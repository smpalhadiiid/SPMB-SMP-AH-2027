# =====================================================================
# PANDUAN LENGKAP MIGRASI DATA (DATA-MIGRATION.md)
# SPMB SMPS AL-HADIID CILEUNGSI (TRANSISI TOTAL V1 KE V2)
# =====================================================================

Dokumen ini menjelaskan proses perpindahan data dari model lama (*JSON document blob in `public.spmb_app_state`*) ke arsitektur relasional murni (*Single Source of Truth* / SSOT) di Supabase.

---

## 1. Latar Belakang & Identifikasi Arsitektur Lama (Legacy v1)

Pada implementasi awal (v1), sistem SPMB mengalami masalah konsistensi dan integritas data akibat pola arsitektur:
1. **`spmb_app_state` (Tabel key-value JSONB)**:
   - Menyimpan seluruh array siswa pada key `'students'`.
   - Menyimpan seluruh array akun pada key `'users_db'`.
   - Menyimpan array pembayaran pada key `'form_payments'` dan `'bam_payments'`.
2. **`localStorage` Client-Side**:
   - Berfungsi sebagai cache agresif yang meng-overwrite state server dan melakukan *auto-seed/auto-restore* ketika database server kosong `[]`.
   - Mode sinkronisasi "smart" dan "push" berpotensi menimpa data server secara massal (*blind overwrite*).
3. **Data Relasional Terabaikan**:
   - Terjadi inkonsistensi antara tabel relasional `public.students` dengan JSON blob di `spmb_app_state`.

---

## 2. Arsitektur Sasaran (Single Source of Truth v2)

| Entitas | Model Baru (V2) | Kebijakan Terhadap `spmb_app_state` | Peran Cache Lokal (`localStorage`) |
| :--- | :--- | :--- | :--- |
| **Identitas Akun** | `public.users` & `auth.users` | **DILARANG**. Key `users` / `users_db` dihapus permanen. | Hanya menyimpan token sesi Supabase SDK. |
| **Pendaftaran Siswa** | `public.students` | **DILARANG**. Dicegah oleh CHECK constraint. | Cache baca sementara, tidak pernah menimpa database. |
| **Pembayaran** | `public.payments` | **DILARANG**. Key `payments` dihapus permanen. | Draft form saat input, tidak ada riwayat transaksi lokal. |
| **Bank Soal & CBT** | `public.soal`, `public.jawaban_peserta`, `public.hasil_ujian` | **DILARANG**. | Tidak ada penyimpanan kunci jawaban di client. |
| **Konfigurasi Non-Transaksional** | `public.spmb_app_state` (`school_info`, `class_quotas`, `cost_breakdown`) | **DIIZINKAN** (Non-transaksional). | UI fallback jika offline. |

---

## 3. Langkah-Langkah Menjalankan Migrasi

### Langkah 1: Backup Database
Sebelum menjalankan migrasi, buat backup snapshot skema dan data yang ada di Supabase Dashboard -> **Settings** -> **Database** -> **Backups**.

### Langkah 2: Eksekusi Dry-Run
Jalankan file `supabase/data_migration_dry_run.sql` pada SQL Editor Supabase.
Skrip ini akan menampilkan ringkasan data yang ada di `spmb_app_state`:
- Jumlah record siswa di JSON `students`.
- Jumlah akun di JSON `users_db`.
- Daftar ID yang belum ada di tabel relasional.

### Langkah 3: Eksekusi Migrasi Total (Tahap 1 s/d 6)
Jalankan file `supabase/migrations/010_migrate_app_state_to_relational.sql` pada SQL Editor Supabase.
Skrip ini secara otomatis dan atomik (idempoten):
1. Memindahkan akun dari `spmb_app_state` (`users_db`) ke tabel relasional `public.users`.
2. Memastikan user account dibuat untuk setiap siswa agar memenuhi foreign key `public.students(id) -> public.users(id)`.
3. Memindahkan seluruh data siswa dari JSON `students` ke tabel relasional `public.students`.
4. Memindahkan seluruh data pembayaran formulir & BAM ke tabel relasional `public.payments`.
5. Memindahkan bank soal CBT ke tabel relasional `public.soal`.
6. Memasang CHECK constraint `chk_non_transactional_keys` pada `public.spmb_app_state` sehingga database server menolak key transaksional:
   ```sql
   ALTER TABLE public.spmb_app_state
   ADD CONSTRAINT chk_non_transactional_keys
   CHECK (key IN (
       'school_info', 'schoolInfo',
       'cost_breakdown', 'costBreakdown',
       'class_quotas', 'classQuotas',
       'test_schedules', 'testSchedules',
       'gas_config', 'gasConfig',
       'website_config', 'websiteConfig'
   ));
   ```
7. Menghapus key transaksional lama dari `public.spmb_app_state`.

---

## 4. Verifikasi Pasca Migrasi

Jalankan skrip `supabase/verify_migration.sql` pada SQL Editor Supabase.
Pastikan hasil output memvalidasi:
- Tabel `public.students` memiliki data siswa yang terisi lengkap.
- Kolom `version` pada `public.students` terisi (default 1) untuk Optimistic Concurrency Control.
- Tabel `public.payments` memiliki foreign key valid ke `public.students`.
- Tabel `public.spmb_app_state` tidak lagi memiliki baris dengan key `'students'`, `'users_db'`, atau `'form_payments'`.
- Constraint `chk_non_transactional_keys` aktif dan menolak insert key ilegal.

---

## 5. Rollback Plan (Rencana Pemulihan Darurat)

Jika terjadi kendala selama eksekusi migrasi:
1. Skrip `010_migrate_app_state_to_relational.sql` dibungkus dalam blok transaksi PL/pgSQL atomik (`DO $$ ... $$`). Jika terjadi exception, rollback terjadi secara otomatis.
2. Jika perlu mengembalikan data asli, pulihkan tabel `spmb_app_state` dari snapshot backup yang dibuat pada Langkah 1.
