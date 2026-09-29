import React, { useState, useEffect } from 'react';
import {
  X, Database, RefreshCw, ArrowDownToLine, ArrowUpFromLine,
  CheckCircle2, AlertCircle, Clock, ShieldCheck, Sparkles, Server, HardDrive
} from 'lucide-react';
import {
  performFullSupabaseSync,
  fetchSyncComparisonStats,
  getLastSyncInfo,
  formatSyncTime,
  SyncMode,
  SyncStatsComparison,
  SyncResult
} from '../utils/supabaseSync';
import { SUPABASE_PROJECT_NAME, SUPABASE_PROJECT_ID } from '../utils/supabaseClient';

interface SupabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataSynced?: () => void;
}

export const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({
  isOpen,
  onClose,
  onDataSynced,
}) => {
  const [stats, setStats] = useState<SyncStatsComparison | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ stage: string; percent: number }>({
    stage: '',
    percent: 0,
  });
  const [lastResult, setLastResult] = useState<SyncResult | null>(() => getLastSyncInfo());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadStats = async () => {
    setLoadingStats(true);
    setErrorMessage(null);
    try {
      const data = await fetchSyncComparisonStats();
      setStats(data);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal memuat status pembanding database.');
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStats();
      setLastResult(getLastSyncInfo());
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartSync = async (mode: SyncMode = 'pull') => {
    setIsSyncing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setSyncProgress({ stage: 'Menghubungi server Supabase...', percent: 15 });

    try {
      const result = await performFullSupabaseSync(mode, (stage, percent) => {
        setSyncProgress({ stage, percent });
      });

      setLastResult(result);
      setSuccessMessage(result.message);
      await loadStats();

      if (onDataSynced) {
        onDataSynced();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kendala saat memuat ulang data dari server Supabase.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl text-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Pusat Data Server Supabase
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                  SSOT Aktif
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Projek: <span className="text-slate-200 font-medium">{SUPABASE_PROJECT_NAME}</span> ({SUPABASE_PROJECT_ID})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSyncing}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs sm:text-sm">
          {/* Last sync info banner */}
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Clock className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                Terakhir Dimuat:{' '}
                <strong className="text-white">
                  {formatSyncTime(lastResult?.timestamp)}
                </strong>
              </span>
            </div>
            <button
              onClick={loadStats}
              disabled={loadingStats || isSyncing}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
              <span>Periksa Status Cloud</span>
            </button>
          </div>

          {/* Success Alert */}
          {successMessage && (
            <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Pembaruan Berhasil</span>
                <span>{successMessage}</span>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Gagal Memuat Data</span>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Progress Bar during Sync */}
          {isSyncing && (
            <div className="p-4 bg-blue-950/40 border border-blue-800/60 rounded-xl space-y-2 animate-pulse">
              <div className="flex justify-between items-center text-xs font-medium text-blue-200">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  {syncProgress.stage}
                </span>
                <span>{syncProgress.percent}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${syncProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Primary Action: Pull from Server */}
          <div className="p-4 rounded-xl bg-linear-to-r from-blue-900/30 via-slate-900 to-indigo-900/20 border border-blue-700/50 hover:border-blue-600 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-blue-600/30 text-blue-400 mt-0.5 shrink-0 border border-blue-500/30">
                <ArrowDownToLine className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">Muat Ulang dari Server</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-600 text-white uppercase tracking-wider">
                    Read-Only (Aman)
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  Mengambil data resmi terbaru dari Supabase (Single Source of Truth) dan memperbarui cache perangkat ini tanpa mengubah atau menimpa data di database server.
                </p>
              </div>
            </div>

            <button
              onClick={() => handleStartSync('pull')}
              disabled={isSyncing}
              className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shrink-0 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Memuat...' : 'Muat Ulang Sekarang'}</span>
            </button>
          </div>

          {/* Database Metrics Comparison Table (Purely Diagnostic) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Diagnostik Data (Pemantauan Status)
              </h4>
              {loadingStats && <span className="text-[11px] text-blue-400 font-normal">Memeriksa cloud...</span>}
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              Perbandingan statistik di bawah ini murni bersifat diagnostik untuk memantau status data. Supabase berfungsi sebagai sumber kebenaran tunggal (SSOT).
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80">
                <div className="text-[11px] text-slate-400 font-medium">Data Siswa</div>
                <div className="flex items-baseline justify-between mt-1">
                  <div className="text-lg font-bold text-white">
                    {stats?.local.students ?? '-'}
                    <span className="text-[10px] text-slate-400 ml-1 font-normal">lokal</span>
                  </div>
                  <div className="text-xs font-semibold text-blue-400">
                    {stats?.cloud.students ?? '-'}
                    <span className="text-[9px] text-slate-400 ml-0.5">server</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80">
                <div className="text-[11px] text-slate-400 font-medium">Akun User</div>
                <div className="flex items-baseline justify-between mt-1">
                  <div className="text-lg font-bold text-white">
                    {stats?.local.users ?? '-'}
                    <span className="text-[10px] text-slate-400 ml-1 font-normal">lokal</span>
                  </div>
                  <div className="text-xs font-semibold text-blue-400">
                    {stats?.cloud.users ?? '-'}
                    <span className="text-[9px] text-slate-400 ml-0.5">server</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80">
                <div className="text-[11px] text-slate-400 font-medium">Bayar Formulir</div>
                <div className="flex items-baseline justify-between mt-1">
                  <div className="text-lg font-bold text-white">
                    {stats?.local.formPayments ?? '-'}
                    <span className="text-[10px] text-slate-400 ml-1 font-normal">lokal</span>
                  </div>
                  <div className="text-xs font-semibold text-blue-400">
                    {stats?.cloud.formPayments ?? '-'}
                    <span className="text-[9px] text-slate-400 ml-0.5">server</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80">
                <div className="text-[11px] text-slate-400 font-medium">Bayar BAM</div>
                <div className="flex items-baseline justify-between mt-1">
                  <div className="text-lg font-bold text-white">
                    {stats?.local.bamPayments ?? '-'}
                    <span className="text-[10px] text-slate-400 ml-1 font-normal">lokal</span>
                  </div>
                  <div className="text-xs font-semibold text-blue-400">
                    {stats?.cloud.bamPayments ?? '-'}
                    <span className="text-[9px] text-slate-400 ml-0.5">server</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Koneksi terenkripsi SSL 256-bit Supabase</span>
          </div>
          <button
            onClick={onClose}
            disabled={isSyncing}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
