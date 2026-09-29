-- =====================================================================
-- 006_rls_policies.sql
-- Strict Row-Level Security (RLS) Policies (Principle of Least Privilege)
-- =====================================================================

-- 1. ENABLE RLS ON ALL TABLES
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kategori_soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ujian_soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jawaban_peserta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hasil_ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spmb_app_state ENABLE ROW LEVEL SECURITY;

-- 2. SCHEMA & GRANTS MANAGEMENT
-- Revoke all blanket permissions
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;

-- Grant minimal necessary privileges
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Anon can only read public configurations (school info, website config)
GRANT SELECT ON public.spmb_app_state TO anon;

-- Authenticated roles can query specific tables per RLS policies below
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kategori_soal TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.soal TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ujian TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ujian_soal TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jawaban_peserta TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hasil_ujian TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spmb_app_state TO authenticated;

-- 3. POLICIES: PUBLIC.USERS
DROP POLICY IF EXISTS "Admin full access on users" ON public.users;
CREATE POLICY "Admin full access on users" ON public.users
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (
    public.is_admin() AND 
    (role != 'super_admin' OR public.is_super_admin())
);

DROP POLICY IF EXISTS "Kepsek read only on users" ON public.users;
CREATE POLICY "Kepsek read only on users" ON public.users
FOR SELECT TO authenticated
USING (public.current_user_role() = 'kepsek');

DROP POLICY IF EXISTS "User read own profile" ON public.users;
CREATE POLICY "User read own profile" ON public.users
FOR SELECT TO authenticated
USING (auth_user_id = auth.uid() OR id = auth.uid()::text);

DROP POLICY IF EXISTS "User update own profile" ON public.users;
CREATE POLICY "User update own profile" ON public.users
FOR UPDATE TO authenticated
USING (auth_user_id = auth.uid() OR id = auth.uid()::text)
WITH CHECK (
    (auth_user_id = auth.uid() OR id = auth.uid()::text) AND
    role = 'student'
);

-- 4. POLICIES: PUBLIC.STUDENTS
DROP POLICY IF EXISTS "Admin full access on students" ON public.students;
CREATE POLICY "Admin full access on students" ON public.students
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Kepsek read only on students" ON public.students;
CREATE POLICY "Kepsek read only on students" ON public.students
FOR SELECT TO authenticated
USING (public.current_user_role() = 'kepsek');

DROP POLICY IF EXISTS "Student read own record" ON public.students;
CREATE POLICY "Student read own record" ON public.students
FOR SELECT TO authenticated
USING (
    id = public.current_student_id() OR 
    user_email = (auth.jwt()->>'email')
);

DROP POLICY IF EXISTS "Student update own editable fields" ON public.students;
CREATE POLICY "Student update own editable fields" ON public.students
FOR UPDATE TO authenticated
USING (
    id = public.current_student_id() OR 
    user_email = (auth.jwt()->>'email')
)
WITH CHECK (
    (id = public.current_student_id() OR user_email = (auth.jwt()->>'email'))
);

-- 5. POLICIES: PUBLIC.PAYMENTS
DROP POLICY IF EXISTS "Admin full access on payments" ON public.payments;
CREATE POLICY "Admin full access on payments" ON public.payments
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Kepsek read only on payments" ON public.payments;
CREATE POLICY "Kepsek read only on payments" ON public.payments
FOR SELECT TO authenticated
USING (public.current_user_role() = 'kepsek');

DROP POLICY IF EXISTS "Student read own payments" ON public.payments;
CREATE POLICY "Student read own payments" ON public.payments
FOR SELECT TO authenticated
USING (student_id = public.current_student_id());

DROP POLICY IF EXISTS "Student insert own payment" ON public.payments;
CREATE POLICY "Student insert own payment" ON public.payments
FOR INSERT TO authenticated
WITH CHECK (
    student_id = public.current_student_id() AND
    status = 'pending'
);

-- 6. POLICIES: PUBLIC.KATEGORI_SOAL & SOAL & UJIAN
DROP POLICY IF EXISTS "Admin manage exam structure" ON public.kategori_soal;
CREATE POLICY "Admin manage exam structure" ON public.kategori_soal
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated view active categories" ON public.kategori_soal;
CREATE POLICY "Authenticated view active categories" ON public.kategori_soal
FOR SELECT TO authenticated
USING (aktif = true);

DROP POLICY IF EXISTS "Admin manage questions" ON public.soal;
CREATE POLICY "Admin manage questions" ON public.soal
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Students view active questions" ON public.soal;
CREATE POLICY "Students view active questions" ON public.soal
FOR SELECT TO authenticated
USING (aktif = true);

DROP POLICY IF EXISTS "Admin manage exams" ON public.ujian;
CREATE POLICY "Admin manage exams" ON public.ujian
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated view published exams" ON public.ujian;
CREATE POLICY "Authenticated view published exams" ON public.ujian
FOR SELECT TO authenticated
USING (status IN ('published', 'ongoing') OR public.is_admin());

DROP POLICY IF EXISTS "Admin manage exam questions link" ON public.ujian_soal;
CREATE POLICY "Admin manage exam questions link" ON public.ujian_soal
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated view exam questions link" ON public.ujian_soal;
CREATE POLICY "Authenticated view exam questions link" ON public.ujian_soal
FOR SELECT TO authenticated
USING (true);

-- 7. POLICIES: PUBLIC.JAWABAN_PESERTA
DROP POLICY IF EXISTS "Admin view all exam answers" ON public.jawaban_peserta;
CREATE POLICY "Admin view all exam answers" ON public.jawaban_peserta
FOR SELECT TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Student manage own exam answers" ON public.jawaban_peserta;
CREATE POLICY "Student manage own exam answers" ON public.jawaban_peserta
FOR ALL TO authenticated
USING (peserta_id = public.current_student_id())
WITH CHECK (peserta_id = public.current_student_id());

-- 8. POLICIES: PUBLIC.HASIL_UJIAN
DROP POLICY IF EXISTS "Admin full access on exam results" ON public.hasil_ujian;
CREATE POLICY "Admin full access on exam results" ON public.hasil_ujian
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Kepsek read only on exam results" ON public.hasil_ujian;
CREATE POLICY "Kepsek read only on exam results" ON public.hasil_ujian
FOR SELECT TO authenticated
USING (public.current_user_role() = 'kepsek');

DROP POLICY IF EXISTS "Student read own exam result" ON public.hasil_ujian;
CREATE POLICY "Student read own exam result" ON public.hasil_ujian
FOR SELECT TO authenticated
USING (peserta_id = public.current_student_id());

-- 9. POLICIES: PUBLIC.AUDIT_LOGS
DROP POLICY IF EXISTS "Admin view audit logs" ON public.audit_logs;
CREATE POLICY "Admin view audit logs" ON public.audit_logs
FOR SELECT TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admin insert audit logs" ON public.audit_logs;
CREATE POLICY "Admin insert audit logs" ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

-- 10. POLICIES: PUBLIC.SPMB_APP_STATE
DROP POLICY IF EXISTS "Anyone can read public state" ON public.spmb_app_state;
CREATE POLICY "Anyone can read public state" ON public.spmb_app_state
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admin manage app state" ON public.spmb_app_state;
CREATE POLICY "Admin manage app state" ON public.spmb_app_state
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
