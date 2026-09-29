import React, { useState, useEffect } from 'react';
import {
  X, ZoomIn, ZoomOut, RotateCw, Download, CheckCircle2,
  XCircle, FileText, Calendar, CreditCard, User, AlertCircle
} from 'lucide-react';
import { downloadPaymentProof } from '../../utils/paymentProofStorage';

export interface ProofModalData {
  url: string;
  studentName: string;
  regNo?: string;
  paymentType?: 'form' | 'bam' | 'tuition' | 'other' | string;
  amount?: number;
  status?: string;
  date?: string;
  notes?: string;
  fileName?: string;
  gender?: 'Laki-laki' | 'Perempuan';
}

export interface PaymentProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ProofModalData | null;
  onVerify?: (isVerified: boolean) => void;
}

export const PaymentProofModal: React.FC<PaymentProofModalProps> = ({
  isOpen,
  onClose,
  data,
  onVerify,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0);

  // Reset zoom & rotation whenever modal opens or data changes
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotate(0);
    }
  }, [isOpen, data?.url]);

  if (!isOpen || !data || !data.url) return null;

  const isForm = data.paymentType === 'form';
  const isBam = data.paymentType === 'bam';
  const typeLabel = isForm ? 'Biaya Formulir Pendaftaran' : isBam ? 'Biaya Awal Masuk (BAM)' : 'Pembayaran SPMB';
  const isVerified = data.status === 'verified';
  const isRejected = data.status === 'rejected';
  const isPending = !isVerified && !isRejected;

  const defaultFileName = data.fileName || `Bukti_${isForm ? 'Formulir' : isBam ? 'BAM' : 'Transfer'}_${(data.studentName || 'Siswa').replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;

  return (
    <div
      id="payment-proof-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="payment-proof-modal-card"
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-sm sm:text-base text-white truncate">
                  Bukti Pembayaran: {data.studentName}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                  isVerified
                    ? 'bg-emerald-500 text-slate-950'
                    : isRejected
                    ? 'bg-rose-500 text-white'
                    : 'bg-amber-400 text-slate-950 animate-pulse'
                }`}>
                  {isVerified ? '✓ Lunas' : isRejected ? '✕ Ditolak' : '⏳ Menunggu Verifikasi'}
                </span>
              </div>
              <div className="text-[11px] text-slate-300 flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="font-mono text-amber-300 font-bold">{data.regNo || 'NO-REG'}</span>
                <span>•</span>
                <span className="text-slate-300 font-medium">{typeLabel}</span>
                {data.amount ? (
                  <>
                    <span>•</span>
                    <span className="font-bold text-emerald-400 font-mono">
                      Rp {data.amount.toLocaleString('id-ID')}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <button
            id="close-proof-modal-btn"
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0"
            title="Tutup Modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Floating Controls Bar */}
        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2 text-xs flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              id="zoom-out-proof-btn"
              type="button"
              onClick={() => setZoom(prev => Math.max(0.5, Number((prev - 0.25).toFixed(2))))}
              className="p-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
              title="Perkecil Gambar"
            >
              <ZoomOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Perkecil</span>
            </button>
            <button
              id="zoom-in-proof-btn"
              type="button"
              onClick={() => setZoom(prev => Math.min(3, Number((prev + 0.25).toFixed(2))))}
              className="p-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
              title="Perbesar Gambar"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Perbesar ({Math.round(zoom * 100)}%)</span>
            </button>
            <button
              id="rotate-proof-btn"
              type="button"
              onClick={() => setRotate(prev => (prev + 90) % 360)}
              className="p-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
              title="Putar 90 Derajat"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Putar</span>
            </button>
            {zoom !== 1 || rotate !== 0 ? (
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setRotate(0);
                }}
                className="text-[11px] text-blue-600 hover:underline px-1.5 font-semibold cursor-pointer"
              >
                Reset Tampilan
              </button>
            ) : null}
          </div>

          <button
            id="download-proof-btn"
            type="button"
            onClick={() => downloadPaymentProof(data.url, defaultFileName)}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer ml-auto"
            title="Download Bukti Pembayaran ke Komputer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Download Bukti Asli</span>
          </button>
        </div>

        {/* Viewer Canvas */}
        <div className="flex-1 min-h-[280px] max-h-[55vh] bg-slate-950 p-4 flex items-center justify-center overflow-auto select-none relative">
          <div
            className="transition-transform duration-200 ease-out max-w-full flex items-center justify-center"
            style={{
              transform: `scale(${zoom}) rotate(${rotate}deg)`,
              transformOrigin: 'center center',
            }}
          >
            <img
              src={data.url}
              alt={`Bukti Transfer ${data.studentName}`}
              className="max-h-[48vh] max-w-full object-contain rounded-lg shadow-2xl bg-white/5"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* Footer & Verification Action Bar */}
        <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          <div className="text-slate-600 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-800">Tanggal:</span> {data.date || '-'}
              {data.notes ? (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="italic text-slate-500">"{data.notes}"</span>
                </>
              ) : null}
            </div>
            {data.fileName ? (
              <div className="text-[11px] text-slate-400 font-mono truncate max-w-md">
                Nama File: {data.fileName}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 shrink-0 justify-end">
            {onVerify ? (
              <>
                <button
                  id="modal-verify-btn"
                  type="button"
                  onClick={() => onVerify(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Verifikasi Lunas dan Sahkan Pembayaran"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>Verifikasi Lunas</span>
                </button>
                <button
                  id="modal-reject-btn"
                  type="button"
                  onClick={() => onVerify(false)}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Tolak Bukti Pembayaran"
                >
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>Tolak Bukti</span>
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
