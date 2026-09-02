namespace Brantas.Domain.Entities;

public sealed class Region
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string BpsCode { get; init; }
    public required string Name { get; init; }
    public RegionLevel Level { get; init; }
    public Guid? ParentId { get; init; }
    public Region? Parent { get; init; }
    public ICollection<Region> Children { get; init; } = new List<Region>();
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
}

public enum RegionLevel { National, Province, Regency }