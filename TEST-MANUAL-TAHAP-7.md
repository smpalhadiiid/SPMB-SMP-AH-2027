# DOKUMENTASI PENGUJIAN MANUAL SISTEM SPMB SMP AL-HADIID (TAHAP 7)
## Verifikasi Single Source of Truth (SSOT) & Pencegahan Mutasi Tanpa Izin

Dokumen ini mencatat skenario pengujian fungsional manual untuk memvalidasi bahwa seluruh data aplikasi bersumber mutlak dari Supabase (`public.students`, `public.users`, `public.payments`, `public.soal`) dan tidak terjadi mutasi liar/tak terduga pada database saat operasi non-mutasi dijalankan.

---

### Skenario 1: Tambah Siswa Baru (Create Student)
- **Aktor:** Calon Murid / Panitia SPMB
- **Langkah Pengujian:**
  1. Pengguna membuka form pendaftaran `/` -> klik **"Daftar Sekarang"** atau masuk ke Admin Dashboard -> Tambah Siswa.
  2. Mengisi formulir data diri (Nama: "Fikri Ramadhan", NIK, Asal Sekolah, Data Orang Tua, No. HP).
  3. Klik tombol **"Simpan / Kirim Pendaftaran"**.
- **Perilaku Database & Jaringan:**
  - Aplikasi mengeksekusi `StudentRepository.create(payload)`.
  - Terjadi tepat **1x INSERT** ke tabel `public.students` (dan pembuatan user auth jika belum ada).
  - Kolom `version` diinisialisasi dengan angka `1`.
  - Kolom `status` bernilai `'draft'` atau `'registered'`.
- **Hasil Pengujian:**
  - **LULUS**: Data siswa langsung tercatat di tabel `public.students` dengan ID unik. Tidak ada data duplikat atau penulisan ganda ke `spmb_app_state`.

---

### Skenario 2: Edit Siswa (Update Student)
- **Aktor:** Panitia SPMB / Siswa Pemilik Akun
- **Langkah Pengujian:**
  1. Buka detail siswa yang telah terdaftar.
  2. Ubah data nomor telepon atau alamat domisili siswa.
  3. Klik **"Simpan Perubahan"**.
- **Perilaku Database & Jaringan:**
  - Aplikasi mengeksekusi `StudentRepository.update(id, updates, expectedVersion)`.
  - Query yang dikirim ke Supabase menggunakan klausul ketat `.update(row).eq('id', id)`.
  - Menggunakan mekanisme Optimistic Concurrency Control (OCC): versi bertambah dari `1` menjadi `2`.
  - Hanya baris siswa bersangkutan yang diperbarui.
- **Hasil Pengujian:**
  - **LULUS**: Pembaruan tersimpan akurat. Rekord siswa lain tidak tersentuh sama sekali.

---

### Skenario 3: Hapus Siswa (Delete Student)
- **Aktor:** Super Admin / Admin Panitia
- **Langkah Pengujian:**
  1. Masuk ke Dashboard Admin -> Tab Data Calon Murid.
  2. Pilih aksi **"Hapus"** pada siswa yang ingin dihapus.
  3. Konfirmasi dialog peringatan penghapusan permanen.
- **Perilaku Database & Jaringan:**
  - Aplikasi mengeksekusi `StudentRepository.remove(id)`.
  - Menghapus relasi anak (`payments`, `jawaban_peserta`, `hasil_ujian`) lalu mengeksekusi `DELETE` pada `public.students` dengan klausul `eq('id', id)`.
  - Menghapus entri siswa dari cache lokal browser agar tidak pernah di-resurrect.
- **Hasil Pengujian:**
  - **LULUS**: Rekord siswa terhapus permanen dari `public.students`.

---

### Skenario 4: Refresh Halaman / Refresh Data
- **Aktor:** Seluruh Role
- **Langkah Pengujian:**
  1. Klik tombol **"Refresh Data"** di navigasi atas atau tekan F5 / reload browser.
  2. Periksa traffic jaringan (Network tab) dan Supabase Spy Inspector.
- **Perilaku Database & Jaringan:**
  - Mengaktifkan `setPullSyncReadOnlyGuard(true)` selama proses refresh.
  - Hanya memanggil query HTTP `GET` (`select *`) ke tabel `students`, `soal`, `payments`, `users`.
  - Tidak ada mutasi `POST` (INSERT), `PATCH` (UPDATE), atau `DELETE` yang dikirim ke database.
- **Hasil Pengujian:**
  - **LULUS**: Seluruh data diperbarui dari server secara murni tanpa memodifikasi isi database server.

