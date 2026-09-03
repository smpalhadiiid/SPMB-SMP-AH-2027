import React, { useState } from 'react';
import { SchoolInfo } from '../../types';
import { getStoredFormPayments, getStoredBamPayments } from '../../utils/storage';
import { exportToExcel } from '../../utils/excelExporter';
import { generateReportPDF } from '../../utils/pdfGenerator';
import {
  FileText, FileSpreadsheet, ShieldCheck, DollarSign,
  TrendingUp, Users, CheckCircle2, PieChart, Filter, Database
} from 'lucide-react';
import { PaymentSqlModal } from './PaymentSqlModal';

interface KepsekPaymentReportSectionProps {
  schoolInfo: SchoolInfo;
}

export const KepsekPaymentReportSection: React.FC<KepsekPaymentReportSectionProps> = ({
  schoolInfo,
}) => {
  const formPayments = getStoredFormPayments();
  const bamPayments = getStoredBamPayments();

  const [genderFilter, setGenderFilter] = useState<'all' | 'Laki-laki' | 'Perempuan'>('all');
  const [activeReportTab, setActiveReportTab] = useState<'all' | 'form' | 'bam'>('all');
  const [showSqlModal, setShowSqlModal] = useState(false);

  // Filtered lists
  const filteredForm = formPayments.filter(r => genderFilter === 'all' || r.gender === genderFilter);
  const filteredBam = bamPayments.filter(r => genderFilter === 'all' || r.gender === genderFilter);

  // Financial Metrics Calculations
  const totalFormAmount = formPayments.reduce((acc, curr) => acc + curr.amount, 0);
  const totalBamAmount = bamPayments.reduce((acc, curr) => acc + curr.amountPaid, 0);

  const formInternalAmount = formPayments.filter(r => r.category === 'Internal').reduce((a, c) => a + c.amount, 0);
  const formEksternalAmount = formPayments.filter(r => r.category === 'Eksternal').reduce((a, c) => a + c.amount, 0);
  const formBazaarAmount = formPayments.filter(r => r.category === 'Bazaar').reduce((a, c) => a + c.amount, 0);

  const totalRemainingBalance = bamPayments.reduce((acc, curr) => acc + curr.remainingBalance, 0);

  const maleFormAmount = formPayments.filter(r => r.gender === 'Laki-laki').reduce((a, c) => a + c.amount, 0);
  const femaleFormAmount = formPayments.filter(r => r.gender === 'Perempuan').reduce((a, c) => a + c.amount, 0);

  const maleBamAmount = bamPayments.filter(r => r.gender === 'Laki-laki').reduce((a, c) => a + c.amountPaid, 0);
  const femaleBamAmount = bamPayments.filter(r => r.gender === 'Perempuan').reduce((a, c) => a + c.amountPaid, 0);


  // Export Executive Financial PDF
  const handleExportPDF = () => {
    const reportData = [
      ...filteredForm.map(r => ({
        Jenis: 'Formulir',
        No_TRX: r.transactionNumber,
        No_Reg: r.registrationNumber,
        Nama: r.studentName,
        JK: r.gender,
        Ket_Cicilan: r.category,
        Bayar: `Rp ${r.amount.toLocaleString('id-ID')}`,
        Sisa_Saldo: '-',
      })),
      ...filteredBam.map(r => ({
        Jenis: 'Biaya Awal Masuk',
        No_TRX: r.transactionNumber,
        No_Reg: r.registrationNumber,
        Nama: r.studentName,
        JK: r.gender,
        Ket_Cicilan: r.installmentType,
        Bayar: `Rp ${r.amountPaid.toLocaleString('id-ID')}`,
        Sisa_Saldo: `Rp ${r.remainingBalance.toLocaleString('id-ID')}`,
      })),
    ];

    generateReportPDF(
      `Laporan_Keuangan_Kepsek_SPMB_${schoolInfo.academicYear.replace('/', '_')}`,
      reportData,
      ['Jenis', 'No_TRX', 'No_Reg', 'Nama', 'JK', 'Ket_Cicilan', 'Bayar', 'Sisa_Saldo']
    );
  };

  // Export Executive Financial Excel
  const handleExportExcel = () => {
    const formExport = formPayments.map((r, i) => ({
      No: i + 1,
      Kategori_Laporan: 'Pembayaran Formulir',
      No_Transaksi: r.transactionNumber,
      No_Pendaftaran: r.registrationNumber,
      Tanggal_Bayar: r.paymentDate,
      Nama_Murid: r.studentName,
      Jenis_Kelamin: r.gender,
      Nominal_Bayar: r.amount,
      Kategori_Sumber: r.category,
      Catatan: r.notes || '-',
    }));

    const bamExport = bamPayments.map((r, i) => ({
      No: i + 1,
      Kategori_Laporan: 'Biaya Awal Masuk (BAM)',
      No_Transaksi: r.transactionNumber,
      No_Pendaftaran: r.registrationNumber,
      Tanggal_Bayar: r.paymentDate,
      Nama_Murid: r.studentName,
      Jenis_Kelamin: r.gender,
      Nominal_Total_BAM: r.totalBamCost,
      Nominal_Bayar_Ini: r.amountPaid,
      Skema_Cicilan: r.installmentType,
      Total_Terbayar_Accum: r.totalPaidToDate,
      Sisa_Saldo_Tagihan: r.remainingBalance,
      Catatan: r.notes || '-',
    }));

    exportToExcel(
      [...formExport, ...bamExport],
      `Laporan_Rekap_Keuangan_Kepsek_SPMB_AlHadiid`
    );
  };

  return (
    <div className="space-y-6">
      {/* Kepsek Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-semibold mb-2 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Laporan Khusus Kepala Sekolah SMP Al-Hadiid</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Laporan Pembayaran Formulir & Biaya Awal Masuk (BAM)
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Rekapitutasi real-time penerimaan dana pendaftaran, skema angsuran, serta sisa saldo tagihan murid.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowSqlModal(true)}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs rounded-xl border border-slate-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Skrip SQL Database</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Cetak PDF Laporan</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Main Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Total Penerimaan Formulir</div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-700">
            Rp {totalFormAmount.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-slate-400 font-semibold pt-1 border-t border-slate-100 flex justify-between">
            <span>{formPayments.length} Pendaftar</span>
            <span>Rp 200.000 / Murid</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Total Dana BAM Terkumpul</div>
          <div className="text-xl sm:text-2xl font-extrabold text-blue-700">
            Rp {totalBamAmount.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-slate-400 font-semibold pt-1 border-t border-slate-100 flex justify-between">
            <span>{bamPayments.length} Transaksi BAM</span>
            <span>Lunas & Angsuran</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Total Combined Revenue</div>
          <div className="text-xl sm:text-2xl font-extrabold text-purple-800">
            Rp {(totalFormAmount + totalBamAmount).toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-emerald-600 font-bold pt-1 border-t border-slate-100">
            ✓ Terverifikasi di Kas Sekolah
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Sisa Saldo Tagihan BAM</div>
          <div className="text-xl sm:text-2xl font-extrabold text-rose-600">
            Rp {totalRemainingBalance.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-rose-500 font-semibold pt-1 border-t border-slate-100">
            Piutang Angsuran Berjalan
          </div>
        </div>
      </div>

      {/* Detail Financial Breakdown Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Breakdown Pembayaran Formulir */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-extrabold text-slate-900 text-sm border-b pb-3 flex items-center justify-between">
            <span>Breakdown Penerimaan Formulir Pendaftaran</span>
            <PieChart className="w-4 h-4 text-emerald-600" />
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="text-[10px] font-bold text-emerald-800 uppercase">Internal</div>
              <div className="text-sm sm:text-base font-extrabold text-emerald-900 mt-1">
                Rp {formInternalAmount.toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] text-emerald-700 font-bold mt-0.5">
                {formPayments.filter(r => r.category === 'Internal').length} Murid
              </div>
            </div>

            <div className="p-3 bg-sky-50 rounded-xl border border-sky-100">
              <div className="text-[10px] font-bold text-sky-800 uppercase">Eksternal</div>
              <div className="text-sm sm:text-base font-extrabold text-sky-900 mt-1">
                Rp {formEksternalAmount.toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] text-sky-700 font-bold mt-0.5">
                {formPayments.filter(r => r.category === 'Eksternal').length} Murid
              </div>
            </div>

            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
              <div className="text-[10px] font-bold text-purple-800 uppercase">Bazaar</div>
              <div className="text-sm sm:text-base font-extrabold text-purple-900 mt-1">
                Rp {formBazaarAmount.toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] text-purple-700 font-bold mt-0.5">
                {formPayments.filter(r => r.category === 'Bazaar').length} Murid
              </div>
            </div>
          </div>
        </div>

        {/* Gender Breakdown Comparison */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-extrabold text-slate-900 text-sm border-b pb-3 flex items-center justify-between">
            <span>Perbandingan Penerimaan Laki-Laki vs Perempuan</span>
            <Users className="w-4 h-4 text-blue-600" />
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs">
            <div className="p-3.5 bg-blue-50/80 rounded-xl border border-blue-200 space-y-1.5">
              <div className="font-extrabold text-blue-900 flex items-center gap-1">
                <span>♂️ Calon Murid Laki-Laki</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Formulir:</span>
                <strong className="text-slate-900">Rp {maleFormAmount.toLocaleString('id-ID')}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Dana BAM:</span>
                <strong className="text-slate-900">Rp {maleBamAmount.toLocaleString('id-ID')}</strong>
              </div>
              <div className="pt-1.5 border-t border-blue-200 flex justify-between font-extrabold text-blue-900">
                <span>Total Laki-Laki:</span>
                <span>Rp {(maleFormAmount + maleBamAmount).toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="p-3.5 bg-pink-50/80 rounded-xl border border-pink-200 space-y-1.5">
              <div className="font-extrabold text-pink-900 flex items-center gap-1">
                <span>♀️ Calon Murid Perempuan</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Formulir:</span>
                <strong className="text-slate-900">Rp {femaleFormAmount.toLocaleString('id-ID')}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Dana BAM:</span>
                <strong className="text-slate-900">Rp {femaleBamAmount.toLocaleString('id-ID')}</strong>
              </div>
              <div className="pt-1.5 border-t border-pink-200 flex justify-between font-extrabold text-pink-900">
                <span>Total Perempuan:</span>
                <span>Rp {(femaleFormAmount + femaleBamAmount).toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Tab Controller */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveReportTab('all')}
            className={`px-3 py-2 sm:px-3.5 rounded-xl font-bold transition-all cursor-pointer ${
              activeReportTab === 'all'
                ? 'bg-slate-900 text-white shadow'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Semua Laporan
          </button>
          <button
            onClick={() => setActiveReportTab('form')}
            className={`px-3 py-2 sm:px-3.5 rounded-xl font-bold transition-all cursor-pointer ${
              activeReportTab === 'form'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Laporan Formulir ({filteredForm.length})
          </button>
          <button
            onClick={() => setActiveReportTab('bam')}
            className={`px-3 py-2 sm:px-3.5 rounded-xl font-bold transition-all cursor-pointer ${
              activeReportTab === 'bam'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Laporan BAM & Saldo ({filteredBam.length})
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="font-bold text-slate-600 shrink-0">Filter Gender:</span>
          <select
            value={genderFilter}
            onChange={e => setGenderFilter(e.target.value as any)}
            className="w-full sm:w-auto border border-slate-300 rounded-lg p-1.5 text-xs bg-white font-semibold"
          >
            <option value="all">Semua Gender (L & P)</option>
            <option value="Laki-laki">Laki-laki Only</option>
            <option value="Perempuan">Perempuan Only</option>
          </select>
        </div>
      </div>

      {/* Table 1: Laporan Pembayaran Formulir */}
      {(activeReportTab === 'all' || activeReportTab === 'form') && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <h3 className="font-extrabold text-slate-900 text-sm">
              Laporan Rincian Pembayaran Formulir Pendaftaran
            </h3>
            <span className="text-xs text-slate-500 font-bold">
              Total: Rp {filteredForm.reduce((a, c) => a + c.amount, 0).toLocaleString('id-ID')}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-100 border-b font-bold text-slate-700 whitespace-nowrap">
                  <th className="p-3">No</th>
                  <th className="p-3">No. Transaksi</th>
                  <th className="p-3">No. Pendaftaran</th>
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Nama Calon Murid</th>
                  <th className="p-3">Gender</th>
                  <th className="p-3">Nominal</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {filteredForm.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                      Tidak ada data laporan pembayaran formulir.
                    </td>
                  </tr>
                ) : (
                  filteredForm.map((r, i) => (
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
                      <td className="p-3 text-emerald-600 font-bold">✓ Terverifikasi Kas</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Table 2: Laporan BAM & Sisa Saldo Tagihan */}
      {(activeReportTab === 'all' || activeReportTab === 'bam') && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <h3 className="font-extrabold text-slate-900 text-sm">
              Laporan Rincian Biaya Awal Masuk (BAM) & Sisa Saldo Tagihan
            </h3>
            <span className="text-xs text-slate-500 font-bold">
              Total Terkumpul: Rp {filteredBam.reduce((a, c) => a + c.amountPaid, 0).toLocaleString('id-ID')}
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
                  <th className="p-3">Bayar Transaksi</th>
                  <th className="p-3">Skema Cicilan</th>
                  <th className="p-3">Total Terbayar</th>
                  <th className="p-3">Sisa Saldo Tagihan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {filteredBam.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400 italic">
                      Tidak ada data laporan BAM.
                    </td>
                  </tr>
                ) : (
                  filteredBam.map((r, i) => (
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Official Executive Approval Box */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs">
        <h3 className="font-bold text-slate-900 text-sm border-b pb-2">
          Pengesahan Laporan Keuangan Kepala Sekolah
        </h3>
        <p className="text-slate-600 leading-relaxed">
          Seluruh data penerimaan pembayaran Formulir Pendaftaran dan Biaya Awal Masuk (BAM) di atas telah disajikan secara transparan dan akurat berdasarkan transaksi riil panitia penerimaan murid baru SMP Al-Hadiid Cileungsi TP {schoolInfo.academicYear}.
        </p>
        <div className="pt-4 flex justify-end">
          <div className="text-center space-y-1">
            <div>Cileungsi, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            <div className="font-bold text-slate-900 pt-8 border-b border-slate-800">
              {schoolInfo.headmasterName || 'Herman Jayusman, S.Pd.I.'}
            </div>
            <div className="text-[11px] text-slate-500">Kepala Sekolah SMP Al-Hadiid Cileungsi</div>
          </div>
        </div>
      </div>

      {/* SQL Script Modal */}
      <PaymentSqlModal
        isOpen={showSqlModal}
        onClose={() => setShowSqlModal(false)}
        formPayments={formPayments}
        bamPayments={bamPayments}
      />
    </div>
  );
};
