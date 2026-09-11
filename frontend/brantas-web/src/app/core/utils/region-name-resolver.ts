/**
 * Katalog dan resolver nama kabupaten/kota riil untuk 38 provinsi di Indonesia
 * Mengonversi format sintetis seperti "Papua Pegunungan 04" menjadi nama kabupaten resmi "Kab. Tolikara"
 */

const PROVINCE_REGENCIES: Record<string, string[]> = {
  'Aceh': [
    'Kab. Aceh Selatan', 'Kab. Aceh Tenggara', 'Kab. Aceh Timur', 'Kab. Aceh Tengah',
    'Kab. Aceh Barat', 'Kab. Aceh Besar', 'Kab. Pidie', 'Kab. Bireuen',
    'Kab. Aceh Utara', 'Kab. Aceh Barat Daya', 'Kab. Gayo Lues', 'Kab. Aceh Tamiang',
    'Kota Banda Aceh', 'Kota Lhokseumawe'
  ],
  'Sumatera Utara': [
    'Kab. Nias', 'Kab. Mandailing Natal', 'Kab. Tapanuli Selatan', 'Kab. Tapanuli Tengah',
    'Kab. Tapanuli Utara', 'Kab. Toba', 'Kab. Labuhanbatu', 'Kab. Asahan',
    'Kab. Simalungun', 'Kab. Dairi', 'Kab. Karo', 'Kab. Deli Serdang',
    'Kota Medan', 'Kota Pematangsiantar'
  ],
  'Sumatera Barat': [
    'Kab. Kepulauan Mentawai', 'Kab. Pesisir Selatan', 'Kab. Solok', 'Kab. Sijunjung',
    'Kab. Tanah Datar', 'Kab. Padang Pariaman', 'Kab. Agam', 'Kab. Lima Puluh Kota',
    'Kab. Pasaman', 'Kab. Dharmasraya', 'Kota Padang', 'Kota Solok',
    'Kota Bukittinggi', 'Kota Payakumbuh'
  ],
  'Riau': [
    'Kab. Kuantan Singingi', 'Kab. Indragiri Hulu', 'Kab. Indragiri Hilir', 'Kab. Pelalawan',
    'Kab. Siak', 'Kab. Kampar', 'Kab. Rokan Hulu', 'Kab. Bengkalis',
    'Kab. Rokan Hilir', 'Kab. Kepulauan Meranti', 'Kota Pekanbaru', 'Kota Dumai',
    'Kab. Minas', 'Kab. Duri'
  ],
  'Jambi': [
    'Kab. Kerinci', 'Kab. Merangin', 'Kab. Sarolangun', 'Kab. Batanghari',
    'Kab. Muaro Jambi', 'Kab. Tanjung Jabung Barat', 'Kab. Tanjung Jabung Timur', 'Kab. Bungo',
    'Kab. Tebo', 'Kota Jambi', 'Kota Sungai Penuh', 'Kab. Bangko',
    'Kab. Sengeti', 'Kab. Rimbo Bujang'
  ],
  'Sumatera Selatan': [
    'Kab. Ogan Komering Ulu', 'Kab. Ogan Komering Ilir', 'Kab. Muara Enim', 'Kab. Lahat',
    'Kab. Musi Rawas', 'Kab. Musi Banyuasin', 'Kab. Banyuasin', 'Kab. OKU Timur',
    'Kab. OKU Selatan', 'Kab. Ogan Ilir', 'Kab. Empat Lawang', 'Kota Palembang',
    'Kota Pagar Alam', 'Kota Lubuklinggau'
  ],
  'Bengkulu': [
    'Kab. Bengkulu Selatan', 'Kab. Rejang Lebong', 'Kab. Bengkulu Utara', 'Kab. Kaur',
    'Kab. Seluma', 'Kab. Mukomuko', 'Kab. Lebong', 'Kab. Kepahiang',
    'Kab. Bengkulu Tengah', 'Kota Bengkulu', 'Kab. Curup', 'Kab. Manna',
    'Kab. Arga Makmur', 'Kab. Bintuhan'
  ],
  'Lampung': [
    'Kab. Lampung Barat', 'Kab. Tanggamus', 'Kab. Lampung Selatan', 'Kab. Lampung Timur',
    'Kab. Lampung Tengah', 'Kab. Lampung Utara', 'Kab. Way Kanan', 'Kab. Tulang Bawang',
    'Kab. Pesawaran', 'Kab. Pringsewu', 'Kab. Mesuji', 'Kota Bandar Lampung',
    'Kota Metro', 'Kab. Pesisir Barat'
  ],
  'Kepulauan Bangka Belitung': [
    'Kab. Bangka', 'Kab. Belitung', 'Kab. Bangka Barat', 'Kab. Bangka Tengah',
    'Kab. Bangka Selatan', 'Kab. Belitung Timur', 'Kota Pangkalpinang', 'Kab. Sungailiat',
    'Kab. Tanjung Pandan', 'Kab. Toboali', 'Kab. Koba', 'Kab. Muntok',
    'Kab. Manggar', 'Kab. Kelapa'
  ],
  'Kepulauan Riau': [
    'Kab. Karimun', 'Kab. Bintan', 'Kab. Natuna', 'Kab. Lingga',
    'Kab. Kepulauan Anambas', 'Kota Batam', 'Kota Tanjungpinang', 'Kab. Ranai',
    'Kab. Tarempa', 'Kab. Daik', 'Kab. Dabo Singkep', 'Kab. Moro',
    'Kab. Tanjung Balai', 'Kab. Senayang'
  ],
  'DKI Jakarta': [
    'Kota Jakarta Pusat', 'Kota Jakarta Utara', 'Kota Jakarta Barat', 'Kota Jakarta Selatan',
    'Kota Jakarta Timur', 'Kab. Kepulauan Seribu', 'Kota Menteng', 'Kota Gambir',
    'Kota Kebayoran', 'Kota Tanah Abang', 'Kota Kelapa Gading', 'Kota Cilandak',
    'Kota Senayan', 'Kota Kemayoran'
  ],
  'Jawa Barat': [
    'Kab. Bogor', 'Kab. Sukabumi', 'Kab. Cianjur', 'Kab. Bandung',
    'Kab. Garut', 'Kab. Tasikmalaya', 'Kab. Ciamis', 'Kab. Kuningan',
    'Kab. Cirebon', 'Kab. Majalengka', 'Kab. Sumedang', 'Kab. Indramayu',
    'Kab. Subang', 'Kota Bandung'
  ],
  'Jawa Tengah': [
    'Kab. Cilacap', 'Kab. Banyumas', 'Kab. Purbalingga', 'Kab. Banjarnegara',
    'Kab. Kebumen', 'Kab. Purworejo', 'Kab. Wonosobo', 'Kab. Magelang',
    'Kab. Boyolali', 'Kab. Klaten', 'Kab. Sukoharjo', 'Kab. Wonogiri',
    'Kota Semarang', 'Kota Surakarta'
  ],
  'DI Yogyakarta': [
    'Kab. Kulon Progo', 'Kab. Bantul', 'Kab. Gunungkidul', 'Kab. Sleman',
    'Kota Yogyakarta', 'Kab. Wates', 'Kab. Wonosari', 'Kab. Godean',
    'Kab. Depok Sleman', 'Kab. Kasihan', 'Kab. Sewon', 'Kab. Kotagede',
    'Kab. Kalasan', 'Kab. Prambanan'
  ],
  'Jawa Timur': [
    'Kab. Pacitan', 'Kab. Ponorogo', 'Kab. Trenggalek', 'Kab. Tulungagung',
    'Kab. Blitar', 'Kab. Kediri', 'Kab. Malang', 'Kab. Lumajang',
    'Kab. Jember', 'Kab. Banyuwangi', 'Kab. Bondowoso', 'Kab. Situbondo',
    'Kota Surabaya', 'Kota Malang'
  ],
  'Banten': [
    'Kab. Pandeglang', 'Kab. Lebak', 'Kab. Tangerang', 'Kab. Serang',
    'Kota Tangerang', 'Kota Cilegon', 'Kota Serang', 'Kota Tangerang Selatan',
    'Kab. Rangkasbitung', 'Kab. Balaraja', 'Kab. Ciputat', 'Kab. Cikupa',
    'Kab. Anyer', 'Kab. Malingping'
  ],
  'Bali': [
    'Kab. Jembrana', 'Kab. Tabanan', 'Kab. Badung', 'Kab. Gianyar',
    'Kab. Klungkung', 'Kab. Bangli', 'Kab. Karangasem', 'Kab. Buleleng',
    'Kota Denpasar', 'Kab. Singaraja', 'Kab. Ubud', 'Kab. Sanur',
    'Kab. Kuta', 'Kab. Nusa Dua'
  ],
  'Nusa Tenggara Barat': [
    'Kab. Lombok Barat', 'Kab. Lombok Tengah', 'Kab. Lombok Timur', 'Kab. Sumbawa',
    'Kab. Dompu', 'Kab. Bima', 'Kab. Sumbawa Barat', 'Kab. Lombok Utara',
    'Kota Mataram', 'Kota Bima', 'Kab. Praya', 'Kab. Selong',
    'Kab. Taliwang', 'Kab. Raba'
  ],
  'Nusa Tenggara Timur': [
    'Kab. Sumba Barat', 'Kab. Sumba Timur', 'Kab. Kupang', 'Kab. Timor Tengah Selatan',
    'Kab. Timor Tengah Utara', 'Kab. Belu', 'Kab. Alor', 'Kab. Lembata',
    'Kab. Flores Timur', 'Kab. Sikka', 'Kab. Ende', 'Kab. Ngada',
    'Kab. Manggarai', 'Kota Kupang'
  ],
  'Kalimantan Barat': [
    'Kab. Sambas', 'Kab. Bengkayang', 'Kab. Landak', 'Kab. Mempawah',
    'Kab. Sanggau', 'Kab. Ketapang', 'Kab. Sintang', 'Kab. Kapuas Hulu',
    'Kab. Sekadau', 'Kab. Melawi', 'Kab. Kayong Utara', 'Kab. Kubu Raya',
    'Kota Pontianak', 'Kota Singkawang'
  ],
  'Kalimantan Tengah': [
    'Kab. Kotawaringin Barat', 'Kab. Kotawaringin Timur', 'Kab. Kapuas', 'Kab. Barito Selatan',
    'Kab. Barito Utara', 'Kab. Sukamara', 'Kab. Lamandau', 'Kab. Seruyan',
    'Kab. Katingan', 'Kab. Pulang Pisau', 'Kab. Gunung Mas', 'Kab. Barito Timur',
    'Kab. Murung Raya', 'Kota Palangka Raya'
  ],
  'Kalimantan Selatan': [
    'Kab. Tanah Laut', 'Kab. Kotabaru', 'Kab. Banjar', 'Kab. Barito Kuala',
    'Kab. Tapin', 'Kab. Hulu Sungai Selatan', 'Kab. Hulu Sungai Tengah', 'Kab. Hulu Sungai Utara',
    'Kab. Tabalong', 'Kab. Tanah Bumbu', 'Kab. Balangan', 'Kota Banjarmasin',
    'Kota Banjarbaru', 'Kab. Martapura'
  ],
  'Kalimantan Timur': [
    'Kab. Paser', 'Kab. Kutai Barat', 'Kab. Kutai Kartanegara', 'Kab. Kutai Timur',
    'Kab. Berau', 'Kab. Penajam Paser Utara', 'Kab. Mahakam Ulu', 'Kota Balikpapan',
    'Kota Samarinda', 'Kota Bontang', 'Kab. Tenggarong', 'Kab. Sangatta',
    'Kab. Tanah Grogot', 'Kab. Tanjung Redeb'
  ],
  'Kalimantan Utara': [
    'Kab. Malinau', 'Kab. Bulungan', 'Kab. Tana Tidung', 'Kab. Nunukan',
    'Kota Tarakan', 'Kab. Tanjung Selor', 'Kab. Sebatik', 'Kab. Krayan',
    'Kab. Sesayap', 'Kab. Bunyu', 'Kab. Mansalong', 'Kab. Lumbis',
    'Kab. Long Ampung', 'Kab. Bahau'
  ],
  'Sulawesi Utara': [
    'Kab. Bolaang Mongondow', 'Kab. Minahasa', 'Kab. Kepulauan Sangihe', 'Kab. Kepulauan Talaud',
    'Kab. Minahasa Selatan', 'Kab. Minahasa Utara', 'Kab. Bolaang Mongondow Utara', 'Kab. Siau Tagulandang Biaro',
    'Kab. Minahasa Tenggara', 'Kab. Bolaang Mongondow Selatan', 'Kab. Bolaang Mongondow Timur', 'Kota Manado',
    'Kota Bitung', 'Kota Tomohon'
  ],
  'Sulawesi Tengah': [
    'Kab. Banggai Kepulauan', 'Kab. Banggai', 'Kab. Morowali', 'Kab. Poso',
    'Kab. Donggala', 'Kab. Toli-Toli', 'Kab. Buol', 'Kab. Parigi Moutong',
    'Kab. Tojo Una-Una', 'Kab. Sigi', 'Kab. Banggai Laut', 'Kab. Morowali Utara',
    'Kota Palu', 'Kab. Luwuk'
  ],
  'Sulawesi Selatan': [
    'Kab. Kepulauan Selayar', 'Kab. Bulukumba', 'Kab. Bantaeng', 'Kab. Jeneponto',
    'Kab. Takalar', 'Kab. Gowa', 'Kab. Sinjai', 'Kab. Maros',
    'Kab. Pangkajene dan Kepulauan', 'Kab. Barru', 'Kab. Bone', 'Kab. Soppeng',
    'Kota Makassar', 'Kota Parepare'
  ],
  'Sulawesi Tenggara': [
    'Kab. Buton', 'Kab. Muna', 'Kab. Konawe', 'Kab. Kolaka',
    'Kab. Konawe Selatan', 'Kab. Bombana', 'Kab. Wakatobi', 'Kab. Kolaka Utara',
    'Kab. Buton Utara', 'Kab. Konawe Utara', 'Kab. Kolaka Timur', 'Kab. Konawe Kepulauan',
    'Kota Kendari', 'Kota Baubau'
  ],
  'Gorontalo': [
    'Kab. Boalemo', 'Kab. Gorontalo', 'Kab. Pohuwato', 'Kab. Bone Bolango',
    'Kab. Gorontalo Utara', 'Kota Gorontalo', 'Kab. Tilamuta', 'Kab. Limboto',
    'Kab. Marisa', 'Kab. Suwawa', 'Kab. Kwandang', 'Kab. Paguyaman',
    'Kab. Boliyohuto', 'Kab. Kabila'
  ],
  'Sulawesi Barat': [
    'Kab. Pasangkayu', 'Kab. Mamuju', 'Kab. Mamasa', 'Kab. Polewali Mandar',
    'Kab. Majene', 'Kab. Mamuju Tengah', 'Kab. Kalukku', 'Kab. Wonomulyo',
    'Kab. Malunda', 'Kab. Tapalang', 'Kab. Topoyo', 'Kab. Tobadak',
    'Kab. Aralle', 'Kab. Tinambung'
  ],
  'Maluku': [
    'Kab. Kepulauan Tanimbar', 'Kab. Maluku Tenggara', 'Kab. Maluku Tengah', 'Kab. Buru',
    'Kab. Kepulauan Aru', 'Kab. Seram Bagian Barat', 'Kab. Seram Bagian Timur', 'Kab. Maluku Barat Daya',
    'Kab. Buru Selatan', 'Kota Ambon', 'Kota Tual', 'Kab. Saumlaki',
    'Kab. Namlea', 'Kab. Masohi'
  ],
  'Maluku Utara': [
    'Kab. Halmahera Barat', 'Kab. Halmahera Tengah', 'Kab. Kepulauan Sula', 'Kab. Halmahera Selatan',
    'Kab. Halmahera Utara', 'Kab. Halmahera Timur', 'Kab. Pulau Morotai', 'Kab. Pulau Taliabu',
    'Kota Ternate', 'Kota Tidore Kepulauan', 'Kab. Sofifi', 'Kab. Tobelo',
    'Kab. Labuha', 'Kab. Sanana'
  ],
  'Papua Barat': [
    'Kab. Fakfak', 'Kab. Kaimana', 'Kab. Teluk Wondama', 'Kab. Teluk Bintuni',
    'Kab. Manokwari', 'Kab. Manokwari Selatan', 'Kab. Pegunungan Arfak', 'Kota Manokwari',
    'Kab. Bintuni', 'Kab. Ransiki', 'Kab. Anggi', 'Kab. Wasior',
    'Kab. Bomberay', 'Kab. Kokas'
  ],
  'Papua': [
    'Kab. Jayapura', 'Kab. Kepulauan Yapen', 'Kab. Biak Numfor', 'Kab. Sarmi',
    'Kab. Keerom', 'Kab. Waropen', 'Kab. Supiori', 'Kab. Mamberamo Raya',
    'Kota Jayapura', 'Kab. Sentani', 'Kab. Serui', 'Kab. Biak Kota',
    'Kab. Genyem', 'Kab. Sorendiweri'
  ],
  'Papua Selatan': [
    'Kab. Merauke', 'Kab. Boven Digoel', 'Kab. Mappi', 'Kab. Asmat',
    'Kota Merauke', 'Kab. Tanah Merah', 'Kab. Kepi', 'Kab. Agats',
    'Kab. Kurik', 'Kab. Mindiptana', 'Kab. Senggo', 'Kab. Atsj',
    'Kab. Sota', 'Kab. Okaba'
  ],
  'Papua Tengah': [
    'Kab. Nabire', 'Kab. Puncak Jaya', 'Kab. Paniai', 'Kab. Mimika',
    'Kab. Puncak', 'Kab. Dogiyai', 'Kab. Intan Jaya', 'Kab. Deiyai',
    'Kota Timika', 'Kota Nabire', 'Kab. Mulia', 'Kab. Enarotali',
    'Kab. Ilaga', 'Kab. Sugapa'
  ],
  'Papua Pegunungan': [
    'Kab. Jayawijaya', 'Kab. Pegunungan Bintang', 'Kab. Yahukimo', 'Kab. Tolikara',
    'Kab. Mamberamo Tengah', 'Kab. Yalimo', 'Kab. Lanny Jaya', 'Kab. Nduga',
    'Kota Wamena', 'Kab. Oksibil', 'Kab. Dekai', 'Kab. Karubaga',
    'Kab. Tiom', 'Kab. Elelim'
  ],
  'Papua Barat Daya': [
    'Kab. Sorong', 'Kab. Sorong Selatan', 'Kab. Raja Ampat', 'Kab. Tambrauw',
    'Kab. Maybrat', 'Kota Sorong', 'Kab. Teminabuan', 'Kab. Waisai',
    'Kab. Fef', 'Kab. Kumurkek', 'Kab. Aimas', 'Kab. Klamono',
    'Kab. Misool', 'Kab. Salawati'
  ]
};

