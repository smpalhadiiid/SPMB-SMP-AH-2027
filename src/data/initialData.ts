import { StudentData, ClassQuota, CostBreakdown, SchoolInfo, TestSchedule, GasConfig, WebsiteConfig, ExamQuestion, FormPaymentRecord, BamPaymentRecord } from '../types';

export const initialWebsiteConfig: WebsiteConfig = {
  heroTitle: 'Sistem Penerimaan Murid Baru (SPMB)',
  heroSubtitle: 'Mewujudkan Generasi Rabbani yang Cerdas, Berakhlak Mulia, Berprestasi & Berjiwa Qur’ani',
  heroBadgeText: 'SPMB TP 2027/2028 Telah Resmi Dibuka',
  announcementBannerText: '🔥 SPMB SMP Al-Hadiid Cileungsi segera dibuka',
  showAnnouncementBanner: true,
  primaryColorTheme: 'emerald',
  showVideoSection: true,
  showBrochureSection: true,
  showQuotaSection: true,
  showCostSection: true,
  showScheduleSection: true,
  showFaqSection: true,
  customWelcomeNotice: 'Selamat datang di Portal SPMB Online SMP Al-Hadiid Cileungsi.',
};

export const initialSchoolInfo: SchoolInfo = {
  name: 'SMP AL-HADIID CILEUNGSI',
  subTitle: 'Sekolah Menengah Pertama Islam Terpadu Al-Hadiid Cileungsi',
  tagline: 'Terwujudnya Murid yang memiliki Aqidah yang kuat, berakhlak mulia sesuai manhaj salafush sholih serta menguasai ilmu pengetahuan dan teknologi.',
  address: 'Jl. Melati 1 Perumahan Cileungsi Indah, Cileungsi, Kab. Bogor 16820',
  phone: '021-82493659',
  whatsapp: '6285814998782',
  email: 'smpalhadiid@gmail.com',
  website: 'https://alhadiid.or.id/smp-alhadiid/',
  bankName: 'Bank Syariah Indonesia (BSI)',
  bankAccountNumber: '3953157480',
  bankAccountName: 'Al-Hadiid',
  formFee: 200000,
  academicYear: '2027/2028',
  brochureUrl: '',
  brochureFileName: 'Brosur_Resmi_SPMB_SMP_AlHadiid_2027_2028.pdf',
  brochureFileSize: '2.4 MB',
  videoProfileUrl: 'https://youtu.be/pBvlONwqC9g?si=e_MDbYLh3-ViQQ6P',
  headmasterName: 'Dr. H. Ahmad Dahlan, M.Pd.',
  headmasterNiy: '19820514 200801 1 001',
  npsn: '20254651',
  accreditation: 'A (Sangat Baik / Unggulan)',
  principalGreeting: 'Selamat datang di Portal SPMB Online SMP Al-Hadiid Cileungsi. Kami berkomitmen memberikan pendidikan terbaik berbasis Al-Qur\'an & Sains.',
  socialMedia: {
    instagram: 'https://instagram.com/alhadiidofficial',
    facebook: 'https://facebook.com/smpalhadiid',
    youtube: 'https://youtube.com/@YayasanAl-Hadiid',
    tiktok: 'https://tiktok.com/@alhadiidofficial',
  },
};

