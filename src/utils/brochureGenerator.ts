// =====================================================================
// src/utils/brochureGenerator.ts
// Generator Brosur Resmi SPMB SMPS Al-Hadiid Cileungsi (PDF 2 Halaman)
// Serta Fungsi Pembantu Unduh & Pratinjau Brosur Terpadu (Gambar & PDF)
// =====================================================================

import { jsPDF } from 'jspdf';
import { SchoolInfo, CostBreakdown, TestSchedule } from '../types';
import {
  PDF_THEME,
  drawOfficialHeader,
  applyOfficialFooters,
  drawSectionTitle,
  drawWatermark,
  drawOfficialSignature,
} from './pdf';
import { getKepalaSekolahName } from './storage';

/**
 * Deteksi apakah brosur yang aktif berupa berkas gambar (JPG, PNG, WEBP, JPEG)
 */
export function isImageBrochure(schoolInfo?: Partial<SchoolInfo> | null): boolean {
  if (!schoolInfo) return false;
  if (schoolInfo.brochureFileType && schoolInfo.brochureFileType.toLowerCase().startsWith('image/')) {
    return true;
  }
  if (schoolInfo.brochureUrl) {
    const url = schoolInfo.brochureUrl.toLowerCase().trim();
    if (url.startsWith('data:image/')) return true;
    if (/\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(url)) return true;
  }
  if (schoolInfo.brochureFileName && /\.(png|jpe?g|webp|gif)$/i.test(schoolInfo.brochureFileName)) {
    return true;
  }
  return false;
}

/**
 * Konversi Data URL (Base64) ke Blob biner asli untuk download aman tanpa batas URL
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  try {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    console.error('[brochureGenerator] dataUrlToBlob fallback error:', e);
    return new Blob([dataUrl], { type: 'application/octet-stream' });
  }
}

/**
 * Trigger pengunduhan Blob langsung secara aman di semua browser
 */
function triggerDirectBlobDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {}
  }, 2500);
}

/**
 * Menghasilkan Dokumen Brosur Resmi SPMB SMPS Al-Hadiid Cileungsi (2 Halaman Rapi & Sesuai BAM Landing Page)
 */
