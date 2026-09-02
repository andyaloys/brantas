namespace Brantas.Application.Data;

public interface ISyntheticDataSeeder
{
    Task<SyntheticDatasetResult> SeedAsync(CancellationToken cancellationToken);
}

public sealed record SyntheticDatasetResult(Guid DatasetVersionId, int RegionCount, int IndicatorCount, bool AlreadyExists);