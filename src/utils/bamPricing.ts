// =====================================================================
// src/utils/bamPricing.ts
// Single Source of Truth untuk Struktur Biaya Awal Masuk (BAM)
// SMP Al-Hadiid Cileungsi
// Sesuai Dokumen & Brosur Resmi (Landing Page):
// Total BAM Ikhwan (Laki-laki): Rp 6.670.000
// Total BAM Akhwat (Perempuan): Rp 6.890.000
// =====================================================================

import { StudentData } from '../types';

export interface BamBreakdownItem {
  id: string;
  no?: number;
  name: string;
  amountIkhwan: number;
  amountAkhwat: number;
  amountInternal?: number;
  amountExternal?: number;
  period: 'Sekali' | 'Per Tahun' | 'Per Bulan';
  notes: string;
}

export interface BamInstallmentStep {
  step: number;
  title: string;
  amountInternal: number;
  amountExternal: number;
  amountIkhwan?: number;
  amountAkhwat?: number;
  dueDate: string;
  notes: string;
}

export const BAM_CONFIG = {
  totalIkhwan: 6670000,
  totalAkhwat: 6890000,
  totalInternal: 6670000, // backward compatibility
  totalExternal: 6890000, // backward compatibility
  lunasDiscount: 0,
  totalInternalLunas: 6670000,
  totalExternalLunas: 6890000,
};

/**
 * 13 Rincian Komponen Resmi Biaya Awal Masuk (BAM) Sesuai Landing Page & Brosur SK Resmi
 */
export const BAM_BREAKDOWN_ITEMS: BamBreakdownItem[] = [
  {
    id: 'bam-1',
    no: 1,
    name: 'Dana Awal Pendidikan (DAP)',
    amountIkhwan: 4250000,
    amountAkhwat: 4250000,
    amountInternal: 4250000,
    amountExternal: 4250000,
    period: 'Sekali',
    notes: 'Pengembangan sarana prasarana, lab multimedia, dan fasilitas pembelajaran digital',
  },
  {
    id: 'bam-2',
    no: 2,
    name: 'Dana Praktik Komputer',
    amountIkhwan: 150000,
    amountAkhwat: 150000,
    amountInternal: 150000,
    amountExternal: 150000,
    period: 'Per Tahun',
    notes: 'Praktik komputer, lab multimedia & literasi digital',
  },
  {
    id: 'bam-3',
    no: 3,
    name: 'Dana Praktik IPA',
    amountIkhwan: 100000,
    amountAkhwat: 100000,
    amountInternal: 100000,
    amountExternal: 100000,
    period: 'Per Tahun',
    notes: 'Praktikum sains IPA, eksperimen fisika dan biologi',
  },
  {
    id: 'bam-4',
    no: 4,
    name: 'Perlengkapan / Seragam (Paket)*',
    amountIkhwan: 700000,
    amountAkhwat: 920000,
    amountInternal: 700000,
    amountExternal: 920000,
    period: 'Sekali',
    notes: 'Ikhwan: Rp 700.000 (Koko/Celana) | Akhwat: Rp 920.000 (+ Gamis & Jilbab Rabbani)',
  },
  {
    id: 'bam-5',
    no: 5,
    name: 'Dana Penyelenggaraan Pendidikan (DPP / SPP)',
    amountIkhwan: 425000,
    amountAkhwat: 425000,
    amountInternal: 425000,
    amountExternal: 425000,
    period: 'Per Bulan',
    notes: 'Iuran SPP bulan pertama (Bulan Juli 2027)',
  },
  {
    id: 'bam-6',
    no: 6,
    name: 'Tabungan Wajib',
    amountIkhwan: 25000,
    amountAkhwat: 25000,
    amountInternal: 25000,
    amountExternal: 25000,
    period: 'Per Bulan',
    notes: 'Tabungan wajib santri bulan pertama',
  },
  {
    id: 'bam-7',
    no: 7,
    name: 'MPLS / MOS',
    amountIkhwan: 100000,
    amountAkhwat: 100000,
    amountInternal: 100000,
    amountExternal: 100000,
    period: 'Sekali',
    notes: 'Masa Pengenalan Lingkungan Sekolah & Orientasi Keislaman',
  },
  {
    id: 'bam-8',
    no: 8,
    name: 'Dana Sosial',
    amountIkhwan: 25000,
    amountAkhwat: 25000,
    amountInternal: 25000,
    amountExternal: 25000,
    period: 'Per Tahun',
    notes: 'Santunan sosial, ta\'awun dan kepedulian sesama',
  },
  {
    id: 'bam-9',
    no: 9,
    name: 'Penilaian Akhir Semester (PAS)',
    amountIkhwan: 220000,
    amountAkhwat: 220000,
    amountInternal: 220000,
    amountExternal: 220000,
    period: 'Per Tahun',
    notes: 'Pelaksanaan ujian asesmen semester ganjil',
  },
  {
    id: 'bam-10',
    no: 10,
    name: 'Penilaian Akhir Tahun (PAT)',
    amountIkhwan: 225000,
    amountAkhwat: 225000,
    amountInternal: 225000,
    amountExternal: 225000,
    period: 'Per Tahun',
    notes: 'Pelaksanaan ujian asesmen kenaikan kelas genap',
  },
  {
    id: 'bam-11',
    no: 11,
    name: 'Kegiatan Ekstrakurikuler / AMBAP',
    amountIkhwan: 125000,
    amountAkhwat: 125000,
    amountInternal: 125000,
    amountExternal: 125000,
    period: 'Per Tahun',
    notes: 'Pengembangan minat bakat, ekskul pilihan & wajib',
  },
  {
    id: 'bam-12',
    no: 12,
    name: 'Biaya Dauroh (Kegiatan Pesantren)',
    amountIkhwan: 120000,
    amountAkhwat: 120000,
    amountInternal: 120000,
    amountExternal: 120000,
    period: 'Per Tahun',
    notes: 'Pesantren kilat, dauroh Al-Qur\'an & pembinaan adab',
  },
  {
    id: 'bam-13',
    no: 13,
    name: 'Biaya Cetak (Raport, Foto, Name Tag, Kalender)',
    amountIkhwan: 205000,
    amountAkhwat: 205000,
    amountInternal: 205000,
    amountExternal: 205000,
    period: 'Per Tahun',
    notes: 'Pencetakan sampul raport, foto kartu pelajar, name tag & kalender sekolah',
  },
];

