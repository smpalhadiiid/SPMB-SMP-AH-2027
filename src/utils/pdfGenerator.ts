// =====================================================================
// src/utils/pdfGenerator.ts
// Pusat Generator Dokumen PDF SPMB SMPS Al-Hadiid Cileungsi
// Menggunakan Sistem Template & Identitas Visual Terpusat
// =====================================================================

import { jsPDF } from 'jspdf';
import { StudentData, SchoolInfo, TestSchedule } from '../types';
import { getKepalaSekolahName, getStoredSchoolInfo } from './storage';
import { getStudentCredentials } from './studentCredentials';
import { formatTerbilangRupiah, getReceiptVerificationUrl } from './receiptNumber';
import {
  PDF_THEME,
  drawOfficialHeader,
  applyOfficialFooters,
  formatDateIndonesian,
  formatRupiah,
  drawSectionTitle,
  drawKeyValueRow,
  drawOfficialSignature,
  drawStatusBadge,
  drawVerificationQr,
} from './pdf';

// =====================================================================
// HELPER: PREDIKAT NILAI
// =====================================================================
function getScorePredicate(score: number): string {
  if (score >= 88) return 'Sangat Baik (A)';
  if (score >= 75) return 'Baik (B)';
  if (score >= 60) return 'Cukup (C)';
  return 'Perlu Remedial (D)';
}

/**
 * Konversi angka rupiah ke teks terbilang bahasa Indonesia sederhana
 */
function angkaTerbilang(nilai: number): string {
  const bilangan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  const n = Math.floor(Math.abs(nilai));
  if (n < 12) return bilangan[n];
  if (n < 20) return `${angkaTerbilang(n - 10)} Belas`;
  if (n < 100) return `${angkaTerbilang(Math.floor(n / 10))} Puluh ${angkaTerbilang(n % 10)}`.trim();
  if (n < 200) return `Seratus ${angkaTerbilang(n - 100)}`.trim();
  if (n < 1000) return `${angkaTerbilang(Math.floor(n / 100))} Ratus ${angkaTerbilang(n % 100)}`.trim();
  if (n < 2000) return `Seribu ${angkaTerbilang(n - 1000)}`.trim();
  if (n < 1000000) return `${angkaTerbilang(Math.floor(n / 1000))} Ribu ${angkaTerbilang(n % 1000)}`.trim();
  if (n < 1000000000) return `${angkaTerbilang(Math.floor(n / 1000000))} Juta ${angkaTerbilang(n % 1000000)}`.trim();
  return `${n}`;
}

