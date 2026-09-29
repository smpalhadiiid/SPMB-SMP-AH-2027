-- =====================================================================
-- 005_functions_and_triggers.sql
-- Security Helper Functions, Triggers, and Server-Side RPC
-- =====================================================================

-- 1. SECURITY HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role text;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN 'anon';
    END IF;

    SELECT role INTO v_role
    FROM public.users
    WHERE auth_user_id = auth.uid() OR id = auth.uid()::text
    LIMIT 1;

    RETURN COALESCE(v_role, 'anon');
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.current_user_role() IN ('admin', 'super_admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.current_user_role() = 'super_admin';
END;
$$;

CREATE OR REPLACE FUNCTION public.current_student_id()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id text;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT id INTO v_id
    FROM public.users
    WHERE (auth_user_id = auth.uid() OR id = auth.uid()::text)
      AND role = 'student'
    LIMIT 1;

    RETURN v_id;
END;
$$;

-- 2. AUTOMATIC PROFILE CREATION TRIGGER FROM AUTH.USERS
-- Menjamin semua pendaftaran publik HANYA mendapatkan role 'student'
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_full_name text;
    v_phone text;
    v_user_id text;
    v_reg_number text;
    v_rand int;
BEGIN
    v_user_id := NEW.id::text;
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Calon Murid');
    v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '081234567890');

    -- Generate nomor registrasi unik format: REG-YYYYMMDD-XXXX
    v_rand := floor(random() * 9000 + 1000)::int;
    v_reg_number := 'REG-' || to_char(NOW(), 'YYYYMMDD') || '-' || v_rand;

    -- 1. Insert ke public.users (role dipaksa 'student')
    INSERT INTO public.users (
        id,
        auth_user_id,
        name,
        email,
        username,
        phone,
        role,
        registration_number,
        status,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        NEW.id,
        v_full_name,
        LOWER(NEW.email),
        LOWER(SPLIT_PART(NEW.email, '@', 1)),
        v_phone,
        'student',
        v_reg_number,
        'active',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        auth_user_id = EXCLUDED.auth_user_id,
        email = EXCLUDED.email,
        updated_at = NOW();

    -- 2. Insert ke public.students
    INSERT INTO public.students (
        id,
        registration_number,
        status,
        user_email,
        full_name,
        phone,
        is_form_verified,
        form_payment_amount,
        form_payment_status,
        initial_payment_amount,
        initial_payment_status,
        version,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        v_reg_number,
        'draft',
        LOWER(NEW.email),
        v_full_name,
        v_phone,
        false,
        200000,
        'unpaid',
        0,
        'unpaid',
        1,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        user_email = EXCLUDED.user_email,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

-- Pasang trigger pada auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 3. SECURE RPC: VERIFIKASI PEMBAYARAN OLEH ADMIN
CREATE OR REPLACE FUNCTION public.rpc_verify_payment(
    p_payment_id text,
    p_status text,
    p_notes text DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payment record;
    v_admin_role text;
    v_admin_name text;
BEGIN
    v_admin_role := public.current_user_role();
    IF v_admin_role NOT IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya panitia admin yang dapat memverifikasi pembayaran.';
    END IF;

    IF p_status NOT IN ('verified', 'rejected', 'pending') THEN
        RAISE EXCEPTION 'Status tidak valid: %', p_status;
    END IF;

    SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Data pembayaran tidak ditemukan: %', p_payment_id;
    END IF;

    SELECT name INTO v_admin_name FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
    IF v_admin_name IS NULL THEN
        v_admin_name := 'Admin SPMB';
    END IF;

    -- Update payments
    UPDATE public.payments
    SET status = p_status,
        verified_by = v_admin_name,
        verified_at = NOW(),
        notes = COALESCE(p_notes, notes),
        updated_at = NOW()
    WHERE id = p_payment_id;

    -- Sinkronkan status ke tabel students
    IF v_payment.payment_type = 'form' THEN
        UPDATE public.students
        SET form_payment_status = p_status,
            form_payment_notes = COALESCE(p_notes, form_payment_notes),
            updated_at = NOW()
        WHERE id = v_payment.student_id;
    ELSIF v_payment.payment_type = 'bam' THEN
        UPDATE public.students
        SET initial_payment_status = p_status,
            initial_payment_notes = COALESCE(p_notes, initial_payment_notes),
            updated_at = NOW()
        WHERE id = v_payment.student_id;
    END IF;

    -- Catat audit log
    INSERT INTO public.audit_logs (
        admin_id, admin_name, action, target_user_id, target_user_name, details
    ) VALUES (
        auth.uid()::text,
        v_admin_name,
        'VERIFY_PAYMENT',
        v_payment.student_id,
        v_payment.student_name,
        jsonb_build_object('payment_id', p_payment_id, 'new_status', p_status, 'notes', p_notes)
    );

    RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id, 'status', p_status);
END;
$$;

-- 4. SECURE RPC: SUBMIT CBT ANSWER
CREATE OR REPLACE FUNCTION public.rpc_submit_cbt_answer(
    p_ujian_id uuid,
    p_soal_id uuid,
    p_jawaban text,
    p_is_ragu boolean DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_student_id text;
    v_ujian record;
BEGIN
    v_student_id := public.current_student_id();
    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya siswa terdaftar yang dapat menjawab ujian.';
    END IF;

    SELECT * INTO v_ujian FROM public.ujian WHERE id = p_ujian_id;
    IF NOT FOUND OR v_ujian.status NOT IN ('published', 'ongoing') THEN
        RAISE EXCEPTION 'Ujian tidak aktif atau tidak ditemukan.';
    END IF;

    IF p_jawaban IS NOT NULL AND p_jawaban NOT IN ('A', 'B', 'C', 'D') THEN
        RAISE EXCEPTION 'Format jawaban tidak valid: %', p_jawaban;
    END IF;

    INSERT INTO public.jawaban_peserta (
        ujian_id, peserta_id, soal_id, jawaban_dipilih, is_ragu, updated_at
    ) VALUES (
        p_ujian_id, v_student_id, p_soal_id, p_jawaban, p_is_ragu, NOW()
    )
    ON CONFLICT (ujian_id, peserta_id, soal_id) DO UPDATE SET
        jawaban_dipilih = EXCLUDED.jawaban_dipilih,
        is_ragu = EXCLUDED.is_ragu,
        updated_at = NOW();

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. SECURE RPC: FINISH CBT EXAM & SERVER-SIDE SCORING
CREATE OR REPLACE FUNCTION public.rpc_finish_cbt_exam(
    p_ujian_id uuid
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_student_id text;
    v_ujian record;
    v_total_score numeric := 0;
    v_diag_score numeric := 0;
    v_tpu_score numeric := 0;
    v_diniyyah_score numeric := 0;
    v_status text;
BEGIN
    v_student_id := public.current_student_id();
    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya siswa terdaftar yang dapat menyelesaikan ujian.';
    END IF;

    SELECT * INTO v_ujian FROM public.ujian WHERE id = p_ujian_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ujian tidak ditemukan.';
    END IF;

    -- Hitung nilai berdasarkan bobot soal server-side
    SELECT
        COALESCE(SUM(CASE WHEN s.jawaban_benar = j.jawaban_dipilih THEN s.bobot ELSE 0 END), 0)
    INTO v_total_score
    FROM public.jawaban_peserta j
    JOIN public.soal s ON s.id = j.soal_id
    WHERE j.ujian_id = p_ujian_id AND j.peserta_id = v_student_id;

    IF v_total_score >= v_ujian.passing_grade THEN
        v_status := 'LULUS';
    ELSE
        v_status := 'TIDAK LULUS';
    END IF;

    -- Simpan hasil rekap
    INSERT INTO public.hasil_ujian (
        ujian_id, peserta_id, nilai_diagnostik, nilai_tpu, nilai_diniyyah, nilai_akhir, status_kelulusan, waktu_selesai
    ) VALUES (
        p_ujian_id, v_student_id, v_diag_score, v_tpu_score, v_diniyyah_score, v_total_score, v_status, NOW()
    )
    ON CONFLICT (ujian_id, peserta_id) DO UPDATE SET
        nilai_akhir = EXCLUDED.nilai_akhir,
        status_kelulusan = EXCLUDED.status_kelulusan,
        waktu_selesai = NOW(),
        updated_at = NOW();

    -- Update status test di public.students
    UPDATE public.students
    SET test_submitted = true,
        final_score = v_total_score,
        updated_at = NOW()
    WHERE id = v_student_id;

    RETURN jsonb_build_object(
        'success', true,
        'final_score', v_total_score,
        'status_kelulusan', v_status
    );
END;
$$;
