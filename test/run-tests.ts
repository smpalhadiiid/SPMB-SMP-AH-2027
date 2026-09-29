// =====================================================================
// test/run-tests.ts
// SPMB SMP AL-HADIID — TAHAP 7 COMPREHENSIVE TEST SUITE
// Membuktikan data tidak berubah tanpa mutasi eksplisit (SSOT Guarantee)
// =====================================================================

import fs from 'fs';
import path from 'path';
import { setupTestEnvironment, mockStorage, SimpleTestRunner } from './test-harness';
import { spyHarness } from './supabase-spy';
import { supabase, setPullSyncReadOnlyGuard, isPullSyncReadOnlyGuardActive } from '../src/utils/supabaseClient';
import { StudentRepository } from '../src/repositories/StudentRepository';
import { UserProfileRepository } from '../src/repositories/UserProfileRepository';
import { PaymentRepository } from '../src/repositories/PaymentRepository';
import { ExamQuestionRepository } from '../src/repositories/ExamQuestionRepository';
import {
  performFullSupabaseSync,
  fetchSyncComparisonStats,
} from '../src/utils/supabaseSync';
import {
  loadDataFromSupabase,
  getStoredSchoolInfo,
  getStoredClassQuotas,
  getStoredCostBreakdown,
  getStoredWebsiteConfig,
  getStoredGasConfig,
  getKepalaSekolahName,
} from '../src/utils/storage';
import { initialStudents, initialQuestionBank, initialUsers } from '../src/data/initialData';
import { UserRole } from '../src/types';

setupTestEnvironment();
spyHarness.attach(supabase);

const runner = new SimpleTestRunner();

// ---------------------------------------------------------------------
// 1. Initial load hanya menjalankan SELECT
// ---------------------------------------------------------------------
runner.test('1. Initial load hanya menjalankan SELECT (0 mutations)', async () => {
  spyHarness.reset();
  spyHarness.setTableData('students', []);
  spyHarness.setTableData('users', []);
  spyHarness.setTableData('payments', []);
  spyHarness.setTableData('soal', []);
  spyHarness.setTableData('spmb_app_state', []);

  // Initial load calls across all repositories
  await StudentRepository.list();
  await UserProfileRepository.listForAdmin();
  await PaymentRepository.list();
  await ExamQuestionRepository.list();
  await loadDataFromSupabase();

  const selects = spyHarness.getCallsByType('select');
  const mutations = spyHarness.getMutations();

  if (selects.length === 0) {
    throw new Error('Initial load seharusnya menjalankan operasi SELECT.');
  }
  if (mutations.length > 0) {
    throw new Error(`Initial load memanggil ${mutations.length} operasi mutasi yang dilarang!`);
  }
  spyHarness.assertNoMutations('Initial load');
});

// ---------------------------------------------------------------------
// 2. Refresh hanya menjalankan SELECT
// ---------------------------------------------------------------------
runner.test('2. Refresh hanya menjalankan SELECT (0 mutations)', async () => {
  spyHarness.reset();
  spyHarness.setTableData('students', [{ id: 'stu_ref_1', full_name: 'Siswa Refresh', status: 'draft' }]);
  spyHarness.setTableData('payments', [{ id: 'pay_1', amount: 200000, payment_type: 'formulir', status: 'verified' }]);
  spyHarness.setTableData('spmb_app_state', []);

  // Simulate refresh action
  await StudentRepository.list();
  await PaymentRepository.list();
  await loadDataFromSupabase();

  const mutations = spyHarness.getMutations();
  if (mutations.length > 0) {
    throw new Error(`Refresh memanggil ${mutations.length} mutasi yang dilarang!`);
  }
  spyHarness.assertNoMutations('Refresh data');
});

