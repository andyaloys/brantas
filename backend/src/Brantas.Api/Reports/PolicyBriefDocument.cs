using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Brantas.Api.Reports;

public sealed class PolicyBriefDocument(PolicyBriefModel model) : IDocument
{
    public DocumentMetadata GetMetadata() => DocumentMetadata.Default;

    public void Compose(IDocumentContainer container)
    {
        container.Page(page =>
        {
            page.Margin(42);
            page.Header().Column(column =>
            {
                column.Item().Text("KEMENTERIAN KEUANGAN REPUBLIK INDONESIA").FontSize(9).Bold().FontColor(Colors.Blue.Darken3);
                column.Item().Text("BRANTAS | Telaahan Kebijakan Anggaran Sosial").FontSize(17).Bold();
                column.Item().PaddingTop(4).Text("DATA SIMULASI - BUKAN DASAR KEPUTUSAN OPERASIONAL").FontSize(8).Bold().FontColor(Colors.Orange.Darken2);
            });
            page.Content().PaddingVertical(20).Column(column =>
            {
                column.Spacing(12);
                column.Item().Text("Ringkasan Eksekutif").FontSize(14).Bold();
                column.Item().Text($"Dataset periode {model.Period} mencakup {model.RegionCount:N0} provinsi. Rata-rata kemiskinan sebesar {model.AveragePovertyRate:0.00}% dengan {model.AnomalyCount:N0} temuan anomali fiskal senilai Rp{model.ValueAtRisk:N0} juta.");
                column.Item().Text("Dasar Bukti").FontSize(14).Bold();
                column.Item().Text($"Estimasi Difference-in-Differences two-way fixed effects menunjukkan perubahan tingkat kemiskinan sebesar {model.EffectPercentagePoints:0.0000} poin persentase (SE cluster-robust {model.StandardError:0.0000}; CI 95% {model.ConfidenceLower:0.0000} hingga {model.ConfidenceUpper:0.0000}; p={model.PValue:0.000000}).");
                column.Item().Text("Wilayah Prioritas").FontSize(14).Bold();
                column.Item().Table(table =>
                {
                    table.ColumnsDefinition(columns => { columns.RelativeColumn(3); columns.RelativeColumn(); columns.RelativeColumn(2); });
                    table.Header(header =>
                    {
                        header.Cell().Background(Colors.Blue.Darken3).Padding(5).Text("Wilayah").FontColor(Colors.White).Bold();
                        header.Cell().Background(Colors.Blue.Darken3).Padding(5).Text("Kemiskinan").FontColor(Colors.White).Bold();
                        header.Cell().Background(Colors.Blue.Darken3).Padding(5).Text("Penduduk miskin").FontColor(Colors.White).Bold();
                    });
                    foreach (var region in model.PriorityRegions)
                    {
                        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5).Text(region.Name);
                        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5).Text($"{region.PovertyRate:0.00}%");
                        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5).Text(region.PoorPopulation.ToString("N0"));
                    }
                });
                column.Item().Text("Rekomendasi").FontSize(14).Bold();
                column.Item().Text("Prioritaskan verifikasi anomali fiskal bernilai risiko tertinggi dan gunakan simulasi alokasi berbasis IKW sebagai bahan telaahan. Seluruh hasil harus diverifikasi terhadap sumber data resmi sebelum pelaksanaan kebijakan.");
                column.Item().PaddingTop(8).Text("Metadata Reproduksibilitas").FontSize(12).Bold();
                column.Item().Text($"Dataset version: {model.DatasetVersionId}\nChecksum: {model.Checksum}\nSeed: {model.Seed}\nDibuat: {model.GeneratedAt:O}\nPenyusun: BRANTAS (data sintetis)").FontSize(8).FontColor(Colors.Grey.Darken2);
            });
            page.Footer().AlignCenter().Text(text => { text.Span("BRANTAS | Data Simulasi | "); text.CurrentPageNumber(); });
        });
    }
}

public sealed record PolicyBriefModel(Guid DatasetVersionId, string Period, string Checksum, int Seed, DateTimeOffset GeneratedAt, int RegionCount, decimal AveragePovertyRate, int AnomalyCount, decimal ValueAtRisk, decimal EffectPercentagePoints, decimal StandardError, decimal ConfidenceLower, decimal ConfidenceUpper, decimal PValue, IReadOnlyCollection<PolicyBriefRegion> PriorityRegions);
public sealed record PolicyBriefRegion(string Name, decimal PovertyRate, int PoorPopulation);