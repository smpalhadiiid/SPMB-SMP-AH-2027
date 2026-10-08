import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import {
  Key, Search, Eye, EyeOff, Copy, Check, FileSpreadsheet,
  Printer, MessageCircle, Edit, Download, Award, CheckCircle2,
  AlertCircle, ShieldCheck, RefreshCw, User, School, Phone, Mail
} from 'lucide-react';
import { StudentData, SchoolInfo } from '../types';
import { resolveStudentCredentials } from '../utils/studentCredentials';

interface StudentCredentialsRecapSectionProps {
  students: StudentData[];
  schoolInfo: SchoolInfo;
  onEditStudent: (student: StudentData) => void;
  onDownloadExamCard?: (student: StudentData) => void;
  onRefreshAllData?: () => void;
}

export const StudentCredentialsRecapSection: React.FC<StudentCredentialsRecapSectionProps> = ({
  students,
  schoolInfo,
  onEditStudent,
  onDownloadExamCard,
  onRefreshAllData,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Compute resolved credentials for all students
  const studentWithCreds = useMemo(() => {
    return students.map((s) => {
      const creds = resolveStudentCredentials(s);
      return {
        ...s,
        resolvedUsername: creds.username,
        resolvedPassword: creds.password,
      };
    });
  }, [students]);

  // Filtering
  const filteredStudents = useMemo(() => {
    return studentWithCreds.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.fullName?.toLowerCase().includes(q) ||
        s.registrationNumber?.toLowerCase().includes(q) ||
        s.resolvedUsername?.toLowerCase().includes(q) ||
        s.userEmail?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.previousSchoolName?.toLowerCase().includes(q);

      const matchStatus =
        statusFilter === 'all' ||
        s.status === statusFilter;

      const matchPayment =
        paymentFilter === 'all' ||
        (paymentFilter === 'verified' && s.formPaymentStatus === 'verified') ||
        (paymentFilter === 'pending' && s.formPaymentStatus === 'pending') ||
        (paymentFilter === 'unpaid' && (s.formPaymentStatus === 'unpaid' || !s.formPaymentStatus));

      return matchSearch && matchStatus && matchPayment;
    });
  }, [studentWithCreds, searchQuery, statusFilter, paymentFilter]);

  // Copy helper
  const handleCopyText = (text: string, identifier: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(identifier);
    setTimeout(() => setCopiedKey(null), 2000);

    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 1500,
      timerProgressBar: false,
    });
    Toast.fire({
      icon: 'success',
      title: `${label} berhasil disalin!`,
    });
  };

  // Toggle individual password visibility
  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Generate formatted WhatsApp message for a student
  const getWhatsAppMessage = (s: typeof studentWithCreds[0]) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://spmb.smpalhadiid.sch.id';
    return `*KREDENSIAL LOGIN SPMB SMP AL-HADIID*
----------------------------------------
Nama Calon Murid : ${s.fullName}
No. Registrasi   : ${s.registrationNumber}
Asal Sekolah     : ${s.previousSchoolName || '-'}

🔐 *Informasi Akun Login:*
Username : ${s.resolvedUsername}
Password : ${s.resolvedPassword}

Portal Login: ${origin}
----------------------------------------
_Simpan kredensial ini baik-baik untuk login pengisian formulir dan Ujian CBT Online SMP Al-Hadiid._`;
  };

  // Send direct WhatsApp
  const handleSendWhatsApp = (s: typeof studentWithCreds[0]) => {
    const cleanPhone = (s.phone || s.fatherPhone || s.motherPhone || '').replace(/[^0-9]/g, '');
    let formattedPhone = cleanPhone;
    if (cleanPhone.startsWith('0')) {
      formattedPhone = '62' + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith('62')) {
      formattedPhone = '62' + cleanPhone;
    }

    const message = encodeURIComponent(getWhatsAppMessage(s));
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
  };

  // Export Excel Rekap Akun
  const handleExportExcel = () => {
    setIsExporting(true);
    try {
      const academicYear = schoolInfo.academicYear || '2027/2028';
      const printDate = new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
      const printTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      const headerRows: any[][] = [
        ['REKAP USERNAME & PASSWORD AKUN CALON MURID'],
        ['SMP AL-HADIID CILEUNGSI - SPMB ONLINE'],
        [`Tahun Pelajaran: ${academicYear}`],
        [`Tanggal Export: ${printDate} pukul ${printTime} WIB`],
        [`Total Data: ${filteredStudents.length} Calon Murid`],
        [], // Empty row
      ];

      const dataRows = filteredStudents.map((s, idx) => ({
        No: idx + 1,
        No_Registrasi: s.registrationNumber,
        Nama_Lengkap: s.fullName,
        JK: s.gender === 'Perempuan' ? 'P' : 'L',
        Asal_Sekolah: s.previousSchoolName || '-',
        No_WhatsApp: s.phone || '-',
        Email_Akun: s.userEmail || '-',
        Username_Login: s.resolvedUsername,
        Password_Login: s.resolvedPassword,
        Status_Formulir: s.formPaymentStatus === 'verified' ? 'Lunas' : s.formPaymentStatus === 'pending' ? 'Pending' : 'Belum Bayar',
        Verifikasi_Berkas: s.isFormVerified ? 'Terverifikasi' : 'Belum',
        Status_Pendaftaran: s.status,
        Penempatan_Kelas: s.assignedClassName || '-',
      }));

      const worksheet = XLSX.utils.aoa_to_sheet(headerRows);
      XLSX.utils.sheet_add_json(worksheet, dataRows, { origin: -1 });

      // Auto width
      worksheet['!cols'] = [
        { wch: 6 },  // No
        { wch: 18 }, // No_Registrasi
        { wch: 28 }, // Nama_Lengkap
        { wch: 6 },  // JK
        { wch: 24 }, // Asal_Sekolah
        { wch: 16 }, // No_WhatsApp
        { wch: 26 }, // Email_Akun
        { wch: 20 }, // Username_Login
        { wch: 18 }, // Password_Login
        { wch: 16 }, // Status_Formulir
        { wch: 18 }, // Verifikasi_Berkas
        { wch: 18 }, // Status_Pendaftaran
        { wch: 16 }, // Penempatan_Kelas
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap_Akun_Murid');

      const cleanYear = academicYear.replace('/', '_');
      XLSX.writeFile(workbook, `Rekap_Username_Password_SPMB_${cleanYear}.xlsx`);

      Swal.fire({
        icon: 'success',
        title: 'Export Berhasil',
        text: `File Excel berisi ${filteredStudents.length} akun calon murid telah diunduh.`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err: any) {
      console.error('Export error:', err);
      Swal.fire({
        icon: 'error',
        title: 'Export Gagal',
        text: err?.message || 'Terjadi kesalahan saat membuat file Excel.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Copy mass text format
  const handleCopyAllCredentials = () => {
    if (filteredStudents.length === 0) return;

    let massText = `*REKAP KREDENSIAL LOGIN CALON MURID SPMB SMP AL-HADIID*\nTotal: ${filteredStudents.length} Murid\n\n`;
    filteredStudents.forEach((s, idx) => {
      massText += `${idx + 1}. ${s.fullName} (${s.registrationNumber})\n   Username: ${s.resolvedUsername} | Password: ${s.resolvedPassword}\n   HP/WA: ${s.phone || '-'}\n\n`;
    });

    navigator.clipboard.writeText(massText);
    Swal.fire({
      icon: 'success',
      title: 'Kredensial Tersalin!',
      text: `Format rekap ${filteredStudents.length} akun murid berhasil disalin ke clipboard untuk arsip atau broadcast.`,
    });
  };

  // Statistics
  const totalStudents = students.length;
  const verifiedPaymentCount = students.filter(s => s.formPaymentStatus === 'verified').length;
  const verifiedFormCount = students.filter(s => s.isFormVerified || s.status === 'form_verified').length;
  const readyForExamCount = students.filter(s => s.formPaymentStatus === 'verified' && (s.isFormVerified || s.status === 'form_verified')).length;

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 animate-in fade-in">
      
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-tr from-amber-500 to-amber-600 text-white rounded-xl shadow-md">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
                Rekap Username & Password Calon Murid
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola, salin, dan unduh daftar kredensial login portal & CBT Online seluruh pendaftar SPMB SMP Al-Hadiid.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons Top */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAllPasswords(!showAllPasswords)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
              showAllPasswords
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
            title="Tampilkan atau sembunyikan seluruh password sekaligus"
          >
            {showAllPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showAllPasswords ? 'Sembunyikan Semua Password' : 'Intip Semua Password'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyAllCredentials}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Salin seluruh format username dan password dalam bentuk teks"
          >
            <Copy className="w-3.5 h-3.5 text-slate-600" />
            <span>Salin Format Rekap ({filteredStudents.length})</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Unduh seluruh rekap username dan password dalam file Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Mengekspor...' : 'Export Excel (.xlsx)'}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            title="Cetak tabel rekap kredensial"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Rekap</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Akun Murid</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalStudents}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Tercatat di sistem</div>
        </div>

        <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Formulir Lunas</div>
          <div className="text-2xl font-black text-emerald-800 mt-1">{verifiedPaymentCount}</div>
          <div className="text-[10px] text-emerald-600 mt-0.5">{totalStudents ? Math.round((verifiedPaymentCount / totalStudents) * 100) : 0}% terverifikasi</div>
        </div>

        <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl">
          <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Berkas Terverifikasi</div>
          <div className="text-2xl font-black text-blue-800 mt-1">{verifiedFormCount}</div>
          <div className="text-[10px] text-blue-600 mt-0.5">Data murid valid</div>
        </div>

        <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl">
          <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Siap Ujian CBT</div>
          <div className="text-2xl font-black text-indigo-800 mt-1">{readyForExamCount}</div>
          <div className="text-[10px] text-indigo-600 mt-0.5">Akses ujian & kartu aktif</div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari nama siswa, no registrasi, username, no HP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="all">Semua Status Pendaftaran</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="form_submitted">Form Terkirim</option>
            <option value="form_verified">Form Terverifikasi</option>
            <option value="scheduled_test">Menunggu Tes</option>
            <option value="passed">Lulus Seleksi</option>
            <option value="class_assigned">Penempatan Kelas</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="all">Semua Status Bayar</option>
            <option value="verified">Lunas (Verified)</option>
            <option value="pending">Menunggu Verifikasi</option>
            <option value="unpaid">Belum Bayar</option>
          </select>

          {(searchQuery || statusFilter !== 'all' || paymentFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setPaymentFilter('all');
              }}
              className="px-2.5 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Table Rekap */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
              <th className="p-3 text-center w-12">No.</th>
              <th className="p-3">No. Registrasi</th>
              <th className="p-3">Nama Siswa & Asal Sekolah</th>
              <th className="p-3">Kontak WhatsApp</th>
              <th className="p-3">Username Login</th>
              <th className="p-3">Password Login</th>
              <th className="p-3">Status Form & CBT</th>
              <th className="p-3 text-center">Aksi Cepat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700 bg-white">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  <AlertCircle className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                  <p className="font-semibold">Tidak ada data calon murid yang cocok dengan filter pencarian.</p>
                </td>
              </tr>
            ) : (
              filteredStudents.map((s, idx) => {
                const isPasswordShown = showAllPasswords || !!visiblePasswords[s.id];

                return (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* No */}
                    <td className="p-3 text-center font-mono font-bold text-slate-500">
                      {idx + 1}
                    </td>

                    {/* No Reg */}
                    <td className="p-3 font-mono font-bold text-emerald-800 whitespace-nowrap">
                      {s.registrationNumber}
                    </td>

                    {/* Nama Siswa */}
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{s.fullName}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <School className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{s.previousSchoolName || '-'}</span>
                      </div>
                    </td>

                    {/* No HP */}
                    <td className="p-3 whitespace-nowrap">
                      <div className="font-mono text-slate-700 font-semibold">{s.phone || '-'}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{s.userEmail || '-'}</div>
                    </td>

                    {/* Username */}
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-xs select-all">
                          {s.resolvedUsername}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(s.resolvedUsername, `u_${s.id}`, 'Username')}
                          className="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-md transition-colors cursor-pointer"
                          title="Salin Username"
                        >
                          {copiedKey === `u_${s.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Password */}
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 text-xs select-all">
                          {isPasswordShown ? s.resolvedPassword : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(s.id)}
                          className="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-md transition-colors cursor-pointer"
                          title={isPasswordShown ? 'Sembunyikan Password' : 'Lihat Password'}
                        >
                          {isPasswordShown ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyText(s.resolvedPassword, `p_${s.id}`, 'Password')}
                          className="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-md transition-colors cursor-pointer"
                          title="Salin Password"
                        >
                          {copiedKey === `p_${s.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Status Form & CBT */}
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold w-fit ${
                            s.formPaymentStatus === 'verified'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {s.formPaymentStatus === 'verified' ? '✓ Bayar Lunas' : 'Belum Bayar'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {s.isFormVerified ? '✓ Data Terverifikasi' : '⏳ Belum Verifikasi'}
                        </span>
                      </div>
                    </td>

                    {/* Aksi Cepat */}
                    <td className="p-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditStudent(s)}
                          className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                          title="Edit Biodata & Ubah Password Murid"
                        >
                          <Edit className="w-3 h-3" />
                          <span>Update Data</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSendWhatsApp(s)}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                          title="Kirim Kredensial Langsung ke WhatsApp Ortu"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>Kirim WA</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyText(getWhatsAppMessage(s), `msg_${s.id}`, 'Format WhatsApp')}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                          title="Salin Pesan WA Lengkap"
                        >
                          {copiedKey === `msg_${s.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {onDownloadExamCard && (
                          <button
                            type="button"
                            onClick={() => onDownloadExamCard(s)}
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors cursor-pointer"
                            title="Unduh Kartu Ujian Murid"
                          >
                            <Award className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 pt-2 gap-2">
        <div>
          Menampilkan <strong className="text-slate-800">{filteredStudents.length}</strong> dari{' '}
          <strong className="text-slate-800">{totalStudents}</strong> total calon murid.
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          <span>Password otomatis disinkronkan ke Supabase & akun peserta CBT.</span>
        </div>
      </div>
    </div>
  );
};
