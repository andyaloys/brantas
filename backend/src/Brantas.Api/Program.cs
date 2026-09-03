using Brantas.Application.Data;
using Brantas.Application.Assistant;
using Brantas.Analytics.Spatial;
using Brantas.Analytics.Optimization;
using Brantas.Analytics.Causal;
using Brantas.Analytics.Anomalies;
using Brantas.Infrastructure;
using Brantas.Infrastructure.Persistence;
using Brantas.Api.Reports;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

QuestPDF.Settings.License = LicenseType.Community;

builder.Services.AddProblemDetails();
builder.Services.AddHealthChecks();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddCors(options => options.AddPolicy("Frontend", policy => policy
    .WithOrigins("http://127.0.0.1:4200", "http://localhost:4200", "http://127.0.0.1:4201", "http://localhost:4201")
    .AllowAnyHeader()
    .AllowAnyMethod()));

var app = builder.Build();

app.UseExceptionHandler();
app.UseHttpsRedirection();
app.UseCors("Frontend");

app.MapGet("/health", () => Results.Ok(new
{
    status = "Sehat",
    service = "BRANTAS API",
    timestamp = DateTimeOffset.UtcNow
}))
    .WithName("GetHealth")
    .WithSummary("Memeriksa ketersediaan layanan BRANTAS.")
    .WithTags("Sistem")
    .AllowAnonymous();

app.MapGet("/api/v1/system/info", () => Results.Ok(new
{
    application = "BRANTAS",
    version = "v1",
    dataMode = "Synthetic"
}))
    .WithName("GetSystemInfo")
    .WithSummary("Mengambil metadata layanan dan mode data aktif.")
    .WithTags("Sistem")
    .AllowAnonymous();

app.MapGet("/api/v1/system/audit-logs", async (BrantasDbContext database, CancellationToken cancellationToken) =>
{
    var logs = await database.AuditLogs
        .OrderByDescending(item => item.OccurredAt)
        .Take(50)
        .Select(item => new
        {
            id = item.Id,
            action = item.Action,
            actorRole = item.ActorRole,
            actorRegion = item.ActorRegion,
            detailsJson = item.DetailsJson,
            isSuccess = item.IsSuccess,
            occurredAt = item.OccurredAt
        })
        .ToListAsync(cancellationToken);
    return Results.Ok(logs);
})
    .WithName("GetAuditLogs")
    .WithSummary("Mengambil riwayat log audit untuk aksi perubahan state sistem.")
    .WithTags("Sistem")
    .AllowAnonymous();

app.MapPost("/api/v1/pipeline/run", async (HttpContext context, ISyntheticDataSeeder seeder, BrantasDbContext database, CancellationToken cancellationToken) =>
{
    var (role, region) = GetClientContext(context);
    try
    {
        var result = await seeder.SeedAsync(cancellationToken);
        database.AuditLogs.Add(new Brantas.Domain.Entities.AuditLog
        {
            Action = "RunSyntheticPipeline",
            ActorRole = role,
            ActorRegion = region,
            DetailsJson = JsonSerializer.Serialize(new { result.DatasetVersionId, result.IndicatorCount }),
            IsSuccess = true
        });
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(result);
    }
    catch (Exception ex)
    {
        database.AuditLogs.Add(new Brantas.Domain.Entities.AuditLog
        {
            Action = "RunSyntheticPipeline",
            ActorRole = role,
            ActorRegion = region,
            DetailsJson = JsonSerializer.Serialize(new { error = ex.Message }),
            IsSuccess = false
        });
        await database.SaveChangesAsync(cancellationToken);
        throw;
    }
})
    .WithName("RunSyntheticPipeline")
    .WithSummary("Menjalankan pipeline data sintetis deterministik.")
    .WithTags("Pipeline")
    .AllowAnonymous();

app.MapGet("/api/v1/dashboard/summary", async (BrantasDbContext database, CancellationToken cancellationToken) =>
{
    var version = await database.DatasetVersions
        .Where(item => item.Status == Brantas.Domain.Entities.DatasetStatus.Completed)
        .OrderByDescending(item => item.IngestedAt)
        .FirstOrDefaultAsync(cancellationToken);

    if (version is null)
    {
        return Results.NotFound(new { title = "Data belum tersedia", detail = "Jalankan pipeline data sintetis terlebih dahulu." });
    }

    var provIndicators = await database.PovertyIndicators
        .Include(item => item.Region)
        .Where(item => item.DatasetVersionId == version.Id && item.Region!.Level == Brantas.Domain.Entities.RegionLevel.Province)
        .ToListAsync(cancellationToken);

    var regencyIndicators = await database.PovertyIndicators
        .Where(item => item.DatasetVersionId == version.Id && item.Region!.Level == Brantas.Domain.Entities.RegionLevel.Regency)
        .ToListAsync(cancellationToken);

    var totalBudget = await database.FiscalAllocations
        .Where(item => item.DatasetVersionId == version.Id)
        .SumAsync(item => (decimal?)item.TotalAllocation, cancellationToken) ?? 0m;

    var anomalyMetrics = await database.Anomalies
        .Where(item => item.DatasetVersionId == version.Id)
        .GroupBy(_ => 1)
        .Select(group => new { Count = group.Count(), ValueAtRisk = group.Sum(item => item.ValueAtRisk) })
        .FirstOrDefaultAsync(cancellationToken);

    var highestProv = provIndicators.OrderByDescending(i => i.PovertyRate).FirstOrDefault();
    var lowestProv = provIndicators.OrderBy(i => i.PovertyRate).FirstOrDefault();

    var summary = new
    {
        datasetVersionId = version.Id,
        period = version.Period,
        provinceCount = provIndicators.Count,
        regencyCount = regencyIndicators.Count,
        averagePovertyRate = Math.Round(provIndicators.Average(i => i.PovertyRate), 2),
        totalPoorPopulation = provIndicators.Sum(i => i.PoorPopulation),
        highestPovertyRate = highestProv?.PovertyRate ?? 0m,
        highestProvinceName = highestProv?.Region?.Name ?? "—",
        lowestPovertyRate = lowestProv?.PovertyRate ?? 0m,
        lowestProvinceName = lowestProv?.Region?.Name ?? "—",
        averagePovertyDepth = Math.Round(provIndicators.Average(i => i.PovertyDepthIndex), 3),
        averagePovertySeverity = Math.Round(provIndicators.Average(i => i.PovertySeverityIndex), 3),
        averageHumanDevelopmentIndex = Math.Round(provIndicators.Average(i => i.HumanDevelopmentIndex), 2),
        totalBudget = Math.Round(totalBudget, 2),
        totalAnomalies = anomalyMetrics?.Count ?? 0,
        totalValueAtRisk = Math.Round(anomalyMetrics?.ValueAtRisk ?? 0m, 2)
    };

    return Results.Ok(summary);
})
    .WithName("GetDashboardSummary")
    .WithSummary("Mengambil ringkasan indikator makro dan fiskal nasional.")
    .WithTags("Dashboard")
    .AllowAnonymous();

