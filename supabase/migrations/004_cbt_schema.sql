-- =====================================================================
-- 004_cbt_schema.sql
-- Computer-Based Test (CBT) Schema
-- Peserta referensi TUNGGAL dan KONSISTEN ke public.students(id)
-- =====================================================================

-- 1. KATEGORI SOAL
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

DROP TRIGGER IF EXISTS trg_kategori_soal_updated_at ON public.kategori_soal;
CREATE TRIGGER trg_kategori_soal_updated_at
BEFORE UPDATE ON public.kategori_soal
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. BANK SOAL
CREATE TABLE IF NOT EXISTS public.soal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kategori_id UUID NOT NULL REFERENCES public.kategori_soal(id) ON DELETE CASCADE,
    pertanyaan TEXT NOT NULL,
    pilihan_a TEXT NOT NULL,
    pilihan_b TEXT NOT NULL,
    pilihan_c TEXT NOT NULL,
    pilihan_d TEXT NOT NULL,
    jawaban_benar VARCHAR(1) NOT NULL CHECK (jawaban_benar IN ('A', 'B', 'C', 'D')),
    bobot DECIMAL(5,2) NOT NULL DEFAULT 1.00 CHECK (bobot > 0),
    gambar_url TEXT,
    aktif BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_soal_kategori_id ON public.soal(kategori_id);

DROP TRIGGER IF EXISTS trg_soal_updated_at ON public.soal;
CREATE TRIGGER trg_soal_updated_at
BEFORE UPDATE ON public.soal
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. JADWAL / SESI UJIAN
CREATE TABLE IF NOT EXISTS public.ujian (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    judul_ujian VARCHAR(255) NOT NULL,
    deskripsi TEXT,
    durasi_menit INT NOT NULL DEFAULT 60 CHECK (durasi_menit > 0),
    waktu_mulai TIMESTAMP WITH TIME ZONE,
    waktu_selesai TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'ongoing', 'completed')),
    passing_grade DECIMAL(5,2) NOT NULL DEFAULT 70.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS trg_ujian_updated_at ON public.ujian;
CREATE TRIGGER trg_ujian_updated_at
BEFORE UPDATE ON public.ujian
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4. RELASI UJIAN KE SOAL
CREATE TABLE IF NOT EXISTS public.ujian_soal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ujian_id UUID NOT NULL REFERENCES public.ujian(id) ON DELETE CASCADE,
    soal_id UUID NOT NULL REFERENCES public.soal(id) ON DELETE CASCADE,
    urutan INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_ujian_soal UNIQUE (ujian_id, soal_id)
);

CREATE INDEX IF NOT EXISTS idx_ujian_soal_ujian ON public.ujian_soal(ujian_id);

-- 5. JAWABAN PESERTA (REALTIME & SECURE)
-- Referensi peserta_id strictly merujuk ke public.students(id)
CREATE TABLE IF NOT EXISTS public.jawaban_peserta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ujian_id UUID NOT NULL REFERENCES public.ujian(id) ON DELETE CASCADE,
    peserta_id VARCHAR(100) NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    soal_id UUID NOT NULL REFERENCES public.soal(id) ON DELETE CASCADE,
    jawaban_dipilih VARCHAR(1) CHECK (jawaban_dipilih IN ('A', 'B', 'C', 'D')),
    is_ragu BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_jawaban_peserta UNIQUE (ujian_id, peserta_id, soal_id)
);

CREATE INDEX IF NOT EXISTS idx_jawaban_peserta_lookup ON public.jawaban_peserta(ujian_id, peserta_id);

DROP TRIGGER IF EXISTS trg_jawaban_peserta_updated_at ON public.jawaban_peserta;
CREATE TRIGGER trg_jawaban_peserta_updated_at
BEFORE UPDATE ON public.jawaban_peserta
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 6. HASIL REKAP UJIAN
-- Referensi peserta_id strictly merujuk ke public.students(id)
CREATE TABLE IF NOT EXISTS public.hasil_ujian (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ujian_id UUID NOT NULL REFERENCES public.ujian(id) ON DELETE CASCADE,
    peserta_id VARCHAR(100) NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    nilai_diagnostik DECIMAL(5,2) DEFAULT 0.00 CHECK (nilai_diagnostik >= 0),
    nilai_tpu DECIMAL(5,2) DEFAULT 0.00 CHECK (nilai_tpu >= 0),
    nilai_diniyyah DECIMAL(5,2) DEFAULT 0.00 CHECK (nilai_diniyyah >= 0),
    nilai_akhir DECIMAL(5,2) DEFAULT 0.00 CHECK (nilai_akhir >= 0),
    status_kelulusan VARCHAR(50) DEFAULT 'BELUM LULUS',
    waktu_mulai TIMESTAMP WITH TIME ZONE,
    waktu_selesai TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_hasil_ujian UNIQUE (ujian_id, peserta_id)
);

CREATE INDEX IF NOT EXISTS idx_hasil_ujian_lookup ON public.hasil_ujian(ujian_id, peserta_id);

DROP TRIGGER IF EXISTS trg_hasil_ujian_updated_at ON public.hasil_ujian;
CREATE TRIGGER trg_hasil_ujian_updated_at
BEFORE UPDATE ON public.hasil_ujian
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
