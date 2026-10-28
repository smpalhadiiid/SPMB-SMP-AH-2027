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
/**
 * Menghasilkan Dokumen Brosur Resmi SPMB SMPS Al-Hadiid Cileungsi (2 Halaman Rapi, Presisi & Sejajar)
 * Didesain dengan kerapian tinggi, penulisan sejajar garis, dan tata letak tabel yang pas.
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
  const startX = layout.marginLeft; // 15mm
  const contentWidth = layout.contentWidth; // 180mm
  const endX = startX + contentWidth; // 195mm
  const academicYear = schoolInfo.academicYear || '2027/2028';

  // ===================================================================
  // HALAMAN 1: PROFIL, VISI MISI, PROGRAM UNGGULAN & FASILITAS
  // ===================================================================
  drawWatermark(doc, 'SMPS AL-HADIID');

  let currentY = drawOfficialHeader(doc, {
    schoolInfo,
    documentTitle: 'BROSUR INFORMASI PENERIMAAN MURID BARU (SPMB)',
    documentSubtitle: `TAHUN PELAJARAN ${academicYear} - KAMPUS ISLAMI BERKARAKTER & BERPRESTASI`,
    documentNumber: `BROSUR/SPMB/${academicYear.replace('/', '-')}`,
    orientation: 'portrait',
  });

  currentY += 2;

  // A. PROFIL & VISI MISI SEKOLAH
  currentY = drawSectionTitle(doc, 'A. PROFIL & VISI MISI SEKOLAH', currentY, startX, contentWidth);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(30, 41, 59);

  const profilText = `${schoolInfo.name || 'SMPS AL-HADIID CILEUNGSI'} adalah lembaga pendidikan Islam terpadu jenjang Sekolah Menengah Pertama yang berdedikasi membentuk generasi Robbani yang beraqidah lurus, berakhlak mulia sesuai manhaj salafush sholih, unggul dalam prestasi akademik, mandiri, serta menguasai ilmu pengetahuan dan teknologi. Kami memadukan Kurikulum Merdeka Nasional dengan kurikulum diniyyah kepesantrenan terpadu secara harmonis.`;
  const splitProfil = doc.splitTextToSize(profilText, contentWidth - 4);
  splitProfil.forEach((pLine: string) => {
    doc.text(pLine, startX + 2, currentY);
    currentY += 4.0;
  });
  currentY += 2;

  // Kotak Visi Sekolah (Rapi & Sejajar)
  const visiText = schoolInfo.tagline || 'Terwujudnya Murid yang memiliki Aqidah yang kuat, berakhlak mulia sesuai manhaj salafush sholih serta menguasai ilmu pengetahuan dan teknologi.';
  const splitVisi = doc.splitTextToSize(`"${visiText}"`, contentWidth - 14);
  const visiBoxH = Math.max(13.5, 6.5 + splitVisi.length * 3.8);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
  doc.setLineWidth(0.35);
  doc.roundedRect(startX, currentY, contentWidth, visiBoxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.0);
  doc.setTextColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
  doc.text('VISI SEKOLAH:', startX + 4, currentY + 4.8);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.6);
  doc.setTextColor(51, 65, 85);
  let vy = currentY + 9.0;
  splitVisi.forEach((vLine: string) => {
    doc.text(vLine, startX + 4, vy);
    vy += 3.8;
  });
  currentY += visiBoxH + 3.5;

  // B. 5 PROGRAM KEUNGGULAN UTAMA
  currentY = drawSectionTitle(doc, 'B. 5 PROGRAM UNGGULAN & NILAI LEBIH', currentY, startX, contentWidth);

  const programs = [
    {
      no: '1',
      title: 'Program Tahfidz & Diniyyah Al-Qur\'an',
      desc: 'Target hafalan mutqin minimal 3 Juz (Juz 28, 29, 30), bimbingan tahsin metode teruji, Dauroh Qur\'an intensif, serta sertifikasi tahfidz berkala bagi setiap murid.',
    },
    {
      no: '2',
      title: 'Kurikulum Merdeka Terpadu & Penguatan Karakter Adab',
      desc: 'Integrasi Kurikulum Nasional dengan pembiasaan adab Islam: sholat lima waktu berjamaah di masjid sekolah, sholat Dhuha, dzikir pagi-petang, dan mentoring kepemimpinan.',
    },
    {
      no: '3',
      title: 'Penguasaan Bahasa Asing Komunikatif (Arab & Inggris)',
      desc: 'Pembiasaan kosa kata harian (mufradat & vocabulary), Arabic & English Club, kegiatan muhadatsah rutin, serta bimbingan pidato dan lomba dwibahasa.',
    },
    {
      no: '4',
      title: 'Literasi Digital, Laboratorium Komputer & CBT Modern',
      desc: 'Pembelajaran praktikum komputer terstandar, pengenalan logika coding dasar, robotic club, dan implementasi Computer Based Test (CBT) mandiri untuk ujian sekolah.',
    },
    {
      no: '5',
      title: 'Ekstrakurikuler Minat Bakat Beragam & Berprestasi',
      desc: 'Pramuka SIT, Panahan Sunnah, Futsal Academy, Basket, Bulutangkis, Seni Hadroh/Marawis, PMR, Pasus, Sains Club, dan Jurnalistik Sekolah.',
    },
  ];

  programs.forEach((prog) => {
    // Badge Nomor Program (Sejajar & Rapi)
    doc.setFillColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
    doc.roundedRect(startX + 1, currentY - 2.8, 5.0, 4.2, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(255, 255, 255);
    doc.text(prog.no, startX + 3.5, currentY + 0.2, { align: 'center' });

    // Judul Program (Bold)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(PDF_THEME.colors.primaryDark[0], PDF_THEME.colors.primaryDark[1], PDF_THEME.colors.primaryDark[2]);
    doc.text(prog.title, startX + 8.5, currentY + 0.2);
    currentY += 3.8;

    // Deskripsi Program (Hanging Indent, Sejajar dengan teks judul)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const splitDesc = doc.splitTextToSize(prog.desc, contentWidth - 10);
    splitDesc.forEach((dLine: string) => {
      doc.text(dLine, startX + 8.5, currentY);
      currentY += 3.6;
    });
    currentY += 1.8;
  });

  currentY += 1.5;

  // C. FASILITAS PENDUKUNG PEMBELAJARAN (2 Kolom Sejajar Horizontal)
  currentY = drawSectionTitle(doc, 'C. FASILITAS PENDUKUNG PEMBELAJARAN KAMPUS', currentY, startX, contentWidth);

  const colFasWidth = (contentWidth - 4) / 2; // 88mm
  const fasilitasCol1 = [
    'Ruang Kelas Full AC & Proyektor Multimedia',
    'Laboratorium Komputer CBT Berkecepatan Tinggi',
    'Masjid Luas untuk Sholat Berjamaah & Tahfidz',
    'Laboratorium Praktik Sains (IPA Terpadu)',
  ];
  const fasilitasCol2 = [
    'Perpustakaan Lengkap & Pojok Baca Literasi',
    'Lapangan Olahraga: Futsal, Basket, Voli & Panahan',
    'Ruang UKS Medis & Bimbingan Konseling (BK)',
    'Kantin Halal & Sehat serta Area Parkir Terjaga',
  ];

  const fasRowH = 5.6;
  const fasGap = 1.6;

  for (let i = 0; i < 4; i++) {
    const rowY = currentY + i * (fasRowH + fasGap);

    // Box Kolom 1
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(startX, rowY, colFasWidth, fasRowH, 1, 1, 'FD');

    // Bullet Check Hijau Kolom 1
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(15, 118, 110);
    doc.text('✓', startX + 3, rowY + 3.8);

    // Teks Kolom 1
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(30, 41, 59);
    doc.text(fasilitasCol1[i], startX + 7.5, rowY + 3.8);

    // Box Kolom 2
    const x2 = startX + colFasWidth + 4;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x2, rowY, colFasWidth, fasRowH, 1, 1, 'FD');

    // Bullet Check Hijau Kolom 2
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 118, 110);
    doc.text('✓', x2 + 3, rowY + 3.8);

    // Teks Kolom 2
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(fasilitasCol2[i], x2 + 7.5, rowY + 3.8);
  }

  currentY += 4 * (fasRowH + fasGap) + 3;

  // Banner Bawah Halaman 1 (Transisi ke Halaman 2)
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(startX, currentY, contentWidth, 7.5, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);
  doc.setTextColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
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
    documentSubtitle: `PETUNJUK TEKNIS SPMB TP ${academicYear} - ALUR & BIAYA AWAL MASUK (BAM)`,
    orientation: 'portrait',
    compact: true,
  });

  currentY2 += 1.5;

  // D. ALUR 8 TAHAPAN PENDAFTARAN ONLINE (Tabel Baris Sejajar & Presisi)
  currentY2 = drawSectionTitle(doc, 'D. ALUR 8 TAHAP PENDAFTARAN ONLINE (SPMB)', currentY2, startX, contentWidth);

  const alurSteps = [
    { step: '1', title: 'Pembuatan Akun Mandiri', desc: 'Calon murid mendaftarkan username & password mandiri pada portal resmi SPMB.' },
    { step: '2', title: 'Pembayaran Formulir', desc: 'Melakukan pembayaran formulir Rp200.000 & upload bukti transfer ke portal.' },
    { step: '3', title: 'Pengisian Biodata Lengkap', desc: 'Melengkapi data diri siswa, data orang tua/wali, serta mengunggah berkas KK & Akta.' },
    { step: '4', title: 'Verifikasi & Cetak Kartu', desc: 'Panitia memverifikasi berkas pembayaran, murid mengunduh Kartu Peserta Ujian.' },
    { step: '5', title: 'Pelaksanaan Ujian CBT', desc: 'Mengikuti tes diagnostik, potensi akademik, membaca Al-Qur\'an & hafalan juz amma.' },
    { step: '6', title: 'Pengumuman Kelulusan', desc: 'Hasil seleksi diumumkan transparan melalui portal SPMB & pesan WhatsApp resmi.' },
    { step: '7', title: 'Daftar Ulang & Biaya BAM', desc: 'Calon murid yang dinyatakan lulus melakukan pembayaran Biaya Awal Masuk (BAM).' },
    { step: '8', title: 'Penetapan Kelas 7 (Rombel)', desc: 'Verifikasi pembayaran BAM selesai dan murid resmi ditempatkan di rombel kelas 7.' },
  ];

  // Header Baris Alur
  const stepColNo = 10;
  const stepColTitle = 48;
  const stepColDesc = contentWidth - stepColNo - stepColTitle; // 122mm

  alurSteps.forEach((item, sIdx) => {
    const isZebra = sIdx % 2 === 1;
    const splitDesc = doc.splitTextToSize(item.desc, stepColDesc - 4);
    const rowH = Math.max(5.0, splitDesc.length * 3.4 + 1.6);

    // Background Zebra
    if (isZebra) {
      doc.setFillColor(248, 250, 252);
      doc.rect(startX, currentY2, contentWidth, rowH, 'F');
    }

    // Border bawah tipis
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    doc.line(startX, currentY2 + rowH, endX, currentY2 + rowH);

    // Border samping
    doc.line(startX, currentY2, startX, currentY2 + rowH);
    doc.line(endX, currentY2, endX, currentY2 + rowH);

    // Lingkaran penomoran (Presisi di tengah kolom No)
    const centerY = currentY2 + rowH / 2;
    doc.setFillColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
    doc.circle(startX + stepColNo / 2, centerY, 2.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);
    doc.text(item.step, startX + stepColNo / 2, centerY + 0.8, { align: 'center' });

    // Judul Tahap (Bold, sejajar rapi)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.3);
    doc.setTextColor(15, 23, 42);
    doc.text(`${item.step}. ${item.title}:`, startX + stepColNo + 1, currentY2 + 3.4);

    // Deskripsi Tahap (Normal, sejajar pada kolom penjelasan)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.0);
    doc.setTextColor(71, 85, 105);
    let dy = currentY2 + 3.4;
    splitDesc.forEach((dLine: string) => {
      doc.text(dLine, startX + stepColNo + stepColTitle + 2, dy);
      dy += 3.3;
    });

    currentY2 += rowH;
  });

  currentY2 += 2.0;

  // E. RINCIAN BIAYA AWAL MASUK (BAM) & KETENTUAN PEMBAYARAN
  currentY2 = drawSectionTitle(doc, 'E. BIAYA FORMULIR & RINCIAN BIAYA AWAL MASUK (BAM)', currentY2, startX, contentWidth);

  // Box Highlight Ringkasan Biaya Utama (4 Kotak Simetris Sejajar)
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.3);
  doc.roundedRect(startX, currentY2, contentWidth, 10.0, 1.5, 1.5, 'FD');

  const cardCol = contentWidth / 4; // 45mm
  // Box 1: Formulir
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text('FORMULIR PENDAFTARAN', startX + cardCol * 0.5, currentY2 + 3.4, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.4);
  doc.setTextColor(15, 118, 110);
  doc.text(`Rp ${(schoolInfo.formFee || 200000).toLocaleString('id-ID')}`, startX + cardCol * 0.5, currentY2 + 7.6, { align: 'center' });

  // Divider 1
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(startX + cardCol, currentY2 + 1.5, startX + cardCol, currentY2 + 8.5);

  // Box 2: BAM Ikhwan (Putra)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text('TOTAL BAM IKHWAN (PUTRA)', startX + cardCol * 1.5, currentY2 + 3.4, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.4);
  doc.setTextColor(15, 118, 110);
  doc.text('Rp 6.670.000', startX + cardCol * 1.5, currentY2 + 7.6, { align: 'center' });

  // Divider 2
  doc.line(startX + cardCol * 2, currentY2 + 1.5, startX + cardCol * 2, currentY2 + 8.5);

  // Box 3: BAM Akhwat (Putri)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text('TOTAL BAM AKHWAT (PUTRI)', startX + cardCol * 2.5, currentY2 + 3.4, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.4);
  doc.setTextColor(190, 24, 93);
  doc.text('Rp 6.890.000', startX + cardCol * 2.5, currentY2 + 7.6, { align: 'center' });

  // Divider 3
  doc.line(startX + cardCol * 3, currentY2 + 1.5, startX + cardCol * 3, currentY2 + 8.5);

  // Box 4: SPP Bulanan
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text('SPP / DPP BULANAN', startX + cardCol * 3.5, currentY2 + 3.4, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.4);
  doc.setTextColor(15, 118, 110);
  doc.text('Rp 425.000 / bln', startX + cardCol * 3.5, currentY2 + 7.6, { align: 'center' });

  currentY2 += 11.5;

  // TABEL 13 KOMPONEN BAM (Proporsi & Penulisan Sejajar Kolom 100%)
  // Definisi Kolom: No(10mm), Nama(84mm), Ikhwan(30mm), Akhwat(30mm), Keterangan(26mm) = Total 180mm
  const colNoW = 10;
  const colNamaW = 84;
  const colIkhwanW = 30;
  const colAkhwatW = 30;
  const colKetW = 26;

  const xNo = startX;
  const xNama = xNo + colNoW; // startX + 10
  const xIkhwan = xNama + colNamaW; // startX + 94
  const xAkhwat = xIkhwan + colIkhwanW; // startX + 124
  const xKet = xAkhwat + colAkhwatW; // startX + 154
  const xTableEnd = xKet + colKetW; // startX + 180 = endX

  // Header Tabel
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(startX, currentY2, contentWidth, 4.5, 'F');
  doc.setTextColor(255, 255, 255);

  doc.text('NO', xNo + colNoW / 2, currentY2 + 3.2, { align: 'center' });
  doc.text('JENIS KEUANGAN / KOMPONEN PEMBIAYAAN', xNama + 2.5, currentY2 + 3.2);
  doc.text('BIAYA IKHWAN', xIkhwan + colIkhwanW - 2.5, currentY2 + 3.2, { align: 'right' });
  doc.text('BIAYA AKHWAT', xAkhwat + colAkhwatW - 2.5, currentY2 + 3.2, { align: 'right' });
  doc.text('KETERANGAN', xKet + colKetW / 2, currentY2 + 3.2, { align: 'center' });
  currentY2 += 4.5;

  // 13 Komponen BAM Sesuai SK Resmi & Landing Page
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

  doc.setFontSize(6.5);
  const tableRowH = 3.9;

  bamItems.forEach((row, idx) => {
    const isZebra = idx % 2 === 1;

    // Fill background
    if (row.isHighlight) {
      doc.setFillColor(254, 243, 199); // amber-100 highlight
      doc.rect(startX, currentY2, contentWidth, tableRowH, 'F');
    } else if (isZebra) {
      doc.setFillColor(248, 250, 252);
      doc.rect(startX, currentY2, contentWidth, tableRowH, 'F');
    }

    // Border bawah dan samping
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    doc.line(startX, currentY2 + tableRowH, xTableEnd, currentY2 + tableRowH);
    doc.line(startX, currentY2, startX, currentY2 + tableRowH);
    doc.line(xTableEnd, currentY2, xTableEnd, currentY2 + tableRowH);

    // Text cell NO (Center)
    doc.setFont('helvetica', row.isHighlight ? 'bold' : 'normal');
    doc.setTextColor(row.isHighlight ? 120 : 15, row.isHighlight ? 53 : 23, row.isHighlight ? 15 : 42);
    doc.text(String(row.no), xNo + colNoW / 2, currentY2 + 2.7, { align: 'center' });

    // Text cell Nama Komponen (Left)
    doc.text(row.name, xNama + 2.5, currentY2 + 2.7);

    // Text cell Biaya Ikhwan (Right-aligned presisi)
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 118, 110);
    doc.text(row.ikhwan, xIkhwan + colIkhwanW - 2.5, currentY2 + 2.7, { align: 'right' });

    // Text cell Biaya Akhwat (Right-aligned presisi)
    doc.text(row.akhwat, xAkhwat + colAkhwatW - 2.5, currentY2 + 2.7, { align: 'right' });

    // Text cell Keterangan (Center presisi)
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(row.ket, xKet + colKetW / 2, currentY2 + 2.7, { align: 'center' });

    currentY2 += tableRowH;
  });

  // Baris Total BAM (Highlight Hijau Tua & Kuning Emas)
  const totalH = 4.8;
  doc.setFillColor(6, 78, 59); // emerald-900
  doc.rect(startX, currentY2, contentWidth, totalH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL BIAYA AWAL MASUK (BAM):', xNama + 2.5, currentY2 + 3.4);

  doc.setTextColor(253, 224, 71); // yellow-300
  doc.text('Rp 6.670.000', xIkhwan + colIkhwanW - 2.5, currentY2 + 3.4, { align: 'right' });
  doc.text('Rp 6.890.000', xAkhwat + colAkhwatW - 2.5, currentY2 + 3.4, { align: 'right' });

  doc.setTextColor(209, 250, 229);
  doc.setFontSize(6.5);
  doc.text('Awal Masuk', xKet + colKetW / 2, currentY2 + 3.4, { align: 'center' });
  currentY2 += totalH + 2.5;

  // Kotak Catatan Seragam & Skema Cicilan (Rapi & Sejajar)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(startX, currentY2, contentWidth, 11.5, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.7);
  doc.setTextColor(15, 118, 110);
  doc.text('*Paket Seragam:', startX + 3.0, currentY2 + 3.8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Meliputi 4 stel lengkap (Putih Biru, Biru Tosca, Pramuka, dan Olahraga). Siswi Akhwat mendapatkan jilbab & rok syar\'i.', startX + 28, currentY2 + 3.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.7);
  doc.setTextColor(15, 118, 110);
  doc.text('*Skema Bayar:', startX + 3.0, currentY2 + 7.8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Pilihan 1 Lunas saat daftar ulang, atau Pilihan 2 Angsuran (DP min. Rp 4.000.000 saat daftar ulang, pelunasan s/d 30 Oktober).', startX + 28, currentY2 + 7.8);
  currentY2 += 14.0;

  // F. REKENING RESMI & INFORMASI KONTAK
  currentY2 = drawSectionTitle(doc, 'F. REKENING RESMI & PUSAT INFORMASI KAMPUS', currentY2, startX, contentWidth);

  // Box Rekening BSI Resmi
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.3);
  doc.roundedRect(startX, currentY2, contentWidth, 9.5, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(6, 78, 59);
  doc.text('REKENING RESMI PEMBAYARAN FORMULIR & BIAYA AWAL MASUK (BAM):', startX + 3.5, currentY2 + 3.6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.0);
  doc.setTextColor(4, 120, 87);
  const bankAccNum = schoolInfo.bankAccountNumber || '3953157480';
  const bankAccName = schoolInfo.bankAccountName || 'Al-Hadiid';
  const bankName = schoolInfo.bankName || 'Bank Syariah Indonesia (BSI)';
  doc.text(
    `Bank: ${bankName}   •   No. Rekening: ${bankAccNum}   •   Atas Nama: ${bankAccName}   •   Kode Bank: 451`,
    startX + 3.5,
    currentY2 + 7.4
  );
  currentY2 += 12.0;

  // 2-KOLOM SEJAJAR: SEKRETARIAT DI KIRI & PENGESAHAN KEPSEK DI KANAN
  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Sisi Kiri: Kontak Sekretariat
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.3);
  doc.setTextColor(15, 23, 42);
  doc.text('Sekretariat Panitia SPMB SMPS Al-Hadiid Cileungsi:', startX + 1, currentY2 + 3.0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.7);
  doc.setTextColor(71, 85, 105);
  const addrText = `• Alamat: ${schoolInfo.address || 'Jl. Melati 1 Perumahan Cileungsi Indah, Cileungsi, Kab. Bogor 16820'}`;
  const splitAddr = doc.splitTextToSize(addrText, 108);
  let cY = currentY2 + 6.8;
  splitAddr.forEach((aLine: string) => {
    doc.text(aLine, startX + 1, cY);
    cY += 3.3;
  });
  doc.text(`• Hotline WA / Telp: ${schoolInfo.whatsapp || schoolInfo.phone || '085814998782'}  |  Email: ${schoolInfo.email || 'smpalhadiid@gmail.com'}`, startX + 1, cY);
  cY += 3.3;
  doc.text(`• Portal SPMB Online: ${schoolInfo.website || 'https://alhadiid.or.id/smp-alhadiid/'}`, startX + 1, cY);

  // Sisi Kanan: Pengesahan Resmi (Sejajar dengan Sekretariat)
  drawOfficialSignature(doc, {
    x: startX + contentWidth - 65,
    y: currentY2,
    title: 'Panitia SPMB & Kepala Sekolah,',
    subtitle: schoolInfo.name || 'SMPS AL-HADIID CILEUNGSI',
    personName: getKepalaSekolahName(schoolInfo),
    extraNote: schoolInfo.headmasterNiy ? `NIY. ${schoolInfo.headmasterNiy}` : 'KEPALA SEKOLAH',
    signatureWidth: 65,
    isRightAligned: true,
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
 * Periksa apakah admin telah mengunggah brosur berformat gambar (PNG, JPG, WEBP)
 */
