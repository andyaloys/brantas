namespace Brantas.Domain.Entities;

public sealed class SimulationScenario
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid DatasetVersionId { get; init; }
    public required string Name { get; init; }
    public required string WeightsJson { get; init; }
    public required string ConstraintsJson { get; init; }
    public decimal TotalBudget { get; init; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DatasetVersion? DatasetVersion { get; init; }
    public ICollection<AllocationResult> Results { get; init; } = new List<AllocationResult>();
}