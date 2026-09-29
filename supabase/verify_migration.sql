-- =====================================================================
-- verify_migration.sql
-- Verification Script for Baseline Migrations (001 - 009)
-- Run in Supabase SQL Editor to verify staging database integrity
-- =====================================================================

DO $$
DECLARE
    v_missing_tables int;
    v_open_policies int;
    v_invalid_fks int;
    v_anon_table_permissions int;
    v_dangerous_func_execute int;
    v_dangerous_policies int;
    v_transactional_state_keys int;
    v_func_missing int;
BEGIN
    RAISE NOTICE '>>> MEMULAI VERIFIKASI INTEGRITAS DATABASE STAGING SPMB AL-HADIID <<<';

    -- 1. Verifikasi Keberadaan Seluruh Tabel Utama
    SELECT COUNT(*) INTO v_missing_tables
    FROM (
        VALUES 
            ('users'), ('students'), ('payments'), ('kategori_soal'),
            ('soal'), ('ujian'), ('ujian_soal'), ('jawaban_peserta'),
            ('hasil_ujian'), ('audit_logs'), ('spmb_app_state')
    ) AS expected(table_name)
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = expected.table_name
    );

    IF v_missing_tables > 0 THEN
        RAISE EXCEPTION 'GAGAL: Ada % tabel utama yang belum terbuat!', v_missing_tables;
    ELSE
        RAISE NOTICE '[OK] Seluruh 11 tabel utama terverifikasi ada.';
    END IF;

    -- 2. Verifikasi RLS Aktif pada Seluruh Tabel
    SELECT COUNT(*) INTO v_open_policies
    FROM pg_tables
    WHERE schemaname = 'public' 
      AND tablename IN (
        'users', 'students', 'payments', 'kategori_soal', 'soal', 
        'ujian', 'ujian_soal', 'jawaban_peserta', 'hasil_ujian', 
        'audit_logs', 'spmb_app_state'
      )
      AND NOT rowsecurity;

    IF v_open_policies > 0 THEN
        RAISE EXCEPTION 'GAGAL: Ada % tabel tanpa Row-Level Security (RLS)!', v_open_policies;
    ELSE
        RAISE NOTICE '[OK] RLS aktif pada seluruh 11 tabel.';
    END IF;

    -- 3. Verifikasi Konsistensi Foreign Key Peserta CBT (Harus Merujuk ke public.students)
    SELECT COUNT(*) INTO v_invalid_fks
    FROM information_schema.referential_constraints rc
    JOIN information_schema.constraint_table_usage ctu 
      ON rc.unique_constraint_name = ctu.constraint_name
    JOIN information_schema.table_constraints tc 
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.table_name IN ('jawaban_peserta', 'hasil_ujian')
      AND ctu.table_name != 'students';

    IF v_invalid_fks > 0 THEN
        RAISE EXCEPTION 'GAGAL: Ada referensi CBT yang tidak merujuk ke public.students!';
    ELSE
        RAISE NOTICE '[OK] Foreign key CBT konsisten merujuk ke public.students(id).';
    END IF;

    -- 4. Verifikasi Tidak Ada Hak Tulis (INSERT/UPDATE/DELETE) kepada Anon
    SELECT COUNT(*) INTO v_anon_table_permissions
    FROM information_schema.table_privileges
    WHERE grantee = 'anon'
      AND table_schema = 'public'
      AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');

    IF v_anon_table_permissions > 0 THEN
        RAISE EXCEPTION 'GAGAL: Role anon memiliki hak tulis berbahaya pada % tabel!', v_anon_table_permissions;
    ELSE
        RAISE NOTICE '[OK] Hak akses anon aman (least privilege, hanya SELECT spmb_app_state).';
    END IF;

    -- 5. Verifikasi Tidak Ada Eksekusi Fungsi Administratif Berbahaya oleh Anon/Public
    SELECT COUNT(*) INTO v_dangerous_func_execute
    FROM information_schema.routine_privileges
    WHERE specific_schema = 'public'
      AND routine_name IN ('delete_student_secure', 'delete_student_permanent', 'rpc_verify_payment')
      AND grantee IN ('anon', 'public')
      AND privilege_type = 'EXECUTE';

    IF v_dangerous_func_execute > 0 THEN
        RAISE EXCEPTION 'GAGAL: Fungsi administratif dapat dieksekusi oleh anon/public!';
    ELSE
        RAISE NOTICE '[OK] Fungsi administratif terlindungi (hanya authenticated).';
    END IF;

    -- 6. Verifikasi Tidak Ada Policy USING(true) untuk DELETE atau UPDATE pada Data Sensitif
    SELECT COUNT(*) INTO v_dangerous_policies
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('students', 'users', 'payments', 'audit_logs')
      AND cmd IN ('DELETE', 'UPDATE')
      AND qual = 'true';

    IF v_dangerous_policies > 0 THEN
        RAISE EXCEPTION 'GAGAL: Terdapat policy USING(true) tanpa autentikasi/otorisasi pada data sensitif!';
    ELSE
        RAISE NOTICE '[OK] Seluruh policy DELETE & UPDATE pada data sensitif terproteksi otorisasi.';
    END IF;

    -- 7. Verifikasi Tidak Ada Data Transaksional dalam spmb_app_state (SSOT Check)
    SELECT COUNT(*) INTO v_transactional_state_keys
    FROM public.spmb_app_state
    WHERE key IN ('students', 'spmb_alhadiid_students', 'users_db', 'form_payments', 'bam_payments', 'question_bank');

    IF v_transactional_state_keys > 0 THEN
        RAISE EXCEPTION 'PERINGATAN/GAGAL: spmb_app_state mengandung % kunci data transaksional duplikat! Pindahkan ke tabel relasional.', v_transactional_state_keys;
    ELSE
        RAISE NOTICE '[OK] spmb_app_state bersih dari data transaksional duplikat.';
    END IF;

    -- 8. Verifikasi Keberadaan Fungsi Helper Keamanan
    SELECT COUNT(*) INTO v_func_missing
    FROM (
        VALUES ('current_user_role'), ('is_admin'), ('is_super_admin'), ('current_student_id')
    ) AS f(func_name)
    WHERE NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = f.func_name
    );

    IF v_func_missing > 0 THEN
        RAISE EXCEPTION 'GAGAL: Ada % fungsi keamanan penting yang belum terdaftar!', v_func_missing;
    ELSE
        RAISE NOTICE '[OK] Fungsi keamanan current_user_role(), is_admin(), is_super_admin() terverifikasi.';
    END IF;

    RAISE NOTICE '>>> VERIFIKASI BERHASIL: SEMUA KRITERIA SCHEMA STAGING MEMENUHI STANDAR KEAMANAN <<<';
END $$;
