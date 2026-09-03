import React from 'react';
import { StudentData, ClassQuota, SchoolInfo, UserAccount } from '../types';
import { exportToExcel } from '../utils/excelExporter';
import { generateReportPDF } from '../utils/pdfGenerator';
import { KepsekPaymentReportSection } from './payment/KepsekPaymentReportSection';
import { FilledClassesSection } from './FilledClassesSection';
import {
  BarChart3, PieChart, Users, Award, School, Download, FileSpreadsheet,
  CheckCircle2, TrendingUp, ShieldCheck, FileText, ArrowUpRight
} from 'lucide-react';


interface KepsekDashboardProps {
  currentUser: UserAccount;
  students: StudentData[];
  classQuotas: ClassQuota[];
  schoolInfo: SchoolInfo;
  activeTab?: string;
  onUpdateStudents?: (updated: StudentData[]) => void;
  onRefreshAllData?: () => void;
}

export const KepsekDashboard: React.FC<KepsekDashboardProps> = ({
  currentUser,
  students,
  classQuotas,
  schoolInfo,
  activeTab = 'overview',
  onUpdateStudents,
  onRefreshAllData,
}) => {
  const totalApplicants = students.length;
  const formPaid = students.filter(s => s.formPaymentStatus === 'verified').length;
  const testedCount = students.filter(s => s.finalScore !== undefined).length;
  const passedCount = students.filter(s => s.status === 'passed' || s.status === 're_registered' || s.status === 'class_assigned').length;
  const failedCount = students.filter(s => s.status === 'failed').length;
  const reRegisteredCount = students.filter(s => s.initialPaymentStatus === 'verified').length;

  const totalCapacity = classQuotas.reduce((acc, curr) => acc + curr.capacity, 0);
  const totalFilled = classQuotas.reduce((acc, curr) => acc + curr.filled, 0);

  const handleExportKepsekPDF = () => {
    const reportData = students.map(s => ({
      No_Pendaftaran: s.registrationNumber,
      Nama_Siswa: s.fullName,
      Sekolah_Asal: s.previousSchoolName,
      Nilai_Akhir: s.finalScore || '-',
      Status_Kelulusan: s.status,
      Daftar_Ulang: s.initialPaymentStatus,
      Kelas: s.assignedClassName || '-',
    }));

    generateReportPDF(
      `Laporan_Eksekutif_Kepala_Sekolah_TP_${schoolInfo.academicYear.replace('/', '_')}`,
      reportData,
      ['No_Pendaftaran', 'Nama_Siswa', 'Sekolah_Asal', 'Nilai_Akhir', 'Status_Kelulusan', 'Daftar_Ulang', 'Kelas']
    );
  };

  const handleExportKepsekExcel = () => {
    const reportData = students.map(s => ({
      No_Pendaftaran: s.registrationNumber,
      Nama_Lengkap: s.fullName,
      Sekolah_Asal: s.previousSchoolName,
      No_HP: s.phone,
      Formulir: s.formPaymentStatus,
      Nilai_Tes: s.finalScore || '-',
      Status_Kelulusan: s.status,
      Daftar_Ulang: s.initialPaymentStatus,
      Kelas: s.assignedClassName || '-',
    }));

    exportToExcel(
      reportData,
      `Rekap_Eksekutif_SPMB_SMP_AlHadiid_${schoolInfo.academicYear.replace('/', '_')}`
    );
  };

  if (activeTab === 'filled_classes') {
    return (
      <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <FilledClassesSection
            students={students}
            classQuotas={classQuotas}
            onUpdateStudents={onUpdateStudents}
            isAdminMode={false}
          />
        </div>
      </div>
    );
  }

  if (activeTab === 'reports') {
    return (
      <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <KepsekPaymentReportSection schoolInfo={schoolInfo} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Kepsek Header Banner */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-semibold mb-2 border border-blue-500/30">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Dashboard Laporan Kepala Sekolah SMP Al-Hadiid</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Ringkasan Eksekutif & Statistika SPMB
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Kepala Sekolah: {schoolInfo.subTitle} (TP {schoolInfo.academicYear})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportKepsekPDF}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4" />
              <span>Cetak Laporan PDF</span>
            </button>
            <button
              onClick={handleExportKepsekExcel}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 shadow-sm transition-all flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Executive KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[11px] text-slate-500 font-bold uppercase">Total Pendaftar</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{totalApplicants}</div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Murid Terdata</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[11px] text-slate-500 font-bold uppercase">Bayar Formulir</div>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1">{formPaid}</div>
            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Rp200.000 Verified</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[11px] text-slate-500 font-bold uppercase">Sudah Tes</div>
            <div className="text-2xl font-extrabold text-purple-700 mt-1">{testedCount}</div>
            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Memiliki Skor</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[11px] text-slate-500 font-bold uppercase">Siswa Lulus</div>
            <div className="text-2xl font-extrabold text-blue-700 mt-1">{passedCount}</div>
            <div className="text-[10px] text-blue-600 font-bold mt-0.5">
              {totalApplicants > 0 ? ((passedCount / totalApplicants) * 100).toFixed(0) : 0}% Passing Rate
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[11px] text-slate-500 font-bold uppercase">Daftar Ulang</div>
            <div className="text-2xl font-extrabold text-amber-600 mt-1">{reRegisteredCount}</div>
            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Lunas Daftar Ulang</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[11px] text-slate-500 font-bold uppercase">Kuota Terisi</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{totalFilled} / {totalCapacity}</div>
            <div className="text-[10px] text-emerald-600 font-bold mt-0.5">Kapasitas Sisa {totalCapacity - totalFilled}</div>
          </div>
        </div>

        {/* Visual Charts & Class Quota Summaries */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Funnel Pipeline Progress */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between border-b pb-3">
              <span>Grafik Funnel Pendaftaran SPMB</span>
              <BarChart3 className="w-4 h-4 text-blue-600" />
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between mb-1 font-semibold">
                  <span>Pendaftar Akun</span>
                  <span>{totalApplicants} Siswa (100%)</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-800 rounded-full" style={{ width: '100%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1 font-semibold">
                  <span>Pembayaran Formulir Lunas</span>
                  <span>{formPaid} Siswa ({totalApplicants > 0 ? Math.round((formPaid/totalApplicants)*100) : 0}%)</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${totalApplicants > 0 ? (formPaid/totalApplicants)*100 : 0}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1 font-semibold">
                  <span>Sudah Tes & Lulus</span>
                  <span>{passedCount} Siswa ({totalApplicants > 0 ? Math.round((passedCount/totalApplicants)*100) : 0}%)</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${totalApplicants > 0 ? (passedCount/totalApplicants)*100 : 0}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1 font-semibold">
                  <span>Lunas Daftar Ulang & Masuk Kelas</span>
                  <span>{reRegisteredCount} Siswa ({totalApplicants > 0 ? Math.round((reRegisteredCount/totalApplicants)*100) : 0}%)</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${totalApplicants > 0 ? (reRegisteredCount/totalApplicants)*100 : 0}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Chart 2: Class Quotas Breakdown */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between border-b pb-3">
              <span>Status Keterisian Kuota Tiap Kelas</span>
              <School className="w-4 h-4 text-emerald-600" />
            </h3>

            <div className="space-y-4">
              {classQuotas.map(q => (
                <div key={q.id} className="space-y-1 text-xs">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>{q.className} ({q.homeroomTeacher})</span>
                    <span>{q.filled} / {q.capacity} Siswa</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full"
                      style={{ width: `${Math.min(100, (q.filled / q.capacity) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Kepsek Detailed Financial Report Section */}
        <KepsekPaymentReportSection schoolInfo={schoolInfo} />

        {/* Official Executive Approval Box */}

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs">
          <h3 className="font-bold text-slate-900 text-sm border-b pb-2">
            Pengesahan Laporan Kepala Sekolah
          </h3>
          <p className="text-slate-600 leading-relaxed">
            Data penerimaan murid baru di atas disajikan secara akurat dan real-time berdasarkan pencatatan transaksi terverifikasi panitia SPMB SMP Al-Hadiid Cileungsi.
          </p>
          <div className="pt-4 flex justify-end">
            <div className="text-center space-y-1">
              <div>Cileungsi, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
              <div className="font-bold text-slate-900 pt-8 border-b border-slate-800">
                Herman Jayusman, S.Pd.I.
              </div>
              <div className="text-[11px] text-slate-500">Kepala Sekolah SMP Al-Hadiid Cileungsi</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
