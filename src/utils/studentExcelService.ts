import * as XLSX from 'xlsx';
import { StudentData, SchoolInfo } from '../types';

export interface ParsedStudentRow {
  rowNumber: number;
  data: Partial<StudentData>;
  isValid: boolean;
  isDuplicate: boolean;
  errors: string[];
  warnings: string[];
  originalRow: Record<string, any>;
}

export interface StudentExcelParseResult {
  totalRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  rows: ParsedStudentRow[];
  readyStudents: StudentData[];
}

/**
 * Format tanggal ke standar YYYY-MM-DD
 */
function normalizeDateString(rawVal: any): string {
  if (!rawVal) return '2013-01-01';

  // Jika date object atau number (Excel serial date)
  if (typeof rawVal === 'number') {
    try {
      const dateObj = XLSX.SSF.parse_date_code(rawVal);
      if (dateObj) {
        const y = String(dateObj.y).padStart(4, '0');
        const m = String(dateObj.m).padStart(2, '0');
        const d = String(dateObj.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch {}
  }

  const str = String(rawVal).trim();
  if (!str) return '2013-01-01';

  // Format DD/MM/YYYY atau DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // Format YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '2013-01-01';
}

/**
 * Normalisasi jenis kelamin ke 'Laki-laki' | 'Perempuan'
 */
function normalizeGender(rawVal: any): 'Laki-laki' | 'Perempuan' {
  if (!rawVal) return 'Laki-laki';
  const s = String(rawVal).trim().toLowerCase();
  if (s.startsWith('p') || s.includes('wanita') || s.includes('perempuan') || s.includes('akhwat')) {
    return 'Perempuan';
  }
  return 'Laki-laki';
}

/**
 * Buat nomor registrasi acak unik format SPMB2027XXXX
 */
export function generateStudentRegistrationNumber(existingNumbers: Set<string>): string {
  let reg = '';
  let attempts = 0;
  do {
    const rand = Math.floor(1000 + Math.random() * 9000);
    reg = `SPMB2027${rand}`;
    attempts++;
  } while (existingNumbers.has(reg) && attempts < 100);
  existingNumbers.add(reg);
  return reg;
}

/**
 * Helper pencarian kolom secara fleksibel (case-insensitive & alias)
 */
function findRowValue(row: Record<string, any>, aliases: string[]): string {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const cleanAlias = alias.toLowerCase().replace(/[\s_\-]/g, '');
    for (const k of keys) {
      const cleanKey = k.toLowerCase().replace(/[\s_\-]/g, '');
      if (cleanKey === cleanAlias) {
        const val = row[k];
        if (val !== undefined && val !== null) {
          return String(val).trim();
        }
      }
    }
  }
  return '';
}

/**
 * 1. PARSING FILE EXCEL CALON MURID
 */
export async function parseStudentsFromExcel(
  file: File,
  existingStudents: StudentData[]
): Promise<StudentExcelParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  // Pilih sheet data (prioritaskan 'Data_Calon_Murid', 'Data Murid', atau sheet pertama)
  const targetSheetName =
    workbook.SheetNames.find(
      (n) =>
        n.toLowerCase().includes('calon') ||
        n.toLowerCase().includes('murid') ||
        n.toLowerCase().includes('siswa') ||
        n.toLowerCase().includes('pendaftar')
    ) || workbook.SheetNames[0];

  const worksheet = workbook.Sheets[targetSheetName];
  const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const existingRegNumbers = new Set<string>(existingStudents.map((s) => s.registrationNumber?.toUpperCase() || ''));
  const existingEmails = new Set<string>(existingStudents.map((s) => s.userEmail?.toLowerCase() || ''));
  const existingPhones = new Set<string>(existingStudents.map((s) => s.phone || ''));

  const parsedRows: ParsedStudentRow[] = [];
  const readyStudents: StudentData[] = [];

  jsonRows.forEach((row, idx) => {
    const rowNumber = idx + 2; // Row 1 is header

    // Cari nilai berdasarkan variasi nama kolom
    const fullName = findRowValue(row, [
      'nama_lengkap', 'namalengkap', 'nama', 'nama_siswa', 'namasiswa', 'student_name', 'full_name'
    ]);
    const regNoRaw = findRowValue(row, [
      'no_pendaftaran', 'nopendaftaran', 'no_reg', 'noreg', 'nomor_pendaftaran', 'registration_number', 'no_peserta'
    ]);
    const genderRaw = findRowValue(row, [
      'jenis_kelamin', 'jeniskelamin', 'jk', 'gender', 'sex'
    ]);
    const phone = findRowValue(row, [
      'no_hp_ortu', 'nohportu', 'no_hp', 'nohp', 'no_whatsapp', 'telepon', 'phone', 'wa'
    ]);
    const emailRaw = findRowValue(row, [
      'email', 'user_email', 'surel', 'email_akun'
    ]);
    const nik = findRowValue(row, ['nik', 'no_nik', 'nomor_nik', 'ktp']);
    const nisn = findRowValue(row, ['nisn', 'nomor_nisn']);
    const birthPlace = findRowValue(row, ['tempat_lahir', 'tempatlahir', 'birth_place', 'kota_lahir']);
    const birthDateRaw = findRowValue(row, ['tanggal_lahir', 'tanggallahir', 'tgl_lahir', 'birth_date']);
    const school = findRowValue(row, [
      'sekolah_asal', 'sekolahasal', 'asal_sekolah', 'asalsekolah', 'previous_school', 'sd_asal'
    ]);
    const address = findRowValue(row, ['alamat', 'alamat_lengkap', 'address', 'domisili']);
    const village = findRowValue(row, ['desa_kelurahan', 'kelurahan', 'desa', 'village']);
    const subdistrict = findRowValue(row, ['kecamatan', 'subdistrict']);
    const city = findRowValue(row, ['kota_kabupaten', 'kabupaten', 'kota', 'city']);
    const province = findRowValue(row, ['provinsi', 'province']);
    const postalCode = findRowValue(row, ['kode_pos', 'kodepos', 'postal_code']);

    // Data Orang Tua
    const fatherName = findRowValue(row, ['nama_ayah', 'namaayah', 'ayah', 'father_name']);
    const fatherJob = findRowValue(row, ['pekerjaan_ayah', 'pekerjaanayah', 'job_ayah']);
    const fatherPhone = findRowValue(row, ['no_hp_ayah', 'nohpayah', 'hp_ayah', 'telepon_ayah']);
    const motherName = findRowValue(row, ['nama_ibu', 'namaibu', 'ibu', 'mother_name']);
    const motherJob = findRowValue(row, ['pekerjaan_ibu', 'pekerjaanibu', 'job_ibu']);
    const motherPhone = findRowValue(row, ['no_hp_ibu', 'nohpibu', 'hp_ibu', 'telepon_ibu']);

    // Status pendaftaran
    const statusRaw = findRowValue(row, ['status_pendaftaran', 'status', 'status_spmb']);
    const formPaymentStatusRaw = findRowValue(row, ['status_bayar_formulir', 'bayar_formulir', 'form_payment']);

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validasi Wajib
    if (!fullName) {
      errors.push('Nama lengkap siswa kosong');
    }

    // Normalisasi Gender
    const gender = normalizeGender(genderRaw);

    // Normalisasi Tanggal Lahir
    const birthDate = normalizeDateString(birthDateRaw);

    // Nomor Pendaftaran
    let regNo = regNoRaw.toUpperCase();
    let isDuplicate = false;

    if (!regNo) {
      regNo = generateStudentRegistrationNumber(existingRegNumbers);
      warnings.push(`Nomor pendaftaran otomatis digenerate: ${regNo}`);
    } else {
      if (existingRegNumbers.has(regNo)) {
        isDuplicate = true;
        warnings.push(`Nomor pendaftaran ${regNo} sudah terdaftar di database (akan diupdate).`);
      } else {
        existingRegNumbers.add(regNo);
      }
    }

    // Email Akun
    let email = emailRaw.toLowerCase();
    if (!email) {
      email = `${regNo.toLowerCase()}@spmb.alhadiid.sch.id`;
    } else if (existingEmails.has(email) && !isDuplicate) {
      warnings.push(`Email ${email} sudah digunakan oleh calon murid lain.`);
    }

    // ID Unik Siswa
    const studentId = `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Normalisasi Status Pendaftaran
    let admissionStatus = (statusRaw.toLowerCase() as any) || 'form_submitted';
    if (!['draft', 'pending_payment', 'verifying_payment', 'filling_form', 'form_submitted', 'form_verified', 'scheduled_test', 'test_completed', 'passed', 'class_assigned'].includes(admissionStatus)) {
      admissionStatus = 'form_submitted';
    }

    let formPaymentStatus: 'unpaid' | 'pending' | 'verified' | 'rejected' = 'verified';
    if (formPaymentStatusRaw.toLowerCase().includes('belum') || formPaymentStatusRaw.toLowerCase().includes('unpaid')) {
      formPaymentStatus = 'unpaid';
    } else if (formPaymentStatusRaw.toLowerCase().includes('verif') || formPaymentStatusRaw.toLowerCase().includes('lunas')) {
      formPaymentStatus = 'verified';
    }

    const initialPaymentStatusRaw = findRowValue(row, ['status_daftar_ulang', 'status_bam', 'bayar_daftar_ulang', 'initial_payment', 'daftar_ulang']);
    let initialPaymentStatus: 'unpaid' | 'pending' | 'verified' | 'rejected' = 'unpaid';
    if (initialPaymentStatusRaw.toLowerCase().includes('lunas') || initialPaymentStatusRaw.toLowerCase().includes('verif')) {
      initialPaymentStatus = 'verified';
    } else if (initialPaymentStatusRaw.toLowerCase().includes('pending') || initialPaymentStatusRaw.toLowerCase().includes('tunggu')) {
      initialPaymentStatus = 'pending';
    }

    const studentRecord: StudentData = {
      id: studentId,
      registrationNumber: regNo,
      status: admissionStatus,
      userEmail: email,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fullName,
      phone: phone || '081234567890',
      formPaymentAmount: 200000,
      formPaymentStatus,
      isFormVerified: formPaymentStatus === 'verified',
      initialPaymentAmount: 0,
      initialPaymentStatus,
      nik: nik || '3201010000000000',
      nisn: nisn || '',
      birthPlace: birthPlace || 'Bogor',
      birthDate,
      gender,
      religion: 'Islam',
      address: address || 'Jl. Melati Cileungsi',
      village: village || 'Cileungsi Indah',
      subdistrict: subdistrict || 'Cileungsi',
      city: city || 'Kabupaten Bogor',
      province: province || 'Jawa Barat',
      postalCode: postalCode || '16820',
      previousSchoolName: school || 'SD/MI Sederajat',
      fatherName: fatherName || 'Ayah',
      fatherEducation: 'SMA / Sederajat',
      fatherJob: fatherJob || 'Karyawan Swasta',
      fatherPhone: fatherPhone || phone || '081234567890',
      motherName: motherName || 'Ibu',
      motherJob: motherJob || 'Ibu Rumah Tangga',
      motherPhone: motherPhone || phone || '081234567890',
    };

    const isValid = errors.length === 0;

    parsedRows.push({
      rowNumber,
      data: studentRecord,
      isValid,
      isDuplicate,
      errors,
      warnings,
      originalRow: row,
    });

    if (isValid) {
      readyStudents.push(studentRecord);
    }
  });

  const validCount = parsedRows.filter((r) => r.isValid && !r.isDuplicate).length;
  const warningCount = parsedRows.filter((r) => r.isDuplicate || r.warnings.length > 0).length;
  const errorCount = parsedRows.filter((r) => !r.isValid).length;

  return {
    totalRows: parsedRows.length,
    validCount,
    warningCount,
    errorCount,
    rows: parsedRows,
    readyStudents,
  };
}

/**
 * 2. UNDUH TEMPLATE EXCEL CALON MURID (.XLSX)
 */
export function downloadStudentExcelTemplate(schoolInfo?: SchoolInfo) {
  const academicYear = schoolInfo?.academicYear || '2027/2028';

  // Sheet 1: Data Calon Murid
  const templateHeaders = [
    'No_Pendaftaran',
    'Nama_Lengkap',
    'Jenis_Kelamin',
    'NISN',
    'NIK',
    'Tempat_Lahir',
    'Tanggal_Lahir',
    'Sekolah_Asal',
    'No_HP_Ortu',
    'Email',
    'Alamat',
    'Desa_Kelurahan',
    'Kecamatan',
    'Kota_Kabupaten',
    'Nama_Ayah',
    'No_HP_Ayah',
    'Nama_Ibu',
    'No_HP_Ibu',
    'Status_Pendaftaran',
    'Status_Bayar_Formulir',
  ];

  const sampleRows = [
    [
      'SPMB20270001',
      'Muhammad Fatih Al-Ayyubi',
      'Laki-laki',
      '0123456789',
      '3201011205120001',
      'Bogor',
      '2012-05-12',
      'SDIT Al-Hadiid',
      '081234567890',
      'fatih@example.com',
      'Jl. Melati No. 12',
      'Cileungsi Indah',
      'Cileungsi',
      'Kabupaten Bogor',
      'Ahmad Fauzi',
      '081234567890',
      'Siti Rahmah',
      '081298765432',
      'form_submitted',
      'verified',
    ],
    [
      'SPMB20270002',
      'Aisyah Humaira Putri',
      'Perempuan',
      '0123456790',
      '3201015509120002',
      'Jakarta',
      '2012-09-15',
      'SDN Cileungsi 01',
      '081398765432',
      'aisyah@example.com',
      'Perum Griya Alam Sentosa Blok A1',
      'Pasir Angin',
      'Cileungsi',
      'Kabupaten Bogor',
      'Bambang Pratama',
      '081398765432',
      'Nurul Hasanah',
      '081312345678',
      'form_submitted',
      'verified',
    ],
  ];

  const wsData = XLSX.utils.aoa_to_sheet([templateHeaders, ...sampleRows]);

  // Styling Column widths
  wsData['!cols'] = [
    { wch: 18 }, // No_Pendaftaran
    { wch: 28 }, // Nama_Lengkap
    { wch: 15 }, // Jenis_Kelamin
    { wch: 14 }, // NISN
    { wch: 20 }, // NIK
    { wch: 16 }, // Tempat_Lahir
    { wch: 14 }, // Tanggal_Lahir
    { wch: 24 }, // Sekolah_Asal
    { wch: 16 }, // No_HP_Ortu
    { wch: 26 }, // Email
    { wch: 32 }, // Alamat
    { wch: 18 }, // Desa_Kelurahan
    { wch: 16 }, // Kecamatan
    { wch: 18 }, // Kota_Kabupaten
    { wch: 22 }, // Nama_Ayah
    { wch: 16 }, // No_HP_Ayah
    { wch: 22 }, // Nama_Ibu
    { wch: 16 }, // No_HP_Ibu
    { wch: 20 }, // Status_Pendaftaran
    { wch: 22 }, // Status_Bayar_Formulir
  ];

  // Sheet 2: Petunjuk Pengisian
  const instructions = [
    ['PANDUAN & PETUNJUK PENGISIAN TEMPLATE IMPORT CALON MURID'],
    ['SMP AL-HADIID CILEUNGSI - TP ' + academicYear],
    [''],
    ['KOLOM', 'SIFAT', 'FORMAT / CONTOH', 'KETERANGAN'],
    ['Nama_Lengkap', 'WAJIB', 'Muhammad Fatih Al-Ayyubi', 'Nama lengkap calon murid sesuai akta lahir/ijazah.'],
    ['Jenis_Kelamin', 'WAJIB', 'Laki-laki / Perempuan (atau L / P)', 'Jenis kelamin calon murid.'],
    ['No_Pendaftaran', 'OPSIONAL', 'SPMB20270001', 'Jika kosong, sistem akan otomatis menerbitkan nomor unik.'],
    ['Tanggal_Lahir', 'OPSIONAL', '2012-05-12 atau 12/05/2012', 'Format YYYY-MM-DD atau DD/MM/YYYY.'],
    ['No_HP_Ortu', 'DISARANKAN', '081234567890', 'Nomor WhatsApp aktif orang tua/wali murid.'],
    ['Email', 'OPSIONAL', 'fatih@example.com', 'Jika kosong, sistem akan otomatis membuatkan email default.'],
    ['NIK', 'OPSIONAL', '3201011205120001', 'Nomor Induk Kependudukan (16 digit).'],
    ['NISN', 'OPSIONAL', '0123456789', 'Nomor Induk Siswa Nasional dari sekolah asal.'],
    ['Sekolah_Asal', 'OPSIONAL', 'SDIT Al-Hadiid', 'Nama SD/MI asal calon murid.'],
    ['Status_Pendaftaran', 'OPSIONAL', 'form_submitted', 'Pilihan: form_submitted, verified, scheduled_test, passed.'],
    ['Status_Bayar_Formulir', 'OPSIONAL', 'verified', 'Pilihan: verified (Lunas Rp 200rb) atau unpaid (Belum bayar).'],
    [''],
    ['Catatan Keamanan:', '', '', ''],
    ['- Format file harus berekstensi .xlsx, .xls, atau .csv.'],
    ['- Jangan mengubah nama baris header kolom pada Sheet pertama.'],
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
  wsInstructions['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 32 }, { wch: 50 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, wsData, 'Data_Calon_Murid');
  XLSX.utils.book_append_sheet(workbook, wsInstructions, 'Petunjuk_Pengisian');

  const cleanYear = academicYear.replace('/', '_');
  XLSX.writeFile(workbook, `Template_Import_Calon_Murid_SPMB_${cleanYear}.xlsx`);
}

/**
 * 3. EXPORT DATA CALON MURID KE EXCEL (.XLSX) DENGAN METADATA RESMI
 */
export function exportStudentsToExcel(
  students: StudentData[],
  schoolInfo: SchoolInfo,
  options?: {
    customFilename?: string;
    filterLabel?: string;
  }
) {
  const academicYear = schoolInfo.academicYear || '2027/2028';
  const printDate = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const printTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  // Siapkan header atas laporan
  const headerRows: any[][] = [
    ['LAPORAN DATA CALON MURID SPMB ONLINE'],
    ['SMP AL-HADIID CILEUNGSI'],
    [`Tahun Pelajaran: ${academicYear}`],
    [`Tanggal Cetak: ${printDate} pukul ${printTime} WIB`],
  ];

  if (options?.filterLabel) {
    headerRows.push([`Kategori Filter: ${options.filterLabel}`]);
  }
  headerRows.push([`Total Data: ${students.length} Calon Murid`]);
  headerRows.push([]); // Baris kosong pemisah

  const dataRows = students.map((s, idx) => ({
    No_Urut: idx + 1,
    No_Pendaftaran: s.registrationNumber,
    Nama_Lengkap_Siswa: s.fullName,
    Jenis_Kelamin: s.gender,
    NIK: s.nik || '-',
    NISN: s.nisn || '-',
    Tempat_Lahir: s.birthPlace || '-',
    Tanggal_Lahir: s.birthDate || '-',
    Asal_Sekolah: s.previousSchoolName || '-',
    No_WhatsApp_HP: s.phone || '-',
    Email_Akun: s.userEmail || '-',
    Alamat_Lengkap: s.address || '-',
    Desa_Kelurahan: s.village || '-',
    Kecamatan: s.subdistrict || '-',
    Kota_Kabupaten: s.city || '-',
    Provinsi: s.province || '-',
    Kode_Pos: s.postalCode || '-',
    Nama_Ayah: s.fatherName || '-',
    Pekerjaan_Ayah: s.fatherJob || '-',
    No_HP_Ayah: s.fatherPhone || '-',
    Nama_Ibu: s.motherName || '-',
    Pekerjaan_Ibu: s.motherJob || '-',
    No_HP_Ibu: s.motherPhone || '-',
    Status_Pendaftaran: s.status,
    Verifikasi_Formulir: s.isFormVerified ? 'Terverifikasi' : 'Belum Terverifikasi',
    Biaya_Formulir: s.formPaymentStatus === 'verified' ? 'Lunas (Rp 200.000)' : s.formPaymentStatus === 'pending' ? 'Menunggu Verifikasi' : 'Belum Bayar',
    Biaya_Awal_Masuk_BAM: s.initialPaymentStatus === 'verified' ? 'Lunas / Sesuai Cicilan' : s.initialPaymentStatus === 'pending' ? 'Verifikasi Berkas' : 'Belum Bayar',
    Nilai_Diagnostik: s.diagnosticScore ?? '-',
    Nilai_TPU: s.generalScore ?? '-',
    Nilai_Diniyyah: s.religiousScore ?? '-',
    Nilai_Akhir: s.finalScore ?? '-',
    Status_Kelulusan: s.status === 'passed' ? 'LULUS' : s.status === 'failed' ? 'TIDAK LULUS' : s.status === 'passed_reserved' ? 'CADANGAN' : 'BELUM DITENTUKAN',
    Kelas_Penempatan: s.assignedClassName || '-',
    Tanggal_Pendaftaran: s.createdAt ? new Date(s.createdAt).toLocaleDateString('id-ID') : '-',
  }));

  const worksheet = XLSX.utils.aoa_to_sheet(headerRows);
  XLSX.utils.sheet_add_json(worksheet, dataRows, { origin: -1 });

  // Column width formatting
  worksheet['!cols'] = [
    { wch: 8 },  // No_Urut
    { wch: 16 }, // No_Pendaftaran
    { wch: 28 }, // Nama_Lengkap_Siswa
    { wch: 14 }, // Jenis_Kelamin
    { wch: 18 }, // NIK
    { wch: 14 }, // NISN
    { wch: 16 }, // Tempat_Lahir
    { wch: 14 }, // Tanggal_Lahir
    { wch: 26 }, // Asal_Sekolah
    { wch: 16 }, // No_WhatsApp_HP
    { wch: 26 }, // Email_Akun
    { wch: 32 }, // Alamat_Lengkap
    { wch: 18 }, // Desa_Kelurahan
    { wch: 16 }, // Kecamatan
    { wch: 18 }, // Kota_Kabupaten
    { wch: 16 }, // Provinsi
    { wch: 10 }, // Kode_Pos
    { wch: 22 }, // Nama_Ayah
    { wch: 18 }, // Pekerjaan_Ayah
    { wch: 16 }, // No_HP_Ayah
    { wch: 22 }, // Nama_Ibu
    { wch: 18 }, // Pekerjaan_Ibu
    { wch: 16 }, // No_HP_Ibu
    { wch: 18 }, // Status_Pendaftaran
    { wch: 20 }, // Verifikasi_Formulir
    { wch: 22 }, // Biaya_Formulir
    { wch: 22 }, // Biaya_Awal_Masuk_BAM
    { wch: 14 }, // Nilai_Diagnostik
    { wch: 12 }, // Nilai_TPU
    { wch: 14 }, // Nilai_Diniyyah
    { wch: 12 }, // Nilai_Akhir
    { wch: 18 }, // Status_Kelulusan
    { wch: 18 }, // Kelas_Penempatan
    { wch: 18 }, // Tanggal_Pendaftaran
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data_Calon_Murid');

  const defaultFilename = `Data_Calon_Murid_SPMB_SMP_AlHadiid_${academicYear.replace('/', '_')}.xlsx`;
  const filename = options?.customFilename || defaultFilename;
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
