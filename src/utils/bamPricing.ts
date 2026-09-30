// =====================================================================
// src/utils/bamPricing.ts
// Single Source of Truth untuk Struktur Biaya Awal Masuk (BAM)
// SMP Al-Hadiid Cileungsi
// Sesuai Dokumen & Brosur Resmi:
// Total BAM: Rp 11.000.000 (Internal) / Rp 12.000.000 (Eksternal)
// =====================================================================

import { StudentData } from '../types';

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

export const BAM_CONFIG = {
  totalInternal: 11000000,
  totalExternal: 12000000,
  lunasDiscount: 500000,
  totalInternalLunas: 10500000, // Diskon lunas Rp 500.000
  totalExternalLunas: 11500000, // Diskon lunas Rp 500.000
};

/**
 * 6 Rincian Komponen Resmi Biaya Awal Masuk (BAM)
 */
export const BAM_BREAKDOWN_ITEMS: BamBreakdownItem[] = [
  {
    id: 'bam-1',
    name: 'Dana Sarana & Prasarana',
    amountInternal: 4500000,
    amountExternal: 5500000,
    period: 'Sekali',
    notes: 'Pengembangan sarana prasarana, lab multimedia, dan fasilitas pembelajaran digital',
  },
  {
    id: 'bam-2',
    name: 'Paket Seragam Lengkap (5 Stel)',
    amountInternal: 1500000,
    amountExternal: 1500000,
    period: 'Sekali',
    notes: 'Putih Biru, Pramuka, Batik Khas Al-Hadiid, Kaos Olahraga, Busana Muslim/Gamis Al-Hadiid',
  },
  {
    id: 'bam-3',
    name: 'Buku Paket & Modul Pembelajaran (1 Tahun)',
    amountInternal: 1600000,
    amountExternal: 1600000,
    period: 'Per Tahun',
    notes: 'Buku teks kurikulum nasional, modul keislaman, Al-Qur\'an tahfidz dan kalender akademik',
  },
  {
    id: 'bam-4',
    name: 'Kegiatan MPLS & Penguatan Karakter Rabbani',
    amountInternal: 500000,
    amountExternal: 500000,
    period: 'Sekali',
    notes: 'Masa Pengenalan Lingkungan Sekolah, orientasi kurikulum salafush sholih & asesmen awal',
  },
  {
    id: 'bam-5',
    name: 'Ekstrakurikuler Wajib & Pilihan (1 Tahun)',
    amountInternal: 600000,
    amountExternal: 600000,
    period: 'Per Tahun',
    notes: 'Tahfidz intensif, Pramuka SIT, Panahan, Futsal, Pencak Silat, English/Arabic Club',
  },
  {
    id: 'bam-6',
    name: 'SPP Bulan Pertama (Bulan Juli)',
    amountInternal: 800000,
    amountExternal: 800000,
    period: 'Per Bulan',
    notes: 'Iuran penyelenggaraan pendidikan bulan pertama tahun pelajaran berjalan',
  },
  {
    id: 'bam-7',
    name: 'Kegiatan Kesiswaan, Keputrian & Dauroh Qur\'an',
    amountInternal: 1500000,
    amountExternal: 1500000,
    period: 'Per Tahun',
    notes: 'Pesantren kilat, dauroh Al-Qur\'an, mukhayyam tarbawi & evaluasi semester (PAS/PAT)',
  },
];

/**
 * Skema Angsuran Pembayaran BAM (3 Kali Cicilan)
 */
export const BAM_INSTALLMENT_STEPS: BamInstallmentStep[] = [
  {
    step: 1,
    title: 'Tahap 1 (Saat Daftar Ulang)',
    amountInternal: 5000000,
    amountExternal: 6000000,
    dueDate: 'Saat daftar ulang dinyatakan lulus',
    notes: 'Penguncian kursi santri, pengukuran seragam & alokasi buku paket',
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

/**
 * Menentukan kategori siswa (Internal SD Al-Hadiid vs Eksternal Umum)
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

/**
 * Mendapatkan Total Tagihan BAM standar berdasarkan kategori siswa
 */
export function getTotalBamCost(categoryOrStudent?: 'Internal' | 'Eksternal' | Partial<StudentData> | null): number {
  let cat: 'Internal' | 'Eksternal' = 'Eksternal';
  if (typeof categoryOrStudent === 'string') {
    cat = categoryOrStudent === 'Internal' ? 'Internal' : 'Eksternal';
  } else if (categoryOrStudent) {
    cat = getStudentCategory(categoryOrStudent);
  }
  return cat === 'Internal' ? BAM_CONFIG.totalInternal : BAM_CONFIG.totalExternal;
}

/**
 * Menghitung sisa saldo tagihan (outstanding balance)
 */
export function calculateBamRemaining(totalCost: number, totalPaid: number): number {
  return Math.max(0, totalCost - totalPaid);
}

/**
 * Menentukan status angsuran BAM secara otomatis
 */
export function getBamInstallmentType(totalCost: number, amountPaid: number, category: 'Internal' | 'Eksternal' = 'Eksternal'): string {
  if (amountPaid <= 0) return 'Belum Bayar';
  
  // Jika mencapai atau melebihi biaya lunas (dengan atau tanpa diskon lunas)
  const lunasThreshold = category === 'Internal' ? BAM_CONFIG.totalInternalLunas : BAM_CONFIG.totalExternalLunas;
  if (amountPaid >= totalCost || amountPaid >= lunasThreshold) {
    return 'Lunas';
  }

  const step1 = category === 'Internal' ? BAM_INSTALLMENT_STEPS[0].amountInternal : BAM_INSTALLMENT_STEPS[0].amountExternal;
  const step2 = step1 + (category === 'Internal' ? BAM_INSTALLMENT_STEPS[1].amountInternal : BAM_INSTALLMENT_STEPS[1].amountExternal);

  if (amountPaid >= step2) {
    return 'Cicilan 2';
  }
  if (amountPaid >= step1) {
    return 'Cicilan 1';
  }

  return 'DP (Sebagian)';
}
