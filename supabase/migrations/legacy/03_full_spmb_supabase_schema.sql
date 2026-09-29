-- =====================================================================
-- MASTER MIGRATION SQL SUPABASE - APP SPMB SMP AL-HADIID
-- =====================================================================
-- Deskripsi: Script SQL Lengkap untuk pembuatan tabel, relasi, index, 
--            Row Level Security (RLS), dan Triggers di Supabase Database.
-- Petunjuk: Salin dan jalankan seluruh script ini di SQL Editor Supabase Dashboard.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSIONS & UTILITY FUNCTIONS
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function otomatis memperbarui timestamp updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 1. TABEL PUBLIC.USERS (Manajemen Pengguna & Auth Sync)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id VARCHAR(100) PRIMARY KEY,
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) UNIQUE,
    phone VARCHAR(50),
    role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'admin', 'kepsek', 'super_admin')),
    registration_number VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    must_change_password BOOLEAN NOT NULL DEFAULT false,
    last_login TIMESTAMP WITH TIME ZONE,
    password_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Ensure unique constraint on email if users table was created previously without it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key'
    ) THEN
        ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Index untuk pencarian cepat
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------
-- 2. TABEL PUBLIC.STUDENTS (Data Pendaftaran Calon Murid SPMB)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
    id VARCHAR(100) PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    registration_number VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    user_email VARCHAR(255) NOT NULL,
    is_form_verified BOOLEAN DEFAULT false,
    
    -- Step 2: Registrasi Dasar
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    
    -- Step 3: Pembayaran Formulir (Rp200.000)
    form_payment_proof_url TEXT,
    form_payment_date VARCHAR(100),
    form_payment_amount NUMERIC(12,2) DEFAULT 200000,
    form_payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (form_payment_status IN ('unpaid', 'pending', 'verified', 'rejected')),
    form_payment_notes TEXT,
    
    -- Step 4: Data Biodata Lengkap
    nik VARCHAR(50),
    nisn VARCHAR(50),
    birth_place VARCHAR(100),
    birth_date VARCHAR(50),
    gender VARCHAR(20) CHECK (gender IN ('Laki-laki', 'Perempuan')),
    religion VARCHAR(50) DEFAULT 'Islam',
    child_order VARCHAR(20),
    total_siblings VARCHAR(20),
    address TEXT,
    village VARCHAR(100),
    subdistrict VARCHAR(100),
    city VARCHAR(100),
    province VARCHAR(100),
    postal_code VARCHAR(20),
    
    -- Data Sekolah Asal
    previous_school_name VARCHAR(255),
    previous_school_npsn VARCHAR(50),
    previous_school_address TEXT,
    
    -- Data Orang Tua - Ayah
    father_name VARCHAR(255),
    father_birth_place VARCHAR(100),
    father_birth_date VARCHAR(50),
    father_job VARCHAR(100),
    father_education VARCHAR(100),
    father_phone VARCHAR(50),
    
    -- Data Orang Tua - Ibu
    mother_name VARCHAR(255),
    mother_birth_place VARCHAR(100),
    mother_birth_date VARCHAR(50),
    mother_job VARCHAR(100),
    mother_education VARCHAR(100),
    mother_phone VARCHAR(50),
    
    -- Data Wali (Opsional)
    guardian_name VARCHAR(255),
    guardian_relation VARCHAR(100),
    guardian_phone VARCHAR(50),
    
    -- Dokumen Berkas Upload
    photo_url TEXT,
    kk_url TEXT,
    birth_cert_url TEXT,
    report_card_url TEXT,
    kip_url TEXT,
    certificate_url TEXT,
    
    -- Step 7 & 8: Ujian Diagnostik CBT
    is_test_active BOOLEAN DEFAULT false,
    test_submitted BOOLEAN DEFAULT false,
    test_answers JSONB DEFAULT '{}'::jsonb,
    test_schedule_date VARCHAR(100),
    test_location VARCHAR(255),
    diagnostic_score NUMERIC(5,2),
    general_score NUMERIC(5,2),
    religious_score NUMERIC(5,2),
    final_score NUMERIC(5,2),
    test_notes TEXT,
    
    -- Step 10: Pembayaran Biaya Awal Masuk (Daftar Ulang)
    initial_payment_proof_url TEXT,
    initial_payment_date VARCHAR(100),
    initial_payment_amount NUMERIC(12,2) DEFAULT 0,
    initial_payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (initial_payment_status IN ('unpaid', 'pending', 'verified', 'rejected')),
    initial_payment_notes TEXT,
    
    -- Step 11 & 12: Penempatan Kelas
    assigned_class_id VARCHAR(50),
    assigned_class_name VARCHAR(100),
    assigned_homeroom_teacher VARCHAR(255),
    first_day_date VARCHAR(100),
    mpls_info TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index untuk pencarian & filtering cepat
