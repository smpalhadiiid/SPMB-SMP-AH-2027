-- =====================================================================
-- MIGRATION SQL SUPABASE - MODUL COMPUTER BASED TEST (CBT) SPMB
-- =====================================================================
-- Keterangan:
-- Script SQL ini menambahkan tabel-tabel baru untuk modul CBT SPMB
-- tanpa merubah atau menghapus tabel yang sudah ada (misal: 'peserta', 'users').
--
-- FITUR & DOKUMEN SCRIPT:
-- 1. CREATE TABLE (kategori_soal, soal, ujian, ujian_soal, jawaban_peserta, hasil_ujian, log_ujian)
-- 2. PRIMARY KEY (UUID gen_random_uuid())
-- 3. FOREIGN KEY (dengan CASCADE dan relasi ke peserta)
-- 4. INDEX pada seluruh Foreign Key
-- 5. UNIQUE CONSTRAINT
-- 6. CHECK CONSTRAINT (jawaban_benar IN ('A','B','C','D'), bobot > 0, dll)
-- 7. DEFAULT VALUE (aktif = true, created_at = now(), updated_at = now())
-- 8. Trigger update updated_at
-- 9. Function update_updated_at()
-- 10. Row Level Security (RLS)
-- 11. Policy Admin & Policy Peserta
-- 12. INSERT Default Kategori Soal (Diagnostik 30%, TPU 40%, Diniyyah 30%)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. FUNCTION UPDATE_UPDATED_AT()
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 1. TABEL KATEGORI_SOAL
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kategori_soal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_kategori VARCHAR(100) NOT NULL UNIQUE,
  kode_kategori VARCHAR(50) NOT NULL UNIQUE,
  persentase_bobot DECIMAL(5,2) NOT NULL DEFAULT 30.00 CHECK (persentase_bobot > 0),
  keterangan TEXT,
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_kategori_soal_updated_at ON public.kategori_soal;
CREATE TRIGGER trg_kategori_soal_updated_at
BEFORE UPDATE ON public.kategori_soal
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------
-- 2. TABEL SOAL (BANK SOAL CBT)
-- ---------------------------------------------------------------------
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_soal_updated_at ON public.soal;
CREATE TRIGGER trg_soal_updated_at
BEFORE UPDATE ON public.soal
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------
-- 3. TABEL UJIAN (JADWAL UJIAN CBT)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ujian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_ujian VARCHAR(255) NOT NULL,
  gelombang VARCHAR(100) NOT NULL DEFAULT 'Gelombang 1',
  tanggal DATE NOT NULL,
  jam_mulai TIME NOT NULL DEFAULT '08:00:00',
  durasi INT NOT NULL DEFAULT 90 CHECK (durasi > 0), -- Durasi dalam Menit
  status VARCHAR(20) NOT NULL DEFAULT 'aktif' CHECK (status IN ('draft', 'aktif', 'selesai')),
  jumlah_diagnostik INT NOT NULL DEFAULT 6 CHECK (jumlah_diagnostik >= 0),
  jumlah_tpu INT NOT NULL DEFAULT 8 CHECK (jumlah_tpu >= 0),
  jumlah_diniyyah INT NOT NULL DEFAULT 6 CHECK (jumlah_diniyyah >= 0),
  batas_kelulusan DECIMAL(5,2) DEFAULT 70.00 CHECK (batas_kelulusan >= 0),
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_ujian_updated_at ON public.ujian;
CREATE TRIGGER trg_ujian_updated_at
BEFORE UPDATE ON public.ujian
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------
-- 4. TABEL UJIAN_SOAL (MAPPING SOAL TERPILIH UTK UJIAN)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ujian_soal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ujian_id UUID NOT NULL REFERENCES public.ujian(id) ON DELETE CASCADE,
  soal_id UUID NOT NULL REFERENCES public.soal(id) ON DELETE CASCADE,
  urutan INT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT uq_ujian_soal UNIQUE(ujian_id, soal_id)
);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_ujian_soal_updated_at ON public.ujian_soal;
CREATE TRIGGER trg_ujian_soal_updated_at
BEFORE UPDATE ON public.ujian_soal
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------
-- 5. TABEL JAWABAN_PESERTA (AUTO-SAVE JAWABAN REALTIME)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jawaban_peserta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ujian_id UUID NOT NULL REFERENCES public.ujian(id) ON DELETE CASCADE,
  peserta_id UUID NOT NULL REFERENCES public.peserta(id) ON DELETE CASCADE,
  soal_id UUID NOT NULL REFERENCES public.soal(id) ON DELETE CASCADE,
  jawaban_dipilih VARCHAR(1) CHECK (jawaban_dipilih IN ('A', 'B', 'C', 'D')),
  is_ragu BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT uq_jawaban_peserta UNIQUE(ujian_id, peserta_id, soal_id)
);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_jawaban_peserta_updated_at ON public.jawaban_peserta;
CREATE TRIGGER trg_jawaban_peserta_updated_at
BEFORE UPDATE ON public.jawaban_peserta
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------
-- 6. TABEL HASIL_UJIAN (REKAP NILAI & KELULUSAN CBT)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hasil_ujian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ujian_id UUID NOT NULL REFERENCES public.ujian(id) ON DELETE CASCADE,
  peserta_id UUID NOT NULL REFERENCES public.peserta(id) ON DELETE CASCADE,
  registration_number VARCHAR(100),
  nama_peserta VARCHAR(255),
  nilai_diagnostik DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (nilai_diagnostik >= 0),
  nilai_tpu DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (nilai_tpu >= 0),
  nilai_diniyyah DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (nilai_diniyyah >= 0),
  nilai_total DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (nilai_total >= 0),
  status_kelulusan VARCHAR(50) NOT NULL DEFAULT 'BELUM LULUS',
  ranking INT,
  tanggal_ujian TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT uq_hasil_ujian UNIQUE(ujian_id, peserta_id)
);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_hasil_ujian_updated_at ON public.hasil_ujian;
CREATE TRIGGER trg_hasil_ujian_updated_at
BEFORE UPDATE ON public.hasil_ujian
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------
-- 7. TABEL LOG_UJIAN (REALTIME MONITORING UJIAN PESERTA)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.log_ujian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ujian_id UUID NOT NULL REFERENCES public.ujian(id) ON DELETE CASCADE,
  peserta_id UUID NOT NULL REFERENCES public.peserta(id) ON DELETE CASCADE,
  nomor_soal_terakhir INT DEFAULT 1,
  sisa_waktu_detik INT NOT NULL DEFAULT 5400,
  status_online VARCHAR(20) DEFAULT 'ONLINE' CHECK (status_online IN ('ONLINE', 'OFFLINE')),
  is_submitted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT uq_log_ujian UNIQUE(ujian_id, peserta_id)
);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_log_ujian_updated_at ON public.log_ujian;
CREATE TRIGGER trg_log_ujian_updated_at
BEFORE UPDATE ON public.log_ujian
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------
-- INDEX PADA SELURUH FOREIGN KEY
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_soal_kategori_kode ON public.soal(kategori_kode);

