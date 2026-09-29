import {
  StudentData, ClassQuota, CostBreakdown, SchoolInfo, TestSchedule,
  GasConfig, UserAccount, FormPaymentRecord, BamPaymentRecord,
  ExamQuestion, WebsiteConfig
} from '../types';
import { getStudentCategory, getTotalBamCost, calculateBamRemaining, getBamInstallmentType } from './bamPricing';
import { StudentRepository } from '../repositories/StudentRepository';
import { UserProfileRepository } from '../repositories/UserProfileRepository';
import { PaymentRepository } from '../repositories/PaymentRepository';
import {
  supabase, testSupabaseConnection, SUPABASE_PROJECT_NAME, SUPABASE_PROJECT_ID,
  fetchStudentsFromSupabase,
  fetchUsersDbFromSupabase,
  fetchFormPaymentsFromSupabase,
  fetchBamPaymentsFromSupabase,
  fetchClassQuotasFromSupabase,
  fetchClassQuotasTableCount,
  fetchSchoolInfoFromSupabase,
  fetchCostBreakdownFromSupabase,
  fetchTestSchedulesFromSupabase,
  fetchQuestionBankFromSupabase,
  fetchGasConfigFromSupabase,
  fetchWebsiteConfigFromSupabase,
  setPullSyncReadOnlyGuard
} from './supabaseClient';
import {
  KEYS,
  getStoredStudents,
  getUsersDb,
  getStoredFormPayments,
  getStoredBamPayments,
  getStoredClassQuotas,
  getStoredSchoolInfo,
  getStoredCostBreakdown,
  getStoredTestSchedules,
  getStoredQuestionBank,
  getStoredGasConfig,
  getStoredWebsiteConfig,
  safeGetItem, safeSetItem
} from './storage';

/**
 * Mode sinkronisasi normal: hanya 'pull' (Read-Only dari server Supabase sebagai SSOT).
 */
export type NormalSyncMode = 'pull';

/**
 * @deprecated Mode 'smart' dan 'push' telah didepresiasi demi mencegah risiko penimpaan data server.
 * Jangan gunakan dalam UI baru. Pemanggilan mode ini otomatis dialihkan ke 'pull' dengan peringatan.
 */
export type DeprecatedSyncMode = 'smart' | 'push';

export type SyncMode = NormalSyncMode | DeprecatedSyncMode;

export interface SyncRecordCounts {
  students: number;
  users: number;
  formPayments: number;
  bamPayments: number;
  classQuotas: number;
  schedules: number;
}

export interface SyncStatsComparison {
  local: SyncRecordCounts;
  cloud: SyncRecordCounts;
  connectionOk: boolean;
  connectionMessage: string;
  classQuotasTableCount?: number;
}

export interface SyncResult {
  success: boolean;
  mode: NormalSyncMode;
  timestamp: string;
  durationMs: number;
  counts: SyncRecordCounts;
  message: string;
  error?: string;
}

const LAST_SYNC_KEY = 'spmb_last_supabase_sync_result';

