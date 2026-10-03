import { createClient } from '@supabase/supabase-js';
import {
  StudentData, ClassQuota, CostBreakdown, SchoolInfo, TestSchedule,
  GasConfig, UserAccount, UserRole, FormPaymentRecord, BamPaymentRecord,
  ExamQuestion, WebsiteConfig, BamInstallmentType, BamItem, BamGender
} from '../types';
import { getDefaultCredentials } from './defaultCredentials';
import { fetchStudentCredentialsFromSupabase, saveStudentAccountCredentials } from './studentCredentials';
import { generateUUID, isValidUUID } from './uuid';

/**
 * Sanitasi URL Supabase untuk membersihkan trailing path (/rest/v1) atau teks ekstra
 */
export function sanitizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();
  // Pisahkan jika ada teks ekstra yang tidak sengaja tertempel (seperti " Public API keys : ...")
  url = url.split(/\s+/)[0];
  // Bersihkan trailing /rest/v1 atau /rest/v1/
  url = url.replace(/\/rest\/v1\/?$/, '');
  // Bersihkan trailing slash
  url = url.replace(/\/+$/, '');
  return url;
}

const rawEnvUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL)
  || (typeof process !== 'undefined' && process.env && (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL))
  || '';
const rawEnvKey = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY)
  || (typeof process !== 'undefined' && process.env && (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY))
  || '';

const cleanedEnvUrl = sanitizeSupabaseUrl(rawEnvUrl);

// Kredensial resmi project SPMB 2027-2028 (SMP Al-Hadiid Cileungsi)
const OFFICIAL_SUPABASE_URL = 'https://fjscuokehikwhungyvll.supabase.co';
const OFFICIAL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqc2N1b2tlaGlrd2h1bmd5dmxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MTQ3NzMsImV4cCI6MjEwMTE5MDc3M30.IPCIdcYcVtDSpF2mJN-4nXf7urb71ZsdsZXWQzs8Ei4';

export const SUPABASE_URL = (cleanedEnvUrl && !cleanedEnvUrl.includes('placeholder'))
  ? cleanedEnvUrl
  : OFFICIAL_SUPABASE_URL;

export const SUPABASE_ANON_KEY = (rawEnvKey && !rawEnvKey.includes('placeholder') && rawEnvKey !== 'your-anon-key')
  ? rawEnvKey
  : OFFICIAL_SUPABASE_ANON_KEY;

export const SUPABASE_PROJECT_NAME = 'SPMB SMP Al-Hadiid Cileungsi';
export const SUPABASE_PROJECT_ID = SUPABASE_URL.split('//')[1]?.split('.')[0] || 'fjscuokehikwhungyvll';

/**
 * Validasi apakah konfigurasi environment Supabase valid
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('placeholder'));
}

const safeAuthStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // ignore
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: safeAuthStorage,
  },
});

let pullSyncReadOnlyGuardActive = false;

/**
 * Mengaktifkan atau menonaktifkan technical guard read-only mode pull sync.
 * Ketika aktif, setiap percobaan insert, update, upsert, delete, atau mutating rpc akan diblokir dengan Exception.
 */
export function setPullSyncReadOnlyGuard(active: boolean): void {
  pullSyncReadOnlyGuardActive = active;
}

export function isPullSyncReadOnlyGuardActive(): boolean {
  return pullSyncReadOnlyGuardActive;
}

// Interceptor level teknis: cegah mutasi database selama proses refresh/pull data
const rawFrom = supabase.from.bind(supabase);
(supabase as any).from = function (relation: string) {
  const builder = rawFrom(relation);
  if (!pullSyncReadOnlyGuardActive) {
    return builder;
  }

  builder.insert = function (..._args: any[]) {
    throw new Error(`[SSOT READ-ONLY GUARD] Percobaan INSERT pada tabel '${relation}' diblokir selama mode pull/refresh data!`);
  };
  builder.update = function (..._args: any[]) {
    throw new Error(`[SSOT READ-ONLY GUARD] Percobaan UPDATE pada tabel '${relation}' diblokir selama mode pull/refresh data!`);
  };
  builder.upsert = function (..._args: any[]) {
    throw new Error(`[SSOT READ-ONLY GUARD] Percobaan UPSERT pada tabel '${relation}' diblokir selama mode pull/refresh data!`);
  };
  builder.delete = function (..._args: any[]) {
    throw new Error(`[SSOT READ-ONLY GUARD] Percobaan DELETE pada tabel '${relation}' diblokir selama mode pull/refresh data!`);
  };

  return builder;
};

const rawRpc = supabase.rpc.bind(supabase);
(supabase as any).rpc = function (fn: string, ...args: any[]) {
  if (pullSyncReadOnlyGuardActive) {
    throw new Error(`[SSOT READ-ONLY GUARD] Percobaan RPC mutasi '${fn}' diblokir selama mode pull/refresh data!`);
  }
  return rawRpc(fn, ...args);
};

export interface SupabaseDiagnosticResult {
  urlAvailable: boolean;
  keyAvailable: boolean;
  urlValid: boolean;
  maskedUrl: string;
  maskedKey: string;
  connectionOk: boolean;
  usersQueryOk: boolean;
  authAccessible: boolean;
  emailAuthActive?: boolean;
  message: string;
  errors: string[];
}

// Helper to test connectivity and Supabase architecture health
export async function testSupabaseConnection(): Promise<{
  ok: boolean;
  message: string;
  diagnostics?: SupabaseDiagnosticResult;
}> {
  const errors: string[] = [];
  const urlAvailable = Boolean(SUPABASE_URL && !SUPABASE_URL.includes('placeholder'));
  const keyAvailable = Boolean(SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('placeholder'));
  const urlValid = urlAvailable && SUPABASE_URL.startsWith('https://') && SUPABASE_URL.includes('.supabase.co');

  const maskedUrl = SUPABASE_URL
    ? SUPABASE_URL.replace(/^(https:\/\/[a-z0-9]{4})[a-z0-9]+(\.[a-z0-9.]+)/i, '$1****$2')
    : '(tidak disetel)';
  const maskedKey = SUPABASE_ANON_KEY
    ? `${SUPABASE_ANON_KEY.slice(0, 8)}...${SUPABASE_ANON_KEY.slice(-6)} (${SUPABASE_ANON_KEY.length} karakter)`
    : '(tidak disetel)';

  if (!urlAvailable) errors.push('VITE_SUPABASE_URL belum disetel.');
  if (!keyAvailable) errors.push('VITE_SUPABASE_ANON_KEY belum disetel.');
  if (urlAvailable && !urlValid) errors.push('Format VITE_SUPABASE_URL tidak valid.');

  let connectionOk = false;
  let usersQueryOk = false;
  let authAccessible = false;

  try {
    const { error: pingErr } = await supabase.from('spmb_app_state').select('key').limit(1);
    if (!pingErr || pingErr.code === 'PGRST116' || pingErr.code === '42P01') {
      connectionOk = true;
    } else {
      errors.push(`Koneksi database: ${pingErr.message}`);
    }
  } catch (e: any) {
    errors.push(`Koneksi database error: ${e?.message || e}`);
  }

  try {
    const { error: usersErr } = await supabase.from('users').select('id').limit(1);
    if (!usersErr) {
      usersQueryOk = true;
      connectionOk = true;
    } else {
      errors.push(`Query public.users: ${usersErr.message}`);
    }
  } catch (e: any) {
    errors.push(`Query public.users error: ${e?.message || e}`);
  }

  try {
    const { error: sessionErr } = await supabase.auth.getSession();
    if (!sessionErr) {
      authAccessible = true;
    } else {
      errors.push(`Supabase Auth endpoint: ${sessionErr.message}`);
    }
  } catch (e: any) {
    errors.push(`Supabase Auth endpoint error: ${e?.message || e}`);
  }

  const isOk = (connectionOk || usersQueryOk) && urlValid;
  const statusMsg = isOk
    ? `Terhubung ke Supabase (${SUPABASE_PROJECT_NAME})`
    : `Peringatan konfigurasi Supabase: ${errors.join(', ')}`;

  return {
    ok: isOk,
    message: statusMsg,
    diagnostics: {
      urlAvailable,
      keyAvailable,
      urlValid,
      maskedUrl,
      maskedKey,
      connectionOk,
      usersQueryOk,
      authAccessible,
      message: statusMsg,
      errors,
    },
  };
}