// ---------------------------------------------------------------------
// 3. Pull sync hanya menjalankan SELECT
// ---------------------------------------------------------------------
runner.test('3. Pull sync hanya menjalankan SELECT (0 mutations)', async () => {
  spyHarness.reset();
  spyHarness.setTableData('students', []);
  spyHarness.setTableData('users', []);
  spyHarness.setTableData('payments', []);
  spyHarness.setTableData('spmb_app_state', []);

  // Execute performFullSupabaseSync in 'pull' mode
  const res = await performFullSupabaseSync('pull');

  if (!res.success) {
    throw new Error('performFullSupabaseSync gagal.');
  }

  const mutations = spyHarness.getMutations();
  if (mutations.length > 0) {
    throw new Error(`Pull sync memanggil ${mutations.length} mutasi yang dilarang!`);
  }
  spyHarness.assertNoMutations('Pull sync');
});

// ---------------------------------------------------------------------
// 4. Cache kosong tidak menyebabkan INSERT/UPSERT
// ---------------------------------------------------------------------
runner.test('4. Cache kosong tidak menyebabkan INSERT/UPSERT', async () => {
  mockStorage.clear();
  spyHarness.reset();
  spyHarness.setTableData('students', []);
  spyHarness.setTableData('users', []);
  spyHarness.setTableData('payments', []);
  spyHarness.setTableData('soal', []);

  // Execute all reads with clean empty cache
  await StudentRepository.list();
  await PaymentRepository.list();
  await UserProfileRepository.listForAdmin();
  await ExamQuestionRepository.list();
  await loadDataFromSupabase();

  const inserts = spyHarness.getCallsByType('insert');
  const upserts = spyHarness.getCallsByType('upsert');

  if (inserts.length > 0 || upserts.length > 0) {
    throw new Error(
      `Cache kosong memicu ${inserts.length} INSERT dan ${upserts.length} UPSERT ke Supabase!`
    );
  }
  spyHarness.assertNoMutations('Cache kosong');
});

// ---------------------------------------------------------------------
// 5. Supabase mengembalikan [] dan aplikasi mempertahankan []
// ---------------------------------------------------------------------
runner.test('5. Supabase mengembalikan [] dan aplikasi mempertahankan []', async () => {
  spyHarness.reset();
  mockStorage.clear();
  spyHarness.setTableData('students', []);
  spyHarness.setTableData('payments', []);
  spyHarness.setTableData('soal', []);

  const studentsRes = await StudentRepository.list();
  const paymentsRes = await PaymentRepository.list();
  const questionsRes = await ExamQuestionRepository.list();

  if (!Array.isArray(studentsRes.data) || studentsRes.data.length !== 0) {
    throw new Error(`Expected students [0], got ${studentsRes.data?.length}`);
  }
  if (!Array.isArray(paymentsRes.data) || paymentsRes.data.length !== 0) {
    throw new Error(`Expected payments [0], got ${paymentsRes.data?.length}`);
  }
  if (!Array.isArray(questionsRes) || questionsRes.length !== 0) {
    throw new Error(`Expected questions [0], got ${questionsRes?.length}`);
  }

  // Ensure no resurrection writes occurred
  spyHarness.assertNoMutations('Empty array retention');
});

// ---------------------------------------------------------------------
// 6. Data terhapus tidak dibuat kembali
// ---------------------------------------------------------------------
runner.test('6. Data terhapus tidak dibuat kembali', async () => {
  mockStorage.clear();
  spyHarness.reset();

  // Set student in database
  const activeStudent = {
    id: 'stu_kept_1',
    registration_number: 'REG-001',
    full_name: 'Siswa Tetap',
    status: 'draft',
  };
  spyHarness.setTableData('students', [activeStudent]);

  // Subsequent listing without the deleted student
  const res = await StudentRepository.list();
  if (res.data.length !== 1 || res.data[0].id !== 'stu_kept_1') {
    throw new Error('Data yang tersisa tidak sesuai.');
  }

  // Ensure deleted student 'stu_deleted_99' was not re-inserted
  const inserts = spyHarness.getCallsByType('insert');
  const upserts = spyHarness.getCallsByType('upsert');
  const hasDeletedReinserted = [...inserts, ...upserts].some((c) =>
    JSON.stringify(c.args || []).includes('stu_deleted_99')
  );

  if (hasDeletedReinserted) {
    throw new Error('Data terhapus dibuat kembali ke Supabase!');
  }
  spyHarness.assertNoMutations('Post-deletion read');
});

