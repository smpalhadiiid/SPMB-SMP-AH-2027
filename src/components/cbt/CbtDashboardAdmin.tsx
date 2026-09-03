import React from 'react';
import { StudentData } from '../../types';
import { getCbtSoal, getCbtUjian, getCbtHasilUjian, getCbtLogUjian } from '../../utils/cbtStorage';
import {
  Users, BookOpen, Calendar, Clock, CheckCircle2, Award,
  TrendingUp, BarChart3, PieChart, ShieldCheck
} from 'lucide-react';

interface CbtDashboardAdminProps {
  students: StudentData[];
}

export const CbtDashboardAdmin: React.FC<CbtDashboardAdminProps> = ({ students }) => {
  const soalList = getCbtSoal();
  const ujianList = getCbtUjian();
  const hasilList = getCbtHasilUjian();
  const logList = getCbtLogUjian();

  const totalPeserta = students.length;
  const totalSoal = soalList.length;
  const totalUjian = ujianList.length;
  const sedangUjianCount = logList.filter(l => !l.isSubmitted && l.statusOnline === 'ONLINE').length;
  const sudahSelesaiCount = hasilList.length;

  const scores = hasilList.map(h => h.nilaiTotal);
  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '0';
  const maxScore = scores.length > 0 ? Math.max(...scores).toFixed(1) : '0';
  const minScore = scores.length > 0 ? Math.min(...scores).toFixed(1) : '0';

  // Average per category
  const diagAvg = hasilList.length > 0
    ? (hasilList.reduce((acc, h) => acc + h.nilaiDiagnostik, 0) / hasilList.length).toFixed(1)
    : '0';
  const tpuAvg = hasilList.length > 0
    ? (hasilList.reduce((acc, h) => acc + h.nilaiTpu, 0) / hasilList.length).toFixed(1)
    : '0';
  const diniyyahAvg = hasilList.length > 0
    ? (hasilList.reduce((acc, h) => acc + h.nilaiDiniyyah, 0) / hasilList.length).toFixed(1)
    : '0';

  // Distribution ranges: <60, 60-75, 76-85, >85
  const distUnder60 = scores.filter(s => s < 60).length;
  const dist60To75 = scores.filter(s => s >= 60 && s <= 75).length;
  const dist76To85 = scores.filter(s => s > 75 && s <= 85).length;
  const distAbove85 = scores.filter(s => s > 85).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800">
        <div className="flex items-center gap-2 text-blue-400 font-extrabold text-xs uppercase tracking-wider mb-2">
          <ShieldCheck className="w-4 h-4" />
          <span>Sistem CBT SPMB SMP Al-Hadiid</span>
        </div>
        <h2 className="text-2xl font-black tracking-tight">Dashboard Executive CBT</h2>
        <p className="text-xs text-slate-300 mt-1 max-w-2xl">
          Ringkasan statistik real-time pelaksanaan ujian Computer-Based Test (CBT), bank soal, grafik performa peserta, dan distribusi kelulusan.
        </p>
      </div>

      {/* 8 Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Jumlah Peserta</div>
            <div className="text-2xl font-black text-slate-900">{totalPeserta}</div>
            <div className="text-[10px] text-blue-600 font-semibold">Calon Murid</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Jumlah Soal</div>
            <div className="text-2xl font-black text-indigo-900">{totalSoal}</div>
            <div className="text-[10px] text-indigo-600 font-semibold">Bank Soal CBT</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Jumlah Ujian</div>
            <div className="text-2xl font-black text-emerald-900">{totalUjian}</div>
            <div className="text-[10px] text-emerald-600 font-semibold">Jadwal Terdaftar</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Sedang Ujian</div>
            <div className="text-2xl font-black text-amber-600">{sedangUjianCount}</div>
            <div className="text-[10px] text-amber-600 font-semibold">Peserta Live Active</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Sudah Selesai</div>
            <div className="text-2xl font-black text-teal-900">{sudahSelesaiCount}</div>
            <div className="text-[10px] text-teal-600 font-semibold">Telah Submit Tes</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Rata-rata Nilai</div>
            <div className="text-2xl font-black text-sky-900">{avgScore}</div>
            <div className="text-[10px] text-sky-600 font-semibold">Skala 100</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Nilai Tertinggi</div>
            <div className="text-2xl font-black text-emerald-600">{maxScore}</div>
            <div className="text-[10px] text-emerald-600 font-semibold">Skor Maksimal</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Nilai Terendah</div>
            <div className="text-2xl font-black text-rose-600">{minScore}</div>
            <div className="text-[10px] text-rose-600 font-semibold">Skor Minimal</div>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Grafik Distribusi Nilai */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <span>Grafik Distribusi Nilai Peserta</span>
              </h3>
              <p className="text-[11px] text-slate-500">Sebaran total nilai akhir hasil ujian CBT</p>
            </div>
            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-lg">
              {scores.length} Peserta
            </span>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Nilai Superior (&gt; 85)</span>
                <span className="font-bold text-emerald-600">{distAbove85} peserta</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${scores.length > 0 ? (distAbove85 / scores.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Nilai Baik (76 - 85)</span>
                <span className="font-bold text-blue-600">{dist76To85} peserta</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${scores.length > 0 ? (dist76To85 / scores.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Nilai Cukup (60 - 75)</span>
                <span className="font-bold text-amber-600">{dist60To75} peserta</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${scores.length > 0 ? (dist60To75 / scores.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Nilai Kurang (&lt; 60)</span>
                <span className="font-bold text-rose-600">{distUnder60} peserta</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all duration-500"
                  style={{ width: `${scores.length > 0 ? (distUnder60 / scores.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Grafik Nilai per Kategori */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-indigo-600" />
                <span>Grafik Rata-Rata Nilai per Kategori</span>
              </h3>
              <p className="text-[11px] text-slate-500">Perbandingan performa per bidang studi</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 text-center">
            <div className="bg-blue-50/80 p-4 rounded-xl border border-blue-100 space-y-1">
              <div className="text-[10px] font-bold text-blue-700 uppercase">Tes Diagnostik</div>
              <div className="text-2xl font-black text-blue-900">{diagAvg}</div>
              <div className="text-[10px] text-blue-600 font-semibold">Bobot 30%</div>
              <div className="w-full h-1.5 bg-blue-200 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full" style={{ width: `${diagAvg}%` }} />
              </div>
            </div>

            <div className="bg-indigo-50/80 p-4 rounded-xl border border-indigo-100 space-y-1">
              <div className="text-[10px] font-bold text-indigo-700 uppercase">Pengetahuan Umum</div>
              <div className="text-2xl font-black text-indigo-900">{tpuAvg}</div>
              <div className="text-[10px] text-indigo-600 font-semibold">Bobot 40%</div>
              <div className="w-full h-1.5 bg-indigo-200 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${tpuAvg}%` }} />
              </div>
            </div>

            <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-100 space-y-1">
              <div className="text-[10px] font-bold text-emerald-700 uppercase">Diniyyah & Agama</div>
              <div className="text-2xl font-black text-emerald-900">{diniyyahAvg}</div>
              <div className="text-[10px] text-emerald-600 font-semibold">Bobot 30%</div>
              <div className="w-full h-1.5 bg-emerald-200 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${diniyyahAvg}%` }} />
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Kombinasi bobot otomatis dihitung menggunakan standar formula SPMB: <strong>30% Diagnostik + 40% Pengetahuan Umum + 30% Diniyyah</strong>.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
