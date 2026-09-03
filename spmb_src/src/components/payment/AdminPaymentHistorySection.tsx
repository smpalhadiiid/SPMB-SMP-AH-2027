import React, { useState } from 'react';
import { FormPaymentRecord, BamPaymentRecord } from '../../types';
import { getStoredFormPayments, getStoredBamPayments } from '../../utils/storage';
import { exportToExcel } from '../../utils/excelExporter';
import { generateReportPDF } from '../../utils/pdfGenerator';
import {
  Users, Search, Download, FileSpreadsheet, FileText,
  CreditCard, Calculator, CheckCircle2, User, Filter, Database
} from 'lucide-react';
import { PaymentSqlModal } from './PaymentSqlModal';

export const AdminPaymentHistorySection: React.FC = () => {
  const formPayments = getStoredFormPayments();
  const bamPayments = getStoredBamPayments();

  // Primary Tab: Gender Separation (Laki-laki vs Perempuan)
  const [activeGender, setActiveGender] = useState<'Laki-laki' | 'Perempuan'>('Laki-laki');
  // Secondary Tab: Payment Module (Formulir vs BAM)
  const [activeModule, setActiveModule] = useState<'form' | 'bam'>('form');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSqlModal, setShowSqlModal] = useState(false);

  // Filter form payments by gender
  const genderFormPayments = formPayments.filter(
    r => r.gender === activeGender &&
    (r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
     r.transactionNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
     r.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Filter BAM payments by gender
  const genderBamPayments = bamPayments.filter(
    r => r.gender === activeGender &&
    (r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
     r.transactionNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
     r.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Totals for active gender
  const totalFormPaidGender = genderFormPayments.reduce((acc, curr) => acc + curr.amount, 0);
  const totalBamPaidGender = genderBamPayments.reduce((acc, curr) => acc + curr.amountPaid, 0);

  // Export Excel
  const handleExportExcel = () => {
    if (activeModule === 'form') {
      const data = genderFormPayments.map((r, i) => ({
        No: i + 1,
        No_Transaksi: r.transactionNumber,
        No_Pendaftaran: r.registrationNumber,
        Tanggal_Bayar: r.paymentDate,
        Nama_Murid: r.studentName,
        Jenis_Kelamin: r.gender,
        Nominal: r.amount,
        Keterangan: r.category,
        Catatan: r.notes || '-',
      }));
      exportToExcel(data, `Riwayat_Pembayaran_Formulir_${activeGender}_SPMB_AlHadiid`);
    } else {
      const data = genderBamPayments.map((r, i) => ({
        No: i + 1,
        No_Transaksi: r.transactionNumber,
        No_Pendaftaran: r.registrationNumber,
        Tanggal_Bayar: r.paymentDate,
        Nama_Murid: r.studentName,
        Jenis_Kelamin: r.gender,
        Total_BAM: r.totalBamCost,
        Nominal_Bayar: r.amountPaid,
        Status_Cicilan: r.installmentType,
        Total_Terbayar: r.totalPaidToDate,
        Sisa_Saldo: r.remainingBalance,
        Catatan: r.notes || '-',
      }));
      exportToExcel(data, `Riwayat_Pembayaran_BAM_${activeGender}_SPMB_AlHadiid`);
    }
  };

  // Export PDF
  const handleExportPDF = () => {
    if (activeModule === 'form') {
      const data = genderFormPayments.map((r, i) => ({
        No: i + 1,
        No_Transaksi: r.transactionNumber,
        Tanggal: r.paymentDate,
        Nama_Murid: r.studentName,
        JK: r.gender,
        Nominal: `Rp ${r.amount.toLocaleString('id-ID')}`,
        Kategori: r.category,
      }));
      generateReportPDF(
        `Laporan_Riwayat_Formulir_${activeGender}`,
        data,
        ['No', 'No_Transaksi', 'Tanggal', 'Nama_Murid', 'JK', 'Nominal', 'Kategori']
      );
    } else {
      const data = genderBamPayments.map((r, i) => ({
        No: i + 1,
        No_Transaksi: r.transactionNumber,
        Tanggal: r.paymentDate,
        Nama_Murid: r.studentName,
        Cicilan: r.installmentType,
        Bayar: `Rp ${r.amountPaid.toLocaleString('id-ID')}`,
        Terbayar: `Rp ${r.totalPaidToDate.toLocaleString('id-ID')}`,
        Saldo_Sisa: `Rp ${r.remainingBalance.toLocaleString('id-ID')}`,
      }));
      generateReportPDF(
        `Laporan_Riwayat_BAM_${activeGender}`,
        data,
        ['No', 'No_Transaksi', 'Tanggal', 'Nama_Murid', 'Cicilan', 'Bayar', 'Terbayar', 'Saldo_Sisa']
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-bold mb-2">
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            <span>Terpisah Berdasarkan Gender</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Riwayat Pembayaran Calon Murid
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Data riwayat transaksi pembayaran Formulir dan BAM terpisah untuk Calon Murid Laki-Laki dan Perempuan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowSqlModal(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Database className="w-4 h-4 text-white" />
            <span>Skrip SQL</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Cetak PDF</span>
          </button>
        </div>
      </div>

      {/* Main Gender Navigation Switcher */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-200 p-1.5 rounded-2xl">
        <button
          onClick={() => setActiveGender('Laki-laki')}
          className={`py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeGender === 'Laki-laki'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-700 hover:bg-slate-300'
          }`}
        >
          <span>♂️ Calon Murid Laki-Laki (Ikhwan)</span>
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-[11px] shrink-0">
            {formPayments.filter(f => f.gender === 'Laki-laki').length + bamPayments.filter(b => b.gender === 'Laki-laki').length} TRX
          </span>
        </button>

        <button
          onClick={() => setActiveGender('Perempuan')}
          className={`py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeGender === 'Perempuan'
              ? 'bg-pink-600 text-white shadow-md'
              : 'text-slate-700 hover:bg-slate-300'
          }`}
        >
          <span>♀️ Calon Murid Perempuan (Akhwat)</span>
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-[11px] shrink-0">
            {formPayments.filter(f => f.gender === 'Perempuan').length + bamPayments.filter(b => b.gender === 'Perempuan').length} TRX
          </span>
        </button>
      </div>

      {/* Gender Financial Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className={`p-4 rounded-2xl border shadow-sm ${
          activeGender === 'Laki-laki' ? 'bg-blue-50/70 border-blue-200' : 'bg-pink-50/70 border-pink-200'
        }`}>
          <div className="text-[11px] font-bold uppercase text-slate-500">
            Total Pembayaran Formulir ({activeGender})
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
            Rp {totalFormPaidGender.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
            {genderFormPayments.length} Transaksi Terverifikasi
          </div>
        </div>

        <div className={`p-4 rounded-2xl border shadow-sm ${
          activeGender === 'Laki-laki' ? 'bg-blue-50/70 border-blue-200' : 'bg-pink-50/70 border-pink-200'
        }`}>
          <div className="text-[11px] font-bold uppercase text-slate-500">
            Total Dana BAM Terkumpul ({activeGender})
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
            Rp {totalBamPaidGender.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
            {genderBamPayments.length} Transaksi (Lunas & Cicilan 1-10)
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between sm:col-span-2 lg:col-span-1">
          <div className="text-[11px] font-bold uppercase text-slate-500">Total Kombinasi Penerimaan</div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-800">
            Rp {(totalFormPaidGender + totalBamPaidGender).toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-emerald-600 font-bold">Lunas Terdata Sistem</div>
        </div>
      </div>

      {/* Module Selector & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveModule('form')}
            className={`px-3.5 sm:px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
              activeModule === 'form'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>Formulir ({genderFormPayments.length})</span>
          </button>

          <button
            onClick={() => setActiveModule('bam')}
            className={`px-3.5 sm:px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
              activeModule === 'bam'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Calculator className="w-4 h-4 shrink-0" />
            <span>BAM & Cicilan ({genderBamPayments.length})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari Nama / No Reg / Transaksi..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-slate-500"
          />
        </div>
      </div>

      {/* Module Table 1: Form Payments */}
      {activeModule === 'form' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span>Riwayat Pembayaran Formulir - Calon Murid {activeGender}</span>
            </h3>
            <span className="text-xs text-slate-500">
              Total: <strong className="text-emerald-700 font-extrabold">Rp {totalFormPaidGender.toLocaleString('id-ID')}</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-100 border-b font-bold text-slate-700 whitespace-nowrap">
                  <th className="p-3">No</th>
                  <th className="p-3">No. Transaksi</th>
                  <th className="p-3">No. Registration</th>
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Nama Calon Murid</th>
                  <th className="p-3">Gender</th>
                  <th className="p-3">Nominal</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {genderFormPayments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                      Belum ada riwayat pembayaran formulir untuk calon murid {activeGender}.
                    </td>
                  </tr>
                ) : (
                  genderFormPayments.map((r, i) => (
                    <tr key={r.id} className="hover:bg-slate-50 font-medium whitespace-nowrap">
                      <td className="p-3 text-slate-500 font-mono">{i + 1}</td>
                      <td className="p-3 font-mono font-bold text-blue-700">{r.transactionNumber}</td>
                      <td className="p-3 font-mono text-slate-600">{r.registrationNumber}</td>
                      <td className="p-3 text-slate-600">{r.paymentDate}</td>
                      <td className="p-3 font-bold text-slate-900">{r.studentName}</td>
                      <td className="p-3 font-semibold">{r.gender}</td>
                      <td className="p-3 font-extrabold text-emerald-700">
                        Rp {r.amount.toLocaleString('id-ID')}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                          {r.category}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500">{r.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Module Table 2: BAM & Cicilan Payments */}
      {activeModule === 'bam' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span>Riwayat Biaya Awal Masuk (BAM) & Angsuran - Calon Murid {activeGender}</span>
            </h3>
            <span className="text-xs text-slate-500">
              Total Terkumpul: <strong className="text-blue-700 font-extrabold">Rp {totalBamPaidGender.toLocaleString('id-ID')}</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-slate-100 border-b font-bold text-slate-700 whitespace-nowrap">
                  <th className="p-3">No</th>
                  <th className="p-3">No. Transaksi</th>
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Nama Calon Murid</th>
                  <th className="p-3">Gender</th>
                  <th className="p-3">Total BAM</th>
                  <th className="p-3">Bayar Transaksi ini</th>
                  <th className="p-3">Skema / Cicilan</th>
                  <th className="p-3">Total Terbayar</th>
                  <th className="p-3">Saldo Sisa Tagihan</th>
                  <th className="p-3">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {genderBamPayments.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400 italic">
                      Belum ada riwayat pembayaran BAM untuk calon murid {activeGender}.
                    </td>
                  </tr>
                ) : (
                  genderBamPayments.map((r, i) => (
                    <tr key={r.id} className="hover:bg-slate-50 font-medium whitespace-nowrap">
                      <td className="p-3 text-slate-500 font-mono">{i + 1}</td>
                      <td className="p-3 font-mono font-bold text-blue-700">{r.transactionNumber}</td>
                      <td className="p-3 text-slate-600">{r.paymentDate}</td>
                      <td className="p-3 font-bold text-slate-900">{r.studentName}</td>
                      <td className="p-3 font-semibold">{r.gender}</td>
                      <td className="p-3 text-slate-600 font-semibold">
                        Rp {r.totalBamCost.toLocaleString('id-ID')}
                      </td>
                      <td className="p-3 font-extrabold text-blue-700">
                        Rp {r.amountPaid.toLocaleString('id-ID')}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          r.installmentType === 'Lunas' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {r.installmentType}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-800">
                        Rp {r.totalPaidToDate.toLocaleString('id-ID')}
                      </td>
                      <td className="p-3">
                        {r.remainingBalance === 0 ? (
                          <span className="font-extrabold text-emerald-600">✓ LUNAS</span>
                        ) : (
                          <span className="font-extrabold text-rose-600">
                            Rp {r.remainingBalance.toLocaleString('id-ID')}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-500">{r.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SQL Modal */}
      <PaymentSqlModal
        isOpen={showSqlModal}
        onClose={() => setShowSqlModal(false)}
        formPayments={formPayments}
        bamPayments={bamPayments}
      />
    </div>
  );
};
