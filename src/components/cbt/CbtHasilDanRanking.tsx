import React, { useState } from 'react';
import { StudentData, CbtHasilUjian } from '../../types';
import { getCbtHasilUjian } from '../../utils/cbtStorage';
import { exportToExcel } from '../../utils/excelExporter';
import { Trophy, Award, Search, FileSpreadsheet, CheckCircle2, XCircle, FileText, Download } from 'lucide-react';

interface CbtHasilDanRankingProps {
  students: StudentData[];
  mode?: 'hasil' | 'ranking';
}

export const CbtHasilDanRanking: React.FC<CbtHasilDanRankingProps> = ({ students, mode = 'hasil' }) => {
  const [hasilList, setHasilList] = useState<CbtHasilUjian[]>(() => {
    const raw = getCbtHasilUjian();
    // Sort descending by total score to calculate ranking
    const sorted = [...raw].sort((a, b) => b.nilaiTotal - a.nilaiTotal);
    return sorted.map((item, index) => ({
      ...item,
      ranking: index + 1,
    }));
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const studentMap = new Map<string, StudentData>(students.map(s => [s.id, s]));

  const filteredHasil = hasilList.filter(h => {
    const std = studentMap.get(h.pesertaId);
    const name = std?.fullName || h.namaPeserta || '';
    const regNo = std?.registrationNumber || h.registrationNumber || '';

    const matchSearch =
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      regNo.toLowerCase().includes(searchQuery.toLowerCase());

    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'lulus' ? h.statusKelulusan === 'LULUS' : h.statusKelulusan === 'BELUM LULUS');

    return matchSearch && matchStatus;
  });

  const handleExportExcel = () => {
    const exportData = filteredHasil.map((h) => {
      const std = studentMap.get(h.pesertaId);
      return {
        Peringkat: h.ranking || '-',
        No_Pendaftaran: std?.registrationNumber || h.registrationNumber || '-',
        Nama_Peserta: std?.fullName || h.namaPeserta || '-',
        Gelombang: 'Gelombang 1',
        Nilai_Diagnostik_30: h.nilaiDiagnostik,
        Nilai_TPU_40: h.nilaiTpu,
        Nilai_Diniyyah_30: h.nilaiDiniyyah,
        Nilai_Total_Akhir: h.nilaiTotal,
        Status_Kelulusan: h.statusKelulusan,
        Tanggal_Ujian: h.tanggalUjian,
      };
    });

    exportToExcel(exportData, `Rekap_Hasil_CBT_SPMB_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            {mode === 'ranking' ? (
              <Trophy className="w-5 h-5 text-amber-500" />
            ) : (
              <Award className="w-5 h-5 text-teal-600" />
            )}
            <span>{mode === 'ranking' ? 'Peringkat & Ranking Nilai CBT SPMB' : 'Hasil Nilai & Rekapitulasi Ujian CBT'}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Breakdown skor akumulasi (Diagnostik 30%, TPU 40%, Diniyyah 30%), status kelulusan, dan ranking peserta.
          </p>
        </div>

        <button
          onClick={handleExportExcel}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Rekap Excel</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-semibold">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari nama peserta atau no pendaftaran..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="p-2 border border-slate-300 rounded-xl bg-white text-xs font-semibold"
          >
            <option value="all">Semua Status Kelulusan</option>
            <option value="lulus">Status LULUS</option>
            <option value="belum">Status BELUM LULUS</option>
          </select>
        </div>
      </div>

      {/* Results & Ranking Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b text-slate-700 font-bold">
              <th className="p-3 w-12 text-center">Rank</th>
              <th className="p-3">No. Registration</th>
              <th className="p-3">Nama Peserta</th>
              <th className="p-3 text-center">Diagnostik (30%)</th>
              <th className="p-3 text-center">TPU (40%)</th>
              <th className="p-3 text-center">Diniyyah (30%)</th>
              <th className="p-3 text-center font-extrabold text-indigo-900">Nilai Akhir Total</th>
              <th className="p-3 text-center">Status Kelulusan</th>
            </tr>
          </thead>
          <tbody className="divide-y text-slate-700">
            {filteredHasil.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                  Belum ada data hasil pengerjaan ujian yang tersimpan.
                </td>
              </tr>
            ) : (
              filteredHasil.map((h) => {
                const std = studentMap.get(h.pesertaId);
                const isTop3 = h.ranking && h.ranking <= 3;
                return (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="p-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black ${
                          h.ranking === 1
                            ? 'bg-amber-400 text-amber-950 shadow-sm'
                            : h.ranking === 2
                            ? 'bg-slate-300 text-slate-900'
                            : h.ranking === 3
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {h.ranking}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-900">
                      {std?.registrationNumber || h.registrationNumber || '-'}
                    </td>
                    <td className="p-3 font-bold text-slate-900">
                      {std?.fullName || h.namaPeserta || 'Peserta Tes'}
                    </td>
                    <td className="p-3 text-center font-bold text-slate-700">{h.nilaiDiagnostik}</td>
                    <td className="p-3 text-center font-bold text-slate-700">{h.nilaiTpu}</td>
                    <td className="p-3 text-center font-bold text-slate-700">{h.nilaiDiniyyah}</td>
                    <td className="p-3 text-center">
                      <span className="text-base font-black text-indigo-900 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-200">
                        {h.nilaiTotal}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {h.statusKelulusan === 'LULUS' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> LULUS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-100 text-rose-800 text-[10px] font-black rounded-full border border-rose-300">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" /> BELUM LULUS
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
