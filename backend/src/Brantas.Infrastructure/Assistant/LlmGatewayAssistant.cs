using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Brantas.Analytics.Optimization;
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
    public string Model { get; set; } = "gpt-4.1-mini";
    public double Temperature { get; set; } = 0.3;
    public int MaxOutputTokens { get; set; } = 500;
    public int RequestTimeoutSeconds { get; set; } = 60;
}

public sealed partial class LlmGatewayAssistant : IBrantasAssistant
{
    private static readonly ConcurrentDictionary<Guid, string> MacroContextCache = new();
    private static readonly ConcurrentDictionary<Guid, string> MacroSummaryCache = new();
    private static readonly ConcurrentDictionary<Guid, IReadOnlyDictionary<Guid, AllocationRecommendation>> AllocationMapCache = new();
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

    public const string GentleRefusalMessage = "Mohon maaf, saya tidak bisa membantu untuk hal itu. Saya ditugaskan khusus sebagai Juru Bantuan Sosial Interaktif dengan ruang lingkup analisis data kemiskinan, alokasi anggaran APBN/TKDD, dan rekomendasi kebijakan pada sistem BRANTAS. Terima kasih.";

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

        var version = await _database.DatasetVersions
            .Where(item => item.Status == DatasetStatus.Completed)
            .OrderByDescending(item => item.IngestedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (version is null)
        {
            throw new InvalidOperationException("Dataset aktif belum tersedia.");
        }

        // Strict Guardrail: Pertanyaan di luar domain ditolak secara sopan (Gentle Refusal)
        if (OutOfDomainPattern().IsMatch(question))
        {
            await RecordAuditAsync(question, "GentleRefusal", version.Id, cancellationToken);
            return new AssistantResponse(
                GentleRefusalMessage,
                "Guardrail Sistem BRANTAS",
                version.Id.ToString(),
                version.Period,
                true);
        }

        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            _logger.LogWarning("LLM Gateway ApiKey belum dikonfigurasi. Menggunakan fallback deterministik database.");
            return await _fallbackAssistant.AskAsync(question, cancellationToken);
        }

