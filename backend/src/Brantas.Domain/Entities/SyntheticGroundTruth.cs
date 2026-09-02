namespace Brantas.Domain.Entities;

public sealed class SyntheticGroundTruth
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid RegionId { get; init; }
    public Guid DatasetVersionId { get; init; }
    public AnomalyType ExpectedType { get; init; }
    public Region? Region { get; init; }
    public DatasetVersion? DatasetVersion { get; init; }
}