// =====================================================================
// src/utils/bamPricing.ts
// Single Source of Truth untuk Struktur Biaya Awal Masuk (BAM)
// SPMB SMPS Al-Hadiid Cileungsi
//
// ATURAN PENTING:
// - Supabase adalah Single Source of Truth
// - Nominal BAM Ikhwan dan Akhwat dipisahkan secara ketat
// - Nominal BAM TIDAK di-hardcode bila data dari upload/Supabase tersedia
// - Sisa Tunggakan = Total BAM - Total Pembayaran
// - Status Pembayaran: BELUM BAYAR | SEBAGIAN | LUNAS
// =====================================================================

import { StudentData, BamItem, BamGender, BamInstallmentType, BamPaymentStatus } from '../types';
import { fetchBamItemsFromSupabase, saveBamItemsToSupabase } from './supabaseClient';

export interface BamBreakdownItem {
  id: string;
  name: string;
  amountInternal: number;
  amountExternal: number;
  period: 'Sekali' | 'Per Tahun' | 'Per Bulan';
  notes: string;
}

export interface BamInstallmentStep {
  step: number;
  title: string;
  amountInternal: number;
  amountExternal: number;
  dueDate: string;
  notes: string;
}

// Fallback seed items jika database kosong saat instalasi awal (13 Komponen Resmi SK BAM SPMB SMP Al-Hadiid)
export const DEFAULT_BAM_ITEMS_IKHWAN: BamItem[] = [
  { id: 'bam_ikhwan_1', gender: 'ikhwan', nama_item: 'Dana Awal Pendidikan (DAP)', nominal: 4250000, urutan: 1, aktif: true, keterangan: 'Dana sarana, prasarana, fasilitas pembelajaran & pengembangan pendidikan awal santri' },
  { id: 'bam_ikhwan_2', gender: 'ikhwan', nama_item: 'Dana Praktik Komputer', nominal: 150000, urutan: 2, aktif: true, keterangan: 'Praktikum lab komputer, multimedia, dan literasi digital santri' },
  { id: 'bam_ikhwan_3', gender: 'ikhwan', nama_item: 'Dana Praktik IPA', nominal: 100000, urutan: 3, aktif: true, keterangan: 'Praktikum laboratorium sains dan eksperimen IPA terpadu' },
  { id: 'bam_ikhwan_4', gender: 'ikhwan', nama_item: 'Perlengkapan / Seragam (Paket)*', nominal: 700000, urutan: 4, aktif: true, keterangan: 'Paket seragam lengkap Ikhwan (Putih Biru, Biru Tosca, Pramuka, Olahraga)' },
  { id: 'bam_ikhwan_5', gender: 'ikhwan', nama_item: 'Dana Penyelenggaraan Pendidikan (DPP / SPP)', nominal: 425000, urutan: 5, aktif: true, keterangan: 'Iuran penyelenggaraan pendidikan (SPP) bulan pertama (Juli)' },
  { id: 'bam_ikhwan_6', gender: 'ikhwan', nama_item: 'Tabungan Wajib', nominal: 25000, urutan: 6, aktif: true, keterangan: 'Tabungan wajib santri bulan pertama' },
  { id: 'bam_ikhwan_7', gender: 'ikhwan', nama_item: 'MPLS / MOS', nominal: 100000, urutan: 7, aktif: true, keterangan: 'Masa Pengenalan Lingkungan Sekolah & Orientasi Santri Rabbani' },
  { id: 'bam_ikhwan_8', gender: 'ikhwan', nama_item: 'Dana Sosial', nominal: 25000, urutan: 8, aktif: true, keterangan: 'Dana sosial santri, infak dan kepedulian umat' },
  { id: 'bam_ikhwan_9', gender: 'ikhwan', nama_item: 'Penilaian Akhir Semester (PAS)', nominal: 220000, urutan: 9, aktif: true, keterangan: 'Penyelenggaraan evaluasi dan Penilaian Akhir Semester 1' },
  { id: 'bam_ikhwan_10', gender: 'ikhwan', nama_item: 'Penilaian Akhir Tahun (PAT)', nominal: 225000, urutan: 10, aktif: true, keterangan: 'Penyelenggaraan evaluasi dan Penilaian Akhir Tahun' },
  { id: 'bam_ikhwan_11', gender: 'ikhwan', nama_item: 'Kegiatan Ekstrakurikuler / AMBAP', nominal: 125000, urutan: 11, aktif: true, keterangan: 'Kegiatan ekstrakurikuler wajib & kepanduan pramuka SIT / AMBAP' },
  { id: 'bam_ikhwan_12', gender: 'ikhwan', nama_item: 'Biaya Dauroh (Kegiatan Pesantren)', nominal: 120000, urutan: 12, aktif: true, keterangan: 'Dauroh Al-Qur\'an, tarbiyah ruhiyah, dan kepesantrenan santri' },
  { id: 'bam_ikhwan_13', gender: 'ikhwan', nama_item: 'Biaya Cetak (Raport, Foto, Name Tag, Kalender)', nominal: 205000, urutan: 13, aktif: true, keterangan: 'Buku raport kurikulum merdeka, pas foto kartu pelajar, name tag & kalender sekolah' },
];

