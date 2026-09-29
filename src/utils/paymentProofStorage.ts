import { supabase, isSupabaseConfigured } from './supabaseClient';
import { PaymentRepository } from '../repositories/PaymentRepository';

export interface StoredPaymentProof {
  id: string;
  studentId: string;
  registrationNumber: string;
  studentName: string;
  paymentType: 'form' | 'bam';
  fileName: string;
  fileSize: number; // in bytes
  fileType: string;
  dataUrl: string; // Base64 data URI or public Supabase URL
  uploadedAt: string; // ISO date string
  amount: number;
  status: 'unpaid' | 'pending' | 'verified' | 'rejected';
  notes?: string;
  gender?: 'Laki-laki' | 'Perempuan';
}

const STORAGE_KEY = 'spmb_stored_payment_proofs';

/**
 * Format bytes ke format yang mudah dibaca (KB / MB)
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Kompresi gambar bukti transfer di sisi browser (Client-Side Canvas Compression).
 * Mengurangi ukuran foto kamera HP (biasanya 3-10MB) menjadi 100-250KB
 * dengan tetap menjaga ketajaman teks resi transfer / mutasi bank.
 */
export async function compressPaymentProofImage(
  file: File,
  maxDimension = 1280,
  quality = 0.82
): Promise<{
  dataUrl: string;
  fileName: string;
  fileSize: number;
  originalSize: number;
  fileType: string;
}> {
  const originalSize = file.size;
  const fileName = file.name || `bukti_transfer_${Date.now()}.jpg`;
  const fileType = file.type || 'image/jpeg';

  // Jika bukan gambar (misal dokumen PDF), baca langsung sebagai dataUrl
  if (!file.type.startsWith('image/')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve({
          dataUrl: result,
          fileName,
          fileSize: originalSize,
          originalSize,
          fileType,
        });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Resize proporsional jika lebih besar dari maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback ke dataUrl awal jika canvas context tidak tersedia
          resolve({
            dataUrl: event.target?.result as string,
            fileName,
            fileSize: originalSize,
            originalSize,
            fileType,
          });
          return;
        }

        // Aktifkan bilinear image smoothing untuk hasil teks struk tajam
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Pilih format JPEG atau WebP
        const targetFormat = 'image/jpeg';
        const compressedDataUrl = canvas.toDataURL(targetFormat, quality);

        // Hitung perkiraan ukuran dalam bytes dari base64 string
        const base64Length = compressedDataUrl.length - (compressedDataUrl.indexOf(',') + 1);
        const approxSize = Math.round((base64Length * 3) / 4);

        resolve({
          dataUrl: compressedDataUrl,
          fileName: fileName.replace(/\.[^/.]+$/, '') + '.jpg',
          fileSize: approxSize,
          originalSize,
          fileType: targetFormat,
        });
      };

      img.onerror = () => {
        // Fallback jika decode gambar gagal
        resolve({
          dataUrl: event.target?.result as string,
          fileName,
          fileSize: originalSize,
          originalSize,
          fileType,
        });
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      resolve({
        dataUrl: '',
        fileName,
        fileSize: 0,
        originalSize,
        fileType,
      });
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Mencoba mengunggah file bukti ke Supabase Storage bucket 'payment-proofs' jika tersedia.
 * Jika bucket belum dibuat atau anon key tidak memiliki permission, fungsi ini mengembalikan null
 * tanpa throw error sehingga sistem beralih secara mulus ke dataUrl terkompresi.
 */
export async function uploadToSupabaseStorageIfAvailable(
  fileDataUrl: string,
  fileName: string,
  folder: 'form' | 'bam' = 'form'
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    // Ubah dataUrl ke Blob
    const response = await fetch(fileDataUrl);
    const blob = await response.blob();
    const cleanFileName = `${folder}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const { data, error } = await supabase.storage
      .from('payment-proofs')
      .upload(cleanFileName, blob, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      // Bucket belum ada atau RLS storage belum diset, gunakan inline dataUrl
      return null;
    }

    if (data?.path) {
      const { data: publicUrlData } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(data.path);

      if (publicUrlData?.publicUrl) {
        return publicUrlData.publicUrl;
      }
    }
  } catch (err) {
    console.warn('Supabase storage upload optional fallback:', err);
  }

  return null;
}

/**
 * Mengambil seluruh riwayat data bukti transfer pembayaran yang tersimpan di cache lokal
 */
export function getStoredPaymentProofs(): StoredPaymentProof[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const data = window.localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data) as StoredPaymentProof[];
      }
    }
  } catch (e) {
    console.warn('Gagal membaca stored payment proofs:', e);
  }
  return [];
}

/**
 * Menyimpan data bukti pembayaran ke penyimpanan lokal dan menyinkronkan ke Supabase
 */
export async function savePaymentProofRecord(proof: StoredPaymentProof): Promise<StoredPaymentProof> {
  try {
    // 1. Simpan ke local cache
    const existing = getStoredPaymentProofs();
    const filtered = existing.filter(
      (p) => !(p.studentId === proof.studentId && p.paymentType === proof.paymentType)
    );
    const updated = [proof, ...filtered];

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 50)));
      }
    } catch (quotaErr) {
      console.warn('LocalStorage quota reached when saving proof, fallback in-memory:', quotaErr);
    }

    // 2. Sinkronkan ke Supabase `public.payments`
    try {
      await PaymentRepository.create({
        studentId: proof.studentId,
        registrationNumber: proof.registrationNumber,
        studentName: proof.studentName,
        paymentType: proof.paymentType,
        amount: proof.amount,
        status: proof.status,
        paymentMethod: 'Transfer Bank',
        bankName: 'BSI',
        proofUrl: proof.dataUrl,
        paymentDate: proof.uploadedAt,
        notes: proof.notes || `Bukti ${proof.paymentType === 'form' ? 'Formulir' : 'BAM'} (${proof.fileName}, ${formatFileSize(proof.fileSize)})`,
      });
    } catch (dbErr) {
      console.warn('Sinkronisasi PaymentRepository bukti upload error:', dbErr);
    }

    return proof;
  } catch (err) {
    console.error('Error in savePaymentProofRecord:', err);
    return proof;
  }
}

/**
 * Trigger download gambar bukti pembayaran langsung ke perangkat pengguna
 */
export function downloadPaymentProof(dataUrl: string, defaultFileName: string): void {
  try {
    if (!dataUrl) {
      alert('File bukti pembayaran tidak tersedia untuk diunduh.');
      return;
    }

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = defaultFileName || `Bukti_Transfer_${Date.now()}.jpg`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.error('Download error:', err);
    // Fallback buka di tab baru jika download gagal
    window.open(dataUrl, '_blank');
  }
}
