import { StudentData, SchoolInfo } from '../types';

/**
 * Utilitas Pengumuman WhatsApp SPMB SMP Al-Hadiid Cileungsi
 * Membersihkan format nomor telepon dan menyusun pesan pengumuman resmi ke orang tua / wali.
 */

export interface ParentContactInfo {
  role: 'Ayah' | 'Ibu' | 'Wali' | 'Murid';
  name: string;
  phone: string;
  cleanPhone: string;
  isValid: boolean;
}

export type WhatsAppTemplateKey =
  | 'passed'
  | 'passed_reserved'
  | 'failed'
  | 'retest'
  | 'test_schedule'
  | 'payment_reminder'
  | 'class_placement'
  | 'custom';

export interface WhatsAppTemplate {
  key: WhatsAppTemplateKey;
  title: string;
  category: 'Kelulusan' | 'Tes Seleksi' | 'Pembayaran' | 'Rombel' | 'Umum';
  description: string;
  defaultMessage: string;
}

/**
 * Normalisasi nomor WhatsApp ke standar internasional Indonesia (62xxx)
 */
export function cleanWhatsAppNumber(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  let cleaned = String(rawPhone).replace(/[^0-9]/g, '');
  if (!cleaned) return '';

  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  } else if (cleaned.startsWith('62')) {
    // Already in 62 format
  } else if (cleaned.length >= 9 && !cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }

  // Indonesian mobile numbers are typically 10 to 14 digits (628xxxxxxxx)
  if (cleaned.length < 10 || !cleaned.startsWith('628')) {
    return '';
  }

  return cleaned;
}

/**
 * Memilih kontak orang tua / wali murid terbaik dari data siswa
 */
export function getAvailableParentContacts(student: StudentData): ParentContactInfo[] {
  const contacts: ParentContactInfo[] = [];

  // 1. Ayah
  const fatherClean = cleanWhatsAppNumber(student.fatherPhone);
  if (student.fatherPhone || student.fatherName) {
    contacts.push({
      role: 'Ayah',
      name: student.fatherName || 'Bapak Wali Murid',
      phone: student.fatherPhone || '',
      cleanPhone: fatherClean,
      isValid: !!fatherClean,
    });
  }

  // 2. Ibu
  const motherClean = cleanWhatsAppNumber(student.motherPhone);
  if (student.motherPhone || student.motherName) {
    contacts.push({
      role: 'Ibu',
      name: student.motherName || 'Ibu Wali Murid',
      phone: student.motherPhone || '',
      cleanPhone: motherClean,
      isValid: !!motherClean,
    });
  }

  // 3. Wali (jika diisi)
  if (student.guardianName || student.guardianPhone) {
    const guardianClean = cleanWhatsAppNumber(student.guardianPhone);
    contacts.push({
      role: 'Wali',
      name: student.guardianName || 'Wali Murid',
      phone: student.guardianPhone || '',
      cleanPhone: guardianClean,
      isValid: !!guardianClean,
    });
  }

  // 4. Nomor Murid (cadangan)
  const studentClean = cleanWhatsAppNumber(student.phone);
  if (student.phone) {
    contacts.push({
      role: 'Murid',
      name: student.fullName,
      phone: student.phone || '',
      cleanPhone: studentClean,
      isValid: !!studentClean,
    });
  }

  return contacts;
}

/**
 * Mendapatkan kontak orang tua utama yang valid (Prioritas: Ayah -> Ibu -> Wali -> Murid)
 */
export function getPrimaryParentContact(student: StudentData): ParentContactInfo {
  const allContacts = getAvailableParentContacts(student);
  const validContact = allContacts.find(c => c.isValid);
  if (validContact) return validContact;

  // Fallback jika belum ada nomor valid
  return {
    role: 'Ayah',
    name: student.fatherName || student.motherName || 'Bapak/Ibu Wali Murid',
    phone: student.fatherPhone || student.motherPhone || student.phone || '',
    cleanPhone: cleanWhatsAppNumber(student.fatherPhone || student.motherPhone || student.phone),
    isValid: false,
  };
}

