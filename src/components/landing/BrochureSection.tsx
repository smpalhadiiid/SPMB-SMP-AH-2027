// =====================================================================
// src/components/landing/BrochureSection.tsx
// Seksi Brosur Resmi SPMB SMPS Al-Hadiid Cileungsi (PDF Download & Preview)
// =====================================================================

import React, { useState } from 'react';
import { SchoolInfo, CostBreakdown, TestSchedule } from '../../types';
import { downloadBrochureFile, getBrochurePdfBlobUrl } from '../../utils/brochureGenerator';
import {
  FileText, Download, Eye, Sparkles, CheckCircle2, ShieldCheck,
  Calendar, CreditCard, BookOpen, Layers, X, ExternalLink, Loader2
} from 'lucide-react';
import Swal from 'sweetalert2';

interface BrochureSectionProps {
  schoolInfo: SchoolInfo;
  costBreakdowns: CostBreakdown[];
  testSchedules: TestSchedule[];
  onOpenRegister?: () => void;
  onOpenWhatsApp?: () => void;
}

export const BrochureSection: React.FC<BrochureSectionProps> = ({
  schoolInfo,
  costBreakdowns = [],
  testSchedules = [],
  onOpenRegister,
  onOpenWhatsApp,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const academicYear = schoolInfo.academicYear || '2027/2028';
  const fileName = schoolInfo.brochureFileName || `Brosur_Resmi_SPMB_SMP_AlHadiid_${academicYear.replace('/', '_')}.pdf`;

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const res = await downloadBrochureFile(schoolInfo, costBreakdowns, testSchedules);
      if (res.success) {
        Swal.fire({
          icon: 'success',
          title: 'Brosur Berhasil Diunduh!',
          html: `
            <div style="text-align: left; font-size: 13px; color: #334155; line-height: 1.6;">
              <p style="margin-bottom: 8px;">
                Berkas <strong>${fileName}</strong> telah otomatis disimpan di perangkat Anda.
              </p>
              <div style="background-color: #f1f5f9; padding: 10px; border-radius: 10px; margin-bottom: 10px; font-size: 12px;">
                📄 <strong>Format:</strong> Adobe PDF Document (2 Halaman)<br/>
                🏷️ <strong>Tahun Ajaran:</strong> ${academicYear}<br/>
                🏫 <strong>Penerbit:</strong> ${schoolInfo.name}
              </div>
              <p style="font-size: 12px; color: #059669;">
                Anda juga dapat membuka pratinjau brosur langsung di browser ini.
              </p>
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: '✔ Selesai',
          cancelButtonText: '👁️ Buka Pratinjau',
          confirmButtonColor: '#10b981',
          cancelButtonColor: '#2563eb',
          customClass: {
            popup: 'rounded-2xl font-sans',
            confirmButton: 'px-5 py-2.5 rounded-xl text-xs font-bold',
            cancelButton: 'px-5 py-2.5 rounded-xl text-xs font-bold',
          },
        }).then((result) => {
          if (result.isDismissed && result.dismiss === Swal.DismissReason.cancel) {
            handleOpenPreview();
          }
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Mengunduh Brosur',
          text: res.message || 'Terjadi kendala saat memproses berkas brosur.',
          confirmButtonColor: '#ef4444',
          customClass: { popup: 'rounded-2xl font-sans' },
        });
      }
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Kendala Sistem',
        text: 'Tidak dapat mengunduh berkas brosur saat ini. Silakan hubungi Panitia.',
        confirmButtonColor: '#ef4444',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenPreview = () => {
    setIsLoadingPreview(true);
    try {
      const url = getBrochurePdfBlobUrl(schoolInfo, costBreakdowns, testSchedules);
      setPreviewBlobUrl(url);
      setIsPreviewOpen(true);
    } catch (e) {
      console.warn('Gagal menyiapkan pratinjau brosur:', e);
      handleDownload();
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleClosePreview = () => {
    setIsPreviewOpen(false);
  };

  return (
    <section id="brosur" className="py-20 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white relative overflow-hidden border-b border-slate-800">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-10 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold tracking-wide uppercase shadow-inner mb-3">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Dokumen Informasi Resmi SPMB {academicYear}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Unduh Brosur Panduan SPMB
          </h2>
          <p className="mt-3.5 text-sm sm:text-base text-slate-300 leading-relaxed">
            Dapatkan panduan lengkap mengenai profil sekolah, kurikulum terpadu, program unggulan tahfidz & teknologi, alur 8 tahap pendaftaran, serta estimasi rincian biaya resmi SMPS Al-Hadiid Cileungsi.
          </p>
        </div>

        {/* Brochure Showcase Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Visual Brochure Card Preview (2 Pages Mockup) */}
          <div className="lg:col-span-5 flex flex-col sm:flex-row lg:flex-col gap-4 justify-center items-center">
            {/* Page 1 Mockup */}
            <div className="w-full max-w-sm bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 rounded-2xl p-5 shadow-2xl relative overflow-hidden group hover:border-emerald-500/50 transition-all">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Brosur Hal. 1</div>
                    <div className="text-[10px] text-slate-400">Profil & Program Unggulan</div>
                  </div>
                </div>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-mono font-bold">
                  PAGE 1
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Profil & Visi Misi:</strong> Generasi Robbani, Hafizh & Berakhlak</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>5 Program Unggulan:</strong> Tahfidz, Bahasa Asing, Coding & Robotika</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Fasilitas:</strong> Kelas AC, Lab Multimedia CBT, Lapangan Olahraga</span>
                </div>
              </div>
            </div>

            {/* Page 2 Mockup */}
            <div className="w-full max-w-sm bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 rounded-2xl p-5 shadow-2xl relative overflow-hidden group hover:border-blue-500/50 transition-all">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Brosur Hal. 2</div>
                    <div className="text-[10px] text-slate-400">Alur, Biaya & Rekening Resmi</div>
                  </div>
                </div>
                <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded font-mono font-bold">
                  PAGE 2
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <span><strong>Alur 8 Tahapan:</strong> Dari daftar akun hingga penetapan rombel</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <span><strong>Ketentuan Biaya:</strong> Formulir pendaftaran, SPP, dan rincian BAM</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <span><strong>Rekening Bank BSI Resmi & Kontak:</strong> Hotline WhatsApp & Website</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Information, Specs & Instant Download CTA */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Dokumen Resmi & Akurat</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                Brosur SPMB TP {academicYear}
              </h3>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                Disusun resmi oleh Panitia SPMB dan disahkan oleh Kepala Sekolah SMPS Al-Hadiid Cileungsi. Cocok dicetak pada kertas A4 atau dibaca di smartphone dan tablet.
              </p>
            </div>

            {/* Document Specs Pill Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2 border-y border-slate-800 text-xs">
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="text-[11px] text-slate-400">Format File</div>
                <div className="font-bold text-white mt-0.5 font-mono">Adobe PDF</div>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="text-[11px] text-slate-400">Jumlah Halaman</div>
                <div className="font-bold text-white mt-0.5 font-mono">2 Halaman (A4)</div>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="text-[11px] text-slate-400">Ukuran Berkas</div>
                <div className="font-bold text-emerald-400 mt-0.5 font-mono">~2.4 MB (Ringan)</div>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="text-[11px] text-slate-400">Status Validasi</div>
                <div className="font-bold text-emerald-400 mt-0.5">✓ Terverifikasi</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Sedang Mengunduh Berkas...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>Unduh Brosur Resmi (PDF)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleOpenPreview}
                disabled={isLoadingPreview || isDownloading}
                className="py-3.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isLoadingPreview ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyiapkan...</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 text-blue-400" />
                    <span>Pratinjau di Layar</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Nama berkas: <code className="font-mono text-slate-300">{fileName}</code></span>
              </div>
              {onOpenWhatsApp && (
                <button
                  type="button"
                  onClick={onOpenWhatsApp}
                  className="text-emerald-400 hover:text-emerald-300 font-semibold underline cursor-pointer"
                >
                  Tanya Panitia via WhatsApp →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* IN-APP PREVIEW MODAL (Safe for iFrames & No Popup Blocker) */}
      {isPreviewOpen && previewBlobUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{fileName}</h3>
                  <p className="text-[11px] text-slate-400">Pratinjau Brosur Resmi SPMB SMPS Al-Hadiid Cileungsi</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleClosePreview}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title="Tutup Pratinjau"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal PDF Viewer Body */}
            <div className="flex-1 bg-slate-950 relative overflow-hidden">
              <object
                data={previewBlobUrl}
                type="application/pdf"
                className="w-full h-full"
              >
                {/* Fallback if object cannot render inside browser */}
                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-300 space-y-4">
                  <FileText className="w-16 h-16 text-emerald-400" />
                  <p className="text-sm font-semibold max-w-md">
                    Browser Anda tidak mendukung pratinjau PDF langsung di dalam frame. Silakan klik tombol di bawah untuk mengunduh berkas.
                  </p>
                  <button
                    onClick={handleDownload}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh {fileName}</span>
                  </button>
                </div>
              </object>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
