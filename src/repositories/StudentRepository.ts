// =====================================================================
// src/repositories/StudentRepository.ts
// Single Source of Truth Repository for public.students
// =====================================================================

import { supabase } from '../utils/supabaseClient';
import { StudentData, AdmissionStatus } from '../types';

export const VALID_STUDENT_DB_COLUMNS = new Set([
  'id',
  'registration_number',
  'user_email',
  'status',
  'created_at',
  'updated_at',
  'full_name',
  'phone',
  'form_payment_proof_url',
  'form_payment_date',
  'form_payment_amount',
  'form_payment_status',
  'form_payment_notes',
  'nik',
  'nisn',
  'birth_place',
  'birth_date',
  'gender',
  'religion',
  'address',
  'subdistrict',
  'city',
  'province',
  'postal_code',
  'previous_school_name',
  'previous_school_npsn',
  'previous_school_address',
  'father_name',
  'father_job',
  'father_education',
  'father_phone',
  'mother_name',
  'mother_job',
  'mother_education',
  'mother_phone',
  'guardian_name',
  'guardian_relation',
  'guardian_phone',
  'photo_url',
  'kk_url',
  'birth_cert_url',
  'report_card_url',
  'kip_url',
  'certificate_url',
  'test_schedule_date',
  'test_location',
  'diagnostic_score',
  'general_score',
  'religious_score',
  'final_score',
  'test_notes',
  'initial_payment_proof_url',
  'initial_payment_date',
  'initial_payment_amount',
  'initial_payment_status',
  'initial_payment_notes',
  'assigned_class_id',
  'assigned_class_name',
  'assigned_homeroom_teacher',
  'first_day_date',
  'mpls_info'
]);

export function mapRowToStudent(row: any): StudentData {
  return {
    id: row.id,
    registrationNumber: row.registration_number,
    status: (row.status || 'draft') as AdmissionStatus,
    userEmail: row.user_email || '',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at,
    version: row.version ?? 1,
    isFormVerified: !!(row.is_form_verified || row.form_payment_status === 'verified'),

    fullName: row.full_name || '',
    phone: row.phone || '',

    // Form Payment
    formPaymentAmount: Number(row.form_payment_amount ?? 200000),
    formPaymentStatus: row.form_payment_status || 'unpaid',
    formPaymentProofUrl: row.form_payment_proof_url || undefined,
    formPaymentDate: row.form_payment_date || undefined,
    formPaymentNotes: row.form_payment_notes || undefined,

    // Biodata
    nik: row.nik || '',
    nisn: row.nisn || undefined,
    birthPlace: row.birth_place || '',
    birthDate: row.birth_date || '',
    gender: row.gender || 'Laki-laki',
    religion: row.religion || 'Islam',
    childOrder: row.child_order || undefined,
    totalSiblings: row.total_siblings || undefined,
    address: row.address || '',
    village: row.village || undefined,
    subdistrict: row.subdistrict || '',
    city: row.city || '',
    province: row.province || '',
    postalCode: row.postal_code || undefined,

    // School Origin
    previousSchoolName: row.previous_school_name || '',
    previousSchoolNpsn: row.previous_school_npsn || undefined,
    previousSchoolAddress: row.previous_school_address || undefined,

    // Parents
    fatherName: row.father_name || '',
    fatherBirthPlace: row.father_birth_place || undefined,
    fatherBirthDate: row.father_birth_date || undefined,
    fatherJob: row.father_job || undefined,
    fatherEducation: row.father_education || '',
    fatherPhone: row.father_phone || '',

    motherName: row.mother_name || '',
    motherBirthPlace: row.mother_birth_place || undefined,
    motherBirthDate: row.mother_birth_date || undefined,
    motherJob: row.mother_job || '',
    motherEducation: row.mother_education || undefined,
    motherPhone: row.mother_phone || '',

    guardianName: row.guardian_name || undefined,
    guardianRelation: row.guardian_relation || undefined,
    guardianPhone: row.guardian_phone || undefined,

    // Uploaded Documents
    photoUrl: row.photo_url || undefined,
    kkUrl: row.kk_url || undefined,
    birthCertUrl: row.birth_cert_url || undefined,
    reportCardUrl: row.report_card_url || undefined,
    kipUrl: row.kip_url || undefined,
    certificateUrl: row.certificate_url || undefined,

    // Test Information
    isTestActive: Boolean(
      row.is_test_active ||
      (row.test_notes && row.test_notes.includes('[IS_TEST_ACTIVE:true]')) ||
      row.status === 'scheduled_test'
    ),
    testSubmitted: Boolean(
      row.test_submitted ||
      (row.test_notes && row.test_notes.includes('[TEST_SUBMITTED:true]')) ||
      row.status === 'test_completed' ||
      (row.final_score !== null && row.final_score !== undefined)
    ),
    testAnswers: typeof row.test_answers === 'object' && row.test_answers ? row.test_answers : {},
    testScheduleDate: row.test_schedule_date || undefined,
    testLocation: row.test_location || undefined,
    diagnosticScore: row.diagnostic_score !== null && row.diagnostic_score !== undefined ? Number(row.diagnostic_score) : undefined,
    generalScore: row.general_score !== null && row.general_score !== undefined ? Number(row.general_score) : undefined,
    religiousScore: row.religious_score !== null && row.religious_score !== undefined ? Number(row.religious_score) : undefined,
    finalScore: row.final_score !== null && row.final_score !== undefined ? Number(row.final_score) : undefined,
    testNotes: row.test_notes || undefined,

    // Initial Payment / BAM
    initialPaymentAmount: Number(row.initial_payment_amount ?? 0),
    initialPaymentStatus: row.initial_payment_status || 'unpaid',
    initialPaymentProofUrl: row.initial_payment_proof_url || undefined,
    initialPaymentDate: row.initial_payment_date || undefined,
    initialPaymentNotes: row.initial_payment_notes || undefined,

    // Placement
    assignedClassId: row.assigned_class_id || undefined,
    assignedClassName: row.assigned_class_name || undefined,
    assignedHomeroomTeacher: row.assigned_homeroom_teacher || undefined,
    firstDayDate: row.first_day_date || undefined,
    mplsInfo: row.mpls_info || undefined,
  };
}