/**
 * Skema Angsuran Pembayaran BAM (3 Kali Cicilan)
 */
export const BAM_INSTALLMENT_STEPS: BamInstallmentStep[] = [
  {
    step: 1,
    title: 'Tahap 1 (Saat Daftar Ulang)',
    amountInternal: 3500000,
    amountExternal: 3500000,
    amountIkhwan: 3500000,
    amountAkhwat: 3500000,
    dueDate: 'Saat daftar ulang dinyatakan lulus',
    notes: 'Penguncian kursi santri, pengukuran seragam & alokasi buku paket',
  },
  {
    step: 2,
    title: 'Tahap 2 (Sebelum Masuk Sekolah)',
    amountInternal: 2000000,
    amountExternal: 2000000,
    amountIkhwan: 2000000,
    amountAkhwat: 2000000,
    dueDate: '30 Juni 2027',
    notes: 'Pelunasan seragam, modul pelajaran, dan persiapan MPLS',
  },
  {
    step: 3,
    title: 'Tahap 3 (Sebelum Penilaian Akhir Semester 1)',
    amountInternal: 1170000,
    amountExternal: 1390000,
    amountIkhwan: 1170000,
    amountAkhwat: 1390000,
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
 * Mendapatkan Total Tagihan BAM standar berdasarkan jenis kelamin santri (Ikhwan vs Akhwat)
 * atau objek santri
 */
export function getTotalBamCost(categoryOrGenderOrStudent?: string | Partial<StudentData> | null): number {
  if (!categoryOrGenderOrStudent) return BAM_CONFIG.totalIkhwan;

  if (typeof categoryOrGenderOrStudent === 'string') {
    const s = categoryOrGenderOrStudent.toLowerCase();
    if (s.includes('perempuan') || s.includes('akhwat') || s.includes('putri')) {
      return BAM_CONFIG.totalAkhwat;
    }
    if (s.includes('laki') || s.includes('ikhwan') || s.includes('putra')) {
      return BAM_CONFIG.totalIkhwan;
    }
    // Backward compatibility jika passing 'Internal' atau 'Eksternal'
    if (s === 'eksternal') return BAM_CONFIG.totalAkhwat;
    return BAM_CONFIG.totalIkhwan;
  }

  // Jika student object
  const student = categoryOrGenderOrStudent as any;
  if (student.gender === 'Perempuan' || student.gender === 'akhwat' || student.gender === 'putri') {
    return BAM_CONFIG.totalAkhwat;
  }
  return BAM_CONFIG.totalIkhwan;
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
export function getBamInstallmentType(totalCost: number, amountPaid: number, categoryOrGender: string = 'Laki-laki'): string {
  if (amountPaid <= 0) return 'Belum Bayar';
  
  if (amountPaid >= totalCost) {
    return 'Lunas';
  }

  const isAkhwat = categoryOrGender.toLowerCase().includes('perempuan') || categoryOrGender.toLowerCase().includes('akhwat');
  const step1 = isAkhwat ? (BAM_INSTALLMENT_STEPS[0].amountAkhwat || 3500000) : (BAM_INSTALLMENT_STEPS[0].amountIkhwan || 3500000);
  const step2 = step1 + (isAkhwat ? (BAM_INSTALLMENT_STEPS[1].amountAkhwat || 2000000) : (BAM_INSTALLMENT_STEPS[1].amountIkhwan || 2000000));

  if (amountPaid >= step2) {
    return 'Cicilan 2';
  }
  if (amountPaid >= step1) {
    return 'Cicilan 1';
  }

  return 'DP (Sebagian)';
}

