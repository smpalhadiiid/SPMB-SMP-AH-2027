import { StudentData, ClassQuota, CostBreakdown, SchoolInfo, TestSchedule, GasConfig, UserAccount, WebsiteConfig, ExamQuestion, FormPaymentRecord, BamPaymentRecord } from '../types';
import { initialStudents, initialClassQuotas, initialCostBreakdowns, initialSchoolInfo, initialTestSchedules, initialGasConfig, initialWebsiteConfig, initialQuestionBank, initialFormPayments, initialBamPayments } from '../data/initialData';
import {
  syncStudentsToSupabase,
  fetchStudentsFromSupabase,
  syncClassQuotasToSupabase,
  fetchClassQuotasFromSupabase,
  syncSchoolInfoToSupabase,
  fetchSchoolInfoFromSupabase,
  syncUsersDbToSupabase,
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

const KEYS = {
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

export function safeGetItem(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`[Storage] safeGetItem error for ${key}:`, e);
    return null;
  }
}

export function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`[Storage] safeSetItem error for ${key}:`, e);
  }
}

export function safeRemoveItem(key: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.removeItem(key);
  } catch (e) {
    console.warn(`[Storage] safeRemoveItem error for ${key}:`, e);
  }
}

export function getStoredStudents(): StudentData[] {
  const data = safeGetItem(KEYS.STUDENTS);
  if (!data) {
    safeSetItem(KEYS.STUDENTS, JSON.stringify(initialStudents));
    syncStudentsToSupabase(initialStudents);
    return initialStudents;
  }
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      if (parsed.some((s) => s.id === 'std_001' || s.id === 'std_002' || s.userEmail === 'fathan.alkhatiri@gmail.com')) {
        const cleaned = parsed.filter((s) => !s.id.startsWith('std_00') && s.userEmail !== 'fathan.alkhatiri@gmail.com');
        safeSetItem(KEYS.STUDENTS, JSON.stringify(cleaned));
        syncStudentsToSupabase(cleaned);
        return cleaned;
      }
      return parsed;
    }
    return initialStudents;
  } catch {
    return initialStudents;
  }
}

export function saveStudents(students: StudentData[]): void {
  safeSetItem(KEYS.STUDENTS, JSON.stringify(students));
  updateClassQuotaCounts(students);
  syncStudentsToSupabase(students);
}

export function getStoredClassQuotas(): ClassQuota[] {
  const data = safeGetItem(KEYS.CLASS_QUOTAS);
  if (!data) {
    safeSetItem(KEYS.CLASS_QUOTAS, JSON.stringify(initialClassQuotas));
    syncClassQuotasToSupabase(initialClassQuotas);
    return initialClassQuotas;
  }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : initialClassQuotas;
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
    syncSchoolInfoToSupabase(initialSchoolInfo);
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
  if (!user) {
    safeRemoveItem(KEYS.CURRENT_USER);
  } else {
    // Ensure plaintext password is never stored in current user session
    const sanitizedUser = { ...user };
    delete sanitizedUser.password;
    safeSetItem(KEYS.CURRENT_USER, JSON.stringify(sanitizedUser));
  }
}

