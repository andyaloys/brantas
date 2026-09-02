namespace Brantas.Domain.Entities;

public sealed class PovertyIndicator
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid RegionId { get; init; }
    public Guid DatasetVersionId { get; init; }
    public required string Period { get; init; }
    public decimal PovertyRate { get; init; }
    public int PoorPopulation { get; init; }
    public decimal PovertyDepthIndex { get; init; }
    public decimal PovertySeverityIndex { get; init; }
    public decimal HumanDevelopmentIndex { get; init; }
    public decimal GdpPerCapita { get; init; }
    public Region? Region { get; init; }
    public DatasetVersion? DatasetVersion { get; init; }
}