import { StudentData, ClassQuota, CostBreakdown, SchoolInfo, TestSchedule, GasConfig, UserAccount, WebsiteConfig, ExamQuestion, FormPaymentRecord, BamPaymentRecord } from '../types';
import { initialStudents, initialClassQuotas, initialCostBreakdowns, initialSchoolInfo, initialTestSchedules, initialGasConfig, initialWebsiteConfig, initialQuestionBank, initialFormPayments, initialBamPayments } from '../data/initialData';
import {
  fetchStudentsFromSupabase,
  syncClassQuotasToSupabase,
  fetchClassQuotasFromSupabase,
  syncSchoolInfoToSupabase,
  fetchSchoolInfoFromSupabase,
  fetchUsersDbFromSupabase,
  deleteUserFromSupabase,
  purgeApplicantDataFromSupabase,
  syncFormPaymentsToSupabase,
  fetchFormPaymentsFromSupabase,
  syncBamPaymentsToSupabase,
  fetchBamPaymentsFromSupabase,
  syncCostBreakdownToSupabase,
  fetchCostBreakdownFromSupabase,
  syncTestSchedulesToSupabase,
  fetchTestSchedulesFromSupabase,
  syncQuestionBankToSupabase,
  fetchQuestionBankFromSupabase,
  syncGasConfigToSupabase,
  fetchGasConfigFromSupabase,
  syncWebsiteConfigToSupabase,
  fetchWebsiteConfigFromSupabase,
} from './supabaseClient';

export const KEYS = {
  STUDENTS: 'spmb_alhadiid_students',
  CLASS_QUOTAS: 'spmb_alhadiid_class_quotas',
  COST_BREAKDOWN: 'spmb_alhadiid_cost_breakdown',
  SCHOOL_INFO: 'spmb_alhadiid_school_info',
  TEST_SCHEDULES: 'spmb_alhadiid_test_schedules',
  QUESTION_BANK: 'spmb_alhadiid_question_bank',
  GAS_CONFIG: 'spmb_alhadiid_gas_config',
  CURRENT_USER: 'spmb_alhadiid_current_user',
  USERS_DB: 'spmb_alhadiid_users_db',
  WEBSITE_CONFIG: 'spmb_alhadiid_website_config',
  FORM_PAYMENTS: 'spmb_alhadiid_form_payments',
  BAM_PAYMENTS: 'spmb_alhadiid_bam_payments',
};

const inMemoryStorage: Record<string, string> = {};

export function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch (e) {
    console.warn(`[Storage] safeGetItem error for ${key}:`, e);
  }
  return inMemoryStorage[key] ?? null;
}

export function safeSetItem(key: string, value: string): void {
  inMemoryStorage[key] = value;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch (e) {
    console.warn(`[Storage] safeSetItem error for ${key}:`, e);
  }
}

export function safeRemoveItem(key: string): void {
  delete inMemoryStorage[key];
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch (e) {
    console.warn(`[Storage] safeRemoveItem error for ${key}:`, e);
  }
}

