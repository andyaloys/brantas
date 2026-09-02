namespace Brantas.Domain.Entities;

public sealed class BeneficiaryRecord
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid RegionId { get; init; }
    public Guid DatasetVersionId { get; init; }
    public required string NikHash { get; init; }
    public required string NkkHash { get; init; }
    public required string Program { get; init; }
    public int Decile { get; init; }
    public bool IsActivePublicServant { get; init; }
    public bool IsDeceased { get; init; }
    public bool HasEconomicAsset { get; init; }
    public Region? Region { get; init; }
    public DatasetVersion? DatasetVersion { get; init; }
}