CREATE INDEX IF NOT EXISTS idx_ujian_soal_ujian_id ON public.ujian_soal(ujian_id);
CREATE INDEX IF NOT EXISTS idx_ujian_soal_soal_id ON public.ujian_soal(soal_id);

CREATE INDEX IF NOT EXISTS idx_jawaban_peserta_ujian_id ON public.jawaban_peserta(ujian_id);
CREATE INDEX IF NOT EXISTS idx_jawaban_peserta_peserta_id ON public.jawaban_peserta(peserta_id);
CREATE INDEX IF NOT EXISTS idx_jawaban_peserta_soal_id ON public.jawaban_peserta(soal_id);

CREATE INDEX IF NOT EXISTS idx_hasil_ujian_ujian_id ON public.hasil_ujian(ujian_id);
CREATE INDEX IF NOT EXISTS idx_hasil_ujian_peserta_id ON public.hasil_ujian(peserta_id);

CREATE INDEX IF NOT EXISTS idx_log_ujian_ujian_id ON public.log_ujian(ujian_id);
CREATE INDEX IF NOT EXISTS idx_log_ujian_peserta_id ON public.log_ujian(peserta_id);

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- ---------------------------------------------------------------------
ALTER TABLE public.kategori_soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ujian_soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jawaban_peserta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hasil_ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_ujian ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- POLICY ADMIN (AKSES PENUH SEMUA OPERASI)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access kategori_soal" ON public.kategori_soal;
CREATE POLICY "Admin full access kategori_soal" ON public.kategori_soal FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin full access soal" ON public.soal;
CREATE POLICY "Admin full access soal" ON public.soal FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin full access ujian" ON public.ujian;
CREATE POLICY "Admin full access ujian" ON public.ujian FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin full access ujian_soal" ON public.ujian_soal;
CREATE POLICY "Admin full access ujian_soal" ON public.ujian_soal FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin full access jawaban_peserta" ON public.jawaban_peserta;
CREATE POLICY "Admin full access jawaban_peserta" ON public.jawaban_peserta FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin full access hasil_ujian" ON public.hasil_ujian;
CREATE POLICY "Admin full access hasil_ujian" ON public.hasil_ujian FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin full access log_ujian" ON public.log_ujian;
CREATE POLICY "Admin full access log_ujian" ON public.log_ujian FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- POLICY PESERTA (BACA SOAL/UJIAN AKTIF, KELOLA JAWABAN & LOG SENDIRI)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Peserta read active kategori" ON public.kategori_soal;
CREATE POLICY "Peserta read active kategori" ON public.kategori_soal FOR SELECT USING (aktif = true);