export const DEFAULT_BAM_ITEMS_AKHWAT: BamItem[] = [
  { id: 'bam_akhwat_1', gender: 'akhwat', nama_item: 'Dana Awal Pendidikan (DAP)', nominal: 4250000, urutan: 1, aktif: true, keterangan: 'Dana sarana, prasarana, fasilitas pembelajaran & pengembangan pendidikan awal santriwati' },
  { id: 'bam_akhwat_2', gender: 'akhwat', nama_item: 'Dana Praktik Komputer', nominal: 150000, urutan: 2, aktif: true, keterangan: 'Praktikum lab komputer, multimedia, dan literasi digital santriwati' },
  { id: 'bam_akhwat_3', gender: 'akhwat', nama_item: 'Dana Praktik IPA', nominal: 100000, urutan: 3, aktif: true, keterangan: 'Praktikum laboratorium sains dan eksperimen IPA terpadu' },
  { id: 'bam_akhwat_4', gender: 'akhwat', nama_item: 'Perlengkapan / Seragam (Paket)*', nominal: 920000, urutan: 4, aktif: true, keterangan: 'Paket seragam lengkap Akhwat + Jilbab Syar\'i (Putih Biru, Biru Tosca, Pramuka, Olahraga)' },
  { id: 'bam_akhwat_5', gender: 'akhwat', nama_item: 'Dana Penyelenggaraan Pendidikan (DPP / SPP)', nominal: 425000, urutan: 5, aktif: true, keterangan: 'Iuran penyelenggaraan pendidikan (SPP) bulan pertama (Juli)' },
  { id: 'bam_akhwat_6', gender: 'akhwat', nama_item: 'Tabungan Wajib', nominal: 25000, urutan: 6, aktif: true, keterangan: 'Tabungan wajib santriwati bulan pertama' },
  { id: 'bam_akhwat_7', gender: 'akhwat', nama_item: 'MPLS / MOS', nominal: 100000, urutan: 7, aktif: true, keterangan: 'Masa Pengenalan Lingkungan Sekolah & Orientasi Santriwati Rabbani' },
  { id: 'bam_akhwat_8', gender: 'akhwat', nama_item: 'Dana Sosial', nominal: 25000, urutan: 8, aktif: true, keterangan: 'Dana sosial santriwati, infak dan kepedulian umat' },
  { id: 'bam_akhwat_9', gender: 'akhwat', nama_item: 'Penilaian Akhir Semester (PAS)', nominal: 220000, urutan: 9, aktif: true, keterangan: 'Penyelenggaraan evaluasi dan Penilaian Akhir Semester 1' },
  { id: 'bam_akhwat_10', gender: 'akhwat', nama_item: 'Penilaian Akhir Tahun (PAT)', nominal: 225000, urutan: 10, aktif: true, keterangan: 'Penyelenggaraan evaluasi dan Penilaian Akhir Tahun' },
  { id: 'bam_akhwat_11', gender: 'akhwat', nama_item: 'Kegiatan Ekstrakurikuler / AMBAP', nominal: 125000, urutan: 11, aktif: true, keterangan: 'Kegiatan keputrian, ekstrakurikuler wajib & kepanduan pramuka SIT' },
  { id: 'bam_akhwat_12', gender: 'akhwat', nama_item: 'Biaya Dauroh (Kegiatan Pesantren)', nominal: 120000, urutan: 12, aktif: true, keterangan: 'Dauroh Al-Qur\'an, tarbiyah ruhiyah, dan kepesantrenan santriwati' },
  { id: 'bam_akhwat_13', gender: 'akhwat', nama_item: 'Biaya Cetak (Raport, Foto, Name Tag, Kalender)', nominal: 205000, urutan: 13, aktif: true, keterangan: 'Buku raport kurikulum merdeka, pas foto kartu pelajar, name tag & kalender sekolah' },
];

