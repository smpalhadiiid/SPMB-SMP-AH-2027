-- =====================================================================
-- 011_class_quotas_schema_and_policies.sql
-- Integrasi Tabel Relasional Kuota Kelas (Single Source of Truth)
-- SPMB SMP Al-Hadiid Cileungsi
-- =====================================================================

-- 1. PASTIKAN TABEL RELASIONAL public.class_quotas ADA
CREATE TABLE IF NOT EXISTS public.class_quotas (
    id VARCHAR(100) PRIMARY KEY,
    academic_year VARCHAR(50) DEFAULT '2027/2028' NOT NULL,
    level VARCHAR(50) DEFAULT 'Kelas 7' NOT NULL,
    class_name VARCHAR(100) NOT NULL,
    capacity INTEGER DEFAULT 32 NOT NULL,
    filled INTEGER DEFAULT 0 NOT NULL,
    homeroom_teacher VARCHAR(255) DEFAULT 'Pengajar Al-Hadiid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pastikan kolom updated_at ada jika tabel dibuat sebelumnya tanpa kolom tersebut
ALTER TABLE public.class_quotas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Buat index untuk pencarian cepat
CREATE INDEX IF NOT EXISTS idx_class_quotas_level ON public.class_quotas(level);
CREATE INDEX IF NOT EXISTS idx_class_quotas_academic_year ON public.class_quotas(academic_year);
CREATE INDEX IF NOT EXISTS idx_class_quotas_class_name ON public.class_quotas(class_name);

-- 2. AKTIFKAN ROW LEVEL SECURITY (RLS) & IZIN AKSES (POLICIES)
ALTER TABLE public.class_quotas ENABLE ROW LEVEL SECURITY;

-- Izinkan SELECT untuk semua (publik, calon murid, dan admin perlu melihat kapasitas kuota kelas)
DROP POLICY IF EXISTS "Allow select for class_quotas" ON public.class_quotas;
DROP POLICY IF EXISTS "Allow all for class_quotas" ON public.class_quotas;

CREATE POLICY "Allow all for class_quotas" ON public.class_quotas 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 3. BERIKAN PERMISSION KEPADA anon, authenticated, & service_role
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.class_quotas TO anon, authenticated, service_role;

-- 4. MIGRASIKAN DATA DARI spmb_app_state JIKA TABEL MASIH KOSONG
DO $$
DECLARE
    v_count integer;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.class_quotas;
    
    IF v_count = 0 THEN
        -- Coba ambil dari spmb_app_state jika ada
        IF EXISTS (SELECT 1 FROM public.spmb_app_state WHERE key = 'class_quotas') THEN
            INSERT INTO public.class_quotas (id, academic_year, level, class_name, capacity, filled, homeroom_teacher, created_at)
            SELECT
                COALESCE(elem->>'id', 'q_' || floor(random() * 1000)::text),
                COALESCE(elem->>'academicYear', '2027/2028'),
                COALESCE(elem->>'level', 'Kelas 7'),
                COALESCE(elem->>'className', 'Kelas 7 A'),
                COALESCE((elem->>'capacity')::integer, 32),
                COALESCE((elem->>'filled')::integer, 0),
                COALESCE(elem->>'homeroomTeacher', 'Ustadz Ahmad Fauzi, S.Pd.I.'),
                NOW()
            FROM public.spmb_app_state,
                 jsonb_array_elements(payload) AS elem
            WHERE key = 'class_quotas'
              AND jsonb_typeof(payload) = 'array'
            ON CONFLICT (id) DO NOTHING;
        END IF;

        -- Jika masih kosong setelah cek spmb_app_state, masukkan data kuota kelas resmi SMP Al-Hadiid
        SELECT COUNT(*) INTO v_count FROM public.class_quotas;
        IF v_count = 0 THEN
            INSERT INTO public.class_quotas (id, academic_year, level, class_name, capacity, filled, homeroom_teacher, created_at)
            VALUES 
                ('q1', '2027/2028', 'Kelas 7', '7 A (Tahfizh Unggulan)', 32, 0, 'Ustadz Ahmad Fauzi, S.Pd.I.', NOW()),
                ('q2', '2027/2028', 'Kelas 7', '7 B (Sains & Digital)', 32, 0, 'Ibu Nuraeni, S.Si.', NOW()),
                ('q3', '2027/2028', 'Kelas 7', '7 C (Bilingual & International)', 32, 0, 'Ustadz Rizky Syahputra, M.Pd.', NOW()),
                ('q4', '2027/2028', 'Kelas 7', '7 D (Reguler Rabbani)', 32, 0, 'Ibu Fitri Handayani, S.Pd.', NOW())
            ON CONFLICT (id) DO NOTHING;
        END IF;
    END IF;
END $$;

-- 5. REFRESH POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
