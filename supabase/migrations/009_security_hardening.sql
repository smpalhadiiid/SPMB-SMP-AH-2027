-- 009_security_hardening.sql
-- Defense-in-depth fixes from the 2026 application security audit.

-- Prevent clients from changing authorization-critical profile fields.
CREATE OR REPLACE FUNCTION public.protect_user_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
    RAISE EXCEPTION 'Perubahan atribut keamanan akun tidak diizinkan';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_security_fields ON public.users;
CREATE TRIGGER trg_protect_user_security_fields
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.protect_user_security_fields();

-- Students may edit biodata, but never workflow, payment, CBT, or placement results.
CREATE OR REPLACE FUNCTION public.protect_student_managed_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_email IS DISTINCT FROM OLD.user_email
     OR NEW.registration_number IS DISTINCT FROM OLD.registration_number
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.is_form_verified IS DISTINCT FROM OLD.is_form_verified
     OR NEW.form_payment_status IS DISTINCT FROM OLD.form_payment_status
     OR NEW.form_payment_amount IS DISTINCT FROM OLD.form_payment_amount
     OR NEW.initial_payment_status IS DISTINCT FROM OLD.initial_payment_status
     OR NEW.initial_payment_amount IS DISTINCT FROM OLD.initial_payment_amount
     OR NEW.is_test_active IS DISTINCT FROM OLD.is_test_active
     OR NEW.test_submitted IS DISTINCT FROM OLD.test_submitted
     OR NEW.diagnostic_score IS DISTINCT FROM OLD.diagnostic_score
     OR NEW.general_score IS DISTINCT FROM OLD.general_score
     OR NEW.religious_score IS DISTINCT FROM OLD.religious_score
     OR NEW.final_score IS DISTINCT FROM OLD.final_score
     OR NEW.assigned_class_id IS DISTINCT FROM OLD.assigned_class_id
     OR NEW.assigned_class_name IS DISTINCT FROM OLD.assigned_class_name THEN
    RAISE EXCEPTION 'Perubahan field yang dikelola server tidak diizinkan';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_student_managed_fields ON public.students;
CREATE TRIGGER trg_protect_student_managed_fields
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.protect_student_managed_fields();

-- Never expose answer keys through direct table SELECT to students.
DROP POLICY IF EXISTS "Students view active questions" ON public.soal;
CREATE POLICY "Admins read questions" ON public.soal
FOR SELECT TO authenticated
USING (public.is_admin());

-- Return exam questions without jawaban_benar. Also verifies the question belongs
-- to the requested published/ongoing exam.
CREATE OR REPLACE FUNCTION public.rpc_get_exam_questions(p_ujian_id uuid)
RETURNS TABLE (
  id uuid,
  kategori_id uuid,
  pertanyaan text,
  pilihan_a text,
  pilihan_b text,
  pilihan_c text,
  pilihan_d text,
  bobot numeric,
  urutan integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.id, s.kategori_id, s.pertanyaan, s.pilihan_a, s.pilihan_b,
         s.pilihan_c, s.pilihan_d, s.bobot, us.urutan
  FROM public.ujian_soal us
  JOIN public.ujian u ON u.id = us.ujian_id
  JOIN public.soal s ON s.id = us.soal_id
  WHERE us.ujian_id = p_ujian_id
    AND u.status IN ('published', 'ongoing')
    AND s.aktif = true
    AND public.current_student_id() IS NOT NULL
  ORDER BY us.urutan;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_exam_questions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_exam_questions(uuid) TO authenticated;

-- SECURITY DEFINER functions must not be executable by anonymous/public roles.
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_student_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role(), public.is_admin(),
  public.is_super_admin(), public.current_student_id() TO authenticated;
