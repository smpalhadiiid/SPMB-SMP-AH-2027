-- =====================================================================
-- 003_payment_schema.sql
-- Relational Payment Table (Source of Truth for Payments)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.payments (
    id VARCHAR(100) PRIMARY KEY DEFAULT ('pay_' || replace(gen_random_uuid()::text, '-', '')),
    student_id VARCHAR(100) NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    registration_number VARCHAR(100) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    payment_type VARCHAR(50) NOT NULL CHECK (payment_type IN ('form', 'bam', 'tuition', 'other')),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('unpaid', 'pending', 'verified', 'rejected')),
    payment_method VARCHAR(50) DEFAULT 'manual_transfer',
    bank_name VARCHAR(50),
    account_number VARCHAR(50),
    sender_name VARCHAR(255),
    proof_url TEXT,
    payment_date TIMESTAMP WITH TIME ZONE,
    verified_by VARCHAR(100),
    verified_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_student_id ON public.payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_type_status ON public.payments(payment_type, status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
