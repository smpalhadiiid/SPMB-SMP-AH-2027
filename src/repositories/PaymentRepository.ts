// =====================================================================
// src/repositories/PaymentRepository.ts
// Single Source of Truth Repository for public.payments
// =====================================================================

import { supabase } from '../utils/supabaseClient';

export interface PaymentItem {
  id: string;
  studentId: string;
  registrationNumber: string;
  studentName: string;
  gender?: 'Laki-laki' | 'Perempuan';
  paymentType: 'form' | 'bam' | 'tuition' | 'other';
  amount: number;
  status: 'unpaid' | 'pending' | 'verified' | 'rejected';
  paymentMethod?: string;
  bankName?: string;
  accountNumber?: string;
  senderName?: string;
  proofUrl?: string;
  paymentDate?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export function isValidUuid(val?: string | null): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

export function mapRowToPayment(row: any): PaymentItem {
  const pType = (row.payment_type === 'daftar_ulang' || row.payment_type === 'bam') ? 'bam' : 'form';
  return {
    id: row.id,
    studentId: row.student_id,
    registrationNumber: row.registration_number,
    studentName: row.student_name,
    gender: row.student?.gender || row.gender || undefined,
    paymentType: pType,
    amount: Number(row.amount || 0),
    status: row.status,
    paymentMethod: row.payment_method || undefined,
    bankName: row.bank_name || undefined,
    accountNumber: row.account_number || undefined,
    senderName: row.sender_name || undefined,
    proofUrl: row.proof_url || undefined,
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
        bank_name: payment.bankName,
        account_number: payment.accountNumber,
        sender_name: payment.senderName,
        proof_url: payment.proofUrl,
        payment_date: payment.paymentDate || new Date().toISOString(),
        notes: payment.notes,
        created_at: new Date().toISOString(),
      };

      if (payment.id && isValidUuid(payment.id)) {
        row.id = payment.id;
      }
      if (payment.status === 'verified') {
        row.verified_at = payment.verifiedAt || new Date().toISOString();
        row.verified_by = payment.verifiedBy || 'Admin Panitia';
      }

      const { data, error } = await supabase.from('payments').insert(row).select().single();
      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      // Sync student status in Supabase students table
      if (payment.studentId) {
        if (dbPaymentType === 'formulir') {
          if (payment.status === 'verified') {
            await supabase.from('students').update({
              is_form_verified: true,
              form_payment_status: 'verified',
              form_payment_amount: payment.amount || 200000,
              form_payment_proof_url: payment.proofUrl || null,
              updated_at: new Date().toISOString(),
            }).eq('id', payment.studentId);
          }
        } else if (dbPaymentType === 'daftar_ulang') {
          const studentUpdates: Record<string, any> = {
            initial_payment_amount: payment.amount || 0,
            initial_payment_status: payment.status || 'pending',
            updated_at: new Date().toISOString(),
          };
          if (payment.proofUrl) studentUpdates.initial_payment_proof_url = payment.proofUrl;
          if (payment.paymentDate) studentUpdates.initial_payment_date = payment.paymentDate;
          if (payment.notes) studentUpdates.initial_payment_notes = payment.notes;
          if (payment.status === 'verified') {
            studentUpdates.status = 're_registered';
          }
          await supabase.from('students').update(studentUpdates).eq('id', payment.studentId);
        }
      }

      return { data: mapRowToPayment(data), error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Verifikasi pembayaran secara aman menggunakan RPC Supabase
   */
  async verifyThroughSecureFunction(
    paymentId: string,
    status: 'verified' | 'rejected' | 'pending',
    notes?: string
  ): Promise<{ success: boolean; error: Error | null }> {
    try {
      // 1. Coba panggil RPC rpc_verify_payment jika paymentId adalah UUID valid
      if (isValidUuid(paymentId)) {
        const { error: rpcError } = await supabase.rpc('rpc_verify_payment', {
          p_payment_id: paymentId,
          p_status: status,
          p_notes: notes || null,
        });

        if (!rpcError) {
          return { success: true, error: null };
        }
      }

      // 2. Fallback direct update jika RPC belum ter-apply atau paymentId bukan UUID
      const query = isValidUuid(paymentId)
        ? supabase.from('payments').update({
            status,
            notes,
            verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', paymentId)
        : supabase.from('payments').update({
            status,
            notes,
            verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('student_id', paymentId).in('payment_type', ['daftar_ulang', 'bam']);

      const { error: updateErr } = await query;
      if (updateErr) {
        return { success: false, error: new Error(updateErr.message) };
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
      if (updates.paymentDate !== undefined) {
        payload.payment_date = updates.paymentDate && updates.paymentDate.trim() ? updates.paymentDate.trim() : null;
      }
      if (updates.verifiedBy !== undefined) payload.verified_by = updates.verifiedBy;
      if (updates.verifiedAt !== undefined) {
        payload.verified_at = updates.verifiedAt && updates.verifiedAt.trim() ? updates.verifiedAt.trim() : null;
      }
      if (updates.notes !== undefined) payload.notes = updates.notes;

      let data: any = null;
      let error: any = null;

      if (isValidUuid(id)) {
        const res = await supabase
          .from('payments')
          .update(payload)
          .eq('id', id)
          .select()
          .maybeSingle();
        data = res.data;
        error = res.error;
      } else if (updates.studentId) {
        const res = await supabase
          .from('payments')
          .update(payload)
          .eq('student_id', updates.studentId)
          .in('payment_type', ['daftar_ulang', 'bam'])
          .select()
          .maybeSingle();
        data = res.data;
        error = res.error;
      } else {
        // Fallback: look for payment by notes or other fields
        const res = await supabase
          .from('payments')
          .update(payload)
          .eq('id', id)
          .select()
          .maybeSingle();
        data = res.data;
        error = res.error;
      }

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      // Sync student status if status or amount changed
      const targetStudentId = updates.studentId || data?.student_id;
      if (targetStudentId) {
        const isBAM = !data || data.payment_type === 'daftar_ulang' || data.payment_type === 'bam' || updates.paymentType === 'bam';
        if (isBAM) {
          const studentUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
          if (updates.status !== undefined) studentUpdates.initial_payment_status = updates.status;
          if (updates.amount !== undefined) studentUpdates.initial_payment_amount = updates.amount;
          if (updates.notes !== undefined) studentUpdates.initial_payment_notes = updates.notes;
          if (updates.proofUrl !== undefined) studentUpdates.initial_payment_proof_url = updates.proofUrl;
          if (updates.paymentDate !== undefined) studentUpdates.initial_payment_date = updates.paymentDate;
          if (updates.status === 'verified') {
            studentUpdates.status = 're_registered';
          }
          await supabase.from('students').update(studentUpdates).eq('id', targetStudentId);
        } else if (updates.status) {
          await supabase.from('students').update({
            form_payment_status: updates.status,
            is_form_verified: updates.status === 'verified',
            updated_at: new Date().toISOString(),
          }).eq('id', targetStudentId);
        }
      }

      return { data: data ? mapRowToPayment(data) : null, error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Menghapus record pembayaran dan memperbarui status siswa jika diperlukan
   */
  async remove(id: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      let existing: any = null;
      if (isValidUuid(id)) {
        const { data } = await supabase.from('payments').select('*').eq('id', id).maybeSingle();
        existing = data;
        const { error } = await supabase.from('payments').delete().eq('id', id);
        if (error) {
          return { success: false, error: new Error(error.message) };
        }
      } else {
        // Fallback jika id bukan uuid: coba cari by student_id
        const { data } = await supabase.from('payments').select('*').eq('student_id', id).maybeSingle();
        existing = data;
        if (existing?.id) {
          await supabase.from('payments').delete().eq('id', existing.id);
        }
      }

      if (existing && existing.student_id) {
        const isForm = existing.payment_type === 'formulir' || existing.payment_type === 'form';
        if (isForm) {
          await supabase.from('students').update({
            form_payment_status: 'unpaid',
            is_form_verified: false,
            updated_at: new Date().toISOString(),
          }).eq('id', existing.student_id);
        } else {
          await supabase.from('students').update({
            initial_payment_status: 'unpaid',
            initial_payment_amount: 0,
            initial_payment_proof_url: null,
            initial_payment_notes: null,
            updated_at: new Date().toISOString(),
          }).eq('id', existing.student_id);
        }
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },
};