/**
 * Membersihkan dan memvalidasi nilai tanggal untuk kolom DATE PostgreSQL.
 * PostgreSQL menolak string kosong "" dengan fatal error:
 * "invalid input syntax for type date: """
 * Fungsi ini mengonversi string kosong, whitespace, atau format invalid menjadi null.
 * Juga mampu mem-parsing tanggal standar ISO, YYYY-MM-DD, dan teks Indonesia ("12 Juli 2027").
 */
export function sanitizeDate(val: any): string | null {
  if (val === undefined || val === null) return null;
  if (typeof val !== 'string') {
    if (val instanceof Date && !isNaN(val.getTime())) {
      return val.toISOString().split('T')[0];
    }
    return null;
  }
  const trimmed = val.trim();
  if (
    !trimmed ||
    trimmed === 'null' ||
    trimmed === 'undefined' ||
    trimmed === '""' ||
    trimmed === "''" ||
    trimmed === '-'
  ) {
    return null;
  }

  // Jika string ISO yang memiliki jam (contoh: 2026-09-11T00:00:00.000Z)
  if (trimmed.includes('T')) {
    const datePart = trimmed.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return datePart;
    }
  }

  // Jika sudah format valid YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Format tanggal Indonesia seperti "12 Juli 2027" atau "15 April 2027"
  const bulanMap: Record<string, string> = {
    januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
    juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12',
    jan: '01', feb: '02', mar: '03', apr: '04', jun: '06', jul: '07', agu: '08', ags: '08',
    sep: '09', okt: '10', nov: '11', des: '12'
  };
  const indonesianDateMatch = trimmed.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/i);
  if (indonesianDateMatch) {
    const day = indonesianDateMatch[1].padStart(2, '0');
    const monthName = indonesianDateMatch[2].toLowerCase();
    const year = indonesianDateMatch[3];
    const month = bulanMap[monthName];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  // Mencoba parsing JavaScript Date standar
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

const DATE_DB_COLUMNS = new Set([
  'birth_date',
  'father_birth_date',
  'mother_birth_date',
  'form_payment_date',
  'test_schedule_date',
  'initial_payment_date',
  'first_day_date',
]);

export function mapStudentToRow(s: Partial<StudentData>): Record<string, any> {
  const row: Record<string, any> = {};

  if (s.id !== undefined) row.id = s.id;
  if (s.registrationNumber !== undefined) row.registration_number = s.registrationNumber;
  if (s.status !== undefined) row.status = s.status;
  if (s.userEmail !== undefined) row.user_email = s.userEmail.toLowerCase();
  if (s.fullName !== undefined) row.full_name = s.fullName;
  if (s.phone !== undefined) row.phone = s.phone;
  // Note: is_form_verified is represented by form_payment_status === 'verified' in database
  if (s.isFormVerified === true && s.formPaymentStatus === undefined) {
    row.form_payment_status = 'verified';
  }

  if (s.formPaymentAmount !== undefined) row.form_payment_amount = s.formPaymentAmount;
  if (s.formPaymentStatus !== undefined) row.form_payment_status = s.formPaymentStatus;
  if (s.formPaymentProofUrl !== undefined) row.form_payment_proof_url = s.formPaymentProofUrl;
  if (s.formPaymentDate !== undefined) row.form_payment_date = sanitizeDate(s.formPaymentDate);
  if (s.formPaymentNotes !== undefined) row.form_payment_notes = s.formPaymentNotes;

  if (s.nik !== undefined) row.nik = s.nik;
  if (s.nisn !== undefined) row.nisn = s.nisn;
  if (s.birthPlace !== undefined) row.birth_place = s.birthPlace;
  if (s.birthDate !== undefined) row.birth_date = sanitizeDate(s.birthDate);
  if (s.gender !== undefined) row.gender = s.gender;
  if (s.religion !== undefined) row.religion = s.religion;
  if (s.childOrder !== undefined) row.child_order = s.childOrder;
  if (s.totalSiblings !== undefined) row.total_siblings = s.totalSiblings;
  if (s.address !== undefined) row.address = s.address;
  if (s.village !== undefined) row.village = s.village;
  if (s.subdistrict !== undefined) row.subdistrict = s.subdistrict;
  if (s.city !== undefined) row.city = s.city;
  if (s.province !== undefined) row.province = s.province;
  if (s.postalCode !== undefined) row.postal_code = s.postalCode;

  if (s.previousSchoolName !== undefined) row.previous_school_name = s.previousSchoolName;
  if (s.previousSchoolNpsn !== undefined) row.previous_school_npsn = s.previousSchoolNpsn;
  if (s.previousSchoolAddress !== undefined) row.previous_school_address = s.previousSchoolAddress;

  if (s.fatherName !== undefined) row.father_name = s.fatherName;
  if (s.fatherBirthPlace !== undefined) row.father_birth_place = s.fatherBirthPlace;
  if (s.fatherBirthDate !== undefined) row.father_birth_date = sanitizeDate(s.fatherBirthDate);
  if (s.fatherJob !== undefined) row.father_job = s.fatherJob;
  if (s.fatherEducation !== undefined) row.father_education = s.fatherEducation;
  if (s.fatherPhone !== undefined) row.father_phone = s.fatherPhone;

  if (s.motherName !== undefined) row.mother_name = s.motherName;
  if (s.motherBirthPlace !== undefined) row.mother_birth_place = s.motherBirthPlace;
  if (s.motherBirthDate !== undefined) row.mother_birth_date = sanitizeDate(s.motherBirthDate);
  if (s.motherJob !== undefined) row.mother_job = s.motherJob;
  if (s.motherEducation !== undefined) row.mother_education = s.motherEducation;
  if (s.motherPhone !== undefined) row.mother_phone = s.motherPhone;

  if (s.guardianName !== undefined) row.guardian_name = s.guardianName;
  if (s.guardianRelation !== undefined) row.guardian_relation = s.guardianRelation;
  if (s.guardianPhone !== undefined) row.guardian_phone = s.guardianPhone;

  if (s.photoUrl !== undefined) row.photo_url = s.photoUrl;
  if (s.kkUrl !== undefined) row.kk_url = s.kkUrl;
  if (s.birthCertUrl !== undefined) row.birth_cert_url = s.birthCertUrl;
  if (s.reportCardUrl !== undefined) row.report_card_url = s.reportCardUrl;
  if (s.kipUrl !== undefined) row.kip_url = s.kipUrl;
  if (s.certificateUrl !== undefined) row.certificate_url = s.certificateUrl;

  // Catatan: is_test_active & test_submitted dienkode ke test_notes agar kompatibel dengan skema Supabase
  let currentNotes = s.testNotes || '';
  if (s.isTestActive !== undefined) {
    const cleanNotes = currentNotes.replace(/\[IS_TEST_ACTIVE:(true|false)\]/g, '').trim();
    currentNotes = s.isTestActive
      ? (cleanNotes ? `${cleanNotes} [IS_TEST_ACTIVE:true]` : '[IS_TEST_ACTIVE:true]')
      : cleanNotes;
  }
  if (s.testSubmitted !== undefined) {
    const cleanNotes = currentNotes.replace(/\[TEST_SUBMITTED:(true|false)\]/g, '').trim();
    currentNotes = s.testSubmitted
      ? (cleanNotes ? `${cleanNotes} [TEST_SUBMITTED:true]` : '[TEST_SUBMITTED:true]')
      : cleanNotes;
  }
  if (currentNotes) {
    row.test_notes = currentNotes;
  }

  if (s.testScheduleDate !== undefined) row.test_schedule_date = sanitizeDate(s.testScheduleDate);
  if (s.testLocation !== undefined) row.test_location = s.testLocation;
  if (s.diagnosticScore !== undefined) row.diagnostic_score = s.diagnosticScore;
  if (s.generalScore !== undefined) row.general_score = s.generalScore;
  if (s.religiousScore !== undefined) row.religious_score = s.religiousScore;
  if (s.finalScore !== undefined) row.final_score = s.finalScore;

  if (s.initialPaymentAmount !== undefined) row.initial_payment_amount = s.initialPaymentAmount;
  if (s.initialPaymentStatus !== undefined) row.initial_payment_status = s.initialPaymentStatus;
  if (s.initialPaymentProofUrl !== undefined) row.initial_payment_proof_url = s.initialPaymentProofUrl;
  if (s.initialPaymentDate !== undefined) row.initial_payment_date = sanitizeDate(s.initialPaymentDate);
  if (s.initialPaymentNotes !== undefined) row.initial_payment_notes = s.initialPaymentNotes;

  if (s.assignedClassId !== undefined) row.assigned_class_id = s.assignedClassId;
  if (s.assignedClassName !== undefined) row.assigned_class_name = s.assignedClassName;
  if (s.assignedHomeroomTeacher !== undefined) row.assigned_homeroom_teacher = s.assignedHomeroomTeacher;
  if (s.firstDayDate !== undefined) row.first_day_date = sanitizeDate(s.firstDayDate);
  if (s.mplsInfo !== undefined) row.mpls_info = s.mplsInfo;

  row.updated_at = new Date().toISOString();

  // Filter hanya kolom yang benar-benar ada di tabel public.students Supabase
  // dan pastikan semua kolom tanggal tidak bernilai string kosong ""
  const sanitizedRow: Record<string, any> = {};
  for (const [key, val] of Object.entries(row)) {
    if (VALID_STUDENT_DB_COLUMNS.has(key) && val !== undefined) {
      if (DATE_DB_COLUMNS.has(key)) {
        sanitizedRow[key] = sanitizeDate(val);
      } else {
        sanitizedRow[key] = val;
      }
    }
  }
  return sanitizedRow;
}

function cleanLocalStudentCache(id: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      // 1. Clean alhadiid_spmb_students
      const raw = window.localStorage.getItem('alhadiid_spmb_students');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((s: any) => s.id !== id && s.registrationNumber !== id && !s.id?.startsWith('std_00'));
          window.localStorage.setItem('alhadiid_spmb_students', JSON.stringify(filtered));
        }
      }

      // 2. Clean alhadiid_spmb_users_db
      const rawUsers = window.localStorage.getItem('alhadiid_spmb_users_db');
      if (rawUsers) {
        const parsedUsers = JSON.parse(rawUsers);
        if (Array.isArray(parsedUsers)) {
          const filteredUsers = parsedUsers.filter((u: any) => u.id !== id && !u.id?.startsWith('std_00'));
          window.localStorage.setItem('alhadiid_spmb_users_db', JSON.stringify(filteredUsers));
        }
      }

      // 3. Clean current user if matching tombstoned ID
      const rawCurr = window.localStorage.getItem('alhadiid_spmb_current_user');
      if (rawCurr) {
        const parsedCurr = JSON.parse(rawCurr);
        if (parsedCurr && (parsedCurr.id === id || parsedCurr.id?.startsWith('std_00') || parsedCurr.email === 'fathan.alkhatiri@gmail.com')) {
          window.localStorage.removeItem('alhadiid_spmb_current_user');
        }
      }

      // 4. Clean form payments
      const rawFp = window.localStorage.getItem('alhadiid_spmb_form_payments');
      if (rawFp) {
        const parsedFp = JSON.parse(rawFp);
        if (Array.isArray(parsedFp)) {
          const filteredFp = parsedFp.filter((f: any) => f.studentId !== id && f.studentId !== 'std_001');
          window.localStorage.setItem('alhadiid_spmb_form_payments', JSON.stringify(filteredFp));
        }
      }

      // 5. Clean bam payments
      const rawBp = window.localStorage.getItem('alhadiid_spmb_bam_payments');
      if (rawBp) {
        const parsedBp = JSON.parse(rawBp);
        if (Array.isArray(parsedBp)) {
          const filteredBp = parsedBp.filter((b: any) => b.studentId !== id && b.studentId !== 'std_001');
          window.localStorage.setItem('alhadiid_spmb_bam_payments', JSON.stringify(filteredBp));
        }
      }
    }
  } catch (err: any) {
    console.warn('[StudentRepository] cleanLocalStudentCache warning:', err?.message || err);
  }
}

