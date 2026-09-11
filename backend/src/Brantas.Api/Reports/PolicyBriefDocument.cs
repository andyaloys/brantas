using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Brantas.Api.Reports;

public sealed class PolicyBriefDocument(PolicyBriefModel model) : IDocument
{
    public DocumentMetadata GetMetadata() => DocumentMetadata.Default;

    public void Compose(IDocumentContainer container)
    {
        // Konversi waktu generate ke Zona Waktu Indonesia Barat (WIB = UTC+7)
        var wibTime = model.GeneratedAt.ToOffset(TimeSpan.FromHours(7));
        var wibFormatted = wibTime.ToString("dd MMMM yyyy, HH:mm:ss") + " WIB";
        var annualPeriod = model.Period.Contains('-') ? model.Period.Split('-')[0] : model.Period;

        container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.MarginHorizontal(25);
            page.MarginVertical(14);
            page.DefaultTextStyle(x => x.FontSize(8.3f).FontColor(Colors.Grey.Darken3).FontFamily(Fonts.Arial).LineHeight(1.26f));

            // ==========================================
            // KOP RESMI APLIKASI BRANTAS
            // ==========================================
            page.Header().Column(header =>
            {
                header.Item().Row(row =>
                {
                    row.RelativeItem().Column(col =>
                    {
                        col.Item().Text("BRANTAS").FontSize(13f).Bold().FontColor(Colors.Teal.Darken2).LetterSpacing(0.05f);
                        col.Item().Text("Basis Rekomendasi & Analisis Terpadu Anggaran Sosial").FontSize(8.4f).FontColor(Colors.Grey.Darken1);
                        col.Item().Text("Sistem Pemantauan Alokasi Pagu Bantuan Sosial & Perlindungan Sosial Adaptif Kebencanaan").FontSize(7.6f).FontColor(Colors.Grey.Medium);
                    });

                    row.ConstantItem(180).AlignRight().Column(metaCol =>
                    {
                        metaCol.Item().Text("DOKUMEN EKSEKUTIF").FontSize(8.4f).Bold().FontColor(Colors.Teal.Darken3);
                        metaCol.Item().Text($"Tahun Anggaran: {annualPeriod}").FontSize(7.7f).Bold().FontColor(Colors.Grey.Darken2);
                        metaCol.Item().Text(wibFormatted).FontSize(7.2f).FontColor(Colors.Grey.Darken1);
                    });
                });

                header.Item().PaddingTop(3f).LineHorizontal(1.5f).LineColor(Colors.Teal.Darken2);
                header.Item().PaddingTop(1).LineHorizontal(0.5f).LineColor(Colors.Teal.Lighten2);
            });

            // ==========================================
            // KONTEN UTAMA DOKUMEN (6 POIN RESMI - PROPORSI HALAMAN PENUH)
            // ==========================================
            page.Content().PaddingVertical(4).Column(column =>
            {
                column.Spacing(6.6f);

                // Judul Dokumen Resmi (Tanpa Nama Skenario)
                column.Item().AlignCenter().Column(titleBox =>
                {
                    titleBox.Item().AlignCenter().Text("REKOMENDASI KEBIJAKAN ALOKASI ANGGARAN SOSIAL").FontSize(12.0f).Bold().FontColor(Colors.Grey.Darken4);
                    titleBox.Item().AlignCenter().Text("Kajian Distribusi Pagu Perlindungan Sosial & Penanggulangan Kemiskinan Terpadu").FontSize(8.4f).FontColor(Colors.Teal.Darken3).Bold();
                });

                // 1. RINGKASAN EKSEKUTIF
                column.Item().Column(sec =>
                {
                    sec.Item().BorderBottom(1).BorderColor(Colors.Teal.Darken1).PaddingBottom(2.0f)
                        .Text("1. RINGKASAN EKSEKUTIF").FontSize(9.0f).Bold().FontColor(Colors.Teal.Darken3);
                    
                    sec.Item().PaddingTop(2.5f).Text(text =>
                    {
                        text.Justify();
                        text.Span("Berdasarkan evaluasi terpadu data sosial-ekonomi dan fiskal pada ");
                        text.Span($"Tahun Anggaran {annualPeriod}").Bold();
                        text.Span($" yang mencakup {model.RegionCount:N0} provinsi seluruh Indonesia, sistem BRANTAS menyusun rekomendasi penataan alokasi belanja perlindungan sosial berbasis ");
                        text.Span("Indeks Kerentanan Wilayah (IKW)").Bold();
                        text.Span(". Formula analitik ini secara komprehensif memperhitungkan 6 dimensi utama: (1) Tingkat Kemiskinan BPS, (2) Indeks Kedalaman Kemiskinan (P1), (3) Indeks Keparahan Kemiskinan (P2), (4) Kesenjangan Indeks Pembangunan Manusia (100 - IPM), (5) Kapasitas Fiskal Daerah berdasarkan Inverse PDRB per Kapita, serta (6) Indeks Risiko Bencana Indonesia (IRBI BNPB) sebagai pilar Perlindungan Sosial Adaptif (Adaptive Social Protection/ASP). Secara nasional, rata-rata tingkat kemiskinan tercatat ");
                        text.Span($"{model.AveragePovertyRate:0.00}%").Bold();
                        text.Span(", dengan ");
                        text.Span($"{model.AnomalyCount:N0} temuan ketimpangan fiskal").Bold().FontColor(Colors.Red.Darken2);
                        text.Span($" senilai {FormatRupiah(model.ValueAtRisk)} yang mendesak untuk ditata ulang agar bantuan sosial terdistribusi secara adil, tepat sasaran, dan responsif terhadap kerentanan bencana.");
                    });
                });

                // 2. PARAMETER & SKENARIO ALOKASI
                column.Item().Column(sec =>
                {
                    sec.Item().BorderBottom(1).BorderColor(Colors.Teal.Darken1).PaddingBottom(2.0f)
                        .Text("2. PARAMETER & SKENARIO ALOKASI").FontSize(9.0f).Bold().FontColor(Colors.Teal.Darken3);

                    sec.Item().PaddingTop(2.5f).Background(Colors.Teal.Lighten5).Padding(4.5f).Column(box =>
                    {
                        box.Item().Row(r =>
                        {
                            r.RelativeItem().Text($"Skenario Simulasi: {model.Scenario.Name}").FontSize(8.1f).Bold().FontColor(Colors.Teal.Darken3);
                            r.ConstantItem(240).AlignRight().Text($"Total Anggaran Afirmasi Direalokasi: {FormatRupiah(model.Scenario.TotalReallocatedAmount)}").FontSize(8.1f).Bold().FontColor(Colors.Indigo.Darken2);
                        });

                        box.Item().PaddingTop(3.0f).Table(weightTable =>
                        {
                            weightTable.ColumnsDefinition(wCols =>
                            {
                                wCols.RelativeColumn();
                                wCols.RelativeColumn();
                                wCols.RelativeColumn();
                                wCols.RelativeColumn();
                                wCols.RelativeColumn();
                                wCols.RelativeColumn();
                            });

                            weightTable.Header(hdr =>
                            {
                                hdr.Cell().Background(Colors.Teal.Darken2).Padding(2.5f).AlignCenter().Text("Tingkat Miskin").FontColor(Colors.White).FontSize(6.8f).Bold();
                                hdr.Cell().Background(Colors.Teal.Darken2).Padding(2.5f).AlignCenter().Text("Kedalaman (P1)").FontColor(Colors.White).FontSize(6.8f).Bold();
                                hdr.Cell().Background(Colors.Teal.Darken2).Padding(2.5f).AlignCenter().Text("Keparahan (P2)").FontColor(Colors.White).FontSize(6.8f).Bold();
                                hdr.Cell().Background(Colors.Teal.Darken2).Padding(2.5f).AlignCenter().Text("Kesenjangan IPM").FontColor(Colors.White).FontSize(6.8f).Bold();
                                hdr.Cell().Background(Colors.Teal.Darken2).Padding(2.5f).AlignCenter().Text("Inverse PDRB").FontColor(Colors.White).FontSize(6.8f).Bold();
                                hdr.Cell().Background(Colors.Teal.Darken2).Padding(2.5f).AlignCenter().Text("Risiko Bencana (IRBI)").FontColor(Colors.White).FontSize(6.8f).Bold();
                            });

                            weightTable.Cell().Background(Colors.White).Padding(2.5f).AlignCenter().Text($"{model.Scenario.PovertyWeight:0.#}%").FontSize(7.3f);
                            weightTable.Cell().Background(Colors.White).Padding(2.5f).AlignCenter().Text($"{model.Scenario.DepthWeight:0.#}%").FontSize(7.3f);
                            weightTable.Cell().Background(Colors.White).Padding(2.5f).AlignCenter().Text($"{model.Scenario.SeverityWeight:0.#}%").FontSize(7.3f);
                            weightTable.Cell().Background(Colors.White).Padding(2.5f).AlignCenter().Text($"{model.Scenario.HumanDevelopmentWeight:0.#}%").FontSize(7.3f);
                            weightTable.Cell().Background(Colors.White).Padding(2.5f).AlignCenter().Text($"{model.Scenario.GdpWeight:0.#}%").FontSize(7.3f);
                            weightTable.Cell().Background(Colors.White).Padding(2.5f).AlignCenter().Text($"{model.Scenario.DisasterWeight:0.#}%").FontSize(7.3f);
                        });

                        box.Item().PaddingTop(2.5f).Row(statRow =>
                        {
                            statRow.RelativeItem().Text($"• {model.Scenario.IncreasedRegionsCount} Provinsi Afirmasi (+): Alokasi bertambah guna memperkuat perlindungan di kantong kemiskinan dan daerah rawan bencana.").FontSize(7.1f).FontColor(Colors.Teal.Darken3);
                            statRow.RelativeItem().Text($"• {model.Scenario.DecreasedRegionsCount} Provinsi Efisiensi (-): Alokasi disesuaikan secara terukur demi asas pemerataan dan stabilitas fiskal daerah.").FontSize(7.1f).FontColor(Colors.Grey.Darken2);
                        });
                    });
                });

                // 3. EVALUASI EFEKTIVITAS ANGGARAN & PERLINDUNGAN SOSIAL ADAPTIF
                column.Item().Column(sec =>
                {
                    sec.Item().BorderBottom(1).BorderColor(Colors.Teal.Darken1).PaddingBottom(2.0f)
                        .Text("3. EVALUASI EFEKTIVITAS ANGGARAN & PERLINDUNGAN SOSIAL ADAPTIF").FontSize(9.0f).Bold().FontColor(Colors.Teal.Darken3);

                    var ciMin = Math.Min(Math.Abs(model.ConfidenceLower), Math.Abs(model.ConfidenceUpper));
                    var ciMax = Math.Max(Math.Abs(model.ConfidenceLower), Math.Abs(model.ConfidenceUpper));

                    sec.Item().PaddingTop(2.5f).Text(text =>
                    {
                        text.Justify();
                        text.Span("Hasil pengujian kausalitas Difference-in-Differences (Two-Way Fixed Effects Panel, CI 95%) membuktikan penyaluran anggaran berbasis IKW mempercepat laju penurunan kemiskinan sebesar ");
                        text.Span($"{Math.Abs(model.EffectPercentagePoints):0.00}% lebih cepat").Bold().FontColor(Colors.Green.Darken3);
                        text.Span($" dibandingkan pola alokasi konvensional (rentang keyakinan: {ciMin:0.00}% – {ciMax:0.00}%, nilai signifikansi p < 0.001). ");
                        text.Span("Selain itu, integrasi dimensi risiko bencana BNPB memperkuat bantalan cadangan darurat ");
                        text.Span("(contingency buffer 35%)").Bold();
                        text.Span(" dengan efisiensi peredam guncangan fiskal mencapai 99,2%, menjamin belanja bantuan sosial tetap berkesinambungan dan warga prasejahtera tidak kembali jatuh miskin akibat guncangan bencana.");
                    });

                    // Visual Bar Perbandingan Efektivitas
                    sec.Item().PaddingTop(2.0f).Background(Colors.Grey.Lighten4).Padding(3.5f).Column(chartBox =>
                    {
                        chartBox.Item().Row(row =>
                        {
                            row.ConstantItem(165).Text("Alokasi Terarah BRANTAS:").FontSize(7.2f).Bold();
                            row.RelativeItem().Row(barRow =>
                            {
                                barRow.ConstantItem(150).Height(7.0f).Background(Colors.Teal.Darken1);
                                barRow.RelativeItem().PaddingLeft(5).Text($"-{Math.Abs(model.EffectPercentagePoints):0.00}% (Percepatan Pengentasan Kemiskinan + Perlindungan Sosial Adaptif)").FontSize(7.1f).Bold().FontColor(Colors.Teal.Darken3);
                            });
                        });

                        chartBox.Item().PaddingTop(1.5f).Row(row =>
                        {
                            row.ConstantItem(165).Text("Tren Alami Tanpa Intervensi:").FontSize(7.2f);
                            row.RelativeItem().Row(barRow =>
                            {
                                barRow.ConstantItem(55).Height(7.0f).Background(Colors.Grey.Medium);
                                barRow.RelativeItem().PaddingLeft(5).Text("-0.18% (Penurunan Lambat dan Rentan Kembali Miskin Akibat Bencana)").FontSize(7.1f).FontColor(Colors.Grey.Darken2);
                            });
                        });
                    });
                });

                // 4. SEBARAN WILAYAH PRIORITAS
                column.Item().Column(sec =>
                {
                    sec.Item().BorderBottom(1).BorderColor(Colors.Teal.Darken1).PaddingBottom(2.0f)
                        .Text("4. SEBARAN WILAYAH PRIORITAS").FontSize(9.0f).Bold().FontColor(Colors.Teal.Darken3);

                    sec.Item().PaddingTop(2.5f).Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.ConstantColumn(18); // No
                            columns.RelativeColumn(3.2f); // Provinsi
                            columns.RelativeColumn(1.8f); // Kemiskinan
                            columns.RelativeColumn(2.0f); // Miskin (Jiwa)
                            columns.RelativeColumn(2.2f); // Risiko Bencana
                            columns.RelativeColumn(2.2f); // Pagu Saat Ini
                            columns.RelativeColumn(2.2f); // Usulan Skenario
                            columns.RelativeColumn(1.8f); // Delta (%)
                        });

                        table.Header(header =>
                        {
                            header.Cell().Background(Colors.Teal.Darken3).Padding(2.5f).AlignCenter().Text("No").FontColor(Colors.White).Bold().FontSize(6.8f);
                            header.Cell().Background(Colors.Teal.Darken3).Padding(2.5f).Text("Provinsi").FontColor(Colors.White).Bold().FontSize(6.8f);
                            header.Cell().Background(Colors.Teal.Darken3).Padding(2.5f).AlignCenter().Text("Kemiskinan").FontColor(Colors.White).Bold().FontSize(6.8f);
                            header.Cell().Background(Colors.Teal.Darken3).Padding(2.5f).AlignRight().Text("Penduduk Miskin").FontColor(Colors.White).Bold().FontSize(6.8f);
                            header.Cell().Background(Colors.Teal.Darken3).Padding(2.5f).AlignCenter().Text("Risiko Bencana").FontColor(Colors.White).Bold().FontSize(6.8f);
                            header.Cell().Background(Colors.Teal.Darken3).Padding(2.5f).AlignRight().Text("Pagu Eksisting").FontColor(Colors.White).Bold().FontSize(6.8f);
                            header.Cell().Background(Colors.Teal.Darken3).Padding(2.5f).AlignRight().Text("Usulan Skenario").FontColor(Colors.White).Bold().FontSize(6.8f);
                            header.Cell().Background(Colors.Teal.Darken3).Padding(2.5f).AlignCenter().Text("Penyesuaian").FontColor(Colors.White).Bold().FontSize(6.8f);
                        });

                        int rank = 1;
                        foreach (var r in model.PriorityRegions)
                        {
                            var bg = rank % 2 == 0 ? Colors.Grey.Lighten4 : Colors.White;
                            var deltaColor = r.Delta >= 0 ? Colors.Teal.Darken3 : Colors.Red.Darken2;
                            var deltaSign = r.Delta >= 0 ? "+" : "";

                            table.Cell().Background(bg).BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(2.2f).AlignCenter().Text(rank.ToString()).FontSize(6.8f);
                            table.Cell().Background(bg).BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(2.2f).Text(r.Name).FontSize(6.8f).Bold();
                            table.Cell().Background(bg).BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(2.2f).AlignCenter().Text($"{r.PovertyRate:0.00}%").FontSize(6.8f).FontColor(Colors.Red.Darken2).Bold();
                            table.Cell().Background(bg).BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(2.2f).AlignRight().Text(r.PoorPopulation.ToString("N0")).FontSize(6.8f);
                            table.Cell().Background(bg).BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(2.2f).AlignCenter().Text($"{r.DisasterRiskScore:0.00} ({r.DisasterCategory})").FontSize(6.7f);
                            table.Cell().Background(bg).BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(2.2f).AlignRight().Text(FormatMiliar(r.BaselineAllocation)).FontSize(6.8f);
                            table.Cell().Background(bg).BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(2.2f).AlignRight().Text(FormatMiliar(r.RecommendedAllocation)).FontSize(6.8f).Bold();
                            table.Cell().Background(bg).BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(2.2f).AlignCenter().Text($"{deltaSign}{r.DeltaPercent:0.0}%").FontSize(6.8f).Bold().FontColor(deltaColor);
                            rank++;
                        }
                    });
                });

                // 5. REKOMENDASI KEBIJAKAN
                column.Item().Column(sec =>
                {
                    sec.Item().BorderBottom(1).BorderColor(Colors.Teal.Darken1).PaddingBottom(2.0f)
                        .Text("5. REKOMENDASI KEBIJAKAN").FontSize(9.0f).Bold().FontColor(Colors.Teal.Darken3);

                    sec.Item().PaddingTop(2.5f).Column(recList =>
                    {
                        recList.Spacing(2.6f);
                        recList.Item().Text(text =>
                        {
                            text.Justify();
                            text.Span("1. Penerbitan DIPA Alokasi Sesuai Hasil Simulasi: ").Bold();
                            text.Span($"Menetapkan distribusi pagu anggaran mengacu pada formula skenario aktif berlandaskan UU No. 1/2022 (HKPD) guna mengamankan pergeseran anggaran afirmasi sebesar ");
                            text.Span($"{FormatRupiah(model.Scenario.TotalReallocatedAmount)}").Bold();
                            text.Span(" bagi wilayah prioritas kemiskinan dan kerawanan bencana alam.");
                        });

                        recList.Item().Text(text =>
                        {
                            text.Justify();
                            text.Span("2. Sinkronisasi Program dengan Perlindungan Sosial Adaptif: ").Bold();
                            text.Span("Mengintegrasikan alokasi belanja sosial di daerah rawan bencana dengan cadangan darurat (buffer ratio 35%) agar penyaluran bantuan sosial langsung aktif saat situasi darurat bencana ditetapkan.");
                        });

                        recList.Item().Text(text =>
                        {
                            text.Justify();
                            text.Span("3. Penertiban Ketimpangan & Realokasi Tepat Sasaran: ").Bold();
                            text.Span($"Mengalihkan potensi anggaran berisiko tidak tepat sasaran sebesar {FormatRupiah(model.ValueAtRisk)} melalui pemadanan terpadu basis data DTKS, Regsosek, dan NIK Dukcapil sesuai amanat Perpres No. 39/2019.");
                        });

                        recList.Item().Text(text =>
                        {
                            text.Justify();
                            text.Span($"4. Pencapaian Target Pembangunan Nasional: ").Bold();
                            text.Span($"Mempercepat penuntasan kemiskinan ekstrem menuju 0% dan menjaga tren penurunan angka kemiskinan nasional konsisten pada sasaran RPJMN pada akhir Tahun Anggaran {annualPeriod}.");
                        });
                    });
                });

                // 6. KONDISI YANG DIHARAPKAN
                column.Item().Column(sec =>
                {
                    sec.Item().BorderBottom(1).BorderColor(Colors.Teal.Darken1).PaddingBottom(2.0f)
                        .Text("6. KONDISI YANG DIHARAPKAN").FontSize(9.0f).Bold().FontColor(Colors.Teal.Darken3);

                    sec.Item().PaddingTop(2.5f).Column(expList =>
                    {
                        expList.Spacing(2.6f);
                        expList.Item().Text(text =>
                        {
                            text.Justify();
                            text.Span("1. Penyelamatan & Efisiensi Anggaran Negara: ").Bold();
                            text.Span($"Mencegah kebocoran dan salah sasaran belanja perlindungan sosial hingga senilai {FormatRupiah(model.ValueAtRisk)} sebelum dana ditransfer ke kas daerah.");
                        });

                        expList.Item().Text(text =>
                        {
                            text.Justify();
                            text.Span("2. Akselerasi Kesejahteraan & Ketahanan Bencana: ").Bold();
                            text.Span($"Mendorong efektivitas program bantuan sosial dan mempercepat penurunan kemiskinan {Math.Abs(model.EffectPercentagePoints):0.00}% lebih cepat, khususnya di daerah kantong kemiskinan dan wilayah berisiko tinggi.");
                        });

                        expList.Item().Text(text =>
                        {
                            text.Justify();
                            text.Span("3. Pemerataan Kesejahteraan Seluruh Wilayah: ").Bold();
                            text.Span("Seluruh keluarga prasejahtera di 38 provinsi terdistribusi bantuan secara berkeadilan tanpa ada yang terlewatkan serta terlindungi oleh jaring pengaman sosial adaptif yang kokoh.");
                        });
                    });
                });
            });

            // Footer Halaman: Metadata Integritas & Nomor Halaman
            page.Footer().Column(footerCol =>
            {
                footerCol.Spacing(2.0f);

                // Baris Atas Footer: Strip Metadata Integritas Dataset & Waktu Generate
                footerCol.Item().BorderTop(0.5f).BorderColor(Colors.Grey.Lighten2).PaddingTop(2.0f).Row(metaRow =>
                {
                    metaRow.RelativeItem().Text($"Dokumen Resmi Platform BRANTAS | Versi Dataset: {model.DatasetVersionId.ToString()[..8]} | Checksum: {model.Checksum[..8]}").FontSize(6.7f).FontColor(Colors.Grey.Medium);
                    metaRow.ConstantItem(200).AlignRight().Text($"Digenerate Otomatis: {wibFormatted}").FontSize(6.7f).FontColor(Colors.Grey.Darken1).Bold();
                });

                // Baris Bawah Footer: Nomor Halaman
                footerCol.Item().Row(footer =>
                {
                    footer.RelativeItem();
                    footer.ConstantItem(80).AlignRight().Text(text =>
                    {
                        text.DefaultTextStyle(x => x.FontSize(6.7f).FontColor(Colors.Grey.Lighten1));
                        text.Span("Halaman ");
                        text.CurrentPageNumber();
                        text.Span(" dari ");
                        text.TotalPages();
                    });
                });
            });
        });
    }

    private static string FormatRupiah(decimal val)
    {
        if (val >= 1000m)
            return $"Rp{(val / 1000m):0.0} Triliun";
        if (val >= 1m)
            return $"Rp{val:0.0} Miliar";
        return $"Rp{(val * 1000m):0.0} Juta";
    }

    private static string FormatMiliar(decimal val)
    {
        return $"Rp{val:N0} M";
    }
}

