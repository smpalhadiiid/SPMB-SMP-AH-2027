-- =====================================================================
-- 007_storage_policies.sql
-- Supabase Storage Buckets and Security Policies
-- =====================================================================

-- 1. INSERT STORAGE BUCKETS (IF NOT EXISTS)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('documents', 'documents', false, 5242880, ARRAY['image/jpeg', 'image/png', 'application/pdf']),
    ('payments', 'payments', false, 5242880, ARRAY['image/jpeg', 'image/png', 'application/pdf']),
    ('photos', 'photos', true, 2097152, ARRAY['image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. STORAGE POLICIES: DOCUMENTS BUCKET
DROP POLICY IF EXISTS "Students upload own documents" ON storage.objects;
CREATE POLICY "Students upload own documents" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users read own documents or admin view" ON storage.objects;
CREATE POLICY "Users read own documents or admin view" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'documents' AND (
        (storage.foldername(name))[1] = auth.uid()::text OR
        public.is_admin() OR
        public.current_user_role() = 'kepsek'
    )
);

-- 3. STORAGE POLICIES: PAYMENTS BUCKET
DROP POLICY IF EXISTS "Students upload own payment proof" ON storage.objects;
CREATE POLICY "Students upload own payment proof" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'payments' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users read own payment proof or admin view" ON storage.objects;
CREATE POLICY "Users read own payment proof or admin view" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'payments' AND (
        (storage.foldername(name))[1] = auth.uid()::text OR
        public.is_admin() OR
        public.current_user_role() = 'kepsek'
    )
);

-- 4. STORAGE POLICIES: PHOTOS BUCKET (PUBLIC AVATARS / PROFILES)
DROP POLICY IF EXISTS "Anyone read public photos" ON storage.objects;
CREATE POLICY "Anyone read public photos" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'photos');

DROP POLICY IF EXISTS "Authenticated users upload own photo" ON storage.objects;
CREATE POLICY "Authenticated users upload own photo" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
);
