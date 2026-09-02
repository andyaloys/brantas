namespace Brantas.Domain.Entities;

public sealed class PolicyImpactGroundTruth
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid DatasetVersionId { get; init; }
    public decimal PlantedEffectPercentagePoints { get; init; }
    public int TreatmentStartYear { get; init; }
    public DatasetVersion? DatasetVersion { get; init; }
}