import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      localStorage.clear();
    } catch (e) {
      console.warn('Could not clear localStorage:', e);
    }
    window.location.reload();
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-white">Sistem SPMB Mengalami Masalah</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Terjadi kesalahan saat memuat tampilan. Silakan muat ulang halaman atau atur ulang data lokal.
              </p>
              {this.state.error && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-[11px] font-mono text-rose-400 text-left overflow-x-auto max-h-24">
                  {this.state.error.toString()}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-emerald-300" />
                <span>Muat Ulang Halaman</span>
              </button>
              <button
                onClick={this.handleReset}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4 text-slate-400" />
                <span>Reset Sesi &amp; Kembali ke Awal</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