CREATE INDEX IF NOT EXISTS idx_students_reg_no ON public.students(registration_number);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status);
CREATE INDEX IF NOT EXISTS idx_students_form_pay ON public.students(form_payment_status);
CREATE INDEX IF NOT EXISTS idx_students_init_pay ON public.students(initial_payment_status);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_students_updated_at ON public.students;
CREATE TRIGGER trg_students_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------
-- 3. TABEL PUBLIC.PAYMENTS (Riwayat Transaksi Pembayaran)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(100) NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    registration_number VARCHAR(100) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    payment_type VARCHAR(50) NOT NULL CHECK (payment_type IN ('formulir', 'daftar_ulang')),
    amount NUMERIC(12,2) NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    proof_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    verified_by VARCHAR(255),
    verified_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_student ON public.payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_type ON public.payments(payment_type);

-- ---------------------------------------------------------------------
-- 4. TABEL MODUL CBT (Kategori, Soal, Ujian, Jawaban, Hasil)
-- ---------------------------------------------------------------------

-- Kategori Soal
CREATE TABLE IF NOT EXISTS public.kategori_soal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_kategori VARCHAR(100) NOT NULL UNIQUE,
    kode_kategori VARCHAR(50) NOT NULL UNIQUE,
    persentase_bobot DECIMAL(5,2) NOT NULL DEFAULT 30.00 CHECK (persentase_bobot > 0),
    keterangan TEXT,
    aktif BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Bank Soal
CREATE TABLE IF NOT EXISTS public.soal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kategori_kode VARCHAR(50) NOT NULL REFERENCES public.kategori_soal(kode_kategori) ON DELETE CASCADE ON UPDATE CASCADE,
    pertanyaan TEXT NOT NULL,
    gambar_url TEXT,
    pilihan_a TEXT NOT NULL,
    pilihan_b TEXT NOT NULL,
    pilihan_c TEXT NOT NULL,
    pilihan_d TEXT NOT NULL,
    jawaban_benar VARCHAR(1) NOT NULL CHECK (jawaban_benar IN ('A', 'B', 'C', 'D')),
    bobot INT NOT NULL DEFAULT 10 CHECK (bobot > 0),
    level_kesulitan VARCHAR(20) DEFAULT 'medium' CHECK (level_kesulitan IN ('easy', 'medium', 'hard')),
    aktif BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Jadwal Ujian
