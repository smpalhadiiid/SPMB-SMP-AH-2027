import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Calendar, Plus, Edit, Trash2, Clock, RefreshCw, X, Check, Lock, Sparkles } from 'lucide-react';
import { CbtUjian } from '../../types';
import { getStoredTestSchedules, saveTestSchedules } from '../../utils/storage';
import {
  fetchUjianSupabase,
  createUjianSupabase,
  updateUjianSupabase,
  deleteUjianSupabase,
} from '../../services/cbtSupabaseService';

const ujianSchema = z.object({
  namaUjian: z.string().min(3, 'Nama ujian minimal 3 karakter'),
  gelombang: z.string().min(1, 'Gelombang wajib diisi'),
  tanggal: z.string().min(1, 'Tanggal pelaksanaan wajib diisi'),
  jamMulai: z.string().min(1, 'Jam mulai wajib diisi'),
  durasiMinutes: z.number().min(15, 'Durasi minimal 15 menit').max(300, 'Durasi maksimal 300 menit'),
  status: z.enum(['draft', 'aktif', 'selesai']),
  jumlahDiagnostik: z.number().min(0, 'Jumlah minimal 0'),
  jumlahTpu: z.number().min(0, 'Jumlah minimal 0'),
  jumlahDiniyyah: z.number().min(0, 'Jumlah minimal 0'),
  batasKelulusan: z.number().min(0, 'Passing grade minimal 0').max(100, 'Passing grade maksimal 100'),

});

type UjianFormData = z.infer<typeof ujianSchema>;

