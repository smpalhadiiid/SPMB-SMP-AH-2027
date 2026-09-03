import { jsPDF } from 'jspdf';
import { StudentData, SchoolInfo } from '../types';

function drawKopHeader(doc: jsPDF, schoolInfo: SchoolInfo) {
  // Draw Uploaded School Logo on Top Left of Kop Header
  if (schoolInfo.logoUrl) {
    try {
      const isJpeg = schoolInfo.logoUrl.includes('image/jpeg') || schoolInfo.logoUrl.includes('image/jpg');
      const format = isJpeg ? 'JPEG' : 'PNG';
      doc.addImage(schoolInfo.logoUrl, format, 16, 7, 22, 22);
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
  doc.text((schoolInfo.name || 'SMP AL-HADIID CILEUNGSI').toUpperCase(), 105, 16.5, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(50, 50, 50);
  doc.text(`Alamat : ${schoolInfo.address || 'Jl. Melati 1 Perumahan Cileungsi Indah, Cileungsi Kabupaten Bogor 16820'}`, 105, 21, { align: 'center' });
  doc.text(`Telp. ${schoolInfo.phone || '021-82493659'} Email : ${schoolInfo.email || 'smpalhadiid@gmail.com'}`, 105, 25, { align: 'center' });
  doc.text(`Website : ${schoolInfo.website || 'https://alhadiid.or.id/smp-alhadiid/'}`, 105, 29, { align: 'center' });

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
  doc.save(`Formulir_SPMB_${student.registrationNumber}_${student.fullName.replace(/\s+/g, '_')}.pdf`);
}

export function generateReportPDF(title: string, data: any[], columns: string[]) {
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

  doc.save(`Laporan_SPMB_${title.replace(/\s+/g, '_')}.pdf`);
}