// =====================================================================
// 1. DOKUMEN: BUKTI & FORMULIR PENDAFTARAN RESMI (3 HALAMAN)
// =====================================================================
export function generateRegistrationPDF(student: StudentData, schoolInfo: SchoolInfo) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const todayStr = formatDateIndonesian(new Date().toISOString());
  const academicYear = schoolInfo?.academicYear || '2027/2028';
  const studentDisplayName = (student.fullName || 'Calon Murid').toUpperCase();
  const parentDisplayName = (student.fatherName || student.motherName || 'Orang Tua / Wali').toUpperCase();

  // -------------------------------------------------------------------
  // HALAMAN 1: FORMULIR PENDAFTARAN & BIODATA SISWA
  // -------------------------------------------------------------------
  let curY = drawOfficialHeader(doc, {
    schoolInfo,
    documentTitle: 'FORMULIR PENERIMAAN MURID BARU',
    documentSubtitle: `TAHUN PELAJARAN ${academicYear}`,
    documentNumber: `No. Registrasi: ${student.registrationNumber || '-'}`,
    orientation: 'portrait',
  });

  // Section A: DATA CALON PESERTA DIDIK
  curY = drawSectionTitle(doc, 'A. DATA CALON PESERTA DIDIK', curY, 15, 180);

  const studentTableData: [string, string, string, string][] = [
    ['Nomor Induk Siswa Nasional (NISN)', student.nisn || '-', 'Nomor Pendaftaran', student.registrationNumber || '-'],
    ['Nama Lengkap (sesuai Ijazah)', studentDisplayName, '', ''],
    ['Jenis Kelamin', (student.gender || 'LAKI-LAKI').toUpperCase(), '', ''],
    ['Tempat, Tanggal Lahir', `${(student.birthPlace || '-').toUpperCase()}, ${formatDateIndonesian(student.birthDate)}`, '', ''],
    ['Agama', (student.religion || 'ISLAM').toUpperCase(), '', ''],
    ['Anak ke', `${student.childOrder || '1'} dari ${student.totalSiblings || '....'} bersaudara`, '', ''],
    ['Sekolah Asal (SD/MI)', (student.previousSchoolName || '-').toUpperCase(), '', ''],
    ['Alamat Tempat Tinggal', (student.address || '-').toUpperCase(), '', ''],
    ['Desa / Kelurahan', (student.village || student.subdistrict || '-').toUpperCase(), '', ''],
    ['Kecamatan', (student.subdistrict || '-').toUpperCase(), 'Kabupaten/Kota', (student.city || 'BOGOR').toUpperCase()],
    ['Email Aktif Calon Siswa', student.userEmail || '-', '', ''],
    ['Nomor WhatsApp / HP', student.phone || '-', '', ''],
  ];

  const rowH = 5.2;
  const photoW = 42;
  const photoH = rowH * 6; // Rows 2 to 7

  // Box Pas Foto di sisi kanan
  doc.saveGraphicsState();
  doc.setDrawColor(PDF_THEME.colors.borderLight[0], PDF_THEME.colors.borderLight[1], PDF_THEME.colors.borderLight[2]);
  doc.setFillColor(250, 250, 252);
  doc.roundedRect(153, curY + rowH, photoW, photoH, 1, 1, 'FD');

  let photoPlaced = false;
  if (student.photoUrl && (student.photoUrl.startsWith('data:image') || student.photoUrl.startsWith('http'))) {
    try {
      const isJpeg = student.photoUrl.includes('image/jpeg') || student.photoUrl.includes('image/jpg');
      doc.addImage(student.photoUrl, isJpeg ? 'JPEG' : 'PNG', 154, curY + rowH + 1, photoW - 2, photoH - 2);
      photoPlaced = true;
    } catch {}
  }

  if (!photoPlaced) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(PDF_THEME.colors.textLight[0], PDF_THEME.colors.textLight[1], PDF_THEME.colors.textLight[2]);
    doc.text('PAS FOTO', 153 + photoW / 2, curY + rowH + photoH / 2 - 1, { align: 'center' });
    doc.setFontSize(7);
    doc.text('3 x 4 cm', 153 + photoW / 2, curY + rowH + photoH / 2 + 3.5, { align: 'center' });
  }
  doc.restoreGraphicsState();

  // Render Baris Data Siswa
  studentTableData.forEach((row, idx) => {
    doc.saveGraphicsState();
    doc.setDrawColor(PDF_THEME.colors.borderLight[0], PDF_THEME.colors.borderLight[1], PDF_THEME.colors.borderLight[2]);
    doc.setLineWidth(0.2);

    if (idx === 0) {
      // Row 1: NISN + No Pendaftaran Full Width
      doc.rect(15, curY, 45, rowH);
      doc.rect(60, curY, 65, rowH);
      doc.rect(125, curY, 30, rowH);
      doc.rect(155, curY, 40, rowH);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(PDF_THEME.colors.textBody[0], PDF_THEME.colors.textBody[1], PDF_THEME.colors.textBody[2]);
      doc.text(row[0], 16.5, curY + 3.6);
      doc.text(row[1], 61.5, curY + 3.6);
      doc.text(row[2], 126.5, curY + 3.6);
      doc.setTextColor(PDF_THEME.colors.primaryDark[0], PDF_THEME.colors.primaryDark[1], PDF_THEME.colors.primaryDark[2]);
      doc.text(row[3], 156.5, curY + 3.6);
    } else if (idx >= 1 && idx <= 6) {
      // Row 2-7: Berdampingan dengan Box Foto di sisi kanan
      doc.rect(15, curY, 50, rowH);
      doc.rect(65, curY, 87, rowH);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(PDF_THEME.colors.textBody[0], PDF_THEME.colors.textBody[1], PDF_THEME.colors.textBody[2]);
      doc.text(row[0], 16.5, curY + 3.6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(PDF_THEME.colors.textDark[0], PDF_THEME.colors.textDark[1], PDF_THEME.colors.textDark[2]);
      doc.text(row[1].substring(0, 52), 66.5, curY + 3.6);
    } else if (idx === 9) {
      // Row 10: Kecamatan & Kab/Kota
      doc.rect(15, curY, 50, rowH);
      doc.rect(65, curY, 45, rowH);
      doc.rect(110, curY, 35, rowH);
      doc.rect(145, curY, 50, rowH);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(PDF_THEME.colors.textBody[0], PDF_THEME.colors.textBody[1], PDF_THEME.colors.textBody[2]);
      doc.text(row[0], 16.5, curY + 3.6);
      doc.setFont('helvetica', 'normal');
      doc.text(row[1], 66.5, curY + 3.6);
      doc.setFont('helvetica', 'bold');
      doc.text(row[2], 111.5, curY + 3.6);
      doc.setFont('helvetica', 'normal');
      doc.text(row[3], 146.5, curY + 3.6);
    } else {
      // Standard rows (8, 10, 11)
      doc.rect(15, curY, 50, rowH);
      doc.rect(65, curY, 130, rowH);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(PDF_THEME.colors.textBody[0], PDF_THEME.colors.textBody[1], PDF_THEME.colors.textBody[2]);
      doc.text(row[0], 16.5, curY + 3.6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(PDF_THEME.colors.textDark[0], PDF_THEME.colors.textDark[1], PDF_THEME.colors.textDark[2]);
      doc.text(row[1].substring(0, 78), 66.5, curY + 3.6);
    }

    doc.restoreGraphicsState();
    curY += rowH;
  });

  // Section B: DATA ORANG TUA / WALI
  curY += 2;
  curY = drawSectionTitle(doc, 'B. DATA ORANG TUA / WALI', curY, 15, 180);

  const parentTableData: [string, string][] = [
    ['Nama Lengkap Ayah', (student.fatherName || '-').toUpperCase()],
    ['Pekerjaan & Pendidikan Ayah', `${(student.fatherJob || 'Wiraswasta / Karyawan').toUpperCase()}`],
    ['Nama Lengkap Ibu', (student.motherName || '-').toUpperCase()],
    ['Pekerjaan & Pendidikan Ibu', `${(student.motherJob || 'Ibu Rumah Tangga').toUpperCase()}`],
    ['Nomor Kontak / WhatsApp Wali', student.fatherPhone || student.motherPhone || student.phone || '-'],
  ];

  parentTableData.forEach(([label, value]) => {
    curY = drawKeyValueRow(doc, label, value, 15, curY, 50, 130, rowH);
  });

  // Tanda Tangan Halaman 1
  curY += 6;
  drawOfficialSignature(doc, {
    x: 25,
    y: curY,
    title: 'Mengetahui,',
    subtitle: 'Orang Tua / Wali Siswa,',
    personName: parentDisplayName,
    signatureWidth: 60,
  });

  drawOfficialSignature(doc, {
    x: 130,
    y: curY,
    title: `Cileungsi, ${todayStr}`,
    subtitle: 'Calon Murid Baru,',
    personName: studentDisplayName,
    signatureWidth: 60,
  });

  // QR Code Verifikasi di pojok tengah bawah
  drawVerificationQr(doc, 94, curY + 2, 22, `SPMB-REG-${student.registrationNumber || '0001'}`);

  // -------------------------------------------------------------------
  // HALAMAN 2: SURAT PERJANJIAN SISWA
  // -------------------------------------------------------------------
  doc.addPage();
  curY = drawOfficialHeader(doc, {
    schoolInfo,
    documentTitle: 'SURAT PERJANJIAN & TATA TERTIB SISWA',
    documentSubtitle: `TAHUN PELAJARAN ${academicYear}`,
    orientation: 'portrait',
  });

  curY += 2;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(PDF_THEME.colors.primaryDark[0], PDF_THEME.colors.primaryDark[1], PDF_THEME.colors.primaryDark[2]);
  doc.text('Bismillaahirrahmaanirrahiim,', 15, curY);

  curY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(PDF_THEME.colors.textBody[0], PDF_THEME.colors.textBody[1], PDF_THEME.colors.textBody[2]);
  doc.text('Saya yang bertanda tangan di bawah ini calon murid baru SMPS Al-Hadiid Cileungsi:', 15, curY);

  curY += 5;
  const agreementFields: [string, string][] = [
    ['Nama Lengkap', `: ${studentDisplayName}`],
    ['Nomor Registrasi', `: ${student.registrationNumber || '-'}`],
    ['Sekolah Asal', `: ${(student.previousSchoolName || '-').toUpperCase()}`],
    ['NISN', `: ${student.nisn || '-'}`],
    ['Nama Orang Tua / Wali', `: ${parentDisplayName}`],
    ['Alamat Lengkap', `: ${(student.address || '-').toUpperCase()}, ${(student.subdistrict || '').toUpperCase()}, ${(student.city || 'BOGOR').toUpperCase()}`],
    ['Nomor WhatsApp', `: ${student.phone || '-'}`],
  ];

  agreementFields.forEach(([lbl, val]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(PDF_THEME.colors.textBody[0], PDF_THEME.colors.textBody[1], PDF_THEME.colors.textBody[2]);
    doc.text(lbl, 20, curY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(PDF_THEME.colors.textDark[0], PDF_THEME.colors.textDark[1], PDF_THEME.colors.textDark[2]);
    doc.text(val, 65, curY);
    curY += 4.5;
  });

  curY += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(PDF_THEME.colors.primaryDark[0], PDF_THEME.colors.primaryDark[1], PDF_THEME.colors.primaryDark[2]);
  doc.text('D E N G A N   I N I   B E R J A N J I :', 105, curY, { align: 'center' });

  curY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(PDF_THEME.colors.textBody[0], PDF_THEME.colors.textBody[1], PDF_THEME.colors.textBody[2]);

  const promises = [
    '1. Bertekad sungguh-sungguh untuk mentaati seluruh tata tertib dan peraturan yang berlaku di SMPS Al-Hadiid Cileungsi.',
    '2. Melaksanakan ibadah sholat 5 waktu secara istiqomah serta menjunjung tinggi akhlakul karimah sesuai Al-Qur\'an dan Sunnah.',
    '3. Belajar dengan tekun, disiplin, berprestasi, serta menjaga adab terhadap guru, orang tua, dan sesama teman.',
    '4. Tidak melakukan hal-hal yang dapat merusak nama baik sekolah, diri sendiri, keluarga, maupun agama Islam.',
  ];

  promises.forEach(p => {
    doc.text(p, 20, curY);
    curY += 5;
  });

  curY += 3;
  const pSanksi = 'Apabila di kemudian hari saya terbukti melanggar perjanjian ini, maka saya bersedia menerima sanksi yang ditetapkan sekolah hingga dikeluarkan/dikembalikan kepada orang tua/wali siswa.';
  const splitSanksi = doc.splitTextToSize(pSanksi, 175);
  doc.text(splitSanksi, 15, curY);
  curY += splitSanksi.length * 4.5 + 2;

  const pPenutup = 'Demikian surat perjanjian ini saya tandatangani dengan penuh kesadaran, keikhlasan, dan tanpa paksaan dari pihak manapun.';
  doc.text(pPenutup, 15, curY);

  curY += 12;
  drawOfficialSignature(doc, {
    x: 25,
    y: curY,
    title: 'Mengetahui / Menyetujui,',
    subtitle: 'Orang Tua / Wali Siswa,',
    personName: parentDisplayName,
    signatureWidth: 60,
  });

  drawOfficialSignature(doc, {
    x: 130,
    y: curY,
    title: `Cileungsi, ${todayStr}`,
    subtitle: 'Yang Berjanji (Calon Murid),',
    personName: studentDisplayName,
    signatureWidth: 60,
  });

  // Kotak Materai 10.000 di tengah
  doc.saveGraphicsState();
  doc.setDrawColor(PDF_THEME.colors.borderLight[0], PDF_THEME.colors.borderLight[1], PDF_THEME.colors.borderLight[2]);
  doc.setFillColor(252, 252, 254);
  doc.rect(88, curY + 6, 28, 16, 'FD');
  doc.setFontSize(7);
  doc.setTextColor(PDF_THEME.colors.textLight[0], PDF_THEME.colors.textLight[1], PDF_THEME.colors.textLight[2]);
  doc.text('Materai', 102, curY + 13, { align: 'center' });
  doc.text('Rp 10.000,-', 102, curY + 17, { align: 'center' });
  doc.restoreGraphicsState();

  // -------------------------------------------------------------------
  // HALAMAN 3: TANDA TERIMA KELENGKAPAN BERKAS & ADMINISTRASI
  // -------------------------------------------------------------------
  doc.addPage();
  curY = drawOfficialHeader(doc, {
    schoolInfo,
    documentTitle: 'TANDA TERIMA KELENGKAPAN DOKUMEN & ADMINISTRASI',
    documentSubtitle: `TAHUN PELAJARAN ${academicYear}`,
    orientation: 'portrait',
  });

  curY += 2;
  // Box Identitas Cepat Siswa
  doc.saveGraphicsState();
  doc.setFillColor(PDF_THEME.colors.bgLight[0], PDF_THEME.colors.bgLight[1], PDF_THEME.colors.bgLight[2]);
  doc.setDrawColor(PDF_THEME.colors.borderLight[0], PDF_THEME.colors.borderLight[1], PDF_THEME.colors.borderLight[2]);
  doc.roundedRect(15, curY, 180, 14, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(PDF_THEME.colors.textBody[0], PDF_THEME.colors.textBody[1], PDF_THEME.colors.textBody[2]);
  doc.text('Nama Calon Murid :', 19, curY + 5.5);
  doc.text('No. Pendaftaran :', 115, curY + 5.5);
  doc.text('Sekolah Asal :', 19, curY + 10.5);
  doc.text('Jalur Pendaftaran :', 115, curY + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(PDF_THEME.colors.textDark[0], PDF_THEME.colors.textDark[1], PDF_THEME.colors.textDark[2]);
  doc.text(studentDisplayName.substring(0, 38), 50, curY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PDF_THEME.colors.primaryDark[0], PDF_THEME.colors.primaryDark[1], PDF_THEME.colors.primaryDark[2]);
  doc.text(student.registrationNumber || '-', 145, curY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(PDF_THEME.colors.textDark[0], PDF_THEME.colors.textDark[1], PDF_THEME.colors.textDark[2]);
  doc.text((student.previousSchoolName || '-').toUpperCase().substring(0, 35), 44, curY + 10.5);
  doc.text('Reguler TP 2027/2028', 145, curY + 10.5);
  doc.restoreGraphicsState();

  curY += 18;
  curY = drawSectionTitle(doc, '1. KELENGKAPAN BERKAS FISIK DOKUMEN SISWA', curY, 15, 180);

  const docChecklist = [
    'Pas Photo 3x4 berwarna terbaru (2 lembar)',
    'Fotokopi Akte Kelahiran (2 lembar)',
    'Fotokopi Kartu Keluarga (2 lembar)',
    'Fotokopi KTP Orang Tua / Wali (2 lembar)',
    'Fotokopi Surat Keterangan Lulus (SKL) / Ijazah Terlegalisir (2 lembar)',
    'Fotokopi Kartu NISN resmi (1 lembar)',
    'Formulir Pendaftaran SPMB Online yang telah dicetak & ditandatangani',
    'Surat Perjanjian Siswa bermaterai Rp 10.000,-',
  ];

  // Header Checklist
  doc.saveGraphicsState();
  doc.setFillColor(PDF_THEME.colors.bgZebra[0], PDF_THEME.colors.bgZebra[1], PDF_THEME.colors.bgZebra[2]);
  doc.rect(15, curY, 15, 5, 'FD');
  doc.rect(30, curY, 130, 5, 'FD');
  doc.rect(160, curY, 35, 5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(PDF_THEME.colors.textBody[0], PDF_THEME.colors.textBody[1], PDF_THEME.colors.textBody[2]);
  doc.text('NO.', 22.5, curY + 3.6, { align: 'center' });
  doc.text('NAMA BERKAS / DOKUMEN', 34, curY + 3.6);
  doc.text('STATUS CEK', 177.5, curY + 3.6, { align: 'center' });
  curY += 5;

  doc.setFont('helvetica', 'normal');
  docChecklist.forEach((item, idx) => {
    doc.rect(15, curY, 15, 4.5);
    doc.rect(30, curY, 130, 4.5);
    doc.rect(160, curY, 35, 4.5);

    doc.text(`${idx + 1}.`, 22.5, curY + 3.2, { align: 'center' });
    doc.text(item, 34, curY + 3.2);

    // Checkbox Square
    doc.rect(176, curY + 1, 3, 3);
    curY += 4.5;
  });
  doc.restoreGraphicsState();

  curY += 4;
  curY = drawSectionTitle(doc, '2. KELENGKAPAN ADMINISTRASI KEUANGAN SPMB', curY, 15, 180);

  // Financial Checklist
  doc.saveGraphicsState();
  doc.setFillColor(PDF_THEME.colors.bgZebra[0], PDF_THEME.colors.bgZebra[1], PDF_THEME.colors.bgZebra[2]);
  doc.rect(15, curY, 15, 5, 'FD');
  doc.rect(30, curY, 130, 5, 'FD');
  doc.rect(160, curY, 35, 5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('NO.', 22.5, curY + 3.6, { align: 'center' });
  doc.text('KOMPONEN BIAYA', 34, curY + 3.6);
  doc.text('STATUS SISTEM', 177.5, curY + 3.6, { align: 'center' });
  curY += 5;

  const isFormVerified = student.formPaymentStatus === 'verified' || (student.status as string) === 'verified' || (student.status as string) === 'registered';
  const isBamVerified = student.initialPaymentStatus === 'verified' || student.status === 're_registered' || student.status === 're_registration_paid';

  const finRows = [
    { name: `Biaya Formulir Pendaftaran (${formatRupiah(schoolInfo?.formFee || 200000)})`, verified: isFormVerified },
    { name: 'Biaya Awal Masuk / Daftar Ulang BAM (Paket Lengkap)', verified: isBamVerified },
  ];

  finRows.forEach((r, idx) => {
    doc.rect(15, curY, 15, 5);
    doc.rect(30, curY, 130, 5);
    doc.rect(160, curY, 35, 5);

    doc.setFont('helvetica', 'normal');
    doc.text(`${idx + 1}.`, 22.5, curY + 3.4, { align: 'center' });
    doc.text(r.name, 34, curY + 3.4);

    if (r.verified) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(PDF_THEME.colors.verified[0], PDF_THEME.colors.verified[1], PDF_THEME.colors.verified[2]);
      doc.text('TERVERIFIKASI ✓', 177.5, curY + 3.4, { align: 'center' });
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(PDF_THEME.colors.pending[0], PDF_THEME.colors.pending[1], PDF_THEME.colors.pending[2]);
      doc.text('MENUNGGU / BELUM', 177.5, curY + 3.4, { align: 'center' });
    }
    curY += 5;
  });
  doc.restoreGraphicsState();

  // Tanda Tangan Serah Terima
  curY += 6;
  drawOfficialSignature(doc, {
    x: 25,
    y: curY,
    title: 'Petugas Penerima Berkas,',
    subtitle: 'Panitia SPMB SMPS Al-Hadiid,',
    personName: 'Panitia SPMB',
    signatureWidth: 60,
  });

  drawOfficialSignature(doc, {
    x: 130,
    y: curY,
    title: `Cileungsi, ${todayStr}`,
    subtitle: 'Yang Menyerahkan,',
    personName: parentDisplayName,
    signatureWidth: 60,
  });

  // Terapkan Footer Resmi ke SELURUH 3 Halaman
  applyOfficialFooters(doc, { schoolInfo, orientation: 'portrait' });

  // Simpan Dokumen
  const safeReg = student.registrationNumber || 'NO-REG';
  const safeName = (student.fullName || 'Calon_Murid').replace(/\s+/g, '_');
  doc.save(`Formulir_SPMB_${safeReg}_${safeName}.pdf`);
}

// =====================================================================
// 2. DOKUMEN: LAPORAN RESMI MULTI-HALAMAN (ADMIN & KEPSEK)
// =====================================================================
export function generateReportPDF(
  title: string,
  data: any[],
  columns: string[],
  schoolInfo?: SchoolInfo
) {
  const effectiveSchoolInfo = schoolInfo || (typeof window !== 'undefined' ? getStoredSchoolInfo() : undefined);
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const layout = PDF_THEME.layout.landscape;
  const contentWidth = layout.contentWidth; // 267mm
  const startX = layout.marginLeft; // 15mm
  const colCount = Math.max(1, columns.length);
  const colWidth = contentWidth / colCount;

  // Gambar Header Resmi di Halaman 1
  let curY = drawOfficialHeader(doc, {
    schoolInfo: effectiveSchoolInfo,
    documentTitle: title.toUpperCase(),
    documentSubtitle: `SISTEM INFORMASI SPMB SMPS AL-HADIID CILEUNGSI - TP ${effectiveSchoolInfo?.academicYear || '2027/2028'}`,
    orientation: 'landscape',
    compact: true,
  });

  curY += 2;

  // Fungsi menggambar Header Tabel yang rapi
  const drawTableHeader = (yPos: number) => {
    doc.saveGraphicsState();
    doc.setFillColor(PDF_THEME.colors.primaryDark[0], PDF_THEME.colors.primaryDark[1], PDF_THEME.colors.primaryDark[2]);
    doc.rect(startX, yPos, contentWidth, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    columns.forEach((col, idx) => {
      const cellX = startX + idx * colWidth;
      doc.text(col.toUpperCase(), cellX + 2, yPos + 4.8);
    });
    doc.restoreGraphicsState();
    return yPos + 7;
  };

  curY = drawTableHeader(curY);

  const rowHeight = 6.2;
  const maxPageY = 175; // Batas bawah sebelum halaman baru pada landscape

  data.forEach((row, rowIndex) => {
    // Cek apakah tabel melewati batas halaman
    if (curY + rowHeight > maxPageY) {
      doc.addPage();
      // Gambar header tabel ulang pada halaman baru
      curY = drawTableHeader(layout.marginTop + 4);
    }

    doc.saveGraphicsState();
    // Zebra background
    if (rowIndex % 2 === 1) {
      doc.setFillColor(PDF_THEME.colors.bgZebra[0], PDF_THEME.colors.bgZebra[1], PDF_THEME.colors.bgZebra[2]);
      doc.rect(startX, curY, contentWidth, rowHeight, 'F');
    }

    // Border sel tipis
    doc.setDrawColor(PDF_THEME.colors.borderLight[0], PDF_THEME.colors.borderLight[1], PDF_THEME.colors.borderLight[2]);
    doc.setLineWidth(0.2);
    doc.rect(startX, curY, contentWidth, rowHeight);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(PDF_THEME.colors.textDark[0], PDF_THEME.colors.textDark[1], PDF_THEME.colors.textDark[2]);

    columns.forEach((col, colIdx) => {
      const cellX = startX + colIdx * colWidth;
      const rawVal = row[col];
      let displayVal = '-';
      if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
        displayVal = String(rawVal);
      }

      // Deteksi jika angka / nominal uang
      const isNominal = col.toLowerCase().includes('nominal') || col.toLowerCase().includes('biaya') || col.toLowerCase().includes('bayar');
      if (isNominal && !isNaN(Number(displayVal)) && Number(displayVal) > 1000) {
        displayVal = formatRupiah(Number(displayVal));
      }

      // Potong jika terlalu panjang agar tidak merusak layout
      const truncated = displayVal.length > 32 ? `${displayVal.substring(0, 30)}...` : displayVal;
      doc.text(truncated, cellX + 2, curY + 4.2);
    });

    doc.restoreGraphicsState();
    curY += rowHeight;
  });

  // Tanda Tangan Pengesahan di Akhir Laporan
  if (curY + 35 > maxPageY) {
    doc.addPage();
    curY = layout.marginTop + 10;
  } else {
    curY += 8;
  }

  const todayStr = formatDateIndonesian(new Date().toISOString());
  const kepsekName = getKepalaSekolahName(effectiveSchoolInfo);

  drawOfficialSignature(doc, {
    x: startX + 35,
    y: curY,
    title: 'Mengetahui,',
    subtitle: 'Kepala SMPS Al-Hadiid Cileungsi,',
    personName: kepsekName,
    extraNote: effectiveSchoolInfo?.headmasterNiy ? `NIY. ${effectiveSchoolInfo.headmasterNiy}` : 'Kepala Sekolah',
    signatureWidth: 70,
  });

  drawOfficialSignature(doc, {
    x: startX + contentWidth - 95,
    y: curY,
    title: `Cileungsi, ${todayStr}`,
    subtitle: 'Ketua Panitia SPMB TP 2027/2028,',
    personName: 'Panitia SPMB Al-Hadiid',
    extraNote: 'Stempel Resmi & Terverifikasi Sistem',
    signatureWidth: 70,
  });

  // Terapkan Footer Resmi ke SELURUH Halaman Laporan
  applyOfficialFooters(doc, { schoolInfo: effectiveSchoolInfo, orientation: 'landscape' });

  // Simpan File
  const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Laporan_SPMB_${safeTitle}.pdf`);
}

// =====================================================================
// 3. DOKUMEN: KARTU PESERTA UJIAN & KREDENSIAL CBT
// =====================================================================
export function generateExamCardPDF(
  student: StudentData,
  schoolInfo: SchoolInfo,
  schedule?: TestSchedule,
  authCredentials?: { username?: string; password?: string }
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const todayStr = formatDateIndonesian(new Date().toISOString());
  const academicYear = schoolInfo?.academicYear || '2027/2028';

  let storedPass = '';
  let storedUser = '';
  try {
    if (typeof window !== 'undefined') {
      storedPass = sessionStorage.getItem('spmb_last_student_password') || '';
      storedUser = sessionStorage.getItem('spmb_last_student_username') || '';
    }
  } catch {}

  const storedCred = getStudentCredentials(student.id) || getStudentCredentials(student.registrationNumber) || getStudentCredentials(student.userEmail);
  const embeddedCred = (student.testAnswers as any)?._accountCredentials || (student.testAnswers as any)?._credentials;

  // Resolusi Username Calon Murid:
  // Mengutamakan kredensial asli saat calon murid mendaftar akun pertama kali
  const loginUsername = (
    authCredentials?.username ||
    student.username ||
    student.examUsername ||
    embeddedCred?.username ||
    storedCred?.username ||
    (typeof window !== 'undefined' ? (
      localStorage.getItem(`spmb_user_${student.id}`) ||
      localStorage.getItem(`spmb_user_${student.registrationNumber}`) ||
      localStorage.getItem(`spmb_user_${student.userEmail?.toLowerCase()}`) ||
      ''
    ) : '') ||
    storedUser ||
    (student.userEmail ? student.userEmail.split('@')[0] : '') ||
    student.registrationNumber ||
    'siswa'
  ).trim();

  // Resolusi Password Calon Murid:
  // Mengutamakan password asli saat calon murid mendaftar akun pertama kali
  const loginPassword = (
    authCredentials?.password ||
    student.password ||
    student.examPassword ||
    embeddedCred?.password ||
    storedCred?.password ||
    (typeof window !== 'undefined' ? (
      localStorage.getItem(`spmb_cred_${student.id}`) ||
      localStorage.getItem(`spmb_cred_${student.registrationNumber}`) ||
      localStorage.getItem(`spmb_cred_${student.userEmail?.toLowerCase()}`) ||
      localStorage.getItem(`spmb_cred_${loginUsername.toLowerCase()}`) ||
      ''
    ) : '') ||
    storedPass ||
    'siswa123'
  ).trim();

  // 1. Kop Surat Resmi
  let curY = drawOfficialHeader(doc, {
    schoolInfo,
    documentTitle: 'KARTU TANDA PESERTA UJIAN & DIAGNOSTIK SPMB',
    documentSubtitle: `TAHUN PELAJARAN ${academicYear}`,
    documentNumber: `No. Registrasi: ${student.registrationNumber || '-'}`,
    orientation: 'portrait',
  });

  // Border Bingkai Formal Kartu Peserta
  doc.saveGraphicsState();
  doc.setDrawColor(PDF_THEME.colors.primaryDark[0], PDF_THEME.colors.primaryDark[1], PDF_THEME.colors.primaryDark[2]);
  doc.setLineWidth(0.6);
  doc.roundedRect(15, curY - 2, 180, 228, 2, 2, 'D');

  // Badge Jalur & No Registrasi
  doc.setFillColor(PDF_THEME.colors.bgLight[0], PDF_THEME.colors.bgLight[1], PDF_THEME.colors.bgLight[2]);
  doc.rect(16, curY - 1, 178, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(PDF_THEME.colors.textMuted[0], PDF_THEME.colors.textMuted[1], PDF_THEME.colors.textMuted[2]);
  doc.text('NOMOR PESERTA / REGISTRASI :', 20, curY + 5);

  doc.setFontSize(10.5);
  doc.setTextColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
  doc.text(student.registrationNumber || 'SPMB-20270001', 75, curY + 5.2);

  doc.setFontSize(8);
  doc.setTextColor(PDF_THEME.colors.accent[0], PDF_THEME.colors.accent[1], PDF_THEME.colors.accent[2]);
  doc.text(`JALUR : ${schedule?.waveName || 'Gelombang 1 - Reguler'}`, 140, curY + 5);
  doc.restoreGraphicsState();

  curY += 12;

  // A. IDENTITAS PESERTA
  curY = drawSectionTitle(doc, 'A. IDENTITAS PESERTA UJIAN', curY, 20, 170);

  const photoW = 34;
  const photoH = 42;
  const photoX = 152;
  const photoY = curY;

  // Box Pas Foto
  doc.saveGraphicsState();
  doc.setDrawColor(PDF_THEME.colors.borderLight[0], PDF_THEME.colors.borderLight[1], PDF_THEME.colors.borderLight[2]);
  doc.setFillColor(250, 250, 252);
  doc.roundedRect(photoX, photoY, photoW, photoH, 1, 1, 'FD');

  let photoDone = false;
  if (student.photoUrl && (student.photoUrl.startsWith('data:image') || student.photoUrl.startsWith('http'))) {
    try {
      const isJpeg = student.photoUrl.includes('image/jpeg') || student.photoUrl.includes('image/jpg');
      doc.addImage(student.photoUrl, isJpeg ? 'JPEG' : 'PNG', photoX + 1, photoY + 1, photoW - 2, photoH - 2);
      photoDone = true;
    } catch {}
  }
  if (!photoDone) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(PDF_THEME.colors.textLight[0], PDF_THEME.colors.textLight[1], PDF_THEME.colors.textLight[2]);
    doc.text('PAS FOTO', photoX + photoW / 2, photoY + photoH / 2 - 1, { align: 'center' });
    doc.setFontSize(7);
    doc.text('3 x 4 cm', photoX + photoW / 2, photoY + photoH / 2 + 3.5, { align: 'center' });
  }
  doc.restoreGraphicsState();

  const idRows: [string, string][] = [
    ['Nama Lengkap', (student.fullName || '-').toUpperCase()],
    ['NISN / NIK', `${student.nisn || '-'} / ${student.nik || '-'}`],
    ['Tempat, Tanggal Lahir', `${(student.birthPlace || '-').toUpperCase()}, ${formatDateIndonesian(student.birthDate)}`],
    ['Jenis Kelamin', (student.gender || 'LAKI-LAKI').toUpperCase()],
    ['Sekolah Asal', (student.previousSchoolName || '-').toUpperCase()],
    ['No. HP / WhatsApp', student.phone || '-'],
    ['Nama Orang Tua / Wali', (student.fatherName || student.motherName || '-').toUpperCase()],
  ];

  idRows.forEach(([lbl, val]) => {
    curY = drawKeyValueRow(doc, lbl, val, 20, curY, 40, 88, 5.8);
  });

  curY += 4;

  // B. KREDENSIAL AKUN CBT
  curY = drawSectionTitle(doc, 'B. KREDENSIAL AKUN TES CBT ONLINE (HP / LAPTOP)', curY, 20, 170);

  doc.saveGraphicsState();
  doc.setFillColor(PDF_THEME.colors.primaryLight[0], PDF_THEME.colors.primaryLight[1], PDF_THEME.colors.primaryLight[2]);
  doc.setDrawColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
  doc.roundedRect(20, curY, 170, 16, 1.5, 1.5, 'FD');

  // Username
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(PDF_THEME.colors.textMuted[0], PDF_THEME.colors.textMuted[1], PDF_THEME.colors.textMuted[2]);
  doc.text('USERNAME LOGIN:', 25, curY + 5.5);
  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(PDF_THEME.colors.textDark[0], PDF_THEME.colors.textDark[1], PDF_THEME.colors.textDark[2]);
  doc.text(loginUsername, 25, curY + 11.5);

  // Password
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(PDF_THEME.colors.textMuted[0], PDF_THEME.colors.textMuted[1], PDF_THEME.colors.textMuted[2]);
  doc.text('PASSWORD LOGIN:', 85, curY + 5.5);
  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(PDF_THEME.colors.accent[0], PDF_THEME.colors.accent[1], PDF_THEME.colors.accent[2]);
  doc.text(loginPassword, 85, curY + 11.5);

  // Portal URL
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(PDF_THEME.colors.textMuted[0], PDF_THEME.colors.textMuted[1], PDF_THEME.colors.textMuted[2]);
  doc.text('PORTAL TES CBT:', 140, curY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(PDF_THEME.colors.primaryDark[0], PDF_THEME.colors.primaryDark[1], PDF_THEME.colors.primaryDark[2]);
  doc.text('spmb.smpalhadiid.sch.id', 140, curY + 11.5);
  doc.restoreGraphicsState();

  curY += 20;

  // C. JADWAL PELAKSANAAN UJIAN
  curY = drawSectionTitle(doc, 'C. JADWAL PELAKSANAAN TES DIAGNOSTIK & AKADEMIK', curY, 20, 170);

  const schedRows: [string, string][] = [
    ['Hari & Tanggal Tes', schedule?.testDate || student.testScheduleDate || 'Sesuai Pengumuman Gelombang'],
    ['Waktu / Jam Pelaksanaan', schedule?.testTime || '08.00 - 11.30 WIB'],
    ['Durasi Pengerjaan', `${schedule?.durationMinutes || 90} Menit`],
    ['Tempat / Sistem', schedule?.location || student.testLocation || 'Portal CBT Online SPMB / Lab Komputer SMPS Al-Hadiid'],
    ['Materi Uji', '1. Tes Diagnostik Awal (30%) | 2. Pengetahuan Umum (40%) | 3. Diniyyah & Qur\'an (30%)'],
  ];

  schedRows.forEach(([lbl, val]) => {
    curY = drawKeyValueRow(doc, lbl, val, 20, curY, 45, 125, 5.2);
  });

  curY += 3;

  // D. TATA TERTIB PESERTA
  curY = drawSectionTitle(doc, 'D. TATA TERTIB PESERTA UJIAN', curY, 20, 170);

  const rules = [
    '1. Peserta wajib membawa atau menunjukkan Kartu Peserta Ujian ini saat pelaksanaan ujian.',
    '2. Gunakan Username dan Password resmi di atas untuk login ke aplikasi Ujian CBT Online.',
    '3. Dilarang bekerjasama atau menggunakan alat bantu lain selama pengerjaan tes berlangsung.',
    '4. Pastikan koneksi internet stabil dan perangkat memiliki daya baterai yang cukup.',
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(PDF_THEME.colors.textBody[0], PDF_THEME.colors.textBody[1], PDF_THEME.colors.textBody[2]);
  rules.forEach(r => {
    doc.text(r, 22, curY + 3.5);
    curY += 4.5;
  });

  // Tanda Tangan Kartu Ujian
  curY += 6;
  const kepsekName = getKepalaSekolahName(schoolInfo);

  drawOfficialSignature(doc, {
    x: 25,
    y: curY,
    title: 'Peserta Ujian,',
    subtitle: 'Calon Murid Baru,',
    personName: (student.fullName || 'Peserta').toUpperCase(),
    signatureWidth: 50,
  });

  drawOfficialSignature(doc, {
    x: 80,
    y: curY,
    title: 'Ketua Panitia SPMB,',
    subtitle: 'SMPS Al-Hadiid Cileungsi,',
    personName: 'Panitia SPMB',
    signatureWidth: 50,
  });

  drawOfficialSignature(doc, {
    x: 135,
    y: curY,
    title: `Cileungsi, ${todayStr}`,
    subtitle: 'Kepala SMPS Al-Hadiid,',
    personName: kepsekName,
    extraNote: schoolInfo?.headmasterNiy ? `NIY. ${schoolInfo.headmasterNiy}` : 'Kepala Sekolah',
    signatureWidth: 50,
  });

  // Footer Resmi
  applyOfficialFooters(doc, { schoolInfo, orientation: 'portrait' });

  // Simpan File
  const safeReg = student.registrationNumber || 'NO-REG';
  const safeName = (student.fullName || 'Calon_Murid').replace(/\s+/g, '_');
  doc.save(`Kartu_Ujian_SPMB_${safeReg}_${safeName}.pdf`);
}

// =====================================================================
// 4. DOKUMEN: SURAT KETERANGAN HASIL UJIAN & KELULUSAN
// =====================================================================
export function generateExamResultPDF(student: StudentData, schoolInfo: SchoolInfo) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const todayStr = formatDateIndonesian(new Date().toISOString());
  const academicYear = schoolInfo?.academicYear || '2027/2028';

  let curY = drawOfficialHeader(doc, {
    schoolInfo,
    documentTitle: 'SURAT KETERANGAN HASIL TES DIAGNOSTIK & KELULUSAN',
    documentSubtitle: `SISTEM PENERIMAAN MURID BARU (SPMB) T.P. ${academicYear}`,
    documentNumber: `Nomor: 421.3/095/PAN-SPMB/SMP-AH/${new Date().getFullYear()}`,
    orientation: 'portrait',
  });

  curY += 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(PDF_THEME.colors.textBody[0], PDF_THEME.colors.textBody[1], PDF_THEME.colors.textBody[2]);
  doc.text('Panitia SPMB SMPS Al-Hadiid Cileungsi menerangkan bahwa calon peserta didik berikut:', 15, curY);

  curY += 4;
  curY = drawSectionTitle(doc, 'IDENTITAS CALON PESERTA DIDIK', curY, 15, 180);

  const studentInfoList: [string, string][] = [
    ['Nomor Registrasi', student.registrationNumber || '-'],
    ['Nama Calon Peserta', (student.fullName || '-').toUpperCase()],
    ['Jenis Kelamin', (student.gender || 'Laki-laki').toUpperCase()],
    ['NISN / Asal Sekolah', `${student.nisn || '-'} / ${(student.previousSchoolName || '-').toUpperCase()}`],
  ];

  studentInfoList.forEach(([lbl, val]) => {
    curY = drawKeyValueRow(doc, lbl, val, 15, curY, 45, 135, 5.2);
  });

  curY += 4;
  curY = drawSectionTitle(doc, 'RINCIAN PEROLEHAN SKOR UJIAN / TES DIAGNOSTIK', curY, 15, 180);

  // Header Tabel Nilai
  doc.saveGraphicsState();
  doc.setFillColor(PDF_THEME.colors.primaryDark[0], PDF_THEME.colors.primaryDark[1], PDF_THEME.colors.primaryDark[2]);
  doc.rect(15, curY, 180, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('NO.', 19, curY + 4.5);
  doc.text('MATA UJI / KOMPONEN TES', 30, curY + 4.5);
  doc.text('BOBOT', 115, curY + 4.5);
  doc.text('NILAI (0-100)', 138, curY + 4.5);
  doc.text('PREDIKAT', 165, curY + 4.5);
  curY += 6.5;

  const diag = student.diagnosticScore ?? 0;
  const gen = student.generalScore ?? 0;
  const rel = student.religiousScore ?? 0;
  const fin = student.finalScore ?? 0;

  const scoreRows = [
    ['1', 'Tes Diagnostik Awal', '30%', String(diag), getScorePredicate(diag)],
    ['2', 'Tes Pengetahuan Umum (TPU)', '40%', String(gen), getScorePredicate(gen)],
    ['3', 'Tes Diniyyah & Baca Al-Qur\'an', '30%', String(rel), getScorePredicate(rel)],
  ];

  scoreRows.forEach((row, idx) => {
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.rect(15, curY, 180, 6.2, 'F');
    doc.setDrawColor(PDF_THEME.colors.borderLight[0], PDF_THEME.colors.borderLight[1], PDF_THEME.colors.borderLight[2]);
    doc.rect(15, curY, 180, 6.2, 'D');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(PDF_THEME.colors.textDark[0], PDF_THEME.colors.textDark[1], PDF_THEME.colors.textDark[2]);
    doc.text(row[0], 20, curY + 4.2);
    doc.text(row[1], 30, curY + 4.2);
    doc.text(row[2], 118, curY + 4.2);
    doc.setFont('helvetica', 'bold');
    doc.text(row[3], 144, curY + 4.2);
    doc.setFont('helvetica', 'normal');
    doc.text(row[4], 165, curY + 4.2);
    curY += 6.2;
  });

  // Nilai Akhir Kumulatif Baris
  doc.setFillColor(PDF_THEME.colors.primaryLight[0], PDF_THEME.colors.primaryLight[1], PDF_THEME.colors.primaryLight[2]);
  doc.rect(15, curY, 180, 7.5, 'F');
  doc.setDrawColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
  doc.setLineWidth(0.3);
  doc.rect(15, curY, 180, 7.5, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(PDF_THEME.colors.primaryDark[0], PDF_THEME.colors.primaryDark[1], PDF_THEME.colors.primaryDark[2]);
  doc.text('NILAI AKHIR KUMULATIF (RATA-RATA BERBOBOT)', 30, curY + 5);
  doc.text('100%', 117, curY + 5);
  doc.setFontSize(9.5);
  doc.text(String(fin), 143, curY + 5.2);
  doc.setFontSize(8);
  doc.text(getScorePredicate(fin), 165, curY + 5);
  doc.restoreGraphicsState();

  curY += 12;

  // BANNER KEPUTUSAN HASIL SELEKSI
  const isPassed = student.status === 'passed' || student.status === 'class_assigned' || student.status === 're_registered' || student.status === 're_registration_paid' || student.status === 'completed';
  const isFailed = student.status === 'failed';
  const isReserved = student.status === 'passed_reserved';

  doc.saveGraphicsState();
  let boxBg: [number, number, number] = PDF_THEME.colors.primaryLight;
  let boxBorder: [number, number, number] = PDF_THEME.colors.primary;
  let textStatusColor: [number, number, number] = PDF_THEME.colors.primaryDark;
  let statusHeading = 'STATUS: MENUNGGU SIDANG YUDISIUM KELULUSAN';
  let statusDesc1 = 'Data hasil tes telah terekam dan sedang dalam proses verifikasi akhir panitia SPMB.';
  let statusDesc2 = 'Pengumuman resmi kelulusan akan diumumkan melalui portal SPMB ini.';

  if (isPassed) {
    boxBg = PDF_THEME.colors.verifiedBg;
    boxBorder = PDF_THEME.colors.verified;
    textStatusColor = PDF_THEME.colors.verified;
    statusHeading = 'KEPUTUSAN: DINYATAKAN LULUS SELEKSI';
    statusDesc1 = 'Selamat atas kelulusan Anda pada SPMB SMPS Al-Hadiid Cileungsi.';
    statusDesc2 = 'Silakan melanjutkan ke tahap Pembayaran Biaya Awal Masuk (BAM) untuk mengamankan kuota kelas.';
  } else if (isFailed) {
    boxBg = PDF_THEME.colors.rejectedBg;
    boxBorder = PDF_THEME.colors.rejected;
    textStatusColor = PDF_THEME.colors.rejected;
    statusHeading = 'KEPUTUSAN: BELUM LULUS (BERHAK UJIAN REMEDIAL)';
    statusDesc1 = 'Berdasarkan evaluasi nilai, calon peserta didik belum mencapai ambang batas kelulusan.';
    statusDesc2 = 'Sekolah memberikan kesempatan Ujian Remedial yang dapat diakses langsung pada portal SPMB.';
  } else if (isReserved) {
    boxBg = PDF_THEME.colors.pendingBg;
    boxBorder = PDF_THEME.colors.pending;
    textStatusColor = PDF_THEME.colors.pending;
    statusHeading = 'KEPUTUSAN: DINYATAKAN LULUS CADANGAN';
    statusDesc1 = 'Calon murid dinyatakan Lulus Cadangan dan akan diprioritaskan jika kuota kelas tersedia.';
    statusDesc2 = 'Informasi ketersediaan kuota akan dihubungi langsung oleh pihak Panitia SPMB.';
  }

  doc.setFillColor(boxBg[0], boxBg[1], boxBg[2]);
  doc.setDrawColor(boxBorder[0], boxBorder[1], boxBorder[2]);
  doc.setLineWidth(0.4);
  doc.roundedRect(15, curY, 180, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(textStatusColor[0], textStatusColor[1], textStatusColor[2]);
  doc.text(statusHeading, 105, curY + 6.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(PDF_THEME.colors.textBody[0], PDF_THEME.colors.textBody[1], PDF_THEME.colors.textBody[2]);
  doc.text(statusDesc1, 105, curY + 12.5, { align: 'center' });
  doc.text(statusDesc2, 105, curY + 17, { align: 'center' });
  doc.restoreGraphicsState();

  curY += 28;

  // Tanda Tangan Resmi
  const kepsekName = getKepalaSekolahName(schoolInfo);

  drawOfficialSignature(doc, {
    x: 25,
    y: curY,
    title: 'Mengetahui,',
    subtitle: 'Kepala SMPS Al-Hadiid Cileungsi,',
    personName: kepsekName,
    extraNote: schoolInfo?.headmasterNiy ? `NIY. ${schoolInfo.headmasterNiy}` : 'Kepala Sekolah',
    signatureWidth: 60,
  });

  drawOfficialSignature(doc, {
    x: 130,
    y: curY,
    title: `Cileungsi, ${todayStr}`,
    subtitle: 'Ketua Panitia SPMB,',
    personName: 'Panitia SPMB Al-Hadiid',
    extraNote: 'Stempel Resmi Kelulusan SPMB',
    signatureWidth: 60,
  });

  // QR Code Keabsahan Surat
  drawVerificationQr(doc, 94, curY + 2, 22, `SPMB-RESULT-${student.registrationNumber || '0001'}`);

  // Footer Resmi
  applyOfficialFooters(doc, { schoolInfo, orientation: 'portrait' });

  // Simpan File
  const safeReg = student.registrationNumber || 'NO-REG';
  const safeName = (student.fullName || 'Calon_Murid').replace(/\s+/g, '_');
  doc.save(`Hasil_Ujian_SPMB_${safeReg}_${safeName}.pdf`);
}

// =====================================================================
// 5. DOKUMEN: KUITANSI PEMBAYARAN RESMI SPMB (FORMULIR & BAM)
// Sesuai Spesifikasi:
// - Jenis Kuitansi Jelas: KUITANSI PEMBAYARAN FORMULIR / BAM
// - Nomor Kuitansi Unik (KWT-FRM-YYYY-XXXXX / KWT-BAM-YYYY-XXXXX)
// - Khusus BAM: Total Kewajiban, Bayar Sebelumnya, Bayar Saat Ini, Total Terbayar, Sisa Tunggakan
// - Terbilang Rupiah Akurat
// - QR Code Verifikasi Online Kuitansi
// - Tanda Tangan Panitia & Kepala Sekolah
// =====================================================================
export function generatePaymentReceiptPDF(
  payment: any,
  student: StudentData | any,
  schoolInfo?: SchoolInfo,
  bamDetails?: {
    totalBam: number;
    previousPaid: number;
    currentPaid: number;
    totalPaidToDate: number;
    remainingBalance: number;
  }
) {
  const effectiveSchoolInfo = schoolInfo || (typeof window !== 'undefined' ? getStoredSchoolInfo() : undefined);
  const statusStr = (payment.status || payment.verification_status || 'verified').toLowerCase();

  // Proteksi: Kuitansi resmi HANYA boleh diterbitkan jika transaksi sudah TERVERIFIKASI
  if (statusStr !== 'verified' && statusStr !== 'lunas') {
    alert('Transaksi belum diverifikasi. Kuitansi resmi belum dapat diterbitkan.');
    return;
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const academicYear = effectiveSchoolInfo?.academicYear || '2027/2028';
  const paymentDateStr = formatDateIndonesian(payment.payment_date || payment.created_at || new Date().toISOString());
  const todayStr = formatDateIndonesian(new Date().toISOString());

  const paymentType = String(payment.payment_type || payment.paymentType || 'form').toLowerCase();
  const isForm = paymentType.includes('form') || paymentType.includes('formulir');
  const typeLabel = isForm ? 'KUITANSI PEMBAYARAN FORMULIR' : 'KUITANSI PEMBAYARAN BIAYA AWAL MASUK (BAM)';
  
  // Nominal transaksi kuitansi ini
  const amount = Number(payment.amount || payment.amountPaid || 0);

  // Nomor Kuitansi Unik
  const year4 = academicYear.replace(/[^0-9]/g, '').slice(0, 4) || '2027';
  const receiptNumber = payment.receipt_number || payment.receiptNumber || 
    (isForm ? `KWT-FRM-${year4}-${String(payment.id || '00001').slice(-5)}` : `KWT-BAM-${year4}-${String(payment.id || '00001').slice(-5)}`);
  
  const trxNumber = payment.transactionNumber || payment.transaction_number || payment.id || 'TRX-001';

  let curY = drawOfficialHeader(doc, {
    schoolInfo: effectiveSchoolInfo,
    documentTitle: typeLabel,
    documentSubtitle: `SISTEM PENERIMAAN MURID BARU TP ${academicYear}`,
    documentNumber: `Nomor Kuitansi: ${receiptNumber}`,
    orientation: 'portrait',
    compact: false,
  });

  curY += 2;

  // Frame Kuitansi Formal
  doc.saveGraphicsState();
  doc.setDrawColor(PDF_THEME.colors.primaryDark[0], PDF_THEME.colors.primaryDark[1], PDF_THEME.colors.primaryDark[2]);
  doc.setLineWidth(0.4);
  doc.roundedRect(15, curY, 180, 208, 2, 2, 'D');

  // Status Badge di pojok kanan atas frame
  drawStatusBadge(doc, 132, curY + 3.5, 58, 7, 'verified', '✓ TERVERIFIKASI & SAH');

  curY += 11;

  // A. IDENTITAS & DATA TRANSAKSI
  curY = drawSectionTitle(doc, 'DATA TRANSAKSI PEMBAYARAN RESMI', curY, 20, 170);

  const parentName = student?.fatherName || student?.motherName || student?.guardianName || '-';

  const paymentDetails: [string, string][] = [
    ['Nomor Kuitansi', receiptNumber],
    ['Nomor Transaksi', trxNumber],
    ['Nomor Pendaftaran', student?.registrationNumber || payment.registration_number || '-'],
    ['Nama Calon Murid', (student?.fullName || payment.student_name || 'Calon Murid').toUpperCase()],
    ['Jenis Kelamin', student?.gender || payment.gender || 'Laki-laki'],
    ['Nama Orang Tua / Wali', parentName],
    ['Jenis Pembayaran', isForm ? 'Pembayaran Formulir Pendaftaran SPMB' : 'Biaya Awal Masuk (BAM)'],
    ['Tanggal Pembayaran', paymentDateStr],
    ['Metode Pembayaran', payment.payment_method || payment.paymentMethod || 'Transfer Bank BSI'],
    ['Status Pembayaran', 'TERVERIFIKASI (KAS MASUK RESMI)'],
  ];

  paymentDetails.forEach(([lbl, val]) => {
    curY = drawKeyValueRow(doc, lbl, val, 20, curY, 52, 118, 5.2);
  });

  curY += 2.5;

  // B. KOTAK NOMINAL BESAR & TERBILANG (NOMINAL TRANSAKSI SAAT INI)
  doc.saveGraphicsState();
  doc.setFillColor(PDF_THEME.colors.primaryLight[0], PDF_THEME.colors.primaryLight[1], PDF_THEME.colors.primaryLight[2]);
  doc.setDrawColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
  doc.roundedRect(20, curY, 170, 21, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(PDF_THEME.colors.primaryDark[0], PDF_THEME.colors.primaryDark[1], PDF_THEME.colors.primaryDark[2]);
  doc.text('JUMLAH PEMBAYARAN SAAT INI (NOMINAL) :', 24, curY + 6);

  doc.setFontSize(13.5);
  doc.text(formatRupiah(amount), 24, curY + 13.5);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(PDF_THEME.colors.textMuted[0], PDF_THEME.colors.textMuted[1], PDF_THEME.colors.textMuted[2]);
  doc.text(`Terbilang: "${formatTerbilangRupiah(amount)}"`, 24, curY + 18);
  doc.restoreGraphicsState();

  curY += 24;

  // C. KHUSUS KUITANSI BAM: TAMPILKAN RINCIAN ANGSURAN & TUNGGAKAN (SECTION 5)
  if (!isForm && bamDetails) {
    curY = drawSectionTitle(doc, 'REKAPITULASI PEMBAYARAN BAM & SISA TUNGGAKAN', curY, 20, 170);

    const bamRows = [
      ['Total Kewajiban BAM', formatRupiah(bamDetails.totalBam)],
      ['Pembayaran Sebelumnya', formatRupiah(bamDetails.previousPaid)],
      ['Pembayaran Saat Ini (Kuitansi Ini)', formatRupiah(bamDetails.currentPaid || amount)],
      ['Total Pembayaran Sampai Saat Ini', formatRupiah(bamDetails.totalPaidToDate)],
      ['Sisa Tunggakan BAM', bamDetails.remainingBalance === 0 ? 'Rp 0 (LUNAS)' : formatRupiah(bamDetails.remainingBalance)],
    ];

    bamRows.forEach(([lbl, val], idx) => {
      curY = drawKeyValueRow(doc, lbl, val, 20, curY, 75, 95, 5, idx % 2 === 1);
    });

    curY += 2.5;
  }

  // Catatan Kuitansi
  if (payment.notes || payment.rejection_reason) {
    doc.saveGraphicsState();
    doc.setFillColor(PDF_THEME.colors.bgZebra[0], PDF_THEME.colors.bgZebra[1], PDF_THEME.colors.bgZebra[2]);
    doc.rect(20, curY, 170, 8.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(PDF_THEME.colors.textBody[0], PDF_THEME.colors.textBody[1], PDF_THEME.colors.textBody[2]);
    doc.text('Keterangan :', 23, curY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.text(String(payment.notes || payment.rejection_reason).substring(0, 95), 45, curY + 4.5);
    doc.restoreGraphicsState();
    curY += 11;
  }

  // Pernyataan Keabsahan
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(PDF_THEME.colors.textLight[0], PDF_THEME.colors.textLight[1], PDF_THEME.colors.textLight[2]);
  doc.text('* Kuitansi ini adalah bukti pembayaran yang sah dan diterbitkan secara digital oleh Sistem SPMB SMPS Al-Hadiid Cileungsi.', 20, curY);

  curY += 6.5;

  // Tanda Tangan: Panitia SPMB & Kepala Sekolah
  const verifiedBy = payment.verified_by || 'Panitia Keuangan SPMB';
  const kepsekName = getKepalaSekolahName(effectiveSchoolInfo);

  drawOfficialSignature(doc, {
    x: 25,
    y: curY,
    title: 'Penerima / Panitia SPMB,',
    subtitle: 'Bagian Administrasi Keuangan,',
    personName: verifiedBy,
    signatureWidth: 55,
  });

  drawOfficialSignature(doc, {
    x: 125,
    y: curY,
    title: `Cileungsi, ${todayStr}`,
    subtitle: 'Mengetahui,\nKepala Sekolah SMPS Al-Hadiid,',
    personName: kepsekName,
    extraNote: effectiveSchoolInfo?.headmasterNiy ? `NIY. ${effectiveSchoolInfo.headmasterNiy}` : undefined,
    signatureWidth: 55,
  });

  // QR Code Verifikasi Kuitansi (Section 14)
  const qrUrl = getReceiptVerificationUrl(receiptNumber);
  drawVerificationQr(doc, 85, curY + 2, 22, qrUrl);

  // Footer Resmi
  applyOfficialFooters(doc, { schoolInfo: effectiveSchoolInfo, orientation: 'portrait' });

  // Simpan File dengan nama terstruktur
  const safeReg = student?.registrationNumber || payment.registration_number || 'NO-REG';
  const cleanReceiptNo = receiptNumber.replace(/[^A-Za-z0-9_-]/g, '_');
  doc.save(`Kuitansi_${cleanReceiptNo}_${safeReg}.pdf`);
}

// =====================================================================
// 8. DOKUMEN: SURAT KETERANGAN TUNGGAKAN BAM RESMI (PORTRAIT)
// =====================================================================
export function generateSuratTunggakanBamPDF(
  student: StudentData,
  bamData: {
    totalBam: number;
    totalPaid: number;
    remaining: number;
    items?: Array<{ nama_item: string; nominal: number }>;
  },
  schoolInfo?: SchoolInfo
) {
  const effectiveSchoolInfo = schoolInfo || (typeof window !== 'undefined' ? getStoredSchoolInfo() : undefined);
  
  if (bamData.remaining <= 0) {
    alert('Calon murid ini tidak memiliki sisa tunggakan BAM (Status LUNAS). Surat keterangan tunggakan hanya untuk siswa yang memiliki sisa tunggakan.');
    return;
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const layout = PDF_THEME.layout.portrait;
  const startX = layout.marginLeft; // 15mm
  const contentWidth = layout.contentWidth; // 180mm
  const rightX = startX + contentWidth;

  // Header Resmi
  let curY = drawOfficialHeader(doc, {
    schoolInfo: effectiveSchoolInfo,
    documentTitle: 'SURAT PEMBERITAHUAN TUNGGAKAN BIAYA AWAL MASUK (BAM)',
    documentSubtitle: `SISTEM PENERIMAAN MURID BARU TP ${effectiveSchoolInfo?.academicYear || '2027/2028'}`,
    orientation: 'portrait',
    compact: false,
  });

  curY += 2;

  // Nomor Surat dan Identitas Dokumen
  const todayStr = formatDateIndonesian(new Date().toISOString());
  const yearNum = new Date().getFullYear();
  const regNo = student.registrationNumber || 'SPMB';
  const letterNo = `B-421.3/${regNo.replace(/[^0-9]/g, '') || '088'}/SPMB-BAM/SMP-ALH/${yearNum}`;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(PDF_THEME.colors.textDark[0], PDF_THEME.colors.textDark[1], PDF_THEME.colors.textDark[2]);

  doc.text(`Nomor     : ${letterNo}`, startX, curY);
  doc.text(`Lampiran  : 1 (Satu) Lembar Rincian`, startX, curY + 4.5);
  doc.text(`Perihal   : Pemberitahuan & Tagihan Tunggakan BAM`, startX, curY + 9);
  doc.text(`Cileungsi, ${todayStr}`, rightX - 45, curY);

  curY += 16;

  // Kepada Yth
  doc.setFont('helvetica', 'normal');
  doc.text('Kepada Yth.', startX, curY);
  doc.setFont('helvetica', 'bold');
  const parentName = student.fatherName || student.motherName || student.guardianName || `Orang Tua / Wali dari ${student.fullName}`;
  doc.text(`Bapak/Ibu Orang Tua / Wali dari ${student.fullName}`, startX, curY + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Di Tempat', startX, curY + 9);

  curY += 15;

  // Paragraf Pembuka
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const introText = 'Assalamu\'alaikum Warahmatullahi Wabarakatuh.\n\nBa\'da salam, semoga Bapak/Ibu senantiasa dalam limpahan taufiq dan hidayah Allah SWT dalam menjalankan aktivitas sehari-hari. Sehubungan dengan proses Penerimaan Murid Baru (SPMB) SMPS Al-Hadiid Cileungsi Tahun Pelajaran ' + (effectiveSchoolInfo?.academicYear || '2027/2028') + ', bersama ini kami sampaikan data administrasi keuangan Biaya Awal Masuk (BAM) atas nama calon santri/murid berikut:';
  const splitIntro = doc.splitTextToSize(introText, contentWidth);
  doc.text(splitIntro, startX, curY);
  curY += splitIntro.length * 4.2 + 2;

  // Box Data Calon Murid
  curY = drawSectionTitle(doc, 'I. DATA IDENTITAS CALON SANTRI / MURID', curY, startX, contentWidth);

  curY = drawKeyValueRow(doc, 'Nomor Pendaftaran', student.registrationNumber || '-', startX, curY, 45, contentWidth - 45);
  curY = drawKeyValueRow(doc, 'Nama Lengkap Siswa', student.fullName, startX, curY, 45, contentWidth - 45);
  curY = drawKeyValueRow(doc, 'Jenis Kelamin', student.gender || 'Laki-laki', startX, curY, 45, contentWidth - 45);
  curY = drawKeyValueRow(doc, 'Asal Sekolah', student.previousSchoolName || '-', startX, curY, 45, contentWidth - 45);
  if (student.assignedClassName) {
    curY = drawKeyValueRow(doc, 'Rekomendasi Kelas', student.assignedClassName, startX, curY, 45, contentWidth - 45);
  }

  curY += 4;

  // Box Ringkasan Tunggakan
  curY = drawSectionTitle(doc, 'II. REKAPITULASI PEMBAYARAN & SISA TUNGGAKAN BAM', curY, startX, contentWidth);

  // Tabel Rekapitulasi Keuangan
  doc.saveGraphicsState();
  doc.setFillColor(PDF_THEME.colors.primaryDark[0], PDF_THEME.colors.primaryDark[1], PDF_THEME.colors.primaryDark[2]);
  doc.rect(startX, curY, contentWidth, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('KOMPONEN PERHITUNGAN', startX + 4, curY + 4.5);
  doc.text('NOMINAL (RP)', rightX - 35, curY + 4.5);
  doc.restoreGraphicsState();
  curY += 6.5;

  const rows = [
    { label: 'Total Kewajiban Biaya Awal Masuk (BAM)', val: formatRupiah(bamData.totalBam), bold: false, color: [30, 41, 59] },
    { label: 'Jumlah yang Telah Terbayar / Diterima', val: formatRupiah(bamData.totalPaid), bold: false, color: [16, 185, 129] },
    { label: 'SISA SALDO TUNGGAKAN BAM (WAJIB DILUNASI)', val: formatRupiah(bamData.remaining), bold: true, color: [225, 29, 72] },
  ];

  rows.forEach((r, idx) => {
    doc.saveGraphicsState();
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(startX, curY, contentWidth, 6.5, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(startX, curY, contentWidth, 6.5);

    doc.setFont('helvetica', r.bold ? 'bold' : 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(r.color[0], r.color[1], r.color[2]);
    doc.text(r.label, startX + 4, curY + 4.5);
    doc.text(r.val, rightX - 35, curY + 4.5);
    doc.restoreGraphicsState();
    curY += 6.5;
  });

  curY += 4;

  // Box Rekening Pembayaran
  doc.saveGraphicsState();
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(startX, curY, contentWidth, 18, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('REKENING RESMI PEMBAYARAN SMPS AL-HADIID CILEUNGSI:', startX + 4, curY + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.text(`Bank Syariah Indonesia (BSI) / Bank Mandiri Cabang Cileungsi`, startX + 4, curY + 9);
  doc.text(`Nomor Rekening: 7123-4567-89 a.n. YAYASAN AL-HADIID CILEUNGSI`, startX + 4, curY + 13);
  doc.text(`Konfirmasi Bukti Transfer via WhatsApp Admin Keuangan SPMB: ${effectiveSchoolInfo?.phone || '0812-3456-7890'}`, startX + 4, curY + 16.5);
  doc.restoreGraphicsState();
  curY += 22;

  // Paragraf Penutup
  const closingText = 'Mengingat pentingnya pemenuhan sarana belajar, pemesanan seragam lengkap, dan modul pembelajaran santri, kami mengimbau Bapak/Ibu untuk dapat melunasi sisa tagihan tersebut sebelum kegiatan MPLS dimulai. Atas perhatian dan kerjasamanya, kami sampaikan terima kasih.\n\nWassalamu\'alaikum Warahmatullahi Wabarakatuh.';
  const splitClosing = doc.splitTextToSize(closingText, contentWidth);
  doc.text(splitClosing, startX, curY);
  curY += splitClosing.length * 4.2 + 2;

  // Tanda Tangan
  const kepsekName = getKepalaSekolahName(effectiveSchoolInfo);
  drawOfficialSignature(doc, {
    x: rightX - 65,
    y: curY,
    title: `Cileungsi, ${todayStr}`,
    subtitle: 'Panitia SPMB & Kepala Sekolah,',
    personName: kepsekName,
    extraNote: effectiveSchoolInfo?.headmasterNiy ? `NIY. ${effectiveSchoolInfo.headmasterNiy}` : 'SMPS AL-HADIID CILEUNGSI',
    signatureWidth: 60,
  });

  // QR Code Verifikasi
  drawVerificationQr(doc, startX + 4, curY + 4, 20, `TUNGGAKAN-BAM-${regNo}-${bamData.remaining}`);

  // Footer Resmi
  applyOfficialFooters(doc, { schoolInfo: effectiveSchoolInfo, orientation: 'portrait' });

  // Simpan File PDF
  const safeName = (student.fullName || 'Calon_Murid').replace(/\s+/g, '_');
  doc.save(`Surat_Tunggakan_BAM_${regNo}_${safeName}.pdf`);
}
