import React, { useState, useEffect } from 'react';
import { StudentData, CbtHasilUjian } from '../../types';
import { getCbtHasilUjian } from '../../utils/cbtStorage';
import { fetchMergedCbtResults, deleteHasilUjianSupabase, deleteAllHasilUjianSupabase } from '../../services/cbtSupabaseService';
import { exportToExcel } from '../../utils/excelExporter';
import {
  Trophy, Award, Search, FileSpreadsheet, CheckCircle2,
  XCircle, RefreshCw, Sparkles, Filter, Users, TrendingUp,
  Trash2, AlertTriangle, X, RotateCcw
} from 'lucide-react';

interface CbtHasilDanRankingProps {
  students: StudentData[];
  mode?: 'hasil' | 'ranking';
}

export const CbtHasilDanRanking: React.FC<CbtHasilDanRankingProps> = ({ students, mode = 'hasil' }) => {
  const [hasilList, setHasilList] = useState<CbtHasilUjian[]>(() => {
    const raw = getCbtHasilUjian();
    const sorted = [...raw].sort((a, b) => b.nilaiTotal - a.nilaiTotal);
    return sorted.map((item, index) => ({
      ...item,
      ranking: index + 1,
    }));
  });

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // State untuk Fitur Hapus Data Hasil Nilai CBT
  const [selectedHasilToDelete, setSelectedHasilToDelete] = useState<CbtHasilUjian | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [resetStudentScoresOnDelete, setResetStudentScoresOnDelete] = useState<boolean>(true);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  const studentMap = new Map<string, StudentData>(students.map((s) => [s.id, s]));

  // Load live data dari Supabase SSOT
  const loadData = async (isManual = false) => {
    if (isManual) setIsLoading(true);
    try {
      const merged = await fetchMergedCbtResults(students);
      setHasilList(merged);
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.warn('Failed loading cbt results from Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen to real-time update event when scores are modified or deleted
    const handleHasilUpdated = () => {
      loadData();
    };
    window.addEventListener('cbt_hasil_updated', handleHasilUpdated);
    return () => {
      window.removeEventListener('cbt_hasil_updated', handleHasilUpdated);
    };
  }, [students.length]);

  const filteredHasil = hasilList.filter((h) => {
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

  // Statistik Ringkas
  const totalLulus = hasilList.filter((h) => h.statusKelulusan === 'LULUS').length;
  const totalBelum = hasilList.filter((h) => h.statusKelulusan !== 'LULUS').length;
  const avgScore =
    hasilList.length > 0
      ? (hasilList.reduce((acc, h) => acc + h.nilaiTotal, 0) / hasilList.length).toFixed(1)
      : '0';

  const handleExportExcel = () => {
    const exportData = filteredHasil.map((h) => {
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
      `Rekap_${mode === 'ranking' ? 'Ranking' : 'Hasil'}_CBT_SPMB_${new Date().toISOString().split('T')[0]}`
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
      setHasilList((prev) => {
        const remaining = prev.filter(
          (h) => h.id !== target.id && h.pesertaId !== target.pesertaId
        );
        return remaining.map((item, index) => ({
          ...item,
          ranking: index + 1,
        }));
      });
      setToastMessage(`Data nilai ujian "${studentName}" berhasil dihapus.`);
      setTimeout(() => setToastMessage(''), 4000);
      setSelectedHasilToDelete(null);
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
      setHasilList([]);
      setToastMessage('Seluruh data nilai ujian CBT berhasil dihapus.');
      setTimeout(() => setToastMessage(''), 4000);
      setShowDeleteAllModal(false);
    } catch (err: any) {
      console.warn('Gagal menghapus semua nilai:', err);
      alert('Gagal menghapus seluruh nilai: ' + (err?.message || err));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
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

      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Database Supabase SSOT
            </span>
            <span className="text-xs text-slate-400">
              Terakhir diperbarui: {lastRefreshedAt.toLocaleTimeString('id-ID')}
            </span>
          </div>

          <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            {mode === 'ranking' ? (
              <Trophy className="w-6 h-6 text-amber-500" />
            ) : (
              <Award className="w-6 h-6 text-teal-600" />
            )}
            <span>
              {mode === 'ranking'
                ? 'Peringkat & Ranking Nilai CBT SPMB'
                : 'Hasil Nilai & Rekapitulasi Ujian CBT'}
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Data rekapitulasi nilai akumulasi resmi dari database Supabase (Diagnostik 30%, TPU 40%, Diniyyah 30%), status kelulusan, dan urutan ranking peserta.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isLoading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Menyinkron...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Rekap Excel</span>
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

      {/* 4 Mini Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
          <div className="text-[10px] font-bold text-slate-500 uppercase">Total Peserta Dinilai</div>
          <div className="text-2xl font-black text-slate-900 mt-0.5">{hasilList.length}</div>
          <div className="text-[10px] text-blue-600 font-semibold">Telah Dinilai</div>
        </div>

        <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/80">
          <div className="text-[10px] font-bold text-emerald-700 uppercase">Status Lulus</div>
          <div className="text-2xl font-black text-emerald-800 mt-0.5">{totalLulus}</div>
          <div className="text-[10px] text-emerald-600 font-semibold">Skor &ge; 70</div>
        </div>

        <div className="bg-rose-50/60 p-4 rounded-2xl border border-rose-200/80">
          <div className="text-[10px] font-bold text-rose-700 uppercase">Belum Lulus</div>
          <div className="text-2xl font-black text-rose-800 mt-0.5">{totalBelum}</div>
          <div className="text-[10px] text-rose-600 font-semibold">Skor &lt; 70</div>
        </div>

        <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-200/80">
          <div className="text-[10px] font-bold text-indigo-700 uppercase">Rata-rata Skor</div>
          <div className="text-2xl font-black text-indigo-900 mt-0.5">{avgScore}</div>
          <div className="text-[10px] text-indigo-600 font-semibold">Skala 100</div>
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
                    <span className="font-bold text-xs">Memuat data hasil &amp; ranking dari database Supabase...</span>
                  </div>
                </td>
              </tr>
            ) : filteredHasil.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-10 text-center text-slate-400 italic">
                  Belum ada data nilai hasil ujian yang sesuai dengan pencarian atau filter.
                </td>
              </tr>
            ) : (
              filteredHasil.map((h) => {
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
                      <button
                        type="button"
                        onClick={() => setSelectedHasilToDelete(h)}
                        title={`Hapus data nilai ${std?.fullName || h.namaPeserta}`}
                        className="px-2.5 py-1.5 text-rose-600 hover:text-white hover:bg-rose-600 rounded-lg transition-all border border-rose-200 hover:border-rose-600 cursor-pointer inline-flex items-center gap-1 font-bold text-[11px] shadow-2xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
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
