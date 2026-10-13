import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import {
  X, Save, User, School, Users, ShieldCheck, Key, Eye, EyeOff,
  RefreshCw, Copy, Check, Sparkles, AlertCircle, Phone, Mail,
  MapPin, Calendar, Award, FileText, CheckCircle2
} from 'lucide-react';
import { StudentData, ClassQuota, AdmissionStatus } from '../types';
import { StudentRepository } from '../repositories/StudentRepository';
import { resolveStudentCredentials, saveStudentAccountCredentials } from '../utils/studentCredentials';
import { BAM_DISCOUNT_CATEGORIES, getBamDiscountCategory } from '../utils/bamPricing';

interface EditStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentData | null;
  classQuotas?: ClassQuota[];
  onSaveSuccess: (updated: StudentData) => void;
}

export const EditStudentModal: React.FC<EditStudentModalProps> = ({
  isOpen,
  onClose,
  student,
  classQuotas = [],
  onSaveSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'pribadi' | 'sekolah' | 'ortu' | 'status' | 'kredensial'>('pribadi');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<StudentData> & { passwordInput?: string }>({});

  useEffect(() => {
    if (student) {
      const creds = resolveStudentCredentials(student);
      setFormData({
        ...student,
        username: creds.username,
        password: creds.password,
        passwordInput: creds.password,
      });
      setActiveTab('pribadi');
    }
  }, [student, isOpen]);

  if (!isOpen || !student) return null;

  const handleChange = (field: keyof StudentData | 'passwordInput', value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleGenerateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let res = 'al';
    for (let i = 0; i < 6; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    handleChange('passwordInput', res);
    handleChange('password', res);
    handleChange('examPassword', res);
  };

  const handleCopyText = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    if (!formData.fullName || !formData.fullName.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Nama Lengkap Kosong',
        text: 'Mohon masukkan nama lengkap calon murid.',
      });
      setActiveTab('pribadi');
      return;
    }

    if (!formData.phone || !formData.phone.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'No. WhatsApp/HP Kosong',
        text: 'Mohon masukkan nomor kontak calon murid / orang tua.',
      });
      setActiveTab('pribadi');
      return;
    }

    const effectiveUsername = (formData.username || student.username || student.registrationNumber || 'siswa').trim();
    const effectivePassword = (formData.passwordInput || formData.password || student.password || 'siswa123').trim();

    setIsSubmitting(true);
    try {
      const updatePayload: Partial<StudentData> = {
        ...formData,
        fullName: formData.fullName.trim(),
        username: effectiveUsername,
        examUsername: effectiveUsername,
        password: effectivePassword,
        examPassword: effectivePassword,
        updatedAt: new Date().toISOString(),
      };

      delete (updatePayload as any).passwordInput;

      // 1. Call StudentRepository.update
      const res = await StudentRepository.update(student.id, updatePayload);
      if (res.error && !res.data) {
        throw res.error;
      }

      const updatedRecord: StudentData = res.data ? {
        ...res.data,
        username: effectiveUsername,
        password: effectivePassword,
        examUsername: effectiveUsername,
        examPassword: effectivePassword,
      } : {
        ...student,
        ...updatePayload,
        username: effectiveUsername,
        password: effectivePassword,
      } as StudentData;

      // 2. Also save to credentials cache & Supabase spmb_app_state
      await saveStudentAccountCredentials({
        studentId: student.id,
        registrationNumber: updatedRecord.registrationNumber || student.registrationNumber,
        userEmail: updatedRecord.userEmail || student.userEmail,
        fullName: updatedRecord.fullName,
        username: effectiveUsername,
        password: effectivePassword,
      });

      Swal.fire({
        icon: 'success',
        title: 'Data Berhasil Diperbarui',
        text: `Data dan kredensial calon murid ${updatedRecord.fullName} telah disimpan ke database.`,
        timer: 2000,
        showConfirmButton: false,
      });

      onSaveSuccess(updatedRecord);
      onClose();
    } catch (err: any) {
      console.error('Gagal mengupdate data murid:', err);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan Data',
        text: err?.message || 'Terjadi kesalahan teknis saat menyimpan data murid.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-4xl w-full text-slate-900 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white font-extrabold text-base flex items-center justify-center shadow-md shrink-0">
              {student.fullName ? student.fullName.charAt(0).toUpperCase() : 'M'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  Edit & Update Data Calon Murid
                </h3>
                <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-300">
                  {student.registrationNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Perbarui biodata pribadi, sekolah asal, wali, status penerimaan, dan akun login siswa.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 px-4 sm:px-6 gap-1 sm:gap-2 overflow-x-auto shrink-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('pribadi')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'pribadi'
                ? 'border-blue-600 text-blue-600 bg-white shadow-2xs rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>1. Data Pribadi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sekolah')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'sekolah'
                ? 'border-blue-600 text-blue-600 bg-white shadow-2xs rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <School className="w-3.5 h-3.5" />
            <span>2. Sekolah Asal</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ortu')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'ortu'
                ? 'border-blue-600 text-blue-600 bg-white shadow-2xs rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>3. Orang Tua & Wali</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'status'
                ? 'border-blue-600 text-blue-600 bg-white shadow-2xs rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>4. Status & Kelas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('kredensial')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'kredensial'
                ? 'border-amber-600 text-amber-600 bg-white shadow-2xs rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-amber-500" />
            <span>5. Akun & Password</span>
          </button>
        </div>

        {/* Tab Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            
            {/* TAB 1: DATA PRIBADI */}
            {activeTab === 'pribadi' && (
              <div className="space-y-4 animate-in fade-in">
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Biodata identitas resmi calon murid sesuai Kartu Keluarga (KK) dan Akta Kelahiran.</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Lengkap Siswa <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.fullName || ''}
                      onChange={(e) => handleChange('fullName', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Masukkan nama lengkap siswa..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Jenis Kelamin <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.gender || 'Laki-laki'}
                      onChange={(e) => handleChange('gender', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                      <option value="Laki-laki">Laki-laki (L)</option>
                      <option value="Perempuan">Perempuan (P)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      NIK (Nomor Induk Kependudukan)
                    </label>
                    <input
                      type="text"
                      maxLength={16}
                      value={formData.nik || ''}
                      onChange={(e) => handleChange('nik', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="16 digit NIK KK..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      NISN (Nomor Induk Siswa Nasional)
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      value={formData.nisn || ''}
                      onChange={(e) => handleChange('nisn', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="10 digit NISN..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tempat Lahir
                    </label>
                    <input
                      type="text"
                      value={formData.birthPlace || ''}
                      onChange={(e) => handleChange('birthPlace', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Kota tempat lahir..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tanggal Lahir
                    </label>
                    <input
                      type="date"
                      value={formData.birthDate || ''}
                      onChange={(e) => handleChange('birthDate', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Agama
                    </label>
                    <select
                      value={formData.religion || 'Islam'}
                      onChange={(e) => handleChange('religion', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
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
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      No. WhatsApp / HP Siswa <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={formData.phone || ''}
                        onChange={(e) => handleChange('phone', e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Contoh: 081234567890"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Anak Ke-
                    </label>
                    <input
                      type="text"
                      value={formData.childOrder || ''}
                      onChange={(e) => handleChange('childOrder', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Contoh: 1"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Dari Berapa Bersaudara
                    </label>
                    <input
                      type="text"
                      value={formData.totalSiblings || ''}
                      onChange={(e) => handleChange('totalSiblings', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Contoh: 3"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Alamat Lengkap Tempat Tinggal
                    </label>
                    <textarea
                      rows={2}
                      value={formData.address || ''}
                      onChange={(e) => handleChange('address', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Jalan, No. Rumah, RT/RW..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Kelurahan / Desa
                    </label>
                    <input
                      type="text"
                      value={formData.village || ''}
                      onChange={(e) => handleChange('village', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Desa/Kelurahan..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Kecamatan
                    </label>
                    <input
                      type="text"
                      value={formData.subdistrict || ''}
                      onChange={(e) => handleChange('subdistrict', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Kecamatan..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Kabupaten / Kota
                    </label>
                    <input
                      type="text"
                      value={formData.city || ''}
                      onChange={(e) => handleChange('city', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Kabupaten/Kota..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Provinsi & Kode Pos
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={formData.province || ''}
                        onChange={(e) => handleChange('province', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Provinsi..."
                      />
                      <input
                        type="text"
                        maxLength={5}
                        value={formData.postalCode || ''}
                        onChange={(e) => handleChange('postalCode', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Kode Pos..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SEKOLAH ASAL */}
            {activeTab === 'sekolah' && (
              <div className="space-y-4 animate-in fade-in">
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center gap-2">
                  <School className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Informasi jenjang SD/MI asal calon murid untuk pemetaan jalur internal / eksternal.</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Sekolah Asal (SD / MI)
                    </label>
                    <input
                      type="text"
                      value={formData.previousSchoolName || ''}
                      onChange={(e) => handleChange('previousSchoolName', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Contoh: SD Al-Hadiid / SDN 01 Cileungsi..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      NPSN Sekolah Asal
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      value={formData.previousSchoolNpsn || ''}
                      onChange={(e) => handleChange('previousSchoolNpsn', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="8 digit NPSN..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Alamat / Kota Sekolah Asal
                    </label>
                    <input
                      type="text"
                      value={formData.previousSchoolAddress || ''}
                      onChange={(e) => handleChange('previousSchoolAddress', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Kecamatan / Kota sekolah asal..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: DATA ORANG TUA & WALI */}
            {activeTab === 'ortu' && (
              <div className="space-y-4 animate-in fade-in">
                {/* Data Ayah */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <span>Data Ayah Kandung</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Nama Ayah</label>
                      <input
                        type="text"
                        value={formData.fatherName || ''}
                        onChange={(e) => handleChange('fatherName', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Nama lengkap ayah..."
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">No. HP / WA Ayah</label>
                      <input
                        type="text"
                        value={formData.fatherPhone || ''}
                        onChange={(e) => handleChange('fatherPhone', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="0812..."
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Pekerjaan Ayah</label>
                      <input
                        type="text"
                        value={formData.fatherJob || ''}
                        onChange={(e) => handleChange('fatherJob', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Pekerjaan ayah..."
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Pendidikan Terakhir Ayah</label>
                      <input
                        type="text"
                        value={formData.fatherEducation || ''}
                        onChange={(e) => handleChange('fatherEducation', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Contoh: S1 / SMA..."
                      />
                    </div>
                  </div>
                </div>

                {/* Data Ibu */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                    <User className="w-3.5 h-3.5 text-pink-600" />
                    <span>Data Ibu Kandung</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Nama Ibu</label>
                      <input
                        type="text"
                        value={formData.motherName || ''}
                        onChange={(e) => handleChange('motherName', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Nama lengkap ibu..."
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">No. HP / WA Ibu</label>
                      <input
                        type="text"
                        value={formData.motherPhone || ''}
                        onChange={(e) => handleChange('motherPhone', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="0812..."
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Pekerjaan Ibu</label>
                      <input
                        type="text"
                        value={formData.motherJob || ''}
                        onChange={(e) => handleChange('motherJob', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Pekerjaan ibu / Ibu Rumah Tangga..."
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Pendidikan Terakhir Ibu</label>
                      <input
                        type="text"
                        value={formData.motherEducation || ''}
                        onChange={(e) => handleChange('motherEducation', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Contoh: S1 / SMA..."
                      />
                    </div>
                  </div>
                </div>

                {/* Data Wali */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-600" />
                    <span>Data Wali (Opsional / Jika Diwakili)</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Nama Wali</label>
                      <input
                        type="text"
                        value={formData.guardianName || ''}
                        onChange={(e) => handleChange('guardianName', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Nama wali..."
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Hubungan Keluarga</label>
                      <input
                        type="text"
                        value={formData.guardianRelation || ''}
                        onChange={(e) => handleChange('guardianRelation', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Paman / Kakek..."
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">No. HP Wali</label>
                      <input
                        type="text"
                        value={formData.guardianPhone || ''}
                        onChange={(e) => handleChange('guardianPhone', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="0812..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: STATUS & KELAS */}
            {activeTab === 'status' && (
              <div className="space-y-4 animate-in fade-in">
                <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Atur status pendaftaran, pembayaran formulir, BAM (daftar ulang), dan penempatan kelas murid.</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      No. Pendaftaran (Nomor Registrasi)
                    </label>
                    <input
                      type="text"
                      value={formData.registrationNumber || ''}
                      onChange={(e) => handleChange('registrationNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-emerald-800 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Status Tahapan SPMB
                    </label>
                    <select
                      value={formData.status || 'draft'}
                      onChange={(e) => handleChange('status', e.target.value as AdmissionStatus)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                      <option value="draft">Draft (Baru Buat Akun)</option>
                      <option value="pending">Pending (Menunggu Form/Bayar)</option>
                      <option value="verifying_payment">Verifikasi Pembayaran</option>
                      <option value="filling_form">Pengisian Formulir</option>
                      <option value="form_submitted">Formulir Terkirim</option>
                      <option value="form_verified">Formulir Terverifikasi</option>
                      <option value="scheduled_test">Menunggu Jadwal Tes</option>
                      <option value="passed">Lulus Seleksi</option>
                      <option value="passed_reserved">Lulus Cadangan</option>
                      <option value="failed">Tidak Lulus</option>
                      <option value="re_registered">Sudah Daftar Ulang (BAM)</option>
                      <option value="class_assigned">Penempatan Kelas</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Status Pembayaran Formulir (Rp 200.000)
                    </label>
                    <select
                      value={formData.formPaymentStatus || 'unpaid'}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        handleChange('formPaymentStatus', val);
                        if (val === 'verified') {
                          handleChange('isFormVerified', true);
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                      <option value="verified">✓ Verified (Lunas)</option>
                      <option value="pending">⏳ Pending (Menunggu Verifikasi)</option>
                      <option value="unpaid">✕ Belum Bayar</option>
                      <option value="rejected">✕ Ditolak</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nominal Pembayaran Formulir (Rp)
                    </label>
                    <input
                      type="number"
                      value={formData.formPaymentAmount || 200000}
                      onChange={(e) => handleChange('formPaymentAmount', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Status Biaya Awal Masuk (BAM / Daftar Ulang)
                    </label>
                    <select
                      value={formData.initialPaymentStatus || 'unpaid'}
                      onChange={(e) => handleChange('initialPaymentStatus', e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                      <option value="verified">✓ Verified (Lunas / Cicilan Sah)</option>
                      <option value="pending">⏳ Pending (Menunggu Verifikasi Bukti)</option>
                      <option value="unpaid">✕ Belum Bayar</option>
                      <option value="rejected">✕ Ditolak</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nominal Pembayaran BAM Tercatat (Rp)
                    </label>
                    <input
                      type="number"
                      value={formData.initialPaymentAmount || 0}
                      onChange={(e) => handleChange('initialPaymentAmount', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Kategori & Potongan Biaya Awal Masuk (BAM) */}
                  <div className="sm:col-span-2 p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-bold text-amber-900">Kategori & Potongan Biaya Awal Masuk (BAM)</span>
                      </div>
                      <span className="text-[10px] bg-amber-200/60 text-amber-900 px-2 py-0.5 rounded font-bold">
                        Keringanan / Beasiswa
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Pilihan Kategori Potongan
                        </label>
                        <select
                          value={formData.bamDiscountCategory || 'none'}
                          onChange={(e) => {
                            const catId = e.target.value;
                            handleChange('bamDiscountCategory', catId);
                            const cat = getBamDiscountCategory(catId);
                            if (catId !== 'custom') {
                              handleChange('bamDiscountAmount', cat.defaultAmount);
                            }
                          }}
                          className="w-full px-3 py-2 border border-amber-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none bg-white text-slate-900"
                        >
                          {BAM_DISCOUNT_CATEGORIES.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name} {cat.defaultAmount > 0 ? `(-Rp ${cat.defaultAmount.toLocaleString('id-ID')})` : ''}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-amber-800 mt-1">
                          {getBamDiscountCategory(formData.bamDiscountCategory).description}
                        </p>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Nominal Potongan (Rp)
                        </label>
                        <input
                          type="number"
                          value={formData.bamDiscountAmount ?? 0}
                          onChange={(e) => handleChange('bamDiscountAmount', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-amber-300 rounded-xl text-xs font-mono font-bold text-emerald-800 bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                          placeholder="0"
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          Terpotong otomatis dari total kewajiban BAM murid
                        </span>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Catatan / Alasan Verifikasi Potongan
                        </label>
                        <input
                          type="text"
                          value={formData.bamDiscountNotes || ''}
                          onChange={(e) => handleChange('bamDiscountNotes', e.target.value)}
                          className="w-full px-3 py-1.5 border border-amber-300 rounded-xl text-xs text-slate-800 bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                          placeholder="Contoh: Alumni SD Islam Al-Hadiid / Kakak kandung kelas 8B / Sertifikat Tahfidz Juz 30"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Penempatan Kelas
                    </label>
                    <select
                      value={formData.assignedClassName || ''}
                      onChange={(e) => {
                        const selectedName = e.target.value;
                        handleChange('assignedClassName', selectedName);
                        const matched = classQuotas.find(q => q.className === selectedName);
                        if (matched) {
                          handleChange('assignedClassId', matched.id);
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none bg-white text-blue-700"
                    >
                      <option value="">-- Belum Ditentukan --</option>
                      {classQuotas.map((cq) => (
                        <option key={cq.id} value={cq.className}>
                          Kelas {cq.className} - Terisi: {cq.filled}/{cq.capacity} siswa
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Jalur Masuk / Program
                    </label>
                    <select
                      value={formData.entryPath || formData.selectedProgram || 'Reguler'}
                      onChange={(e) => {
                        handleChange('entryPath', e.target.value);
                        handleChange('selectedProgram', e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                      <option value="Reguler">Reguler</option>
                      <option value="Prestasi">Prestasi (Akademik / Non-Akademik)</option>
                      <option value="Tahfidz">Tahfidz Qur'an</option>
                      <option value="Afirmasi">Afirmasi / KIP</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <input
                      type="checkbox"
                      id="isFormVerifiedCheck"
                      checked={!!formData.isFormVerified}
                      onChange={(e) => handleChange('isFormVerified', e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                    />
                    <label htmlFor="isFormVerifiedCheck" className="text-xs font-semibold text-slate-800 cursor-pointer select-none">
                      Tandai Berkas & Formulir telah diverifikasi oleh Panitia (Membuka akses cetak kartu ujian dan pengunduhan formulir di akun siswa).
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: AKUN & KREDENSIAL LOGIN */}
            {activeTab === 'kredensial' && (
              <div className="space-y-4 animate-in fade-in">
                <div className="bg-amber-50/80 border border-amber-300 rounded-xl p-3.5 text-xs text-amber-950 flex items-start gap-2.5">
                  <Key className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong className="font-bold">Kredensial Login Murid:</strong> Kredensial ini digunakan calon murid untuk masuk ke halaman portal pendaftaran, mengunduh kartu ujian, dan login ke sistem CBT Online Al-Hadiid.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email Akun Pendaftar <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        value={formData.userEmail || ''}
                        onChange={(e) => handleChange('userEmail', e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Username Login Murid <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <User className="w-3.5 h-3.5 text-slate-400 absolute left-3" />
                      <input
                        type="text"
                        required
                        value={formData.username || ''}
                        onChange={(e) => {
                          handleChange('username', e.target.value);
                          handleChange('examUsername', e.target.value);
                        }}
                        className="w-full pl-9 pr-20 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none"
                        placeholder="Username login..."
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyText(formData.username || '', 'username')}
                        className="absolute right-2 text-[10px] font-bold px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        title="Salin Username"
                      >
                        {copiedField === 'username' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                        <span>{copiedField === 'username' ? 'Tersalin' : 'Salin'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        Password Login Murid <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateRandomPassword}
                        className="text-[11px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        <span>Generate Password Acak</span>
                      </button>
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={formData.passwordInput || ''}
                        onChange={(e) => {
                          handleChange('passwordInput', e.target.value);
                          handleChange('password', e.target.value);
                          handleChange('examPassword', e.target.value);
                        }}
                        className="w-full pl-3 pr-28 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                        placeholder="Masukkan password login..."
                      />

                      <div className="absolute right-2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyText(formData.passwordInput || '', 'password')}
                          className="text-[10px] font-bold px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          title="Salin Password"
                        >
                          {copiedField === 'password' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                          <span>{copiedField === 'password' ? 'Tersalin' : 'Salin'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview Box Format Kredensial untuk Orang Tua */}
                <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Format Kredensial Siap Kirim ke WhatsApp Ortu:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const text = `*KREDENSIAL LOGIN SPMB SMP AL-HADIID*\nNama Calon Murid: ${formData.fullName}\nNo. Registrasi: ${formData.registrationNumber}\nUsername: ${formData.username}\nPassword: ${formData.passwordInput}\nLink Portal: ${window.location.origin}`;
                        handleCopyText(text, 'preview');
                      }}
                      className="text-[10px] font-bold px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'preview' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'preview' ? 'Format Tersalin!' : 'Salin Pesan WA'}</span>
                    </button>
                  </div>
                  <pre className="text-[11px] font-mono bg-slate-950 p-2.5 rounded-lg overflow-x-auto text-slate-300 select-all whitespace-pre-wrap">
{`Assalamu'alaikum Wr. Wb.
Kredensial Akun Calon Murid SPMB SMP Al-Hadiid:
- Nama: ${formData.fullName || '-'}
- No. Registrasi: ${formData.registrationNumber || '-'}
- Username: ${formData.username || '-'}
- Password: ${formData.passwordInput || '-'}

Silakan gunakan kredensial di atas untuk login ke portal SPMB & Ujian CBT Online.`}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <div className="text-xs text-slate-500 hidden sm:block">
              Perubahan langsung disimpan ke Supabase database dan sinkron dengan akun murid.
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Perubahan Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
