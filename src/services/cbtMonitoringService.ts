import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../utils/supabaseClient';
import {
  StudentData,
  CbtMonitoringStatus,
  CbtHeartbeatPayload,
  CbtActivityLogItem,
  CbtParticipantLiveStatus,
  CbtLiveMonitoringSummary,
  CbtHasilUjian,
} from '../types';
import { generateUUID } from '../utils/uuid';

// =====================================================================
// KONFIGURASI TERPUSAT MONITORING CBT (CENTRALIZED CONFIG)
// =====================================================================
export const CBT_MONITORING_CONFIG = {
  // Threshold Status Online / Offline sesuai instruksi sistem:
  // 🟢 AKTIF: Heartbeat < 60 detik
  ACTIVE_THRESHOLD_SEC: 60,
  // 🟡 TIDAK AKTIF: Heartbeat 60 - 120 detik
  INACTIVE_THRESHOLD_SEC: 120,
  // 🔴 TERPUTUS: Heartbeat > 120 detik
  DISCONNECTED_THRESHOLD_SEC: 120,
  // Interval pengiriman Heartbeat peserta (15 - 30 detik)
  HEARTBEAT_INTERVAL_MS: 18000,
  // Interval fallback polling admin
  POLLING_FALLBACK_INTERVAL_MS: 5000,
  // Batas toleransi tanpa heartbeat sebelum ditandai perlu diperiksa (120 detik)
  ATTENTION_INACTIVE_SEC: 120,
  // Maksimal log aktivitas disimpan per peserta
  MAX_ACTIVITIES_PER_USER: 40,
};

// State key template pada tabel spmb_app_state
const getSessionsStateKey = (examId: string) => `cbt_sessions_${examId}`;
const getActivitiesStateKey = (examId: string) => `cbt_activities_${examId}`;

export interface MonitoringChannelCallbacks {
  onHeartbeat?: (heartbeat: CbtHeartbeatPayload) => void;
  onActivity?: (activity: CbtActivityLogItem) => void;
  onDbChange?: (table: string, payload: any) => void;
  onStatusChange?: (status: 'connected' | 'polling' | 'error') => void;
}

// Memory cache untuk optimasi pengiriman dan rendering
const activeSessionsCache: Record<string, Record<string, CbtHeartbeatPayload>> = {};
const activeActivitiesCache: Record<string, CbtActivityLogItem[]> = {};

/**
 * Format Countdown Timer: HH:MM:SS atau MM:SS
 */
export function formatCountdownTimer(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Format Waktu Terakhir Aktif (Relative & Timestamp)
 */
export function formatLastSeen(isoDate: string | null): { timeStr: string; relativeStr: string; secondsAgo: number } {
  if (!isoDate) {
    return { timeStr: '-', relativeStr: 'Belum terdeteksi', secondsAgo: 999999 };
  }

  const d = new Date(isoDate);
  if (isNaN(d.getTime())) {
    return { timeStr: '-', relativeStr: 'Waktu tidak valid', secondsAgo: 999999 };
  }

  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - d.getTime()) / 1000));
  const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  let relativeStr = '';
  if (diffSec < 5) relativeStr = 'Baru saja';
  else if (diffSec < 60) relativeStr = `${diffSec} dtk lalu`;
  else if (diffSec < 3600) relativeStr = `${Math.floor(diffSec / 60)} mnt lalu`;
  else relativeStr = `${Math.floor(diffSec / 3600)} jam lalu`;

  return { timeStr, relativeStr, secondsAgo: diffSec };
}

/**
 * Evaluasi status peserta berdasarkan timestamp heartbeat dan status ujian
 */
