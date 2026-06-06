# Product Requirements Document
## 6S Audit MVM — Internal Tool

**Versi:** 1.0  
**Tanggal:** 6 Juni 2026  
**Status:** Production

---

## 1. Ringkasan Produk

**6S Audit MVM** adalah aplikasi web internal untuk mengelola dan menjalankan audit 6S (Sort, Set in Order, Shine, Standardize, Sustain, Safety) di lingkungan kerja. Aplikasi ini menggantikan proses audit manual berbasis kertas atau spreadsheet, mempercepat pengisian, menyimpan histori, dan menyediakan analitik berbasis data.

**Target pengguna:** Tim PIC 6S dan auditor internal perusahaan manufaktur.

---

## 2. Tujuan Produk

- Digitalisasi proses audit 6S yang sebelumnya manual
- Memudahkan pencatatan skor dan catatan temuan per auditee secara real-time
- Menyimpan histori audit secara terpusat di cloud
- Menyediakan laporan dan analitik untuk monitoring tren kualitas 6S
- Menghasilkan dokumen audit (PDF) yang dapat diarsipkan

---

## 3. Stack Teknologi

| Komponen       | Teknologi                         |
|----------------|-----------------------------------|
| Framework      | Next.js 14.2.5 (App Router)       |
| Bahasa         | TypeScript                        |
| Styling        | Tailwind CSS v3                   |
| Database       | Supabase (PostgreSQL)             |
| Auth           | Custom password-based (internal)  |
| Charts         | Recharts                          |
| PDF Export     | `window.print()` / HTML new-window|
| PNG Export     | html2canvas                       |
| Deployment     | Netlify                           |
| Font Signature | Dancing Script (Google Fonts)     |

---

## 4. Arsitektur Database

### Tabel `lokasi`
| Kolom        | Tipe    | Keterangan                        |
|--------------|---------|-----------------------------------|
| id           | uuid    | Primary key                       |
| nama         | string  | Nama lokasi (misal: OTC, Cabin)   |
| kode         | string  | Kode singkat                      |
| jumlah_pic   | number  | Jumlah PIC auditor (1 atau 2)     |
| aktif        | boolean | Soft delete                       |

### Tabel `members`
| Kolom      | Tipe    | Keterangan                    |
|------------|---------|-------------------------------|
| id         | uuid    | Primary key                   |
| lokasi_id  | uuid    | FK → lokasi                   |
| nama       | string  | Nama auditee                  |
| urutan     | number  | Urutan tampil                 |
| aktif      | boolean | Soft delete                   |

### Tabel `checklist_items`
| Kolom      | Tipe    | Keterangan                              |
|------------|---------|-----------------------------------------|
| id         | uuid    | Primary key                             |
| lokasi_id  | uuid    | FK → lokasi                             |
| nomor      | number  | Nomor urut item                         |
| item       | string  | Nama item audit                         |
| deskripsi  | string? | Penjelasan tambahan                     |
| bobot      | number  | Bobot item dalam perhitungan skor total |
| aktif      | boolean | Soft delete                             |

### Tabel `score_config`
| Kolom      | Tipe    | Keterangan              |
|------------|---------|-------------------------|
| id         | uuid    | Primary key             |
| nilai      | number  | Nilai skor (0–4)        |
| label      | string  | Label (misal: Buruk)    |
| deskripsi  | string? | Deskripsi kondisi       |
| warna      | string? | Hex color untuk UI      |

### Tabel `audit_sessions`
| Kolom         | Tipe                   | Keterangan                    |
|---------------|------------------------|-------------------------------|
| id            | uuid                   | Primary key                   |
| lokasi_id     | uuid                   | FK → lokasi                   |
| tanggal       | date                   | Tanggal audit                 |
| auditor1      | string                 | Nama PIC auditor utama        |
| auditor2      | string?                | Nama PIC auditor kedua        |
| status        | `draft` / `completed`  | Status sesi                   |
| waktu_proses  | string?                | Durasi audit (format HH:MM:SS)|
| avg_score_pct | number?                | Rata-rata skor seluruh sesi   |

