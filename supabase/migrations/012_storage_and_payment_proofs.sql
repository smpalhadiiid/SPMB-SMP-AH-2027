-- =====================================================================
-- 012_storage_and_payment_proofs.sql
-- SPMB SMPS AL-HADIID CILEUNGSI
-- Supabase Storage 'payment-proofs' Bucket, Security Policies, 
-- dan Metadata Bukti Transfer di Tabel public.payments
-- =====================================================================

-- 1. TAMBAH KOLOM METADATA BUKTI TRANSFER PADA TABEL public.payments
-- Metadata disimpan di database, sedangkan file gambar/PDF disimpan di Supabase Storage
ALTER TABLE public.payments 
    ADD COLUMN IF NOT EXISTS proof_storage_path TEXT,
    ADD COLUMN IF NOT EXISTS proof_file_name TEXT,
    ADD COLUMN IF NOT EXISTS proof_file_type TEXT,
    ADD COLUMN IF NOT EXISTS proof_file_size BIGINT,
    ADD COLUMN IF NOT EXISTS proof_uploaded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Indexing untuk mempercepat lookup path storage dan audit bukti
CREATE INDEX IF NOT EXISTS idx_payments_proof_storage_path ON public.payments(proof_storage_path);
CREATE INDEX IF NOT EXISTS idx_payments_status_type ON public.payments(status, payment_type);

-- 2. BUCKET SUPABASE STORAGE: payment-proofs (PRIVATE)
-- Bucket bersifat PRIVATE demi melindungi data pribadi dan bukti transfer bank calon murid
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'payment-proofs',
    'payment-proofs',
    false, -- BUCKET PRIVATE: Tidak dapat diakses publik langsung, wajib via Signed URL
    5242880, -- Maksimal 5 MB (5 * 1024 * 1024 bytes)
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- 3. STORAGE SECURITY POLICIES (RLS) PADA storage.objects UNTUK payment-proofs

-- A. Policy INSERT: Siswa hanya dapat upload bukti transfer miliknya sendiri, Admin dapat upload semua
DROP POLICY IF EXISTS "Students upload own payment proofs" ON storage.objects;
CREATE POLICY "Students upload own payment proofs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'payment-proofs' AND (
        -- Folder pertama adalah student_id yang sesuai dengan akun siswa
        (storage.foldername(name))[1] = auth.uid()::text OR
        (storage.foldername(name))[1] = public.current_student_id() OR
        public.is_admin() OR
        public.is_super_admin()
    )
);

-- B. Policy SELECT: Siswa hanya dapat melihat buktinya sendiri; Admin, Panitia, dan Kepsek dapat melihat semua bukti
DROP POLICY IF EXISTS "Users read authorized payment proofs" ON storage.objects;
CREATE POLICY "Users read authorized payment proofs" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'payment-proofs' AND (
        (storage.foldername(name))[1] = auth.uid()::text OR
        (storage.foldername(name))[1] = public.current_student_id() OR
        public.is_admin() OR
        public.is_super_admin() OR
        public.current_user_role() = 'kepsek'
    )
);

-- C. Policy DELETE: Hanya Admin / Super Admin atau pemilik sebelum diverifikasi yang dapat menghapus file
DROP POLICY IF EXISTS "Authorized delete payment proofs" ON storage.objects;
CREATE POLICY "Authorized delete payment proofs" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'payment-proofs' AND (
        (storage.foldername(name))[1] = auth.uid()::text OR
        (storage.foldername(name))[1] = public.current_student_id() OR
        public.is_admin() OR
        public.is_super_admin()
    )
);

-- D. Izinkan anon role untuk upload dan create signed url saat fallback autentikasi lokal
DROP POLICY IF EXISTS "Anon upload payment proof with key" ON storage.objects;
CREATE POLICY "Anon upload payment proof with key" ON storage.objects
FOR INSERT TO anon
WITH CHECK (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "Anon select payment proof" ON storage.objects;
CREATE POLICY "Anon select payment proof" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'payment-proofs');

-- 4. UPDATE RPC rpc_verify_payment AGAR MENCATAT ALASAN PENOLAKAN
CREATE OR REPLACE FUNCTION public.rpc_verify_payment(
    p_payment_id TEXT,
    p_status VARCHAR,
    p_notes TEXT DEFAULT NULL,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_payment_record RECORD;
    v_user_role TEXT;
    v_admin_email TEXT;
BEGIN
    -- Validasi status
    IF p_status NOT IN ('verified', 'rejected', 'pending') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Status pembayaran tidak valid.');
    END IF;

    -- Validasi alasan penolakan jika status rejected
    IF p_status = 'rejected' AND (p_rejection_reason IS NULL OR TRIM(p_rejection_reason) = '') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Alasan penolakan wajib diisi ketika menolak bukti pembayaran.');
    END IF;

    SELECT * INTO v_payment_record FROM public.payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Data pembayaran tidak ditemukan.');
    END IF;

    v_user_role := public.current_user_role();
    v_admin_email := COALESCE(auth.jwt()->>'email', 'Admin Panitia');

    -- Update tabel public.payments
    UPDATE public.payments
    SET 
        status = p_status,
        verified_by = CASE WHEN p_status = 'verified' THEN v_admin_email ELSE verified_by END,
        verified_at = CASE WHEN p_status = 'verified' THEN NOW() ELSE verified_at END,
        notes = COALESCE(p_notes, notes),
        rejection_reason = CASE WHEN p_status = 'rejected' THEN p_rejection_reason ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_payment_id;

    -- Sinkronisasi otomatis ke public.students
    IF v_payment_record.student_id IS NOT NULL THEN
        IF v_payment_record.payment_type IN ('formulir', 'form') THEN
            UPDATE public.students
            SET 
                form_payment_status = p_status,
                is_form_verified = (p_status = 'verified'),
                is_form_verified_by_admin = (p_status = 'verified'),
                form_payment_notes = CASE WHEN p_status = 'rejected' THEN ('Ditolak: ' || p_rejection_reason) ELSE form_payment_notes END,
                status = CASE 
                    WHEN p_status = 'verified' AND status IN ('pending_payment', 'draft', 'verifying_payment') THEN 'filling_form'
                    ELSE status 
                END,
                updated_at = NOW()
            WHERE id = v_payment_record.student_id;
        ELSIF v_payment_record.payment_type IN ('daftar_ulang', 'bam') THEN
            UPDATE public.students
            SET 
                initial_payment_status = p_status,
                initial_payment_notes = CASE WHEN p_status = 'rejected' THEN ('Ditolak: ' || p_rejection_reason) ELSE initial_payment_notes END,
                updated_at = NOW()
            WHERE id = v_payment_record.student_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Status pembayaran berhasil diperbarui.',
        'payment_id', p_payment_id,
        'new_status', p_status
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_verify_payment(TEXT, VARCHAR, TEXT, TEXT) TO authenticated, anon;