export function determineParticipantStatus(params: {
  isSubmitted: boolean;
  hasStarted: boolean;
  lastSeenAt: string | null;
}): CbtMonitoringStatus {
  const { isSubmitted, hasStarted, lastSeenAt } = params;

  if (isSubmitted) {
    return 'SELESAI';
  }

  if (!hasStarted || !lastSeenAt) {
    return 'BELUM_MULAI';
  }

  const { secondsAgo } = formatLastSeen(lastSeenAt);

  if (secondsAgo < CBT_MONITORING_CONFIG.ACTIVE_THRESHOLD_SEC) {
    return 'AKTIF';
  }

  if (secondsAgo <= CBT_MONITORING_CONFIG.INACTIVE_THRESHOLD_SEC) {
    return 'TIDAK_AKTIF';
  }

  return 'TERPUTUS';
}

// =====================================================================
// 1. SUPABASE REALTIME SUBSCRIPTION
// =====================================================================

let activeMonitoringChannel: RealtimeChannel | null = null;
let currentExamChannelId: string | null = null;

// Channel khusus pengiriman broadcast peserta
let participantChannel: RealtimeChannel | null = null;
let participantExamId: string | null = null;

export function getOrCreateParticipantChannel(examId: string): RealtimeChannel {
  if (participantChannel && participantExamId === examId) {
    return participantChannel;
  }
  if (participantChannel) {
    try {
      supabase.removeChannel(participantChannel);
    } catch {}
  }
  participantExamId = examId;
  participantChannel = supabase.channel(`cbt-live-room-${examId}`, {
    config: { broadcast: { ack: false, self: false } },
  });
  participantChannel.subscribe();
  return participantChannel;
}

/**
 * Inisialisasi Supabase Realtime Channel untuk Monitoring Ujian
 */
export function subscribeToCbtMonitoringChannel(
  examId: string,
  callbacks: MonitoringChannelCallbacks
): () => void {
  // Bersihkan channel sebelumnya jika berbeda
  if (activeMonitoringChannel) {
    supabase.removeChannel(activeMonitoringChannel);
    activeMonitoringChannel = null;
    currentExamChannelId = null;
  }

  currentExamChannelId = examId;
  const channelName = `cbt-live-room-${examId}`;

  const channel = supabase.channel(channelName, {
    config: {
      broadcast: { ack: true, self: false },
      presence: { key: examId },
    },
  });

  // 1. Listen Broadcast Heartbeat
  channel.on('broadcast', { event: 'heartbeat' }, ({ payload }) => {
    if (payload && payload.participant_id) {
      if (!activeSessionsCache[examId]) activeSessionsCache[examId] = {};
      activeSessionsCache[examId][payload.participant_id] = payload;
      if (!activeSessionsCache['GLOBAL']) activeSessionsCache['GLOBAL'] = {};
      activeSessionsCache['GLOBAL'][payload.participant_id] = payload;
      callbacks.onHeartbeat?.(payload);
    }
  });

  // 2. Listen Broadcast Activity Log
  channel.on('broadcast', { event: 'activity' }, ({ payload }) => {
    if (payload && payload.participantId) {
      if (!activeActivitiesCache[examId]) activeActivitiesCache[examId] = [];
      activeActivitiesCache[examId].unshift(payload);
      if (activeActivitiesCache[examId].length > 200) {
        activeActivitiesCache[examId].pop();
      }
      callbacks.onActivity?.(payload);
    }
  });

  // 3. Listen Postgres Changes pada jawaban_peserta dan hasil_ujian
  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'jawaban_peserta' },
    (payload) => {
      callbacks.onDbChange?.('jawaban_peserta', payload);
    }
  );

  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'hasil_ujian' },
    (payload) => {
      callbacks.onDbChange?.('hasil_ujian', payload);
    }
  );

  // 4. Listen Postgres Changes pada students (status ujian, submit)
  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'students' },
    (payload) => {
      callbacks.onDbChange?.('students', payload);
    }
  );

  // 5. Listen Postgres Changes pada spmb_app_state (SSOT backup)
  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'spmb_app_state' },
    (payload) => {
      callbacks.onDbChange?.('spmb_app_state', payload);
    }
  );

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      callbacks.onStatusChange?.('connected');
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      callbacks.onStatusChange?.('polling');
    }
  });

  activeMonitoringChannel = channel;

  return () => {
    if (activeMonitoringChannel) {
      supabase.removeChannel(activeMonitoringChannel);
      activeMonitoringChannel = null;
      currentExamChannelId = null;
    }
  };
}