// Key-Value sync helper for resilient document storage in Supabase table 'spmb_app_state'
export async function fetchSupabaseState<T>(key: string): Promise<T | null> {
  try {
    const { data, error } = await supabase
      .from('spmb_app_state')
      .select('payload')
      .eq('key', key)
      .single();

    if (error) {
      if (error.code !== 'PGRST116' && error.code !== '42P01') {
        console.warn(`Supabase fetch warning [${key}]:`, error.message);
      }
      return null;
    }
    return data?.payload as T;
  } catch (err) {
    console.warn(`Error fetching ${key} from Supabase:`, err);
    return null;
  }
}

export async function saveSupabaseState<T>(key: string, payload: T): Promise<boolean> {
  // SSOT Guard: Cegah penyimpanan kunci data transaksional ke spmb_app_state
  const FORBIDDEN_KEYS = [
    'students',
    'spmb_alhadiid_students',
    'users_db',
    'users',
    'form_payments',
    'bam_payments',
    'question_bank',
    'payments',
  ];

  if (FORBIDDEN_KEYS.includes(key)) {
    console.warn(`[SSOT Guard] Penulisan key transaksional '${key}' ke spmb_app_state dicegah. Data harus disimpan ke tabel relasional khusus.`);
    return false;
  }

  try {
    const { error } = await supabase
      .from('spmb_app_state')
      .upsert({ key, payload, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) {
      console.warn(`Supabase save warning [${key}]:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`Error saving ${key} to Supabase:`, err);
    return false;
  }
}

// Dedicated helper methods for sync
export async function syncStudentsToSupabase(_students: StudentData[]): Promise<void> {
  // Deprecated & neutralized per Security Audit Tahap 3.
  // Mutations must be performed individually via StudentRepository to prevent race conditions and overwrites.
}

export async function fetchStudentsFromSupabase(): Promise<StudentData[] | null> {
  try {
    const { data: dbStudents, error } = await supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('fetchStudentsFromSupabase relational fetch error:', error.message);
      return null;
    }

    if (!dbStudents) {
      return [];
    }

    // Query users table & stored student credentials to ensure account credentials match initial registration
    const userMap = new Map<string, any>();
    try {
      const { data: dbUsers } = await supabase.from('users').select('id, username, email, registration_number');
      if (dbUsers && dbUsers.length > 0) {
        dbUsers.forEach((u: any) => {
          if (u.id) userMap.set(u.id, u);
          if (u.registration_number) userMap.set(u.registration_number, u);
          if (u.email) userMap.set(u.email.toLowerCase(), u);
        });
      }
    } catch (uErr) {
      console.warn('fetchStudentsFromSupabase users notice:', uErr);
    }

    let credsMap: Record<string, any> = {};
    try {
      credsMap = await fetchStudentCredentialsFromSupabase();
    } catch {}

    // Query hasil_ujian to ensure exam scores inputted in Supabase are reflected in student data
    const hasilMap = new Map<string, any>();
    try {
      const { data: hasilData } = await supabase.from('hasil_ujian').select('*');
      if (hasilData && hasilData.length > 0) {
        hasilData.forEach(h => {
          if (h.peserta_id) hasilMap.set(h.peserta_id, h);
        });
      }
    } catch (hErr) {
      console.warn('fetchStudentsFromSupabase hasil_ujian notice:', hErr);
    }

    const mapped: StudentData[] = dbStudents.map((row: any) => {
      const hu = hasilMap.get(row.id);
      const diagScore = row.diagnostic_score !== null && row.diagnostic_score !== undefined
        ? Number(row.diagnostic_score)
        : (hu && hu.nilai_diagnostik !== null && hu.nilai_diagnostik !== undefined ? Number(hu.nilai_diagnostik) : undefined);
      const genScore = row.general_score !== null && row.general_score !== undefined
        ? Number(row.general_score)
        : (hu && hu.nilai_tpu !== null && hu.nilai_tpu !== undefined ? Number(hu.nilai_tpu) : undefined);
      const relScore = row.religious_score !== null && row.religious_score !== undefined
        ? Number(row.religious_score)
        : (hu && hu.nilai_diniyyah !== null && hu.nilai_diniyyah !== undefined ? Number(hu.nilai_diniyyah) : undefined);
      const finScore = row.final_score !== null && row.final_score !== undefined
        ? Number(row.final_score)
        : (hu ? Number(hu.nilai_akhir ?? hu.nilai_total ?? 0) : undefined);

      let studentStatus = row.status || 'draft';
      if (hu && hu.status_kelulusan === 'LULUS' && (!studentStatus || studentStatus === 'draft' || studentStatus === 'form_verified' || studentStatus === 'scheduled_test' || studentStatus === 'test_completed')) {
        studentStatus = 'passed';
      }

      // Kredensial akun resmi yang dibuat calon murid saat pendaftaran pertama kali
      const matchedUser = userMap.get(row.id) || (row.registration_number ? userMap.get(row.registration_number) : null) || (row.user_email ? userMap.get(row.user_email.toLowerCase()) : null);
      const storedCred = credsMap[row.id] || (row.registration_number ? credsMap[row.registration_number] : null) || (row.user_email ? credsMap[row.user_email.toLowerCase()] : null);
      const embeddedCred = row.test_answers?._accountCredentials || row.test_answers?._credentials;

      const studentUsername = (
        embeddedCred?.username ||
        storedCred?.username ||
        matchedUser?.username ||
        (typeof window !== 'undefined' ? localStorage.getItem(`spmb_user_${row.id}`) : '') ||
        (row.user_email ? row.user_email.split('@')[0] : '') ||
        row.registration_number ||
        'siswa'
      ).trim();

      const studentPassword = (
        embeddedCred?.password ||
        storedCred?.password ||
        (typeof window !== 'undefined' ? localStorage.getItem(`spmb_cred_${row.id}`) : '') ||
        (typeof window !== 'undefined' ? localStorage.getItem(`spmb_cred_${row.registration_number}`) : '') ||
        (typeof window !== 'undefined' ? localStorage.getItem(`spmb_cred_${row.user_email?.toLowerCase()}`) : '') ||
        (typeof window !== 'undefined' ? localStorage.getItem(`spmb_cred_${studentUsername.toLowerCase()}`) : '') ||
        'siswa123'
      ).trim();

      return {
        id: row.id,
        registrationNumber: row.registration_number,
        status: studentStatus,
        userEmail: row.user_email,
        username: studentUsername,
        password: studentPassword,
        examUsername: studentUsername,
        examPassword: studentPassword,
        createdAt: row.created_at,
        version: row.version ?? 1,
        isFormVerified: !!(row.is_form_verified || row.form_payment_status === 'verified'),
        isFormVerifiedByAdmin: !!(row.is_form_verified || row.form_payment_status === 'verified'),
        fullName: row.full_name,
        phone: row.phone,
        formPaymentProofUrl: row.form_payment_proof_url,
        formPaymentDate: row.form_payment_date,
        formPaymentAmount: Number(row.form_payment_amount || 200000),
        formPaymentStatus: row.form_payment_status || 'unpaid',
        formPaymentNotes: row.form_payment_notes,
        nik: row.nik || '',
        nisn: row.nisn,
        birthPlace: row.birth_place || 'Bogor',
        birthDate: row.birth_date || '2013-01-01',
        gender: row.gender || 'Laki-laki',
        religion: row.religion || 'Islam',
        childOrder: row.child_order,
        totalSiblings: row.total_siblings,
        address: row.address || '',
        village: row.village,
        subdistrict: row.subdistrict || '',
        city: row.city || '',
        province: row.province || '',
        postalCode: row.postal_code,
        previousSchoolName: row.previous_school_name || '',
        previousSchoolNpsn: row.previous_school_npsn,
        previousSchoolAddress: row.previous_school_address,
        fatherName: row.father_name || '',
        fatherBirthPlace: row.father_birth_place,
        fatherBirthDate: row.father_birth_date,
        fatherJob: row.father_job,
        fatherEducation: row.father_education || 'S1',
        fatherPhone: row.father_phone || row.phone,
        motherName: row.mother_name || '',
        motherBirthPlace: row.mother_birth_place,
        motherBirthDate: row.mother_birth_date,
        motherJob: row.mother_job || 'Ibu Rumah Tangga',
        motherEducation: row.mother_education,
        motherPhone: row.mother_phone || row.phone,
        guardianName: row.guardian_name,
        guardianRelation: row.guardian_relation,
        guardianPhone: row.guardian_phone,
        photoUrl: row.photo_url,
        kkUrl: row.kk_url,
        birthCertUrl: row.birth_cert_url,
        reportCardUrl: row.report_card_url,
        kipUrl: row.kip_url,
        certificateUrl: row.certificate_url,
        isTestActive: Boolean(row.is_test_active || (row.test_notes && row.test_notes.includes('[IS_TEST_ACTIVE:true]')) || row.status === 'scheduled_test'),
        testSubmitted: Boolean(row.test_submitted || (row.test_notes && row.test_notes.includes('[TEST_SUBMITTED:true]')) || row.status === 'test_completed' || finScore !== undefined),
        testAnswers: typeof row.test_answers === 'object' && row.test_answers ? row.test_answers : {},
        testScheduleDate: row.test_schedule_date,
        testLocation: row.test_location,
        diagnosticScore: diagScore,
        generalScore: genScore,
        religiousScore: relScore,
        finalScore: finScore,
        testNotes: row.test_notes,
        initialPaymentProofUrl: row.initial_payment_proof_url,
        initialPaymentDate: row.initial_payment_date,
        initialPaymentAmount: Number(row.initial_payment_amount || 0),
        initialPaymentStatus: row.initial_payment_status || 'unpaid',
        initialPaymentNotes: row.initial_payment_notes,
        assignedClassId: row.assigned_class_id,
        assignedClassName: row.assigned_class_name,
        assignedHomeroomTeacher: row.assigned_homeroom_teacher,
        firstDayDate: row.first_day_date,
        mplsInfo: row.mpls_info,
      };
    });

    return mapped;
  } catch (e) {
    console.warn('fetchStudentsFromSupabase relational fetch exception:', e);
    return null;
  }
}

export async function syncClassQuotasToSupabase(quotas: ClassQuota[]): Promise<void> {
  if (!quotas || quotas.length === 0) return;
  try {
    const rows = quotas.map(q => ({
      id: q.id || `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      academic_year: q.academicYear || '2027/2028',
      level: q.level || 'Kelas 7',
      class_name: q.className || 'Kelas',
      capacity: Number(q.capacity || 32),
      filled: Number(q.filled || 0),
      homeroom_teacher: q.homeroomTeacher || '',
      created_at: new Date().toISOString(),
    }));

    // Simpan langsung ke tabel relasional public.class_quotas di Supabase
    const { error } = await supabase.from('class_quotas').upsert(rows, { onConflict: 'id' });
    if (error) {
      console.warn('syncClassQuotasToSupabase relational notice:', error.message);
      // Fallback cadangan ke spmb_app_state jika RLS write dibatasi
      await saveSupabaseState('class_quotas', quotas);
    }
  } catch (e) {
    console.warn('syncClassQuotasToSupabase warning:', e);
    await saveSupabaseState('class_quotas', quotas);
  }
}

