import { FormPaymentRecord, BamPaymentRecord } from '../types';

/**
 * Generates SQL DDL (Table schema, indexes, views) & DML (Insert data) 
 * for the Payment module (Formulir & BAM).
 */
export function generatePaymentSql(
  formPayments: FormPaymentRecord[],
  bamPayments: BamPaymentRecord[]
): string {
  const timestamp = new Date().toISOString();

  return `-- ============================================================
-- DATABASE DDL & DML SCRIPT FOR SPMB PAYMENT SYSTEM
-- Generated at: ${timestamp}
-- Compatible with: PostgreSQL 12+ / MySQL 8.0+ / Supabase / Cloud SQL
-- ============================================================

-- ------------------------------------------------------------
-- 1. TABEL PEMBAYARAN FORMULIR (form_payments)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS form_payments (
    id VARCHAR(64) PRIMARY KEY,
    transaction_number VARCHAR(50) NOT NULL UNIQUE,
    registration_number VARCHAR(50) NOT NULL,
    student_id VARCHAR(64) NOT NULL,
    student_name VARCHAR(150) NOT NULL,
    gender VARCHAR(20) NOT NULL CHECK (gender IN ('Laki-laki', 'Perempuan')),
    payment_date DATE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    category VARCHAR(30) NOT NULL CHECK (category IN ('Internal', 'Eksternal', 'Bazaar')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing untuk query performa tinggi
CREATE INDEX IF NOT EXISTS idx_form_payments_reg_num ON form_payments(registration_number);
CREATE INDEX IF NOT EXISTS idx_form_payments_gender ON form_payments(gender);
CREATE INDEX IF NOT EXISTS idx_form_payments_category ON form_payments(category);
CREATE INDEX IF NOT EXISTS idx_form_payments_date ON form_payments(payment_date);

-- ------------------------------------------------------------
-- 2. TABEL PEMBAYARAN BIAYA AWAL MASUK (bam_payments)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bam_payments (
    id VARCHAR(64) PRIMARY KEY,
    transaction_number VARCHAR(50) NOT NULL UNIQUE,
    registration_number VARCHAR(50) NOT NULL,
    student_id VARCHAR(64) NOT NULL,
    student_name VARCHAR(150) NOT NULL,
    gender VARCHAR(20) NOT NULL CHECK (gender IN ('Laki-laki', 'Perempuan')),
    payment_date DATE NOT NULL,
    total_bam_cost NUMERIC(15, 2) NOT NULL DEFAULT 8500000,
    amount_paid NUMERIC(15, 2) NOT NULL DEFAULT 0,
    installment_type VARCHAR(30) NOT NULL,
    total_paid_to_date NUMERIC(15, 2) NOT NULL DEFAULT 0,
    remaining_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing BAM
CREATE INDEX IF NOT EXISTS idx_bam_payments_reg_num ON bam_payments(registration_number);
CREATE INDEX IF NOT EXISTS idx_bam_payments_gender ON bam_payments(gender);
CREATE INDEX IF NOT EXISTS idx_bam_payments_installment ON bam_payments(installment_type);
CREATE INDEX IF NOT EXISTS idx_bam_payments_balance ON bam_payments(remaining_balance);

-- ------------------------------------------------------------
-- 3. VIEW REKAPITULASI LAPORAN KEUANGAN KEPALA SEKOLAH
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_rekap_pembayaran_gender AS
SELECT 
    gender,
    COUNT(DISTINCT student_id) AS total_siswa,
    SUM(amount) AS total_nominal_formulir
FROM form_payments
GROUP BY gender;

CREATE OR REPLACE VIEW v_rekap_bam_gender AS
SELECT 
    gender,
    COUNT(DISTINCT student_id) AS total_siswa,
    SUM(amount_paid) AS total_nominal_bam,
    SUM(remaining_balance) AS total_sisa_tagihan
FROM bam_payments
GROUP BY gender;

CREATE OR REPLACE VIEW v_laporan_eksekutif_keuangan AS
SELECT 
    f.gender,
    COALESCE(f.total_nominal_formulir, 0) AS total_formulir,
    COALESCE(b.total_nominal_bam, 0) AS total_bam,
    (COALESCE(f.total_nominal_formulir, 0) + COALESCE(b.total_nominal_bam, 0)) AS total_penerimaan,
    COALESCE(b.total_sisa_tagihan, 0) AS total_piutang_sisa_bam
FROM (
    SELECT gender, SUM(amount) AS total_nominal_formulir 
    FROM form_payments GROUP BY gender
) f
FULL OUTER JOIN (
    SELECT gender, SUM(amount_paid) AS total_nominal_bam, SUM(remaining_balance) AS total_sisa_tagihan 
    FROM bam_payments GROUP BY gender
) b ON f.gender = b.gender;

-- ------------------------------------------------------------
-- 4. DATA SEED (INSERT DATA PEMBAYARAN FORMULIR & BAM)
-- ------------------------------------------------------------

-- Insert Data Pembayaran Formulir (${formPayments.length} records)
${
  formPayments.length === 0
    ? '-- (Belum ada data pembayaran formulir)'
    : formPayments
        .map(
          fp =>
            `INSERT INTO form_payments (id, transaction_number, registration_number, student_id, student_name, gender, payment_date, amount, category, notes, created_at)\nVALUES ('${fp.id}', '${fp.transactionNumber}', '${fp.registrationNumber}', '${fp.studentId}', '${fp.studentName.replace(/'/g, "''")}', '${fp.gender}', '${fp.paymentDate}', ${fp.amount}, '${fp.category}', '${(fp.notes || '').replace(/'/g, "''")}', '${fp.createdAt}')\nON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount, category = EXCLUDED.category;`
        )
        .join('\n\n')
}

-- Insert Data Pembayaran BAM (${bamPayments.length} records)
${
  bamPayments.length === 0
    ? '-- (Belum ada data pembayaran BAM)'
    : bamPayments
        .map(
          bp =>
            `INSERT INTO bam_payments (id, transaction_number, registration_number, student_id, student_name, gender, payment_date, total_bam_cost, amount_paid, installment_type, total_paid_to_date, remaining_balance, notes, created_at)\nVALUES ('${bp.id}', '${bp.transactionNumber}', '${bp.registrationNumber}', '${bp.studentId}', '${bp.studentName.replace(/'/g, "''")}', '${bp.gender}', '${bp.paymentDate}', ${bp.totalBamCost}, ${bp.amountPaid}, '${bp.installmentType}', ${bp.totalPaidToDate}, ${bp.remainingBalance}, '${(bp.notes || '').replace(/'/g, "''")}', '${bp.createdAt}')\nON CONFLICT (id) DO UPDATE SET amount_paid = EXCLUDED.amount_paid, remaining_balance = EXCLUDED.remaining_balance;`
        )
        .join('\n\n')
}

-- ------------------------------------------------------------
-- 5. QUERIES ANALITIK SIAP PAKAI (READY-TO-USE ANALYTICS)
-- ------------------------------------------------------------

-- A. Total Penerimaan Pembayaran Formulir per Kategori:
-- SELECT category, COUNT(*) as total_transaksi, SUM(amount) as total_nominal FROM form_payments GROUP BY category;

-- B. Daftar Siswa Belum Lunas BAM (Sisa Saldo > 0):
-- SELECT registration_number, student_name, gender, total_bam_cost, total_paid_to_date, remaining_balance FROM bam_payments WHERE remaining_balance > 0 ORDER BY remaining_balance DESC;

-- C. Laporan Harian Transaksi BAM Masuk:
-- SELECT payment_date, COUNT(*) as qty_trx, SUM(amount_paid) as total_masuk FROM bam_payments GROUP BY payment_date ORDER BY payment_date DESC;
`;
}

/**
 * Trigger browser file download for the generated SQL script
 */
export function downloadPaymentSqlFile(
  formPayments: FormPaymentRecord[],
  bamPayments: BamPaymentRecord[],
  filename = 'schema_pembayaran_spmb.sql'
) {
  const sqlString = generatePaymentSql(formPayments, bamPayments);
  const blob = new Blob([sqlString], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
