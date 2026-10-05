import React, { useState, useEffect } from 'react';
import { Eye, FileText, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import { getPaymentProofSignedUrl, getCachedPaymentProofUrl, isPdfProof } from '../../utils/paymentProofStorage';

export interface PaymentProofThumbnailProps {
  pathOrUrl?: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  onClick?: () => void;
  showOverlayHover?: boolean;
  fileName?: string;
}

export const PaymentProofThumbnail: React.FC<PaymentProofThumbnailProps> = ({
  pathOrUrl,
  alt = 'Bukti Transfer',
  className = 'w-16 h-16',
  imgClassName = 'w-full h-full object-cover',
  onClick,
  showOverlayHover = true,
  fileName,
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() => getCachedPaymentProofUrl(pathOrUrl));
  const [isLoading, setIsLoading] = useState<boolean>(!getCachedPaymentProofUrl(pathOrUrl) && !!pathOrUrl);
  const [hasError, setHasError] = useState<boolean>(false);
  const [retryAttempted, setRetryAttempted] = useState<boolean>(false);

  useEffect(() => {
    if (!pathOrUrl || pathOrUrl.trim() === '') {
      setResolvedUrl(null);
      setIsLoading(false);
      setHasError(false);
      setRetryAttempted(false);
      return;
    }

    // Jika sudah berupa data URL atau blob
    if (pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('blob:')) {
      setResolvedUrl(pathOrUrl);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    const cached = getCachedPaymentProofUrl(pathOrUrl);
    if (cached) {
      setResolvedUrl(cached);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setHasError(false);
    setRetryAttempted(false);

    getPaymentProofSignedUrl(pathOrUrl, 3600)
      .then((res) => {
        if (!isMounted) return;
        if (res.url) {
          setResolvedUrl(res.url);
          setHasError(false);
        } else {
          setHasError(true);
        }
      })
      .catch(() => {
        if (isMounted) setHasError(true);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [pathOrUrl]);

  // Handle image load error with one-time fresh signed URL retry
  const handleImageError = () => {
    if (!retryAttempted && pathOrUrl) {
      setRetryAttempted(true);
      setIsLoading(true);
      getPaymentProofSignedUrl(pathOrUrl, 3600, true)
        .then((res) => {
          if (res.url) {
            setResolvedUrl(res.url);
            setHasError(false);
          } else {
            setHasError(true);
          }
        })
        .catch(() => setHasError(true))
        .finally(() => setIsLoading(false));
    } else {
      setHasError(true);
    }
  };

  const isPdf = isPdfProof(pathOrUrl || '', fileName);

  if (!pathOrUrl || pathOrUrl.trim() === '') {
    return (
      <div className={`rounded-xl border border-dashed border-slate-700 bg-slate-900/60 flex flex-col items-center justify-center p-2 text-slate-500 text-[10px] ${className}`}>
        <ImageIcon className="w-4 h-4 text-slate-600 mb-0.5" />
        <span className="text-center font-medium">Belum Upload</span>
      </div>
    );
  }

  // Apakah URL yang akan dirender valid untuk tag img
  const effectiveImgSrc = resolvedUrl || (
    pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('blob:') || pathOrUrl.startsWith('http')
      ? pathOrUrl
      : null
  );

  return (
    <div
      onClick={onClick}
      className={`relative group rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 flex items-center justify-center select-none shadow-xs transition-all ${
        onClick ? 'cursor-pointer hover:border-emerald-500 hover:ring-2 hover:ring-emerald-500/30' : ''
      } ${className}`}
      title={onClick ? 'Klik untuk memperbesar bukti transfer' : alt}
    >
      {isLoading || !effectiveImgSrc ? (
        <div className="flex flex-col items-center justify-center p-2 text-slate-400 gap-1">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          <span className="text-[9px] font-semibold text-slate-400">Memuat...</span>
        </div>
      ) : hasError ? (
        <div className="flex flex-col items-center justify-center p-1 text-amber-400 text-center">
          <AlertCircle className="w-4 h-4 mb-0.5 text-amber-400" />
          <span className="text-[9px] font-bold text-slate-300">Bukti Tersimpan</span>
          {onClick && <span className="text-[8px] text-emerald-400 underline">Buka</span>}
        </div>
      ) : isPdf ? (
        <div className="flex flex-col items-center justify-center p-2 text-rose-400 text-center w-full h-full bg-slate-900">
          <FileText className="w-5 h-5 mb-0.5 text-rose-500" />
          <span className="text-[9px] font-bold text-slate-200">PDF Bukti</span>
          <span className="text-[8px] text-slate-400">Transfer</span>
        </div>
      ) : (
        <img
          src={effectiveImgSrc}
          alt={alt}
          className={`${imgClassName} transition-transform duration-200 group-hover:scale-105`}
          onError={handleImageError}
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      )}

      {/* Hover action overlay */}
      {showOverlayHover && onClick && (
        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1 p-1">
          <Eye className="w-4 h-4 text-emerald-400 drop-shadow" />
          <span className="text-[10px] font-bold drop-shadow hidden sm:inline">Perbesar</span>
        </div>
      )}
    </div>
  );
};