export function hasAdminBrochureImage(schoolInfo?: Partial<SchoolInfo> | null): boolean {
  if (!schoolInfo) return false;
  return isImageBrochure(schoolInfo) && Boolean(schoolInfo.brochureUrl && schoolInfo.brochureUrl.trim() !== '');
}

/**
 * Generate fallback visual brochure graphic as a high-res image (JPEG) via Canvas
 * Dipakai saat admin belum mengunggah brosur gambar tersendiri
 */
function generateFallbackBrosurCanvasBlob(
  schoolInfo: SchoolInfo,
  _costBreakdowns: CostBreakdown[] = [],
  _testSchedules: TestSchedule[] = []
): Promise<Blob> {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas 2D context not available');
      }

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1200, 1920);

      // Header Gradient
      const grad = ctx.createLinearGradient(0, 0, 1200, 0);
      grad.addColorStop(0, '#064e3b');
      grad.addColorStop(0.5, '#047857');
      grad.addColorStop(1, '#0f766e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1200, 230);

      // Header text
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 20px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('YAYASAN PENDIDIKAN ISLAM AL-HADIID CILEUNGSI', 600, 48);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 34px Arial, sans-serif';
      ctx.fillText(schoolInfo.name || 'SMPS AL-HADIID CILEUNGSI', 600, 92);

      ctx.font = 'normal 17px Arial, sans-serif';
      ctx.fillStyle = '#d1fae5';
      ctx.fillText(schoolInfo.address || 'Jl. Melati 1 Perumahan Cileungsi Indah, Cileungsi, Kab. Bogor 16820', 600, 126);
      ctx.fillText(`Telp/WA: ${schoolInfo.whatsapp || schoolInfo.phone || '085814998782'} | Website: ${schoolInfo.website || 'https://alhadiid.or.id/smp-alhadiid/'}`, 600, 154);

      // Subheader banner
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(100, 175, 1000, 38);
      ctx.fillStyle = '#064e3b';
      ctx.font = 'bold 19px Arial, sans-serif';
      ctx.fillText(`BROSUR RESMI SPMB TP ${schoolInfo.academicYear || '2027/2028'}`, 600, 201);

      // Visi & Profil Section
      ctx.textAlign = 'left';
      ctx.fillStyle = '#047857';
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.fillText('A. PROFIL & 5 PROGRAM UNGGULAN SEKOLAH', 80, 280);

      ctx.fillStyle = '#334155';
      ctx.font = 'normal 17px Arial, sans-serif';
      ctx.fillText("1. Program Tahfidz Al-Qur'an Mutqin Minimal 3 Juz (Juz 28, 29, 30) & Dauroh Quran", 90, 315);
      ctx.fillText('2. Kurikulum Merdeka Terpadu & Pembiasaan Adab Salafush Sholih', 90, 348);
      ctx.fillText('3. Penguatan Bahasa Asing Komunikatif (Bahasa Arab & Inggris)', 90, 381);
      ctx.fillText('4. Literasi Digital, Laboratorium Komputer Modern & Ujian Mandiri CBT', 90, 414);
      ctx.fillText('5. Pembinaan Karakter Kepemimpinan, Sains, & Ekstrakurikuler Berprestasi', 90, 447);

      // BAM Box
      const bamBoxY = 485;
      const bamBoxH = 650;
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(80, bamBoxY, 1040, bamBoxH, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#064e3b';
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.fillText('B. TABEL 13 RINCIAN BIAYA AWAL MASUK (BAM)', 105, bamBoxY + 38);

      // Table header
      ctx.fillStyle = '#047857';
      ctx.fillRect(105, bamBoxY + 55, 990, 38);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Arial, sans-serif';
      ctx.fillText('JENIS KEUANGAN / KOMPONEN PEMBIAYAAN', 125, bamBoxY + 80);
      ctx.fillText('BIAYA IKHWAN', 640, bamBoxY + 80);
      ctx.fillText('BIAYA AKHWAT', 870, bamBoxY + 80);

      const bamRows = [
        ['1. Dana Awal Pendidikan (DAP)', 'Rp 4.250.000', 'Rp 4.250.000'],
        ['2. Dana Praktik Komputer', 'Rp 150.000', 'Rp 150.000'],
        ['3. Dana Praktik IPA', 'Rp 100.000', 'Rp 100.000'],
        ['4. Perlengkapan / Seragam (Paket 4 Stel)*', 'Rp 700.000', 'Rp 920.000'],
        ['5. Dana Penyelenggaraan Pendidikan (DPP / SPP)', 'Rp 425.000', 'Rp 425.000'],
        ['6. Tabungan Wajib', 'Rp 25.000', 'Rp 25.000'],
        ['7. MPLS / Masa Pengenalan Lingkungan Sekolah', 'Rp 100.000', 'Rp 100.000'],
        ['8. Dana Sosial', 'Rp 25.000', 'Rp 25.000'],
        ['9. Penilaian Akhir Semester (PAS)', 'Rp 220.000', 'Rp 220.000'],
        ['10. Penilaian Akhir Tahun (PAT)', 'Rp 225.000', 'Rp 225.000'],
        ['11. Kegiatan Ekstrakurikuler / AMBAP', 'Rp 125.000', 'Rp 125.000'],
        ['12. Biaya Dauroh (Kegiatan Pesantren / Tarbawi)', 'Rp 120.000', 'Rp 120.000'],
        ['13. Biaya Cetak (Raport, Foto, Name Tag, Kalender)', 'Rp 205.000', 'Rp 205.000'],
      ];

      let rowY = bamBoxY + 120;
      ctx.font = 'normal 15px Arial, sans-serif';
      ctx.fillStyle = '#1e293b';
      bamRows.forEach((row, i) => {
        if (i % 2 === 1) {
          ctx.fillStyle = '#f1f5f9';
          ctx.fillRect(105, rowY - 20, 990, 28);
        } else if (i === 3) {
          ctx.fillStyle = '#fef3c7'; // amber highlight seragam
          ctx.fillRect(105, rowY - 20, 990, 28);
        }
        ctx.fillStyle = i === 3 ? '#92400e' : '#1e293b';
        ctx.fillText(row[0], 125, rowY);
        ctx.fillText(row[1], 640, rowY);
        ctx.fillText(row[2], 870, rowY);
        rowY += 31;
      });

      // Total row
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(105, rowY - 12, 990, 42);
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 18px Arial, sans-serif';
      ctx.fillText('TOTAL BIAYA AWAL MASUK (BAM)', 125, rowY + 16);
      ctx.fillText('Rp 6.670.000', 640, rowY + 16);
      ctx.fillText('Rp 6.890.000', 870, rowY + 16);

      // Section C: Bank & Registration
      const secCY = 1175;
      ctx.fillStyle = '#064e3b';
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.fillText('C. ALUR 8 TAHAP PENDAFTARAN & REKENING RESMI', 80, secCY);

      ctx.fillStyle = '#1e293b';
      ctx.font = 'normal 16px Arial, sans-serif';
      ctx.fillText('1. Pendaftaran Akun Online mandiri melalui website resmi: ' + (schoolInfo.website || 'https://alhadiid.or.id/smp-alhadiid/'), 90, secCY + 36);
      ctx.fillText(`2. Pembayaran biaya formulir Rp ${(schoolInfo.formFee || 200000).toLocaleString('id-ID')} ke rekening resmi panitia sekolah:`, 90, secCY + 68);
      ctx.fillText(`   Bank: ${schoolInfo.bankName || 'BSI'} | No. Rekening: ${schoolInfo.bankAccountNumber || '3953157480'} a.n. ${schoolInfo.bankAccountName || 'Al-Hadiid'}`, 90, secCY + 98);
      ctx.fillText('3. Pengisian formulir online lengkap & unggah berkas (Akta Kelahiran, Kartu Keluarga).', 90, secCY + 130);
      ctx.fillText('4. Verifikasi berkas oleh admin & unduh Kartu Peserta Ujian CBT.', 90, secCY + 162);
      ctx.fillText('5. Pelaksanaan Ujian CBT: Diagnostik, Potensi Akademik, Membaca Al-Qur\'an & Hafalan Juz Amma.', 90, secCY + 194);
      ctx.fillText('6. Pengumuman Kelulusan resmi via portal & WhatsApp.', 90, secCY + 226);
      ctx.fillText('7. Daftar ulang & Pembayaran Biaya Awal Masuk (BAM) - dapat lunas atau diangsur.', 90, secCY + 258);
      ctx.fillText('8. Verifikasi BAM dan penempatan di rombongan belajar (Rombel) Kelas 7.', 90, secCY + 290);

      // Footer
      ctx.fillStyle = '#047857';
      ctx.fillRect(0, 1840, 1200, 80);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 17px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`PANITIA SPMB ${schoolInfo.name || 'SMPS AL-HADIID CILEUNGSI'} - HOTLINE WA: ${schoolInfo.whatsapp || '085814998782'}`, 600, 1888);

      canvas.toBlob((b) => {
        if (b) resolve(b);
        else resolve(new Blob([], { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.92);
    } catch {
      resolve(new Blob([], { type: 'image/jpeg' }));
    }
  });
}

/**
 * Mengunduh berkas brosur dalam format GAMBAR (JPG / PNG):
 * - Prioritas Utama: Mengunduh langsung berkas gambar yang diunggah oleh admin (schoolInfo.brochureUrl).
 * - Menjaga resolusi asli, tipe biner, dan nama berkas yang diunggah admin.
 * - Fallback: Jika admin belum mengunggah gambar, sistem mengenerate brosur format gambar beresolusi tinggi.
 */
export async function downloadBrochureImage(
  schoolInfo: SchoolInfo,
  costBreakdowns: CostBreakdown[] = [],
  testSchedules: TestSchedule[] = []
): Promise<{ success: boolean; message: string; fromAdminUpload: boolean; fileName: string }> {
  const academicYearClean = (schoolInfo.academicYear || '2027_2028').replace('/', '_');
  const baseName = `Brosur_Resmi_SPMB_SMP_AlHadiid_${academicYearClean}`;
  const isImage = isImageBrochure(schoolInfo);
  const rawFileName = schoolInfo.brochureFileName || `${baseName}.jpg`;

  let fileName = rawFileName;
  if (!/\.(png|jpe?g|webp|gif)$/i.test(fileName)) {
    fileName = `${fileName.replace(/\.[^/.]+$/, '')}.jpg`;
  }

  try {
    // 1. Prioritas Utama: Berkas gambar yang diunggah oleh admin
    if (isImage && schoolInfo.brochureUrl && schoolInfo.brochureUrl.trim() !== '') {
      const url = schoolInfo.brochureUrl.trim();

      // Data URL (base64 image dari unggahan admin)
      if (url.startsWith('data:image/')) {
        const blob = dataUrlToBlob(url);
        triggerDirectBlobDownload(blob, fileName);
        return {
          success: true,
          message: `Brosur gambar resmi (${fileName}) berhasil diunduh dari berkas unggahan admin.`,
          fromAdminUpload: true,
          fileName,
        };
      }

      // Remote HTTP/HTTPS URL
      try {
        const response = await fetch(url, { mode: 'cors' });
        if (response.ok) {
          const blob = await response.blob();
          triggerDirectBlobDownload(blob, fileName);
          return {
            success: true,
            message: `Brosur gambar resmi (${fileName}) berhasil diunduh dari berkas unggahan admin.`,
            fromAdminUpload: true,
            fileName,
          };
        }
      } catch (fetchErr) {
        console.warn('[downloadBrochureImage] Fetch remote image error, fallback anchor:', fetchErr);
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
        return {
          success: true,
          message: `Mengunduh brosur gambar (${fileName})`,
          fromAdminUpload: true,
          fileName,
        };
      }
    }

    // 2. Fallback jika admin belum mengunggah berkas gambar:
    // Generate gambar brosur resmi berkualitas tinggi secara dinamis
    const canvasBlob = await generateFallbackBrosurCanvasBlob(schoolInfo, costBreakdowns, testSchedules);
    const fallbackFileName = `${baseName}.jpg`;
    triggerDirectBlobDownload(canvasBlob, fallbackFileName);
    return {
      success: true,
      message: `Brosur gambar SPMB (${fallbackFileName}) berhasil diunduh.`,
      fromAdminUpload: false,
      fileName: fallbackFileName,
    };
  } catch (error: any) {
    console.error('[downloadBrochureImage] Error:', error);
    return {
      success: false,
      message: `Gagal mengunduh gambar brosur: ${error?.message || 'Terjadi kesalahan sistem'}`,
      fromAdminUpload: false,
      fileName,
    };
  }
}

/**
 * Mengunduh berkas brosur dalam format PDF:
 * - Jika admin mengunggah file PDF, mengunduh PDF dari admin.
 * - Jika tidak, menghasilkan PDF 2 halaman resmi SPMB secara dinamis.
 */
export async function downloadBrochurePdf(
  schoolInfo: SchoolInfo,
  costBreakdowns: CostBreakdown[] = [],
  testSchedules: TestSchedule[] = []
): Promise<{ success: boolean; message: string; fileName: string }> {
  const academicYearClean = (schoolInfo.academicYear || '2027_2028').replace('/', '_');
  const defaultPdfName = `Brosur_Resmi_SPMB_SMP_AlHadiid_${academicYearClean}.pdf`;
  const fileName = (!isImageBrochure(schoolInfo) && schoolInfo.brochureFileName)
    ? (schoolInfo.brochureFileName.endsWith('.pdf') ? schoolInfo.brochureFileName : `${schoolInfo.brochureFileName}.pdf`)
    : defaultPdfName;

  try {
    // Jika ada PDF terunggah oleh admin
    if (schoolInfo.brochureUrl && !isImageBrochure(schoolInfo)) {
      const url = schoolInfo.brochureUrl.trim();
      if (url.startsWith('data:')) {
        const blob = dataUrlToBlob(url);
        triggerDirectBlobDownload(blob, fileName);
        return {
          success: true,
          message: `Brosur PDF (${fileName}) berhasil diunduh.`,
          fileName,
        };
      }
    }

    // Generate PDF Resmi SPMB (2 Halaman)
    const doc = generateBrosurSpmbPDF(schoolInfo, costBreakdowns, testSchedules);
    const blob = doc.output('blob');
    triggerDirectBlobDownload(blob, fileName);
    return {
      success: true,
      message: `Brosur PDF Resmi SPMB (${fileName}) berhasil diunduh.`,
      fileName,
    };
  } catch (error: any) {
    console.error('[downloadBrochurePdf] Error:', error);
    return {
      success: false,
      message: `Gagal mengunduh brosur PDF: ${error?.message || 'Terjadi kesalahan'}`,
      fileName,
    };
  }
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
  if (isImage) {
    const res = await downloadBrochureImage(schoolInfo, costBreakdowns, testSchedules);
    return { success: res.success, message: res.message };
  } else {
    const res = await downloadBrochurePdf(schoolInfo, costBreakdowns, testSchedules);
    return { success: res.success, message: res.message };
  }
}

