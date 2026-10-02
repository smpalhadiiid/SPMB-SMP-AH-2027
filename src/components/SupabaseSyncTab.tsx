import React, { useState, useEffect } from 'react';
import {
  Database, RefreshCw, ArrowDownToLine, ArrowUpFromLine, CheckCircle2,
  AlertCircle, Clock, ShieldCheck, Sparkles, Server, HardDrive, HelpCircle,
  CheckCircle, ArrowRight, Zap, RefreshCcw, Code2, Copy, Play, Check, ExternalLink, Terminal, Globe,
  ShieldAlert, FileText, ChevronDown, ChevronUp, Layers, AlertTriangle, FileCode
} from 'lucide-react';
import { apiClient, SupabaseApiStatus, SupabaseTablesStatus } from '../utils/apiClient';
import {
  performFullSupabaseSync,
  fetchSyncComparisonStats,
  getLastSyncInfo,
  formatSyncTime,
  SyncMode,
  SyncStatsComparison,
  SyncResult
} from '../utils/supabaseSync';
import {
  testSupabaseConnection,
  SUPABASE_PROJECT_NAME,
  SUPABASE_PROJECT_ID,
  SUPABASE_URL
} from '../utils/supabaseClient';
import {
  checkLegacyAppStateStatus,
  migrateAllAppStateToRelationalDatabase,
  LegacyAppStateStatus,
  MigrationExecutionResult,
} from '../utils/migrateAppStateToDatabase';

interface SupabaseSyncTabProps {
  onRefreshAllData?: () => void;
}

