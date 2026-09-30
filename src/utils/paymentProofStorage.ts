// =====================================================================
// src/utils/paymentProofStorage.ts
// Modul Penyimpanan Bukti Transfer SPMB ke Supabase Storage & Metadata DB
// =====================================================================

import { supabase, isSupabaseConfigured } from './supabaseClient';

export const PAYMENT_PROOFS_BUCKET = 'payment-proofs';
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

export interface ProofFileValidationResult {
  valid: boolean;
  error?: string;
}

export interface PaymentProofMetadata {
  storagePath: string; // payment-proofs/{student_id}/{payment_id}/{timestamp}_{safe_filename}
  fileName: string;
  fileType: string;
  fileSize: number; // in bytes
  uploadedAt: string; // ISO date string
}

export interface UploadProofResult {
  success: boolean;
  metadata?: PaymentProofMetadata;
  error?: string;
}

export type StoredPaymentProof = PaymentProofMetadata;

/**
 * Format bytes ke format yang mudah dibaca (KB / MB)
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Validasi ketat keamanan file bukti transfer:
 * - Ukuran maksimal 5 MB
 * - Format hanya: JPG, PNG, WEBP, PDF
 */
export function validateProofFile(file: File): ProofFileValidationResult {
  if (!file) {
    return { valid: false, error: 'Silakan pilih file bukti transfer terlebih dahulu.' };
  }

  // 1. Validasi Ukuran File (Maksimal 5 MB)
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: 'Bukti transfer maksimal 5 MB.' };
  }

  // 2. Validasi Tipe MIME
  const mimeType = (file.type || '').toLowerCase();
  const rawFileName = (file.name || '').toLowerCase();
  const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => rawFileName.endsWith(ext));

  if (!ALLOWED_MIME_TYPES.includes(mimeType) && !hasValidExtension) {
    return {
      valid: false,
      error: 'Format file tidak didukung. Silakan gunakan JPG, PNG, WEBP, atau PDF.',
    };
  }

  return { valid: true };
}

/**
 * Membuat nama file yang aman (sanitized) tanpa karakter khusus berbahaya
 */
