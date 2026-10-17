import { CbtKategori, CbtSoal, CbtUjian, CbtJawabanPeserta, CbtHasilUjian, CbtLogUjian, CbtExamSession } from '../types';
import { supabase } from './supabaseClient';
import { safeGetItem, safeSetItem, safeRemoveItem } from './storage';

const CBT_KEYS = {
  KATEGORI: 'spmb_cbt_kategori',
  SOAL: 'spmb_cbt_soal',
  UJIAN: 'spmb_cbt_ujian',
  JAWABAN: 'spmb_cbt_jawaban',
  HASIL: 'spmb_cbt_hasil',
  DELETED_HASIL: 'spmb_cbt_deleted_hasil',
  DELETED_MONITORING: 'spmb_cbt_deleted_monitoring',
  LOG: 'spmb_cbt_log',
  SESSION_PREFIX: 'spmb_cbt_session_',
};

// 1. DEFAULT KATEGORI
export const DEFAULT_CBT_KATEGORI: CbtKategori[] = [
  {
    id: 'kat_diag',
    namaKategori: 'Tes Diagnostik',
    kodeKategori: 'diagnostik',
    persentaseBobot: 30,
    keterangan: 'Pengukuran kemampuan dasar & logika matematika skolastik (30%)',
  },
  {
    id: 'kat_tpu',
    namaKategori: 'Pengetahuan Umum',
    kodeKategori: 'pengetahuan_umum',
    persentaseBobot: 40,
    keterangan: 'Tes Pengetahuan Umum (TPU), wawasan kebangsaan, & literasi (40%)',
  },
  {
    id: 'kat_diniyyah',
    namaKategori: 'Diniyyah & Agama',
    kodeKategori: 'diniyyah',
    persentaseBobot: 30,
    keterangan: 'Tes Pemahaman Diniyyah, PAI, Al-Qur\'an & Akhlak Islamiyah (30%)',
  },
];

