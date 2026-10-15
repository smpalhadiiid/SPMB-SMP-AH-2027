import React, { useState, useEffect } from 'react';
import {
  Database, Copy, Check, Download, RefreshCw, CheckCircle2,
  AlertTriangle, ShieldCheck, Zap, X, Terminal, Server, Layers, ExternalLink
} from 'lucide-react';
import {
  generateCbtDatabaseSql,
  downloadCbtSqlFile,
  testCbtSupabaseTables,
  autoInitializeCbtDatabase,
  CbtTableCheckResult
} from '../../utils/sqlCbtGenerator';
import { SUPABASE_URL, SUPABASE_PROJECT_ID } from '../../utils/supabaseClient';

interface CbtDatabaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CbtDatabaseSetupModal: React.FC<CbtDatabaseSetupModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [copied, setCopied] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initFeedback, setInitFeedback] = useState<string | null>(null);
  const [tableChecks, setTableChecks] = useState<CbtTableCheckResult[]>([]);
  const [allHealthy, setAllHealthy] = useState<boolean | null>(null);

  const fullSql = generateCbtDatabaseSql();

  // Run initial health check on modal open
  useEffect(() => {
    if (isOpen) {
      handleRunHealthCheck();
    }
  }, [isOpen]);

  const handleCopySql = () => {
    navigator.clipboard.writeText(fullSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRunHealthCheck = async () => {
    setIsChecking(true);
    setInitFeedback(null);
    try {
      const res = await testCbtSupabaseTables();
      setTableChecks(res.results);
      setAllHealthy(res.allHealthy);
    } catch (err: any) {
      console.warn('Health check error:', err);
    } finally {
      setIsChecking(false);
    }
  };

  const handleAutoInit = async () => {
    setIsInitializing(true);
    setInitFeedback(null);
    try {
      const res = await autoInitializeCbtDatabase();
      setInitFeedback(res.message);
      if (res.success) {
        await handleRunHealthCheck();
        onSuccess?.();
      }
    } catch (err: any) {
      setInitFeedback('Terjadi kendala inisialisasi: ' + (err?.message || 'Gagal'));
    } finally {
      setIsInitializing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white">
                  Database CBT &amp; Monitoring Live Ujian
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Supabase PostgreSQL
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Skrip SQL migrasi, diagnosa tabel, dan inisialisasi database ujian SPMB SMP Al-Hadiid Cileungsi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Top Quick Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2 text-xs text-slate-700">
              <Server className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Project ID: <strong className="font-mono text-blue-700">{SUPABASE_PROJECT_ID}</strong></span>
              <span className="text-slate-300">•</span>
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Cloud Sync
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleAutoInit}
                disabled={isInitializing}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Zap className={`w-3.5 h-3.5 ${isInitializing ? 'animate-spin' : ''}`} />
                <span>{isInitializing ? 'Menginisialisasi...' : 'Inisialisasi Database Otomatis'}</span>
              </button>

              <button
                type="button"
                onClick={handleRunHealthCheck}
                disabled={isChecking}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                <span>{isChecking ? 'Memeriksa...' : 'Cek Status Tabel'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopySql}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin!' : 'Salin Skrip SQL'}</span>
              </button>

              <button
                type="button"
                onClick={downloadCbtSqlFile}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh .SQL</span>
              </button>
            </div>
          </div>

          {/* Feedback Banner */}
          {initFeedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{initFeedback}</span>
            </div>
          )}

          {/* Table Health Diagnostic Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Status Tabel CBT di Database Supabase ({tableChecks.length} Tabel)</span>
              </h4>
              {allHealthy !== null && (
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  allHealthy ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  {allHealthy ? '✅ Semua Tabel Normal & Terhubung' : '⚠️ Perlu Dijalankan Skrip SQL'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {tableChecks.map((t) => (
                <div
                  key={t.tableName}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                    t.exists
                      ? 'bg-emerald-50/50 border-emerald-200 text-slate-800'
                      : 'bg-rose-50/50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-extrabold flex items-center gap-1.5">
                      {t.exists ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      )}
                      <span className="font-mono">{t.tableName}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">{t.displayName}</div>
                  </div>

                  <div className="text-right">
                    <div className={`font-black text-xs ${t.exists ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {t.exists ? `${t.rowCount} Baris` : 'Belum Ada'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {t.exists ? 'Siap Digunakan' : 'Perlu Dibuat'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Guide Steps */}
          <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 space-y-2">
            <div className="font-extrabold flex items-center gap-1.5 text-blue-950">
              <Terminal className="w-4 h-4 text-blue-600" />
              <span>Petunjuk Eksekusi di SQL Editor Supabase:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-blue-800 font-semibold pl-1">
              <li>Klik tombol <strong>Salin Skrip SQL</strong> di atas.</li>
              <li>Buka dashboard Supabase pada tab baru: <a href="https://supabase.com/dashboard/project/fjscuokehikwhungyvll/sql" target="_blank" rel="noopener noreferrer" className="underline font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-0.5">Supabase SQL Editor <ExternalLink className="w-3 h-3 inline" /></a>.</li>
              <li>Klik <strong>+ New Query</strong>, tempelkan skrip SQL, lalu klik tombol hijau <strong>Run</strong>.</li>
              <li>Seluruh tabel, indeks, hak akses (RLS), dan Realtime Replication akan aktif seketika.</li>
            </ol>
          </div>

          {/* SQL Code View */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-bold">Pratinjau Skrip SQL (012_spmb_cbt_live_monitoring_schema.sql):</span>
              <span className="text-[11px] text-slate-400 font-mono">ANSI / PostgreSQL 14+</span>
            </div>
            <div className="bg-slate-950 text-slate-200 p-4 rounded-2xl font-mono text-[11px] overflow-x-auto max-h-64 border border-slate-800 leading-relaxed shadow-inner">
              <pre>{fullSql}</pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            Terhubung dengan <strong className="text-slate-700">SMP Al-Hadiid Cileungsi</strong> via Supabase Realtime
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
