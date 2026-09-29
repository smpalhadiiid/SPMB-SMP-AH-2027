-- =====================================================================
-- 002_core_schema.sql
-- Core Tables: public.users, public.students, public.spmb_app_state, public.audit_logs
-- =====================================================================

-- 1. TABEL PUBLIC.USERS
-- Sumber tunggal data identitas dan role pengguna
CREATE TABLE IF NOT EXISTS public.users (
    id VARCHAR(100) PRIMARY KEY,
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) UNIQUE,
    phone VARCHAR(50),
    role VARCHAR(50) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin', 'kepsek', 'super_admin')),
    registration_number VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    must_change_password BOOLEAN NOT NULL DEFAULT false,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. TABEL PUBLIC.STUDENTS
-- Sumber tunggal data pendaftaran calon murid SPMB
CREATE TABLE IF NOT EXISTS public.students (
    id VARCHAR(100) PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    registration_number VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    user_email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    is_form_verified BOOLEAN DEFAULT false,
    
    -- Pembayaran Formulir (Tahap Pendaftaran Awal)
    form_payment_amount NUMERIC(12,2) DEFAULT 200000,
    form_payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (form_payment_status IN ('unpaid', 'pending', 'verified', 'rejected')),
    form_payment_proof_url TEXT,
    form_payment_date VARCHAR(100),
    form_payment_notes TEXT,
    
    -- Biodata Lengkap Siswa
    nik VARCHAR(50),
    nisn VARCHAR(50),
    birth_place VARCHAR(100),
    birth_date VARCHAR(50),
    gender VARCHAR(20) CHECK (gender IS NULL OR gender IN ('Laki-laki', 'Perempuan')),
    religion VARCHAR(50) DEFAULT 'Islam',
    child_order VARCHAR(20),
    total_siblings VARCHAR(20),
    address TEXT,
    village VARCHAR(100),
    subdistrict VARCHAR(100),
    city VARCHAR(100),
    province VARCHAR(100),
    postal_code VARCHAR(20),
    
    -- Sekolah Asal
    previous_school_name VARCHAR(255),
    previous_school_npsn VARCHAR(50),
    previous_school_address TEXT,
    
    -- Data Ayah
    father_name VARCHAR(255),
    father_birth_place VARCHAR(100),
    father_birth_date VARCHAR(50),
    father_job VARCHAR(100),
    father_education VARCHAR(100),
    father_phone VARCHAR(50),
    
    -- Data Ibu
    mother_name VARCHAR(255),
    mother_birth_place VARCHAR(100),
    mother_birth_date VARCHAR(50),
    mother_job VARCHAR(100),
    mother_education VARCHAR(100),
    mother_phone VARCHAR(50),
    
    -- Data Wali
    guardian_name VARCHAR(255),
    guardian_relation VARCHAR(100),
    guardian_phone VARCHAR(50),
    
    -- Berkas Pendaftaran (URL Storage)
    photo_url TEXT,
    kk_url TEXT,
    birth_cert_url TEXT,
    report_card_url TEXT,
    kip_url TEXT,
    certificate_url TEXT,
    
    -- Evaluasi & Hasil Tes
    is_test_active BOOLEAN DEFAULT false,
    test_submitted BOOLEAN DEFAULT false,
    test_answers JSONB DEFAULT '{}'::jsonb,
    test_schedule_date VARCHAR(100),
    test_location VARCHAR(100),
    diagnostic_score NUMERIC(5,2),
    general_score NUMERIC(5,2),
    religious_score NUMERIC(5,2),
    final_score NUMERIC(5,2),
    test_notes TEXT,
    
    -- Pembayaran Biaya Awal Masuk (BAM / Daftar Ulang)
    initial_payment_amount NUMERIC(12,2) DEFAULT 0,
    initial_payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (initial_payment_status IN ('unpaid', 'pending', 'verified', 'rejected')),
    initial_payment_proof_url TEXT,
    initial_payment_date VARCHAR(100),
    initial_payment_notes TEXT,
    
    -- Penempatan Kelas
    assigned_class_id VARCHAR(50),
    assigned_class_name VARCHAR(100),
    assigned_homeroom_teacher VARCHAR(255),
    first_day_date VARCHAR(50),
    mpls_info TEXT,
    
    -- Optimistic Concurrency Control Version
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_students_reg_num ON public.students(registration_number);
CREATE INDEX IF NOT EXISTS idx_students_user_email ON public.students(user_email);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status);
CREATE INDEX IF NOT EXISTS idx_students_form_pay_status ON public.students(form_payment_status);
CREATE INDEX IF NOT EXISTS idx_students_initial_pay_status ON public.students(initial_payment_status);

DROP TRIGGER IF EXISTS trg_students_updated_at ON public.students;
CREATE TRIGGER trg_students_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. TABEL PUBLIC.SPMB_APP_STATE
-- HANYA untuk konfigurasi aplikasi non-transaksional (Website, Info Sekolah, Tampilan)
-- DILARANG menyimpan data siswa, akun, pembayaran, atau jawaban ujian di tabel ini!
CREATE TABLE IF NOT EXISTS public.spmb_app_state (
    key VARCHAR(100) PRIMARY KEY,
    payload JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_non_transactional_keys CHECK (
        key NOT IN (
            'students', 'users', 'users_db', 'payments', 
            'form_payments', 'bam_payments', 'jawaban_peserta', 'hasil_ujian'
        )
    )
);

DROP TRIGGER IF EXISTS trg_spmb_app_state_updated_at ON public.spmb_app_state;
CREATE TRIGGER trg_spmb_app_state_updated_at
BEFORE UPDATE ON public.spmb_app_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4. TABEL PUBLIC.AUDIT_LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id VARCHAR(100),
    admin_name VARCHAR(255),
    action VARCHAR(50) NOT NULL,
    target_user_id VARCHAR(100),
    target_user_name VARCHAR(255),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON public.audit_logs(admin_id);
