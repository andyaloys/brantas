namespace Brantas.Domain.Entities;

/// <summary>
/// Repositori Indeks Risiko Bencana Indonesia (IRBI BNPB) terstandardisasi per kode provinsi BPS (skor 0.0 - 1.0).
/// </summary>
public static class DisasterRiskRepository
{
    public static (decimal Score, string Category) GetDisasterRisk(string? bpsCode)
    {
        var code = (bpsCode ?? "").Length >= 2 ? (bpsCode ?? "")[..2] : "";
        return ProvinceIndex.TryGetValue(code, out var value) ? value : (0.50m, "Sedang");
    }

    public static readonly Dictionary<string, (decimal Score, string Category)> ProvinceIndex = new()
    {
        ["11"] = (0.78m, "Tinggi"),        // Aceh (Tsunami, Gempa, Banjir Bandang)
        ["12"] = (0.58m, "Sedang"),        // Sumatera Utara
        ["13"] = (0.82m, "Sangat Tinggi"), // Sumatera Barat (Megathrust, Gempa, Galodo)
        ["14"] = (0.46m, "Sedang"),        // Riau (Karhutla)
        ["15"] = (0.44m, "Sedang"),        // Jambi (Karhutla, Banjir)
        ["16"] = (0.48m, "Sedang"),        // Sumatera Selatan
        ["17"] = (0.74m, "Tinggi"),        // Bengkulu (Gempa Sesar Pesisir)
        ["18"] = (0.64m, "Tinggi"),        // Lampung (Krakatau, Tsunami)
        ["19"] = (0.24m, "Rendah"),        // Kep. Bangka Belitung
        ["21"] = (0.32m, "Rendah"),        // Kepulauan Riau
        ["31"] = (0.36m, "Sedang"),        // DKI Jakarta (Banjir Rob)
        ["32"] = (0.71m, "Tinggi"),        // Jawa Barat (Longsor, Gempa Sesar Darat)
        ["33"] = (0.68m, "Tinggi"),        // Jawa Tengah (Merapi, Longsor, Rob)
        ["34"] = (0.73m, "Tinggi"),        // DI Yogyakarta (Merapi, Megathrust Selatan)
        ["35"] = (0.72m, "Tinggi"),        // Jawa Timur (Semeru, Kelud, Gempa Selatan)
        ["36"] = (0.65m, "Tinggi"),        // Banten (Selat Sunda, Tsunami)
        ["51"] = (0.58m, "Sedang"),        // Bali (Gunung Agung, Gempa)
        ["52"] = (0.79m, "Tinggi"),        // NTB (Gempa Lombok, Tambora, Kekeringan)
        ["53"] = (0.86m, "Sangat Tinggi"), // NTT (Siklon Seroja, Kekeringan Ekstrem, Flores Fault)
        ["61"] = (0.28m, "Rendah"),        // Kalimantan Barat
        ["62"] = (0.35m, "Sedang"),        // Kalimantan Tengah (Karhutla, Banjir)
        ["63"] = (0.42m, "Sedang"),        // Kalimantan Selatan (Banjir)
        ["64"] = (0.30m, "Rendah"),        // Kalimantan Timur
        ["65"] = (0.34m, "Rendah"),        // Kalimantan Utara
        ["71"] = (0.66m, "Tinggi"),        // Sulawesi Utara (Gunung Ruang, Lokon)
        ["72"] = (0.85m, "Sangat Tinggi"), // Sulawesi Tengah (Sesar Palu-Koro, Likuefaksi, Tsunami)
        ["73"] = (0.59m, "Sedang"),        // Sulawesi Selatan
        ["74"] = (0.54m, "Sedang"),        // Sulawesi Tenggara
        ["75"] = (0.62m, "Tinggi"),        // Gorontalo (Gempa, Banjir)
        ["76"] = (0.75m, "Tinggi"),        // Sulawesi Barat (Gempa Mamuju)
        ["81"] = (0.80m, "Sangat Tinggi"), // Maluku (Palung Banda, Megathrust Laut, Gempa)
        ["82"] = (0.70m, "Tinggi"),        // Maluku Utara (Dukono, Gamalama, Tsunami)
        ["91"] = (0.69m, "Tinggi"),        // Papua Barat
        ["92"] = (0.72m, "Tinggi"),        // Papua
        ["93"] = (0.52m, "Sedang"),        // Papua Selatan
        ["94"] = (0.78m, "Tinggi"),        // Papua Tengah
        ["95"] = (0.79m, "Tinggi"),        // Papua Pegunungan (Longsor, Cuaca Ekstrem)
        ["96"] = (0.64m, "Tinggi")         // Papua Barat Daya
    };
}
