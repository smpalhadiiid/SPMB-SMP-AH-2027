-- ============================================================
-- MIGRATION 02: ACCOUNT MANAGEMENT & AUDIT LOGS
-- ============================================================

-- 1. Tambahkan kolom status, username, dan must_change_password pada public.users jika belum ada
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username VARCHAR(100) NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Buat UNIQUE index pada username jika belum ada
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_users_username_unique' AND n.nspname = 'public'
    ) THEN
        CREATE UNIQUE INDEX idx_users_username_unique ON public.users(username) WHERE username IS NOT NULL;
    END IF;
END $$;

-- 2. Buat Tabel public.audit_logs untuk mencatat riwayat perubahan akun
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id VARCHAR(100) NOT NULL PRIMARY KEY,
    admin_id VARCHAR(100) NOT NULL,
    admin_name VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    target_user_id VARCHAR(100) NOT NULL,
    target_user_name VARCHAR(255) NOT NULL,
    details TEXT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pada timestamp audit_logs untuk performa query log terbaru
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);

-- 3. Aktifkan RLS pada public.audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists before recreating
DROP POLICY IF EXISTS audit_logs_read_policy ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_insert_policy ON public.audit_logs;

-- Policy: Authenticated users / Super Admin can read audit logs
CREATE POLICY audit_logs_read_policy ON public.audit_logs
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- Policy: Authenticated users can insert audit logs
CREATE POLICY audit_logs_insert_policy ON public.audit_logs
    FOR INSERT
    TO authenticated, anon
    WITH CHECK (true);
