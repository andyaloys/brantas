# Instruksi Proyek BRANTAS

Sistem analitik anggaran sosial & kemiskinan untuk LAN Datathon 2026 (Kemenkeu RI).
Dokumen kebutuhan: `dokumen/BRD_BRANTAS.md`. **Selalu rujuk kebutuhan dengan kodenya** (mis. `FR-OPT-03`, `SPEC-SYNTH-02`).

## Bahasa

- Seluruh teks yang terlihat pengguna, pesan galat, dan keluaran AI: **Bahasa Indonesia formal**.
- Identifier kode, nama tabel, dan nama endpoint: **Bahasa Inggris**.
- Komentar kode: Bahasa Indonesia, hanya bila menjelaskan *alasan* yang tidak terbaca dari kode.

## Tumpukan Teknologi (tidak boleh diganti tanpa ADR)

| Bagian | Teknologi |
|---|---|
| Backend | ASP.NET Core 10, Clean Architecture, Minimal API |
| Database | PostgreSQL 17 + PostGIS + pgvector, EF Core 10 + NetTopologySuite |
| ML | Microsoft.ML.OnnxRuntime (model dilatih di Python, diekspor `.onnx`) |
| Optimasi | Google OR-Tools |
| LLM | Semantic Kernel → LLM Gateway internal (OpenAI-compatible) |
| PDF | QuestPDF |
| Frontend | Angular 21 (standalone, signals, **zoneless**), PrimeNG 21, Leaflet, ECharts |

## Struktur

```
backend/src/Brantas.Domain/          # Entitas & aturan bisnis murni. TANPA dependensi eksternal.
backend/src/Brantas.Application/     # Use case, CQRS handler, interface. Tidak menyentuh EF/HTTP langsung.
backend/src/Brantas.Infrastructure/  # EF Core, konektor data, klien LLM.
backend/src/Brantas.Analytics/       # Anomali, Moran's I, IKW, optimizer, DiD.
backend/src/Brantas.Api/             # Endpoint, auth, SSE.
frontend/brantas-web/                # Angular. Struktur di BRD §7.5.2.
infra/                                # Docker Compose dan konfigurasi lingkungan lokal.
```

Arah dependensi hanya ke dalam: `Api → Infrastructure → Application → Domain`.

## Aturan Wajib

### Keamanan
- Query database **selalu** terparameterisasi. Tidak ada string concatenation SQL.
- NIK/NKK disimpan **hanya** sebagai hash (SHA-256 + salt). Tidak pernah dirender utuh di UI atau log.
- Rahasia (API key, connection string) via User Secrets / env var. **Tidak pernah** masuk repositori.
- Setiap endpoint punya atribut otorisasi eksplisit. Peran `REGIONAL` selalu difilter cakupan wilayah.
- Setiap aksi yang mengubah state menulis audit log.

### LLM (JUSI)
- **Angka tidak boleh berasal dari model.** Seluruh nilai numerik wajib hasil tool calling ke database (`FR-LLM-02`).
- Tool bersifat baca-saja dan mewarisi filter otorisasi pemanggil.
- Guardrail berjalan sebelum dan sesudah inferensi (BRD §7.6.5).
- Nama model dan base URL dari konfigurasi, tidak pernah ter-hardcode.

### Data
- MVP memakai data sintetis. Akses sumber selalu lewat `IDataSourceConnector` (`FR-DATA-08`).
- Generator sintetis wajib deterministik terhadap seed dan mengikuti SPEC-SYNTH (§10.4).
- **Struktur spasial wajib ditanam** (SPEC-SYNTH-02) — tanpa itu Moran's I ≈ 0 dan fitur kluster gagal.
- Setiap keluaran analitik menyimpan `datasetVersionId` agar dapat direproduksi.
- Tampilan bersumber data sintetis wajib merender badge "Data Simulasi".

### Frontend
- Zoneless. State fitur memakai `signalStore`; nilai turunan **selalu** `computed()`, tidak disimpan ganda.
- Komponen tidak memanggil `HttpClient` langsung — selalu lewat lapisan `data/` fitur.
- Tipe API **digenerate dari OpenAPI**, tidak ditulis tangan.
- Leaflet diisolasi dalam adapter dan berjalan di luar change detection.
- Setiap tampilan data menangani 4 kondisi: memuat, kosong, galat, sebagian.

## Konvensi

- C#: `PascalCase` tipe/metode, `_camelCase` field privat, `sealed` secara default, nullable aktif.
- Async: selalu teruskan `CancellationToken`. Akhiri nama metode dengan `Async`.
- Galat API: RFC 7807 ProblemDetails.
- Migrasi EF Core diberi nama deskriptif, tidak pernah disunting setelah di-commit.
- Angular: berkas `kebab-case`, komponen `OnPush`, `input()`/`output()` fungsi (bukan dekorator).

## Yang Harus Dihindari

- Menambah pustaka baru tanpa alasan kuat — utamakan yang sudah ada di tumpukan.
- Membuat abstraksi untuk satu kali pakai.
- Menulis dokumen markdown baru untuk mencatat perubahan kecuali diminta.
- Mengubah `fe app/` — itu mockup lama dan **bukan** basis kode.
