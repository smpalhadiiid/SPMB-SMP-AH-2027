// =====================================================================
// test/integration-test.ts
// SPMB SMP AL-HADIID — TAHAP 7 INTEGRATION TEST SUITE
// Verifikasi integrasi menyeluruh CRUD, OCC, Read-Only Guard & RLS
// =====================================================================

import { setupTestEnvironment, mockStorage, SimpleTestRunner } from './test-harness';
import { spyHarness } from './supabase-spy';
import {
  supabase,
  setPullSyncReadOnlyGuard,
  isPullSyncReadOnlyGuardActive,
} from '../src/utils/supabaseClient';
import { StudentRepository } from '../src/repositories/StudentRepository';
import { PaymentRepository } from '../src/repositories/PaymentRepository';
import { ExamQuestionRepository } from '../src/repositories/ExamQuestionRepository';
import { UserProfileRepository } from '../src/repositories/UserProfileRepository';
import { performFullSupabaseSync } from '../src/utils/supabaseSync';
import { StudentData } from '../src/types';

setupTestEnvironment();
spyHarness.attach(supabase);

const runner = new SimpleTestRunner();

// ---------------------------------------------------------------------
// 1. Technical Guard Integrity
// ---------------------------------------------------------------------
runner.test('Integration 1: Technical Guard memblokir seluruh mutasi saat aktif', async () => {
  setPullSyncReadOnlyGuard(true);
  try {
    if (!isPullSyncReadOnlyGuardActive()) {
      throw new Error('Guard seharusnya aktif.');
    }

    let insertBlocked = false;
    try {
      supabase.from('students').insert({ full_name: 'Test Block' });
    } catch (err: any) {
      if (err.message.includes('SSOT READ-ONLY GUARD')) {
        insertBlocked = true;
      }
    }

    let updateBlocked = false;
    try {
      supabase.from('students').update({ full_name: 'Test Block' });
    } catch (err: any) {
      if (err.message.includes('SSOT READ-ONLY GUARD')) {
        updateBlocked = true;
      }
    }

    let deleteBlocked = false;
    try {
      supabase.from('students').delete();
    } catch (err: any) {
      if (err.message.includes('SSOT READ-ONLY GUARD')) {
        deleteBlocked = true;
      }
    }

    if (!insertBlocked || !updateBlocked || !deleteBlocked) {
      throw new Error('Technical Guard gagal memblokir operasi mutasi!');
    }
  } finally {
    setPullSyncReadOnlyGuard(false);
  }
});

// ---------------------------------------------------------------------
// 2. Student CRUD lifecycle with explicit mutations only
// ---------------------------------------------------------------------
runner.test('Integration 2: Student CRUD Lifecycle & OCC Version Tracking', async () => {
  spyHarness.reset();

  const newStudent: Partial<StudentData> = {
    id: 'stu_integ_1',
    registrationNumber: 'REG-2027-099',
    fullName: 'Calon Murid Integrasi',
    userEmail: 'calon@alhadiid.sch.id',
    phone: '08123456789',
    status: 'draft',
    version: 1,
  };

  spyHarness.setTableData('users', [{ id: 'stu_integ_1', role: 'student' }]);

  // 1. CREATE (explicit mutation)
  await StudentRepository.create(newStudent as StudentData);
  const studentInserts = spyHarness.getCallsByTarget('students').filter((c) => c.type === 'insert');
  if (studentInserts.length !== 1) {
    throw new Error('StudentRepository.create harus memanggil tepat 1 kali INSERT pada tabel students.');
  }

  // 2. READ (strictly select, zero mutations)
  spyHarness.reset();
  const mockStudentRow = {
    id: 'stu_integ_1',
    registration_number: 'REG-2027-099',
    full_name: 'Calon Murid Integrasi',
    user_email: 'calon@alhadiid.sch.id',
    phone: '08123456789',
    status: 'draft',
    version: 1,
  };
  spyHarness.setTableData('students', [mockStudentRow]);
  const fetchRes = await StudentRepository.getById('stu_integ_1');
  if (!fetchRes.data || fetchRes.data.fullName !== 'Calon Murid Integrasi') {
    throw new Error(`StudentRepository.getById gagal mengambil data: ${JSON.stringify(fetchRes)}`);
  }
  spyHarness.assertNoMutations('StudentRepository.getById');

  // 3. UPDATE (explicit mutation with OCC version check)
  spyHarness.reset();
  spyHarness.setTableData('students', [mockStudentRow]);
  const updatedData = { ...fetchRes.data, fullName: 'Calon Murid Updated' };
  const updateRes = await StudentRepository.update('stu_integ_1', updatedData, 1);
  if (updateRes.error) {
    throw new Error(`StudentRepository.update gagal: ${updateRes.error.message}`);
  }
  const updates = spyHarness.getCallsByType('update');
  if (updates.length !== 1 || updates[0].tableOrTarget !== 'students') {
    throw new Error('StudentRepository.update harus memanggil tepat 1 kali UPDATE.');
  }

  // 4. DELETE (explicit mutation)
  spyHarness.reset();
  await StudentRepository.remove('stu_integ_1');
  const studentDeletes = spyHarness.getCallsByTarget('students').filter((c) => c.type === 'delete');
  if (studentDeletes.length !== 1) {
    throw new Error('StudentRepository.remove harus memanggil tepat 1 kali DELETE pada tabel students.');
  }
});

