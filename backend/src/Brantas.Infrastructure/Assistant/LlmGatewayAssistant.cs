using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Brantas.Application.Assistant;
using Brantas.Domain.Entities;
using Brantas.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Brantas.Infrastructure.Assistant;

public sealed class LlmGatewayOptions
{
    public string BaseUrl { get; set; } = "https://ai.sumopod.com/v1";
    public string StreamingBaseUrl { get; set; } = "https://ai.sumopod.com/v1";
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "qwen3.8-flash";
    public double Temperature { get; set; } = 0.7;
    public int MaxOutputTokens { get; set; } = 8000;
    public int RequestTimeoutSeconds { get; set; } = 120;
}

public sealed partial class LlmGatewayAssistant : IBrantasAssistant
{
    private static readonly ConcurrentDictionary<Guid, string> MacroContextCache = new();
    private static List<RegionLookupItem>? CachedRegions;
    private static readonly SemaphoreSlim RegionCacheLock = new(1, 1);

    private readonly BrantasDbContext _database;
    private readonly HttpClient _httpClient;
    private readonly LlmGatewayOptions _options;
    private readonly DatabaseGroundedAssistant _fallbackAssistant;
    private readonly ILogger<LlmGatewayAssistant> _logger;

    public LlmGatewayAssistant(
        BrantasDbContext database,
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<LlmGatewayAssistant> logger)
    {
        _database = database;
        _httpClient = httpClient;
        _logger = logger;
        _fallbackAssistant = new DatabaseGroundedAssistant(database);

        _options = new LlmGatewayOptions();
        var section = configuration.GetSection("LlmGateway");
        if (section.Exists())
        {
            section.Bind(_options);
        }

        var envKey = Environment.GetEnvironmentVariable("LLM_API_KEY");
        if (!string.IsNullOrWhiteSpace(envKey))
        {
            _options.ApiKey = envKey;
        }

        if (!string.IsNullOrWhiteSpace(_options.BaseUrl))
        {
            _httpClient.BaseUrlOrTimeout(_options.BaseUrl, _options.RequestTimeoutSeconds);
        }
    }

    public async Task<AssistantResponse> AskAsync(string question, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(question))
        {
            await RecordAuditAsync(string.Empty, "Rejected", null, cancellationToken);
            throw new ArgumentException("Pertanyaan tidak boleh kosong.");
        }
        if (IdentityNumberPattern().IsMatch(question))
        {
            await RecordAuditAsync(question, "Rejected", null, cancellationToken);
            throw new InvalidOperationException("Pertanyaan tidak dapat diproses karena memuat pola identitas pribadi.");
        }
        if (OutOfDomainPattern().IsMatch(question))
        {
            await RecordAuditAsync(question, "Rejected", null, cancellationToken);
            throw new InvalidOperationException("JUSI hanya melayani pertanyaan tentang data kemiskinan, anggaran sosial, anomali, peta spasial, formula alokasi, dan evaluasi kebijakan BRANTAS.");
        }

        var version = await _database.DatasetVersions
            .Where(item => item.Status == DatasetStatus.Completed)
            .OrderByDescending(item => item.IngestedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (version is null)
        {
            throw new InvalidOperationException("Dataset aktif belum tersedia.");
        }

        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            _logger.LogWarning("LLM Gateway ApiKey belum dikonfigurasi. Menggunakan fallback deterministik database.");
            return await _fallbackAssistant.AskAsync(question, cancellationToken);
        }