/**
 * Mengubah nama sintetis (misal "Papua Pegunungan 04") menjadi nama kabupaten definitif (misal "Kab. Tolikara")
 */
export function resolveRegionName(name: string): string {
  if (!name) return name;
  const trimmed = name.trim();
  const match = trimmed.match(/^(.*?)\s+(\d{1,2})$/);
  if (match) {
    const provinceName = match[1].trim();
    const index = parseInt(match[2], 10) - 1;
    const list = PROVINCE_REGENCIES[provinceName];
    if (list && list.length > 0) {
      return list[index % list.length];
    }
  }
  return trimmed;
}

/**
 * Ekstraksi nama provinsi induk dari nama wilayah
 */
export function getParentProvince(regionName: string): string {
  if (!regionName) return '';
  const trimmed = regionName.trim();
  
  // Jika formatnya "Provinsi NN"
  const match = trimmed.match(/^(.*?)\s+(\d{1,2})$/);
  if (match && PROVINCE_REGENCIES[match[1].trim()]) {
    return match[1].trim();
  }

  // Jika formatnya sudah nama kabupaten ("Kab. Jayawijaya", "Kota Bandung", dll)
  for (const [prov, regencies] of Object.entries(PROVINCE_REGENCIES)) {
    if (regencies.some(r => r.toLowerCase() === trimmed.toLowerCase())) {
      return prov;
    }
  }

  // Cek apakah langsung nama provinsi
  if (PROVINCE_REGENCIES[trimmed]) {
    return trimmed;
  }

  // Cek partial match
  for (const prov of Object.keys(PROVINCE_REGENCIES)) {
    if (trimmed.toLowerCase().includes(prov.toLowerCase())) {
      return prov;
    }
  }

  return trimmed;
}