CREATE TABLE IF NOT EXISTS public.ujian (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_ujian VARCHAR(255) NOT NULL,
    gelombang VARCHAR(100) NOT NULL DEFAULT 'Gelombang 1',
    tanggal DATE NOT NULL,
    jam_mulai TIME NOT NULL DEFAULT '08:00:00',
    durasi INT NOT NULL DEFAULT 90 CHECK (durasi > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'aktif' CHECK (status IN ('draft', 'aktif', 'selesai')),
    jumlah_diagnostik INT NOT NULL DEFAULT 6,
    jumlah_tpu INT NOT NULL DEFAULT 8,
    jumlah_diniyyah INT NOT NULL DEFAULT 6,
    batas_kelulusan DECIMAL(5,2) DEFAULT 70.00,
    aktif BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Jawaban Peserta
CREATE TABLE IF NOT EXISTS public.jawaban_peserta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ujian_id UUID NOT NULL REFERENCES public.ujian(id) ON DELETE CASCADE,
    peserta_id VARCHAR(100) NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    soal_id UUID NOT NULL REFERENCES public.soal(id) ON DELETE CASCADE,
    jawaban_dipilih VARCHAR(1),
    is_ragu BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_ujian_peserta_soal UNIQUE (ujian_id, peserta_id, soal_id)
);

-- Hasil Ujian CBT
CREATE TABLE IF NOT EXISTS public.hasil_ujian (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ujian_id UUID NOT NULL REFERENCES public.ujian(id) ON DELETE CASCADE,
    peserta_id VARCHAR(100) NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    nilai_diagnostik DECIMAL(5,2) DEFAULT 0.00,
    nilai_tpu DECIMAL(5,2) DEFAULT 0.00,
    nilai_diniyyah DECIMAL(5,2) DEFAULT 0.00,
    nilai_akhir DECIMAL(5,2) DEFAULT 0.00,
    status_kelulusan VARCHAR(50) DEFAULT 'pending',
    waktu_mulai TIMESTAMP WITH TIME ZONE,
    waktu_selesai TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_ujian_peserta UNIQUE (ujian_id, peserta_id)
);

-- ---------------------------------------------------------------------
-- 5. TABEL PUBLIC.AUDIT_LOGS (Log Aktivitas Perubahan Akun)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id VARCHAR(100) PRIMARY KEY,
    admin_id VARCHAR(100) NOT NULL,
    admin_name VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    target_user_id VARCHAR(100) NOT NULL,
    target_user_name VARCHAR(255) NOT NULL,
    details TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);

-- ---------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ---------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kategori_soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jawaban_peserta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hasil_ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Grant RLS access untuk role authenticated & anon
DROP POLICY IF EXISTS "Allow select for users" ON public.users;
DROP POLICY IF EXISTS "Allow insert/update for users" ON public.users;
DROP POLICY IF EXISTS "Allow all for users" ON public.users;
CREATE POLICY "Allow all for users" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow select for students" ON public.students;
DROP POLICY IF EXISTS "Allow all for students" ON public.students;
CREATE POLICY "Allow all for students" ON public.students FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for payments" ON public.payments;
CREATE POLICY "Allow all for payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow select for kategori_soal" ON public.kategori_soal;
DROP POLICY IF EXISTS "Allow all for kategori_soal" ON public.kategori_soal;
CREATE POLICY "Allow all for kategori_soal" ON public.kategori_soal FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow select for soal" ON public.soal;
DROP POLICY IF EXISTS "Allow all for soal" ON public.soal;
CREATE POLICY "Allow all for soal" ON public.soal FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow select for ujian" ON public.ujian;
DROP POLICY IF EXISTS "Allow all for ujian" ON public.ujian;
CREATE POLICY "Allow all for ujian" ON public.ujian FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for jawaban_peserta" ON public.jawaban_peserta;
CREATE POLICY "Allow all for jawaban_peserta" ON public.jawaban_peserta FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for hasil_ujian" ON public.hasil_ujian;
CREATE POLICY "Allow all for hasil_ujian" ON public.hasil_ujian FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for audit_logs" ON public.audit_logs;
CREATE POLICY "Allow all for audit_logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- 6b. GRANT SCHEMA & TABLE PERMISSIONS UNTUK POSTGREST (ANON & AUTHENTICATED)
-- ---------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- Reload schema cache agar PostgREST membaca tabel-tabel baru
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- 7. DEFAULT DATA SEEDING (Kategori Soal Default)
-- ---------------------------------------------------------------------
INSERT INTO public.kategori_soal (nama_kategori, kode_kategori, persentase_bobot, keterangan)
VALUES 
    ('Tes Diagnostik Awal', 'diagnostik', 30.00, 'Evaluasi kemampuan mendasar calon murid'),
    ('Tes Pengetahuan Umum (TPU)', 'pengetahuan_umum', 40.00, 'Pengukuran logika, matematika & wawasan umum'),
    ('Tes Diniyyah & Keislaman', 'diniyyah', 30.00, 'Tes hafalan, bacaan Al-Quran & keislaman')
ON CONFLICT (kode_kategori) DO NOTHING;