export function getStoredStudents(): StudentData[] {
  const data = safeGetItem(KEYS.STUDENTS);
  if (!data) {
    return [];
  }
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      // Filter out legacy demo student accounts if present
      const cleaned = parsed.filter((s) => !s.id.startsWith('std_00') && s.userEmail !== 'fathan.alkhatiri@gmail.com');
      return cleaned;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveStudents(students: StudentData[]): void {
  safeSetItem(KEYS.STUDENTS, JSON.stringify(students));
  updateClassQuotaCounts(students);
}

export function getStoredClassQuotas(): ClassQuota[] {
  const data = safeGetItem(KEYS.CLASS_QUOTAS);
  if (!data) {
    safeSetItem(KEYS.CLASS_QUOTAS, JSON.stringify(initialClassQuotas));
    return initialClassQuotas;
  }
  try {
    const parsed = JSON.parse(data);
    const valid = Array.isArray(parsed) ? parsed : initialClassQuotas;
    // Filter baris lama yang diminta dihapus
    const cleaned = valid.filter((q: any) =>
      !['q1', 'q2', 'q3', 'q4'].includes(q.id) &&
      !['7 A (Tahfizh Unggulan)', '7 B (Sains & Digital)', '7 C (Bilingual & International)', '7 D (Reguler Rabbani)'].includes(q.className || q.class_name)
    );
    return cleaned.length > 0 ? cleaned : initialClassQuotas;
  } catch {
    return initialClassQuotas;
  }
}

export function saveClassQuotas(quotas: ClassQuota[]): void {
  safeSetItem(KEYS.CLASS_QUOTAS, JSON.stringify(quotas));
  syncClassQuotasToSupabase(quotas);
}

export function updateClassQuotaCounts(students: StudentData[]): void {
  const quotas = getStoredClassQuotas();
  const updatedQuotas = quotas.map(q => {
    // Count students who are verified re-registered or assigned to this class
    const filledCount = students.filter(
      s => s.assignedClassId === q.id && (s.status === 're_registered' || s.status === 'class_assigned' || s.status === 'completed' || s.status === 're_registration_paid')
    ).length;
    return { ...q, filled: filledCount };
  });
  saveClassQuotas(updatedQuotas);
}

export function getStoredCostBreakdown(): CostBreakdown[] {
  const data = safeGetItem(KEYS.COST_BREAKDOWN);
  if (!data) {
    safeSetItem(KEYS.COST_BREAKDOWN, JSON.stringify(initialCostBreakdowns));
    return initialCostBreakdowns;
  }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : initialCostBreakdowns;
  } catch {
    return initialCostBreakdowns;
  }
}

export function saveCostBreakdown(costs: CostBreakdown[]): void {
  safeSetItem(KEYS.COST_BREAKDOWN, JSON.stringify(costs));
  syncCostBreakdownToSupabase(costs);
}

export function getStoredSchoolInfo(): SchoolInfo {
  const data = safeGetItem(KEYS.SCHOOL_INFO);
  if (!data) {
    safeSetItem(KEYS.SCHOOL_INFO, JSON.stringify(initialSchoolInfo));
    return initialSchoolInfo;
  }
  try {
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object') return initialSchoolInfo;
    if (!parsed.tagline || parsed.tagline === 'Mewujudkan Generasi Rabbani yang Cerdas, Berakhlak Mulia, Berprestasi & Berjiwa Qur’ani') {
      parsed.tagline = initialSchoolInfo.tagline;
      safeSetItem(KEYS.SCHOOL_INFO, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return initialSchoolInfo;
  }
}

export function saveSchoolInfo(info: SchoolInfo): void {
  safeSetItem(KEYS.SCHOOL_INFO, JSON.stringify(info));
  syncSchoolInfoToSupabase(info);

  // Sync to kepsek account if headmasterName is set
  if (info.headmasterName && info.headmasterName.trim()) {
    try {
      const usersData = safeGetItem(KEYS.USERS_DB);
      if (usersData) {
        const users: UserAccount[] = JSON.parse(usersData);
        if (Array.isArray(users)) {
          const kepsekIdx = users.findIndex(u => u.role === 'kepsek' || u.id === 'usr_kepsek');
          if (kepsekIdx >= 0 && users[kepsekIdx].name !== info.headmasterName.trim()) {
            users[kepsekIdx].name = info.headmasterName.trim();
            cacheUsersDbOnly(users);
          }
        }
      }
    } catch {
      // ignore
    }
  }
}

export function getStoredTestSchedules(): TestSchedule[] {
  const data = safeGetItem(KEYS.TEST_SCHEDULES);
  if (!data) {
    safeSetItem(KEYS.TEST_SCHEDULES, JSON.stringify(initialTestSchedules));
    return initialTestSchedules;
  }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : initialTestSchedules;
  } catch {
    return initialTestSchedules;
  }
}

export function saveTestSchedules(schedules: TestSchedule[]): void {
  safeSetItem(KEYS.TEST_SCHEDULES, JSON.stringify(schedules));
  syncTestSchedulesToSupabase(schedules);
}

export function getStoredQuestionBank(): ExamQuestion[] {
  const data = safeGetItem(KEYS.QUESTION_BANK);
  if (!data) {
    safeSetItem(KEYS.QUESTION_BANK, JSON.stringify(initialQuestionBank));
    return initialQuestionBank;
  }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : initialQuestionBank;
  } catch {
    return initialQuestionBank;
  }
}

