namespace Brantas.Domain.Entities;

public sealed class PolicyImpactPanel
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid RegionId { get; init; }
    public Guid DatasetVersionId { get; init; }
    public int Year { get; init; }
    public bool IsTreated { get; init; }
    public decimal SocialProtectionAllocation { get; init; }
    public decimal PovertyRate { get; init; }
    public Region? Region { get; init; }
    public DatasetVersion? DatasetVersion { get; init; }
}