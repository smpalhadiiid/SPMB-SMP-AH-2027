export type UserRole = 'student' | 'admin' | 'kepsek' | 'super_admin';

export type AdmissionStatus =
  | 'draft'               // Step 1-2: Akun dibuat
  | 'pending_payment'     // Step 3: Menunggu Pembayaran Formulir
  | 'verifying_payment'   // Step 3: Menunggu Verifikasi Pembayaran
  | 'filling_form'        // Step 4: Isi Formulir Data Lengkap
  | 'form_submitted'      // Step 5: Formulir Terkirim, Nomor Pendaftaran Terbit
  | 'scheduled_test'      // Step 7: Menunggu Tes
  | 'test_completed'      // Step 8: Tes Selesai, Menunggu Pengumuman
  | 'passed'              // Step 9: Dinyatakan Lulus
  | 'passed_reserved'     // Step 9: Cadangan
  | 'failed'              // Step 9: Tidak Lulus
  | 're_registration_paid'// Step 10: Bukti Daftar Ulang Diupload
  | 're_registered'       // Step 10: Daftar Ulang Diverifikasi
  | 'class_assigned'      // Step 12: Penempatan Kelas Selesai
  | 'completed';          // Step 12: Selesai seluruh proses

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  username?: string;
  phone: string;
  role: UserRole;
  registrationNumber?: string;
  createdAt: string;
  password?: string;
  status?: 'active' | 'disabled';
  mustChangePassword?: boolean;
  lastLogin?: string;
}

export interface AuditLogEntry {
  id: string;
  adminId: string;
  adminName: string;
  action: 'UPDATE_USERNAME' | 'UPDATE_PASSWORD' | 'RESET_PASSWORD' | 'ENABLE_USER' | 'DISABLE_USER' | 'CREATE_USER';
  targetUserId: string;
  targetUserName: string;
  details?: string;
  timestamp: string;
}

export interface StudentData {
  id: string; // Same as UserAccount ID
  registrationNumber: string; // e.g., SPMB20270001
  status: AdmissionStatus;
  userEmail: string;
  createdAt: string;

  // Verification flag by Admin
  isFormVerified?: boolean; // Set to true when Admin verifies form & payment

  // Step 2: Registrasi
  fullName: string;
  phone: string;
  
  // Step 3: Pembayaran Formulir
  formPaymentProofUrl?: string;
  formPaymentDate?: string;
  formPaymentAmount: number; // e.g. 200000
  formPaymentStatus: 'unpaid' | 'pending' | 'verified' | 'rejected';
  formPaymentNotes?: string;

  // Step 4: Data Pribadi
  nik: string;
  nisn?: string;
  birthPlace: string;
  birthDate: string;
  gender: 'Laki-laki' | 'Perempuan';
  religion: string;
  childOrder?: string;       // Anak ke
  totalSiblings?: string;    // Dari berapa saudara
  address: string;
  village?: string;          // Desa/Kelurahan
  subdistrict: string;       // Kecamatan
  city: string;              // Kabupaten/Kota
  province: string;
  postalCode?: string;

  // Data Sekolah Asal
  previousSchoolName: string;
  previousSchoolNpsn?: string;
  previousSchoolAddress?: string;

  // Data Orang Tua - Ayah
  fatherName: string;
  fatherBirthPlace?: string;
  fatherBirthDate?: string;
  fatherJob?: string;
  fatherEducation: string;
  fatherPhone: string;

  // Data Orang Tua - Ibu
  motherName: string;
  motherBirthPlace?: string;
  motherBirthDate?: string;
  motherJob: string;
  motherEducation?: string;
  motherPhone: string;

  // Data Wali (Optional)
  guardianName?: string;
  guardianRelation?: string;
  guardianPhone?: string;

  // Upload Dokumen
  photoUrl?: string;        // Pas Foto
  kkUrl?: string;           // Kartu Keluarga
  birthCertUrl?: string;    // Akta Lahir
  reportCardUrl?: string;   // Rapor
  kipUrl?: string;          // Kartu KIP (opsional)
  certificateUrl?: string;  // Piagam Prestasi (opsional)