export function generateBrosurSpmbPDF(
  schoolInfo: SchoolInfo,
  _costBreakdowns: CostBreakdown[] = [],
  _testSchedules: TestSchedule[] = []
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const layout = PDF_THEME.layout.portrait;
  const startX = layout.marginLeft;
  const contentWidth = layout.contentWidth;
  const academicYear = schoolInfo.academicYear || '2027/2028';
  const academicYearClean = academicYear.replace('/', '-');

  // ===================================================================
  // HALAMAN 1: PROFIL, VISI MISI, PROGRAM UNGGULAN & FASILITAS KAMPUS
  // ===================================================================
  drawWatermark(doc, 'SMPS AL-HADIID');

  let currentY = drawOfficialHeader(doc, {
    schoolInfo,
    documentTitle: 'BROSUR PANDUAN PENERIMAAN MURID BARU (SPMB)',
    documentSubtitle: `TAHUN PELAJARAN ${academicYear} • KAMPUS ISLAMI BERKARAKTER & BERPRESTASI`,
    documentNumber: `BROSUR/SPMB/${academicYearClean}`,
    orientation: 'portrait',
  });

  currentY += 2;

  // A. PROFIL & VISI MISI SEKOLAH
  currentY = drawSectionTitle(doc, 'A. PROFIL & VISI MISI SEKOLAH', currentY, startX, contentWidth);
  currentY += 4.5; // Jarak aman setelah judul seksi agar teks tidak bertabrakan

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(30, 41, 59);

  const profilText = `${schoolInfo.name || 'SMPS AL-HADIID CILEUNGSI'} adalah lembaga pendidikan Islam terpadu jenjang Sekolah Menengah Pertama yang berdedikasi membentuk generasi Robbani yang beraqidah lurus, berakhlak mulia sesuai manhaj salafush sholih, unggul dalam prestasi akademik, mandiri, serta menguasai ilmu pengetahuan dan teknologi. Kami memadukan Kurikulum Merdeka Nasional dengan kurikulum diniyyah kepesantrenan terpadu untuk melahirkan generasi yang bertauhid, tangguh, dan berdaya saing global.`;
  const splitProfil = doc.splitTextToSize(profilText, contentWidth - 4);
  doc.text(splitProfil, startX + 2, currentY);
  currentY += splitProfil.length * 4.1 + 3.0;

  // Kotak Visi & Karakter Unggulan (Tinggi Dinamis & Margin Rapi)
  const visiText = schoolInfo.tagline || 'Terwujudnya Murid yang memiliki Aqidah yang kuat, berakhlak mulia sesuai manhaj salafush sholih serta menguasai ilmu pengetahuan dan teknologi.';
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.6);
  const splitVisi = doc.splitTextToSize(`"${visiText}"`, contentWidth - 14);

  const visiBoxHeight = 13.0 + splitVisi.length * 3.8;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
  doc.setLineWidth(0.35);
  doc.roundedRect(startX, currentY, contentWidth, visiBoxHeight, 2, 2, 'FD');

  // Strip aksen vertikal di sisi kiri kotak visi
  doc.setFillColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
  doc.rect(startX, currentY, 2.5, visiBoxHeight, 'F');

  // Label Visi
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
  doc.text('VISI & TARGET MUTU PENDIDIKAN:', startX + 5, currentY + 4.8);

  // Teks Isi Visi
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(splitVisi, startX + 5, currentY + 9.0);

  // Pilar Karakter Utama di bawah teks visi
  const pilarY = currentY + 9.0 + splitVisi.length * 3.8 + 0.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(PDF_THEME.colors.accent[0], PDF_THEME.colors.accent[1], PDF_THEME.colors.accent[2]);
  doc.text('• Karakter Adab Salafush Sholih   • Tahfidz Al-Qur\'an 3 Juz Mutqin   • Berpikir Kritis & Melek Digital', startX + 5, pilarY);

  currentY += visiBoxHeight + 4.0;

  // B. 5 PROGRAM KEUNGGULAN UTAMA
  currentY = drawSectionTitle(doc, 'B. 5 PROGRAM KEUNGGULAN UTAMA SEKOLAH', currentY, startX, contentWidth);
  currentY += 4.5;

  const programs = [
    {
      no: '1',
      title: 'Program Tahfidz & Diniyyah Al-Qur\'an',
      badge: 'Target 3 Juz Mutqin',
      desc: 'Target hafalan minimal 3 Juz (Juz 28, 29, 30), bimbingan tahsin metode bersanad teruji, Dauroh Al-Qur\'an intensif, serta sertifikasi tahfidz berkala bagi setiap murid.',
    },
    {
      no: '2',
      title: 'Kurikulum Merdeka Terpadu & Pembiasaan Adab Islami',
      badge: 'Karakter & Akhlak',
      desc: 'Integrasi Kurikulum Nasional dengan adab Islam: sholat lima waktu berjamaah di masjid kampus, sholat Dhuha, dzikir pagi-petang, serta mentoring adab harian.',
    },
    {
      no: '3',
      title: 'Penguasaan Bahasa Asing Komunikatif (Arab & Inggris)',
      badge: 'Bilingual Habit',
      desc: 'Pembiasaan kosa kata harian (mufradat & vocabulary), Arabic & English Club, kegiatan muhadatsah rutin, serta bimbingan pidato dan lomba dwibahasa.',
    },
    {
      no: '4',
      title: 'Literasi Digital, Laboratorium Komputer & CBT Modern',
      badge: 'Teknologi & CBT',
      desc: 'Praktikum komputer terstandar, pengenalan logika coding dasar, robotic club, dan implementasi Computer Based Test (CBT) mandiri untuk seluruh evaluasi sekolah.',
    },
    {
      no: '5',
      title: 'Ekstrakurikuler Minat Bakat Beragam & Berprestasi',
      badge: 'Bakat & Prestasi',
      desc: 'Pramuka SIT, Panahan Sunnah, Futsal Academy, Basket, Bulutangkis, Iqra/Al-Qur\'an, PMR, Pasus, Sains Club, dan Jurnalistik Sekolah.',
    },
  ];

  programs.forEach((prog) => {
    // Nomor / Badge
    doc.setFillColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
    doc.roundedRect(startX + 1, currentY - 2.8, 4.8, 4.2, 0.8, 0.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);
    doc.text(prog.no, startX + 3.4, currentY + 0.1, { align: 'center' });

    // Judul Program
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.0);
    doc.setTextColor(PDF_THEME.colors.primaryDark[0], PDF_THEME.colors.primaryDark[1], PDF_THEME.colors.primaryDark[2]);
    doc.text(prog.title, startX + 7.8, currentY);

    // Tag Kanan
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    doc.setTextColor(PDF_THEME.colors.accent[0], PDF_THEME.colors.accent[1], PDF_THEME.colors.accent[2]);
    doc.text(`[ ${prog.badge} ]`, startX + contentWidth - 2, currentY, { align: 'right' });

    currentY += 3.6;

    // Deskripsi Program (Wrapped secara rapi dan presisi)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(71, 85, 105);
    const splitDesc = doc.splitTextToSize(prog.desc, contentWidth - 10);
    doc.text(splitDesc, startX + 7.8, currentY);
    currentY += splitDesc.length * 3.6 + 2.3;
  });

  currentY += 1.0;

  // C. FASILITAS PENDUKUNG PEMBELAJARAN
  currentY = drawSectionTitle(doc, 'C. FASILITAS PENDUKUNG PEMBELAJARAN KAMPUS', currentY, startX, contentWidth);
  currentY += 4.5;

  const colWidth = (contentWidth - 4) / 2;
  const col1Fasilitas = [
    '• Ruang Kelas Full AC & Proyektor Multimedia',
    '• Laboratorium Komputer CBT Berkecepatan Tinggi',
    '• Masjid Kampus Luas untuk Sholat & Tahfidz',
    '• Laboratorium Praktik Sains (IPA Terpadu)',
  ];
  const col2Fasilitas = [
    '• Perpustakaan Lengkap & Pojok Baca Literasi',
    '• Lapangan Olahraga: Futsal, Basket, Voli & Panahan',
    '• Ruang Medis UKS & Bimbingan Konseling (BK)',
    '• Kantin Halal Bersih & Area Parkir Terjaga 24 Jam',
  ];

  // Kotak Kolom 1
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.roundedRect(startX, currentY - 2.5, colWidth, 19, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(30, 41, 59);
  let tempY1 = currentY;
  col1Fasilitas.forEach((f) => {
    doc.text(f, startX + 3, tempY1);
    tempY1 += 4.2;
  });

  // Kotak Kolom 2
  doc.roundedRect(startX + colWidth + 4, currentY - 2.5, colWidth, 19, 1.5, 1.5, 'FD');
  let tempY2 = currentY;
  col2Fasilitas.forEach((f) => {
    doc.text(f, startX + colWidth + 7, tempY2);
    tempY2 += 4.2;
  });

  currentY += 21.0;

  // Banner Bawah Hal 1 (Transisi ke Hal 2)
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.3);
  doc.roundedRect(startX, currentY, contentWidth, 7.5, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);
  doc.setTextColor(6, 78, 59);
  doc.text(
    'Lanjut ke Halaman 2: Alur 8 Tahap Pendaftaran Online, Rincian Biaya (BAM), Rekening & Kontak Resmi ->',
    startX + contentWidth / 2,
    currentY + 4.8,
    { align: 'center' }
  );

  // ===================================================================
  // HALAMAN 2: ALUR PENDAFTARAN, RINCIAN BIAYA BAM, REKENING & KONTAK
  // ===================================================================
  doc.addPage();
  drawWatermark(doc, 'SMPS AL-HADIID');

  let currentY2 = drawOfficialHeader(doc, {
    schoolInfo,
    documentTitle: 'INFORMASI PENDAFTARAN & KETENTUAN BIAYA SPMB',
    documentSubtitle: `PETUNJUK TEKNIS SPMB TP ${academicYear} • TAHAPAN SELEKSI & BIAYA AWAL MASUK (BAM)`,
    orientation: 'portrait',
    compact: true,
  });

  currentY2 += 2.0;

  // D. ALUR 8 TAHAPAN PENDAFTARAN ONLINE
  currentY2 = drawSectionTitle(doc, 'D. ALUR 8 TAHAP PENDAFTARAN ONLINE (SPMB)', currentY2, startX, contentWidth);
  currentY2 += 4.2;

  const alurSteps = [
    {
      step: '1',
      title: 'Pembuatan Akun Mandiri',
      desc: 'Calon murid mendaftarkan username & password mandiri pada portal resmi SPMB sekolah.',
    },
    {
      step: '2',
      title: 'Pembayaran Formulir',
      desc: `Melakukan pembayaran formulir Rp ${(schoolInfo.formFee || 200000).toLocaleString('id-ID')} & upload bukti transfer ke portal.`,
    },
    {
      step: '3',
      title: 'Pengisian Formulir',
      desc: 'Melengkapi data diri siswa, wali murid, dan berkas KK serta Akta Kelahiran secara online.',
    },
    {
      step: '4',
      title: 'Verifikasi & Unduh Kartu',
      desc: 'Panitia memverifikasi berkas pendaftaran, kemudian murid mengunduh Kartu Peserta Ujian.',
    },
    {
      step: '5',
      title: 'Pelaksanaan Ujian CBT',
      desc: 'Mengikuti tes potensi akademik, literasi numerasi, dan tes kemampuan membaca Al-Qur\'an.',
    },
    {
      step: '6',
      title: 'Pengumuman Kelulusan',
      desc: 'Hasil seleksi diumumkan melalui portal SPMB sekolah serta pesan WhatsApp resmi panitia.',
    },
    {
      step: '7',
      title: 'Daftar Ulang & Biaya BAM',
      desc: 'Calon murid yang lulus melakukan pelunasan Biaya Awal Masuk (BAM) sesuai skema pilihan.',
    },
    {
      step: '8',
      title: 'Penetapan Rombel Kelas 7',
      desc: 'Administrasi dinyatakan lengkap dan murid resmi ditempatkan di rombel kelas 7.',
    },
  ];

  const colDescX = startX + 54;
  const colDescWidth = contentWidth - 54;

  alurSteps.forEach((item, idx) => {
    // Zebra striping untuk baris ganjil
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(startX, currentY2 - 3.0, contentWidth, 4.3, 'F');
    }

    // Badge Lingkaran Penomoran
    doc.setFillColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
    doc.circle(startX + 3.2, currentY2 - 0.9, 1.9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    doc.setTextColor(255, 255, 255);
    doc.text(item.step, startX + 3.2, currentY2 - 0.3, { align: 'center' });

    // Kolom Judul Tahap (Bold)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text(item.title, startX + 6.8, currentY2);

    // Titik Pemisah / Bullet
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.0);
    doc.setTextColor(148, 163, 184);
    doc.text('•', startX + 51.5, currentY2);

    // Kolom Deskripsi Tahap (Normal, wrap secara presisi dalam kolomnya)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.1);
    doc.setTextColor(71, 85, 105);

    const descWidth = doc.getTextWidth(item.desc);
    if (descWidth <= colDescWidth) {
      doc.text(item.desc, colDescX, currentY2);
      currentY2 += 4.2;
    } else {
      const splitDesc = doc.splitTextToSize(item.desc, colDescWidth);
      doc.text(splitDesc, colDescX, currentY2);
      currentY2 += splitDesc.length * 3.4 + 1.0;
    }
  });

  currentY2 += 1.8;

  // E. RINCIAN BIAYA AWAL MASUK (BAM) & KETENTUAN PEMBAYARAN
  currentY2 = drawSectionTitle(doc, 'E. BIAYA FORMULIR & RINCIAN BIAYA AWAL MASUK (BAM)', currentY2, startX, contentWidth);
  currentY2 += 3.2;

  // Box Highlight Ringkasan Biaya Utama (Sesuai Landing Page)
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.3);
  doc.roundedRect(startX, currentY2, contentWidth, 10.5, 1.5, 1.5, 'FD');

  const cardCol = contentWidth / 4;
  // Box 1: Formulir
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text('FORMULIR PENDAFTARAN', startX + cardCol * 0.5, currentY2 + 3.5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 118, 110);
  doc.text(`Rp ${(schoolInfo.formFee || 200000).toLocaleString('id-ID')}`, startX + cardCol * 0.5, currentY2 + 7.8, { align: 'center' });

  // Divider 1
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(startX + cardCol, currentY2 + 1.5, startX + cardCol, currentY2 + 9);

  // Box 2: BAM Ikhwan (Putra)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text('TOTAL BAM IKHWAN (PUTRA)', startX + cardCol * 1.5, currentY2 + 3.5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 118, 110);
  doc.text('Rp 6.670.000', startX + cardCol * 1.5, currentY2 + 7.8, { align: 'center' });

  // Divider 2
  doc.line(startX + cardCol * 2, currentY2 + 1.5, startX + cardCol * 2, currentY2 + 9);

  // Box 3: BAM Akhwat (Putri)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text('TOTAL BAM AKHWAT (PUTRI)', startX + cardCol * 2.5, currentY2 + 3.5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(190, 24, 93);
  doc.text('Rp 6.890.000', startX + cardCol * 2.5, currentY2 + 7.8, { align: 'center' });

  // Divider 3
  doc.line(startX + cardCol * 3, currentY2 + 1.5, startX + cardCol * 3, currentY2 + 9);

  // Box 4: SPP Bulanan
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text('SPP / DPP BULANAN', startX + cardCol * 3.5, currentY2 + 3.5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 118, 110);
  doc.text('Rp 425.000 / bln', startX + cardCol * 3.5, currentY2 + 7.8, { align: 'center' });

  currentY2 += 12;

  // Header Tabel 13 Komponen BAM (Presisi sesuai Landing Page)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(startX, currentY2, contentWidth, 4.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text('NO', startX + 2.5, currentY2 + 3.2);
  doc.text('JENIS KEUANGAN / KOMPONEN PEMBIAYAAN', startX + 11, currentY2 + 3.2);
  doc.text('BIAYA IKHWAN', startX + 105, currentY2 + 3.2, { align: 'right' });
  doc.text('BIAYA AKHWAT', startX + 140, currentY2 + 3.2, { align: 'right' });
  doc.text('KETERANGAN', startX + 162, currentY2 + 3.2, { align: 'center' });
  currentY2 += 4.5;

  // Daftar 13 Komponen BAM resmi
  const bamItems = [
    { no: 1, name: 'Dana Awal Pendidikan (DAP)', ikhwan: 'Rp 4.250.000', akhwat: 'Rp 4.250.000', ket: 'Sekali' },
    { no: 2, name: 'Dana Praktik Komputer', ikhwan: 'Rp 150.000', akhwat: 'Rp 150.000', ket: 'Per Tahun' },
    { no: 3, name: 'Dana Praktik IPA', ikhwan: 'Rp 100.000', akhwat: 'Rp 100.000', ket: 'Per Tahun' },
    { no: 4, name: 'Perlengkapan / Seragam (Paket 4 Stel)*', ikhwan: 'Rp 700.000', akhwat: 'Rp 920.000', ket: 'Sekali', isHighlight: true },
    { no: 5, name: 'Dana Penyelenggaraan Pendidikan (DPP / SPP)', ikhwan: 'Rp 425.000', akhwat: 'Rp 425.000', ket: 'Per Bulan (Juli)' },
    { no: 6, name: 'Tabungan Wajib', ikhwan: 'Rp 25.000', akhwat: 'Rp 25.000', ket: 'Per Bulan' },
    { no: 7, name: 'MPLS / Masa Pengenalan Lingkungan Sekolah', ikhwan: 'Rp 100.000', akhwat: 'Rp 100.000', ket: 'Sekali' },
    { no: 8, name: 'Dana Sosial', ikhwan: 'Rp 25.000', akhwat: 'Rp 25.000', ket: 'Per Tahun' },
    { no: 9, name: 'Penilaian Akhir Semester (PAS)', ikhwan: 'Rp 220.000', akhwat: 'Rp 220.000', ket: 'Per Tahun' },
    { no: 10, name: 'Penilaian Akhir Tahun (PAT)', ikhwan: 'Rp 225.000', akhwat: 'Rp 225.000', ket: 'Per Tahun' },
    { no: 11, name: 'Kegiatan Ekstrakurikuler / AMBAP', ikhwan: 'Rp 125.000', akhwat: 'Rp 125.000', ket: 'Per Tahun' },
    { no: 12, name: 'Biaya Dauroh (Kegiatan Pesantren / Tarbawi)', ikhwan: 'Rp 120.000', akhwat: 'Rp 120.000', ket: 'Per Tahun' },
    { no: 13, name: 'Biaya Cetak (Raport, Foto, Name Tag, Kalender)', ikhwan: 'Rp 205.000', akhwat: 'Rp 205.000', ket: 'Per Tahun' },
  ];

  doc.setFontSize(6.4);
  bamItems.forEach((row, idx) => {
    const isZebra = idx % 2 === 1;
    if (row.isHighlight) {
      doc.setFillColor(254, 243, 199); // amber-100
      doc.rect(startX, currentY2, contentWidth, 3.7, 'F');
    } else if (isZebra) {
      doc.setFillColor(248, 250, 252);
      doc.rect(startX, currentY2, contentWidth, 3.7, 'F');
    }

    doc.setFont('helvetica', row.isHighlight ? 'bold' : 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(String(row.no), startX + 3.5, currentY2 + 2.6, { align: 'center' });
    doc.text(row.name, startX + 11, currentY2 + 2.6);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 118, 110);
    doc.text(row.ikhwan, startX + 105, currentY2 + 2.6, { align: 'right' });
    doc.text(row.akhwat, startX + 140, currentY2 + 2.6, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(row.ket, startX + 162, currentY2 + 2.6, { align: 'center' });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    doc.line(startX, currentY2 + 3.7, startX + contentWidth, currentY2 + 3.7);

    currentY2 += 3.7;
  });

  // Baris Total BAM (Highlight Hijau Tua)
  doc.setFillColor(6, 78, 59); // emerald-900
  doc.rect(startX, currentY2, contentWidth, 4.6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL BIAYA AWAL MASUK (BAM):', startX + 11, currentY2 + 3.3);
  doc.setTextColor(253, 224, 71); // yellow-300
  doc.text('Rp 6.670.000', startX + 105, currentY2 + 3.3, { align: 'right' });
  doc.text('Rp 6.890.000', startX + 140, currentY2 + 3.3, { align: 'right' });
  doc.setTextColor(209, 250, 229);
  doc.setFontSize(6.4);
  doc.text('Awal Masuk', startX + 162, currentY2 + 3.3, { align: 'center' });
  currentY2 += 6.0;

  // Kotak Informasi Catatan Seragam & Skema Cicilan (Rapi, Tidak Terpotong)
  const noteBoxHeight = 11.2;
  doc.setFillColor(254, 252, 232); // amber-50
  doc.setDrawColor(251, 191, 36); // amber-400
  doc.setLineWidth(0.25);
  doc.roundedRect(startX, currentY2, contentWidth, noteBoxHeight, 1.5, 1.5, 'FD');

  // Baris 1: Catatan Paket Seragam
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text('* Ketentuan Seragam:', startX + 3.0, currentY2 + 4.0);
  const seragamLabelW = doc.getTextWidth('* Ketentuan Seragam:');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  const seragamDesc = 'Paket 4 stel lengkap (Putih Biru, Biru Tosca, Pramuka, Olahraga). Siswi (Akhwat) mendapatkan jilbab & rok syar\'i.';
  doc.text(seragamDesc, startX + 4.5 + seragamLabelW, currentY2 + 4.0);

  // Baris 2: Skema Pembayaran
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(180, 83, 9);
  doc.text('* Skema Pembayaran:', startX + 3.0, currentY2 + 8.2);
  const skemaLabelW = doc.getTextWidth('* Skema Pembayaran:');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  const skemaDesc = 'Pilihan 1 Langsung Lunas saat daftar ulang, atau Pilihan 2 Bertahap (Tahap 1 min. Rp 3.500.000 saat daftar ulang, pelunasan sebelum KBM).';
  doc.text(skemaDesc, startX + 4.5 + skemaLabelW, currentY2 + 8.2);

  currentY2 += noteBoxHeight + 3.0;

  // F. REKENING RESMI & INFORMASI KONTAK
  currentY2 = drawSectionTitle(doc, 'F. REKENING RESMI & PUSAT INFORMASI KAMPUS', currentY2, startX, contentWidth);
  currentY2 += 3.2;

  // Box Rekening BSI
  const bankBoxHeight = 11.5;
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(16, 185, 129); // emerald-500
  doc.setLineWidth(0.3);
  doc.roundedRect(startX, currentY2, contentWidth, bankBoxHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor(6, 78, 59);
  doc.text('REKENING RESMI PEMBAYARAN FORMULIR & BIAYA AWAL MASUK (BAM):', startX + 3.5, currentY2 + 4.0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 118, 110);
  const bankAccNum = schoolInfo.bankAccountNumber || '3953157480';
  const bankAccName = schoolInfo.bankAccountName || 'Al-Hadiid';
  const bankName = schoolInfo.bankName || 'Bank Syariah Indonesia (BSI)';
  doc.text(
    `Bank: ${bankName}    •    No. Rekening: ${bankAccNum}    •    Atas Nama: ${bankAccName}`,
    startX + 3.5,
    currentY2 + 8.3
  );
  currentY2 += bankBoxHeight + 3.5;

  // Layout Bagian Bawah: Dua Kolom Sejajar (Kiri: Sekretariat & Kontak, Kanan: Pengesahan & Tanda Tangan)
  const bottomStartY = currentY2;
  const leftColWidth = 106;

  // Kotak Kiri: Informasi Sekretariat & Kontak
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.roundedRect(startX, bottomStartY, leftColWidth, 34, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text('SEKRETARIAT & PUSAT LAYANAN SPMB:', startX + 3.5, bottomStartY + 4.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.7);
  doc.setTextColor(71, 85, 105);

  const addressText = `Alamat: ${schoolInfo.address || 'Jl. Melati 1 Perumahan Cileungsi Indah, Cileungsi, Kab. Bogor 16820'}`;
  const splitAddress = doc.splitTextToSize(addressText, leftColWidth - 7);
  doc.text(splitAddress, startX + 3.5, bottomStartY + 8.2);

  let curInfoY = bottomStartY + 8.2 + splitAddress.length * 3.3;
  const phoneStr = schoolInfo.whatsapp || schoolInfo.phone || '0858-1499-8782';
  doc.text(`Hotline WhatsApp: ${phoneStr}`, startX + 3.5, curInfoY);
  curInfoY += 3.3;

  doc.text(`Email Resmi: ${schoolInfo.email || 'smpalhadiid@gmail.com'}`, startX + 3.5, curInfoY);
  curInfoY += 3.3;

  doc.text(`Website: ${schoolInfo.website || 'https://alhadiid.or.id/smp-alhadiid/'}`, startX + 3.5, curInfoY);
  curInfoY += 3.4;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.3);
  doc.setTextColor(100, 116, 139);
  doc.text('Pelayanan Sekretariat: Senin - Sabtu (08.00 - 15.00 WIB)', startX + 3.5, curInfoY);

  // Kolom Kanan: Pengesahan & Tanda Tangan Resmi (Sejajar dengan Sekretariat)
  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const rightColX = startX + leftColWidth + 5;
  const rightColWidth = contentWidth - leftColWidth - 5;

  drawOfficialSignature(doc, {
    x: rightColX,
    y: bottomStartY,
    title: 'Panitia SPMB & Kepala Sekolah,',
    subtitle: schoolInfo.name || 'SMPS AL-HADIID CILEUNGSI',
    personName: getKepalaSekolahName(schoolInfo),
    extraNote: schoolInfo.headmasterNiy ? `NIY. ${schoolInfo.headmasterNiy}` : 'KEPALA SEKOLAH',
    signatureWidth: rightColWidth,
    isRightAligned: false,
    dateCity: `Cileungsi, ${todayStr}`,
  });

  // Terapkan penomoran halaman otomatis resmi
  applyOfficialFooters(doc, {
    schoolInfo,
    orientation: 'portrait',
  });

  return doc;
}

/**
 * Menghasilkan URL Blob untuk pratinjau brosur di layar (in-app viewer)
 * Mendukung berkas gambar maupun PDF
 */
export function getBrochurePdfBlobUrl(
  schoolInfo: SchoolInfo,
  costBreakdowns: CostBreakdown[] = [],
  testSchedules: TestSchedule[] = []
): string {
  if (schoolInfo.brochureUrl && schoolInfo.brochureUrl.trim() !== '') {
    const url = schoolInfo.brochureUrl.trim();
    if (url.startsWith('data:')) {
      const blob = dataUrlToBlob(url);
      return URL.createObjectURL(blob);
    }
    return url;
  }
  const doc = generateBrosurSpmbPDF(schoolInfo, costBreakdowns, testSchedules);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}

/**
 * Fungsi Terpadu untuk Mengunduh Brosur SPMB:
 * 1. Jika sekolah memiliki brochureUrl terunggah (gambar atau PDF):
 *    - Konversi ke Blob & unduh dengan nama berkas berekstensi tepat (.jpg/.png/.pdf)
 * 2. Jika belum mengunggah berkas khusus:
 *    - Secara otomatis membuat dan mengunduh Brosur Resmi SPMB SMPS Al-Hadiid (PDF)
 */
export async function downloadBrochureFile(
  schoolInfo: SchoolInfo,
  costBreakdowns: CostBreakdown[] = [],
  testSchedules: TestSchedule[] = []
): Promise<{ success: boolean; message: string }> {
  const isImage = isImageBrochure(schoolInfo);
  const defaultExt = isImage ? '.jpg' : '.pdf';
  const academicYearClean = (schoolInfo.academicYear || '2027_2028').replace('/', '_');
  const baseName = `Brosur_Resmi_SPMB_SMP_AlHadiid_${academicYearClean}`;
  const rawFileName = schoolInfo.brochureFileName || `${baseName}${defaultExt}`;

  // Pastikan ekstensi sesuai dengan tipe berkas sebenarnya
  let fileName = rawFileName;
  if (isImage && !/\.(png|jpe?g|webp|gif)$/i.test(fileName)) {
    fileName = `${fileName.replace(/\.[^/.]+$/, '')}.jpg`;
  } else if (!isImage && !/\.pdf$/i.test(fileName)) {
    fileName = `${fileName.replace(/\.[^/.]+$/, '')}.pdf`;
  }

  try {
    // 1. Jika ada URL brosur terunggah
    if (schoolInfo.brochureUrl && schoolInfo.brochureUrl.trim() !== '') {
      const url = schoolInfo.brochureUrl.trim();

      // Kasus A: Data URL (base64 image atau PDF)
      if (url.startsWith('data:')) {
        const blob = dataUrlToBlob(url);
        triggerDirectBlobDownload(blob, fileName);
        return {
          success: true,
          message: `Brosur ${isImage ? 'gambar' : 'dokumen'} (${fileName}) berhasil diunduh.`,
        };
      }

      // Kasus B: Remote HTTP/HTTPS URL
      try {
        const response = await fetch(url, { mode: 'cors' });
        if (response.ok) {
          const blob = await response.blob();
          triggerDirectBlobDownload(blob, fileName);
          return {
            success: true,
            message: `Brosur ${isImage ? 'gambar' : 'dokumen'} (${fileName}) berhasil diunduh.`,
          };
        }
      } catch (fetchErr) {
        console.warn('[downloadBrochureFile] Fetch remote file gagal, fallback ke window anchor:', fetchErr);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          try {
            document.body.removeChild(a);
          } catch {}
        }, 1500);
        return { success: true, message: `Membuka berkas brosur (${fileName})` };
      }
    }

    // 2. Jika tidak ada file khusus terunggah, buat PDF Brosur Resmi SPMB secara dinamis
    const doc = generateBrosurSpmbPDF(schoolInfo, costBreakdowns, testSchedules);
    const blob = doc.output('blob');
    triggerDirectBlobDownload(blob, fileName);
    return { success: true, message: `Brosur Resmi SPMB (${fileName}) berhasil diunduh.` };
  } catch (error: any) {
    console.error('[downloadBrochureFile] Exception:', error);
    try {
      const doc = generateBrosurSpmbPDF(schoolInfo, costBreakdowns, testSchedules);
      doc.save(fileName);
      return { success: true, message: `Brosur Resmi SPMB (${fileName}) berhasil diunduh.` };
    } catch (innerErr: any) {
      return {
        success: false,
        message: `Gagal mengunduh brosur: ${innerErr?.message || 'Terjadi kesalahan sistem'}`,
      };
    }
  }
}
