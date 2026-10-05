import React, { useState, useRef } from 'react';
import Swal from 'sweetalert2';
import {
  X, Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle, AlertCircle,
  RefreshCw, Check, ArrowRight, FileCheck2, User, Users, Info, Sparkles
} from 'lucide-react';
import { StudentData, SchoolInfo } from '../types';
import {
  parseStudentsFromExcel,
  downloadStudentExcelTemplate,
  exportStudentsToExcel,
  StudentExcelParseResult,
  ParsedStudentRow,
} from '../utils/studentExcelService';
import { StudentRepository } from '../repositories/StudentRepository';

interface StudentExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: StudentData[];
  filteredStudents?: StudentData[];
  schoolInfo: SchoolInfo;
  onStudentsUpdated: (updatedList: StudentData[]) => Promise<void> | void;
  onRefreshAllData?: () => void;
  initialTab?: 'import' | 'export';
}

export const StudentExcelModal: React.FC<StudentExcelModalProps> = ({
  isOpen,
  onClose,
  students,
  filteredStudents,
  schoolInfo,
  onStudentsUpdated,
  onRefreshAllData,
  initialTab = 'import',
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>(initialTab);

  // Import State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<StudentExcelParseResult | null>(null);
  const [duplicateHandling, setDuplicateHandling] = useState<'update' | 'skip'>('update');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [filterPreviewStatus, setFilterPreviewStatus] = useState<'all' | 'valid' | 'warning' | 'error'>('all');

  // Export State
  const [exportScope, setExportScope] = useState<'all' | 'filtered'>('all');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Handle file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(fileExt || '')) {
      Swal.fire({
        icon: 'error',
        title: 'Format File Tidak Didukung',
        text: 'Silakan upload file tabel berformat .xlsx, .xls, atau .csv.',
      });
      return;
    }

    setSelectedFile(file);
    setIsParsing(true);

    try {
      const result = await parseStudentsFromExcel(file, students);
      setParseResult(result);
    } catch (err: any) {
      console.error('Gagal membaca file Excel:', err);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Membaca File Excel',
        text: err?.message || 'Pastikan file Excel tidak rusak dan memiliki struktur tabel yang benar.',
      });
      setSelectedFile(null);
      setParseResult(null);
    } finally {
      setIsParsing(false);
      // Reset input value to allow re-selecting same file
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Reset file selection
  const handleResetFile = () => {
    setSelectedFile(null);
    setParseResult(null);
    setImportProgress({ current: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Execute Import to Database
  const handleExecuteImport = async () => {
    if (!parseResult || parseResult.readyStudents.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Tidak Ada Data',
        text: 'Tidak ada baris data calon murid yang valid untuk diimpor.',
      });
      return;
    }

    // Filter students based on duplicate handling
    let studentsToProcess = parseResult.readyStudents;
    const existingRegMap = new Map<string, StudentData>(
      students.map((s) => [s.registrationNumber?.toUpperCase() || '', s])
    );

    if (duplicateHandling === 'skip') {
      studentsToProcess = studentsToProcess.filter((s) => !existingRegMap.has(s.registrationNumber.toUpperCase()));
      if (studentsToProcess.length === 0) {
        Swal.fire({
          icon: 'info',
          title: 'Semua Data Dilewati',
          text: 'Seluruh nomor pendaftaran dalam file sudah terdaftar di database.',
        });
        return;
      }
    }

    const confirm = await Swal.fire({
      title: 'Konfirmasi Impor Data Calon Murid',
      html: `
        <div style="text-align: left; font-size: 13px; color: #334155; line-height: 1.6;">
          <p style="margin-bottom: 8px;">
            Anda akan mengimpor <strong>${studentsToProcess.length}</strong> data calon murid ke database SPMB Supabase.
          </p>
          <div style="background-color: #f1f5f9; padding: 10px; border-radius: 8px; font-size: 12px; margin-bottom: 8px;">
            <div>• Mode Duplikasi: <strong>${duplicateHandling === 'update' ? 'Perbarui Data Yang Sudah Ada' : 'Lewati Data Yang Sudah Ada'}</strong></div>
            <div>• File: <code>${selectedFile?.name}</code></div>
          </div>
          <p style="font-size: 11px; color: #64748b;">
            * Setiap calon murid akan diverifikasi dan disinkronkan ke database server secara aman.
          </p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '🚀 Ya, Mulai Impor',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#64748b',
      customClass: {
        popup: 'rounded-2xl font-sans',
      },
    });

    if (!confirm.isConfirmed) return;

    setIsImporting(true);
    setImportProgress({ current: 0, total: studentsToProcess.length });

    let successCount = 0;
    let failCount = 0;
    const currentStudentsMap = new Map<string, StudentData>(students.map((s) => [s.id, s]));

    for (let i = 0; i < studentsToProcess.length; i++) {
      const student = studentsToProcess[i];
      setImportProgress({ current: i + 1, total: studentsToProcess.length });

      try {
        // Cek apakah ada record yang cocok berdasarkan registrationNumber
        const existing = students.find(
          (e) => e.registrationNumber?.toUpperCase() === student.registrationNumber.toUpperCase()
        );

        if (existing) {
          if (duplicateHandling === 'update') {
            const updatedItem: StudentData = {
              ...existing,
              ...student,
              id: existing.id, // Pertahankan ID asli
              version: existing.version,
              updatedAt: new Date().toISOString(),
            };
            const res = await StudentRepository.update(existing.id, updatedItem, existing.version);
            if (!res.error) {
              currentStudentsMap.set(existing.id, res.data || updatedItem);
              successCount++;
            } else {
              failCount++;
            }
          }
        } else {
          // Buat record baru di database Supabase
          const res = await StudentRepository.create(student);
          if (!res.error && res.data) {
            currentStudentsMap.set(res.data.id, res.data);
            successCount++;
          } else {
            failCount++;
          }
        }
      } catch (err) {
        console.error('Gagal memproses baris import:', err);
        failCount++;
      }
    }

    setIsImporting(false);

    // Update parent state
    const finalStudentList = Array.from(currentStudentsMap.values());
    try {
      await onStudentsUpdated(finalStudentList);
    } catch {}

    if (onRefreshAllData) {
      onRefreshAllData();
    }

    Swal.fire({
      icon: successCount > 0 ? 'success' : 'error',
      title: successCount > 0 ? 'Impor Data Calon Murid Berhasil!' : 'Impor Gagal',
      html: `
        <div style="text-align: left; font-size: 13px; color: #334155;">
          <p style="margin-bottom: 6px;">
            Proses impor data calon murid dari file Excel telah selesai.
          </p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; font-size: 12px;">
            <div style="color: #16a34a; font-weight: bold;">✓ Berhasil diimpor / diperbarui: ${successCount} siswa</div>
            ${failCount > 0 ? `<div style="color: #dc2626; font-weight: bold;">✕ Gagal: ${failCount} siswa</div>` : ''}
            <div>• Total data pendaftar saat ini: ${finalStudentList.length} calon murid</div>
          </div>
        </div>
      `,
      confirmButtonText: 'Selesai',
      confirmButtonColor: '#2563eb',
    });

    handleResetFile();
    onClose();
  };

  // Execute Export
  const handleExecuteExport = () => {
    const listToExport = exportScope === 'filtered' && filteredStudents ? filteredStudents : students;

    if (listToExport.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Data Kosong',
        text: 'Tidak ada data calon murid yang dapat diekspor.',
      });
      return;
    }

    exportStudentsToExcel(listToExport, schoolInfo, {
      filterLabel: exportScope === 'filtered' ? 'Data Terfilter (Hasil Pencarian / Kategori)' : 'Seluruh Pendaftar',
    });

    Swal.fire({
      icon: 'success',
      title: 'File Excel Berhasil Diunduh!',
      text: `${listToExport.length} data calon murid berhasil diekspor ke format Excel (.xlsx).`,
      timer: 2500,
      showConfirmButton: false,
    });
  };

  // Preview filtering
  const previewRows = parseResult
    ? parseResult.rows.filter((r) => {
        if (filterPreviewStatus === 'valid') return r.isValid && !r.isDuplicate;
        if (filterPreviewStatus === 'warning') return r.isDuplicate || r.warnings.length > 0;
        if (filterPreviewStatus === 'error') return !r.isValid;
        return true;
      })
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-inner">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span>Export & Import Data Calon Murid (Excel)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Format tabel resmi Microsoft Excel (.xlsx / .xls) untuk SPMB SMP Al-Hadiid Cileungsi
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-100/50 p-1.5 gap-2 px-6">
          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
              activeTab === 'import'
                ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>📥 Import Data Calon Murid</span>
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
              activeTab === 'export'
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>📤 Export Data Calon Murid ({students.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
          {/* TAB 1: IMPORT EXCEL */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              {/* Step 1: Download Template */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-extrabold text-blue-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Langkah 1: Unduh Format Template Standar</span>
                  </div>
                  <p className="text-xs text-blue-800">
                    Gunakan template resmi agar kolom data (nama, jenis kelamin, asal sekolah, no HP orang tua, dll) terpetakan dengan benar dan otomatis.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => downloadStudentExcelTemplate(schoolInfo)}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 shrink-0 border border-blue-500"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Template Excel (.xlsx)</span>
                </button>
              </div>

              {/* Step 2: Upload Area */}
              {!parseResult ? (
                <div className="space-y-3">
                  <div className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-slate-600" />
                    <span>Langkah 2: Pilih atau Tarik File Excel</span>
                  </div>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 rounded-3xl p-8 text-center cursor-pointer transition-all space-y-3 group"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    <div className="w-14 h-14 bg-blue-100 group-hover:bg-blue-200 text-blue-700 rounded-full flex items-center justify-center mx-auto transition-transform group-hover:scale-105">
                      {isParsing ? (
                        <RefreshCw className="w-6 h-6 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="w-7 h-7" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="font-extrabold text-slate-800 text-sm">
                        {isParsing ? 'Sedang Memproses Data File...' : 'Klik untuk Memilih File atau Tarik ke Sini'}
                      </div>
                      <p className="text-xs text-slate-500">
                        Format didukung: <strong>.xlsx</strong>, <strong>.xls</strong>, atau <strong>.csv</strong> (Maksimal 5.000 baris)
                      </p>
                    </div>
                  </div>

                  {/* Format Tips */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Tips Pengisian Kolom:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 pl-1 text-slate-600">
                      <li>Kolom <strong>Nama_Lengkap</strong> wajib diisi untuk setiap calon murid.</li>
                      <li>Kolom <strong>Jenis_Kelamin</strong> otomatis mengenali 'Laki-laki', 'Perempuan', 'L', atau 'P'.</li>
                      <li>Kolom <strong>No_Pendaftaran</strong> boleh dikosongkan (sistem otomatis menerbitkan nomor resmi SPMB2027XXXX).</li>
                    </ul>
                  </div>
                </div>
              ) : (
                /* Step 3: Preview & Validation Table */
                <div className="space-y-4">
                  {/* File Info & Statistics Bar */}
                  <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
                      <div>
                        <div className="font-extrabold text-sm">{selectedFile?.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {parseResult.totalRows} baris terdeteksi • {((selectedFile?.size || 0) / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleResetFile}
                        disabled={isImporting}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-colors"
                      >
                        Ganti File
                      </button>
                    </div>
                  </div>

                  {/* Statistics Badges & Filter Tabs */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div
                      onClick={() => setFilterPreviewStatus('all')}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                        filterPreviewStatus === 'all'
                          ? 'bg-slate-100 border-slate-400 font-black'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="text-base font-extrabold text-slate-900">{parseResult.totalRows}</div>
                      <div className="text-[10px] text-slate-500 font-bold">Total Baris</div>
                    </div>

                    <div
                      onClick={() => setFilterPreviewStatus('valid')}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                        filterPreviewStatus === 'valid'
                          ? 'bg-emerald-100 border-emerald-500 font-black'
                          : 'bg-emerald-50 border-emerald-200'
                      }`}
                    >
                      <div className="text-base font-extrabold text-emerald-800">{parseResult.validCount}</div>
                      <div className="text-[10px] text-emerald-700 font-bold">✓ Siap Impor Baru</div>
                    </div>

                    <div
                      onClick={() => setFilterPreviewStatus('warning')}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                        filterPreviewStatus === 'warning'
                          ? 'bg-amber-100 border-amber-500 font-black'
                          : 'bg-amber-50 border-amber-200'
                      }`}
                    >
                      <div className="text-base font-extrabold text-amber-800">{parseResult.warningCount}</div>
                      <div className="text-[10px] text-amber-700 font-bold">⚠ Sudah Ada / Diupdate</div>
                    </div>

                    <div
                      onClick={() => setFilterPreviewStatus('error')}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                        filterPreviewStatus === 'error'
                          ? 'bg-rose-100 border-rose-500 font-black'
                          : 'bg-rose-50 border-rose-200'
                      }`}
                    >
                      <div className="text-base font-extrabold text-rose-800">{parseResult.errorCount}</div>
                      <div className="text-[10px] text-rose-700 font-bold">✕ Tidak Valid</div>
                    </div>
                  </div>

                  {/* Duplicate Handling Options */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <span className="font-bold text-slate-700">Jika Nomor Pendaftaran Sudah Terdaftar:</span>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="duplicateHandling"
                          value="update"
                          checked={duplicateHandling === 'update'}
                          onChange={() => setDuplicateHandling('update')}
                          className="text-blue-600"
                        />
                        <span className="font-semibold text-slate-800">Perbarui Data (Update)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="duplicateHandling"
                          value="skip"
                          checked={duplicateHandling === 'skip'}
                          onChange={() => setDuplicateHandling('skip')}
                          className="text-blue-600"
                        />
                        <span className="font-semibold text-slate-800">Lewati (Skip)</span>
                      </label>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 sticky top-0 z-10 text-slate-700 font-bold">
                        <tr className="border-b border-slate-200">
                          <th className="p-2.5 text-center w-12">Baris</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5">No. Reg</th>
                          <th className="p-2.5">Nama Calon Murid</th>
                          <th className="p-2.5">JK</th>
                          <th className="p-2.5">Sekolah Asal</th>
                          <th className="p-2.5">No. HP Ortu</th>
                          <th className="p-2.5">Catatan Validasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewRows.map((r, idx) => (
                          <tr key={idx} className={r.errors.length > 0 ? 'bg-rose-50/50' : r.isDuplicate ? 'bg-amber-50/40' : 'hover:bg-slate-50'}>
                            <td className="p-2.5 text-center font-mono text-slate-400">{r.rowNumber}</td>
                            <td className="p-2.5">
                              {r.errors.length > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                                  <AlertCircle className="w-3 h-3 text-rose-600" /> Error
                                </span>
                              ) : r.isDuplicate ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" /> Terdaftar
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                  <Check className="w-3 h-3 text-emerald-600" /> Valid
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 font-mono font-bold text-blue-900">{r.data.registrationNumber}</td>
                            <td className="p-2.5 font-bold text-slate-900">{r.data.fullName}</td>
                            <td className="p-2.5">
                              {r.data.gender === 'Laki-laki' ? (
                                <span className="text-blue-700 font-semibold">Ikhwan</span>
                              ) : (
                                <span className="text-pink-700 font-semibold">Akhwat</span>
                              )}
                            </td>
                            <td className="p-2.5 text-slate-600">{r.data.previousSchoolName || '-'}</td>
                            <td className="p-2.5 font-mono">{r.data.phone || '-'}</td>
                            <td className="p-2.5 text-[11px]">
                              {r.errors.length > 0 ? (
                                <span className="text-rose-700 font-semibold">{r.errors.join(', ')}</span>
                              ) : r.warnings.length > 0 ? (
                                <span className="text-amber-700">{r.warnings.join(', ')}</span>
                              ) : (
                                <span className="text-emerald-700">Siap disimpan</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Progress Indicator during Import */}
                  {isImporting && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                        <span className="flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                          <span>Menyimpan Calon Murid ke Database Supabase...</span>
                        </span>
                        <span>
                          {importProgress.current} / {importProgress.total}
                        </span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${(importProgress.current / Math.max(1, importProgress.total)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleResetFile}
                      disabled={isImporting}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-colors w-full sm:w-auto"
                    >
                      Batal / Ganti File
                    </button>

                    <button
                      type="button"
                      onClick={handleExecuteImport}
                      disabled={isImporting || parseResult.readyStudents.length === 0}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 w-full sm:w-auto border border-blue-500"
                    >
                      {isImporting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Mengimpor Data ({importProgress.current}/{importProgress.total})...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span>Mulai Impor {parseResult.readyStudents.length} Calon Murid</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EXPORT EXCEL */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 space-y-2">
                <div className="font-extrabold text-emerald-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>Export Tabel Lengkap Calon Murid ke Excel (.xlsx)</span>
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Unduh seluruh rekapan data pendaftar calon murid SMP Al-Hadiid dalam format spreadsheet resmi Microsoft Excel (.xlsx), dilengkapi kop sekolah resmi, data orang tua, riwayat pembayaran, serta hasil kelulusan.
                </p>
              </div>

              {/* Scope Selection */}
              <div className="space-y-3">
                <div className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Pilih Data yang Akan Diekspor:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    onClick={() => setExportScope('all')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      exportScope === 'all'
                        ? 'bg-emerald-50/60 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="exportScope"
                      checked={exportScope === 'all'}
                      onChange={() => setExportScope('all')}
                      className="mt-1 text-emerald-600"
                    />
                    <div className="space-y-1">
                      <div className="font-extrabold text-slate-900 text-sm">
                        Semua Calon Murid
                      </div>
                      <div className="text-xs text-slate-500">
                        Seluruh pendaftar yang ada di database ({students.length} siswa)
                      </div>
                    </div>
                  </label>

                  <label
                    onClick={() => {
                      if (filteredStudents && filteredStudents.length > 0) {
                        setExportScope('filtered');
                      }
                    }}
                    className={`p-4 rounded-2xl border transition-all flex items-start gap-3 ${
                      !filteredStudents || filteredStudents.length === 0
                        ? 'opacity-60 cursor-not-allowed bg-slate-50 border-slate-200'
                        : exportScope === 'filtered'
                        ? 'bg-emerald-50/60 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm cursor-pointer'
                        : 'bg-white border-slate-200 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <input
                      type="radio"
                      name="exportScope"
                      checked={exportScope === 'filtered'}
                      onChange={() => setExportScope('filtered')}
                      disabled={!filteredStudents || filteredStudents.length === 0}
                      className="mt-1 text-emerald-600"
                    />
                    <div className="space-y-1">
                      <div className="font-extrabold text-slate-900 text-sm">
                        Sesuai Filter / Pencarian Saat Ini
                      </div>
                      <div className="text-xs text-slate-500">
                        {filteredStudents ? `${filteredStudents.length} siswa sesuai filter tabel` : 'Filter tabel pendaftar'}
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Export Columns Preview */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                  Kolom yang Akan Disertakan dalam File Excel:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> No. Pendaftaran & Nama</div>
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Jenis Kelamin (Ikhwan/Akhwat)</div>
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> NIK & NISN</div>
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Tempat & Tanggal Lahir</div>
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Asal Sekolah SD/MI</div>
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> No. WhatsApp / HP</div>
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Alamat Lengkap & Kota</div>
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Nama & HP Orang Tua (Ayah/Ibu)</div>
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Status Bayar Formulir</div>
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Status Biaya Awal Masuk (BAM)</div>
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Nilai Tes & Status Lulus</div>
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Kelas Penempatan Rombel</div>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-colors"
                >
                  Tutup
                </button>

                <button
                  type="button"
                  onClick={handleExecuteExport}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 border border-emerald-500"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    Unduh File Excel ({exportScope === 'filtered' && filteredStudents ? filteredStudents.length : students.length} Siswa)
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
