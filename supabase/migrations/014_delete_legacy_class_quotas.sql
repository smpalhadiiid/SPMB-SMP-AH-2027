-- =====================================================================
-- 014_delete_legacy_class_quotas.sql
-- Penghapusan Baris Kuota Lama:
-- 7 A (Tahfizh Unggulan), 7 B (Sains & Digital), 7 C (Bilingual & International), 7 D (Reguler Rabbani)
-- Sesuai revisi database SPMB SMPS Al-Hadiid Cileungsi
-- =====================================================================

DELETE FROM public.class_quotas 
WHERE class_name IN (
    '7 A (Tahfizh Unggulan)',
    '7 B (Sains & Digital)',
    '7 C (Bilingual & International)',
    '7 D (Reguler Rabbani)'
) OR id IN ('q1', 'q2', 'q3', 'q4');

-- Bersihkan juga dari spmb_app_state jika ada
UPDATE public.spmb_app_state
SET payload = (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM jsonb_array_elements(payload) AS elem
    WHERE (elem->>'id') NOT IN ('q1', 'q2', 'q3', 'q4')
      AND (elem->>'className') NOT IN (
        '7 A (Tahfizh Unggulan)',
        '7 B (Sains & Digital)',
        '7 C (Bilingual & International)',
        '7 D (Reguler Rabbani)'
      )
      AND (elem->>'class_name') NOT IN (
        '7 A (Tahfizh Unggulan)',
        '7 B (Sains & Digital)',
        '7 C (Bilingual & International)',
        '7 D (Reguler Rabbani)'
      )
), updated_at = NOW()
WHERE key = 'class_quotas' AND jsonb_typeof(payload) = 'array';

NOTIFY pgrst, 'reload schema';
