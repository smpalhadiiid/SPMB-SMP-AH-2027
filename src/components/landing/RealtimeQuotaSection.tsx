// =====================================================================
// src/components/landing/RealtimeQuotaSection.tsx
// Seksi Informasi Kuota, Jumlah Pendaftar & Kuota yang Masih Dibutuhkan
// Real-time Live Sync dari Database Supabase SPMB SMPS Al-Hadiid Cileungsi
// =====================================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ClassQuota, StudentData, SchoolInfo } from '../../types';
import { ClassQuotaRepository } from '../../repositories/ClassQuotaRepository';
import { StudentRepository } from '../../repositories/StudentRepository';
import { supabase, isSupabaseConfigured } from '../../utils/supabaseClient';
import {
  Users, UserCheck, GraduationCap, Sparkles, RefreshCw, AlertCircle,
  CheckCircle2, ArrowRight, Phone, Clock, Flame, ShieldCheck, TrendingUp
} from 'lucide-react';

interface RealtimeQuotaSectionProps {
  schoolInfo: SchoolInfo;
  initialClassQuotas?: ClassQuota[];
  initialStudents?: StudentData[];
  onOpenRegister: () => void;
  onOpenWhatsApp: () => void;
}

// Komponen Animasi Angka Count-Up yang halus & ramah aksesibilitas
const AnimatedCounter: React.FC<{ value: number; duration?: number }> = ({ value, duration = 1000 }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);

  useEffect(() => {
    // Hormati pengaturan prefers-reduced-motion pengguna
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayValue(value);
      prevValueRef.current = value;
      return;
    }

    const start = prevValueRef.current;
    const end = value;
    let startTimestamp: number | null = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutExpo untuk akselerasi cepat lalu mendarat mulus
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(start + (end - start) * ease);
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(end);
        prevValueRef.current = end;
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value, duration]);

  return <span>{displayValue.toLocaleString('id-ID')}</span>;
};

