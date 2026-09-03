import { createClient } from '@supabase/supabase-js';
import {
  StudentData, ClassQuota, CostBreakdown, SchoolInfo, TestSchedule,
  GasConfig, UserAccount, UserRole, FormPaymentRecord, BamPaymentRecord,
  ExamQuestion, WebsiteConfig
} from '../types';

export const SUPABASE_PROJECT_NAME = 'SPMB 2027-2028';
export const SUPABASE_PROJECT_ID = 'fjscuokehikwhungyvll';

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://fjscuokehikwhungyvll.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqc2N1b2tlaGlrd2h1bmd5dmxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MTQ3NzMsImV4cCI6MjEwMTE5MDc3M30.IPCIdcYcVtDSpF2mJN-4nXf7urb71ZsdsZXWQzs8Ei4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Helper to test connectivity
export async function testSupabaseConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const { data, error } = await supabase.from('spmb_app_state').select('key').limit(1);
    if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
      console.warn('Supabase ping check warning:', error.message);
    }
    return { ok: true, message: `Connected to Supabase (${SUPABASE_PROJECT_NAME})` };
  } catch (err: any) {
    console.error('Supabase connection error:', err);
    return { ok: false, message: err?.message || 'Gagal terhubung ke Supabase' };
  }
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
export async function syncStudentsToSupabase(students: StudentData[]): Promise<void> {
  await saveSupabaseState('students', students);

  if (!students || students.length === 0) return;

  try {
    // 1. Ensure parent records exist in public.users to satisfy foreign key constraint
    const userPayloads = students.map(s => ({
      id: s.id,
      name: s.fullName || 'Calon Murid',
      email: s.userEmail ? s.userEmail.toLowerCase() : `std_${s.id}@alhadiid.sch.id`,
      username: s.userEmail ? s.userEmail.split('@')[0].toLowerCase() : `std_${s.id}`,
      phone: s.phone || '081234567890',
      role: 'student',
      registration_number: s.registrationNumber,
      status: 'active',
      created_at: s.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    await supabase.from('users').upsert(userPayloads, { onConflict: 'id' });

    // 2. Upsert into public.students
    const studentPayloads = students.map(s => ({
      id: s.id,
      registration_number: s.registrationNumber,
      status: s.status || 'draft',
      user_email: s.userEmail ? s.userEmail.toLowerCase() : '',
      full_name: s.fullName || 'Calon Murid',
      phone: s.phone || '081234567890',
      is_form_verified: s.isFormVerified || false,

      form_payment_amount: s.formPaymentAmount || 200000,
      form_payment_status: s.formPaymentStatus || 'unpaid',
      form_payment_proof_url: s.formPaymentProofUrl || null,
      form_payment_date: s.formPaymentDate || null,
      form_payment_notes: s.formPaymentNotes || null,

      nik: s.nik || null,
      nisn: s.nisn || null,
      birth_place: s.birthPlace || null,
      birth_date: s.birthDate || null,
      gender: s.gender || null,
      religion: s.religion || 'Islam',
      child_order: s.childOrder || null,
      total_siblings: s.totalSiblings || null,
      address: s.address || null,
      village: s.village || null,
      subdistrict: s.subdistrict || null,
      city: s.city || null,
      province: s.province || null,
      postal_code: s.postalCode || null,

      previous_school_name: s.previousSchoolName || null,
      previous_school_npsn: s.previousSchoolNpsn || null,
      previous_school_address: s.previousSchoolAddress || null,

      father_name: s.fatherName || null,
      father_birth_place: s.fatherBirthPlace || null,
      father_birth_date: s.fatherBirthDate || null,
      father_job: s.fatherJob || null,
      father_education: s.fatherEducation || null,
      father_phone: s.fatherPhone || null,

      mother_name: s.motherName || null,
      mother_birth_place: s.motherBirthPlace || null,
      mother_birth_date: s.motherBirthDate || null,
      mother_job: s.motherJob || null,
      mother_education: s.motherEducation || null,
      mother_phone: s.motherPhone || null,

      guardian_name: s.guardianName || null,
      guardian_relation: s.guardianRelation || null,
      guardian_phone: s.guardianPhone || null,

      photo_url: s.photoUrl || null,
      kk_url: s.kkUrl || null,
      birth_cert_url: s.birthCertUrl || null,
      report_card_url: s.reportCardUrl || null,
      kip_url: s.kipUrl || null,
      certificate_url: s.certificateUrl || null,

      is_test_active: s.isTestActive || false,
      test_submitted: s.testSubmitted || false,
      test_answers: s.testAnswers || {},
      test_schedule_date: s.testScheduleDate || null,
      test_location: s.testLocation || null,
      diagnostic_score: s.diagnosticScore || null,
      general_score: s.generalScore || null,
      religious_score: s.religiousScore || null,
      final_score: s.finalScore || null,
      test_notes: s.testNotes || null,

      initial_payment_amount: s.initialPaymentAmount || 0,
      initial_payment_status: s.initialPaymentStatus || 'unpaid',
      initial_payment_proof_url: s.initialPaymentProofUrl || null,
      initial_payment_date: s.initialPaymentDate || null,
      initial_payment_notes: s.initialPaymentNotes || null,

      assigned_class_id: s.assignedClassId || null,
      assigned_class_name: s.assignedClassName || null,
      assigned_homeroom_teacher: s.assignedHomeroomTeacher || null,
      first_day_date: s.firstDayDate || null,
      mpls_info: s.mplsInfo || null,

      created_at: s.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    await supabase.from('students').upsert(studentPayloads, { onConflict: 'id' });
  } catch (e) {
    console.warn('Sync to public.students warning:', e);
  }
}

export async function fetchStudentsFromSupabase(): Promise<StudentData[] | null> {
  let kvStudents = await fetchSupabaseState<StudentData[]>('students');

  try {
    const { data: dbStudents, error } = await supabase.from('students').select('*');
    if (!error && dbStudents && dbStudents.length > 0) {
      const mapped: StudentData[] = dbStudents.map((row: any) => ({
        id: row.id,
        registrationNumber: row.registration_number,
        status: row.status,
        userEmail: row.user_email,
        createdAt: row.created_at,
        isFormVerified: row.is_form_verified,
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
        isTestActive: row.is_test_active,
        testSubmitted: row.test_submitted,
        testAnswers: row.test_answers || {},
        testScheduleDate: row.test_schedule_date,
        testLocation: row.test_location,
        diagnosticScore: row.diagnostic_score ? Number(row.diagnostic_score) : undefined,
        generalScore: row.general_score ? Number(row.general_score) : undefined,
        religiousScore: row.religious_score ? Number(row.religious_score) : undefined,
        finalScore: row.final_score ? Number(row.final_score) : undefined,
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
      }));

      if (!kvStudents || kvStudents.length === 0) {
        return mapped;
      }

      // Merge intelligently: kvStudents contains rich JSON data (Base64 uploads, test answers, detailed fields)
      // preserving full user input while updating matching keys from relational DB
      const mapById = new Map<string, StudentData>();
      kvStudents.forEach(s => mapById.set(s.id, s));

      mapped.forEach(rel => {
        const existing = mapById.get(rel.id);
        if (existing) {
          const merged: StudentData = { ...existing };
          (Object.keys(rel) as (keyof StudentData)[]).forEach(k => {
            const relVal = rel[k];
            const extVal = existing[k];
            if (relVal !== null && relVal !== undefined && relVal !== '') {
              if (
                typeof extVal === 'string' &&
                extVal.trim() !== '' &&
                ['Bogor', '2013-01-01', 'Islam', 'Laki-laki', 'S1', 'Ibu Rumah Tangga'].includes(String(relVal)) &&
                !['Bogor', '2013-01-01', 'Islam', 'Laki-laki', 'S1', 'Ibu Rumah Tangga'].includes(extVal)
              ) {
                return;
              }
              (merged as any)[k] = relVal;
            }
          });
          mapById.set(rel.id, merged);
        } else {
          mapById.set(rel.id, rel);
        }
      });

      return Array.from(mapById.values());
    }
  } catch (e) {
    console.warn('fetchStudentsFromSupabase relational fetch error:', e);
  }

  return kvStudents;
}

export async function syncClassQuotasToSupabase(quotas: ClassQuota[]): Promise<void> {
  await saveSupabaseState('class_quotas', quotas);
}

export async function fetchClassQuotasFromSupabase(): Promise<ClassQuota[] | null> {
  return await fetchSupabaseState<ClassQuota[]>('class_quotas');
}

export async function syncSchoolInfoToSupabase(info: SchoolInfo): Promise<void> {
  await saveSupabaseState('school_info', info);
}

export async function fetchSchoolInfoFromSupabase(): Promise<SchoolInfo | null> {
  return await fetchSupabaseState<SchoolInfo>('school_info');
}

export async function syncFormPaymentsToSupabase(records: FormPaymentRecord[]): Promise<void> {
  await saveSupabaseState('form_payments', records);

  if (!records || records.length === 0) return;

  try {
    const payload = records.map(r => ({
      id: r.id,
      transaction_number: r.transactionNumber,
      registration_number: r.registrationNumber,
      student_id: r.studentId,
      student_name: r.studentName,
      gender: r.gender || 'Laki-laki',
      payment_date: r.paymentDate,
      amount: r.amount,
      category: r.category || 'Internal',
      notes: r.notes || '',
      created_at: r.createdAt || new Date().toISOString(),
    }));

    await supabase.from('form_payments').upsert(payload, { onConflict: 'id' });
  } catch (e) {
    console.warn('Sync to public.form_payments warning:', e);
  }
}

export async function fetchFormPaymentsFromSupabase(): Promise<FormPaymentRecord[] | null> {
  const kvData = await fetchSupabaseState<FormPaymentRecord[]>('form_payments');

  try {
    const { data: dbData, error } = await supabase.from('form_payments').select('*');
    if (!error && dbData && dbData.length > 0) {
      const mapped: FormPaymentRecord[] = dbData.map((row: any) => ({
        id: row.id,
        transactionNumber: row.transaction_number,
        registrationNumber: row.registration_number,
        studentId: row.student_id,
        studentName: row.student_name,
        gender: row.gender,
        paymentDate: row.payment_date,
        amount: Number(row.amount || 200000),
        category: row.category,
        notes: row.notes,
        createdAt: row.created_at,
      }));
      return mapped;
    }
  } catch (e) {
    console.warn('fetchFormPaymentsFromSupabase error:', e);
  }

  return kvData;
}

export async function syncBamPaymentsToSupabase(records: BamPaymentRecord[]): Promise<void> {
  await saveSupabaseState('bam_payments', records);

  if (!records || records.length === 0) return;

  try {
    const payload = records.map(r => ({
      id: r.id,
      transaction_number: r.transactionNumber,
      registration_number: r.registrationNumber,
      student_id: r.studentId,
      student_name: r.studentName,
      gender: r.gender || 'Laki-laki',
      payment_date: r.paymentDate,
      total_bam_cost: r.totalBamCost || 8500000,
      amount_paid: r.amountPaid || 0,
      installment_type: r.installmentType || 'Lunas',
      total_paid_to_date: r.totalPaidToDate || r.amountPaid || 0,
      remaining_balance: r.remainingBalance ?? ((r.totalBamCost || 8500000) - (r.totalPaidToDate || r.amountPaid || 0)),
      notes: r.notes || '',
      created_at: r.createdAt || new Date().toISOString(),
    }));

    await supabase.from('bam_payments').upsert(payload, { onConflict: 'id' });
  } catch (e) {
    console.warn('Sync to public.bam_payments warning:', e);
  }
}

export async function fetchBamPaymentsFromSupabase(): Promise<BamPaymentRecord[] | null> {
  const kvData = await fetchSupabaseState<BamPaymentRecord[]>('bam_payments');

  try {
    const { data: dbData, error } = await supabase.from('bam_payments').select('*');
    if (!error && dbData && dbData.length > 0) {
      const mapped: BamPaymentRecord[] = dbData.map((row: any) => ({
        id: row.id,
        transactionNumber: row.transaction_number,
        registrationNumber: row.registration_number,
        studentId: row.student_id,
        studentName: row.student_name,
        gender: row.gender,
        paymentDate: row.payment_date,
        totalBamCost: Number(row.total_bam_cost || 8500000),
        amountPaid: Number(row.amount_paid || 0),
        installmentType: row.installment_type,
        totalPaidToDate: Number(row.total_paid_to_date || 0),
        remainingBalance: Number(row.remaining_balance || 0),
        notes: row.notes,
        createdAt: row.created_at,
      }));
      return mapped;
    }
  } catch (e) {
    console.warn('fetchBamPaymentsFromSupabase error:', e);
  }

  return kvData;
}

export async function syncCostBreakdownToSupabase(costs: CostBreakdown[]): Promise<void> {
  await saveSupabaseState('cost_breakdown', costs);
}

export async function fetchCostBreakdownFromSupabase(): Promise<CostBreakdown[] | null> {
  return await fetchSupabaseState<CostBreakdown[]>('cost_breakdown');
}

export async function syncTestSchedulesToSupabase(schedules: TestSchedule[]): Promise<void> {
  await saveSupabaseState('test_schedules', schedules);
}

export async function fetchTestSchedulesFromSupabase(): Promise<TestSchedule[] | null> {
  return await fetchSupabaseState<TestSchedule[]>('test_schedules');
}

export async function syncQuestionBankToSupabase(questions: ExamQuestion[]): Promise<void> {
  await saveSupabaseState('question_bank', questions);
}

export async function fetchQuestionBankFromSupabase(): Promise<ExamQuestion[] | null> {
  return await fetchSupabaseState<ExamQuestion[]>('question_bank');
}

export async function syncGasConfigToSupabase(config: GasConfig): Promise<void> {
  await saveSupabaseState('gas_config', config);
}

export async function fetchGasConfigFromSupabase(): Promise<GasConfig | null> {
  return await fetchSupabaseState<GasConfig>('gas_config');
}

export async function syncWebsiteConfigToSupabase(config: WebsiteConfig): Promise<void> {
  await saveSupabaseState('website_config', config);
}

export async function fetchWebsiteConfigFromSupabase(): Promise<WebsiteConfig | null> {
  return await fetchSupabaseState<WebsiteConfig>('website_config');
}

export async function syncUsersDbToSupabase(users: UserAccount[]): Promise<void> {
  await saveSupabaseState('users_db', users);

  if (!users || users.length === 0) return;

  for (const u of users) {
    try {
      const payload = {
        id: u.id,
        name: u.name,
        email: u.email.toLowerCase(),
        username: u.username || u.email.split('@')[0].toLowerCase(),
        phone: u.phone,
        role: u.role,
        registration_number: u.registrationNumber || null,
        status: u.status || 'active',
        must_change_password: u.mustChangePassword || false,
        created_at: u.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' });
      if (error) {
        await supabase.from('users').upsert(payload, { onConflict: 'email' });
      }
    } catch (e) {
      console.warn(`Sync to public.users warning for ${u.id}:`, e);
    }
  }
}

export async function fetchUsersDbFromSupabase(): Promise<UserAccount[] | null> {
  const kvUsers = await fetchSupabaseState<UserAccount[]>('users_db');

  try {
    const { data: dbUsers, error } = await supabase.from('users').select('*');
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

      if (!kvUsers || kvUsers.length === 0) return mapped;
      const mapById = new Map<string, UserAccount>();
      kvUsers.forEach(u => mapById.set(u.id, u));

      mapped.forEach(rel => {
        const existing = mapById.get(rel.id);
        if (existing) {
          mapById.set(rel.id, {
            ...existing,
            ...rel,
            password: existing.password || rel.password,
            username: rel.username || existing.username,
            phone: rel.phone || existing.phone,
            registrationNumber: rel.registrationNumber || existing.registrationNumber,
          });
        } else {
          mapById.set(rel.id, rel);
        }
      });

      return Array.from(mapById.values());
    }
  } catch (e) {
    console.warn('fetchUsersDbFromSupabase relational fetch error:', e);
  }

  return kvUsers;
}

// ==========================================
// SUPABASE AUTHENTICATION & SECURITY HELPERS
// ==========================================

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

    if (!cleanPassword || cleanPassword.length < 6) {
      return { ok: false, error: 'Password minimal 6 karakter!' };
    }

    // 1. Register user with Supabase Auth
    const cleanOrigin = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : undefined;

    let authUserId: string | undefined = undefined;
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: cleanPassword,
      options: {
        emailRedirectTo: cleanOrigin,
        data: {
          full_name: params.fullName,
          username: params.username,
          phone: params.phone,
          role: params.role,
        },
      },
    });

    if (authError) {
      console.warn('Supabase Auth signUp notice:', authError.message);
      if (authError.message.toLowerCase().includes('already registered') || authError.message.toLowerCase().includes('already exists')) {
        return { ok: false, error: 'Email ini sudah terdaftar. Silakan login ke portal.' };
      }
    } else {
      authUserId = authData.user?.id;
    }

    const userId = params.role === 'student' ? `std_${Date.now()}` : `usr_${Date.now()}`;
    const regNum = params.registrationNumber || (params.role === 'student' ? `SPMB2027${Math.floor(1000 + Math.random() * 9000)}` : undefined);

    const userAccount: UserAccount = {
      id: userId,
      name: params.fullName,
      email: cleanEmail,
      username: params.username,
      phone: params.phone,
      password: cleanPassword,
      role: params.role,
      registrationNumber: regNum,
      createdAt: new Date().toISOString(),
    };

    // 2. Upsert to public.users table mapping auth_user_id
    try {
      const { error: userErr } = await supabase.from('users').upsert({
        id: userId,
        auth_user_id: authUserId || null,
        name: params.fullName,
        email: cleanEmail,
        username: params.username || cleanEmail.split('@')[0],
        phone: params.phone,
        role: params.role,
        registration_number: regNum,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

      if (userErr) {
        console.warn('Upsert public.users notice:', userErr.message || userErr);
      }
    } catch (e) {
      console.warn('Upsert public.users fallback warning:', e);
    }

    // 3. Upsert to public.students table if role is student
    if (params.role === 'student') {
      try {
        const { error: studentErr } = await supabase.from('students').upsert({
          id: userId,
          registration_number: regNum,
          user_email: cleanEmail,
          full_name: params.fullName,
          phone: params.phone,
          status: 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

        if (studentErr) {
          console.warn('Upsert public.students notice:', studentErr.message || studentErr);
        }
      } catch (e) {
        console.warn('Upsert public.students fallback warning:', e);
      }
    }

    // 4. If Supabase Auth did not generate immediate session (e.g. email confirm required), attempt auto sign-in
    if (cleanPassword && !authData?.session) {
      try {
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });
      } catch (e) {
        console.warn('Auto sign-in after sign-up notice:', e);
      }
    }

    return { ok: true, authUserId, userAccount };
  } catch (err: any) {
    console.error('SignUp with Supabase error:', err);
    return { ok: false, error: err?.message || 'Gagal mendaftar via Supabase Auth' };
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
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInData?.session) {
        if (signInData.user) {
          await linkUserAuthId(userProfile?.id || signInData.user.id, signInData.user.id, email);
        }
        return { ok: true, session: signInData.session };
      }

      // 4. If signIn failed (e.g. user not in auth.users yet), try signUp
      const { data: signUpData } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: userProfile?.name || email.split('@')[0],
            role: userProfile?.role || 'admin',
          },
        },
      });

      if (signUpData?.session) {
        if (signUpData.user) {
          await linkUserAuthId(userProfile?.id || signUpData.user.id, signUpData.user.id, email);
        }
        return { ok: true, session: signUpData.session };
      }

      // Retry signIn after signUp
      const { data: retrySignIn } = await supabase.auth.signInWithPassword({ email, password });
      if (retrySignIn?.session) {
        if (retrySignIn.user) {
          await linkUserAuthId(userProfile?.id || retrySignIn.user.id, retrySignIn.user.id, email);
        }
        return { ok: true, session: retrySignIn.session };
      }
    }

    // 5. Check if there's any active session
    const { data: finalCheck } = await supabase.auth.getSession();
    if (finalCheck.session) {
      return { ok: true, session: finalCheck.session };
    }

    return { ok: false, error: 'Auth session missing!' };
  } catch (err: any) {
    console.warn('ensureSupabaseAuthSession error:', err);
    return { ok: false, error: err?.message || 'Gagal memverifikasi session Supabase Auth' };
  }
}

