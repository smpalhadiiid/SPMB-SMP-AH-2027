import React, { useState, useEffect } from 'react';
import { StudentData } from '../../types';
import { getCbtLogUjian, getCbtUjian } from '../../utils/cbtStorage';
import { Eye, Clock, CheckCircle2, Wifi, WifiOff, RefreshCw, AlertCircle, Search } from 'lucide-react';

interface CbtMonitoringProps {
  students: StudentData[];
}

export const CbtMonitoring: React.FC<CbtMonitoringProps> = ({ students }) => {
  const [logs, setLogs] = useState(() => getCbtLogUjian());
  const exams = getCbtUjian();
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-refresh monitoring state every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLogs(getCbtLogUjian());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const studentMap = new Map<string, StudentData>(students.map(s => [s.id, s]));

  const filteredLogs = logs.filter(l => {
    const std = studentMap.get(l.pesertaId);
    const name = std?.fullName || l.namaPeserta || '';
    const regNo = std?.registrationNumber || '';
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      regNo.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const formatTime = (seconds: number) => {
    if (seconds <= 0) return '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Eye className="w-5 h-5 text-amber-600 animate-pulse" />
            <span>Monitoring Real-Time Ujian Peserta</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Pantau sisa waktu, nomor soal terakhir, koneksi online, dan status submit peserta yang sedang aktif mengerjakan tes.
          </p>
        </div>

        <button
          onClick={() => setLogs(getCbtLogUjian())}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 shrink-0 border border-slate-300"
        >
          <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
          <span>Refresh Live Log</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="text"
          placeholder="Cari nama peserta atau no pendaftaran..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {/* Live Monitoring Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b text-slate-700 font-bold">
              <th className="p-3">No. Reg</th>
              <th className="p-3">Nama Peserta</th>
              <th className="p-3">Nomor Soal Terakhir</th>
              <th className="p-3">Sisa Waktu</th>
              <th className="p-3">Status Online</th>
              <th className="p-3">Status Submit</th>
              <th className="p-3">Aktivitas Terakhir</th>
            </tr>
          </thead>
          <tbody className="divide-y text-slate-700">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                  Belum ada sesi pengerjaan ujian yang tercatat secara aktif.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log, idx) => {
                const std = studentMap.get(log.pesertaId);
                return (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-emerald-800">
                      {std?.registrationNumber || '-'}
                    </td>
                    <td className="p-3 font-bold text-slate-900">
                      {std?.fullName || log.namaPeserta || 'Peserta Tes'}
                    </td>
                    <td className="p-3 font-semibold">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 font-bold">
                        Soal No. {log.nomorSoalTerakhir || 1}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-amber-700">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>{formatTime(log.sisaWaktuDetik)}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      {log.statusOnline === 'ONLINE' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          <Wifi className="w-3 h-3 text-emerald-600" /> ONLINE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                          <WifiOff className="w-3 h-3 text-slate-400" /> OFFLINE
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {log.isSubmitted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3 text-teal-600" /> Sudah Submit
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                          <Clock className="w-3 h-3 text-amber-600 animate-spin" /> Sedang Mengerjakan
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-[10px] text-slate-400 font-mono">
                      {log.updatedAt ? new Date(log.updatedAt).toLocaleTimeString('id-ID') : '-'}
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
