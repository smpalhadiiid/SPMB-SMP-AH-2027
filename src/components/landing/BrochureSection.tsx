// =====================================================================
// src/components/landing/BrochureSection.tsx
// Seksi Brosur Resmi SPMB SMPS Al-Hadiid Cileungsi (Dukungan Gambar & PDF)
// =====================================================================

import React, { useState } from 'react';
import { SchoolInfo, CostBreakdown, TestSchedule } from '../../types';
import { downloadBrochureFile, getBrochurePdfBlobUrl, isImageBrochure } from '../../utils/brochureGenerator';
import {
  FileText, Download, Eye, Sparkles, CheckCircle2, ShieldCheck,
  Layers, X, Loader2, Image as ImageIcon, ZoomIn, ZoomOut, Maximize2
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
  onOpenRegister: _onOpenRegister,
  onOpenWhatsApp: _onOpenWhatsApp,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);

  const academicYear = schoolInfo.academicYear || '2027/2028';
  const isImage = isImageBrochure(schoolInfo);
  const defaultExt = isImage ? '.jpg' : '.pdf';
  const academicYearClean = academicYear.replace('/', '_');
  const fileName = schoolInfo.brochureFileName || `Brosur_Resmi_SPMB_SMP_AlHadiid_${academicYearClean}${defaultExt}`;

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const res = await downloadBrochureFile(schoolInfo, costBreakdowns, testSchedules);
      if (res.success) {
        Swal.fire({
          icon: 'success',
          title: `Brosur ${isImage ? 'Gambar' : 'PDF'} Berhasil Diunduh!`,
          html: `
            <div style="text-align: left; font-size: 13px; color: #334155; line-height: 1.6;">
              <p style="margin-bottom: 8px;">
                Berkas <strong>${fileName}</strong> telah otomatis disimpan ke perangkat Anda.
              </p>
              <div style="background-color: #f1f5f9; padding: 10px; border-radius: 10px; margin-bottom: 10px; font-size: 12px;">
                ${isImage ? '🖼️' : '📄'} <strong>Format:</strong> ${isImage ? 'Gambar Digital (JPG/PNG)' : 'Adobe PDF Document (2 Halaman)'}<br/>
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
        text: 'Tidak dapat mengunduh berkas brosur saat ini. Silakan hubungi Panitia SPMB.',
        confirmButtonColor: '#ef4444',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenPreview = () => {
    setIsLoadingPreview(true);
    setZoomScale(1);
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
      {/* Decorative Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-emerald-500/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-10 right-10 w-96 h-96 bg-teal-500/5 blur-[100px] rounded-full pointer-events-none" />

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
            Dapatkan panduan lengkap mengenai profil sekolah, kurikulum terpadu, program unggulan tahfidz & teknologi, alur 8 tahap pendaftaran online, serta rincian Biaya Awal Masuk (BAM) resmi SMPS Al-Hadiid Cileungsi.
          </p>
        </div>

        {/* Brochure Showcase Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Visual Brochure Card Preview */}
          <div className="lg:col-span-5 flex flex-col sm:flex-row lg:flex-col gap-4 justify-center items-center">
            {isImage && schoolInfo.brochureUrl ? (
              /* Display Real Uploaded Image Brochure Mockup */
              <div
                onClick={handleOpenPreview}
                className="w-full max-w-md bg-gradient-to-br from-slate-800 to-slate-900 border border-emerald-500/40 rounded-2xl p-4 shadow-2xl relative overflow-hidden group hover:border-emerald-400 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Brosur Gambar Resmi</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{fileName}</div>
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-mono font-bold">
                    HD IMAGE
                  </span>
                </div>

                {/* Actual Image Render with Hover Zoom Overlay */}
                <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-[3/4] max-h-[380px] flex items-center justify-center">
                  <img
                    src={schoolInfo.brochureUrl}
                    alt="Pratinjau Brosur SPMB"
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-opacity backdrop-blur-xs">
                    <div className="p-3 rounded-full bg-emerald-600 text-white shadow-lg">
                      <Maximize2 className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-white bg-slate-900/80 px-3 py-1 rounded-full border border-slate-700">
                      Klik untuk Pratinjau Penuh
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Siap Diunduh Calon Murid
                  </span>
                  <span>{schoolInfo.brochureFileSize || 'Gambar HD'}</span>
                </div>
              </div>
            ) : (
              /* Default 2-Page Visual Mockup for PDF */
              <>
                {/* Page 1 Mockup */}
                <div className="w-full max-w-sm bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 rounded-2xl p-5 shadow-2xl relative overflow-hidden group hover:border-emerald-500/50 transition-all">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Brosur Hal. 1</div>
                        <div className="text-[10px] text-slate-400">Profil & 5 Program Unggulan</div>
                      </div>
                    </div>
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-mono font-bold">
                      PAGE 1
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Profil & Visi Misi:</strong> Generasi Robbani, Hafizh & Berakhlak Salaf</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Program Unggulan:</strong> Tahfidz 3 Juz, Bahasa Arab & Inggris, Coding</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Fasilitas:</strong> Kelas AC, Lab Komputer CBT, Masjid Luas & Lapangan</span>
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
                        <div className="text-[10px] text-slate-400">Alur, Rincian BAM & Rekening BSI</div>
                      </div>
                    </div>
                    <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded font-mono font-bold">
                      PAGE 2
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <span><strong>Alur 8 Tahap:</strong> Registrasi online, CBT, hingga rombel kelas 7</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <span><strong>Rincian BAM:</strong> Ikhwan Rp 6.670.000 | Akhwat Rp 6.890.000</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <span><strong>Rekening Resmi:</strong> BSI 3953157480 a.n. Al-Hadiid</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right Column: Information, Specs & Instant Download CTA */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Dokumen Resmi & Akurat SPMB</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                Brosur SPMB TP {academicYear}
              </h3>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                Disusun resmi oleh Panitia SPMB dan disahkan oleh Kepala Sekolah SMPS Al-Hadiid Cileungsi. Berisi informasi lengkap kurikulum, alur pendaftaran, persyaratan, rincian biaya awal masuk (BAM), dan rekening resmi.
              </p>
            </div>

            {/* Document Specs Pill Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2 border-y border-slate-800 text-xs">
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="text-[11px] text-slate-400">Format File</div>
                <div className="font-bold text-white mt-0.5 font-mono">
                  {isImage ? `Gambar (${schoolInfo.brochureFileType || 'JPG/PNG'})` : 'Adobe PDF'}
                </div>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="text-[11px] text-slate-400">{isImage ? 'Kualitas' : 'Halaman'}</div>
                <div className="font-bold text-white mt-0.5 font-mono">
                  {isImage ? 'HD Siap Cetak' : '2 Halaman (A4)'}
                </div>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="text-[11px] text-slate-400">Ukuran Berkas</div>
                <div className="font-bold text-emerald-400 mt-0.5 font-mono">
                  {schoolInfo.brochureFileSize || (isImage ? '~1.5 MB' : '~2.4 MB')}
                </div>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="text-[11px] text-slate-400">Status Validasi</div>
                <div className="font-bold text-emerald-400 mt-0.5">✓ Terverifikasi</div>
              </div>
            </div>

            {/* Quick BAM Highlights Info */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Ringkasan Biaya Sesuai Brosur Resmi:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Formulir Pendaftaran</div>
                  <div className="font-bold text-emerald-400 font-mono">Rp 200.000</div>
                </div>
                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Total BAM Putra (Ikhwan)</div>
                  <div className="font-bold text-amber-300 font-mono">Rp 6.670.000</div>
                </div>
                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Total BAM Putri (Akhwat)</div>
                  <div className="font-bold text-pink-300 font-mono">Rp 6.890.000</div>
                </div>
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
                    {isImage ? <ImageIcon className="w-5 h-5" /> : <Download className="w-5 h-5" />}
                    <span>{isImage ? 'Unduh Brosur Gambar (JPG/PNG)' : 'Unduh Brosur Resmi (PDF)'}</span>
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
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Menyiapkan...</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 text-emerald-400" />
                    <span>{isImage ? 'Pratinjau Gambar' : 'Pratinjau PDF'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* In-App Fullscreen / Modal Viewer (Supports Both Image & PDF) */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden shadow-2xl text-white">
            {/* Modal Header */}
            <div className="p-4 sm:px-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  {isImage ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white truncate max-w-[280px] sm:max-w-md">{fileName}</h3>
                  <p className="text-[11px] text-slate-400">
                    Pratinjau Brosur Resmi SPMB SMPS Al-Hadiid Cileungsi ({isImage ? 'Gambar' : 'PDF'})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isImage && (
                  <div className="hidden sm:flex items-center gap-1 bg-slate-800 rounded-xl p-1 border border-slate-700 mr-2">
                    <button
                      type="button"
                      onClick={() => setZoomScale((z) => Math.max(0.6, z - 0.2))}
                      className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg cursor-pointer"
                      title="Perkecil"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-[11px] font-mono font-bold px-1.5 text-slate-300">
                      {Math.round(zoomScale * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setZoomScale((z) => Math.min(2.5, z + 0.2))}
                      className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg cursor-pointer"
                      title="Perbesar"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomScale(1)}
                      className="text-[10px] font-semibold px-2 py-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh {isImage ? 'Gambar' : 'PDF'}</span>
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

            {/* Modal Body: Image vs PDF */}
            <div className="flex-1 bg-slate-950 relative overflow-auto flex items-center justify-center p-4">
              {isImage ? (
                /* High-Quality Image Display */
                <div className="max-w-full max-h-full overflow-auto flex items-center justify-center p-2">
                  <img
                    src={previewBlobUrl || schoolInfo.brochureUrl}
                    alt="Brosur Resmi SPMB SMP Al-Hadiid"
                    style={{ transform: `scale(${zoomScale})`, transformOrigin: 'center center' }}
                    className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl transition-transform duration-200"
                  />
                </div>
              ) : (
                /* PDF Viewer Body */
                <object
                  data={previewBlobUrl || undefined}
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
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