// 2. DEFAULT SOAL (MINIMAL 6 DIAGNOSTIK, 8 TPU, 6 DINIYYAH = 20 SOAL READY)
export const DEFAULT_CBT_SOAL: CbtSoal[] = [
  // --- DIAGNOSTIK (6 SOAL) ---
  {
    id: 'soal_diag_01',
    category: 'diagnostik',
    kategoriKode: 'diagnostik',
    questionText: 'Jika 3x + 7 = 22, maka nilai dari 2x - 3 adalah...',
    options: ['5', '7', '9', '11'],
    pilihanA: '5',
    pilihanB: '7',
    pilihanC: '9',
    pilihanD: '11',
    jawabanBenar: 1, // 7 (karena x=5)
    correctOptionIndex: 1,
    bobot: 10,
    points: 10,
    levelKesulitan: 'medium',
    statusAktif: true,
  },
  {
    id: 'soal_diag_02',
    category: 'diagnostik',
    kategoriKode: 'diagnostik',
    questionText: 'Pola bilangan: 2, 6, 12, 20, 30, ... Suku berikutnya pada pola tersebut adalah...',
    options: ['38', '40', '42', '46'],
    pilihanA: '38',
    pilihanB: '40',
    pilihanC: '42',
    pilihanD: '46',
    jawabanBenar: 2, // 42
    correctOptionIndex: 2,
    bobot: 10,
    points: 10,
    levelKesulitan: 'medium',
    statusAktif: true,
  },
  {
    id: 'soal_diag_03',
    category: 'diagnostik',
    kategoriKode: 'diagnostik',
    questionText: 'Sebuah kolam dapat diisi penuh dalam waktu 4 jam oleh 3 kran air. Berapa jam waktu yang dibutuhkan jika menggunakan 4 kran air dengan debit yang sama?',
    options: ['2 jam', '3 jam', '3.5 jam', '5 jam'],
    pilihanA: '2 jam',
    pilihanB: '3 jam',
    pilihanC: '3.5 jam',
    pilihanD: '5 jam',
    jawabanBenar: 1, // 3 jam
    correctOptionIndex: 1,
    bobot: 10,
    points: 10,
    levelKesulitan: 'medium',
    statusAktif: true,
  },
  {
    id: 'soal_diag_04',
    category: 'diagnostik',
    kategoriKode: 'diagnostik',
    questionText: 'Nilai dari 15 + (-8) × 3 - 12 : (-4) adalah...',
    options: ['-6', '-12', '18', '24'],
    pilihanA: '-6',
    pilihanB: '-12',
    pilihanC: '18',
    pilihanD: '24',
    jawabanBenar: 0, // -6
    correctOptionIndex: 0,
    bobot: 10,
    points: 10,
    levelKesulitan: 'medium',
    statusAktif: true,
  },
  {
    id: 'soal_diag_05',
    category: 'diagnostik',
    kategoriKode: 'diagnostik',
    questionText: 'Manakah di antara pilihan berikut yang memiliki nilai terkecil?',
    options: ['0,35', '3/8', '35%', '1/3'],
    pilihanA: '0,35',
    pilihanB: '3/8',
    pilihanC: '35%',
    pilihanD: '1/3',
    jawabanBenar: 3, // 1/3 (0,333)
    correctOptionIndex: 3,
    bobot: 10,
    points: 10,
    levelKesulitan: 'hard',
    statusAktif: true,
  },
  {
    id: 'soal_diag_06',
    category: 'diagnostik',
    kategoriKode: 'diagnostik',
    questionText: 'Sebuah persegi panjang memiliki keliling 48 cm. Jika panjangnya 4 cm lebih dari lebarnya, maka luas persegi panjang tersebut adalah...',
    options: ['120 cm²', '140 cm²', '160 cm²', '180 cm²'],
    pilihanA: '120 cm²',
    pilihanB: '140 cm²',
    pilihanC: '160 cm²',
    pilihanD: '180 cm²',
    jawabanBenar: 1, // 140 cm² (P=14, L=10)
    correctOptionIndex: 1,
    bobot: 10,
    points: 10,
    levelKesulitan: 'hard',
    statusAktif: true,
  },

  // --- PENGETAHUAN UMUM (8 SOAL) ---
  {
    id: 'soal_tpu_01',
    category: 'pengetahuan_umum',
    kategoriKode: 'pengetahuan_umum',
    questionText: 'Landasan idiil dan falsafah hidup bangsa Indonesia adalah...',
    options: ['UUD 1945', 'Pancasila', 'GBHN', 'Proklamasi 1945'],
    pilihanA: 'UUD 1945',
    pilihanB: 'Pancasila',
    pilihanC: 'GBHN',
    pilihanD: 'Proklamasi 1945',
    jawabanBenar: 1, // Pancasila
    correctOptionIndex: 1,
    bobot: 10,
    points: 10,
    levelKesulitan: 'easy',
    statusAktif: true,
  },
  {
    id: 'soal_tpu_02',
    category: 'pengetahuan_umum',
    kategoriKode: 'pengetahuan_umum',
    questionText: 'Pahlawan nasional yang dijuluki sebagai "Bapak Pendidikan Nasional" adalah...',
    options: ['Ir. Soekarno', 'Ki Hajar Dewantara', 'R.A. Kartini', 'Mohammad Hatta'],
    pilihanA: 'Ir. Soekarno',
    pilihanB: 'Ki Hajar Dewantara',
    pilihanC: 'R.A. Kartini',
    pilihanD: 'Mohammad Hatta',
    jawabanBenar: 1,
    correctOptionIndex: 1,
    bobot: 10,
    points: 10,
    levelKesulitan: 'easy',
    statusAktif: true,
  },
  {
    id: 'soal_tpu_03',
    category: 'pengetahuan_umum',
    kategoriKode: 'pengetahuan_umum',
    questionText: 'Danau vulkanik terbesar di Indonesia yang berada di Provinsi Sumatera Utara adalah...',
    options: ['Danau Singkarak', 'Danau Maninjau', 'Danau Toba', 'Danau Sentani'],
    pilihanA: 'Danau Singkarak',
    pilihanB: 'Danau Maninjau',
    pilihanC: 'Danau Toba',
    pilihanD: 'Danau Sentani',
    jawabanBenar: 2,
    correctOptionIndex: 2,
    bobot: 10,
    points: 10,
    levelKesulitan: 'easy',
    statusAktif: true,
  },
  {
    id: 'soal_tpu_04',
    category: 'pengetahuan_umum',
    kategoriKode: 'pengetahuan_umum',
    questionText: 'Organ tubuh manusia yang berfungsi memompa darah ke seluruh tubuh adalah...',
    options: ['Paru-paru', 'Hati', 'Jantung', 'Ginjal'],
    pilihanA: 'Paru-paru',
    pilihanB: 'Hati',
    pilihanC: 'Jantung',
    pilihanD: 'Ginjal',
    jawabanBenar: 2,
    correctOptionIndex: 2,
    bobot: 10,
    points: 10,
    levelKesulitan: 'easy',
    statusAktif: true,
  },
  {
    id: 'soal_tpu_05',
    category: 'pengetahuan_umum',
    kategoriKode: 'pengetahuan_umum',
    questionText: 'Planet terbesar dalam sistem Tata Surya kita adalah...',
    options: ['Mars', 'Saturnus', 'Jupiter', 'Neptunus'],
    pilihanA: 'Mars',
    pilihanB: 'Saturnus',
    pilihanC: 'Jupiter',
    pilihanD: 'Neptunus',
    jawabanBenar: 2,
    correctOptionIndex: 2,
    bobot: 10,
    points: 10,
    levelKesulitan: 'easy',
    statusAktif: true,
  },
  {
    id: 'soal_tpu_06',
    category: 'pengetahuan_umum',
    kategoriKode: 'pengetahuan_umum',
    questionText: 'Proses tumbuhan hijau mengolah makanan dengan bantuan cahaya matahari dinamakan...',
    options: ['Respirasi', 'Fotosintesis', 'Transpirasi', 'Klorofilasi'],
    pilihanA: 'Respirasi',
    pilihanB: 'Fotosintesis',
    pilihanC: 'Transpirasi',
    pilihanD: 'Klorofilasi',
    jawabanBenar: 1,
    correctOptionIndex: 1,
    bobot: 10,
    points: 10,
    levelKesulitan: 'easy',
    statusAktif: true,
  },
  {
    id: 'soal_tpu_07',
    category: 'pengetahuan_umum',
    kategoriKode: 'pengetahuan_umum',
    questionText: 'Hari Kemerdekaan Republik Indonesia diperingati setiap tanggal...',
    options: ['1 Juni', '17 Agustus', '28 Oktober', '10 November'],
    pilihanA: '1 Juni',
    pilihanB: '17 Agustus',
    pilihanC: '28 Oktober',
    pilihanD: '10 November',
    jawabanBenar: 1,
    correctOptionIndex: 1,
    bobot: 10,
    points: 10,
    levelKesulitan: 'easy',
    statusAktif: true,
  },
  {
    id: 'soal_tpu_08',
    category: 'pengetahuan_umum',
    kategoriKode: 'pengetahuan_umum',
    questionText: 'Benua terbesar dan terluas di dunia adalah...',
    options: ['Benua Afrika', 'Benua Amerika', 'Benua Asia', 'Benua Eropa'],
    pilihanA: 'Benua Afrika',
    pilihanB: 'Benua Amerika',
    pilihanC: 'Benua Asia',
    pilihanD: 'Benua Eropa',
    jawabanBenar: 2,
    correctOptionIndex: 2,
    bobot: 10,
    points: 10,
    levelKesulitan: 'easy',
    statusAktif: true,
  },

  // --- DINIYYAH & AGAMA (6 SOAL) ---
  {
    id: 'soal_diniyyah_01',
    category: 'diniyyah',
    kategoriKode: 'diniyyah',
    questionText: 'Surah dalam Al-Qur\'an yang dijuluki sebagai Ummul Qur\'an (Induk Al-Qur\'an) adalah...',
    options: ['Surah Al-Baqarah', 'Surah Al-Ikhlas', 'Surah Al-Fatihah', 'Surah Yasin'],
    pilihanA: 'Surah Al-Baqarah',
    pilihanB: 'Surah Al-Ikhlas',
    pilihanC: 'Surah Al-Fatihah',
    pilihanD: 'Surah Yasin',
    jawabanBenar: 2,
    correctOptionIndex: 2,
    bobot: 10,
    points: 10,
    levelKesulitan: 'easy',
    statusAktif: true,
  },
  {
    id: 'soal_diniyyah_02',
    category: 'diniyyah',
    kategoriKode: 'diniyyah',
    questionText: 'Rukun Islam yang ketiga menurut urutan yang benar adalah...',
    options: ['Mengucapkan Kalimat Syahadat', 'Mendirikan Shalat', 'Menunaikan Zakat', 'Berpuasa Ramadhan'],
    pilihanA: 'Mengucapkan Kalimat Syahadat',
    pilihanB: 'Mendirikan Shalat',
    pilihanC: 'Menunaikan Zakat',
    pilihanD: 'Berpuasa Ramadhan',
    jawabanBenar: 2,
    correctOptionIndex: 2,
    bobot: 10,
    points: 10,
    levelKesulitan: 'easy',
    statusAktif: true,
  },
  {
    id: 'soal_diniyyah_03',
    category: 'diniyyah',
    kategoriKode: 'diniyyah',
    questionText: 'Hukum membaca Al-Qur\'an dengan memperhatikan kaidah ilmu tajwid bagi setiap muslim adalah...',
    options: ['Fardhu Kifayah', 'Fardhu \'Ain', 'Sunnah Muakkad', 'Mubah'],
    pilihanA: 'Fardhu Kifayah',
    pilihanB: 'Fardhu \'Ain',
    pilihanC: 'Sunnah Muakkad',
    pilihanD: 'Mubah',
    jawabanBenar: 1,
    correctOptionIndex: 1,
    bobot: 10,
    points: 10,
    levelKesulitan: 'medium',
    statusAktif: true,
  },
  {
    id: 'soal_diniyyah_04',
    category: 'diniyyah',
    kategoriKode: 'diniyyah',
    questionText: 'Nabi dan Rasul Allah SWT yang mendapat julukan Ulul Azmi berjumlah...',
    options: ['3 Rasul', '5 Rasul', '7 Rasul', '10 Rasul'],
    pilihanA: '3 Rasul',
    pilihanB: '5 Rasul',
    pilihanC: '7 Rasul',
    pilihanD: '10 Rasul',
    jawabanBenar: 1, // 5 Rasul
    correctOptionIndex: 1,
    bobot: 10,
    points: 10,
    levelKesulitan: 'medium',
    statusAktif: true,
  },
  {
    id: 'soal_diniyyah_05',
    category: 'diniyyah',
    kategoriKode: 'diniyyah',
    questionText: 'Shalat sunnah yang dikerjakan pada sepertiga malam terakhir dan ditutup dengan shalat witir dinamakan...',
    options: ['Shalat Dhuha', 'Shalat Tahajjud', 'Shalat Istikharah', 'Shalat Hajat'],
    pilihanA: 'Shalat Dhuha',
    pilihanB: 'Shalat Tahajjud',
    pilihanC: 'Shalat Istikharah',
    pilihanD: 'Shalat Hajat',
    jawabanBenar: 1,
    correctOptionIndex: 1,
    bobot: 10,
    points: 10,
    levelKesulitan: 'easy',
    statusAktif: true,
  },
  {
    id: 'soal_diniyyah_06',
    category: 'diniyyah',
    kategoriKode: 'diniyyah',
    questionText: 'Kitab suci Al-Qur\'an diturunkan kepada Nabi Muhammad SAW melalui perantara Malaikat...',
    options: ['Mikail', 'Jibril', 'Izrail', 'Israfil'],
    pilihanA: 'Mikail',
    pilihanB: 'Jibril',
    pilihanC: 'Izrail',
    pilihanD: 'Israfil',
    jawabanBenar: 1,
    correctOptionIndex: 1,
    bobot: 10,
    points: 10,
    levelKesulitan: 'easy',
    statusAktif: true,
  },
];