app.MapGet("/api/v1/dashboard/corridors", async (BrantasDbContext database, CancellationToken cancellationToken) =>
{
    var version = await database.DatasetVersions
        .Where(item => item.Status == Brantas.Domain.Entities.DatasetStatus.Completed)
        .OrderByDescending(item => item.IngestedAt)
        .FirstOrDefaultAsync(cancellationToken);

    if (version is null) return Results.NotFound(new { title = "Data belum tersedia" });

    var provinces = await (
        from indicator in database.PovertyIndicators
        join region in database.Regions on indicator.RegionId equals region.Id
        join allocation in database.FiscalAllocations on new { indicator.RegionId, indicator.DatasetVersionId } equals new { allocation.RegionId, allocation.DatasetVersionId } into allocGroup
        from alloc in allocGroup.DefaultIfEmpty()
        where indicator.DatasetVersionId == version.Id && region.Level == Brantas.Domain.Entities.RegionLevel.Province
        select new
        {
            Code = region.BpsCode,
            Name = region.Name,
            indicator.PovertyRate,
            indicator.PoorPopulation,
            indicator.HumanDevelopmentIndex,
            indicator.PovertyDepthIndex,
            Allocation = alloc != null ? alloc.TotalAllocation : 0m
        }).ToListAsync(cancellationToken);

    var regencyCounts = await database.Regions
        .Where(r => r.Level == Brantas.Domain.Entities.RegionLevel.Regency && r.ParentId != null)
        .GroupBy(r => r.ParentId)
        .Select(g => new { ParentId = g.Key, Count = g.Count() })
        .ToDictionaryAsync(g => g.ParentId!.Value, g => g.Count, cancellationToken);

    string GetCorridor(string code) =>
        code.StartsWith("1") || code.StartsWith("2") ? "Sumatera" :
        code.StartsWith("3") || code == "51" ? "Jawa - Bali" :
        code.StartsWith("5") ? "Nusa Tenggara" :
        code.StartsWith("6") ? "Kalimantan" :
        code.StartsWith("7") ? "Sulawesi" : "Maluku - Papua";

    var corridors = provinces
        .GroupBy(p => GetCorridor(p.Code))
        .Select(group => new
        {
            corridor = group.Key,
            provinceCount = group.Count(),
            averagePovertyRate = Math.Round(group.Average(p => p.PovertyRate), 2),
            totalPoorPopulation = group.Sum(p => p.PoorPopulation),
            totalAllocation = Math.Round(group.Sum(p => p.Allocation), 2),
            averageHdi = Math.Round(group.Average(p => p.HumanDevelopmentIndex), 1),
            averageP1 = Math.Round(group.Average(p => p.PovertyDepthIndex), 2),
            highestPovertyProvince = group.OrderByDescending(p => p.PovertyRate).First().Name,
            highestPovertyRate = group.Max(p => p.PovertyRate)
        })
        .OrderByDescending(c => c.averagePovertyRate)
        .ToList();

    return Results.Ok(corridors);
})
    .WithName("GetDashboardCorridors")
    .WithSummary("Mengambil agregasi indikator kemiskinan dan anggaran berdasarkan 6 koridor kepulauan.")
    .WithTags("Dashboard")
    .AllowAnonymous();

app.MapGet("/api/v1/dashboard/regency-ranks", async (BrantasDbContext database, CancellationToken cancellationToken) =>
{
    var version = await database.DatasetVersions
        .Where(item => item.Status == Brantas.Domain.Entities.DatasetStatus.Completed)
        .OrderByDescending(item => item.IngestedAt)
        .FirstOrDefaultAsync(cancellationToken);

    if (version is null) return Results.NotFound(new { title = "Data belum tersedia" });

    var regencies = await (
        from indicator in database.PovertyIndicators
        join region in database.Regions on indicator.RegionId equals region.Id
        join parent in database.Regions on region.ParentId equals parent.Id
        where indicator.DatasetVersionId == version.Id && region.Level == Brantas.Domain.Entities.RegionLevel.Regency
        select new
        {
            regencyName = region.Name,
            provinceName = parent.Name,
            povertyRate = indicator.PovertyRate,
            poorPopulation = indicator.PoorPopulation,
            humanDevelopmentIndex = indicator.HumanDevelopmentIndex,
            povertyDepthIndex = indicator.PovertyDepthIndex,
            povertySeverityIndex = indicator.PovertySeverityIndex,
            gdpPerCapita = indicator.GdpPerCapita
        }).ToListAsync(cancellationToken);

    var topPoverty = regencies.OrderByDescending(r => r.povertyRate).Take(15).ToList();
    var lowestPoverty = regencies.OrderBy(r => r.povertyRate).Take(10).ToList();

    return Results.Ok(new
    {
        totalRegencies = regencies.Count,
        topPoverty,
        lowestPoverty
    });
})
    .WithName("GetDashboardRegencyRanks")
    .WithSummary("Mengambil peringkat kabupaten/kota dengan tingkat kemiskinan tertinggi dan terendah nasional.")
    .WithTags("Dashboard")
    .AllowAnonymous();

app.MapGet("/api/v1/dashboard/distribution", async (BrantasDbContext database, CancellationToken cancellationToken) =>
{
    var version = await database.DatasetVersions
        .Where(item => item.Status == Brantas.Domain.Entities.DatasetStatus.Completed)
        .OrderByDescending(item => item.IngestedAt)
        .FirstOrDefaultAsync(cancellationToken);

    if (version is null) return Results.NotFound(new { title = "Data belum tersedia" });

    var regencyRates = await database.PovertyIndicators
        .Where(item => item.DatasetVersionId == version.Id && item.Region!.Level == Brantas.Domain.Entities.RegionLevel.Regency)
        .Select(item => item.PovertyRate)
        .ToListAsync(cancellationToken);

    var distribution = new[]
    {
        new { label = "< 5% (Sangat Rendah)", count = regencyRates.Count(r => r < 5m), color = "#0f766e" },
        new { label = "5% - 10% (Rendah)", count = regencyRates.Count(r => r >= 5m && r < 10m), color = "#14b8a6" },
        new { label = "10% - 15% (Sedang)", count = regencyRates.Count(r => r >= 10m && r < 15m), color = "#f59e0b" },
        new { label = "15% - 20% (Tinggi)", count = regencyRates.Count(r => r >= 15m && r < 20m), color = "#ea580c" },
        new { label = "20% - 25% (Sangat Tinggi)", count = regencyRates.Count(r => r >= 20m && r < 25m), color = "#e11d48" },
        new { label = "> 25% (Kritis)", count = regencyRates.Count(r => r >= 25m), color = "#9f1239" }
    };

    return Results.Ok(new
    {
        totalEvaluated = regencyRates.Count,
        distribution
    });
})
    .WithName("GetDashboardDistribution")
    .WithSummary("Mengambil distribusi sebaran kelas kemiskinan 514 kabupaten/kota se-Indonesia.")
    .WithTags("Dashboard")
    .AllowAnonymous();

