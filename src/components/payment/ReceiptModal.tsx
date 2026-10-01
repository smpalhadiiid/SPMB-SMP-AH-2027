// =====================================================================
// src/components/payment/ReceiptModal.tsx
// Modal Preview Kuitansi Pembayaran Resmi SPMB (Formulir & BAM)
// SMPS Al-Hadiid Cileungsi
//
// FITUR:
// - Desain Resmi Kuitansi Sesuai Kop & Logo Sekolah
// - Nomor Kuitansi Unik (KWT-FRM-YYYY-XXXXX / KWT-BAM-YYYY-XXXXX)
// - Terbilang Rupiah Akurat
// - Rincian BAM Khusus (Total Kewajiban, Sebelum, Saat Ini, Total Terbayar, Sisa Tunggakan)
// - Tombol [CETAK] & [DOWNLOAD PDF]
// =====================================================================

import React, { useRef } from 'react';
import { StudentData, SchoolInfo } from '../../types';
import { SchoolLogo } from '../SchoolLogo';
import { formatRupiah } from '../../utils/pdf';
import { formatTerbilangRupiah, getReceiptVerificationUrl } from '../../utils/receiptNumber';
import { generatePaymentReceiptPDF } from '../../utils/pdfGenerator';
import { getKepalaSekolahName, getStoredSchoolInfo } from '../../utils/storage';
import {
  Printer, Download, X, CheckCircle2, ShieldCheck,
  QrCode, AlertCircle, Building2, Calendar, User, FileText
} from 'lucide-react';

export interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: any;
  student?: StudentData | null;
  schoolInfo?: SchoolInfo;
  bamDetails?: {
    totalBam: number;
    previousPaid: number;
    currentPaid: number;
    totalPaidToDate: number;
    remainingBalance: number;
  };
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  payment,
  student,
  schoolInfo: propSchoolInfo,
  bamDetails,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const effectiveSchoolInfo = propSchoolInfo || getStoredSchoolInfo();

  if (!isOpen || !payment) return null;

  const statusStr = String(payment.status || payment.verification_status || 'verified').toLowerCase();
  const isVerified = statusStr === 'verified' || statusStr === 'lunas';

  const paymentType = String(payment.payment_type || payment.paymentType || 'form').toLowerCase();
  const isForm = paymentType.includes('form') || paymentType.includes('formulir');
  const typeLabel = isForm
    ? 'KUITANSI PEMBAYARAN FORMULIR'
    : 'KUITANSI PEMBAYARAN BIAYA AWAL MASUK (BAM)';

  const amount = Number(payment.amount || payment.amountPaid || 0);
  const academicYear = effectiveSchoolInfo?.academicYear || '2027/2028';
  const year4 = academicYear.replace(/[^0-9]/g, '').slice(0, 4) || '2027';

  const receiptNumber = payment.receipt_number || payment.receiptNumber ||
    (isForm ? `KWT-FRM-${year4}-${String(payment.id || '00001').slice(-5)}` : `KWT-BAM-${year4}-${String(payment.id || '00001').slice(-5)}`);

  const paymentDateStr = payment.payment_date || payment.paymentDate || payment.created_at || new Date().toISOString().split('T')[0];
  const dateFormatted = new Date(paymentDateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const parentName = student?.fatherName || student?.motherName || student?.guardianName || '-';
  const verifiedBy = payment.verified_by || 'Panitia Keuangan SPMB';
  const kepsekName = getKepalaSekolahName(effectiveSchoolInfo);

  const handleDownloadPDF = () => {
    generatePaymentReceiptPDF(payment, student, effectiveSchoolInfo, bamDetails);
  };

  const handlePrint = () => {
    // Jalankan fungsi cetak browser dengan layout rapi
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* MODAL ACTION BAR AT TOP */}
        <div className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="font-extrabold text-sm tracking-wide">
              Pratinjau Kuitansi Pembayaran Resmi
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isVerified && (
              <>
                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
                  title="Cetak Kuitansi"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-300" />
                  <span className="hidden sm:inline">CETAK</span>
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  title="Unduh Berkas PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>DOWNLOAD PDF</span>
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* RECEIPT CONTENT AREA */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-4" ref={receiptRef}>
          {!isVerified ? (
            <div className="bg-amber-50 border-2 border-amber-300 p-6 rounded-2xl text-center space-y-3">
              <AlertCircle className="w-12 h-12 text-amber-600 mx-auto" />
              <h3 className="text-base font-extrabold text-amber-900">
                Kuitansi Resmi Belum Tersedia
              </h3>
              <p className="text-xs text-amber-800 max-w-md mx-auto">
                Transaksi pembayaran ini masih berstatus <strong>MENUNGGU VERIFIKASI</strong> atau belum disetujui oleh panitia keuangan. Kuitansi resmi bernomor sah hanya dapat diterbitkan setelah pembayaran diverifikasi.
              </p>
            </div>
          ) : (
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-300 shadow-sm space-y-6 text-slate-800 font-sans print:border-none print:shadow-none print:p-0">
              {/* KOP RESMI SEKOLAH */}
              <div className="flex items-center gap-4 border-b-2 border-slate-900 pb-4">
                <SchoolLogo className="w-16 h-16 shrink-0 object-contain" />
                <div className="flex-1">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    YAYASAN AL-HADIID CILEUNGSI
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-950 tracking-tight leading-tight">
                    {effectiveSchoolInfo.name || 'SMPS AL-HADIID CILEUNGSI'}
                  </h2>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    {effectiveSchoolInfo.address || 'Jl. Melati Raya Komp. PT Semen Cibinong, Cileungsi, Bogor 16820'}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Telp: {effectiveSchoolInfo.phone || '0812-3456-7890'} • Email: {effectiveSchoolInfo.email || 'info@smpalhadiid.sch.id'} • NPSN: {effectiveSchoolInfo.npsn || '20200000'}
                  </div>
                </div>
              </div>

              {/* JUDUL KUITANSI & NOMOR KUITANSI */}
              <div className="text-center space-y-1">
                <h3 className="text-base sm:text-lg font-black text-slate-950 uppercase tracking-wide">
                  {typeLabel}
                </h3>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900 text-amber-300 rounded-lg text-xs font-mono font-bold shadow-xs">
                  <span>Nomor Kuitansi: {receiptNumber}</span>
                </div>
                <div className="text-[11px] text-slate-500 font-semibold">
                  Tahun Pelajaran: {academicYear}
                </div>
              </div>

              {/* DATA TRANSAKSI PEMBAYARAN */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
                  <div className="flex justify-between sm:justify-start gap-2">
                    <span className="text-slate-500 w-36 shrink-0">Nomor Transaksi:</span>
                    <strong className="font-mono text-slate-900">{payment.transactionNumber || payment.transaction_number || payment.id}</strong>
                  </div>
                  <div className="flex justify-between sm:justify-start gap-2">
                    <span className="text-slate-500 w-36 shrink-0">Tanggal Pembayaran:</span>
                    <strong className="text-slate-900">{dateFormatted}</strong>
                  </div>
                  <div className="flex justify-between sm:justify-start gap-2">
                    <span className="text-slate-500 w-36 shrink-0">Nomor Pendaftaran:</span>
                    <strong className="font-mono text-indigo-700">{student?.registrationNumber || payment.registration_number || '-'}</strong>
                  </div>
                  <div className="flex justify-between sm:justify-start gap-2">
                    <span className="text-slate-500 w-36 shrink-0">Nama Calon Murid:</span>
                    <strong className="text-slate-950 uppercase">{student?.fullName || payment.student_name || 'Calon Murid'}</strong>
                  </div>
                  <div className="flex justify-between sm:justify-start gap-2">
                    <span className="text-slate-500 w-36 shrink-0">Jenis Kelamin:</span>
                    <span className="font-semibold text-slate-800">{student?.gender || payment.gender || 'Laki-laki'}</span>
                  </div>
                  <div className="flex justify-between sm:justify-start gap-2">
                    <span className="text-slate-500 w-36 shrink-0">Nama Orang Tua/Wali:</span>
                    <span className="font-semibold text-slate-800">{parentName}</span>
                  </div>
                  <div className="flex justify-between sm:justify-start gap-2">
                    <span className="text-slate-500 w-36 shrink-0">Metode Pembayaran:</span>
                    <span className="font-semibold text-slate-800">{payment.payment_method || payment.paymentMethod || 'Transfer Bank BSI'}</span>
                  </div>
                  <div className="flex justify-between sm:justify-start gap-2">
                    <span className="text-slate-500 w-36 shrink-0">Status:</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-bold text-[10px]">
                      ✓ TERVERIFIKASI (KAS MASUK RESMI)
                    </span>
                  </div>
                </div>
              </div>

              {/* KOTAK NOMINAL BESAR & TERBILANG */}
              <div className="bg-emerald-50/70 border-2 border-emerald-300 rounded-2xl p-4 sm:p-5 space-y-2">
                <div className="text-[11px] font-bold text-emerald-900 uppercase tracking-wide">
                  Jumlah Pembayaran Saat Ini (Nominal Transaksi):
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-800">
                  {formatRupiah(amount)}
                </div>
                <div className="text-xs text-slate-700 italic bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                  <span className="font-bold not-italic text-slate-900">Terbilang:</span> "{formatTerbilangRupiah(amount)}"
                </div>
              </div>

              {/* KHUSUS KUITANSI BAM: TABEL REKAPITULASI PEMBAYARAN & SISA TUNGGAKAN (SECTION 5) */}
              {!isForm && bamDetails && (
                <div className="space-y-2">
                  <div className="font-extrabold text-xs text-slate-800 uppercase tracking-wide">
                    Rekapitulasi Kewajiban BAM & Sisa Saldo:
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left border-collapse">
                      <tbody className="divide-y divide-slate-100">
                        <tr className="bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-600">Total Kewajiban BAM</td>
                          <td className="p-2.5 font-extrabold text-right text-slate-900">{formatRupiah(bamDetails.totalBam)}</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 text-slate-600">Pembayaran Sebelumnya</td>
                          <td className="p-2.5 font-bold text-right text-slate-700">{formatRupiah(bamDetails.previousPaid)}</td>
                        </tr>
                        <tr className="bg-emerald-50/40">
                          <td className="p-2.5 font-bold text-emerald-900">Pembayaran Saat Ini (Kuitansi Ini)</td>
                          <td className="p-2.5 font-black text-right text-emerald-700">{formatRupiah(bamDetails.currentPaid || amount)}</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-bold text-slate-800">Total Pembayaran Sampai Saat Ini</td>
                          <td className="p-2.5 font-extrabold text-right text-slate-900">{formatRupiah(bamDetails.totalPaidToDate)}</td>
                        </tr>
                        <tr className="bg-rose-50/50">
                          <td className="p-2.5 font-extrabold text-rose-800">Sisa Tunggakan BAM</td>
                          <td className="p-2.5 font-black text-right text-rose-600">
                            {bamDetails.remainingBalance === 0 ? 'Rp 0 (LUNAS)' : formatRupiah(bamDetails.remainingBalance)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* KETERANGAN / CATATAN */}
              {(payment.notes || payment.rejection_reason) && (
                <div className="text-xs bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-start gap-2 text-slate-700">
                  <FileText className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-900">Keterangan:</span> {payment.notes || payment.rejection_reason}
                  </div>
                </div>
              )}

              {/* AREA TANDA TANGAN & QR VERIFIKASI */}
              <div className="pt-4 border-t border-slate-200 flex items-end justify-between text-xs text-slate-700">
                {/* QR Code Verifikasi */}
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl border border-slate-300 shadow-xs text-center">
                    <QrCode className="w-14 h-14 text-slate-900 mx-auto" />
                    <span className="text-[8px] font-bold text-slate-500 block mt-1">SCAN VERIFIKASI</span>
                  </div>
                  <div className="text-[10px] text-slate-500 max-w-[160px] leading-tight">
                    Pindai QR Code untuk memeriksa keabsahan kuitansi secara online pada sistem SPMB Al-Hadiid.
                  </div>
                </div>

                {/* Tanda Tangan Pejabat */}
                <div className="text-center space-y-1">
                  <div>Cileungsi, {dateFormatted}</div>
                  <div className="font-bold text-slate-900">Panitia SPMB / Kasir Keuangan,</div>
                  <div className="pt-10 font-black text-slate-950 border-b border-slate-900">
                    {verifiedBy}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    SMPS AL-HADIID CILEUNGSI
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-mono">
            {receiptNumber}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Tutup Kuitansi
          </button>
        </div>
      </div>
    </div>
  );
};