export const initialCostBreakdowns: CostBreakdown[] = [
  { id: 'c1', title: 'Dana Sarana & Prasarana', amount: 4500000, amountIkhwan: 4500000, amountAkhwat: 5500000, period: 'Sekali', description: 'Internal: Rp 4.500.000 / Eksternal: Rp 5.500.000 (Fasilitas Multimedia, Lab Komputer & Sarana Belajar)', isMandatory: true },
  { id: 'c2', title: 'Paket Seragam Lengkap (5 Stel)', amount: 1500000, amountIkhwan: 1500000, amountAkhwat: 1500000, period: 'Sekali', description: 'Sekali - 5 Stel: Putih Biru, Pramuka, Batik Al-Hadiid, Olahraga, Gamis/Koko Rabbani', isMandatory: true },
  { id: 'c3', title: 'Buku Paket & Modul Pembelajaran (1 Tahun)', amount: 1600000, amountIkhwan: 1600000, amountAkhwat: 1600000, period: 'Per Tahun', description: 'Per Tahun - Buku Kurikulum Nasional & Modul Diniyyah Salafush Sholih', isMandatory: true },
  { id: 'c4', title: 'Kegiatan MPLS & Penguatan Karakter', amount: 500000, amountIkhwan: 500000, amountAkhwat: 500000, period: 'Sekali', description: 'Sekali - Masa Pengenalan Lingkungan Sekolah & Orientasi Keislaman', isMandatory: true },
  { id: 'c5', title: 'Ekstrakurikuler Wajib & Pilihan (1 Tahun)', amount: 600000, amountIkhwan: 600000, amountAkhwat: 600000, period: 'Per Tahun', description: 'Per Tahun - Tahfidz Al-Qur\'an, Pramuka SIT, Panahan, Futsal, Robotic Club', isMandatory: true },
  { id: 'c6', title: 'Dana Penyelenggaraan Pendidikan (SPP Bulan Juli)', amount: 800000, amountIkhwan: 800000, amountAkhwat: 800000, period: 'Per Bulan', description: 'Per Bulan - SPP Bulan Pertama (Juli 2027)', isMandatory: true },
  { id: 'c7', title: 'Kegiatan Kesiswaan, Keputrian & Dauroh Qur\'an', amount: 1500000, amountIkhwan: 1500000, amountAkhwat: 1500000, period: 'Per Tahun', description: 'Per Tahun - Pesantren Kilat, Mukhayyam Tarbawi, Dauroh Qur\'an, PAS & PAT', isMandatory: true },
];

export const initialClassQuotas: ClassQuota[] = [
  { id: 'cls-7a', academicYear: '2027/2028', level: 'Kelas 7', className: '7 A', capacity: 32, filled: 0, homeroomTeacher: '-' },
  { id: 'cls-7b', academicYear: '2027/2028', level: 'Kelas 7', className: '7 B', capacity: 32, filled: 0, homeroomTeacher: '-' },
  { id: 'cls-7c', academicYear: '2027/2028', level: 'Kelas 7', className: '7 C', capacity: 32, filled: 0, homeroomTeacher: '-' },
  { id: 'cls-7d', academicYear: '2027/2028', level: 'Kelas 7', className: '7 D', capacity: 32, filled: 0, homeroomTeacher: '-' },
  { id: 'cls-7e', academicYear: '2027/2028', level: 'Kelas 7', className: '7 E', capacity: 32, filled: 0, homeroomTeacher: '-' },
  { id: 'cls-7f', academicYear: '2027/2028', level: 'Kelas 7', className: '7 F', capacity: 32, filled: 0, homeroomTeacher: '-' },
  { id: 'cls-7g', academicYear: '2027/2028', level: 'Kelas 7', className: '7 G', capacity: 32, filled: 0, homeroomTeacher: '-' },
  { id: 'cls-7h', academicYear: '2027/2028', level: 'Kelas 7', className: '7 H', capacity: 32, filled: 0, homeroomTeacher: '-' },
];

export const initialTestSchedules: TestSchedule[] = [
  {
    id: 'ts1',
    waveName: 'Gelombang 1',
    testDate: '2027-02-15',
    testTime: '08:00 - 11:30 WIB',
    location: 'Gedung Utama SMP Al-Hadiid Cileungsi (Lantai 2)',
    notes: 'Harap membawa Bukti Pendaftaran, Alat Tulis, dan memakai pakaian rapi/busana muslim.',
    isOnlineActive: true,
    durationMinutes: 90,
  },
  {
    id: 'ts2',
    waveName: 'Gelombang 2',
    testDate: '2027-04-18',
    testTime: '08:00 - 11:30 WIB',
    location: 'Gedung Utama SMP Al-Hadiid Cileungsi (Lantai 2)',
    notes: 'Harap membawa Bukti Pendaftaran & Alat Tulis lengkap.',
    isOnlineActive: false,
    durationMinutes: 90,
  },
];

