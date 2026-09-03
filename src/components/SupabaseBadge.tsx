import React, { useEffect, useState } from 'react';
import { Database, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
import { testSupabaseConnection, SUPABASE_PROJECT_NAME, SUPABASE_PROJECT_ID } from '../utils/supabaseClient';
import { loadDataFromSupabase } from '../utils/storage';

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

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await loadDataFromSupabase();
      if (onDataSynced) {
        onDataSynced();
      }
      setStatus('connected');
      setMessage('Data berhasil disinkronkan dengan Supabase!');
    } catch (err: any) {
      console.error(err);
      setMessage('Gagal sinkronisasi data');
    } finally {
      setIsSyncing(false);
    }
  };

  if (variant === 'compact') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-xs transition-all ${
          status === 'connected'
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            : status === 'error'
            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
        } ${className}`}
        title={`Supabase DB: ${SUPABASE_PROJECT_NAME} (${SUPABASE_PROJECT_ID})`}
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
      </div>
    );
  }

  return (
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
            <h4 className="text-sm font-semibold text-white">Database Supabase Terkoneksi</h4>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
              {SUPABASE_PROJECT_ID}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Projek: <strong className="text-slate-200">{SUPABASE_PROJECT_NAME}</strong> • Endpoint: <code className="text-blue-300 font-mono text-[11px]">https://{SUPABASE_PROJECT_ID}.supabase.co</code>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Menyingkronkan...' : 'Sinkronkan Data'}
        </button>
      </div>
    </div>
  );
};
