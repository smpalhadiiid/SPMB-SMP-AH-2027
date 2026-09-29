# SPMB SMPS Al-Hadiid Cileungsi (Sistem Penerimaan Murid Baru Online)

Sistem Informasi Penerimaan Murid Baru (SPMB) SMP Al-Hadiid Cileungsi berbasis arsitektur **Single Source of Truth (SSOT)** menggunakan database PostgreSQL / Supabase, Express.js backend proxy, dan React 19 + TypeScript frontend.

---

## 1. Arsitektur Single Source of Truth (SSOT)

Aplikasi ini menggunakan arsitektur relasional murni dengan pemisahan tanggung jawab yang ketat:

| Entitas Data | Tabel Supabase (SSOT) | Keterangan & Proteksi |
| :--- | :--- | :--- |
| **Data Calon Siswa** | `public.students` | Data pendaftar, NIK, biodata orang tua, status pendaftaran. OCC (`version`) mencegah *blind overwrite*. |
| **Akun & Otorisasi** | `public.users` | Profil RBAC (`superadmin`, `admin`, `panitia`, `keuangan`, `student`). Bebas dari manipulasi cache. |
| **Pembayaran** | `public.payments` | Transaksi pembayaran formulir & daftar ulang (BAM). Terisolasi dari cache lokal. |
| **Ujian Seleksi (CBT)** | `public.soal`, `public.ujian`, `public.jawaban_peserta`, `public.hasil_ujian` | Bank soal, sesi tes, jawaban, dan kalkulasi nilai otomatis. Kunci jawaban dilindungi server-side. |
| **Konfigurasi Sistem** | `public.spmb_app_state` | **HANYA** untuk data non-transaksional: kuota kelas, info sekolah, rincian biaya, jadwal tes. |

### Prinsip Integritas Data (Non-Negotiable)
1. **Refresh Bersifat Read-Only**: Pemuatan ulang data (pull/refresh) dilindungi oleh *Technical Guard* (`setPullSyncReadOnlyGuard(true)`) yang memblokir semua mutasi `insert`, `update`, `upsert`, dan `delete`.
2. **Data Kosong Tetap Kosong**: Jika database server mengembalikan array kosong `[]`, aplikasi mempertahankan array kosong tanpa melakukan auto-seed data dummy.
3. **Data Terhapus Tidak Muncul Kembali**: Operasi penghapusan menghapus foreign key berelasi di server dan membersihkan cache lokal seketika.
4. **Mutasi Hanya Akibat Tindakan Pengguna**: Tidak ada background syncing otomatis yang menulis data ke database tanpa aksi klik eksplisit dari pengguna.
5. **Keamanan Kunci Rahasia**: `service_role` key dilarang keras berada di bundle client/browser. Semua akses browser menggunakan `anon` key yang diawasi oleh Row Level Security (RLS).

---

## 2. Persyaratan Lingkungan (Prerequisites)

- **Node.js**: v18.0.0 atau lebih baru (disarankan v20 LTS / v22)
- **NPM**: v9.0.0 atau lebih baru
- **Projek Supabase**: PostgreSQL 15+ dengan ekstensi `pgcrypto` dan `uuid-ossp`

---

## 3. Konfigurasi Environment Variable

Salin file `.env.example` ke `.env`:

```bash
cp .env.example .env
```

Isi variabel environment sesuai kredensial projek Supabase Anda:

```env
# AI Studio & Port Configuration
PORT=3000
GEMINI_API_KEY=your-gemini-api-key-if-applicable

# Supabase Client Configuration (Akses Publik / Frontend)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Supabase Server-Side Configuration (Proxy / Backend Only)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-never-expose-to-client

# CORS Allowed Origins
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

> **PERINGATAN KEAMANAN:** Jangan pernah mengisikan `SUPABASE_SERVICE_ROLE_KEY` pada variabel berawalan `VITE_`. Kunci tersebut memiliki hak bypass RLS dan hanya boleh dipakai oleh backend Node.js.

---

## 4. Panduan Menjalankan Migrasi Database

File migrasi database terletak di direktori `supabase/migrations/`.

### Urutan Eksekusi Migrasi SQL di Supabase SQL Editor:
1. `001_extensions_and_types.sql`: Ekstensi UUID, crypto, dan ENUM roles & status.
2. `002_core_schema.sql`: Tabel `public.users`, `public.students`, dan `public.spmb_app_state`.
3. `003_payment_schema.sql`: Tabel `public.payments` dan audit log keuangan.
4. `004_cbt_schema.sql`: Tabel `public.kategori_soal`, `public.soal`, `public.jawaban_peserta`, `public.hasil_ujian`.
5. `005_functions_and_triggers.sql`: Stored functions, OCC check, dan audit triggers.
6. `006_rls_policies.sql`: Row Level Security policies untuk isolasi multi-role.
7. `007_storage_policies.sql`: Bucket storage untuk bukti bayar dan dokumen berkas.
8. `008_reference_seed.sql`: Data inisialisasi kuota dan kategori soal.
9. `009_security_hardening.sql`: Pengamanan ketat RPC dan pembatasan fungsi administratif.
10. `010_migrate_app_state_to_relational.sql`: Pemindahan data transaksional dari JSON legacy ke tabel relasional baru.

### Verifikasi Hasil Migrasi:
Jalankan skrip verifikasi pada Supabase SQL Editor:
```sql
-- Jalankan isi file supabase/verify_migration.sql
```
Pastikan seluruh tabel relasional terisi dan constraint `chk_non_transactional_keys` aktif di `public.spmb_app_state`.

---

## 5. Menjalankan Aplikasi Secara Lokal

### Instalasi Dependensi:
```bash
npm install
```

### Menjalankan Mode Development:
```bash
npm run dev
```
Aplikasi berjalan pada `http://localhost:3000`.

---

## 6. Prosedur Verifikasi & Pengujian Kode

Jalankan seluruh suite verifikasi kualitas dan integritas kode:

```bash
# 1. Pengecekan Type Safety TypeScript
npm run typecheck

# 2. Kompilasi Produksi (Vite + esbuild Server)
npm run build

# 3. Test Integritas SSOT (15 Skenario Anti-Mutasi)
npm test

# 4. Test Integrasi CRUD & OCC (4 Skenario Lifecycle)
npm run test:integration
```

---

## 7. Panduan Deployment Produksi

### Build Produksi:
```bash
npm run build
```
Output build:
- `dist/`: Berisi bundle client statis yang telah diminifikasi (`index.html`, assets CSS/JS).
- `dist/server.cjs`: Bundle server CommonJS mandiri hasil kompilasi `esbuild`.

### Menjalankan di Server Produksi:
```bash
NODE_ENV=production npm start
```
Server Express akan menyajikan API backend dan melayani asset frontend statis dari direktori `dist/`.

### Deployment ke Cloud Run / Docker Container:
Aplikasi telah dikonfigurasi untuk container ingress port `3000` dan host `0.0.0.0`.
Periksa `package.json` scripts:
- `dev`: `tsx server.ts`
- `build`: `vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs`
- `start`: `node dist/server.cjs`
