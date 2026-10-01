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

// Fallback seed items jika database kosong saat instalasi awal
export const DEFAULT_BAM_ITEMS_IKHWAN: BamItem[] = [
  { id: 'bam_ikhwan_1', gender: 'ikhwan', nama_item: 'Dana Pengembangan Sarana & Prasarana', nominal: 4500000, urutan: 1, aktif: true, keterangan: 'Pengembangan sarana prasarana, lab multimedia, dan fasilitas pembelajaran digital' },
  { id: 'bam_ikhwan_2', gender: 'ikhwan', nama_item: 'Paket Seragam Lengkap Ikhwan (5 Stel)', nominal: 1500000, urutan: 2, aktif: true, keterangan: 'Putih Biru, Pramuka, Batik Khas Al-Hadiid, Kaos Olahraga, Busana Muslim' },
  { id: 'bam_ikhwan_3', gender: 'ikhwan', nama_item: 'Buku Paket & Modul Pembelajaran (1 Tahun)', nominal: 1600000, urutan: 3, aktif: true, keterangan: 'Buku teks kurikulum nasional, modul keislaman, Al-Qur\'an tahfidz' },
  { id: 'bam_ikhwan_4', gender: 'ikhwan', nama_item: 'Kegiatan MPLS & Orientasi Santri Rabbani', nominal: 500000, urutan: 4, aktif: true, keterangan: 'Masa Pengenalan Lingkungan Sekolah, asesmen awal karakter santri' },
  { id: 'bam_ikhwan_5', gender: 'ikhwan', nama_item: 'Ekstrakurikuler Wajib & Pilihan (1 Tahun)', nominal: 600000, urutan: 5, aktif: true, keterangan: 'Tahfidz intensif, Pramuka SIT, Panahan, Futsal, Silat, Bahasa' },
  { id: 'bam_ikhwan_6', gender: 'ikhwan', nama_item: 'SPP Bulan Pertama (Juli)', nominal: 800000, urutan: 6, aktif: true, keterangan: 'Iuran penyelenggaraan pendidikan bulan pertama tahun pelajaran berjalan' },
  { id: 'bam_ikhwan_7', gender: 'ikhwan', nama_item: 'Kegiatan Kesiswaan, Kepesantrenan & Dauroh Qur\'an', nominal: 1500000, urutan: 7, aktif: true, keterangan: 'Pesantren kilat, dauroh Al-Qur\'an, mukhayyam tarbawi & evaluasi semester' },
];

export const DEFAULT_BAM_ITEMS_AKHWAT: BamItem[] = [
  { id: 'bam_akhwat_1', gender: 'akhwat', nama_item: 'Dana Pengembangan Sarana & Prasarana', nominal: 4500000, urutan: 1, aktif: true, keterangan: 'Pengembangan sarana prasarana, lab multimedia, dan fasilitas pembelajaran digital' },
  { id: 'bam_akhwat_2', gender: 'akhwat', nama_item: 'Paket Seragam Lengkap Akhwat + Jilbab Syar\'i (5 Stel)', nominal: 1720000, urutan: 2, aktif: true, keterangan: 'Putih Biru + Jilbab, Pramuka, Batik Al-Hadiid, Kaos Olahraga, Gamis Muslimah' },
  { id: 'bam_akhwat_3', gender: 'akhwat', nama_item: 'Buku Paket & Modul Pembelajaran (1 Tahun)', nominal: 1600000, urutan: 3, aktif: true, keterangan: 'Buku teks kurikulum nasional, modul keislaman, Al-Qur\'an tahfidz' },
  { id: 'bam_akhwat_4', gender: 'akhwat', nama_item: 'Kegiatan MPLS & Orientasi Santri Rabbani', nominal: 500000, urutan: 4, aktif: true, keterangan: 'Masa Pengenalan Lingkungan Sekolah, asesmen awal karakter santri' },
  { id: 'bam_akhwat_5', gender: 'akhwat', nama_item: 'Ekstrakurikuler Wajib & Keputrian (1 Tahun)', nominal: 600000, urutan: 5, aktif: true, keterangan: 'Tahfidz intensif, Pramuka SIT, Keputrian, Seni Kaligrafi, Bahasa' },
  { id: 'bam_akhwat_6', gender: 'akhwat', nama_item: 'SPP Bulan Pertama (Juli)', nominal: 800000, urutan: 6, aktif: true, keterangan: 'Iuran penyelenggaraan pendidikan bulan pertama tahun pelajaran berjalan' },
  { id: 'bam_akhwat_7', gender: 'akhwat', nama_item: 'Kegiatan Keputrian, Tarbiyah & Dauroh Tahfidz', nominal: 1500000, urutan: 7, aktif: true, keterangan: 'Keputrian intensif, dauroh Al-Qur\'an santriwati, tarbiyah ruhiyah' },
];

const LOCAL_STORAGE_KEY_IKHWAN = 'spmb_alhadiid_bam_items_ikhwan_v2';
const LOCAL_STORAGE_KEY_AKHWAT = 'spmb_alhadiid_bam_items_akhwat_v2';

// In-memory cache for fast synchronous access
let cachedIkhwanItems: BamItem[] = [];
let cachedAkhwatItems: BamItem[] = [];

// Inisialisasi awal dari LocalStorage jika ada
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const rawIkhwan = window.localStorage.getItem(LOCAL_STORAGE_KEY_IKHWAN);
    if (rawIkhwan) cachedIkhwanItems = JSON.parse(rawIkhwan);
    const rawAkhwat = window.localStorage.getItem(LOCAL_STORAGE_KEY_AKHWAT);
    if (rawAkhwat) cachedAkhwatItems = JSON.parse(rawAkhwat);
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
 */
export async function fetchAndCacheBamItems(): Promise<{ ikhwan: BamItem[]; akhwat: BamItem[] }> {
  try {
    const res = await fetchBamItemsFromSupabase();
    if (res.ikhwan && res.ikhwan.length > 0) {
      setLoadedBamItems('ikhwan', res.ikhwan);
    }
    if (res.akhwat && res.akhwat.length > 0) {
      setLoadedBamItems('akhwat', res.akhwat);
    }
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

export const BAM_BREAKDOWN_ITEMS: BamBreakdownItem[] = DEFAULT_BAM_ITEMS_IKHWAN.map(it => ({
  id: it.id,
  name: it.nama_item,
  amountInternal: it.nominal,
  amountExternal: it.nominal,
  period: 'Sekali',
  notes: it.keterangan || '',
}));

export const BAM_INSTALLMENT_STEPS: BamInstallmentStep[] = [
  {
    step: 1,
    title: 'Tahap 1 (Saat Daftar Ulang)',
    amountInternal: 5000000,
    amountExternal: 5000000,
    dueDate: 'Saat daftar ulang dinyatakan lulus',
    notes: 'Penguncian kursi santri & pengukuran seragam',
  },
  {
    step: 2,
    title: 'Tahap 2 (Sebelum Masuk Sekolah)',
    amountInternal: 3000000,
    amountExternal: 3000000,
    dueDate: '30 Juni 2027',
    notes: 'Pelunasan seragam, modul pelajaran, dan persiapan MPLS',
  },
  {
    step: 3,
    title: 'Tahap 3 (Sebelum Penilaian Akhir Semester 1)',
    amountInternal: 3000000,
    amountExternal: 3000000,
    dueDate: '30 Oktober 2027',
    notes: 'Pelunasan total sisa tagihan Biaya Awal Masuk (BAM)',
  },
];