/**
 * Daftar template pesan resmi SPMB SMP Al-Hadiid Cileungsi
 */
export const WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    key: 'passed',
    title: 'Pengumuman Kelulusan (LULUS)',
    category: 'Kelulusan',
    description: 'Pemberitahuan resmi bahwa calon murid dinyatakan Lulus seleksi penerimaan murid baru.',
    defaultMessage: `*PENGUMUMAN HASIL SELEKSI SPMB {{NAMA_SEKOLAH}}*
*TAHUN AJARAN {{TAHUN_AJARAN}}*

_Assalamu'alaikum Warahmatullahi Wabarakatuh_

Yth. *{{NAMA_WALI}}*, orang tua/wali dari:
Nama Siswa: *{{NAMA_SISWA}}*
No. Registrasi: *{{NO_REGISTRASI}}*
Nilai Akhir Seleksi: *{{NILAI_AKHIR}}*

Alhamdulillah wa syukurillah, kami Panitia Penerimaan Murid Baru (SPMB) {{NAMA_SEKOLAH}} mengumumkan bahwa ananda dinyatakan:

🎉 *D I N Y A T A K A N   L U L U S* 🎉

Selamat atas keberhasilan ananda. Tahap selanjutnya adalah proses *Daftar Ulang (Penyelesaian Biaya Awal Masuk)* agar hak kursi rombongan belajar ananda terkunci.

Informasi rincian biaya dan formulir daftar ulang dapat diakses melalui portal SPMB:
🌐 {{LINK_PORTAL}}

Jika ada pertanyaan atau konfirmasi, silakan hubungi Panitia SPMB di nomor ini.

_Wassalamu'alaikum Warahmatullahi Wabarakatuh_
*Panitia SPMB {{NAMA_SEKOLAH}}*`,
  },
  {
    key: 'passed_reserved',
    title: 'Pengumuman Cadangan (WAITING LIST)',
    category: 'Kelulusan',
    description: 'Pemberitahuan bahwa ananda berstatus cadangan dan menanti kuota pelimpahan.',
    defaultMessage: `*PENGUMUMAN HASIL SELEKSI SPMB {{NAMA_SEKOLAH}}*
*TAHUN AJARAN {{TAHUN_AJARAN}}*

_Assalamu'alaikum Warahmatullahi Wabarakatuh_

Yth. *{{NAMA_WALI}}*, orang tua/wali dari:
Nama Siswa: *{{NAMA_SISWA}}*
No. Registrasi: *{{NO_REGISTRASI}}*
Nilai Akhir Seleksi: *{{NILAI_AKHIR}}*

Berdasarkan hasil rapat pleno seleksi SPMB {{NAMA_SEKOLAH}}, kami menginformasikan bahwa ananda dinyatakan:

📌 *STATUS: CADANGAN (WAITING LIST)* 📌

Ananda berada dalam antrean pemanggilan kuota berikutnya apabila terdapat pendaftar utama yang mengundurkan diri hingga batas akhir daftar ulang.

Panitia akan menghubungi Bapak/Ibu segera setelah ada kuota kelas yang tersedia. Bapak/Ibu juga dapat memantau status secara berkala melalui:
🌐 {{LINK_PORTAL}}

Terima kasih atas kepercayaan dan antusiasme Bapak/Ibu kepada {{NAMA_SEKOLAH}}.

_Wassalamu'alaikum Warahmatullahi Wabarakatuh_
*Panitia SPMB {{NAMA_SEKOLAH}}*`,
  },
  {
    key: 'failed',
    title: 'Pengumuman Belum Lulus / Penawaran Remedial',
    category: 'Kelulusan',
    description: 'Pemberitahuan hasil seleksi belum memenuhi passing grade beserta opsi ujian remedial.',
    defaultMessage: `*INFORMASI HASIL SELEKSI SPMB {{NAMA_SEKOLAH}}*
*TAHUN AJARAN {{TAHUN_AJARAN}}*

_Assalamu'alaikum Warahmatullahi Wabarakatuh_

Yth. *{{NAMA_WALI}}*, orang tua/wali dari:
Nama Siswa: *{{NAMA_SISWA}}*
No. Registrasi: *{{NO_REGISTRASI}}*
Nilai Akhir: *{{NILAI_AKHIR}}*

Terima kasih atas partisipasi ananda dalam rangkaian tes seleksi SPMB {{NAMA_SEKOLAH}}. 

Berdasarkan batas passing grade nilai seleksi, saat ini nilai ananda *belum memenuhi kriteria kelulusan utama*.

Namun, Panitia SPMB memberikan kesempatan khusus berupa *Ujian Remedial / Tes Ulang* untuk memperbaiki nilai Diniyyah / Pengetahuan Umum ananda.

Bapak/Ibu dapat menghubungi panitia atau membuka dashboard akun ananda untuk petunjuk ujian ulang:
🌐 {{LINK_PORTAL}}

Tetap semangat dan optimis untuk ananda.

_Wassalamu'alaikum Warahmatullahi Wabarakatuh_
*Panitia SPMB {{NAMA_SEKOLAH}}*`,
  },
  {
    key: 'retest',
    title: 'Akses Ujian Remedial Telah Dibuka',
    category: 'Tes Seleksi',
    description: 'Pemberitahuan kepada orang tua bahwa ujian remedial CBT ananda telah diaktifkan oleh panitia.',
    defaultMessage: `*PEMBERITAHUAN AKSES UJIAN REMEDIAL (CBT)*
*{{NAMA_SEKOLAH}}*

_Assalamu'alaikum Warahmatullahi Wabarakatuh_

Yth. *{{NAMA_WALI}}*, orang tua/wali dari ananda *{{NAMA_SISWA}}* (No. Reg: *{{NO_REGISTRASI}}*).

Kami menginformasikan bahwa panitia telah *mengaktifkan akses Ujian Remedial (Tes Ulang CBT Online)* untuk ananda.

Silakan ananda login ke sistem CBT SPMB untuk mengulang pengerjaan soal seleksi:
🌐 {{LINK_PORTAL}}
Gunakan username/email dan password pendaftaran ananda.

Semoga ananda mendapatkan hasil terbaik pada kesempatan ujian ulang ini.

_Wassalamu'alaikum Warahmatullahi Wabarakatuh_
*Panitia SPMB {{NAMA_SEKOLAH}}*`,
  },
  {
    key: 'test_schedule',
    title: 'Pemberitahuan Jadwal Tes Seleksi CBT & Wawancara',
    category: 'Tes Seleksi',
    description: 'Pengingat jadwal dan tata tertib pelaksanaan tes seleksi calon murid baru.',
    defaultMessage: `*JADWAL TES SELEKSI SPMB {{NAMA_SEKOLAH}}*
*TAHUN AJARAN {{TAHUN_AJARAN}}*

_Assalamu'alaikum Warahmatullahi Wabarakatuh_

Yth. *{{NAMA_WALI}}*, orang tua/wali dari:
Nama Siswa: *{{NAMA_SISWA}}*
No. Registrasi: *{{NO_REGISTRASI}}*

Kami mengundang ananda untuk mengikuti rangkaian Tes Seleksi SPMB {{NAMA_SEKOLAH}} yang meliputi:
1. Tes Diagnostik Awal & Minat Bakat
2. Tes Pengetahuan Umum (TPU) CBT
3. Tes Diniyyah & Baca Al-Quran
4. Wawancara Calon Orang Tua

Harap memastikan ananda telah mempersiapkan perlengkapan dan login ke sistem:
🌐 {{LINK_PORTAL}}

Mohon hadir / siap 15 menit sebelum pelaksanaan. Terima kasih atas perhatian dan kerja sama Bapak/Ibu.

_Wassalamu'alaikum Warahmatullahi Wabarakatuh_
*Panitia SPMB {{NAMA_SEKOLAH}}*`,
  },
  {
    key: 'payment_reminder',
    title: 'Pengingat Daftar Ulang & Biaya Masuk (BAM)',
    category: 'Pembayaran',
    description: 'Pengingat batas waktu penyelesaian biaya daftar ulang calon murid yang telah lulus.',
    defaultMessage: `*PENGINGAT DAFTAR ULANG SPMB {{NAMA_SEKOLAH}}*
*TAHUN AJARAN {{TAHUN_AJARAN}}*

_Assalamu'alaikum Warahmatullahi Wabarakatuh_

Yth. *{{NAMA_WALI}}*, orang tua/wali dari ananda *{{NAMA_SISWA}}* (No. Reg: *{{NO_REGISTRASI}}*).

Selamat atas kelulusan ananda pada seleksi SPMB {{NAMA_SEKOLAH}}. Kami mengingatkan bahwa batas akhir konfirmasi *Daftar Ulang (Biaya Awal Masuk)* adalah dalam waktu dekat.

Daftar ulang diperlukan guna penguncian kuota rombongan belajar (rombel) dan pendataan seragam serta buku pembelajaran ananda.

Rincian pembayaran & konfirmasi transfer dapat dilakukan melalui:
🌐 {{LINK_PORTAL}}

Terima kasih atas kerja sama dan kepercayaan Bapak/Ibu menyekolahkan ananda di {{NAMA_SEKOLAH}}.

_Wassalamu'alaikum Warahmatullahi Wabarakatuh_
*Panitia SPMB {{NAMA_SEKOLAH}}*`,
  },
  {
    key: 'class_placement',
    title: 'Pengumuman Penempatan Rombel & Jadwal MPLS',
    category: 'Rombel',
    description: 'Informasi penempatan kelas rombel 7, nama wali kelas, dan hari pertama masuk / MPLS.',
    defaultMessage: `*PENGUMUMAN PENEMPATAN KELAS & MPLS*
*{{NAMA_SEKOLAH}} TP {{TAHUN_AJARAN}}*

_Assalamu'alaikum Warahmatullahi Wabarakatuh_

Yth. *{{NAMA_WALI}}*, orang tua/wali dari ananda *{{NAMA_SISWA}}* (No. Reg: *{{NO_REGISTRASI}}*).

Alhamdulillah, ananda telah resmi terdaftar dan ditempatkan pada rombongan belajar:
🏫 *Kelas: {{KELAS}}*
👨‍🏫 *Wali Kelas: {{WALI_KELAS}}*

Informasi Masa Pengenalan Lingkungan Sekolah (MPLS):
📅 Tanggal Masuk: 12 Juli 2027 (Pukul 07.00 WIB)
👕 Seragam: Pakaian seragam SD asal lengkap & rapi

Buku panduan dan agenda MPLS dapat diunduh di dashboard siswa:
🌐 {{LINK_PORTAL}}

Selamat bergabung menjadi keluarga besar {{NAMA_SEKOLAH}}!

_Wassalamu'alaikum Warahmatullahi Wabarakatuh_
*Panitia SPMB {{NAMA_SEKOLAH}}*`,
  },
  {
    key: 'custom',
    title: 'Pesan Kustom Bebas',
    category: 'Umum',
    description: 'Tulis pesan pengumuman bebas sesuai kebutuhan panitia.',
    defaultMessage: `*PEMBERITAHUAN PANITIA SPMB {{NAMA_SEKOLAH}}*

_Assalamu'alaikum Warahmatullahi Wabarakatuh_

Yth. *{{NAMA_WALI}}*, orang tua/wali dari ananda *{{NAMA_SISWA}}* (No. Reg: *{{NO_REGISTRASI}}*).

[Tulis isi pengumuman Bapak/Ibu di sini...]

Informasi lebih lanjut dapat diakses melalui portal resmi:
🌐 {{LINK_PORTAL}}

Terima kasih atas perhatian dan kerja sama Bapak/Ibu.

_Wassalamu'alaikum Warahmatullahi Wabarakatuh_
*Panitia SPMB {{NAMA_SEKOLAH}}*`,
  },
];