const LOCAL_STORAGE_KEY_IKHWAN = 'spmb_alhadiid_bam_items_ikhwan_v3';
const LOCAL_STORAGE_KEY_AKHWAT = 'spmb_alhadiid_bam_items_akhwat_v3';

// In-memory cache for fast synchronous access
let cachedIkhwanItems: BamItem[] = [];
let cachedAkhwatItems: BamItem[] = [];

// Inisialisasi awal dari LocalStorage jika ada (dan validasi tidak menggunakan nominal usang >10M)
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const rawIkhwan = window.localStorage.getItem(LOCAL_STORAGE_KEY_IKHWAN);
    if (rawIkhwan) {
      const parsed = JSON.parse(rawIkhwan);
      const sum = Array.isArray(parsed) ? parsed.reduce((a, b) => a + (Number(b.nominal) || 0), 0) : 0;
      if (sum <= 8000000 && parsed.length >= 10) {
        cachedIkhwanItems = parsed;
      }
    }
    const rawAkhwat = window.localStorage.getItem(LOCAL_STORAGE_KEY_AKHWAT);
    if (rawAkhwat) {
      const parsed = JSON.parse(rawAkhwat);
      const sum = Array.isArray(parsed) ? parsed.reduce((a, b) => a + (Number(b.nominal) || 0), 0) : 0;
      if (sum <= 8000000 && parsed.length >= 10) {
        cachedAkhwatItems = parsed;
      }
    }
  } catch (e) {
    console.warn('[BAM] Error initializing cache from localStorage:', e);
  }
}

if (cachedIkhwanItems.length === 0) cachedIkhwanItems = [...DEFAULT_BAM_ITEMS_IKHWAN];
if (cachedAkhwatItems.length === 0) cachedAkhwatItems = [...DEFAULT_BAM_ITEMS_AKHWAT];

/**
 * Menghitung total akumulasi dari daftar item BAM aktif
 */
export function calculateTotalFromItems(items: BamItem[]): number {
  if (!items || !Array.isArray(items)) return 0;
  return items
    .filter(it => it.aktif !== false)
    .reduce((acc, it) => acc + (Number(it.nominal) || 0), 0);
}

/**
 * Mendapatkan daftar item BAM ter-cache sesuai gender
 */
export function getLoadedBamItems(gender: BamGender | string): BamItem[] {
  const isAkhwat = String(gender).toLowerCase().includes('perempuan') || String(gender).toLowerCase() === 'akhwat';
  return isAkhwat ? cachedAkhwatItems : cachedIkhwanItems;
}

/**
 * Memperbarui cache lokal dan localStorage untuk gender tertentu
 */
export function setLoadedBamItems(gender: BamGender, items: BamItem[]): void {
  if (gender === 'akhwat') {
    cachedAkhwatItems = [...items];
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LOCAL_STORAGE_KEY_AKHWAT, JSON.stringify(items));
    }
  } else {
    cachedIkhwanItems = [...items];
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LOCAL_STORAGE_KEY_IKHWAN, JSON.stringify(items));
    }
  }
}

