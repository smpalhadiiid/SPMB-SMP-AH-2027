// =====================================================================
// src/components/payment/ReceiptVerificationPage.tsx
// Halaman Verifikasi Keabsahan Kuitansi Pembayaran Online
// SMPS Al-Hadiid Cileungsi
//
// Akses publik untuk scan QR code pada kuitansi fisik/digital.
// Data diverifikasi langsung ke tabel database Supabase secara real-time.
// =====================================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { SchoolLogo } from '../SchoolLogo';
import { formatRupiah } from '../../utils/pdf';
import { formatTerbilangRupiah } from '../../utils/receiptNumber';
import { getStoredSchoolInfo } from '../../utils/storage';
import {
  ShieldCheck, CheckCircle2, AlertTriangle, ArrowLeft,
  Calendar, FileText, User, DollarSign, Building2, RefreshCw
} from 'lucide-react';

interface ReceiptVerificationPageProps {
  receiptNumber: string;
  onBackToHome: () => void;
}

export const ReceiptVerificationPage: React.FC<ReceiptVerificationPageProps> = ({
  receiptNumber,
  onBackToHome,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [paymentData, setPaymentData] = useState<any | null>(null);
  const [errorNotFound, setErrorNotFound] = useState<boolean>(false);
  const schoolInfo = getStoredSchoolInfo();

  useEffect(() => {
    async function verifyReceipt() {
      setIsLoading(true);
      setErrorNotFound(false);
      try {
        const cleanNo = decodeURIComponent(receiptNumber).trim();

        // 1. Cari berdasarkan receipt_number di tabel public.payments
        let { data, error } = await supabase
          .from('payments')
          .select('*, student:students(*)')
          .eq('receipt_number', cleanNo)
          .maybeSingle();

        // 2. Fallback jika nomor adalah transaction ID
        if (!data) {
          const resId = await supabase
            .from('payments')
            .select('*, student:students(*)')
            .eq('id', cleanNo)
            .maybeSingle();
          data = resId.data;
        }

        if (data) {
          setPaymentData(data);
        } else {
          setErrorNotFound(true);
        }
      } catch (err) {
        console.warn('Verifikasi kuitansi error:', err);
        setErrorNotFound(true);
      } finally {
        setIsLoading(false);
      }
    }

    if (receiptNumber) {
      verifyReceipt();
    } else {
      setErrorNotFound(true);
      setIsLoading(false);
    }
  }, [receiptNumber]);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-4 sm:p-6 md:p-10 font-sans">
      <div className="max-w-xl w-full mx-auto space-y-6">
        {/* TOP BAR / BACK */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToHome}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-2 border border-slate-700 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Beranda SPMB</span>
          </button>

          <span className="text-xs text-slate-400 font-mono">
            Sistem Verifikasi Kuitansi Online
          </span>
        </div>

        {/* CARD UTAMA VERIFIKASI */}
        <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6">
          {/* HEADER SEKOLAH */}
          <div className="flex items-center gap-3.5 border-b border-slate-200 pb-4">
            <SchoolLogo className="w-14 h-14 shrink-0 object-contain" />
            <div>
              <h1 className="text-base font-black text-slate-900 leading-tight">
                {schoolInfo.name || 'SMPS AL-HADIID CILEUNGSI'}
              </h1>
              <p className="text-[11px] text-slate-500">
                Pusat Verifikasi Dokumen & Kuitansi Pembayaran SPMB
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <div className="text-xs font-bold text-slate-600">
                Memverifikasi keabsahan kuitansi di database server...
              </div>
            </div>
          ) : errorNotFound || !paymentData ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-black text-rose-700">
                  Nomor Kuitansi Tidak Ditemukan
                </h2>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Nomor kuitansi <span className="font-mono font-bold text-slate-800">"{receiptNumber}"</span> tidak terdaftar dalam database resmi pembayaran SMPS Al-Hadiid Cileungsi.
                </p>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-800">
                Pastikan nomor kuitansi yang dipindai telah sesuai atau hubungi panitia administrasi keuangan SPMB.
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* VALIDATION BANNER */}
              <div className="p-4 bg-emerald-500/10 border-2 border-emerald-500 rounded-2xl flex items-center gap-3 text-emerald-900">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                <div>
                  <h2 className="text-sm sm:text-base font-black text-emerald-900 uppercase tracking-wide">
                    ✓ KUITANSI RESMI VALID & TERVERIFIKASI
                  </h2>
                  <p className="text-[11px] text-emerald-800">
                    Dokumen pembayaran ini sah, tercatat dalam pembukuan kas resmi SMPS Al-Hadiid.
                  </p>
                </div>
              </div>

              {/* DETAIL TRANSAKSI */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3 text-xs">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500 font-medium">Nomor Kuitansi:</span>
                  <span className="font-mono font-black text-slate-900">
                    {paymentData.receipt_number || receiptNumber}
                  </span>
                </div>

                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500 font-medium">Nama Calon Murid:</span>
                  <strong className="text-slate-950 uppercase">
                    {paymentData.student_name || paymentData.student?.fullName || '-'}
                  </strong>
                </div>

                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500 font-medium">Nomor Pendaftaran:</span>
                  <strong className="font-mono text-indigo-700">
                    {paymentData.registration_number || paymentData.student?.registrationNumber || '-'}
                  </strong>
                </div>

                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500 font-medium">Jenis Pembayaran:</span>
                  <span className="font-bold text-slate-800 uppercase">
                    {paymentData.payment_type === 'daftar_ulang' || paymentData.payment_type === 'bam'
                      ? 'Biaya Awal Masuk (BAM)'
                      : 'Formulir Pendaftaran SPMB'}
                  </span>
                </div>

                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500 font-medium">Tanggal Transaksi:</span>
                  <span className="font-bold text-slate-900">
                    {paymentData.payment_date
                      ? new Date(paymentData.payment_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                      : '-'}
                  </span>
                </div>

                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500 font-medium">Metode Pembayaran:</span>
                  <span className="font-bold text-slate-800">
                    {paymentData.payment_method || 'Transfer Bank BSI'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Status Verifikasi:</span>
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[10px]">
                    ✓ {String(paymentData.status || 'verified').toUpperCase()}
                  </span>
                </div>
              </div>

              {/* HIGHLIGHT NOMINAL */}
              <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 text-center space-y-1">
                <div className="text-[11px] font-bold text-emerald-800 uppercase">
                  Nominal Pembayaran Resmi:
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-900">
                  {formatRupiah(paymentData.amount)}
                </div>
                <div className="text-[11px] text-slate-600 italic">
                  "{formatTerbilangRupiah(paymentData.amount)}"
                </div>
              </div>
            </div>
          )}

          {/* FOOTER KETERANGAN */}
          <div className="text-center text-[10px] text-slate-400 pt-2 border-t border-slate-100">
            Sistem Penerimaan Murid Baru (SPMB) • SMPS Al-Hadiid Cileungsi
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-slate-500 mt-6">
        © {new Date().getFullYear()} SMPS Al-Hadiid Cileungsi. Hak cipta dilindungi.
      </div>
    </div>
  );
};