// 3. DEFAULT UJIAN JADWAL
export const DEFAULT_CBT_UJIAN: CbtUjian[] = [
  {
    id: 'uj_spmb_2027_01',
    namaUjian: 'Ujian Tes Seleksi SPMB Gelombang 1',
    gelombang: 'Gelombang 1',
    tanggal: new Date().toISOString().split('T')[0],
    jamMulai: '08:00',
    durasiMinutes: 90,
    status: 'aktif',
    jumlahDiagnostik: 6,
    jumlahTpu: 8,
    jumlahDiniyyah: 6,
    batasKelulusan: 70,
  },
];

// --------------------------------------------------------------------
// LOCAL STORAGE & SUPABASE GETTERS / SAVERS
// --------------------------------------------------------------------

export function getCbtKategori(): CbtKategori[] {
  const data = safeGetItem(CBT_KEYS.KATEGORI);
  if (!data) {
    safeSetItem(CBT_KEYS.KATEGORI, JSON.stringify(DEFAULT_CBT_KATEGORI));
    return DEFAULT_CBT_KATEGORI;
  }
  try {
    return JSON.parse(data);
  } catch {
    return DEFAULT_CBT_KATEGORI;
  }
}

export function saveCbtKategori(kategoriList: CbtKategori[]): void {
  safeSetItem(CBT_KEYS.KATEGORI, JSON.stringify(kategoriList));
}

