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
 * Trigger pengunduhan Blob langsung secara aman di semua browser & iFrame
 */
function triggerDirectBlobDownload(blob: Blob, fileName: string, fallbackDataUrl?: string) {
  try {
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = fileName;
    a.setAttribute('download', fileName);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      } catch {}
    }, 4000);
  } catch (err) {
    if (fallbackDataUrl) {
      try {
        const a = document.createElement('a');
        a.href = fallbackDataUrl;
        a.download = fileName;
        a.setAttribute('download', fileName);
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          try { document.body.removeChild(a); } catch {}
        }, 3000);
      } catch {}
    }
  }
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

  const profilText = `${schoolInfo.name || 'SMPS AL-HADIID CILEUNGSI'} adalah lembaga pendidikan Islam terpadu jenjang Sekolah Menengah Pertama yang berdedikasi membentuk generasi Robbani yang beraqidah lurus, berakhlak mulia sesuai manhaj salafush sholih, unggul dalam prestasi akademik, mandiri, serta menguasai ilmu pengetahuan dan teknologi. Kami memadukan Kurikulum Merdeka Nasional dengan kurikulum diniyyah kepesantrenan terpadu.`;
  const splitProfil = doc.splitTextToSize(profilText, contentWidth - 4);
  doc.text(splitProfil, startX + 2, currentY);
  currentY += splitProfil.length * 4.0 + 2.5;

  // Kotak Visi & Nilai Utama
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
  doc.setLineWidth(0.35);
  doc.roundedRect(startX + 1, currentY, contentWidth - 2, 13.5, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
  doc.text('VISI SEKOLAH:', startX + 4, currentY + 4.5);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.6);
  doc.setTextColor(51, 65, 85);
  const visiText = schoolInfo.tagline || 'Terwujudnya Murid yang memiliki Aqidah yang kuat, berakhlak mulia sesuai manhaj salafush sholih serta menguasai ilmu pengetahuan dan teknologi.';
  const splitVisi = doc.splitTextToSize(`"${visiText}"`, contentWidth - 10);
  doc.text(splitVisi, startX + 4, currentY + 8.5);
  currentY += 16.5;

  // B. 5 PROGRAM KEUNGGULAN UTAMA
  currentY = drawSectionTitle(doc, 'B. 5 PROGRAM UNGGULAN & NILAI LEBIH', currentY, startX, contentWidth);

  const programs = [
    {
      title: '1. Program Tahfidz & Diniyyah Al-Qur\'an',
      desc: 'Target hafalan mutqin minimal 3 Juz (Juz 28, 29, 30), bimbingan tahsin metode teruji, Dauroh Qur\'an intensif, serta sertifikasi tahfidz berkala bagi setiap murid.',
    },
    {
      title: '2. Kurikulum Merdeka Terpadu & Penguatan Karakter Adab',
      desc: 'Integrasi Kurikulum Nasional dengan pembiasaan adab Islam: sholat lima waktu berjamaah di masjid sekolah, sholat Dhuha, dzikir pagi-petang, dan mentoring kepemimpinan.',
    },
    {
      title: '3. Penguasaan Bahasa Asing Komunikatif (Arab & Inggris)',
      desc: 'Pembiasaan kosa kata harian (mufradat & vocabulary), Arabic & English Club, kegiatan muhadatsah rutin, serta bimbingan pidato dan lomba dwibahasa.',
    },
    {
      title: '4. Literasi Digital, Laboratorium Komputer & CBT Modern',
      desc: 'Pembelajaran praktikum komputer terstandar, pengenalan logika coding dasar, robotic club, dan implementasi Computer Based Test (CBT) mandiri untuk ujian sekolah.',
    },
    {
      title: '5. Ekstrakurikuler Minat Bakat Beragam & Berprestasi',
      desc: 'Pramuka SIT, Panahan Sunnah, Futsal Academy, Basket, Bulutangkis, Seni Hadroh/Marawis, PMR, Pasus, Sains Club, dan Jurnalistik Sekolah.',
    },
  ];

  programs.forEach((prog) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(PDF_THEME.colors.primaryDark[0], PDF_THEME.colors.primaryDark[1], PDF_THEME.colors.primaryDark[2]);
    doc.text(prog.title, startX + 2, currentY);
    currentY += 3.6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const splitDesc = doc.splitTextToSize(prog.desc, contentWidth - 8);
    doc.text(splitDesc, startX + 6, currentY);
    currentY += splitDesc.length * 3.6 + 2.0;
  });

  currentY += 1.5;

  // C. FASILITAS PENDUKUNG PEMBELAJARAN
  currentY = drawSectionTitle(doc, 'C. FASILITAS PENDUKUNG PEMBELAJARAN KAMPUS', currentY, startX, contentWidth);

  const colWidth = (contentWidth - 6) / 2;
  const fasilitasCol1 = [
    '• Ruang Kelas Full AC & Proyektor Multimedia',
    '• Laboratorium Komputer CBT Berkecepatan Tinggi',
    '• Masjid Luas untuk Sholat Berjamaah & Tahfidz',
    '• Laboratorium Praktik Sains (IPA Terpadu)',
  ];
  const fasilitasCol2 = [
    '• Perpustakaan Lengkap & Pojok Baca Literasi',
    '• Lapangan Olahraga: Futsal, Basket, Voli & Panahan',
    '• Ruang UKS Medis & Bimbingan Konseling (BK)',
    '• Kantin Halal & Sehat serta Area Parkir Terjaga',
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(30, 41, 59);

  let tempY1 = currentY;
  fasilitasCol1.forEach((f) => {
    doc.text(f, startX + 2, tempY1);
    tempY1 += 4.2;
  });

  let tempY2 = currentY;
  fasilitasCol2.forEach((f) => {
    doc.text(f, startX + colWidth + 4, tempY2);
    tempY2 += 4.2;
  });

  currentY = Math.max(tempY1, tempY2) + 3;

  // Banner Bawah Hal 1 (Transisi ke Hal 2)
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

  // D. ALUR 8 TAHAPAN PENDAFTARAN ONLINE
  currentY2 = drawSectionTitle(doc, 'D. ALUR 8 TAHAP PENDAFTARAN ONLINE (SPMB)', currentY2, startX, contentWidth);

  const alurSteps = [
    { step: '1', title: 'Pembuatan Akun Mandiri:', desc: 'Calon murid mendaftarkan username & password mandiri pada portal resmi SPMB.' },
    { step: '2', title: 'Pembayaran Formulir:', desc: 'Melakukan pembayaran formulir Rp200.000 & upload bukti transfer ke portal.' },
    { step: '3', title: 'Pengisian Biodata:', desc: 'Melengkapi data diri siswa, data orang tua/wali, serta mengunggah berkas KK & Akta.' },
    { step: '4', title: 'Verifikasi & Cetak Kartu:', desc: 'Panitia memverifikasi data dan bukti transfer, murid mengunduh Kartu Peserta Ujian.' },
    { step: '5', title: 'Pelaksanaan Ujian CBT:', desc: 'Mengikuti tes diagnostik, potensi akademik, membaca Al-Qur\'an & hafalan juz amma.' },
    { step: '6', title: 'Pengumuman Kelulusan:', desc: 'Hasil seleksi diumumkan secara transparan melalui portal SPMB & pesan WhatsApp resmi.' },
    { step: '7', title: 'Daftar Ulang & Biaya BAM:', desc: 'Calon murid yang dinyatakan lulus melakukan pembayaran Biaya Awal Masuk (BAM).' },
    { step: '8', title: 'Penetapan Kelas 7 (Rombel):', desc: 'Verifikasi pembayaran BAM selesai dan murid resmi ditempatkan di rombel kelas 7.' },
  ];

  alurSteps.forEach((item) => {
    // Lingkaran penomoran
    doc.setFillColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
    doc.circle(startX + 3.5, currentY2 - 0.7, 2.1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text(item.step, startX + 3.5, currentY2 + 0.8, { align: 'center' });

    // Judul Tahap (Bold)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(15, 23, 42);
    doc.text(item.title, startX + 7.5, currentY2);

    // Deskripsi Tahap (Normal, wrap text)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.1);
    doc.setTextColor(71, 85, 105);
    const splitDesc = doc.splitTextToSize(item.desc, contentWidth - 52);
    doc.text(splitDesc, startX + 50, currentY2);

    const stepHeight = Math.max(4.2, splitDesc.length * 3.4 + 1.0);
    currentY2 += stepHeight;
  });

  currentY2 += 1.5;

  // E. RINCIAN BIAYA AWAL MASUK (BAM) & KETENTUAN PEMBAYARAN
  currentY2 = drawSectionTitle(doc, 'E. BIAYA FORMULIR & RINCIAN BIAYA AWAL MASUK (BAM)', currentY2, startX, contentWidth);

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
      doc.rect(startX, currentY2, contentWidth, 3.8, 'F');
    } else if (isZebra) {
      doc.setFillColor(248, 250, 252);
      doc.rect(startX, currentY2, contentWidth, 3.8, 'F');
    }

    doc.setFont('helvetica', row.isHighlight ? 'bold' : 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(String(row.no), startX + 3.5, currentY2 + 2.7, { align: 'center' });
    doc.text(row.name, startX + 11, currentY2 + 2.7);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 118, 110);
    doc.text(row.ikhwan, startX + 105, currentY2 + 2.7, { align: 'right' });
    doc.text(row.akhwat, startX + 140, currentY2 + 2.7, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(row.ket, startX + 162, currentY2 + 2.7, { align: 'center' });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    doc.line(startX, currentY2 + 3.8, startX + contentWidth, currentY2 + 3.8);

    currentY2 += 3.8;
  });

  // Baris Total BAM (Highlight Hijau Tua)
  doc.setFillColor(6, 78, 59); // emerald-900
  doc.rect(startX, currentY2, contentWidth, 4.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL BIAYA AWAL MASUK (BAM):', startX + 11, currentY2 + 3.4);
  doc.setTextColor(253, 224, 71); // yellow-300
  doc.text('Rp 6.670.000', startX + 105, currentY2 + 3.4, { align: 'right' });
  doc.text('Rp 6.890.000', startX + 140, currentY2 + 3.4, { align: 'right' });
  doc.setTextColor(209, 250, 229);
  doc.setFontSize(6.4);
  doc.text('Awal Masuk', startX + 162, currentY2 + 3.4, { align: 'center' });
  currentY2 += 6.5;

  // Catatan Seragam & Skema Cicilan
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    '*Catatan Seragam: Paket seragam meliputi 4 stel lengkap (1. Putih Biru, 2. Biru Tosca, 3. Pramuka, 4. Olahraga). Khusus siswi (Akhwat) dilengkapi jilbab & rok panjang syar\'i.',
    startX + 1,
    currentY2
  );
  currentY2 += 3.2;
  const startYear = academicYear.split('/')[0] || '2027';
  doc.text(
    `*Tahapan Pembayaran BAM: Pilihan 1 Langsung Lunas (Ikhwan Rp 6.670.000 | Akhwat Rp 6.890.000) saat daftar ulang, atau Pilihan 2 Angsuran (DP Awal Rp 4.000.000 saat pendaftaran, pelunasan paling lambat 30 Oktober ${startYear}).`,
    startX + 1,
    currentY2
  );
  currentY2 += 4.5;

  // F. REKENING RESMI & INFORMASI KONTAK
  currentY2 = drawSectionTitle(doc, 'F. REKENING RESMI & PUSAT INFORMASI KAMPUS', currentY2, startX, contentWidth);

  // Box Rekening BSI
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.3);
  doc.roundedRect(startX, currentY2, contentWidth, 10.5, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);
  doc.setTextColor(6, 78, 59);
  doc.text('REKENING RESMI PEMBAYARAN FORMULIR & BAM (BANK SYARIAH INDONESIA):', startX + 3, currentY2 + 3.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(4, 120, 87);
  const bankAccNum = schoolInfo.bankAccountNumber || '3953157480';
  const bankAccName = schoolInfo.bankAccountName || 'Al-Hadiid';
  const bankName = schoolInfo.bankName || 'Bank Syariah Indonesia (BSI)';
  doc.text(
    `Bank: ${bankName}   |   No. Rekening: ${bankAccNum}   |   Atas Nama: ${bankAccName}`,
    startX + 3,
    currentY2 + 7.8
  );
  currentY2 += 13.5;

  // Baris Alamat & Kontak Resmi
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(30, 41, 59);
  doc.text('Sekretariat Panitia SPMB SMPS Al-Hadiid Cileungsi:', startX + 1, currentY2);
  currentY2 += 3.4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  doc.text(`• Alamat: ${schoolInfo.address || 'Jl. Melati 1 Perumahan Cileungsi Indah, Cileungsi, Kab. Bogor 16820'}`, startX + 1, currentY2);
  currentY2 += 3.2;
  doc.text(`• Hotline WhatsApp / Telp: ${schoolInfo.whatsapp || schoolInfo.phone || '085814998782'}  |  Email: ${schoolInfo.email || 'smpalhadiid@gmail.com'}`, startX + 1, currentY2);
  currentY2 += 3.2;
  doc.text(`• Portal Pendaftaran Online: ${schoolInfo.website || 'https://alhadiid.or.id/smp-alhadiid/'}`, startX + 1, currentY2);
  currentY2 += 5.5;

  // Pengesahan Resmi Panitia & Kepala Sekolah
  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

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
        triggerDirectBlobDownload(blob, fileName, url);
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
          triggerDirectBlobDownload(blob, fileName, url);
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

/**
 * Fungsi untuk mengunduh berkas SK Brosur Rincian Biaya BAM resmi (Gambar atau PDF)
 */
export async function downloadBamBrochureFile(
  schoolInfo: SchoolInfo
): Promise<{ success: boolean; message: string }> {
  if (schoolInfo.bamBrochureUrl && schoolInfo.bamBrochureUrl.trim() !== '') {
    const url = schoolInfo.bamBrochureUrl.trim();
    const isImg =
      url.startsWith('data:image/') ||
      /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(url) ||
      (schoolInfo.bamBrochureFileType && schoolInfo.bamBrochureFileType.startsWith('image/'));
    const ext = isImg ? '.jpg' : '.pdf';
    const fileName =
      schoolInfo.bamBrochureFileName ||
      `SK_Rincian_Biaya_BAM_${(schoolInfo.academicYear || '2027_2028').replace('/', '_')}${ext}`;

    if (url.startsWith('data:')) {
      const blob = dataUrlToBlob(url);
      triggerDirectBlobDownload(blob, fileName, url);
      return { success: true, message: `Dokumen SK BAM (${fileName}) berhasil diunduh.` };
    }

    try {
      const res = await fetch(url, { mode: 'cors' });
      if (res.ok) {
        const blob = await res.blob();
        triggerDirectBlobDownload(blob, fileName, url);
        return { success: true, message: `Dokumen SK BAM (${fileName}) berhasil diunduh.` };
      }
    } catch {
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
      return { success: true, message: `Membuka berkas SK BAM (${fileName})` };
    }
  }

  // Fallback: unduh brosur resmi SPMB yang memuat tabel BAM
  return await downloadBrochureFile(schoolInfo);
}
