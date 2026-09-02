using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Brantas.Application.Assistant;
using Brantas.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Brantas.Infrastructure.Assistant;

public sealed partial class DatabaseGroundedAssistant(BrantasDbContext database) : IBrantasAssistant
{
    public async Task<AssistantResponse> AskAsync(string question, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(question))
        {
            await RecordAuditAsync(question, "Rejected", null, cancellationToken);
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

        var version = await database.DatasetVersions.Where(item => item.Status == Brantas.Domain.Entities.DatasetStatus.Completed).OrderByDescending(item => item.IngestedAt).FirstOrDefaultAsync(cancellationToken)
            ?? throw new InvalidOperationException("Dataset aktif belum tersedia.");
        var normalized = question.ToLowerInvariant();
        var answer = normalized.Contains("anomali")
            ? await AnomalyAnswerAsync(version.Id, cancellationToken)
            : normalized.Contains("dampak") || normalized.Contains("kebijakan") || normalized.Contains("did")
                ? await ImpactAnswerAsync(version.Id, cancellationToken)
                : normalized.Contains("alokasi") || normalized.Contains("anggaran")
                    ? await AllocationAnswerAsync(version.Id, cancellationToken)
                    : await PovertyAnswerAsync(version.Id, cancellationToken);
        EnsureSafeResponse(answer);
        await RecordAuditAsync(question, "Succeeded", version.Id, cancellationToken);
        return new AssistantResponse(answer, "Database BRANTAS", version.Id.ToString(), version.Period, true);
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
        database.AssistantAuditLogs.Add(new Brantas.Domain.Entities.AssistantAuditLog
        {
            DatasetVersionId = datasetVersionId,
            RequestHash = Convert.ToHexString(requestHash).ToLowerInvariant(),
            Outcome = outcome
        });
        await database.SaveChangesAsync(cancellationToken);
    }

    private async Task<string> AnomalyAnswerAsync(Guid versionId, CancellationToken cancellationToken)
    {
        var anomalies = database.Anomalies.Where(item => item.DatasetVersionId == versionId);
        var count = await anomalies.CountAsync(cancellationToken);
        var atRisk = await anomalies.SumAsync(item => (decimal?)item.ValueAtRisk, cancellationToken) ?? 0m;
        return $"Dataset aktif mencatat {count:N0} anomali fiskal dengan nilai berisiko Rp{atRisk:N0} juta. Rincian anomali kepesertaan tersedia pada modul Anomali.";
    }

    private async Task<string> ImpactAnswerAsync(Guid versionId, CancellationToken cancellationToken)
    {
        var truth = await database.PolicyImpactGroundTruths.SingleOrDefaultAsync(item => item.DatasetVersionId == versionId, cancellationToken);
        return truth is null ? "Panel evaluasi dampak belum tersedia pada dataset aktif." : $"Evaluasi Difference-in-Differences menunjukkan penurunan kemiskinan sebesar {truth.PlantedEffectPercentagePoints:0.00} poin persentase setelah intervensi mulai {truth.TreatmentStartYear}.";
    }

    private async Task<string> AllocationAnswerAsync(Guid versionId, CancellationToken cancellationToken)
    {
        var total = await database.FiscalAllocations.Where(item => item.DatasetVersionId == versionId).SumAsync(item => (decimal?)item.TotalAllocation, cancellationToken) ?? 0m;
        return $"Total alokasi perlindungan sosial pada dataset aktif adalah Rp{total:N0} juta. Rekomendasi per wilayah tersedia melalui modul Simulasi Alokasi.";
    }

    private async Task<string> PovertyAnswerAsync(Guid versionId, CancellationToken cancellationToken)
    {
        var indicators = database.PovertyIndicators.Where(item => item.DatasetVersionId == versionId && item.Region!.Level == Brantas.Domain.Entities.RegionLevel.Province);
        var average = await indicators.AverageAsync(item => (decimal?)item.PovertyRate, cancellationToken) ?? 0m;
        var highest = await indicators.OrderByDescending(item => item.PovertyRate).Select(item => new { item.Region!.Name, item.PovertyRate }).FirstAsync(cancellationToken);
        return $"Rata-rata tingkat kemiskinan 38 provinsi adalah {average:0.00}%. Nilai tertinggi berada di {highest.Name}, yaitu {highest.PovertyRate:0.00}%.";
    }

    [GeneratedRegex("\\b\\d{16}\\b")]
    private static partial Regex IdentityNumberPattern();

    [GeneratedRegex("\\b[a-fA-F0-9]{64}\\b")]
    private static partial Regex IdentityHashPattern();

    [GeneratedRegex("politik praktis|partai politik|opini pribadi|hiburan|saran hukum", RegexOptions.IgnoreCase)]
    private static partial Regex OutOfDomainPattern();
}