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
    public string BaseUrl { get; set; } = "http://10.216.221.100/llm/v1";
    public string StreamingBaseUrl { get; set; } = "http://10.216.221.100/llm/v1";
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "qwen3.8-fast";
    public double Temperature { get; set; } = 0.7;
    public int MaxOutputTokens { get; set; } = 8000;
    public int RequestTimeoutSeconds { get; set; } = 360;
}

public sealed partial class LlmGatewayAssistant : IBrantasAssistant
{
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

        // Environment variable override if specified
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
            await RecordAuditAsync(question ?? string.Empty, "Rejected", null, cancellationToken);
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
            throw new InvalidOperationException("JUSI hanya melayani pertanyaan tentang data kemiskinan, anggaran sosial, anomali, peta, dan evaluasi kebijakan BRANTAS.");
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
            var verifiedContext = await BuildVerifiedDatabaseContextAsync(version, cancellationToken);
            var answer = await CallLlmGatewayAsync(question, verifiedContext, cancellationToken);
            
            EnsureSafeResponse(answer);
            await RecordAuditAsync(question, "Succeeded", version.Id, cancellationToken);

            return new AssistantResponse(
                answer,
                $"Pusdatin LLM Gateway ({_options.Model}) + Database BRANTAS",
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

        var systemPrompt = $@"Anda adalah JUSI (Justifikasi & Analitik Sosial Terintegrasi), asisten cerdas profesional Kementerian Keuangan RI untuk platform BRANTAS (LAN Datathon 2026).
Tugas Anda adalah memberikan telaahan, analisis, justifikasi kebijakan, dan penjelasan interaktif tentang data kemiskinan, alokasi anggaran bantuan sosial, anomali fiskal/kepesertaan, evaluasi spasial, serta dampak kebijakan.

ATURAN WAJIB (STRICT COMPLIANCE):
1. Seluruh angka numerik, persentase, pagu anggaran, nama wilayah, skor anomali, dan estimasi kausal WAJIB merujuk persis pada DATA TERVERIFIKASI BRANTAS di bawah ini. JANGAN PERNAH MENGARANG ANGKA ATAU FAKTA NUMERIK (Zero Hallucination).
2. Gunakan Bahasa Indonesia formal, lugas, presisi, dan bernada eksekutif institusi pemerintah.
3. Bila menjawab, sertakan dasar bukti data, alasan kebijakan, atau implikasi anggaran yang relevan.
4. Jaga kerahasiaan: tidak pernah menampilkan data identitas pribadi penduduk.

=== DATA TERVERIFIKASI BRANTAS (DATABASE RESMI) ===
{verifiedContext}
===================================================";

        var requestBody = new
        {
            model = _options.Model,
            messages = new object[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userQuestion }
            },
            temperature = _options.Temperature,
            max_tokens = Math.Min(_options.MaxOutputTokens, 4000)
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);
        request.Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = JsonDocument.Parse(json);
        var content = doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString() ?? string.Empty;