export function getLastSyncInfo(): SyncResult | null {
  try {
    const raw = safeGetItem(LAST_SYNC_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveLastSyncInfo(res: SyncResult): void {
  try {
    safeSetItem(LAST_SYNC_KEY, JSON.stringify(res));
  } catch {
    // ignore
  }
}

/**
 * Mengambil perbandingan jumlah record antara database Lokal (Browser) vs Cloud Supabase
 */
export async function fetchSyncComparisonStats(): Promise<SyncStatsComparison> {
  const local: SyncRecordCounts = {
    students: getStoredStudents().length,
    users: getUsersDb().length,
    formPayments: getStoredFormPayments().length,
    bamPayments: getStoredBamPayments().length,
    classQuotas: getStoredClassQuotas().length,
    schedules: getStoredTestSchedules().length,
  };

  const cloud: SyncRecordCounts = {
    students: 0,
    users: 0,
    formPayments: 0,
    bamPayments: 0,
    classQuotas: 0,
    schedules: 0,
  };

  let connectionOk = false;
  let connectionMessage = 'Memeriksa koneksi Supabase...';

  try {
    const conn = await testSupabaseConnection();
    connectionOk = conn.ok;
    connectionMessage = conn.message;

    if (connectionOk) {
      const [
        cloudStudents,
        cloudUsers,
        cloudFormPayments,
        cloudBamPayments,
        cloudQuotas,
        cloudSchedules,
        tableCount,
      ] = await Promise.all([
        fetchStudentsFromSupabase().catch(() => null),
        fetchUsersDbFromSupabase().catch(() => null),
        fetchFormPaymentsFromSupabase().catch(() => null),
        fetchBamPaymentsFromSupabase().catch(() => null),
        fetchClassQuotasFromSupabase().catch(() => null),
        fetchTestSchedulesFromSupabase().catch(() => null),
        fetchClassQuotasTableCount().catch(() => 0),
      ]);

      cloud.students = cloudStudents ? cloudStudents.length : 0;
      cloud.users = cloudUsers ? cloudUsers.length : 0;
      cloud.formPayments = cloudFormPayments ? cloudFormPayments.length : 0;
      cloud.bamPayments = cloudBamPayments ? cloudBamPayments.length : 0;
      cloud.classQuotas = cloudQuotas ? cloudQuotas.length : 0;
      cloud.schedules = cloudSchedules ? cloudSchedules.length : 0;

      return { local, cloud, connectionOk, connectionMessage, classQuotasTableCount: tableCount };
    }
  } catch (err: any) {
    connectionOk = false;
    connectionMessage = err?.message || 'Gagal terhubung ke database Supabase';
  }

  return { local, cloud, connectionOk, connectionMessage, classQuotasTableCount: 0 };
}

/**
 * Menjalankan proses pemuatan ulang data (Refresh / Pull) dari database server Supabase.
 * Mode alur normal HANYA 'pull' (Read-Only). Mode 'smart' dan 'push' telah didepresiasi dan dialihkan ke 'pull'.
 * Dilengkapi Technical Guard: operasi mutasi (insert/update/upsert/delete) akan diblokir secara mutlak saat fungsi ini berjalan.
 * @param mode 'pull' (default) | 'smart' (deprecated, dialihkan ke pull) | 'push' (deprecated, dialihkan ke pull)
 */
export async function performFullSupabaseSync(
  mode: SyncMode = 'pull',
  onProgress?: (stage: string, percent: number) => void
): Promise<SyncResult> {
  const startTime = Date.now();

  if (mode === 'smart' || mode === 'push') {
    console.warn(
      `[DEPRECATED SYNC MODE] Mode '${mode}' telah didepresiasi dan dinonaktifkan demi integritas database Supabase (SSOT). Mengalihkan eksekusi secara aman ke mode 'pull' (Read-Only Refresh dari Server).`
    );
  }

  // Aktifkan technical guard: memastikan semua interaksi Supabase berstatus strictly read-only
  setPullSyncReadOnlyGuard(true);

  try {
    onProgress?.('Memeriksa koneksi ke Supabase...', 15);
    const conn = await testSupabaseConnection();
    if (!conn.ok) {
      throw new Error(`Koneksi Supabase gagal: ${conn.message}`);
    }

    // =========================================================================
    // PULL ONLY: Refetch datasets strictly from Supabase Server (SSOT)
    // Dilarang melakukan merge atau push data lokal ke database server!
    // =========================================================================
    onProgress?.('Mengambil data terbaru dari server Supabase...', 35);

    const [
      studentsRes,
      usersRes,
      paymentsRes,
      cloudQuotas,
      cloudSchoolInfo,
      cloudCosts,
      cloudSchedules,
      cloudQuestions,
      cloudGas,
      cloudWebsite,
    ] = await Promise.all([
      StudentRepository.list(),
      UserProfileRepository.listForAdmin(),
      PaymentRepository.list(),
      fetchClassQuotasFromSupabase(),
      fetchSchoolInfoFromSupabase(),
      fetchCostBreakdownFromSupabase(),
      fetchTestSchedulesFromSupabase(),
      fetchQuestionBankFromSupabase(),
      fetchGasConfigFromSupabase(),
      fetchWebsiteConfigFromSupabase(),
    ]);

    onProgress?.('Memperbarui cache baca lokal dari database server...', 75);

    const cloudStudents = studentsRes.data;
    const cloudUsers = usersRes.data;
    const cloudPayments = paymentsRes.data;

    // Filter form payments and bam payments from cloud payments
    const cloudFormPayments: FormPaymentRecord[] = cloudPayments
      .filter(p => p.paymentType === 'form')
      .map(p => ({
        id: p.id,
        transactionNumber: p.id.replace('pay_', 'TRX-FORM-').toUpperCase(),
        paymentDate: p.paymentDate || p.createdAt.split('T')[0],
        studentId: p.studentId,
        studentName: p.studentName,
        registrationNumber: p.registrationNumber,
        gender: 'Laki-laki',
        amount: p.amount,
        category: 'Internal',
        notes: p.notes,
        proofUrl: p.proofUrl,
        createdAt: p.createdAt,
      }));

    const cloudBamPayments: BamPaymentRecord[] = cloudPayments
      .filter(p => p.paymentType === 'bam' || (p as any).paymentType === 'daftar_ulang')
      .map(p => {
        const student = cloudStudents.find(s => s.id === p.studentId || (s.registrationNumber && s.registrationNumber === p.registrationNumber));
        const gender = (student?.gender || p.gender || 'Laki-laki') as 'Laki-laki' | 'Perempuan';
        const isAkhwat = gender === 'Perempuan';
        const totalCost = isAkhwat ? 6890000 : 6670000;
        const amt = Number(p.amount || 0);
        const rem = Math.max(0, totalCost - amt);
        const installment = (p.status === 'verified' && rem <= 0) ? 'Lunas' : (getBamInstallmentType(totalCost, amt, gender) as any);

        return {
          id: p.id,
          transactionNumber: p.id.startsWith('pay_') ? p.id.replace('pay_', 'TRX-BAM-').toUpperCase() : `TRX-BAM-${p.id.slice(-6).toUpperCase()}`,
          paymentDate: p.paymentDate || p.createdAt.split('T')[0],
          studentId: p.studentId,
          studentName: p.studentName,
          registrationNumber: p.registrationNumber,
          gender: gender,
          totalBamCost: totalCost,
          amountPaid: amt,
          installmentType: installment,
          totalPaidToDate: amt,
          remainingBalance: rem,
          notes: p.notes,
          proofUrl: p.proofUrl,
          createdAt: p.createdAt,
        };
      });

    // Simpan ke cache baca lokal murni tanpa memicu mutasi balik ke Supabase
    safeSetItem(KEYS.STUDENTS, JSON.stringify(cloudStudents));
    safeSetItem(KEYS.USERS_DB, JSON.stringify(cloudUsers));
    safeSetItem(KEYS.FORM_PAYMENTS, JSON.stringify(cloudFormPayments));
    safeSetItem(KEYS.BAM_PAYMENTS, JSON.stringify(cloudBamPayments));

    if (cloudQuotas !== null && Array.isArray(cloudQuotas)) {
      const updatedQuotas = cloudQuotas.map(q => {
        const filledCount = cloudStudents.filter(
          s => s.assignedClassId === q.id &&
            (s.status === 're_registered' || s.status === 'class_assigned' || s.status === 'completed' || s.status === 're_registration_paid')
        ).length;
        return { ...q, filled: filledCount };
      });
      safeSetItem(KEYS.CLASS_QUOTAS, JSON.stringify(updatedQuotas));
    }
    if (cloudSchoolInfo) safeSetItem(KEYS.SCHOOL_INFO, JSON.stringify(cloudSchoolInfo));
    if (cloudCosts !== null && Array.isArray(cloudCosts)) safeSetItem(KEYS.COST_BREAKDOWN, JSON.stringify(cloudCosts));
    if (cloudSchedules !== null && Array.isArray(cloudSchedules)) safeSetItem(KEYS.TEST_SCHEDULES, JSON.stringify(cloudSchedules));
    if (cloudQuestions !== null && Array.isArray(cloudQuestions)) safeSetItem(KEYS.QUESTION_BANK, JSON.stringify(cloudQuestions));
    if (cloudGas) safeSetItem(KEYS.GAS_CONFIG, JSON.stringify(cloudGas));
    if (cloudWebsite) safeSetItem(KEYS.WEBSITE_CONFIG, JSON.stringify(cloudWebsite));

    onProgress?.('Pembaruan data selesai!', 100);

    const result: SyncResult = {
      success: true,
      mode: 'pull',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      counts: {
        students: cloudStudents.length,
        users: cloudUsers.length,
        formPayments: cloudFormPayments.length,
        bamPayments: cloudBamPayments.length,
        classQuotas: cloudQuotas?.length || getStoredClassQuotas().length,
        schedules: cloudSchedules?.length || getStoredTestSchedules().length,
      },
      message: `Berhasil memuat ulang data resmi terbaru dari server Supabase: ${cloudStudents.length} siswa, ${cloudUsers.length} akun, ${cloudPayments.length} transaksi pembayaran.`,
    };

    saveLastSyncInfo(result);
    return result;
  } catch (err: any) {
    console.error('performFullSupabaseSync error:', err);
    const failedResult: SyncResult = {
      success: false,
      mode: 'pull',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      counts: {
        students: getStoredStudents().length,
        users: getUsersDb().length,
        formPayments: getStoredFormPayments().length,
        bamPayments: getStoredBamPayments().length,
        classQuotas: getStoredClassQuotas().length,
        schedules: getStoredTestSchedules().length,
      },
      message: 'Gagal memuat ulang data dari Supabase.',
      error: err?.message || String(err),
    };
    saveLastSyncInfo(failedResult);
    throw err;
  } finally {
    // Nonaktifkan technical guard setelah proses selesai
    setPullSyncReadOnlyGuard(false);
  }
}

/**
 * Format tanggal sinkronisasi yang ramah dibaca
 */
export function formatSyncTime(isoString?: string | null): string {
  if (!isoString) return 'Belum pernah sinkron';
  try {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit yang lalu`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} jam yang lalu`;

    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Belum pernah sinkron';
  }
}
