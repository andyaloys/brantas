namespace Brantas.Analytics.Spatial;

public sealed class MoranCalculator
{
    private const decimal NeighborTolerance = 0.33m;

    public MoranAnalysisResult Analyze(IReadOnlyCollection<SpatialObservation> observations)
    {
        if (observations.Count < 2)
        {
            return new MoranAnalysisResult(0m, []);
        }

        var mean = observations.Average(item => item.Value);
        var denominator = observations.Sum(item => Square(item.Value - mean));
        var numerator = 0m;
        var weightSum = 0m;
        var classifications = new List<LocalMoranResult>(observations.Count);

        foreach (var subject in observations)
        {
            var neighbors = observations.Where(candidate => IsNeighbor(subject, candidate)).ToArray();
            var spatialLag = neighbors.Length == 0 ? 0m : neighbors.Average(item => item.Value) - mean;
            var subjectDeviation = subject.Value - mean;
            numerator += subjectDeviation * neighbors.Sum(item => item.Value - mean);
            weightSum += neighbors.Length;
            classifications.Add(new LocalMoranResult(subject.Id, Classify(subjectDeviation, spatialLag), Math.Round(subjectDeviation * spatialLag, 4)));
        }

        var globalI = denominator == 0m || weightSum == 0m
            ? 0m
            : Math.Round(observations.Count / weightSum * numerator / denominator, 4);
        return new MoranAnalysisResult(globalI, classifications);
    }

    private static bool IsNeighbor(SpatialObservation subject, SpatialObservation candidate) =>
        subject.Id != candidate.Id &&
        subject.ParentId == candidate.ParentId &&
        Math.Abs(subject.Latitude - candidate.Latitude) <= NeighborTolerance &&
        Math.Abs(subject.Longitude - candidate.Longitude) <= NeighborTolerance;

    private static string Classify(decimal deviation, decimal spatialLag) =>
        deviation >= 0m && spatialLag >= 0m ? "High-High"
        : deviation < 0m && spatialLag < 0m ? "Low-Low"
        : deviation >= 0m ? "High-Low"
        : "Low-High";

    private static decimal Square(decimal value) => value * value;
}

public sealed record SpatialObservation(Guid Id, Guid ParentId, decimal Latitude, decimal Longitude, decimal Value);
public sealed record LocalMoranResult(Guid RegionId, string Cluster, decimal LocalScore);
public sealed record MoranAnalysisResult(decimal GlobalI, IReadOnlyCollection<LocalMoranResult> LocalResults);