        try
        {
            var specificRegionContext = await TryBuildSpecificRegionContextAsync(question, version, cancellationToken);
            string combinedContext;
            if (!string.IsNullOrWhiteSpace(specificRegionContext))
            {
                var macroSummary = await GetOrBuildMacroSummaryOnlyAsync(version, cancellationToken);
                combinedContext = $"{specificRegionContext}\n\n{macroSummary}";
            }
            else
            {
                combinedContext = await GetOrBuildMacroContextAsync(version, cancellationToken);
            }

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

PANDUAN UTAMA MENJAWAB (WAJIB DIIKUTI):
1. NARASI DESKRIPTIF RINGKAS & FOKUS (TO-THE-POINT):
   - Jawab langsung inti pertanyaan pengguna di kalimat pertama dengan bahasa Indonesia yang mengalir, lugas, ramah, dan mudah dipahami oleh pengambil kebijakan maupun masyarakat umum.
   - Hindari pembukaan bertele-tele, jangan mengulang disclaimer/pendahuluan, dan hindari statistik teknis yang rumit kecuali diminta secara eksplisit.
   - Panjang jawaban maksimal 150-200 kata agar respon cepat dan langsung dapat dibaca sekilas.
2. DILARANG KERAS MENGGUNAKAN TABEL (SIMBOL PIPA |---|---|):
   - JANGAN PERNAH membuat tabel markdown dengan simbol pipa (|---|---|). Sampaikan seluruh data angka dan indikator dalam bentuk 1 paragraf narasi deskriptif yang rapi dan nyaman dibaca di layar chat.
3. DATA SPESIFIK 38 PROVINSI & 514 KABUPATEN/KOTA TERSEDIA LENGKAP:
   - Sistem BRANTAS memiliki data lengkap seluruh 38 provinsi dan 514 kabupaten/kota se-Indonesia. Jangan pernah menyatakan bahwa data kab/kota tidak tersedia atau belum ada angka resminya.
   - Jika ditanya tentang daerah tertentu (misal Timika / Mimika), sebutkan angka kuncinya secara deskriptif: nama daerah, provinsi induk, tingkat kemiskinan (%), jumlah penduduk miskin (jiwa), IPM, dan risiko bencana (IRBI BNPB).
4. REKOMENDASI KEBIJAKAN RINGKAS & TERUKUR (3 BUTIR BERNOMOR):
   - Sajikan rekomendasi kebijakan dalam 3 butir bernomor ringkas, padat, dan terukur yang langsung mencantumkan angka/persentase/indeks dinamis sesuai profil wilayah yang ditanyakan:
     1. Penetapan Alokasi Afirmatif IKW (UU No. 1/2022 HKPD): Sebutkan skor IKW wilayah, perbandingan pagu eksisting baseline dengan usulan rekomendasi alokasi, serta pergeseran delta (+/- nominal dan %).
     2. Integrasi Perlindungan Sosial Adaptif (ASP): Sebutkan alokasi cadangan darurat kebencanaan 35% (nominal Rp), kategori risiko bencana BNPB dan skor IRBI wilayah.
     3. Pemadanan Terpadu DTKS & Regsosek (Perpres No. 39/2019): Pemadanan berkala data penerima bansos dengan NIK Dukcapil guna mengeliminasi temuan anomali ketimpangan anggaran.
5. FORMAT BOLDING WAJIB PADA CHAT BUBBLE:
   - WAJIB gunakan format **tebal** (**...**) untuk seluruh:
     * Nama wilayah administratif (contoh: **Papua Tengah**, **Kabupaten Mimika**).
     * Angka persentase dan statistik (contoh: **38 provinsi**, **37,53%**, **10,20%**, **+15,40%**).
     * Angka nominal anggaran Rupiah (contoh: **Rp2,45 Triliun**, **Rp500,0 Miliar**, **Rp125,4 Juta**).
     * Jumlah penduduk miskin (contoh: **52.400 jiwa**).
     * Skor indeks dan kategori risiko (contoh: skor IKW **82,45**, IPM **63,20**, kategori **Tinggi**, skor IRBI **0,85**).
     * Payung hukum dan regulasi resmi (contoh: **UU No. 1/2022 HKPD**, **Perpres No. 39/2019**).
6. SISTEM GUARDRAIL KETAT & SIKAP PENOLAKAN OTOMATIS (GENTLE REFUSAL):
   - PEMBATASAN RUANG LINGKUP: Anda adalah asisten khusus yang DIBATASI HANYA untuk menjawab topik seputar proyek BRANTAS, meliputi: analisis data kemiskinan BPS (tingkat kemiskinan, kedalaman P1, keparahan P2, IPM, PDRB per kapita), alokasi anggaran belanja perlindungan sosial APBN & TKDD, anomali fiskal daerah, risiko bencana alam dan Perlindungan Sosial Adaptif (ASP / IRBI BNPB), simulasi alokasi IKW, evaluasi kausalitas (DiD), dan rekomendasi kebijakan resmi BRANTAS.
   - SIKAP PENOLAKAN OTOMATIS (GENTLE REFUSAL): Jika pengguna menanyakan hal di luar cakupan tersebut (misal: trivia umum, politik praktis/pemilu/partai politik, hiburan, musik, film, selebriti, resep masakan, olahraga/sepak bola, ramalan/zodiak, lelucon/cerpen, saran medis/hukum umum, tutorial di luar BRANTAS, atau obrolan santai yang tidak terkait data BRANTAS), Anda WAJIB menolak secara sopan dengan PERSIS menjawab:
   ""Mohon maaf, saya tidak bisa membantu untuk hal itu. Saya ditugaskan khusus sebagai Juru Bantuan Sosial Interaktif dengan ruang lingkup analisis data kemiskinan, alokasi anggaran APBN/TKDD, dan rekomendasi kebijakan pada sistem BRANTAS. Terima kasih.""
   - Dilarang menambahkan kata pengantar lain atau memberikan jawaban spekulatif terhadap topik di luar cakupan BRANTAS.

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
            max_tokens = Math.Clamp(_options.MaxOutputTokens, 200, 600)
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
        if (content.Contains("Mohon maaf, saya tidak bisa membantu untuk hal itu", StringComparison.OrdinalIgnoreCase) ||
            content.Contains("Juru Bantuan Sosial Interaktif", StringComparison.OrdinalIgnoreCase) && (content.Contains("ruang lingkup", StringComparison.OrdinalIgnoreCase) || content.Contains("di luar cakupan", StringComparison.OrdinalIgnoreCase)))
        {
            return GentleRefusalMessage;
        }

        // Auto-enrichment: Pastikan pola persentase dan nominal Rupiah yang belum dibold ter-bolding rapi
        content = Regex.Replace(content, @"(?<!\*)\b(Rp\s?[\d.,]+(?:\s*(?:Triliun|Miliar|Juta))?)(?!\*)", match =>
        {
            int pos = match.Index;
            int starCount = 0;
            for (int i = 0; i < pos; i++)
            {
                if (content[i] == '*' && i + 1 < pos && content[i + 1] == '*')
                {
                    starCount++;
                    i++;
                }
            }
            return starCount % 2 == 1 ? match.Value : $"**{match.Value}**";
        });

        content = Regex.Replace(content, @"(?<!\*)\b([+-]?\d+([.,]\d+)?%)(?!\*)", match =>
        {
            int pos = match.Index;
            int starCount = 0;
            for (int i = 0; i < pos; i++)
            {
                if (content[i] == '*' && i + 1 < pos && content[i + 1] == '*')
                {
                    starCount++;
                    i++;
                }
            }
            return starCount % 2 == 1 ? match.Value : $"**{match.Value}**";
        });

        // Bersihkan jika ada artefak penempelan tanda plus atau bintang dobel
        content = content.Replace("**** ", " ").Replace("****", "");

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

    private async Task<string> GetOrBuildMacroSummaryOnlyAsync(DatasetVersion version, CancellationToken cancellationToken)
    {
        if (MacroSummaryCache.TryGetValue(version.Id, out var cached))
        {
            return cached;
        }

        var sb = new StringBuilder();
        sb.AppendLine("[KONTEKS MAKRO & FORMULA ALOKASI NASIONAL BRANTAS]:");
        sb.AppendLine("- Formula IKW: IKW = 30%*Kemiskinan + 15%*P1 + 15%*P2 + 15%*(100-IPM) + 15%*(-PDRB/Kapita) + 10%*IRBI.");
        sb.AppendLine("- Batasan Stabilitas Fiskal: Total pagu bansos APBN terjaga, Floor Rp500,0 Miliar per daerah, Cap deviasi alokasi maksimal ±25%.");

        var provIndicators = await _database.PovertyIndicators
            .Where(i => i.DatasetVersionId == version.Id && i.Region!.Level == RegionLevel.Province)
            .Select(i => new { i.PovertyRate, i.PoorPopulation, i.HumanDevelopmentIndex })
            .ToListAsync(cancellationToken);

        if (provIndicators.Count > 0)
        {
            var avgPoverty = provIndicators.Average(i => i.PovertyRate);
            var totalPoor = provIndicators.Sum(i => i.PoorPopulation);
            var avgHdi = provIndicators.Average(i => i.HumanDevelopmentIndex);
            sb.AppendLine($"- Rata-rata Kemiskinan Nasional: {avgPoverty:0.00}% | Total Penduduk Miskin Nasional: {totalPoor:N0} jiwa | Rata-rata IPM Nasional: {avgHdi:0.00}.");
        }

        var result = sb.ToString();
        MacroSummaryCache[version.Id] = result;
        return result;
    }

    private async Task<string?> TryBuildSpecificRegionContextAsync(string userQuestion, DatasetVersion version, CancellationToken cancellationToken)
    {
        var regions = await EnsureRegionsLookupAsync(cancellationToken);
        var matched = RegionAliasCatalog.FindBestMatch(
            userQuestion,
            regions,
            r => r.FullName,
            r => r.SearchKey,
            r => r.Level);

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
        var allocMap = await EnsureAllocationsAsync(version.Id, cancellationToken);

        decimal baseline;
        decimal recommended;
        decimal delta;
        decimal deltaPct;
        decimal ikw;

        if (matched.Level == RegionLevel.Province)
        {
            if (allocMap.TryGetValue(matched.Id, out var rec))
            {
                baseline = rec.BaselineAllocation;
                recommended = rec.RecommendedAllocation;
                delta = rec.Delta;
                deltaPct = rec.DeltaPercent;
                ikw = rec.VulnerabilityIndex;
            }
            else
            {
                baseline = await _database.FiscalAllocations
                    .Where(a => a.DatasetVersionId == version.Id && a.RegionId == matched.Id)
                    .Select(a => (decimal?)a.TotalAllocation)
                    .FirstOrDefaultAsync(cancellationToken) ?? 0m;
                recommended = baseline;
                delta = 0m;
                deltaPct = 0m;
                ikw = 50.0m;
            }
        }
        else
        {
            var parentId = matched.ParentId ?? Guid.Empty;
            allocMap.TryGetValue(parentId, out var parentRec);

            var parentTotalPoor = await _database.PovertyIndicators
                .Where(i => i.DatasetVersionId == version.Id && i.Region!.ParentId == parentId)
                .SumAsync(i => (long)i.PoorPopulation, cancellationToken);

            var ratio = parentTotalPoor > 0 ? (decimal)indicator.PoorPopulation / parentTotalPoor : 0.1m;

            if (parentRec != null)
            {
                baseline = Math.Round(parentRec.BaselineAllocation * ratio, 2);
                recommended = Math.Round(parentRec.RecommendedAllocation * ratio, 2);
                delta = recommended - baseline;
                deltaPct = parentRec.DeltaPercent;
                ikw = parentRec.VulnerabilityIndex;
            }
            else
            {
                var parentAlloc = await _database.FiscalAllocations
                    .Where(a => a.DatasetVersionId == version.Id && a.RegionId == parentId)
                    .Select(a => (decimal?)a.TotalAllocation)
                    .FirstOrDefaultAsync(cancellationToken) ?? 0m;

                baseline = Math.Round(parentAlloc * ratio, 2);
                recommended = baseline;
                delta = 0m;
                deltaPct = 0m;
                ikw = 50.0m;
            }
        }

        var bufferAmount = Math.Round(recommended * 0.35m, 2);
        var bufferFormatted = FormatRupiah(bufferAmount);
        var baselineFormatted = FormatRupiah(baseline);
        var recFormatted = FormatRupiah(recommended);
        var deltaSign = delta >= 0 ? "+" : "";
        var deltaFormatted = $"{deltaSign}{FormatRupiah(delta)}";
        var deltaPctFormatted = $"{deltaSign}{deltaPct:0.00}%";

        var sb = new StringBuilder();
        sb.AppendLine($"[DATA TERVERIFIKASI SPESIFIK WILAYAH: {matched.FullName.ToUpperInvariant()}]:");
        sb.AppendLine($"- Wilayah Administratif Resmi: **{matched.FullName}**{(matched.Level == RegionLevel.Regency && !string.IsNullOrWhiteSpace(matched.ParentName) ? $" (Provinsi **{matched.ParentName}**)" : "")}");
        sb.AppendLine($"- Tingkat Wilayah: {(matched.Level == RegionLevel.Province ? "Provinsi" : "Kabupaten/Kota")}");
        sb.AppendLine($"- Tingkat Kemiskinan: **{indicator.PovertyRate:0.00}%**");
        sb.AppendLine($"- Jumlah Penduduk Miskin: **{indicator.PoorPopulation:N0} jiwa**");
        sb.AppendLine($"- Indeks Pembangunan Manusia (IPM): **{indicator.HumanDevelopmentIndex:0.00}**");
        sb.AppendLine($"- PDRB per Kapita: **Rp{indicator.GdpPerCapita:0.00} Juta / tahun**");
        sb.AppendLine($"- Indeks Risiko Bencana (IRBI BNPB): Kategori **{disaster.Category}** (Skor IRBI **{disaster.Score:0.00}**)");
        sb.AppendLine($"- Pagu Anggaran Eksisting (Baseline APBN): **{baselineFormatted}**");
        sb.AppendLine($"- Usulan Alokasi Afirmatif IKW: **{recFormatted}** (Pergeseran alokasi: **{deltaFormatted}** atau **{deltaPctFormatted}**)");
        sb.AppendLine($"- Skor Indeks Kerentanan Wilayah (IKW): **{ikw:0.00}**");
        sb.AppendLine($"- Cadangan Perlindungan Sosial Adaptif (ASP Buffer 35%): **{bufferFormatted}** (Kesiapsiagaan darurat bencana kategori **{disaster.Category}**)");
        sb.AppendLine();
        sb.AppendLine("- Panduan Butir Rekomendasi Kebijakan Terarah (Wajib Disajikan dalam 3 Poin Bernomor Ringkas & Wajib Mencantumkan Statistik Dinamis di Atas):");
        sb.AppendLine($"  1. **Penetapan Alokasi Afirmatif IKW (UU No. 1/2022 HKPD)**: Tetapkan pagu alokasi afirmatif berbasis skor IKW **{ikw:0.00}** sebesar **{recFormatted}** (penyesuaian **{deltaFormatted}** / **{deltaPctFormatted}** dari baseline **{baselineFormatted}**) guna redistribusi yang adil.");
        sb.AppendLine($"  2. **Integrasi Perlindungan Sosial Adaptif (ASP)**: Alokasikan cadangan darurat kebencanaan 35% sebesar **{bufferFormatted}** pada zona risiko **{disaster.Category}** (skor IRBI **{disaster.Score:0.00}**) agar bantuan tunai siap disalurkan saat terjadi guncangan bencana.");
        sb.AppendLine($"  3. **Pemadanan Terpadu DTKS & Regsosek (Perpres No. 39/2019)**: Lakukan pemadanan berkala penerima bansos dengan NIK Dukcapil guna mengeliminasi temuan ketimpangan anggaran dan memastikan sasaran tepat.");

        return sb.ToString();
    }

    private async Task<IReadOnlyDictionary<Guid, AllocationRecommendation>> EnsureAllocationsAsync(Guid versionId, CancellationToken cancellationToken)
    {
        if (AllocationMapCache.TryGetValue(versionId, out var cached))
            return cached;

        var rawObservations = await (
            from ind in _database.PovertyIndicators
            join alloc in _database.FiscalAllocations on ind.RegionId equals alloc.RegionId
            where ind.DatasetVersionId == versionId && alloc.DatasetVersionId == versionId && ind.Region!.Level == RegionLevel.Province
            select new
            {
                ind.RegionId,
                RegionName = ind.Region!.Name,
                BpsCode = ind.Region.BpsCode,
                ind.PovertyRate,
                ind.PovertyDepthIndex,
                ind.PovertySeverityIndex,
                ind.HumanDevelopmentIndex,
                ind.GdpPerCapita,
                ind.PoorPopulation,
                alloc.TotalAllocation
            }).ToListAsync(cancellationToken);

        if (rawObservations.Count == 0)
            return new Dictionary<Guid, AllocationRecommendation>();

        var observations = rawObservations.Select(item => new AllocationObservation(
            item.RegionId,
            item.RegionName,
            item.PovertyRate,
            item.PovertyDepthIndex,
            item.PovertySeverityIndex,
            item.HumanDevelopmentIndex,
            item.GdpPerCapita,
            DisasterRiskRepository.GetDisasterRisk(item.BpsCode).Score,
            item.PoorPopulation,
            item.TotalAllocation)).ToList();

        var weights = new AllocationWeights(30m, 15m, 15m, 15m, 15m, 10m);
        var totalBudget = observations.Sum(item => item.BaselineAllocation);
        var optResult = new AllocationOptimizer().Optimize(observations, weights, totalBudget, 500m, 0.25m);

        var dict = optResult.Recommendations.ToDictionary(r => r.RegionId);
        AllocationMapCache[versionId] = dict;
        return dict;
    }

    private static string FormatRupiah(decimal valJuta)
    {
        var valMiliar = valJuta / 1000m;
        if (valMiliar >= 1000m)
            return $"Rp{(valMiliar / 1000m):0.00} Triliun";
        if (valMiliar >= 1m)
            return $"Rp{valMiliar:0.0} Miliar";
        return $"Rp{valJuta:N0} Juta";
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

    [GeneratedRegex(@"(politik praktis|partai politik|pemilu|pilpres|caleg|capres|menteri|presiden luar negeri|siapa presiden|hiburan|film|bioskop|lagu|musik|selebriti|artis|gosip|resep|masak|kuliner|olahraga|sepak bola|klub bola|zodiak|ramalan|lelucon|humor|cerpen|puisi|saran hukum|saran medis|resep obat|dokter|game|gaming|pariwisata|cuaca hari ini|chord gitar|lirik lagu|sinopsis)", RegexOptions.IgnoreCase)]
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

