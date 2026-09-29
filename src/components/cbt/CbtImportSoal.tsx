import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw, Download } from 'lucide-react';
import { CbtSoal } from '../../types';
import { bulkInsertSoalSupabase } from '../../services/cbtSupabaseService';
import { generateUUID } from '../../utils/uuid';

export const CbtImportSoal: React.FC = () => {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [importLog, setImportLog] = useState<{
    successCount: number;
    failedCount: number;
    errors: string[];
    validQuestions: CbtSoal[];
  } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [successBanner, setSuccessBanner] = useState('');

  const bulkMutation = useMutation({
    mutationFn: bulkInsertSoalSupabase,
    onSuccess: (data, variables) => {
      toast.success(`Berhasil mengimpor ${variables.length} soal ke Supabase!`);
      queryClient.invalidateQueries({ queryKey: ['cbt_soal'] });
      setSuccessBanner(`✓ Berhasil mengimpor ${variables.length} soal baru ke Bank Soal Supabase!`);
      setFile(null);
      setImportLog(null);
    },
    onError: (err: any) => {
      toast.error(`Gagal menyimpan ke Supabase: ${err?.message || 'Error'}`);
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setImportLog(null);
    setSuccessBanner('');
  };

  const processImportFile = () => {
    if (!file) {
      toast.error('Pilih file Excel (.xlsx) atau CSV (.csv) terlebih dahulu.');
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const workbook = XLSX.read(buffer, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!jsonRows || jsonRows.length === 0) {
          toast.error('File Excel/CSV kosong atau format baris tidak terbaca.');
          setIsProcessing(false);
          return;
        }

        const errors: string[] = [];
        const validQuestions: CbtSoal[] = [];

        jsonRows.forEach((row, idx) => {
          const rowNum = idx + 2; // Row 1 is Header

          // Case-insensitive key lookup helper
          const getValue = (keys: string[]) => {
            for (const k of Object.keys(row)) {
              if (keys.some((key) => k.trim().toLowerCase() === key.toLowerCase())) {
                return String(row[k]).trim();
              }
            }
            return '';
          };

          const kategoriRaw = getValue(['Kategori', 'Kategori_Soal', 'Category', 'Kode_Kategori']);
          const pertanyaan = getValue(['Pertanyaan', 'Pertanyaan_Soal', 'Question', 'Soal']);
          const opsiA = getValue(['Opsi A', 'Opsi_A', 'Option A', 'Pilihan A', 'A']);
          const opsiB = getValue(['Opsi B', 'Opsi_B', 'Option B', 'Pilihan B', 'B']);
          const opsiC = getValue(['Opsi C', 'Opsi_C', 'Option C', 'Pilihan C', 'C']);
          const opsiD = getValue(['Opsi D', 'Opsi_D', 'Option D', 'Pilihan D', 'D']);
          const jawabanRaw = getValue(['Jawaban', 'Jawaban_Benar', 'Kunci', 'Key', 'Correct']);
          const bobotRaw = getValue(['Bobot', 'Points', 'Nilai']);
          const levelRaw = getValue(['Level', 'Level_Kesulitan', 'Difficulty']);

          // Validations
          if (!pertanyaan) {
            errors.push(`Baris ${rowNum}: Teks pertanyaan kosong.`);
            return;
          }
          if (!opsiA || !opsiB || !opsiC || !opsiD) {
            errors.push(`Baris ${rowNum}: Pilihan opsi A, B, C, D harus lengkap.`);
            return;
          }

          // Parse Category
          let katKode = 'diagnostik';
          const katLower = kategoriRaw.toLowerCase();
          if (katLower.includes('umum') || katLower.includes('tpu') || katLower.includes('pengetahuan')) {
            katKode = 'pengetahuan_umum';
          } else if (katLower.includes('dini') || katLower.includes('agama') || katLower.includes('islam')) {
            katKode = 'diniyyah';
          } else {
            katKode = 'diagnostik';
          }

          // Parse Answer Key (0=A, 1=B, 2=C, 3=D)
          let keyIndex = 0;
          const jawUpper = jawabanRaw.toUpperCase();
          if (jawUpper === 'A' || jawUpper === '0' || jawUpper === opsiA.toUpperCase()) keyIndex = 0;
          else if (jawUpper === 'B' || jawUpper === '1' || jawUpper === opsiB.toUpperCase()) keyIndex = 1;
          else if (jawUpper === 'C' || jawUpper === '2' || jawUpper === opsiC.toUpperCase()) keyIndex = 2;
          else if (jawUpper === 'D' || jawUpper === '3' || jawUpper === opsiD.toUpperCase()) keyIndex = 3;
          else {
            errors.push(`Baris ${rowNum}: Kunci jawaban "${jawabanRaw}" tidak valid. Harus A, B, C, atau D.`);
            return;
          }

          const points = Number(bobotRaw) || 10;
          const level = ['easy', 'medium', 'hard'].includes(levelRaw.toLowerCase())
            ? (levelRaw.toLowerCase() as 'easy' | 'medium' | 'hard')
            : 'medium';

          validQuestions.push({
            id: generateUUID(),
            category: katKode as any,

            kategoriKode: katKode,
            questionText: pertanyaan,
            question: pertanyaan,
            options: [opsiA, opsiB, opsiC, opsiD],
            pilihanA: opsiA,
            pilihanB: opsiB,
            pilihanC: opsiC,
            pilihanD: opsiD,
            jawabanBenar: keyIndex,
            correctOptionIndex: keyIndex,
            bobot: points,
            points: points,
            levelKesulitan: level,
            statusAktif: true,
          });
        });

        setImportLog({
          successCount: validQuestions.length,
          failedCount: errors.length,
          errors,
          validQuestions,
        });
      } catch (err: any) {
        toast.error('Gagal mengurai file Excel: ' + err.message);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleApplyImport = () => {
    if (!importLog || importLog.validQuestions.length === 0) return;
    bulkMutation.mutate(importLog.validQuestions);
  };

  const downloadSampleExcel = () => {
    const sampleData = [
      {
        Kategori: 'diagnostik',
        Pertanyaan: 'Jika 3x + 7 = 22, maka nilai dari 2x - 3 adalah...',
        'Opsi A': '5',
        'Opsi B': '7',
        'Opsi C': '9',
        'Opsi D': '11',
        Jawaban: 'B',
        Bobot: 10,
        Level: 'medium',
      },
      {
        Kategori: 'pengetahuan_umum',
        Pertanyaan: 'Landasan idiil dan falsafah hidup bangsa Indonesia adalah...',
        'Opsi A': 'UUD 1945',
        'Opsi B': 'Pancasila',
        'Opsi C': 'GBHN',
        'Opsi D': 'Proklamasi',
        Jawaban: 'B',
        Bobot: 10,
        Level: 'easy',
      },
      {
        Kategori: 'diniyyah',
        Pertanyaan: 'Surah yang dinamakan sebagai Ummul Qur\'an adalah...',
        'Opsi A': 'Al-Baqarah',
        'Opsi B': 'Al-Fatihah',
        'Opsi C': 'Al-Ikhlas',
        'Opsi D': 'Yasin',
        Jawaban: 'B',
        Bobot: 10,
        Level: 'easy',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Soal');
    XLSX.writeFile(wb, 'Template_Import_Soal_CBT.xlsx');
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Import Soal Excel ke Supabase</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Unggah massal butir soal dari Excel (.xlsx / .csv) dengan verifikasi otomatis.
          </p>
        </div>

        <button
          onClick={downloadSampleExcel}
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center gap-2 shrink-0 border border-slate-300 dark:border-slate-700"
        >
          <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Unduh Template Excel</span>
        </button>
      </div>

      {successBanner && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-xl font-bold text-xs flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Upload Drop Zone */}
      <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-2xl bg-slate-50 dark:bg-slate-800/40 transition-all text-center space-y-3">
        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-2xl flex items-center justify-center mx-auto">
          <FileSpreadsheet className="w-6 h-6" />
        </div>

        <div>
          <div className="text-sm font-extrabold text-slate-900 dark:text-white">
            {file ? file.name : 'Pilih File Excel (.xlsx) atau .csv untuk Diimpor'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Format kolom wajib: <strong>Kategori, Pertanyaan, Opsi A, Opsi B, Opsi C, Opsi D, Jawaban, Bobot, Level</strong>
          </div>
        </div>

        <input
          type="file"
          accept=".xlsx, .xls, .csv"
          onChange={handleFileUpload}
          className="hidden"
          id="cbt-excel-import-input"
        />

        <div className="flex justify-center gap-2 pt-2">
          <label
            htmlFor="cbt-excel-import-input"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer shadow-sm transition-all"
          >
            Pilih File...
          </label>
          {file && (
            <button
              onClick={processImportFile}
              disabled={isProcessing}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memeriksa File...</span>
                </>
              ) : (
                <span>Validasi Data Soal</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Import Validation Report */}
      {importLog && (
        <div className="p-6 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-4">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">
            Hasil Verifikasi Dokumen Soal
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Jumlah Data Valid</div>
                <div className="text-2xl font-black text-emerald-900 dark:text-emerald-100">{importLog.successCount} Soal</div>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>

            <div className="p-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-rose-800 dark:text-rose-300">Jumlah Data Gagal</div>
                <div className="text-2xl font-black text-rose-900 dark:text-rose-100">{importLog.failedCount} Baris</div>
              </div>
              <AlertCircle className="w-8 h-8 text-rose-600 dark:text-rose-400" />
            </div>
          </div>

          {importLog.errors.length > 0 && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl space-y-1 text-xs text-rose-800 dark:text-rose-300">
              <div className="font-bold mb-1">Rincian Error Validasi:</div>
              {importLog.errors.map((err, idx) => (
                <div key={idx} className="flex items-center gap-1.5 font-mono">
                  <span>•</span>
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}

          {importLog.validQuestions.length > 0 && (
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleApplyImport}
                disabled={bulkMutation.isPending}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {bulkMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Supabase...</span>
                  </>
                ) : (
                  <span>Simpan {importLog.validQuestions.length} Soal ke Supabase</span>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