export async function signInWithSupabase(
  identifier: string,
  password: string
): Promise<{ ok: boolean; userAccount?: UserAccount; error?: string }> {
  try {
    const cleanIdentifier = identifier.trim().toLowerCase();
    const cleanPassword = password.trim();

    let targetEmail = cleanIdentifier;

    // Resolve username to email from public.users if not an email format
    if (!cleanIdentifier.includes('@')) {
      const { data: userByUsername } = await supabase
        .from('users')
        .select('email')
        .or(`username.eq.${cleanIdentifier},registration_number.eq.${cleanIdentifier},name.ilike.%${cleanIdentifier}%`)
        .maybeSingle();

      if (userByUsername?.email) {
        targetEmail = userByUsername.email;
      }
    }

    // 1. Attempt login with Supabase Auth
    let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password: cleanPassword,
    });

    if (authError) {
      // Auto-register / provision in Supabase Auth if user doesn't exist yet
      if (
        authError.message.includes('Invalid login credentials') ||
        authError.message.includes('User not found') ||
        authError.message.includes('email_not_confirmed')
      ) {
        const { data: signUpData } = await supabase.auth.signUp({
          email: targetEmail,
          password: cleanPassword,
          options: {
            data: {
              full_name: targetEmail.split('@')[0],
              role: targetEmail.includes('superadmin') ? 'super_admin' : 'admin',
            },
          },
        });

        if (signUpData?.user && signUpData.session) {
          authData = { user: signUpData.user, session: signUpData.session };
          authError = null;
        } else {
          // Retry sign-in
          const { data: retryData, error: retryErr } = await supabase.auth.signInWithPassword({
            email: targetEmail,
            password: cleanPassword,
          });
          if (retryData?.user) {
            authData = retryData;
            authError = null;
          }
        }
      }

      if (authError) {
        return { ok: false, error: authError.message };
      }
    }

    const authUser = authData.user;
    if (!authUser) {
      return { ok: false, error: 'User tidak ditemukan' };
    }

    // 2. Fetch authoritative user profile from public.users
    let userAccount = await getAuthUserProfile(authUser.id, authUser.email);

    if (!userAccount) {
      // Fallback: create or link public.users entry
      const role = (authUser.user_metadata?.role as UserRole) || (targetEmail.includes('superadmin') ? 'super_admin' : 'student');
      const name = authUser.user_metadata?.full_name || (role === 'super_admin' ? 'Super Admin SPMB' : authUser.email?.split('@')[0] || 'User');
      const userId = role === 'super_admin' ? 'usr_superadmin' : (role === 'student' ? `std_${Date.now()}` : `usr_${Date.now()}`);

      userAccount = {
        id: userId,
        name,
        email: authUser.email || targetEmail,
        phone: authUser.user_metadata?.phone || '081234567890',
        role,
        createdAt: new Date().toISOString(),
      };

      try {
        await supabase.from('users').upsert({
          id: userId,
          auth_user_id: authUser.id,
          name: userAccount.name,
          email: userAccount.email,
          phone: userAccount.phone,
          role: userAccount.role,
          created_at: userAccount.createdAt,
        }, { onConflict: 'id' });
      } catch (e) {
        console.warn('Fallback public.users upsert warning:', e);
      }
    } else {
      // Ensure auth_user_id is set
      await linkUserAuthId(userAccount.id, authUser.id, authUser.email || targetEmail);
    }

    return { ok: true, userAccount };
  } catch (err: any) {
    console.error('SignIn with Supabase error:', err);
    return { ok: false, error: err?.message || 'Gagal login via Supabase Auth' };
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
    let query = supabase.from('users').select('*');
    if (authUserId) {
      query = query.eq('auth_user_id', authUserId);
    } else if (email) {
      query = query.eq('email', email.toLowerCase());
    } else {
      return null;
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
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
    // Check if username is taken if changing username
    if (params.newUsername) {
      const avail = await checkUsernameAvailable(params.newUsername, params.targetUserId);
      if (!avail.available) {
        return { ok: false, error: avail.message };
      }
    }

    // Prepare update payload for public.users
    const updates: Record<string, any> = {};
    if (params.newUsername !== undefined) updates.username = params.newUsername.trim();
    if (params.newStatus !== undefined) updates.status = params.newStatus;
    if (params.newName !== undefined) updates.name = params.newName.trim();
    if (params.newPassword !== undefined) updates.password = params.newPassword;

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
      let { data: { session } } = await supabase.auth.getSession();

      if (!session && params.adminUser?.email && params.adminUser?.password) {
        const authRes = await ensureSupabaseAuthSession(
          params.adminUser.email,
          params.adminUser.password,
          params.adminUser
        );
        if (authRes.session) {
          session = authRes.session;
        }
      }

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
        console.warn('Supabase Auth session notice: Password updated in database and local storage.');
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
        details: 'Password diperbarui secara terenkripsi',
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

export async function deleteUserFromSupabase(userId: string, email?: string): Promise<void> {
  try {
    if (userId) {
      await supabase.from('users').delete().eq('id', userId);
      await supabase.from('students').delete().eq('id', userId);
    }
    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      await supabase.from('users').delete().eq('email', cleanEmail);
      await supabase.from('students').delete().eq('user_email', cleanEmail);
    }
  } catch (err) {
    console.warn('deleteUserFromSupabase error:', err);
  }
}

export async function purgeApplicantDataFromSupabase(): Promise<void> {
  try {
    await supabase.from('form_payments').delete().neq('id', 'keep_none');
    await supabase.from('bam_payments').delete().neq('id', 'keep_none');
    await supabase.from('students').delete().neq('id', 'keep_none');
    await supabase.from('users').delete().eq('role', 'student');
    await supabase.from('jawaban_peserta').delete().neq('id', 'keep_none');
    await supabase.from('hasil_ujian').delete().neq('id', 'keep_none');
    await saveSupabaseState('students', []);
    await saveSupabaseState('form_payments', []);
    await saveSupabaseState('bam_payments', []);
  } catch (e) {
    console.warn('purgeApplicantDataFromSupabase error:', e);
  }
}



