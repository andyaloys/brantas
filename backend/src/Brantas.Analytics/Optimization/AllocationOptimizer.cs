using Google.OrTools.LinearSolver;

namespace Brantas.Analytics.Optimization;

public sealed class AllocationOptimizer
{
    public AllocationOptimizationResult Optimize(IReadOnlyCollection<AllocationObservation> observations, AllocationWeights weights, decimal totalBudget, decimal floor, decimal capPercent)
    {
        var normalizedWeights = weights.Normalize();
        var povertyRate = Normalize(observations.Select(item => item.PovertyRate));
        var depth = Normalize(observations.Select(item => item.PovertyDepthIndex));
        var severity = Normalize(observations.Select(item => item.PovertySeverityIndex));
        var humanDevelopmentGap = Normalize(observations.Select(item => 100m - item.HumanDevelopmentIndex));
        var inverseGdp = Normalize(observations.Select(item => -item.GdpPerCapita));
        var disasterRisk = Normalize(observations.Select(item => item.DisasterRisk));
        var scored = observations.Select((item, index) => item with
        {
            VulnerabilityIndex = Math.Round(
                normalizedWeights.PovertyRate * povertyRate[index] +
                normalizedWeights.PovertyDepth * depth[index] +
                normalizedWeights.PovertySeverity * severity[index] +
                normalizedWeights.HumanDevelopmentGap * humanDevelopmentGap[index] +
                normalizedWeights.InverseGdp * inverseGdp[index] +
                normalizedWeights.DisasterRisk * disasterRisk[index], 6)
        }).ToArray();
        var scoreTotal = scored.Sum(item => item.VulnerabilityIndex * item.PoorPopulation);
        var desired = scored.Select(item => totalBudget * item.VulnerabilityIndex * item.PoorPopulation / scoreTotal).ToArray();

        var solver = Solver.CreateSolver("GLOP_LINEAR_PROGRAMMING") ?? throw new InvalidOperationException("Solver OR-Tools tidak tersedia.");
        var allocations = new Variable[scored.Length];
        var deviations = new Variable[scored.Length];
        for (var index = 0; index < scored.Length; index++)
        {
            var baseline = (double)scored[index].BaselineAllocation;
            allocations[index] = solver.MakeNumVar(Math.Max((double)floor, baseline * (1d - (double)capPercent)), baseline * (1d + (double)capPercent), $"allocation_{index}");
            deviations[index] = solver.MakeNumVar(0, double.PositiveInfinity, $"deviation_{index}");
            solver.Add(allocations[index] - deviations[index] <= (double)desired[index]);
            solver.Add(-allocations[index] - deviations[index] <= -(double)desired[index]);
        }
        var budgetConstraint = solver.MakeConstraint((double)totalBudget, (double)totalBudget, "total_budget");
        var objective = solver.Objective();
        objective.SetMinimization();
        for (var index = 0; index < allocations.Length; index++)
        {
            budgetConstraint.SetCoefficient(allocations[index], 1d);
            objective.SetCoefficient(deviations[index], 1d);
        }
        if (solver.Solve() is not Solver.ResultStatus.OPTIMAL and not Solver.ResultStatus.FEASIBLE)
        {
            throw new InvalidOperationException("Kendala alokasi tidak memiliki solusi layak.");
        }

        var recommendations = scored.Select((item, index) => new AllocationRecommendation(
            item.RegionId,
            item.RegionName,
            item.BaselineAllocation,
            Math.Round((decimal)allocations[index].SolutionValue(), 2),
            item.VulnerabilityIndex,
            item.PoorPopulation)).ToArray();
        return new AllocationOptimizationResult(normalizedWeights, recommendations);
    }

    private static decimal[] Normalize(IEnumerable<decimal> values)
    {
        var list = values.ToArray();
        var minimum = list.Min();
        var range = list.Max() - minimum;
        return range == 0m ? list.Select(_ => 0m).ToArray() : list.Select(value => (value - minimum) / range).ToArray();
    }
}

public sealed record AllocationObservation(Guid RegionId, string RegionName, decimal PovertyRate, decimal PovertyDepthIndex, decimal PovertySeverityIndex, decimal HumanDevelopmentIndex, decimal GdpPerCapita, decimal DisasterRisk, int PoorPopulation, decimal BaselineAllocation, decimal VulnerabilityIndex = 0m);
public sealed record AllocationWeights(decimal PovertyRate, decimal PovertyDepth, decimal PovertySeverity, decimal HumanDevelopmentGap, decimal InverseGdp, decimal DisasterRisk)
{
    public AllocationWeights Normalize()
    {
        var total = PovertyRate + PovertyDepth + PovertySeverity + HumanDevelopmentGap + InverseGdp + DisasterRisk;
        return total == 0m ? new AllocationWeights(1m / 6m, 1m / 6m, 1m / 6m, 1m / 6m, 1m / 6m, 1m / 6m)
            : new AllocationWeights(PovertyRate / total, PovertyDepth / total, PovertySeverity / total, HumanDevelopmentGap / total, InverseGdp / total, DisasterRisk / total);
    }
}
public sealed record AllocationRecommendation(Guid RegionId, string RegionName, decimal BaselineAllocation, decimal RecommendedAllocation, decimal VulnerabilityIndex, int PoorPopulation)
{
    public decimal Delta => RecommendedAllocation - BaselineAllocation;
    public decimal DeltaPercent => BaselineAllocation == 0m ? 0m : Math.Round(100m * Delta / BaselineAllocation, 2);
}
public sealed record AllocationOptimizationResult(AllocationWeights Weights, IReadOnlyCollection<AllocationRecommendation> Recommendations);