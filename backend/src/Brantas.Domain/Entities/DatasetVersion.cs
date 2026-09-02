namespace Brantas.Domain.Entities;

public sealed class DatasetVersion
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string SourceSet { get; init; }
    public required string Period { get; init; }
    public required int Seed { get; init; }
    public required string Checksum { get; init; }
    public DateTimeOffset IngestedAt { get; init; } = DateTimeOffset.UtcNow;
    public int RecordCount { get; set; }
    public DatasetStatus Status { get; set; } = DatasetStatus.Pending;
}

public enum DatasetStatus { Pending, Processing, Completed, Failed }