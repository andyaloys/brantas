namespace Brantas.Domain.Entities;

public sealed class AssistantAuditLog
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid? DatasetVersionId { get; init; }
    public required string RequestHash { get; init; }
    public required string Outcome { get; init; }
    public DateTimeOffset OccurredAt { get; init; } = DateTimeOffset.UtcNow;
    public DatasetVersion? DatasetVersion { get; init; }
}