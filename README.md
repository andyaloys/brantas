# 🛡️ BRANTAS
> **Basis Rekomendasi & Analisis Terpadu Anggaran Sosial**  
> *Poverty Eradication & Fiscal Intelligence Platform*

[![Deployment Status](https://github.com/andyaloys/brantas/actions/workflows/deploy.yml/badge.svg)](https://github.com/andyaloys/brantas/actions/workflows/deploy.yml)
[![Live Production](https://img.shields.io/badge/Production-Live-22c55e?logo=google-chrome&logoColor=white)](https://brantas-batii.online)
[![SSL](https://img.shields.io/badge/SSL-Let's%20Encrypt-003a70?logo=letsencrypt&logoColor=white)](https://brantas-batii.online)
[![Backend](https://img.shields.io/badge/.NET-10.0-512bd4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/)
[![Frontend](https://img.shields.io/badge/Angular-21.0-dd0031?logo=angular&logoColor=white)](https://angular.dev/)
[![Database](https://img.shields.io/badge/PostGIS-17--3.5-336791?logo=postgresql&logoColor=white)](https://postgis.net/)

---

## 🌐 Live Production URL
Sistem BRANTAS dapat diakses langsung secara publik:
- **Production URL**: [https://brantas-batii.online](https://brantas-batii.online)
- **Direct VPS IP**: [http://43.133.153.177](http://43.133.153.177)

---

## 📌 Fitur Utama Platform

1. **Executive Macro Dashboard**:
   - Analisis kemiskinan makro nasional (514 kabupaten/kota).
   - Metrik kemiskinan terpadu (Tingkat Kemiskinan, Indeks Kedalaman P1, Indeks Keparahan P2).
   - Analisis korelasi fiskal dengan *Corridor Poverty-Fiscal*.

2. **Peta Spasial Risiko Bencana & Kemiskinan**:
   - Integrasi GeoJSON 514 daerah dengan layer risiko BNPB (IRBI - Indeks Risiko Bencana Indonesia).
   - Overlay multi-bencana (Banjir, Longsor, Gempa, Cuaca Ekstrem, dsb).
   - Filter dinamis berdasarkan tingkat risiko (*Sangat Tinggi, Tinggi, Sedang, Rendah*).

3. **Prescriptive Fiscal Optimization Engine**:
   - Mesin optimasi alokasi anggaran berbasis **Google OR-Tools**.
   - Simulasi alokasi anggaran interaktif secara real-time.
   - Analisis sensitivitas intervensi bantuan sosial.

4. **Deteksi Anomali & Integritas Penyaluran**:
   - Algoritma isolasi hutan (Isolation Forest / Outlier Detection) untuk mendeteksi deviasi penyerapan anggaran sosial.
   - Estimasi *Value-at-Risk* fiskal daerah.

5. **AI Assistant "JUSI" & Pelaporan Eksekutif**:
   - Chatbot analitik kebijakan sosial berbasis konteks fiskal nasional.
   - Generator dokumen Policy Brief resmi siap cetak (QuestPDF).

---

## 🏗️ Arsitektur Teknologi

```mermaid
graph TD
    Client["🌐 Client Browser (Desktop & Mobile)"] -->|HTTPS / TLS 1.3| Nginx["Nginx Reverse Proxy (Port 80 & 443)"]
    Nginx -->|SPA Routing| AngularApp["Angular 21 Web App"]
    Nginx -->|Proxy /api/| NetBackend[".NET 10 Web API Engine"]
    NetBackend -->|Geo Spatial Queries| PostGIS[("PostgreSQL 17 + PostGIS 3.5")]
    NetBackend -->|Caching & Session| Redis[("Redis 7.4")]
    NetBackend -->|Solver Engine| ORTools["Google OR-Tools Optimizer"]
    NetBackend -->|Document Engine| QuestPDF["QuestPDF Policy Generator"]
```

---

## 🚀 CI / CD Pipeline

Repository ini dilengkapi dengan **Continuous Deployment** otomatis via GitHub Actions:
- Setiap perubahan yang di-push ke branch `main` secara otomatis:
  1. Terhubung secara aman ke server VPS melalui SSH.
  2. Melakukan sinkronisasi kode terbaru (`git pull`).
  3. Menjalankan rebuild kontainer produksi Docker Compose.
  4. Melakukan verifikasi kesehatan layanan secara otomatis.
