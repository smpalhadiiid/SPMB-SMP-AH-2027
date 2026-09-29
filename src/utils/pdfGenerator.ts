import { jsPDF } from 'jspdf';
import { StudentData, SchoolInfo, TestSchedule } from '../types';
import { getKepalaSekolahName } from './storage';

function drawKopHeader(doc: jsPDF, schoolInfo?: SchoolInfo) {
  const info = schoolInfo || ({} as SchoolInfo);
  // Draw Uploaded School Logo on Top Left of Kop Header
  if (info.logoUrl) {
    try {
      const isJpeg = info.logoUrl.includes('image/jpeg') || info.logoUrl.includes('image/jpg');
      const format = isJpeg ? 'JPEG' : 'PNG';
      doc.addImage(info.logoUrl, format, 16, 7, 22, 22);
    } catch (err) {
      console.warn('Gagal merender logo pada Kop PDF:', err);
    }
  }

  // Title / Kop Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text('PANITIA SISTEM PENERIMAAN MURID BARU', 105, 11, { align: 'center' });
  
  doc.setFontSize(13);
  doc.text((info.name || 'SMP AL-HADIID CILEUNGSI').toUpperCase(), 105, 16.5, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(50, 50, 50);
  doc.text(`Alamat : ${info.address || 'Jl. Melati 1 Perumahan Cileungsi Indah, Cileungsi Kabupaten Bogor 16820'}`, 105, 21, { align: 'center' });
  doc.text(`Telp. ${info.phone || '021-82493659'} Email : ${info.email || 'smpalhadiid@gmail.com'}`, 105, 25, { align: 'center' });
  doc.text(`Website : ${info.website || 'https://alhadiid.or.id/smp-alhadiid/'}`, 105, 29, { align: 'center' });

  // Double Divider Lines
  doc.setLineWidth(0.8);
  doc.setDrawColor(0, 0, 0);
  doc.line(15, 31.5, 195, 31.5);
  doc.setLineWidth(0.2);
  doc.line(15, 32.5, 195, 32.5);
}

function formatDateIndonesian(dateString?: string): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const months = [
      'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
      'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateString;
  }
}

