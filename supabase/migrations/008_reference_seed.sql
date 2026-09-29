-- =====================================================================
-- 008_reference_seed.sql
-- Reference Data Seeding (No Accounts, No Passwords)
-- =====================================================================

-- 1. SEED DEFAULT CBT CATEGORIES
INSERT INTO public.kategori_soal (nama_kategori, kode_kategori, persentase_bobot, keterangan)
VALUES 
    ('Tes Diagnostik Awal', 'diagnostik', 30.00, 'Evaluasi kemampuan mendasar dan kesiapan belajar calon murid'),
    ('Tes Pengetahuan Umum (TPU)', 'pengetahuan_umum', 40.00, 'Pengukuran daya nalar, logika, matematika, dan wawasan umum'),
    ('Tes Diniyyah & Keislaman', 'diniyyah', 30.00, 'Pengukuran kemampuan membaca Al-Quran, tajwid, dan ibadah praktis')
ON CONFLICT (kode_kategori) DO UPDATE SET
    nama_kategori = EXCLUDED.nama_kategori,
    persentase_bobot = EXCLUDED.persentase_bobot,
    keterangan = EXCLUDED.keterangan;

-- 2. SEED NON-TRANSACTIONAL CONFIGURATIONS IN SPMB_APP_STATE
-- (Hanya konfigurasi sekolah & tampilan, BUKAN data akun/siswa/pembayaran)
INSERT INTO public.spmb_app_state (key, payload, updated_at)
VALUES 
(
    'school_info',
    '{
        "name": "SMP AL-HADIID CILEUNGSI",
        "subTitle": "Dr. H. Ahmad Dahlan, M.Pd.",
        "address": "Jl. Raya Cileungsi - Setu KM. 3,5, Cileungsi, Kec. Cileungsi, Kab. Bogor, Jawa Barat 16820",
        "phone": "(021) 8249 1234",
        "email": "info@alhadiid.sch.id",
        "academicYear": "2027/2028",
        "bankName": "Bank Syariah Indonesia (BSI)",
        "bankAccountNumber": "7144556677",
        "bankAccountHolder": "SMP Al-Hadiid SPMB",
        "waveName": "Gelombang 1 (Reguler & Beasiswa)",
        "waveSchedule": "1 November 2026 - 31 Maret 2027"
    }'::jsonb,
    NOW()
),
(
    'website_config',
    '{
        "heroTitle": "Penerimaan Murid Baru (SPMB) SMP Al-Hadiid Cileungsi",
        "heroSubtitle": "Membentuk Generasi Qurani, Berakhlak Mulia, dan Unggul dalam Prestasi Akademik",
        "announcement": "Pendaftaran Gelombang 1 TP 2027/2028 Resmi Dibuka!",
        "contactWhatsApp": "6281234567890"
    }'::jsonb,
    NOW()
),
(
    'class_quotas',
    '[
        {"id": "q1", "wave": "Gelombang 1", "category": "Reguler", "target": 64, "filled": 0},
        {"id": "q2", "wave": "Gelombang 1", "category": "Prestasi", "target": 32, "filled": 0},
        {"id": "q3", "wave": "Gelombang 1", "category": "Tahfidz", "target": 32, "filled": 0}
    ]'::jsonb,
    NOW()
)
ON CONFLICT (key) DO NOTHING;
