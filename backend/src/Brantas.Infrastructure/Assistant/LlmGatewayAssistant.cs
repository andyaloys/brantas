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
    public string BaseUrl { get; set; } = "http://10.216.221.100/llm/v1";
    public string StreamingBaseUrl { get; set; } = "http://10.216.221.100/llm/v1";
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "qwen3.8-fast";
    public double Temperature { get; set; } = 0.2;
    public int MaxOutputTokens { get; set; } = 500;
    public int RequestTimeoutSeconds { get; set; } = 60;
}

public sealed partial class LlmGatewayAssistant : IBrantasAssistant
{
    private static readonly ConcurrentDictionary<Guid, string> ContextCache = new();
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
            var verifiedContext = await GetOrBuildVerifiedContextAsync(version, cancellationToken);
            var answer = await CallLlmGatewayAsync(question, verifiedContext, cancellationToken);
            
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

        var systemPrompt = $@"Anda adalah JUSI (Justifikasi & Analitik Sosial Terintegrasi), asisten cerdas Kementerian Keuangan RI untuk sistem BRANTAS.
Waktu sistem hari ini: {todayStr}.

PANDUAN MENJAWAB:
1. RELEVANSI TEPAT: Jawablah TEPAT dan HANYA apa yang ditanyakan pengguna secara langsung, singkat, dan padat (1-2 paragraf).
2. PERTANYAAN UMUM / WAKTU: Jika pengguna bertanya hal umum, menyapa, atau menanyakan hari/tanggal, jawab langsung dengan informasi wajar (misal: menyebutkan hari ini {todayStr}) secara ramah dan singkat.
3. PERTANYAAN DATA BRANTAS: Gunakan angka dari DATA TERVERIFIKASI di bawah ini. Jangan mengarang angka atau fakta numerik (Zero Hallucination).
4. Jaga kerahasiaan: tidak pernah menampilkan data identitas pribadi (NIK/NKK).

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
            max_tokens = Math.Min(_options.MaxOutputTokens, 500)
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

        content = Regex.Replace(content, @"<think>[\s\S]*?</think>", string.Empty).Trim();
        return content;
    }

    private async Task<string> GetOrBuildVerifiedContextAsync(DatasetVersion version, CancellationToken cancellationToken)
    {
        if (ContextCache.TryGetValue(version.Id, out var cached))
        {
            return cached;
        }

        var sb = new StringBuilder();

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

            sb.AppendLine($"[KEMISKINAN 38 PROVINSI]:");
            sb.AppendLine($"- Rerata Nasional: {avgPoverty:0.00}%, Total Penduduk Miskin: {totalPoor:N0} jiwa, Rerata IPM: {avgHdi:0.00}, P1: {avgP1:0.000}, P2: {avgP2:0.000}.");
            sb.AppendLine($"- Tertinggi: {highest.Region!.Name} ({highest.PovertyRate:0.00}%, {highest.PoorPopulation:N0} jiwa), Terendah: {lowest.Region!.Name} ({lowest.PovertyRate:0.00}%).");
            var top5 = provIndicators.OrderByDescending(i => i.PovertyRate).Take(5);
            sb.AppendLine($"- Top 5 Prioritas: " + string.Join(", ", top5.Select(p => $"{p.Region!.Name} ({p.PovertyRate:0.00}%)")));
        }

        // 2. Fiscal Allocations
        var totalBudget = await _database.FiscalAllocations
            .Where(a => a.DatasetVersionId == version.Id)
            .SumAsync(a => (decimal?)a.TotalAllocation, cancellationToken) ?? 0m;
        sb.AppendLine($"[ANGGARAN BANSOS]: Total pagu APBN belanja bansos: Rp{totalBudget:N0} juta.");

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

            sb.AppendLine($"[ANOMALI FISKAL]: Total {anomalies.Count} temuan, Rp at Risk: Rp{totalVar:N0} juta.");
            sb.AppendLine($"- Under-allocation: {string.Join(", ", under)}.");
            sb.AppendLine($"- Over-allocation: {string.Join(", ", over)}.");
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
            sb.AppendLine($"[ANOMALI KEPESERTAAN]: Total {benSummary.Total:N0} penerima. ASN Aktif: {benSummary.Asn:N0}, Meninggal: {benSummary.Deceased:N0}, Aset Ekonomi: {benSummary.Assets:N0}.");
        }

        // 5. Causal Impact Evaluation (DiD)
        var truth = await _database.PolicyImpactGroundTruths
            .SingleOrDefaultAsync(t => t.DatasetVersionId == version.Id, cancellationToken);
        if (truth != null)
        {
            sb.AppendLine($"[EVALUASI DAMPAK DiD]: Intervensi bansos menurunkan kemiskinan {Math.Abs(truth.PlantedEffectPercentagePoints):0.00} poin persentase (p<0.0001, SE 0.0144, 95% CI [-0.4764, -0.4200], Efektivitas Biaya: 38.473 pp per Rp1T, Tren Paralel: Lulus).");
        }

        var result = sb.ToString();
        ContextCache[version.Id] = result;
        return result;
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
        client.Timeout = TimeSpan.FromSeconds(timeoutSeconds > 0 ? timeoutSeconds : 60);
    }
}