        try
        {
            var macroContext = await GetOrBuildMacroContextAsync(version, cancellationToken);
            var specificRegionContext = await TryBuildSpecificRegionContextAsync(question, version, cancellationToken);

            var combinedContext = string.IsNullOrWhiteSpace(specificRegionContext)
                ? macroContext
                : $"{specificRegionContext}\n\n{macroContext}";

            var answer = await CallLlmGatewayAsync(question, combinedContext, cancellationToken);
            
            EnsureSafeResponse(answer);
            await RecordAuditAsync(question, "Succeeded", version.Id, cancellationToken);

            return new AssistantResponse(
                answer,
                $"LLM Gateway ({_options.Model}) + Database BRANTAS",
                version.Id.ToString(),
                version.Period,
                false);
        }
        catch (Exception ex) when (ex is not InvalidOperationException && ex is not ArgumentException)
        {
            _logger.LogError(ex, "Gagal menghubungi LLM Gateway. Mengalihkan ke fallback database deterministik.");
            var fallback = await _fallbackAssistant.AskAsync(question, cancellationToken);
            return fallback with { Source = "Database BRANTAS (Gateway Fallback)" };
        }
    }

    private async Task<string> CallLlmGatewayAsync(string userQuestion, string verifiedContext, CancellationToken cancellationToken)
    {
        var endpoint = $"{_options.BaseUrl.TrimEnd('/')}/chat/completions";
        var todayStr = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).ToString("dddd, d MMMM yyyy", new System.Globalization.CultureInfo("id-ID"));

        var systemPrompt = $@"Anda adalah JUSI (Juru Bantuan Sosial Interaktif), asisten analitik cerdas Kementerian Keuangan RI untuk sistem BRANTAS (Bantuan Rasional, Adaptif, Nirkorupsi, Terarah, dan Akuntabel untuk Kesejahteraan Sosial).
Waktu sistem hari ini: {todayStr}.

PANDUAN UTAMA MENJAWAB:
1. DATA VALID & TERVERIFIKASI (ZERO HALLUCINATION):
   - Gunakan data dan fakta dari DATA TERVERIFIKASI BRANTAS di bawah ini. Jangan pernah mengarang angka kemiskinan, alokasi anggaran, atau indikator wilayah.
   - Jika ditanya tentang provinsi atau kabupaten/kota tertentu, sebutkan angka-angka kuncinya (tingkat kemiskinan, penduduk miskin, IPM, alokasi APBN, risiko bencana IRBI BNPB, dan rekomendasi kebijakan).
2. FORMAT PENEKANAN DATA KUNCI:
   - Beri tanda tebal menggunakan Markdown **kata kunci** untuk angka, nama daerah, persentase, skor bencana, status klaster, dan rekomendasi penting (contoh: **Provinsi Banten**, **6,10%**, **Rp1.450 Miliar**, **Risiko Tinggi**).
3. FORMULA & METODOLOGI:
   - Jika ditanya dasar perhitungan atau klasifikasi formula, jelaskan 6 variabel IKW (Kemiskinan 30%, Kedalaman 15%, Keparahan 15%, Kesenjangan IPM 15%, Inverse PDRB 15%, Risiko Bencana 10%), solver optimasi Linear Programming GLOP Google OR-Tools, serta batasan stabilitas fiskal (floor Rp500M & cap pergerakan ±25%).
4. REKOMENDASI KEBIJAKAN:
   - Jika ditanya rekomendasi kebijakan untuk suatu wilayah, berikan justifikasi kebijakan berbasis bukti (evidence-based) yang mencakup:
     a) Penyesuaian porsi pagu anggaran bansos berbasis IKW dan kemiskinan riil.
     b) Kebijakan perlindungan sosial adaptif kebencanaan (IRBI BNPB).
     c) Intervensi spasial (program padat karya jika hotspot High-High, atau proteksi perlinsos adaptif jika coldspot Low-Low).
     d) Pengawasan dan audit data penerima (mitigasi anomali ASN, penerima fiktif/meninggal, dan aset ekonomi).
5. GAYA KOMUNIKASI:
   - Lugas, profesional, analitis, berbasis data, dan terstruktur rapi (gunakan bullet point atau paragraf teratur).