app.MapGet("/api/v1/dashboard/priority-regions", async (BrantasDbContext database, CancellationToken cancellationToken) =>
{
    var version = await database.DatasetVersions
        .Where(item => item.Status == Brantas.Domain.Entities.DatasetStatus.Completed)
        .OrderByDescending(item => item.IngestedAt)
        .FirstOrDefaultAsync(cancellationToken);

    if (version is null)
    {
        return Results.NotFound(new { title = "Data belum tersedia", detail = "Jalankan pipeline data sintetis terlebih dahulu." });
    }

    var regions = await database.PovertyIndicators
        .Where(item => item.DatasetVersionId == version.Id && item.Region!.Level == Brantas.Domain.Entities.RegionLevel.Province)
        .OrderByDescending(item => item.PovertyRate)
        .Take(5)
        .Select(item => new
        {
            region = item.Region!.Name,
            povertyRate = item.PovertyRate,
            poorPopulation = item.PoorPopulation,
            humanDevelopmentIndex = item.HumanDevelopmentIndex
        })
        .ToListAsync(cancellationToken);

    return Results.Ok(regions);
})
    .WithName("GetPriorityRegions")
    .WithSummary("Mengambil lima wilayah dengan tingkat kemiskinan tertinggi.")
    .WithTags("Dashboard")
    .AllowAnonymous();

app.MapGet("/api/v1/anomalies/summary", async (BrantasDbContext database, CancellationToken cancellationToken) =>
{
    var version = await database.DatasetVersions
        .Where(item => item.Status == Brantas.Domain.Entities.DatasetStatus.Completed)
        .OrderByDescending(item => item.IngestedAt)
        .FirstOrDefaultAsync(cancellationToken);

    if (version is null)
    {
        return Results.NotFound(new { title = "Data belum tersedia", detail = "Jalankan pipeline data sintetis terlebih dahulu." });
    }

    var anomalies = database.Anomalies.Where(item => item.DatasetVersionId == version.Id);
    var summary = await anomalies.GroupBy(_ => 1).Select(group => new
    {
        datasetVersionId = version.Id,
        period = version.Period,
        totalCount = group.Count(),
        underAllocationCount = group.Count(item => item.Type == Brantas.Domain.Entities.AnomalyType.FiscalUnderAllocation),
        overAllocationCount = group.Count(item => item.Type == Brantas.Domain.Entities.AnomalyType.FiscalOverAllocation),
        criticalCount = group.Count(item => item.Severity == Brantas.Domain.Entities.AnomalySeverity.Critical),
        totalValueAtRisk = Math.Round(group.Sum(item => item.ValueAtRisk), 2)
    }).FirstOrDefaultAsync(cancellationToken);

    return Results.Ok(summary ?? new
    {
        datasetVersionId = version.Id,
        period = version.Period,
        totalCount = 0,
        underAllocationCount = 0,
        overAllocationCount = 0,
        criticalCount = 0,
        totalValueAtRisk = 0m
    });
})
    .WithName("GetAnomalySummary")
    .WithSummary("Mengambil ringkasan temuan anomali fiskal pada dataset aktif.")
    .WithTags("Anomali")
    .AllowAnonymous();

app.MapGet("/api/v1/anomalies", async (HttpContext context, BrantasDbContext database, CancellationToken cancellationToken) =>
{
    var (role, userRegion) = GetClientContext(context);
    var version = await database.DatasetVersions
        .Where(item => item.Status == Brantas.Domain.Entities.DatasetStatus.Completed)
        .OrderByDescending(item => item.IngestedAt)
        .FirstOrDefaultAsync(cancellationToken);

    if (version is null)
    {
        return Results.NotFound(new { title = "Data belum tersedia", detail = "Jalankan pipeline data sintetis terlebih dahulu." });
    }

    var query = database.Anomalies.Where(item => item.DatasetVersionId == version.Id);
    if (role == "REGIONAL" && !string.IsNullOrWhiteSpace(userRegion))
    {
        query = query.Where(item => item.Region!.Name.ToLower().Contains(userRegion.ToLower()) || (item.Region.Parent != null && item.Region.Parent.Name.ToLower().Contains(userRegion.ToLower())));
    }

    var findings = await query
        .OrderByDescending(item => item.Severity)
        .ThenByDescending(item => item.ValueAtRisk)
        .Select(item => new
        {
            id = item.Id,
            region = item.Region!.Name,
            type = item.Type == Brantas.Domain.Entities.AnomalyType.FiscalUnderAllocation ? "Under-allocation" : "Over-allocation",
            severity = item.Severity.ToString(),
            confidenceScore = item.ConfidenceScore,
            zScore = item.ZScore,
            valueAtRisk = item.ValueAtRisk,
            explanation = item.Explanation,
            reviewStatus = database.AnomalyReviews.Where(review => review.AnomalyId == item.Id).Select(review => review.Status.ToString()).FirstOrDefault() ?? "InVerification"
        })
        .ToListAsync(cancellationToken);

    return Results.Ok(findings);
})
    .WithName("GetAnomalies")
    .WithSummary("Mengambil daftar temuan anomali fiskal pada dataset aktif (difilter cakupan wilayah untuk peran REGIONAL).")
    .WithTags("Anomali")
    .AllowAnonymous();

app.MapGet("/api/v1/anomalies/onnx-multivariate", async (BrantasDbContext database, CancellationToken cancellationToken) =>
{
    var version = await database.DatasetVersions
        .Where(item => item.Status == Brantas.Domain.Entities.DatasetStatus.Completed)
        .OrderByDescending(item => item.IngestedAt)
        .FirstOrDefaultAsync(cancellationToken);

    if (version is null)
    {
        return Results.NotFound(new { title = "Data belum tersedia", detail = "Jalankan pipeline data sintetis terlebih dahulu." });
    }

    var observations = await (
        from indicator in database.PovertyIndicators
        join allocation in database.FiscalAllocations on indicator.RegionId equals allocation.RegionId
        where indicator.DatasetVersionId == version.Id && allocation.DatasetVersionId == version.Id && indicator.Region!.Level == Brantas.Domain.Entities.RegionLevel.Province
        select new MultivariateObservation(
            indicator.RegionId,
            indicator.Region!.Name,
            indicator.PovertyRate,
            indicator.PovertyDepthIndex,
            indicator.PovertySeverityIndex,
            indicator.HumanDevelopmentIndex,
            indicator.PoorPopulation > 0 ? allocation.TotalAllocation / indicator.PoorPopulation : 0m
        )).ToListAsync(cancellationToken);

    var detector = new OnnxAnomalyDetector();
    var results = detector.DetectAnomalies(observations);

    return Results.Ok(new
    {
        datasetVersionId = version.Id,
        period = version.Period,
        model = "Microsoft.ML.OnnxRuntime (Multivariate Isolation/Projection)",
        totalEvaluated = results.Count,
        criticalCount = results.Count(r => r.Severity == "Critical"),
        highCount = results.Count(r => r.Severity == "High"),
        results
    });
})
    .WithName("GetOnnxMultivariateAnomalies")
    .WithSummary("Mengeksekusi model ONNX native untuk mendeteksi anomali multivariat indikator sosial dan fiskal.")
    .WithTags("Anomali")
    .AllowAnonymous();

