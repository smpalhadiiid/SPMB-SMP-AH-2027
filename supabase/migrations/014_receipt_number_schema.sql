-- =====================================================================
-- 014_receipt_number_schema.sql
-- Penambahan Kolom Nomor Kuitansi & Waktu Penerbitan Kuitansi Resmi
-- SPMB SMPS Al-Hadiid Cileungsi
-- =====================================================================

ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS receipt_issued_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_payments_receipt_number ON public.payments(receipt_number);

-- Backfill otomatis untuk transaksi yang sudah terverifikasi sebelumnya jika receipt_number masih kosong
DO $$
DECLARE
    r RECORD;
    v_seq INT := 1;
    v_year TEXT := '2027';
    v_prefix TEXT;
    v_num TEXT;
BEGIN
    FOR r IN 
        SELECT id, payment_type, created_at, status 
        FROM public.payments 
        WHERE status = 'verified' AND receipt_number IS NULL
        ORDER BY created_at ASC 
    LOOP
        IF r.payment_type = 'formulir' OR r.payment_type = 'form' THEN
            v_prefix := 'KWT-FRM-' || v_year || '-';
        ELSE
            v_prefix := 'KWT-BAM-' || v_year || '-';
        END IF;

        v_num := v_prefix || LPAD(v_seq::text, 5, '0');

        -- Pastikan nomor belum terpakai
        WHILE EXISTS (SELECT 1 FROM public.payments WHERE receipt_number = v_num) LOOP
            v_seq := v_seq + 1;
            v_num := v_prefix || LPAD(v_seq::text, 5, '0');
        END LOOP;

        UPDATE public.payments 
        SET receipt_number = v_num,
            receipt_issued_at = COALESCE(payment_date, created_at, NOW())
        WHERE id = r.id;

        v_seq := v_seq + 1;
    END LOOP;
END $$;
