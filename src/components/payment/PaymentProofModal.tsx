import React, { useState, useEffect } from 'react';
import {
  X, ZoomIn, ZoomOut, RotateCw, Download, CheckCircle2,
  XCircle, FileText, AlertCircle, Loader2, Eye, ShieldCheck, MessageSquare
} from 'lucide-react';
import {
  getPaymentProofSignedUrl,
  downloadPaymentProofFile,
  formatFileSize,
  isPdfProof,
} from '../../utils/paymentProofStorage';

export interface ProofModalData {
  url?: string;
  storagePath?: string;
  studentName: string;
  regNo?: string;
  paymentType?: 'form' | 'bam' | 'tuition' | 'other' | string;
  amount?: number;
  status?: string;
  date?: string;
  notes?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  rejectionReason?: string;
  gender?: 'Laki-laki' | 'Perempuan';
}

export interface PaymentProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ProofModalData | null;
  onVerify?: (isVerified: boolean, rejectionReason?: string) => void;
}

export const PaymentProofModal: React.FC<PaymentProofModalProps> = ({
  isOpen,
  onClose,
  data,
  onVerify,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  // State untuk alur Penolakan Admin (Wajib Alasan)
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [rejectionError, setRejectionError] = useState('');

  const targetPathOrUrl = data?.storagePath || data?.url;

  // Resolusi Signed URL dari Supabase Storage saat modal dibuka
  useEffect(() => {
    if (!isOpen || !targetPathOrUrl) {
      setResolvedUrl(null);
      setIsLoadingUrl(false);
      setUrlError(null);
      setShowRejectForm(false);
      setRejectionReasonInput('');
      setRejectionError('');
      return;
    }

    setZoom(1);
    setRotate(0);
    setShowRejectForm(false);
    setRejectionReasonInput('');
    setRejectionError('');

    // Jika sudah berupa data: atau blob: url
    if (targetPathOrUrl.startsWith('data:') || targetPathOrUrl.startsWith('blob:')) {
      setResolvedUrl(targetPathOrUrl);
      setIsLoadingUrl(false);
      setUrlError(null);
      return;
    }

    // Ambil Signed URL dengan masa berlaku 1 jam (3600 detik)
    setIsLoadingUrl(true);
    setUrlError(null);

    getPaymentProofSignedUrl(targetPathOrUrl, 3600)
      .then((res) => {
        if (res.url) {
          setResolvedUrl(res.url);
          setUrlError(null);
        } else {
          setUrlError(res.error || 'Gagal mengambil Signed URL bukti transfer dari Supabase Storage.');
          setResolvedUrl(null);
        }
      })
      .catch((err) => {
        setUrlError(err?.message || 'Koneksi gagal saat mengambil berkas bukti.');
        setResolvedUrl(null);
      })
      .finally(() => {
        setIsLoadingUrl(false);
      });
  }, [isOpen, targetPathOrUrl]);

  if (!isOpen || !data) return null;

  const isForm = data.paymentType === 'form' || data.paymentType === 'formulir';
  const isBam = data.paymentType === 'bam' || data.paymentType === 'daftar_ulang';
  const typeLabel = isForm
    ? 'Biaya Formulir Pendaftaran'
    : isBam
    ? 'Biaya Awal Masuk (BAM)'
    : 'Pembayaran SPMB';

  const isVerified = data.status === 'verified';
  const isRejected = data.status === 'rejected';
  const isPending = !isVerified && !isRejected;

  const isPdf = isPdfProof(targetPathOrUrl || '', data.fileType || data.fileName);
  const defaultFileName =
    data.fileName ||
    `Bukti_${isForm ? 'Formulir' : isBam ? 'BAM' : 'Transfer'}_${(data.studentName || 'Siswa').replace(
      /[^a-zA-Z0-9]/g,
      '_'
    )}${isPdf ? '.pdf' : '.jpg'}`;

  const handleConfirmReject = () => {
    if (!rejectionReasonInput.trim()) {
      setRejectionError('Alasan penolakan wajib diisi untuk memberi tahu calon murid.');
      return;
    }
    if (onVerify) {
      onVerify(false, rejectionReasonInput.trim());
      setShowRejectForm(false);
    }
  };

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
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-sm sm:text-base text-white truncate">
                  Bukti Pembayaran: {data.studentName}
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    isVerified
                      ? 'bg-emerald-500 text-slate-950'
                      : isRejected
                      ? 'bg-rose-500 text-white'
                      : 'bg-amber-400 text-slate-950 animate-pulse'
                  }`}
                >
                  {isVerified ? '✓ Terverifikasi' : isRejected ? '✕ Ditolak' : '⏳ Menunggu Verifikasi'}
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
            {!isPdf && resolvedUrl ? (
              <>
                <button
                  id="zoom-out-proof-btn"
                  type="button"
                  onClick={() => setZoom((prev) => Math.max(0.5, Number((prev - 0.25).toFixed(2))))}
                  className="p-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                  title="Perkecil Gambar"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Perkecil</span>
                </button>
                <button
                  id="zoom-in-proof-btn"
                  type="button"
                  onClick={() => setZoom((prev) => Math.min(3, Number((prev + 0.25).toFixed(2))))}
                  className="p-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                  title="Perbesar Gambar"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Perbesar ({Math.round(zoom * 100)}%)</span>
                </button>
                <button
                  id="rotate-proof-btn"
                  type="button"
                  onClick={() => setRotate((prev) => (prev + 90) % 360)}
                  className="p-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                  title="Putar 90 Derajat"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Putar</span>
                </button>
                {(zoom !== 1 || rotate !== 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setZoom(1);
                      setRotate(0);
                    }}
                    className="text-[11px] text-blue-600 hover:underline px-1.5 font-semibold cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </>
            ) : isPdf ? (
              <span className="text-[11px] text-slate-600 font-semibold flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-rose-500" />
                <span>Dokumen Bukti Transfer Format PDF</span>
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {resolvedUrl && (
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-[11px] font-bold shadow-xs transition-all flex items-center gap-1.5"
                title="Buka Berkas di Tab Baru Browser"
              >
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span>Buka Tab Baru</span>
              </a>
            )}
            <button
              id="download-proof-btn"
              type="button"
              onClick={() =>
                downloadPaymentProofFile(resolvedUrl || targetPathOrUrl || '', defaultFileName)
              }
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              title="Download Berkas Bukti Pembayaran Asli"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Download Bukti</span>
            </button>
          </div>
        </div>

        {/* Rejection Alert Banner (Jika Status Ditolak) */}
        {(isRejected || data.rejectionReason) && (
          <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-800 flex items-start gap-2.5 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Alasan Penolakan Bukti:</span>{' '}
              <span>{data.rejectionReason || data.notes || 'Bukti tidak memenuhi syarat / nominal tidak sesuai.'}</span>
            </div>
          </div>
        )}

        {/* Viewer Canvas */}
        <div className="flex-1 min-h-[320px] max-h-[58vh] bg-slate-950 p-4 flex items-center justify-center overflow-auto select-none relative">
          {isLoadingUrl ? (
            <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <p className="text-xs">Memuat berkas bukti dari Supabase Storage privat...</p>
            </div>
          ) : urlError ? (
            <div className="flex flex-col items-center justify-center gap-2 max-w-md p-6 bg-slate-900 rounded-2xl text-center text-slate-300 border border-slate-800">
              <AlertCircle className="w-10 h-10 text-amber-400" />
              <h4 className="font-bold text-white text-sm">Gagal Menampilkan Berkas Bukti</h4>
              <p className="text-xs text-slate-400">{urlError}</p>
              <p className="text-[11px] text-slate-500 font-mono mt-1 break-all">
                Path: {targetPathOrUrl}
              </p>
            </div>
          ) : isPdf && resolvedUrl ? (
            <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center bg-white/5 rounded-xl p-2">
              <iframe
                src={`${resolvedUrl}#toolbar=0`}
                title={`Bukti Transfer PDF ${data.studentName}`}
                className="w-full h-[52vh] rounded-lg border border-slate-700 bg-white"
              />
            </div>
          ) : resolvedUrl ? (
            <div
              className="transition-transform duration-200 ease-out max-w-full flex items-center justify-center"
              style={{
                transform: `scale(${zoom}) rotate(${rotate}deg)`,
                transformOrigin: 'center center',
              }}
            >
              <img
                src={resolvedUrl}
                alt={`Bukti Transfer ${data.studentName}`}
                className="max-h-[50vh] max-w-full object-contain rounded-lg shadow-2xl bg-white/5"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="text-slate-400 text-xs italic">
              Tidak ada gambar atau dokumen bukti yang tersedia.
            </div>
          )}
        </div>

        {/* Modal Form Penolakan Khusus Admin */}
        {showRejectForm && (
          <div className="p-4 bg-rose-50 border-t border-rose-200 flex flex-col gap-2 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
              <MessageSquare className="w-4 h-4 text-rose-600" />
              <span>Masukkan Alasan Penolakan Bukti Pembayaran (Wajib):</span>
            </div>
            <textarea
              value={rejectionReasonInput}
              onChange={(e) => {
                setRejectionReasonInput(e.target.value);
                if (rejectionError) setRejectionError('');
              }}
              placeholder="Contoh: Foto bukti buram/tidak terbaca, nominal transfer kurang dari Rp 200.000, atau nama pengirim tidak cocok."
              rows={2}
              className="w-full p-2.5 border border-rose-300 bg-white rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            {rejectionError && (
              <span className="text-[11px] font-bold text-rose-600">{rejectionError}</span>
            )}
            <div className="flex items-center justify-end gap-2 mt-1">
              <button
                type="button"
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectionReasonInput('');
                  setRejectionError('');
                }}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
              >
                Konfirmasi Tolak Pembayaran
              </button>
            </div>
          </div>
        )}

        {/* Footer & Verification Action Bar */}
        <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          <div className="text-slate-600 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-800">Tanggal Upload:</span>{' '}
              {data.date || '-'}
              {data.fileSize ? (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-600 font-mono">
                    Ukuran: {formatFileSize(data.fileSize)}
                  </span>
                </>
              ) : null}
            </div>
            {data.fileName && (
              <div className="text-[11px] text-slate-400 font-mono truncate max-w-md">
                Nama File: {data.fileName}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 justify-end">
            {onVerify && !showRejectForm && (
              <>
                <button
                  id="modal-verify-btn"
                  type="button"
                  onClick={() => onVerify(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-98"
                  title="Verifikasi Lunas dan Sahkan Pembayaran"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>Verifikasi Lunas</span>
                </button>
                <button
                  id="modal-reject-btn"
                  type="button"
                  onClick={() => setShowRejectForm(true)}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-98"
                  title="Tolak Bukti Pembayaran (Wajib Alasan)"
                >
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>Tolak Bukti</span>
                </button>
              </>
            )}
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