export function getCbtSoal(): CbtSoal[] {
  const data = safeGetItem(CBT_KEYS.SOAL);
  if (!data) {
    safeSetItem(CBT_KEYS.SOAL, JSON.stringify(DEFAULT_CBT_SOAL));
    return DEFAULT_CBT_SOAL;
  }
  try {
    return JSON.parse(data);
  } catch {
    return DEFAULT_CBT_SOAL;
  }
}

export function saveCbtSoal(soalList: CbtSoal[]): void {
  safeSetItem(CBT_KEYS.SOAL, JSON.stringify(soalList));
}

export function getCbtUjian(): CbtUjian[] {
  const data = safeGetItem(CBT_KEYS.UJIAN);
  if (!data) {
    safeSetItem(CBT_KEYS.UJIAN, JSON.stringify(DEFAULT_CBT_UJIAN));
    return DEFAULT_CBT_UJIAN;
  }
  try {
    return JSON.parse(data);
  } catch {
    return DEFAULT_CBT_UJIAN;
  }
}

export function saveCbtUjian(ujianList: CbtUjian[]): void {
  safeSetItem(CBT_KEYS.UJIAN, JSON.stringify(ujianList));
}

// Default realistic initial exam results for SMP Al-Hadiid CBT
export const DEFAULT_CBT_HASIL_UJIAN: CbtHasilUjian[] = [
  {
    id: 'hasil_cbt_001',
    ujianId: '7c690ee0-7321-4604-a05d-ea664019bcfc',
    pesertaId: 'peserta_cbt_001',
    registrationNumber: 'REG-2025-001',
    namaPeserta: 'Muhammad Fathan Al-Khatiri',
    nilaiDiagnostik: 95,
    nilaiTpu: 92,
    nilaiDiniyyah: 98,
    nilaiTotal: 95,
    statusKelulusan: 'LULUS',
    tanggalUjian: '2025-02-10',
    ranking: 1,
  },
  {
    id: 'hasil_cbt_002',
    ujianId: '7c690ee0-7321-4604-a05d-ea664019bcfc',
    pesertaId: 'peserta_cbt_002',
    registrationNumber: 'REG-2025-002',
    namaPeserta: 'Aisyah Putri Rahmadani',
    nilaiDiagnostik: 92,
    nilaiTpu: 90,
    nilaiDiniyyah: 95,
    nilaiTotal: 92,
    statusKelulusan: 'LULUS',
    tanggalUjian: '2025-02-10',
    ranking: 2,
  },
  {
    id: 'hasil_cbt_003',
    ujianId: '7c690ee0-7321-4604-a05d-ea664019bcfc',
    pesertaId: 'peserta_cbt_003',
    registrationNumber: 'REG-2025-003',
    namaPeserta: 'Rafi Ahmad Fauzi',
    nilaiDiagnostik: 88,
    nilaiTpu: 90,
    nilaiDiniyyah: 86,
    nilaiTotal: 88,
    statusKelulusan: 'LULUS',
    tanggalUjian: '2025-02-11',
    ranking: 3,
  },
  {
    id: 'hasil_cbt_004',
    ujianId: '7c690ee0-7321-4604-a05d-ea664019bcfc',
    pesertaId: 'peserta_cbt_004',
    registrationNumber: 'REG-2025-004',
    namaPeserta: 'Zahra Nurul Izzah',
    nilaiDiagnostik: 85,
    nilaiTpu: 88,
    nilaiDiniyyah: 85,
    nilaiTotal: 86,
    statusKelulusan: 'LULUS',
    tanggalUjian: '2025-02-11',
    ranking: 4,
  },
  {
    id: 'hasil_cbt_005',
    ujianId: '7c690ee0-7321-4604-a05d-ea664019bcfc',
    pesertaId: 'peserta_cbt_005',
    registrationNumber: 'REG-2025-005',
    namaPeserta: 'Bilal Habibi Ramadhan',
    nilaiDiagnostik: 82,
    nilaiTpu: 85,
    nilaiDiniyyah: 86,
    nilaiTotal: 84,
    statusKelulusan: 'LULUS',
    tanggalUjian: '2025-02-12',
    ranking: 5,
  },
  {
    id: 'hasil_cbt_006',
    ujianId: '7c690ee0-7321-4604-a05d-ea664019bcfc',
    pesertaId: 'peserta_cbt_006',
    registrationNumber: 'REG-2025-006',
    namaPeserta: 'Nadhira Shafa Qanita',
    nilaiDiagnostik: 80,
    nilaiTpu: 82,
    nilaiDiniyyah: 84,
    nilaiTotal: 82,
    statusKelulusan: 'LULUS',
    tanggalUjian: '2025-02-12',
    ranking: 6,
  },
  {
    id: 'hasil_cbt_007',
    ujianId: '7c690ee0-7321-4604-a05d-ea664019bcfc',
    pesertaId: 'peserta_cbt_007',
    registrationNumber: 'REG-2025-007',
    namaPeserta: 'Faris Farhan Maulana',
    nilaiDiagnostik: 76,
    nilaiTpu: 80,
    nilaiDiniyyah: 78,
    nilaiTotal: 78,
    statusKelulusan: 'LULUS',
    tanggalUjian: '2025-02-13',
    ranking: 7,
  },
  {
    id: 'hasil_cbt_008',
    ujianId: '7c690ee0-7321-4604-a05d-ea664019bcfc',
    pesertaId: 'peserta_cbt_008',
    registrationNumber: 'REG-2025-008',
    namaPeserta: 'Khansa Humaira Azzahra',
    nilaiDiagnostik: 74,
    nilaiTpu: 76,
    nilaiDiniyyah: 75,
    nilaiTotal: 75,
    statusKelulusan: 'LULUS',
    tanggalUjian: '2025-02-13',
    ranking: 8,
  },
  {
    id: 'hasil_cbt_009',
    ujianId: '7c690ee0-7321-4604-a05d-ea664019bcfc',
    pesertaId: 'peserta_cbt_009',
    registrationNumber: 'REG-2025-009',
    namaPeserta: 'Daffa Raihan Pratama',
    nilaiDiagnostik: 70,
    nilaiTpu: 72,
    nilaiDiniyyah: 70,
    nilaiTotal: 71,
    statusKelulusan: 'LULUS',
    tanggalUjian: '2025-02-14',
    ranking: 9,
  },
  {
    id: 'hasil_cbt_010',
    ujianId: '7c690ee0-7321-4604-a05d-ea664019bcfc',
    pesertaId: 'peserta_cbt_010',
    registrationNumber: 'REG-2025-010',
    namaPeserta: 'Salma Fitria Amanda',
    nilaiDiagnostik: 60,
    nilaiTpu: 64,
    nilaiDiniyyah: 62,
    nilaiTotal: 62,
    statusKelulusan: 'BELUM LULUS',
    tanggalUjian: '2025-02-14',
    ranking: 10,
  },
];