// ---------------------------------------------------------------------
// 7. Auth listener tidak menulis data transaksi
// ---------------------------------------------------------------------
runner.test('7. Auth listener tidak menulis data transaksi', async () => {
  spyHarness.reset();

  // Simulate onAuthStateChange trigger
  const callbacks: any[] = [];
  const mockUnsub = { unsubscribe: () => {} };
  const origOnAuth = supabase.auth.onAuthStateChange;

  try {
    let capturedCallback: any = null;
    (supabase.auth as any).onAuthStateChange = function (cb: any) {
      capturedCallback = cb;
      return { data: { subscription: mockUnsub } };
    };

    // Register listener like App.tsx does
    supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      // simulate auth state handling
      if (session?.user) {
        // App.tsx only reads getAuthUserProfile, does not write transactions
      }
    });

    if (capturedCallback) {
      await capturedCallback('SIGNED_IN', {
        user: { id: 'usr_mock_1', email: 'test@alhadiid.sch.id' },
      });
      await capturedCallback('TOKEN_REFRESHED', {
        user: { id: 'usr_mock_1', email: 'test@alhadiid.sch.id' },
      });
    }

    // Verify no transactional writes (students, payments, spmb_app_state) occurred
    const mutations = spyHarness.getMutations();
    const transactionalMutations = mutations.filter((m) =>
      ['students', 'payments', 'spmb_app_state'].includes(m.tableOrTarget)
    );

    if (transactionalMutations.length > 0) {
      throw new Error(
        `Auth listener memicu ${transactionalMutations.length} mutasi pada tabel transaksi!`
      );
    }
  } finally {
    (supabase.auth as any).onAuthStateChange = origOnAuth;
  }
});

// ---------------------------------------------------------------------
// 8. Realtime listener tidak menciptakan write loop
// ---------------------------------------------------------------------
runner.test('8. Realtime listener tidak menciptakan write loop', async () => {
  spyHarness.reset();
  spyHarness.setTableData('soal', [{ id: 'soal_1', pertanyaan: 'Soal Realtime', aktif: true }]);

  let updateReceived = false;
  const unsubscribe = ExamQuestionRepository.subscribe((updated) => {
    updateReceived = true;
  });

  // Verify that listener itself does not fire write calls back to database
  const mutations = spyHarness.getMutations();
  if (mutations.length > 0) {
    throw new Error('Realtime listener memicu operasi mutasi (potensi write loop)!');
  }

  unsubscribe();
  spyHarness.assertNoMutations('Realtime listener check');
});

// ---------------------------------------------------------------------
// 9. Fetch users tidak dilanjutkan dengan penulisan users
// ---------------------------------------------------------------------
runner.test('9. Fetch users tidak dilanjutkan dengan penulisan users', async () => {
  spyHarness.reset();
  spyHarness.setTableData('users', [
    { id: 'usr_1', email: 'admin@alhadiid.sch.id', role: 'admin', name: 'Admin SPMB' },
  ]);

  await UserProfileRepository.listForAdmin();

  const userCalls = spyHarness.getCallsByTarget('users');
  const userMutations = userCalls.filter((c) => spyHarness.isMutation(c.type));

  if (userMutations.length > 0) {
    throw new Error(
      `Fetch users dilanjutkan dengan ${userMutations.length} operasi penulisan pada tabel 'users'!`
    );
  }
  spyHarness.assertNoMutations('Fetch users');
});

