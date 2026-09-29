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
  { id: 'c1', title: 'Dana Awal Pendidikan (DAP)', amount: 4250000, amountIkhwan: 4250000, amountAkhwat: 4250000, period: 'Sekali', description: 'Pengembangan sarana prasarana, lab multimedia, dan fasilitas pembelajaran digital', isMandatory: true },
  { id: 'c2', title: 'Dana Praktik Komputer', amount: 150000, amountIkhwan: 150000, amountAkhwat: 150000, period: 'Per Tahun', description: 'Praktik komputer, lab multimedia & literasi digital', isMandatory: true },
  { id: 'c3', title: 'Dana Praktik IPA', amount: 100000, amountIkhwan: 100000, amountAkhwat: 100000, period: 'Per Tahun', description: 'Praktikum sains IPA, eksperimen fisika dan biologi', isMandatory: true },
  { id: 'c4', title: 'Perlengkapan / Seragam (Paket)*', amount: 700000, amountIkhwan: 700000, amountAkhwat: 920000, period: 'Sekali', description: 'Ikhwan: Rp 700.000 (Koko/Celana) | Akhwat: Rp 920.000 (+ Gamis & Jilbab Rabbani)', isMandatory: true },
  { id: 'c5', title: 'Dana Penyelenggaraan Pendidikan (DPP / SPP)', amount: 425000, amountIkhwan: 425000, amountAkhwat: 425000, period: 'Per Bulan', description: 'Iuran SPP bulan pertama (Bulan Juli 2027)', isMandatory: true },
  { id: 'c6', title: 'Tabungan Wajib', amount: 25000, amountIkhwan: 25000, amountAkhwat: 25000, period: 'Per Bulan', description: 'Tabungan wajib santri bulan pertama', isMandatory: true },
  { id: 'c7', title: 'MPLS / MOS', amount: 100000, amountIkhwan: 100000, amountAkhwat: 100000, period: 'Sekali', description: 'Masa Pengenalan Lingkungan Sekolah & Orientasi Keislaman', isMandatory: true },
  { id: 'c8', title: 'Dana Sosial', amount: 25000, amountIkhwan: 25000, amountAkhwat: 25000, period: 'Per Tahun', description: 'Santunan sosial, ta\'awun dan kepedulian sesama', isMandatory: true },
  { id: 'c9', title: 'Penilaian Akhir Semester (PAS)', amount: 220000, amountIkhwan: 220000, amountAkhwat: 220000, period: 'Per Tahun', description: 'Pelaksanaan ujian asesmen semester ganjil', isMandatory: true },
  { id: 'c10', title: 'Penilaian Akhir Tahun (PAT)', amount: 225000, amountIkhwan: 225000, amountAkhwat: 225000, period: 'Per Tahun', description: 'Pelaksanaan ujian asesmen kenaikan kelas genap', isMandatory: true },
  { id: 'c11', title: 'Kegiatan Ekstrakurikuler / AMBAP', amount: 125000, amountIkhwan: 125000, amountAkhwat: 125000, period: 'Per Tahun', description: 'Pengembangan minat bakat, ekskul pilihan & wajib', isMandatory: true },
  { id: 'c12', title: 'Biaya Dauroh (Kegiatan Pesantren)', amount: 120000, amountIkhwan: 120000, amountAkhwat: 120000, period: 'Per Tahun', description: 'Pesantren kilat, dauroh Al-Qur\'an & pembinaan adab', isMandatory: true },
  { id: 'c13', title: 'Biaya Cetak (Raport, Foto, Name Tag, Kalender)', amount: 205000, amountIkhwan: 205000, amountAkhwat: 205000, period: 'Per Tahun', description: 'Pencetakan sampul raport, foto kartu pelajar, name tag & kalender sekolah', isMandatory: true },
];

export const initialClassQuotas: ClassQuota[] = [
  { id: 'q1', academicYear: '2027/2028', level: 'Kelas 7', className: '7 A (Tahfizh Unggulan)', capacity: 32, filled: 0, homeroomTeacher: 'Ustadz Ahmad Fauzi, S.Pd.I.' },
  { id: 'q2', academicYear: '2027/2028', level: 'Kelas 7', className: '7 B (Sains & Digital)', capacity: 32, filled: 0, homeroomTeacher: 'Ibu Nuraeni, S.Si.' },
  { id: 'q3', academicYear: '2027/2028', level: 'Kelas 7', className: '7 C (Bilingual & International)', capacity: 32, filled: 0, homeroomTeacher: 'Ustadz Rizky Syahputra, M.Pd.' },
  { id: 'q4', academicYear: '2027/2028', level: 'Kelas 7', className: '7 D (Reguler Rabbani)', capacity: 32, filled: 0, homeroomTeacher: 'Ibu Fitri Handayani, S.Pd.' },
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

