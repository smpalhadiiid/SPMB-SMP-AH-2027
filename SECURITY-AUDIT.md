# Audit Keamanan — SPMB SMP AL-Hadiid Cileungsi

Tanggal audit: 12 September 2026

## Ringkasan

Audit statis mencakup React/TypeScript, konfigurasi Vite/Vercel, autentikasi Supabase, RLS, Storage, Edge Function, pengelolaan data siswa/pembayaran/CBT, rahasia, dan jejak integrasi Gemini.

## Temuan dan perbaikan

### Kritis — Kunci jawaban CBT dapat dibaca peserta

**Masalah:** kebijakan RLS `Students view active questions` memberi SELECT pada baris `soal`; karena tabel juga memuat `jawaban_benar`, peserta terautentikasi berpotensi meminta kolom tersebut langsung melalui PostgREST.

**Perbaikan:** migrasi `009_security_hardening.sql` menghapus kebijakan itu dan menambahkan `rpc_get_exam_questions`, yang hanya mengembalikan pertanyaan/pilihan/bobot/urutan untuk ujian aktif tanpa kunci jawaban.

**Tindak lanjut wajib:** ubah loader portal peserta agar memakai RPC tersebut sebelum menerapkan migrasi di produksi. Jangan aktifkan kembali SELECT langsung untuk role peserta.

### Kritis — Peserta dapat mencoba mengubah field hasil/proses server

**Masalah:** RLS UPDATE pada `students` membatasi baris, tetapi tidak membatasi kolom. Peserta dapat mencoba mengubah status pembayaran, nilai, status ujian, atau penempatan kelas miliknya.

**Perbaikan:** trigger `protect_student_managed_fields` menolak perubahan field yang dikelola server untuk pemanggil non-admin.

### Tinggi — Pendaftaran publik menerima role dari klien

**Masalah:** helper pendaftaran menerima `role` dari browser dan membentuk profil lokal berdasarkan nilai tersebut. Walaupun trigger database memaksa role student, UI dapat membentuk status otorisasi yang tidak konsisten dan alur fallback menyimpan profil lokal saat operasi server gagal.

**Perbaikan:** pendaftaran publik kini menolak role selain `student`, metadata selalu `student`, ID memakai UUID/ID Auth, dan alur manajemen pengguna tidak lagi membuat fallback lokal setelah kegagalan server.

**Tindak lanjut:** sediakan Edge Function khusus pembuatan akun pengelola, validasi JWT + role super_admin, gunakan service role hanya di server, dan catat audit log.

### Tinggi — Atribut keamanan profil dapat diubah

**Masalah:** update profil berisiko menyertakan role, auth mapping, status akun, atau flag reset password.

**Perbaikan:** trigger `protect_user_security_fields` mengunci field tersebut kecuali untuk super admin.

### Sedang — CORS Edge Function terlalu longgar

**Masalah:** fungsi reset password mengizinkan origin `*`.

**Perbaikan:** origin sekarang harus ada pada `ALLOWED_ORIGINS` (daftar dipisahkan koma), respons memakai `Vary: Origin`, dan origin asing ditolak 403.

### Sedang — Dev server terbuka dan CORS universal

**Masalah:** Vite bind ke semua interface melalui script serta `cors: true`.

**Perbaikan:** konfigurasi Vite bind ke `127.0.0.1`; CORS mati secara default dan hanya aktif untuk `VITE_DEV_ALLOWED_ORIGIN`. Script `dev` masih memiliki `--host=0.0.0.0` dan harus diubah/di-override bila tidak diperlukan dalam container.

### Sedang — Header browser belum cukup ketat

**Perbaikan:** menambahkan CSP, mengganti frame policy menjadi DENY, mempertahankan HSTS, nosniff, referrer policy, dan permissions policy. Inline script global dihapus agar CSP `script-src 'self'` dapat berlaku.

### Sedang — SECURITY DEFINER dapat dieksekusi PUBLIC

**Perbaikan:** helper otorisasi utama dicabut dari PUBLIC dan hanya diberikan kepada `authenticated`; seluruh fungsi SECURITY DEFINER perlu diaudit serupa sebelum produksi.

### AI safety — Integrasi Gemini tidak ditemukan

Dependensi dan environment key Gemini tercantum, tetapi tidak ada pemanggilan Gemini di source. Karena fitur AI belum ada, belum ada risiko prompt injection runtime yang dapat diuji. Sebelum mengaktifkan AI:

- panggil Gemini hanya dari server/Edge Function; jangan pernah mengekspos API key ke `VITE_*`;
- autentikasi dan rate-limit per pengguna/IP;
- minimalkan/redaksi NIK, NISN, alamat, dokumen keluarga, data pembayaran, dan data anak;
- jangan izinkan model menentukan kelulusan, nilai, verifikasi pembayaran, role, atau mutasi database;
- gunakan output terstruktur tervalidasi schema, batas panjang, timeout, dan audit trail;
- anggap semua input dokumen/prompt sebagai data tidak tepercaya; jangan menjalankan instruksi dari konten;
- sediakan human review, penjelasan, dan jalur banding untuk keputusan yang berdampak pada siswa.

## Validasi

- Pemindaian rahasia: tidak ditemukan pola API key/JWT nyata; hanya referensi `service_role` dalam SQL legacy.
- Struktur migrasi diverifikasi terhadap nama kolom yang ada.
- `vercel.json` lolos parse JSON.
- Typecheck/build belum dapat divalidasi penuh di sandbox karena arsip tidak menyertakan `node_modules` dan instalasi dependensi jaringan tidak tersedia. Kegagalan yang terlihat didominasi modul yang tidak terpasang, bukan bukti error source.

## Checklist deployment

1. Buat backup database dan uji migrasi 009 di staging.
2. Migrasikan portal peserta ke `rpc_get_exam_questions` sebelum produksi.
3. Set `ALLOWED_ORIGINS=https://domain-produksi` pada Edge Function.
4. Buat Edge Function admin-create-user; jangan gunakan public signup untuk akun admin/kepsek.
5. Jalankan `npm ci`, `npm run typecheck`, `npm test`, dan `npm run build` di CI.
6. Tambahkan test RLS dengan token anon, student, admin, kepsek, dan super_admin.
7. Hapus/arsipkan migrasi legacy dari paket deployment agar tidak diterapkan tanpa sengaja.
8. Jalankan dependency audit di CI dan pin versi yang sudah diverifikasi.