function mergeHasilUjianIntoStudent(s: StudentData, hu: any): StudentData {
  if (!hu) return s;
  const diag = hu.nilai_diagnostik !== null && hu.nilai_diagnostik !== undefined ? Number(hu.nilai_diagnostik) : s.diagnosticScore;
  const gen = hu.nilai_tpu !== null && hu.nilai_tpu !== undefined ? Number(hu.nilai_tpu) : s.generalScore;
  const rel = hu.nilai_diniyyah !== null && hu.nilai_diniyyah !== undefined ? Number(hu.nilai_diniyyah) : s.religiousScore;
  const finRaw = hu.nilai_akhir !== null && hu.nilai_akhir !== undefined ? Number(hu.nilai_akhir) : (hu.nilai_total !== null && hu.nilai_total !== undefined ? Number(hu.nilai_total) : s.finalScore);
  const fin = finRaw !== undefined ? finRaw : s.finalScore;

  let newStatus = s.status;
  if (hu.status_kelulusan === 'LULUS' && (!newStatus || newStatus === 'draft' || newStatus === 'form_verified' || newStatus === 'scheduled_test' || newStatus === 'test_completed')) {
    newStatus = 'passed';
  } else if ((hu.status_kelulusan === 'TIDAK LULUS' || hu.status_kelulusan === 'BELUM LULUS') && (!newStatus || newStatus === 'draft' || newStatus === 'scheduled_test')) {
    newStatus = 'failed';
  }

  return {
    ...s,
    diagnosticScore: diag,
    generalScore: gen,
    religiousScore: rel,
    finalScore: fin,
    testSubmitted: s.testSubmitted || (fin !== undefined && fin !== null),
    status: newStatus,
  };
}

