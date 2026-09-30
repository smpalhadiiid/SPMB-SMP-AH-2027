// =====================================================================
// src/utils/pdf/pdfHeader.ts
// Header & Kop Surat Resmi SMPS Al-Hadiid Cileungsi untuk Dokumen PDF
// =====================================================================

import { jsPDF } from 'jspdf';
import { SchoolInfo } from '../../types';
import { drawSchoolLogo } from './pdfLogo';
import { PDF_THEME } from './pdfTheme';

export interface HeaderOptions {
  schoolInfo?: SchoolInfo;
  documentTitle?: string;
  documentSubtitle?: string;
  documentNumber?: string;
  orientation?: 'portrait' | 'landscape';
  compact?: boolean; // Untuk halaman selanjutnya atau landscape
  showKopLines?: boolean;
}

/**
 * Gambar Kop Surat Resmi SMPS AL-HADIID CILEUNGSI
 * @returns Posisi Y (dalam mm) di bawah kop surat yang siap digunakan untuk konten
 */
export function drawOfficialHeader(
  doc: jsPDF,
  options: HeaderOptions = {}
): number {
  const {
    schoolInfo,
    documentTitle,
    documentSubtitle,
    documentNumber,
    orientation = 'portrait',
    compact = false,
    showKopLines = true,
  } = options;

  const layout = orientation === 'landscape' ? PDF_THEME.layout.landscape : PDF_THEME.layout.portrait;
  const info = schoolInfo || ({} as SchoolInfo);

  const startX = layout.marginLeft;
  const contentWidth = layout.contentWidth;
  const endX = startX + contentWidth;
  const centerX = layout.centerX;

  let currentY = layout.marginTop;

  // 1. Gambar Logo Resmi Sekolah di sisi kiri atas
  const logoSize = compact ? 18 : 22;
  const logoX = startX + 2;
  const logoY = currentY + 0.5;

  drawSchoolLogo(doc, logoX, logoY, logoSize, logoSize, schoolInfo);

  // 2. Teks Kop Surat Resmi Sekolah (Center Aligned terhadap area kop)
  // Menjaga margin dari logo agar teks seimbang
  const textCenterX = centerX + (orientation === 'portrait' ? 8 : 4);

  // Baris 1: Yayasan / Lembaga Penyelenggara
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(PDF_THEME.colors.textMuted[0], PDF_THEME.colors.textMuted[1], PDF_THEME.colors.textMuted[2]);
  doc.text('PANITIA SISTEM PENERIMAAN MURID BARU (SPMB)', textCenterX, currentY + 4, { align: 'center' });

  // Baris 2: Nama Resmi Sekolah (Besar, Bold, Tegas)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(PDF_THEME.colors.primaryDark[0], PDF_THEME.colors.primaryDark[1], PDF_THEME.colors.primaryDark[2]);
  const schoolName = (info.name || 'SMPS AL-HADIID CILEUNGSI').toUpperCase();
  doc.text(schoolName, textCenterX, currentY + 9.5, { align: 'center' });

  // Baris 3: Legalitas & Akreditasi
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(PDF_THEME.colors.accent[0], PDF_THEME.colors.accent[1], PDF_THEME.colors.accent[2]);
  const npsn = info.npsn || '20254651';
  const accreditation = info.accreditation || 'A (Sangat Baik / Unggulan)';
  doc.text(`NPSN: ${npsn} • TERAKREDITASI "${accreditation}"`, textCenterX, currentY + 13.5, { align: 'center' });

  // Baris 4: Alamat Lengkap
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(PDF_THEME.colors.textBody[0], PDF_THEME.colors.textBody[1], PDF_THEME.colors.textBody[2]);
  const address = info.address || 'Jl. Melati 1 Perumahan Cileungsi Indah, Cileungsi, Kab. Bogor 16820';
  doc.text(`Alamat: ${address}`, textCenterX, currentY + 17, { align: 'center' });

  // Baris 5: Kontak & Kanal Resmi
  const phone = info.phone || '021-82493659';
  const wa = info.whatsapp ? `0${info.whatsapp.replace(/^62/, '')}` : '0858-1499-8782';
  const email = info.email || 'smpalhadiid@gmail.com';
  const website = info.website || 'https://alhadiid.or.id/smp-alhadiid/';
  doc.text(`Telp: ${phone} | WhatsApp: ${wa} | Email: ${email}`, textCenterX, currentY + 20.5, { align: 'center' });
  doc.text(`Website: ${website}`, textCenterX, currentY + 24, { align: 'center' });

  // 3. Garis Ganda Pemisah Kop Surat (Double Lines Resmi Standar Kementerian/Sekolah)
  if (showKopLines) {
    const lineY = currentY + (compact ? 24.5 : 26.5);
    // Garis Atas Tebal
    doc.setLineWidth(0.8);
    doc.setDrawColor(PDF_THEME.colors.primaryDark[0], PDF_THEME.colors.primaryDark[1], PDF_THEME.colors.primaryDark[2]);
    doc.line(startX, lineY, endX, lineY);

    // Garis Bawah Tipis
    doc.setLineWidth(0.25);
    doc.setDrawColor(PDF_THEME.colors.accent[0], PDF_THEME.colors.accent[1], PDF_THEME.colors.accent[2]);
    doc.line(startX, lineY + 0.9, endX, lineY + 0.9);

    currentY = lineY + 3.5;
  } else {
    currentY += 26.5;
  }

  // 4. Judul Dokumen (Jika disediakan)
  if (documentTitle) {
    currentY += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(PDF_THEME.colors.textDark[0], PDF_THEME.colors.textDark[1], PDF_THEME.colors.textDark[2]);
    doc.text(documentTitle.toUpperCase(), centerX, currentY, { align: 'center' });

    if (documentSubtitle) {
      currentY += 4.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(PDF_THEME.colors.textMuted[0], PDF_THEME.colors.textMuted[1], PDF_THEME.colors.textMuted[2]);
      doc.text(documentSubtitle.toUpperCase(), centerX, currentY, { align: 'center' });
    }

    if (documentNumber) {
      currentY += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(PDF_THEME.colors.textLight[0], PDF_THEME.colors.textLight[1], PDF_THEME.colors.textLight[2]);
      doc.text(documentNumber, centerX, currentY, { align: 'center' });
    }

    currentY += 3;
  }

  return currentY;
}
