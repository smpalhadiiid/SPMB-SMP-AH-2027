import React, { useState } from 'react';
import { StudentData, ClassQuota } from '../types';
import { exportToExcel } from '../utils/excelExporter';
import {
  Users, School, Search, Filter, Download, Printer, UserCheck,
  Sparkles, CheckCircle2, UserX, GraduationCap, ArrowUpDown, RefreshCw, UserPlus
} from 'lucide-react';

interface FilledClassesSectionProps {
  students: StudentData[];
  classQuotas: ClassQuota[];
  onUpdateStudents?: (updated: StudentData[]) => void;
  isAdminMode?: boolean;
}

export const FilledClassesSection: React.FC<FilledClassesSectionProps> = ({
  students,
  classQuotas,
  onUpdateStudents,
  isAdminMode = false,
}) => {
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'Laki-laki' | 'Perempuan'>('all');

  // Stats Calculations
  const totalCapacity = classQuotas.reduce((acc, q) => acc + q.capacity, 0);

  // Students who have an assigned class
  const assignedStudents = students.filter(s => s.assignedClassId || s.assignedClassName);
  const unassignedStudents = students.filter(s => !s.assignedClassId && !s.assignedClassName);

  const totalAssigned = assignedStudents.length;
  const totalRemainingQuota = Math.max(0, totalCapacity - totalAssigned);

  const assignedLaki = assignedStudents.filter(s => s.gender === 'Laki-laki').length;
  const assignedPerempuan = assignedStudents.filter(s => s.gender === 'Perempuan').length;

  // Filter students based on search, gender, and selected class filter
  const getStudentsForClass = (classId?: string, className?: string) => {
    return students.filter(s => {
      const matchClass = classId
        ? s.assignedClassId === classId || s.assignedClassName === className
        : !s.assignedClassId && !s.assignedClassName;

      const matchSearch =
        s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.previousSchoolName && s.previousSchoolName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchGender = genderFilter === 'all' || s.gender === genderFilter;

      return matchClass && matchSearch && matchGender;
    });
  };

  // Move or assign student to class
  const handleMoveClass = (studentId: string, newClassId: string) => {
    if (!onUpdateStudents) return;

    const targetQuota = classQuotas.find(q => q.id === newClassId);
    const updated = students.map(s => {
      if (s.id === studentId) {
        if (!newClassId) {
          return {
            ...s,
            assignedClassId: undefined,
            assignedClassName: undefined,
            status: s.status === 'class_assigned' ? 're_registered' : s.status,
          };
        }
        return {
          ...s,
          assignedClassId: targetQuota?.id,
          assignedClassName: targetQuota?.className,
          status: 'class_assigned' as const,
        };
      }
      return s;
    });

    onUpdateStudents(updated);
  };

  // Export Roster Excel
  const handleExportRoster = () => {
    const exportData = assignedStudents.map((s, idx) => ({
      No: idx + 1,
      'No Registrasi': s.registrationNumber,
      'Nama Lengkap': s.fullName,
      'Jenis Kelamin': s.gender,
      'Kelas Terisi': s.assignedClassName || '-',
      'Asal Sekolah': s.previousSchoolName || '-',
      'HP Orang Tua': s.fatherPhone || s.motherPhone || s.phone || '-',
      'Status Pendaftaran': s.status,
    }));

    exportToExcel(exportData, `Roster_Kelas_Terisi_SPMB_${Date.now()}`, 'Data Roster Kelas');
  };

  // Print Roster
  const handlePrintRoster = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1">
            <School className="w-4 h-4" /> Laporan Rekapitulasi Rombongan Belajar
          </div>
          <h2 className="text-2xl font-black text-white">
            Data Kelas Terisi SPMB TP 2027/2028
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Sistem pemantauan penempatan kelas terisi, statistik gender siswa per rombel, serta sisa daya tampung kelas 7.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportRoster}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor Excel Roster</span>
          </button>
          <button
            onClick={handlePrintRoster}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Roster</span>
          </button>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] text-slate-500 font-semibold">Total Rombel Kelas 7</div>
          <div className="text-xl font-extrabold text-slate-900 mt-1">{classQuotas.length} Kelas</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Tahun Ajaran 2027/2028</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] text-slate-500 font-semibold">Total Kapasitas Daya Tampung</div>
          <div className="text-xl font-extrabold text-indigo-600 mt-1">{totalCapacity} Murid</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Maksimum Keseluruhan</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] text-slate-500 font-semibold">Siswa Terisi di Kelas</div>
          <div className="text-xl font-extrabold text-emerald-600 mt-1">{totalAssigned} Murid</div>
          <div className="text-[10px] text-emerald-600 font-bold mt-0.5">
            {totalCapacity > 0 ? ((totalAssigned / totalCapacity) * 100).toFixed(1) : 0}% Terisi
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] text-slate-500 font-semibold">Sisa Bangku Kosong</div>
          <div className="text-xl font-extrabold text-amber-600 mt-1">{totalRemainingQuota} Bangku</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Sisa Kuota Tersedia</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-2 md:col-span-1">
          <div className="text-[11px] text-slate-500 font-semibold">Siswa Belum Diplot Kelas</div>
          <div className="text-xl font-extrabold text-rose-600 mt-1">{unassignedStudents.length} Murid</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Memerlukan Plotting</div>
        </div>
      </div>

      {/* Rasio Gender Banner */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="font-extrabold text-slate-800 text-sm">Distribusi Gender Siswa Terisi Kelas</div>
            <div className="text-slate-500 text-[11px]">Rasio perbandingan jumlah putra (Ikhwan) dan putri (Akhwat)</div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 font-bold">
          <div className="flex items-center gap-2 text-blue-700">
            <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
            <span>Ikhwan (L): {assignedLaki} Murid</span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-2 text-pink-700">
            <span className="w-3 h-3 rounded-full bg-pink-600 inline-block" />
            <span>Akhwat (P): {assignedPerempuan} Murid</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama, no. reg, atau asal sekolah..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Gender Filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setGenderFilter('all')}
              className={`px-2.5 py-1 rounded font-bold transition-all ${
                genderFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Semua Gender
            </button>
            <button
              onClick={() => setGenderFilter('Laki-laki')}
              className={`px-2.5 py-1 rounded font-bold transition-all ${
                genderFilter === 'Laki-laki' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              Laki-laki
            </button>
            <button
              onClick={() => setGenderFilter('Perempuan')}
              className={`px-2.5 py-1 rounded font-bold transition-all ${
                genderFilter === 'Perempuan' ? 'bg-pink-600 text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              Perempuan
            </button>
          </div>

          {/* Class Filter */}
          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">Semua Rombel Kelas ({totalAssigned} Siswa)</option>
            {classQuotas.map(q => {
              const count = students.filter(s => s.assignedClassId === q.id || s.assignedClassName === q.className).length;
              return (
                <option key={q.id} value={q.id}>
                  {q.className} ({count}/{q.capacity} Siswa)
                </option>
              );
            })}
            <option value="unassigned">Belum Memiliki Kelas ({unassignedStudents.length} Siswa)</option>
          </select>
        </div>
      </div>

      {/* Roster per Class Display */}
      <div className="space-y-6">
        {classQuotas
          .filter(q => selectedClassFilter === 'all' || selectedClassFilter === q.id)
          .map(q => {
            const classStudents = getStudentsForClass(q.id, q.className);
            const classLaki = classStudents.filter(s => s.gender === 'Laki-laki').length;
            const classPerempuan = classStudents.filter(s => s.gender === 'Perempuan').length;
            const totalInClass = students.filter(s => s.assignedClassId === q.id || s.assignedClassName === q.className).length;
            const percentage = Math.min(100, (totalInClass / q.capacity) * 100);

            return (
              <div key={q.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Class Card Header */}
                <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[10px]">
                        {q.academicYear}
                      </span>
                      <span className="text-slate-400 text-xs font-semibold">
                        Wali Kelas: <strong className="text-slate-200">{q.homeroomTeacher || 'Belum Ditentukan'}</strong>
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-emerald-400" />
                      <span>{q.className}</span>
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div className="bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-right min-w-[140px]">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Kapasitas Terisi</div>
                      <div className="font-extrabold text-emerald-400 text-sm">
                        {totalInClass} / {q.capacity} Murid ({percentage.toFixed(0)}%)
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1 overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>

                    <div className="bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 flex items-center gap-3">
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Distribusi Gender</div>
                        <div className="font-bold text-slate-200 text-xs">
                          <span className="text-blue-400">{classLaki} Laki-laki</span> • <span className="text-pink-400">{classPerempuan} Perempuan</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Class Roster Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                        <th className="p-3">No</th>
                        <th className="p-3">No. Reg SPMB</th>
                        <th className="p-3">Nama Lengkap Siswa</th>
                        <th className="p-3">L / P</th>
                        <th className="p-3">Asal Sekolah</th>
                        <th className="p-3">No. Telepon / WA Wali</th>
                        <th className="p-3">Status Daftar Ulang</th>
                        {isAdminMode && <th className="p-3 text-center">Aksi Pindah Kelas</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {classStudents.length === 0 ? (
                        <tr>
                          <td colSpan={isAdminMode ? 8 : 7} className="p-6 text-center text-slate-400 font-medium">
                            Belum ada murid yang terisi di rombel {q.className}.
                          </td>
                        </tr>
                      ) : (
                        classStudents.map((s, idx) => (
                          <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                            <td className="p-3 font-mono font-bold text-emerald-800">{s.registrationNumber}</td>
                            <td className="p-3 font-bold text-slate-900">{s.fullName}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                s.gender === 'Laki-laki'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-pink-100 text-pink-800'
                              }`}>
                                {s.gender === 'Laki-laki' ? 'L (Ikhwan)' : 'P (Akhwat)'}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600 font-medium">{s.previousSchoolName || '-'}</td>
                            <td className="p-3 font-mono text-slate-600">{s.fatherPhone || s.motherPhone || s.phone || '-'}</td>
                            <td className="p-3">
                              <span className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10px] ${
                                s.initialPaymentStatus === 'verified'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-amber-100 text-amber-800 border border-amber-300'
                              }`}>
                                {s.initialPaymentStatus === 'verified' ? '✓ Lunas Registrasi' : 'Belum Lunas'}
                              </span>
                            </td>
                            {isAdminMode && (
                              <td className="p-3 text-center">
                                <select
                                  value={s.assignedClassId || ''}
                                  onChange={(e) => handleMoveClass(s.id, e.target.value)}
                                  className="p-1.5 border border-slate-300 rounded-lg text-xs bg-white font-semibold cursor-pointer"
                                >
                                  {classQuotas.map(cq => (
                                    <option key={cq.id} value={cq.id}>
                                      Pindah: {cq.className}
                                    </option>
                                  ))}
                                  <option value="">Keluarkan Dari Kelas</option>
                                </select>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

        {/* Unassigned Students Section */}
        {(selectedClassFilter === 'all' || selectedClassFilter === 'unassigned') && (
          <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="bg-amber-500 text-slate-950 p-5 border-b border-amber-600 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black flex items-center gap-2">
                  <UserX className="w-5 h-5 text-slate-900" />
                  <span>Daftar Siswa Belum Memiliki Kelas ({unassignedStudents.length} Murid)</span>
                </h3>
                <p className="text-xs text-slate-800 mt-0.5">
                  Siswa yang sudah mendaftar namun belum di-plotting ke rombongan belajar kelas 7.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-amber-100/60 text-slate-800 font-bold border-b border-amber-200 uppercase text-[10px]">
                    <th className="p-3">No</th>
                    <th className="p-3">No. Reg SPMB</th>
                    <th className="p-3">Nama Lengkap Siswa</th>
                    <th className="p-3">Gender</th>
                    <th className="p-3">Asal Sekolah</th>
                    <th className="p-3">Status Pembayaran</th>
                    {isAdminMode && <th className="p-3 text-center">Plotting Ke Kelas</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {unassignedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={isAdminMode ? 7 : 6} className="p-6 text-center text-slate-400 font-medium">
                        Seluruh siswa pendaftar telah memiliki alokasi kelas!
                      </td>
                    </tr>
                  ) : (
                    unassignedStudents.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-amber-50/50 transition-colors">
                        <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-amber-900">{s.registrationNumber}</td>
                        <td className="p-3 font-bold text-slate-900">{s.fullName}</td>
                        <td className="p-3">{s.gender}</td>
                        <td className="p-3 text-slate-600">{s.previousSchoolName || '-'}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded text-[10px]">
                            {s.status}
                          </span>
                        </td>
                        {isAdminMode && (
                          <td className="p-3 text-center">
                            <select
                              value=""
                              onChange={(e) => handleMoveClass(s.id, e.target.value)}
                              className="p-1.5 border border-amber-300 rounded-lg text-xs bg-amber-50 font-bold text-amber-900 cursor-pointer"
                            >
                              <option value="">-- Pilih Rombel --</option>
                              {classQuotas.map(cq => (
                                <option key={cq.id} value={cq.id}>
                                  Plot ke {cq.className}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
