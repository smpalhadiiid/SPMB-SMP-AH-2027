// =====================================================================
// src/repositories/PaymentRepository.ts
// Single Source of Truth Repository for public.payments
// =====================================================================

import { supabase } from '../utils/supabaseClient';
import { getOrAssignReceiptNumber } from '../utils/receiptNumber';

export interface PaymentItem {
  id: string;
  studentId: string;
  registrationNumber: string;
  studentName: string;
  gender?: 'Laki-laki' | 'Perempuan';
  paymentType: 'form' | 'bam' | 'tuition' | 'other';
  amount: number;
  status: 'unpaid' | 'pending' | 'verified' | 'rejected';
  receiptNumber?: string;
  receiptIssuedAt?: string;
  paymentMethod?: string;
  bankName?: string;
  accountNumber?: string;
  senderName?: string;
  proofUrl?: string; // Menyimpan storage path atau URL
  proofStoragePath?: string;
  proofFileName?: string;
  proofFileType?: string;
  proofFileSize?: number;
  proofUploadedAt?: string;
  rejectionReason?: string;
  paymentDate?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export function mapRowToPayment(row: any): PaymentItem {
  const pType = (row.payment_type === 'daftar_ulang' || row.payment_type === 'bam') ? 'bam' : 'form';
  const rawPath = row.proof_storage_path || row.proof_url || undefined;
  
  return {
    id: row.id,
    studentId: row.student_id,
    registrationNumber: row.registration_number,
    studentName: row.student_name,
    gender: row.student?.gender || row.gender || undefined,
    paymentType: pType,
    amount: Number(row.amount || 0),
    status: row.status,
    receiptNumber: row.receipt_number || undefined,
    receiptIssuedAt: row.receipt_issued_at || undefined,
    paymentMethod: row.payment_method || undefined,
    bankName: row.bank_name || undefined,
    accountNumber: row.account_number || undefined,
    senderName: row.sender_name || undefined,
    proofUrl: row.proof_url || row.proof_storage_path || undefined,
    proofStoragePath: rawPath,
    proofFileName: row.proof_file_name || undefined,
    proofFileType: row.proof_file_type || undefined,
    proofFileSize: row.proof_file_size ? Number(row.proof_file_size) : undefined,
    proofUploadedAt: row.proof_uploaded_at || undefined,
    rejectionReason: row.rejection_reason || undefined,
    paymentDate: row.payment_date || undefined,
    verifiedBy: row.verified_by || undefined,
    verifiedAt: row.verified_at || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at,
  };
}

export const PaymentRepository = {
  /**
   * Mengambil daftar pembayaran langsung dari database Supabase.
   * Admin dapat melihat semua, siswa hanya miliknya sendiri.
   * Mendukung filter berdasarkan studentId atau paymentType ('form' | 'bam' | 'tuition' | 'other').
   */
  async list(
    filter?: string | { studentId?: string; paymentType?: 'form' | 'bam' | 'tuition' | 'other' }
  ): Promise<{ data: PaymentItem[]; error: Error | null }> {
    try {
      let query = supabase
        .from('payments')
        .select('*, student:students(gender)')
        .order('created_at', { ascending: false });

      let studentIdFilter: string | undefined;
      let paymentTypeDbValues: string[] | undefined;

      if (typeof filter === 'string') {
        const lower = filter.toLowerCase();
        if (['form', 'formulir'].includes(lower)) {
          paymentTypeDbValues = ['formulir', 'form'];
        } else if (['bam', 'daftar_ulang'].includes(lower)) {
          paymentTypeDbValues = ['daftar_ulang', 'bam'];
        } else if (['tuition', 'other'].includes(lower)) {
          paymentTypeDbValues = [lower];
        } else {
          studentIdFilter = filter;
        }
      } else if (typeof filter === 'object' && filter !== null) {
        studentIdFilter = filter.studentId;
        if (filter.paymentType === 'form') {
          paymentTypeDbValues = ['formulir', 'form'];
        } else if (filter.paymentType === 'bam') {
          paymentTypeDbValues = ['daftar_ulang', 'bam'];
        } else if (filter.paymentType) {
          paymentTypeDbValues = [filter.paymentType];
        }
      }

      if (studentIdFilter) {
        query = query.eq('student_id', studentIdFilter);
      }
      if (paymentTypeDbValues) {
        query = query.in('payment_type', paymentTypeDbValues);
      }

      const { data, error } = await query;
      if (error) {
        // Fallback without relation join if relation alias is not configured
        let fallbackQuery = supabase.from('payments').select('*').order('created_at', { ascending: false });
        if (studentIdFilter) {
          fallbackQuery = fallbackQuery.eq('student_id', studentIdFilter);
        }
        if (paymentTypeDbValues) {
          fallbackQuery = fallbackQuery.in('payment_type', paymentTypeDbValues);
        }
        const { data: fallbackData, error: fallbackError } = await fallbackQuery;
        if (fallbackError) {
          return { data: [], error: new Error(fallbackError.message) };
        }
        return { data: (fallbackData || []).map(mapRowToPayment), error: null };
      }

      return { data: (data || []).map(mapRowToPayment), error: null };
    } catch (err: any) {
      return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Mengambil pembayaran spesifik berdasarkan id
   */
  async getById(id: string): Promise<{ data: PaymentItem | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.from('payments').select('*').eq('id', id).maybeSingle();
      if (error) return { data: null, error: new Error(error.message) };
      return { data: data ? mapRowToPayment(data) : null, error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Mengirim pembayaran baru (INSERT) ke tabel public.payments
   */
  async create(payment: Partial<PaymentItem>): Promise<{ data: PaymentItem | null; error: Error | null }> {
    try {
      const paymentTypeStr = String(payment.paymentType || '');
      const dbPaymentType = (paymentTypeStr === 'bam' || paymentTypeStr === 'daftar_ulang' || paymentTypeStr === 'tuition')
        ? 'daftar_ulang'
        : 'formulir';

      const row: Record<string, any> = {
        student_id: payment.studentId,
        registration_number: payment.registrationNumber,
        student_name: payment.studentName,
        payment_type: dbPaymentType,
        amount: payment.amount,
        status: payment.status || 'pending',
        payment_method: payment.paymentMethod || 'manual_transfer',
        bank_name: payment.bankName || 'BSI',
        account_number: payment.accountNumber,
        sender_name: payment.senderName,
        proof_url: payment.proofStoragePath || payment.proofUrl,
        payment_date: payment.paymentDate || new Date().toISOString(),
        notes: payment.notes,
        created_at: new Date().toISOString(),
      };

      if (payment.id) {
        row.id = payment.id;
      }
      if (payment.status === 'verified') {
        row.verified_at = payment.verifiedAt || new Date().toISOString();
        row.verified_by = payment.verifiedBy || 'Admin Panitia';
      }
      if (payment.rejectionReason) {
        row.rejection_reason = payment.rejectionReason;
      }

      // Metadata tambahan bukti transfer (jika kolom tersedia)
      const extendedRow = { ...row };
      if (payment.proofStoragePath) extendedRow.proof_storage_path = payment.proofStoragePath;
      if (payment.proofFileName) extendedRow.proof_file_name = payment.proofFileName;
      if (payment.proofFileType) extendedRow.proof_file_type = payment.proofFileType;
      if (payment.proofFileSize) extendedRow.proof_file_size = payment.proofFileSize;
      if (payment.proofUploadedAt) extendedRow.proof_uploaded_at = payment.proofUploadedAt;

      let insertedData: any = null;
      const { data, error } = await supabase.from('payments').insert(extendedRow).select().single();
      
      if (error) {
        // Jika kolom metadata belum ada di schema cache, coba insert dengan kolom dasar row
        if (error.message.includes('column') || error.message.includes('schema cache')) {
          const { data: retryData, error: retryErr } = await supabase.from('payments').insert(row).select().single();
          if (retryErr) {
            return { data: null, error: new Error(retryErr.message) };
          }
          insertedData = retryData;
        } else {
          return { data: null, error: new Error(error.message) };
        }
      } else {
        insertedData = data;
      }

      // Sinkronisasi status siswa jika diperlukan
      if (payment.studentId && payment.status === 'verified') {
        if (dbPaymentType === 'formulir') {
          await supabase.from('students').update({
            is_form_verified: true,
            is_form_verified_by_admin: true,
            form_payment_status: 'verified',
            form_payment_amount: payment.amount || 200000,
            form_payment_proof_url: payment.proofStoragePath || payment.proofUrl || null,
          }).eq('id', payment.studentId);
        } else if (dbPaymentType === 'daftar_ulang') {
          await supabase.from('students').update({
            initial_payment_status: 'verified',
            initial_payment_amount: payment.amount || 8500000,
            initial_payment_proof_url: payment.proofStoragePath || payment.proofUrl || null,
          }).eq('id', payment.studentId);
        }
      }

      return { data: mapRowToPayment(insertedData), error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Verifikasi atau Penolakan pembayaran secara aman
   * Jika ditolak, p_rejection_reason WAJIB diisi sesuai aturan SOP SPMB.
   */
  async verifyThroughSecureFunction(
    paymentId: string,
    status: 'verified' | 'rejected' | 'pending',
    notes?: string,
    rejectionReason?: string
  ): Promise<{ success: boolean; error: Error | null }> {
    try {
      if (status === 'rejected' && (!rejectionReason || !rejectionReason.trim())) {
        return {
          success: false,
          error: new Error('Alasan penolakan wajib diisi ketika menolak bukti pembayaran.'),
        };
      }

      // 1. Coba panggil RPC rpc_verify_payment jika tersedia
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_verify_payment', {
          p_payment_id: paymentId,
          p_status: status,
          p_notes: notes || null,
          p_rejection_reason: rejectionReason || null,
        });

        if (!rpcError && rpcData?.success) {
          return { success: true, error: null };
        }
      } catch (rpcErr) {
        console.warn('RPC rpc_verify_payment fallback to direct update:', rpcErr);
      }

      // 2. Direct update fallback
      const payload: Record<string, any> = {
        status,
        notes: notes || (status === 'rejected' ? `Ditolak: ${rejectionReason}` : undefined),
        verified_by: status === 'verified' ? 'Admin Panitia' : undefined,
        verified_at: status === 'verified' ? new Date().toISOString() : undefined,
        updated_at: new Date().toISOString(),
      };

      // Coba masukkan rejection_reason jika kolom ada
      if (status === 'rejected' && rejectionReason) {
        payload.rejection_reason = rejectionReason;
      }

      const { data: updatedPayment, error: updateErr } = await supabase
        .from('payments')
        .update(payload)
        .eq('id', paymentId)
        .select()
        .maybeSingle();

      if (updateErr) {
        // Fallback jika rejection_reason belum ada di schema
        if (updateErr.message.includes('rejection_reason')) {
          delete payload.rejection_reason;
          payload.notes = `Ditolak: ${rejectionReason}`;
          const { error: retryErr } = await supabase
            .from('payments')
            .update(payload)
            .eq('id', paymentId);
          if (retryErr) {
            return { success: false, error: new Error(retryErr.message) };
          }
        } else {
          return { success: false, error: new Error(updateErr.message) };
        }
      }

      // 3. Sinkronkan status ke tabel students & pastikan Nomor Kuitansi diterbitkan
      if (updatedPayment?.student_id) {
        const isForm = updatedPayment.payment_type === 'formulir' || updatedPayment.payment_type === 'form';
        if (isForm) {
          await supabase.from('students').update({
            form_payment_status: status,
            is_form_verified: status === 'verified',
            is_form_verified_by_admin: status === 'verified',
            form_payment_notes: status === 'rejected' ? `Ditolak: ${rejectionReason}` : undefined,
          }).eq('id', updatedPayment.student_id);
        } else {
          await supabase.from('students').update({
            initial_payment_status: status,
            initial_payment_notes: status === 'rejected' ? `Ditolak: ${rejectionReason}` : undefined,
          }).eq('id', updatedPayment.student_id);
        }

        // Terbitkan nomor kuitansi permanen jika status verified
        if (status === 'verified' && !updatedPayment.receipt_number) {
          const type = isForm ? 'form' : 'bam';
          getOrAssignReceiptNumber(paymentId, type).catch(err => console.warn('Assign receipt error:', err));
        }
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Memperbarui record pembayaran
   */
  async update(id: string, updates: Partial<PaymentItem>): Promise<{ data: PaymentItem | null; error: Error | null }> {
    try {
      const payload: Record<string, any> = { updated_at: new Date().toISOString() };
      if (updates.amount !== undefined) payload.amount = updates.amount;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.paymentMethod !== undefined) payload.payment_method = updates.paymentMethod;
      if (updates.bankName !== undefined) payload.bank_name = updates.bankName;
      if (updates.accountNumber !== undefined) payload.account_number = updates.accountNumber;
      if (updates.senderName !== undefined) payload.sender_name = updates.senderName;
      if (updates.proofUrl !== undefined) payload.proof_url = updates.proofUrl;
      if (updates.proofStoragePath !== undefined) payload.proof_storage_path = updates.proofStoragePath;
      if (updates.proofFileName !== undefined) payload.proof_file_name = updates.proofFileName;
      if (updates.proofFileType !== undefined) payload.proof_file_type = updates.proofFileType;
      if (updates.proofFileSize !== undefined) payload.proof_file_size = updates.proofFileSize;
      if (updates.proofUploadedAt !== undefined) payload.proof_uploaded_at = updates.proofUploadedAt;
      if (updates.rejectionReason !== undefined) payload.rejection_reason = updates.rejectionReason;
      if (updates.paymentDate !== undefined) {
        payload.payment_date = updates.paymentDate && updates.paymentDate.trim() ? updates.paymentDate.trim() : null;
      }
      if (updates.verifiedBy !== undefined) payload.verified_by = updates.verifiedBy;
      if (updates.verifiedAt !== undefined) {
        payload.verified_at = updates.verifiedAt && updates.verifiedAt.trim() ? updates.verifiedAt.trim() : null;
      }
      if (updates.notes !== undefined) payload.notes = updates.notes;

      let resultData: any = null;
      const { data, error } = await supabase
        .from('payments')
        .update(payload)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        // Fallback jika ada kolom metadata yang belum terpasang di database
        if (error.message.includes('column') || error.message.includes('schema cache')) {
          delete payload.proof_storage_path;
          delete payload.proof_file_name;
          delete payload.proof_file_type;
          delete payload.proof_file_size;
          delete payload.proof_uploaded_at;
          delete payload.rejection_reason;

          const { data: retryData, error: retryErr } = await supabase
            .from('payments')
            .update(payload)
            .eq('id', id)
            .select()
            .maybeSingle();

          if (retryErr) {
            return { data: null, error: new Error(retryErr.message) };
          }
          resultData = retryData;
        } else {
          return { data: null, error: new Error(error.message) };
        }
      } else {
        resultData = data;
      }

      if (!resultData) {
        return { data: null, error: new Error('Pembayaran tidak ditemukan atau sudah dihapus.') };
      }

      // Sync status siswa jika status pembayaran berubah
      if (updates.status && resultData.student_id) {
        const isForm = resultData.payment_type === 'formulir' || resultData.payment_type === 'form';
        if (isForm) {
          await supabase.from('students').update({
            form_payment_status: updates.status,
            is_form_verified: updates.status === 'verified',
            is_form_verified_by_admin: updates.status === 'verified',
          }).eq('id', resultData.student_id);
        } else {
          await supabase.from('students').update({
            initial_payment_status: updates.status,
          }).eq('id', resultData.student_id);
        }
      }

      return { data: mapRowToPayment(resultData), error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Menghapus record pembayaran dan memperbarui status siswa jika diperlukan
   */
  async remove(id: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { data: existing } = await supabase.from('payments').select('*').eq('id', id).maybeSingle();

      const { error } = await supabase.from('payments').delete().eq('id', id);
      if (error) {
        return { success: false, error: new Error(error.message) };
      }

      if (existing && existing.student_id) {
        const isForm = existing.payment_type === 'formulir' || existing.payment_type === 'form';
        if (isForm) {
          await supabase.from('students').update({
            form_payment_status: 'unpaid',
            is_form_verified: false,
            is_form_verified_by_admin: false,
          }).eq('id', existing.student_id);
        } else {
          await supabase.from('students').update({
            initial_payment_status: 'unpaid',
          }).eq('id', existing.student_id);
        }
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },
};
