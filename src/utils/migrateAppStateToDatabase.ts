// =====================================================================
// src/utils/migrateAppStateToDatabase.ts
// Single Source of Truth - Migration Engine
// Memindahkan seluruh data transaksional dari spmb_app_state ke Database Sebenarnya:
//   - public.users (Akun Pengguna & Siswa)
//   - public.students (Pendaftaran Siswa Lengkap)
//   - public.payments (Pembayaran Formulir & BAM)
//   - public.soal (Bank Soal CBT)
// =====================================================================

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { StudentData, UserAccount, FormPaymentRecord, BamPaymentRecord, ExamQuestion } from '../types';
import { mapStudentToRow } from '../repositories/StudentRepository';

export interface LegacyAppStateStatus {
  hasLegacyData: boolean;
  totalLegacyRecords: number;
  keysFound: string[];
  counts: {
    students: number;
    users: number;
    formPayments: number;
    bamPayments: number;
    questions: number;
  };
}

export interface MigrationExecutionResult {
  success: boolean;
  message: string;
  studentsMigrated: number;
  usersMigrated: number;
  paymentsMigrated: number;
  questionsMigrated: number;
  keysRemoved: string[];
  errors: string[];
}

export const TRANSACTIONAL_STATE_KEYS = [
  'students',
  'spmb_alhadiid_students',
  'users_db',
  'users',
  'form_payments',
  'bam_payments',
  'question_bank',
  'payments',
];

/**
 * Memeriksa apakah masih terdapat sisa data transaksional di tabel spmb_app_state.
 */
export async function checkLegacyAppStateStatus(): Promise<LegacyAppStateStatus> {
  const result: LegacyAppStateStatus = {
    hasLegacyData: false,
    totalLegacyRecords: 0,
    keysFound: [],
    counts: {
      students: 0,
      users: 0,
      formPayments: 0,
      bamPayments: 0,
      questions: 0,
    },
  };

  if (!isSupabaseConfigured()) {
    return result;
  }

  try {
    const { data, error } = await supabase
      .from('spmb_app_state')
      .select('key, payload')
      .in('key', TRANSACTIONAL_STATE_KEYS);

    if (error || !data) {
      return result;
    }

    data.forEach((row: any) => {
      const key = row.key;
      const payload = row.payload;
      const count = Array.isArray(payload) ? payload.length : 1;

      if (count > 0) {
        result.keysFound.push(key);
        result.totalLegacyRecords += count;

        if (key === 'students' || key === 'spmb_alhadiid_students') {
          result.counts.students += count;
        } else if (key === 'users_db' || key === 'users') {
          result.counts.users += count;
        } else if (key === 'form_payments') {
          result.counts.formPayments += count;
        } else if (key === 'bam_payments') {
          result.counts.bamPayments += count;
        } else if (key === 'question_bank') {
          result.counts.questions += count;
        }
      }
    });

    result.hasLegacyData = result.keysFound.length > 0;
  } catch (err) {
    console.warn('Gagal memeriksa status legacy spmb_app_state:', err);
  }

  return result;
}

/**
 * Menjalankan proses pemindahan seluruh data dari spmb_app_state ke tabel relasional Supabase.
 */
