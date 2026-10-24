import React, { useState, useEffect } from 'react';
import { StudentData, CbtHasilUjian } from '../../types';
import {
  fetchCbtDashboardStatsSupabase,
  deleteHasilUjianSupabase,
  deleteAllHasilUjianSupabase,
  resetUjianPesertaCbtSupabase,
} from '../../services/cbtSupabaseService';
import { exportToExcel } from '../../utils/excelExporter';
import {
  Users, BookOpen, Calendar, Clock, CheckCircle2, Award,
  TrendingUp, BarChart3, PieChart, ShieldCheck, RefreshCw, Trophy,
  ArrowRight, Sparkles, Trash2, AlertTriangle, X, Search, FileSpreadsheet,
  XCircle, RotateCcw
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

  // Search & Filter state untuk Tabel Hasil & Rangking di Dashboard
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // State Fitur Hapus Data Hasil Nilai CBT
  const [selectedHasilToDelete, setSelectedHasilToDelete] = useState<CbtHasilUjian | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [resetStudentScoresOnDelete, setResetStudentScoresOnDelete] = useState<boolean>(true);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  // State Fitur Ulang / Reset Ujian oleh Admin (Revisi)
  const [selectedHasilToReset, setSelectedHasilToReset] = useState<CbtHasilUjian | null>(null);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [activateImmediatelyOnReset, setActivateImmediatelyOnReset] = useState<boolean>(true);

  const studentMap = new Map<string, StudentData>(students.map((s) => [s.id, s]));

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

    // Listen to real-time cbt_hasil_updated event
    const handleUpdated = () => {
      loadDashboardData();
    };
    window.addEventListener('cbt_hasil_updated', handleUpdated);
    return () => {
      window.removeEventListener('cbt_hasil_updated', handleUpdated);
    };
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

  // Filter data hasil untuk tabel terintegrasi di Dashboard
  const filteredDashboardHasil = hasilList.filter((h) => {
    const std = studentMap.get(h.pesertaId);
    const name = std?.fullName || h.namaPeserta || '';
    const regNo = std?.registrationNumber || h.registrationNumber || '';

    const matchSearch =
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      regNo.toLowerCase().includes(searchQuery.toLowerCase());

    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'lulus' ? h.statusKelulusan === 'LULUS' : h.statusKelulusan === 'BELUM LULUS');

    return matchSearch && matchStatus;
  });

  const totalLulus = hasilList.filter((h) => h.statusKelulusan === 'LULUS').length;
  const totalBelum = hasilList.filter((h) => h.statusKelulusan !== 'LULUS').length;

  // Export Excel
  const handleExportExcel = () => {
    const exportData = filteredDashboardHasil.map((h) => {
      const std = studentMap.get(h.pesertaId);
      return {
        Peringkat: h.ranking || '-',
        No_Pendaftaran: std?.registrationNumber || h.registrationNumber || '-',
        Nama_Peserta: std?.fullName || h.namaPeserta || '-',
        Gelombang: 'Gelombang 1',
        Nilai_Diagnostik_30: h.nilaiDiagnostik,
        Nilai_TPU_40: h.nilaiTpu,
        Nilai_Diniyyah_30: h.nilaiDiniyyah,
        Nilai_Total_Akhir: h.nilaiTotal,
        Status_Kelulusan: h.statusKelulusan,
        Tanggal_Ujian: h.tanggalUjian ? new Date(h.tanggalUjian).toLocaleDateString('id-ID') : '-',
      };
    });

    exportToExcel(
      exportData,
      `Rekap_Nilai_CBT_Dashboard_${new Date().toISOString().split('T')[0]}`
    );
  };

  // Handler Hapus Nilai Peserta Tunggal
  const handleConfirmDelete = async () => {
    if (!selectedHasilToDelete) return;
    setIsDeleting(true);
    const target = selectedHasilToDelete;
    const std = studentMap.get(target.pesertaId);
    const studentName = std?.fullName || target.namaPeserta || 'Peserta';

    try {
      await deleteHasilUjianSupabase(target.id, target.pesertaId, resetStudentScoresOnDelete);
      setToastMessage(`Data nilai ujian "${studentName}" berhasil dihapus.`);
      setTimeout(() => setToastMessage(''), 4000);
      setSelectedHasilToDelete(null);
      await loadDashboardData(false);
    } catch (err: any) {
      console.warn('Gagal menghapus nilai:', err);
      alert('Gagal menghapus data nilai ujian: ' + (err?.message || err));
    } finally {
      setIsDeleting(false);
    }
  };

  // Handler Hapus Seluruh Data Nilai
  const handleConfirmDeleteAll = async () => {
    setIsDeleting(true);
    try {
      await deleteAllHasilUjianSupabase();
      setToastMessage('Seluruh data nilai ujian CBT berhasil dikosongkan.');
      setTimeout(() => setToastMessage(''), 4000);
      setShowDeleteAllModal(false);
      await loadDashboardData(false);
    } catch (err: any) {
      console.warn('Gagal menghapus semua nilai:', err);
      alert('Gagal menghapus seluruh nilai: ' + (err?.message || err));
    } finally {
      setIsDeleting(false);
    }
  };

  // Handler Ulang / Reset Ujian Peserta oleh Admin (Revisi)
  const handleConfirmResetExam = async () => {
    if (!selectedHasilToReset) return;
    setIsResetting(true);
    const target = selectedHasilToReset;
    const std = studentMap.get(target.pesertaId);
    const studentName = std?.fullName || target.namaPeserta || 'Peserta';

    try {
      const ok = await resetUjianPesertaCbtSupabase({
        participantId: target.pesertaId,
        examId: target.ujianId,
        participantName: studentName,
        activateTestImmediately: activateImmediatelyOnReset,
      });

      if (ok) {
        setToastMessage(`Ujian untuk "${studentName}" berhasil direset! Akses CBT dibuka kembali untuk 1 kesempatan baru.`);
        setTimeout(() => setToastMessage(''), 5000);
        setSelectedHasilToReset(null);
        await loadDashboardData(false);
      } else {
        alert('Gagal mereset sesi ujian peserta.');
      }
    } catch (err: any) {
      console.warn('Gagal reset ujian:', err);
      alert('Gagal mereset ujian: ' + (err?.message || err));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage('')}
            className="text-emerald-700 hover:text-emerald-900 text-sm font-bold cursor-pointer ml-4"
          >
            ✕
          </button>
        </div>
      )}

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

      {/* TABEL TERINTEGRASI: DATA NILAI HASIL UJIAN & RANGKING NILAI CBT */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                <Trophy className="w-3 h-3 text-amber-500" />
                Data Nilai &amp; Rangking Ujian CBT
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Rekapitulasi Data Nilai Hasil Ujian &amp; Rangking Peserta</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tabel lengkap hasil ujian CBT calon murid, peringkat ranking, nilai per materi tes, status kelulusan, dan fitur hapus data nilai.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>

            {hasilList.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(true)}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="Hapus seluruh data nilai hasil ujian CBT"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Hapus Semua Nilai</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs font-semibold">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Cari nama peserta atau nomor pendaftaran..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="p-2 border border-slate-300 rounded-xl bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">Semua Status Kelulusan ({hasilList.length})</option>
              <option value="lulus">Status LULUS ({totalLulus})</option>
              <option value="belum">Status BELUM LULUS ({totalBelum})</option>
            </select>
          </div>
        </div>

        {/* Results & Ranking Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-extrabold uppercase text-[11px] tracking-wider">
                <th className="p-3.5 w-16 text-center">Rank</th>
                <th className="p-3.5">No. Pendaftaran</th>
                <th className="p-3.5">Nama Peserta</th>
                <th className="p-3.5 text-center">Diagnostik (30%)</th>
                <th className="p-3.5 text-center">TPU (40%)</th>
                <th className="p-3.5 text-center">Diniyyah (30%)</th>
                <th className="p-3.5 text-center font-black text-indigo-950">Nilai Akhir Total</th>
                <th className="p-3.5 text-center">Status Kelulusan</th>
                <th className="p-3.5 text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading && hasilList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                      <span className="font-bold text-xs">Memuat data nilai &amp; ranking hasil ujian...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredDashboardHasil.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-400 italic">
                    Belum ada data nilai hasil ujian yang sesuai dengan filter atau pencarian.
                  </td>
                </tr>
              ) : (
                filteredDashboardHasil.map((h) => {
                  const std = studentMap.get(h.pesertaId);
                  const rankNum = h.ranking || 0;
                  const isTop1 = rankNum === 1;
                  const isTop2 = rankNum === 2;
                  const isTop3 = rankNum === 3;

                  return (
                    <tr
                      key={h.id || h.pesertaId}
                      className={`hover:bg-slate-50 transition-colors ${
                        isTop1 ? 'bg-amber-50/40' : isTop2 ? 'bg-slate-50/60' : isTop3 ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black shadow-xs ${
                            isTop1
                              ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-300'
                              : isTop2
                              ? 'bg-slate-300 text-slate-900 ring-2 ring-slate-200'
                              : isTop3
                              ? 'bg-amber-600 text-white ring-2 ring-amber-500'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {rankNum}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-slate-900">
                        {std?.registrationNumber || h.registrationNumber || '-'}
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{std?.fullName || h.namaPeserta || 'Peserta Tes'}</span>
                          {isTop1 && <span className="text-xs" title="Juara 1 Ranking">🥇</span>}
                          {isTop2 && <span className="text-xs" title="Juara 2 Ranking">🥈</span>}
                          {isTop3 && <span className="text-xs" title="Juara 3 Ranking">🥉</span>}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {h.tanggalUjian ? new Date(h.tanggalUjian).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-'}
                        </div>
                      </td>
                      <td className="p-3.5 text-center font-bold text-slate-700">{h.nilaiDiagnostik}</td>
                      <td className="p-3.5 text-center font-bold text-slate-700">{h.nilaiTpu}</td>
                      <td className="p-3.5 text-center font-bold text-slate-700">{h.nilaiDiniyyah}</td>
                      <td className="p-3.5 text-center">
                        <span className="text-base font-black text-indigo-950 bg-indigo-50/80 px-3 py-1 rounded-xl border border-indigo-200/80 shadow-xs">
                          {h.nilaiTotal}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        {h.statusKelulusan === 'LULUS' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> LULUS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-100 text-rose-800 text-[10px] font-black rounded-full border border-rose-300">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" /> BELUM LULUS
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedHasilToReset(h)}
                            title={`Reset & Izinkan Ujian Ulang untuk ${std?.fullName || h.namaPeserta}`}
                            className="px-2.5 py-1.5 text-amber-800 hover:text-white hover:bg-amber-600 rounded-lg transition-all border border-amber-300 hover:border-amber-600 cursor-pointer inline-flex items-center gap-1 font-bold text-[11px] shadow-2xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-amber-600 group-hover:text-white" />
                            <span>Reset Ujian</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedHasilToDelete(h)}
                            title={`Hapus data nilai ${std?.fullName || h.namaPeserta}`}
                            className="px-2.5 py-1.5 text-rose-600 hover:text-white hover:bg-rose-600 rounded-lg transition-all border border-rose-200 hover:border-rose-600 cursor-pointer inline-flex items-center gap-1 font-bold text-[11px] shadow-2xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL KONFIRMASI HAPUS DATA NILAI TUNGGAL */}
      {selectedHasilToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="p-2 bg-rose-100 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <h4 className="text-base font-black text-slate-900">Konfirmasi Hapus Nilai Ujian</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHasilToDelete(null)}
                disabled={isDeleting}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus data nilai ujian untuk peserta berikut? Tindakan ini akan menghapus hasil nilai dari tabel hasil ujian CBT.
            </p>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Nama Peserta:</span>
                <span className="font-bold text-slate-900">
                  {studentMap.get(selectedHasilToDelete.pesertaId)?.fullName || selectedHasilToDelete.namaPeserta}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">No. Pendaftaran:</span>
                <span className="font-mono font-bold text-slate-900">
                  {studentMap.get(selectedHasilToDelete.pesertaId)?.registrationNumber || selectedHasilToDelete.registrationNumber || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nilai Akhir:</span>
                <span className="font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {selectedHasilToDelete.nilaiTotal} ({selectedHasilToDelete.statusKelulusan})
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                <span>Rincian Bobot:</span>
                <span>Diag {selectedHasilToDelete.nilaiDiagnostik} | TPU {selectedHasilToDelete.nilaiTpu} | Din {selectedHasilToDelete.nilaiDiniyyah}</span>
              </div>
            </div>

            <label className="flex items-start gap-2.5 p-3 bg-amber-50 rounded-xl border border-amber-200 cursor-pointer">
              <input
                type="checkbox"
                checked={resetStudentScoresOnDelete}
                onChange={(e) => setResetStudentScoresOnDelete(e.target.checked)}
                className="mt-0.5 text-rose-600 rounded focus:ring-rose-500 cursor-pointer"
              />
              <div className="text-[11px] text-amber-900 leading-tight">
                <span className="font-bold">Reset nilai &amp; status pada data calon murid</span>
                <p className="text-amber-700 text-[10px] mt-0.5">
                  Centang untuk mengizinkan calon murid melakukan ujian ulang (remedial/retest) di portal CBT.
                </p>
              </div>
            </label>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSelectedHasilToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus Nilai</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI RESET UJIAN PESERTA (REVISI) */}
      {selectedHasilToReset && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-amber-600">
                <div className="p-2 bg-amber-100 rounded-xl">
                  <RotateCcw className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">Konfirmasi Reset Ujian CBT</h4>
                  <p className="text-[11px] text-slate-500">Izin Ujian Ulang / Retest untuk Calon Murid</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHasilToReset(null)}
                disabled={isResetting}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Sesuai ketentuan SPMB, calon murid hanya dapat login dan mengikuti tes ujian <strong>1 (satu) kali</strong>. Dengan mereset ujian, Anda memberikan <strong>1 kesempatan baru</strong> bagi calon murid untuk mengikuti ujian CBT kembali dari nomor 1.
            </p>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Nama Calon Murid:</span>
                <span className="font-bold text-slate-900">
                  {studentMap.get(selectedHasilToReset.pesertaId)?.fullName || selectedHasilToReset.namaPeserta}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">No. Pendaftaran:</span>
                <span className="font-mono font-bold text-slate-900">
                  {studentMap.get(selectedHasilToReset.pesertaId)?.registrationNumber || selectedHasilToReset.registrationNumber || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nilai Sebelumnya:</span>
                <span className="font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {selectedHasilToReset.nilaiTotal} ({selectedHasilToReset.statusKelulusan})
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                <span>Rincian Bobot:</span>
                <span>Diag {selectedHasilToReset.nilaiDiagnostik} | TPU {selectedHasilToReset.nilaiTpu} | Din {selectedHasilToReset.nilaiDiniyyah}</span>
              </div>
            </div>

            <label className="flex items-start gap-2.5 p-3 bg-emerald-50 rounded-xl border border-emerald-200 cursor-pointer">
              <input
                type="checkbox"
                checked={activateImmediatelyOnReset}
                onChange={(e) => setActivateImmediatelyOnReset(e.target.checked)}
                className="mt-0.5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
              />
              <div className="text-[11px] text-emerald-900 leading-tight">
                <span className="font-bold">Langsung aktifkan status ujian murid (is_test_active = true)</span>
                <p className="text-emerald-700 text-[10px] mt-0.5">
                  Tombol "Klik Soal" di portal siswa akan langsung terbuka untuk 1 kali pengerjaan.
                </p>
              </div>
            </label>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSelectedHasilToReset(null)}
                disabled={isResetting}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmResetExam}
                disabled={isResetting}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Mereset Ujian...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Ya, Reset &amp; Izinkan Ulang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS SEMUA DATA NILAI */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="p-2 bg-rose-100 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <h4 className="text-base font-black text-slate-900">Hapus Seluruh Data Nilai CBT?</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                disabled={isDeleting}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-rose-800 bg-rose-50 p-3 rounded-xl border border-rose-200 leading-relaxed font-semibold">
              PERINGATAN: Tindakan ini akan mengosongkan dan menghapus seluruh ({hasilList.length}) riwayat nilai hasil ujian dan rangking CBT dari sistem. Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAll}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus Semua...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus Semua</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
