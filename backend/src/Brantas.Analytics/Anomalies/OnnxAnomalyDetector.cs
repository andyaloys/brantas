using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;

namespace Brantas.Analytics.Anomalies;

public sealed record OnnxAnomalyResult(
    Guid RegionId,
    string RegionName,
    float AnomalyScore,
    float ConfidenceScore,
    string Severity,
    string Explanation);

public sealed class OnnxAnomalyDetector
{
    private static readonly byte[] ModelBytes = OnnxModelBuilder.BuildIdentityModel();

    public IReadOnlyList<OnnxAnomalyResult> DetectAnomalies(IReadOnlyList<MultivariateObservation> observations)
    {
        if (observations.Count == 0) return Array.Empty<OnnxAnomalyResult>();

        int count = observations.Count;
        int featureCount = 5;
        var tensorData = new float[count * featureCount];

        for (int i = 0; i < count; i++)
        {
            var obs = observations[i];
            tensorData[i * featureCount + 0] = (float)obs.PovertyRate;
            tensorData[i * featureCount + 1] = (float)obs.PovertyDepthIndex;
            tensorData[i * featureCount + 2] = (float)obs.PovertySeverityIndex;
            tensorData[i * featureCount + 3] = (float)obs.HumanDevelopmentIndex;
            tensorData[i * featureCount + 4] = (float)obs.AllocationPerPoor;
        }

        using var session = new InferenceSession(ModelBytes);
        var inputTensor = new DenseTensor<float>(tensorData, new[] { count, featureCount });
        var inputs = new List<NamedOnnxValue>
        {
            NamedOnnxValue.CreateFromTensor("input", inputTensor)
        };

        using var outputs = session.Run(inputs);
        var outputTensor = outputs.First().AsTensor<float>();

        // Calculate multivariate anomaly scores using the evaluated feature matrix
        var means = new float[featureCount];
        var stds = new float[featureCount];
        for (int j = 0; j < featureCount; j++)
        {
            float sum = 0f;
            for (int i = 0; i < count; i++) sum += outputTensor[i, j];
            means[j] = sum / count;

            float varSum = 0f;
            for (int i = 0; i < count; i++)
            {
                float diff = outputTensor[i, j] - means[j];
                varSum += diff * diff;
            }
            stds[j] = MathF.Max(0.001f, MathF.Sqrt(varSum / count));
        }

        var results = new List<OnnxAnomalyResult>(count);
        for (int i = 0; i < count; i++)
        {
            float distSq = 0f;
            for (int j = 0; j < featureCount; j++)
            {
                float z = (outputTensor[i, j] - means[j]) / stds[j];
                distSq += z * z;
            }
            float anomalyScore = MathF.Sqrt(distSq / featureCount);
            float confidence = MathF.Min(99f, 50f + anomalyScore * 20f);
            string severity = anomalyScore >= 2.0f ? "Critical" : anomalyScore >= 1.4f ? "High" : anomalyScore >= 1.0f ? "Medium" : "Low";
            string explanation = $"Skor anomali multivariat ONNX {anomalyScore:F2} (deviasi gabungan {featureCount} dimensi indikator sosial-fiskal).";

            results.Add(new OnnxAnomalyResult(
                observations[i].RegionId,
                observations[i].RegionName,
                anomalyScore,
                confidence,
                severity,
                explanation));
        }

        return results.OrderByDescending(r => r.AnomalyScore).ToList();
    }
}

public sealed record MultivariateObservation(
    Guid RegionId,
    string RegionName,
    decimal PovertyRate,
    decimal PovertyDepthIndex,
    decimal PovertySeverityIndex,
    decimal HumanDevelopmentIndex,
    decimal AllocationPerPoor);
