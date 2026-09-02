namespace Brantas.Domain.Entities;

public sealed class AuditLog
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Action { get; init; }
    public required string ActorRole { get; init; }
    public string? ActorRegion { get; init; }
    public string? DetailsJson { get; init; }
    public bool IsSuccess { get; init; } = true;
    public DateTimeOffset OccurredAt { get; init; } = DateTimeOffset.UtcNow;
}