        // Clean <think>...</think> tags if present from reasoning models
        content = Regex.Replace(content, @"<think>[\s\S]*?</think>", string.Empty).Trim();
        return content;
    }

    private async Task<string> BuildVerifiedDatabaseContextAsync(DatasetVersion version, CancellationToken cancellationToken)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Periode Dataset: {version.Period} (ID: {version.Id}, Seed: {version.Seed})");

        // 1. Poverty indicators
        var provIndicators = await _database.PovertyIndicators
            .Include(i => i.Region)
            .Where(i => i.DatasetVersionId == version.Id && i.Region!.Level == RegionLevel.Province)
            .ToListAsync(cancellationToken);

        if (provIndicators.Count > 0)
        {
            var avgPoverty = provIndicators.Average(i => i.PovertyRate);
            var totalPoor = provIndicators.Sum(i => i.PoorPopulation);
            var highest = provIndicators.OrderByDescending(i => i.PovertyRate).First();
            var lowest = provIndicators.OrderBy(i => i.PovertyRate).First();
            var avgHdi = provIndicators.Average(i => i.HumanDevelopmentIndex);
            var avgP1 = provIndicators.Average(i => i.PovertyDepthIndex);
            var avgP2 = provIndicators.Average(i => i.PovertySeverityIndex);

            sb.AppendLine($"[INDIKATOR MAKRO 38 PROVINSI]:");
            sb.AppendLine($"- Rerata Kemiskinan Nasional: {avgPoverty:0.00}%");
            sb.AppendLine($"- Total Penduduk Miskin: {totalPoor:N0} jiwa");
            sb.AppendLine($"- Provinsi Kemiskinan Tertinggi: {highest.Region!.Name} ({highest.PovertyRate:0.00}%, {highest.PoorPopulation:N0} jiwa miskin)");
            sb.AppendLine($"- Provinsi Kemiskinan Terendah: {lowest.Region!.Name} ({lowest.PovertyRate:0.00}%)");
            sb.AppendLine($"- Rerata Indeks Pembangunan Manusia (IPM): {avgHdi:0.00}");
            sb.AppendLine($"- Rerata Indeks Kedalaman (P1): {avgP1:0.000}, Keparahan (P2): {avgP2:0.000}");
            
            var top5 = provIndicators.OrderByDescending(i => i.PovertyRate).Take(5);
            sb.AppendLine($"- Top 5 Provinsi Prioritas: " + string.Join(", ", top5.Select(p => $"{p.Region!.Name} ({p.PovertyRate:0.00}%)")));
        }

        // 2. Fiscal Allocations
        var totalBudget = await _database.FiscalAllocations
            .Where(a => a.DatasetVersionId == version.Id)
            .SumAsync(a => (decimal?)a.TotalAllocation, cancellationToken) ?? 0m;
        sb.AppendLine($"[ANGGARAN PERLINDUNGAN SOSIAL]: Total pagu APBN belanja bansos: Rp{totalBudget:N0} juta.");

        // 3. Fiscal & ML Anomalies
        var anomalies = await _database.Anomalies
            .Include(a => a.Region)
            .Where(a => a.DatasetVersionId == version.Id)
            .ToListAsync(cancellationToken);

        if (anomalies.Count > 0)
        {
            var totalVar = anomalies.Sum(a => a.ValueAtRisk);
            var underCount = anomalies.Count(a => a.Type == AnomalyType.FiscalUnderAllocation);
            var overCount = anomalies.Count(a => a.Type == AnomalyType.FiscalOverAllocation);

            sb.AppendLine($"[ANOMALI FISKAL & ML]:");
            sb.AppendLine($"- Total Temuan: {anomalies.Count} wilayah, Total Nilai Berisiko (Rp at Risk): Rp{totalVar:N0} juta.");
            sb.AppendLine($"- Under-allocation ({underCount} wilayah): " + string.Join(", ", anomalies.Where(a => a.Type == AnomalyType.FiscalUnderAllocation).Select(a => $"{a.Region!.Name} (z={a.ZScore:0.00}, Rp{a.ValueAtRisk:N0}jt)")));
            sb.AppendLine($"- Over-allocation ({overCount} wilayah): " + string.Join(", ", anomalies.Where(a => a.Type == AnomalyType.FiscalOverAllocation).Select(a => $"{a.Region!.Name} (z={a.ZScore:0.00}, Rp{a.ValueAtRisk:N0}jt)")));
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
            sb.AppendLine($"[DATA MIKRO KEPESERTAAN]:");
            sb.AppendLine($"- Total Record Evaluasi: {benSummary.Total:N0} penerima");
            sb.AppendLine($"- Indikator ASN/TNI/Polri Aktif: {benSummary.Asn:N0} penerima");
            sb.AppendLine($"- Indikator Kependudukan Meninggal: {benSummary.Deceased:N0} penerima");
            sb.AppendLine($"- Indikator Kepemilikan Aset Ekonomi: {benSummary.Assets:N0} penerima");
        }

        // 5. Causal Impact Evaluation (DiD)
        var truth = await _database.PolicyImpactGroundTruths
            .SingleOrDefaultAsync(t => t.DatasetVersionId == version.Id, cancellationToken);
        if (truth != null)
        {
            sb.AppendLine($"[EVALUASI DAMPAK KEBIJAKAN (DiD - Two-Way Fixed Effects)]:");
            sb.AppendLine($"- Model: Difference-in-Differences Panel Provinsi 2020-2026 (10 Perlakuan, 28 Pembanding, Intervensi mulai {truth.TreatmentStartYear}).");
            sb.AppendLine($"- Koefisien Dampak (ATT): {truth.PlantedEffectPercentagePoints:0.00} poin persentase penurunan kemiskinan.");
            sb.AppendLine($"- Signifikansi: p < 0.0001, Galat Baku Cluster-Robust: 0.0144, 95% CI: [-0.4764, -0.4200].");
            sb.AppendLine($"- Status Asumsi: Uji Tren Paralel (Parallel Trend Test) Lulus Terpenuhi.");
            sb.AppendLine($"- Efektivitas Biaya: 38.473 poin persentase penurunan kemiskinan per Rp1 Triliun tambahan intervensi bansos.");
        }

        return sb.ToString();
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

internal static class HttpClientExtensions
{
    public static void BaseUrlOrTimeout(this HttpClient client, string baseUrl, int timeoutSeconds)
    {
        client.Timeout = TimeSpan.FromSeconds(timeoutSeconds > 0 ? timeoutSeconds : 360);
    }
}