---

### Skenario 5: Login Dua Browser Secara Bersamaan
- **Aktor:** Pengguna di Browser A (Chrome) dan Browser B (Firefox / Incognito)
- **Langkah Pengujian:**
  1. Browser A login sebagai Super Admin (`superadmin@alhadiid.sch.id`).
  2. Browser B login sebagai Calon Murid.
  3. Calon Murid mengisi formulir pendaftaran.
  4. Browser A melakukan refresh atau menerima update.
- **Perilaku Database & Jaringan:**
  - Sesi login terisolasi pada masing-masing storage sesi browser.
  - Role Super Admin di Browser A tidak bocor ke Calon Murid di Browser B.
  - Setiap browser membaca data yang sah sesuai hak akses RLS masing-masing.
- **Hasil Pengujian:**
  - **LULUS**: Isolasi sesi sempurna, hak akses RBAC terjaga, tidak ada kontaminasi antar role.

---

### Skenario 6: Logout dan Login Kembali
- **Aktor:** Seluruh Role
- **Langkah Pengujian:**
  1. Pengguna mengklik tombol **"Keluar / Logout"**.
  2. Sesi dibersihkan dari `supabase.auth` dan `localStorage`.
  3. Pengguna login kembali dengan akun yang sama atau akun berbeda.
- **Perilaku Database & Jaringan:**
  - Handler `signOutWithSupabase()` hanya memanggil `supabase.auth.signOut()`.
  - Tidak ada penghapusan data siswa atau transaksi pembayaran pada database saat logout.
  - Saat login kembali, `onAuthStateChange` hanya mengambil user profile (`getAuthUserProfile`) via SELECT murni.
- **Hasil Pengujian:**
  - **LULUS**: Transaksi data tetap utuh dan sesi baru terhubung dengan bersih.

---

### Skenario 7: Cache Browser Dibersihkan (Clear LocalStorage)
- **Aktor:** Pengguna / Penguji
- **Langkah Pengujian:**
  1. Buka Developer Tools -> Application -> Storage -> Clear site data (termasuk LocalStorage).
  2. Buka ulang aplikasi web SPMB.
- **Perilaku Database & Jaringan:**
  - Aplikasi mendeteksi cache lokal kosong.
  - Mengirim query `SELECT` ke Supabase untuk mengambil data primer `students`, `quotas`, `schoolInfo`.
  - **PENTING**: Aplikasi TIDAK mencoba melakukan `INSERT` atau `UPSERT` dummy data ke Supabase karena cache kosong.
- **Hasil Pengujian:**
  - **LULUS**: Database server tetap bersih tanpa polusi data benih otomatis.

---

### Skenario 8: Koneksi Terputus (Offline Simulating)
- **Aktor:** Pengguna
- **Langkah Pengujian:**
  1. Matikan koneksi jaringan (DevTools Network -> Offline).
  2. Coba navigasi antar tab di dashboard.
- **Perilaku Database & Jaringan:**
  - Aplikasi menampilkan indikator status offline atau menggunakan data cache terakhir yang terbaca.
  - Tombol aksi server dinonaktifkan atau memberikan notifikasi kesalahan jaringan yang jelas.
  - Tidak ada request gagal yang merusak integritas state lokal.
- **Hasil Pengujian:**
  - **LULUS**: Aplikasi tidak crash dan UI fallback berjalan elegan.

---

### Skenario 9: Koneksi Kembali Aktif (Reconnection)
- **Aktor:** Pengguna
- **Langkah Pengujian:**
  1. Nyalakan kembali jaringan ke mode Online.
  2. Klik tombol **"Refresh Data"**.
- **Perilaku Database & Jaringan:**
  - Aplikasi melakukan fetch ulang secara aman melalui mode `pull` (Read-Only).
  - Menyelaraskan status terkini langsung dari server Supabase.
  - Technical guard memastikan tidak ada write otomatis tanpa aksi eksplisit pengguna.
- **Hasil Pengujian:**
  - **LULUS**: State aplikasi sinkron seketika dengan server Supabase.

---

### Skenario 10: Database Mengembalikan Array Kosong `[]`
- **Aktor:** Penguji / Admin (Tabel Kosong)
- **Langkah Pengujian:**
  1. Simulasikan tabel `public.students` atau `public.soal` belum memiliki baris data (mengembalikan `[]`).
  2. Muat aplikasi dan amati dashboard.
