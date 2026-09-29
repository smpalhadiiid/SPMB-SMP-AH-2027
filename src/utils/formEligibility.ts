import { StudentData } from '../types';

/**
 * Memeriksa apakah calon murid sudah melengkapi isian formulir pendaftaran.
 * Terpenuhi jika status formulir sudah disubmit/lanjut, atau data biodata inti telah terisi.
 */
export function isStudentFormFilled(student: StudentData | null | undefined): boolean {
  if (!student) return false;

  const submittedStatuses: string[] = [
    'form_submitted',
    'form_verified',
    'scheduled_test',
    'test_completed',
    'passed',
    'passed_reserved',
    'failed',
    're_registration_paid',
    're_registered',
    'class_assigned',
    'completed'
  ];

  if (submittedStatuses.includes(student.status)) {
    return true;
  }

  // Cek kelengkapan data formulir jika status masih draft/filling_form
  const hasBasicInfo = Boolean(
    student.fullName &&
    (student.nik || student.birthDate || student.birthPlace) &&
    (student.address || student.fatherName || student.motherName || student.previousSchoolName)
  );

  return hasBasicInfo;
}

/**
 * Memeriksa apakah calon murid sudah mengunggah bukti transfer biaya formulir.
 * Terpenuhi jika URL bukti transfer tersedia atau status pembayaran formulir pending/verified atau tahap lanjut.
 */
export function hasUploadedPaymentProof(student: StudentData | null | undefined): boolean {
  if (!student) return false;

  return Boolean(
    (student.formPaymentProofUrl && student.formPaymentProofUrl.trim().length > 0) ||
    student.formPaymentStatus === 'verified' ||
    student.formPaymentStatus === 'pending' ||
    student.isFormVerified === true ||
    student.status === 'filling_form' ||
    student.status === 'form_submitted' ||
    student.status === 'form_verified' ||
    student.status === 'scheduled_test' ||
    student.status === 'test_completed' ||
    student.status === 'passed' ||
    student.status === 'passed_reserved' ||
    student.status === 're_registration_paid' ||
    student.status === 're_registered' ||
    student.status === 'class_assigned' ||
    student.status === 'completed'
  );
}

/**
 * Memeriksa apakah calon murid sudah berhak mendownload Kartu Ujian.
 * Sesuai revisi: setelah calon murid mengunggah bukti pembayaran, fitur Download Kartu Ujian langsung aktif dan tampil.
 */
export function canStudentDownloadExamCard(student: StudentData | null | undefined): boolean {
  if (!student) return false;
  return hasUploadedPaymentProof(student) || isStudentDataVerified(student);
}

/**
 * Memeriksa apakah pembayaran formulir calon murid sudah diverifikasi oleh Panitia Admin.
 */
export function isStudentPaymentVerified(student: StudentData | null | undefined): boolean {
  if (!student) return false;
  return Boolean(
    student.formPaymentStatus === 'verified' ||
    student.isFormVerified === true ||
    student.isFormVerifiedByAdmin === true
  );
}

/**
 * Memeriksa apakah data calon murid sudah diverifikasi oleh Panitia Admin.
 * Syarat utama sesuai Alur Pendaftaran Revisi:
 * Setelah admin panitia memverifikasi data pembayaran dan data calon murid,
 * barulah calon murid bisa mendownload formulir dan kartu ujian.
 */
export function isStudentDataVerified(student: StudentData | null | undefined): boolean {
  if (!student) return false;
  return Boolean(
    student.isFormVerified === true ||
    student.isFormVerifiedByAdmin === true ||
    student.status === 'form_verified' ||
    student.status === 'scheduled_test' ||
    student.status === 'test_completed' ||
    student.status === 'passed' ||
    student.status === 'passed_reserved' ||
    student.status === 're_registration_paid' ||
    student.status === 're_registered' ||
    student.status === 'class_assigned' ||
    student.status === 'completed'
  );
}

/**
 * Calon murid bisa download formulir dan kartu ujian SETELAH diverifikasi datanya oleh panitia admin.
 * (Sesuai Butir 5 Alur Pendaftaran: "setelah diverifikasi datanya calon murid juga bisa dowload formulir dan kartu ujian")
 */
export function canStudentDownloadDocuments(student: StudentData | null | undefined): boolean {
  if (!student) return false;
  return isStudentDataVerified(student);
}

/**
 * Admin panitia dapat mendownload formulir pendaftaran calon murid jika data calon murid sudah terisi atau sudah diverifikasi.
 * (Sesuai Butir 4 Alur Pendaftaran: "admin panitia memverifikasi data pembayaran dan data calon murid, kemudian mendownload formulir pendaftaran calon murid")
 */
export function canAdminDownloadStudentForm(student: StudentData | null | undefined): boolean {
  if (!student) return false;
  return isStudentFormFilled(student) || isStudentDataVerified(student);
}

/**
 * Kompatibilitas umum: memeriksa apakah formulir pendaftaran dapat diunduh
 */
export function canDownloadStudentForm(student: StudentData | null | undefined): boolean {
  if (!student) return false;
  return isStudentDataVerified(student) || (isStudentFormFilled(student) && hasUploadedPaymentProof(student));
}

/**
 * Memberikan rincian status kesiapan pengunduhan formulir beserta pesan pemandu untuk admin panitia.
 */
export function getStudentFormStatus(student: StudentData | null | undefined): {
  isFormFilled: boolean;
  hasPaymentProof: boolean;
  canDownload: boolean;
  statusBadgeText: string;
  missingRequirements: string[];
} {
  const formFilled = isStudentFormFilled(student);
  const paymentProof = hasUploadedPaymentProof(student);
  const eligible = formFilled && paymentProof;

  const missingRequirements: string[] = [];
  if (!formFilled) {
    missingRequirements.push('Data Formulir belum diisi lengkap');
  }
  if (!paymentProof) {
    missingRequirements.push('Bukti Transfer Formulir belum diunggah');
  }

  let statusBadgeText = 'Belum Memenuhi Syarat Unduh';
  if (eligible) {
    statusBadgeText = 'Siap Unduh Formulir';
  } else if (formFilled && !paymentProof) {
    statusBadgeText = 'Menunggu Upload Bukti Transfer';
  } else if (!formFilled && paymentProof) {
    statusBadgeText = 'Menunggu Pengisian Formulir';
  }

  return {
    isFormFilled: formFilled,
    hasPaymentProof: paymentProof,
    canDownload: eligible,
    statusBadgeText,
    missingRequirements,
  };
}
