import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Eye, Clock, CheckCircle2, Wifi, WifiOff, RefreshCw, AlertCircle, Search,
  Filter, AlertTriangle, User, Activity, Layers, X, Info, Sparkles,
  ChevronRight, ArrowRight, ShieldCheck, ShieldAlert, Database, Zap,
  RotateCcw, Trash2
} from 'lucide-react';
import { StudentData, CbtUjian, CbtParticipantLiveStatus, CbtLiveMonitoringSummary, CbtActivityLogItem } from '../../types';
import { fetchUjianSupabase } from '../../services/cbtSupabaseService';
import {
  fetchCbtLiveMonitoringFromSupabase,
  subscribeToCbtMonitoringChannel,
  formatCountdownTimer,
  formatLastSeen,
  fetchParticipantDetailedAnswers,
  sendCbtHeartbeatSupabase,
  recordCbtActivityLogSupabase,
  ulangUjianPesertaMonitoringLiveSupabase,
  hapusPesertaMonitoringLiveSupabase,
  hapusSemuaPesertaMonitoringLiveSupabase,
  CBT_MONITORING_CONFIG,
} from '../../services/cbtMonitoringService';
import { CbtDatabaseSetupModal } from './CbtDatabaseSetupModal';

interface CbtMonitoringProps {
  students: StudentData[];
}

