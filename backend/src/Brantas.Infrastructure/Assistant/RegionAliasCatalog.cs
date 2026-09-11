using System.Text.RegularExpressions;
using Brantas.Domain.Entities;

namespace Brantas.Infrastructure.Assistant;

public static class RegionAliasCatalog
{
    private static readonly Dictionary<string, string> Aliases = new(StringComparer.OrdinalIgnoreCase)
    {
        // Papua & Maluku
        ["timika"] = "mimika",
        ["mimika"] = "mimika",
        ["wamena"] = "jayawijaya",
        ["jayawijaya"] = "jayawijaya",
        ["sentani"] = "jayapura",
        ["serui"] = "kepulauan yapen",
        ["biak"] = "biak numfor",
        ["nabire"] = "nabire",
        ["merauke"] = "merauke",
        ["raja ampat"] = "raja ampat",
        ["waisai"] = "raja ampat",
        ["fef"] = "tambrauw",
        ["tambrauw"] = "tambrauw",
        ["kumurkek"] = "maybrat",
        ["maybrat"] = "maybrat",
        ["bintuni"] = "teluk bintuni",
        ["teluk bintuni"] = "teluk bintuni",
        ["wondama"] = "teluk wondama",
        ["teluk wondama"] = "teluk wondama",
        ["fakfak"] = "fakfak",
        ["kaimana"] = "kaimana",
        ["teminabuan"] = "sorong selatan",
        ["aimas"] = "sorong",
        ["kepi"] = "mappi",
        ["mappi"] = "mappi",
        ["agats"] = "asmat",
        ["asmat"] = "asmat",
        ["tanah merah"] = "boven digoel",
        ["boven digoel"] = "boven digoel",
        ["enarotali"] = "paniai",
        ["paniai"] = "paniai",
        ["sugapa"] = "intan jaya",
        ["intan jaya"] = "intan jaya",
        ["mulia"] = "puncak jaya",
        ["puncak jaya"] = "puncak jaya",
        ["ilaga"] = "puncak",
        ["tiom"] = "lanny jaya",
        ["lanny jaya"] = "lanny jaya",
        ["elelim"] = "yalimo",
        ["yalimo"] = "yalimo",
        ["karubaga"] = "tolikara",
        ["tolikara"] = "tolikara",
        ["dekai"] = "yahukimo",
        ["yahukimo"] = "yahukimo",
        ["oksibil"] = "pegunungan bintang",
        ["pegunungan bintang"] = "pegunungan bintang",
        ["saumlaki"] = "kepulauan tanimbar",
        ["namlea"] = "buru",
        ["namrole"] = "buru selatan",
        ["masohi"] = "maluku tengah",
        ["bula"] = "seram bagian timur",
        ["piru"] = "seram bagian barat",
        ["langgur"] = "maluku tenggara",
        ["dobo"] = "kepulauan aru",
        ["tiakur"] = "maluku barat daya",
        ["labuha"] = "halmahera selatan",
        ["tobelo"] = "halmahera utara",
        ["maba"] = "halmahera timur",
        ["jawa"] = "halmahera tengah",
        ["jailolo"] = "halmahera barat",
        ["sanana"] = "kepulauan sula",
        ["daruba"] = "pulau morotai",
        ["bobong"] = "pulau taliabu",

        // Bali & Nusa Tenggara
        ["singaraja"] = "buleleng",
        ["buleleng"] = "buleleng",
        ["negara"] = "jembrana",
        ["tabanan"] = "tabanan",
        ["gianyar"] = "gianyar",
        ["ubud"] = "gianyar",
        ["klungkung"] = "klungkung",
        ["semarapura"] = "klungkung",
        ["bangli"] = "bangli",
        ["amlapura"] = "karangasem",
        ["karangasem"] = "karangasem",
        ["praya"] = "lombok tengah",
        ["lombok tengah"] = "lombok tengah",
        ["selong"] = "lombok timur",
        ["lombok timur"] = "lombok timur",
        ["gerung"] = "lombok barat",
        ["lombok barat"] = "lombok barat",
        ["tanjung"] = "lombok utara",
        ["lombok utara"] = "lombok utara",
        ["taliwang"] = "sumbawa barat",
        ["sumbawa barat"] = "sumbawa barat",
        ["waingapu"] = "sumba timur",
        ["sumba timur"] = "sumba timur",
        ["waikabubak"] = "sumba barat",
        ["sumba barat"] = "sumba barat",
        ["tambolaka"] = "sumba barat daya",
        ["sumba barat daya"] = "sumba barat daya",
        ["waibakul"] = "sumba tengah",
        ["sumba tengah"] = "sumba tengah",
        ["atambua"] = "belu",
        ["belu"] = "belu",
        ["betun"] = "malaka",
        ["malaka"] = "malaka",
        ["kefamenanu"] = "timor tengah utara",
        ["timor tengah utara"] = "timor tengah utara",
        ["soe"] = "timor tengah selatan",
        ["timor tengah selatan"] = "timor tengah selatan",
        ["ba'a"] = "rote ndao",
        ["rote ndao"] = "rote ndao",
        ["seba"] = "sabu raijua",
        ["sabu raijua"] = "sabu raijua",
        ["kalabahi"] = "alor",
        ["alor"] = "alor",
        ["ruteng"] = "manggarai",
        ["manggarai"] = "manggarai",
        ["labuan bajo"] = "manggarai barat",
        ["manggarai barat"] = "manggarai barat",
        ["borong"] = "manggarai timur",
        ["manggarai timur"] = "manggarai timur",
        ["bajawa"] = "ngada",
        ["ngada"] = "ngada",
        ["mbay"] = "nagekeo",
        ["nagekeo"] = "nagekeo",
        ["ende"] = "ende",
        ["maumere"] = "sikka",
        ["sikka"] = "sikka",
        ["larantuka"] = "flores timur",
        ["flores timur"] = "flores timur",
        ["lewoleba"] = "lembata",
        ["lembata"] = "lembata",

        // Jawa & DIY
        ["cikarang"] = "bekasi",
        ["cibinong"] = "bogor",
        ["purwokerto"] = "banyumas",
        ["kepanjen"] = "malang",
        ["jogja"] = "yogyakarta",
        ["yogyakarta"] = "yogyakarta",
        ["sleman"] = "sleman",
        ["bantul"] = "bantul",
        ["wonosari"] = "gunungkidul",
        ["gunungkidul"] = "gunungkidul",
        ["wates"] = "kulon progo",
        ["kulon progo"] = "kulon progo",
        ["jakpus"] = "jakarta pusat",
        ["jaksel"] = "jakarta selatan",
        ["jaktim"] = "jakarta timur",
        ["jakbar"] = "jakarta barat",
        ["jakut"] = "jakarta utara",
        ["seribu"] = "kepulauan seribu",
        ["tangsel"] = "tangerang selatan",
        ["tigaraksa"] = "tangerang",
        ["serpong"] = "tangerang selatan",
        ["bsd"] = "tangerang selatan",
        ["singaparna"] = "tasikmalaya",
        ["soreang"] = "bandung",
        ["ngamprah"] = "bandung barat",
        ["pelabuhanratu"] = "sukabumi",
        ["palabuhanratu"] = "sukabumi",
        ["tarogong"] = "garut",
        ["parigi"] = "pangandaran",
        ["kajen"] = "pekalongan",
        ["ungaran"] = "semarang",
        ["slawi"] = "tegal",
        ["kraksaan"] = "probolinggo",
        ["bangkalan"] = "bangkalan",
        ["sampang"] = "sampang",
        ["pamekasan"] = "pamekasan",
        ["sumenep"] = "sumenep",

        // Sumatera, Kalimantan & Sulawesi
        ["batam"] = "batam",
        ["tanjung pinang"] = "tanjung pinang",
        ["bukittinggi"] = "bukittinggi",
        ["sungailiat"] = "bangka",
        ["tanjung pandan"] = "belitung",
        ["tarakan"] = "tarakan",
        ["banjarbaru"] = "banjarbaru",
        ["singkawang"] = "singkawang",
        ["bontang"] = "bontang",
        ["palopo"] = "palopo",
        ["parepare"] = "parepare",
        ["baubau"] = "baubau",
        ["tidore"] = "tidore kepulauan",
        ["ternate"] = "ternate",
        ["tual"] = "tual",
        ["tomohon"] = "tomohon",
        ["kotamobagu"] = "kotamobagu",
        ["bitung"] = "bitung"
    };

