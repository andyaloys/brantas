namespace Brantas.Domain.Entities;

public sealed class AllocationResult
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid ScenarioId { get; init; }
    public Guid RegionId { get; init; }
    public decimal VulnerabilityIndex { get; init; }
    public decimal BaselineAmount { get; init; }
    public decimal RecommendedAmount { get; init; }
    public SimulationScenario? Scenario { get; init; }
    public Region? Region { get; init; }
}