/**
 * Kompilasi placeholder template menjadi pesan nyata untuk calon siswa tertentu
 */
export function compileWhatsAppMessage(
  templateText: string,
  student: StudentData,
  schoolInfo: SchoolInfo,
  parentName?: string
): string {
  const statusLabels: Record<string, string> = {
    passed: 'LULUS',
    passed_reserved: 'CADANGAN (WAITING LIST)',
    failed: 'BELUM LULUS',
    draft: 'DRAFT',
    pending_payment: 'MENUNGGU PEMBAYARAN',
    verifying_payment: 'VERIFIKASI PEMBAYARAN',
    form_submitted: 'FORMULIR TERKIRIM',
    form_verified: 'TERVERIFIKASI',
    scheduled_test: 'TERJADWAL TES',
    test_completed: 'TES SELESAI',
    re_registration_paid: 'DAFTAR ULANG DIBAYAR',
    re_registered: 'DAFTAR ULANG SELESAI',
    class_assigned: 'KELAS DITETAPKAN',
    completed: 'SELESAI',
  };

  const portalUrl = typeof window !== 'undefined' ? window.location.origin : 'https://spmb.alhadiid.sch.id';

  let msg = templateText;
  msg = msg.replace(/{{NAMA_SEKOLAH}}/g, schoolInfo.name || 'SMP Al-Hadiid Cileungsi');
  msg = msg.replace(/{{TAHUN_AJARAN}}/g, schoolInfo.academicYear || '2027/2028');
  msg = msg.replace(/{{NAMA_SISWA}}/g, student.fullName || 'Calon Murid');
  msg = msg.replace(/{{NO_REGISTRASI}}/g, student.registrationNumber || '-');
  msg = msg.replace(/{{STATUS_SELEKSI}}/g, statusLabels[student.status] || student.status.toUpperCase());
  msg = msg.replace(/{{NILAI_AKHIR}}/g, student.finalScore !== undefined ? String(student.finalScore) : '-');
  msg = msg.replace(/{{NAMA_WALI}}/g, parentName || student.fatherName || student.motherName || 'Bapak/Ibu Wali Murid');
  msg = msg.replace(/{{KELAS}}/g, student.assignedClassName || 'Kelas 7');
  msg = msg.replace(/{{WALI_KELAS}}/g, student.assignedHomeroomTeacher || 'Pengajar Al-Hadiid');
  msg = msg.replace(/{{LINK_PORTAL}}/g, portalUrl);

  return msg;
}

