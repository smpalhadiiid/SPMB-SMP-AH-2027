// =====================================================================
// src/utils/brochureGenerator.ts
// Generator Brosur Resmi SPMB SMPS Al-Hadiid Cileungsi (PDF 2 Halaman)
// Serta Fungsi Pembantu Unduh Brosur Terpadu (Online & Offline)
// =====================================================================

import { jsPDF } from 'jspdf';
import { SchoolInfo, CostBreakdown, TestSchedule } from '../types';
import {
  PDF_THEME,
  drawOfficialHeader,
  applyOfficialFooters,
  drawSectionTitle,
  formatRupiah,
  drawWatermark,
  drawOfficialSignature,
} from './pdf';
import { getKepalaSekolahName } from './storage';

/**
 * Menghasilkan Dokumen Brosur Resmi SPMB SMPS Al-Hadiid Cileungsi (2 Halaman)
 */
export function generateBrosurSpmbPDF(
  schoolInfo: SchoolInfo,
  costBreakdowns: CostBreakdown[] = [],
  testSchedules: TestSchedule[] = []
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
  // HALAMAN 1: PROFIL, PROGRAM UNGGULAN, KURIKULUM & FASILITAS
  // ===================================================================
  drawWatermark(doc, 'SMPS AL-HADIID');

  let currentY = drawOfficialHeader(doc, {
    schoolInfo,
    documentTitle: 'BROSUR INFORMASI PENERIMAAN MURID BARU (SPMB)',
    documentSubtitle: `TAHUN PELAJARAN ${academicYear} - KAMPUS ISLAMI MODERN`,
    documentNumber: `BROSUR/SPMB/${academicYear.replace('/', '-')}`,
    orientation: 'portrait',
  });

  currentY += 2;

  // A. PROFIL & VISI MISI
  currentY = drawSectionTitle(doc, 'A. PROFIL & VISI MISI SEKOLAH', currentY, startX, contentWidth);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  const profilText = `${schoolInfo.name || 'SMPS Al-Hadiid Cileungsi'} adalah lembaga pendidikan Islam terpadu jenjang Sekolah Menengah Pertama yang berdedikasi mewujudkan generasi Robbani yang berakhlak mulia, unggul dalam prestasi akademik, mandiri, serta berwawasan global. Memadukan Kurikulum Merdeka Nasional dengan Kurikulum Diniyyah Terpadu.`;
  const splitProfil = doc.splitTextToSize(profilText, contentWidth - 4);
  doc.text(splitProfil, startX + 2, currentY);
  currentY += splitProfil.length * 4.2 + 2;

  // Box Visi
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(startX + 2, currentY, contentWidth - 4, 11, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
  doc.text('VISI SEKOLAH:', startX + 5, currentY + 4);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  const visiText = schoolInfo.tagline || 'Menjadi Sekolah Unggul Berkarakter Islami, Berprestasi Global, dan Hafizh Al-Qur\'an';
  doc.text(`"${visiText}"`, startX + 5, currentY + 8);
  currentY += 14;

  // B. 5 PROGRAM KEUNGGULAN UTAMA
  currentY = drawSectionTitle(doc, 'B. PROGRAM UNGGULAN & NILAI LEBIH', currentY, startX, contentWidth);

  const programs = [
    {
      title: '1. Program Tahfidz & Diniyyah Al-Qur\'an',
      desc: 'Target hafalan mutqin minimal 3 Juz (Juz 28, 29, 30), bimbingan Tahsin metode teruji, Dauroh Qur\'an, serta sertifikasi tahfidz berkala.',
    },
    {
      title: '2. Kurikulum Merdeka & Penguatan Karakter',
      desc: 'Integrasi Kurikulum Merdeka dengan penguatan adab Islam, sholat berjamaah harian, pembiasaan Dhuha, serta program mentoring kepemimpinan.',
    },
    {
      title: '3. Bahasa Asing Komunikatif (Arab & Inggris)',
      desc: 'Pembiasaan kosa kata harian, English & Arabic Club, lomba pidato dwibahasa, serta laboratorium bahasa interaktif.',
    },
    {
      title: '4. Literasi Digital, Coding & Robotika',
      desc: 'Praktikum Komputer modern, pengenalan logika coding dasar, robotic club, dan Computer Based Test (CBT) mandiri.',
    },
    {
      title: '5. Ekstrakurikuler Beragam & Berprestasi',
      desc: 'Pramuka SIT, Panahan Sunnah, Futsal Academy, Basket, Bulutangkis, Seni Hadroh/Marawis, PMR, dan Jurnalistik Sekolah.',
    },
  ];

  programs.forEach(prog => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(PDF_THEME.colors.primaryDark[0], PDF_THEME.colors.primaryDark[1], PDF_THEME.colors.primaryDark[2]);
    doc.text(prog.title, startX + 2, currentY);
    currentY += 3.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const splitDesc = doc.splitTextToSize(prog.desc, contentWidth - 6);
    doc.text(splitDesc, startX + 5, currentY);
    currentY += splitDesc.length * 3.6 + 1.5;
  });

  currentY += 2;

  // C. FASILITAS KAMPUS TERPADU
  currentY = drawSectionTitle(doc, 'C. FASILITAS PENDUKUNG PEMBELAJARAN', currentY, startX, contentWidth);

  const colWidth = (contentWidth - 6) / 2;
  const fasilitasCol1 = [
    '• Ruang Kelas Ber-AC & Proyektor Multimedia',
    '• Laboratorium Komputer CBT & Multimedia',
    '• Masjid Luas untuk Pembiasaan Ibadah',
    '• Laboratorium Sains (IPA Terpadu)',
  ];
  const fasilitasCol2 = [
    '• Perpustakaan Lengkap & Pojok Literasi',
    '• Lapangan Olahraga Futsal, Basket & Voli',
    '• Ruang UKS Standar Medis & Bimbingan Konseling',
    '• Kantin Sehat Halal & Area Parkir Luas',
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);

  let tempY1 = currentY;
  fasilitasCol1.forEach(f => {
    doc.text(f, startX + 2, tempY1);
    tempY1 += 4;
  });

  let tempY2 = currentY;
  fasilitasCol2.forEach(f => {
    doc.text(f, startX + colWidth + 4, tempY2);
    tempY2 += 4;
  });

  currentY = Math.max(tempY1, tempY2) + 2;

  // Banner Ajakan Bawah Hal 1
  doc.setFillColor(241, 245, 249);
  doc.rect(startX, currentY, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
  doc.text('Lanjut ke Halaman 2: Alur Pendaftaran Online, Rincian Biaya, Jadwal Tes & Kontak Resmi ->', startX + contentWidth / 2, currentY + 4.5, { align: 'center' });

  // ===================================================================
  // HALAMAN 2: ALUR PENDAFTARAN, BIAYA, JADWAL & KONTAK RESMI
  // ===================================================================
  doc.addPage();
  drawWatermark(doc, 'SMPS AL-HADIID');

  let currentY2 = drawOfficialHeader(doc, {
    schoolInfo,
    documentTitle: 'INFORMASI PENDAFTARAN & KETENTUAN BIAYA SPMB',
    documentSubtitle: `PETUNJUK TEKNIS SPMB TP ${academicYear}`,
    orientation: 'portrait',
    compact: true,
  });

  currentY2 += 2;

  // D. ALUR 8 TAHAPAN PENDAFTARAN ONLINE
  currentY2 = drawSectionTitle(doc, 'D. ALUR 8 TAHAP PENDAFTARAN ONLINE (SPMB)', currentY2, startX, contentWidth);

  const alurSteps = [
    { step: '1', title: 'Pembuatan Akun:', desc: 'Calon murid mendaftarkan username & password mandiri pada portal resmi SPMB.' },
    { step: '2', title: 'Pembayaran Formulir:', desc: 'Melakukan pembayaran formulir pendaftaran Rp200.000 & upload bukti transfer.' },
    { step: '3', title: 'Pengisian Biodata:', desc: 'Melengkapi data diri calon murid, data orang tua/wali, serta dokumen KK & Akta.' },
    { step: '4', title: 'Verifikasi & Cetak Kartu:', desc: 'Panitia memverifikasi data, kemudian peserta mengunduh Kartu Peserta Ujian.' },
    { step: '5', title: 'Pelaksanaan Ujian CBT:', desc: 'Mengikuti tes diagnostik, potensi akademik, membaca Al-Qur\'an & hafalan juz amma.' },
    { step: '6', title: 'Pengumuman Kelulusan:', desc: 'Hasil kelulusan diumumkan langsung melalui portal SPMB & pesan WhatsApp resmi.' },
    { step: '7', title: 'Daftar Ulang & BAM:', desc: 'Calon murid yang lulus melakukan pembayaran Biaya Awal Masuk (BAM).' },
    { step: '8', title: 'Penetapan Kelas (Rombel):', desc: 'Verifikasi pembayaran BAM selesai dan murid resmi ditempatkan di kelas 7.' },
  ];

  alurSteps.forEach(item => {
    // Lingkaran angka
    doc.setFillColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
    doc.circle(startX + 4, currentY2 - 1, 2.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text(item.step, startX + 4, currentY2 + 0.8, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(item.title, startX + 8, currentY2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(item.desc, startX + 42, currentY2);

    currentY2 += 4.5;
  });

  currentY2 += 1.5;

  // E. ESTIMASI KOMPONEN BIAYA
  currentY2 = drawSectionTitle(doc, 'E. BIAYA FORMULIR & BIAYA PENDIDIKAN', currentY2, startX, contentWidth);

  // Tabel Biaya Ringkas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setFillColor(241, 245, 249);
  doc.rect(startX, currentY2, contentWidth, 5, 'F');
  doc.setTextColor(30, 41, 59);
  doc.text('No', startX + 2, currentY2 + 3.5);
  doc.text('Komponen Pembiayaan', startX + 10, currentY2 + 3.5);
  doc.text('Keterangan / Periode', startX + 90, currentY2 + 3.5);
  doc.text('Nominal (Estimasi)', startX + 145, currentY2 + 3.5);
  currentY2 += 5.5;

  const costList = [
    { no: '1', name: 'Biaya Formulir Pendaftaran & Akun Ujian', period: 'Sekali saat pendaftaran', amount: 'Rp 200.000' },
    { no: '2', name: 'Biaya Awal Masuk (BAM) Ikhwan (Laki-laki)', period: 'Seragam, Gedung, Buku, Kegiatan', amount: 'Sesuai rincian BAM' },
    { no: '3', name: 'Biaya Awal Masuk (BAM) Akhwat (Perempuan)', period: 'Seragam jilbab, Gedung, Kegiatan', amount: 'Sesuai rincian BAM' },
    { no: '4', name: 'SPP / Dana Penyelenggaraan Pendidikan', period: 'Per Bulan (Mulai Juli)', amount: 'Rp 800.000 / bln' },
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);

  costList.forEach(c => {
    doc.text(c.no, startX + 2, currentY2 + 3);
    doc.text(c.name, startX + 10, currentY2 + 3);
    doc.text(c.period, startX + 90, currentY2 + 3);
    doc.setFont('helvetica', 'bold');
    doc.text(c.amount, startX + 145, currentY2 + 3);
    doc.setFont('helvetica', 'normal');

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(startX, currentY2 + 4.5, startX + contentWidth, currentY2 + 4.5);
    currentY2 += 5;
  });

  currentY2 += 1.5;

  // F. REKENING RESMI & INFORMASI KONTAK
  currentY2 = drawSectionTitle(doc, 'F. REKENING RESMI & PUSAT INFORMASI', currentY2, startX, contentWidth);

  // Box Rekening BSI
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.3);
  doc.roundedRect(startX, currentY2, contentWidth, 12, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(6, 78, 59);
  doc.text('REKENING RESMI PEMBAYARAN SPMB (BANK SYARIAH INDONESIA):', startX + 3, currentY2 + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(4, 120, 87);
  doc.text(
    `Bank: ${schoolInfo.bankName || 'BSI (Bank Syariah Indonesia)'}  |  No. Rekening: ${schoolInfo.bankAccountNumber || '7123891011'}  |  A.N: ${schoolInfo.bankAccountName || 'YPI AL-HADIID CILEUNGSI'}`,
    startX + 3,
    currentY2 + 8.5
  );
  currentY2 += 15;

  // Kontak & Alamat
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Layanan Informasi & Pendaftaran Kampus:', startX + 2, currentY2);
  currentY2 += 3.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(`• Alamat: ${schoolInfo.address || 'Jl. Raya Cileungsi - Setu KM 3.5, Pasirangin, Cileungsi, Bogor, Jawa Barat 16820'}`, startX + 2, currentY2);
  currentY2 += 3.5;
  doc.text(`• Telp / WhatsApp Resmi: ${schoolInfo.phone || '0812-8888-9999'}  |  Email: ${schoolInfo.email || 'info@alhadiid.sch.id'}`, startX + 2, currentY2);
  currentY2 += 3.5;
  doc.text(`• Portal Pendaftaran Online: ${schoolInfo.website || 'https://spmb-al-hadiid.sch.id'}`, startX + 2, currentY2);
  currentY2 += 6;

  // Pengesahan Resmi Bawah
  drawOfficialSignature(doc, {
    x: startX + contentWidth - 65,
    y: currentY2,
    title: 'Panitia SPMB & Kepala Sekolah,',
    subtitle: schoolInfo.name || 'SMPS AL-HADIID CILEUNGSI',
    personName: getKepalaSekolahName(schoolInfo),
    extraNote: schoolInfo.headmasterNiy ? `NIY. ${schoolInfo.headmasterNiy}` : 'KEPALA SEKOLAH',
    signatureWidth: 65,
    isRightAligned: true,
    dateCity: `Cileungsi, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
  });

  // Terapkan penomoran halaman otomatis
  applyOfficialFooters(doc, {
    schoolInfo,
    orientation: 'portrait',
  });

  return doc;
}

/**
 * Unduh berkas PDF yang dihasilkan jsPDF dengan jaminan kompatibilitas di semua browser
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
 * Menghasilkan URL Blob untuk pratinjau brosur di layar (in-app viewer)
 */
export function getBrochurePdfBlobUrl(
  schoolInfo: SchoolInfo,
  costBreakdowns: CostBreakdown[] = [],
  testSchedules: TestSchedule[] = []
): string {
  if (schoolInfo.brochureUrl && schoolInfo.brochureUrl.trim() !== '') {
    return schoolInfo.brochureUrl.trim();
  }
  const doc = generateBrosurSpmbPDF(schoolInfo, costBreakdowns, testSchedules);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}

/**
 * Fungsi Terpadu untuk Mengunduh Brosur SPMB:
 * 1. Jika sekolah memiliki brochureUrl terunggah:
 *    - Melakukan download file secara aman (via Blob untuk URL remote agar tidak diblokir browser).
 * 2. Jika belum mengunggah file khusus:
 *    - Secara otomatis membuat dan mengunduh Brosur Resmi SPMB SMPS Al-Hadiid (PDF) menggunakan generateBrosurSpmbPDF.
 */
export async function downloadBrochureFile(
  schoolInfo: SchoolInfo,
  costBreakdowns: CostBreakdown[] = [],
  testSchedules: TestSchedule[] = []
): Promise<{ success: boolean; message: string }> {
  const fileName = schoolInfo.brochureFileName || `Brosur_Resmi_SPMB_SMP_AlHadiid_${(schoolInfo.academicYear || '2027_2028').replace('/', '_')}.pdf`;

  try {
    // 1. Jika ada URL brosur terunggah
    if (schoolInfo.brochureUrl && schoolInfo.brochureUrl.trim() !== '') {
      const url = schoolInfo.brochureUrl.trim();

      // Kasus A: Data URL (base64)
      if (url.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          try { document.body.removeChild(a); } catch {}
        }, 1500);
        return { success: true, message: `Berhasil mengunduh ${fileName}` };
      }

      // Kasus B: Remote HTTP/HTTPS URL
      try {
        const response = await fetch(url, { mode: 'cors' });
        if (response.ok) {
          const blob = await response.blob();
          triggerDirectBlobDownload(blob, fileName);
          return { success: true, message: `Berhasil mengunduh ${fileName}` };
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
          try { document.body.removeChild(a); } catch {}
        }, 1500);
        return { success: true, message: `Membuka ${fileName}` };
      }
    }

    // 2. Jika tidak ada file khusus terunggah, buat PDF Brosur Resmi SPMB secara dinamis
    const doc = generateBrosurSpmbPDF(schoolInfo, costBreakdowns, testSchedules);
    const blob = doc.output('blob');
    triggerDirectBlobDownload(blob, fileName);
    return { success: true, message: `Brosur Resmi SPMB (${fileName}) berhasil diunduh.` };
  } catch (error: any) {
    console.error('[downloadBrochureFile] Exception:', error);
    // Fallback terakhir: generate PDF lokal
    try {
      const doc = generateBrosurSpmbPDF(schoolInfo, costBreakdowns, testSchedules);
      doc.save(fileName);
      return { success: true, message: `Brosur Resmi SPMB (${fileName}) berhasil diunduh.` };
    } catch (innerErr: any) {
      return { success: false, message: `Gagal mengunduh brosur: ${innerErr?.message || 'Terjadi kesalahan sistem'}` };
    }
  }
}