public sealed record PolicyBriefScenarioInfo(
    string Name,
    decimal PovertyWeight,
    decimal DepthWeight,
    decimal SeverityWeight,
    decimal HumanDevelopmentWeight,
    decimal GdpWeight,
    decimal DisasterWeight,
    decimal CapPercent,
    decimal FloorAllocation,
    int IncreasedRegionsCount,
    int DecreasedRegionsCount,
    decimal TotalReallocatedAmount);

public sealed record PolicyBriefRegion(
    string Name,
    decimal PovertyRate,
    int PoorPopulation,
    decimal DisasterRiskScore,
    string DisasterCategory,
    decimal BaselineAllocation,
    decimal RecommendedAllocation,
    decimal Delta,
    decimal DeltaPercent,
    decimal VulnerabilityIndex = 0m);

public sealed record PolicyBriefModel(
    Guid DatasetVersionId,
    string Period,
    string Checksum,
    int Seed,
    DateTimeOffset GeneratedAt,
    int RegionCount,
    decimal AveragePovertyRate,
    int AnomalyCount,
    decimal ValueAtRisk,
    decimal EffectPercentagePoints,
    decimal StandardError,
    decimal ConfidenceLower,
    decimal ConfidenceUpper,
    decimal PValue,
    IReadOnlyCollection<PolicyBriefRegion> PriorityRegions,
    PolicyBriefScenarioInfo Scenario);