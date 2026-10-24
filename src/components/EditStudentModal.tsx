// =====================================================================
// src/components/EditStudentModal.tsx
// Modal Lengkap Edit & Lengkapi Data Pendaftaran Calon Murid
// Terintegrasi langsung dengan StudentRepository & Supabase public.students
// =====================================================================

import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  School,
  Users,
  Compass,
  FileText,
  Save,
  CheckCircle2,
  AlertCircle,
  Upload,
  Eye,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  Award,
} from 'lucide-react';
import { StudentData, AdmissionStatus } from '../types';
import { StudentRepository } from '../repositories/StudentRepository';
import { supabase } from '../utils/supabaseClient';

interface EditStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentData | null;
  onSaveSuccess?: (updatedStudent: StudentData) => void;
}

export const EditStudentModal: React.FC<EditStudentModalProps> = ({
  isOpen,
  onClose,
  student,
  onSaveSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'biodata' | 'school' | 'parents' | 'path' | 'documents'>('biodata');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successToast, setSuccessToast] = useState(false);

  // Form Fields State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [nik, setNik] = useState('');
  const [nisn, setNisn] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [birthDate, setBirthDate] = useState('2013-01-01');
  const [gender, setGender] = useState<'Laki-laki' | 'Perempuan'>('Laki-laki');
  const [religion, setReligion] = useState('Islam');
  const [childOrder, setChildOrder] = useState('1');
  const [totalSiblings, setTotalSiblings] = useState('1');
  const [address, setAddress] = useState('');
  const [village, setVillage] = useState('');
  const [subdistrict, setSubdistrict] = useState('Cileungsi');
  const [city, setCity] = useState('Kabupaten Bogor');
  const [province, setProvince] = useState('Jawa Barat');
  const [postalCode, setPostalCode] = useState('');

  // School Origin
  const [previousSchoolName, setPreviousSchoolName] = useState('');
  const [previousSchoolNpsn, setPreviousSchoolNpsn] = useState('');
  const [previousSchoolAddress, setPreviousSchoolAddress] = useState('');

  // Parents - Father
  const [fatherName, setFatherName] = useState('');
  const [fatherBirthPlace, setFatherBirthPlace] = useState('');
  const [fatherBirthDate, setFatherBirthDate] = useState('');
  const [fatherJob, setFatherJob] = useState('');
  const [fatherEducation, setFatherEducation] = useState('SMA/SMK');
  const [fatherPhone, setFatherPhone] = useState('');

  // Parents - Mother
  const [motherName, setMotherName] = useState('');
  const [motherBirthPlace, setMotherBirthPlace] = useState('');
  const [motherBirthDate, setMotherBirthDate] = useState('');
  const [motherJob, setMotherJob] = useState('');
  const [motherEducation, setMotherEducation] = useState('SMA/SMK');
  const [motherPhone, setMotherPhone] = useState('');

  // Guardian
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelation, setGuardianRelation] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');

  // Path & Program
  const [entryPath, setEntryPath] = useState('Reguler');
  const [selectedProgram, setSelectedProgram] = useState('Reguler');
  const [status, setStatus] = useState<AdmissionStatus>('form_submitted');

  // Documents
  const [photoUrl, setPhotoUrl] = useState('');
  const [kkUrl, setKkUrl] = useState('');
  const [birthCertUrl, setBirthCertUrl] = useState('');
  const [reportCardUrl, setReportCardUrl] = useState('');
  const [kipUrl, setKipUrl] = useState('');
  const [certificateUrl, setCertificateUrl] = useState('');

  // Inisialisasi data form saat student berubah
  useEffect(() => {
    if (student) {
      setFullName(student.fullName || '');
      setPhone(student.phone || '');
      setUserEmail(student.userEmail || '');
      setNik(student.nik || '');
      setNisn(student.nisn || '');
      setBirthPlace(student.birthPlace || '');
      setBirthDate(student.birthDate || '2013-01-01');
      setGender(student.gender || 'Laki-laki');
      setReligion(student.religion || 'Islam');
      setChildOrder(student.childOrder || '1');
      setTotalSiblings(student.totalSiblings || '1');
      setAddress(student.address || '');
      setVillage(student.village || '');
      setSubdistrict(student.subdistrict || 'Cileungsi');
      setCity(student.city || 'Kabupaten Bogor');
      setProvince(student.province || 'Jawa Barat');
      setPostalCode(student.postalCode || '');

      setPreviousSchoolName(student.previousSchoolName || student.previousSchool || '');
      setPreviousSchoolNpsn(student.previousSchoolNpsn || '');
      setPreviousSchoolAddress(student.previousSchoolAddress || '');

      setFatherName(student.fatherName || '');
      setFatherBirthPlace(student.fatherBirthPlace || '');
      setFatherBirthDate(student.fatherBirthDate || '');
      setFatherJob(student.fatherJob || '');
      setFatherEducation(student.fatherEducation || 'SMA/SMK');
      setFatherPhone(student.fatherPhone || '');

      setMotherName(student.motherName || '');
      setMotherBirthPlace(student.motherBirthPlace || '');
      setMotherBirthDate(student.motherBirthDate || '');
      setMotherJob(student.motherJob || '');
      setMotherEducation(student.motherEducation || 'SMA/SMK');
      setMotherPhone(student.motherPhone || '');

      setGuardianName(student.guardianName || '');
      setGuardianRelation(student.guardianRelation || '');
      setGuardianPhone(student.guardianPhone || '');

      setEntryPath(student.entryPath || 'Reguler');
      setSelectedProgram(student.selectedProgram || 'Reguler');
      setStatus(student.status || 'form_submitted');

      setPhotoUrl(student.photoUrl || '');
      setKkUrl(student.kkUrl || '');
      setBirthCertUrl(student.birthCertUrl || '');
      setReportCardUrl(student.reportCardUrl || '');
      setKipUrl(student.kipUrl || '');
      setCertificateUrl(student.certificateUrl || '');

      setErrorMessage('');
      setSuccessToast(false);
    }
  }, [student, isOpen]);

  if (!isOpen || !student) return null;

  // Handle upload file lokal menjadi data URL
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Ukuran file maksimal 5 MB!');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student?.id) return;

    if (!fullName.trim()) {
      setActiveTab('biodata');
      setErrorMessage('Nama lengkap calon murid wajib diisi!');
      return;
    }

    if (!nik.trim()) {
      setActiveTab('biodata');
      setErrorMessage('NIK calon murid wajib diisi!');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      const updates: Partial<StudentData> = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        userEmail: userEmail.trim(),
        nik: nik.trim(),
        nisn: nisn.trim() || undefined,
        birthPlace: birthPlace.trim(),
        birthDate: birthDate || '2013-01-01',
        gender,
        religion,
        childOrder: childOrder.trim() || undefined,
        totalSiblings: totalSiblings.trim() || undefined,
        address: address.trim(),
        village: village.trim() || undefined,
        subdistrict: subdistrict.trim(),
        city: city.trim(),
        province: province.trim(),
        postalCode: postalCode.trim() || undefined,

        previousSchoolName: previousSchoolName.trim(),
        previousSchool: previousSchoolName.trim(),
        previousSchoolNpsn: previousSchoolNpsn.trim() || undefined,
        previousSchoolAddress: previousSchoolAddress.trim() || undefined,

        fatherName: fatherName.trim(),
        fatherBirthPlace: fatherBirthPlace.trim() || undefined,
        fatherBirthDate: fatherBirthDate || undefined,
        fatherJob: fatherJob.trim() || undefined,
        fatherEducation: fatherEducation || 'SMA/SMK',
        fatherPhone: fatherPhone.trim(),

        motherName: motherName.trim(),
        motherBirthPlace: motherBirthPlace.trim() || undefined,
        motherBirthDate: motherBirthDate || undefined,
        motherJob: motherJob.trim(),
        motherEducation: motherEducation || 'SMA/SMK',
        motherPhone: motherPhone.trim(),

        guardianName: guardianName.trim() || undefined,
        guardianRelation: guardianRelation.trim() || undefined,
        guardianPhone: guardianPhone.trim() || undefined,

        entryPath: entryPath || 'Reguler',
        selectedProgram: selectedProgram || 'Reguler',
        status: status || student.status,

        photoUrl: photoUrl || undefined,
        kkUrl: kkUrl || undefined,
        birthCertUrl: birthCertUrl || undefined,
        reportCardUrl: reportCardUrl || undefined,
        kipUrl: kipUrl || undefined,
        certificateUrl: certificateUrl || undefined,
      };

      // Simpan pembaruan ke Supabase via StudentRepository
      const res = await StudentRepository.update(student.id, updates);

      if (res.error) {
        throw res.error;
      }

      // Pastikan tabel public.users juga terupdate jika nama atau HP berubah
      if (fullName !== student.fullName || phone !== student.phone) {
        try {
          await supabase.from('users').update({
            name: fullName.trim(),
            phone: phone.trim(),
            updated_at: new Date().toISOString(),
          }).eq('id', student.id);
        } catch (uErr) {
          console.warn('Gagal sinkron nama user di public.users:', uErr);
        }
      }

      const mergedStudent: StudentData = {
        ...student,
        ...updates,
      };

      setSuccessToast(true);
      if (onSaveSuccess) {
        onSaveSuccess(mergedStudent);
      }

      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Gagal memperbarui data calon murid:', err);
      setIsSaving(false);
      setErrorMessage(err?.message || 'Terjadi kesalahan saat menyimpan data calon murid ke database.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-4xl w-full text-slate-900 relative shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 px-6 flex items-center justify-between border-b border-indigo-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Edit & Lengkapi Data Calon Murid
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold">
                  {student.registrationNumber}
                </span>
              </div>
              <p className="text-xs text-indigo-200">
                Pembaruan biodata, sekolah asal, berkas, dan data orang tua/wali tersinkronisasi ke Supabase
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Ribbon */}
        <div className="flex items-center gap-1.5 px-6 pt-3 pb-2 bg-slate-100 border-b border-slate-200 overflow-x-auto text-xs font-bold shrink-0">
          {[
            { id: 'biodata', label: '1. Data Pribadi', icon: User },
            { id: 'school', label: '2. Sekolah Asal', icon: School },
            { id: 'parents', label: '3. Orang Tua & Wali', icon: Users },
            { id: 'path', label: '4. Jalur & Program', icon: Compass },
            { id: 'documents', label: '5. Berkas & Dokumen', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body / Scrollable Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successToast && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>✓ Perubahan data calon murid berhasil disimpan ke database! Menutup modal...</span>
            </div>
          )}

          <form id="edit-student-form" onSubmit={handleSubmit} className="space-y-6 text-xs">
            
            {/* TAB 1: DATA PRIBADI */}
            {activeTab === 'biodata' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-600" />
                    <span>Identitas Pribadi Calon Murid</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">* Wajib diisi</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">
                      Nama Lengkap Calon Murid *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Muhammad Fathan Al-Khatiri"
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Jenis Kelamin *
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-white font-medium"
                    >
                      <option value="Laki-laki">Laki-laki (Ikhwan)</option>
                      <option value="Perempuan">Perempuan (Akhwat)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      NIK (Nomor Induk Kependudukan) *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={16}
                      value={nik}
                      onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))}
                      placeholder="16 digit NIK sesuai KK"
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                    <span className="text-[10px] text-slate-400">{nik.length}/16 digit</span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      NISN (Nomor Induk Siswa Nasional)
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      value={nisn}
                      onChange={(e) => setNisn(e.target.value.replace(/\D/g, ''))}
                      placeholder="10 digit NISN"
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Agama *
                    </label>
                    <select
                      value={religion}
                      onChange={(e) => setReligion(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-white font-medium"
                    >
                      <option value="Islam">Islam</option>
                      <option value="Kristen">Kristen</option>
                      <option value="Katolik">Katolik</option>
                      <option value="Hindu">Hindu</option>
                      <option value="Buddha">Buddha</option>
                      <option value="Konghucu">Konghucu</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Tempat Lahir *
                    </label>
                    <input
                      type="text"
                      required
                      value={birthPlace}
                      onChange={(e) => setBirthPlace(e.target.value)}
                      placeholder="e.g. Bogor / Jakarta"
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Tanggal Lahir *
                    </label>
                    <input
                      type="date"
                      required
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Anak Ke-</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={childOrder}
                        onChange={(e) => setChildOrder(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 text-center"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Dari Saudara</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={totalSiblings}
                        onChange={(e) => setTotalSiblings(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 text-center"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      No. WhatsApp / HP Siswa *
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="081234567890"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Email Akun Siswa
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="email"
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        placeholder="siswa@spmb.alhadiid.sch.id"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Kode Pos
                    </label>
                    <input
                      type="text"
                      maxLength={5}
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="16820"
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">
                      Alamat Lengkap Tempat Tinggal *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Jl. Raya Cileungsi No. 123, RT 01 / RW 02..."
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Desa / Kelurahan</label>
                    <input
                      type="text"
                      value={village}
                      onChange={(e) => setVillage(e.target.value)}
                      placeholder="e.g. Cileungsi Kidul"
                      className="w-full p-2.5 rounded-xl border border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Kecamatan *</label>
                    <input
                      type="text"
                      required
                      value={subdistrict}
                      onChange={(e) => setSubdistrict(e.target.value)}
                      placeholder="e.g. Cileungsi"
                      className="w-full p-2.5 rounded-xl border border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Kabupaten / Kota *</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Kabupaten Bogor"
                      className="w-full p-2.5 rounded-xl border border-slate-300"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SEKOLAH ASAL */}
            {activeTab === 'school' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <School className="w-4 h-4 text-blue-600" />
                    <span>Data Sekolah Asal (SD / MI)</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">Isi data sekolah dasar calon murid</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">
                      Nama Sekolah Asal (SD / MI) *
                    </label>
                    <input
                      type="text"
                      required
                      value={previousSchoolName}
                      onChange={(e) => setPreviousSchoolName(e.target.value)}
                      placeholder="e.g. SDIT Al-Hadiid / SDN 01 Cileungsi"
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      NPSN Sekolah Asal
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      value={previousSchoolNpsn}
                      onChange={(e) => setPreviousSchoolNpsn(e.target.value)}
                      placeholder="e.g. 20231456"
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-mono"
                    />
                    <span className="text-[10px] text-slate-400">8 digit nomor pokok sekolah nasional</span>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">
                      Alamat Lengkap Sekolah Asal
                    </label>
                    <textarea
                      rows={2}
                      value={previousSchoolAddress}
                      onChange={(e) => setPreviousSchoolAddress(e.target.value)}
                      placeholder="Alamat jalan, kelurahan, dan kota sekolah asal..."
                      className="w-full p-2.5 rounded-xl border border-slate-300"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: ORANG TUA & WALI */}
            {activeTab === 'parents' && (
              <div className="space-y-6">
                {/* DATA AYAH */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4 text-indigo-600" />
                    <span>Data Ayah Kandung</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap Ayah *</label>
                      <input
                        type="text"
                        required
                        value={fatherName}
                        onChange={(e) => setFatherName(e.target.value)}
                        placeholder="Nama Ayah sesuai KTP/KK"
                        className="w-full p-2 rounded-lg border border-slate-300 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">No. WhatsApp/HP Ayah *</label>
                      <input
                        type="tel"
                        required
                        value={fatherPhone}
                        onChange={(e) => setFatherPhone(e.target.value)}
                        placeholder="081234567890"
                        className="w-full p-2 rounded-lg border border-slate-300 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Tempat Lahir Ayah</label>
                      <input
                        type="text"
                        value={fatherBirthPlace}
                        onChange={(e) => setFatherBirthPlace(e.target.value)}
                        placeholder="Kota Lahir"
                        className="w-full p-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Tanggal Lahir Ayah</label>
                      <input
                        type="date"
                        value={fatherBirthDate}
                        onChange={(e) => setFatherBirthDate(e.target.value)}
                        className="w-full p-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Pendidikan Terakhir</label>
                      <select
                        value={fatherEducation}
                        onChange={(e) => setFatherEducation(e.target.value)}
                        className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                      >
                        <option value="SD">SD / Sederajat</option>
                        <option value="SMP">SMP / Sederajat</option>
                        <option value="SMA/SMK">SMA / SMK / MA</option>
                        <option value="D3">Diploma (D3)</option>
                        <option value="S1">Sarjana (S1)</option>
                        <option value="S2">Magister (S2)</option>
                        <option value="S3">Doktor (S3)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">Pekerjaan Ayah</label>
                      <input
                        type="text"
                        value={fatherJob}
                        onChange={(e) => setFatherJob(e.target.value)}
                        placeholder="e.g. Karyawan Swasta / Wiraswasta / PNS"
                        className="w-full p-2 rounded-lg border border-slate-300"
                      />
                    </div>
                  </div>
                </div>

                {/* DATA IBU */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4 text-rose-600" />
                    <span>Data Ibu Kandung</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap Ibu *</label>
                      <input
                        type="text"
                        required
                        value={motherName}
                        onChange={(e) => setMotherName(e.target.value)}
                        placeholder="Nama Ibu sesuai KTP/KK"
                        className="w-full p-2 rounded-lg border border-slate-300 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">No. WhatsApp/HP Ibu *</label>
                      <input
                        type="tel"
                        required
                        value={motherPhone}
                        onChange={(e) => setMotherPhone(e.target.value)}
                        placeholder="081234567890"
                        className="w-full p-2 rounded-lg border border-slate-300 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Tempat Lahir Ibu</label>
                      <input
                        type="text"
                        value={motherBirthPlace}
                        onChange={(e) => setMotherBirthPlace(e.target.value)}
                        placeholder="Kota Lahir"
                        className="w-full p-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Tanggal Lahir Ibu</label>
                      <input
                        type="date"
                        value={motherBirthDate}
                        onChange={(e) => setMotherBirthDate(e.target.value)}
                        className="w-full p-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Pendidikan Terakhir</label>
                      <select
                        value={motherEducation}
                        onChange={(e) => setMotherEducation(e.target.value)}
                        className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                      >
                        <option value="SD">SD / Sederajat</option>
                        <option value="SMP">SMP / Sederajat</option>
                        <option value="SMA/SMK">SMA / SMK / MA</option>
                        <option value="D3">Diploma (D3)</option>
                        <option value="S1">Sarjana (S1)</option>
                        <option value="S2">Magister (S2)</option>
                        <option value="S3">Doktor (S3)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">Pekerjaan Ibu</label>
                      <input
                        type="text"
                        value={motherJob}
                        onChange={(e) => setMotherJob(e.target.value)}
                        placeholder="e.g. Ibu Rumah Tangga / Guru / Karyawan"
                        className="w-full p-2 rounded-lg border border-slate-300"
                      />
                    </div>
                  </div>
                </div>

                {/* DATA WALI (OPSIONAL) */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-600" />
                    <span>Data Wali Murid (Opsional / Jika Tinggal Bersama Wali)</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap Wali</label>
                      <input
                        type="text"
                        value={guardianName}
                        onChange={(e) => setGuardianName(e.target.value)}
                        placeholder="Nama Wali"
                        className="w-full p-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Hubungan dengan Murid</label>
                      <input
                        type="text"
                        value={guardianRelation}
                        onChange={(e) => setGuardianRelation(e.target.value)}
                        placeholder="e.g. Kakek / Paman / Kakak"
                        className="w-full p-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">No. WhatsApp/HP Wali</label>
                      <input
                        type="tel"
                        value={guardianPhone}
                        onChange={(e) => setGuardianPhone(e.target.value)}
                        placeholder="081234567890"
                        className="w-full p-2 rounded-lg border border-slate-300 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: JALUR & PROGRAM */}
            {activeTab === 'path' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <Compass className="w-4 h-4 text-emerald-600" />
                    <span>Jalur Pendaftaran, Program Belajar & Status SPMB</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">Pengaturan kepanitiaan</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Jalur Pendaftaran *</label>
                    <select
                      value={entryPath}
                      onChange={(e) => setEntryPath(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-semibold"
                    >
                      <option value="Reguler">Jalur Reguler (Umum)</option>
                      <option value="Prestasi Akademik">Jalur Prestasi Akademik (Nilai Rapor)</option>
                      <option value="Prestasi Non-Akademik">Jalur Prestasi Olahraga / Seni</option>
                      <option value="Tahfidz Al-Qur'an">Jalur Prestasi Tahfidz Qur'an</option>
                      <option value="Afirmasi / KIP">Jalur Afirmasi / KIP / Yatim</option>
                      <option value="Internal Yayasan">Jalur Internal Alumni SD Al-Hadiid</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Program Belajar Pilihan *</label>
                    <select
                      value={selectedProgram}
                      onChange={(e) => setSelectedProgram(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-semibold"
                    >
                      <option value="Reguler">Program Reguler (Kurikulum Merdeka + Diniyyah)</option>
                      <option value="Tahfidz">Program Khusus Tahfidz Al-Qur'an (Target 5-10 Juz)</option>
                      <option value="Bilingual">Program Billingual / Bahasa Arab & Inggris</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Status Progres SPMB *</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-semibold"
                    >
                      <option value="draft">1. Draft (Baru Buat Akun)</option>
                      <option value="verifying_payment">2. Menunggu Verifikasi Pembayaran</option>
                      <option value="filling_form">3. Pengisian Formulir</option>
                      <option value="form_submitted">4. Formulir Terkirim</option>
                      <option value="form_verified">5. Formulir & Berkas Diverifikasi</option>
                      <option value="scheduled_test">6. Jadwal Tes / CBT Siap</option>
                      <option value="test_completed">7. Tes CBT Selesai</option>
                      <option value="passed">8. Lulus Seleksi</option>
                      <option value="passed_reserved">9. Cadangan</option>
                      <option value="failed">10. Belum Lulus (Remedial)</option>
                      <option value="re_registration_paid">11. Bukti Daftar Ulang Diunggah</option>
                      <option value="re_registered">12. Daftar Ulang Lunas (BAM Terverifikasi)</option>
                      <option value="class_assigned">13. Penempatan Kelas Selesai</option>
                      <option value="completed">14. Selesai Seluruh Proses</option>
                    </select>
                  </div>
                </div>

                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Informasi Jalur Masuk:</span>
                  </div>
                  <p className="text-[11px] text-blue-800">
                    Siswa dengan jalur <b>Internal Yayasan</b> atau <b>Tahfidz</b> berhak mendapatkan potongan biaya dan skala prioritas penempatan kelas rombel sesuai ketentuan sekolah.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 5: BERKAS & DOKUMEN */}
            {activeTab === 'documents' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>Upload & Perbarui Berkas Dokumen Persyaratan</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">Maksimal 5MB per berkas (JPG/PNG/PDF)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Pas Foto */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <label className="block font-bold text-slate-800">1. Pas Foto Calon Murid</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, setPhotoUrl)}
                      className="text-[11px] block w-full text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                    />
                    <input
                      type="text"
                      placeholder="Atau masukkan Link Pas Foto..."
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      className="w-full p-2 rounded-lg border text-xs"
                    />
                    {photoUrl && (
                      <div className="flex items-center gap-2 pt-1">
                        <img src={photoUrl} alt="Foto" className="w-10 h-10 object-cover rounded-lg border" />
                        <span className="text-[10px] text-emerald-600 font-bold">✓ Pas Foto Siap</span>
                      </div>
                    )}
                  </div>

                  {/* Kartu Keluarga */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <label className="block font-bold text-slate-800">2. Kartu Keluarga (KK)</label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleFileUpload(e, setKkUrl)}
                      className="text-[11px] block w-full text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                    <input
                      type="text"
                      placeholder="Atau masukkan Link Scan KK..."
                      value={kkUrl}
                      onChange={(e) => setKkUrl(e.target.value)}
                      className="w-full p-2 rounded-lg border text-xs"
                    />
                    {kkUrl && (
                      <div className="text-[10px] text-blue-600 font-bold">✓ Scan KK Terunggah</div>
                    )}
                  </div>

                  {/* Akta Lahir */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <label className="block font-bold text-slate-800">3. Akta Kelahiran</label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleFileUpload(e, setBirthCertUrl)}
                      className="text-[11px] block w-full text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                    <input
                      type="text"
                      placeholder="Atau masukkan Link Akta Lahir..."
                      value={birthCertUrl}
                      onChange={(e) => setBirthCertUrl(e.target.value)}
                      className="w-full p-2 rounded-lg border text-xs"
                    />
                    {birthCertUrl && (
                      <div className="text-[10px] text-blue-600 font-bold">✓ Akta Lahir Terunggah</div>
                    )}
                  </div>

                  {/* Scan Rapor */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <label className="block font-bold text-slate-800">4. Scan Rapor SD / MI (Kelas 4-6)</label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleFileUpload(e, setReportCardUrl)}
                      className="text-[11px] block w-full text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                    <input
                      type="text"
                      placeholder="Atau masukkan Link Rapor..."
                      value={reportCardUrl}
                      onChange={(e) => setReportCardUrl(e.target.value)}
                      className="w-full p-2 rounded-lg border text-xs"
                    />
                    {reportCardUrl && (
                      <div className="text-[10px] text-blue-600 font-bold">✓ Scan Rapor Terunggah</div>
                    )}
                  </div>

                  {/* KIP / Kartu Afirmasi */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <label className="block font-bold text-slate-800">5. KIP / PIP / PKH (Opsional)</label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleFileUpload(e, setKipUrl)}
                      className="text-[11px] block w-full text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                    <input
                      type="text"
                      placeholder="Atau masukkan Link Kartu KIP..."
                      value={kipUrl}
                      onChange={(e) => setKipUrl(e.target.value)}
                      className="w-full p-2 rounded-lg border text-xs"
                    />
                    {kipUrl && (
                      <div className="text-[10px] text-blue-600 font-bold">✓ Kartu KIP Terunggah</div>
                    )}
                  </div>

                  {/* Piagam / Sertifikat */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <label className="block font-bold text-slate-800">6. Sertifikat / Piagam Prestasi</label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleFileUpload(e, setCertificateUrl)}
                      className="text-[11px] block w-full text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                    <input
                      type="text"
                      placeholder="Atau masukkan Link Piagam..."
                      value={certificateUrl}
                      onChange={(e) => setCertificateUrl(e.target.value)}
                      className="w-full p-2 rounded-lg border text-xs"
                    />
                    {certificateUrl && (
                      <div className="text-[10px] text-blue-600 font-bold">✓ Piagam Prestasi Terunggah</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Modal Action Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <span>No. Reg: <b className="font-mono text-slate-700">{student.registrationNumber}</b></span>
            <span>•</span>
            <span>Status: <b className="uppercase text-slate-700">{status}</b></span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Batal
            </button>

            <button
              type="submit"
              form="edit-student-form"
              disabled={isSaving}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? 'Menyimpan Perubahan...' : 'Simpan Perubahan Data Calon Murid'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
