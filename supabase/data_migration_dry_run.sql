-- =====================================================================
-- data_migration_dry_run.sql
-- Dry-Run Script: Identifikasi Data Transaksional yang Hanya Ada di spmb_app_state
-- Dijalankan sebelum menghapus key 'students'/'users_db' dari spmb_app_state
-- =====================================================================

DO $$
DECLARE
    v_json_students_count int := 0;
    v_rel_students_count int := 0;
    v_orphaned_students int := 0;
    v_json_users_count int := 0;
    v_rel_users_count int := 0;
    v_orphaned_users int := 0;
BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'DRY-RUN PEMERIKSAAN DATA TRANSIONAL SPMB_APP_STATE';
    RAISE NOTICE '=======================================================';

    -- 1. Periksa Data Siswa di JSON vs Relasional
    IF EXISTS (SELECT 1 FROM public.spmb_app_state WHERE key = 'students') THEN
        SELECT jsonb_array_length(payload) INTO v_json_students_count
        FROM public.spmb_app_state WHERE key = 'students';
    END IF;

    SELECT COUNT(*) INTO v_rel_students_count FROM public.students;

    -- Hitung siswa di JSON yang BELUM ADA di tabel relasional
    IF v_json_students_count > 0 THEN
        SELECT COUNT(*) INTO v_orphaned_students
        FROM (
            SELECT elem->>'id' AS student_id
            FROM public.spmb_app_state,
                 jsonb_array_elements(payload) AS elem
            WHERE key = 'students'
        ) json_s
        WHERE NOT EXISTS (
            SELECT 1 FROM public.students s WHERE s.id = json_s.student_id
        );
    END IF;

    RAISE NOTICE '[Siswa] Total di spmb_app_state (JSON) : %', v_json_students_count;
    RAISE NOTICE '[Siswa] Total di public.students (Rel) : %', v_rel_students_count;
    RAISE NOTICE '[Siswa] Siswa HANYA di JSON (Belum migrasi) : %', v_orphaned_students;

    -- 2. Periksa Data Pengguna di JSON vs Relasional
    IF EXISTS (SELECT 1 FROM public.spmb_app_state WHERE key = 'users_db') THEN
        SELECT jsonb_array_length(payload) INTO v_json_users_count
        FROM public.spmb_app_state WHERE key = 'users_db';
    ELSIF EXISTS (SELECT 1 FROM public.spmb_app_state WHERE key = 'users') THEN
        SELECT jsonb_array_length(payload) INTO v_json_users_count
        FROM public.spmb_app_state WHERE key = 'users';
    END IF;

    SELECT COUNT(*) INTO v_rel_users_count FROM public.users;

    IF v_json_users_count > 0 THEN
        SELECT COUNT(*) INTO v_orphaned_users
        FROM (
            SELECT elem->>'id' AS user_id, elem->>'email' AS user_email
            FROM public.spmb_app_state,
                 jsonb_array_elements(payload) AS elem
            WHERE key IN ('users_db', 'users')
        ) json_u
        WHERE NOT EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = json_u.user_id OR LOWER(u.email) = LOWER(json_u.user_email)
        );
    END IF;

    RAISE NOTICE '[Pengguna] Total di spmb_app_state (JSON) : %', v_json_users_count;
    RAISE NOTICE '[Pengguna] Total di public.users (Rel)    : %', v_rel_users_count;
    RAISE NOTICE '[Pengguna] Pengguna HANYA di JSON        : %', v_orphaned_users;

    RAISE NOTICE '-------------------------------------------------------';
    IF v_orphaned_students > 0 OR v_orphaned_users > 0 THEN
        RAISE NOTICE 'REKOMENDASI: Jalankan tahap migrasi di DATA-MIGRATION.md untuk memindahkan % siswa & % user ke tabel relasional sebelum drop key JSON.', v_orphaned_students, v_orphaned_users;
    ELSE
        RAISE NOTICE 'STATUS AMAN: Seluruh data siswa dan pengguna sudah sinkron di tabel relasional. Aman untuk menerapkan constraint chk_non_transactional_keys.';
    END IF;
    RAISE NOTICE '=======================================================';
END $$;
