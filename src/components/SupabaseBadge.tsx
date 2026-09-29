import React, { useEffect, useState } from 'react';
import { Database, CheckCircle2, RefreshCw, AlertCircle, ArrowUpDown } from 'lucide-react';
import { testSupabaseConnection, SUPABASE_PROJECT_NAME, SUPABASE_PROJECT_ID } from '../utils/supabaseClient';
import { performFullSupabaseSync, getLastSyncInfo, formatSyncTime } from '../utils/supabaseSync';
import { SupabaseSyncModal } from './SupabaseSyncModal';

interface SupabaseBadgeProps {
  onDataSynced?: () => void;
  className?: string;
  variant?: 'compact' | 'full';
}

export const SupabaseBadge: React.FC<SupabaseBadgeProps> = ({
  onDataSynced,
  className = '',
  variant = 'compact',
}) => {
  const [status, setStatus] = useState<'testing' | 'connected' | 'error'>('testing');
  const [message, setMessage] = useState<string>('Menghubungkan ke Supabase...');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => getLastSyncInfo()?.timestamp || null);

  const checkConnection = async () => {
    setStatus('testing');
    const result = await testSupabaseConnection();
    if (result.ok) {
      setStatus('connected');
      setMessage(result.message);
    } else {
      setStatus('error');
      setMessage(result.message);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const handleManualSync = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsSyncing(true);
    try {
      const res = await performFullSupabaseSync('pull');
      setLastSyncTime(res.timestamp);
      if (onDataSynced) {
        onDataSynced();
      }
      setStatus('connected');
      setMessage('Data berhasil dimuat ulang dari server!');
    } catch (err: any) {
      console.error(err);
      setMessage(err?.message || 'Gagal memuat ulang data dari server');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleModalSyncDone = () => {
    setLastSyncTime(getLastSyncInfo()?.timestamp || null);
    if (onDataSynced) {
      onDataSynced();
    }
  };

  if (variant === 'compact') {
    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-xs transition-all cursor-pointer group hover:scale-105 active:scale-95 ${
            status === 'connected'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              : status === 'error'
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
          } ${className}`}
          title={`Supabase DB: ${SUPABASE_PROJECT_NAME} (${SUPABASE_PROJECT_ID}) • Klik untuk Muat Ulang dari Server`}
        >
          <Database className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate max-w-[140px] sm:max-w-none">
            Supabase: <span className="font-semibold">{SUPABASE_PROJECT_NAME}</span>
          </span>
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              status === 'connected'
                ? 'bg-emerald-400 animate-pulse'
                : status === 'error'
                ? 'bg-rose-400'
                : 'bg-amber-400 animate-ping'
            }`}
          />
        </button>

        <SupabaseSyncModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onDataSynced={handleModalSyncDone}
        />
      </>
    );
  }

  return (
    <>
      <div
        className={`p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${className}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg shrink-0 ${
              status === 'connected'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : status === 'error'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}
          >
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-white">Database Supabase Cloud (SSOT)</h4>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                {SUPABASE_PROJECT_ID}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Projek: <strong className="text-slate-200">{SUPABASE_PROJECT_NAME}</strong> •{' '}
              <span className="text-slate-400">Terakhir dimuat: </span>
              <span className="text-blue-300 font-medium">{formatSyncTime(lastSyncTime)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={() => setModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-blue-400" />
            <span>Pusat Data Server</span>
          </button>

          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Memuat ulang...' : 'Muat Ulang dari Server'}
          </button>
        </div>
      </div>

      <SupabaseSyncModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onDataSynced={handleModalSyncDone}
      />
    </>
  );
};