app.MapPut("/api/v1/anomalies/{id:guid}/review", async (Guid id, UpdateAnomalyReviewRequest request, HttpContext context, BrantasDbContext database, CancellationToken cancellationToken) =>
{
    var (role, userRegion) = GetClientContext(context);
    if (!Enum.TryParse<Brantas.Domain.Entities.AnomalyReviewStatus>(request.Status, true, out var status)) return Results.BadRequest(new { title = "Status tinjauan tidak valid." });
    var anomaly = await database.Anomalies.Include(a => a.Region).SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
    if (anomaly is null) return Results.NotFound(new { title = "Temuan tidak ditemukan." });

    if (role == "REGIONAL" && !string.IsNullOrWhiteSpace(userRegion) && !anomaly.Region!.Name.Contains(userRegion, StringComparison.OrdinalIgnoreCase))
    {
        return Results.Forbid();
    }

    var review = await database.AnomalyReviews.SingleOrDefaultAsync(item => item.AnomalyId == id, cancellationToken);
    if (review is null)
    {
        review = new Brantas.Domain.Entities.AnomalyReview { AnomalyId = id, Status = status };
        database.AnomalyReviews.Add(review);
    }
    else
    {
        review.Status = status;
        review.UpdatedAt = DateTimeOffset.UtcNow;
    }

    database.AuditLogs.Add(new Brantas.Domain.Entities.AuditLog
    {
        Action = "UpdateAnomalyReview",
        ActorRole = role,
        ActorRegion = userRegion,
        DetailsJson = JsonSerializer.Serialize(new { anomalyId = id, region = anomaly.Region?.Name, status = status.ToString() }),
        IsSuccess = true
    });

    await database.SaveChangesAsync(cancellationToken);
    return Results.Ok(new { anomalyId = id, reviewStatus = status.ToString(), updatedAt = review.UpdatedAt });
})
    .WithName("UpdateAnomalyReview")
    .WithSummary("Menyimpan hasil tinjauan temuan anomali fiskal dengan pencatatan audit log.")
    .WithTags("Anomali")
    .AllowAnonymous();

app.MapGet("/api/v1/spatial/morans-i", async (BrantasDbContext database, CancellationToken cancellationToken) =>
{
    var version = await database.DatasetVersions
        .Where(item => item.Status == Brantas.Domain.Entities.DatasetStatus.Completed)
        .OrderByDescending(item => item.IngestedAt)
        .FirstOrDefaultAsync(cancellationToken);

    if (version is null)
    {
        return Results.NotFound(new { title = "Data belum tersedia", detail = "Jalankan pipeline data sintetis terlebih dahulu." });
    }

    var regions = await database.PovertyIndicators
        .Where(item => item.DatasetVersionId == version.Id && item.Region!.Level == Brantas.Domain.Entities.RegionLevel.Regency)
        .Select(item => new { item.RegionId, item.PovertyRate, Region = item.Region! })
        .ToListAsync(cancellationToken);
    var parentNames = await database.Regions
        .Where(item => item.Level == Brantas.Domain.Entities.RegionLevel.Province)
        .ToDictionaryAsync(item => item.Id, item => item.Name, cancellationToken);
    var observations = regions.Select(item => new SpatialObservation(
        item.RegionId,
        item.Region.ParentId!.Value,
        item.Region.Latitude!.Value,
        item.Region.Longitude!.Value,
        item.PovertyRate)).ToArray();
    var analysis = new MoranCalculator().Analyze(observations);
    var clusters = analysis.LocalResults.ToDictionary(item => item.RegionId);

    return Results.Ok(new
    {
        datasetVersionId = version.Id,
        period = version.Period,
        globalMoranI = analysis.GlobalI,
        regionCount = observations.Length,
        regions = regions.Select(item => new
        {
            name = item.Region.Name,
            parent = parentNames[item.Region.ParentId!.Value],
            latitude = item.Region.Latitude,
            longitude = item.Region.Longitude,
            povertyRate = item.PovertyRate,
            cluster = clusters[item.RegionId].Cluster,
            localScore = clusters[item.RegionId].LocalScore
        })
    });
})
    .WithName("GetMoransI")
    .WithSummary("Menghitung autokorelasi spasial Global dan Local Moran's I untuk kabupaten/kota sintetis.")
    .WithTags("Spasial")
    .AllowAnonymous();

app.MapGet("/api/v1/spatial/regions.geojson", async (BrantasDbContext database, CancellationToken cancellationToken) =>
{
    var version = await database.DatasetVersions.Where(item => item.Status == Brantas.Domain.Entities.DatasetStatus.Completed).OrderByDescending(item => item.IngestedAt).FirstOrDefaultAsync(cancellationToken);
    if (version is null) return Results.NotFound(new { title = "Data belum tersedia", detail = "Jalankan pipeline data sintetis terlebih dahulu." });
    var regions = await database.PovertyIndicators.Where(item => item.DatasetVersionId == version.Id && item.Region!.Level == Brantas.Domain.Entities.RegionLevel.Regency)
        .Select(item => new
        {
            item.RegionId,
            item.Region!.Name,
            item.Region.ParentId,
            item.Region.Latitude,
            item.Region.Longitude,
            item.PovertyRate,
            item.PovertyDepthIndex,
            item.PovertySeverityIndex,
            item.HumanDevelopmentIndex,
            item.GdpPerCapita,
            item.PoorPopulation
        })
        .ToListAsync(cancellationToken);
    var parents = await database.Regions.Where(item => item.Level == Brantas.Domain.Entities.RegionLevel.Province).ToDictionaryAsync(item => item.Id, item => item.Name, cancellationToken);
    var observations = regions.Select(item => new SpatialObservation(
        item.RegionId,
        item.ParentId!.Value,
        item.Latitude!.Value,
        item.Longitude!.Value,
        item.PovertyRate)).ToArray();
    var analysis = new MoranCalculator().Analyze(observations);
    var clusters = analysis.LocalResults.ToDictionary(item => item.RegionId);

    return Results.Ok(new
    {
        type = "FeatureCollection",
        datasetVersionId = version.Id,
        period = version.Period,
        globalMoranI = analysis.GlobalI,
        features = regions.Select(region => new
        {
            type = "Feature",
            properties = new
            {
                regionId = region.RegionId,
                name = region.Name,
                parent = parents[region.ParentId!.Value],
                povertyRate = region.PovertyRate,
                povertyDepthIndex = region.PovertyDepthIndex,
                povertySeverityIndex = region.PovertySeverityIndex,
                humanDevelopmentIndex = region.HumanDevelopmentIndex,
                gdpPerCapita = region.GdpPerCapita,
                poorPopulation = region.PoorPopulation,
                cluster = clusters[region.RegionId].Cluster,
                localScore = clusters[region.RegionId].LocalScore
            },
            geometry = new
            {
                type = "Point",
                coordinates = new[] { region.Longitude!.Value, region.Latitude!.Value }
            }
        })
    });
})
    .WithName("GetSpatialRegionsGeoJson")
    .WithSummary("Mengambil poligon GeoJSON tersimplifikasi kabupaten/kota sintetis.")
    .WithTags("Spasial")
    .AllowAnonymous();