export const SupabaseSyncTab: React.FC<SupabaseSyncTabProps> = ({ onRefreshAllData }) => {
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

  // Migration State (spmb_app_state -> Database Sebenarnya)
  const [legacyStatus, setLegacyStatus] = useState<LegacyAppStateStatus | null>(null);
  const [checkingLegacy, setCheckingLegacy] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationExecutionResult | null>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  // API Explorer State
  const [apiStatus, setApiStatus] = useState<SupabaseApiStatus | null>(null);
  const [loadingApiStatus, setLoadingApiStatus] = useState(false);
  const [activeEndpoint, setActiveEndpoint] = useState<string>('/api/supabase/status');
  const [apiOutput, setApiOutput] = useState<string | null>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedQuotaSql, setCopiedQuotaSql] = useState(false);

  const checkLegacy = async () => {
    setCheckingLegacy(true);
    try {
      const res = await checkLegacyAppStateStatus();
      setLegacyStatus(res);
    } catch (err: any) {
      console.warn('Gagal cek legacy state:', err);
    } finally {
      setCheckingLegacy(false);
    }
  };

  const handleMigrateData = async () => {
    setIsMigrating(true);
    setMigrationError(null);
    setMigrationResult(null);
    try {
      const res = await migrateAllAppStateToRelationalDatabase();
      setMigrationResult(res);
      if (!res.success && res.errors.length > 0) {
        setMigrationError(res.errors.join('; '));
      }

      try {
        await apiClient.migrateAppState();
      } catch {
        // ignore
      }

      await checkLegacy();
      await loadStats();
      if (onRefreshAllData) onRefreshAllData();
    } catch (err: any) {
      setMigrationError(err?.message || 'Gagal memproses pemindahan data.');
    } finally {
      setIsMigrating(false);
    }
  };

  const checkApiHealth = async () => {
    setLoadingApiStatus(true);
    try {
      const res = await apiClient.getSupabaseStatus();
      setApiStatus(res);
    } catch {
      // ignore
    } finally {
      setLoadingApiStatus(false);
    }
  };

  const handleTestEndpoint = async (path: string) => {
    setActiveEndpoint(path);
    setIsTestingApi(true);
    setApiOutput(null);
    try {
      const startTime = performance.now();
      const res = await fetch(path);
      const data = await res.json();
      const duration = Math.round(performance.now() - startTime);
      setApiOutput(JSON.stringify({ httpStatus: res.status, durationMs: duration, response: data }, null, 2));
    } catch (err: any) {
      setApiOutput(JSON.stringify({ error: err?.message || 'Gagal mengeksekusi request' }, null, 2));
    } finally {
      setIsTestingApi(false);
    }
  };

  const loadStats = async () => {
    setLoadingStats(true);
    setErrorMessage(null);
    try {
      const data = await fetchSyncComparisonStats();
      setStats(data);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal memuat perbandingan database.');
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStats();
    checkApiHealth();
    checkLegacy();
    setLastResult(getLastSyncInfo());
  }, []);

  const handleSync = async (mode: SyncMode = 'pull') => {
    setIsSyncing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setSyncProgress({ stage: 'Menyiapkan pemuatan ulang data dari server...', percent: 10 });

    try {
      const result = await performFullSupabaseSync(mode, (stage, percent) => {
        setSyncProgress({ stage, percent });
      });

      setLastResult(result);
      setSuccessMessage(result.message);
      await loadStats();

      if (onRefreshAllData) {
        onRefreshAllData();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan saat memuat ulang data dari server.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-semibold border border-blue-500/30">
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span>Pusat Data Server Supabase (SSOT)</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white">
            Pusat Data Resmi Supabase
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl">
            Database Supabase adalah Single Source of Truth (SSOT). Gunakan tombol di bawah ini untuk memuat ulang data pendaftar, akun pengguna, dan pembayaran terbaru dari server ke tampilan tanpa risiko menimpa data server.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto shrink-0">
          <button
            onClick={loadStats}
            disabled={loadingStats || isSyncing}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
            <span>Periksa Status Data</span>
          </button>

          <button
            onClick={() => handleSync('pull')}
            disabled={isSyncing}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>{isSyncing ? 'Memuat ulang...' : 'Muat Ulang dari Server'}</span>
          </button>
        </div>
      </div>

      {/* Status Alerts */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-medium flex items-start justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-sm font-bold text-emerald-950 mb-0.5">
                Sinkronisasi Berhasil Dilakukan
              </strong>
              <span>{successMessage}</span>
            </div>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl text-xs font-medium flex items-start justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-sm font-bold text-rose-950 mb-0.5">
                Kendala Sinkronisasi
              </strong>
              <span>{errorMessage}</span>
            </div>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-700 hover:text-rose-900 font-bold text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Progress Bar during active sync */}
      {isSyncing && (
        <div className="p-5 bg-blue-50 border border-blue-200 rounded-2xl space-y-3 animate-pulse shadow-sm">
          <div className="flex justify-between items-center text-xs font-bold text-blue-900">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              {syncProgress.stage}
            </span>
            <span className="text-blue-700 font-mono text-sm">{syncProgress.percent}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${syncProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Cloud & Connection Metadata Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Status Koneksi Supabase</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-bold text-slate-900">
                {stats?.connectionOk ? 'Terkoneksi (Aktif)' : 'Memeriksa / Terputus'}
              </span>
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  stats?.connectionOk ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
              {stats?.connectionMessage || 'Koneksi ke server normal'}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <Server className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-slate-500 font-medium">Identitas Cloud Supabase</div>
            <div className="text-sm font-bold text-slate-900 truncate">
              {SUPABASE_PROJECT_NAME}
            </div>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
              ID: {SUPABASE_PROJECT_ID}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Waktu Sinkron Terakhir</div>
            <div className="text-sm font-bold text-slate-900">
              {formatSyncTime(lastResult?.timestamp)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Mode: {lastResult?.mode ? (lastResult.mode === 'pull' ? 'Pull (Server SSOT)' : String(lastResult.mode).toUpperCase()) : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Database Architecture & Migration to Relational Tables */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Migrasi Data: Penyimpanan Tunggal (Single Source of Truth)</span>
                {!legacyStatus?.hasLegacyData ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Relasional Aktif
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Perlu Migrasi
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Memastikan semua data pendaftaran dipindahkan sepenuhnya dari <code className="text-indigo-600 font-mono">spmb_app_state</code> ke tabel relasional database resmi (<code className="text-slate-700 font-mono">students</code>, <code className="text-slate-700 font-mono">users</code>, <code className="text-slate-700 font-mono">payments</code>, <code className="text-slate-700 font-mono">soal</code>).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={checkLegacy}
              disabled={checkingLegacy || isMigrating}
              className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Periksa ulang status data spmb_app_state"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingLegacy ? 'animate-spin' : ''}`} />
              <span>Cek Status</span>
            </button>
            <button
              onClick={handleMigrateData}
              disabled={isMigrating}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <Database className={`w-3.5 h-3.5 ${isMigrating ? 'animate-spin' : ''}`} />
              <span>{isMigrating ? 'Memindahkan Data...' : 'Pindahkan Semua Data ke Database'}</span>
            </button>
          </div>
        </div>

        {/* Status Display */}
        {legacyStatus && (
          <div className="space-y-3">
            {!legacyStatus.hasLegacyData ? (
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-800 space-y-1">
                  <p className="font-bold">
                    Database Relasional Bersih & Terstandarisasi
                  </p>
                  <p className="text-emerald-700">
                    Tidak ditemukan data transaksional yang tertinggal di tabel penyimpanan lama (<code className="font-mono">spmb_app_state</code>). Semua data pendaftar, akun, pembayaran, dan soal dikelola secara eksklusif langsung melalui tabel relasional database.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900">
                    <p className="font-bold">
                      Ditemukan {legacyStatus.totalLegacyRecords} rekaman lama di <code className="font-mono">spmb_app_state</code> yang siap dipindahkan:
                    </p>
                    <p className="text-amber-700 mt-0.5">
                      Klik tombol <strong>"Pindahkan Semua Data ke Database"</strong> untuk mentransfer data ini ke tabel relasional dan mengaktifkan Single Source of Truth.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  <div className="p-2.5 rounded-lg bg-white border border-amber-200 text-center">
                    <div className="text-[11px] font-mono text-slate-500 truncate">Calon Murid</div>
                    <div className="text-base font-bold text-slate-800 mt-0.5">{legacyStatus.counts.students} data</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-amber-200 text-center">
                    <div className="text-[11px] font-mono text-slate-500 truncate">Akun Pengguna</div>
                    <div className="text-base font-bold text-slate-800 mt-0.5">{legacyStatus.counts.users} data</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-amber-200 text-center">
                    <div className="text-[11px] font-mono text-slate-500 truncate">Bayar Formulir</div>
                    <div className="text-base font-bold text-slate-800 mt-0.5">{legacyStatus.counts.formPayments} data</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-amber-200 text-center">
                    <div className="text-[11px] font-mono text-slate-500 truncate">Bayar BAM</div>
                    <div className="text-base font-bold text-slate-800 mt-0.5">{legacyStatus.counts.bamPayments} data</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-amber-200 text-center">
                    <div className="text-[11px] font-mono text-slate-500 truncate">Bank Soal</div>
                    <div className="text-base font-bold text-slate-800 mt-0.5">{legacyStatus.counts.questions} data</div>
                  </div>
                </div>
              </div>
            )}

            {/* Migration Feedback Result */}
            {migrationResult && (
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span>Hasil Eksekusi Pemindahan Data:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-white p-2 rounded-lg border border-blue-100 text-center">
                    <span className="text-slate-500">Siswa Dipindahkan</span>
                    <p className="font-bold text-blue-700">{migrationResult.studentsMigrated}</p>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-blue-100 text-center">
                    <span className="text-slate-500">Akun Dipindahkan</span>
                    <p className="font-bold text-blue-700">{migrationResult.usersMigrated}</p>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-blue-100 text-center">
                    <span className="text-slate-500">Pembayaran Dipindahkan</span>
                    <p className="font-bold text-blue-700">{migrationResult.paymentsMigrated}</p>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-blue-100 text-center">
                    <span className="text-slate-500">Soal Dipindahkan</span>
                    <p className="font-bold text-blue-700">{migrationResult.questionsMigrated}</p>
                  </div>
                </div>
                {migrationResult.keysRemoved.length > 0 && (
                  <p className="text-[11px] text-blue-600">
                    Kunci yang dibersihkan dari spmb_app_state: {migrationResult.keysRemoved.join(', ')}
                  </p>
                )}
              </div>
            )}

            {migrationError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{migrationError}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Data Parity / Comparison Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-blue-600" />
              <span>Diagnostik Data: Cache Lokal vs Database Server (SSOT)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Statistik di bawah ini bersifat diagnostik murni untuk pemantauan. Supabase adalah Single Source of Truth (SSOT).
            </p>
          </div>
          {loadingStats && (
            <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Memuat data diagnostik...
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-xs font-semibold text-slate-600">Calon Murid</div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">
              {stats?.local.students ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-center gap-1">
              <span>Server:</span>
              <strong className="text-blue-600 font-bold">{stats?.cloud.students ?? 0}</strong>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-xs font-semibold text-slate-600">Akun Pengguna</div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">
              {stats?.local.users ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-center gap-1">
              <span>Server:</span>
              <strong className="text-blue-600 font-bold">{stats?.cloud.users ?? 0}</strong>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-xs font-semibold text-slate-600">Bayar Formulir</div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">
              {stats?.local.formPayments ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-center gap-1">
              <span>Server:</span>
              <strong className="text-blue-600 font-bold">{stats?.cloud.formPayments ?? 0}</strong>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-xs font-semibold text-slate-600">Bayar BAM</div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">
              {stats?.local.bamPayments ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-center gap-1">
              <span>Server:</span>
              <strong className="text-blue-600 font-bold">{stats?.cloud.bamPayments ?? 0}</strong>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-xs font-semibold text-slate-600">Kuota Kelas</div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">
              {stats?.local.classQuotas ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-center gap-1">
              <span>Server:</span>
              <strong className="text-blue-600 font-bold">{stats?.cloud.classQuotas ?? 0}</strong>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-xs font-semibold text-slate-600">Jadwal Ujian</div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">
              {stats?.local.schedules ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-center gap-1">
              <span>Server:</span>
              <strong className="text-blue-600 font-bold">{stats?.cloud.schedules ?? 0}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Integrasi Tabel Kuota Kelas (public.class_quotas) */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/40 rounded-2xl p-6 shadow-xl text-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-semibold border border-emerald-500/30">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Integrasi Tabel Relasional: public.class_quotas</span>
            </div>
            <h3 className="text-lg font-extrabold text-white">
              Status Sinkronisasi Kuota Kelas (Single Source of Truth)
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Kapasitas dan data rombongan belajar dikelola melalui tabel relasional <code className="text-emerald-400 font-mono">public.class_quotas</code>. Sistem dilengkapi dual-write otomatis ke database server untuk memastikan data kuota kelas tidak pernah hilang.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const sql = `-- =====================================================================
-- 011_class_quotas_schema_and_policies.sql
-- Integrasi Tabel Relasional Kuota Kelas (Single Source of Truth)
-- SPMB SMP Al-Hadiid Cileungsi
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.class_quotas (
    id VARCHAR(100) PRIMARY KEY,
    academic_year VARCHAR(50) DEFAULT '2027/2028' NOT NULL,
    level VARCHAR(50) DEFAULT 'Kelas 7' NOT NULL,
    class_name VARCHAR(100) NOT NULL,
    capacity INTEGER DEFAULT 32 NOT NULL,
    filled INTEGER DEFAULT 0 NOT NULL,
    homeroom_teacher VARCHAR(255) DEFAULT 'Pengajar Al-Hadiid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.class_quotas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.class_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for class_quotas" ON public.class_quotas;
DROP POLICY IF EXISTS "Allow all for class_quotas" ON public.class_quotas;

CREATE POLICY "Allow all for class_quotas" ON public.class_quotas 
FOR ALL USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.class_quotas TO anon, authenticated, service_role;

-- Migrasikan data default jika tabel kosong
DO $$
DECLARE
    v_count integer;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.class_quotas;
    IF v_count = 0 THEN
        IF EXISTS (SELECT 1 FROM public.spmb_app_state WHERE key = 'class_quotas') THEN
            INSERT INTO public.class_quotas (id, academic_year, level, class_name, capacity, filled, homeroom_teacher, created_at)
            SELECT
                COALESCE(elem->>'id', 'q_' || floor(random() * 1000)::text),
                COALESCE(elem->>'academicYear', '2027/2028'),
                COALESCE(elem->>'level', 'Kelas 7'),
                COALESCE(elem->>'className', 'Kelas 7 A'),
                COALESCE((elem->>'capacity')::integer, 32),
                COALESCE((elem->>'filled')::integer, 0),
                COALESCE(elem->>'homeroomTeacher', 'Ustadz Ahmad Fauzi, S.Pd.I.'),
                NOW()
            FROM public.spmb_app_state,
                 jsonb_array_elements(payload) AS elem
            WHERE key = 'class_quotas'
              AND jsonb_typeof(payload) = 'array'
            ON CONFLICT (id) DO NOTHING;
        END IF;

        SELECT COUNT(*) INTO v_count FROM public.class_quotas;
        IF v_count = 0 THEN
            INSERT INTO public.class_quotas (id, academic_year, level, class_name, capacity, filled, homeroom_teacher, created_at)
            VALUES 
                ('cls-7a', '2027/2028', 'Kelas 7', '7 A', 32, 0, '-', NOW()),
                ('cls-7b', '2027/2028', 'Kelas 7', '7 B', 32, 0, '-', NOW()),
                ('cls-7c', '2027/2028', 'Kelas 7', '7 C', 32, 0, '-', NOW()),
                ('cls-7d', '2027/2028', 'Kelas 7', '7 D', 32, 0, '-', NOW())
            ON CONFLICT (id) DO NOTHING;
        END IF;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';`;
                navigator.clipboard.writeText(sql);
                setCopiedQuotaSql(true);
                setTimeout(() => setCopiedQuotaSql(false), 2500);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <FileCode className="w-4 h-4" />
              <span>{copiedQuotaSql ? 'SQL Tersalin ke Clipboard!' : 'Salin Skrip SQL Migrasi (011)'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Status Tabel:</span>
            <span className="font-bold text-emerald-400 mt-0.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> public.class_quotas Terdaftar
            </span>
          </div>
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Tabel Relasional di Supabase:</span>
            <span className="font-bold text-white mt-0.5 flex items-center gap-1.5">
              {stats?.classQuotasTableCount && stats.classQuotasTableCount > 0 ? (
                <span className="text-emerald-400 font-bold">✓ {stats.classQuotasTableCount} Rombel di Tabel Relasional</span>
              ) : (
                <span className="text-amber-400 font-semibold">{stats?.cloud.classQuotas ?? 0} Rombel (Fallback spmb_app_state)</span>
              )}
            </span>
          </div>
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Endpoint API:</span>
            <code className="font-mono text-emerald-300 text-[11px] mt-0.5 block">GET /api/class-quotas</code>
          </div>
        </div>

        {(!stats?.classQuotasTableCount || stats.classQuotasTableCount === 0) && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <span>
                Tabel <code className="font-mono text-amber-300">public.class_quotas</code> siap menerima migrasi. Salin skrip SQL di atas lalu jalankan di <strong>SQL Editor Supabase</strong> untuk mengaktifkan RLS Policy &amp; mengintegrasikan data kelas secara langsung.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Sync Execution Action: Pull Only (Read-Only) */}
      <div className="bg-white p-6 rounded-2xl border-2 border-blue-500 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wider">
              Single Source of Truth
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Read-Only Enforced
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            Muat Ulang dari Server Supabase (Pull)
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Mengambil data resmi terbaru langsung dari server Supabase untuk memperbarui cache tampilan lokal Anda. Proses ini aman dan read-only: sistem diproteksi oleh technical guard aktif yang memblokir segala bentuk operasi penulisan (insert, update, upsert, delete) ke database server.
          </p>
        </div>

        <div className="w-full md:w-auto shrink-0">
          <button
            onClick={() => handleSync('pull')}
            disabled={isSyncing}
            className="w-full md:w-auto px-6 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Memuat dari Server...' : 'Muat Ulang dari Server Sekarang'}</span>
          </button>
        </div>
      </div>

      {/* REST API Gateway & Supabase Integration Panel */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl text-white space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-semibold border border-emerald-500/30">
              <Code2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>REST API Gateway Supabase</span>
            </div>
            <h3 className="text-lg font-extrabold text-white">
              API Koneksi Database Supabase
            </h3>
            <p className="text-xs text-slate-400 max-w-2xl">
              Aplikasi telah dilengkapi API Server (/api/*) untuk menghubungkan frontend, sistem eksternal, atau aplikasi mobile dengan database Supabase SPMB SMP Al-Hadiid.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
              <span className={`w-2.5 h-2.5 rounded-full ${apiStatus?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span className="font-bold text-slate-200">
                {apiStatus?.connected ? 'API Supabase Terhubung' : 'Memeriksa API...'}
              </span>
              {apiStatus?.latencyMs !== null && apiStatus?.latencyMs !== undefined && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] font-mono border border-emerald-800/50">
                  {apiStatus.latencyMs}ms
                </span>
              )}
            </div>

            <button
              onClick={checkApiHealth}
              disabled={loadingApiStatus}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Periksa Ulang API"
            >
              <RefreshCw className={`w-4 h-4 ${loadingApiStatus ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* API Endpoints Navigator */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-400" />
              Pilih Endpoint untuk Uji Coba Langsung (Live Test):
            </span>
            <span className="text-[11px] text-slate-500 font-mono">Host: {window.location.origin}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {[
              { path: '/api/supabase/status', label: 'Status & Ping Supabase', method: 'GET', badge: 'Health' },
              { path: '/api/admin/legacy-state-status', label: 'Status Data Legacy (spmb_app_state)', method: 'GET', badge: 'Admin' },
              { path: '/api/supabase/tables', label: 'Diagnostik Tabel Database', method: 'GET', badge: 'System' },
              { path: '/api/students', label: 'Daftar Calon Murid (Relasional)', method: 'GET', badge: 'Database' },
              { path: '/api/class-quotas', label: 'Kuota Kelas (public.class_quotas)', method: 'GET', badge: 'Database' },
              { path: '/api/soal', label: 'Bank Soal CBT (Relasional)', method: 'GET', badge: 'Database' },
              { path: '/api/docs', label: 'Dokumentasi API SPMB', method: 'GET', badge: 'Docs' },
            ].map((ep) => (
              <button
                key={ep.path}
                onClick={() => handleTestEndpoint(ep.path)}
                disabled={isTestingApi}
                className={`p-3 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                  activeEndpoint === ep.path
                    ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg'
                    : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/80 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {ep.method}
                  </span>
                  <span className="text-[10px] text-slate-400">{ep.badge}</span>
                </div>
                <div className="font-bold text-xs truncate mt-1 text-slate-100">{ep.label}</div>
                <div className="text-[11px] font-mono text-slate-400 truncate">{ep.path}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Live Output Console */}
        <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
              <span className="font-mono text-xs font-bold text-slate-300 ml-2">
                Response Console: {activeEndpoint}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleTestEndpoint(activeEndpoint)}
                disabled={isTestingApi}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Play className={`w-3.5 h-3.5 fill-current ${isTestingApi ? 'animate-spin' : ''}`} />
                <span>{isTestingApi ? 'Memanggil...' : 'Jalankan Request'}</span>
              </button>

              {apiOutput && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(apiOutput);
                    setCopiedSnippet(true);
                    setTimeout(() => setCopiedSnippet(false), 2000);
                  }}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Salin Response JSON"
                >
                  {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSnippet ? 'Tersalin' : 'Salin'}</span>
                </button>
              )}
            </div>
          </div>

          <pre className="p-3 bg-slate-900/90 rounded-lg text-slate-200 font-mono text-xs overflow-x-auto max-h-64 scrollbar-thin scrollbar-thumb-slate-700">
            {isTestingApi ? (
              <span className="text-blue-400 animate-pulse">Menghubungi API Server & Database Supabase...</span>
            ) : apiOutput ? (
              apiOutput
            ) : (
              <span className="text-slate-500">// Klik salah satu endpoint di atas atau tombol 'Jalankan Request' untuk menguji koneksi API Supabase.</span>
            )}
          </pre>
        </div>

        {/* Code Snippet Guides */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" /> Contoh cURL
            </span>
            <pre className="p-2.5 bg-slate-900 rounded text-[11px] font-mono text-slate-300 overflow-x-auto">
{`curl -X GET \\
  ${window.location.origin}${activeEndpoint} \\
  -H "Accept: application/json"`}
            </pre>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
            <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> Contoh JavaScript (Fetch)
            </span>
            <pre className="p-2.5 bg-slate-900 rounded text-[11px] font-mono text-slate-300 overflow-x-auto">
{`const res = await fetch('${activeEndpoint}');
const data = await res.json();
console.log(data);`}
            </pre>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5" /> Contoh Python (requests)
            </span>
            <pre className="p-2.5 bg-slate-900 rounded text-[11px] font-mono text-slate-300 overflow-x-auto">
{`import requests
res = requests.get('${window.location.origin}${activeEndpoint}')
data = res.json()`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
