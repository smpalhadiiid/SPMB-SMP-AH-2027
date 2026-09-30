// =====================================================================
// src/utils/pdf/pdfStyles.ts
// Komponen & Helper Tampilan Dokumen PDF SPMB Al-Hadiid
// =====================================================================

import { jsPDF } from 'jspdf';
import { PDF_THEME } from './pdfTheme';

/**
 * Gambar Kotak Seksi / Section Title (Contoh: "A. DATA CALON PESERTA DIDIK")
 */
export function drawSectionTitle(
  doc: jsPDF,
  title: string,
  y: number,
  x = 15,
  width = 180
): number {
  doc.saveGraphicsState();
  doc.setFillColor(PDF_THEME.colors.primaryLight[0], PDF_THEME.colors.primaryLight[1], PDF_THEME.colors.primaryLight[2]);
  doc.setDrawColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
  doc.setLineWidth(0.4);
  doc.rect(x, y, width, 5.5, 'FD');

  // Strip penanda aksen vertikal di paling kiri
  doc.setFillColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
  doc.rect(x, y, 2.5, 5.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(PDF_THEME.colors.primaryDark[0], PDF_THEME.colors.primaryDark[1], PDF_THEME.colors.primaryDark[2]);
  doc.text(title.toUpperCase(), x + 5, y + 3.8);

  doc.restoreGraphicsState();
  return y + 6.5;
}

/**
 * Gambar baris tabel key-value (Label dan Value)
 */
export function drawKeyValueRow(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  labelWidth: number,
  valueWidth: number,
  rowHeight = 5,
  isZebra = false
): number {
  doc.saveGraphicsState();
  if (isZebra) {
    doc.setFillColor(PDF_THEME.colors.bgZebra[0], PDF_THEME.colors.bgZebra[1], PDF_THEME.colors.bgZebra[2]);
    doc.rect(x, y, labelWidth + valueWidth, rowHeight, 'F');
  }

  // Border tipis
  doc.setDrawColor(PDF_THEME.colors.borderLight[0], PDF_THEME.colors.borderLight[1], PDF_THEME.colors.borderLight[2]);
  doc.setLineWidth(0.2);
  doc.rect(x, y, labelWidth, rowHeight);
  doc.rect(x + labelWidth, y, valueWidth, rowHeight);

  // Label (Kiri, Bold)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(PDF_THEME.colors.textBody[0], PDF_THEME.colors.textBody[1], PDF_THEME.colors.textBody[2]);
  doc.text(label, x + 2, y + rowHeight / 2 + 1.2);

  // Value (Kanan, Normal)
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(PDF_THEME.colors.textDark[0], PDF_THEME.colors.textDark[1], PDF_THEME.colors.textDark[2]);
  // Truncate jika kepanjangan
  const safeVal = value || '-';
  const splitText = doc.splitTextToSize(safeVal, valueWidth - 4);
  doc.text(splitText[0] || '-', x + labelWidth + 2.5, y + rowHeight / 2 + 1.2);

  doc.restoreGraphicsState();
  return y + rowHeight;
}

/**
 * Gambar Blok Tanda Tangan Resmi
 */
export function drawOfficialSignature(
  doc: jsPDF,
  options: {
    x: number;
    y: number;
    title: string;
    subtitle?: string;
    personName: string;
    extraNote?: string;
    signatureWidth?: number;
    isRightAligned?: boolean;
    dateCity?: string;
  }
) {
  const {
    x,
    y,
    title,
    subtitle,
    personName,
    extraNote,
    signatureWidth = 55,
    isRightAligned = false,
    dateCity,
  } = options;

  doc.saveGraphicsState();
  const centerX = isRightAligned ? x + signatureWidth / 2 : x;
  let curY = y;

  if (dateCity) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(PDF_THEME.colors.textBody[0], PDF_THEME.colors.textBody[1], PDF_THEME.colors.textBody[2]);
    doc.text(dateCity, centerX, curY, { align: isRightAligned ? 'center' : 'left' });
    curY += 4;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(PDF_THEME.colors.textBody[0], PDF_THEME.colors.textBody[1], PDF_THEME.colors.textBody[2]);
  doc.text(title, centerX, curY, { align: isRightAligned ? 'center' : 'left' });

  if (subtitle) {
    curY += 4;
    doc.text(subtitle, centerX, curY, { align: isRightAligned ? 'center' : 'left' });
  }

  // Ruang Tanda Tangan
  curY += 18;

  // Nama Pejabat / Murid
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(PDF_THEME.colors.textDark[0], PDF_THEME.colors.textDark[1], PDF_THEME.colors.textDark[2]);
  const formattedName = personName.startsWith('(') ? personName : `( ${personName.toUpperCase()} )`;
  doc.text(formattedName, centerX, curY, { align: isRightAligned ? 'center' : 'left' });

  if (extraNote) {
    curY += 3.8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(PDF_THEME.colors.textLight[0], PDF_THEME.colors.textLight[1], PDF_THEME.colors.textLight[2]);
    doc.text(extraNote, centerX, curY, { align: isRightAligned ? 'center' : 'left' });
  }

  doc.restoreGraphicsState();
}