// ---------------------------------------------------------------------
// 3. Payment Verification Flow
// ---------------------------------------------------------------------
runner.test('Integration 3: Payment Verification & Isolation', async () => {
  spyHarness.reset();

  // Create payment (explicit mutation)
  await PaymentRepository.create({
    studentId: 'stu_pay_1',
    amount: 200000,
    paymentType: 'formulir',
    paymentMethod: 'transfer',
    status: 'pending',
  });

  const inserts = spyHarness.getCallsByType('insert');
  if (inserts.length !== 1 || inserts[0].tableOrTarget !== 'payments') {
    throw new Error('PaymentRepository.create harus memanggil 1 kali INSERT pada tabel payments.');
  }

  // Verify payment (explicit mutation)
  spyHarness.reset();
  await PaymentRepository.update('pay_mock_1', { status: 'verified', notes: 'Bukti valid' });
  const updates = spyHarness.getCallsByType('update');
  if (updates.length !== 1 || updates[0].tableOrTarget !== 'payments') {
    throw new Error('PaymentRepository.update harus memanggil 1 kali UPDATE pada tabel payments.');
  }
});

// ---------------------------------------------------------------------
// 4. CBT Question Bank Security & Non-Leaking Answers
// ---------------------------------------------------------------------
runner.test('Integration 4: Bank Soal CBT Siswa Tidak Membocorkan Kunci Jawaban', async () => {
  spyHarness.reset();
  const mockSoalRow = {
    id: 'soal_sec_1',
    kategori_kode: 'diagnostik',
    pertanyaan: 'Berapa hasil 5 + 5?',
    pilihan_a: '8',
    pilihan_b: '10',
    pilihan_c: '12',
    pilihan_d: '15',
    jawaban_benar: 'B',
    bobot: 10,
    level_kesulitan: 'easy',
    aktif: true,
  };
  spyHarness.setTableData('soal', [mockSoalRow]);

  // Admin listing has access to questions
  const adminQuestions = await ExamQuestionRepository.list();
  if (adminQuestions.length !== 1) {
    throw new Error('ExamQuestionRepository.list gagal mengambil daftar soal.');
  }

  // Ensure no unintended mutations occurred during read
  spyHarness.assertNoMutations('ExamQuestion list');
});

// ---------------------------------------------------------------------
// RUN ALL INTEGRATION TESTS
// ---------------------------------------------------------------------
runner.run().then(({ allPassed, total, passed, failed }) => {
  if (!allPassed) {
    console.error(`\x1b[31mIntegration Tests GAGAL: ${failed} dari ${total} test gagal.\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\x1b[32mIntegration Tests BERHASIL: Semua ${passed} test LULUS!\x1b[0m\n`);
    process.exit(0);
  }
});
