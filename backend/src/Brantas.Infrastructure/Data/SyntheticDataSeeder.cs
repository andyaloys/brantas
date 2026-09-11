using System.Security.Cryptography;
using System.Text;
using Brantas.Application.Data;
using Brantas.Domain.Entities;
using Brantas.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Brantas.Infrastructure.Data;

public sealed class SyntheticDataSeeder(BrantasDbContext database) : ISyntheticDataSeeder
{
    private const int Seed = 20260101;
    private const string Period = "2026-03";
    private const string GeneratorVersion = "v4-real-geo-coords";
    private const int RegencyTargetCount = 514;
    private const int BeneficiaryTargetCount = 2_000_000;
    private const string SyntheticIdentitySalt = "brantas-synthetic-identity-v1";
    private const decimal TotalSocialProtectionBudget = 508_200m;
    private static readonly HashSet<string> UnderAllocatedProvinceCodes = ["11", "17", "53", "81", "94", "95"];
    private static readonly HashSet<string> OverAllocatedProvinceCodes = ["19", "21", "31", "64"];
    private static readonly HashSet<string> TreatedProvinceCodes = ["11", "17", "18", "52", "53", "75", "81", "91", "94", "95"];

    private static readonly (string Code, string Name, decimal PovertyRate, decimal Lat, decimal Lng)[] Provinces =
    [
        ("11", "Aceh", 14.39m, 4.695m, 96.749m),
        ("12", "Sumatera Utara", 8.15m, 2.115m, 99.545m),
        ("13", "Sumatera Barat", 5.95m, -0.739m, 100.800m),
        ("14", "Riau", 6.68m, 0.293m, 101.706m),
        ("15", "Jambi", 7.58m, -1.610m, 103.613m),
        ("16", "Sumatera Selatan", 11.95m, -3.319m, 104.914m),
        ("17", "Bengkulu", 13.75m, -3.577m, 102.346m),
        ("18", "Lampung", 10.69m, -4.558m, 105.406m),
        ("19", "Kepulauan Bangka Belitung", 4.17m, -2.741m, 106.440m),
        ("21", "Kepulauan Riau", 5.37m, 3.945m, 108.142m),
        ("31", "DKI Jakarta", 4.14m, -6.208m, 106.845m),
        ("32", "Jawa Barat", 7.08m, -6.917m, 107.619m),
        ("33", "Jawa Tengah", 9.58m, -7.150m, 110.140m),
        ("34", "DI Yogyakarta", 10.12m, -7.795m, 110.369m),
        ("35", "Jawa Timur", 9.79m, -7.536m, 112.238m),
        ("36", "Banten", 5.84m, -6.405m, 106.064m),
        ("51", "Bali", 3.80m, -8.409m, 115.188m),
        ("52", "Nusa Tenggara Barat", 11.91m, -8.652m, 117.361m),
        ("53", "Nusa Tenggara Timur", 19.48m, -8.657m, 121.079m),
        ("61", "Kalimantan Barat", 6.30m, -0.000m, 109.333m),
        ("62", "Kalimantan Tengah", 5.12m, -1.681m, 113.382m),
        ("63", "Kalimantan Selatan", 4.70m, -3.092m, 115.283m),
        ("64", "Kalimantan Timur", 5.17m, 0.538m, 116.419m),
        ("65", "Kalimantan Utara", 6.32m, 3.073m, 116.041m),
        ("71", "Sulawesi Utara", 7.25m, 0.624m, 123.975m),
        ("72", "Sulawesi Tengah", 11.04m, -1.430m, 121.445m),
        ("73", "Sulawesi Selatan", 8.06m, -3.668m, 119.974m),
        ("74", "Sulawesi Tenggara", 10.43m, -4.144m, 122.174m),
        ("75", "Gorontalo", 14.57m, 0.699m, 122.446m),
        ("76", "Sulawesi Barat", 11.21m, -2.844m, 119.232m),
        ("81", "Maluku", 15.78m, -3.238m, 130.145m),
        ("82", "Maluku Utara", 6.32m, 1.570m, 127.808m),
        ("91", "Papua Barat", 21.66m, -1.336m, 133.174m),
        ("92", "Papua", 26.03m, -4.269m, 138.081m),
        ("93", "Papua Selatan", 18.90m, -7.500m, 139.500m),
        ("94", "Papua Tengah", 29.76m, -3.700m, 136.500m),
        ("95", "Papua Pegunungan", 30.03m, -4.100m, 139.000m),
        ("96", "Papua Barat Daya", 17.17m, -0.880m, 131.250m)
    ];