export function getUsersDb(): UserAccount[] {
  const data = safeGetItem(KEYS.USERS_DB);
  if (!data) {
    const defaultUsers: UserAccount[] = [
      { id: 'usr_superadmin', name: 'Super Admin SPMB', email: 'superadmin@alhadiid.sch.id', username: 'superadmin', phone: '081234567899', role: 'super_admin', password: 'superadmin123', status: 'active', createdAt: '2027-01-01' },
      { id: 'usr_admin', name: 'Panitia SPMB', email: 'admin@alhadiid.sch.id', username: 'admin', phone: '081234567890', role: 'admin', password: 'admin123', status: 'active', createdAt: '2027-01-01' },
      { id: 'usr_kepsek', name: 'Dr. H. Ahmad Dahlan, M.Pd.', email: 'kepsek@alhadiid.sch.id', username: 'kepsek', phone: '081299887766', role: 'kepsek', password: 'kepsek123', status: 'active', createdAt: '2027-01-01' },
    ];
    safeSetItem(KEYS.USERS_DB, JSON.stringify(defaultUsers));
    syncUsersDbToSupabase(defaultUsers);
    return defaultUsers;
  }
  try {
    let parsed: UserAccount[] = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];

    // Filter out legacy demo student accounts
    if (parsed.some((u) => u.id === 'std_001' || u.id === 'std_002' || u.email === 'fathan.alkhatiri@gmail.com')) {
      parsed = parsed.filter((u) => u.id !== 'std_001' && u.id !== 'std_002' && u.email !== 'fathan.alkhatiri@gmail.com');
      safeSetItem(KEYS.USERS_DB, JSON.stringify(parsed));
      syncUsersDbToSupabase(parsed);
    }

    let updated = false;

    // Ensure super_admin account exists
    if (!parsed.some(u => u.role === 'super_admin' || u.email === 'superadmin@alhadiid.sch.id' || u.username === 'superadmin')) {
      parsed.unshift({ id: 'usr_superadmin', name: 'Super Admin SPMB', email: 'superadmin@alhadiid.sch.id', username: 'superadmin', phone: '081234567899', role: 'super_admin', password: 'superadmin123', status: 'active', createdAt: '2027-01-01' });
      updated = true;
    }

    // Ensure admin account exists
    if (!parsed.some(u => u.role === 'admin' || u.email === 'admin@alhadiid.sch.id')) {
      parsed.push({ id: 'usr_admin', name: 'Panitia SPMB', email: 'admin@alhadiid.sch.id', username: 'admin', phone: '081234567890', role: 'admin', password: 'admin123', status: 'active', createdAt: '2027-01-01' });
      updated = true;
    }

    // Ensure kepsek account exists
    if (!parsed.some(u => u.role === 'kepsek' || u.email === 'kepsek@alhadiid.sch.id')) {
      parsed.push({ id: 'usr_kepsek', name: 'Dr. H. Ahmad Dahlan, M.Pd.', email: 'kepsek@alhadiid.sch.id', username: 'kepsek', phone: '081299887766', role: 'kepsek', password: 'kepsek123', status: 'active', createdAt: '2027-01-01' });
      updated = true;
    }

    const result = parsed.map(u => {
      const copy = { ...u };
      if (copy.id === 'usr_superadmin' || copy.email?.toLowerCase() === 'superadmin@alhadiid.sch.id' || copy.username?.toLowerCase() === 'superadmin') {
        if (copy.role !== 'super_admin') {
          copy.role = 'super_admin';
          updated = true;
        }
      }
      if (!copy.password) {
        if (copy.role === 'super_admin') copy.password = 'superadmin123';
        else if (copy.role === 'admin') copy.password = 'admin123';
        else if (copy.role === 'kepsek') copy.password = 'kepsek123';
        else if (copy.role === 'student') copy.password = '123456';
        updated = true;
      }
      if (copy.status === 'disabled' && copy.role === 'super_admin') {
        copy.status = 'active';
        updated = true;
      }
      if (copy.role === 'student' && !copy.username) {
        copy.username = copy.email ? copy.email.split('@')[0].toLowerCase() : `user_${copy.id}`;
        updated = true;
      }
      return copy;
    });
    if (updated) {
      safeSetItem(KEYS.USERS_DB, JSON.stringify(result));
    }
    return result;
  } catch {
    return [];
  }
}

export function saveUsersDb(users: UserAccount[]): void {
  safeSetItem(KEYS.USERS_DB, JSON.stringify(users));
  syncUsersDbToSupabase(users);
}

