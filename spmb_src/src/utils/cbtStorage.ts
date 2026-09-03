import { CbtKategori, CbtSoal, CbtUjian, CbtJawabanPeserta, CbtHasilUjian, CbtLogUjian, CbtExamSession } from '../types';
import { supabase } from './supabaseClient';

const CBT_KEYS = {
  KATEGORI: 'spmb_cbt_kategori',
  SOAL: 'spmb_cbt_soal',
  UJIAN: 'spmb_cbt_ujian',
  JAWABAN: 'spmb_cbt_jawaban',
  HASIL: 'spmb_cbt_hasil',
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
  const data = localStorage.getItem(CBT_KEYS.KATEGORI);
  if (!data) {
    localStorage.setItem(CBT_KEYS.KATEGORI, JSON.stringify(DEFAULT_CBT_KATEGORI));
    return DEFAULT_CBT_KATEGORI;
  }
  try {
    return JSON.parse(data);
  } catch {
    return DEFAULT_CBT_KATEGORI;
  }
}

export function saveCbtKategori(kategoriList: CbtKategori[]): void {
  localStorage.setItem(CBT_KEYS.KATEGORI, JSON.stringify(kategoriList));
}

export function getCbtSoal(): CbtSoal[] {
  const data = localStorage.getItem(CBT_KEYS.SOAL);
  if (!data) {
    localStorage.setItem(CBT_KEYS.SOAL, JSON.stringify(DEFAULT_CBT_SOAL));
    return DEFAULT_CBT_SOAL;
  }
  try {
    return JSON.parse(data);
  } catch {
    return DEFAULT_CBT_SOAL;
  }
}

export function saveCbtSoal(soalList: CbtSoal[]): void {
  localStorage.setItem(CBT_KEYS.SOAL, JSON.stringify(soalList));
}

export function getCbtUjian(): CbtUjian[] {
  const data = localStorage.getItem(CBT_KEYS.UJIAN);
  if (!data) {
    localStorage.setItem(CBT_KEYS.UJIAN, JSON.stringify(DEFAULT_CBT_UJIAN));
    return DEFAULT_CBT_UJIAN;
  }
  try {
    return JSON.parse(data);
  } catch {
    return DEFAULT_CBT_UJIAN;
  }
}

export function saveCbtUjian(ujianList: CbtUjian[]): void {
  localStorage.setItem(CBT_KEYS.UJIAN, JSON.stringify(ujianList));
}

export function getCbtHasilUjian(): CbtHasilUjian[] {
  const data = localStorage.getItem(CBT_KEYS.HASIL);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveCbtHasilUjian(hasilList: CbtHasilUjian[]): void {
  localStorage.setItem(CBT_KEYS.HASIL, JSON.stringify(hasilList));
  // Try syncing to Supabase if available
  try {
    Promise.resolve(
      supabase.from('hasil_ujian').upsert(
        hasilList.map(h => ({
          id: h.id,
          ujian_id: h.ujianId,
          peserta_id: h.pesertaId,
          registration_number: h.registrationNumber,
          nama_peserta: h.namaPeserta,
          nilai_diagnostik: h.nilaiDiagnostik,
          nilai_tpu: h.nilaiTpu,
          nilai_diniyyah: h.nilaiDiniyyah,
          nilai_total: h.nilaiTotal,
          status_kelulusan: h.statusKelulusan,
          ranking: h.ranking,
          tanggal_ujian: h.tanggalUjian,
        })),
        { onConflict: 'id' }
      )
    ).catch(() => {});
  } catch {}
}

export function getCbtLogUjian(): CbtLogUjian[] {
  const data = localStorage.getItem(CBT_KEYS.LOG);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveCbtLogUjian(logList: CbtLogUjian[]): void {
  localStorage.setItem(CBT_KEYS.LOG, JSON.stringify(logList));
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
  const data = localStorage.getItem(key);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function saveCbtExamSession(session: CbtExamSession): void {
  const key = `${CBT_KEYS.SESSION_PREFIX}${session.ujianId}_${session.pesertaId}`;
  localStorage.setItem(key, JSON.stringify(session));

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
  localStorage.removeItem(key);
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