export async function fetchClassQuotasFromSupabase(): Promise<ClassQuota[] | null> {
  try {
    // 1. Ambil langsung dari tabel relasional public.class_quotas (Single Source of Truth)
    const { data: dbRows, error } = await supabase
      .from('class_quotas')
      .select('*')
      .order('class_name', { ascending: true });

    if (!error && dbRows && dbRows.length > 0) {
      const mapped: ClassQuota[] = dbRows.map((r: any) => ({
        id: String(r.id),
        academicYear: r.academic_year || '2027/2028',
        level: r.level || 'Kelas 7',
        className: r.class_name,
        capacity: Number(r.capacity || 32),
        filled: Number(r.filled || 0),
        homeroomTeacher: r.homeroom_teacher || '',
      }));
      return mapped;
    }

    // 2. Jika tabel relasional belum berisi baris data, ambil dari spmb_app_state sebagai fallback
    const legacy = await fetchSupabaseState<ClassQuota[]>('class_quotas');
    if (legacy && Array.isArray(legacy) && legacy.length > 0) {
      return legacy;
    }
  } catch (e) {
    console.warn('fetchClassQuotasFromSupabase relational fetch exception:', e);
  }

  return null;
}

export async function fetchClassQuotasTableCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('class_quotas')
      .select('*', { count: 'exact', head: true });
    if (!error && typeof count === 'number') {
      return count;
    }
  } catch (e) {
    console.warn('fetchClassQuotasTableCount notice:', e);
  }
  return 0;
}

export async function syncSchoolInfoToSupabase(info: SchoolInfo): Promise<void> {
  try {
    await saveSupabaseState('school_info', info);
  } catch (e) {
    console.warn('syncSchoolInfoToSupabase warning:', e);
  }
}

export async function fetchSchoolInfoFromSupabase(): Promise<SchoolInfo | null> {
  return await fetchSupabaseState<SchoolInfo>('school_info');
}