// =====================================================================
// 2. PESERTA: KIRIM HEARTBEAT KE SUPABASE
// =====================================================================

let lastSentHeartbeatTime = 0;

/**
 * Mengirim Heartbeat Peserta secara efisien ke Supabase Realtime & Database SSOT
 */
export async function sendCbtHeartbeatSupabase(heartbeat: CbtHeartbeatPayload): Promise<boolean> {
  const now = Date.now();
  // Hindari spam heartbeat berlebihan (< 1.5 detik)
  if (now - lastSentHeartbeatTime < 1500) {
    return true;
  }
  lastSentHeartbeatTime = now;

  const examId = heartbeat.exam_id;
  const participantId = heartbeat.participant_id;

  // Update memory cache
  if (!activeSessionsCache[examId]) activeSessionsCache[examId] = {};
  activeSessionsCache[examId][participantId] = heartbeat;
  if (!activeSessionsCache['GLOBAL']) activeSessionsCache['GLOBAL'] = {};
  activeSessionsCache['GLOBAL'][participantId] = heartbeat;

  // 1. Broadcast langsung melalui Supabase Realtime Channel
  try {
    const ch = (activeMonitoringChannel && currentExamChannelId === examId)
      ? activeMonitoringChannel
      : getOrCreateParticipantChannel(examId);
    
    ch.send({
      type: 'broadcast',
      event: 'heartbeat',
      payload: heartbeat,
    });
  } catch (err) {
    console.warn('Realtime broadcast heartbeat error:', err);
  }

  // 2. Fallback sync via backend Express route (aman concurrency & merge SSOT)
  try {
    fetch('/api/cbt/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(heartbeat),
    }).catch(() => {});
  } catch {}

  // 3. Simpan secara persisten ke database Supabase (spmb_app_state) sebagai SSOT
  try {
    const key = getSessionsStateKey(examId);
    // Merge dengan cache
    const existing = { ...(activeSessionsCache[examId] || {}) };
    existing[participantId] = heartbeat;

    await Promise.all([
      supabase.from('spmb_app_state').upsert({
        key,
        payload: existing,
        updated_at: new Date().toISOString(),
      }),
      supabase.from('spmb_app_state').upsert({
        key: 'cbt_live_all_sessions',
        payload: { ...(activeSessionsCache['GLOBAL'] || {}), [participantId]: heartbeat },
        updated_at: new Date().toISOString(),
      }),
      // Pastikan status ujian di tabel students terupdate
      supabase.from('students').update({
        is_test_active: !heartbeat.isSubmitted && heartbeat.remaining_seconds > 0,
        test_submitted: Boolean(heartbeat.isSubmitted),
        updated_at: new Date().toISOString(),
      }).eq('id', participantId),
    ]);
  } catch (err) {
    console.warn('Persist heartbeat to Supabase state notice:', err);
  }

  return true;
}

// =====================================================================
// 3. CATAT EVENT / LOG AKTIVITAS PESERTA
// =====================================================================

/**
 * Mencatat log aktivitas peserta (misal: buka soal, simpan jawaban, tab switch, offline/online)
 */