    public static string NormalizeQuery(string query)
    {
        return query.Trim().ToLowerInvariant();
    }

    public static T? FindBestMatch<T>(string userQuestion, IEnumerable<T> candidates, Func<T, string> nameSelector, Func<T, string> searchKeySelector, Func<T, RegionLevel> levelSelector) where T : class
    {
        var normalized = NormalizeQuery(userQuestion);

        // 1. Cek kamus alias terlebih dahulu
        foreach (var (alias, target) in Aliases)
        {
            var pattern = $@"\b{Regex.Escape(alias)}\b";
            if (Regex.IsMatch(normalized, pattern, RegexOptions.IgnoreCase))
            {
                var targetCandidate = candidates.FirstOrDefault(c =>
                {
                    var name = nameSelector(c).ToLowerInvariant();
                    var key = searchKeySelector(c).ToLowerInvariant();
                    return name.Contains(target) || key.Contains(target);
                });

                if (targetCandidate != null)
                {
                    return targetCandidate;
                }
            }
        }

        // 2. Pencocokan langsung berbasis search key (prioritas nama terpanjang dan level kab/kota jika disebut)
        var ordered = candidates
            .OrderByDescending(c => searchKeySelector(c).Length)
            .ToList();

        // Coba cocokan dengan batas kata (word boundary) untuk menghindari false positive
        foreach (var c in ordered)
        {
            var key = searchKeySelector(c);
            if (string.IsNullOrWhiteSpace(key) || key.Length < 3) continue;

            var pattern = $@"\b{Regex.Escape(key)}\b";
            if (Regex.IsMatch(normalized, pattern, RegexOptions.IgnoreCase))
            {
                return c;
            }
        }

        // Fallback substring jika kata lebih dari 4 karakter
        foreach (var c in ordered)
        {
            var key = searchKeySelector(c);
            if (key.Length >= 5 && normalized.Contains(key, StringComparison.OrdinalIgnoreCase))
            {
                return c;
            }
        }

        return null;
    }
}