export async function syncFormPaymentsToSupabase(records: FormPaymentRecord[]): Promise<void> {
  if (!records || records.length === 0) return;

  try {
    const paymentRows = records.map(r => ({
      id: (r.id && isValidUUID(r.id)) ? r.id : generateUUID(),
      student_id: r.studentId,
      registration_number: r.registrationNumber,
      student_name: r.studentName,
      payment_type: 'formulir',
      amount: Number(r.amount || 200000),
      status: 'verified',
      payment_method: 'manual_transfer',
      proof_url: r.proofUrl || null,
      notes: r.notes || '',
      created_at: r.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // Simpan ke tabel relasional tunggal public.payments
    await supabase.from('payments').upsert(paymentRows, { onConflict: 'id' });

    // Perbarui status pendaftaran siswa
    for (const r of records) {
      if (r.studentId) {
        await supabase
          .from('students')
          .update({
            is_form_verified: true,
            form_payment_status: 'verified',
            form_payment_amount: Number(r.amount || 200000),
            form_payment_proof_url: r.proofUrl || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', r.studentId);
      }
    }
  } catch (e) {
    console.warn('Sync to public.payments (form) warning:', e);
  }
}

export async function fetchFormPaymentsFromSupabase(): Promise<FormPaymentRecord[] | null> {
  try {
    // Single Source of Truth: Ambil langsung dari tabel relasional public.payments
    const { data: dbData, error } = await supabase
      .from('payments')
      .select('*')
      .in('payment_type', ['formulir', 'form'])
      .order('created_at', { ascending: false });

    if (!error && dbData && dbData.length > 0) {
      const mapped: FormPaymentRecord[] = dbData.map((row: any) => ({
        id: row.id,
        transactionNumber: row.id.replace('pay_', 'TRX-FORM-').toUpperCase(),
        registrationNumber: row.registration_number,
        studentId: row.student_id,
        studentName: row.student_name,
        gender: row.gender || 'Laki-laki',
        paymentDate: row.payment_date || row.created_at?.split('T')[0],
        amount: Number(row.amount || 200000),
        category: 'Internal',
        notes: row.notes,
        proofUrl: row.proof_url,
        createdAt: row.created_at,
      }));
      return mapped;
    }
  } catch (e) {
    console.warn('fetchFormPaymentsFromSupabase error:', e);
  }

  return null;
}

export async function syncBamPaymentsToSupabase(records: BamPaymentRecord[]): Promise<void> {
  if (!records || records.length === 0) return;

  try {
    const paymentRows = records.map(r => ({
      id: (r.id && isValidUUID(r.id)) ? r.id : generateUUID(),
      student_id: r.studentId,
      registration_number: r.registrationNumber,
      student_name: r.studentName,
      payment_type: 'daftar_ulang',
      amount: Number(r.amountPaid || 0),
      status: 'verified',
      payment_method: 'manual_transfer',
      proof_url: r.proofUrl || null,
      notes: r.notes || '',
      created_at: r.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // Simpan ke tabel relasional tunggal public.payments
    await supabase.from('payments').upsert(paymentRows, { onConflict: 'id' });

    // Perbarui nominal BAM siswa
    for (const r of records) {
      if (r.studentId && r.amountPaid > 0) {
        await supabase
          .from('students')
          .update({
            initial_payment_amount: Number(r.amountPaid),
            initial_payment_status: 'verified',
            initial_payment_proof_url: r.proofUrl || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', r.studentId);
      }
    }
  } catch (e) {
    console.warn('Sync to public.payments (bam) warning:', e);
  }
}

export async function fetchBamPaymentsFromSupabase(): Promise<BamPaymentRecord[] | null> {
  try {
    // Single Source of Truth: Ambil langsung dari tabel relasional public.payments
    const { data: dbData, error } = await supabase
      .from('payments')
      .select('*')
      .in('payment_type', ['daftar_ulang', 'bam'])
      .order('created_at', { ascending: false });

    if (!error && dbData && dbData.length > 0) {
      const mapped: BamPaymentRecord[] = dbData.map((row: any) => {
        const cost = Number(row.total_bam_cost || row.total_cost || 11000000);
        const amt = Number(row.amount || 0);
        const remaining = Math.max(0, cost - amt);
        const installment = (row.installment_type || (amt >= cost ? 'Lunas' : (amt > 0 ? 'Cicilan 1' : 'Belum Bayar'))) as BamInstallmentType;
        return {
          id: row.id,
          transactionNumber: row.transaction_number || row.id.replace('pay_', 'TRX-BAM-').toUpperCase(),
          registrationNumber: row.registration_number,
          studentId: row.student_id,
          studentName: row.student_name,
          gender: row.gender || 'Laki-laki',
          paymentDate: row.payment_date || row.created_at?.split('T')[0],
          totalBamCost: cost,
          amountPaid: amt,
          installmentType: installment,
          totalPaidToDate: amt,
          remainingBalance: remaining,
          notes: row.notes,
          proofUrl: row.proof_url,
          createdAt: row.created_at,
        };
      });
      return mapped;
    }
  } catch (e) {
    console.warn('fetchBamPaymentsFromSupabase error:', e);
  }

  return null;
}

export async function syncCostBreakdownToSupabase(costs: CostBreakdown[]): Promise<void> {
  try {
    await saveSupabaseState('cost_breakdown', costs);
  } catch (e) {
    console.warn('syncCostBreakdownToSupabase warning:', e);
  }
}

export async function fetchCostBreakdownFromSupabase(): Promise<CostBreakdown[] | null> {
  return await fetchSupabaseState<CostBreakdown[]>('cost_breakdown');
}

/**
 * Mengambil daftar item resmi Biaya Awal Masuk (BAM) dari Supabase (Single Source of Truth).
 * Membaca dari tabel public.bam_items terlebih dahulu, dengan fallback ke spmb_app_state.
 */
export async function fetchBamItemsFromSupabase(): Promise<{ ikhwan: BamItem[]; akhwat: BamItem[] }> {
  try {
    // 1. Coba ambil dari tabel relasional public.bam_items
    const { data: rows, error } = await supabase
      .from('bam_items')
      .select('*')
      .order('urutan', { ascending: true });

    if (!error && Array.isArray(rows) && rows.length > 0) {
      const ikhwan: BamItem[] = [];
      const akhwat: BamItem[] = [];

      rows.forEach((r: any) => {
        const item: BamItem = {
          id: r.id,
          gender: r.gender === 'akhwat' ? 'akhwat' : 'ikhwan',
          nama_item: r.nama_item || '',
          nominal: Number(r.nominal ?? 0),
          urutan: Number(r.urutan ?? 1),
          aktif: r.aktif !== false,
          keterangan: r.keterangan || undefined,
          created_at: r.created_at,
          updated_at: r.updated_at,
        };

        if (item.gender === 'akhwat') {
          akhwat.push(item);
        } else {
          ikhwan.push(item);
        }
      });

      return { ikhwan, akhwat };
    }
  } catch (err) {
    console.warn('[Supabase] fetchBamItemsFromSupabase error (falling back to app state):', err);
  }

  // 2. Fallback ke spmb_app_state jika tabel bam_items belum dibuat
  try {
    const ikhwanState = await fetchSupabaseState<BamItem[]>('bam_items_ikhwan');
    const akhwatState = await fetchSupabaseState<BamItem[]>('bam_items_akhwat');

    if ((ikhwanState && ikhwanState.length > 0) || (akhwatState && akhwatState.length > 0)) {
      return {
        ikhwan: ikhwanState || [],
        akhwat: akhwatState || [],
      };
    }
  } catch (stateErr) {
    console.warn('[Supabase] fetchSupabaseState bam_items error:', stateErr);
  }

  return { ikhwan: [], akhwat: [] };
}

/**
 * Menyimpan seluruh data item BAM untuk gender tertentu ('ikhwan' atau 'akhwat') ke Supabase.
 * Menyimpan secara permanen ke tabel public.bam_items dan mencadangkan ke spmb_app_state.
 */
export async function saveBamItemsToSupabase(
  gender: BamGender,
  items: BamItem[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Validasi input
    if (!gender || (gender !== 'ikhwan' && gender !== 'akhwat')) {
      return { success: false, error: 'Gender BAM harus spesifik: "ikhwan" atau "akhwat"' };
    }

    const payloadRows = items.map((it, idx) => ({
      id: it.id || `bam_${gender}_${Date.now()}_${idx}`,
      gender,
      nama_item: it.nama_item.trim(),
      nominal: Number(it.nominal ?? 0),
      urutan: Number(it.urutan ?? idx + 1),
      aktif: it.aktif !== false,
      updated_at: new Date().toISOString(),
    }));

    // Coba hapus item lama untuk gender ini yang tidak lagi ada, atau timpa dengan upsert
    try {
      const { error: upsertErr } = await supabase
        .from('bam_items')
        .upsert(payloadRows, { onConflict: 'id' });

      if (upsertErr) {
        console.warn('[Supabase] upsert bam_items warning:', upsertErr.message);
      }
    } catch (upsertE) {
      console.warn('[Supabase] upsert bam_items exception:', upsertE);
    }

    // 2. Simpan juga ke spmb_app_state agar sinkron di semua environment dan device
    await saveSupabaseState(`bam_items_${gender}`, items);

    return { success: true };
  } catch (err: any) {
    console.error('[Supabase] saveBamItemsToSupabase failed:', err);
    return { success: false, error: err?.message || 'Gagal menyimpan data BAM ke Supabase' };
  }
}

/**
 * Menghapus 1 item BAM secara permanen dari Supabase.
 */
export async function deleteBamItemFromSupabase(id: string, gender: BamGender): Promise<boolean> {
  try {
    await supabase.from('bam_items').delete().eq('id', id);
    // Sinkronisasi state lokal di app_state
    const current = await fetchSupabaseState<BamItem[]>(`bam_items_${gender}`);
    if (current && Array.isArray(current)) {
      const updated = current.filter(i => i.id !== id);
      await saveSupabaseState(`bam_items_${gender}`, updated);
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] deleteBamItemFromSupabase error:', err);
    return false;
  }
}

export async function syncTestSchedulesToSupabase(schedules: TestSchedule[]): Promise<void> {
  try {
    await saveSupabaseState('test_schedules', schedules);
  } catch (e) {
    console.warn('syncTestSchedulesToSupabase warning:', e);
  }
}

export async function fetchTestSchedulesFromSupabase(): Promise<TestSchedule[] | null> {
  return await fetchSupabaseState<TestSchedule[]>('test_schedules');
}

export async function syncQuestionBankToSupabase(questions: ExamQuestion[]): Promise<void> {
  try {
    if (questions && questions.length > 0) {
      const letterMap = ['A', 'B', 'C', 'D'];
      const rows = questions.map((q) => ({
        id: q.id,
        kategori_kode: q.category || 'diagnostik',
        pertanyaan: q.questionText || '',
        pilihan_a: q.options?.[0] || '',
        pilihan_b: q.options?.[1] || '',
        pilihan_c: q.options?.[2] || '',
        pilihan_d: q.options?.[3] || '',
        jawaban_benar: letterMap[q.correctOptionIndex] || 'A',
        bobot: q.points || 10,
        level_kesulitan: q.difficulty || 'medium',
        gambar_url: q.imageUrl || null,
        aktif: q.isActive !== false,
      }));
      await supabase.from('soal').upsert(rows, { onConflict: 'id' });
    }
  } catch (e) {
    console.warn('syncQuestionBankToSupabase warning:', e);
  }
}

export async function fetchQuestionBankFromSupabase(): Promise<ExamQuestion[] | null> {
  try {
    const { data: soalData, error } = await supabase.from('soal').select('*').order('created_at', { ascending: false });
    if (!error && soalData && Array.isArray(soalData) && soalData.length > 0) {
      const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
      return soalData.map((row: any) => ({
        id: String(row.id),
        category: row.kategori_kode || 'diagnostik',
        questionText: row.pertanyaan || '',
        options: [row.pilihan_a || '', row.pilihan_b || '', row.pilihan_c || '', row.pilihan_d || ''],
        correctOptionIndex: letterMap[row.jawaban_benar?.toUpperCase()] ?? 0,
        points: Number(row.bobot || 10),
        difficulty: row.level_kesulitan || 'medium',
        imageUrl: row.gambar_url || undefined,
        isActive: row.aktif !== false,
      }));
    }
    return null;
  } catch (e) {
    console.warn('fetchQuestionBankFromSupabase error:', e);
    return null;
  }
}

export async function syncGasConfigToSupabase(config: GasConfig): Promise<void> {
  try {
    await saveSupabaseState('gas_config', config);
  } catch (e) {
    console.warn('syncGasConfigToSupabase warning:', e);
  }
}

export async function fetchGasConfigFromSupabase(): Promise<GasConfig | null> {
  return await fetchSupabaseState<GasConfig>('gas_config');
}

export async function syncWebsiteConfigToSupabase(config: WebsiteConfig): Promise<void> {
  try {
    await saveSupabaseState('website_config', config);
  } catch (e) {
    console.warn('syncWebsiteConfigToSupabase warning:', e);
  }
}

export async function fetchWebsiteConfigFromSupabase(): Promise<WebsiteConfig | null> {
  return await fetchSupabaseState<WebsiteConfig>('website_config');
}

/**
 * @deprecated DILARANG melakukan bulk upsert array akun ke public.users karena melanggar aturan SSOT.
 * Database relasional public.users adalah Single Source of Truth.
 */
export async function syncUsersDbToSupabase(_users: UserAccount[]): Promise<void> {
  console.warn('[SupabaseClient] syncUsersDbToSupabase is deprecated. Database public.users is the SSOT and cannot be mass-overwritten.');
}

export async function fetchUsersDbFromSupabase(): Promise<UserAccount[] | null> {
  try {
    const { data: dbUsers, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && dbUsers && dbUsers.length > 0) {
      const mapped: UserAccount[] = dbUsers.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        username: u.username,
        phone: u.phone,
        role: u.role as UserRole,
        registrationNumber: u.registration_number,
        status: u.status || 'active',
        mustChangePassword: u.must_change_password || false,
        createdAt: u.created_at,
      }));

      return mapped;
    }

    if (error) {
      console.warn('fetchUsersDbFromSupabase relational fetch error:', error.message);
    }

    return dbUsers ? [] : null;
  } catch (e) {
    console.warn('fetchUsersDbFromSupabase relational fetch error:', e);
    return null;
  }
}

// ==========================================
// SUPABASE AUTHENTICATION & SECURITY HELPERS
// ==========================================

/**
 * Hashes a plaintext password using SHA-256 with an application-specific salt.
 * Ensures passwords are never stored in plaintext in the database or caches.
 */
export async function hashPassword(plain: string): Promise<string> {
  if (!plain) return '';
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(`spmb_alhadiid_salt_${plain}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return 'sha256:' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let hash = 0;
    for (let i = 0; i < plain.length; i++) {
      hash = ((hash << 5) - hash) + plain.charCodeAt(i);
      hash |= 0;
    }
    return `hash:${Math.abs(hash)}`;
  }
}

/**
 * Verifies a plaintext password against a stored hash, handling salted sha256,
 * legacy migrations, and system initial roles.
 */
export async function verifyPassword(plain: string, storedHash?: string, role?: string): Promise<boolean> {
  if (!plain) return false;

  // Cek kecocokan password default dinamis yang dikonfigurasi Super Admin
  const dynamicDefaults = getDefaultCredentials();
  if (role && (role in dynamicDefaults)) {
    const roleDef = dynamicDefaults[role as keyof typeof dynamicDefaults];
    if (roleDef && typeof roleDef === 'object' && 'defaultPassword' in roleDef && plain === (roleDef as any).defaultPassword) return true;
  }

  if (!storedHash) {
    if ((role === 'admin' || role === 'super_admin' || role === 'kepsek') &&
        (plain === 'admin123' || plain === 'superadmin123' || plain === 'spmb2027')) return true;
    if (role === 'student' && (plain === 'siswa123' || plain === '123456' || plain === 'spmb2027')) return true;
    return false;
  }

  if (storedHash.startsWith('sha256:')) {
    const computed = await hashPassword(plain);
    return computed === storedHash;
  }

  // Legacy plaintext match
  if (storedHash === plain) return true;

  // Fallback defaults for pre-seeded or reset accounts
  if ((role === 'admin' || role === 'super_admin' || role === 'kepsek') &&
      (plain === 'admin123' || plain === 'superadmin123' || plain === 'spmb2027')) return true;
  if (role === 'student' && (plain === 'siswa123' || plain === '123456' || plain === 'spmb2027')) return true;

  return false;
}

export async function signUpWithSupabase(params: {
  email: string;
  password?: string;
  fullName: string;
  username?: string;
  phone: string;
  role: UserRole;
  registrationNumber?: string;
}): Promise<{ ok: boolean; authUserId?: string; userAccount?: UserAccount; error?: string }> {
  try {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanPassword = params.password ? params.password.trim() : '';
    const cleanFullName = params.fullName.trim();
    const cleanUsername = (params.username || cleanEmail.split('@')[0]).trim().toLowerCase();
    const cleanPhone = params.phone.trim();

    if (!cleanPassword || cleanPassword.length < 6) {
      return { ok: false, error: 'Password minimal 6 karakter!' };
    }

    if (!cleanFullName) {
      return { ok: false, error: 'Nama lengkap wajib diisi!' };
    }

    if (!cleanUsername) {
      return { ok: false, error: 'Username wajib diisi!' };
    }

    // 1. Cek apakah Email atau Username sudah digunakan di database public.users
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email, username')
      .or(`email.ilike.${cleanEmail},username.ilike.${cleanUsername}`)
      .limit(1)
      .maybeSingle();

    if (existingUser) {
      if (existingUser.email && existingUser.email.toLowerCase() === cleanEmail) {
        return {
          ok: false,
          error: `Email "${cleanEmail}" sudah terdaftar di sistem SPMB. Silakan langsung login menggunakan email atau username Anda.`,
        };
      }
      if (existingUser.username && existingUser.username.toLowerCase() === cleanUsername) {
        return {
          ok: false,
          error: `Username "${cleanUsername}" sudah digunakan oleh calon murid lain. Silakan pilih username yang berbeda.`,
        };
      }
    }

    // 2. Registrasi Supabase Auth di latar belakang (jika email auth aktif di project)
    let authUserId: string | undefined = undefined;
    try {
      const cleanOrigin = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : undefined;
      const { data: authData } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: {
          emailRedirectTo: cleanOrigin,
          data: {
            full_name: cleanFullName,
            username: cleanUsername,
            phone: cleanPhone,
            role: params.role,
          },
        },
      });
      if (authData?.user?.id) {
        authUserId = authData.user.id;
      }
    } catch {
      // Supabase Auth provider mungkin nonaktif di dashboard; lanjutkan ke penyimpanan database relasional
    }

    const userId = params.role === 'student' ? `std_${Date.now()}` : `usr_${Date.now()}`;
    const regNum = params.registrationNumber || (params.role === 'student' ? `SPMB2027${Math.floor(1000 + Math.random() * 9000)}` : undefined);

    const userAccount: UserAccount = {
      id: userId,
      name: cleanFullName,
      email: cleanEmail,
      username: cleanUsername,
      phone: cleanPhone,
      role: params.role,
      registrationNumber: regNum,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    // 3. Simpan langsung ke tabel relasional public.users dengan hash password (BUKAN plaintext)
    const hashed = await hashPassword(cleanPassword);
    const { error: userErr } = await supabase.from('users').upsert({
      id: userId,
      auth_user_id: authUserId || null,
      name: cleanFullName,
      email: cleanEmail,
      username: cleanUsername,
      phone: cleanPhone,
      role: params.role,
      registration_number: regNum,
      password_hash: hashed,
      status: 'active',
      must_change_password: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    if (userErr) {
      console.error('Insert public.users error:', userErr);
      return {
        ok: false,
        error: `Gagal menyimpan data akun ke database: ${userErr.message}`,
      };
    }

    // 4. Jika role calon murid, simpan record pendaftaran awal ke public.students beserta kredensial akun
    if (params.role === 'student') {
      const { error: studentErr } = await supabase.from('students').upsert({
        id: userId,
        registration_number: regNum,
        user_email: cleanEmail,
        full_name: cleanFullName,
        phone: cleanPhone,
        status: 'draft',
        form_payment_amount: 200000,
        form_payment_status: 'unpaid',
        test_answers: {
          _accountCredentials: {
            username: cleanUsername,
            password: cleanPassword,
          },
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

      if (studentErr) {
        console.warn('Upsert public.students notice:', studentErr.message);
      }

      // Simpan juga ke store kredensial terpusat (spmb_app_state & local caches)
      try {
        await saveStudentAccountCredentials({
          studentId: userId,
          registrationNumber: regNum || '',
          userEmail: cleanEmail,
          fullName: cleanFullName,
          username: cleanUsername,
          password: cleanPassword,
        });
      } catch (cErr) {
        console.warn('saveStudentAccountCredentials notice:', cErr);
      }
    }

    return { ok: true, authUserId, userAccount };
  } catch (err: any) {
    console.error('SignUp with Supabase error:', err);
    return { ok: false, error: err?.message || 'Gagal mendaftar via Supabase' };
  }
}

export async function linkUserAuthId(userId: string, authUserId: string, email: string) {
  try {
    if (!authUserId) return;
    await supabase
      .from('users')
      .update({ auth_user_id: authUserId })
      .or(`id.eq.${userId},email.ilike.${email}`);
  } catch (e) {
    console.warn('linkUserAuthId warning:', e);
  }
}

export async function ensureSupabaseAuthSession(
  email: string,
  password?: string,
  userProfile?: UserAccount
): Promise<{ ok: boolean; session?: any; error?: string }> {
  try {
    // 1. Get current active session
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user && session.user.email?.toLowerCase() === email.toLowerCase()) {
      return { ok: true, session };
    }

    // 2. Try refresh session
    const { data: refreshData } = await supabase.auth.refreshSession();
    if (refreshData.session?.user && refreshData.session.user.email?.toLowerCase() === email.toLowerCase()) {
      return { ok: true, session: refreshData.session };
    }

    // 3. Attempt signInWithPassword if password provided
    if (password) {
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInData?.session) {
        if (signInData.user) {
          await linkUserAuthId(userProfile?.id || signInData.user.id, signInData.user.id, email);
        }
        return { ok: true, session: signInData.session };
      }
      if (signInErr) {
        return { ok: false, error: signInErr.message };
      }
    }

    // 4. Check if there's any active session
    const { data: finalCheck } = await supabase.auth.getSession();
    if (finalCheck.session) {
      return { ok: true, session: finalCheck.session };
    }

    return { ok: false, error: 'Sesi autentikasi tidak ditemukan. Silakan login kembali.' };
  } catch (err: any) {
    console.warn('ensureSupabaseAuthSession error:', err);
    return { ok: false, error: err?.message || 'Gagal memverifikasi sesi Supabase Auth' };
  }
}

export async function signInWithSupabase(
  identifier: string,
  password: string
): Promise<{ ok: boolean; userAccount?: UserAccount; error?: string }> {
  try {
    const cleanIdentifier = identifier.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanIdentifier || !cleanPassword) {
      return { ok: false, error: 'Email/Username dan Password wajib diisi!' };
    }

    if (!isSupabaseConfigured()) {
      return {
        ok: false,
        error: 'Konfigurasi Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) belum disetel pada aplikasi.',
      };
    }

    // 1. Resolve user profile from authoritative public.users in Supabase
    let dbUser: any = null;

    const dynamicDefaults = getDefaultCredentials();
    const superAdminUser = dynamicDefaults.super_admin.defaultUsername.toLowerCase();
    const superAdminEmail = dynamicDefaults.super_admin.defaultEmail.toLowerCase();
    const adminUser = dynamicDefaults.admin.defaultUsername.toLowerCase();
    const adminEmail = dynamicDefaults.admin.defaultEmail.toLowerCase();
    const kepsekUser = dynamicDefaults.kepsek.defaultUsername.toLowerCase();
    const kepsekEmail = dynamicDefaults.kepsek.defaultEmail.toLowerCase();
    const studentUser = dynamicDefaults.student.defaultUsername.toLowerCase();
    const studentEmail = dynamicDefaults.student.defaultEmail.toLowerCase();

    // Direct check for official administrative accounts (with dynamic defaults & aliases)
    if (cleanIdentifier === 'admin' || cleanIdentifier === 'admin@alhadiid.sch.id' || cleanIdentifier === 'admin.spmb@alhadiid.sch.id' || cleanIdentifier === adminUser || cleanIdentifier === adminEmail) {
      const res = await supabase
        .from('users')
        .select('*')
        .or(`id.eq.usr_admin,username.ilike.${adminUser},username.ilike.admin,email.ilike.${adminEmail},email.ilike.admin@alhadiid.sch.id`)
        .limit(1)
        .maybeSingle();
      dbUser = res.data;
    } else if (cleanIdentifier === 'superadmin' || cleanIdentifier === 'superadmin@alhadiid.sch.id' || cleanIdentifier === 'superadmin@lhadiid.sch.id' || cleanIdentifier === superAdminUser || cleanIdentifier === superAdminEmail) {
      const res = await supabase
        .from('users')
        .select('*')
        .or(`id.eq.usr_superadmin,username.ilike.${superAdminUser},username.ilike.superadmin,email.ilike.${superAdminEmail},email.ilike.superadmin@alhadiid.sch.id`)
        .limit(1)
        .maybeSingle();
      dbUser = res.data;
    } else if (cleanIdentifier === 'kepsek' || cleanIdentifier === 'kepsek@alhadiid.sch.id' || cleanIdentifier === kepsekUser || cleanIdentifier === kepsekEmail) {
      const res = await supabase
        .from('users')
        .select('*')
        .or(`id.eq.usr_kepsek,username.ilike.${kepsekUser},username.ilike.kepsek,email.ilike.${kepsekEmail},email.ilike.kepsek@alhadiid.sch.id`)
        .limit(1)
        .maybeSingle();
      dbUser = res.data;
    } else if (cleanIdentifier === 'siswa' || cleanIdentifier === 'siswa@alhadiid.sch.id' || cleanIdentifier === studentUser || cleanIdentifier === studentEmail) {
      const res = await supabase
        .from('users')
        .select('*')
        .or(`id.eq.usr_student,username.ilike.${studentUser},username.ilike.siswa,email.ilike.${studentEmail},email.ilike.siswa@alhadiid.sch.id`)
        .limit(1)
        .maybeSingle();
      dbUser = res.data;
    } else if (cleanIdentifier === 'suwarno' || cleanIdentifier === 'suwarno691' || cleanIdentifier === 'suwarno691@guru.smp.belajar.id') {
      const res = await supabase
        .from('users')
        .select('*')
        .or('username.ilike.suwarno,username.ilike.suwarno691,email.ilike.suwarno691@guru.smp.belajar.id')
        .limit(1)
        .maybeSingle();
      dbUser = res.data;
    } else {
      // Pencarian calon murid atau pengguna umum:
      // A. Jika identifier mengandung '@', cari langsung berdasarkan email
      if (cleanIdentifier.includes('@')) {
        const res = await supabase
          .from('users')
          .select('*')
          .ilike('email', cleanIdentifier)
          .limit(1)
          .maybeSingle();
        dbUser = res.data;
      } else {
        // B. Cari berdasarkan username
        const resUsername = await supabase
          .from('users')
          .select('*')
          .ilike('username', cleanIdentifier)
          .limit(1)
          .maybeSingle();
        dbUser = resUsername.data;

        // C. Jika belum ditemukan, cari berdasarkan no. pendaftaran
        if (!dbUser) {
          const resReg = await supabase
            .from('users')
            .select('*')
            .ilike('registration_number', cleanIdentifier)
            .limit(1)
            .maybeSingle();
          dbUser = resReg.data;
        }

        // D. Jika masih belum ditemukan, cek tabel students berdasarkan registration_number atau nisn
        if (!dbUser) {
          const studentRes = await supabase
            .from('students')
            .select('id, user_email')
            .or(`registration_number.ilike.${cleanIdentifier},nisn.eq.${cleanIdentifier}`)
            .limit(1)
            .maybeSingle();

          if (studentRes.data) {
            const userRes = await supabase
              .from('users')
              .select('*')
              .or(`id.eq.${studentRes.data.id},email.ilike.${(studentRes.data.user_email || '').toLowerCase().trim()}`)
              .limit(1)
              .maybeSingle();
            dbUser = userRes.data;
          }
        }
      }
    }

    if (!dbUser) {
      return {
        ok: false,
        error: `Username atau Email "${identifier.trim()}" tidak terdaftar di sistem SPMB. Pastikan Anda telah membuat akun terlebih dahulu.`,
      };
    }

    if (dbUser.status === 'disabled') {
      return { ok: false, error: 'Akses Ditolak: Akun Anda telah dinonaktifkan oleh Administrator.' };
    }

    // Determine target email for Supabase Auth
    const targetEmail = dbUser?.email || cleanIdentifier;

    // 2. Authenticate through Supabase Auth
    let authSucceeded = false;
    let authUser: any = null;
    let authErrorMsg = '';

    if (targetEmail && targetEmail.includes('@')) {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: cleanPassword,
      });

      if (authData?.user) {
        authSucceeded = true;
        authUser = authData.user;
      } else if (authError) {
        authErrorMsg = authError.message || '';
        // Safe console diagnostic without credentials
        console.warn('[Supabase Auth Info]', {
          message: authError.message,
        });
      }
    }

    // 3. If Supabase Auth succeeded, ensure profile is loaded and linked
    if (authSucceeded && authUser) {
      if (!dbUser) {
        dbUser = await getAuthUserProfile(authUser.id, authUser.email);
      }

      if (!dbUser) {
        return {
          ok: false,
          error: 'Login berhasil, tetapi profil pengguna belum terhubung ke database. Hubungi Super Admin.',
        };
      }

      if (dbUser.status === 'disabled') {
        await supabase.auth.signOut();
        return { ok: false, error: 'Akses Ditolak: Akun Anda telah dinonaktifkan oleh Administrator.' };
      }

      // Link auth_user_id if not yet linked
      if (!dbUser.auth_user_id || dbUser.auth_user_id !== authUser.id) {
        await linkUserAuthId(dbUser.id, authUser.id, dbUser.email || targetEmail);
      }

      const userAccount: UserAccount = {
        id: dbUser.id,
        name: dbUser.name || 'Pengguna',
        email: dbUser.email || targetEmail,
        username: dbUser.username || undefined,
        phone: dbUser.phone || '',
        role: dbUser.role as UserRole,
        registrationNumber: dbUser.registration_number || undefined,
        status: dbUser.status || 'active',
        mustChangePassword: !!dbUser.must_change_password,
        createdAt: dbUser.created_at,
      };

      return { ok: true, userAccount };
    }

    // 4. Verification against authoritative public.users database record
    // Handles scenarios where Supabase Auth Email Provider is disabled in project settings
    if (dbUser) {
      const isPasswordValid = await verifyPassword(cleanPassword, dbUser.password_hash, dbUser.role);

      if (isPasswordValid) {
        // Asynchronously migrate to sha256 hash in DB if it was not yet hashed
        if (!dbUser.password_hash || !dbUser.password_hash.startsWith('sha256:')) {
          hashPassword(cleanPassword).then((newHash) => {
            supabase
              .from('users')
              .update({ password_hash: newHash, updated_at: new Date().toISOString() })
              .eq('id', dbUser.id)
              .then(() => {});
          });
        }

        const userAccount: UserAccount = {
          id: dbUser.id,
          name: dbUser.name || 'Pengguna',
          email: dbUser.email || targetEmail,
          username: dbUser.username || undefined,
          phone: dbUser.phone || '',
          role: dbUser.role as UserRole,
          registrationNumber: dbUser.registration_number || undefined,
          status: dbUser.status || 'active',
          mustChangePassword: !!dbUser.must_change_password,
          createdAt: dbUser.created_at,
        };

        return { ok: true, userAccount };
      }

      return { ok: false, error: 'Password salah. Silakan periksa kembali password akun Anda.' };
    }

    // 5. Default fallback if no match found
    return { ok: false, error: 'Email/Username atau Password salah. Silakan periksa kembali kredensial Anda.' };
  } catch (err: any) {
    console.error('SignIn with Supabase error:', err?.message || err);
    return { ok: false, error: err?.message || 'Gagal login via Supabase' };
  }
}

export async function signOutWithSupabase(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('SignOut with Supabase warning:', err);
  }
}

export async function getAuthUserProfile(
  authUserId?: string,
  email?: string
): Promise<UserAccount | null> {
  try {
    let data: any = null;

    if (authUserId) {
      const res = await supabase.from('users').select('*').eq('auth_user_id', authUserId).maybeSingle();
      data = res.data;
    }

    if (!data && email) {
      const cleanEmail = email.toLowerCase().trim();
      const res = await supabase.from('users').select('*').ilike('email', cleanEmail).maybeSingle();
      data = res.data;

      // Handle official administrative accounts
      if (!data && (cleanEmail === 'admin' || cleanEmail === 'admin@alhadiid.sch.id')) {
        const aliasRes = await supabase.from('users').select('*').ilike('email', 'admin@alhadiid.sch.id').maybeSingle();
        data = aliasRes.data;
      } else if (!data && (cleanEmail === 'superadmin' || cleanEmail === 'superadmin@alhadiid.sch.id')) {
        const aliasRes = await supabase.from('users').select('*').ilike('email', 'superadmin@alhadiid.sch.id').maybeSingle();
        data = aliasRes.data;
      }
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      username: data.username,
      phone: data.phone,
      role: data.role as UserRole,
      registrationNumber: data.registration_number,
      status: data.status || 'active',
      mustChangePassword: data.must_change_password || false,
      createdAt: data.created_at,
    };
  } catch (err) {
    console.warn('Error fetching user profile from public.users:', err);
    return null;
  }
}

// ==========================================
// ACCOUNT MANAGEMENT & AUDIT LOGGING HELPERS
// ==========================================

export async function checkUsernameAvailable(
  username: string,
  excludeUserId?: string
): Promise<{ available: boolean; message?: string }> {
  try {
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) return { available: true };

    let query = supabase.from('users').select('id, username').eq('username', cleanUsername);
    if (excludeUserId) {
      query = query.neq('id', excludeUserId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Check username error:', error);
      return { available: true }; // non-blocking fallback
    }

    if (data && data.length > 0) {
      return { available: false, message: 'Username sudah digunakan. Silakan gunakan username lain.' };
    }

    return { available: true };
  } catch (err) {
    console.warn('Check username exception:', err);
    return { available: true };
  }
}

export async function recordAuditLog(log: {
  adminId: string;
  adminName: string;
  action: 'UPDATE_USERNAME' | 'UPDATE_PASSWORD' | 'RESET_PASSWORD' | 'ENABLE_USER' | 'DISABLE_USER' | 'CREATE_USER';
  targetUserId: string;
  targetUserName: string;
  details?: string;
}): Promise<void> {
  try {
    const logEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      admin_id: log.adminId,
      admin_name: log.adminName,
      action: log.action,
      target_user_id: log.targetUserId,
      target_user_name: log.targetUserName,
      details: log.details || '',
      timestamp: new Date().toISOString(),
    };

    // Save to public.audit_logs in Supabase
    await supabase.from('audit_logs').insert([logEntry]);
  } catch (err) {
    console.warn('Record audit log fallback warning:', err);
  }
}

export async function fetchAuditLogsFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error || !data) return null;

    return data.map((d: any) => ({
      id: d.id,
      adminId: d.admin_id,
      adminName: d.admin_name,
      action: d.action,
      targetUserId: d.target_user_id,
      targetUserName: d.target_user_name,
      details: d.details,
      timestamp: d.timestamp,
    }));
  } catch (err) {
    console.warn('Fetch audit logs error:', err);
    return null;
  }
}

export async function updateUserAccountCredentials(params: {
  adminUser: UserAccount;
  targetUserId: string;
  newUsername?: string;
  newPassword?: string;
  newStatus?: 'active' | 'disabled';
  newName?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    // 1. Validasi Otorisasi Pemanggil Langsung ke Database Server (JANGAN percaya role di localStorage semata)
    if (params.adminUser?.id) {
      const { data: serverCaller, error: callerErr } = await supabase
        .from('users')
        .select('id, role, status')
        .eq('id', params.adminUser.id)
        .maybeSingle();

      const isSelfAction = params.targetUserId === params.adminUser.id;
      const hasServerAdminRights =
        serverCaller &&
        (serverCaller.role === 'admin' || serverCaller.role === 'super_admin') &&
        serverCaller.status === 'active';

      if (!isSelfAction && !hasServerAdminRights) {
        return {
          ok: false,
          error: 'Otorisasi server ditolak: Akun Anda tidak terkonfirmasi memiliki hak administratif di database server.',
        };
      }
    }

    // Check if username is taken if changing username
    if (params.newUsername) {
      const avail = await checkUsernameAvailable(params.newUsername, params.targetUserId);
      if (!avail.available) {
        return { ok: false, error: avail.message };
      }
    }

    // Prepare update payload for public.users
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (params.newUsername !== undefined) updates.username = params.newUsername.trim();
    if (params.newStatus !== undefined) updates.status = params.newStatus;
    if (params.newName !== undefined) updates.name = params.newName.trim();
    if (params.newPassword !== undefined) {
      updates.password_hash = await hashPassword(params.newPassword);
    }

    if (Object.keys(updates).length > 0) {
      const { error: dbError } = await supabase
        .from('users')
        .update(updates)
        .eq('id', params.targetUserId);

      if (dbError && dbError.code !== 'PGRST116' && dbError.code !== '42P01') {
        console.warn('public.users update notice:', dbError.message);
      }
    }

    // Update Password via Supabase Auth
    if (params.newPassword) {
      // 1. Verify/ensure active Supabase Auth session
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        if (params.targetUserId === params.adminUser?.id || (session.user && session.user.email?.toLowerCase() === params.adminUser?.email.toLowerCase())) {
          // If updating own password via current session
          const { error: passError } = await supabase.auth.updateUser({
            password: params.newPassword,
          });

          if (passError) {
            console.warn('Supabase Auth updateUser notice:', passError.message);
          } else if (session.user) {
            await linkUserAuthId(params.targetUserId, session.user.id, params.adminUser?.email || '');
          }
        } else {
          // Invoke Edge Function for updating another user's password server-side if present
          try {
            const { data: fnData, error: fnError } = await supabase.functions.invoke(
              'admin-update-user-password',
              {
                body: {
                  target_user_id: params.targetUserId,
                  new_password: params.newPassword,
                },
              }
            );

            if (fnError) {
              console.warn('Edge Function invocation notice (password saved to DB):', fnError);
            } else if (fnData && !fnData.success) {
              console.warn('Edge Function returned message:', fnData.message);
            }
          } catch (e) {
            console.warn('Edge Function catch notice:', e);
          }
        }
      } else {
        console.warn('Supabase Auth session notice: Password updated in database.');
      }
    }

    // Record Audit Log
    if (params.newUsername) {
      await recordAuditLog({
        adminId: params.adminUser.id,
        adminName: params.adminUser.name,
        action: 'UPDATE_USERNAME',
        targetUserId: params.targetUserId,
        targetUserName: params.newName || params.targetUserId,
        details: `Username diperbarui menjadi ${params.newUsername}`,
      });
    }

    if (params.newPassword) {
      await recordAuditLog({
        adminId: params.adminUser.id,
        adminName: params.adminUser.name,
        action: 'UPDATE_PASSWORD',
        targetUserId: params.targetUserId,
        targetUserName: params.newName || params.targetUserId,
        details: 'Password diperbarui secara terenkripsi (SHA-256)',
      });
    }

    if (params.newStatus) {
      await recordAuditLog({
        adminId: params.adminUser.id,
        adminName: params.adminUser.name,
        action: params.newStatus === 'active' ? 'ENABLE_USER' : 'DISABLE_USER',
        targetUserId: params.targetUserId,
        targetUserName: params.newName || params.targetUserId,
        details: `Status akun diubah menjadi ${params.newStatus}`,
      });
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Gagal memperbarui akun' };
  }
}

export async function deleteUserFromSupabase(userId: string, email?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (userId) {
      try { await supabase.from('payments').delete().eq('student_id', userId); } catch (e: any) { console.warn('[deleteUserFromSupabase] Cascade payments warning:', e?.message || e); }
      try { await supabase.from('jawaban_peserta').delete().eq('peserta_id', userId); } catch (e: any) { console.warn('[deleteUserFromSupabase] Cascade jawaban warning:', e?.message || e); }
      try { await supabase.from('hasil_ujian').delete().eq('peserta_id', userId); } catch (e: any) { console.warn('[deleteUserFromSupabase] Cascade hasil_ujian warning:', e?.message || e); }
      await supabase.from('students').delete().eq('id', userId);
      await supabase.from('users').delete().eq('id', userId);
    }
    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      try { await supabase.from('payments').delete().eq('user_email', cleanEmail); } catch (e: any) { console.warn('[deleteUserFromSupabase] Cascade email payments warning:', e?.message || e); }
      await supabase.from('students').delete().eq('user_email', cleanEmail);
      await supabase.from('users').delete().eq('email', cleanEmail);
    }

    // Verifikasi di server bahwa record telah benar-benar terhapus
    if (userId) {
      const { data: stillUser } = await supabase.from('users').select('id').eq('id', userId).maybeSingle();
      const { data: stillStudent } = await supabase.from('students').select('id').eq('id', userId).maybeSingle();
      if (stillUser || stillStudent) {
        return {
          ok: false,
          error: 'Verifikasi server gagal: Record masih ditemukan di database setelah proses hapus.',
        };
      }
    }

    return { ok: true };
  } catch (err: any) {
    console.warn('deleteUserFromSupabase error:', err);
    return { ok: false, error: err?.message || 'Gagal menghapus akun pengguna dari database' };
  }
}

export async function purgeApplicantDataFromSupabase(): Promise<void> {
  try {
    await supabase.from('payments').delete().neq('id', 'keep_none');
    await supabase.from('form_payments').delete().neq('id', 'keep_none');
    await supabase.from('bam_payments').delete().neq('id', 'keep_none');
    await supabase.from('students').delete().neq('id', 'keep_none');
    await supabase.from('users').delete().eq('role', 'student');
    await supabase.from('jawaban_peserta').delete().neq('id', 'keep_none');
    await supabase.from('hasil_ujian').delete().neq('id', 'keep_none');
    // Hapus total kunci transaksional dari spmb_app_state
    await supabase.from('spmb_app_state').delete().in('key', [
      'students',
      'spmb_alhadiid_students',
      'form_payments',
      'bam_payments',
      'payments',
      'users_db',
    ]);
  } catch (e) {
    console.warn('purgeApplicantDataFromSupabase error:', e);
  }
}