export function generateRegistrationPDF(student: StudentData, schoolInfo: SchoolInfo) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const todayStr = formatDateIndonesian(new Date().toISOString());

  // ==========================================
  // PAGE 1: FORMULIR PENERIMAAN MURID BARU
  // ==========================================
  drawKopHeader(doc, schoolInfo);

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('FORMULIR PENERIMAAN MURID BARU', 105, 38, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`TAHUN PELAJARAN ${schoolInfo.academicYear || '2026/2027'}`, 105, 43, { align: 'center' });

  // Section A: DATA CALON PESERTA DIDIK
  doc.setFontSize(9);
  doc.text('A. DATA CALON PESERTA DIDIK', 15, 49);

  // Table Grid A
  let startY = 51;
  const colWidths = [50, 85, 45]; // Total 180mm (15 to 195)
  const rowH = 5.2;

  // Draw Photo Box on the right (Rows 2 to 7)
  doc.setDrawColor(120, 120, 120);
  doc.setFillColor(250, 250, 250);
  doc.rect(150, startY + rowH, 45, rowH * 6, 'FD');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('Foto 3x4', 172.5, startY + rowH * 4, { align: 'center' });

  // Reset font for table contents
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);

  const studentTableData: [string, string, string, string][] = [
    ['Nomor Induk Siswa Nasional (NISN)', student.nisn || '-', 'Nomor Pendaftaran', student.registrationNumber || '0001'],
    ['Nama Lengkap (sesuai Ijazah SD/MI)', (student.fullName || '-').toUpperCase(), '', ''],
    ['Jenis Kelamin', (student.gender || 'LAKI-LAKI').toUpperCase(), '', ''],
    ['Tempat, Tanggal Lahir', `${(student.birthPlace || '-').toUpperCase()}, ${formatDateIndonesian(student.birthDate)}`, '', ''],
    ['Agama', (student.religion || 'ISLAM').toUpperCase(), '', ''],
    ['Anak ke', `${student.childOrder || '1'} Dari ${student.totalSiblings || '....'} Saudara`, '', ''],
    ['Sekolah Asal', (student.previousSchoolName || '-').toUpperCase(), '', ''],
    ['Alamat Tempat Tinggal Sekarang', (student.address || '-').toUpperCase(), '', ''],
    ['Desa/Kelurahan', (student.village || student.subdistrict || '-').toUpperCase(), '', ''],
    ['Kecamatan', (student.subdistrict || '-').toUpperCase(), 'Kab/Kota', (student.city || 'BOGOR').toUpperCase()],
    ['Email Aktif', student.userEmail || '-', '', ''],
    ['No. WA. / Hp. ygbisa dihubungi', student.phone || '-', '', ''],
  ];

  let currentY = startY;

  studentTableData.forEach((row, idx) => {
    // Row background border
    doc.setDrawColor(100, 100, 100);
    doc.setFillColor(255, 255, 255);

    if (idx === 0) {
      // Row 1 spans across with NISN and No Pendaftaran
      doc.rect(15, currentY, 45, rowH);
      doc.rect(60, currentY, 65, rowH);
      doc.rect(125, currentY, 30, rowH);
      doc.rect(155, currentY, 40, rowH);

      doc.setFont('helvetica', 'bold');
      doc.text(row[0], 16.5, currentY + 3.6);
      doc.setFont('helvetica', 'bold');
      doc.text(row[1], 61.5, currentY + 3.6);
      doc.setFont('helvetica', 'bold');
      doc.text(row[2], 126.5, currentY + 3.6);
      doc.setFont('helvetica', 'bold');
      doc.text(row[3], 156.5, currentY + 3.6);
    } else if (idx >= 1 && idx <= 6) {
      // Rows 2..7 share right space with Photo box
      doc.rect(15, currentY, 55, rowH);
      doc.rect(70, currentY, 80, rowH);

      doc.setFont('helvetica', 'bold');
      doc.text(row[0], 16.5, currentY + 3.6);
      doc.setFont('helvetica', 'normal');
      doc.text(row[1].substring(0, 48), 71.5, currentY + 3.6);
    } else if (idx === 9) {
      // Row 10: Kecamatan & Kab/Kota split
      doc.rect(15, currentY, 55, rowH);
      doc.rect(70, currentY, 45, rowH);
      doc.rect(115, currentY, 25, rowH);
      doc.rect(140, currentY, 55, rowH);

      doc.setFont('helvetica', 'bold');
      doc.text(row[0], 16.5, currentY + 3.6);
      doc.setFont('helvetica', 'normal');
      doc.text(row[1], 71.5, currentY + 3.6);
      doc.setFont('helvetica', 'bold');
      doc.text(row[2], 116.5, currentY + 3.6);
      doc.setFont('helvetica', 'normal');
      doc.text(row[3], 141.5, currentY + 3.6);
    } else {
      // Standard rows (8, 9, 11, 12)
      doc.rect(15, currentY, 55, rowH);
      doc.rect(70, currentY, 125, rowH);

      doc.setFont('helvetica', 'bold');
      doc.text(row[0], 16.5, currentY + 3.6);
      doc.setFont('helvetica', 'normal');
      doc.text(row[1].substring(0, 75), 71.5, currentY + 3.6);
    }

    currentY += rowH;
  });

  // Section B: DATA ORANG TUA / WALI
  currentY += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('B. DATA ORANG TUA / WALI', 15, currentY);
  currentY += 2;

  const parentTableData: [string, string][] = [
    ['Nama Ayah', (student.fatherName || '-').toUpperCase()],
    ['Tempat, Tanggal Lahir', student.fatherBirthPlace || student.fatherBirthDate ? `${(student.fatherBirthPlace || '').toUpperCase()}, ${formatDateIndonesian(student.fatherBirthDate)}` : '-'],
    ['Pekerjaan Ayah', (student.fatherJob || 'IRT/SWASTA').toUpperCase()],
    ['Nama Ibu', (student.motherName || '-').toUpperCase()],
    ['Tempat, Tanggal Lahir', student.motherBirthPlace || student.motherBirthDate ? `${(student.motherBirthPlace || '').toUpperCase()}, ${formatDateIndonesian(student.motherBirthDate)}` : '-'],
    ['Pekerjaan Ibu', (student.motherJob || 'IRT').toUpperCase()],
    ['Nomor WA/HP yang bisa dihubungi', student.fatherPhone || student.motherPhone || student.phone || '-'],
  ];

  parentTableData.forEach(([label, value]) => {
    doc.setDrawColor(100, 100, 100);
    doc.rect(15, currentY, 55, rowH);
    doc.rect(70, currentY, 125, rowH);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(label, 16.5, currentY + 3.6);
    doc.setFont('helvetica', 'normal');
    doc.text(value.substring(0, 75), 71.5, currentY + 3.6);

    currentY += rowH;
  });

  // Signatures for Page 1
  currentY += 8;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');

  doc.text('Mengetahui,', 25, currentY);
  doc.text('Orang tua / Wali Siswa,', 25, currentY + 4);

  doc.text(`Cileungsi, ${todayStr}`, 145, currentY);
  doc.text('Calon Murid Baru,', 145, currentY + 4);

  currentY += 22;

  const parentDisplayName = (student.fatherName || student.motherName || 'INDRA RAMADHAN S KURNIAWAN').toUpperCase();
  const studentDisplayName = (student.fullName || 'DZAKIRA AFTANI S. KURNIAWAN').toUpperCase();

  doc.setFont('helvetica', 'bold');
  doc.text(parentDisplayName, 25, currentY);
  doc.text(studentDisplayName, 145, currentY);


  // ==========================================
  // PAGE 2: SURAT PERJANJIAN SISWA
  // ==========================================
  doc.addPage();
  drawKopHeader(doc, schoolInfo);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('SURAT PERJANJIAN SISWA', 105, 38, { align: 'center' });
  doc.setLineWidth(0.3);
  doc.line(78, 39, 132, 39);

  currentY = 46;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.text('Bismillaahirrahmaanirrahiim,', 15, currentY);

  currentY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Saya yang bertanda tangan di bawah ini.', 15, currentY);

  currentY += 6;
  const agreementFields = [
    ['Nama Lengkap', `: ${studentDisplayName}`],
    ['Tempat, Tanggal Lahir', `: ${(student.birthPlace || '-').toUpperCase()}, ${formatDateIndonesian(student.birthDate)}`],
    ['Sekolah Asal', `: SD/MI ${(student.previousSchoolName || '-').toUpperCase()}`],
    ['NISN', `: ${student.nisn || '-'}`],
    ['Nama Orang tua / Wali', `: ${(student.fatherName || '-').toUpperCase()} / ${(student.motherName || '-').toUpperCase()}`],
    ['Alamat Sekarang', `: ${(student.address || '-').toUpperCase()}`],
    ['', `  ${(student.village || student.subdistrict || '').toUpperCase()} ${student.subdistrict.toUpperCase()}`],
    ['', `  ${student.city.toUpperCase()}`],
    ['No. Telpon / HP', `: ${student.phone || '-'}`],
  ];

  agreementFields.forEach(([lbl, val]) => {
    if (lbl) {
      doc.setFont('helvetica', 'bold');
      doc.text(lbl, 20, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(val, 62, currentY);
    } else {
      doc.text(val, 62, currentY);
    }
    currentY += 4.8;
  });

  currentY += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('B E R J A N J I', 105, currentY, { align: 'center' });

  currentY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  const promises = [
    '1. Akan mentaati/mematuhi seluruh peraturan, tata tertib yang berlaku dan yang telah ditetapkan oleh sekolah',
    '2. Akan belajar dengan sebaik-baiknya dan dengan kesungguhan',
    '3. Tidak akan melakukan hal-hal yang dapat merusak nama baik sekolah, diri sendiri, orang tua dan Dinul-Islam.',
  ];

  promises.forEach(p => {
    doc.text(p, 20, currentY);
    currentY += 5.5;
  });

  currentY += 3;
  const paragraph1 = 'Apabila saya ternyata melanggar perjanjian ini, maka saya menyatakan bersedia menerima sanksi yang ditetapkan sekolah atau DIKELUARKAN dari sekolah/dikembalikan kepada orang tua/ wali siswa.';
  const splitP1 = doc.splitTextToSize(paragraph1, 175);
  doc.text(splitP1, 15, currentY);

  currentY += splitP1.length * 4.5 + 3;
  const paragraph2 = 'Dengan penuh kesadaran dan tanpa paksaan dari siapapun, maka saya tanda tangani surat perjanjian ini.';
  doc.text(paragraph2, 15, currentY);

  currentY += 15;
  doc.setFontSize(8.5);
  doc.text('Mengetahui/Menyetujui,', 25, currentY);
  doc.text('Orang tua / Wali siswa', 25, currentY + 4);

  doc.text(`Cileungsi, ${todayStr}`, 145, currentY);
  doc.text('Yang berjanji,', 145, currentY + 4);

  // Materai Box
  currentY += 8;
  doc.setDrawColor(100, 100, 100);
  doc.rect(88, currentY, 28, 16);
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text('Materai', 102, currentY + 6, { align: 'center' });
  doc.text('10.000', 102, currentY + 11, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  currentY += 16;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(parentDisplayName, 25, currentY);
  doc.text(studentDisplayName, 145, currentY);


  // ==========================================
  // PAGE 3: TANDA TERIMA KELENGKAPAN DOKUMEN PENDAFTARAN
  // ==========================================
  doc.addPage();
  drawKopHeader(doc, schoolInfo);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('TANDA TERIMA KELENGKAPAN DOKUMEN PENDAFTARAN', 105, 38, { align: 'center' });
  doc.line(55, 39, 155, 39);

  currentY = 46;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Nama', 15, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`: ${studentDisplayName}`, 38, currentY);

  doc.setFont('helvetica', 'bold');
  doc.text('Form. Pendaftaran', 130, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`: ${student.registrationNumber || '0001'}`, 162, currentY);

  currentY += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Asal Sekolah', 15, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`: ${(student.previousSchoolName || '-').toUpperCase()}`, 38, currentY);

  // Section 1: DOKUMEN SISWA
  currentY += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DOKUMEN SISWA', 15, currentY);

  currentY += 2;
  const docChecklist = [
    'Pas Photo 3x4, 1 (satu) lembar berwarna',
    'Fotokopi Akte Kelahiran 1 (satu) lembar',
    'Fotokopi KTP Orangtua 1 (satu) lembar',
    'Fotokopi Kartu Keluarga 2 (satu) lembar',
    'Fotokopi Surat Keterangan Lulus yang dilegalisir 2 (dua) lembar',
    'Fotokopi Ijazah yang dilegalisir 2 (dua) lembar',
    'Mengembalikan Form Pendaftaran',
    'Menandatangani Surat Perjanjian (bermaterai Rp.10.000,-)',
    'Fotokopi NISN 1 Lembar',
    'Surat keterangan pindah dari sekolah asal *',
    'Surat mutasi Dapodik/Emis dari sekolah asal *',
    'Surat Keterangan Kelakuan Baik dari sekolah Asal *',
    'Rapot asli lengkap diniyyah dan umumnya *',
  ];

  // Table Header
  doc.setDrawColor(80, 80, 80);
  doc.setFillColor(240, 240, 240);
  doc.rect(15, currentY, 15, 5, 'FD');
  doc.rect(30, currentY, 135, 5, 'FD');
  doc.rect(165, currentY, 30, 5, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('NO.', 22.5, currentY + 3.6, { align: 'center' });
  doc.text('KETERANGAN', 33, currentY + 3.6);
  doc.text('CEK', 180, currentY + 3.6, { align: 'center' });

  currentY += 5;
  doc.setFont('helvetica', 'normal');

  docChecklist.forEach((item, idx) => {
    doc.rect(15, currentY, 15, 4.5);
    doc.rect(30, currentY, 135, 4.5);
    doc.rect(165, currentY, 30, 4.5);

    doc.text(`${idx + 1}.`, 22.5, currentY + 3.2, { align: 'center' });
    doc.text(item, 33, currentY + 3.2);
    // Square checkbox box
    doc.rect(178.5, currentY + 1, 3, 3);

    currentY += 4.5;
  });

  currentY += 2;
  doc.setFontSize(7.5);
  doc.text('* Berlaku bagi siswa pindahan.', 15, currentY);
  currentY += 3.5;
  doc.text('Pada saat penyerahan berkas fotocopi harap membawa berkas yang asli.', 15, currentY);

  // Section 2: FINANCIAL
  currentY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('FINANCIAL', 15, currentY);

  currentY += 2;
  // Header
  doc.setFillColor(240, 240, 240);
  doc.rect(15, currentY, 15, 5, 'FD');
  doc.rect(30, currentY, 135, 5, 'FD');
  doc.rect(165, currentY, 30, 5, 'FD');

  doc.setFontSize(8);
  doc.text('NO.', 22.5, currentY + 3.6, { align: 'center' });
  doc.text('KETERANGAN', 33, currentY + 3.6);
  doc.text('CEK', 180, currentY + 3.6, { align: 'center' });

  currentY += 5;
  doc.setFont('helvetica', 'normal');

  const finChecklist = [
    'Formulir pendaftaran',
    'Keuangan Dana Awal Pendidikan (bukti terlampir)',
  ];

  finChecklist.forEach((item, idx) => {
    doc.rect(15, currentY, 15, 4.5);
    doc.rect(30, currentY, 135, 4.5);
    doc.rect(165, currentY, 30, 4.5);

    doc.text(`${idx + 1}.`, 22.5, currentY + 3.2, { align: 'center' });
    doc.text(item, 33, currentY + 3.2);

    // Checkbox box
    const isChecked = idx === 0 ? student.formPaymentStatus === 'verified' : student.initialPaymentStatus === 'verified';
    doc.rect(178.5, currentY + 1, 3, 3);
    if (isChecked) {
      doc.setFont('helvetica', 'bold');
      doc.text('✓', 179, currentY + 3.4);
      doc.setFont('helvetica', 'normal');
    }

    currentY += 4.5;
  });

  // Signatures
  currentY += 8;
  doc.setFontSize(8.5);
  doc.text('Yang menerima,', 25, currentY);
  doc.text('Cileungsi,                    20...', 140, currentY);
  doc.text('Yang menyerahkan,', 140, currentY + 4);

  currentY += 20;
  doc.text('.........................................', 25, currentY);
  doc.text('.........................................', 140, currentY);

  // Save PDF
  const safeReg = student.registrationNumber || 'NO-REG';
  const safeName = (student.fullName || 'Calon_Murid').replace(/\s+/g, '_');
  doc.save(`Formulir_SPMB_${safeReg}_${safeName}.pdf`);
}

export function generateReportPDF(title: string, data: any[], columns: string[], schoolInfo?: SchoolInfo) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Header
  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, 297, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('SMP AL-HADIID CILEUNGSI - LAPORAN OFFICIAL SPMB ONLINE', 148.5, 10, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(title.toUpperCase(), 148.5, 17, { align: 'center' });

  let y = 32;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');

  // Simple Table Header
  const colWidth = 270 / columns.length;
  columns.forEach((col, idx) => {
    doc.setFillColor(226, 232, 240);
    doc.rect(14 + idx * colWidth, y, colWidth, 8, 'F');
    doc.text(col, 16 + idx * colWidth, y + 5.5);
  });

  y += 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  data.forEach((row, rowIndex) => {
    if (y > 180) {
      doc.addPage();
      y = 20;
    }

    if (rowIndex % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y - 1, 270, 7, 'F');
    }

    columns.forEach((col, colIdx) => {
      const val = String(row[col] || '-');
      doc.text(val.substring(0, 28), 16 + colIdx * colWidth, y + 4);
    });

    y += 7;
  });

  // Official Signature Block at the end of report
  if (y > 155) {
    doc.addPage();
    y = 25;
  } else {
    y += 10;
  }
  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const kepsekName = getKepalaSekolahName(schoolInfo);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Mengetahui,', 50, y, { align: 'center' });
  doc.text('Kepala SMP Al-Hadiid,', 50, y + 4.5, { align: 'center' });
  doc.text(`Cileungsi, ${todayStr}`, 240, y, { align: 'center' });
  doc.text('Ketua Panitia SPMB,', 240, y + 4.5, { align: 'center' });

  y += 22;
  doc.setFont('helvetica', 'bold');
  doc.text(`( ${kepsekName} )`, 50, y, { align: 'center' });
  doc.text('( Panitia SPMB SMP Al-Hadiid )', 240, y, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  if (schoolInfo?.headmasterNiy) {
    doc.text(`NIY. ${schoolInfo.headmasterNiy}`, 50, y + 4, { align: 'center' });
  } else {
    doc.text('Kepala Sekolah SMP Al-Hadiid', 50, y + 4, { align: 'center' });
  }
  doc.text('Stempel Resmi SPMB 2027/2028', 240, y + 4, { align: 'center' });

  doc.save(`Laporan_SPMB_${title.replace(/\s+/g, '_')}.pdf`);
}

function getScorePredicate(score: number): string {
  if (score >= 88) return 'Sangat Baik (A)';
  if (score >= 75) return 'Baik (B)';
  if (score >= 60) return 'Cukup (C)';
  return 'Perlu Remedial (D)';
}

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

  // Kredensial Login Akun Peserta Ujian (Username & Password untuk login siswa)
  let storedPass = '';
  let storedUser = '';
  try {
    if (typeof window !== 'undefined') {
      storedPass =
        sessionStorage.getItem('spmb_last_student_password') ||
        localStorage.getItem(`spmb_cred_${student.id}`) ||
        localStorage.getItem(`spmb_cred_${student.userEmail}`) ||
        localStorage.getItem(`spmb_cred_${student.registrationNumber}`) ||
        '';
      storedUser =
        sessionStorage.getItem('spmb_last_student_username') ||
        localStorage.getItem(`spmb_user_${student.id}`) ||
        '';
    }
  } catch {}

  const loginUsername = (
    authCredentials?.username ||
    storedUser ||
    (student as any).username ||
    (student as any).examUsername ||
    (student.userEmail ? student.userEmail.split('@')[0] : '') ||
    student.registrationNumber ||
    'siswa'
  ).trim();

  const loginPassword = (
    authCredentials?.password ||
    storedPass ||
    (student as any).password ||
    (student as any).examPassword ||
    'siswa123'
  ).trim();

  // 1. Kop Header
  drawKopHeader(doc, schoolInfo);

  // Outer Decorative Card Border
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.6);
  doc.rect(15, 36, 180, 245);

  // Title Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(15, 36, 180, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('KARTU TANDA PESERTA UJIAN / TES DIAGNOSTIK SPMB', 105, 42.5, { align: 'center' });
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`TAHUN PELAJARAN ${schoolInfo.academicYear || '2027/2028'}`, 105, 47, { align: 'center' });

  // Registration Badge Box
  doc.setFillColor(241, 245, 249);
  doc.rect(20, 53, 170, 11, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.rect(20, 53, 170, 11, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('NOMOR PESERTA / REGISTRASI:', 25, 60);

  doc.setFontSize(11);
  doc.setTextColor(15, 118, 110);
  doc.text(student.registrationNumber || 'SPMB-20270001', 82, 60.5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`JALUR: ${schedule?.waveName || 'Gelombang 1 - Reguler'}`, 145, 60);

  // Student Identity Section
  let curY = 68;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('A. IDENTITAS PESERTA UJIAN', 20, curY);

  curY += 3.8;
  const idRows: [string, string][] = [
    ['Nama Lengkap', (student.fullName || '-').toUpperCase()],
    ['NISN / NIK', `${student.nisn || '-'} / ${student.nik || '-'}`],
    ['Tempat, Tanggal Lahir', `${(student.birthPlace || '-').toUpperCase()}, ${formatDateIndonesian(student.birthDate)}`],
    ['Jenis Kelamin', (student.gender || 'LAKI-LAKI').toUpperCase()],
    ['Sekolah Asal', (student.previousSchoolName || '-').toUpperCase()],
    ['No. HP / WhatsApp', student.phone || '-'],
    ['Nama Orang Tua / Wali', (student.fatherName || student.motherName || '-').toUpperCase()],
  ];

  doc.setFontSize(8);
  idRows.forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(label, 22, curY);
    doc.text(':', 62, curY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(val.substring(0, 48), 66, curY);
    curY += 4.5;
  });

  // Photo Box on the right (x=150, y=66, width=36, height=44)
  const photoX = 150;
  const photoY = 66;
  const photoW = 36;
  const photoH = 44;

  let photoRendered = false;
  if (student.photoUrl && (student.photoUrl.startsWith('data:image') || student.photoUrl.startsWith('http'))) {
    try {
      const isJpeg = student.photoUrl.includes('image/jpeg') || student.photoUrl.includes('image/jpg');
      doc.addImage(student.photoUrl, isJpeg ? 'JPEG' : 'PNG', photoX, photoY, photoW, photoH);
      photoRendered = true;
    } catch (e) {
      photoRendered = false;
    }
  }

  if (!photoRendered) {
    doc.setFillColor(248, 250, 252);
    doc.rect(photoX, photoY, photoW, photoH, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(photoX, photoY, photoW, photoH, 'D');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('PAS FOTO', photoX + photoW / 2, photoY + 20, { align: 'center' });
    doc.text('3 x 4', photoX + photoW / 2, photoY + 25, { align: 'center' });
  }

  // Section B: AKUN & KREDENSIAL LOGIN TES CBT
  curY = 113;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('B. KREDENSIAL AKUN LOGIN UJIAN CBT ONLINE (KOMPUTER / HP)', 20, curY);

  curY += 3.5;
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.rect(20, curY, 170, 16, 'F');
  doc.setDrawColor(16, 185, 129); // emerald-500
  doc.setLineWidth(0.4);
  doc.rect(20, curY, 170, 16, 'D');

  // Username Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('USERNAME LOGIN:', 25, curY + 5.5);
  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(loginUsername, 25, curY + 11.5);

  // Password Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('PASSWORD LOGIN:', 85, curY + 5.5);
  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text(loginPassword, 85, curY + 11.5);

  // Portal URL
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('PORTAL TES CBT:', 140, curY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(5, 150, 105);
  doc.text('spmb.smpalhadiid.sch.id', 140, curY + 11.5);

  // Schedule & Exam Venue Section
  curY = 135;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('C. JADWAL PELAKSANAAN TES DIAGNOSTIK & AKADEMIK', 20, curY);

  curY += 3.5;
  doc.setFillColor(248, 250, 252);
  doc.rect(20, curY, 170, 32, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(20, curY, 170, 32, 'D');

  const schedRows: [string, string][] = [
    ['Hari & Tanggal Tes', schedule?.testDate || student.testScheduleDate || 'Sesuai Pengumuman Gelombang'],
    ['Waktu / Jam Tes', schedule?.testTime || '08.00 - 11.30 WIB'],
    ['Durasi Pengerjaan', `${schedule?.durationMinutes || 90} Menit`],
    ['Lokasi / Sistem', schedule?.location || student.testLocation || 'Portal Ujian Online SPMB / Lab Komputer SMP Al-Hadiid'],
    ['Materi Uji', '1. Tes Diagnostik Awal (30%) | 2. Pengetahuan Umum (40%) | 3. Diniyyah (30%)'],
    ['Sifat Ujian', 'Ujian Berbasis Komputer (CBT) Mandiri & Terpantau Panitia'],
  ];

  let schedY = curY + 4.5;
  schedRows.forEach(([lbl, val]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(lbl, 23, schedY);
    doc.text(':', 58, schedY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(val, 62, schedY);
    schedY += 4.5;
  });

  // Section D: Tata Tertib Peserta
  curY = 173;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('D. TATA TERTIB PESERTA UJIAN', 20, curY);

  curY += 3.5;
  const rules = [
    '1. Peserta wajib menyimpan dan membawa / menunjukkan Kartu Peserta Ujian ini saat pelaksanaan tes.',
    '2. Gunakan Username dan Password resmi di atas untuk login ke aplikasi Ujian CBT Online.',
    '3. Peserta diharapkan login atau hadir di lokasi tes 15 menit sebelum waktu ujian dimulai.',
    '4. Mempersiapkan perangkat (laptop/smartphone) dengan koneksi internet yang stabil dan memadai.',
    '5. Mengerjakan seluruh soal secara mandiri, jujur, serta mematuhi seluruh instruksi pengawas tes.',
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  rules.forEach(rule => {
    doc.text(rule, 22, curY);
    curY += 4;
  });

  // Section E: Tanda Tangan & Pengesahan
  curY = 197;
  doc.setLineWidth(0.3);
  doc.setDrawColor(203, 213, 225);
  doc.line(20, curY, 190, curY);

  curY += 4.5;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Dicetak secara resmi pada: ${todayStr}`, 20, curY);

  curY += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Peserta Ujian,', 25, curY);
  doc.text('Ketua Panitia SPMB,', 90, curY + 4);
  doc.text(`Cileungsi, ${todayStr}`, 148, curY);
  doc.text('Kepala SMP Al-Hadiid,', 148, curY + 4);

  // Signature lines
  curY += 20;
  doc.setFont('helvetica', 'bold');
  doc.text((student.fullName || '..................................').toUpperCase(), 25, curY);
  doc.text('( PANITIA SPMB SMP AL-HADIID )', 90, curY);
  const kepsekName = getKepalaSekolahName(schoolInfo);
  doc.text(`( ${kepsekName} )`, 148, curY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Tanda tangan calon murid', 25, curY + 3.5);
  doc.text('Tanda tangan & Stempel Panitia', 90, curY + 3.5);
  if (schoolInfo?.headmasterNiy) {
    doc.text(`NIY. ${schoolInfo.headmasterNiy}`, 148, curY + 3.5);
  } else {
    doc.text('Kepala Sekolah SMP Al-Hadiid', 148, curY + 3.5);
  }

  // Save PDF
  const safeReg = student.registrationNumber || 'NO-REG';
  const safeName = (student.fullName || 'Calon_Murid').replace(/\s+/g, '_');
  doc.save(`Kartu_Ujian_SPMB_${safeReg}_${safeName}.pdf`);
}

export function generateExamResultPDF(student: StudentData, schoolInfo: SchoolInfo) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const todayStr = formatDateIndonesian(new Date().toISOString());

  // 1. Kop Header
  drawKopHeader(doc, schoolInfo);

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('SURAT KETERANGAN HASIL TES DIAGNOSTIK & KELULUSAN', 105, 38, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`SISTEM PENERIMAAN MURID BARU (SPMB) T.P. ${schoolInfo.academicYear || '2027/2028'}`, 105, 43, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Nomor: 421.3/095/PAN-SPMB/SMP-AH/2027', 105, 47.5, { align: 'center' });

  // Divider
  doc.setLineWidth(0.4);
  doc.setDrawColor(203, 213, 225);
  doc.line(15, 50, 195, 50);

  // Opening text
  let curY = 56;
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    'Panitia Sistem Penerimaan Murid Baru (SPMB) SMP Al-Hadiid Cileungsi menerangkan bahwa calon peserta didik berikut:',
    15,
    curY
  );

  // Student Info Box
  curY += 4;
  doc.setFillColor(248, 250, 252);
  doc.rect(15, curY, 180, 25, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(15, curY, 180, 25, 'D');

  const infoList: [string, string, string, string][] = [
    ['Nomor Registrasi', student.registrationNumber || '-', 'NISN', student.nisn || '-'],
    ['Nama Calon Peserta', (student.fullName || '-').toUpperCase(), 'Jenis Kelamin', (student.gender || 'Laki-laki').toUpperCase()],
    ['Sekolah Asal', (student.previousSchoolName || '-').toUpperCase(), 'TTL', `${student.birthPlace || '-'}, ${formatDateIndonesian(student.birthDate)}`],
  ];

  let infoY = curY + 5;
  infoList.forEach(([l1, v1, l2, v2]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(l1, 18, infoY);
    doc.text(':', 48, infoY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(v1.substring(0, 30), 51, infoY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(l2, 110, infoY);
    doc.text(':', 135, infoY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(v2.substring(0, 30), 138, infoY);

    infoY += 6.5;
  });

  // Table of Exam Scores
  curY += 31;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('RINCIAN PEROLEHAN SKOR UJIAN / TES DIAGNOSTIK:', 15, curY);

  curY += 4;
  // Table Header
  doc.setFillColor(15, 23, 42);
  doc.rect(15, curY, 180, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('NO', 18, curY + 4.8);
  doc.text('MATA UJI / KOMPONEN TES', 30, curY + 4.8);
  doc.text('BOBOT', 112, curY + 4.8);
  doc.text('NILAI (0-100)', 135, curY + 4.8);
  doc.text('KUALIFIKASI / PREDIKAT', 162, curY + 4.8);

  const diag = student.diagnosticScore ?? 0;
  const gen = student.generalScore ?? 0;
  const rel = student.religiousScore ?? 0;
  const fin = student.finalScore ?? 0;

  const scoreRows = [
    ['1', 'Tes Diagnostik Awal', '30%', String(diag), getScorePredicate(diag)],
    ['2', 'Tes Pengetahuan Umum (TPU)', '40%', String(gen), getScorePredicate(gen)],
    ['3', 'Tes Diniyyah & Baca Al-Qur\'an', '30%', String(rel), getScorePredicate(rel)],
  ];

  curY += 7;
  scoreRows.forEach((row, idx) => {
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.rect(15, curY, 180, 7, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, curY, 180, 7, 'D');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(row[0], 19, curY + 4.8);
    doc.text(row[1], 30, curY + 4.8);
    doc.text(row[2], 115, curY + 4.8);
    doc.setFont('helvetica', 'bold');
    doc.text(row[3], 142, curY + 4.8);
    doc.setFont('helvetica', 'normal');
    doc.text(row[4], 163, curY + 4.8);

    curY += 7;
  });

  // Highlighted Final Score Row
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.rect(15, curY, 180, 8, 'F');
  doc.setDrawColor(16, 185, 129); // emerald-500
  doc.setLineWidth(0.4);
  doc.rect(15, curY, 180, 8, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(6, 78, 59); // emerald-900
  doc.text('NILAI AKHIR KUMULATIF (RATA-RATA BERBOBOT)', 30, curY + 5.5);
  doc.text('100%', 114, curY + 5.5);
  doc.setFontSize(10);
  doc.setTextColor(4, 120, 87);
  doc.text(String(fin), 142, curY + 5.5);
  doc.setFontSize(8.5);
  doc.text(getScorePredicate(fin), 163, curY + 5.5);

  // DECISION BANNER
  curY += 14;
  const isPassed = student.status === 'passed' || student.status === 'class_assigned' || student.status === 're_registered' || student.status === 're_registration_paid' || student.status === 'completed';
  const isFailed = student.status === 'failed';
  const isReserved = student.status === 'passed_reserved';

  if (isPassed) {
    doc.setFillColor(240, 253, 244); // emerald-50
    doc.setDrawColor(34, 197, 94);
    doc.rect(15, curY, 180, 24, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(21, 128, 61); // emerald-700
    doc.text('KEPUTUSAN: DINYATAKAN LULUS SELEKSI', 105, curY + 7, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(22, 101, 52);
    doc.text(
      'Selamat atas kelulusan Anda pada SPMB SMP Al-Hadiid Cileungsi. Silakan melanjutkan ke tahap',
      105,
      curY + 13,
      { align: 'center' }
    );
    doc.text(
      'Pembayaran Biaya Awal Masuk (Daftar Ulang) melalui portal SPMB untuk mengamankan kuota kelas.',
      105,
      curY + 18,
      { align: 'center' }
    );
  } else if (isFailed) {
    doc.setFillColor(255, 241, 242); // rose-50
    doc.setDrawColor(244, 63, 94);
    doc.rect(15, curY, 180, 24, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(190, 18, 60); // rose-700
    doc.text('KEPUTUSAN: BELUM LULUS (BERHAK UJIAN DIULANG / REMEDIAL)', 105, curY + 7, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(159, 18, 57);
    doc.text(
      'Berdasarkan evaluasi nilai, calon peserta didik belum mencapai batas nilai minimal kelulusan.',
      105,
      curY + 13,
      { align: 'center' }
    );
    doc.setFont('helvetica', 'bold');
    doc.text(
      'Sekolah memberikan KESEMPATAN UJIAN DIULANG (REMEDIAL) yang dapat diakses langsung pada Portal SPMB.',
      105,
      curY + 18,
      { align: 'center' }
    );
  } else if (isReserved) {
    doc.setFillColor(254, 252, 232); // amber-50
    doc.setDrawColor(245, 158, 11);
    doc.rect(15, curY, 180, 24, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(180, 83, 9);
    doc.text('KEPUTUSAN: DINYATAKAN LULUS CADANGAN', 105, curY + 7, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(146, 64, 14);
    doc.text(
      'Calon murid dinyatakan Lulus Cadangan dan akan diprioritaskan apabila kuota rombel reguler',
      105,
      curY + 13,
      { align: 'center' }
    );
    doc.text(
      'tersedia setelah batas akhir daftar ulang gelombang berjalan selesai.',
      105,
      curY + 18,
      { align: 'center' }
    );
  } else {
    doc.setFillColor(241, 245, 249); // slate-100
    doc.setDrawColor(148, 163, 184);
    doc.rect(15, curY, 180, 24, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text('STATUS: TES TELAH SELESAI / MENUNGGU SIDANG KELULUSAN', 105, curY + 7, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(
      'Data hasil tes online telah terekam dalam sistem dan sedang dalam proses verifikasi akhir panitia SPMB.',
      105,
      curY + 13,
      { align: 'center' }
    );
    doc.text(
      'Pengumuman resmi status kelulusan akan diumumkan melalui portal SPMB ini.',
      105,
      curY + 18,
      { align: 'center' }
    );
  }

  // Remedial Notes if applicable
  if (student.retestCount && student.retestCount > 0) {
    curY += 27;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Catatan: Calon peserta didik telah mengikuti Ujian Ulang (Remedial) sebanyak ${student.retestCount} kali.`, 15, curY);
    curY += 2;
  } else {
    curY += 27;
  }

  // Signatures
  curY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(`Cileungsi, ${todayStr}`, 140, curY);
  doc.text('Mengetahui,', 25, curY + 4);
  doc.text('Kepala SMP Al-Hadiid,', 25, curY + 8);
  doc.text('Ketua Panitia SPMB,', 140, curY + 8);

  curY += 28;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const kepsekName = getKepalaSekolahName(schoolInfo);
  doc.text(`( ${kepsekName} )`, 25, curY);
  doc.text('( Panitia SPMB SMP Al-Hadiid )', 140, curY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  if (schoolInfo?.headmasterNiy) {
    doc.text(`NIY. ${schoolInfo.headmasterNiy}`, 25, curY + 4);
  } else {
    doc.text('Kepala Sekolah SMP Al-Hadiid', 25, curY + 4);
  }
  doc.text('Stempel Resmi SPMB 2027/2028', 140, curY + 4);

  // Save PDF
  const safeReg = student.registrationNumber || 'NO-REG';
  const safeName = (student.fullName || 'Calon_Murid').replace(/\s+/g, '_');
  doc.save(`Hasil_Ujian_SPMB_${safeReg}_${safeName}.pdf`);
}