app.MapGet("/api/v1/spatial/regions.csv", async (BrantasDbContext database, CancellationToken cancellationToken) =>
{
    var version = await database.DatasetVersions.Where(item => item.Status == Brantas.Domain.Entities.DatasetStatus.Completed).OrderByDescending(item => item.IngestedAt).FirstOrDefaultAsync(cancellationToken);
    if (version is null) return Results.NotFound(new { title = "Data belum tersedia", detail = "Jalankan pipeline data sintetis terlebih dahulu." });
    var regions = await database.PovertyIndicators.Where(item => item.DatasetVersionId == version.Id && item.Region!.Level == Brantas.Domain.Entities.RegionLevel.Regency)
        .Select(item => new
        {
            item.RegionId,
            item.Region!.Name,
            item.Region.ParentId,
            item.PovertyRate,
            item.PovertyDepthIndex,
            item.PovertySeverityIndex,
            item.HumanDevelopmentIndex,
            item.GdpPerCapita,
            item.PoorPopulation
        })
        .ToListAsync(cancellationToken);
    var parents = await database.Regions.Where(item => item.Level == Brantas.Domain.Entities.RegionLevel.Province).ToDictionaryAsync(item => item.Id, item => item.Name, cancellationToken);
    var observations = regions.Select(item => new SpatialObservation(
        item.RegionId,
        item.ParentId!.Value,
        0m,
        0m,
        item.PovertyRate)).ToArray();
    var analysis = new MoranCalculator().Analyze(observations);
    var clusters = analysis.LocalResults.ToDictionary(item => item.RegionId);

    var csv = new StringBuilder("KabupatenKota,Provinsi,TingkatKemiskinan,KedalamanP1,KeparahanP2,IPM,PDRBPerKapitaJuta,PendudukMiskin,KlasterSpasial\n");
    foreach (var r in regions)
    {
        csv.AppendLine($"{Csv(r.Name)},{Csv(parents[r.ParentId!.Value])},{r.PovertyRate.ToString(System.Globalization.CultureInfo.InvariantCulture)},{r.PovertyDepthIndex.ToString(System.Globalization.CultureInfo.InvariantCulture)},{r.PovertySeverityIndex.ToString(System.Globalization.CultureInfo.InvariantCulture)},{r.HumanDevelopmentIndex.ToString(System.Globalization.CultureInfo.InvariantCulture)},{r.GdpPerCapita.ToString(System.Globalization.CultureInfo.InvariantCulture)},{r.PoorPopulation},{Csv(clusters[r.RegionId].Cluster)}");
    }
    return Results.File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv.ToString())).ToArray(), "text/csv", $"spasial-kemiskinan-brantas-{version.Period}.csv");
})
    .WithName("ExportSpatialRegionsCsv")
    .WithSummary("Mengekspor data spasial indikator kemiskinan tingkat kabupaten/kota sebagai CSV.")
    .WithTags("Spasial")
    .AllowAnonymous();

app.MapGet("/api/v1/beneficiaries/anomaly-summary", async (BrantasDbContext database, CancellationToken cancellationToken) =>
{
    var version = await database.DatasetVersions
        .Where(item => item.Status == Brantas.Domain.Entities.DatasetStatus.Completed)
        .OrderByDescending(item => item.IngestedAt)
        .FirstOrDefaultAsync(cancellationToken);
    if (version is null)
    {
        return Results.NotFound(new { title = "Data belum tersedia", detail = "Jalankan pipeline data sintetis terlebih dahulu." });
    }

    var records = database.BeneficiaryRecords.Where(item => item.DatasetVersionId == version.Id);
    var duplicateGroupSizes = await records
        .GroupBy(item => item.NikHash)
        .Select(group => group.Count())
        .Where(count => count > 1)
        .ToListAsync(cancellationToken);
    var summary = new
    {
        datasetVersionId = version.Id,
        totalBeneficiaries = await records.CountAsync(cancellationToken),
        activePublicServantCount = await records.CountAsync(item => item.IsActivePublicServant, cancellationToken),
        deceasedCount = await records.CountAsync(item => item.IsDeceased, cancellationToken),
        economicAssetCount = await records.CountAsync(item => item.HasEconomicAsset, cancellationToken),
        duplicateIdentityCount = duplicateGroupSizes.Sum(count => count - 1)
    };
    return Results.Ok(summary);
})
    .WithName("GetBeneficiaryAnomalySummary")
    .WithSummary("Mengambil agregat anomali kepesertaan tanpa mengekspos identitas penerima.")
    .WithTags("Anomali")
    .AllowAnonymous();

app.MapGet("/api/v1/beneficiaries/anomaly-findings", async (BrantasDbContext database, CancellationToken cancellationToken) =>
{
    var version = await database.DatasetVersions.Where(item => item.Status == Brantas.Domain.Entities.DatasetStatus.Completed).OrderByDescending(item => item.IngestedAt).FirstOrDefaultAsync(cancellationToken);
    if (version is null) return Results.NotFound(new { title = "Data belum tersedia", detail = "Jalankan pipeline data sintetis terlebih dahulu." });
    var findings = await database.BeneficiaryRecords.Where(item => item.DatasetVersionId == version.Id)
        .GroupBy(item => new { item.RegionId, Region = item.Region!.Name })
        .Select(group => new
        {
            group.Key.Region,
            activePublicServantCount = group.Count(item => item.IsActivePublicServant),
            deceasedCount = group.Count(item => item.IsDeceased),
            economicAssetCount = group.Count(item => item.HasEconomicAsset),
            totalCount = group.Count()
        })
        .ToListAsync(cancellationToken);
    return Results.Ok(findings.SelectMany(item => new[]
    {
        new { region = item.Region, type = "Penerima ASN/TNI/Polri aktif", count = item.activePublicServantCount, confidenceScore = 96m, severity = item.activePublicServantCount >= 80 ? "High" : "Medium", explanation = "Terdapat indikasi status aparatur aktif berdasarkan data sintetis; verifikasi administratif diperlukan." },
        new { region = item.Region, type = "Penerima terindikasi meninggal", count = item.deceasedCount, confidenceScore = 94m, severity = item.deceasedCount >= 35 ? "High" : "Medium", explanation = "Terdapat indikasi ketidaksesuaian status kependudukan pada data sintetis; verifikasi administratif diperlukan." },
        new { region = item.Region, type = "Indikator aset ekonomi", count = item.economicAssetCount, confidenceScore = 82m, severity = item.economicAssetCount >= 130 ? "High" : "Medium", explanation = "Terdapat indikator kemampuan ekonomi pada data sintetis; bukan penetapan ketidaklayakan otomatis." }
    }).Where(item => item.count > 0).OrderByDescending(item => item.count));
})
    .WithName("GetBeneficiaryAnomalyFindings")
    .WithSummary("Mengambil temuan agregat kepesertaan per wilayah tanpa mengekspos identitas penerima.")
    .WithTags("Anomali")
    .AllowAnonymous();