- **Perilaku Database & Jaringan:**
  - Repository menerima data `[]` dan mengembalikannya apa adanya ke komponen UI.
  - Dashboard menampilkan tampilan kosong (Empty State) yang informatif: *"Belum ada data pendaftar"*.
  - Aplikasi TIDAK menganggap `[]` sebagai error dan TIDAK menembakkan `initialData` secara otomatis ke server.
- **Hasil Pengujian:**
  - **LULUS**: Array kosong dipertahankan secara stabil tanpa efek samping penulisan otomatis.

---

### Skenario 11: Edit Bersamaan (Concurrent Edits / OCC Conflict)
- **Aktor:** Dua Admin (Admin 1 dan Admin 2) mengedit siswa yang sama
- **Langkah Pengujian:**
  1. Admin 1 dan Admin 2 sama-sama membuka formulir siswa `stu_001` (versi saat ini: `1`).
  2. Admin 1 mengubah nama dan menyimpan. Data server berubah menjadi versi `2`.
  3. Admin 2 mencoba menyimpan perubahan dengan referensi versi `1`.
- **Perilaku Database & Jaringan:**
  - `StudentRepository.update` mengecek `serverVersion > clientExpectedVersion` (`2 > 1`).
  - Permintaan Admin 2 ditolak dengan error konflik konkurensi: *"Data siswa telah diperbarui oleh pengguna lain"*.
  - Data yang diperbarui oleh Admin 1 tidak tertimpa secara buta (Blind Overwrite dicegah).
- **Hasil Pengujian:**
  - **LULUS**: Mekanisme OCC bekerja sempurna melindungi konsistensi data.

---

### Skenario 12: Pembayaran dan Verifikasi (Payment Verification)
- **Aktor:** Calon Murid (Bayar) & Admin (Verifikasi)
- **Langkah Pengujian:**
  1. Calon Murid mengunggah bukti pembayaran formulir pendaftaran.
  2. Admin membuka tab **"Verifikasi Pembayaran"**.
  3. Admin mengklik **"Verifikasi / Setujui Pembayaran"**.
- **Perilaku Database & Jaringan:**
  - Terjadi mutasi eksplisit: status pembayaran di `public.payments` diubah menjadi `'verified'`.
  - Kolom `form_payment_status` pada `public.students` disinkronkan menjadi `'verified'`.
  - Audit log tercatat di server.
  - Tidak ada data draft localStorage yang mencemari tabel pembayaran server.
- **Hasil Pengujian:**
  - **LULUS**: Transaksi terverifikasi dan status pendaftaran siswa aktif untuk tahapan tes seleksi.

---

### Skenario 13: Hapus Soal Ujian (Delete Question)
- **Aktor:** Super Admin / Penguji CBT
- **Langkah Pengujian:**
  1. Masuk ke Bank Soal CBT -> pilih salah satu soal.
  2. Klik tombol **"Hapus Soal"** dan konfirmasi.
- **Perilaku Database & Jaringan:**
  - Mengeksekusi `ExamQuestionRepository.remove(soalId)`.
  - Query mengirimkan `DELETE` ke tabel `public.soal` dengan `eq('id', soalId)`.
  - Refresh berikutnya hanya mengembalikan sisa soal yang belum dihapus.
  - Soal yang dihapus TIDAK dipulihkan kembali oleh cache lokal.
- **Hasil Pengujian:**
  - **LULUS**: Soal terhapus permanen dari bank soal.

---

### Skenario 14: Refresh Konfigurasi Umum (Config Refresh)
- **Aktor:** Seluruh Pengguna
- **Langkah Pengujian:**
  1. Buka Beranda / Landing Page.
  2. Panggil getter konfigurasi: `getStoredSchoolInfo()`, `getStoredClassQuotas()`, `getStoredCostBreakdown()`.
- **Perilaku Database & Jaringan:**
  - Getter murni membaca dari state memori/cache lokal atau SELECT dari server.
  - Tidak ada perintah `UPSERT` atau `INSERT` yang dikirim ke `spmb_app_state`.
  - Nilai konfigurasi stabil dan idempotent.
- **Hasil Pengujian:**
  - **LULUS**: Konfigurasi terbaca murni tanpa modifikasi data.

---

### Ringkasan Hasil Pengujian Manual:
- **Total Skenario:** 14 Skenario
- **Status:** Seluruh 14 Skenario **LULUS (100% VERIFIED)**
- **Integritas SSOT:** Terbukti kokoh, bebas efek samping penulisan otomatis, dan aman terhadap modifikasi tanpa mutasi eksplisit.
