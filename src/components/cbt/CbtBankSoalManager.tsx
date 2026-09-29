import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  BookOpen, Plus, Search, Edit, Trash2, Eye, FileSpreadsheet,
  Image as ImageIcon, AlertTriangle, X, Check, RefreshCw, ChevronLeft, ChevronRight
} from 'lucide-react';
import { CbtSoal, CbtKategori } from '../../types';
import { exportToExcel } from '../../utils/excelExporter';
import {
  fetchSoalSupabase,
  createSoalSupabase,
  updateSoalSupabase,
  deleteSoalSupabase,
  fetchKategoriSoalSupabase,
  bulkUpdateSoalStatusSupabase,
  syncAndSaveSelectedSoalToSupabase,
} from '../../services/cbtSupabaseService';

const soalSchema = z.object({
  kategoriKode: z.string().min(1, 'Pilih kategori soal'),
  pertanyaan: z.string().min(5, 'Teks pertanyaan minimal 5 karakter'),
  pilihanA: z.string().min(1, 'Pilihan A wajib diisi'),
  pilihanB: z.string().min(1, 'Pilihan B wajib diisi'),
  pilihanC: z.string().min(1, 'Pilihan C wajib diisi'),
  pilihanD: z.string().min(1, 'Pilihan D wajib diisi'),
  jawabanBenar: z.number().min(0).max(3),
  bobot: z.number().min(1, 'Bobot minimal 1'),

  levelKesulitan: z.enum(['easy', 'medium', 'hard']),
  statusAktif: z.boolean(),
  imageUrl: z.string().optional(),
});

type SoalFormData = z.infer<typeof soalSchema>;