app.MapGet("/api/v1/beneficiaries/exclusion-errors", async (BrantasDbContext database, CancellationToken cancellationToken) =>
{
    var version = await database.DatasetVersions
        .Where(item => item.Status == Brantas.Domain.Entities.DatasetStatus.Completed)
        .OrderByDescending(item => item.IngestedAt)
        .FirstOrDefaultAsync(cancellationToken);
    if (version is null)
    {
        return Results.NotFound(new { title = "Data belum tersedia", detail = "Jalankan pipeline data sintetis terlebih dahulu." });
    }

    var regions = await database.WelfareCoverages
        .Where(item => item.DatasetVersionId == version.Id && item.EstimatedEligibleHouseholds > item.RegisteredBeneficiaries)
        .OrderByDescending(item => item.EstimatedEligibleHouseholds - item.RegisteredBeneficiaries)
        .Take(20)
        .Select(item => new
        {
            region = item.Region!.Name,
            estimatedEligibleHouseholds = item.EstimatedEligibleHouseholds,
            registeredBeneficiaries = item.RegisteredBeneficiaries,
            gap = item.EstimatedEligibleHouseholds - item.RegisteredBeneficiaries,
            gapRate = Math.Round(100m * (item.EstimatedEligibleHouseholds - item.RegisteredBeneficiaries) / item.EstimatedEligibleHouseholds, 2)
        })
        .ToListAsync(cancellationToken);
    return Results.Ok(regions);
})
    .WithName("GetExclusionErrors")
    .WithSummary("Mengambil wilayah dengan estimasi keluarga layak yang belum tercakup program bantuan.")
    .WithTags("Anomali")
    .AllowAnonymous();

app.MapGet("/api/v1/optimization/recommendations", async (BrantasDbContext database, decimal? povertyWeight, decimal? depthWeight, decimal? severityWeight, decimal? humanDevelopmentWeight, decimal? gdpWeight, decimal? disasterWeight, decimal? capPercent, CancellationToken cancellationToken) =>
{
    var version = await database.DatasetVersions.Where(item => item.Status == Brantas.Domain.Entities.DatasetStatus.Completed).OrderByDescending(item => item.IngestedAt).FirstOrDefaultAsync(cancellationToken);
    if (version is null) return Results.NotFound(new { title = "Data belum tersedia", detail = "Jalankan pipeline data sintetis terlebih dahulu." });
    var observations = await (
        from indicator in database.PovertyIndicators
        join allocation in database.FiscalAllocations on indicator.RegionId equals allocation.RegionId
        where indicator.DatasetVersionId == version.Id && allocation.DatasetVersionId == version.Id && indicator.Region!.Level == Brantas.Domain.Entities.RegionLevel.Province
        select new AllocationObservation(indicator.RegionId, indicator.Region!.Name, indicator.PovertyRate, indicator.PovertyDepthIndex, indicator.PovertySeverityIndex, indicator.HumanDevelopmentIndex, indicator.GdpPerCapita, Math.Abs(indicator.Region.BpsCode.GetHashCode() % 100) / 100m, indicator.PoorPopulation, allocation.TotalAllocation)).ToListAsync(cancellationToken);
    var weights = new AllocationWeights(povertyWeight ?? 30m, depthWeight ?? 15m, severityWeight ?? 15m, humanDevelopmentWeight ?? 15m, gdpWeight ?? 15m, disasterWeight ?? 10m);
    var totalBudget = observations.Sum(item => item.BaselineAllocation);
    var result = new AllocationOptimizer().Optimize(observations, weights, totalBudget, 500m, capPercent ?? .25m);
    return Results.Ok(new { datasetVersionId = version.Id, totalBudget, capPercent = capPercent ?? .25m, weights = result.Weights, recommendations = result.Recommendations.OrderByDescending(item => item.Delta).Select(item => new { region = item.RegionName, baselineAllocation = item.BaselineAllocation, recommendedAllocation = item.RecommendedAllocation, delta = item.Delta, deltaPercent = item.DeltaPercent, vulnerabilityIndex = item.VulnerabilityIndex, poorPopulation = item.PoorPopulation }) });
})
    .WithName("GetAllocationRecommendations")
    .WithSummary("Menghitung rekomendasi alokasi berbasis IKW dengan floor dan cap perubahan.")
    .WithTags("Optimasi")
    .AllowAnonymous();

app.MapPost("/api/v1/optimization/scenarios", async (CreateSimulationScenarioRequest request, HttpContext context, BrantasDbContext database, CancellationToken cancellationToken) =>
{
    var (role, userRegion) = GetClientContext(context);
    var version = await database.DatasetVersions.Where(item => item.Status == Brantas.Domain.Entities.DatasetStatus.Completed).OrderByDescending(item => item.IngestedAt).FirstOrDefaultAsync(cancellationToken);
    if (version is null) return Results.NotFound(new { title = "Data belum tersedia", detail = "Jalankan pipeline data sintetis terlebih dahulu." });
    if (string.IsNullOrWhiteSpace(request.Name)) return Results.BadRequest(new { title = "Nama skenario wajib diisi." });
    var observations = await (
        from indicator in database.PovertyIndicators
        join allocation in database.FiscalAllocations on indicator.RegionId equals allocation.RegionId
        where indicator.DatasetVersionId == version.Id && allocation.DatasetVersionId == version.Id && indicator.Region!.Level == Brantas.Domain.Entities.RegionLevel.Province
        select new AllocationObservation(indicator.RegionId, indicator.Region!.Name, indicator.PovertyRate, indicator.PovertyDepthIndex, indicator.PovertySeverityIndex, indicator.HumanDevelopmentIndex, indicator.GdpPerCapita, Math.Abs(indicator.Region.BpsCode.GetHashCode() % 100) / 100m, indicator.PoorPopulation, allocation.TotalAllocation)).ToListAsync(cancellationToken);
    var weights = new AllocationWeights(request.PovertyWeight, request.DepthWeight, request.SeverityWeight, request.HumanDevelopmentWeight, request.GdpWeight, request.DisasterWeight);
    var totalBudget = observations.Sum(item => item.BaselineAllocation);
    var result = new AllocationOptimizer().Optimize(observations, weights, totalBudget, 500m, request.CapPercent);
    var scenario = new Brantas.Domain.Entities.SimulationScenario
    {
        DatasetVersionId = version.Id,
        Name = request.Name.Trim(),
        WeightsJson = JsonSerializer.Serialize(result.Weights),
        ConstraintsJson = JsonSerializer.Serialize(new { floor = 500m, capPercent = request.CapPercent }),
        TotalBudget = totalBudget
    };
    database.SimulationScenarios.Add(scenario);
    database.AllocationResults.AddRange(result.Recommendations.Select(item => new Brantas.Domain.Entities.AllocationResult
    {
        ScenarioId = scenario.Id,
        RegionId = item.RegionId,
        VulnerabilityIndex = item.VulnerabilityIndex,
        BaselineAmount = item.BaselineAllocation,
        RecommendedAmount = item.RecommendedAllocation
    }));

    database.AuditLogs.Add(new Brantas.Domain.Entities.AuditLog
    {
        Action = "CreateSimulationScenario",
        ActorRole = role,
        ActorRegion = userRegion,
        DetailsJson = JsonSerializer.Serialize(new { scenarioName = scenario.Name, totalBudget, scenarioId = scenario.Id }),
        IsSuccess = true
    });

    await database.SaveChangesAsync(cancellationToken);
    return Results.Created($"/api/v1/optimization/scenarios/{scenario.Id}", new { id = scenario.Id, name = scenario.Name, datasetVersionId = scenario.DatasetVersionId, createdAt = scenario.CreatedAt });
})
    .WithName("CreateSimulationScenario")
    .WithSummary("Menyimpan hasil simulasi alokasi yang dapat direproduksi dengan pencatatan audit log.")
    .WithTags("Optimasi")
    .AllowAnonymous();