export const CbtJadwalUjianManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingExam, setEditingExam] = useState<CbtUjian | null>(null);

  // Queries
  const { data: exams = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['cbt_ujian'],
    queryFn: fetchUjianSupabase,
  });

  // React Hook Form
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UjianFormData>({
    resolver: zodResolver(ujianSchema),
    defaultValues: {
      namaUjian: 'Ujian Seleksi SPMB Online',
      gelombang: 'Gelombang 1',
      tanggal: new Date().toISOString().split('T')[0],
      jamMulai: '08:00',
      durasiMinutes: 90,
      status: 'aktif',
      jumlahDiagnostik: 6,
      jumlahTpu: 8,
      jumlahDiniyyah: 6,
      batasKelulusan: 70,
    },
  });

  const watchDiag = watch('jumlahDiagnostik') || 0;
  const watchTpu = watch('jumlahTpu') || 0;
  const watchDiniyyah = watch('jumlahDiniyyah') || 0;
  const totalSoalCount = Number(watchDiag) + Number(watchTpu) + Number(watchDiniyyah);

  // Mutations
  const createMutation = useMutation({
    mutationFn: createUjianSupabase,
    onSuccess: () => {
      toast.success('Jadwal ujian berhasil dibuat di Supabase!');
      queryClient.invalidateQueries({ queryKey: ['cbt_ujian'] });
      setShowModal(false);
      reset();
    },
    onError: (err: any) => {
      toast.error(`Gagal membuat jadwal: ${err?.message || 'Error'}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateUjianSupabase,
    onSuccess: () => {
      toast.success('Jadwal ujian berhasil diperbarui di Supabase!');
      queryClient.invalidateQueries({ queryKey: ['cbt_ujian'] });
      setShowModal(false);
      setEditingExam(null);
      reset();
    },
    onError: (err: any) => {
      toast.error(`Gagal update jadwal: ${err?.message || 'Error'}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUjianSupabase,
    onSuccess: () => {
      toast.success('Jadwal ujian berhasil dihapus!');
      queryClient.invalidateQueries({ queryKey: ['cbt_ujian'] });
    },
    onError: (err: any) => {
      toast.error(`Gagal menghapus jadwal: ${err?.message || 'Error'}`);
    },
  });

  const handleOpenAddModal = () => {
    setEditingExam(null);
    reset({
      namaUjian: 'Ujian Seleksi SPMB Online',
      gelombang: 'Gelombang 1',
      tanggal: new Date().toISOString().split('T')[0],
      jamMulai: '08:00',
      durasiMinutes: 90,
      status: 'aktif',
      jumlahDiagnostik: 6,
      jumlahTpu: 8,
      jumlahDiniyyah: 6,
      batasKelulusan: 70,
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (exam: CbtUjian) => {
    setEditingExam(exam);
    reset({
      namaUjian: exam.namaUjian,
      gelombang: exam.gelombang,
      tanggal: exam.tanggal,
      jamMulai: exam.jamMulai,
      durasiMinutes: exam.durasiMinutes,
      status: exam.status,
      jumlahDiagnostik: exam.jumlahDiagnostik,
      jumlahTpu: exam.jumlahTpu,
      jumlahDiniyyah: exam.jumlahDiniyyah,
      batasKelulusan: exam.batasKelulusan || 70,
    });
    setShowModal(true);
  };

  const handleToggleExamStatus = (exam: CbtUjian) => {
    const nextStatus = exam.status === 'aktif' ? 'draft' : 'aktif';
    updateMutation.mutate(
      {
        ...exam,
        status: nextStatus,
      },
      {
        onSuccess: () => {
          if (nextStatus === 'aktif') {
            toast.success(
              `Jadwal "${exam.namaUjian}" (${exam.tanggal}) BERHASIL DISINKRONKAN & DIAKTIFKAN untuk seluruh calon murid!`
            );
          } else {
            toast.success(`Jadwal "${exam.namaUjian}" diubah menjadi Draft / Terkunci.`);
          }
          // Sync with local storage test schedule
          try {
            const current = getStoredTestSchedules();
            const updated = current.map((s) => ({
              ...s,
              testDate: exam.tanggal,
              testTime: `${exam.jamMulai} WIB`,
              durationMinutes: exam.durasiMinutes,
              isOnlineActive: nextStatus === 'aktif',
            }));
            saveTestSchedules(updated);
          } catch (e) {
            console.warn('Storage schedule update error:', e);
          }
        },
      }
    );
  };

  const handleDelete = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus jadwal ujian ini dari Supabase?')) {
      deleteMutation.mutate(id);
    }
  };

  const onSubmit = (data: UjianFormData) => {
    const syncLocalStorageSchedule = () => {
      try {
        const current = getStoredTestSchedules();
        const updated = current.map((s) => ({
          ...s,
          testDate: data.tanggal,
          testTime: `${data.jamMulai} WIB`,
          durationMinutes: data.durasiMinutes,
          isOnlineActive: data.status === 'aktif',
        }));
        saveTestSchedules(updated);
      } catch (e) {
        console.warn('Sync storage error:', e);
      }
    };

    if (editingExam) {
      updateMutation.mutate(
        {
          ...editingExam,
          namaUjian: data.namaUjian,
          gelombang: data.gelombang,
          tanggal: data.tanggal,
          jamMulai: data.jamMulai,
          durasiMinutes: data.durasiMinutes,
          status: data.status,
          jumlahDiagnostik: data.jumlahDiagnostik,
          jumlahTpu: data.jumlahTpu,
          jumlahDiniyyah: data.jumlahDiniyyah,
          batasKelulusan: data.batasKelulusan,
        },
        { onSuccess: syncLocalStorageSchedule }
      );
    } else {
      createMutation.mutate(
        {
          namaUjian: data.namaUjian,
          gelombang: data.gelombang,
          tanggal: data.tanggal,
          jamMulai: data.jamMulai,
          durasiMinutes: data.durasiMinutes,
          status: data.status,
          jumlahDiagnostik: data.jumlahDiagnostik,
          jumlahTpu: data.jumlahTpu,
          jumlahDiniyyah: data.jumlahDiniyyah,
          batasKelulusan: data.batasKelulusan,
        },
        { onSuccess: syncLocalStorageSchedule }
      );
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Jadwal Ujian & Komposisi Soal (Supabase Sync)</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pengaturan jadwal sesi ujian, durasi, dan alokasi jumlah soal per kategori.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            title="Refresh dari Supabase"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Jadwal Ujian Baru</span>
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-14 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : (
        /* Exam Schedules Table */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                <th className="p-3">Nama Ujian & Gelombang</th>
                <th className="p-3">Waktu & Durasi</th>
                <th className="p-3">Komposisi Soal</th>
                <th className="p-3">Batas Kelulusan</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {exams.map((e) => {
                const totalSoal = Number(e.jumlahDiagnostik) + Number(e.jumlahTpu) + Number(e.jumlahDiniyyah);
                return (
                  <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3">
                      <div className="font-bold text-slate-900 dark:text-white text-sm">{e.namaUjian}</div>
                      <div className="text-[10px] text-blue-700 dark:text-blue-400 font-bold uppercase">{e.gelombang}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold">{e.tanggal} (Pukul {e.jamMulai} WIB)</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" /> Durasi: {e.durasiMinutes} Menit
                      </div>
                    </td>
                    <td className="p-3 font-semibold space-y-0.5">
                      <div>• Diagnostik: <span className="font-bold">{e.jumlahDiagnostik}</span></div>
                      <div>• Pengetahuan Umum: <span className="font-bold">{e.jumlahTpu}</span></div>
                      <div>• Diniyyah: <span className="font-bold">{e.jumlahDiniyyah}</span></div>
                      <div className="text-[10px] text-indigo-700 dark:text-indigo-400 font-bold">Total: {totalSoal} Soal</div>
                    </td>
                    <td className="p-3">
                      <span className="font-extrabold text-emerald-700 dark:text-emerald-400">Passing Grade: {e.batasKelulusan || 70}</span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1 items-start">
                        <button
                          onClick={() => handleToggleExamStatus(e)}
                          className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                            e.status === 'aktif'
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-400 hover:bg-emerald-200'
                              : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 hover:bg-amber-200'
                          }`}
                          title="Klik untuk mengubah status aktif/terkunci bagi calon murid"
                        >
                          {e.status === 'aktif' ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span>AKTIF (Calon Murid)</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              <span>TERKUNCI (Draft)</span>
                            </>
                          )}
                        </button>
                        <span className="text-[10px] text-slate-400 font-medium">Klik untuk toggle</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(e)}
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/50 text-slate-700 dark:text-slate-300 hover:text-blue-600 rounded-lg transition-colors"
                          title="Edit Jadwal"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(e.id)}
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/50 text-slate-700 dark:text-slate-300 hover:text-rose-600 rounded-lg transition-colors"
                          title="Hapus Jadwal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Add / Edit Schedule */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {editingExam ? 'Edit Jadwal Ujian CBT' : 'Buat Jadwal Ujian CBT Baru'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Nama Ujian *</label>
                <input
                  type="text"
                  {...register('namaUjian')}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-600"
                />
                {errors.namaUjian && <p className="text-rose-500 text-[11px] mt-1">{errors.namaUjian.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Gelombang SPMB *</label>
                  <select
                    {...register('gelombang')}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold"
                  >
                    <option value="Gelombang 1">Gelombang 1</option>
                    <option value="Gelombang 2">Gelombang 2</option>
                    <option value="Gelombang Khusus">Gelombang Khusus</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Status Ujian *</label>
                  <select
                    {...register('status')}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold"
                  >
                    <option value="aktif">Aktif (Dapat Dikerjakan)</option>
                    <option value="draft">Draft (Belum Dibuka)</option>
                    <option value="selesai">Selesai (Ditutup)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Tanggal *</label>
                  <input
                    type="date"
                    {...register('tanggal')}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                  />
                  {errors.tanggal && <p className="text-rose-500 text-[11px] mt-1">{errors.tanggal.message}</p>}
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Jam Mulai *</label>
                  <input
                    type="time"
                    {...register('jamMulai')}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Durasi (Menit) *</label>
                  <input
                    type="number"
                    {...register('durasiMinutes', { valueAsNumber: true })}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold"
                  />
                  {errors.durasiMinutes && <p className="text-rose-500 text-[11px] mt-1">{errors.durasiMinutes.message}</p>}
                </div>
              </div>

              {/* Komposisi Soal */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                <div className="font-bold text-slate-800 dark:text-slate-200 flex justify-between items-center">
                  <span>Jumlah Soal Per Kategori:</span>
                  <span className="text-blue-700 dark:text-blue-400 font-extrabold text-xs">
                    Total: {totalSoalCount} Soal
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">Diagnostik</label>
                    <input
                      type="number"
                      {...register('jumlahDiagnostik', { valueAsNumber: true })}
                      className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">TPU</label>
                    <input
                      type="number"
                      {...register('jumlahTpu', { valueAsNumber: true })}
                      className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">Diniyyah</label>
                    <input
                      type="number"
                      {...register('jumlahDiniyyah', { valueAsNumber: true })}
                      className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Batas Minimal Kelulusan (Passing Grade)</label>
                <input
                  type="number"
                  {...register('batasKelulusan', { valueAsNumber: true })}
                  className="w-full p-2.5 border border-emerald-300 dark:border-emerald-700 rounded-xl font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/40"
                />
                {errors.batasKelulusan && <p className="text-rose-500 text-[11px] mt-1">{errors.batasKelulusan.message}</p>}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl disabled:opacity-50"
                >
                  {isSubmitting || createMutation.isPending || updateMutation.isPending ? 'Menyimpan...' : 'Simpan Jadwal Ujian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