export const initialQuestionBank: ExamQuestion[] = [
  // Tes Diagnostik (30%)
  {
    id: 'q_diag_01',
    category: 'diagnostik',
    questionText: 'Jika 3x + 7 = 22, maka nilai dari 2x - 3 adalah...',
    options: ['5', '7', '9', '11'],
    correctOptionIndex: 1,
    points: 10,
  },
  {
    id: 'q_diag_02',
    category: 'diagnostik',
    questionText: 'Pola bilangan 2, 6, 12, 20, 30, ... Suku berikutnya adalah...',
    options: ['38', '40', '42', '46'],
    correctOptionIndex: 2,
    points: 10,
  },
  {
    id: 'q_diag_03',
    category: 'diagnostik',
    questionText: 'Sebuah kolam dapat diisi penuh dalam waktu 4 jam oleh 3 kran air. Berapa jam waktu yang dibutuhkan jika menggunakan 4 kran air dengan debit yang sama?',
    options: ['2 jam', '3 jam', '3.5 jam', '5 jam'],
    correctOptionIndex: 1,
    points: 10,
  },

  // Pengetahuan Umum (40%)
  {
    id: 'q_gen_01',
    category: 'pengetahuan_umum',
    questionText: 'Landasan idiil negara Republik Indonesia adalah...',
    options: ['UUD 1945', 'Pancasila', 'GBHN', 'Proklamasi'],
    correctOptionIndex: 1,
    points: 10,
  },
  {
    id: 'q_gen_02',
    category: 'pengetahuan_umum',
    questionText: 'Siapakah pahlawan nasional yang mendapat julukan "Bapak Pendidikan Nasional"?',
    options: ['Ir. Soekarno', 'Ki Hajar Dewantara', 'R.A. Kartini', 'Mohammad Hatta'],
    correctOptionIndex: 1,
    points: 10,
  },
  {
    id: 'q_gen_03',
    category: 'pengetahuan_umum',
    questionText: 'Danau terbesar di Indonesia yang terletak di Provinsi Sumatera Utara adalah...',
    options: ['Danau Singkarak', 'Danau Maninjau', 'Danau Toba', 'Danau Sentani'],
    correctOptionIndex: 2,
    points: 10,
  },

  // Diniyyah / Agama (30%)
  {
    id: 'q_rel_01',
    category: 'diniyyah',
    questionText: 'Surah dalam Al-Qur\'an yang dinamakan sebagai Ummul Qur\'an (Induk Al-Qur\'an) adalah...',
    options: ['Surah Al-Baqarah', 'Surah Al-Ikhlas', 'Surah Al-Fatihah', 'Surah Yasin'],
    correctOptionIndex: 2,
    points: 10,
  },
  {
    id: 'q_rel_02',
    category: 'diniyyah',
    questionText: 'Rukun Islam yang ketiga menurut urutan yang benar adalah...',
    options: ['Mengucapkan Kalimat Syahadat', 'Mendirikan Shalat', 'Menunaikan Zakat', 'Berpuasa di Bulan Ramadhan'],
    correctOptionIndex: 2,
    points: 10,
  },
  {
    id: 'q_rel_03',
    category: 'diniyyah',
    questionText: 'Hukum membaca Al-Qur\'an dengan memperhatikan tajwid secara umum bagi setiap muslim adalah...',
    options: ['Fardhu Kifayah', 'Fardhu \'Ain', 'Sunnah Muakkad', 'Mubah'],
    correctOptionIndex: 1,
    points: 10,
  },
];

export const initialStudents: StudentData[] = [];

export const initialGasConfig: GasConfig = {
  spreadsheetId: '1SpMbAlHadiidCileungsi_SpreadsheetDatabase2027',
  webAppUrl: 'https://script.google.com/macros/s/AKfycbx_SMPAlHadiidCileungsiSPMB2027/exec',
  autoSync: true,
  lastSyncedAt: new Date().toISOString(),
};

export const initialFormPayments: FormPaymentRecord[] = [];

export const initialBamPayments: BamPaymentRecord[] = [];

