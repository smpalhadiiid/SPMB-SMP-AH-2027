// =====================================================================
// src/utils/pdf/pdfHelpers.ts
// Kumpulan Fungsi Pembantu & Format Resmi Dokumen PDF SPMB
// =====================================================================

import { jsPDF } from 'jspdf';
import { PDF_THEME } from './pdfTheme';

/**
 * Format tanggal Indonesia lengkap (Contoh: "29 September 2026")
 */
export function formatDateIndonesian(dateString?: string): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateString;
  }
}

/**
 * Format mata uang Rupiah standar (Contoh: "Rp 250.000")
 */
export function formatRupiah(amount?: number | string): string {
  if (amount === undefined || amount === null || amount === '') return 'Rp 0';
  const num = typeof amount === 'number' ? amount : Number(amount) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Gambar watermark sangat halus di tengah halaman (hanya jika diperlukan)
 */
export function drawWatermark(doc: jsPDF, text = 'SMPS AL-HADIID CILEUNGSI') {
  try {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    doc.saveGraphicsState();
    doc.setTextColor(230, 235, 240); // Sangat tipis mendekati background
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    // Putar 35 derajat di tengah halaman
    doc.text(text, pageW / 2, pageH / 2, {
      align: 'center',
      angle: 35,
    });
    doc.restoreGraphicsState();
  } catch {
    // Ignore jika canvas error
  }
}

/**
 * Badge status visual pembayaran atau seleksi (TERVERIFIKASI, MENUNGGU VERIFIKASI, DITOLAK)
 */
export function drawStatusBadge(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  status: 'verified' | 'pending' | 'rejected' | string,
  customLabel?: string
) {
  const normStatus = (status || '').toLowerCase();
  let bgColor: [number, number, number] = PDF_THEME.colors.pendingBg;
  let borderColor: [number, number, number] = PDF_THEME.colors.pending;
  let textColor: [number, number, number] = PDF_THEME.colors.pending;
  let label = customLabel || 'MENUNGGU VERIFIKASI';

  if (normStatus === 'verified' || normStatus === 'lunas' || normStatus === 'passed') {
    bgColor = PDF_THEME.colors.verifiedBg;
    borderColor = PDF_THEME.colors.verified;
    textColor = PDF_THEME.colors.verified;
    label = customLabel || 'TERVERIFIKASI ✓';
  } else if (normStatus === 'rejected' || normStatus === 'ditolak' || normStatus === 'failed') {
    bgColor = PDF_THEME.colors.rejectedBg;
    borderColor = PDF_THEME.colors.rejected;
    textColor = PDF_THEME.colors.rejected;
    label = customLabel || 'DITOLAK ✗';
  }

  doc.saveGraphicsState();
  doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, height, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text(label, x + width / 2, y + height / 2 + 1.2, { align: 'center' });
  doc.restoreGraphicsState();
}

/**
 * Renders QR Code verifikasi dokumen (simulasi modul matriks presisi)
 */
export function drawVerificationQr(
  doc: jsPDF,
  x: number,
  y: number,
  size: number,
  payloadText: string
) {
  doc.saveGraphicsState();
  // Frame latar putih dengan border tipis
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.rect(x, y, size, size, 'FD');

  // Pola sudut penanda QR (Finder patterns)
  const drawCorner = (cx: number, cy: number, cSize: number) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(cx, cy, cSize, cSize, 'F');
    doc.setFillColor(255, 255, 255);
    doc.rect(cx + 0.8, cy + 0.8, cSize - 1.6, cSize - 1.6, 'F');
    doc.setFillColor(15, 23, 42);
    doc.rect(cx + 1.6, cy + 1.6, cSize - 3.2, cSize - 3.2, 'F');
  };

  const cornerSize = Math.max(3.5, size * 0.28);
  drawCorner(x + 1, y + 1, cornerSize);
  drawCorner(x + size - cornerSize - 1, y + 1, cornerSize);
  drawCorner(x + 1, y + size - cornerSize - 1, cornerSize);

  // Micro dots pattern di tengah
  doc.setFillColor(30, 41, 59);
  const step = 1.2;
  for (let px = x + cornerSize + 1.5; px < x + size - 2; px += step) {
    for (let py = y + cornerSize + 1.5; py < y + size - 2; py += step) {
      const hash = (px * 31 + py * 17 + payloadText.length) % 3;
      if (hash === 0) {
        doc.rect(px, py, 0.7, 0.7, 'F');
      }
    }
  }

  // Teks verifikasi di bawah QR
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(100, 116, 139);
  doc.text('VERIFIKASI SISTEM', x + size / 2, y + size + 2.5, { align: 'center' });

  doc.restoreGraphicsState();
}