DATA TERVERIFIKASI BRANTAS (Maret 2026):
{verifiedContext}";

        var requestBody = new
        {
            model = _options.Model,
            messages = new object[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userQuestion }
            },
            temperature = _options.Temperature,
            max_tokens = Math.Clamp(_options.MaxOutputTokens, 800, 2000)
        };

        _logger.LogInformation("Mengirim request ke LLM Gateway: {Endpoint}, Model: {Model}", endpoint, _options.Model);

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey.Trim());
        request.Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("LLM Gateway HTTP {StatusCode}: {ErrorBody}", response.StatusCode, json);
            response.EnsureSuccessStatusCode();
        }
        using var doc = JsonDocument.Parse(json);
        var content = doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString() ?? string.Empty;

        content = Regex.Replace(content, @"<think>[\s\S]*?</think>", string.Empty).Trim();
        return content;
    }

    private async Task<string> GetOrBuildMacroContextAsync(DatasetVersion version, CancellationToken cancellationToken)
    {
        if (MacroContextCache.TryGetValue(version.Id, out var cached))
        {
            return cached;
        }

        var sb = new StringBuilder();

        // 1. Formula & Metodologi Alokasi BRANTAS
        sb.AppendLine("[METODOLOGI FORMULA ALOKASI & INDEKS KERENTANAN WILAYAH (IKW)]:");
        sb.AppendLine("- Formula IKW: IKW = w1*Kemiskinan + w2*P1(Kedalaman) + w3*P2(Keparahan) + w4*(100-IPM) + w5*(-PDRB/Kapita) + w6*IRBI(Risiko Bencana).");
        sb.AppendLine("- Bobot Default Formula: Tingkat Kemiskinan (30%), Kedalaman Kemiskinan (15%), Keparahan Kemiskinan (15%), Kesenjangan IPM (15%), Inverse PDRB/Kapita (15%), Indeks Risiko Bencana IRBI BNPB (10%).");
        sb.AppendLine("- Solver Optimasi: Google OR-Tools GLOP (Linear Programming) untuk meminimalkan deviasi alokasi terhadap alokasi ideal proporsional berbasis (IKW * Penduduk Miskin).");
        sb.AppendLine("- Batasan Stabilitas Fiskal: Total pagu belanja perlindungan sosial APBN tetap terjaga, Pagu Minimum Wilayah (Floor) Rp500,0 Miliar per daerah, dan Batas Toleransi Deviasi (Cap) maksimal ±25% dari alokasi eksisting.");
        sb.AppendLine("- Klasifikasi Klaster Spasial (LISA Moran's I): High-High (Hotspot Kemiskinan Regional), Low-Low (Coldspot Sejahtera), High-Low & Low-High (Outlier Spasial).");
        sb.AppendLine("- Evaluasi Dampak Kebijakan (Difference-in-Differences / DiD): Model panel Two-Way Fixed Effects (TWFE) membuktikan intervensi bansos menurunkan kemiskinan sebesar 0,45 poin persentase (p < 0.0001) dengan efektivitas biaya 38,47 pp per Rp1 Triliun dan uji tren paralel valid.");

        // 2. Poverty indicators 38 Provinsi
        var provIndicators = await _database.PovertyIndicators
            .Include(i => i.Region)
            .Where(i => i.DatasetVersionId == version.Id && i.Region!.Level == RegionLevel.Province)
            .OrderBy(i => i.Region!.Name)
            .ToListAsync(cancellationToken);

        var provAllocations = await _database.FiscalAllocations
            .Where(a => a.DatasetVersionId == version.Id)
            .ToDictionaryAsync(a => a.RegionId, a => a.TotalAllocation, cancellationToken);

        if (provIndicators.Count > 0)
        {
            var avgPoverty = provIndicators.Average(i => i.PovertyRate);
            var totalPoor = provIndicators.Sum(i => i.PoorPopulation);
            var highest = provIndicators.OrderByDescending(i => i.PovertyRate).First();
            var lowest = provIndicators.OrderBy(i => i.PovertyRate).First();
            var avgHdi = provIndicators.Average(i => i.HumanDevelopmentIndex);
            var totalAlloc = provAllocations.Values.Sum();

            sb.AppendLine();
            sb.AppendLine($"[AGREGAT NASIONAL 38 PROVINSI]:");
            sb.AppendLine($"- Rata-rata Kemiskinan Nasional: {avgPoverty:0.00}% | Total Penduduk Miskin: {totalPoor:N0} jiwa | Rata-rata IPM: {avgHdi:0.00}.");
            sb.AppendLine($"- Provinsi Kemiskinan Tertinggi: {highest.Region!.Name} ({highest.PovertyRate:0.00}%, {highest.PoorPopulation:N0} jiwa) | Terendah: {lowest.Region!.Name} ({lowest.PovertyRate:0.00}%).");
            sb.AppendLine($"- Total Pagu Belanja Bansos APBN: Rp{totalAlloc:N0} Juta.");

            sb.AppendLine();
            sb.AppendLine($"[KATALOG TERLENGKAP 38 PROVINSI (Kemiskinan, Penduduk Miskin, IPM, PDRB/Kapita, Alokasi APBN, Risiko Bencana IRBI BNPB)]:");
            foreach (var p in provIndicators)
            {
                var alloc = provAllocations.TryGetValue(p.RegionId, out var val) ? val : 0m;
                var risk = DisasterRiskRepository.GetDisasterRisk(p.Region!.BpsCode);
                sb.AppendLine($"- {p.Region.Name} (Kode BPS {p.Region.BpsCode}): Kemiskinan {p.PovertyRate:0.00}%, Miskin {p.PoorPopulation:N0} jiwa, IPM {p.HumanDevelopmentIndex:0.00}, PDRB Rp{p.GdpPerCapita:0.00} Jt, Pagu APBN Rp{alloc:N0} Jt, IRBI {risk.Score:0.00} ({risk.Category}), P1 {p.PovertyDepthIndex:0.000}, P2 {p.PovertySeverityIndex:0.000}.");
            }
        }

        // 3. Fiscal Anomalies
        var anomalies = await _database.Anomalies
            .Include(a => a.Region)
            .Where(a => a.DatasetVersionId == version.Id)
            .ToListAsync(cancellationToken);

        if (anomalies.Count > 0)
        {
            var totalVar = anomalies.Sum(a => a.ValueAtRisk);
            var under = anomalies.Where(a => a.Type == AnomalyType.FiscalUnderAllocation).Select(a => $"{a.Region!.Name} (Rp{a.ValueAtRisk:N0}jt)");
            var over = anomalies.Where(a => a.Type == AnomalyType.FiscalOverAllocation).Select(a => $"{a.Region!.Name} (Rp{a.ValueAtRisk:N0}jt)");

            sb.AppendLine();
            sb.AppendLine($"[TEMUAN ANOMALI FISKAL BRANTAS]: Total {anomalies.Count} temuan daerah berisiko, Total Nilai Rp at Risk: Rp{totalVar:N0} Juta.");
            sb.AppendLine($"- Under-allocation (Kurang Alokasi vs Tingkat Kemiskinan): {string.Join(", ", under)}.");
            sb.AppendLine($"- Over-allocation (Kelebihan Alokasi vs Tingkat Kemiskinan): {string.Join(", ", over)}.");
        }

        // 4. Beneficiaries Summary
        var benSummary = await _database.BeneficiaryRecords
            .Where(b => b.DatasetVersionId == version.Id)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Asn = g.Count(b => b.IsActivePublicServant),
                Deceased = g.Count(b => b.IsDeceased),
                Assets = g.Count(b => b.HasEconomicAsset)
            }).FirstOrDefaultAsync(cancellationToken);

        if (benSummary != null)
        {
            sb.AppendLine();
            sb.AppendLine($"[TEMUAN ANOMALI KEPESERTAAN BANSOS]: Total {benSummary.Total:N0} data uji penerima. Temuan: ASN Aktif {benSummary.Asn:N0} orang, Meninggal Dunia {benSummary.Deceased:N0} orang, Memiliki Aset Ekonomi {benSummary.Assets:N0} orang.");
        }

        var result = sb.ToString();
        MacroContextCache[version.Id] = result;
        return result;
    }

    private async Task<string?> TryBuildSpecificRegionContextAsync(string userQuestion, DatasetVersion version, CancellationToken cancellationToken)
    {
        var regions = await EnsureRegionsLookupAsync(cancellationToken);
        var normalized = userQuestion.ToLowerInvariant();

        // Cari pencocokan wilayah dengan nama terpanjang terlebih dahulu
        var matched = regions
            .OrderByDescending(r => r.SearchKey.Length)
            .FirstOrDefault(r => normalized.Contains(r.SearchKey));

        if (matched is null)
        {
            return null;
        }

        var indicator = await _database.PovertyIndicators
            .Include(i => i.Region)
            .FirstOrDefaultAsync(i => i.DatasetVersionId == version.Id && i.RegionId == matched.Id, cancellationToken);

        if (indicator is null)
        {
            return null;
        }

        var disaster = DisasterRiskRepository.GetDisasterRisk(matched.BpsCode);
        var sb = new StringBuilder();
        sb.AppendLine($"[DATA TERVERIFIKASI SPESIFIK WILAYAH: {matched.FullName.ToUpperInvariant()}]:");
        sb.AppendLine($"- Tingkat Wilayah: {(matched.Level == RegionLevel.Province ? "Provinsi" : "Kabupaten/Kota")}");
        if (matched.Level == RegionLevel.Regency && !string.IsNullOrWhiteSpace(matched.ParentName))
        {
            sb.AppendLine($"- Provinsi Induk: {matched.ParentName}");
        }
        sb.AppendLine($"- Kode Wilayah BPS: {matched.BpsCode}");
        sb.AppendLine($"- Tingkat Kemiskinan: {indicator.PovertyRate:0.00}%");
        sb.AppendLine($"- Jumlah Penduduk Miskin: {indicator.PoorPopulation:N0} jiwa");
        sb.AppendLine($"- Indeks Kedalaman Kemiskinan (P1): {indicator.PovertyDepthIndex:0.0000}");
        sb.AppendLine($"- Indeks Keparahan Kemiskinan (P2): {indicator.PovertySeverityIndex:0.0000}");
        sb.AppendLine($"- Indeks Pembangunan Manusia (IPM): {indicator.HumanDevelopmentIndex:0.00}");
        sb.AppendLine($"- Pendapatan Regional (PDRB) / Kapita: Rp{indicator.GdpPerCapita:0.00} Juta / tahun");
        sb.AppendLine($"- Indeks Risiko Bencana (IRBI BNPB): Skor {disaster.Score:0.00} (Kategori: {disaster.Category})");

        if (matched.Level == RegionLevel.Province)
        {
            var alloc = await _database.FiscalAllocations
                .Where(a => a.DatasetVersionId == version.Id && a.RegionId == matched.Id)
                .Select(a => (decimal?)a.TotalAllocation)
                .FirstOrDefaultAsync(cancellationToken) ?? 0m;
            sb.AppendLine($"- Alokasi Pagu Bansos APBN: Rp{alloc:N0} Juta");

            var anomaly = await _database.Anomalies
                .Where(a => a.DatasetVersionId == version.Id && a.RegionId == matched.Id)
                .FirstOrDefaultAsync(cancellationToken);
            if (anomaly != null)
            {
                sb.AppendLine($"- Status Anomali Fiskal: Terdeteksi {anomaly.Type} dengan Nilai Berisiko Rp{anomaly.ValueAtRisk:N0} Juta (z-score: {anomaly.ZScore:0.00})");
            }
            else
            {
                sb.AppendLine("- Status Anomali Fiskal: Tidak ditemukan anomali signifikan (Alokasi proporsional terhadap tingkat kemiskinan)");
            }
        }
        else
        {
            // Untuk Kabupaten/Kota, hitung estimasi alokasi proporsional daerah dari pagu provinsi induknya
            var parentAlloc = await _database.FiscalAllocations
                .Where(a => a.DatasetVersionId == version.Id && a.RegionId == matched.ParentId)
                .Select(a => (decimal?)a.TotalAllocation)
                .FirstOrDefaultAsync(cancellationToken) ?? 0m;

            var parentTotalPoor = await _database.PovertyIndicators
                .Where(i => i.DatasetVersionId == version.Id && i.Region!.ParentId == matched.ParentId)
                .SumAsync(i => (long)i.PoorPopulation, cancellationToken);

            if (parentTotalPoor > 0 && parentAlloc > 0)
            {
                var estRegencyAlloc = Math.Round(parentAlloc * indicator.PoorPopulation / parentTotalPoor, 2);
                sb.AppendLine($"- Estimasi Alokasi Proporsional Bansos Wilayah: Rp{estRegencyAlloc:N0} Juta (dari pagu induk {matched.ParentName} Rp{parentAlloc:N0} Juta)");
            }
        }

        // Susun Rekomendasi Kebijakan Terinci Berdasarkan Profil Daerah
        sb.AppendLine("- Rekomendasi Kebijakan Terpadu BRANTAS:");
        if (disaster.Score >= 0.70m)
        {
            sb.AppendLine($"  * Perlindungan Sosial Adaptif Bencana: Wilayah memiliki risiko bencana tinggi/sangat tinggi ({disaster.Category}, skor {disaster.Score:0.00}), disarankan mengintegrasikan cadangan darurat (buffer stock bantuan logistik) dan skema cash-transfer pascabencana.");
        }
        if (indicator.PovertyRate >= 12.0m)
        {
            sb.AppendLine($"  * Intervensi Kemiskinan Struktural: Tingkat kemiskinan tinggi ({indicator.PovertyRate:0.00}%), rekomendasikan kombinasi bantuan pemenuhan kebutuhan dasar reguler (PKH/Sembako) dengan program padat karya produktif.");
        }
        else
        {
            sb.AppendLine($"  * Pemberdayaan & Ketahanan Ekonomi: Tingkat kemiskinan relatif terkendali ({indicator.PovertyRate:0.00}%), fokus pada perlindungan kelompok rentan dan program graduasi kemiskinan melalui akses permodalan UMKM.");
        }
        if (indicator.HumanDevelopmentIndex < 70.0m)
        {
            sb.AppendLine($"  * Penguatan Indeks Pembangunan Manusia: IPM daerah ({indicator.HumanDevelopmentIndex:0.00}) di bawah rata-rata nasional, prioritaskan bantuan bersyarat sektor pendidikan vokasi dan intervensi kesehatan/stunting.");
        }

        return sb.ToString();
    }

    private async Task<List<RegionLookupItem>> EnsureRegionsLookupAsync(CancellationToken cancellationToken)
    {
        if (CachedRegions != null)
        {
            return CachedRegions;
        }

        await RegionCacheLock.WaitAsync(cancellationToken);
        try
        {
            if (CachedRegions != null)
            {
                return CachedRegions;
            }

            var list = await _database.Regions
                .Include(r => r.Parent)
                .Select(r => new RegionLookupItem(
                    r.Id,
                    r.Name,
                    r.BpsCode,
                    r.Level,
                    r.ParentId,
                    r.Parent != null ? r.Parent.Name : null,
                    r.Name.Replace("Kab. ", "").Replace("Kota ", "").Trim().ToLowerInvariant()
                ))
                .ToListAsync(cancellationToken);

            CachedRegions = list;
            return list;
        }
        finally
        {
            RegionCacheLock.Release();
        }
    }

    private static void EnsureSafeResponse(string answer)
    {
        if (IdentityNumberPattern().IsMatch(answer) || IdentityHashPattern().IsMatch(answer))
        {
            throw new InvalidOperationException("Respons JUSI ditahan karena berpotensi memuat identitas pribadi.");
        }
    }

    private async Task RecordAuditAsync(string question, string outcome, Guid? datasetVersionId, CancellationToken cancellationToken)
    {
        var requestHash = SHA256.HashData(Encoding.UTF8.GetBytes(question.Trim()));
        _database.AssistantAuditLogs.Add(new AssistantAuditLog
        {
            DatasetVersionId = datasetVersionId,
            RequestHash = Convert.ToHexString(requestHash).ToLowerInvariant(),
            Outcome = outcome
        });
        await _database.SaveChangesAsync(cancellationToken);
    }

    [GeneratedRegex("\\b\\d{16}\\b")]
    private static partial Regex IdentityNumberPattern();

    [GeneratedRegex("\\b[a-fA-F0-9]{64}\\b")]
    private static partial Regex IdentityHashPattern();

    [GeneratedRegex("politik praktis|partai politik|opini pribadi|hiburan|saran hukum", RegexOptions.IgnoreCase)]
    private static partial Regex OutOfDomainPattern();
}

public sealed record RegionLookupItem(
    Guid Id,
    string FullName,
    string BpsCode,
    RegionLevel Level,
    Guid? ParentId,
    string? ParentName,
    string SearchKey);

internal static class HttpClientExtensions
{
    public static void BaseUrlOrTimeout(this HttpClient client, string baseUrl, int timeoutSeconds)
    {
        client.Timeout = TimeSpan.FromSeconds(timeoutSeconds > 0 ? timeoutSeconds : 60);
    }
}

