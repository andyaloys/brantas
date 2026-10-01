# BRANTAS Workspace Workflow & Commit Rules

Ketentuan kerja yang wajib ditaati oleh asisten AI di seluruh workspace BRANTAS:

1. **Selalu Jelaskan Rencana Kerja Secara Detail dan Lengkap**:
   - Berikan uraian rencana kerja yang komprehensif, mencakup analisis masalah, arsitektur/desain solusi, file yang akan dimodifikasi, dan alur pengerjaannya sebelum mengambil tindakan teknis.

2. **Selalu Konfirmasi Sebelum Implementasi**:
   - Setelah memaparkan rencana kerja, WAJIB meminta konfirmasi/persetujuan dari pengguna terlebih dahulu sebelum mulai menulis atau mengedit kode di workspace.

3. **Buatkan Commit Plan yang Detail untuk Setiap Tahapan yang Dikerjakan**:
   - Cantumkan daftar file target, ringkasan modifikasi, serta pesan commit yang diformat khusus:
     - Untuk pekerjaan Backend: `"BE - message in English"` (contoh: `BE - implement geospatial data seeding and fix cors policy`)
     - Untuk pekerjaan Frontend: `"FE - message in English"` (contoh: `FE - update landing copy, hero titles, nav button, and center footer attribution`)

4. **Wajib Selalu Konfirmasi Sebelum Commit**:
   - Setiap kali pekerjaan selesai diuji dan siap di-commit ke Git, WAJIB meminta konfirmasi dan menunggu persetujuan eksplisit dari pengguna sebelum mengeksekusi perintah git commit.