export const StudentRepository = {
  /**
   * Mengambil daftar siswa dari public.students.
   * Mengembalikan array kosong [] jika tidak ada data (VALID RESULT).
   */
  async list(params?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: StudentData[]; count: number; error: Error | null }> {
    try {
      let query = supabase.from('students').select('*', { count: 'exact' });

      if (params?.status && params.status !== 'all') {
        query = query.eq('status', params.status);
      }
      if (params?.search) {
        query = query.or(
          `full_name.ilike.%${params.search}%,registration_number.ilike.%${params.search}%,user_email.ilike.%${params.search}%`
        );
      }

      if (params?.page && params?.limit) {
        const from = (params.page - 1) * params.limit;
        const to = from + params.limit - 1;
        query = query.range(from, to);
      } else {
        // Default order by created_at DESC
        query = query.order('created_at', { ascending: false });
      }

      const { data, count, error } = await query;
      if (error) {
        return { data: [], count: 0, error: new Error(error.message) };
      }

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
        console.warn('Hasil ujian fetch error:', hErr);
      }

      const mapped = (data || []).map(row => {
        const s = mapRowToStudent(row);
        const hu = hasilMap.get(s.id);
        return mergeHasilUjianIntoStudent(s, hu);
      });
      return { data: mapped, count: count || mapped.length, error: null };
    } catch (err: any) {
      return { data: [], count: 0, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Mengambil satu siswa berdasarkan ID
   */
  async getById(id: string): Promise<{ data: StudentData | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }
      if (!data) {
        return { data: null, error: null };
      }
      let student = mapRowToStudent(data);
      try {
        const { data: hu } = await supabase.from('hasil_ujian').select('*').eq('peserta_id', id).maybeSingle();
        if (hu) {
          student = mergeHasilUjianIntoStudent(student, hu);
        }
      } catch (huErr) {
        console.warn('Fetch student hasil_ujian error:', huErr);
      }
      return { data: student, error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Mengambil satu siswa berdasarkan Email Akun
   */
  async getByEmail(email: string): Promise<{ data: StudentData | null; error: Error | null }> {
    try {
      if (!email) return { data: null, error: null };
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .ilike('user_email', email.trim().toLowerCase())
        .maybeSingle();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }
      if (!data) {
        return { data: null, error: null };
      }
      let student = mapRowToStudent(data);
      try {
        const { data: hu } = await supabase.from('hasil_ujian').select('*').eq('peserta_id', student.id).maybeSingle();
        if (hu) {
          student = mergeHasilUjianIntoStudent(student, hu);
        }
      } catch (huErr) {
        console.warn('Fetch student hasil_ujian by email error:', huErr);
      }
      return { data: student, error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Membuat record pendaftaran siswa baru (INSERT ONLY per record).
   * Melakukan validasi ketat ID dan registration_number, tidak melakukan upsert array penuh.
   */
  async create(payload: Partial<StudentData>): Promise<{ data: StudentData | null; error: Error | null }> {
    try {
      // Prevent resurrected or tombstoned IDs from causing trigger violations
      if (payload.id && (payload.id.startsWith('std_00') || payload.id === 'std_001')) {
        console.warn(`[StudentRepository] ID [${payload.id}] adalah ID lama/telah dihapus permanen. Mengalokasikan ID baru.`);
        cleanLocalStudentCache(payload.id);
        payload.id = `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      }

      const row = mapStudentToRow(payload);
      if (!row.id || typeof row.id !== 'string' || !row.id.trim()) {
        return { data: null, error: new Error('ID pendaftaran siswa wajib diisi dan tidak boleh kosong.') };
      }
      if (!row.registration_number || typeof row.registration_number !== 'string' || !row.registration_number.trim()) {
        return { data: null, error: new Error('Nomor registrasi (registration_number) siswa wajib diisi dan valid.') };
      }

      row.created_at = new Date().toISOString();
      row.updated_at = new Date().toISOString();
      if (!row.birth_date) {
        row.birth_date = '2013-01-01';
      }
      delete row.version;

      // Pastikan akun user ada di public.users untuk memenuhi foreign key
      const { data: existingUser } = await supabase.from('users').select('id').eq('id', row.id).maybeSingle();
      if (!existingUser) {
        await supabase.from('users').upsert({
          id: row.id,
          name: row.full_name || 'Calon Murid',
          email: (row.user_email || `${row.id}@spmb.alhadiid.sch.id`).trim().toLowerCase(),
          phone: row.phone || '081234567890',
          role: 'student',
          registration_number: row.registration_number,
          status: 'active',
          must_change_password: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      }

      // Cek apakah record siswa sudah ada di tabel public.students untuk mencegah error students_pkey
      const { data: existingStudent } = await supabase
        .from('students')
        .select('id, version')
        .eq('id', row.id)
        .maybeSingle();

      if (existingStudent) {
        console.info(`[StudentRepository] Record [${row.id}] sudah ada di database server. Melakukan update data untuk menghindari pelanggaran students_pkey.`);
        const { version: _v, ...payloadClean } = payload;
        return await StudentRepository.update(row.id, payloadClean);
      }

      // INSERT 1 record ke tabel relasional public.students
      const { data, error } = await supabase
        .from('students')
        .insert(row)
        .select()
        .single();

      if (error) {
        const isDuplicateKey =
          (error as any)?.code === '23505' ||
          (error.message && (
            error.message.includes('students_pkey') ||
            error.message.includes('duplicate key value violates unique constraint')
          ));

        if (isDuplicateKey) {
          console.warn(`[StudentRepository] Record ${row.id} mengalami konflik students_pkey. Mengalihkan ke update.`);
          const { version: _v, ...payloadClean } = payload;
          return await StudentRepository.update(row.id, payloadClean);
        }

        if (error.message && error.message.includes('telah dihapus secara permanen')) {
          console.warn(`[StudentRepository] Record ${row.id} ditolak karena telah dihapus secara permanen di server.`);
          cleanLocalStudentCache(row.id);
          return { data: null, error: new Error(error.message) };
        }
        return { data: null, error: new Error(error.message) };
      }
      const mapped = mapRowToStudent(data);
      mapped.version = 1;
      return { data: mapped, error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Memperbarui record siswa yang SUDAH ADA dengan filter ID spesifik (eq('id', id)).
   * Menggunakan version / updated_at untuk Optimistic Concurrency Control (OCC).
   * Jika terjadi konflik versi server yang lebih baru, pembaruan lokal tidak menimpa data server.
   */
  async update(
    id: string,
    updates: Partial<StudentData>,
    expectedVersion?: number
  ): Promise<{ data: StudentData | null; error: Error | null; conflict?: boolean }> {
    try {
      if (!id || !id.trim()) {
        return { data: null, error: new Error('ID siswa wajib disertakan untuk pembaruan.') };
      }

      if (id.startsWith('std_00') || id === 'std_001') {
        console.warn(`[StudentRepository] Update untuk ID [${id}] ditolak karena record telah dihapus secara permanen.`);
        cleanLocalStudentCache(id);
        return {
          data: null,
          error: new Error(`Record ID [${id}] telah dihapus secara permanen dan tidak dapat diperbarui.`),
          conflict: true,
        };
      }

      // 1. Ambil data server saat ini untuk verifikasi keberadaan & OCC version check
      const { data: serverRecord, error: fetchErr } = await supabase
        .from('students')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr) {
        return { data: null, error: new Error(fetchErr.message) };
      }

      if (!serverRecord) {
        return {
          data: null,
          error: new Error('Data siswa tidak ditemukan di database server (mungkin telah dihapus).'),
          conflict: true,
        };
      }

      // 2. Optimistic Concurrency Check
      const serverVersion = typeof serverRecord.version === 'number' ? serverRecord.version : 1;
      const clientExpectedVersion = expectedVersion ?? updates.version;

      if (clientExpectedVersion !== undefined && serverVersion > clientExpectedVersion) {
        // Server memiliki versi lebih baru. JANGAN menimpa data server!
        return {
          data: mapRowToStudent(serverRecord),
          error: new Error(
            `Konflik konkurensi: Data siswa telah diperbarui oleh pengguna lain (versi server: ${serverVersion}, versi lokal: ${clientExpectedVersion}). Perubahan lokal dibatalkan demi integritas data server.`
          ),
          conflict: true,
        };
      }

      const row = mapStudentToRow(updates);
      delete row.id; // Jangan pernah mengubah primary key ID
      delete row.created_at;
      delete row.version;
      row.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('students')
        .update(row)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        if (error.message && error.message.includes('telah dihapus secara permanen')) {
          console.warn(`[StudentRepository] Update ${id} ditolak karena telah dihapus permanen di server.`);
          cleanLocalStudentCache(id);
          return { data: null, error: new Error(error.message), conflict: true };
        }
        if (error.message && error.message.includes('not-null') && (error.message.includes('birth_date') || error.message.includes('date'))) {
          row.birth_date = '2013-01-01';
          const retryRes = await supabase.from('students').update(row).eq('id', id).select().maybeSingle();
          if (!retryRes.error && retryRes.data) {
            const mappedRetry = mapRowToStudent(retryRes.data);
            mappedRetry.version = serverVersion + 1;
            return { data: mappedRetry, error: null };
          }
        }
        return { data: null, error: new Error(error.message) };
      }

      if (!data) {
        return {
          data: null,
          error: new Error('Data siswa tidak ditemukan saat pembaruan.'),
          conflict: true,
        };
      }

      const mapped = mapRowToStudent(data);
      mapped.version = serverVersion + 1;
      if (updates.isTestActive !== undefined) mapped.isTestActive = updates.isTestActive;
      if (updates.testSubmitted !== undefined) mapped.testSubmitted = updates.testSubmitted;
      if (updates.childOrder !== undefined) mapped.childOrder = updates.childOrder;
      if (updates.totalSiblings !== undefined) mapped.totalSiblings = updates.totalSiblings;
      if (updates.village !== undefined) mapped.village = updates.village;
      if (updates.fatherBirthPlace !== undefined) mapped.fatherBirthPlace = updates.fatherBirthPlace;
      if (updates.fatherBirthDate !== undefined) mapped.fatherBirthDate = updates.fatherBirthDate;
      if (updates.motherBirthPlace !== undefined) mapped.motherBirthPlace = updates.motherBirthPlace;
      if (updates.motherBirthDate !== undefined) mapped.motherBirthDate = updates.motherBirthDate;
      if (updates.testAnswers !== undefined) mapped.testAnswers = updates.testAnswers;

      // Sync scores to hasil_ujian if scores are updated
      if (updates.finalScore !== undefined || updates.diagnosticScore !== undefined || updates.generalScore !== undefined || updates.religiousScore !== undefined) {
        try {
          const finalScore = updates.finalScore !== undefined ? updates.finalScore : mapped.finalScore || 0;
          await supabase.from('hasil_ujian').upsert({
            peserta_id: id,
            ujian_id: '145eacad-ef02-4180-ba26-85b34d1649da',
            nilai_diagnostik: updates.diagnosticScore ?? mapped.diagnosticScore ?? 0,
            nilai_tpu: updates.generalScore ?? mapped.generalScore ?? 0,
            nilai_diniyyah: updates.religiousScore ?? mapped.religiousScore ?? 0,
            nilai_akhir: finalScore,
            status_kelulusan: (updates.status === 'passed' || mapped.status === 'passed' || updates.status === 're_registered' || finalScore >= 70) ? 'LULUS' : 'BELUM LULUS',
            waktu_selesai: new Date().toISOString(),
          }, { onConflict: 'ujian_id,peserta_id' });
        } catch (huErr) {
          console.warn('[StudentRepository] Sync to hasil_ujian warning:', huErr);
        }
      }

      return { data: mapped, error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * @deprecated Hindari pembaruan seluruh koleksi secara massal. Gunakan create/update per record.
   */
  async upsertMany(students: Partial<StudentData>[]): Promise<{ count: number; error: Error | null }> {
    console.warn('[StudentRepository] upsertMany is deprecated. Please perform individual granular operations.');
    try {
      if (!students || students.length === 0) return { count: 0, error: null };
      const rows = students.map(s => mapStudentToRow(s)).filter(r => !!r.id && !!r.registration_number);
      if (rows.length === 0) return { count: 0, error: null };

      const { data, error } = await supabase
        .from('students')
        .upsert(rows, { onConflict: 'id' })
        .select('id');

      if (error) {
        return { count: 0, error: new Error(error.message) };
      }
      return { count: data?.length || rows.length, error: null };
    } catch (err: any) {
      return { count: 0, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Menghapus record siswa secara permanen dari Supabase.
   * Menghapus data anak terkait (foreign key) terlebih dahulu, menghapus record server,
   * lalu memverifikasi bahwa record benar-benar terhapus di server.
   * Membersihkan cache lokal agar tidak pernah membuat ulang record yang telah dihapus.
   */
  async remove(id: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      if (!id || !id.trim()) {
        return { success: false, error: new Error('ID siswa wajib diisi untuk operasi penghapusan.') };
      }

      // 1. Coba gunakan RPC PostgreSQL delete_student_secure jika terdefinisi
      try {
        const { data: rpcData, error: rpcErr } = await (supabase as any).rpc('delete_student_secure', {
          p_student_id: id,
        });
        if (!rpcErr && rpcData?.success) {
          // Bersihkan cache lokal
          cleanLocalStudentCache(id);
          return { success: true, error: null };
        }
      } catch (rpcErr: any) {
        console.warn('[StudentRepository] RPC delete_student_secure fallback:', rpcErr?.message || rpcErr);
      }

      // 2. Hapus data berelasi foreign key
      try { await supabase.from('payments').delete().eq('student_id', id); } catch (e: any) { console.warn('[StudentRepository] Delete related payments warning:', e?.message || e); }
      try { await supabase.from('jawaban_peserta').delete().eq('peserta_id', id); } catch (e: any) { console.warn('[StudentRepository] Delete related jawaban warning:', e?.message || e); }
      try { await supabase.from('hasil_ujian').delete().eq('peserta_id', id); } catch (e: any) { console.warn('[StudentRepository] Delete related hasil_ujian warning:', e?.message || e); }

      // 3. Hapus data dari tabel public.students
      const { error: studentErr } = await supabase
        .from('students')
        .delete()
        .or(`id.eq.${id},registration_number.eq.${id}`);

      if (studentErr) {
        return { success: false, error: new Error(studentErr.message) };
      }

      // 4. Hapus akun user berelasi di tabel public.users
      try { await supabase.from('users').delete().eq('id', id); } catch (e: any) { console.warn('[StudentRepository] Delete related user warning:', e?.message || e); }

      // 5. Verifikasi di server bahwa record tidak lagi ditemukan
      const { data: verifyRow } = await supabase
        .from('students')
        .select('id')
        .eq('id', id)
        .maybeSingle();

      if (verifyRow) {
        return {
          success: false,
          error: new Error('Verifikasi server gagal: Record siswa masih ditemukan di tabel public.students setelah penghapusan.'),
        };
      }

      // 6. Bersihkan cache lokal agar data tidak diregenerasi
      cleanLocalStudentCache(id);

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },
};
