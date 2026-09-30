// =====================================================================
// src/utils/pdf/pdfFooter.ts
// Footer & Nomor Halaman Otomatis Dokumen PDF SMPS Al-Hadiid Cileungsi
// =====================================================================

import { jsPDF } from 'jspdf';
import { SchoolInfo } from '../../types';
import { PDF_THEME } from './pdfTheme';
import { formatDateIndonesian } from './pdfHelpers';

export interface FooterOptions {
  schoolInfo?: SchoolInfo;
  orientation?: 'portrait' | 'landscape';
  customNotice?: string;
  totalPageOverride?: number;
}

/**
 * Terapkan footer resmi Al-Hadiid ke SELURUH halaman dokumen yang ada
 * Memastikan nomor halaman "Halaman X dari Y" selalu akurat & konsisten
 */
export function applyOfficialFooters(
  doc: jsPDF,
  options: FooterOptions = {}
): void {
  const pageCount = doc.getNumberOfPages();
  const orientation = options.orientation || 'portrait';
  const layout = orientation === 'landscape' ? PDF_THEME.layout.landscape : PDF_THEME.layout.portrait;
  const info = options.schoolInfo || ({} as SchoolInfo);

  const startX = layout.marginLeft;
  const contentWidth = layout.contentWidth;
  const endX = startX + contentWidth;
  const pageHeight = layout.height;
  const footerY = pageHeight - layout.marginBottom;

  const todayStr = formatDateIndonesian(new Date().toISOString());
  const academicYear = info.academicYear || '2027/2028';
  const schoolName = info.name || 'SMPS Al-Hadiid Cileungsi';

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Garis Pemisah Footer
    doc.saveGraphicsState();
    doc.setDrawColor(PDF_THEME.colors.borderLight[0], PDF_THEME.colors.borderLight[1], PDF_THEME.colors.borderLight[2]);
    doc.setLineWidth(0.3);
    doc.line(startX, footerY - 4, endX, footerY - 4);

    // Kolom Kiri: Identitas Sekolah & Tahun Ajaran
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(PDF_THEME.colors.primaryDark[0], PDF_THEME.colors.primaryDark[1], PDF_THEME.colors.primaryDark[2]);
    doc.text(`${schoolName} • SPMB T.P. ${academicYear}`, startX, footerY);

    // Keterangan Validasi Sistem di bawah identitas
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(PDF_THEME.colors.textLight[0], PDF_THEME.colors.textLight[1], PDF_THEME.colors.textLight[2]);
    doc.text('Dokumen resmi sah dikeluarkan secara otomatis melalui Sistem SPMB Online.', startX, footerY + 3.2);

    // Kolom Kanan: Nomor Halaman & Waktu Cetak
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(PDF_THEME.colors.textMuted[0], PDF_THEME.colors.textMuted[1], PDF_THEME.colors.textMuted[2]);
    const pageText = `Halaman ${i} dari ${pageCount}`;
    doc.text(pageText, endX, footerY, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(PDF_THEME.colors.textLight[0], PDF_THEME.colors.textLight[1], PDF_THEME.colors.textLight[2]);
    doc.text(`Dicetak: ${todayStr}`, endX, footerY + 3.2, { align: 'right' });

    doc.restoreGraphicsState();
  }
}
