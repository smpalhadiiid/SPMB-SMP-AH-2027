-- =====================================================================
-- 009_secure_administrative_functions.sql
-- Safe, Audited, Role-Based Administrative Functions & Strict SSOT Guard
-- (Replaces dangerous legacy 009 anti-resurrection migration)
-- =====================================================================

-- 1. STRICT SECURITY HARDENING: REVOKE ANY RESIDUAL ANON PRIVILEGES
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;

-- Explicitly allow anon ONLY USAGE on schema and SELECT on non-sensitive spmb_app_state
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.spmb_app_state TO anon;

-- Drop legacy/unsafe functions if previously created
DROP FUNCTION IF EXISTS public.delete_student_permanent(TEXT);

-- 2. SSOT DATABASE GUARD: FORBID TRANSACTIONAL DATA IN SPMB_APP_STATE
-- Rejects attempts to use spmb_app_state as a duplicate store for students, users, payments, or questions.
CREATE OR REPLACE FUNCTION public.guard_spmb_app_state_keys()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.key IN ('students', 'spmb_alhadiid_students', 'users_db', 'form_payments', 'bam_payments', 'question_bank') THEN
        RAISE EXCEPTION 'SSOT Violation: Key "%" is transactional and must only be stored in dedicated relational tables.', NEW.key;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_spmb_app_state ON public.spmb_app_state;
CREATE TRIGGER trg_guard_spmb_app_state
BEFORE INSERT OR UPDATE ON public.spmb_app_state
FOR EACH ROW EXECUTE FUNCTION public.guard_spmb_app_state_keys();

-- 3. SECURE ADMINISTRATIVE FUNCTION: DELETE STUDENT WITH AUDIT LOG
-- Only callable by authenticated users with admin/super_admin role.
CREATE OR REPLACE FUNCTION public.delete_student_secure(p_student_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_user_email TEXT;
    v_user_role TEXT;
    v_student_exists BOOLEAN;
    v_student_reg TEXT;
    v_student_name TEXT;
BEGIN
    -- 3.1 Authentication Check
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Autentikasi diperlukan untuk menghapus data siswa.';
    END IF;

    -- 3.2 Authorization Check (Admin or Super Admin only)
    v_user_role := public.current_user_role();
    IF v_user_role NOT IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'Forbidden: Hanya admin atau super_admin yang berwenang menghapus data siswa.';
    END IF;

    -- 3.3 Verify Student Existence
    SELECT EXISTS(SELECT 1 FROM public.students WHERE id = p_student_id), registration_number, full_name
    INTO v_student_exists, v_student_reg, v_student_name
    FROM public.students
    WHERE id = p_student_id;

    IF NOT v_student_exists THEN
        -- Try match by registration_number
        SELECT EXISTS(SELECT 1 FROM public.students WHERE registration_number = p_student_id), id, registration_number, full_name
        INTO v_student_exists, p_student_id, v_student_reg, v_student_name
        FROM public.students
        WHERE registration_number = p_student_id;
    END IF;

    IF NOT v_student_exists THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Data siswa tidak ditemukan di tabel public.students.'
        );
    END IF;

    v_user_email := COALESCE(auth.jwt()->>'email', 'system');

    -- 3.4 Transactional Deletion of Child & Related Records
    DELETE FROM public.jawaban_peserta WHERE peserta_id = p_student_id;
    DELETE FROM public.hasil_ujian WHERE peserta_id = p_student_id;
    DELETE FROM public.payments WHERE student_id = p_student_id;
    DELETE FROM public.students WHERE id = p_student_id;
    DELETE FROM public.users WHERE id = p_student_id OR registration_number = v_student_reg;

    -- 3.5 Write Audit Log
    INSERT INTO public.audit_logs (
        user_id,
        user_email,
        role,
        action,
        target_entity,
        target_id,
        details,
        ip_address,
        created_at
    ) VALUES (
        v_user_id::text,
        v_user_email,
        v_user_role,
        'DELETE_STUDENT_PERMANENT',
        'students',
        p_student_id,
        jsonb_build_object(
            'deleted_by', v_user_email,
            'student_id', p_student_id,
            'registration_number', v_student_reg,
            'full_name', v_student_name,
            'timestamp', NOW()
        ),
        'server-internal',
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Siswa berhasil dihapus secara aman dari database.',
        'student_id', p_student_id,
        'registration_number', v_student_reg
    );
END;
$$;

-- Revoke execute from anon/public, grant strictly to authenticated
REVOKE EXECUTE ON FUNCTION public.delete_student_secure(TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.delete_student_secure(TEXT) TO authenticated;

-- 4. SECURE ADMINISTRATIVE FUNCTION: VERIFY PAYMENT WITH AUDIT LOG
CREATE OR REPLACE FUNCTION public.rpc_verify_payment(
    p_payment_id TEXT,
    p_status VARCHAR,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_user_email TEXT;
    v_user_role TEXT;
    v_payment RECORD;
BEGIN
    -- 4.1 Authentication Check
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Autentikasi diperlukan.';
    END IF;

    -- 4.2 Authorization Check
    v_user_role := public.current_user_role();
    IF v_user_role NOT IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'Forbidden: Hanya admin yang berhak memverifikasi pembayaran.';
    END IF;

    -- Validate Status
    IF p_status NOT IN ('verified', 'rejected', 'pending', 'unpaid') THEN
        RAISE EXCEPTION 'Status pembayaran tidak valid.';
    END IF;

    SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;
    IF v_payment.id IS NULL THEN
        RAISE EXCEPTION 'Record pembayaran tidak ditemukan.';
    END IF;

    v_user_email := COALESCE(auth.jwt()->>'email', 'admin');

    -- 4.3 Update Payment Record
    UPDATE public.payments
    SET status = p_status,
        verified_by = v_user_email,
        verified_at = CASE WHEN p_status = 'verified' THEN NOW() ELSE NULL END,
        notes = COALESCE(p_notes, notes),
        updated_at = NOW()
    WHERE id = p_payment_id;

    -- 4.4 Synchronize Student Table
    IF v_payment.payment_type = 'form' THEN
        UPDATE public.students
        SET form_payment_status = p_status,
            updated_at = NOW()
        WHERE id = v_payment.student_id;
    ELSIF v_payment.payment_type = 'bam' THEN
        UPDATE public.students
        SET initial_payment_status = p_status,
            updated_at = NOW()
        WHERE id = v_payment.student_id;
    END IF;

    -- 4.5 Insert Audit Log
    INSERT INTO public.audit_logs (
        user_id,
        user_email,
        role,
        action,
        target_entity,
        target_id,
        details,
        ip_address,
        created_at
    ) VALUES (
        v_user_id::text,
        v_user_email,
        v_user_role,
        'VERIFY_PAYMENT',
        'payments',
        p_payment_id,
        jsonb_build_object(
            'payment_id', p_payment_id,
            'student_id', v_payment.student_id,
            'payment_type', v_payment.payment_type,
            'new_status', p_status,
            'verified_by', v_user_email
        ),
        'server-internal',
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', p_payment_id,
        'status', p_status
    );
END;
$$;

-- Revoke execute from anon/public, grant strictly to authenticated
REVOKE EXECUTE ON FUNCTION public.rpc_verify_payment(TEXT, VARCHAR, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.rpc_verify_payment(TEXT, VARCHAR, TEXT) TO authenticated;
