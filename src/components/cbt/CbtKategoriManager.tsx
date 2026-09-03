import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Layers, Plus, Edit, Trash2, Scale, RefreshCw } from 'lucide-react';
import { CbtKategori } from '../../types';
import {
  fetchKategoriSoalSupabase,
  createKategoriSoalSupabase,
  updateKategoriSoalSupabase,
  deleteKategoriSoalSupabase,
} from '../../services/cbtSupabaseService';

const kategoriSchema = z.object({
  namaKategori: z.string().min(2, 'Nama kategori minimal 2 karakter'),
  kodeKategori: z
    .string()
    .min(2, 'Kode kategori minimal 2 karakter')
    .regex(/^[a-z0-9_]+$/, 'Kode harus berupa huruf kecil, angka, dan underscore'),
  persentaseBobot: z.number().min(1, 'Persentase minimal 1%').max(100, 'Persentase maksimal 100%'),

  keterangan: z.string().optional(),
});

type KategoriFormData = z.infer<typeof kategoriSchema>;

export const CbtKategoriManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CbtKategori | null>(null);

  // React Query Fetch
  const { data: categories = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['cbt_kategori'],
    queryFn: fetchKategoriSoalSupabase,
  });

  // React Hook Form
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<KategoriFormData>({
    resolver: zodResolver(kategoriSchema),
    defaultValues: {
      namaKategori: '',
      kodeKategori: '',
      persentaseBobot: 30,
      keterangan: '',
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createKategoriSoalSupabase,
    onSuccess: () => {
      toast.success('Kategori soal berhasil ditambahkan ke Supabase!');
      queryClient.invalidateQueries({ queryKey: ['cbt_kategori'] });
      setShowModal(false);
      reset();
    },
    onError: (err: any) => {
      toast.error(`Gagal menambah kategori: ${err?.message || 'Error'}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateKategoriSoalSupabase,
    onSuccess: () => {
      toast.success('Kategori soal berhasil diperbarui!');
      queryClient.invalidateQueries({ queryKey: ['cbt_kategori'] });
      setShowModal(false);
      setEditingCategory(null);
      reset();
    },
    onError: (err: any) => {
      toast.error(`Gagal update kategori: ${err?.message || 'Error'}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, kode }: { id: string; kode: string }) => deleteKategoriSoalSupabase(id, kode),
    onSuccess: () => {
      toast.success('Kategori berhasil dihapus!');
      queryClient.invalidateQueries({ queryKey: ['cbt_kategori'] });
    },
    onError: (err: any) => {
      toast.error(`Gagal menghapus: ${err?.message || 'Error'}`);
    },
  });

  const totalPercentage = categories.reduce((sum, c) => sum + Number(c.persentaseBobot), 0);

  const handleOpenAddModal = () => {
    setEditingCategory(null);
    reset({
      namaKategori: '',
      kodeKategori: '',
      persentaseBobot: 30,
      keterangan: '',
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (cat: CbtKategori) => {
    setEditingCategory(cat);
    setValue('namaKategori', cat.namaKategori);
    setValue('kodeKategori', cat.kodeKategori);
    setValue('persentaseBobot', cat.persentaseBobot);
    setValue('keterangan', cat.keterangan || '');
    setShowModal(true);
  };

  const handleDelete = (cat: CbtKategori) => {
    if (confirm(`Apakah Anda yakin ingin menghapus kategori "${cat.namaKategori}"?`)) {
      deleteMutation.mutate({ id: cat.id, kode: cat.kodeKategori });
    }
  };

  const onSubmit = (data: KategoriFormData) => {
    if (editingCategory) {
      updateMutation.mutate({
        ...editingCategory,
        namaKategori: data.namaKategori,
        kodeKategori: data.kodeKategori,
        persentaseBobot: data.persentaseBobot,
        keterangan: data.keterangan || '',
      });
    } else {
      createMutation.mutate({
        namaKategori: data.namaKategori,
        kodeKategori: data.kodeKategori,
        persentaseBobot: data.persentaseBobot,
        keterangan: data.keterangan || '',
      });
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Kategori Soal & Pembobotan Nilai (Supabase Sync)</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Kelola kategori bidang studi ujian dan persentase kontribusi bobot nilai SPMB.
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
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kategori</span>
          </button>
        </div>
      </div>

      {/* Percentage Total Summary Bar */}
      <div
        className={`p-4 rounded-xl border flex items-center justify-between ${
          totalPercentage === 100
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
            : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <Scale className="w-5 h-5 shrink-0" />
          <div>
            <div className="text-xs font-bold">Total Pembobotan Kategori: {totalPercentage}%</div>
            <div className="text-[11px] opacity-90">
              {totalPercentage === 100
                ? '✓ Pembobotan sempurna 100% (Tes Diagnostik 30%, TPU 40%, Diniyyah 30%).'
                : '⚠️ Total persentase bobot belum 100%. Silakan sesuaikan bobot kategori.'}
            </div>
          </div>
        </div>
        <div className="text-xl font-black">{totalPercentage}%</div>
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : (
        /* Categories Table */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                <th className="p-3">Kode Kategori</th>
                <th className="p-3">Nama Kategori</th>
                <th className="p-3">Persentase Bobot</th>
                <th className="p-3">Keterangan</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-mono font-bold text-indigo-700 dark:text-indigo-400">{c.kodeKategori}</td>
                  <td className="p-3 font-semibold text-slate-900 dark:text-white">{c.namaKategori}</td>
                  <td className="p-3">
                    <span className="px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black border border-indigo-200 dark:border-indigo-800">
                      {c.persentaseBobot}%
                    </span>
                  </td>
                  <td className="p-3 text-slate-500 dark:text-slate-400 max-w-xs">{c.keterangan || '-'}</td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditModal(c)}
                        className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 hover:text-indigo-600 rounded-lg transition-colors"
                        title="Edit Kategori"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-900/50 hover:text-rose-600 rounded-lg transition-colors"
                        title="Hapus Kategori"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Add / Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in duration-200 border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-3">
              {editingCategory ? 'Edit Kategori Soal' : 'Tambah Kategori Soal Baru'}
            </h3>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Nama Kategori *</label>
                <input
                  type="text"
                  placeholder="Contoh: Tes Diagnostik"
                  {...register('namaKategori')}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-600"
                />
                {errors.namaKategori && <p className="text-rose-500 text-[11px] mt-1">{errors.namaKategori.message}</p>}
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Kode Kategori (Unik) *</label>
                <input
                  type="text"
                  placeholder="diagnostik / pengetahuan_umum / diniyyah"
                  {...register('kodeKategori')}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-mono focus:ring-2 focus:ring-indigo-600"
                />
                {errors.kodeKategori && <p className="text-rose-500 text-[11px] mt-1">{errors.kodeKategori.message}</p>}
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Persentase Bobot (%) *</label>
                <input
                  type="number"
                  placeholder="30"
                  {...register('persentaseBobot', { valueAsNumber: true })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold focus:ring-2 focus:ring-indigo-600"
                />
                {errors.persentaseBobot && (
                  <p className="text-rose-500 text-[11px] mt-1">{errors.persentaseBobot.message}</p>
                )}
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Keterangan / Deskripsi</label>
                <textarea
                  rows={3}
                  placeholder="Deskripsi materi uji..."
                  {...register('keterangan')}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl disabled:opacity-50"
                >
                  {isSubmitting || createMutation.isPending || updateMutation.isPending ? 'Menyimpan...' : 'Simpan Kategori'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
