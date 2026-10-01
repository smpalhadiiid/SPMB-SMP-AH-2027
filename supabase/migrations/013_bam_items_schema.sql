-- =====================================================================
-- 013_bam_items_schema.sql
-- Struktur Tabel Resmi Biaya Awal Masuk (BAM) Terpisah Ikhwan & Akhwat
-- SPMB SMPS Al-Hadiid Cileungsi
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.bam_items (
    id VARCHAR(100) PRIMARY KEY,
    gender VARCHAR(20) NOT NULL CHECK (gender IN ('ikhwan', 'akhwat')),
    nama_item VARCHAR(255) NOT NULL,
    nominal NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (nominal >= 0),
    urutan INTEGER NOT NULL DEFAULT 1,
    aktif BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indeks performa pencarian gender dan pengurutan
CREATE INDEX IF NOT EXISTS idx_bam_items_gender ON public.bam_items(gender);
CREATE INDEX IF NOT EXISTS idx_bam_items_urutan ON public.bam_items(gender, urutan ASC);
CREATE INDEX IF NOT EXISTS idx_bam_items_aktif ON public.bam_items(aktif);

-- Trigger auto updated_at
DROP TRIGGER IF EXISTS trg_bam_items_updated_at ON public.bam_items;
CREATE TRIGGER trg_bam_items_updated_at
BEFORE UPDATE ON public.bam_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE public.bam_items ENABLE ROW LEVEL SECURITY;

-- Kebijakan Akses: Publik dapat melihat item aktif, Panitia/Admin dapat mengelola penuh
DROP POLICY IF EXISTS "Public can view active bam_items" ON public.bam_items;
CREATE POLICY "Public can view active bam_items" ON public.bam_items
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Panitia and authenticated users can insert bam_items" ON public.bam_items;
CREATE POLICY "Panitia and authenticated users can insert bam_items" ON public.bam_items
    FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Panitia and authenticated users can update bam_items" ON public.bam_items;
CREATE POLICY "Panitia and authenticated users can update bam_items" ON public.bam_items
    FOR UPDATE
    USING (true);

DROP POLICY IF EXISTS "Panitia and authenticated users can delete bam_items" ON public.bam_items;
CREATE POLICY "Panitia and authenticated users can delete bam_items" ON public.bam_items
    FOR DELETE
    USING (true);

-- Seed Data Awal Resmi BAM (Ikhwan & Akhwat) jika tabel masih kosong
INSERT INTO public.bam_items (id, gender, nama_item, nominal, urutan, aktif)
VALUES
    -- IKHWAN
    ('bam_ikhwan_1', 'ikhwan', 'Dana Pengembangan Sarana & Prasarana', 4500000, 1, true),
    ('bam_ikhwan_2', 'ikhwan', 'Paket Seragam Lengkap Ikhwan (5 Stel)', 1500000, 2, true),
    ('bam_ikhwan_3', 'ikhwan', 'Buku Paket & Modul Pembelajaran (1 Tahun)', 1600000, 3, true),
    ('bam_ikhwan_4', 'ikhwan', 'Kegiatan MPLS & Orientasi Santri Rabbani', 500000, 4, true),
    ('bam_ikhwan_5', 'ikhwan', 'Ekstrakurikuler Wajib & Pilihan (1 Tahun)', 600000, 5, true),
    ('bam_ikhwan_6', 'ikhwan', 'SPP Bulan Pertama (Juli)', 800000, 6, true),
    ('bam_ikhwan_7', 'ikhwan', 'Kegiatan Kesiswaan, Kepesantrenan & Dauroh Qur''an', 1500000, 7, true),

    -- AKHWAT (Perbedaan spesifik paket seragam/jilbab/gamis & keputrian)
    ('bam_akhwat_1', 'akhwat', 'Dana Pengembangan Sarana & Prasarana', 4500000, 1, true),
    ('bam_akhwat_2', 'akhwat', 'Paket Seragam Lengkap Akhwat + Jilbab Syar''i (5 Stel)', 1720000, 2, true),
    ('bam_akhwat_3', 'akhwat', 'Buku Paket & Modul Pembelajaran (1 Tahun)', 1600000, 3, true),
    ('bam_akhwat_4', 'akhwat', 'Kegiatan MPLS & Orientasi Santri Rabbani', 500000, 4, true),
    ('bam_akhwat_5', 'akhwat', 'Ekstrakurikuler Wajib & Keputrian (1 Tahun)', 600000, 5, true),
    ('bam_akhwat_6', 'akhwat', 'SPP Bulan Pertama (Juli)', 800000, 6, true),
    ('bam_akhwat_7', 'akhwat', 'Kegiatan Keputrian, Tarbiyah & Dauroh Tahfidz', 1500000, 7, true)
ON CONFLICT (id) DO NOTHING;