  // Step 7 & 8: Tes Diagnostik & Ujian Online
  isTestActive?: boolean;     // Set by Admin to open online exam
  testSubmitted?: boolean;    // Set when student submits exam answers
  testAnswers?: Record<string, string>;
  testScheduleDate?: string;
  testLocation?: string;
  diagnosticScore?: number;  // Tes Diagnostik Awal (Bobot 30%)
  generalScore?: number;     // Tes Pengetahuan Umum (Bobot 40%)
  religiousScore?: number;   // Tes Diniyyah (Bobot 30%)
  finalScore?: number;       // Weighted average score
  testNotes?: string;

  // Step 10: Pembayaran Daftar Ulang (Awal Masuk)
  initialPaymentProofUrl?: string;
  initialPaymentDate?: string;
  initialPaymentAmount: number;
  initialPaymentStatus: 'unpaid' | 'pending' | 'verified' | 'rejected';
  initialPaymentNotes?: string;

  // Step 11 & 12: Penempatan Kelas
  assignedClassId?: string;
  assignedClassName?: string; // e.g., 7 A
  assignedHomeroomTeacher?: string;
  firstDayDate?: string;
  mplsInfo?: string;
}

export interface ExamQuestion {
  id: string;
  category: 'diagnostik' | 'pengetahuan_umum' | 'diniyyah' | string;

  questionText: string;
  imageUrl?: string;
  options: string[]; // [Option A, Option B, Option C, Option D]
  correctOptionIndex: number; // 0, 1, 2, 3
  points: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  isActive?: boolean;
}

export interface CbtKategori {
  id: string;
  namaKategori: string;
  kodeKategori: 'diagnostik' | 'pengetahuan_umum' | 'diniyyah' | string;
  persentaseBobot: number; // e.g. 30, 40, 30
  keterangan?: string;
}

export interface CbtSoal extends ExamQuestion {
  kategoriKode: 'diagnostik' | 'pengetahuan_umum' | 'diniyyah' | string;
  question?: string;
  pilihanA: string;

  pilihanB: string;
  pilihanC: string;
  pilihanD: string;
  jawabanBenar: number; // 0, 1, 2, 3
  bobot: number;
  levelKesulitan: 'easy' | 'medium' | 'hard';
  statusAktif: boolean;
  imageUrl?: string;
}

export interface CbtUjian {
  id: string;
  namaUjian: string;
  gelombang: string;
  tanggal: string;
  jamMulai: string;
  durasiMinutes: number;
  status: 'draft' | 'aktif' | 'selesai';
  jumlahDiagnostik: number; // default 6
  jumlahTpu: number;        // default 8
  jumlahDiniyyah: number;   // default 6
  batasKelulusan: number;   // e.g. 70
}

export interface CbtJawabanPeserta {
  id?: string;
  ujianId: string;
  pesertaId: string;
  soalId: string;
  jawabanDipilih?: number; // 0, 1, 2, 3 or undefined
  isRagu?: boolean;
  updatedAt?: string;
}

export interface CbtHasilUjian {
  id: string;
  ujianId: string;
  pesertaId: string;
  registrationNumber: string;
  namaPeserta: string;
  nilaiDiagnostik: number; // e.g. 25
  nilaiTpu: number;        // e.g. 35
  nilaiDiniyyah: number;   // e.g. 30
  nilaiTotal: number;      // e.g. 90
  statusKelulusan: 'LULUS' | 'BELUM LULUS';
  ranking?: number;
  tanggalUjian: string;
}

export interface CbtLogUjian {
  id?: string;
  ujianId: string;
  pesertaId: string;
  namaPeserta: string;
  nomorSoalTerakhir: number;
  sisaWaktuDetik: number;
  statusOnline: 'ONLINE' | 'OFFLINE';
  isSubmitted: boolean;
  updatedAt: string;
}