export const CbtBankSoalManager: React.FC = () => {
  const queryClient = useQueryClient();

  // Queries
  const { data: soalList = [], isLoading: isSoalLoading, isFetching, refetch } = useQuery<CbtSoal[]>({
    queryKey: ['cbt_soal'],
    queryFn: () => fetchSoalSupabase(false),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['cbt_kategori'],
    queryFn: () => fetchKategoriSoalSupabase(),
  });

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showExamSetModal, setShowExamSetModal] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingSoal, setEditingSoal] = useState<CbtSoal | null>(null);
  const [previewSoal, setPreviewSoal] = useState<CbtSoal | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string>('');

  // React Hook Form
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SoalFormData>({
    resolver: zodResolver(soalSchema),
    defaultValues: {
      kategoriKode: 'diagnostik',
      pertanyaan: '',
      pilihanA: '',
      pilihanB: '',
      pilihanC: '',
      pilihanD: '',
      jawabanBenar: 0,
      bobot: 10,
      levelKesulitan: 'medium',
      statusAktif: true,
      imageUrl: '',
    },
  });

  const watchedPilihanA = watch('pilihanA');
  const watchedPilihanB = watch('pilihanB');
  const watchedPilihanC = watch('pilihanC');
  const watchedPilihanD = watch('pilihanD');

  // Mutations
  const createMutation = useMutation({
    mutationFn: createSoalSupabase,
    onSuccess: () => {
      toast.success('Soal berhasil ditambahkan ke Supabase!');
      queryClient.invalidateQueries({ queryKey: ['cbt_soal'] });
      setShowModal(false);
      reset();
      setUploadedImage('');
    },
    onError: (err: any) => {
      toast.error(`Gagal menyimpan soal: ${err?.message || 'Error'}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateSoalSupabase,
    onSuccess: () => {
      toast.success('Soal berhasil diperbarui di Supabase!');
      queryClient.invalidateQueries({ queryKey: ['cbt_soal'] });
      setShowModal(false);
      setEditingSoal(null);
      reset();
      setUploadedImage('');
    },
    onError: (err: any) => {
      toast.error(`Gagal memperbarui soal: ${err?.message || 'Error'}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSoalSupabase,
    onSuccess: () => {
      toast.success('Soal berhasil dihapus!');
      queryClient.invalidateQueries({ queryKey: ['cbt_soal'] });
      setDeleteConfirmId(null);
    },
    onError: (err: any) => {
      toast.error(`Gagal menghapus soal: ${err?.message || 'Error'}`);
    },
  });

  // Filtered List
  const filteredSoal = soalList.filter((s) => {
    const qText = (s.questionText || s.question || '').toLowerCase();
    const pA = (s.pilihanA || s.options?.[0] || '').toLowerCase();
    const pB = (s.pilihanB || s.options?.[1] || '').toLowerCase();
    const pC = (s.pilihanC || s.options?.[2] || '').toLowerCase();
    const pD = (s.pilihanD || s.options?.[3] || '').toLowerCase();
    const term = searchQuery.toLowerCase();

    const matchSearch = qText.includes(term) || pA.includes(term) || pB.includes(term) || pC.includes(term) || pD.includes(term);
    const matchCategory = categoryFilter === 'all' || s.kategoriKode === categoryFilter || s.category === categoryFilter;
    const matchDifficulty = difficultyFilter === 'all' || s.levelKesulitan === difficultyFilter;
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? s.statusAktif !== false : s.statusAktif === false);

    return matchSearch && matchCategory && matchDifficulty && matchStatus;
  });

  // Pagination calculation
  const totalPages = Math.ceil(filteredSoal.length / itemsPerPage) || 1;
  const paginatedSoal = filteredSoal.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleOpenAddModal = () => {
    setEditingSoal(null);
    setUploadedImage('');
    reset({
      kategoriKode: categories[0]?.kodeKategori || 'diagnostik',
      pertanyaan: '',
      pilihanA: '',
      pilihanB: '',
      pilihanC: '',
      pilihanD: '',
      jawabanBenar: 0,
      bobot: 10,
      levelKesulitan: 'medium',
      statusAktif: true,
      imageUrl: '',
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (soal: CbtSoal) => {
    setEditingSoal(soal);
    const img = soal.imageUrl || '';
    setUploadedImage(img);
    reset({
      kategoriKode: soal.kategoriKode || soal.category || 'diagnostik',
      pertanyaan: soal.questionText || soal.question || '',
      pilihanA: soal.pilihanA || soal.options?.[0] || '',
      pilihanB: soal.pilihanB || soal.options?.[1] || '',
      pilihanC: soal.pilihanC || soal.options?.[2] || '',
      pilihanD: soal.pilihanD || soal.options?.[3] || '',
      jawabanBenar: typeof soal.jawabanBenar === 'number' ? soal.jawabanBenar : soal.correctOptionIndex || 0,
      bobot: soal.bobot || soal.points || 10,
      levelKesulitan: soal.levelKesulitan || 'medium',
      statusAktif: soal.statusAktif !== false,
      imageUrl: img,
    });
    setShowModal(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran gambar maksimal 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      setUploadedImage(res);
      setValue('imageUrl', res);
    };
    reader.readAsDataURL(file);
  };

  const onSubmitForm = (data: SoalFormData) => {
    const opts = [data.pilihanA, data.pilihanB, data.pilihanC, data.pilihanD];
    const itemData = {
      category: data.kategoriKode,
      kategoriKode: data.kategoriKode,
      questionText: data.pertanyaan,
      question: data.pertanyaan,
      options: opts,
      pilihanA: data.pilihanA,
      pilihanB: data.pilihanB,
      pilihanC: data.pilihanC,
      pilihanD: data.pilihanD,
      jawabanBenar: data.jawabanBenar,
      correctOptionIndex: data.jawabanBenar,
      bobot: data.bobot,
      points: data.bobot,
      levelKesulitan: data.levelKesulitan,
      statusAktif: data.statusAktif,
      imageUrl: uploadedImage || undefined,
    };

    if (editingSoal) {
      updateMutation.mutate({
        ...editingSoal,
        ...itemData,
      });
    } else {
      createMutation.mutate(itemData);
    }
  };

  // Quick single-click status toggle (Diujikan vs Cadangan)
  const handleToggleExamStatus = (soal: CbtSoal) => {
    const nextStatus = soal.statusAktif === false; // toggle
    updateMutation.mutate(
      {
        ...soal,
        statusAktif: nextStatus,
      },
      {
        onSuccess: () => {
          toast.success(
            nextStatus
              ? '🎯 Soal BERHASIL DIPILIH UNTUK DIUJIKAN!'
              : '⚪ Soal dipindahkan ke Bank Soal Cadangan.'
          );
        },
      }
    );
  };

  // Bulk Selection Handlers
  const handleToggleSelectAllOnPage = () => {
    const pageIds = paginatedSoal.map((s) => s.id);
    const isAllSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
    if (isAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkSetStatus = async (targetStatus: boolean) => {
    if (selectedIds.length === 0) return;
    toast.loading('Memproses pembaruan status massal...', { id: 'bulk-status' });
    try {
      await bulkUpdateSoalStatusSupabase(selectedIds, targetStatus);
      queryClient.invalidateQueries({ queryKey: ['cbt_soal'] });
      setSelectedIds([]);
      toast.success(
        `Berhasil ${targetStatus ? 'menandai & menyimpan untuk diujikan' : 'menyimpan ke cadangan'} (${selectedIds.length} soal)!`,
        { id: 'bulk-status' }
      );
    } catch (e: any) {
      toast.error(`Gagal update massal: ${e?.message || 'Error'}`, { id: 'bulk-status' });
    }
  };

  const handleSelectAllSoalStatus = async (targetStatus: boolean) => {
    const allIds = filteredSoal.map((s) => s.id);
    if (allIds.length === 0) return;
    toast.loading(`Memproses ${targetStatus ? 'memilih semua' : 'mengosongkan'} soal...`, { id: 'select-all-status' });
    try {
      await bulkUpdateSoalStatusSupabase(allIds, targetStatus);
      queryClient.invalidateQueries({ queryKey: ['cbt_soal'] });
      toast.success(
        `Berhasil ${targetStatus ? 'menandai SEMUA soal untuk diujikan' : 'mengubah SEMUA soal ke cadangan'} (${allIds.length} soal)!`,
        { id: 'select-all-status' }
      );
    } catch (e: any) {
      toast.error(`Gagal memperbarui: ${e?.message || 'Error'}`, { id: 'select-all-status' });
    }
  };

  // Active Questions Count per category
  const activeQuestions = soalList.filter((s) => s.statusAktif !== false);
  const activeDiag = activeQuestions.filter((s) => (s.kategoriKode || s.category) === 'diagnostik').length;
  const activeTpu = activeQuestions.filter((s) => (s.kategoriKode || s.category) === 'pengetahuan_umum').length;
  const activeDiniyyah = activeQuestions.filter((s) => (s.kategoriKode || s.category) === 'diniyyah').length;

  const handleSaveActiveExamPackage = async () => {
    if (activeQuestions.length === 0) {
      toast.error('Belum ada soal yang dipilih sebagai "Diujikan (Aktif)". Pilih/centang minimal 1 soal terlebih dahulu.');
      return;
    }
    toast.loading('Menyimpan seluruh butir soal ke tabel public.soal Supabase...', { id: 'save-pkg' });
    try {
      await syncAndSaveSelectedSoalToSupabase(soalList);
      queryClient.invalidateQueries({ queryKey: ['cbt_soal'] });
      toast.success(
        `🎯 Berhasil menyimpan ${activeQuestions.length} soal terpilih ke tabel public.soal Supabase!`,
        { id: 'save-pkg', duration: 4000 }
      );
    } catch (e: any) {
      toast.error(`Gagal menyimpan ke tabel public.soal: ${e?.message || 'Error'}`, { id: 'save-pkg' });
    }
  };

  const handleExportExcel = () => {
    if (filteredSoal.length === 0) {
      toast.error('Tidak ada data soal untuk di-export');
      return;
    }

    const exportData = filteredSoal.map((s, idx) => ({
      No: idx + 1,
      Kategori: s.kategoriKode || s.category,
      Pertanyaan: s.questionText || s.question,
      Opsi_A: s.pilihanA || s.options?.[0],
      Opsi_B: s.pilihanB || s.options?.[1],
      Opsi_C: s.pilihanC || s.options?.[2],
      Opsi_D: s.pilihanD || s.options?.[3],
      Jawaban_Benar: (s.jawabanBenar === 0 ? 'A' : s.jawabanBenar === 1 ? 'B' : s.jawabanBenar === 2 ? 'C' : 'D'),
      Bobot: s.bobot || 10,
      Level: s.levelKesulitan || 'medium',
      Status: s.statusAktif !== false ? 'Aktif' : 'Nonaktif',
    }));

    exportToExcel(exportData, `Bank_Soal_CBT_SPMB_${new Date().toISOString().split('T')[0]}`);
    toast.success('Berhasil mengexport bank soal ke Excel!');
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 transition-colors">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Bank Soal CBT ({soalList.length} Soal)</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manajemen butir soal seleksi SPMB tersinkronisasi langsung ke Supabase.
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
            onClick={handleExportExcel}
            className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Soal</span>
          </button>
        </div>
      </div>

      {/* Summary Card Banner: Ringkasan Soal Terpilih untuk Diujikan */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-blue-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-extrabold uppercase tracking-wider">
              Status Sinkronisasi Ujian
            </span>
            <span className="text-xs text-blue-200 font-medium">
              Total Bank Soal: <strong className="text-white">{soalList.length}</strong>
            </span>
          </div>
          <h4 className="text-base font-extrabold text-white flex items-center gap-2">
            <span>🎯 Soal Dipilih untuk Diujikan Kepada Calon Murid</span>
          </h4>
          <p className="text-xs text-slate-300">
            Calon murid hanya akan menerima butir soal yang ditandai <strong>"Diujikan (Aktif)"</strong> saat tes dilaksanakan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/10">
          <div className="text-center px-3 border-r border-white/20">
            <div className="text-xs text-slate-300 font-bold">Diagnostik</div>
            <div className="text-base font-black text-emerald-300">{activeDiag} Soal</div>
          </div>
          <div className="text-center px-3 border-r border-white/20">
            <div className="text-xs text-slate-300 font-bold">Pengetahuan Umum</div>
            <div className="text-base font-black text-amber-300">{activeTpu} Soal</div>
          </div>
          <div className="text-center px-3 border-r border-white/20">
            <div className="text-xs text-slate-300 font-bold">Diniyyah</div>
            <div className="text-base font-black text-purple-300">{activeDiniyyah} Soal</div>
          </div>
          <div className="pl-1 flex flex-col sm:flex-row items-center gap-2">
            <button
              onClick={handleSaveActiveExamPackage}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs rounded-lg transition-all shadow-md flex items-center gap-1.5"
              title="Simpan & Terbitkan Paket Soal Terpilih ke Supabase"
            >
              <Check className="w-4 h-4 text-white" />
              <span>💾 Simpan Pilihan Soal Ujian ({activeQuestions.length})</span>
            </button>
            <button
              onClick={() => setShowExamSetModal(true)}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs rounded-lg transition-all border border-white/20 flex items-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Pratinjau Paket</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari teks pertanyaan atau opsi jawaban..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="p-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold"
          >
            <option value="all">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.kodeKategori}>
                {c.namaKategori}
              </option>
            ))}
          </select>

          <select
            value={difficultyFilter}
            onChange={(e) => {
              setDifficultyFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="p-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold"
          >
            <option value="all">Semua Level</option>
            <option value="easy">Easy (Mudah)</option>
            <option value="medium">Medium (Sedang)</option>
            <option value="hard">Hard (Sulit)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="p-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold"
          >
            <option value="all">Semua Status Soal</option>
            <option value="active">🎯 Hanya Soal Diujikan (Aktif)</option>
            <option value="inactive">⚪ Hanya Cadangan (Nonaktif)</option>
          </select>

          <div className="flex items-center gap-1.5 border-l border-slate-300 dark:border-slate-700 pl-2">
            <button
              type="button"
              onClick={() => handleSelectAllSoalStatus(true)}
              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-lg text-[11px] font-bold transition-all"
              title="Tandai semua soal yang terlihat sebagai Diujikan (Aktif)"
            >
              ✓ Pilih Semua
            </button>
            <button
              type="button"
              onClick={() => handleSelectAllSoalStatus(false)}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg text-[11px] font-bold transition-all"
              title="Ubah semua soal yang terlihat menjadi Cadangan (Nonaktif)"
            >
              ⚪ Kosongkan
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs font-bold animate-in fade-in duration-150">
          <div className="text-blue-900 dark:text-blue-200 flex items-center gap-2">
            <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px]">
              {selectedIds.length}
            </span>
            <span>Soal Terpilih dari Tabel</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkSetStatus(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all flex items-center gap-1 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Tandai Terpilih untuk Diujikan</span>
            </button>
            <button
              onClick={() => handleBulkSetStatus(false)}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition-all flex items-center gap-1 shadow-sm"
            >
              <X className="w-3.5 h-3.5" />
              <span>Simpan ke Cadangan</span>
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 rounded-lg"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isSoalLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : paginatedSoal.length === 0 ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-xs">
          Tidak ada soal yang sesuai dengan filter atau pencarian.
        </div>
      ) : (
        /* Questions Table */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      paginatedSoal.length > 0 &&
                      paginatedSoal.every((s) => selectedIds.includes(s.id))
                    }
                    onChange={handleToggleSelectAllOnPage}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="p-3 w-12 text-center">No</th>
                <th className="p-3">Kategori</th>
                <th className="p-3 min-w-[260px]">Pertanyaan Soal</th>
                <th className="p-3 min-w-[180px]">Pilihan Jawaban & Kunci</th>
                <th className="p-3">Bobot</th>
                <th className="p-3 text-center min-w-[150px]">Pilih untuk Ujian</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {paginatedSoal.map((soal, index) => {
                const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                const categoryObj = categories.find(
                  (c) => c.kodeKategori === soal.kategoriKode || c.kodeKategori === soal.category
                );
                const correctIdx = typeof soal.jawabanBenar === 'number' ? soal.jawabanBenar : soal.correctOptionIndex || 0;
                const isSelected = selectedIds.includes(soal.id);
                const isExamActive = soal.statusAktif !== false;

                return (
                  <tr
                    key={soal.id}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-blue-50/70 dark:bg-blue-950/40'
                        : isExamActive
                        ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        : 'bg-slate-50/50 dark:bg-slate-900/40 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectItem(soal.id)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-3 text-center font-bold text-slate-500 dark:text-slate-400">{globalIndex}</td>
                    <td className="p-3">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold text-[10px] uppercase border border-blue-200 dark:border-blue-800">
                        {categoryObj?.namaKategori || soal.kategoriKode || soal.category}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900 dark:text-white line-clamp-2">
                        {soal.questionText || soal.question}
                      </div>
                      {soal.imageUrl && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mt-1">
                          <ImageIcon className="w-3 h-3" /> Ada Gambar
                        </span>
                      )}
                    </td>
                    <td className="p-3 space-y-0.5 text-[11px]">
                      <div className={correctIdx === 0 ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}>
                        A. {soal.pilihanA || soal.options?.[0]} {correctIdx === 0 && '✓'}
                      </div>
                      <div className={correctIdx === 1 ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}>
                        B. {soal.pilihanB || soal.options?.[1]} {correctIdx === 1 && '✓'}
                      </div>
                      <div className={correctIdx === 2 ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}>
                        C. {soal.pilihanC || soal.options?.[2]} {correctIdx === 2 && '✓'}
                      </div>
                      <div className={correctIdx === 3 ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}>
                        D. {soal.pilihanD || soal.options?.[3]} {correctIdx === 3 && '✓'}
                      </div>
                    </td>
                    <td className="p-3 font-semibold">
                      <div>
                        Bobot: <span className="font-bold text-slate-900 dark:text-white">{soal.bobot || 10}</span>
                      </div>
                      <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400">
                        {soal.levelKesulitan || 'medium'}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleToggleExamStatus(soal)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold transition-all border shadow-sm flex items-center justify-center gap-1 mx-auto ${
                          isExamActive
                            ? 'bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                        }`}
                        title="Klik untuk mengubah status diujikan / cadangan"
                      >
                        {isExamActive ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>🎯 Diujikan (Aktif)</span>
                          </>
                        ) : (
                          <>
                            <X className="w-3 h-3 text-slate-400" />
                            <span>⚪ Cadangan</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setPreviewSoal(soal)}
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/50 hover:text-blue-600 rounded-lg transition-colors"
                          title="Preview Soal"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(soal)}
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 hover:text-indigo-600 rounded-lg transition-colors"
                          title="Edit Soal"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(soal.id)}
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-900/50 hover:text-rose-600 rounded-lg transition-colors"
                          title="Hapus Soal"
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

      {/* Pagination Controls */}
      {!isSoalLoading && filteredSoal.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>Menampilkan per halaman:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="p-1 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>
              (Total: <strong>{filteredSoal.length}</strong> soal)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 font-bold text-slate-900 dark:text-white">
              Halaman {currentPage} dari {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal Add / Edit Soal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 my-8 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {editingSoal ? 'Edit Soal' : 'Tambah Soal Baru (Supabase Sync)'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Kategori Soal *</label>
                  <select
                    {...register('kategoriKode')}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-600"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.kodeKategori}>
                        {c.namaKategori}
                      </option>
                    ))}
                  </select>
                  {errors.kategoriKode && <p className="text-rose-500 text-[11px] mt-1">{errors.kategoriKode.message}</p>}
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Level Kesulitan *</label>
                  <select
                    {...register('levelKesulitan')}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="easy">Easy (Mudah)</option>
                    <option value="medium">Medium (Sedang)</option>
                    <option value="hard">Hard (Sulit)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Teks Pertanyaan Soal *</label>
                <textarea
                  rows={4}
                  placeholder="Tuliskan pertanyaan soal secara rinci..."
                  {...register('pertanyaan')}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-600"
                />
                {errors.pertanyaan && <p className="text-rose-500 text-[11px] mt-1">{errors.pertanyaan.message}</p>}
              </div>

              {/* Gambar Lampiran */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                <label className="block text-slate-700 dark:text-slate-300 font-bold flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Upload Gambar Lampiran Soal (Opsional)</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-blue-50 dark:file:bg-blue-950 file:text-blue-700 dark:file:text-blue-300 file:font-bold hover:file:bg-blue-100"
                />
                {uploadedImage && (
                  <div className="mt-2 relative inline-block border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden max-h-40">
                    <img src={uploadedImage} alt="Lampiran" className="h-36 object-contain" />
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedImage('');
                        setValue('imageUrl', '');
                      }}
                      className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Opsi Pilihan A, B, C, D */}
              <div className="space-y-3 pt-2">
                <div className="font-bold text-slate-800 dark:text-slate-200">Opsi Pilihan Jawaban:</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">Pilihan A *</label>
                    <input
                      type="text"
                      {...register('pilihanA')}
                      className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-600"
                    />
                    {errors.pilihanA && <p className="text-rose-500 text-[11px] mt-1">{errors.pilihanA.message}</p>}
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">Pilihan B *</label>
                    <input
                      type="text"
                      {...register('pilihanB')}
                      className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-600"
                    />
                    {errors.pilihanB && <p className="text-rose-500 text-[11px] mt-1">{errors.pilihanB.message}</p>}
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">Pilihan C *</label>
                    <input
                      type="text"
                      {...register('pilihanC')}
                      className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-600"
                    />
                    {errors.pilihanC && <p className="text-rose-500 text-[11px] mt-1">{errors.pilihanC.message}</p>}
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">Pilihan D *</label>
                    <input
                      type="text"
                      {...register('pilihanD')}
                      className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-600"
                    />
                    {errors.pilihanD && <p className="text-rose-500 text-[11px] mt-1">{errors.pilihanD.message}</p>}
                  </div>
                </div>
              </div>

              {/* Kunci Jawaban & Bobot */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Jawaban Benar (Kunci) *</label>
                  <select
                    {...register('jawabanBenar', { valueAsNumber: true })}
                    className="w-full p-2.5 border border-emerald-300 dark:border-emerald-700 rounded-xl font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200"
                  >
                    <option value={0}>A. {watchedPilihanA || 'Pilihan A'}</option>
                    <option value={1}>B. {watchedPilihanB || 'Pilihan B'}</option>
                    <option value={2}>C. {watchedPilihanC || 'Pilihan C'}</option>
                    <option value={3}>D. {watchedPilihanD || 'Pilihan D'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Bobot Soal *</label>
                  <input
                    type="number"
                    {...register('bobot', { valueAsNumber: true })}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold focus:ring-2 focus:ring-blue-600"
                  />
                  {errors.bobot && <p className="text-rose-500 text-[11px] mt-1">{errors.bobot.message}</p>}
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Status Keaktifan</label>
                  <select
                    {...register('statusAktif', {
                      setValueAs: (v) => v === 'true' || v === true,
                    })}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold"
                  >
                    <option value="true">Aktif Digunakan</option>
                    <option value="false">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
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
                  {isSubmitting || createMutation.isPending || updateMutation.isPending ? 'Menyimpan...' : 'Simpan Soal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Preview Soal */}
      {previewSoal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <span className="px-3 py-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-extrabold text-xs rounded-full uppercase">
                Preview Soal ({previewSoal.kategoriKode || previewSoal.category})
              </span>
              <button onClick={() => setPreviewSoal(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="font-bold text-sm text-slate-900 dark:text-white leading-relaxed">
                {previewSoal.questionText || previewSoal.question}
              </div>

              {previewSoal.imageUrl && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-slate-50 dark:bg-slate-800 flex justify-center">
                  <img src={previewSoal.imageUrl} alt="Lampiran Soal" className="max-h-48 object-contain rounded-lg" />
                </div>
              )}

              <div className="space-y-2 pt-2">
                {[previewSoal.pilihanA, previewSoal.pilihanB, previewSoal.pilihanC, previewSoal.pilihanD].map((opt, idx) => {
                  const correctIdx = typeof previewSoal.jawabanBenar === 'number' ? previewSoal.jawabanBenar : previewSoal.correctOptionIndex;
                  const isCorrect = correctIdx === idx;
                  const displayOpt = opt || previewSoal.options?.[idx];
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between ${
                        isCorrect
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-bold'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span>
                        {String.fromCharCode(65 + idx)}. {displayOpt}
                      </span>
                      {isCorrect && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPreviewSoal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
              >
                Tutup Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmation Delete */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 text-center border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Konfirmasi Hapus Soal</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Apakah Anda yakin ingin menghapus butir soal ini dari Supabase & Bank Soal? Tindakan ini permanen.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Hapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pratinjau Paket Soal Ujian Calon Murid */}
      {showExamSetModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200 my-8 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Paket Soal Ujian Calon Murid ({activeQuestions.length} Soal Terpilih)
                </h3>
              </div>
              <button onClick={() => setShowExamSetModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-2 flex-1 text-xs">
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 leading-relaxed font-semibold">
                Berikut adalah daftar butir soal yang diaktifkan untuk diujikan secara langsung kepada calon murid saat mereka membuka portal CBT SPMB.
              </div>

              {activeQuestions.length === 0 ? (
                <div className="text-center py-8 text-slate-500 font-semibold">
                  Belum ada soal yang ditandai sebagai <strong>"Diujikan (Aktif)"</strong>.
                </div>
              ) : (
                <div className="space-y-4">
                  {['diagnostik', 'pengetahuan_umum', 'diniyyah'].map((catKey) => {
                    const catSoal = activeQuestions.filter(
                      (s) => (s.kategoriKode || s.category) === catKey
                    );
                    const catName =
                      catKey === 'diagnostik'
                        ? '1. Tes Diagnostik'
                        : catKey === 'pengetahuan_umum'
                        ? '2. Tes Pengetahuan Umum (TPU)'
                        : '3. Tes Diniyyah & Keagamaan';

                    if (catSoal.length === 0) return null;

                    return (
                      <div key={catKey} className="space-y-2">
                        <div className="font-extrabold text-slate-900 dark:text-white text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                          {catName} ({catSoal.length} Soal)
                        </div>
                        <div className="space-y-2 pl-2">
                          {catSoal.map((soal, idx) => {
                            const correctIdx =
                              typeof soal.jawabanBenar === 'number'
                                ? soal.jawabanBenar
                                : soal.correctOptionIndex || 0;
                            return (
                              <div
                                key={soal.id}
                                className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5"
                              >
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {idx + 1}. {soal.questionText || soal.question}
                                </div>
                                <div className="grid grid-cols-2 gap-1 text-[11px]">
                                  <div className={correctIdx === 0 ? 'font-bold text-emerald-600' : 'text-slate-500'}>
                                    A. {soal.pilihanA || soal.options?.[0]} {correctIdx === 0 && '✓'}
                                  </div>
                                  <div className={correctIdx === 1 ? 'font-bold text-emerald-600' : 'text-slate-500'}>
                                    B. {soal.pilihanB || soal.options?.[1]} {correctIdx === 1 && '✓'}
                                  </div>
                                  <div className={correctIdx === 2 ? 'font-bold text-emerald-600' : 'text-slate-500'}>
                                    C. {soal.pilihanC || soal.options?.[2]} {correctIdx === 2 && '✓'}
                                  </div>
                                  <div className={correctIdx === 3 ? 'font-bold text-emerald-600' : 'text-slate-500'}>
                                    D. {soal.pilihanD || soal.options?.[3]} {correctIdx === 3 && '✓'}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0 gap-3">
              <span className="text-xs text-slate-500 font-medium">
                Total Soal Aktif: <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold">{activeQuestions.length} Soal</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    await handleSaveActiveExamPackage();
                    setShowExamSetModal(false);
                  }}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>💾 Simpan & Kunci Paket Ujian</span>
                </button>
                <button
                  onClick={() => setShowExamSetModal(false)}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
