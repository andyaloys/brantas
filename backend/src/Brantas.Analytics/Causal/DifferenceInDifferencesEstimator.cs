using MathNet.Numerics.Distributions;
using MathNet.Numerics.LinearAlgebra;

namespace Brantas.Analytics.Causal;

public sealed class DifferenceInDifferencesEstimator
{
    public DifferenceInDifferencesResult Estimate(IReadOnlyCollection<PolicyObservation> observations, int treatmentStartYear)
    {
        if (observations.Count == 0)
        {
            throw new ArgumentException("Panel observasi tidak boleh kosong.", nameof(observations));
        }

        var treated = observations.Where(item => item.IsTreated).ToArray();
        var control = observations.Where(item => !item.IsTreated).ToArray();
        if (treated.Length == 0 || control.Length == 0)
        {
            throw new ArgumentException("Panel harus memuat wilayah perlakuan dan pembanding.", nameof(observations));
        }

        var orderedObservations = observations.OrderBy(item => item.RegionId).ThenBy(item => item.Year).ToArray();
        var regionIds = orderedObservations.Select(item => item.RegionId).Distinct().ToArray();
        var years = orderedObservations.Select(item => item.Year).Distinct().Order().ToArray();
        var columnCount = 2 + regionIds.Length - 1 + years.Length - 1;
        var design = Matrix<double>.Build.Dense(orderedObservations.Length, columnCount);
        var outcome = Vector<double>.Build.Dense(orderedObservations.Length);
        for (var row = 0; row < orderedObservations.Length; row++)
        {
            var observation = orderedObservations[row];
            design[row, 0] = 1d;
            design[row, 1] = observation.IsTreated && observation.Year >= treatmentStartYear + 1 ? 1d : 0d;
            for (var regionIndex = 1; regionIndex < regionIds.Length; regionIndex++)
            {
                design[row, 1 + regionIndex] = observation.RegionId == regionIds[regionIndex] ? 1d : 0d;
            }
            for (var yearIndex = 1; yearIndex < years.Length; yearIndex++)
            {
                design[row, regionIds.Length + yearIndex] = observation.Year == years[yearIndex] ? 1d : 0d;
            }
            outcome[row] = (double)observation.PovertyRate;
        }

        var crossProduct = design.TransposeThisAndMultiply(design);
        var inverseCrossProduct = crossProduct.Inverse();
        var coefficients = inverseCrossProduct * design.TransposeThisAndMultiply(outcome);
        var residuals = outcome - design * coefficients;
        var clusterScores = regionIds.Select(regionId =>
            orderedObservations
                .Select((item, row) => new { item, row })
                .Where(item => item.item.RegionId == regionId)
                .Aggregate(Vector<double>.Build.Dense(columnCount), (sum, item) => sum + design.Row(item.row) * residuals[item.row]))
            .ToArray();
        var meat = clusterScores.Aggregate(Matrix<double>.Build.Dense(columnCount, columnCount), (sum, score) => sum + score.OuterProduct(score));
        var correction = (double)regionIds.Length / (regionIds.Length - 1) * (orderedObservations.Length - 1d) / (orderedObservations.Length - columnCount);
        var covariance = correction * inverseCrossProduct * meat * inverseCrossProduct;
        var standardError = Math.Sqrt(Math.Max(0d, covariance[1, 1]));
        var estimatedEffect = coefficients[1];
        var criticalValue = 1.959963984540054d;
        var pValue = standardError == 0d ? (estimatedEffect == 0d ? 1d : 0d) : 2d * (1d - Normal.CDF(0d, 1d, Math.Abs(estimatedEffect / standardError)));
        var preTreated = treated.Where(item => item.Year < treatmentStartYear + 1).Average(item => item.PovertyRate);
        var preControl = control.Where(item => item.Year < treatmentStartYear + 1).Average(item => item.PovertyRate);
        var postTreated = treated.Where(item => item.Year >= treatmentStartYear + 1).Average(item => item.PovertyRate);
        var postControl = control.Where(item => item.Year >= treatmentStartYear + 1).Average(item => item.PovertyRate);
        var effect = Math.Round((decimal)estimatedEffect, 4);
        var baselineGroup = observations.Where(item => item.Year == 2023).ToArray();
        var baselineTreated = Math.Round(baselineGroup.Where(item => item.IsTreated).Average(item => item.PovertyRate), 2);
        var baselineControl = Math.Round(baselineGroup.Where(item => !item.IsTreated).Average(item => item.PovertyRate), 2);
        var baselineDifference = baselineGroup.Where(item => item.IsTreated).Average(item => item.PovertyRate) - baselineGroup.Where(item => !item.IsTreated).Average(item => item.PovertyRate);

        var groups = observations.GroupBy(item => item.Year).OrderBy(group => group.Key).ToList();
        var annualEffects = new List<EventStudyPoint>();
        for (var i = 0; i < groups.Count; i++)
        {
            var group = groups[i];
            var treatedMean = group.Where(item => item.IsTreated).Average(item => item.PovertyRate);
            var controlMean = group.Where(item => !item.IsTreated).Average(item => item.PovertyRate);
            var priorYearTreated = i > 0
                ? Math.Round(groups[i - 1].Where(item => item.IsTreated).Average(item => item.PovertyRate), 2)
                : Math.Round(treatedMean, 2);

            annualEffects.Add(new EventStudyPoint(
                group.Key,
                Math.Round((treatedMean - controlMean) - baselineDifference, 4),
                Math.Round(treatedMean, 2),
                Math.Round(controlMean, 2),
                baselineTreated,
                baselineControl,
                priorYearTreated));
        }
        var costIncrease = treated.Where(item => item.Year >= treatmentStartYear).Sum(item => item.SocialProtectionAllocation) - treated.Where(item => item.Year < treatmentStartYear).Sum(item => item.SocialProtectionAllocation) * 3m / 4m;
        return new DifferenceInDifferencesResult(
            effect,
            Math.Round((decimal)standardError, 4),
            Math.Round((decimal)(estimatedEffect - criticalValue * standardError), 4),
            Math.Round((decimal)(estimatedEffect + criticalValue * standardError), 4),
            Math.Round((decimal)pValue, 6),
            Math.Round(-effect / (costIncrease / 1_000_000m), 6),
            annualEffects);
    }
}

public sealed record PolicyObservation(Guid RegionId, int Year, bool IsTreated, decimal SocialProtectionAllocation, decimal PovertyRate);
public sealed record EventStudyPoint(
    int Year,
    decimal EffectPercentagePoints,
    decimal TreatedPovertyRate,
    decimal ControlPovertyRate,
    decimal BaselineTreatedPovertyRate,
    decimal BaselineControlPovertyRate,
    decimal PriorYearTreatedPovertyRate);
public sealed record DifferenceInDifferencesResult(decimal EffectPercentagePoints, decimal StandardError, decimal ConfidenceIntervalLower, decimal ConfidenceIntervalUpper, decimal PValue, decimal EffectivenessPerTrillion, IReadOnlyCollection<EventStudyPoint> EventStudy);