export interface CbtExamSession {
  ujianId: string;
  pesertaId: string;
  questions: CbtSoal[];
  answers: Record<string, number>; // soalId -> selected option index
  doubtfuls: Record<string, boolean>; // soalId -> boolean
  currentIndex: number;
  remainingTimeSeconds: number;
  isCompleted: boolean;
  startedAt?: string;
}

export interface TestSchedule {
  id: string;
  waveName: string; // Gelombang 1 / Gelombang 2
  testDate: string;
  testTime: string;
  location: string;
  notes: string;
  isOnlineActive?: boolean;
  durationMinutes?: number;
}

export interface ClassQuota {
  id: string;
  academicYear: string; // e.g., 2027/2028
  level: string;        // e.g., Kelas 7
  className: string;    // e.g., 7 A
  capacity: number;     // e.g., 32
  filled: number;       // auto calculated based on verified re-registered students
  homeroomTeacher: string;
}

export interface CostBreakdown {
  id: string;
  title: string;
  amount: number;
  description: string;
  isMandatory: boolean;
}

export interface SchoolInfo {
  name: string;
  subTitle: string;
  tagline: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  formFee: number;
  academicYear: string;
  // Logo Sekolah untuk Kop Surat & Cetak Formulir
  logoUrl?: string;
  logoFileName?: string;
  logoFileSize?: string;
  // Media, Brosur, & Profil Tambahan
  brochureUrl?: string;
  brochureFileName?: string;
  brochureFileType?: string;
  brochureFileSize?: string;
  bamBrochureUrl?: string;
  bamBrochureFileName?: string;
  bamBrochureFileType?: string;
  bamBrochureFileSize?: string;
  videoProfileUrl?: string;
  headmasterName?: string;
  npsn?: string;
  accreditation?: string;
  principalGreeting?: string;
  socialMedia?: {
    instagram?: string;
    facebook?: string;
    youtube?: string;
    tiktok?: string;
  };
}

export interface GasConfig {
  spreadsheetId: string;
  webAppUrl: string;
  lastSyncedAt?: string;
  autoSync: boolean;
}

export interface WebsiteConfig {
  heroTitle?: string;
  heroSubtitle?: string;
  heroBadgeText?: string;
  announcementBannerText?: string;
  showAnnouncementBanner?: boolean;
  primaryColorTheme?: 'emerald' | 'blue' | 'indigo' | 'purple' | 'teal';
  showVideoSection?: boolean;
  showBrochureSection?: boolean;
  showQuotaSection?: boolean;
  showCostSection?: boolean;
  showScheduleSection?: boolean;
  showFaqSection?: boolean;
  customWelcomeNotice?: string;
}

export interface FormPaymentRecord {
  id: string;
  transactionNumber: string; // e.g. TRX-FORM-001
  registrationNumber: string; // e.g. SPMB20270001
  studentId: string;
  studentName: string;
  gender: 'Laki-laki' | 'Perempuan';
  paymentDate: string; // YYYY-MM-DD
  amount: number;
  category: 'Internal' | 'Eksternal' | 'Bazaar';
  notes?: string;
  createdAt: string;
}

export type BamInstallmentType = 'Lunas' | 'Cicilan 1' | 'Cicilan 2' | 'Cicilan 3' | 'Cicilan 4' | 'Cicilan 5' | 'Cicilan 6' | 'Cicilan 7' | 'Cicilan 8' | 'Cicilan 9' | 'Cicilan 10';

export interface BamPaymentRecord {
  id: string;
  transactionNumber: string; // e.g. TRX-BAM-001
  registrationNumber: string; // e.g. SPMB20270001
  studentId: string;
  studentName: string;
  gender: 'Laki-laki' | 'Perempuan';
  paymentDate: string; // YYYY-MM-DD
  totalBamCost: number; // Total nominal BAM e.g. 8500000
  amountPaid: number; // nominal bayar transaksi ini
  installmentType: BamInstallmentType;
  totalPaidToDate: number; // akumulasi terbayar
  remainingBalance: number; // totalBamCost - totalPaidToDate (Saldo)
  proofUrl?: string;
  notes?: string;
  createdAt?: string;
}

