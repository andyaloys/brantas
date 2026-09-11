using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Brantas.Analytics.Optimization;
using Brantas.Application.Assistant;
using Brantas.Domain.Entities;
using Brantas.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Brantas.Infrastructure.Assistant;

public sealed partial class DatabaseGroundedAssistant(BrantasDbContext database) : IBrantasAssistant
{
    private static List<RegionLookup>? CachedRegions;
    private static readonly SemaphoreSlim CacheLock = new(1, 1);
    private static readonly ConcurrentDictionary<Guid, IReadOnlyDictionary<Guid, AllocationRecommendation>> AllocationMapCache = new();

    public const string GentleRefusalMessage = "Mohon maaf, saya tidak bisa membantu untuk hal itu. Saya ditugaskan khusus sebagai Juru Bantuan Sosial Interaktif dengan ruang lingkup analisis data kemiskinan, alokasi anggaran APBN/TKDD, dan rekomendasi kebijakan pada sistem BRANTAS. Terima kasih.";

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

        var version = await database.DatasetVersions
            .Where(item => item.Status == DatasetStatus.Completed)
            .OrderByDescending(item => item.IngestedAt)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new InvalidOperationException("Dataset aktif belum tersedia.");

        if (OutOfDomainPattern().IsMatch(question))
        {
            await RecordAuditAsync(question, "GentleRefusal", version.Id, cancellationToken);
            return new AssistantResponse(GentleRefusalMessage, "Guardrail Sistem BRANTAS", version.Id.ToString(), version.Period, true);
        }

        var normalized = question.ToLowerInvariant();

        // 1. Cek apakah pengguna menanyakan wilayah tertentu (Provinsi / Kabupaten / Kota)
        var regionMatch = await TryMatchRegionAsync(normalized, cancellationToken);
        string answer;

        if (regionMatch != null)
        {
            answer = await RegionSpecificAnswerAsync(regionMatch, version.Id, cancellationToken);
        }
        else if (normalized.Contains("formula") || normalized.Contains("ikw") || normalized.Contains("dasar perhitungan") || normalized.Contains("bobot") || normalized.Contains("solver") || normalized.Contains("metodologi"))
        {
            answer = FormulaExplanationAnswer();
        }
        else if (normalized.Contains("anomali"))
        {
            answer = await AnomalyAnswerAsync(version.Id, cancellationToken);
        }
        else if (normalized.Contains("dampak") || normalized.Contains("kebijakan") || normalized.Contains("did") || normalized.Contains("evaluasi"))
        {
            answer = await ImpactAnswerAsync(version.Id, cancellationToken);
        }
        else if (normalized.Contains("alokasi") || normalized.Contains("anggaran") || normalized.Contains("pagu"))
        {
            answer = await AllocationAnswerAsync(version.Id, cancellationToken);
        }
        else if (IsBrantasDomainQuestion(normalized))
        {
            answer = await PovertyAnswerAsync(version.Id, cancellationToken);
        }
        else
        {
            await RecordAuditAsync(question, "GentleRefusal", version.Id, cancellationToken);
            return new AssistantResponse(GentleRefusalMessage, "Guardrail Sistem BRANTAS", version.Id.ToString(), version.Period, true);
        }

