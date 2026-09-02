namespace Brantas.Domain.Entities;

public sealed class WelfareCoverage
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid RegionId { get; init; }
    public Guid DatasetVersionId { get; init; }
    public int EstimatedEligibleHouseholds { get; init; }
    public int RegisteredBeneficiaries { get; init; }
    public Region? Region { get; init; }
    public DatasetVersion? DatasetVersion { get; init; }
}