/**
 * Buat URL WhatsApp langsung (menggunakan api.whatsapp.com yang kompatibel mobile & desktop)
 */
export function createWhatsAppUrl(phone: string, text: string): string {
  const clean = cleanWhatsAppNumber(phone);
  if (!clean) return '';
  return `https://api.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(text)}`;
}

/**
 * Buka aplikasi WhatsApp di tab baru
 */
export function openWhatsAppLink(phone: string, text: string): boolean {
  const url = createWhatsAppUrl(phone, text);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

/**
 * Key penyimpanan riwayat pesan terkirim di localStorage
 */
const SENT_HISTORY_KEY = 'spmb_wa_announcements_sent_history';

export interface WhatsAppSentRecord {
  studentId: string;
  studentName: string;
  parentRole: string;
  phone: string;
  templateKey: string;
  sentAt: string;
}

export function getWhatsAppSentHistory(): Record<string, WhatsAppSentRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SENT_HISTORY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function recordWhatsAppAnnouncementSent(
  studentId: string,
  studentName: string,
  parentRole: string,
  phone: string,
  templateKey: string
): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getWhatsAppSentHistory();
    current[studentId] = {
      studentId,
      studentName,
      parentRole,
      phone,
      templateKey,
      sentAt: new Date().toISOString(),
    };
    localStorage.setItem(SENT_HISTORY_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn('Gagal mencatat riwayat pengiriman WA:', err);
  }
}