export const RealtimeQuotaSection: React.FC<RealtimeQuotaSectionProps> = ({
  schoolInfo,
  initialClassQuotas = [],
  initialStudents = [],
  onOpenRegister,
  onOpenWhatsApp,
}) => {
  const [quotas, setQuotas] = useState<ClassQuota[]>(initialClassQuotas);
  const [students, setStudents] = useState<StudentData[]>(initialStudents);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [syncStatusText, setSyncStatusText] = useState('Realtime terhubung');
  const [highlightPulse, setHighlightPulse] = useState(false);

  // Sync internal state jika props awal berubah
  useEffect(() => {
    if (initialClassQuotas.length > 0) setQuotas(initialClassQuotas);
  }, [initialClassQuotas]);

  useEffect(() => {
    if (initialStudents.length > 0) setStudents(initialStudents);
  }, [initialStudents]);

  // Fungsi pengambilan data paling mutakhir dari Supabase
  const fetchLatestRealtimeData = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const [quotaRes, studentRes] = await Promise.all([
        ClassQuotaRepository.list(),
        StudentRepository.list(),
      ]);

      if (!quotaRes.error && quotaRes.data && quotaRes.data.length > 0) {
        setQuotas(quotaRes.data);
      }
      if (!studentRes.error && studentRes.data) {
        setStudents(studentRes.data);
      }

      setLastSyncTime(new Date());
      setSyncStatusText('Data tersinkronisasi');
      
      // Animasi kedipan singkat penanda update berhasil
      setHighlightPulse(true);
      setTimeout(() => setHighlightPulse(false), 1200);
    } catch (err) {
      console.warn('[RealtimeQuotaSection] Fetch error:', err);
      setSyncStatusText('Sinkronisasi offline/cache');
    } finally {
      if (isManual) {
        setTimeout(() => setIsRefreshing(false), 600);
      }
    }
  };

  // Setup Realtime Subscription + Auto Polling
  useEffect(() => {
    // Ambil data pertama kali saat komponen mount
    fetchLatestRealtimeData();

    if (!isSupabaseConfigured()) {
      setIsLiveConnected(false);
      return;
    }

    // Subscribe ke Supabase Realtime Channels
    const channel = supabase
      .channel('realtime_landing_quota_feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        () => {
          fetchLatestRealtimeData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'class_quotas' },
        () => {
          fetchLatestRealtimeData();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsLiveConnected(true);
          setSyncStatusText('Real-time live aktif');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsLiveConnected(false);
          setSyncStatusText('Koneksi cadangan (polling)');
        }
      });

    // Fallback polling setiap 25 detik untuk menjamin data selalu mutakhir
    const pollInterval = setInterval(() => {
      fetchLatestRealtimeData();
    }, 25000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, []);

  // Perhitungan Metrik Kuota
  const metrics = useMemo(() => {
    // Total kapasitas dari rombel/kelas (fallback standar 128 jika belum terisi)
    const rawCapacity = quotas.reduce((sum, q) => sum + (Number(q.capacity) || 0), 0);
    const totalCapacity = rawCapacity > 0 ? rawCapacity : 128;

    // Total pendaftar saat ini
    const totalPendaftar = students.length;

    // Kuota yang masih dibutuhkan (sisa kursi)
    const neededQuota = Math.max(0, totalCapacity - totalPendaftar);

    // Persentase keterisian
    const fillPercentage = totalCapacity > 0 
      ? Math.min(100, Math.round((totalPendaftar / totalCapacity) * 100)) 
      : 0;

    // Breakdown Gender pendaftar
    const countIkhwan = students.filter(s => s.gender === 'Laki-laki').length;
    const countAkhwat = students.filter(s => s.gender === 'Perempuan').length;

    // Status keterisian
    let statusBadge = {
      label: 'Pendaftaran Terbuka Luas',
      color: 'bg-emerald-50 text-emerald-800 border-emerald-300',
      icon: CheckCircle2,
      urgencyNote: 'Segera lakukan pendaftaran sebelum kuota per rombel terpenuhi.',
    };

    if (neededQuota === 0) {
      statusBadge = {
        label: 'Kuota Utama Terpenuhi (Waiting List)',
        color: 'bg-rose-50 text-rose-800 border-rose-300',
        icon: AlertCircle,
        urgencyNote: 'Pendaftaran gelombang cadangan / waiting list sedang dibuka.',
      };
    } else if (neededQuota <= 20) {
      statusBadge = {
        label: 'Sisa Kuota Terbatas!',
        color: 'bg-amber-50 text-amber-900 border-amber-300',
        icon: Flame,
        urgencyNote: 'Tersisa kurang dari 20 bangku pendaftaran untuk calon murid baru.',
      };
    }

    return {
      totalCapacity,
      totalPendaftar,
      neededQuota,
      fillPercentage,
      countIkhwan,
      countAkhwat,
      statusBadge,
    };
  }, [quotas, students]);

  return (
    <section id="kuota" className="relative py-20 bg-slate-900 text-white overflow-hidden border-b border-slate-800">
      {/* Background Accent Gradients */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 -right-20 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-12">
        {/* Section Header with Live Status Tag */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-800 pb-8">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-xs font-semibold backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="font-mono tracking-wider uppercase text-[11px]">
                {isLiveConnected ? 'REAL-TIME LIVE UPDATE' : 'STATUS TERKINI'}
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300">TP {schoolInfo.academicYear}</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Status Kuota & Daya Tampung Pendaftar
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Pantau jumlah kuota penerimaan, total pendaftar yang telah terdaftar, dan sisa kuota yang masih dibutuhkan secara langsung.
            </p>
          </div>

          {/* Real-time Indicator & Manual Refresh Control */}
          <div className="flex items-center gap-3 self-start md:self-auto bg-slate-800/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-700 shadow-inner">
            <div className="text-right">
              <div className="text-[11px] font-semibold text-emerald-400 flex items-center justify-end gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{syncStatusText}</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Pukul {lastSyncTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
              </div>
            </div>

            <button
              onClick={() => fetchLatestRealtimeData(true)}
              disabled={isRefreshing}
              className={`p-2 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 hover:text-white transition-all cursor-pointer ${
                isRefreshing ? 'opacity-70' : 'active:scale-95'
              }`}
              title="Perbarui data kuota sekarang"
              aria-label="Segarkan data kuota"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 3 HERO METRIC CARDS (SESUAI PERMINTAAN USER) */}
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-500 ${highlightPulse ? 'scale-[1.008]' : ''}`}>
          {/* KARTU 1: JUMLAH KUOTA PENDAFTAR (DAYA TAMPUNG) */}
          <div className="relative bg-gradient-to-b from-slate-800/90 to-slate-800/50 p-6 sm:p-7 rounded-3xl border border-slate-700 shadow-xl overflow-hidden group hover:border-blue-500/40 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/20 transition-all" />
            
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                1. Kuota Daya Tampung
              </span>
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <GraduationCap className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-4xl sm:text-5xl font-black text-white tracking-tight flex items-baseline gap-2">
                <AnimatedCounter value={metrics.totalCapacity} />
                <span className="text-base sm:text-lg font-semibold text-slate-400">Kursi</span>
              </div>
              <div className="text-xs text-slate-300 font-medium">
                Total kapasitas murid baru TP {schoolInfo.academicYear}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
              <span>Alokasi Kelas:</span>
              <span className="font-semibold text-slate-200">
                {quotas.length > 0 ? `${quotas.length} Rombel (Kelas 7)` : '4 Rombel Reguler & Tahfidz'}
              </span>
            </div>
          </div>

          {/* KARTU 2: JUMLAH PENDAFTAR (REALTIME) */}
          <div className="relative bg-gradient-to-b from-slate-800/90 to-slate-800/50 p-6 sm:p-7 rounded-3xl border border-emerald-500/30 shadow-xl overflow-hidden group hover:border-emerald-500/60 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/25 transition-all" />

            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                2. Jumlah Pendaftar
              </span>
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-4xl sm:text-5xl font-black text-emerald-400 tracking-tight flex items-baseline gap-2">
                <AnimatedCounter value={metrics.totalPendaftar} />
                <span className="text-base sm:text-lg font-semibold text-slate-400">Calon Murid</span>
              </div>
              <div className="text-xs text-slate-300 font-medium">
                Tercatat resmi dalam database SPMB
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-700/60 flex items-center justify-between text-xs">
              <span className="text-slate-400">Komposisi:</span>
              <span className="font-semibold text-slate-200">
                <span className="text-blue-300">👦 {metrics.countIkhwan} Ikhwan</span>
                <span className="text-slate-500 mx-1.5">·</span>
                <span className="text-pink-300">👧 {metrics.countAkhwat} Akhwat</span>
              </span>
            </div>
          </div>

          {/* KARTU 3: KUOTA YANG MASIH DIBUTUHKAN (SISA KUOTA) */}
          <div className="relative bg-gradient-to-b from-slate-800/90 to-slate-800/50 p-6 sm:p-7 rounded-3xl border border-amber-500/30 shadow-xl overflow-hidden group hover:border-amber-500/60 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/15 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/25 transition-all" />

            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                3. Kuota Masih Dibutuhkan
              </span>
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-4xl sm:text-5xl font-black text-amber-300 tracking-tight flex items-baseline gap-2">
                <AnimatedCounter value={metrics.neededQuota} />
                <span className="text-base sm:text-lg font-semibold text-slate-400">Bangku Tersisa</span>
              </div>
              <div className="text-xs text-slate-300 font-medium">
                Dibutuhkan untuk memenuhi kapasitas target
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-700/60 flex items-center justify-between text-xs">
              <span className="text-slate-400">Status Keterisian:</span>
              <span className="font-bold text-amber-300">
                {metrics.neededQuota > 0 ? `${metrics.fillPercentage}% Terisi` : '100% Penuh'}
              </span>
            </div>
          </div>
        </div>

        {/* ANIMATED PROGRESS BAR & STATUS KETERISIAN KESELURUHAN */}
        <div className="bg-slate-800/70 p-6 sm:p-8 rounded-3xl border border-slate-700/80 backdrop-blur-md space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Tingkat Keterisian Kuota SPMB Al-Hadiid</span>
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-white">
                {metrics.totalPendaftar} dari {metrics.totalCapacity} Kuota Telah Terisi ({metrics.fillPercentage}%)
              </div>
            </div>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold w-fit shadow-sm bg-slate-900 border-slate-700">
              <span className={`w-2 h-2 rounded-full ${metrics.neededQuota <= 20 ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
              <span className="text-slate-200">{metrics.statusBadge.label}</span>
            </div>
          </div>

          {/* The Progress Bar Container */}
          <div className="space-y-2">
            <div className="relative w-full h-5 bg-slate-950/80 rounded-full overflow-hidden p-1 border border-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 transition-all duration-1000 ease-out relative"
                style={{ width: `${Math.max(4, metrics.fillPercentage)}%` }}
              >
                {/* Subtle Inner Glow & Shimmer */}
                <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
              </div>
            </div>

            {/* Scale Markers */}
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono px-1">
              <span>0% (Awal)</span>
              <span>25%</span>
              <span className="font-bold text-slate-300">50% (Separuh Kuota)</span>
              <span>75%</span>
              <span className="font-bold text-emerald-400">100% (Kapasitas Penuh)</span>
            </div>
          </div>

          {/* Urgency Alert Strip */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-slate-300">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <p>
                <strong className="text-white font-semibold">Pemberitahuan Kuota:</strong>{' '}
                {metrics.statusBadge.urgencyNote}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onOpenRegister}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950 cursor-pointer"
              >
                <span>Daftar Sekarang</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onOpenWhatsApp}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Konsultasi</span>
              </button>
            </div>
          </div>
        </div>

        {/* RINCIAN KUOTA PER KELAS / ROMBEL (JIKA TERSEDIA) */}
        {quotas.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>Rincian Kuota per Rombongan Belajar (Rombel)</span>
              </h3>
              <span className="text-xs text-slate-400">
                {quotas.length} Kelas Terdaftar
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {quotas.map((q, idx) => {
                const capacity = Number(q.capacity) || 32;
                // Hitung terisi: jika q.filled ada gunakan q.filled, atau gunakan proporsi siswa
                const filled = Math.min(capacity, Number(q.filled) || 0);
                const remaining = Math.max(0, capacity - filled);
                const classFillPct = Math.min(100, Math.round((filled / capacity) * 100));

                return (
                  <div
                    key={q.id || idx}
                    className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 hover:border-slate-600 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-extrabold text-white text-base">
                          {q.className || `Kelas 7-${String.fromCharCode(65 + idx)}`}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {q.homeroomTeacher ? `Wali: ${q.homeroomTeacher}` : q.level || 'Kelas 7'}
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        remaining === 0 
                          ? 'bg-rose-950 text-rose-300 border border-rose-800' 
                          : remaining <= 5 
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}>
                        {remaining === 0 ? 'Penuh' : `Sisa ${remaining}`}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-300 font-medium">
                        <span>Kapasitas: {capacity}</span>
                        <span className="text-emerald-400 font-bold">{filled} Terisi</span>
                      </div>
                      <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                          style={{ width: `${Math.max(5, classFillPct)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
