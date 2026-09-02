namespace Brantas.Domain.Entities;

public sealed class Anomaly
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid RegionId { get; init; }
    public Guid DatasetVersionId { get; init; }
    public AnomalyType Type { get; init; }
    public AnomalySeverity Severity { get; init; }
    public decimal ConfidenceScore { get; init; }
    public decimal ZScore { get; init; }
    public decimal ValueAtRisk { get; init; }
    public required string Explanation { get; init; }
    public DateTimeOffset DetectedAt { get; init; } = DateTimeOffset.UtcNow;
    public Region? Region { get; init; }
    public DatasetVersion? DatasetVersion { get; init; }
}

public enum AnomalyType
{
    FiscalUnderAllocation,
    FiscalOverAllocation,
    ActivePublicServant,
    DuplicateIdentity,
    DeceasedBeneficiary,
    EconomicAssetOwner,
    ExclusionError
}
public enum AnomalySeverity { Medium, High, Critical }