    public async Task<SyntheticDatasetResult> SeedAsync(CancellationToken cancellationToken)
    {
        var checksum = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"synthetic:{GeneratorVersion}:{Seed}:{Period}")));
        var existing = await database.DatasetVersions.SingleOrDefaultAsync(
            item => item.Checksum == checksum && item.Status == DatasetStatus.Completed,
            cancellationToken);

        if (existing is not null)
        {
            await EnsureRegencyNamesAsync(cancellationToken);
            await EnsureFiscalAnomaliesAsync(existing, cancellationToken);
            await EnsureBeneficiaryDataAsync(existing, cancellationToken);
            await EnsurePolicyImpactPanelAsync(existing, cancellationToken);
            var indicatorCount = await database.PovertyIndicators.CountAsync(
                item => item.DatasetVersionId == existing.Id,
                cancellationToken);
            return new SyntheticDatasetResult(existing.Id, Provinces.Length, indicatorCount, true);
        }

        var random = new Random(Seed);
        var version = new DatasetVersion
        {
            SourceSet = "SYNTHETIC-BPS",
            Period = Period,
            Seed = Seed,
            Checksum = checksum,
            Status = DatasetStatus.Processing
        };
        database.DatasetVersions.Add(version);

        for (var provinceIndex = 0; provinceIndex < Provinces.Length; provinceIndex++)
        {
            var province = Provinces[provinceIndex];
            var region = await database.Regions.SingleOrDefaultAsync(
                item => item.BpsCode == province.Code && item.Level == RegionLevel.Province,
                cancellationToken);

            var provinceLatitude = province.Lat;
            var provinceLongitude = province.Lng;
            if (region is null)
            {
                region = new Region
                {
                    BpsCode = province.Code,
                    Name = province.Name,
                    Level = RegionLevel.Province,
                    Latitude = provinceLatitude,
                    Longitude = provinceLongitude
                };
                database.Regions.Add(region);
            }
            else
            {
                region.Latitude = provinceLatitude;
                region.Longitude = provinceLongitude;
            }

            var population = random.Next(1_100_000, 14_000_000);
            database.PovertyIndicators.Add(new PovertyIndicator
            {
                RegionId = region.Id,
                DatasetVersionId = version.Id,
                Period = Period,
                PovertyRate = province.PovertyRate,
                PoorPopulation = (int)Math.Round(population * (double)province.PovertyRate / 100),
                PovertyDepthIndex = Math.Round(province.PovertyRate * 0.17m, 4),
                PovertySeverityIndex = Math.Round(province.PovertyRate * 0.04m, 4),
                HumanDevelopmentIndex = Math.Round(75m - province.PovertyRate * 0.28m + (decimal)random.NextDouble() * 3m, 4),
                GdpPerCapita = Math.Round(35m + (decimal)random.NextDouble() * 120m - province.PovertyRate * 1.2m, 2)
            });

            var regencyCount = provinceIndex < RegencyTargetCount % Provinces.Length ? 14 : 13;
            var regencyPopulationBase = population / regencyCount;
            for (var regencyIndex = 0; regencyIndex < regencyCount; regencyIndex++)
            {
                var angle = (double)regencyIndex / regencyCount * 2.0 * Math.PI;
                var dist = 0.12 + (random.NextDouble() * 0.38);
                var regencyLat = province.Lat + (decimal)(Math.Sin(angle) * dist);
                var regencyLng = province.Lng + (decimal)(Math.Cos(angle) * dist);

                var regencyCode = $"{province.Code}{regencyIndex + 1:000}";
                var regency = await database.Regions.SingleOrDefaultAsync(
                    item => item.BpsCode == regencyCode && item.Level == RegionLevel.Regency,
                    cancellationToken);
                var localSignal = (decimal)Math.Sin(angle) * 0.85m;
                var localNoise = ((decimal)random.NextDouble() - 0.5m) * 0.55m;
                var regencyPovertyRate = Math.Clamp(province.PovertyRate + 0.6m * localSignal + localNoise, 2m, 35m);

                if (regency is null)
                {
                    regency = new Region
                    {
                        BpsCode = regencyCode,
                        Name = RegencyCatalog.GetRegencyName(province.Name, regencyIndex),
                        Level = RegionLevel.Regency,
                        ParentId = region.Id,
                        Latitude = regencyLat,
                        Longitude = regencyLng
                    };
                    database.Regions.Add(regency);
                }
                else
                {
                    regency.Latitude = regencyLat;
                    regency.Longitude = regencyLng;
                }

                database.PovertyIndicators.Add(new PovertyIndicator
                {
                    RegionId = regency.Id,
                    DatasetVersionId = version.Id,
                    Period = Period,
                    PovertyRate = Math.Round(regencyPovertyRate, 4),
                    PoorPopulation = (int)Math.Round(regencyPopulationBase * (double)regencyPovertyRate / 100),
                    PovertyDepthIndex = Math.Round(regencyPovertyRate * 0.17m + localNoise * 0.01m, 4),
                    PovertySeverityIndex = Math.Round(regencyPovertyRate * 0.04m + localNoise * 0.005m, 4),
                    HumanDevelopmentIndex = Math.Round(75m - regencyPovertyRate * 0.28m + (decimal)random.NextDouble() * 1.2m, 4),
                    GdpPerCapita = Math.Round(35m + (decimal)random.NextDouble() * 120m - regencyPovertyRate * 1.2m, 2)
                });
            }
        }

        version.RecordCount = Provinces.Length + RegencyTargetCount;
        version.Status = DatasetStatus.Completed;
        await database.SaveChangesAsync(cancellationToken);
        await EnsureFiscalAnomaliesAsync(version, cancellationToken);
        await EnsureBeneficiaryDataAsync(version, cancellationToken);
        await EnsurePolicyImpactPanelAsync(version, cancellationToken);

        return new SyntheticDatasetResult(version.Id, RegencyTargetCount, Provinces.Length + RegencyTargetCount, false);
    }

    private async Task EnsureFiscalAnomaliesAsync(DatasetVersion version, CancellationToken cancellationToken)
    {
        var hasFiscalAllocations = await database.FiscalAllocations.AnyAsync(
            item => item.DatasetVersionId == version.Id,
            cancellationToken);

        if (!hasFiscalAllocations)
        {
            var indicators = await database.PovertyIndicators
                .Include(item => item.Region)
                .Where(item => item.DatasetVersionId == version.Id && item.Region!.Level == RegionLevel.Province)
                .ToListAsync(cancellationToken);
            var totalPoorPopulation = indicators.Sum(item => item.PoorPopulation);

            foreach (var indicator in indicators)
            {
                var multiplier = UnderAllocatedProvinceCodes.Contains(indicator.Region!.BpsCode) ? 0.45m
                    : OverAllocatedProvinceCodes.Contains(indicator.Region.BpsCode) ? 1.80m
                    : 1m;
                var expectedAllocation = TotalSocialProtectionBudget * indicator.PoorPopulation / totalPoorPopulation;
                database.FiscalAllocations.Add(new FiscalAllocation
                {
                    RegionId = indicator.RegionId,
                    DatasetVersionId = version.Id,
                    TotalAllocation = Math.Round(expectedAllocation * multiplier, 2)
                });

                if (multiplier != 1m)
                {
                    database.SyntheticGroundTruths.Add(new SyntheticGroundTruth
                    {
                        RegionId = indicator.RegionId,
                        DatasetVersionId = version.Id,
                        ExpectedType = multiplier < 1m ? AnomalyType.FiscalUnderAllocation : AnomalyType.FiscalOverAllocation
                    });
                }
            }
            await database.SaveChangesAsync(cancellationToken);
        }

        var hasAnomalies = await database.Anomalies.AnyAsync(item => item.DatasetVersionId == version.Id, cancellationToken);
        if (hasAnomalies)
        {
            return;
        }

        var observations = await (
            from indicator in database.PovertyIndicators
            join allocation in database.FiscalAllocations on indicator.RegionId equals allocation.RegionId
            where indicator.DatasetVersionId == version.Id && allocation.DatasetVersionId == version.Id && indicator.Region!.Level == RegionLevel.Province
            select new { indicator.RegionId, indicator.PoorPopulation, allocation.TotalAllocation, Region = indicator.Region! }).ToListAsync(cancellationToken);
        var perPoorAllocations = observations.Select(item => item.TotalAllocation / item.PoorPopulation).ToArray();
        var mean = perPoorAllocations.Average();
        var standardDeviation = (decimal)Math.Sqrt(perPoorAllocations.Average(value => (double)((value - mean) * (value - mean))));

        foreach (var observation in observations)
        {
            var actualPerPoor = observation.TotalAllocation / observation.PoorPopulation;
            var zScore = Math.Round((actualPerPoor - mean) / standardDeviation, 4);
            if (Math.Abs(zScore) < 1m)
            {
                continue;
            }

            var expectedAllocation = mean * observation.PoorPopulation;
            var type = zScore < 0 ? AnomalyType.FiscalUnderAllocation : AnomalyType.FiscalOverAllocation;
            database.Anomalies.Add(new Anomaly
            {
                RegionId = observation.RegionId,
                DatasetVersionId = version.Id,
                Type = type,
                Severity = Math.Abs(zScore) >= 3m ? AnomalySeverity.Critical
                    : Math.Abs(zScore) >= 2m ? AnomalySeverity.High
                    : AnomalySeverity.Medium,
                ConfidenceScore = Math.Min(99m, Math.Round(70m + Math.Abs(zScore) * 8m, 2)),
                ZScore = zScore,
                ValueAtRisk = Math.Round(Math.Abs(expectedAllocation - observation.TotalAllocation), 2),
                Explanation = $"Alokasi per penduduk miskin {Math.Abs(zScore):0.00} standar deviasi {(zScore < 0 ? "di bawah" : "di atas")} rata-rata nasional.",
            });
        }
        await database.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureBeneficiaryDataAsync(DatasetVersion version, CancellationToken cancellationToken)
    {
        var hasBeneficiaries = await database.BeneficiaryRecords.AnyAsync(
            item => item.DatasetVersionId == version.Id,
            cancellationToken);
        if (hasBeneficiaries)
        {
            return;
        }

        var regencies = await database.PovertyIndicators
            .Where(item => item.DatasetVersionId == version.Id && item.Region!.Level == RegionLevel.Regency)
            .OrderBy(item => item.Region!.BpsCode)
            .Select(item => new { item.RegionId, item.PoorPopulation })
            .ToListAsync(cancellationToken);
        var totalPoorPopulation = regencies.Sum(item => item.PoorPopulation);
        var assigned = 0;

        var connection = (NpgsqlConnection)database.Database.GetDbConnection();
        await connection.OpenAsync(cancellationToken);
        await using (var importer = await connection.BeginBinaryImportAsync(
            "COPY beneficiary_records (\"Id\", \"RegionId\", \"DatasetVersionId\", \"NikHash\", \"NkkHash\", \"Program\", \"Decile\", \"IsActivePublicServant\", \"IsDeceased\", \"HasEconomicAsset\") FROM STDIN (FORMAT BINARY)",
            cancellationToken))
        {
            for (var regionIndex = 0; regionIndex < regencies.Count; regionIndex++)
            {
                var region = regencies[regionIndex];
                var target = regionIndex == regencies.Count - 1
                    ? BeneficiaryTargetCount - assigned
                    : (int)Math.Round(BeneficiaryTargetCount * (decimal)region.PoorPopulation / totalPoorPopulation);
                assigned += target;

                for (var localIndex = 0; localIndex < target; localIndex++)
                {
                    var identityIndex = assigned - target + localIndex;
                    var duplicate = identityIndex % 125 == 0 && identityIndex > 0;
                    var canonicalIndex = duplicate ? identityIndex - 1 : identityIndex;
                    await importer.StartRowAsync(cancellationToken);
                    await importer.WriteAsync(Guid.NewGuid(), cancellationToken);
                    await importer.WriteAsync(region.RegionId, cancellationToken);
                    await importer.WriteAsync(version.Id, cancellationToken);
                    await importer.WriteAsync(HashIdentity($"nik:{canonicalIndex}"), cancellationToken);
                    await importer.WriteAsync(HashIdentity($"nkk:{canonicalIndex / 4}"), cancellationToken);
                    await importer.WriteAsync("Program Keluarga Harapan", cancellationToken);
                    await importer.WriteAsync(identityIndex % 10 < 7 ? 1 : 2, cancellationToken);
                    await importer.WriteAsync(identityIndex % 83 == 0, cancellationToken);
                    await importer.WriteAsync(identityIndex % 200 == 0, cancellationToken);
                    await importer.WriteAsync(identityIndex % 50 == 0, cancellationToken);
                }
            }
            await importer.CompleteAsync(cancellationToken);
        }

        foreach (var region in regencies)
        {
            var registered = (int)Math.Round(BeneficiaryTargetCount * (decimal)region.PoorPopulation / totalPoorPopulation);
            var gapMultiplier = region.RegionId.GetHashCode() % 29 == 0 ? 1.035m : 1m;
            database.WelfareCoverages.Add(new WelfareCoverage
            {
                RegionId = region.RegionId,
                DatasetVersionId = version.Id,
                RegisteredBeneficiaries = registered,
                EstimatedEligibleHouseholds = (int)Math.Round(registered * gapMultiplier)
            });
        }
        await database.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsurePolicyImpactPanelAsync(DatasetVersion version, CancellationToken cancellationToken)
    {
        await database.PolicyImpactPanels.Where(item => item.DatasetVersionId == version.Id).ExecuteDeleteAsync(cancellationToken);
        await database.PolicyImpactGroundTruths.Where(item => item.DatasetVersionId == version.Id).ExecuteDeleteAsync(cancellationToken);

        var provinces = await database.PovertyIndicators
            .Include(item => item.Region)
            .Where(item => item.DatasetVersionId == version.Id && item.Region!.Level == RegionLevel.Province)
            .ToListAsync(cancellationToken);
        foreach (var indicator in provinces)
        {
            var treated = TreatedProvinceCodes.Contains(indicator.Region!.BpsCode);
            for (var year = 2020; year <= 2026; year++)
            {
                var yearsFromBase = year - 2020;
                var allocation = 850m + indicator.PoorPopulation / 30_000m + yearsFromBase * 15m;
                if (treated && year >= 2024) allocation *= 1.35m;
                var povertyRate = indicator.PovertyRate + (2026 - year) * 0.22m;
                if (treated && year >= 2025) povertyRate -= 0.45m;
                var provinceYearNoise = ((int.Parse(indicator.Region.BpsCode) * 31 + year * 7) % 17 - 8) * 0.0125m;
                database.PolicyImpactPanels.Add(new PolicyImpactPanel
                {
                    RegionId = indicator.RegionId,
                    DatasetVersionId = version.Id,
                    Year = year,
                    IsTreated = treated,
                    SocialProtectionAllocation = Math.Round(allocation, 2),
                    PovertyRate = Math.Round(povertyRate + provinceYearNoise, 4)
                });
            }
        }
        database.PolicyImpactGroundTruths.Add(new PolicyImpactGroundTruth
        {
            DatasetVersionId = version.Id,
            PlantedEffectPercentagePoints = -0.45m,
            TreatmentStartYear = 2024
        });
        await database.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureRegencyNamesAsync(CancellationToken cancellationToken)
    {
        var regencies = await database.Regions
            .Where(item => item.Level == RegionLevel.Regency)
            .ToListAsync(cancellationToken);

        var changed = false;
        foreach (var regency in regencies)
        {
            var resolved = RegencyCatalog.ResolveSyntheticName(regency.Name);
            if (resolved != regency.Name)
            {
                regency.Name = resolved;
                changed = true;
            }
        }

        if (changed)
        {
            await database.SaveChangesAsync(cancellationToken);
        }
    }

    private static string HashIdentity(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{SyntheticIdentitySalt}:{value}")));
}