app.MapGet("/api/v1/optimization/scenarios", async (BrantasDbContext database, CancellationToken cancellationToken) =>
    Results.Ok(await database.SimulationScenarios.OrderByDescending(item => item.CreatedAt).Take(20).Select(item => new { id = item.Id, name = item.Name, datasetVersionId = item.DatasetVersionId, totalBudget = item.TotalBudget, createdAt = item.CreatedAt }).ToListAsync(cancellationToken)))
    .WithName("GetSimulationScenarios")
    .WithSummary("Mengambil daftar skenario simulasi tersimpan.")
    .WithTags("Optimasi")
    .AllowAnonymous();

app.MapGet("/api/v1/optimization/scenarios/compare", async (Guid a, Guid b, BrantasDbContext database, CancellationToken cancellationToken) =>
{
    var results = await database.AllocationResults.Where(item => item.ScenarioId == a || item.ScenarioId == b).Select(item => new { item.ScenarioId, region = item.Region!.Name, item.RecommendedAmount }).ToListAsync(cancellationToken);
    if (!results.Any(item => item.ScenarioId == a) || !results.Any(item => item.ScenarioId == b)) return Results.NotFound(new { title = "Skenario tidak ditemukan." });
    return Results.Ok(results.GroupBy(item => item.region).Select(group => new { region = group.Key, scenarioA = group.Single(item => item.ScenarioId == a).RecommendedAmount, scenarioB = group.Single(item => item.ScenarioId == b).RecommendedAmount }).OrderByDescending(item => Math.Abs(item.scenarioB - item.scenarioA)));
})
    .WithName("CompareSimulationScenarios")
    .WithSummary("Membandingkan rekomendasi dua skenario alokasi.")
    .WithTags("Optimasi")
    .AllowAnonymous();

app.MapGet("/api/v1/causal/did", async (BrantasDbContext database, CancellationToken cancellationToken) =>
{
    var version = await database.DatasetVersions.Where(item => item.Status == Brantas.Domain.Entities.DatasetStatus.Completed).OrderByDescending(item => item.IngestedAt).FirstOrDefaultAsync(cancellationToken);
    if (version is null) return Results.NotFound(new { title = "Data belum tersedia", detail = "Jalankan pipeline data sintetis terlebih dahulu." });
    var truth = await database.PolicyImpactGroundTruths.SingleOrDefaultAsync(item => item.DatasetVersionId == version.Id, cancellationToken);
    if (truth is null) return Results.NotFound(new { title = "Panel kausal belum tersedia", detail = "Jalankan pipeline data sintetis terlebih dahulu." });
    var panel = await database.PolicyImpactPanels.Where(item => item.DatasetVersionId == version.Id).Select(item => new PolicyObservation(item.RegionId, item.Year, item.IsTreated, item.SocialProtectionAllocation, item.PovertyRate)).ToListAsync(cancellationToken);
    var result = new DifferenceInDifferencesEstimator().Estimate(panel, truth.TreatmentStartYear);
    return Results.Ok(new { datasetVersionId = version.Id, treatedRegionCount = panel.Select(item => item.RegionId).Distinct().Count(id => panel.Any(item => item.RegionId == id && item.IsTreated)), controlRegionCount = panel.Select(item => item.RegionId).Distinct().Count(id => panel.Any(item => item.RegionId == id && !item.IsTreated)), treatmentStartYear = truth.TreatmentStartYear, effectPercentagePoints = result.EffectPercentagePoints, standardError = result.StandardError, confidenceInterval95 = new { lower = result.ConfidenceIntervalLower, upper = result.ConfidenceIntervalUpper }, pValue = result.PValue, effectivenessPerTrillion = result.EffectivenessPerTrillion, parallelTrendPassed = result.EventStudy.Where(item => item.Year < truth.TreatmentStartYear).All(item => Math.Abs(item.EffectPercentagePoints) < .05m), eventStudy = result.EventStudy });
})
    .WithName("EstimateDifferenceInDifferences")
    .WithSummary("Mengestimasi dampak kebijakan dengan Difference-in-Differences pada panel sintetis.")
    .WithTags("Evaluasi Kausal")
    .AllowAnonymous();

app.MapGet("/api/v1/reports/policy-brief.pdf", async (BrantasDbContext database, CancellationToken cancellationToken) =>
{
    var version = await database.DatasetVersions.Where(item => item.Status == Brantas.Domain.Entities.DatasetStatus.Completed).OrderByDescending(item => item.IngestedAt).FirstOrDefaultAsync(cancellationToken);
    if (version is null) return Results.NotFound(new { title = "Data belum tersedia", detail = "Jalankan pipeline data sintetis terlebih dahulu." });
    var indicators = database.PovertyIndicators.Where(item => item.DatasetVersionId == version.Id && item.Region!.Level == Brantas.Domain.Entities.RegionLevel.Province);
    var priorities = await indicators.OrderByDescending(item => item.PovertyRate).Take(5).Select(item => new PolicyBriefRegion(item.Region!.Name, item.PovertyRate, item.PoorPopulation)).ToListAsync(cancellationToken);
    var anomalyMetrics = await database.Anomalies.Where(item => item.DatasetVersionId == version.Id).GroupBy(_ => 1).Select(group => new { Count = group.Count(), ValueAtRisk = group.Sum(item => item.ValueAtRisk) }).FirstOrDefaultAsync(cancellationToken);
    var truth = await database.PolicyImpactGroundTruths.SingleOrDefaultAsync(item => item.DatasetVersionId == version.Id, cancellationToken);
    var panel = truth is null ? [] : await database.PolicyImpactPanels.Where(item => item.DatasetVersionId == version.Id).Select(item => new PolicyObservation(item.RegionId, item.Year, item.IsTreated, item.SocialProtectionAllocation, item.PovertyRate)).ToListAsync(cancellationToken);
    var did = truth is null ? null : new DifferenceInDifferencesEstimator().Estimate(panel, truth.TreatmentStartYear);
    var report = new PolicyBriefModel(version.Id, version.Period, version.Checksum, version.Seed, DateTimeOffset.UtcNow, await indicators.CountAsync(cancellationToken), await indicators.AverageAsync(item => item.PovertyRate, cancellationToken), anomalyMetrics?.Count ?? 0, anomalyMetrics?.ValueAtRisk ?? 0m, did?.EffectPercentagePoints ?? 0m, did?.StandardError ?? 0m, did?.ConfidenceIntervalLower ?? 0m, did?.ConfidenceIntervalUpper ?? 0m, did?.PValue ?? 1m, priorities);
    return Results.File(new PolicyBriefDocument(report).GeneratePdf(), "application/pdf", $"telaahan-kebijakan-brantas-{version.Period}.pdf");
})
    .WithName("DownloadPolicyBrief")
    .WithSummary("Menghasilkan telaahan kebijakan PDF berbasis data simulasi aktif.")
    .WithTags("Pelaporan")
    .AllowAnonymous();