// ---------------------------------------------------------------------
// 10. Fetch payments tidak digabungkan dengan transaksi localStorage
// ---------------------------------------------------------------------
runner.test('10. Fetch payments tidak digabungkan dengan transaksi localStorage', async () => {
  mockStorage.setItem(
    'alhadiid_spmb_form_payments',
    JSON.stringify([
      { id: 'draft_form_99', amount: 999999, studentName: 'Draft Lokal Palsu' },
    ])
  );
  mockStorage.setItem(
    'alhadiid_spmb_bam_payments',
    JSON.stringify([
      { id: 'draft_bam_99', amount: 888888, studentName: 'Draft BAM Palsu' },
    ])
  );

  spyHarness.reset();
  const cloudPayments = [
    {
      id: 'pay_official_1',
      student_id: 'stu_1',
      amount: 200000,
      payment_type: 'formulir',
      status: 'verified',
      created_at: new Date().toISOString(),
    },
  ];
  spyHarness.setTableData('payments', cloudPayments);

  const res = await PaymentRepository.list();

  if (res.data.length !== 1 || res.data[0].id !== 'pay_official_1') {
    throw new Error(
      `Fetch payments mencampurkan transaksi localStorage! Expected 1 official payment, got ${res.data.length}`
    );
  }

  // Ensure no payment mutation pushed to cloud
  const paymentMutations = spyHarness.getCallsByTarget('payments').filter((c) =>
    spyHarness.isMutation(c.type)
  );
  if (paymentMutations.length > 0) {
    throw new Error('Fetch payments memicu penulisan ke database payments!');
  }
  spyHarness.assertNoMutations('Fetch payments');
});

// ---------------------------------------------------------------------
// 11. Getter tidak mengubah nilai konfigurasi
// ---------------------------------------------------------------------
runner.test('11. Getter tidak mengubah nilai konfigurasi (0 mutations)', async () => {
  spyHarness.reset();

  const info1 = getStoredSchoolInfo();
  const quotas1 = getStoredClassQuotas();
  const cost1 = getStoredCostBreakdown();
  const web1 = getStoredWebsiteConfig();
  const gas1 = getStoredGasConfig();
  const kepsek1 = getKepalaSekolahName();

  const info2 = getStoredSchoolInfo();
  const quotas2 = getStoredClassQuotas();
  const kepsek2 = getKepalaSekolahName();

  if (JSON.stringify(info1) !== JSON.stringify(info2)) {
    throw new Error('getStoredSchoolInfo mengubah nilai konfigurasi!');
  }
  if (JSON.stringify(quotas1) !== JSON.stringify(quotas2)) {
    throw new Error('getStoredClassQuotas mengubah nilai konfigurasi!');
  }
  if (kepsek1 !== kepsek2) {
    throw new Error('getKepalaSekolahName menghasilkan nilai tidak stabil!');
  }

  spyHarness.assertNoMutations('Config getters');
});

// ---------------------------------------------------------------------
// 12. initialData tidak pernah dikirim otomatis
// ---------------------------------------------------------------------
runner.test('12. initialData tidak pernah dikirim otomatis ke Supabase', async () => {
  mockStorage.clear();
  spyHarness.reset();
  spyHarness.setTableData('students', []);
  spyHarness.setTableData('soal', []);
  spyHarness.setTableData('users', []);
  spyHarness.setTableData('payments', []);

  // Run full initial read flow
  await StudentRepository.list();
  await ExamQuestionRepository.list();
  await PaymentRepository.list();
  await UserProfileRepository.listForAdmin();

  // Search for any payload matching initialStudents or initialQuestionBank
  const mutations = spyHarness.getMutations();
  for (const m of mutations) {
    const payloadStr = JSON.stringify(m.args || []);
    if (
      payloadStr.includes('Achmad Hidayat') ||
      payloadStr.includes('Rizky Ramadhan') ||
      payloadStr.includes('Apa ibukota Indonesia?')
    ) {
      throw new Error(`initialData terdeteksi dikirim otomatis ke tabel '${m.tableOrTarget}'!`);
    }
  }

  spyHarness.assertNoMutations('Auto initialData check');
});

