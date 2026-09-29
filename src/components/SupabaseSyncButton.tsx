import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, CheckCircle2, AlertCircle, ArrowUpDown } from 'lucide-react';
import { SupabaseSyncModal } from './SupabaseSyncModal';
import {
  performFullSupabaseSync,
  getLastSyncInfo,
  formatSyncTime,
  SyncResult
} from '../utils/supabaseSync';
import { testSupabaseConnection, SUPABASE_PROJECT_NAME, SUPABASE_PROJECT_ID } from '../utils/supabaseClient';

interface SupabaseSyncButtonProps {
  onDataSynced?: () => void;
  className?: string;
  variant?: 'header' | 'button' | 'pill' | 'card';
  showLastSync?: boolean;
}

export const SupabaseSyncButton: React.FC<SupabaseSyncButtonProps> = ({
  onDataSynced,
  className = '',
  variant = 'header',
  showLastSync = true,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<SyncResult | null>(() => getLastSyncInfo());
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<'connected' | 'testing' | 'error'>('testing');

  const checkConn = async () => {
    try {
      const res = await testSupabaseConnection();
      setStatus(res.ok ? 'connected' : 'error');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    checkConn();
    setLastSync(getLastSyncInfo());
  }, []);

  const handleQuickSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSyncing(true);
    setToastMsg(null);
    try {
      const res = await performFullSupabaseSync('pull');
      setLastSync(res);
      setStatus('connected');
      setToastMsg('Data berhasil dimuat ulang dari Supabase!');
      if (onDataSynced) {
        onDataSynced();
      }
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err: any) {
      setStatus('error');
      setToastMsg(err?.message || 'Gagal memuat ulang data server');
      setTimeout(() => setToastMsg(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenModal = () => {
    setModalOpen(true);
  };

  const handleDataSyncedFromModal = () => {
    setLastSync(getLastSyncInfo());
    if (onDataSynced) {
      onDataSynced();
    }
  };

  // 1. Header Variant (For top bars & sidebars)
  if (variant === 'header') {
    return (
      <>
        <div className={`relative inline-flex items-center gap-1.5 ${className}`}>
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-semibold rounded-lg transition-all shadow-xs active:scale-95 group"
            title={`Supabase: ${SUPABASE_PROJECT_NAME} (${SUPABASE_PROJECT_ID}) - Single Source of Truth`}
          >
            <Database className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform" />
            <span className="font-semibold">Muat Server</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                status === 'connected'
                  ? 'bg-emerald-400 animate-pulse'
                  : status === 'error'
                  ? 'bg-rose-400'
                  : 'bg-amber-400'
              }`}
            />
          </button>

          <button
            onClick={handleQuickSync}
            disabled={isSyncing}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 hover:text-white border border-slate-700 rounded-lg transition-colors"
            title="Muat Ulang dari Server Sekarang (1-Click)"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>

          {/* Floating Toast Notification */}
          {toastMsg && (
            <div className="absolute top-full right-0 mt-2 z-50 px-3 py-2 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl shadow-xl whitespace-nowrap flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{toastMsg}</span>
            </div>
          )}
        </div>

        <SupabaseSyncModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onDataSynced={handleDataSyncedFromModal}
        />
      </>
    );
  }

  // 2. Pill Variant (Compact badge)
  if (variant === 'pill') {
    return (
      <>
        <button
          onClick={handleOpenModal}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-xs transition-all cursor-pointer ${
            status === 'connected'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              : status === 'error'
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
          } ${className}`}
          title="Klik untuk melihat status database server Supabase"
        >
          <Database className="w-3.5 h-3.5 shrink-0" />
          <span>Server Supabase</span>
          <RefreshCw className={`w-3 h-3 ml-0.5 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
        </button>

        <SupabaseSyncModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onDataSynced={handleDataSyncedFromModal}
        />
      </>
    );
  }

  // 3. Card Variant (Full card for Overview or Settings)
  if (variant === 'card') {
    return (
      <>
        <div
          className={`p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-200 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${className}`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`p-3 rounded-xl shrink-0 ${
                status === 'connected'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : status === 'error'
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              }`}
            >
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">Database Supabase Cloud (SSOT)</h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold">
                  {SUPABASE_PROJECT_ID}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Projek: <strong className="text-slate-200">{SUPABASE_PROJECT_NAME}</strong> •{' '}
                <span>Pembaruan terakhir: <span className="text-blue-300 font-medium">{formatSyncTime(lastSync?.timestamp)}</span></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              onClick={handleQuickSync}
              disabled={isSyncing}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Memuat ulang...' : 'Muat Ulang Server'}</span>
            </button>

            <button
              onClick={handleOpenModal}
              disabled={isSyncing}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-blue-400" />
              <span>Pusat Server</span>
            </button>
          </div>
        </div>

        {/* Toast Notification */}
        {toastMsg && (
          <div className="p-3 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl shadow-md flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        <SupabaseSyncModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onDataSynced={handleDataSyncedFromModal}
        />
      </>
    );
  }

  // 4. Default Button Variant
  return (
    <>
      <button
        onClick={handleOpenModal}
        disabled={isSyncing}
        className={`px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 ${className}`}
      >
        <Database className="w-4 h-4" />
        <span>Muat Ulang dari Server Supabase</span>
        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
      </button>

      <SupabaseSyncModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onDataSynced={handleDataSyncedFromModal}
      />
    </>
  );
};