/**
 * Mengambil data BAM resmi langsung dari Supabase dan memperbarui cache in-memory & localStorage.
 * Jika Supabase masih menyimpan data lama (> 10M), secara otomatis diperbarui ke skema 13 item resmi.
 */
export async function fetchAndCacheBamItems(): Promise<{ ikhwan: BamItem[]; akhwat: BamItem[] }> {
  try {
    const res = await fetchBamItemsFromSupabase();
    let ikhwanToSet = res.ikhwan;
    let akhwatToSet = res.akhwat;

    // Deteksi jika data Supabase kosong atau data usang (> 10 Juta atau item <= 7)
    const ikhwanSum = calculateTotalFromItems(ikhwanToSet);
    const akhwatSum = calculateTotalFromItems(akhwatToSet);

    if (!ikhwanToSet || ikhwanToSet.length <= 7 || ikhwanSum > 8000000) {
      ikhwanToSet = [...DEFAULT_BAM_ITEMS_IKHWAN];
      saveBamItemsToSupabase('ikhwan', ikhwanToSet).catch(() => {});
    }
    if (!akhwatToSet || akhwatToSet.length <= 7 || akhwatSum > 8000000) {
      akhwatToSet = [...DEFAULT_BAM_ITEMS_AKHWAT];
      saveBamItemsToSupabase('akhwat', akhwatToSet).catch(() => {});
    }

    setLoadedBamItems('ikhwan', ikhwanToSet);
    setLoadedBamItems('akhwat', akhwatToSet);

    return {
      ikhwan: getLoadedBamItems('ikhwan'),
      akhwat: getLoadedBamItems('akhwat'),
    };
  } catch (err) {
    console.warn('[BAM] fetchAndCacheBamItems warning:', err);
    return {
      ikhwan: getLoadedBamItems('ikhwan'),
      akhwat: getLoadedBamItems('akhwat'),
    };
  }
}

/**
 * Menentukan gender standar 'ikhwan' atau 'akhwat' dari data siswa/string
 */
export function normalizeBamGender(genderOrStudent?: any): BamGender {
  if (!genderOrStudent) return 'ikhwan';
  if (typeof genderOrStudent === 'string') {
    const s = genderOrStudent.toLowerCase();
    if (s.includes('perempuan') || s.includes('akhwat') || s === 'p') return 'akhwat';
    return 'ikhwan';
  }
  const s = String(genderOrStudent.gender || '').toLowerCase();
  if (s.includes('perempuan') || s.includes('akhwat') || s === 'p') return 'akhwat';
  return 'ikhwan';
}

/**
 * Mendapatkan Total Tagihan BAM spesifik sesuai data upload/Supabase untuk gender calon murid.
 * IKHWAN dan AKHWAT dihitung dari item BAM aktif masing-masing gender.
 */
export function getTotalBamCost(categoryOrStudent?: 'Internal' | 'Eksternal' | Partial<StudentData> | string | null): number {
  if (!categoryOrStudent) {
    return calculateTotalFromItems(cachedIkhwanItems);
  }

  // Jika input berupa student object
  if (typeof categoryOrStudent === 'object') {
    const gender = normalizeBamGender(categoryOrStudent);
    const items = getLoadedBamItems(gender);
    return calculateTotalFromItems(items);
  }

  // Jika string mengindikasikan gender
  const str = String(categoryOrStudent).toLowerCase();
  if (str.includes('perempuan') || str.includes('akhwat')) {
    return calculateTotalFromItems(cachedAkhwatItems);
  }
  if (str.includes('laki') || str.includes('ikhwan')) {
    return calculateTotalFromItems(cachedIkhwanItems);
  }

  // Fallback ke ikhwan default
  return calculateTotalFromItems(cachedIkhwanItems);
}

/**
 * Menghitung sisa saldo / tunggakan BAM
 * Sisa = Total BAM - Total Pembayaran
 */
export function calculateBamRemaining(totalCost: number, totalPaid: number): number {
  return Math.max(0, (totalCost || 0) - (totalPaid || 0));
}

