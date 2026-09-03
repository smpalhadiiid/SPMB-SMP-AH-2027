import React, { useState } from 'react';
import { Database, Copy, Check, Download, X, Code, Sparkles } from 'lucide-react';
import { FormPaymentRecord, BamPaymentRecord } from '../../types';
import { generatePaymentSql, downloadPaymentSqlFile } from '../../utils/sqlPaymentGenerator';

interface PaymentSqlModalProps {
  isOpen: boolean;
  onClose: () => void;
  formPayments: FormPaymentRecord[];
  bamPayments: BamPaymentRecord[];
}

export const PaymentSqlModal: React.FC<PaymentSqlModalProps> = ({
  isOpen,
  onClose,
  formPayments,
  bamPayments,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'ddl' | 'dml'>('all');

  if (!isOpen) return null;

  const fullSql = generatePaymentSql(formPayments, bamPayments);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadPaymentSqlFile(formPayments, bamPayments);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 rounded-2xl max-w-4xl w-full text-slate-100 shadow-2xl border border-slate-700 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base sm:text-lg flex items-center gap-2">
                <span>Skrip SQL Database Pembayaran SPMB</span>
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  PostgreSQL / MySQL
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                DDL Tabel `form_payments` & `bam_payments`, View Laporan Keuangan, Indexing & Data Seed ({formPayments.length + bamPayments.length} TRX)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold flex items-center gap-1">
              <Code className="w-3.5 h-3.5 text-blue-400" /> Dialek:
            </span>
            <span className="font-semibold text-slate-200 bg-slate-700 px-2.5 py-1 rounded-md">
              ANSI SQL / Postgres / MySQL 8.0
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700 text-slate-200 hover:bg-slate-600 hover:text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Tersalin ke Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Salin SQL</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="px-3.5 py-1.5 rounded-lg font-bold bg-blue-600 text-white hover:bg-blue-500 transition-all flex items-center gap-1.5 cursor-pointer text-xs shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>Unduh File .SQL</span>
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="p-4 overflow-y-auto font-mono text-xs bg-slate-950 text-emerald-400 leading-relaxed space-y-2 flex-1 scrollbar-thin scrollbar-thumb-slate-700">
          <pre className="whitespace-pre-wrap break-all">{fullSql}</pre>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/90 text-slate-400 text-[11px] flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-amber-400">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Skrip ini siap diimpor langsung ke Supabase, Cloud SQL, phpMyAdmin, DBeaver, atau PostgreSQL terminal.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg transition-colors cursor-pointer text-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