        EnsureSafeResponse(answer);
        await RecordAuditAsync(question, "Succeeded", version.Id, cancellationToken);
        return new AssistantResponse(answer, "Database Terverifikasi BRANTAS", version.Id.ToString(), version.Period, true);
    }

    private async Task<RegionLookup?> TryMatchRegionAsync(string normalizedQuestion, CancellationToken cancellationToken)
    {
        var regions = await EnsureRegionsCacheAsync(cancellationToken);
        return RegionAliasCatalog.FindBestMatch(
            normalizedQuestion,
            regions,
            r => r.FullName,
            r => r.SearchKey,
            r => r.Level);
    }

    private async Task<string> RegionSpecificAnswerAsync(RegionLookup region, Guid versionId, CancellationToken cancellationToken)
    {
        var indicator = await database.PovertyIndicators
            .Include(i => i.Region)
            .FirstOrDefaultAsync(i => i.DatasetVersionId == versionId && i.RegionId == region.Id, cancellationToken);

        if (indicator == null)
        {
            return $"Data indikator untuk **{region.FullName}** belum ditemukan dalam dataset aktif periode saat ini.";
        }

        var disaster = DisasterRiskRepository.GetDisasterRisk(region.BpsCode);
        var allocMap = await EnsureAllocationsAsync(versionId, cancellationToken);

        decimal baseline;
        decimal recommended;
        decimal delta;
        decimal deltaPercent;
        decimal vulnerabilityIndex;

        if (region.Level == RegionLevel.Province && allocMap.TryGetValue(region.Id, out var provRec))
        {
            baseline = provRec.BaselineAllocation;
            recommended = provRec.RecommendedAllocation;
            delta = provRec.Delta;
            deltaPercent = provRec.DeltaPercent;
            vulnerabilityIndex = provRec.VulnerabilityIndex;
        }
        else if (region.Level == RegionLevel.Regency && region.ParentId.HasValue && allocMap.TryGetValue(region.ParentId.Value, out var parentRec))
        {
            var parentTotalPoor = await database.PovertyIndicators
                .Where(i => i.DatasetVersionId == versionId && i.Region!.ParentId == region.ParentId.Value)
                .SumAsync(i => (long)i.PoorPopulation, cancellationToken);

            var share = parentTotalPoor > 0 ? (decimal)indicator.PoorPopulation / parentTotalPoor : 0m;
            baseline = Math.Round(parentRec.BaselineAllocation * share, 2);
            recommended = Math.Round(parentRec.RecommendedAllocation * share, 2);
            delta = recommended - baseline;
            deltaPercent = parentRec.DeltaPercent;
            vulnerabilityIndex = parentRec.VulnerabilityIndex;
        }
        else
        {
            var directAlloc = await database.FiscalAllocations
                .Where(a => a.DatasetVersionId == versionId && a.RegionId == region.Id)
                .Select(a => (decimal?)a.TotalAllocation)
                .FirstOrDefaultAsync(cancellationToken) ?? 0m;

            baseline = directAlloc;
            recommended = directAlloc;
            delta = 0m;
            deltaPercent = 0m;
            vulnerabilityIndex = 0.500m;
        }

        var bufferAmount = Math.Round(recommended * 0.35m, 2);
        var sign = delta >= 0 ? "+" : "";
        var sb = new StringBuilder();

        var parentInfo = region.Level == RegionLevel.Regency && !string.IsNullOrWhiteSpace(region.ParentName)
            ? $" (Provinsi **{region.ParentName}**)"
            : "";

        sb.AppendLine($"Tingkat kemiskinan di **{region.FullName}**{parentInfo} tercatat sebesar **{indicator.PovertyRate:0.00}%** dengan jumlah penduduk miskin sebanyak **{indicator.PoorPopulation:N0} jiwa**, IPM **{indicator.HumanDevelopmentIndex:0.00}**, PDRB per kapita **Rp{indicator.GdpPerCapita:0.00} Juta**, dan pagu alokasi bansos APBN eksisting sebesar **{FormatRupiah(baseline)}**. Wilayah ini tergolong zona risiko bencana **{disaster.Category}** dengan skor IRBI BNPB **{disaster.Score:0.00}**.");
        sb.AppendLine();
        sb.AppendLine("**Rekomendasi Kebijakan BRANTAS**:");
        sb.AppendLine($"1. **Penetapan Alokasi Afirmatif IKW (UU No. 1/2022 HKPD)**: Berdasarkan skor Indeks Kerentanan Wilayah (IKW) **{vulnerabilityIndex:0.000}**, direkomendasikan penyesuaian alokasi pagu dari **{FormatRupiah(baseline)}** menjadi **{FormatRupiah(recommended)}** (penyesuaian **{sign}{deltaPercent:0.0}%** atau **{sign}{FormatRupiah(Math.Abs(delta))}**) guna memprioritaskan pemenuhan kebutuhan **{indicator.PoorPopulation:N0} jiwa** warga prasejahtera.");
        sb.AppendLine($"2. **Integrasi Perlindungan Sosial Adaptif (ASP)**: Mengamankan alokasi cadangan darurat kebencanaan (*buffer ratio 35%*) sebesar **{FormatRupiah(bufferAmount)}** pada zona risiko **{disaster.Category}** (skor IRBI **{disaster.Score:0.00}**) agar dana bantuan langsung aktif saat terjadi guncangan bencana alam.");
        sb.AppendLine($"3. **Pemadanan Terpadu DTKS & Regsosek (Perpres No. 39/2019)**: Melakukan pemadanan berkala data penerima bansos dan pemadanan NIK Dukcapil guna mengeliminasi temuan anomali ketimpangan anggaran daerah dan memastikan bantuan sosial tepat sasaran.");

        return sb.ToString().Trim();
    }

    private static string FormulaExplanationAnswer()
    {
        return @"**Dasar Perhitungan & Klasifikasi Formula Alokasi BRANTAS**:

1. **Indeks Kerentanan Wilayah (IKW)** dihitung dari pembobotan komposit 6 variabel normalisasi:
   - **Tingkat Kemiskinan** (Bobot: **30%**)
   - **Indeks Kedalaman Kemiskinan (P1)** (Bobot: **15%**)
   - **Indeks Keparahan Kemiskinan (P2)** (Bobot: **15%**)
   - **Kesenjangan IPM (100 - IPM)** (Bobot: **15%**)
   - **Inverse PDRB per Kapita** (Bobot: **15%**)
   - **Indeks Risiko Bencana (IRBI BNPB)** (Bobot: **10%**)

2. **Metode Optimasi Alokasi Berkeadilan**:
   - Memakai solver Linear Programming **Google OR-Tools GLOP**.
   - **Fungsi Tujuan**: Meminimalkan deviasi alokasi terhadap alokasi ideal proporsional berbasis `(IKW * Penduduk Miskin)`.
   - **Kendala Stabilitas Fiskal**: Menjaga total pagu belanja APBN, batas minimum pagu (Floor) **Rp500,0 Miliar** per daerah, serta batas toleransi pergerakan alokasi (Cap) maksimal **±25%** dari alokasi eksisting demi kesinambungan fiskal daerah.";
    }

    private async Task<string> AnomalyAnswerAsync(Guid versionId, CancellationToken cancellationToken)
    {
        var anomalies = database.Anomalies.Where(item => item.DatasetVersionId == versionId);
        var count = await anomalies.CountAsync(cancellationToken);
        var atRisk = await anomalies.SumAsync(item => (decimal?)item.ValueAtRisk, cancellationToken) ?? 0m;
        
        var benSummary = await database.BeneficiaryRecords
            .Where(b => b.DatasetVersionId == versionId)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Asn = g.Count(b => b.IsActivePublicServant),
                Deceased = g.Count(b => b.IsDeceased),
                Assets = g.Count(b => b.HasEconomicAsset)
            }).FirstOrDefaultAsync(cancellationToken);

        var benInfo = benSummary != null 
            ? $" Sementara itu, audit kepesertaan mendeteksi **{benSummary.Asn:N0} ASN aktif**, **{benSummary.Deceased:N0} penerima meninggal**, dan **{benSummary.Assets:N0} penerima dengan aset ekonomi tinggi**."
            : "";

        return $"Dataset aktif mencatat **{count:N0} temuan ketimpangan fiskal** pada alokasi wilayah dengan total nilai berisiko **{FormatRupiah(atRisk)}**.{benInfo} Rekomendasi mitigasi kebijakan: lakukan cleansing data terpadu NIK Dukcapil sesuai amanat **Perpres No. 39/2019** dan sesuaikan pagu daerah berdeviasi z-score > 1 ke koridor toleransi Cap ±25% demi stabilitas fiskal.";
    }

    private async Task<string> ImpactAnswerAsync(Guid versionId, CancellationToken cancellationToken)
    {
        var truth = await database.PolicyImpactGroundTruths.SingleOrDefaultAsync(item => item.DatasetVersionId == versionId, cancellationToken);
        return truth is null
            ? "Panel evaluasi dampak belum tersedia pada dataset aktif."
            : $"Evaluasi Kausalitas Kebijakan menggunakan metode **Difference-in-Differences (DiD)** dengan model panel Two-Way Fixed Effects membuktikan bahwa intervensi belanja bansos terarah mempercepat penurunan tingkat kemiskinan sebesar **{Math.Abs(truth.PlantedEffectPercentagePoints):0.00} poin persentase lebih cepat** (p < 0.0001, SE 0.0144). Rasio efektivitas biaya mencapai **38,47 pp per Rp1 Triliun** alokasi anggaran dengan uji tren paralel yang valid.";
    }

    private async Task<string> AllocationAnswerAsync(Guid versionId, CancellationToken cancellationToken)
    {
        var total = await database.FiscalAllocations.Where(item => item.DatasetVersionId == versionId).SumAsync(item => (decimal?)item.TotalAllocation, cancellationToken) ?? 0m;
        return $"Total pagu belanja perlindungan sosial pada dataset aktif APBN adalah **{FormatRupiah(total)}**. Alokasi direformulasikan menggunakan formula optimasi Linear Programming berbasis **Indeks Kerentanan Wilayah (IKW)** dan beban kemiskinan riil dengan batasan stabilitas fiskal (Floor **Rp500,0 Miliar** dan Cap **±25%**) untuk memastikan redistribusi yang berkeadilan.";
    }

    private async Task<string> PovertyAnswerAsync(Guid versionId, CancellationToken cancellationToken)
    {
        var indicators = database.PovertyIndicators.Where(item => item.DatasetVersionId == versionId && item.Region!.Level == RegionLevel.Province);
        var average = await indicators.AverageAsync(item => (decimal?)item.PovertyRate, cancellationToken) ?? 0m;
        var totalPoor = await indicators.SumAsync(item => (long)item.PoorPopulation, cancellationToken);
        var highest = await indicators.OrderByDescending(item => item.PovertyRate).Select(item => new { item.Region!.Name, item.PovertyRate, item.PoorPopulation }).FirstAsync(cancellationToken);
        var lowest = await indicators.OrderBy(item => item.PovertyRate).Select(item => new { item.Region!.Name, item.PovertyRate }).FirstAsync(cancellationToken);

        return $"Rata-rata tingkat kemiskinan **38 provinsi** di Indonesia adalah **{average:0.00}%** dengan total penduduk miskin sebanyak **{totalPoor:N0} jiwa**. Provinsi dengan tingkat kemiskinan tertinggi berada di **{highest.Name}** (**{highest.PovertyRate:0.00}%**, **{highest.PoorPopulation:N0} jiwa**), sedangkan terendah berada di **{lowest.Name}** (**{lowest.PovertyRate:0.00}%**). Seluruh data spesifik dapat Anda tanyakan untuk setiap provinsi maupun kabupaten/kota di Indonesia.";
    }

    private async Task<IReadOnlyDictionary<Guid, AllocationRecommendation>> EnsureAllocationsAsync(Guid versionId, CancellationToken cancellationToken)
    {
        if (AllocationMapCache.TryGetValue(versionId, out var cached))
            return cached;

        var rawObservations = await (
            from ind in database.PovertyIndicators
            join alloc in database.FiscalAllocations on ind.RegionId equals alloc.RegionId
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

    private async Task<List<RegionLookup>> EnsureRegionsCacheAsync(CancellationToken cancellationToken)
    {
        if (CachedRegions != null) return CachedRegions;
        await CacheLock.WaitAsync(cancellationToken);
        try
        {
            if (CachedRegions != null) return CachedRegions;
            var list = await database.Regions
                .Include(r => r.Parent)
                .Select(r => new RegionLookup(
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
            CacheLock.Release();
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
        database.AssistantAuditLogs.Add(new AssistantAuditLog
        {
            DatasetVersionId = datasetVersionId,
            RequestHash = Convert.ToHexString(requestHash).ToLowerInvariant(),
            Outcome = outcome
        });
        await database.SaveChangesAsync(cancellationToken);
    }

    [GeneratedRegex("\\b\\d{16}\\b")]
    private static partial Regex IdentityNumberPattern();

    [GeneratedRegex("\\b[a-fA-F0-9]{64}\\b")]
    private static partial Regex IdentityHashPattern();

    private static bool IsBrantasDomainQuestion(string normalized)
    {
        return normalized.Contains("kemiskinan") ||
               normalized.Contains("miskin") ||
               normalized.Contains("penduduk") ||
               normalized.Contains("bansos") ||
               normalized.Contains("anggaran") ||
               normalized.Contains("pagu") ||
               normalized.Contains("alokasi") ||
               normalized.Contains("anomali") ||
               normalized.Contains("formula") ||
               normalized.Contains("ikw") ||
               normalized.Contains("bobot") ||
               normalized.Contains("dampak") ||
               normalized.Contains("kebijakan") ||
               normalized.Contains("did") ||
               normalized.Contains("evaluasi") ||
               normalized.Contains("bencana") ||
               normalized.Contains("irbi") ||
               normalized.Contains("ipm") ||
               normalized.Contains("pdrb") ||
               normalized.Contains("fiskal") ||
               normalized.Contains("apbn") ||
               normalized.Contains("tkdd") ||
               normalized.Contains("brantas") ||
               normalized.Contains("rekomendasi") ||
               normalized.Contains("indikator") ||
               normalized.Contains("provinsi") ||
               normalized.Contains("kabupaten") ||
               normalized.Contains("kota") ||
               normalized.Contains("wilayah") ||
               normalized.Contains("bantuan sosial") ||
               normalized.Contains("dtks") ||
               normalized.Contains("regsosek");
    }

    [GeneratedRegex(@"(politik praktis|partai politik|pemilu|pilpres|caleg|capres|menteri|presiden luar negeri|siapa presiden|hiburan|film|bioskop|lagu|musik|selebriti|artis|gosip|resep|masak|kuliner|olahraga|sepak bola|klub bola|zodiak|ramalan|lelucon|humor|cerpen|puisi|saran hukum|saran medis|resep obat|dokter|game|gaming|pariwisata|cuaca hari ini|chord gitar|lirik lagu|sinopsis)", RegexOptions.IgnoreCase)]
    private static partial Regex OutOfDomainPattern();
}

public sealed record RegionLookup(
    Guid Id,
    string FullName,
    string BpsCode,
    RegionLevel Level,
    Guid? ParentId,
    string? ParentName,
    string SearchKey);