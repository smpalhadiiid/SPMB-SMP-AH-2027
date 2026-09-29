-- =====================================================================
-- 010_migrate_app_state_to_relational.sql
-- Pemindahan Data Lengkap dari spmb_app_state ke Database Relasional
-- SPMB SMP Al-Hadiid Cileungsi (Transisi V1 ke V2 Selesai)
-- =====================================================================

DO $$
DECLARE
    v_users_migrated int := 0;
    v_students_migrated int := 0;
    v_payments_migrated int := 0;
    v_soal_migrated int := 0;
    v_keys_deleted int := 0;
    v_kategori_default_id UUID;
BEGIN
    RAISE NOTICE '>>> MEMULAI MIGRASI DATA DARI spmb_app_state KE TABEL RELASIONAL <<<';

    -- -----------------------------------------------------------------
    -- TAHAP 1: Pindahkan Pengguna dari users_db / users ke public.users
    -- -----------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM public.spmb_app_state WHERE key IN ('users_db', 'users')) THEN
        WITH raw_users AS (
            SELECT DISTINCT ON (COALESCE(elem->>'id', elem->>'email'))
                COALESCE(elem->>'id', 'usr_' || replace(gen_random_uuid()::text, '-', '')) AS id,
                COALESCE(elem->>'name', elem->>'fullName', 'Pengguna') AS name,
                LOWER(TRIM(COALESCE(elem->>'email', (elem->>'id') || '@alhadiid.sch.id'))) AS email,
                elem->>'username' AS username,
                COALESCE(elem->>'phone', '081234567890') AS phone,
                COALESCE(elem->>'role', 'student') AS role,
                elem->>'registrationNumber' AS registration_number,
                COALESCE(elem->>'status', 'active') AS status,
                COALESCE((elem->>'mustChangePassword')::boolean, false) AS must_change_password,
                COALESCE((elem->>'createdAt')::timestamptz, NOW()) AS created_at
            FROM public.spmb_app_state,
                 jsonb_array_elements(payload) AS elem
            WHERE key IN ('users_db', 'users')
              AND jsonb_typeof(payload) = 'array'
        )
        INSERT INTO public.users (
            id, name, email, username, phone, role, registration_number,
            status, must_change_password, created_at, updated_at
        )
        SELECT 
            id, name, email, username, phone, role, registration_number,
            status, must_change_password, created_at, NOW()
        FROM raw_users
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            phone = EXCLUDED.phone,
            role = EXCLUDED.role,
            registration_number = COALESCE(EXCLUDED.registration_number, public.users.registration_number),
            updated_at = NOW();

        GET DIAGNOSTICS v_users_migrated = ROW_COUNT;
        RAISE NOTICE '[OK] % akun pengguna dari users_db berhasil dipindahkan/disinkronkan ke public.users.', v_users_migrated;
    END IF;

    -- -----------------------------------------------------------------
    -- TAHAP 2: Buat Akun Pengguna untuk Setiap Siswa di spmb_app_state
    -- Karena public.students(id) memiliki Foreign Key ke public.users(id)
    -- -----------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM public.spmb_app_state WHERE key IN ('students', 'spmb_alhadiid_students')) THEN
        WITH student_users AS (
            SELECT DISTINCT ON (COALESCE(elem->>'id', elem->>'registrationNumber'))
                COALESCE(elem->>'id', 'std_' || replace(gen_random_uuid()::text, '-', '')) AS id,
                COALESCE(elem->>'fullName', 'Calon Murid') AS name,
                LOWER(TRIM(COALESCE(elem->>'userEmail', (elem->>'id') || '@spmb.alhadiid.sch.id'))) AS email,
                elem->>'registrationNumber' AS registration_number,
                COALESCE(elem->>'phone', '081234567890') AS phone,
                'student' AS role,
                'active' AS status,
                COALESCE((elem->>'createdAt')::timestamptz, NOW()) AS created_at
            FROM public.spmb_app_state,
                 jsonb_array_elements(payload) AS elem
            WHERE key IN ('students', 'spmb_alhadiid_students')
              AND jsonb_typeof(payload) = 'array'
        )
        INSERT INTO public.users (
            id, name, email, phone, role, registration_number,
            status, must_change_password, created_at, updated_at
        )
        SELECT 
            id, name, email, phone, role, registration_number,
            status, false, created_at, NOW()
        FROM student_users
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            registration_number = COALESCE(EXCLUDED.registration_number, public.users.registration_number),
            updated_at = NOW();

        -- -----------------------------------------------------------------
        -- TAHAP 3: Pindahkan Calon Murid ke public.students
        -- -----------------------------------------------------------------
        WITH raw_students AS (
            SELECT DISTINCT ON (COALESCE(elem->>'id', elem->>'registrationNumber'))
                COALESCE(elem->>'id', 'std_' || replace(gen_random_uuid()::text, '-', '')) AS id,
                COALESCE(elem->>'registrationNumber', 'SPMB2027' || floor(1000 + random() * 9000)::text) AS registration_number,
                COALESCE(elem->>'status', 'draft') AS status,
                LOWER(TRIM(COALESCE(elem->>'userEmail', (elem->>'id') || '@spmb.alhadiid.sch.id'))) AS user_email,
                COALESCE(elem->>'fullName', 'Calon Murid') AS full_name,
                COALESCE(elem->>'phone', '081234567890') AS phone,
                COALESCE((elem->>'isFormVerified')::boolean, (elem->>'formPaymentStatus') = 'verified', false) AS is_form_verified,
                COALESCE((elem->>'formPaymentAmount')::numeric, 200000) AS form_payment_amount,
                COALESCE(elem->>'formPaymentStatus', 'unpaid') AS form_payment_status,
                elem->>'formPaymentProofUrl' AS form_payment_proof_url,
                elem->>'formPaymentDate' AS form_payment_date,
                elem->>'formPaymentNotes' AS form_payment_notes,
                elem->>'nik' AS nik,
                elem->>'nisn' AS nisn,
                elem->>'birthPlace' AS birth_place,
                elem->>'birthDate' AS birth_date,
                CASE 
                    WHEN elem->>'gender' IN ('Laki-laki', 'Perempuan') THEN elem->>'gender'
                    ELSE 'Laki-laki'
                END AS gender,
                COALESCE(elem->>'religion', 'Islam') AS religion,
                elem->>'childOrder' AS child_order,
                elem->>'totalSiblings' AS total_siblings,
                elem->>'address' AS address,
                elem->>'village' AS village,
                elem->>'subdistrict' AS subdistrict,
                elem->>'city' AS city,
                elem->>'province' AS province,
                elem->>'postalCode' AS postal_code,
                elem->>'previousSchoolName' AS previous_school_name,
                elem->>'previousSchoolNpsn' AS previous_school_npsn,
                elem->>'previousSchoolAddress' AS previous_school_address,
                elem->>'fatherName' AS father_name,
                elem->>'fatherBirthPlace' AS father_birth_place,
                elem->>'fatherBirthDate' AS father_birth_date,
                elem->>'fatherJob' AS father_job,
                elem->>'fatherEducation' AS father_education,
                elem->>'fatherPhone' AS father_phone,
                elem->>'motherName' AS mother_name,
                elem->>'motherBirthPlace' AS mother_birth_place,
                elem->>'motherBirthDate' AS mother_birth_date,
                elem->>'motherJob' AS mother_job,
                elem->>'motherEducation' AS mother_education,
                elem->>'motherPhone' AS mother_phone,
                elem->>'guardianName' AS guardian_name,
                elem->>'guardianRelation' AS guardian_relation,
                elem->>'guardianPhone' AS guardian_phone,
                elem->>'photoUrl' AS photo_url,
                elem->>'kkUrl' AS kk_url,
                elem->>'birthCertUrl' AS birth_cert_url,
                elem->>'reportCardUrl' AS report_card_url,
                elem->>'kipUrl' AS kip_url,
                elem->>'certificateUrl' AS certificate_url,
                COALESCE((elem->>'isTestActive')::boolean, false) AS is_test_active,
                COALESCE((elem->>'testSubmitted')::boolean, false) AS test_submitted,
                COALESCE(elem->'testAnswers', '{}'::jsonb) AS test_answers,
                elem->>'testScheduleDate' AS test_schedule_date,
                elem->>'testLocation' AS test_location,
                (elem->>'diagnosticScore')::numeric AS diagnostic_score,
                (elem->>'generalScore')::numeric AS general_score,
                (elem->>'religiousScore')::numeric AS religious_score,
                (elem->>'finalScore')::numeric AS final_score,
                elem->>'testNotes' AS test_notes,
                elem->>'initialPaymentProofUrl' AS initial_payment_proof_url,
                elem->>'initialPaymentDate' AS initial_payment_date,
                COALESCE((elem->>'initialPaymentAmount')::numeric, 0) AS initial_payment_amount,
                COALESCE(elem->>'initialPaymentStatus', 'unpaid') AS initial_payment_status,
                elem->>'initialPaymentNotes' AS initial_payment_notes,
                elem->>'assignedClassId' AS assigned_class_id,
                elem->>'assignedClassName' AS assigned_class_name,
                elem->>'assignedHomeroomTeacher' AS assigned_homeroom_teacher,
                elem->>'firstDayDate' AS first_day_date,
                elem->>'mplsInfo' AS mpls_info,
                COALESCE((elem->>'version')::int, 1) AS version,
                COALESCE((elem->>'createdAt')::timestamptz, NOW()) AS created_at
            FROM public.spmb_app_state,
                 jsonb_array_elements(payload) AS elem
            WHERE key IN ('students', 'spmb_alhadiid_students')
              AND jsonb_typeof(payload) = 'array'
        )
        INSERT INTO public.students (
            id, registration_number, status, user_email, full_name, phone,
            is_form_verified, form_payment_amount, form_payment_status, form_payment_proof_url,
            form_payment_date, form_payment_notes, nik, nisn, birth_place, birth_date,
            gender, religion, child_order, total_siblings, address, village, subdistrict,
            city, province, postal_code, previous_school_name, previous_school_npsn,
            previous_school_address, father_name, father_birth_place, father_birth_date,
            father_job, father_education, father_phone, mother_name, mother_birth_place,
            mother_birth_date, mother_job, mother_education, mother_phone, guardian_name,
            guardian_relation, guardian_phone, photo_url, kk_url, birth_cert_url,
            report_card_url, kip_url, certificate_url, is_test_active, test_submitted,
            test_answers, test_schedule_date, test_location, diagnostic_score,
            general_score, religious_score, final_score, test_notes,
            initial_payment_proof_url, initial_payment_date, initial_payment_amount,
            initial_payment_status, initial_payment_notes, assigned_class_id,
            assigned_class_name, assigned_homeroom_teacher, first_day_date,
            mpls_info, version, created_at, updated_at
        )
        SELECT 
            id, registration_number, status, user_email, full_name, phone,
            is_form_verified, form_payment_amount, form_payment_status, form_payment_proof_url,
            form_payment_date, form_payment_notes, nik, nisn, birth_place, birth_date,
            gender, religion, child_order, total_siblings, address, village, subdistrict,
            city, province, postal_code, previous_school_name, previous_school_npsn,
            previous_school_address, father_name, father_birth_place, father_birth_date,
            father_job, father_education, father_phone, mother_name, mother_birth_place,
            mother_birth_date, mother_job, mother_education, mother_phone, guardian_name,
            guardian_relation, guardian_phone, photo_url, kk_url, birth_cert_url,
            report_card_url, kip_url, certificate_url, is_test_active, test_submitted,
            test_answers, test_schedule_date, test_location, diagnostic_score,
            general_score, religious_score, final_score, test_notes,
            initial_payment_proof_url, initial_payment_date, initial_payment_amount,
            initial_payment_status, initial_payment_notes, assigned_class_id,
            assigned_class_name, assigned_homeroom_teacher, first_day_date,
            mpls_info, version, created_at, NOW()
        FROM raw_students
        ON CONFLICT (id) DO UPDATE SET
            registration_number = EXCLUDED.registration_number,
            full_name = EXCLUDED.full_name,
            phone = EXCLUDED.phone,
            status = EXCLUDED.status,
            form_payment_status = EXCLUDED.form_payment_status,
            initial_payment_status = EXCLUDED.initial_payment_status,
            updated_at = NOW();

        GET DIAGNOSTICS v_students_migrated = ROW_COUNT;
        RAISE NOTICE '[OK] % data pendaftaran siswa berhasil dipindahkan ke public.students.', v_students_migrated;
    END IF;

    -- -----------------------------------------------------------------
    -- TAHAP 4: Pindahkan Data Pembayaran Formulir ke public.payments
    -- -----------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM public.spmb_app_state WHERE key = 'form_payments') THEN
        WITH form_pay AS (
            SELECT 
                COALESCE(elem->>'id', 'pay_form_' || replace(gen_random_uuid()::text, '-', '')) AS id,
                elem->>'studentId' AS student_id,
                COALESCE(elem->>'registrationNumber', s.registration_number, 'SPMB-FORM') AS registration_number,
                COALESCE(elem->>'studentName', s.full_name, 'Calon Siswa') AS student_name,
                'form' AS payment_type,
                COALESCE((elem->>'amount')::numeric, 200000) AS amount,
                'verified' AS status,
                'manual_transfer' AS payment_method,
                elem->>'proofUrl' AS proof_url,
                elem->>'paymentDate' AS payment_date_str,
                elem->>'notes' AS notes,
                COALESCE((elem->>'createdAt')::timestamptz, NOW()) AS created_at
            FROM public.spmb_app_state,
                 jsonb_array_elements(payload) AS elem
            LEFT JOIN public.students s ON s.id = elem->>'studentId'
            WHERE key = 'form_payments'
              AND jsonb_typeof(payload) = 'array'
              AND elem->>'studentId' IS NOT NULL
              AND EXISTS (SELECT 1 FROM public.students WHERE id = elem->>'studentId')
        )
        INSERT INTO public.payments (
            id, student_id, registration_number, student_name, payment_type,
            amount, status, payment_method, proof_url, notes, created_at, updated_at
        )
        SELECT 
            id, student_id, registration_number, student_name, payment_type,
            amount, status, payment_method, proof_url, notes, created_at, NOW()
        FROM form_pay
        ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            amount = EXCLUDED.amount,
            updated_at = NOW();

        -- Sinkronkan juga status verifikasi di tabel students
        UPDATE public.students s
        SET 
            is_form_verified = true,
            form_payment_status = 'verified',
            updated_at = NOW()
        FROM form_pay fp
        WHERE s.id = fp.student_id;

        RAISE NOTICE '[OK] Data pembayaran formulir berhasil dipindahkan ke public.payments.';
    END IF;

    -- -----------------------------------------------------------------
    -- TAHAP 5: Pindahkan Data Pembayaran BAM ke public.payments
    -- -----------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM public.spmb_app_state WHERE key = 'bam_payments') THEN
        WITH bam_pay AS (
            SELECT 
                COALESCE(elem->>'id', 'pay_bam_' || replace(gen_random_uuid()::text, '-', '')) AS id,
                elem->>'studentId' AS student_id,
                COALESCE(elem->>'registrationNumber', s.registration_number, 'SPMB-BAM') AS registration_number,
                COALESCE(elem->>'studentName', s.full_name, 'Calon Siswa') AS student_name,
                'bam' AS payment_type,
                COALESCE((elem->>'amountPaid')::numeric, 0) AS amount,
                'verified' AS status,
                'manual_transfer' AS payment_method,
                elem->>'proofUrl' AS proof_url,
                elem->>'notes' AS notes,
                COALESCE((elem->>'createdAt')::timestamptz, NOW()) AS created_at
            FROM public.spmb_app_state,
                 jsonb_array_elements(payload) AS elem
            LEFT JOIN public.students s ON s.id = elem->>'studentId'
            WHERE key = 'bam_payments'
              AND jsonb_typeof(payload) = 'array'
              AND elem->>'studentId' IS NOT NULL
              AND EXISTS (SELECT 1 FROM public.students WHERE id = elem->>'studentId')
        )
        INSERT INTO public.payments (
            id, student_id, registration_number, student_name, payment_type,
            amount, status, payment_method, proof_url, notes, created_at, updated_at
        )
        SELECT 
            id, student_id, registration_number, student_name, payment_type,
            amount, status, payment_method, proof_url, notes, created_at, NOW()
        FROM bam_pay
        WHERE amount > 0
        ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            amount = EXCLUDED.amount,
            updated_at = NOW();

        -- Update nominal initial_payment di students
        UPDATE public.students s
        SET 
            initial_payment_amount = bp.amount,
            initial_payment_status = 'verified',
            updated_at = NOW()
        FROM bam_pay bp
        WHERE s.id = bp.student_id;

        RAISE NOTICE '[OK] Data pembayaran BAM berhasil dipindahkan ke public.payments.';
    END IF;

    -- -----------------------------------------------------------------
    -- TAHAP 6: Pindahkan Bank Soal CBT ke public.soal
    -- -----------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM public.spmb_app_state WHERE key = 'question_bank') THEN
        -- Ambil / Buat kategori soal diagnostik default jika belum ada
        SELECT id INTO v_kategori_default_id FROM public.kategori_soal WHERE kode_kategori = 'diagnostik' LIMIT 1;
        IF v_kategori_default_id IS NULL THEN
            INSERT INTO public.kategori_soal (nama_kategori, kode_kategori, deskripsi)
            VALUES ('Tes Diagnostik Skolastik', 'diagnostik', 'Kategori default soal SPMB')
            RETURNING id INTO v_kategori_default_id;
        END IF;

        WITH raw_soal AS (
            SELECT 
                gen_random_uuid() AS new_id,
                COALESCE(ks.id, v_kategori_default_id) AS kategori_id,
                COALESCE(elem->>'questionText', elem->>'pertanyaan', 'Pertanyaan') AS pertanyaan,
                COALESCE(elem->'options'->>0, elem->>'pilihan_a', '') AS pilihan_a,
                COALESCE(elem->'options'->>1, elem->>'pilihan_b', '') AS pilihan_b,
                COALESCE(elem->'options'->>2, elem->>'pilihan_c', '') AS pilihan_c,
                COALESCE(elem->'options'->>3, elem->>'pilihan_d', '') AS pilihan_d,
                CASE 
                    WHEN elem->>'correctOptionIndex' = '1' THEN 'B'
                    WHEN elem->>'correctOptionIndex' = '2' THEN 'C'
                    WHEN elem->>'correctOptionIndex' = '3' THEN 'D'
                    WHEN elem->>'jawaban_benar' IN ('A', 'B', 'C', 'D') THEN elem->>'jawaban_benar'
                    ELSE 'A'
                END AS jawaban_benar,
                COALESCE((elem->>'points')::numeric, 1.00) AS bobot,
                elem->>'imageUrl' AS gambar_url,
                COALESCE((elem->>'isActive')::boolean, true) AS aktif
            FROM public.spmb_app_state,
                 jsonb_array_elements(payload) AS elem
            LEFT JOIN public.kategori_soal ks ON ks.kode_kategori = COALESCE(elem->>'category', 'diagnostik')
            WHERE key = 'question_bank'
              AND jsonb_typeof(payload) = 'array'
        )
        INSERT INTO public.soal (
            id, kategori_id, pertanyaan, pilihan_a, pilihan_b, pilihan_c,
            pilihan_d, jawaban_benar, bobot, gambar_url, aktif, created_at, updated_at
        )
        SELECT 
            new_id, kategori_id, pertanyaan, pilihan_a, pilihan_b, pilihan_c,
            pilihan_d, jawaban_benar, bobot, gambar_url, aktif, NOW(), NOW()
        FROM raw_soal
        WHERE pertanyaan <> '';

        GET DIAGNOSTICS v_soal_migrated = ROW_COUNT;
        RAISE NOTICE '[OK] % soal ujian berhasil dipindahkan ke public.soal.', v_soal_migrated;
    END IF;

    -- -----------------------------------------------------------------
    -- TAHAP 7: Hapus Key Transaksional yang Sudah Berpindah dari spmb_app_state
    -- Membersihkan spmb_app_state agar hanya berisi data non-transaksional
    -- -----------------------------------------------------------------
    DELETE FROM public.spmb_app_state 
    WHERE key IN (
        'students', 
        'spmb_alhadiid_students', 
        'users_db', 
        'users', 
        'form_payments', 
        'bam_payments', 
        'payments', 
        'question_bank'
    );
    GET DIAGNOSTICS v_keys_deleted = ROW_COUNT;

    RAISE NOTICE '[OK] % key transaksional lama berhasil dihapus dari spmb_app_state.', v_keys_deleted;
    RAISE NOTICE '>>> MIGRASI SELESAI: SEMUA DATA KINI BERADA DI DATABASE SEBENARNYA (RELASIONAL) <<<';
END $$;
