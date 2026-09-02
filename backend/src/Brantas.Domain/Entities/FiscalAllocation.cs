namespace Brantas.Domain.Entities;

public sealed class FiscalAllocation
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid RegionId { get; init; }
    public Guid DatasetVersionId { get; init; }
    public decimal TotalAllocation { get; init; }
    public Region? Region { get; init; }
    public DatasetVersion? DatasetVersion { get; init; }
}