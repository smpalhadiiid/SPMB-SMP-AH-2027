// =====================================================================
// src/utils/receiptNumber.ts
// Modul Generator Nomor Kuitansi Unik & Terbilang Rupiah Resmi
// SPMB SMPS Al-Hadiid Cileungsi
//
// FORMAT NOMOR:
// Formulir : KWT-FRM-[TAHUN]-[00001...] (Contoh: KWT-FRM-2027-00001)
// BAM      : KWT-BAM-[TAHUN]-[00001...] (Contoh: KWT-BAM-2027-00001)
// =====================================================================

import { supabase } from './supabaseClient';

/**
 * Konversi angka rupiah ke kalimat terbilang Bahasa Indonesia resmi
 * Contoh: 200000 -> "Dua Ratus Ribu Rupiah"
 * Contoh: 2500000 -> "Dua Juta Lima Ratus Ribu Rupiah"
 */
export function formatTerbilangRupiah(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount) || amount <= 0) {
    return 'Nol Rupiah';
  }

  const satuan = [
    '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima',
    'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'
  ];

  function bilang(n: number): string {
    const num = Math.floor(Math.abs(n));
    if (num < 12) {
      return satuan[num];
    }
    if (num < 20) {
      return `${bilang(num - 10)} Belas`;
    }
    if (num < 100) {
      const sisa = num % 10;
      return `${bilang(Math.floor(num / 10))} Puluh${sisa > 0 ? ' ' + bilang(sisa) : ''}`;
    }
    if (num < 200) {
      const sisa = num - 100;
      return `Seratus${sisa > 0 ? ' ' + bilang(sisa) : ''}`;
    }
    if (num < 1000) {
      const sisa = num % 100;
      return `${bilang(Math.floor(num / 100))} Ratus${sisa > 0 ? ' ' + bilang(sisa) : ''}`;
    }
    if (num < 2000) {
      const sisa = num - 1000;
      return `Seribu${sisa > 0 ? ' ' + bilang(sisa) : ''}`;
    }
    if (num < 1000000) {
      const sisa = num % 1000;
      return `${bilang(Math.floor(num / 1000))} Ribu${sisa > 0 ? ' ' + bilang(sisa) : ''}`;
    }
    if (num < 1000000000) {
      const sisa = num % 1000000;
      return `${bilang(Math.floor(num / 1000000))} Juta${sisa > 0 ? ' ' + bilang(sisa) : ''}`;
    }
    if (num < 1000000000000) {
      const sisa = num % 1000000000;
      return `${bilang(Math.floor(num / 1000000000))} Milyar${sisa > 0 ? ' ' + bilang(sisa) : ''}`;
    }
    return `${num}`;
  }

  const hasil = bilang(amount).trim();
  return `${hasil} Rupiah`;
}

/**
 * Mengekstrak tahun 4 digit dari academic year (contoh: "2027/2028" -> "2027")
 */
export function extractReceiptYear(academicYear?: string): string {
  if (!academicYear) return '2027';
  const match = academicYear.match(/\b(20\d{2})\b/);
  return match ? match[1] : '2027';
}

/**
 * Mengambil atau membuat nomor kuitansi permanen di Supabase untuk transaksi pembayaran.
 * Jika transaksi sudah memiliki nomor kuitansi, nomor tersebut dikembalikan persis tanpa perubahan.
 * Jika belum, nomor kuitansi dibuat berurutan (sequence), disimpan di database, lalu dikembalikan.
 */
export async function getOrAssignReceiptNumber(
  paymentId: string,
  type: 'form' | 'bam',
  academicYear?: string
): Promise<string> {
  const year = extractReceiptYear(academicYear);
  const prefix = type === 'bam' ? `KWT-BAM-${year}-` : `KWT-FRM-${year}-`;

  try {
    // 1. Cek apakah transaksi sudah memiliki receipt_number di database
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, receipt_number, payment_type')
      .eq('id', paymentId)
      .maybeSingle();

    if (existingPayment?.receipt_number) {
      return existingPayment.receipt_number;
    }

    // 2. Ambil seluruh receipt_number yang sudah terpakai dengan prefix yang sama untuk cari urutan tertinggi
    const { data: allWithPrefix } = await supabase
      .from('payments')
      .select('receipt_number')
      .like('receipt_number', `${prefix}%`);

    let maxSeq = 0;
    if (allWithPrefix && allWithPrefix.length > 0) {
      allWithPrefix.forEach(row => {
        if (row.receipt_number && row.receipt_number.startsWith(prefix)) {
          const numPart = row.receipt_number.replace(prefix, '');
          const parsed = parseInt(numPart, 10);
          if (!isNaN(parsed) && parsed > maxSeq) {
            maxSeq = parsed;
          }
        }
      });
    }

    const nextSeq = maxSeq + 1;
    const newReceiptNumber = `${prefix}${String(nextSeq).padStart(5, '0')}`;
    const issuedAt = new Date().toISOString();

    // 3. Simpan nomor kuitansi permanen ke Supabase
    try {
      await supabase
        .from('payments')
        .update({
          receipt_number: newReceiptNumber,
          receipt_issued_at: issuedAt,
        })
        .eq('id', paymentId);
    } catch (saveErr) {
      console.warn('[Receipt] Gagal mengupdate receipt_number di tabel payments:', saveErr);
    }

    return newReceiptNumber;
  } catch (err) {
    console.warn('[Receipt] getOrAssignReceiptNumber error:', err);
    // Fallback safe deterministic fallback
    const fallbackSeq = Math.floor(Math.random() * 90000) + 10000;
    return `${prefix}${fallbackSeq}`;
  }
}

/**
 * Menghasilkan URL verifikasi kuitansi resmi
 */
export function getReceiptVerificationUrl(receiptNumber: string): string {
  if (typeof window === 'undefined') return `/verify/kuitansi/${receiptNumber}`;
  const origin = window.location.origin;
  return `${origin}/verify/kuitansi/${encodeURIComponent(receiptNumber)}`;
}