export async function recordCbtActivityLogSupabase(activity: Omit<CbtActivityLogItem, 'id' | 'timestamp'> & {
  id?: string;
  timestamp?: string;
}): Promise<boolean> {
  const examId = activity.examId;
  const fullItem: CbtActivityLogItem = {
    id: activity.id || `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    examId: activity.examId,
    participantId: activity.participantId,
    participantName: activity.participantName,
    eventType: activity.eventType,
    title: activity.title,
    description: activity.description,
    questionNumber: activity.questionNumber,
    timestamp: activity.timestamp || new Date().toISOString(),
    isSuspicious: Boolean(activity.isSuspicious),
  };

  // Update memory cache
  if (!activeActivitiesCache[examId]) activeActivitiesCache[examId] = [];
  activeActivitiesCache[examId].unshift(fullItem);
  if (activeActivitiesCache[examId].length > 200) {
    activeActivitiesCache[examId].pop();
  }

  // 1. Broadcast via Realtime Channel
  try {
    const ch = (activeMonitoringChannel && currentExamChannelId === examId)
      ? activeMonitoringChannel
      : getOrCreateParticipantChannel(examId);

    ch.send({
      type: 'broadcast',
      event: 'activity',
      payload: fullItem,
    });
  } catch {}

  // 2. Sync to Express API
  try {
    fetch('/api/cbt/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullItem),
    }).catch(() => {});
  } catch {}

  // 3. Persist to Supabase Database spmb_app_state
  try {
    const key = getActivitiesStateKey(examId);
    const existingList = activeActivitiesCache[examId] || [];
    const capped = existingList.slice(0, 150);

    await supabase.from('spmb_app_state').upsert({
      key,
      payload: capped,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Persist activity log to Supabase notice:', err);
  }

  return true;
}

// =====================================================================
// 4. PANITIA / ADMIN: LOAD DATA MONITORING LENGKAP DARI SUPABASE
// =====================================================================

export async function fetchCbtLiveMonitoringFromSupabase(
  examId: string,
  allStudents: StudentData[],
  totalExamQuestions: number = 30
): Promise<{
  participants: CbtParticipantLiveStatus[];
  summary: CbtLiveMonitoringSummary;
  isFromSupabase: boolean;
}> {
  let isFromSupabase = false;
  const isGlobalExam = !examId || examId === 'ALL' || examId === 'ALL_EXAMS';

  // 1. Fetch Hasil Ujian (Submit status & scores)
  let hasilMap: Record<string, CbtHasilUjian> = {};
  try {
    let query = supabase.from('hasil_ujian').select('*');
    if (!isGlobalExam) {
      query = query.eq('ujian_id', examId);
    }
    const { data: hasilData, error: hasilErr } = await query;

    if (!hasilErr && hasilData) {
      isFromSupabase = true;
      hasilData.forEach((row: any) => {
        hasilMap[row.peserta_id] = {
          id: row.id,
          ujianId: row.ujian_id,
          pesertaId: row.peserta_id,
          registrationNumber: row.registration_number || '',
          namaPeserta: row.nama_peserta || '',
          nilaiDiagnostik: Number(row.nilai_diagnostik || 0),
          nilaiTpu: Number(row.nilai_tpu || 0),
          nilaiDiniyyah: Number(row.nilai_diniyyah || 0),
          nilaiTotal: Number(row.nilai_akhir ?? row.nilai_total ?? 0),
          statusKelulusan: row.status_kelulusan === 'LULUS' ? 'LULUS' : 'BELUM LULUS',
          tanggalUjian: row.waktu_selesai || row.tanggal_ujian || row.created_at,
        };
      });
    }
  } catch (err) {
    console.warn('Failed fetching hasil_ujian from Supabase:', err);
  }

  // 2. Fetch Jawaban Peserta Count (Jawaban terisi nyata per peserta)
  let answersCountMap: Record<string, number> = {};
  let doubtfulCountMap: Record<string, number> = {};
  try {
    let query = supabase.from('jawaban_peserta').select('peserta_id, jawaban_dipilih, is_ragu');
    if (!isGlobalExam) {
      query = query.eq('ujian_id', examId);
    }
    const { data: ansData, error: ansErr } = await query;

    if (!ansErr && ansData) {
      isFromSupabase = true;
      ansData.forEach((row: any) => {
        const pId = row.peserta_id;
        if (row.jawaban_dipilih) {
          answersCountMap[pId] = (answersCountMap[pId] || 0) + 1;
        }
        if (row.is_ragu) {
          doubtfulCountMap[pId] = (doubtfulCountMap[pId] || 0) + 1;
        }
      });
    }
  } catch (err) {
    console.warn('Failed fetching jawaban_peserta counts:', err);
  }

  // 3. Fetch Heartbeats Sessions dari spmb_app_state (Exam Session + Global Sessions)
  let liveSessions: Record<string, CbtHeartbeatPayload> = {};
  try {
    const keysToFetch = isGlobalExam
      ? ['cbt_live_all_sessions']
      : [getSessionsStateKey(examId), 'cbt_live_all_sessions'];

    const { data: stateRows, error: stateErr } = await supabase
      .from('spmb_app_state')
      .select('key, payload')
      .in('key', keysToFetch);

    if (!stateErr && stateRows && stateRows.length > 0) {
      isFromSupabase = true;
      stateRows.forEach((row) => {
        if (row.payload && typeof row.payload === 'object') {
          liveSessions = { ...liveSessions, ...row.payload };
        }
      });
      activeSessionsCache[examId] = liveSessions;
      activeSessionsCache['GLOBAL'] = { ...(activeSessionsCache['GLOBAL'] || {}), ...liveSessions };
    } else if (activeSessionsCache[examId] || activeSessionsCache['GLOBAL']) {
      liveSessions = { ...(activeSessionsCache['GLOBAL'] || {}), ...(activeSessionsCache[examId] || {}) };
    }
  } catch (err) {
    if (activeSessionsCache[examId] || activeSessionsCache['GLOBAL']) {
      liveSessions = { ...(activeSessionsCache['GLOBAL'] || {}), ...(activeSessionsCache[examId] || {}) };
    }
  }

  // 4. Fallback ambil dari Express API live
  try {
    const apiPath = isGlobalExam ? '/api/cbt/live-all' : `/api/cbt/live/${examId}`;
    const apiRes = await fetch(apiPath);
    if (apiRes.ok) {
      const json = await apiRes.json();
      if (json.sessions && typeof json.sessions === 'object') {
        liveSessions = { ...liveSessions, ...json.sessions };
      }
    }
  } catch {}

  // 5. Fetch Activity Logs dari spmb_app_state
  let activityLogs: CbtActivityLogItem[] = [];
  try {
    const { data: actData, error: actErr } = await supabase
      .from('spmb_app_state')
      .select('payload')
      .eq('key', isGlobalExam ? 'cbt_activities_29ead736-1ef5-4c3e-b287-05ad404c0d9f' : getActivitiesStateKey(examId))
      .maybeSingle();

    if (!actErr && Array.isArray(actData?.payload)) {
      isFromSupabase = true;
      activityLogs = actData.payload;
      activeActivitiesCache[examId] = activityLogs;
    } else if (activeActivitiesCache[examId]) {
      activityLogs = activeActivitiesCache[examId];
    }
  } catch (err) {
    if (activeActivitiesCache[examId]) {
      activityLogs = activeActivitiesCache[examId];
    }
  }

  // Petakan activity logs per peserta
  const activitiesByParticipant: Record<string, CbtActivityLogItem[]> = {};
  activityLogs.forEach((act) => {
    if (!activitiesByParticipant[act.participantId]) {
      activitiesByParticipant[act.participantId] = [];
    }
    activitiesByParticipant[act.participantId].push(act);
  });

  // 6. Susun Peserta & Evaluasi Status Live Tiap Calon Murid
  const participants: CbtParticipantLiveStatus[] = allStudents.map((std) => {
    const pId = std.id;
    const session = liveSessions[pId] || liveSessions[std.registrationNumber] || (activeSessionsCache[examId] ? activeSessionsCache[examId][pId] : undefined);
    
    // Hasil ujian dari tabel hasil_ujian atau dari student object
    const hasil = hasilMap[pId] || (std.finalScore !== undefined ? {
      id: `hasil_${pId}`,
      ujianId: examId,
      pesertaId: pId,
      registrationNumber: std.registrationNumber || '',
      namaPeserta: std.fullName || '',
      nilaiDiagnostik: std.diagnosticScore || 0,
      nilaiTpu: std.generalScore || 0,
      nilaiDiniyyah: std.religiousScore || 0,
      nilaiTotal: std.finalScore || 0,
      statusKelulusan: (std.finalScore || 0) >= 70 ? 'LULUS' : 'BELUM LULUS',
      tanggalUjian: std.updatedAt || new Date().toISOString(),
    } : undefined);

    const userActivities = activitiesByParticipant[pId] || [];

    const isSubmitted = Boolean(
      hasil ||
      std.testSubmitted === true ||
      std.status === 'test_completed' ||
      session?.isSubmitted ||
      (session?.connection_status === 'offline' && session?.remaining_seconds === 0)
    );

    const hasStarted = Boolean(
      session ||
      hasil ||
      std.isTestActive === true ||
      (answersCountMap[pId] || 0) > 0
    );

    const answeredCount = Math.max(
      answersCountMap[pId] || 0,
      session?.answered_count || 0
    );

    const totalQuestions = session?.total_questions || totalExamQuestions || 20;
    const progressPercentage = Math.min(100, Math.round((answeredCount / totalQuestions) * 100));

    // Sisa Waktu Detik
    let remainingSeconds = session?.remaining_seconds ?? (90 * 60);
    if (session?.server_end_time) {
      const msLeft = new Date(session.server_end_time).getTime() - Date.now();
      remainingSeconds = Math.max(0, Math.floor(msLeft / 1000));
    }
    if (isSubmitted) {
      remainingSeconds = 0;
    }

    const lastSeenAt = session?.last_seen_at || (hasil ? hasil.tanggalUjian : (std.isTestActive ? std.updatedAt || new Date().toISOString() : null));

    let status: CbtMonitoringStatus;
    if (isSubmitted) {
      status = 'SELESAI';
    } else if (!hasStarted) {
      status = 'BELUM_MULAI';
    } else {
      if (lastSeenAt) {
        const { secondsAgo } = formatLastSeen(lastSeenAt);
        if (secondsAgo < CBT_MONITORING_CONFIG.ACTIVE_THRESHOLD_SEC) {
          status = 'AKTIF';
        } else if (secondsAgo <= CBT_MONITORING_CONFIG.INACTIVE_THRESHOLD_SEC) {
          status = 'TIDAK_AKTIF';
        } else {
          status = 'TERPUTUS';
        }
      } else if (std.isTestActive) {
        status = 'AKTIF';
      } else {
        status = 'BELUM_MULAI';
      }
    }

    // Deteksi Technical Attention / Perlu Diperiksa
    const attentionReasons: string[] = [];

    // Alasan 1: Sesi terputus / tanpa heartbeat > 2 menit tapi belum selesai
    if (hasStarted && !isSubmitted) {
      if (lastSeenAt) {
        const { secondsAgo } = formatLastSeen(lastSeenAt);
        if (secondsAgo > CBT_MONITORING_CONFIG.ATTENTION_INACTIVE_SEC) {
          attentionReasons.push(`Tidak ada heartbeat selama ${Math.floor(secondsAgo / 60)} menit`);
        }
      }
    }

    // Alasan 2: Reconnect jaringan berulang
    const reconnectCount = userActivities.filter((a) => a.eventType === 'network_reconnect' || a.eventType === 'network_offline').length;
    if (reconnectCount >= 2) {
      attentionReasons.push(`Terjadi kendala koneksi/reconnect ${reconnectCount} kali`);
    }

    // Alasan 3: Tab switch / Window blur terdeteksi
    const blurCount = userActivities.filter((a) => a.eventType === 'window_blur' || a.eventType === 'tab_switch').length;
    if (blurCount >= 1) {
      attentionReasons.push(`Terdeteksi perpindahan jendela/tab ${blurCount} kali`);
    }

    // Alasan 4: Penyimpanan jawaban gagal
    const failCount = userActivities.filter((a) => a.eventType === 'save_failed').length;
    if (failCount >= 1) {
      attentionReasons.push(`Penyimpanan jawaban sempat gagal ${failCount} kali`);
    }

    const needsAttention = attentionReasons.length > 0;

    return {
      participantId: pId,
      registrationNumber: std.registrationNumber || hasil?.registrationNumber || 'REG-SPMB',
      fullName: std.fullName || hasil?.namaPeserta || 'Calon Murid',
      gender: (std.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki'),
      examId,
      status,
      progressPercentage,
      answeredCount,
      totalQuestions,
      currentQuestionNumber: session?.current_question || (answeredCount > 0 ? answeredCount : 1),
      remainingSeconds,
      lastSeenAt,
      serverStartTime: session?.server_start_time || null,
      serverEndTime: session?.server_end_time || null,
      isSubmitted,
      score: hasil?.nilaiTotal ?? std.finalScore,
      needsAttention,
      attentionReasons,
      recentActivities: userActivities,
      connectionStatus: (session?.connection_status as any) || (status === 'AKTIF' ? 'online' : 'offline'),
      doubtfulCount: doubtfulCountMap[pId] || 0,
    };
  });

  // 7. Hitung Summary Statistik
  const totalParticipants = participants.length;
  const activeCount = participants.filter((p) => p.status === 'AKTIF').length;
  const notStartedCount = participants.filter((p) => p.status === 'BELUM_MULAI').length;
  const finishedCount = participants.filter((p) => p.status === 'SELESAI').length;
  const inactiveCount = participants.filter((p) => p.status === 'TIDAK_AKTIF').length;
  const disconnectedCount = participants.filter((p) => p.status === 'TERPUTUS').length;
  const needsAttentionCount = participants.filter((p) => p.needsAttention).length;

  const summary: CbtLiveMonitoringSummary = {
    examId,
    examName: isGlobalExam ? 'Semua Ujian Aktif (Global Live)' : 'Ujian CBT Online',
    totalParticipants,
    activeCount,
    notStartedCount,
    finishedCount,
    inactiveCount,
    disconnectedCount,
    needsAttentionCount,
    connectionQuality: isFromSupabase ? 'connected' : 'polling',
    lastUpdated: new Date().toISOString(),
  };

  return { participants, summary, isFromSupabase };
}

// =====================================================================
// 5. DETAIL JAWABAN PESERTA DARI SUPABASE
// =====================================================================

export async function fetchParticipantDetailedAnswers(
  examId: string,
  participantId: string
): Promise<Array<{
  soalId: string;
  jawabanDipilih?: string;
  jawabanIndex?: number;
  isRagu: boolean;
  updatedAt?: string;
}>> {
  try {
    let query = supabase
      .from('jawaban_peserta')
      .select('soal_id, jawaban_dipilih, is_ragu, updated_at')
      .eq('peserta_id', participantId);

    if (examId && examId !== 'ALL' && examId !== 'ALL_EXAMS') {
      query = query.eq('ujian_id', examId);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    const LETTER_TO_IDX: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

    return data.map((row) => ({
      soalId: row.soal_id,
      jawabanDipilih: row.jawaban_dipilih || undefined,
      jawabanIndex: row.jawaban_dipilih ? LETTER_TO_IDX[row.jawaban_dipilih.toUpperCase()] : undefined,
      isRagu: Boolean(row.is_ragu),
      updatedAt: row.updated_at,
    }));
  } catch (err) {
    console.warn('fetchParticipantDetailedAnswers error:', err);
    return [];
  }
}
