namespace Brantas.Domain.Entities;

public sealed class AnomalyReview
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid AnomalyId { get; init; }
    public required AnomalyReviewStatus Status { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Anomaly? Anomaly { get; init; }
}

public enum AnomalyReviewStatus { InVerification, Valid, FalsePositive }