/**
 * Menentukan status BAM sesuai spesifikasi (BELUM BAYAR | SEBAGIAN | LUNAS)
 */
export function getBamPaymentStatus(totalCost: number, amountPaid: number): 'BELUM BAYAR' | 'SEBAGIAN' | 'LUNAS' {
  if (!amountPaid || amountPaid <= 0) return 'BELUM BAYAR';
  if (amountPaid >= totalCost) return 'LUNAS';
  return 'SEBAGIAN';
}

/**
 * Menentukan status angsuran BAM (Kompatibilitas tampilan cicilan)
 */
export function getBamInstallmentType(totalCost: number, amountPaid: number, _category: 'Internal' | 'Eksternal' = 'Eksternal'): string {
  if (amountPaid <= 0) return 'Belum Bayar';
  if (amountPaid >= totalCost) return 'Lunas';
  const ratio = totalCost > 0 ? amountPaid / totalCost : 0;
  if (ratio >= 0.66) return 'Cicilan 2';
  if (ratio >= 0.33) return 'Cicilan 1';
  return 'Sebagian';
}

/**
 * Backward compatibility helpers
 */
export function getStudentCategory(student?: any): 'Internal' | 'Eksternal' {
  if (!student) return 'Eksternal';
  if ((student as any).category === 'Internal' || (student as any).category === 'internal') return 'Internal';
  if ((student as any).category === 'Eksternal' || (student as any).category === 'eksternal') return 'Eksternal';

  const entry = (student.entryPath || '').toLowerCase();
  if (entry.includes('internal') || entry.includes('al-hadiid') || entry.includes('alhadiid')) {
    return 'Internal';
  }

  const prev = (student.previousSchoolName || student.previousSchool || '').toLowerCase();
  if (prev.includes('al-hadiid') || prev.includes('alhadiid') || prev.includes('al hadiid')) {
    return 'Internal';
  }

  return 'Eksternal';
}

export const BAM_CONFIG = {
  get totalInternal() {
    return calculateTotalFromItems(cachedIkhwanItems);
  },
  get totalExternal() {
    return calculateTotalFromItems(cachedAkhwatItems);
  },
  lunasDiscount: 0,
  get totalInternalLunas() {
    return calculateTotalFromItems(cachedIkhwanItems);
  },
  get totalExternalLunas() {
    return calculateTotalFromItems(cachedAkhwatItems);
  },
};

export const BAM_BREAKDOWN_ITEMS: BamBreakdownItem[] = DEFAULT_BAM_ITEMS_IKHWAN.map((it, idx) => {
  const akhwatMatch = DEFAULT_BAM_ITEMS_AKHWAT[idx];
  return {
    id: it.id,
    name: it.nama_item,
    amountInternal: it.nominal,
    amountExternal: akhwatMatch ? akhwatMatch.nominal : it.nominal,
    period: (it.nama_item.includes('DPP') || it.nama_item.includes('Tabungan'))
      ? 'Per Bulan'
      : (it.nama_item.includes('DAP') || it.nama_item.includes('Seragam') || it.nama_item.includes('MPLS'))
      ? 'Sekali'
      : 'Per Tahun',
    notes: it.keterangan || '',
  };
});

export const BAM_INSTALLMENT_STEPS: BamInstallmentStep[] = [
  {
    step: 1,
    title: 'Tahap 1: DP Awal (Saat Daftar Ulang)',
    amountInternal: 4000000,
    amountExternal: 4000000,
    dueDate: 'Saat daftar ulang dinyatakan lulus',
    notes: 'Penguncian kursi santri, pengukuran seragam & administrasi awal',
  },
  {
    step: 2,
    title: 'Tahap 2: Pelunasan Sisa Biaya BAM',
    amountInternal: 2670000,
    amountExternal: 2890000,
    dueDate: 'Paling lambat 30 Oktober 2027',
    notes: 'Pelunasan sisa tagihan BAM (Ikhwan: Rp 2.670.000 / Akhwat: Rp 2.890.000)',
  },
];