export const CbtMonitoring: React.FC<CbtMonitoringProps> = ({ students }) => {
  // 1. Fetch Daftar Jadwal Ujian
  const { data: allUjian = [], isLoading: isUjianLoading } = useQuery({
    queryKey: ['cbt_ujian_list'],
    queryFn: fetchUjianSupabase,
  });

  // Selected Exam (Default ke Semua Ujian untuk pemantauan menyeluruh dan real-time)
  const [selectedUjianId, setSelectedUjianId] = useState<string>('ALL_EXAMS');

  useEffect(() => {
    if (!selectedUjianId) {
      setSelectedUjianId('ALL_EXAMS');
    }
  }, [allUjian, selectedUjianId]);

  const currentUjian = allUjian.find((u) => u.id === selectedUjianId) || allUjian[0];

  // 2. Monitoring State
  const [participants, setParticipants] = useState<CbtParticipantLiveStatus[]>([]);
  const [summary, setSummary] = useState<CbtLiveMonitoringSummary | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'polling' | 'error'>('polling');
  const [isFetching, setIsFetching] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // 3. Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterGender, setFilterGender] = useState<string>('ALL');
  const [filterOnlyAttention, setFilterOnlyAttention] = useState<boolean>(false);

  // 4. Participant Detail Modal State
  const [selectedParticipant, setSelectedParticipant] = useState<CbtParticipantLiveStatus | null>(null);
  const [detailedAnswers, setDetailedAnswers] = useState<Array<{
    soalId: string;
    jawabanDipilih?: string;
    jawabanIndex?: number;
    isRagu: boolean;
  }>>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // 5. Database Supabase Modal & Simulasi Sambungan Murid
  const [showDatabaseModal, setShowDatabaseModal] = useState(false);
  const [isSimulatingTest, setIsSimulatingTest] = useState(false);

  // 6. Action Modal States (Fitur Ulang Ujian & Hapus Data Monitoring)
  const [selectedParticipantToReset, setSelectedParticipantToReset] = useState<CbtParticipantLiveStatus | null>(null);
  const [selectedParticipantToDelete, setSelectedParticipantToDelete] = useState<CbtParticipantLiveStatus | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState<boolean>(false);
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

  // Opsi saat menghapus
  const [deleteParticipantAnswers, setDeleteParticipantAnswers] = useState<boolean>(true);
  const [deleteParticipantHasil, setDeleteParticipantHasil] = useState<boolean>(true);
  const [resetParticipantScores, setResetParticipantScores] = useState<boolean>(true);

  // Notification Toast Feedback
  const [actionFeedback, setActionFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleConfirmUlangUjian = async () => {
    if (!selectedParticipantToReset) return;
    setIsProcessingAction(true);
    try {
      const success = await ulangUjianPesertaMonitoringLiveSupabase({
        participantId: selectedParticipantToReset.participantId,
        examId: selectedParticipantToReset.examId || selectedUjianId,
        participantName: selectedParticipantToReset.fullName,
      });

      if (success) {
        setActionFeedback({
          type: 'success',
          message: `Berhasil mereset sesi! Peserta ${selectedParticipantToReset.fullName} kini diizinkan ujian ulang (retest) dari soal no. 1 dengan timer penuh.`,
        });
        if (selectedParticipant?.participantId === selectedParticipantToReset.participantId) {
          setSelectedParticipant(null);
        }
        await refreshMonitoringData(true);
      } else {
        setActionFeedback({
          type: 'error',
          message: 'Gagal mereset sesi ujian peserta. Silakan coba kembali.',
        });
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: `Terjadi kendala saat reset: ${err?.message || 'Gagal'}`,
      });
    } finally {
      setIsProcessingAction(false);
      setSelectedParticipantToReset(null);
      setTimeout(() => setActionFeedback(null), 5000);
    }
  };

  const handleConfirmHapusPeserta = async () => {
    if (!selectedParticipantToDelete) return;
    setIsProcessingAction(true);
    try {
      const success = await hapusPesertaMonitoringLiveSupabase({
        participantId: selectedParticipantToDelete.participantId,
        examId: selectedParticipantToDelete.examId || selectedUjianId,
        participantName: selectedParticipantToDelete.fullName,
        deleteAnswers: deleteParticipantAnswers,
        deleteHasil: deleteParticipantHasil,
        resetScores: resetParticipantScores,
      });

      if (success) {
        setActionFeedback({
          type: 'success',
          message: `Data monitoring untuk ${selectedParticipantToDelete.fullName} berhasil dihapus dari sistem.`,
        });
        if (selectedParticipant?.participantId === selectedParticipantToDelete.participantId) {
          setSelectedParticipant(null);
        }
        await refreshMonitoringData(true);
      } else {
        setActionFeedback({
          type: 'error',
          message: 'Gagal menghapus data peserta dari monitoring.',
        });
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: `Terjadi kendala saat hapus: ${err?.message || 'Gagal'}`,
      });
    } finally {
      setIsProcessingAction(false);
      setSelectedParticipantToDelete(null);
      setTimeout(() => setActionFeedback(null), 5000);
    }
  };

  const handleConfirmClearAll = async () => {
    setIsProcessingAction(true);
    try {
      await hapusSemuaPesertaMonitoringLiveSupabase(selectedUjianId);
      setActionFeedback({
        type: 'success',
        message: 'Seluruh rekaman sesi live monitoring telah berhasil dikosongkan.',
      });
      await refreshMonitoringData(true);
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: 'Gagal mengosongkan sesi live.',
      });
    } finally {
      setIsProcessingAction(false);
      setShowClearAllModal(false);
      setTimeout(() => setActionFeedback(null), 5000);
    }
  };

  const handleTestSimulation = async () => {
    setIsSimulatingTest(true);
    try {
      const demoId = 'std_demo_athifah_live';
      const activeUjianTarget = currentUjian?.id || '7c690ee0-7321-4604-a05d-ea664019bcfc';
      
      await sendCbtHeartbeatSupabase({
        exam_id: activeUjianTarget,
        participant_id: demoId,
        user_id: 'Athifah Syauqiyah (Simulasi Live)',
        last_seen_at: new Date().toISOString(),
        current_question: 9,
        answered_count: 8,
        total_questions: 20,
        progress_percentage: 40,
        remaining_seconds: 4500,
        session_id: `ses_${activeUjianTarget}_${demoId}`,
        connection_status: 'online',
        server_start_time: new Date().toISOString(),
        server_end_time: new Date(Date.now() + 4500 * 1000).toISOString(),
      });

      await recordCbtActivityLogSupabase({
        examId: activeUjianTarget,
        participantId: demoId,
        participantName: 'Athifah Syauqiyah (Simulasi Live)',
        eventType: 'save_answer',
        title: 'Menyimpan Jawaban Soal #9',
        description: 'Peserta aktif menjawab pilihan B pada soal nomor 9.',
        questionNumber: 9,
      });

      await refreshMonitoringData(true);
    } catch (err) {
      console.warn('Simulation error:', err);
    } finally {
      setTimeout(() => setIsSimulatingTest(false), 800);
    }
  };

  // Load / Re-fetch monitoring data directly from Supabase (SSOT)
  const refreshMonitoringData = async (isManual = false) => {
    if (!selectedUjianId) return;
    if (isManual) setIsFetching(true);

    try {
      const totalQ = currentUjian
        ? (currentUjian.jumlahDiagnostik || 6) + (currentUjian.jumlahTpu || 8) + (currentUjian.jumlahDiniyyah || 6)
        : 20;

      const result = await fetchCbtLiveMonitoringFromSupabase(selectedUjianId, students, totalQ);
      setParticipants(result.participants);
      setSummary(result.summary);
      setLastRefreshedAt(new Date());

      if (connectionStatus !== 'connected') {
        setConnectionStatus(result.isFromSupabase ? 'polling' : 'error');
      }

      // Perbarui modal jika sedang terbuka
      if (selectedParticipant) {
        const updated = result.participants.find((p) => p.participantId === selectedParticipant.participantId);
        if (updated) setSelectedParticipant(updated);
      }
    } catch (err) {
      console.warn('Refresh monitoring data error:', err);
      setConnectionStatus('error');
    } finally {
      if (isManual) setIsFetching(false);
    }
  };

  // Initial load when selectedUjianId changes
  useEffect(() => {
    if (selectedUjianId) {
      refreshMonitoringData(true);
    }
  }, [selectedUjianId, students.length]);

  // Supabase Realtime Subscription & Fallback Polling
  useEffect(() => {
    if (!selectedUjianId) return;

    // 1. Subscribe to Supabase Realtime Channel
    const unsubscribe = subscribeToCbtMonitoringChannel(selectedUjianId, {
      onHeartbeat: (hb) => {
        setParticipants((prev) =>
          prev.map((p) => {
            if (p.participantId === hb.participant_id) {
              const diffMs = hb.server_end_time ? new Date(hb.server_end_time).getTime() - Date.now() : 0;
              const remSec = hb.server_end_time ? Math.max(0, Math.floor(diffMs / 1000)) : hb.remaining_seconds;
              return {
                ...p,
                currentQuestionNumber: hb.current_question,
                answeredCount: hb.answered_count,
                totalQuestions: hb.total_questions,
                progressPercentage: hb.progress_percentage,
                remainingSeconds: remSec,
                lastSeenAt: hb.last_seen_at,
                connectionStatus: hb.connection_status,
                status: hb.remaining_seconds === 0 && p.isSubmitted ? 'SELESAI' : 'AKTIF',
              };
            }
            return p;
          })
        );
      },
      onActivity: (act) => {
        setParticipants((prev) =>
          prev.map((p) => {
            if (p.participantId === act.participantId) {
              const updatedActivities = [act, ...(p.recentActivities || [])].slice(0, 30);
              const needsAtt = updatedActivities.some((a) => a.isSuspicious);
              return {
                ...p,
                recentActivities: updatedActivities,
                needsAttention: p.needsAttention || needsAtt,
              };
            }
            return p;
          })
        );
      },
      onDbChange: () => {
        // Ketika terjadi perubahan pada jawaban_peserta atau hasil_ujian di Supabase
        refreshMonitoringData(false);
      },
      onStatusChange: (status) => {
        setConnectionStatus(status);
      },
    });

    // 2. Interval Polling Reconcile (Setiap 5 detik)
    const pollInterval = setInterval(() => {
      refreshMonitoringData(false);
    }, CBT_MONITORING_CONFIG.POLLING_FALLBACK_INTERVAL_MS);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [selectedUjianId]);

  // 3. Listen to external updates & reset events
  useEffect(() => {
    const handleReconcile = () => {
      refreshMonitoringData(false);
    };
    window.addEventListener('cbt_monitoring_updated', handleReconcile);
    window.addEventListener('cbt_exam_reset', handleReconcile);
    window.addEventListener('cbt_hasil_updated', handleReconcile);
    return () => {
      window.removeEventListener('cbt_monitoring_updated', handleReconcile);
      window.removeEventListener('cbt_exam_reset', handleReconcile);
      window.removeEventListener('cbt_hasil_updated', handleReconcile);
    };
  }, [selectedUjianId]);

  // Second-by-second countdown clock for active participant cards/rows
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setParticipants((prev) =>
        prev.map((p) => {
          if (p.status === 'AKTIF' && p.remainingSeconds > 0) {
            return {
              ...p,
              remainingSeconds: Math.max(0, p.remainingSeconds - 1),
            };
          }
          return p;
        })
      );
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  // Filtered Participants List
  const filteredParticipants = useMemo(() => {
    return participants.filter((p) => {
      // 1. Search filter
      const matchesSearch =
        p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // 2. Status filter
      if (filterStatus !== 'ALL' && p.status !== filterStatus) {
        return false;
      }

      // 3. Gender filter
      if (filterGender !== 'ALL') {
        if (filterGender === 'IKHWAN' && p.gender !== 'Laki-laki') return false;
        if (filterGender === 'AKHWAT' && p.gender !== 'Perempuan') return false;
      }

      // 4. Attention only filter
      if (filterOnlyAttention && !p.needsAttention) {
        return false;
      }

      return true;
    });
  }, [participants, searchQuery, filterStatus, filterGender, filterOnlyAttention]);

  // Open Participant Detail Modal
  const handleOpenDetail = async (participant: CbtParticipantLiveStatus) => {
    setSelectedParticipant(participant);
    setIsLoadingDetails(true);

    try {
      const answers = await fetchParticipantDetailedAnswers(participant.examId, participant.participantId);
      setDetailedAnswers(answers);
    } catch (err) {
      console.warn('Failed loading detailed answers:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Exam Selector */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white p-6 rounded-3xl shadow-xl border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[11px] font-black tracking-wider uppercase flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                Live Monitoring CBT
              </span>
              <span className="text-xs text-slate-400">
                • SMP Al-Hadiid Cileungsi
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>MONITORING LIVE UJIAN</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Pantau jalannya ujian seleksi secara real-time. Menampilkan progres pengerjaan, sisa waktu, aktivitas detak jantung (heartbeat), dan deteksi anomali koneksi peserta langsung dari database Supabase.
            </p>
          </div>

          {/* Right Controls: Exam Dropdown & Connection Indicator */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {/* Exam Selector */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-2 flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-bold px-2">Pilih Ujian:</span>
              <select
                value={selectedUjianId}
                onChange={(e) => setSelectedUjianId(e.target.value)}
                className="bg-slate-900 text-white font-bold px-3 py-1.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL_EXAMS">🌐 Semua Jadwal Ujian (Global Live Terkoneksi)</option>
                {allUjian.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.namaUjian} ({u.gelombang}) {u.status === 'aktif' ? '• [AKTIF]' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Database Setup Button */}
            <button
              onClick={() => setShowDatabaseModal(true)}
              className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 border border-indigo-400/30 cursor-pointer"
              title="Kelola skrip SQL migrasi, cek status tabel, dan inisialisasi database CBT Supabase"
            >
              <Database className="w-3.5 h-3.5 text-indigo-200" />
              <span>Database Supabase CBT</span>
            </button>

            {/* Simulasi Uji Sambungan Calon Murid */}
            <button
              onClick={handleTestSimulation}
              disabled={isSimulatingTest}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 border border-emerald-400/30 cursor-pointer"
              title="Kirim detak jantung uji coba untuk memverifikasi tampilan koneksi calon murid secara live"
            >
              <Zap className={`w-3.5 h-3.5 text-amber-300 ${isSimulatingTest ? 'animate-spin' : ''}`} />
              <span>{isSimulatingTest ? 'Menguji...' : 'Uji Sambungan Murid'}</span>
            </button>

            {/* Manual Refresh Button */}
            <button
              onClick={() => refreshMonitoringData(true)}
              disabled={isFetching}
              className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 border border-blue-400/30 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span>{isFetching ? 'Memuat...' : 'Refresh'}</span>
            </button>

            {/* Bersihkan Sesi Live Button */}
            <button
              type="button"
              onClick={() => setShowClearAllModal(true)}
              className="px-3.5 py-2.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-white font-bold text-xs rounded-2xl shadow-md border border-rose-800/60 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              title="Bersihkan seluruh sesi & riwayat detak jantung live"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Bersihkan Sesi Live</span>
            </button>
          </div>
        </div>

        {/* Connection Quality Banner */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            {connectionStatus === 'connected' && (
              <div className="flex items-center gap-2 text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/50 px-3 py-1 rounded-xl">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>🟢 Supabase Realtime Terhubung (Live Broadcast Aktif)</span>
              </div>
            )}
            {connectionStatus === 'polling' && (
              <div className="flex items-center gap-2 text-amber-300 font-bold bg-amber-950/60 border border-amber-800/50 px-3 py-1 rounded-xl">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>🟡 Sinkronisasi Database Supabase (Polling 5 Detik)</span>
              </div>
            )}
            {connectionStatus === 'error' && (
              <div className="flex items-center gap-2 text-rose-300 font-bold bg-rose-950/80 border border-rose-800 px-3 py-1 rounded-xl">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                <span>🔴 Koneksi monitoring terganggu (Menjaga data resmi Supabase)</span>
              </div>
            )}
          </div>

          <div className="text-slate-400 text-[11px] font-mono">
            Terakhir diperbarui: {lastRefreshedAt.toLocaleTimeString('id-ID')}
          </div>
        </div>
      </div>

      {/* 2. Executive Stat Summary Cards (6 Clickable Filter Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Peserta */}
        <button
          type="button"
          onClick={() => {
            setFilterStatus('ALL');
            setFilterOnlyAttention(false);
          }}
          className={`text-left p-4 rounded-2xl border shadow-sm space-y-1 transition-all cursor-pointer ${
            filterStatus === 'ALL' && !filterOnlyAttention
              ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-blue-500 shadow-md'
              : 'bg-white hover:bg-slate-50 border-slate-200'
          }`}
        >
          <div className={`text-[10px] font-black uppercase tracking-wider ${
            filterStatus === 'ALL' && !filterOnlyAttention ? 'text-slate-300' : 'text-slate-500'
          }`}>
            Total Peserta
          </div>
          <div className={`text-2xl font-black ${
            filterStatus === 'ALL' && !filterOnlyAttention ? 'text-white' : 'text-slate-900'
          }`}>
            {summary?.totalParticipants || 0}
          </div>
          <div className={`text-[10px] font-semibold ${
            filterStatus === 'ALL' && !filterOnlyAttention ? 'text-blue-300' : 'text-slate-500'
          }`}>
            Semua Murid (Klik)
          </div>
        </button>

        {/* 🟢 Sedang Ujian (Aktif) */}
        <button
          type="button"
          onClick={() => {
            setFilterStatus('AKTIF');
            setFilterOnlyAttention(false);
          }}
          className={`text-left p-4 rounded-2xl border shadow-sm space-y-1 transition-all cursor-pointer ${
            filterStatus === 'AKTIF'
              ? 'bg-emerald-700 text-white border-emerald-600 ring-2 ring-emerald-400 shadow-md'
              : 'bg-white hover:bg-emerald-50/50 border-emerald-200'
          }`}
        >
          <div className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
            filterStatus === 'AKTIF' ? 'text-emerald-100' : 'text-emerald-700'
          }`}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Sedang Ujian</span>
          </div>
          <div className={`text-2xl font-black ${
            filterStatus === 'AKTIF' ? 'text-white' : 'text-emerald-800'
          }`}>
            {summary?.activeCount || 0}
          </div>
          <div className={`text-[10px] font-semibold ${
            filterStatus === 'AKTIF' ? 'text-emerald-200' : 'text-emerald-600'
          }`}>
            Aktif Pengerjaan (Klik)
          </div>
        </button>

        {/* ⚪ Belum Mulai */}
        <button
          type="button"
          onClick={() => {
            setFilterStatus('BELUM_MULAI');
            setFilterOnlyAttention(false);
          }}
          className={`text-left p-4 rounded-2xl border shadow-sm space-y-1 transition-all cursor-pointer ${
            filterStatus === 'BELUM_MULAI'
              ? 'bg-slate-700 text-white border-slate-600 ring-2 ring-slate-400 shadow-md'
              : 'bg-white hover:bg-slate-50 border-slate-200'
          }`}
        >
          <div className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
            filterStatus === 'BELUM_MULAI' ? 'text-slate-200' : 'text-slate-600'
          }`}>
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span>Belum Mulai</span>
          </div>
          <div className={`text-2xl font-black ${
            filterStatus === 'BELUM_MULAI' ? 'text-white' : 'text-slate-700'
          }`}>
            {summary?.notStartedCount || 0}
          </div>
          <div className={`text-[10px] font-semibold ${
            filterStatus === 'BELUM_MULAI' ? 'text-slate-300' : 'text-slate-500'
          }`}>
            Belum Mulai Tes (Klik)
          </div>
        </button>

        {/* 🔵 Selesai */}
        <button
          type="button"
          onClick={() => {
            setFilterStatus('SELESAI');
            setFilterOnlyAttention(false);
          }}
          className={`text-left p-4 rounded-2xl border shadow-sm space-y-1 transition-all cursor-pointer ${
            filterStatus === 'SELESAI'
              ? 'bg-blue-700 text-white border-blue-600 ring-2 ring-blue-400 shadow-md'
              : 'bg-white hover:bg-blue-50/50 border-blue-200'
          }`}
        >
          <div className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
            filterStatus === 'SELESAI' ? 'text-blue-100' : 'text-blue-700'
          }`}>
            <CheckCircle2 className="w-3 h-3 text-blue-300" />
            <span>Selesai</span>
          </div>
          <div className={`text-2xl font-black ${
            filterStatus === 'SELESAI' ? 'text-white' : 'text-blue-900'
          }`}>
            {summary?.finishedCount || 0}
          </div>
          <div className={`text-[10px] font-semibold ${
            filterStatus === 'SELESAI' ? 'text-blue-200' : 'text-blue-600'
          }`}>
            Disubmit (Klik)
          </div>
        </button>

        {/* 🟡 / 🔴 Tidak Aktif / Terputus */}
        <button
          type="button"
          onClick={() => {
            setFilterStatus('TIDAK_AKTIF');
            setFilterOnlyAttention(false);
          }}
          className={`text-left p-4 rounded-2xl border shadow-sm space-y-1 transition-all cursor-pointer ${
            filterStatus === 'TIDAK_AKTIF' || filterStatus === 'TERPUTUS'
              ? 'bg-amber-700 text-white border-amber-600 ring-2 ring-amber-400 shadow-md'
              : 'bg-white hover:bg-amber-50/50 border-amber-200'
          }`}
        >
          <div className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
            filterStatus === 'TIDAK_AKTIF' || filterStatus === 'TERPUTUS' ? 'text-amber-100' : 'text-amber-700'
          }`}>
            <WifiOff className="w-3 h-3 text-amber-300" />
            <span>Terputus</span>
          </div>
          <div className={`text-2xl font-black ${
            filterStatus === 'TIDAK_AKTIF' || filterStatus === 'TERPUTUS' ? 'text-white' : 'text-amber-800'
          }`}>
            {(summary?.inactiveCount || 0) + (summary?.disconnectedCount || 0)}
          </div>
          <div className={`text-[10px] font-semibold ${
            filterStatus === 'TIDAK_AKTIF' || filterStatus === 'TERPUTUS' ? 'text-amber-200' : 'text-amber-700'
          }`}>
            {summary?.inactiveCount || 0} jeda, {summary?.disconnectedCount || 0} putus
          </div>
        </button>

        {/* ⚠ Perlu Diperiksa */}
        <button
          type="button"
          onClick={() => {
            setFilterOnlyAttention(!filterOnlyAttention);
          }}
          className={`text-left p-4 rounded-2xl border shadow-sm space-y-1 transition-all cursor-pointer ${
            filterOnlyAttention
              ? 'bg-rose-700 text-white border-rose-600 ring-2 ring-rose-400 shadow-md'
              : (summary?.needsAttentionCount || 0) > 0
                ? 'bg-rose-50 border-rose-300 hover:bg-rose-100/60'
                : 'bg-white hover:bg-slate-50 border-slate-200'
          }`}
        >
          <div className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
            filterOnlyAttention ? 'text-rose-100' : 'text-rose-700'
          }`}>
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            <span>Perlu Diperiksa</span>
          </div>
          <div className={`text-2xl font-black ${
            filterOnlyAttention ? 'text-white' : 'text-rose-800'
          }`}>
            {summary?.needsAttentionCount || 0}
          </div>
          <div className={`text-[10px] font-semibold ${
            filterOnlyAttention ? 'text-rose-200' : 'text-rose-600'
          }`}>
            {filterOnlyAttention ? 'Filter Aktif (Klik Reset)' : 'Anomali Teknis (Klik)'}
          </div>
        </button>
      </div>

      {/* 3. Filters and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Cari nama peserta atau nomor pendaftaran SPMB..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filter Dropdowns & Toggles */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
              <span className="text-slate-500 font-bold">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none"
              >
                <option value="ALL">Semua Status ({participants.length})</option>
                <option value="AKTIF">🟢 Aktif ({participants.filter(p => p.status === 'AKTIF').length})</option>
                <option value="TIDAK_AKTIF">🟡 Tidak Aktif ({participants.filter(p => p.status === 'TIDAK_AKTIF').length})</option>
                <option value="TERPUTUS">🔴 Terputus ({participants.filter(p => p.status === 'TERPUTUS').length})</option>
                <option value="BELUM_MULAI">⚪ Belum Mulai ({participants.filter(p => p.status === 'BELUM_MULAI').length})</option>
                <option value="SELESAI">🔵 Selesai ({participants.filter(p => p.status === 'SELESAI').length})</option>
              </select>
            </div>

            {/* Gender Filter */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
              <span className="text-slate-500 font-bold">Gender:</span>
              <select
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none"
              >
                <option value="ALL">Semua Gender</option>
                <option value="IKHWAN">Ikhwan (Laki-laki)</option>
                <option value="AKHWAT">Akhwat (Perempuan)</option>
              </select>
            </div>

            {/* Attention Only Toggle Button */}
            <button
              onClick={() => setFilterOnlyAttention(!filterOnlyAttention)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                filterOnlyAttention
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Hanya Perlu Diperiksa {summary?.needsAttentionCount ? `(${summary.needsAttentionCount})` : ''}</span>
            </button>
          </div>
        </div>

        {/* Active Filter Indicators */}
        {(filterStatus !== 'ALL' || filterGender !== 'ALL' || filterOnlyAttention || searchQuery) && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <span>Menampilkan <strong>{filteredParticipants.length}</strong> dari {participants.length} peserta</span>
            <button
              onClick={() => {
                setFilterStatus('ALL');
                setFilterGender('ALL');
                setFilterOnlyAttention(false);
                setSearchQuery('');
              }}
              className="text-blue-600 hover:underline font-bold ml-auto"
            >
              Reset Semua Filter
            </button>
          </div>
        )}
      </div>

      {/* 4. Live Participants Table (Requirement 10) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <th className="p-3.5 text-center w-12">No</th>
                <th className="p-3.5">No. Pendaftar</th>
                <th className="p-3.5">Nama Peserta</th>
                <th className="p-3.5">Gender</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 w-48">Progress</th>
                <th className="p-3.5 text-center">Soal</th>
                <th className="p-3.5">Sisa Waktu</th>
                <th className="p-3.5">Last Seen</th>
                <th className="p-3.5 text-center">Pemeriksaan</th>
                <th className="p-3.5 text-center w-48">Aksi &amp; Kontrol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredParticipants.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-slate-400">
                    <div className="max-w-sm mx-auto space-y-2">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                        <Search className="w-6 h-6" />
                      </div>
                      <div className="font-bold text-slate-700">Tidak ada peserta yang cocok</div>
                      <p className="text-xs text-slate-400">
                        Coba sesuaikan kata kunci pencarian atau ubah filter status di bagian atas.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredParticipants.map((p, idx) => {
                  const lastSeen = formatLastSeen(p.lastSeenAt);

                  return (
                    <tr
                      key={p.participantId}
                      className={`hover:bg-slate-50 transition-colors ${
                        p.needsAttention ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      {/* 1. No */}
                      <td className="p-3.5 text-center font-mono font-bold text-slate-500">
                        {String(idx + 1).padStart(2, '0')}
                      </td>

                      {/* 2. No. Pendaftar */}
                      <td className="p-3.5 font-mono font-bold text-blue-900">
                        <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                          {p.registrationNumber}
                        </span>
                      </td>

                      {/* 3. Nama Peserta */}
                      <td className="p-3.5 font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{p.fullName}</span>
                          {p.isSubmitted && p.score !== undefined && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                              Nilai: {p.score}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4. Gender */}
                      <td className="p-3.5">
                        {p.gender === 'Laki-laki' ? (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                            Ikhwan
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 font-bold text-[10px]">
                            Akhwat
                          </span>
                        )}
                      </td>

                      {/* 5. Status Live Indicator */}
                      <td className="p-3.5">
                        {p.status === 'AKTIF' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            🟢 Aktif
                          </span>
                        )}
                        {p.status === 'TIDAK_AKTIF' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            🟡 Tidak Aktif
                          </span>
                        )}
                        {p.status === 'TERPUTUS' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            🔴 Terputus
                          </span>
                        )}
                        {p.status === 'BELUM_MULAI' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px]">
                            <span className="w-2 h-2 rounded-full bg-slate-400" />
                            ⚪ Belum Mulai
                          </span>
                        )}
                        {p.status === 'SELESAI' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-extrabold text-[10px]">
                            <CheckCircle2 className="w-3 h-3 text-blue-600" />
                            🔵 Selesai
                          </span>
                        )}
                      </td>

                      {/* 6. Progress Bar */}
                      <td className="p-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span className="text-slate-600">{p.progressPercentage}%</span>
                            <span className="text-slate-400 font-mono">
                              {p.answeredCount} / {p.totalQuestions}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 rounded-full ${
                                p.status === 'SELESAI'
                                  ? 'bg-blue-600'
                                  : p.progressPercentage > 75
                                  ? 'bg-emerald-500'
                                  : p.progressPercentage > 30
                                  ? 'bg-indigo-500'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${p.progressPercentage}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* 7. Soal Terakhir */}
                      <td className="p-3.5 text-center font-semibold">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 font-mono font-bold text-[11px]">
                          {p.status === 'BELUM_MULAI' ? '-' : `No. ${p.currentQuestionNumber}`}
                        </span>
                      </td>

                      {/* 8. Sisa Waktu */}
                      <td className="p-3.5 font-mono font-bold text-amber-700">
                        {p.status === 'SELESAI' ? (
                          <span className="text-blue-700 font-semibold text-[11px]">Selesai</span>
                        ) : p.status === 'BELUM_MULAI' ? (
                          <span className="text-slate-400">-</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>{formatCountdownTimer(p.remainingSeconds)}</span>
                          </div>
                        )}
                      </td>

                      {/* 9. Last Seen */}
                      <td className="p-3.5 text-[11px]">
                        <div className="font-mono font-bold text-slate-700">{lastSeen.timeStr}</div>
                        <div className="text-[10px] text-slate-400">{lastSeen.relativeStr}</div>
                      </td>

                      {/* 10. Status Pemeriksaan / Perlu Diperiksa */}
                      <td className="p-3.5 text-center">
                        {p.needsAttention ? (
                          <span
                            title={p.attentionReasons.join('\n')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-black text-[10px] cursor-help"
                          >
                            <AlertTriangle className="w-3 h-3 text-rose-600 animate-pulse" />
                            <span>Perlu Diperiksa</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400 text-[10px]">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Normal</span>
                          </span>
                        )}
                      </td>

                      {/* 11. Aksi: Button Detail, Ulang Ujian, Hapus */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(p)}
                            className="px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-xl border border-indigo-200 transition-all flex items-center gap-1 cursor-pointer"
                            title="Buka Lembar Jawaban & Audit Detail"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Detail</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedParticipantToReset(p)}
                            className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[11px] rounded-xl border border-amber-300 transition-all flex items-center gap-1 cursor-pointer"
                            title="Ulang Ujian (Reset sesi & izinkan peserta retest)"
                          >
                            <RotateCcw className="w-3 h-3 text-amber-600" />
                            <span>Ulang</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedParticipantToDelete(p)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-800 font-bold text-[11px] rounded-xl border border-rose-200 transition-all flex items-center gap-1 cursor-pointer"
                            title="Hapus Peserta dari Monitoring Live"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Detail Peserta Modal / Drawer (Requirement 12 & 13 & 14) */}
      {selectedParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-slate-900">
                    DETAIL PESERTA UJIAN
                  </h3>
                  {selectedParticipant.status === 'AKTIF' && (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-full">
                      🟢 LIVE AKTIF
                    </span>
                  )}
                  {selectedParticipant.status === 'SELESAI' && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-extrabold rounded-full">
                      🔵 SELESAI
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {currentUjian?.namaUjian || 'Ujian CBT SPMB'} • Data langsung dari Supabase
                </p>
              </div>

              <button
                onClick={() => setSelectedParticipant(null)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
              {/* Profile Card */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Nama Peserta</div>
                  <div className="font-extrabold text-slate-900 text-sm mt-0.5">{selectedParticipant.fullName}</div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">No. Pendaftar</div>
                  <div className="font-mono font-bold text-blue-800 text-sm mt-0.5">{selectedParticipant.registrationNumber}</div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Gender</div>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {selectedParticipant.gender === 'Laki-laki' ? 'Ikhwan (Laki-laki)' : 'Akhwat (Perempuan)'}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Sisa Waktu</div>
                  <div className="font-mono font-extrabold text-amber-700 text-sm mt-0.5">
                    {selectedParticipant.status === 'SELESAI' ? 'Ujian Selesai' : formatCountdownTimer(selectedParticipant.remainingSeconds)}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Terakhir Aktif</div>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {formatLastSeen(selectedParticipant.lastSeenAt).timeStr} ({formatLastSeen(selectedParticipant.lastSeenAt).relativeStr})
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Status Koneksi</div>
                  <div className="font-bold mt-0.5 flex items-center gap-1">
                    {selectedParticipant.connectionStatus === 'online' ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <Wifi className="w-3 h-3 text-emerald-600" /> Online
                      </span>
                    ) : (
                      <span className="text-slate-500 flex items-center gap-1">
                        <WifiOff className="w-3 h-3 text-slate-400" /> Offline / Selesai
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress & Answers Summary (Requirement 7 & 12) */}
              <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-slate-900 text-sm">Progress Pengerjaan Ujian</span>
                  <span className="text-blue-700 font-extrabold text-base">
                    {selectedParticipant.progressPercentage}%
                  </span>
                </div>

                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${selectedParticipant.progressPercentage}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-2">
                  <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    <div className="text-lg font-black text-emerald-800">
                      {selectedParticipant.answeredCount}
                    </div>
                    <div className="text-[10px] font-bold text-emerald-600">Soal Terisi</div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div className="text-lg font-black text-slate-700">
                      {Math.max(0, selectedParticipant.totalQuestions - selectedParticipant.answeredCount)}
                    </div>
                    <div className="text-[10px] font-bold text-slate-500">Belum Terisi</div>
                  </div>

                  <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    <div className="text-lg font-black text-amber-800">
                      {selectedParticipant.doubtfulCount || 0}
                    </div>
                    <div className="text-[10px] font-bold text-amber-600">Ragu-ragu</div>
                  </div>
                </div>

                {/* Visual Questions Grid */}
                <div className="pt-2">
                  <div className="text-[11px] font-bold text-slate-600 mb-2">
                    Pemetaan Lembar Jawaban ({selectedParticipant.totalQuestions} Soal):
                  </div>
                  <div className="grid grid-cols-10 gap-1.5">
                    {Array.from({ length: selectedParticipant.totalQuestions }).map((_, i) => {
                      const qNum = i + 1;
                      const isCurrent = selectedParticipant.currentQuestionNumber === qNum;
                      // Cek apakah soal i terjawab berdasarkan detailedAnswers
                      const ansItem = detailedAnswers[i];
                      const isAnswered = ansItem ? Boolean(ansItem.jawabanDipilih) : i < selectedParticipant.answeredCount;
                      const isDoubtful = Boolean(ansItem?.isRagu);

                      return (
                        <div
                          key={qNum}
                          className={`h-8 rounded-lg flex items-center justify-center font-bold text-[11px] font-mono border transition-all ${
                            isDoubtful
                              ? 'bg-amber-400 text-slate-900 border-amber-500 font-black'
                              : isAnswered
                              ? 'bg-emerald-600 text-white border-emerald-700'
                              : 'bg-slate-100 text-slate-400 border-slate-200'
                          } ${isCurrent ? 'ring-2 ring-blue-500 ring-offset-1 font-black' : ''}`}
                          title={`Soal No. ${qNum}: ${isDoubtful ? 'Ragu-ragu' : isAnswered ? 'Terisi' : 'Belum dijawab'}${isCurrent ? ' (Sedang dibuka)' : ''}`}
                        >
                          {qNum}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-slate-500 mt-2">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block" /> Terisi</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block" /> Ragu-ragu</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-slate-200 inline-block" /> Belum Dijawab</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded border-2 border-blue-500 inline-block" /> Sedang Dibuka</span>
                  </div>
                </div>
              </div>

              {/* Status Pemeriksaan Teknis (Requirement 14) */}
              <div className="space-y-2">
                <div className="text-xs font-black uppercase text-slate-900 tracking-wider">
                  Status Pemeriksaan Teknis
                </div>

                {selectedParticipant.needsAttention ? (
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-rose-800 font-extrabold">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>PERLU DIPERIKSA OLEH PANITIA</span>
                    </div>
                    <p className="text-[11px] text-rose-700">
                      <strong>Catatan Kebijakan:</strong> Indikator ini murni rangkuman teknis jaringan dan fokus aplikasi, bukan vonis otomatis kecurangan. Keputusan dan pengecekan verifikasi tetap menjadi wewenang Panitia SPMB.
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-[11px] text-rose-900 font-semibold pt-1">
                      {selectedParticipant.attentionReasons.map((reason, rIdx) => (
                        <li key={rIdx}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-extrabold text-emerald-900">Aktivitas Ujian Normal</div>
                      <div className="text-[11px] text-emerald-700">
                        Tidak ditemukan anomali koneksi, heartbeat lancar, dan proses ujian berjalan tertib.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Aktivitas Terakhir (Audit Log) (Requirement 13) */}
              <div className="space-y-2">
                <div className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  <span>Aktivitas Terakhir Peserta (Audit Log)</span>
                </div>

                {selectedParticipant.recentActivities && selectedParticipant.recentActivities.length > 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 max-h-52 overflow-y-auto space-y-2">
                    {selectedParticipant.recentActivities.map((act, actIdx) => (
                      <div
                        key={act.id || actIdx}
                        className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                          act.isSuspicious
                            ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-bold shrink-0">
                          {act.timestamp ? new Date(act.timestamp).toLocaleTimeString('id-ID') : '-'}
                        </span>
                        <div className="space-y-0.5">
                          <div className="font-bold flex items-center gap-1.5">
                            {act.isSuspicious && <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />}
                            <span>{act.title}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">{act.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center text-slate-400 italic">
                    Belum ada log aktivitas tambahan yang tercatat untuk sesi ini.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer with Action Buttons */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/90 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedParticipantToReset(selectedParticipant)}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Izinkan peserta ini mengikuti ujian ulang dari awal"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Ulang Ujian Peserta Ini</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedParticipantToDelete(selectedParticipant)}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Hapus sesi peserta dari monitoring live"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus dari Monitoring</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedParticipant(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI ULANG UJIAN (RESET & RETEST) */}
      {selectedParticipantToReset && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-amber-600">
                <div className="p-2 bg-amber-100 rounded-xl">
                  <RotateCcw className="w-5 h-5 text-amber-700" />
                </div>
                <h4 className="text-base font-black text-slate-900">Konfirmasi Ulang Ujian</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedParticipantToReset(null)}
                disabled={isProcessingAction}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda ingin mengizinkan peserta ini melakukan <strong>Ujian Ulang (Retest)</strong>? Tindakan ini akan mengosongkan lembar jawaban sebelumnya, mereset durasi waktu ujian ke awal, dan mengembalikan status calon murid agar dapat mengerjakan tes dari nomor 1.
            </p>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Nama Peserta:</span>
                <span className="font-bold text-slate-900">{selectedParticipantToReset.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">No. Pendaftaran:</span>
                <span className="font-mono font-bold text-slate-900">{selectedParticipantToReset.registrationNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status Saat Ini:</span>
                <span className="font-bold text-slate-800">
                  {selectedParticipantToReset.status === 'SELESAI'
                    ? '🔵 Selesai Ujian'
                    : selectedParticipantToReset.status === 'AKTIF'
                    ? '🟢 Sedang Aktif Ujian'
                    : selectedParticipantToReset.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Jawaban Terisi:</span>
                <span className="font-mono font-bold text-slate-700">
                  {selectedParticipantToReset.answeredCount} dari {selectedParticipantToReset.totalQuestions} soal
                </span>
              </div>
              {selectedParticipantToReset.score !== undefined && (
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Nilai Sebelumnya:</span>
                  <span className="font-mono font-bold text-indigo-700">{selectedParticipantToReset.score}</span>
                </div>
              )}
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Catatan: Sesi ujian peserta pada tabel <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">jawaban_peserta</code> dan <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">hasil_ujian</code> akan dibersihkan agar peserta dapat masuk kembali di portal CBT.
              </span>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSelectedParticipantToReset(null)}
                disabled={isProcessingAction}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmUlangUjian}
                disabled={isProcessingAction}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isProcessingAction ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Mereset Ujian...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Ya, Izinkan Ulang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS PESERTA DARI MONITORING */}
      {selectedParticipantToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="p-2 bg-rose-100 rounded-xl">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                </div>
                <h4 className="text-base font-black text-slate-900">Hapus dari Monitoring Live</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedParticipantToDelete(null)}
                disabled={isProcessingAction}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus data pemantauan ujian untuk peserta berikut dari menu Monitoring Live?
            </p>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Nama Peserta:</span>
                <span className="font-bold text-slate-900">{selectedParticipantToDelete.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">No. Pendaftaran:</span>
                <span className="font-mono font-bold text-slate-900">{selectedParticipantToDelete.registrationNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status Live:</span>
                <span className="font-bold text-slate-800">{selectedParticipantToDelete.status}</span>
              </div>
            </div>

            <div className="space-y-2 p-3 bg-rose-50/60 rounded-xl border border-rose-200 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteParticipantAnswers}
                  onChange={(e) => setDeleteParticipantAnswers(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <span className="text-slate-800 font-semibold text-[11px]">Hapus riwayat jawaban ujian (jawaban_peserta)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteParticipantHasil}
                  onChange={(e) => setDeleteParticipantHasil(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <span className="text-slate-800 font-semibold text-[11px]">Hapus riwayat hasil &amp; skor ujian (hasil_ujian)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resetParticipantScores}
                  onChange={(e) => setResetParticipantScores(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <span className="text-slate-800 font-semibold text-[11px]">Reset nilai pada data calon murid di database</span>
              </label>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSelectedParticipantToDelete(null)}
                disabled={isProcessingAction}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmHapusPeserta}
                disabled={isProcessingAction}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isProcessingAction ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BERSIHKAN SEMUA SESI LIVE */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="p-2 bg-rose-100 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <h4 className="text-base font-black text-slate-900">Bersihkan Seluruh Sesi Live?</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowClearAllModal(false)}
                disabled={isProcessingAction}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-rose-800 bg-rose-50 p-3 rounded-xl border border-rose-200 leading-relaxed font-semibold">
              PERINGATAN: Tindakan ini akan mengosongkan rekaman detak jantung (heartbeat) aktif dan sesi live seluruh peserta dari pemantauan real-time.
            </p>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowClearAllModal(false)}
                disabled={isProcessingAction}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                disabled={isProcessingAction}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isProcessingAction ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Membersihkan...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Bersihkan Sesi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTION FEEDBACK FLOATING TOAST */}
      {actionFeedback && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5">
          <div
            className={`px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-2.5 text-xs font-bold ${
              actionFeedback.type === 'success'
                ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
                : 'bg-rose-900 text-rose-100 border-rose-700'
            }`}
          >
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
            <button
              onClick={() => setActionFeedback(null)}
              className="ml-2 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 5. Modal Konfigurasi Database Supabase CBT */}
      <CbtDatabaseSetupModal
        isOpen={showDatabaseModal}
        onClose={() => setShowDatabaseModal(false)}
        onSuccess={() => refreshMonitoringData(true)}
      />
    </div>
  );
};