export function saveUserToDb(user: UserAccount): void {
  const db = getUsersDb();
  const index = db.findIndex(u => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
  if (index >= 0) {
    db[index] = { ...db[index], ...user };
  } else {
    db.push(user);
  }
  saveUsersDb(db);
}

export function deleteUserFromDb(userId: string): void {
  const db = getUsersDb();
  const target = db.find(u => u.id === userId);
  const filtered = db.filter(u => u.id !== userId);
  saveUsersDb(filtered);

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

export function ensureStudentDataExists(user: UserAccount, existingStudents: StudentData[]): StudentData[] {
  if (user.role !== 'student') return existingStudents;
  const found = existingStudents.find(
    s => s.id === user.id || s.userEmail.toLowerCase() === user.email.toLowerCase()
  );
  if (found) return existingStudents;

  const newStudent: StudentData = {
    id: user.id || `std_${Date.now()}`,
    registrationNumber: user.registrationNumber || `SPMB2027${Math.floor(1000 + Math.random() * 9000)}`,
    status: 'draft',
    userEmail: user.email.toLowerCase(),
    createdAt: user.createdAt || new Date().toISOString(),
    fullName: user.name,
    phone: user.phone || '081234567890',
    formPaymentAmount: 200000,
    formPaymentStatus: 'unpaid',
    nik: '',
    birthPlace: 'Bogor',
    birthDate: '2013-01-01',
    gender: 'Laki-laki',
    religion: 'Islam',
    address: 'Cileungsi, Bogor',
    subdistrict: 'Cileungsi',
    city: 'Kabupaten Bogor',
    province: 'Jawa Barat',
    previousSchoolName: '',
    fatherName: '',
    fatherPhone: user.phone || '081234567890',
    fatherEducation: 'S1',
    initialPaymentStatus: 'unpaid',
    initialPaymentAmount: 8500000,
    motherName: '',
    motherJob: 'Ibu Rumah Tangga',
    motherPhone: user.phone || '081234567890',
  };

  const updated = [newStudent, ...existingStudents];
  saveStudents(updated);
  return updated;
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

  if (students && students.length > 0) safeSetItem(KEYS.STUDENTS, JSON.stringify(students));
  if (classQuotas && classQuotas.length > 0) safeSetItem(KEYS.CLASS_QUOTAS, JSON.stringify(classQuotas));
  if (schoolInfo) safeSetItem(KEYS.SCHOOL_INFO, JSON.stringify(schoolInfo));
  if (usersDb && usersDb.length > 0) safeSetItem(KEYS.USERS_DB, JSON.stringify(usersDb));
  if (formPayments && formPayments.length > 0) safeSetItem(KEYS.FORM_PAYMENTS, JSON.stringify(formPayments));
  if (bamPayments && bamPayments.length > 0) safeSetItem(KEYS.BAM_PAYMENTS, JSON.stringify(bamPayments));
  if (costBreakdown && costBreakdown.length > 0) safeSetItem(KEYS.COST_BREAKDOWN, JSON.stringify(costBreakdown));
  if (testSchedules && testSchedules.length > 0) safeSetItem(KEYS.TEST_SCHEDULES, JSON.stringify(testSchedules));
  if (questionBank && questionBank.length > 0) safeSetItem(KEYS.QUESTION_BANK, JSON.stringify(questionBank));
  if (gasConfig) safeSetItem(KEYS.GAS_CONFIG, JSON.stringify(gasConfig));
  if (websiteConfig) safeSetItem(KEYS.WEBSITE_CONFIG, JSON.stringify(websiteConfig));

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
    safeSetItem(KEYS.FORM_PAYMENTS, JSON.stringify(initialFormPayments));
    return initialFormPayments;
  }
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      if (parsed.some((f) => f.id === 'fpay_001' || f.studentId === 'std_001')) {
        const cleaned = parsed.filter((f) => !f.id.startsWith('fpay_00') && f.studentId !== 'std_001');
        safeSetItem(KEYS.FORM_PAYMENTS, JSON.stringify(cleaned));
        return cleaned;
      }
      return parsed;
    }
    return initialFormPayments;
  } catch {
    return initialFormPayments;
  }
}

export function saveFormPayments(records: FormPaymentRecord[]): void {
  safeSetItem(KEYS.FORM_PAYMENTS, JSON.stringify(records));
  syncFormPaymentsToSupabase(records);
}

export function getStoredBamPayments(): BamPaymentRecord[] {
  const data = safeGetItem(KEYS.BAM_PAYMENTS);
  if (!data) {
    safeSetItem(KEYS.BAM_PAYMENTS, JSON.stringify(initialBamPayments));
    return initialBamPayments;
  }
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      if (parsed.some((b) => b.id === 'bampay_001' || b.studentId === 'std_001')) {
        const cleaned = parsed.filter((b) => !b.id.startsWith('bampay_00') && b.studentId !== 'std_001');
        safeSetItem(KEYS.BAM_PAYMENTS, JSON.stringify(cleaned));
        return cleaned;
      }
      return parsed;
    }
    return initialBamPayments;
  } catch {
    return initialBamPayments;
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
      safeSetItem(KEYS.USERS_DB, JSON.stringify(data.usersDb));
      syncUsersDbToSupabase(data.usersDb);
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
  safeSetItem(KEYS.USERS_DB, JSON.stringify(nonStudentUsers));
  syncUsersDbToSupabase(nonStudentUsers);

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
  syncStudentsToSupabase(initialStudents);
  syncClassQuotasToSupabase(initialClassQuotas);
  syncSchoolInfoToSupabase(initialSchoolInfo);
}
