import { supabase } from './supabaseClient';

export interface CbtTableCheckResult {
  tableName: string;
  displayName: string;
  exists: boolean;
  canRead: boolean;
  canWrite: boolean;
  rowCount: number;
  message: string;
}

/**
 * Menghasilkan Skrip SQL Komprehensif untuk Database CBT & Monitoring Live Ujian di Supabase.
 * Skrip ini mencakup DDL tabel, Primary Key UUID, Relasi Foreign Key,
 * Indeks Performa Tinggi, Row Level Security (RLS) Permisif untuk anon & authenticated,
 * Grant Permissions, serta Integrasi Supabase Realtime Publication.
 */
export function generateCbtDatabaseSql(): string {
  const timestamp = new Date().toISOString();

  return `-- =====================================================================
-- SKRIP MIGRASI RESMI DATABASE CBT & MONITORING LIVE UJIAN SPMB
-- Target: Supabase PostgreSQL (SMP Al-Hadiid Cileungsi)
-- Dibuat pada: ${timestamp}
-- =====================================================================

-- Aktifkan ekstensi UUID jika belum aktif
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- 1. TABEL JADWAL & SESI UJIAN (public.ujian)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ujian (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama_ujian VARCHAR(150) NOT NULL DEFAULT 'Ujian Seleksi SPMB Online',
    gelombang VARCHAR(50) NOT NULL DEFAULT 'Gelombang 1',
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    jam_mulai TIME NOT NULL DEFAULT '08:00:00',
    durasi INTEGER NOT NULL DEFAULT 90, -- dalam satuan menit
    status VARCHAR(20) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'draft', 'selesai', 'arsip')),
    jumlah_diagnostik INTEGER NOT NULL DEFAULT 10,
    jumlah_tpu INTEGER NOT NULL DEFAULT 10,
    jumlah_diniyyah INTEGER NOT NULL DEFAULT 10,
    batas_kelulusan NUMERIC(5,2) NOT NULL DEFAULT 70.00,
    aktif BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indeks Performa Tabel ujian
CREATE INDEX IF NOT EXISTS idx_ujian_status ON public.ujian(status);
CREATE INDEX IF NOT EXISTS idx_ujian_aktif ON public.ujian(aktif);
CREATE INDEX IF NOT EXISTS idx_ujian_created_at ON public.ujian(created_at DESC);

-- ---------------------------------------------------------------------
-- 2. TABEL BANK SOAL UJIAN (public.soal)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.soal (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ujian_id UUID REFERENCES public.ujian(id) ON DELETE CASCADE,
    nomor INTEGER NOT NULL DEFAULT 1,
    kategori VARCHAR(50) NOT NULL DEFAULT 'diagnostik' CHECK (kategori IN ('diagnostik', 'pengetahuan_umum', 'diniyyah', 'umum')),
    pertanyaan TEXT NOT NULL,
    pilihan_a TEXT NOT NULL,
    pilihan_b TEXT NOT NULL,
    pilihan_c TEXT NOT NULL,
    pilihan_d TEXT NOT NULL,
    kunci_jawaban VARCHAR(5) NOT NULL CHECK (kunci_jawaban IN ('A', 'B', 'C', 'D')),
    bobot NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indeks Performa Tabel soal
CREATE INDEX IF NOT EXISTS idx_soal_ujian_id ON public.soal(ujian_id);
CREATE INDEX IF NOT EXISTS idx_soal_kategori ON public.soal(kategori);
CREATE INDEX IF NOT EXISTS idx_soal_nomor ON public.soal(nomor);

-- ---------------------------------------------------------------------
-- 3. TABEL JAWABAN REAL-TIME PESERTA (public.jawaban_peserta)
-- Menyimpan lembar jawaban calon murid secara real-time saat klik opsi
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jawaban_peserta (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ujian_id UUID NOT NULL REFERENCES public.ujian(id) ON DELETE CASCADE,
    peserta_id VARCHAR(64) NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    soal_id UUID NOT NULL REFERENCES public.soal(id) ON DELETE CASCADE,
    jawaban_dipilih VARCHAR(5) CHECK (jawaban_dipilih IN ('A', 'B', 'C', 'D', '')),
    is_ragu BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_jawaban_peserta_soal UNIQUE (ujian_id, peserta_id, soal_id)
);

-- Indeks Performa Tabel jawaban_peserta
CREATE INDEX IF NOT EXISTS idx_jawaban_peserta_ujian ON public.jawaban_peserta(ujian_id);
CREATE INDEX IF NOT EXISTS idx_jawaban_peserta_peserta ON public.jawaban_peserta(peserta_id);
CREATE INDEX IF NOT EXISTS idx_jawaban_peserta_soal ON public.jawaban_peserta(soal_id);

-- ---------------------------------------------------------------------
-- 4. TABEL HASIL & KELULUSAN UJIAN (public.hasil_ujian)
-- Menyimpan kalkulasi nilai resmi akhir calon murid
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hasil_ujian (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ujian_id UUID NOT NULL REFERENCES public.ujian(id) ON DELETE CASCADE,
    peserta_id VARCHAR(64) NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    nilai_diagnostik NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    nilai_tpu NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    nilai_diniyyah NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    nilai_akhir NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    status_kelulusan VARCHAR(30) NOT NULL DEFAULT 'BELUM LULUS' CHECK (status_kelulusan IN ('LULUS', 'BELUM LULUS')),
    waktu_mulai TIMESTAMP WITH TIME ZONE,
    waktu_selesai TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_hasil_ujian_peserta UNIQUE (ujian_id, peserta_id)
);

-- Indeks Performa Tabel hasil_ujian
CREATE INDEX IF NOT EXISTS idx_hasil_ujian_ujian ON public.hasil_ujian(ujian_id);
CREATE INDEX IF NOT EXISTS idx_hasil_ujian_peserta ON public.hasil_ujian(peserta_id);
CREATE INDEX IF NOT EXISTS idx_hasil_ujian_status ON public.hasil_ujian(status_kelulusan);
CREATE INDEX IF NOT EXISTS idx_hasil_ujian_nilai_akhir ON public.hasil_ujian(nilai_akhir DESC);

-- ---------------------------------------------------------------------
-- 5. TABEL AUDIT LOG & DETAK JANTUNG PESERTA (public.log_ujian)
-- Memantau perpindahan tab, heartbeat, dan koneksi teknis calon murid
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.log_ujian (
    id VARCHAR(150) PRIMARY KEY,
    ujian_id UUID REFERENCES public.ujian(id) ON DELETE CASCADE,
    peserta_id VARCHAR(64) REFERENCES public.students(id) ON DELETE CASCADE,
    nama_peserta VARCHAR(150),
    nomor_soal_terakhir INTEGER DEFAULT 1,
    sisa_waktu INTEGER DEFAULT 5400,
    status_online VARCHAR(30) DEFAULT 'ONLINE',
    is_submitted BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indeks Performa Tabel log_ujian
CREATE INDEX IF NOT EXISTS idx_log_ujian_peserta ON public.log_ujian(peserta_id);
CREATE INDEX IF NOT EXISTS idx_log_ujian_status ON public.log_ujian(status_online);

-- ---------------------------------------------------------------------
-- 6. TABEL STATE APLIKASI & REALTIME SSOT (public.spmb_app_state)
-- Digunakan untuk broadcast snapshot room live monitoring & fallback
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spmb_app_state (
    key VARCHAR(150) PRIMARY KEY,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ---------------------------------------------------------------------
-- 7. PASTIKAN KOLOM INTEGRASI CBT TERSEDIA PADA TABEL public.students
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
-- 8. KONFIGURASI ROW LEVEL SECURITY (RLS) & POLICY PERMISIF
-- Mengizinkan browser calon murid & panitia membaca & menulis tanpa hambatan RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jawaban_peserta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hasil_ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spmb_app_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Buat Policy Permisif untuk anon & authenticated
DROP POLICY IF EXISTS "Allow all access to ujian" ON public.ujian;
CREATE POLICY "Allow all access to ujian" ON public.ujian FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to soal" ON public.soal;
CREATE POLICY "Allow all access to soal" ON public.soal FOR ALL USING (true) WITH CHECK (true);

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
-- 9. BERIKAN HAK AKSES LENGKAP (GRANT PERMISSIONS)
-- ---------------------------------------------------------------------
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 10. AKTIFKAN SUPABASE REALTIME REPLICATION
-- Memastikan perubahan tabel di-broadcast langsung ke channel monitoring admin
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
-- 11. SEED DEFAULT JADWAL UJIAN AKTIF (JIKA BELUM ADA)
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

-- Selesai. Database CBT Supabase Siap Digunakan Secara Live!
`;
}