export function saveQuestionBank(questions: ExamQuestion[]): void {
  safeSetItem(KEYS.QUESTION_BANK, JSON.stringify(questions));
  syncQuestionBankToSupabase(questions);
}

export function getStoredGasConfig(): GasConfig {
  const data = safeGetItem(KEYS.GAS_CONFIG);
  if (!data) {
    safeSetItem(KEYS.GAS_CONFIG, JSON.stringify(initialGasConfig));
    return initialGasConfig;
  }
  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' ? parsed : initialGasConfig;
  } catch {
    return initialGasConfig;
  }
}

export function saveGasConfig(config: GasConfig): void {
  safeSetItem(KEYS.GAS_CONFIG, JSON.stringify(config));
  syncGasConfigToSupabase(config);
}

export function getCurrentUser(): UserAccount | null {
  const data = safeGetItem(KEYS.CURRENT_USER);
  if (!data) return null;
  try {
    const user: UserAccount = JSON.parse(data);
    if (!user || typeof user !== 'object') return null;

    // Invalidate deleted / tombstoned student sessions
    if (user.id?.startsWith('std_00') || user.email === 'fathan.alkhatiri@gmail.com') {
      safeRemoveItem(KEYS.CURRENT_USER);
      return null;
    }

    // Enforce super_admin role for superadmin email/username
    if (user.email?.toLowerCase() === 'superadmin@alhadiid.sch.id' || user.username?.toLowerCase() === 'superadmin' || user.id === 'usr_superadmin') {
      user.role = 'super_admin';
    }
    // Sanitize: remove any password property from session
    if ('password' in user) {
      delete user.password;
    }
    return user;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: UserAccount | null): void {
  if (!user || user.id?.startsWith('std_00') || user.email === 'fathan.alkhatiri@gmail.com') {
    safeRemoveItem(KEYS.CURRENT_USER);
  } else {
    // Ensure plaintext password is never stored in current user session
    const sanitizedUser = { ...user };
    delete (sanitizedUser as any).password;
    safeSetItem(KEYS.CURRENT_USER, JSON.stringify(sanitizedUser));
  }
}

export function getUsersDb(): UserAccount[] {
  const data = safeGetItem(KEYS.USERS_DB);
  if (!data) {
    return [];
  }
  try {
    const parsed: UserAccount[] = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];

    // Filter out legacy demo student accounts & sanitize passwords
    return parsed
      .filter((u) => !u.id.startsWith('std_00') && u.email !== 'fathan.alkhatiri@gmail.com')
      .map(u => {
        const copy = { ...u };
        delete (copy as any).password;
        return copy;
      });
  } catch {
    return [];
  }
}

export function cacheUsersDbOnly(users: UserAccount[]): void {
  // Sanitize passwords before saving to local storage
  const sanitized = users.map(u => {
    const copy = { ...u };
    delete (copy as any).password;
    return copy;
  });
  safeSetItem(KEYS.USERS_DB, JSON.stringify(sanitized));
}

/**
 * @deprecated Use UserProfileRepository for server persistence and cacheUsersDbOnly for local cache.
 */
export function saveUsersDb(users: UserAccount[]): void {
  // Pure local read cache - NO server push!
  cacheUsersDbOnly(users);
}

