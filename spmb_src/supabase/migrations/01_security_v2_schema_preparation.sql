-- =====================================================================
-- MIGRATION V2 - PHASE 1: SCHEMA PREPARATION
-- Project: SPMB 2027-2028 (SMP Al-Hadiid)
-- Goal: Prepare public.users table for Supabase Auth integration
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PRE-CHECK QUERY (READ-ONLY)
-- Run this prior to applying migration to confirm baseline state
-- ---------------------------------------------------------------------
/*
SELECT 
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'users' 
  AND column_name IN ('auth_user_id', 'password_hash', 'id');
*/

-- ---------------------------------------------------------------------
-- 2. MIGRATION SQL PHASE 1
-- ---------------------------------------------------------------------

-- Step 1: Add auth_user_id column (UUID, Nullable)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- Step 2: Add Foreign Key Constraint to auth.users(id) with ON DELETE SET NULL
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_users_auth_user' 
          AND table_name = 'users' 
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.users 
        ADD CONSTRAINT fk_users_auth_user 
        FOREIGN KEY (auth_user_id) 
        REFERENCES auth.users(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- Step 3: Create UNIQUE partial index for auth_user_id (allows multiple NULLs for existing users)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id 
ON public.users(auth_user_id) 
WHERE auth_user_id IS NOT NULL;

-- Step 4: Make password_hash NULLABLE for smooth auth transition
ALTER TABLE public.users 
ALTER COLUMN password_hash DROP NOT NULL;

-- ---------------------------------------------------------------------
-- 3. VERIFICATION QUERY (READ-ONLY)
-- ---------------------------------------------------------------------
/*
-- Check columns state in public.users
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'users' 
  AND column_name IN ('id', 'auth_user_id', 'password_hash', 'email');

-- Check Foreign Key constraint
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'users'
  AND kcu.column_name = 'auth_user_id';

-- Check total records preservation
SELECT 
    (SELECT COUNT(*) FROM public.users) AS total_users,
    (SELECT COUNT(*) FROM public.students) AS total_students;
*/

-- ---------------------------------------------------------------------
-- 4. ROLLBACK SQL (SAFE REVERSION IF NEEDED)
-- ---------------------------------------------------------------------
/*
-- Step R1: Remove unique index
DROP INDEX IF EXISTS public.idx_users_auth_user_id;

-- Step R2: Drop foreign key constraint
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS fk_users_auth_user;

-- Step R3: Drop auth_user_id column
ALTER TABLE public.users 
DROP COLUMN IF EXISTS auth_user_id;

-- Step R4: Restore password_hash NOT NULL (Ensure no NULL values exist first)
-- UPDATE public.users SET password_hash = 'legacy_migrated' WHERE password_hash IS NULL;
-- ALTER TABLE public.users ALTER COLUMN password_hash SET NOT NULL;
*/