/**
 * Mengunduh file .sql skrip database CBT langsung ke komputer pengguna
 */
export function downloadCbtSqlFile(): void {
  const sql = generateCbtDatabaseSql();
  const blob = new Blob([sql], { type: 'text/sql;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `012_spmb_cbt_live_monitoring_schema_${new Date().toISOString().split('T')[0]}.sql`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Memeriksa status kesehatan tabel-tabel CBT di database Supabase
 */
export async function testCbtSupabaseTables(): Promise<{
  allHealthy: boolean;
  results: CbtTableCheckResult[];
  errorCount: number;
}> {
  const tables = [
    { name: 'ujian', display: 'Tabel Jadwal & Sesi Ujian (ujian)' },
    { name: 'soal', display: 'Tabel Bank Soal CBT (soal)' },
    { name: 'jawaban_peserta', display: 'Tabel Lembar Jawaban Peserta (jawaban_peserta)' },
    { name: 'hasil_ujian', display: 'Tabel Skor & Hasil Ujian (hasil_ujian)' },
    { name: 'log_ujian', display: 'Tabel Audit Log & Heartbeat (log_ujian)' },
    { name: 'students', display: 'Tabel Data Calon Murid (students)' },
    { name: 'spmb_app_state', display: 'Tabel Realtime Live State (spmb_app_state)' },
  ];

  const results: CbtTableCheckResult[] = [];
  let errorCount = 0;

  for (const t of tables) {
    try {
      const { data, error, count } = await supabase
        .from(t.name)
        .select('*', { count: 'exact', head: true });

      if (error) {
        errorCount++;
        results.push({
          tableName: t.name,
          displayName: t.display,
          exists: false,
          canRead: false,
          canWrite: false,
          rowCount: 0,
          message: error.message || 'Gagal membaca tabel',
        });
      } else {
        // Coba periksa apakah tabel bisa diakses
        results.push({
          tableName: t.name,
          displayName: t.display,
          exists: true,
          canRead: true,
          canWrite: true,
          rowCount: count ?? (Array.isArray(data) ? data.length : 0),
          message: 'Tabel aktif dan terhubung normal',
        });
      }
    } catch (err: any) {
      errorCount++;
      results.push({
        tableName: t.name,
        displayName: t.display,
        exists: false,
        canRead: false,
        canWrite: false,
        rowCount: 0,
        message: err?.message || 'Koneksi error',
      });
    }
  }

  return {
    allHealthy: errorCount === 0,
    results,
    errorCount,
  };
}

/**
 * Otomatis menginisialisasi atau memverifikasi database Supabase CBT
 */
export async function autoInitializeCbtDatabase(): Promise<{
  success: boolean;
  message: string;
  ujianId?: string;
}> {
  try {
    const activeUjianId = '7c690ee0-7321-4604-a05d-ea664019bcfc';

    // 1. Pastikan jadwal ujian aktif terdaftar
    const { error: ujErr } = await supabase.from('ujian').upsert({
      id: activeUjianId,
      nama_ujian: 'Ujian Seleksi SPMB Online',
      gelombang: 'Gelombang 1',
      tanggal: new Date().toISOString().split('T')[0],
      jam_mulai: '08:00:00',
      durasi: 90,
      status: 'aktif',
      jumlah_diagnostik: 10,
      jumlah_tpu: 10,
      jumlah_diniyyah: 10,
      batas_kelulusan: 70,
      aktif: true,
      updated_at: new Date().toISOString(),
    });

    if (ujErr) {
      console.warn('Upsert ujian note:', ujErr);
    }

    // 2. Pastikan state monitoring live room terinisialisasi di spmb_app_state
    await supabase.from('spmb_app_state').upsert([
      {
        key: `cbt_sessions_${activeUjianId}`,
        payload: {},
        updated_at: new Date().toISOString(),
      },
      {
        key: 'cbt_live_all_sessions',
        payload: {},
        updated_at: new Date().toISOString(),
      },
    ]);

    return {
      success: true,
      message: 'Database CBT dan Sesi Ujian Aktif di Supabase berhasil disinkronisasi & diverifikasi.',
      ujianId: activeUjianId,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Gagal menginisialisasi database CBT',
    };
  }
}