DROP POLICY IF EXISTS "Peserta read active soal" ON public.soal;
CREATE POLICY "Peserta read active soal" ON public.soal FOR SELECT USING (aktif = true);

DROP POLICY IF EXISTS "Peserta read active ujian" ON public.ujian;
CREATE POLICY "Peserta read active ujian" ON public.ujian FOR SELECT USING (aktif = true AND status = 'aktif');

DROP POLICY IF EXISTS "Peserta read ujian_soal" ON public.ujian_soal;
CREATE POLICY "Peserta read ujian_soal" ON public.ujian_soal FOR SELECT USING (true);

DROP POLICY IF EXISTS "Peserta write jawaban" ON public.jawaban_peserta;
CREATE POLICY "Peserta write jawaban" ON public.jawaban_peserta FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Peserta write hasil" ON public.hasil_ujian;
CREATE POLICY "Peserta write hasil" ON public.hasil_ujian FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Peserta write log" ON public.log_ujian;
CREATE POLICY "Peserta write log" ON public.log_ujian FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- SEED DATA DEFAULT KATEGORI SOAL
-- ---------------------------------------------------------------------
INSERT INTO public.kategori_soal (nama_kategori, kode_kategori, persentase_bobot, keterangan, aktif)
VALUES 
  ('Tes Diagnostik', 'diagnostik', 30.00, 'Pengukuran kemampuan dasar dan bakat skolastik (30%)', true),
  ('Pengetahuan Umum', 'pengetahuan_umum', 40.00, 'Tes Pengetahuan Umum / TPU (40%)', true),
  ('Diniyyah & Agama', 'diniyyah', 30.00, 'Tes Pemahaman Diniyyah, PAI, & Kemampuan Mengaji (30%)', true)
ON CONFLICT (kode_kategori) DO UPDATE 
SET 
  nama_kategori = EXCLUDED.nama_kategori,
  persentase_bobot = EXCLUDED.persentase_bobot,
  keterangan = EXCLUDED.keterangan,
  aktif = EXCLUDED.aktif;