export async function migrateAllAppStateToRelationalDatabase(): Promise<MigrationExecutionResult> {
  const result: MigrationExecutionResult = {
    success: false,
    message: '',
    studentsMigrated: 0,
    usersMigrated: 0,
    paymentsMigrated: 0,
    questionsMigrated: 0,
    keysRemoved: [],
    errors: [],
  };

  if (!isSupabaseConfigured()) {
    result.message = 'Supabase belum terkonfigurasi. Tidak dapat memigrasikan database.';
    return result;
  }

  try {
    // 1. Ambil semua baris transaksional dari spmb_app_state
    const { data: legacyRows, error: fetchErr } = await supabase
      .from('spmb_app_state')
      .select('key, payload')
      .in('key', TRANSACTIONAL_STATE_KEYS);

    if (fetchErr) {
      result.errors.push(`Gagal membaca data dari spmb_app_state: ${fetchErr.message}`);
      result.message = 'Gagal mengakses spmb_app_state';
      return result;
    }

    if (!legacyRows || legacyRows.length === 0) {
      result.success = true;
      result.message = 'spmb_app_state sudah bersih. Seluruh data sudah berada di tabel database relasional sebenarnya.';
      return result;
    }

    const stateMap = new Map<string, any>();
    legacyRows.forEach((r: any) => {
      stateMap.set(r.key, r.payload);
    });

    // 2. MIGRASI USERS: Dari users_db / users
    const usersPayload = stateMap.get('users_db') || stateMap.get('users') || [];
    if (Array.isArray(usersPayload) && usersPayload.length > 0) {
      const userRows = usersPayload.map((u: Partial<UserAccount>) => ({
        id: u.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: u.name || 'Pengguna',
        email: (u.email || `${u.id}@alhadiid.sch.id`).trim().toLowerCase(),
        username: u.username || null,
        phone: u.phone || '081234567890',
        role: u.role || 'student',
        registration_number: u.registrationNumber || null,
        status: u.status || 'active',
        must_change_password: !!u.mustChangePassword,
        created_at: u.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error: usersErr } = await supabase
        .from('users')
        .upsert(userRows, { onConflict: 'id' });

      if (usersErr) {
        result.errors.push(`Migrasi users gagal: ${usersErr.message}`);
      } else {
        result.usersMigrated += userRows.length;
      }
    }

    // 3. MIGRASI STUDENTS: Dari students / spmb_alhadiid_students
    const studentsPayload = stateMap.get('students') || stateMap.get('spmb_alhadiid_students') || [];
    if (Array.isArray(studentsPayload) && studentsPayload.length > 0) {
      // Pastikan ada user account terlebih dahulu untuk setiap student (karena Foreign Key)
      const studentUserRows = studentsPayload.map((s: Partial<StudentData>) => ({
        id: s.id || `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: s.fullName || 'Calon Murid',
        email: (s.userEmail || `${s.id}@spmb.alhadiid.sch.id`).trim().toLowerCase(),
        phone: s.phone || '081234567890',
        role: 'student',
        registration_number: s.registrationNumber || `SPMB2027${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'active',
        must_change_password: false,
        created_at: s.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error: stUsersErr } = await supabase
        .from('users')
        .upsert(studentUserRows, { onConflict: 'id' });

      if (stUsersErr) {
        result.errors.push(`Pembuatan akun pengguna siswa gagal: ${stUsersErr.message}`);
      } else {
        result.usersMigrated += studentUserRows.length;
      }

      // Upsert ke public.students dengan sanitasi
      const studentDbRows = studentsPayload.map((s: Partial<StudentData>) => {
        const row = mapStudentToRow(s);
        if (!row.id) row.id = `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        if (!row.registration_number) row.registration_number = `SPMB2027${Math.floor(1000 + Math.random() * 9000)}`;
        if (!row.user_email) row.user_email = `${row.id}@spmb.alhadiid.sch.id`;
        if (!row.full_name) row.full_name = 'Calon Murid';
        if (!row.phone) row.phone = '081234567890';
        if (!row.status) row.status = 'draft';
        return row;
      });

      const { error: stErr } = await supabase
        .from('students')
        .upsert(studentDbRows, { onConflict: 'id' });

      if (stErr) {
        result.errors.push(`Migrasi students gagal: ${stErr.message}`);
      } else {
        result.studentsMigrated += studentDbRows.length;
      }
    }

    // 4. MIGRASI PEMBAYARAN FORMULIR: Dari form_payments ke public.payments
    const formPayPayload = stateMap.get('form_payments') || [];
    if (Array.isArray(formPayPayload) && formPayPayload.length > 0) {
      for (const fp of formPayPayload as FormPaymentRecord[]) {
        if (!fp.studentId || fp.studentId.startsWith('std_00') || fp.studentId === 'std_001') continue;

        // Pastikan student ada di tabel students untuk memenuhi Foreign Key
        const { data: existingStudent } = await supabase
          .from('students')
          .select('id')
          .eq('id', fp.studentId)
          .maybeSingle();

        if (!existingStudent) {
          const stubEmail = ((fp as any).userEmail || `${fp.studentId}@spmb.alhadiid.sch.id`).trim().toLowerCase();
          await supabase.from('users').upsert({
            id: fp.studentId,
            name: fp.studentName || 'Calon Siswa',
            email: stubEmail,
            phone: '081234567890',
            role: 'student',
            registration_number: fp.registrationNumber || 'SPMB-FORM',
            status: 'active',
            must_change_password: false,
          }, { onConflict: 'id' });

          await supabase.from('students').upsert({
            id: fp.studentId,
            user_email: stubEmail,
            full_name: fp.studentName || 'Calon Siswa',
            registration_number: fp.registrationNumber || 'SPMB-FORM',
            status: 'submitted',
            phone: '081234567890',
            is_form_verified: true,
            form_payment_status: 'verified',
            form_payment_amount: Number(fp.amount || 200000),
          }, { onConflict: 'id' });
        }

        const paymentRow = {
          id: fp.id || `pay_form_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          student_id: fp.studentId,
          registration_number: fp.registrationNumber || 'SPMB-FORM',
          student_name: fp.studentName || 'Calon Siswa',
          payment_type: 'formulir',
          amount: Number(fp.amount || 200000),
          status: 'verified',
          payment_method: 'manual_transfer',
          proof_url: fp.proofUrl || null,
          notes: fp.notes || 'Migrasi otomatis dari spmb_app_state',
          created_at: fp.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: payErr } = await supabase
          .from('payments')
          .upsert(paymentRow, { onConflict: 'id' });

        if (!payErr) {
          result.paymentsMigrated++;
          // Update status pembayaran formulir di tabel students
          await supabase
            .from('students')
            .update({
              is_form_verified: true,
              form_payment_status: 'verified',
              form_payment_amount: paymentRow.amount,
              form_payment_proof_url: paymentRow.proof_url,
              updated_at: new Date().toISOString(),
            })
            .eq('id', fp.studentId);
        } else {
          result.errors.push(`Migrasi pembayaran formulir [${fp.id}] gagal: ${payErr.message}`);
        }
      }
    }

    // 5. MIGRASI PEMBAYARAN BAM: Dari bam_payments ke public.payments
    const bamPayPayload = stateMap.get('bam_payments') || [];
    if (Array.isArray(bamPayPayload) && bamPayPayload.length > 0) {
      for (const bp of bamPayPayload as BamPaymentRecord[]) {
        if (!bp.studentId || bp.studentId.startsWith('std_00') || bp.studentId === 'std_001') continue;
        const amount = Number(bp.amountPaid || 0);
        if (amount <= 0) continue;

        // Pastikan student ada di tabel students untuk memenuhi Foreign Key
        const { data: existingStudent } = await supabase
          .from('students')
          .select('id')
          .eq('id', bp.studentId)
          .maybeSingle();

        if (!existingStudent) {
          const stubEmail = `${bp.studentId}@spmb.alhadiid.sch.id`.toLowerCase();
          await supabase.from('users').upsert({
            id: bp.studentId,
            name: bp.studentName || 'Calon Siswa',
            email: stubEmail,
            phone: '081234567890',
            role: 'student',
            registration_number: bp.registrationNumber || 'SPMB-BAM',
            status: 'active',
            must_change_password: false,
          }, { onConflict: 'id' });

          await supabase.from('students').upsert({
            id: bp.studentId,
            user_email: stubEmail,
            full_name: bp.studentName || 'Calon Siswa',
            registration_number: bp.registrationNumber || 'SPMB-BAM',
            status: 'submitted',
            phone: '081234567890',
            initial_payment_status: 'verified',
            initial_payment_amount: amount,
          }, { onConflict: 'id' });
        }

        const paymentRow = {
          id: bp.id || `pay_bam_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          student_id: bp.studentId,
          registration_number: bp.registrationNumber || 'SPMB-BAM',
          student_name: bp.studentName || 'Calon Siswa',
          payment_type: 'daftar_ulang',
          amount,
          status: 'verified',
          payment_method: 'manual_transfer',
          proof_url: bp.proofUrl || null,
          notes: bp.notes || 'Migrasi otomatis dari spmb_app_state',
          created_at: bp.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: payErr } = await supabase
          .from('payments')
          .upsert(paymentRow, { onConflict: 'id' });

        if (!payErr) {
          result.paymentsMigrated++;
          // Update nominal BAM di tabel students
          await supabase
            .from('students')
            .update({
              initial_payment_amount: paymentRow.amount,
              initial_payment_status: 'verified',
              initial_payment_proof_url: paymentRow.proof_url,
              updated_at: new Date().toISOString(),
            })
            .eq('id', bp.studentId);
        } else {
          result.errors.push(`Migrasi pembayaran BAM [${bp.id}] gagal: ${payErr.message}`);
        }
      }
    }

    // 6. MIGRASI QUESTION BANK: Dari question_bank ke public.soal
    const questionsPayload = stateMap.get('question_bank') || [];
    if (Array.isArray(questionsPayload) && questionsPayload.length > 0) {
      const letterMap = ['A', 'B', 'C', 'D'];
      const soalRows = questionsPayload.map((q: Partial<ExamQuestion>) => {
        const catCode = q.category || 'diagnostik';
        return {
          id: q.id,
          kategori_kode: catCode,
          pertanyaan: q.questionText || '',
          pilihan_a: q.options?.[0] || '',
          pilihan_b: q.options?.[1] || '',
          pilihan_c: q.options?.[2] || '',
          pilihan_d: q.options?.[3] || '',
          jawaban_benar: letterMap[q.correctOptionIndex ?? 0] || 'A',
          bobot: Number(q.points || 10),
          level_kesulitan: q.difficulty || 'medium',
          gambar_url: q.imageUrl || null,
          aktif: q.isActive !== false,
        };
      });

      const { error: soalErr } = await supabase
        .from('soal')
        .upsert(soalRows, { onConflict: 'id' });

      if (soalErr) {
        result.errors.push(`Migrasi bank soal ke public.soal gagal: ${soalErr.message}`);
      } else {
        result.questionsMigrated += soalRows.length;
      }
    }

    // 7. PEMBERSIHAN: Hapus kunci transaksional dari spmb_app_state
    const keysToDelete = Array.from(stateMap.keys()).filter((k) =>
      TRANSACTIONAL_STATE_KEYS.includes(k)
    );

    if (keysToDelete.length > 0) {
      const { error: delErr } = await supabase
        .from('spmb_app_state')
        .delete()
        .in('key', keysToDelete);

      if (delErr) {
        result.errors.push(`Pembersihan kunci legacy dari spmb_app_state gagal: ${delErr.message}`);
      } else {
        result.keysRemoved = keysToDelete;
      }
    }

    result.success = result.errors.length === 0 || (result.studentsMigrated > 0 || result.usersMigrated > 0);
    result.message = `Migrasi selesai! Berhasil memindahkan ${result.studentsMigrated} siswa, ${result.usersMigrated} akun pengguna, ${result.paymentsMigrated} transaksi pembayaran, dan ${result.questionsMigrated} soal ke database relasional.`;
  } catch (err: any) {
    result.errors.push(err?.message || String(err));
    result.message = 'Terjadi kesalahan sistem saat memproses migrasi data.';
  }

  return result;
}