export function saveUserToDb(user: UserAccount): void {
  const db = getUsersDb();
  const index = db.findIndex(u => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
  const cleanUser = { ...user };
  delete (cleanUser as any).password;
  if (index >= 0) {
    db[index] = { ...db[index], ...cleanUser };
  } else {
    db.push(cleanUser);
  }
  cacheUsersDbOnly(db);

  // If user is kepsek, sync name to schoolInfo
  if (user.role === 'kepsek' && user.name && user.name.trim()) {
    try {
      const schoolInfo = getStoredSchoolInfo();
      if (schoolInfo && schoolInfo.headmasterName !== user.name.trim()) {
        schoolInfo.headmasterName = user.name.trim();
        saveSchoolInfo(schoolInfo);
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Mengambil akun Kepala Sekolah yang terdaftar di sistem.
 */
export function getKepalaSekolahAccount(): UserAccount | null {
  try {
    const users = getUsersDb();
    // 1. Akun dengan role 'kepsek'
    const kepsek = users.find(u => u.role === 'kepsek');
    if (kepsek && kepsek.name && kepsek.name.trim()) return kepsek;

    // 2. Akun sesi login aktif jika sedang login sebagai kepsek
    const current = getCurrentUser();
    if (current && current.role === 'kepsek' && current.name && current.name.trim()) return current;

    // 3. Fallback pencarian berdasarkan email atau ID
    const byEmailOrId = users.find(u => u.email?.toLowerCase().includes('kepsek') || u.id === 'usr_kepsek');
    if (byEmailOrId && byEmailOrId.name && byEmailOrId.name.trim()) return byEmailOrId;
  } catch (err) {
    console.error('Gagal mengambil data akun kepala sekolah:', err);
  }
  return null;
}

/**
 * Mengambil nama resmi Kepala Sekolah yang selalu disesuaikan dengan akun kepala sekolah.
 */
export function getKepalaSekolahName(schoolInfo?: SchoolInfo): string {
  // 1. Prioritas utama: Nama resmi dari Akun Kepala Sekolah (role: 'kepsek')
  const kepsekAccount = getKepalaSekolahAccount();
  if (kepsekAccount?.name && kepsekAccount.name.trim()) {
    return kepsekAccount.name.trim();
  }

  // 2. Prioritas kedua: Nama dari konfigurasi schoolInfo jika ada
  if (schoolInfo?.headmasterName && schoolInfo.headmasterName.trim()) {
    return schoolInfo.headmasterName.trim();
  }

  // 3. Prioritas ketiga: Nama dari storage school info
  try {
    const stored = getStoredSchoolInfo();
    if (stored?.headmasterName && stored.headmasterName.trim()) {
      return stored.headmasterName.trim();
    }
  } catch {
    // ignore
  }

  return 'Dr. H. Ahmad Dahlan, M.Pd.';
}

export function deleteUserFromDb(userId: string): void {
  const db = getUsersDb();
  const target = db.find(u => u.id === userId);
  const filtered = db.filter(u => u.id !== userId);
  cacheUsersDbOnly(filtered);

  // If user was a student, also remove from students list
  if (target?.role === 'student' || target?.email) {
    const students = getStoredStudents();
    const filteredStudents = students.filter(
      s => s.id !== userId && s.userEmail.toLowerCase() !== target?.email.toLowerCase()
    );
    if (filteredStudents.length !== students.length) {
      saveStudents(filteredStudents);
    }
  }

  // Sync deletion with Supabase
  deleteUserFromSupabase(userId, target?.email);
}

export function ensureStudentDataExists(_user: UserAccount, existingStudents: StudentData[]): StudentData[] {
  // Neutralized per Security Audit Tahap 3: Do not resurrect or auto-generate dummy student records
  return existingStudents;
}

export async function loadDataFromSupabase(): Promise<{
  students: StudentData[] | null;
  classQuotas: ClassQuota[] | null;
  schoolInfo: SchoolInfo | null;
  usersDb: UserAccount[] | null;
  formPayments: FormPaymentRecord[] | null;
  bamPayments: BamPaymentRecord[] | null;
  costBreakdown: CostBreakdown[] | null;
  testSchedules: TestSchedule[] | null;
  questionBank: ExamQuestion[] | null;
  gasConfig: GasConfig | null;
  websiteConfig: WebsiteConfig | null;
}> {
  const [
    students,
    classQuotas,
    schoolInfo,
    usersDb,
    formPayments,
    bamPayments,
    costBreakdown,
    testSchedules,
    questionBank,
    gasConfig,
    websiteConfig,
  ] = await Promise.all([
    fetchStudentsFromSupabase(),
    fetchClassQuotasFromSupabase(),
    fetchSchoolInfoFromSupabase(),
    fetchUsersDbFromSupabase(),
    fetchFormPaymentsFromSupabase(),
    fetchBamPaymentsFromSupabase(),
    fetchCostBreakdownFromSupabase(),
    fetchTestSchedulesFromSupabase(),
    fetchQuestionBankFromSupabase(),
    fetchGasConfigFromSupabase(),
    fetchWebsiteConfigFromSupabase(),
  ]);

  // Treat empty arrays as valid responses from Supabase (Tahap 2 requirement)
  if (students !== null) safeSetItem(KEYS.STUDENTS, JSON.stringify(students));
  if (classQuotas !== null) safeSetItem(KEYS.CLASS_QUOTAS, JSON.stringify(classQuotas));
  if (schoolInfo !== null) safeSetItem(KEYS.SCHOOL_INFO, JSON.stringify(schoolInfo));
  if (usersDb !== null) safeSetItem(KEYS.USERS_DB, JSON.stringify(usersDb));
  if (formPayments !== null) safeSetItem(KEYS.FORM_PAYMENTS, JSON.stringify(formPayments));
  if (bamPayments !== null) safeSetItem(KEYS.BAM_PAYMENTS, JSON.stringify(bamPayments));
  if (costBreakdown !== null) safeSetItem(KEYS.COST_BREAKDOWN, JSON.stringify(costBreakdown));
  if (testSchedules !== null) safeSetItem(KEYS.TEST_SCHEDULES, JSON.stringify(testSchedules));
  if (questionBank !== null) safeSetItem(KEYS.QUESTION_BANK, JSON.stringify(questionBank));
  if (gasConfig !== null) safeSetItem(KEYS.GAS_CONFIG, JSON.stringify(gasConfig));
  if (websiteConfig !== null) safeSetItem(KEYS.WEBSITE_CONFIG, JSON.stringify(websiteConfig));

  return {
    students,
    classQuotas,
    schoolInfo,
    usersDb,
    formPayments,
    bamPayments,
    costBreakdown,
    testSchedules,
    questionBank,
    gasConfig,
    websiteConfig,
  };
}

export function getStoredWebsiteConfig(): WebsiteConfig {
  const data = safeGetItem(KEYS.WEBSITE_CONFIG);
  if (!data) {
    safeSetItem(KEYS.WEBSITE_CONFIG, JSON.stringify(initialWebsiteConfig));
    return initialWebsiteConfig;
  }
  try {
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object') return initialWebsiteConfig;
    if (
      !parsed.announcementBannerText ||
      parsed.announcementBannerText.includes('Gelombang 1 Dapatkan Potongan') ||
      parsed.announcementBannerText.includes('Pendaftaran SPMB Online Telah')
    ) {
      parsed.announcementBannerText = initialWebsiteConfig.announcementBannerText;
      safeSetItem(KEYS.WEBSITE_CONFIG, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return initialWebsiteConfig;
  }
}

export function saveWebsiteConfig(config: WebsiteConfig): void {
  safeSetItem(KEYS.WEBSITE_CONFIG, JSON.stringify(config));
  syncWebsiteConfigToSupabase(config);
}

export function getStoredFormPayments(): FormPaymentRecord[] {
  const data = safeGetItem(KEYS.FORM_PAYMENTS);
  if (!data) {
    return [];
  }
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      const cleaned = parsed.filter((f) => !f.id.startsWith('fpay_00') && f.studentId !== 'std_001');
      return cleaned;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveFormPayments(records: FormPaymentRecord[]): void {
  safeSetItem(KEYS.FORM_PAYMENTS, JSON.stringify(records));
  syncFormPaymentsToSupabase(records);
}

export function getStoredBamPayments(): BamPaymentRecord[] {
  const data = safeGetItem(KEYS.BAM_PAYMENTS);
  if (!data) {
    return [];
  }
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      const cleaned = parsed.filter((b) => !b.id.startsWith('bampay_00') && b.studentId !== 'std_001');
      return cleaned;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveBamPayments(records: BamPaymentRecord[]): void {
  safeSetItem(KEYS.BAM_PAYMENTS, JSON.stringify(records));
  syncBamPaymentsToSupabase(records);
}

export function exportAllDataAsBackup(): string {
  const backup = {
    appName: 'SPMB SMP Al-Hadiid Cileungsi',
    exportedAt: new Date().toISOString(),
    version: '2.0.0',
    data: {
      students: getStoredStudents(),
      classQuotas: getStoredClassQuotas(),
      costBreakdown: getStoredCostBreakdown(),
      schoolInfo: getStoredSchoolInfo(),
      testSchedules: getStoredTestSchedules(),
      questionBank: getStoredQuestionBank(),
      gasConfig: getStoredGasConfig(),
      usersDb: getUsersDb(),
      websiteConfig: getStoredWebsiteConfig(),
      formPayments: getStoredFormPayments(),
      bamPayments: getStoredBamPayments(),
    },
  };
  return JSON.stringify(backup, null, 2);
}

export function importBackupData(backupJson: string): { success: boolean; message: string } {
  try {
    const parsed = JSON.parse(backupJson);
    const data = parsed.data || parsed; // support raw or wrapped format

    if (data.students && Array.isArray(data.students)) {
      saveStudents(data.students);
    }
    if (data.classQuotas && Array.isArray(data.classQuotas)) {
      saveClassQuotas(data.classQuotas);
    }
    if (data.costBreakdown && Array.isArray(data.costBreakdown)) {
      saveCostBreakdown(data.costBreakdown);
    }
    if (data.schoolInfo && typeof data.schoolInfo === 'object') {
      saveSchoolInfo(data.schoolInfo);
    }
    if (data.testSchedules && Array.isArray(data.testSchedules)) {
      saveTestSchedules(data.testSchedules);
    }
    if (data.questionBank && Array.isArray(data.questionBank)) {
      saveQuestionBank(data.questionBank);
    }
    if (data.gasConfig && typeof data.gasConfig === 'object') {
      saveGasConfig(data.gasConfig);
    }
    if (data.usersDb && Array.isArray(data.usersDb)) {
      cacheUsersDbOnly(data.usersDb);
    }
    if (data.websiteConfig && typeof data.websiteConfig === 'object') {
      saveWebsiteConfig(data.websiteConfig);
    }
    if (data.formPayments && Array.isArray(data.formPayments)) {
      saveFormPayments(data.formPayments);
    }
    if (data.bamPayments && Array.isArray(data.bamPayments)) {
      saveBamPayments(data.bamPayments);
    }

    return { success: true, message: 'Restore database berhasil! Seluruh data telah diperbarui.' };
  } catch (err: any) {
    return { success: false, message: 'Gagal memproses file backup JSON. Format file tidak valid: ' + (err.message || '') };
  }
}

export function purgeApplicantData(): void {
  // Empty all students
  const emptyStudents: StudentData[] = [];
  saveStudents(emptyStudents);

  // Clear payments
  saveFormPayments([]);
  saveBamPayments([]);

  // Clear student accounts from USERS_DB
  const users = getUsersDb();
  const nonStudentUsers = users.filter((u) => u.role !== 'student');
  cacheUsersDbOnly(nonStudentUsers);

  // Reset filled count on class quotas
  const quotas = getStoredClassQuotas();
  const resetQuotas = quotas.map((q) => ({ ...q, filled: 0 }));
  saveClassQuotas(resetQuotas);

  // Sync purge with Supabase DB
  purgeApplicantDataFromSupabase();
}

export function resetAllDataToDefault(): void {
  safeSetItem(KEYS.STUDENTS, JSON.stringify(initialStudents));
  safeSetItem(KEYS.CLASS_QUOTAS, JSON.stringify(initialClassQuotas));
  safeSetItem(KEYS.COST_BREAKDOWN, JSON.stringify(initialCostBreakdowns));
  safeSetItem(KEYS.SCHOOL_INFO, JSON.stringify(initialSchoolInfo));
  safeSetItem(KEYS.TEST_SCHEDULES, JSON.stringify(initialTestSchedules));
  safeSetItem(KEYS.QUESTION_BANK, JSON.stringify(initialQuestionBank));
  safeSetItem(KEYS.GAS_CONFIG, JSON.stringify(initialGasConfig));
  safeSetItem(KEYS.WEBSITE_CONFIG, JSON.stringify(initialWebsiteConfig));
  safeSetItem(KEYS.FORM_PAYMENTS, JSON.stringify(initialFormPayments));
  safeSetItem(KEYS.BAM_PAYMENTS, JSON.stringify(initialBamPayments));
  safeRemoveItem(KEYS.CURRENT_USER);

  // Sync reset to Supabase
  syncClassQuotasToSupabase(initialClassQuotas);
  syncSchoolInfoToSupabase(initialSchoolInfo);
}