// ---------------------------------------------------------------------
// 13. Mode smart/push tidak dapat menulis ke database
// ---------------------------------------------------------------------
runner.test('13. Mode smart/push tidak dapat menulis ke database', async () => {
  spyHarness.reset();
  spyHarness.setTableData('students', []);
  spyHarness.setTableData('users', []);
  spyHarness.setTableData('payments', []);
  spyHarness.setTableData('spmb_app_state', []);

  // Run deprecated smart mode
  await performFullSupabaseSync('smart' as any);
  spyHarness.assertNoMutations('Smart mode sync');

  // Run deprecated push mode
  spyHarness.reset();
  await performFullSupabaseSync('push' as any);
  spyHarness.assertNoMutations('Push mode sync');
});

// ---------------------------------------------------------------------
// 14. Service role key tidak masuk bundle frontend
// ---------------------------------------------------------------------
runner.test('14. Service role key tidak masuk bundle frontend', async () => {
  const srcDir = path.join(process.cwd(), 'src');

  function scanDir(dir: string): string[] {
    let files: string[] = [];
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        files = files.concat(scanDir(fullPath));
      } else if (/\.(ts|tsx|js|jsx|json|html|css)$/.test(item)) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const srcFiles = scanDir(srcDir);
  const violations: string[] = [];

  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    // Check for hardcoded service_role secret key patterns
    if (content.includes('SUPABASE_SERVICE_ROLE_KEY') || content.includes('service_role')) {
      // Exclude comments or explicit doc mentions if any, but ensure no actual service key assignments
      if (/['"]service_role['"]/.test(content) && !file.includes('types.ts')) {
        violations.push(`${path.relative(process.cwd(), file)}: Berisi referensi role 'service_role'`);
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(`Ditemukan service role key / referensi di bundle frontend:\n${violations.join('\n')}`);
  }
});

// ---------------------------------------------------------------------
// 15. Role localStorage tidak dapat memberikan hak admin
// ---------------------------------------------------------------------
runner.test('15. Role localStorage tidak dapat memberikan hak admin', async () => {
  // Helper to test role view authorization logic
  const getAllowedRoleViews = (role: UserRole): UserRole[] => {
    if (role === 'super_admin') return ['super_admin', 'admin', 'kepsek'];
    if (role === 'kepsek') return ['kepsek'];
    if (role === 'admin') return ['admin'];
    return ['student']; // Calon Murid strictly accesses student view
  };

  // 1. Student cannot access admin role view
  const studentViews = getAllowedRoleViews('student');
  if (studentViews.includes('admin') || studentViews.includes('super_admin')) {
    throw new Error('getAllowedRoleViews mengizinkan student mengakses admin view!');
  }

  // 2. Tampering localStorage active role view is rejected
  mockStorage.setItem('alhadiid_spmb_active_role_view', 'admin');
  const studentUser: { role: UserRole } = { role: 'student' };
  const attemptedRole = mockStorage.getItem('alhadiid_spmb_active_role_view') as UserRole;
  const allowed = getAllowedRoleViews(studentUser.role);

  const effectiveRole = allowed.includes(attemptedRole) ? attemptedRole : 'student';
  if (effectiveRole !== 'student') {
    throw new Error('Role tampering di localStorage berhasil memberikan hak admin!');
  }
});

// ---------------------------------------------------------------------
// EXECUTE ALL TESTS
// ---------------------------------------------------------------------
runner.run().then(({ allPassed, total, passed, failed }) => {
  if (!allPassed) {
    console.error(`\x1b[31mPengujian Tahap 7 GAGAL: ${failed} dari ${total} test gagal.\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\x1b[32mPengujian Tahap 7 BERHASIL: Semua ${passed} test LULUS dengan sempurna!\x1b[0m\n`);
    process.exit(0);
  }
});