export function sanitizeFileName(originalName: string): string {
  const parts = originalName.split('.');
  const extension = parts.length > 1 ? `.${parts.pop()!.toLowerCase()}` : '.jpg';
  const baseName = parts.join('_').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${baseName.slice(0, 50)}${extension}`;
}

/**
 * Menghasilkan timestamp string dengan format YYYYMMDD_HHmmss
 */
export function generateTimestampPrefix(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}

/**
 * Memeriksa apakah suatu URL atau file merupakan dokumen PDF
 */
export function isPdfProof(urlOrPath: string, fileType?: string): boolean {
  if (fileType && fileType.toLowerCase().includes('pdf')) return true;
  if (!urlOrPath) return false;
  const lower = urlOrPath.toLowerCase();
  return lower.includes('.pdf') || lower.startsWith('data:application/pdf');
}

/**
 * Membersihkan path Supabase Storage agar siap digunakan oleh SDK
 * Mengubah "payment-proofs/student-01/pay-01/file.jpg" menjadi "student-01/pay-01/file.jpg"
 */
export function extractBucketPath(fullPathOrUrl: string): string {
  if (!fullPathOrUrl) return '';
  let clean = fullPathOrUrl.trim();
  // Hapus awalan bucket name jika ada
  if (clean.startsWith('payment-proofs/')) {
    clean = clean.replace('payment-proofs/', '');
  } else if (clean.startsWith('/payment-proofs/')) {
    clean = clean.replace('/payment-proofs/', '');
  }
  // Hapus query params jika ada
  if (clean.includes('?')) {
    clean = clean.split('?')[0];
  }
  return clean;
}

/**
 * UPLOAD BUKTI TRANSFER KE SUPABASE STORAGE
 * Menyimpan file secara langsung ke private bucket 'payment-proofs'
 * dengan struktur path:
 * payment-proofs/{student_id}/{payment_id}/{timestamp}_{safe_filename}
 */
export async function uploadPaymentProofToStorage(
  file: File,
  studentId: string,
  paymentId: string
): Promise<UploadProofResult> {
  // 1. Validasi Keamanan File
  const validation = validateProofFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  if (!studentId || !paymentId) {
    return { success: false, error: 'Identitas siswa atau transaksi pembayaran tidak valid.' };
  }

  // 2. Format Path Aman
  const timestamp = generateTimestampPrefix();
  const safeName = sanitizeFileName(file.name || 'bukti_transfer.jpg');
  // Path di dalam bucket payment-proofs
  const innerPath = `${studentId}/${paymentId}/${timestamp}_${safeName}`;
  const fullStoragePath = `payment-proofs/${innerPath}`;

  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Koneksi ke Supabase belum terkonfigurasi. Pastikan koneksi internet aktif.',
    };
  }

  try {
    // 3. Upload File Langsung (Binary/Blob) ke Supabase Storage (bukan base64)
    const { data, error: uploadErr } = await supabase.storage
      .from(PAYMENT_PROOFS_BUCKET)
      .upload(innerPath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'image/jpeg',
      });

    if (uploadErr) {
      console.error('Supabase Storage Upload Error:', uploadErr);
      // Deteksi error spesifik Supabase
      if (uploadErr.message?.toLowerCase().includes('bucket not found')) {
        return {
          success: false,
          error:
            'Bucket storage "payment-proofs" belum ditemukan di Supabase. Silakan jalankan migrasi database di Supabase SQL Editor.',
        };
      }
      if (uploadErr.message?.toLowerCase().includes('violates row-level security')) {
        return {
          success: false,
          error: 'Izin akses upload ditolak oleh Row-Level Security (RLS) Supabase Storage.',
        };
      }
      return {
        success: false,
        error: `Gagal mengunggah bukti ke Supabase Storage: ${uploadErr.message}`,
      };
    }

    const savedPath = data?.path ? `payment-proofs/${data.path}` : fullStoragePath;

    // 4. Return Metadata File untuk disimpan ke Database
    const metadata: PaymentProofMetadata = {
      storagePath: savedPath,
      fileName: safeName,
      fileType: file.type || 'image/jpeg',
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
    };

    return {
      success: true,
      metadata,
    };
  } catch (err: any) {
    console.error('Unhandled upload error:', err);
    return {
      success: false,
      error: `Terjadi kendala saat mengunggah file: ${err?.message || 'Koneksi terputus'}`,
    };
  }
}

/**
 * TRANSACTION SAFETY: CLEANUP FILE STORAGE JIKA SIMPAN KE DB GAGAL
 * Jika file storage berhasil diupload namun penulisan ke database gagal,
 * fungsi ini menghapus file yang tidak memiliki referensi (orphan).
 */
export async function cleanupOrphanStorageProof(storagePath: string): Promise<void> {
  if (!storagePath || !isSupabaseConfigured()) return;
  try {
    const cleanPath = extractBucketPath(storagePath);
    if (!cleanPath) return;
    await supabase.storage.from(PAYMENT_PROOFS_BUCKET).remove([cleanPath]);
    console.info(`[Transaction Safety] File orphan berhasil dibersihkan dari Storage: ${cleanPath}`);
  } catch (err) {
    console.warn('[Transaction Safety] Gagal membersihkan orphan storage file:', err);
  }
}

/**
 * MENAMPILKAN BUKTI TRANSFER MENGGUNAKAN SIGNED URL
 * Karena bucket bersifat PRIVATE, admin dan siswa mengakses bukti menggunakan
 * temporary signed URL dari Supabase Storage (berlaku default 1 jam / 3600 detik).
 */
export async function getPaymentProofSignedUrl(
  pathOrUrl: string,
  expiresInSeconds = 3600
): Promise<{ url: string | null; error?: string }> {
  if (!pathOrUrl) {
    return { url: null, error: 'Path bukti transfer tidak ditemukan.' };
  }

  // Jika sudah berupa dataUrl lokal (legacy preview) atau URL http eksternal publik
  if (pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('blob:')) {
    return { url: pathOrUrl };
  }
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return { url: pathOrUrl };
  }

  if (!isSupabaseConfigured()) {
    return { url: null, error: 'Koneksi Supabase belum terkonfigurasi.' };
  }

  try {
    const cleanPath = extractBucketPath(pathOrUrl);
    if (!cleanPath) {
      return { url: null, error: 'Format path storage tidak valid.' };
    }

    const { data, error } = await supabase.storage
      .from(PAYMENT_PROOFS_BUCKET)
      .createSignedUrl(cleanPath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      console.warn('Gagal membuat signed URL bukti transfer:', error);
      return {
        url: null,
        error: error?.message || 'Gagal menghasilkan URL bukti transfer dari storage privat.',
      };
    }

    return { url: data.signedUrl };
  } catch (err: any) {
    console.error('Error saat mengambil signed URL:', err);
    return { url: null, error: err?.message || 'Terjadi kesalahan sistem.' };
  }
}

/**
 * DOWNLOAD BUKTI PEMBAYARAN KE PERANGKAT PENGGUNA
 * Mengunduh file gambar atau PDF secara aman menggunakan Signed URL.
 */
export async function downloadPaymentProofFile(
  pathOrUrl: string,
  defaultFileName = 'Bukti_Transfer.jpg'
): Promise<void> {
  try {
    if (!pathOrUrl) {
      alert('File bukti pembayaran tidak tersedia untuk diunduh.');
      return;
    }

    let downloadUrl = pathOrUrl;

    // Jika berupa path storage, dapatkan signed URL terlebih dahulu
    if (!pathOrUrl.startsWith('data:') && !pathOrUrl.startsWith('http')) {
      const { url, error } = await getPaymentProofSignedUrl(pathOrUrl, 300);
      if (error || !url) {
        alert(`Gagal menyiapkan link unduh bukti transfer: ${error || 'Unknown error'}`);
        return;
      }
      downloadUrl = url;
    }

    // Trigger download melalui fetch blob jika dimungkinkan untuk memaksa nama file
    try {
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = defaultFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      // Fallback jika fetch terhalang CORS
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = defaultFileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } catch (err) {
    console.error('Download proof error:', err);
    alert('Terjadi kesalahan saat mengunduh berkas bukti pembayaran.');
  }
}

// =====================================================================
// BACKWARD COMPATIBILITY HELPER UNTUK SISTEM LAMA (JIKA ADA KOMPONEN IMPORT)
// =====================================================================
export function downloadPaymentProof(dataUrlOrPath: string, defaultFileName: string): void {
  downloadPaymentProofFile(dataUrlOrPath, defaultFileName);
}

export function getStoredPaymentProofs(): any[] {
  return [];
}