app.MapGet("/api/v1/exports/anomalies.csv", async (BrantasDbContext database, CancellationToken cancellationToken) =>
{
    var version = await database.DatasetVersions.Where(item => item.Status == Brantas.Domain.Entities.DatasetStatus.Completed).OrderByDescending(item => item.IngestedAt).FirstOrDefaultAsync(cancellationToken);
    if (version is null) return Results.NotFound(new { title = "Data belum tersedia", detail = "Jalankan pipeline data sintetis terlebih dahulu." });
    var rows = await database.Anomalies.Where(item => item.DatasetVersionId == version.Id).OrderByDescending(item => item.ValueAtRisk).Select(item => new { Region = item.Region!.Name, Type = item.Type, Severity = item.Severity, item.ConfidenceScore, item.ZScore, item.ValueAtRisk, item.Explanation }).ToListAsync(cancellationToken);
    var csv = new StringBuilder("Wilayah,Tipe,Severitas,SkorKeyakinan,ZScore,NilaiRisikoJuta,Penjelasan\n");
    foreach (var row in rows) csv.AppendLine(string.Join(',', [Csv(row.Region), Csv(row.Type.ToString()), Csv(row.Severity.ToString()), row.ConfidenceScore.ToString(System.Globalization.CultureInfo.InvariantCulture), row.ZScore.ToString(System.Globalization.CultureInfo.InvariantCulture), row.ValueAtRisk.ToString(System.Globalization.CultureInfo.InvariantCulture), Csv(row.Explanation)]));
    return Results.File(Encoding.UTF8.GetBytes(csv.ToString()), "text/csv", $"anomali-brantas-{version.Period}.csv");
})
    .WithName("ExportAnomaliesCsv")
    .WithSummary("Mengekspor temuan anomali fiskal tanpa data identitas.")
    .WithTags("Pelaporan")
    .AllowAnonymous();

app.MapGet("/api/v1/exports/allocations.csv", async (BrantasDbContext database, CancellationToken cancellationToken) =>
{
    var version = await database.DatasetVersions.Where(item => item.Status == Brantas.Domain.Entities.DatasetStatus.Completed).OrderByDescending(item => item.IngestedAt).FirstOrDefaultAsync(cancellationToken);
    if (version is null) return Results.NotFound(new { title = "Data belum tersedia", detail = "Jalankan pipeline data sintetis terlebih dahulu." });
    var observations = await (
        from indicator in database.PovertyIndicators
        join allocation in database.FiscalAllocations on indicator.RegionId equals allocation.RegionId
        where indicator.DatasetVersionId == version.Id && allocation.DatasetVersionId == version.Id && indicator.Region!.Level == Brantas.Domain.Entities.RegionLevel.Province
        select new AllocationObservation(indicator.RegionId, indicator.Region!.Name, indicator.PovertyRate, indicator.PovertyDepthIndex, indicator.PovertySeverityIndex, indicator.HumanDevelopmentIndex, indicator.GdpPerCapita, Math.Abs(indicator.Region.BpsCode.GetHashCode() % 100) / 100m, indicator.PoorPopulation, allocation.TotalAllocation)).ToListAsync(cancellationToken);
    var weights = new AllocationWeights(30m, 15m, 15m, 15m, 15m, 10m);
    var totalBudget = observations.Sum(item => item.BaselineAllocation);
    var result = new AllocationOptimizer().Optimize(observations, weights, totalBudget, 500m, .25m);

    var csv = new StringBuilder("Provinsi,AlokasiBaselineJuta,AlokasiRekomendasiJuta,PerubahanJuta,PerubahanPersen,IndeksIKW,PendudukMiskin\n");
    foreach (var item in result.Recommendations.OrderByDescending(r => r.Delta))
    {
        csv.AppendLine($"{Csv(item.RegionName)},{item.BaselineAllocation.ToString(System.Globalization.CultureInfo.InvariantCulture)},{item.RecommendedAllocation.ToString(System.Globalization.CultureInfo.InvariantCulture)},{item.Delta.ToString(System.Globalization.CultureInfo.InvariantCulture)},{item.DeltaPercent.ToString(System.Globalization.CultureInfo.InvariantCulture)},{item.VulnerabilityIndex.ToString(System.Globalization.CultureInfo.InvariantCulture)},{item.PoorPopulation}");
    }
    return Results.File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv.ToString())).ToArray(), "text/csv", $"alokasi-anggaran-brantas-{version.Period}.csv");
})
    .WithName("ExportAllocationsCsv")
    .WithSummary("Mengekspor simulasi alokasi anggaran perlindungan sosial berbasis IKW.")
    .WithTags("Pelaporan")
    .AllowAnonymous();

app.MapPost("/api/v1/jusi/chat", async (JusiChatRequest request, IBrantasAssistant assistant, CancellationToken cancellationToken) =>
{
    try
    {
        return Results.Ok(await assistant.AskAsync(request.Question, cancellationToken));
    }
    catch (ArgumentException exception)
    {
        return Results.BadRequest(new { title = "Pertanyaan tidak valid", detail = exception.Message });
    }
    catch (InvalidOperationException exception)
    {
        return Results.BadRequest(new { title = "Pertanyaan tidak dapat diproses", detail = exception.Message });
    }
})
    .WithName("AskJusi")
    .WithSummary("Menjawab pertanyaan BRANTAS dengan angka yang di-grounding dari database.")
    .WithTags("JUSI")
    .AllowAnonymous();

app.Run();

static string Csv(string value) => $"\"{value.Replace("\"", "\"\"")}\"";

static (string Role, string? Region) GetClientContext(HttpContext context)
{
    var role = context.Request.Headers["X-Brantas-Role"].FirstOrDefault()?.ToUpperInvariant() ?? "CENTRAL";
    var region = context.Request.Headers["X-Brantas-Region"].FirstOrDefault();
    return (role, region);
}

public sealed record CreateSimulationScenarioRequest(string Name, decimal PovertyWeight = 30m, decimal DepthWeight = 15m, decimal SeverityWeight = 15m, decimal HumanDevelopmentWeight = 15m, decimal GdpWeight = 15m, decimal DisasterWeight = 10m, decimal CapPercent = .25m);
public sealed record JusiChatRequest(string Question);
public sealed record UpdateAnomalyReviewRequest(string Status);