export function getDeletedHasilIds(): string[] {
  const data = safeGetItem(CBT_KEYS.DELETED_HASIL);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function addDeletedHasilId(id: string, pesertaId?: string): void {
  const current = getDeletedHasilIds();
  const toAdd = [id];
  if (pesertaId) toAdd.push(pesertaId);
  const updated = Array.from(new Set([...current, ...toAdd]));
  safeSetItem(CBT_KEYS.DELETED_HASIL, JSON.stringify(updated));
}

export function removeDeletedHasilId(idOrPesertaId: string): void {
  const current = getDeletedHasilIds();
  const updated = current.filter((id) => id !== idOrPesertaId);
  safeSetItem(CBT_KEYS.DELETED_HASIL, JSON.stringify(updated));
}

export function clearAllDeletedHasilIds(): void {
  safeRemoveItem(CBT_KEYS.DELETED_HASIL);
}

// --------------------------------------------------------------------
// TOMBSTONES UNTUK PESERTA MONITORING LIVE (HAPUS & ULANG UJIAN)
// --------------------------------------------------------------------
export function getDeletedMonitoringIds(): string[] {
  const data = safeGetItem(CBT_KEYS.DELETED_MONITORING);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function addDeletedMonitoringId(pesertaId: string): void {
  if (!pesertaId) return;
  const current = getDeletedMonitoringIds();
  const updated = Array.from(new Set([...current, pesertaId]));
  safeSetItem(CBT_KEYS.DELETED_MONITORING, JSON.stringify(updated));
}

export function removeDeletedMonitoringId(pesertaId: string): void {
  if (!pesertaId) return;
  const current = getDeletedMonitoringIds();
  const updated = current.filter((id) => id !== pesertaId);
  safeSetItem(CBT_KEYS.DELETED_MONITORING, JSON.stringify(updated));
}

export function clearAllDeletedMonitoringIds(): void {
  safeRemoveItem(CBT_KEYS.DELETED_MONITORING);
}

export function getCbtHasilUjian(): CbtHasilUjian[] {
  const deletedIds = new Set(getDeletedHasilIds());
  const data = safeGetItem(CBT_KEYS.HASIL);
  if (!data) {
    const initial = DEFAULT_CBT_HASIL_UJIAN.filter(
      (h) => !deletedIds.has(h.id) && !deletedIds.has(h.pesertaId)
    );
    safeSetItem(CBT_KEYS.HASIL, JSON.stringify(initial));
    return initial;
  }
  try {
    const parsed: CbtHasilUjian[] = JSON.parse(data);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const initial = DEFAULT_CBT_HASIL_UJIAN.filter(
        (h) => !deletedIds.has(h.id) && !deletedIds.has(h.pesertaId)
      );
      return initial;
    }
    return parsed.filter((h) => !deletedIds.has(h.id) && !deletedIds.has(h.pesertaId));
  } catch {
    return DEFAULT_CBT_HASIL_UJIAN.filter(
      (h) => !deletedIds.has(h.id) && !deletedIds.has(h.pesertaId)
    );
  }
}

export function saveCbtHasilUjian(hasilList: CbtHasilUjian[]): void {
  const deletedIds = new Set(getDeletedHasilIds());
  const filtered = hasilList.filter(
    (h) => !deletedIds.has(h.id) && !deletedIds.has(h.pesertaId)
  );
  safeSetItem(CBT_KEYS.HASIL, JSON.stringify(filtered));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cbt_hasil_updated'));
  }

  // Try syncing to Supabase if available with valid column schema
  try {
    Promise.resolve(
      supabase.from('hasil_ujian').upsert(
        filtered.map((h) => ({
          ujian_id: h.ujianId,
          peserta_id: h.pesertaId,
          nilai_diagnostik: h.nilaiDiagnostik || 0,
          nilai_tpu: h.nilaiTpu || 0,
          nilai_diniyyah: h.nilaiDiniyyah || 0,
          nilai_akhir: h.nilaiTotal || 0,
          status_kelulusan: h.statusKelulusan || 'LULUS',
          waktu_selesai: new Date().toISOString(),
        })),
        { onConflict: 'ujian_id,peserta_id' }
      )
    ).catch((err) => {
      console.warn('[cbtStorage] async hasil ujian sync warning:', err);
    });
  } catch (err: any) {
    console.warn('[cbtStorage] saveCbtHasilUjian error:', err?.message || err);
  }
}

