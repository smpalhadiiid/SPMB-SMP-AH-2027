-- =====================================================================
-- 015_cbt_tables_column_alignment.sql
-- Penyelarasan Kolom Tabel CBT Supabase & Perbaikan ERROR 42703 (ujian_id does not exist)
-- Memastikan kolom ujian_id dan struktur relasional tersedia di seluruh tabel CBT
-- =====================================================================

-- Aktifkan ekstensi UUID jika belum aktif
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. TABEL UJIAN (public.ujian)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ujian (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS nama_ujian VARCHAR(150) NOT NULL DEFAULT 'Ujian Seleksi SPMB Online';
ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS judul_ujian VARCHAR(255);
ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS deskripsi TEXT;
ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS gelombang VARCHAR(50) NOT NULL DEFAULT 'Gelombang 1';
ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS tanggal DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS jam_mulai TIME NOT NULL DEFAULT '08:00:00';
ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS durasi INTEGER NOT NULL DEFAULT 90;
ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS durasi_menit INTEGER NOT NULL DEFAULT 90;
ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'aktif';
ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS jumlah_diagnostik INTEGER NOT NULL DEFAULT 10;
ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS jumlah_tpu INTEGER NOT NULL DEFAULT 10;
ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS jumlah_diniyyah INTEGER NOT NULL DEFAULT 10;
ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS batas_kelulusan NUMERIC(5,2) NOT NULL DEFAULT 70.00;
ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS passing_grade NUMERIC(5,2) NOT NULL DEFAULT 70.00;
ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS aktif BOOLEAN NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------
-- 2. TABEL SOAL (public.soal)
-- Menjamin kolom ujian_id dan kolom penunjang tersedia (Solusi Error 42703)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.soal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.soal ADD COLUMN IF NOT EXISTS ujian_id UUID;
ALTER TABLE public.soal ADD COLUMN IF NOT EXISTS nomor INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.soal ADD COLUMN IF NOT EXISTS kategori VARCHAR(50) NOT NULL DEFAULT 'diagnostik';
ALTER TABLE public.soal ADD COLUMN IF NOT EXISTS kategori_kode VARCHAR(50);
ALTER TABLE public.soal ADD COLUMN IF NOT EXISTS kategori_id UUID;
ALTER TABLE public.soal ADD COLUMN IF NOT EXISTS pertanyaan TEXT;
ALTER TABLE public.soal ADD COLUMN IF NOT EXISTS pilihan_a TEXT;
ALTER TABLE public.soal ADD COLUMN IF NOT EXISTS pilihan_b TEXT;
ALTER TABLE public.soal ADD COLUMN IF NOT EXISTS pilihan_c TEXT;
ALTER TABLE public.soal ADD COLUMN IF NOT EXISTS pilihan_d TEXT;
ALTER TABLE public.soal ADD COLUMN IF NOT EXISTS kunci_jawaban VARCHAR(5) DEFAULT 'A';
ALTER TABLE public.soal ADD COLUMN IF NOT EXISTS jawaban_benar VARCHAR(5) DEFAULT 'A';
ALTER TABLE public.soal ADD COLUMN IF NOT EXISTS bobot NUMERIC(5,2) NOT NULL DEFAULT 10.00;
ALTER TABLE public.soal ADD COLUMN IF NOT EXISTS level_kesulitan VARCHAR(20) DEFAULT 'medium';
ALTER TABLE public.soal ADD COLUMN IF NOT EXISTS gambar_url TEXT;
ALTER TABLE public.soal ADD COLUMN IF NOT EXISTS aktif BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.soal ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Buat indeks pada public.soal setelah kolom dipastikan ada
CREATE INDEX IF NOT EXISTS idx_soal_ujian_id ON public.soal(ujian_id);
CREATE INDEX IF NOT EXISTS idx_soal_kategori ON public.soal(kategori);
CREATE INDEX IF NOT EXISTS idx_soal_nomor ON public.soal(nomor);

-- ---------------------------------------------------------------------
-- 3. TABEL MAPPING UJIAN & SOAL (public.ujian_soal)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ujian_soal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.ujian_soal ADD COLUMN IF NOT EXISTS ujian_id UUID;
ALTER TABLE public.ujian_soal ADD COLUMN IF NOT EXISTS soal_id UUID;
ALTER TABLE public.ujian_soal ADD COLUMN IF NOT EXISTS urutan INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_ujian_soal_ujian_id ON public.ujian_soal(ujian_id);
CREATE INDEX IF NOT EXISTS idx_ujian_soal_soal_id ON public.ujian_soal(soal_id);

-- ---------------------------------------------------------------------
-- 4. TABEL JAWABAN PESERTA (public.jawaban_peserta)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jawaban_peserta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.jawaban_peserta ADD COLUMN IF NOT EXISTS ujian_id UUID;
ALTER TABLE public.jawaban_peserta ADD COLUMN IF NOT EXISTS peserta_id VARCHAR(100);
ALTER TABLE public.jawaban_peserta ADD COLUMN IF NOT EXISTS soal_id UUID;
ALTER TABLE public.jawaban_peserta ADD COLUMN IF NOT EXISTS jawaban_dipilih VARCHAR(5);
ALTER TABLE public.jawaban_peserta ADD COLUMN IF NOT EXISTS is_ragu BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_jawaban_peserta_ujian ON public.jawaban_peserta(ujian_id);
CREATE INDEX IF NOT EXISTS idx_jawaban_peserta_peserta ON public.jawaban_peserta(peserta_id);
CREATE INDEX IF NOT EXISTS idx_jawaban_peserta_soal ON public.jawaban_peserta(soal_id);

-- ---------------------------------------------------------------------
-- 5. TABEL HASIL UJIAN (public.hasil_ujian)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hasil_ujian (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.hasil_ujian ADD COLUMN IF NOT EXISTS ujian_id UUID;
ALTER TABLE public.hasil_ujian ADD COLUMN IF NOT EXISTS peserta_id VARCHAR(100);
ALTER TABLE public.hasil_ujian ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100);
ALTER TABLE public.hasil_ujian ADD COLUMN IF NOT EXISTS nama_peserta VARCHAR(255);
ALTER TABLE public.hasil_ujian ADD COLUMN IF NOT EXISTS nilai_diagnostik NUMERIC(5,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.hasil_ujian ADD COLUMN IF NOT EXISTS nilai_tpu NUMERIC(5,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.hasil_ujian ADD COLUMN IF NOT EXISTS nilai_diniyyah NUMERIC(5,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.hasil_ujian ADD COLUMN IF NOT EXISTS nilai_akhir NUMERIC(5,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.hasil_ujian ADD COLUMN IF NOT EXISTS nilai_total NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE public.hasil_ujian ADD COLUMN IF NOT EXISTS status_kelulusan VARCHAR(50) NOT NULL DEFAULT 'BELUM LULUS';
ALTER TABLE public.hasil_ujian ADD COLUMN IF NOT EXISTS ranking INTEGER;
ALTER TABLE public.hasil_ujian ADD COLUMN IF NOT EXISTS waktu_mulai TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.hasil_ujian ADD COLUMN IF NOT EXISTS waktu_selesai TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.hasil_ujian ADD COLUMN IF NOT EXISTS tanggal_ujian TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.hasil_ujian ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_hasil_ujian_ujian ON public.hasil_ujian(ujian_id);
CREATE INDEX IF NOT EXISTS idx_hasil_ujian_peserta ON public.hasil_ujian(peserta_id);
CREATE INDEX IF NOT EXISTS idx_hasil_ujian_status ON public.hasil_ujian(status_kelulusan);
CREATE INDEX IF NOT EXISTS idx_hasil_ujian_nilai_akhir ON public.hasil_ujian(nilai_akhir DESC);

-- ---------------------------------------------------------------------
-- 6. TABEL LOG UJIAN (public.log_ujian)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.log_ujian (
    id VARCHAR(150) PRIMARY KEY,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.log_ujian ADD COLUMN IF NOT EXISTS ujian_id UUID;
ALTER TABLE public.log_ujian ADD COLUMN IF NOT EXISTS peserta_id VARCHAR(100);
ALTER TABLE public.log_ujian ADD COLUMN IF NOT EXISTS nama_peserta VARCHAR(150);
ALTER TABLE public.log_ujian ADD COLUMN IF NOT EXISTS nomor_soal_terakhir INTEGER DEFAULT 1;
ALTER TABLE public.log_ujian ADD COLUMN IF NOT EXISTS sisa_waktu INTEGER DEFAULT 5400;
ALTER TABLE public.log_ujian ADD COLUMN IF NOT EXISTS sisa_waktu_detik INTEGER DEFAULT 5400;
ALTER TABLE public.log_ujian ADD COLUMN IF NOT EXISTS status_online VARCHAR(30) DEFAULT 'ONLINE';
ALTER TABLE public.log_ujian ADD COLUMN IF NOT EXISTS is_submitted BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_log_ujian_peserta ON public.log_ujian(peserta_id);
CREATE INDEX IF NOT EXISTS idx_log_ujian_status ON public.log_ujian(status_online);

-- ---------------------------------------------------------------------
-- 7. TABEL STATE APLIKASI & REALTIME SSOT (public.spmb_app_state)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spmb_app_state (
    key VARCHAR(150) PRIMARY KEY,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ---------------------------------------------------------------------
-- 8. KOLOM CBT PADA TABEL STUDENTS (public.students)
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='is_test_active') THEN
        ALTER TABLE public.students ADD COLUMN is_test_active BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='test_submitted') THEN
        ALTER TABLE public.students ADD COLUMN test_submitted BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='diagnostic_score') THEN
        ALTER TABLE public.students ADD COLUMN diagnostic_score NUMERIC(5,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='general_score') THEN
        ALTER TABLE public.students ADD COLUMN general_score NUMERIC(5,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='religious_score') THEN
        ALTER TABLE public.students ADD COLUMN religious_score NUMERIC(5,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='final_score') THEN
        ALTER TABLE public.students ADD COLUMN final_score NUMERIC(5,2);
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) & POLICY PERMISIF
-- ---------------------------------------------------------------------
ALTER TABLE public.ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ujian_soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jawaban_peserta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hasil_ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spmb_app_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to ujian" ON public.ujian;
CREATE POLICY "Allow all access to ujian" ON public.ujian FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to soal" ON public.soal;
CREATE POLICY "Allow all access to soal" ON public.soal FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to ujian_soal" ON public.ujian_soal;
CREATE POLICY "Allow all access to ujian_soal" ON public.ujian_soal FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to jawaban_peserta" ON public.jawaban_peserta;
CREATE POLICY "Allow all access to jawaban_peserta" ON public.jawaban_peserta FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to hasil_ujian" ON public.hasil_ujian;
CREATE POLICY "Allow all access to hasil_ujian" ON public.hasil_ujian FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to log_ujian" ON public.log_ujian;
CREATE POLICY "Allow all access to log_ujian" ON public.log_ujian FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to spmb_app_state" ON public.spmb_app_state;
CREATE POLICY "Allow all access to spmb_app_state" ON public.spmb_app_state FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to students" ON public.students;
CREATE POLICY "Allow all access to students" ON public.students FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- 10. GRANT PERMISSIONS
-- ---------------------------------------------------------------------
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 11. SUPABASE REALTIME REPLICATION
-- ---------------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.jawaban_peserta;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.hasil_ujian;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.log_ujian;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.spmb_app_state;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

-- ---------------------------------------------------------------------
-- 12. SEED DEFAULT JADWAL UJIAN AKTIF
-- ---------------------------------------------------------------------
INSERT INTO public.ujian (id, nama_ujian, gelombang, tanggal, jam_mulai, durasi, status, jumlah_diagnostik, jumlah_tpu, jumlah_diniyyah, batas_kelulusan, aktif)
VALUES (
    '7c690ee0-7321-4604-a05d-ea664019bcfc',
    'Ujian Seleksi SPMB Online',
    'Gelombang 1',
    CURRENT_DATE,
    '08:00:00',
    90,
    'aktif',
    10,
    10,
    10,
    70.00,
    true
)
ON CONFLICT (id) DO UPDATE SET
    status = 'aktif',
    aktif = true,
    updated_at = timezone('utc'::text, now());