### Tabel `audit_results`
| Kolom        | Tipe                | Keterangan                          |
|--------------|---------------------|-------------------------------------|
| id           | uuid                | Primary key                         |
| session_id   | uuid                | FK → audit_sessions                 |
| lokasi_id    | uuid                | FK → lokasi                         |
| tanggal      | date                | Tanggal audit                       |
| auditee_name | string              | Nama auditee                        |
| scores       | JSON                | `{ item_id: nilai }` per checklist  |
| remarks      | JSON                | `{ item_id: catatan }` temuan       |
| total_score  | number?             | Total skor terbobot                 |
| max_score    | number?             | Skor maksimal terbobot              |
| persen       | number?             | Persentase (total/max × 100)        |
| kategori     | `EX` / `SD` / `NI` | Kategori hasil                      |
| skipped      | boolean             | Apakah auditee di-skip              |
| skip_reason  | string?             | Alasan skip                         |

---

## 5. Logika Penilaian

### Skala Skor
| Nilai | Makna      |
|-------|------------|
| 0     | Sangat Buruk |
| 1     | Buruk      |
| 2     | Cukup      |
| 3     | Baik       |
| 4     | Sangat Baik|

### Perhitungan
```
Total Skor   = Σ (nilai_item × bobot_item)
Skor Maksimal = Σ (4 × bobot_item)
Persentase   = (Total Skor / Skor Maksimal) × 100
```

### Kategori
| Threshold   | Kategori             |
|-------------|----------------------|
| ≥ 85%       | EX (Excellent)       |
| 60% – 84%   | SD (Standard)        |
| < 60%       | NI (Need Improvement)|

### Catatan Wajib
Skor ≤ 2 mewajibkan pengisian field catatan/temuan.

---

## 6. Fitur & Halaman

### 6.1 Login (`/login`)
- Form input password (single shared password untuk internal)
- Validasi di server; token disimpan di cookie
- Redirect ke `/` setelah berhasil

---

### 6.2 Setup Sesi (`/` — Home)
**Fungsi:** Membuat atau melanjutkan sesi audit.

**Alur:**
1. Pilih lokasi dari daftar (visual card dengan icon per lokasi)
2. Pilih tanggal audit (custom date picker dengan navigasi bulan)
3. Pilih PIC Auditor (searchable dropdown; jumlah PIC mengikuti konfigurasi lokasi)
4. Klik "Mulai Audit" → sesi dibuat di Supabase → redirect ke `/audit`

**Resume sesi:**
- Sesi berstatus `draft` tampil sebagai card peringatan
- Tombol Resume melanjutkan ke `/audit` dari posisi auditee yang belum diisi

**Validasi:**
- Lokasi wajib
- Tanggal wajib (default: hari ini)
- Auditor 1 wajib; Auditor 2 wajib jika `jumlah_pic >= 2`

---

### 6.3 Audit (`/audit`)
**Fungsi:** Mengisi skor dan catatan untuk setiap auditee.

**Fitur utama:**
- Header sticky dengan nama auditee aktif, lokasi, PIC, dan timer real-time
- Progress bar + dot indicator per auditee (warna: abu = belum, hijau = selesai, kuning = skip, biru = aktif)
- Modal daftar auditee untuk navigasi cepat
- Untuk setiap auditee: tampil semua checklist item dengan tombol skor 0–4 dan field catatan
- Skor ≤ 2: textarea catatan wajib dengan visual warning
- Skor ≥ 3: input teks catatan opsional
- Referensi skor (label + warna) tampil di atas checklist
- Tombol Skip: pilih alasan (Cuti / Sakit / Dinas luar / Lainnya) + keterangan opsional
- Setelah auditee terakhir → simpan timer → redirect ke `/review`
- Auto-resume: data yang sudah tersimpan di Supabase di-load saat halaman dibuka

---

### 6.4 Review (`/review`)
**Fungsi:** Melihat ringkasan seluruh hasil audit sebelum finalisasi, lalu export PDF.

**Konten:**
- Header info sesi (lokasi, tanggal, PIC, durasi)
- Tabel rekap: baris per auditee × kolom per checklist item
  - Setiap sel menampilkan nilai skor dengan warna sesuai `score_config`
  - Baris sub-row untuk catatan temuan (item dengan skor rendah)
  - Kolom total skor, persentase, dan badge kategori (EX/SD/NI)
- Baris skip auditee ditandai khusus dengan alasan
- Kartu tanda tangan digital di bawah tabel:
  - Nama auditor dalam font handwriting (Dancing Script)
  - Garis bawah + nama tercetak tebal