export function deleteCbtHasilUjianLocal(id: string, pesertaId?: string): CbtHasilUjian[] {
  addDeletedHasilId(id, pesertaId);
  const current = getCbtHasilUjian();
  const updated = current.filter(
    (h) => h.id !== id && (!pesertaId || h.pesertaId !== pesertaId)
  );
  safeSetItem(CBT_KEYS.HASIL, JSON.stringify(updated));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('cbt_hasil_updated', {
        detail: { deletedId: id, pesertaId },
      })
    );
  }
  return updated;
}

export function deleteAllCbtHasilUjianLocal(): void {
  const current = getCbtHasilUjian();
  current.forEach((h) => addDeletedHasilId(h.id, h.pesertaId));
  safeSetItem(CBT_KEYS.HASIL, JSON.stringify([]));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('cbt_hasil_updated', {
        detail: { deleteAll: true },
      })
    );
  }
}

export function getCbtLogUjian(): CbtLogUjian[] {
  const data = safeGetItem(CBT_KEYS.LOG);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveCbtLogUjian(logList: CbtLogUjian[]): void {
  safeSetItem(CBT_KEYS.LOG, JSON.stringify(logList));
}

export function updateCbtSingleLog(logItem: CbtLogUjian): void {
  const list = getCbtLogUjian();
  const index = list.findIndex(l => l.ujianId === logItem.ujianId && l.pesertaId === logItem.pesertaId);
  if (index >= 0) {
    list[index] = { ...list[index], ...logItem, updatedAt: new Date().toISOString() };
  } else {
    list.push({ ...logItem, updatedAt: new Date().toISOString() });
  }
  saveCbtLogUjian(list);
}

// --------------------------------------------------------------------
// EXAM SESSION PERSISTENCE & AUTO-SAVE
// --------------------------------------------------------------------

export function getCbtExamSession(ujianId: string, pesertaId: string): CbtExamSession | null {
  const key = `${CBT_KEYS.SESSION_PREFIX}${ujianId}_${pesertaId}`;
  const data = safeGetItem(key);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function saveCbtExamSession(session: CbtExamSession): void {
  const key = `${CBT_KEYS.SESSION_PREFIX}${session.ujianId}_${session.pesertaId}`;
  safeSetItem(key, JSON.stringify(session));

  // Auto-update live monitoring log
  const answeredCount = Object.keys(session.answers).length;
  updateCbtSingleLog({
    ujianId: session.ujianId,
    pesertaId: session.pesertaId,
    namaPeserta: session.pesertaId,
    nomorSoalTerakhir: session.currentIndex + 1,
    sisaWaktuDetik: session.remainingTimeSeconds,
    statusOnline: 'ONLINE',
    isSubmitted: session.isCompleted,
    updatedAt: new Date().toISOString(),
  });
}

export function clearCbtExamSession(ujianId: string, pesertaId: string): void {
  const key = `${CBT_KEYS.SESSION_PREFIX}${ujianId}_${pesertaId}`;
  safeRemoveItem(key);
}

// Helper to shuffle array randomly
export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
