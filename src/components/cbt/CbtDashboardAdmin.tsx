import React, { useState, useEffect } from 'react';
import { StudentData, CbtHasilUjian } from '../../types';
import { fetchCbtDashboardStatsSupabase } from '../../services/cbtSupabaseService';
import {
  Users, BookOpen, Calendar, Clock, CheckCircle2, Award,
  TrendingUp, BarChart3, PieChart, ShieldCheck, RefreshCw, Trophy,
  ArrowRight, Sparkles
} from 'lucide-react';

interface CbtDashboardAdminProps {
  students: StudentData[];
  onNavigateTab?: (tab: string) => void;
}

export const CbtDashboardAdmin: React.FC<CbtDashboardAdminProps> = ({ students, onNavigateTab }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [stats, setStats] = useState<{
    totalPeserta: number;
    totalSoal: number;
    totalUjian: number;
    sedangUjianCount: number;
    hasilList: CbtHasilUjian[];
  }>({
    totalPeserta: students.length > 0 ? students.length : 87,
    totalSoal: 30,
    totalUjian: 3,
    sedangUjianCount: 0,
    hasilList: [],
  });

  const loadDashboardData = async (isManual = false) => {
    if (isManual) setIsLoading(true);
    try {
      const data = await fetchCbtDashboardStatsSupabase(students);
      setStats(data);
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.warn('Failed loading CBT dashboard stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [students.length]);

  const hasilList = stats.hasilList;
  const scores = hasilList.map((h) => h.nilaiTotal);
  const avgScore =
    scores.length > 0
      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
      : '0';
  const maxScore = scores.length > 0 ? Math.max(...scores).toFixed(1) : '0';
  const minScore = scores.length > 0 ? Math.min(...scores).toFixed(1) : '0';

  // Average per category
  const diagAvg =
    hasilList.length > 0
      ? (hasilList.reduce((acc, h) => acc + h.nilaiDiagnostik, 0) / hasilList.length).toFixed(1)
      : '0';
  const tpuAvg =
    hasilList.length > 0
      ? (hasilList.reduce((acc, h) => acc + h.nilaiTpu, 0) / hasilList.length).toFixed(1)
      : '0';
  const diniyyahAvg =
    hasilList.length > 0
      ? (hasilList.reduce((acc, h) => acc + h.nilaiDiniyyah, 0) / hasilList.length).toFixed(1)
      : '0';

  // Distribution ranges: <60, 60-75, 76-85, >85
  const distUnder60 = scores.filter((s) => s < 60).length;
  const dist60To75 = scores.filter((s) => s >= 60 && s <= 75).length;
  const dist76To85 = scores.filter((s) => s > 75 && s <= 85).length;
  const distAbove85 = scores.filter((s) => s > 85).length;

  // Top 5 Ranking Peserta
  const topRanked = [...hasilList]
    .sort((a, b) => b.nilaiTotal - a.nilaiTotal)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[11px] font-black tracking-wider uppercase flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Supabase SSOT
            </span>
            <span className="text-xs text-slate-400">
              • Diperbarui: {lastRefreshedAt.toLocaleTimeString('id-ID')}
            </span>
          </div>

          <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <span>Dashboard Executive CBT</span>
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Ringkasan statistik real-time nilai hasil ujian, peringkat akumulasi, grafik performa materi tes, dan bank soal dari database Supabase SMP Al-Hadiid Cileungsi.
          </p>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => loadDashboardData(true)}
            disabled={isLoading}
            className="px-3.5 py-2.5 bg-slate-800/80 hover:bg-slate-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 border border-slate-700 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Menyinkron...' : 'Refresh Data'}</span>
          </button>

          {onNavigateTab && (
            <>
              <button
                type="button"
                onClick={() => onNavigateTab('cbt_ranking')}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-amber-400"
              >
                <Trophy className="w-4 h-4 text-slate-950" />
                <span>Ranking Nilai ➔</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('cbt_monitoring')}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-blue-400/30"
              >
                <Clock className="w-4 h-4" />
                <span>Monitoring Live ➔</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 8 Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Jumlah Peserta */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Jumlah Peserta</div>
            <div className="text-2xl font-black text-slate-900">{stats.totalPeserta}</div>
            <div className="text-[10px] text-blue-600 font-semibold">Calon Murid Terdaftar</div>
          </div>
        </div>

        {/* Card 2: Jumlah Soal */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Jumlah Soal</div>
            <div className="text-2xl font-black text-indigo-900">{stats.totalSoal}</div>
            <div className="text-[10px] text-indigo-600 font-semibold">Bank Soal Aktif</div>
          </div>
        </div>

        {/* Card 3: Jumlah Ujian */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Jumlah Ujian</div>
            <div className="text-2xl font-black text-emerald-900">{stats.totalUjian}</div>
            <div className="text-[10px] text-emerald-600 font-semibold">Jadwal Sesi Terdaftar</div>
          </div>
        </div>

        {/* Card 4: Sedang Ujian */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Sedang Ujian</div>
            <div className="text-2xl font-black text-amber-600">{stats.sedangUjianCount}</div>
            <div className="text-[10px] text-amber-600 font-semibold">Peserta Live Aktif</div>
          </div>
        </div>

        {/* Card 5: Sudah Selesai & Dinilai */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Sudah Selesai</div>
            <div className="text-2xl font-black text-teal-900">{hasilList.length}</div>
            <div className="text-[10px] text-teal-600 font-semibold">Hasil Nilai Tersimpan</div>
          </div>
        </div>

        {/* Card 6: Rata-rata Nilai */}
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

        {/* Card 7: Nilai Tertinggi */}
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

        {/* Card 8: Nilai Terendah */}
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

      {/* Leaderboard Top 5 Ranking Section */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
              <Trophy className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Peringkat Teratas Hasil Ujian CBT (Top 5 Ranking)
              </h3>
              <p className="text-xs text-slate-500">
                Peserta dengan akumulasi nilai tertinggi dari total {hasilList.length} peserta yang telah selesai ujian.
              </p>
            </div>
          </div>

          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('cbt_ranking')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              <span>Lihat Seluruh Peringkat Peserta</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {topRanked.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs italic">
            Belum ada data nilai ujian yang tersimpan.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
            {topRanked.map((item, idx) => {
              const rank = idx + 1;
              const isFirst = rank === 1;
              const isSecond = rank === 2;
              const isThird = rank === 3;

              return (
                <div
                  key={item.id || item.pesertaId}
                  className={`p-4 rounded-2xl border text-center relative overflow-hidden transition-all ${
                    isFirst
                      ? 'bg-gradient-to-b from-amber-50 to-amber-100/50 border-amber-300 ring-2 ring-amber-300'
                      : isSecond
                      ? 'bg-gradient-to-b from-slate-50 to-slate-100/60 border-slate-300'
                      : isThird
                      ? 'bg-gradient-to-b from-amber-50/40 to-orange-50/40 border-orange-200'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="text-2xl mb-1">
                    {isFirst ? '🥇' : isSecond ? '🥈' : isThird ? '🥉' : `#${rank}`}
                  </div>
                  <div className="font-mono text-[10px] text-slate-500 font-bold">
                    {item.registrationNumber || '-'}
                  </div>
                  <div className="font-extrabold text-xs text-slate-900 truncate mt-0.5" title={item.namaPeserta}>
                    {item.namaPeserta}
                  </div>
                  <div className="mt-2 text-2xl font-black text-indigo-950">
                    {item.nilaiTotal}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 mt-1">
                    Diag {item.nilaiDiagnostik} | TPU {item.nilaiTpu} | Din {item.nilaiDiniyyah}
                  </div>
                  <div className="mt-2">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full border border-emerald-300">
                      {item.statusKelulusan}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Visual Analytics Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Grafik Distribusi Nilai */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <span>Grafik Distribusi Nilai Peserta</span>
              </h3>
              <p className="text-[11px] text-slate-500">Sebaran total nilai akhir hasil ujian CBT</p>
            </div>
            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-lg">
              {scores.length} Peserta Dinilai
            </span>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Nilai Superior (&gt; 85)</span>
                <span className="font-bold text-emerald-600">{distAbove85} peserta ({scores.length > 0 ? Math.round((distAbove85 / scores.length) * 100) : 0}%)</span>
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
                <span className="font-bold text-blue-600">{dist76To85} peserta ({scores.length > 0 ? Math.round((dist76To85 / scores.length) * 100) : 0}%)</span>
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
                <span className="font-bold text-amber-600">{dist60To75} peserta ({scores.length > 0 ? Math.round((dist60To75 / scores.length) * 100) : 0}%)</span>
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
                <span className="font-bold text-rose-600">{distUnder60} peserta ({scores.length > 0 ? Math.round((distUnder60 / scores.length) * 100) : 0}%)</span>
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
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
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
            <div className="bg-blue-50/80 p-4 rounded-2xl border border-blue-100 space-y-1">
              <div className="text-[10px] font-bold text-blue-700 uppercase">Tes Diagnostik</div>
              <div className="text-2xl font-black text-blue-900">{diagAvg}</div>
              <div className="text-[10px] text-blue-600 font-semibold">Bobot 30%</div>
              <div className="w-full h-1.5 bg-blue-200 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full" style={{ width: `${diagAvg}%` }} />
              </div>
            </div>

            <div className="bg-indigo-50/80 p-4 rounded-2xl border border-indigo-100 space-y-1">
              <div className="text-[10px] font-bold text-indigo-700 uppercase">Pengetahuan Umum</div>
              <div className="text-2xl font-black text-indigo-900">{tpuAvg}</div>
              <div className="text-[10px] text-indigo-600 font-semibold">Bobot 40%</div>
              <div className="w-full h-1.5 bg-indigo-200 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${tpuAvg}%` }} />
              </div>
            </div>

            <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-100 space-y-1">
              <div className="text-[10px] font-bold text-emerald-700 uppercase">Diniyyah & Agama</div>
              <div className="text-2xl font-black text-emerald-900">{diniyyahAvg}</div>
              <div className="text-[10px] text-emerald-600 font-semibold">Bobot 30%</div>
              <div className="w-full h-1.5 bg-emerald-200 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${diniyyahAvg}%` }} />
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Kombinasi bobot otomatis dihitung menggunakan formula standar: <strong>30% Diagnostik + 40% Pengetahuan Umum + 30% Diniyyah</strong>.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