- Tombol "Export PDF" menggunakan `window.print()` dengan print CSS khusus

---

### 6.5 History (`/history`)
**Fungsi:** Melihat semua sesi audit yang sudah selesai.

**Filter:**
- Tahun (dropdown dinamis dari data Supabase)
- Bulan
- Kategori (EX/SD/NI)
- Urutan (Sort)

**List sesi:** Tanggal, lokasi, PIC, jumlah auditee, avg score, badge kategori dominan.

**Modal detail sesi:**
- Tabel lengkap seperti halaman Review (dengan sub-row catatan)
- Kartu tanda tangan digital
- Tombol Export PDF (full HTML via new window + auto-print)

---

### 6.6 Dashboard Analisis (`/dashboard`)
**Fungsi:** Analitik dan visualisasi data audit.

**Filter global:** Tahun (dinamis), Lokasi, Semester, Kategori.

**KPI Cards:**
| Card            | Warna   | Ikon         |
|-----------------|---------|--------------|
| Total Sesi      | #7C6EF5 | assignment   |
| Auditee Dinilai | #10C98F | people       |
| Avg Score       | hijau   | percent      |
| Di-skip         | kuning  | person_off   |

**Kategori Cards (Excellent / Standard / NI):** Jumlah, persentase, mini progress bar.

**Charts:**
| Chart                 | Tipe        | Export   |
|-----------------------|-------------|----------|
| Distribusi Kategori   | Donut/Pie   | PNG      |
| Per Lokasi            | Bar Chart   | PNG, CSV |
| Tren Distribusi       | Stacked Bar | PNG, CSV |
| Ranking Auditee       | Table       | PNG, CSV |
| Auditee Di-skip       | List Card   | PNG      |

**Period label:** Tampil di subtitle setiap card (`Tahun · Semester · Lokasi`).

---

### 6.7 Settings (`/settings`)
**Fungsi:** Konfigurasi master data.

**Tab Lokasi:**
- Tambah lokasi baru (nama, kode, jumlah PIC)
- Edit inline
- Hapus dengan konfirmasi modal

**Tab Member:**
- List auditee per lokasi (filter dropdown)
- Tambah member baru
- Edit inline
- Hapus dengan konfirmasi modal

**Tab Checklist:**
- List item checklist per lokasi
- Tambah item baru (nomor, nama, deskripsi, bobot)
- Edit inline
- Hapus dengan konfirmasi modal

---

## 7. Alur Pengguna (User Flow)

```
Login
  └─→ Setup Sesi
        ├─→ (Resume draft sesi)
        └─→ Mulai Audit
              └─→ Isi skor per auditee (loop)
                    ├─→ Skip auditee
                    └─→ Selesai semua
                          └─→ Review
                                └─→ Export PDF / Selesai
                                      └─→ Kembali ke Home

Dari Home:
  ├─→ Dashboard Analisis
  ├─→ History
  └─→ Settings
```

---

## 8. Non-Functional Requirements

| Aspek          | Requirement                                            |
|----------------|--------------------------------------------------------|
| Performa       | First load < 3 detik (Netlify CDN)                    |
| Responsif      | Mobile-first, max-width 512px untuk halaman audit      |
| Keamanan       | Password internal, semua API di server component       |
| Ketersediaan   | Hosted Netlify + Supabase (uptime ~99.9%)             |
| Skalabilitas   | Filter tahun dinamis — berfungsi tanpa batas tahun     |
| Aksesibilitas  | ARIA labels pada form, kontras warna memadai           |
| Offline        | Tidak didukung (requires Supabase connection)          |

---

## 9. Batasan & Out of Scope (v1.0)

- Tidak ada multi-tenant / multi-perusahaan
- Tidak ada notifikasi email / push notification
- Tidak ada peran user berbeda (semua user setara)
- Tidak ada versioning checklist (perubahan langsung overwrite)
- Export hanya PDF dan PNG/CSV (tidak ada Excel/XLSX)
- Tidak ada mode offline

---

## 10. Changelog

| Versi | Tanggal    | Perubahan                                                  |
|-------|------------|------------------------------------------------------------|
| 1.0   | 2026-06-06 | Initial release — audit, review, history, dashboard, settings |
