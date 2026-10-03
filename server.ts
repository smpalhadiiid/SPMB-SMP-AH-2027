import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =====================================================================
// KONFIGURASI EXPRESS & PORT
// =====================================================================
const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =====================================================================
// KEAMANAN: RESTRIKSI CORS BERBASIS ALLOWED_ORIGINS
// Tidak mengizinkan Access-Control-Allow-Origin: * sembarangan
// =====================================================================
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '';
const configuredOrigins = allowedOriginsEnv
  ? allowedOriginsEnv.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  : [];

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  if (origin) {
    const originLower = origin.toLowerCase();
    const isLocalhost =
      originLower.includes('localhost:3000') ||
      originLower.includes('127.0.0.1:3000') ||
      originLower.startsWith('http://localhost') ||
      originLower.startsWith('http://127.0.0.1');

    const isExplicitlyAllowed = configuredOrigins.length > 0 && configuredOrigins.includes(originLower);

    // Diizinkan jika origin localhost/staging atau ada di daftar ALLOWED_ORIGINS
    if (isLocalhost || isExplicitlyAllowed || configuredOrigins.length === 0) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-client-info, apikey');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// =====================================================================
// RATE LIMITER SEDERHANA (IN-MEMORY TOKEN BUCKET PER IP)
// =====================================================================
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 menit
const MAX_REQUESTS_PER_WINDOW = 120;

function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      success: false,
      error: 'Too Many Requests',
      message: 'Batas permintaan tercapai. Silakan coba kembali beberapa saat lagi.',
    });
  }

  record.count++;
  next();
}

app.use('/api', rateLimiter);

// =====================================================================
// KONFIGURASI SUPABASE SERVER-SIDE
// =====================================================================
function sanitizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim().split(/\s+/)[0];
  url = url.replace(/\/rest\/v1\/?$/, '');
  url = url.replace(/\/+$/, '');
  return url;
}

const rawServerUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const rawServerKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

const OFFICIAL_SUPABASE_URL = 'https://fjscuokehikwhungyvll.supabase.co';
const OFFICIAL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqc2N1b2tlaGlrd2h1bmd5dmxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MTQ3NzMsImV4cCI6MjEwMTE5MDc3M30.IPCIdcYcVtDSpF2mJN-4nXf7urb71ZsdsZXWQzs8Ei4';

const cleanedServerUrl = sanitizeSupabaseUrl(rawServerUrl);
const supabaseUrl = (cleanedServerUrl && !cleanedServerUrl.includes('placeholder')) ? cleanedServerUrl : OFFICIAL_SUPABASE_URL;
const supabaseKey = (rawServerKey && !rawServerKey.includes('placeholder') && rawServerKey !== 'your-anon-key') ? rawServerKey : OFFICIAL_SUPABASE_ANON_KEY;

let supabaseServer: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (supabaseServer) return supabaseServer;
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder') || supabaseKey.includes('placeholder')) {
    return null;
  }
  try {
    supabaseServer = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return supabaseServer;
  } catch (err) {
    console.error('Inisialisasi Supabase Server gagal:', err);
    return null;
  }
}

// =====================================================================
// MIDDLEWARE AUTENTIKASI & OTORISASI (JWT & RBAC)
// =====================================================================
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  studentId?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Akses ditolak: Bearer token autentikasi tidak ditemukan pada header Authorization.',
    });
  }

  const token = authHeader.split(' ')[1];
  const sb = getSupabase();
  if (!sb) {
    return res.status(503).json({
      success: false,
      error: 'Service Unavailable',
      message: 'Koneksi database Supabase belum terkonfigurasi.',
    });
  }

  try {
    const { data: { user }, error } = await sb.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Token autentikasi tidak valid atau sudah kedaluwarsa.',
      });
    }

    // Role default dari user metadata
    let role = user.user_metadata?.role || 'student';
    let studentId: string | undefined;

    // Sinkronisasi role dengan tabel relasional public.users
    const { data: profile } = await sb
      .from('users')
      .select('role, registration_number')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (profile?.role) {
      role = profile.role;
    }

    if (role === 'student') {
      const { data: studentRecord } = await sb
        .from('students')
        .select('id')
        .ilike('user_email', user.email || '')
        .maybeSingle();

      if (studentRecord) {
        studentId = studentRecord.id;
      }
    }

    req.user = {
      id: user.id,
      email: user.email || '',
      role,
      studentId,
    };

    next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Gagal memverifikasi token pengguna.',
    });
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Autentikasi diperlukan sebelum pemeriksaan otorisasi.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `Hak akses ditolak. Endpoint ini membutuhkan peran: ${allowedRoles.join(', ')}. Peran Anda: ${req.user.role}.`,
      });
    }

    next();
  };
}

// =====================================================================
// API ROUTES: KONEKSI & HEALTH CHECK (PUBLIC)
// =====================================================================

// 1. Health check dasar
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'SPMB SMP Al-Hadiid API Server',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
  });
});

// 2. Status koneksi Supabase & latency check (Public diagnostic)
app.get('/api/supabase/status', async (_req: Request, res: Response) => {
  const sb = getSupabase();
  if (!sb) {
    return res.json({
      configured: false,
      connected: false,
      message: 'Supabase URL atau Key belum dikonfigurasi di environment (.env).',
      projectUrl: null,
      latencyMs: null,
      timestamp: new Date().toISOString(),
    });
  }

  const startTime = Date.now();
  try {
    const { error } = await sb.from('spmb_app_state').select('key').limit(1);
    const latencyMs = Date.now() - startTime;

    if (error && error.code !== 'PGRST116') {
      return res.json({
        configured: true,
        connected: false,
        message: `Koneksi Supabase terdeteksi tetapi query error: ${error.message}`,
        latencyMs,
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      configured: true,
      connected: true,
      message: 'Berhasil terhubung ke database Supabase secara real-time.',
      latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({
      configured: true,
      connected: false,
      message: 'Gagal menghubungi server database Supabase.',
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  }
});

// =====================================================================
// API ROUTES: DATA SISWA (STUDENTS) - TERLINDUNGI RBAC & SSOT
// =====================================================================

// GET /api/students: Ambil daftar calon murid
// Hanya diizinkan untuk Admin, Super Admin, dan Kepala Sekolah (Kepsek)
app.get(
  '/api/students',
  requireAuth,
  requireRole('admin', 'super_admin', 'kepsek'),
  async (req: AuthenticatedRequest, res: Response) => {
    const sb = getSupabase();
    if (!sb) return res.status(503).json({ success: false, message: 'Database belum terkonfigurasi.' });

    try {
      const { search, status, limit = '100', offset = '0' } = req.query;
      const parsedLimit = Math.min(Math.max(1, parseInt(String(limit), 10) || 100), 1000);
      const parsedOffset = Math.max(0, parseInt(String(offset), 10) || 0);

      let query = sb.from('students').select('*', { count: 'exact' });

      if (status && typeof status === 'string' && status !== 'all') {
        query = query.eq('status', status);
      }
      if (search && typeof search === 'string' && search.trim()) {
        const q = search.trim();
        query = query.or(`full_name.ilike.%${q}%,registration_number.ilike.%${q}%,user_email.ilike.%${q}%`);
      }

      const { data, count, error } = await query
        .range(parsedOffset, parsedOffset + parsedLimit - 1)
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ success: false, error: 'QueryError', message: error.message });
      }

      return res.json({
        success: true,
        source: 'table:public.students',
        total: count ?? (data?.length || 0),
        data: data || [],
        offset: parsedOffset,
        limit: parsedLimit,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'InternalServerError', message: 'Terjadi kesalahan pada server.' });
    }
  }
);

// GET /api/students/:id: Ambil detail 1 siswa
// Admin/Kepsek dapat melihat semua; Siswa hanya dapat melihat miliknya sendiri
app.get('/api/students/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const sb = getSupabase();
  if (!sb) return res.status(503).json({ success: false, message: 'Database belum terkonfigurasi.' });

  const id = req.params.id;
  const user = req.user!;

  try {
    const { data: student, error } = await sb
      .from('students')
      .select('*')
      .or(`id.eq.${id},registration_number.eq.${id}`)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    if (!student) {
      return res.status(404).json({ success: false, message: 'Data siswa tidak ditemukan.' });
    }

    // Otorisasi siswa: Siswa hanya dapat membaca datanya sendiri
    if (user.role === 'student') {
      const isOwner =
        student.id === user.studentId ||
        (student.user_email && student.user_email.toLowerCase() === user.email.toLowerCase());

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Akses ditolak: Anda hanya berwenang mengakses data pendaftaran Anda sendiri.',
        });
      }
    }

    return res.json({ success: true, data: student });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
  }
});

// POST /api/students: Tambah atau simpan pendaftaran siswa baru
app.post('/api/students', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const sb = getSupabase();
  if (!sb) return res.status(503).json({ success: false, message: 'Database belum terkonfigurasi.' });

  const payload = req.body;
  const user = req.user!;

  if (!payload || !payload.fullName) {
    return res.status(400).json({ success: false, message: 'Validasi gagal: Nama lengkap siswa wajib diisi.' });
  }

  try {
    let studentId = payload.id;
    if (!studentId || studentId.startsWith('std_00') || studentId === 'std_001') {
      studentId = `std_${Date.now()}`;
    }

    // Siswa hanya boleh membuat pendaftaran dengan email miliknya
    if (user.role === 'student' && payload.userEmail && payload.userEmail.toLowerCase() !== user.email.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: 'Email pendaftar harus sesuai dengan akun pengguna yang sedang aktif.',
      });
    }

    const { data, error } = await sb
      .from('students')
      .insert({
        id: studentId,
        registration_number: payload.registrationNumber || `REG-${Date.now().toString().slice(-6)}`,
        user_email: (payload.userEmail || user.email).toLowerCase(),
        full_name: payload.fullName,
        phone: payload.phone || '',
        status: payload.status || 'draft',
        birth_date: payload.birthDate || '2013-01-01',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ success: false, message: 'Nomor pendaftaran atau ID siswa sudah terdaftar.' });
      }
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.status(201).json({
      success: true,
      message: 'Pendaftaran siswa berhasil disimpan ke database.',
      data,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
  }
});

// DELETE /api/students/:id: Hapus siswa permanen (Hanya Admin / Super Admin)
// Memeriksa autentikasi, otorisasi, mencatat audit log
app.delete(
  '/api/students/:id',
  requireAuth,
  requireRole('admin', 'super_admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const sb = getSupabase();
    if (!sb) return res.status(503).json({ success: false, message: 'Database belum terkonfigurasi.' });

    const id = req.params.id;
    const user = req.user!;

    try {
      // 1. Panggil RPC aman delete_student_secure
      const { data: rpcRes, error: rpcErr } = await sb.rpc('delete_student_secure', {
        p_student_id: id,
      });

      if (!rpcErr && rpcRes?.success) {
        return res.json({
          success: true,
          message: rpcRes.message || `Siswa ${id} berhasil dihapus secara aman.`,
          details: rpcRes,
        });
      }

      // 2. Fallback transaksional jika RPC belum ter-apply di staging
      // Hapus data anak terlebih dahulu
      await sb.from('jawaban_peserta').delete().eq('peserta_id', id);
      await sb.from('hasil_ujian').delete().eq('peserta_id', id);
      await sb.from('payments').delete().eq('student_id', id);

      const { data: delResult, error: delErr } = await sb
        .from('students')
        .delete()
        .or(`id.eq.${id},registration_number.eq.${id}`)
        .select('id, registration_number, full_name');

      if (delErr) {
        return res.status(500).json({ success: false, message: delErr.message });
      }

      if (!delResult || delResult.length === 0) {
        return res.status(404).json({ success: false, message: 'Data siswa tidak ditemukan untuk dihapus.' });
      }

      // Hapus user terkait jika ada
      await sb.from('users').delete().eq('id', id);

      // Catat Audit Log
      await sb.from('audit_logs').insert({
        user_id: user.id,
        user_email: user.email,
        role: user.role,
        action: 'DELETE_STUDENT_PERMANENT',
        target_entity: 'students',
        target_id: id,
        details: { deleted_by: user.email, student_data: delResult[0], timestamp: new Date().toISOString() },
        created_at: new Date().toISOString(),
      });

      return res.json({
        success: true,
        message: `Siswa ${id} berhasil dihapus secara permanen dari database.`,
        deleted: delResult[0],
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat menghapus data siswa.' });
    }
  }
);

// =====================================================================
// API ROUTES: BANK SOAL UJIAN (CBT) - SSOT PUBLIC.SOAL
// =====================================================================

// GET /api/soal: Ambil bank soal
// Kunci jawaban (jawaban_benar) DISEMBUNYIKAN jika pemanggil bukan admin
app.get('/api/soal', async (req: Request, res: Response) => {
  const sb = getSupabase();
  if (!sb) return res.status(503).json({ success: false, message: 'Database belum terkonfigurasi.' });

  try {
    const { category } = req.query;

    // Periksa apakah request memiliki token admin yang sah
    let isAdmin = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user } } = await sb.auth.getUser(token);
      if (user) {
        const { data: profile } = await sb.from('users').select('role').eq('auth_user_id', user.id).maybeSingle();
        if (profile?.role === 'admin' || profile?.role === 'super_admin') {
          isAdmin = true;
        }
      }
    }

    let query = sb.from('soal').select('*').order('created_at', { ascending: false });

    if (category && typeof category === 'string') {
      query = query.eq('kategori_kode', category);
    }

    // Jika bukan admin, hanya ambil soal yang aktif
    if (!isAdmin) {
      query = query.eq('aktif', true);
    }

    const { data: soalData, error } = await query;
    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // SANITASI KEAMANAN: Jangan kirim jawaban_benar kepada peserta sebelum ujian selesai!
    const sanitizedQuestions = (soalData || []).map((q: any) => {
      if (isAdmin) return q;
      const { jawaban_benar, ...safeQuestion } = q;
      return safeQuestion;
    });

    return res.json({
      success: true,
      source: 'table:public.soal',
      total: sanitizedQuestions.length,
      data: sanitizedQuestions,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil bank soal.' });
  }
});

// POST /api/soal: Simpan soal (Hanya Admin / Super Admin)
app.post('/api/soal', requireAuth, requireRole('admin', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  const sb = getSupabase();
  if (!sb) return res.status(503).json({ success: false, message: 'Database belum terkonfigurasi.' });

  const payload = req.body;
  if (!payload) {
    return res.status(400).json({ success: false, message: 'Payload soal tidak boleh kosong.' });
  }

  try {
    const items = Array.isArray(payload) ? payload : [payload];
    const rows = items.map((q) => ({
      id: q.id || `soal_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      kategori_kode: q.kategori_kode || q.category || 'diagnostik',
      pertanyaan: q.pertanyaan || q.questionText || '',
      pilihan_a: q.pilihan_a ?? q.options?.[0] ?? '',
      pilihan_b: q.pilihan_b ?? q.options?.[1] ?? '',
      pilihan_c: q.pilihan_c ?? q.options?.[2] ?? '',
      pilihan_d: q.pilihan_d ?? q.options?.[3] ?? '',
      jawaban_benar: q.jawaban_benar ?? 'A',
      bobot: Number(q.bobot ?? q.points ?? 10),
      level_kesulitan: q.level_kesulitan || q.difficulty || 'medium',
      gambar_url: q.gambar_url || q.imageUrl || null,
      aktif: q.aktif !== undefined ? q.aktif : true,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await sb.from('soal').upsert(rows, { onConflict: 'id' }).select();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({
      success: true,
      message: `${rows.length} soal berhasil disimpan ke tabel public.soal.`,
      count: data?.length || rows.length,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menyimpan soal.' });
  }
});

// =====================================================================
// API ROUTES: MONITORING LIVE UJIAN / CBT REAL-TIME
// =====================================================================

// POST /api/cbt/heartbeat: Menerima heartbeat berkala dari peserta ujian
app.post('/api/cbt/heartbeat', async (req: Request, res: Response) => {
  const sb = getSupabase();
  if (!sb) return res.status(503).json({ success: false, message: 'Database belum terkonfigurasi.' });

  const payload = req.body;
  if (!payload || !payload.exam_id || !payload.participant_id) {
    return res.status(400).json({ success: false, message: 'Data heartbeat tidak lengkap (exam_id & participant_id wajib).' });
  }

  try {
    const key = `cbt_sessions_${payload.exam_id}`;
    // Ambil sesi existing untuk ujian ini
    const { data: existingRow } = await sb.from('spmb_app_state').select('payload').eq('key', key).maybeSingle();
    const sessions = (existingRow?.payload && typeof existingRow.payload === 'object') ? existingRow.payload : {};
    sessions[payload.participant_id] = {
      ...payload,
      last_seen_at: payload.last_seen_at || new Date().toISOString(),
    };

    await sb.from('spmb_app_state').upsert({
      key,
      payload: sessions,
      updated_at: new Date().toISOString(),
    });

    return res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Gagal memproses heartbeat' });
  }
});

// POST /api/cbt/activity: Catat aktivitas peserta ujian (buka soal, simpan jawaban, tab switch, dsb)
app.post('/api/cbt/activity', async (req: Request, res: Response) => {
  const sb = getSupabase();
  if (!sb) return res.status(503).json({ success: false, message: 'Database belum terkonfigurasi.' });

  const activity = req.body;
  if (!activity || !activity.examId || !activity.participantId) {
    return res.status(400).json({ success: false, message: 'Data aktivitas tidak valid.' });
  }

  try {
    const key = `cbt_activities_${activity.examId}`;
    const { data: existingRow } = await sb.from('spmb_app_state').select('payload').eq('key', key).maybeSingle();
    const list: any[] = Array.isArray(existingRow?.payload) ? existingRow.payload : [];
    list.unshift({
      ...activity,
      id: activity.id || `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: activity.timestamp || new Date().toISOString(),
    });

    // Batasi list maksimal 150 log terbaru
    const capped = list.slice(0, 150);
    await sb.from('spmb_app_state').upsert({
      key,
      payload: capped,
      updated_at: new Date().toISOString(),
    });

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Gagal menyimpan aktivitas' });
  }
});

// GET /api/cbt/live/:examId: Ambil status live monitoring dari database Supabase
app.get('/api/cbt/live/:examId', async (req: Request, res: Response) => {
  const sb = getSupabase();
  if (!sb) return res.status(503).json({ success: false, message: 'Database belum terkonfigurasi.' });

  const { examId } = req.params;
  try {
    const sessionsKey = `cbt_sessions_${examId}`;
    const activitiesKey = `cbt_activities_${examId}`;

    const [sessionsRes, activitiesRes, hasilRes] = await Promise.all([
      sb.from('spmb_app_state').select('payload').eq('key', sessionsKey).maybeSingle(),
      sb.from('spmb_app_state').select('payload').eq('key', activitiesKey).maybeSingle(),
      sb.from('hasil_ujian').select('*').eq('ujian_id', examId),
    ]);

    return res.json({
      success: true,
      sessions: sessionsRes.data?.payload || {},
      activities: activitiesRes.data?.payload || [],
      hasilList: hasilRes.data || [],
      serverTime: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil data monitoring live.' });
  }
});

// =====================================================================
// API ROUTES: VERIFIKASI PEMBAYARAN - TERLINDUNGI & TERCATAT AUDIT LOG
// =====================================================================
app.post(
  '/api/payments/verify',
  requireAuth,
  requireRole('admin', 'super_admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const sb = getSupabase();
    if (!sb) return res.status(503).json({ success: false, message: 'Database belum terkonfigurasi.' });

    const { paymentId, status, notes } = req.body;
    if (!paymentId || !status || !['verified', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Validasi gagal: paymentId dan status (verified/rejected/pending) wajib diisi.',
      });
    }

    try {
      // Panggil RPC rpc_verify_payment
      const { data: rpcData, error: rpcError } = await sb.rpc('rpc_verify_payment', {
        p_payment_id: paymentId,
        p_status: status,
        p_notes: notes || null,
      });

      if (!rpcError && rpcData?.success) {
        return res.json({ success: true, message: 'Verifikasi pembayaran berhasil.', details: rpcData });
      }

      // Fallback update
      const { data: updatedPayment, error: updErr } = await sb
        .from('payments')
        .update({
          status,
          notes,
          verified_by: req.user!.email,
          verified_at: status === 'verified' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId)
        .select()
        .single();

      if (updErr) {
        return res.status(500).json({ success: false, message: updErr.message });
      }

      // Catat Audit Log
      await sb.from('audit_logs').insert({
        user_id: req.user!.id,
        user_email: req.user!.email,
        role: req.user!.role,
        action: 'VERIFY_PAYMENT',
        target_entity: 'payments',
        target_id: paymentId,
        details: { status, notes, verified_by: req.user!.email },
        created_at: new Date().toISOString(),
      });

      return res.json({ success: true, message: 'Pembayaran berhasil diverifikasi.', data: updatedPayment });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Gagal memverifikasi pembayaran.' });
    }
  }
);

// =====================================================================
// API ROUTES: KUOTA KELAS (TABEL RELASIONAL public.class_quotas)
// =====================================================================

const DEPRECATED_CLASS_NAMES = [
  '7 A (Tahfizh Unggulan)',
  '7 B (Sains & Digital)',
  '7 C (Bilingual & International)',
  '7 D (Reguler Rabbani)',
];
const DEPRECATED_CLASS_IDS = ['q1', 'q2', 'q3', 'q4'];

// GET /api/class-quotas: Ambil daftar kuota kelas dari tabel relasional
app.get('/api/class-quotas', async (_req: Request, res: Response) => {
  const sb = getSupabase();
  if (!sb) return res.status(503).json({ success: false, message: 'Database belum terkonfigurasi.' });

  try {
    // Jalankan pembersihan baris lama dari database Supabase (class_quotas & class_quotass)
    try {
      sb.from('class_quotas')
        .delete()
        .or(`class_name.in.("${DEPRECATED_CLASS_NAMES.join('","')}"),id.in.("${DEPRECATED_CLASS_IDS.join('","')}")`)
        .then(() => {})
        .catch(() => {});

      sb.from('class_quotass' as any)
        .delete()
        .or(`class_name.in.("${DEPRECATED_CLASS_NAMES.join('","')}"),id.in.("${DEPRECATED_CLASS_IDS.join('","')}")`)
        .then(() => {})
        .catch(() => {});
    } catch {}

    const { data, error } = await sb
      .from('class_quotas')
      .select('*')
      .order('class_name', { ascending: true });

    if (!error && data && data.length > 0) {
      const filtered = data.filter((r: any) => {
        if (DEPRECATED_CLASS_IDS.includes(String(r.id))) return false;
        if (DEPRECATED_CLASS_NAMES.includes(r.class_name)) return false;
        return true;
      });

      const mapped = filtered.map((r: any) => ({
        id: String(r.id),
        academicYear: r.academic_year || '2027/2028',
        level: r.level || 'Kelas 7',
        className: r.class_name,
        capacity: Number(r.capacity || 32),
        filled: Number(r.filled || 0),
        homeroomTeacher: r.homeroom_teacher || '',
      }));
      return res.json({ success: true, data: mapped, source: 'table:public.class_quotas', count: mapped.length });
    }

    // Fallback: jika tabel belum di-seed, coba ambil dari spmb_app_state
    const { data: stateData } = await sb.from('spmb_app_state').select('payload').eq('key', 'class_quotas').maybeSingle();
    const rawFallback = stateData?.payload || [];
    const fallbackQuotas = Array.isArray(rawFallback)
      ? rawFallback.filter((q: any) => {
          const name = q.className || q.class_name;
          const id = q.id;
          if (DEPRECATED_CLASS_IDS.includes(id)) return false;
          if (DEPRECATED_CLASS_NAMES.includes(name)) return false;
          return true;
        })
      : [];

    return res.json({ success: true, data: fallbackQuotas, source: 'state:spmb_app_state', count: fallbackQuotas.length });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil data kuota kelas.' });
  }
});

// POST /api/class-quotas: Simpan atau update kuota kelas
app.post('/api/class-quotas', async (req: Request, res: Response) => {
  const sb = getSupabase();
  if (!sb) return res.status(503).json({ success: false, message: 'Database belum terkonfigurasi.' });

  const payload = req.body;
  if (!payload || !payload.className) {
    return res.status(400).json({ success: false, message: 'Nama kelas wajib diisi.' });
  }

  try {
    const row = {
      id: payload.id || `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      academic_year: payload.academicYear || '2027/2028',
      level: payload.level || 'Kelas 7',
      class_name: payload.className,
      capacity: Number(payload.capacity || 32),
      filled: Number(payload.filled || 0),
      homeroom_teacher: payload.homeroomTeacher || '',
      created_at: new Date().toISOString(),
    };

    // 1. Coba simpan langsung ke tabel relasional public.class_quotas
    const { data, error: tableError } = await sb.from('class_quotas').upsert(row, { onConflict: 'id' }).select().maybeSingle();

    // 2. Simpan juga ke spmb_app_state sebagai proteksi data & fallback
    try {
      const { data: stateData } = await sb.from('spmb_app_state').select('payload').eq('key', 'class_quotas').maybeSingle();
      const currentList: any[] = Array.isArray(stateData?.payload) ? stateData.payload : [];
      const itemToSave = {
        id: row.id,
        academicYear: row.academic_year,
        level: row.level,
        className: row.class_name,
        capacity: row.capacity,
        filled: row.filled,
        homeroomTeacher: row.homeroom_teacher,
      };
      const updatedList = currentList.some(q => q.id === row.id)
        ? currentList.map(q => q.id === row.id ? { ...q, ...itemToSave } : q)
        : [...currentList, itemToSave];
      await sb.from('spmb_app_state').upsert({
        key: 'class_quotas',
        payload: updatedList,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
    } catch (e) {
      console.warn('spmb_app_state class_quotas sync notice:', e);
    }

    const mapped = data ? {
      id: String(data.id),
      academicYear: data.academic_year,
      level: data.level,
      className: data.class_name,
      capacity: Number(data.capacity),
      filled: Number(data.filled),
      homeroomTeacher: data.homeroom_teacher,
    } : {
      id: row.id,
      academicYear: row.academic_year,
      level: row.level,
      className: row.class_name,
      capacity: row.capacity,
      filled: row.filled,
      homeroomTeacher: row.homeroom_teacher,
    };

    return res.json({
      success: true,
      message: 'Kuota kelas berhasil disimpan.',
      data: mapped,
      tableNotice: tableError ? tableError.message : null,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memproses kuota kelas.' });
  }
});

// POST /api/class-quotas/sync: Sinkronkan seluruh array kuota kelas sekaligus
app.post('/api/class-quotas/sync', async (req: Request, res: Response) => {
  const sb = getSupabase();
  if (!sb) return res.status(503).json({ success: false, message: 'Database belum terkonfigurasi.' });

  const quotas = req.body?.quotas || req.body;
  if (!Array.isArray(quotas)) {
    return res.status(400).json({ success: false, message: 'Array data kuota kelas diperlukan.' });
  }

  try {
    const rows = quotas.map((q: any) => ({
      id: q.id || `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      academic_year: q.academicYear || '2027/2028',
      level: q.level || 'Kelas 7',
      class_name: q.className || 'Kelas',
      capacity: Number(q.capacity || 32),
      filled: Number(q.filled || 0),
      homeroom_teacher: q.homeroomTeacher || '',
      created_at: new Date().toISOString(),
    }));

    // Coba simpan ke tabel relasional public.class_quotas
    const { error: upsertError } = await sb.from('class_quotas').upsert(rows, { onConflict: 'id' });

    // Simpan juga ke spmb_app_state sebagai cadangan
    await sb.from('spmb_app_state').upsert({
      key: 'class_quotas',
      payload: quotas,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

    return res.json({
      success: true,
      count: quotas.length,
      warning: upsertError ? upsertError.message : null,
      message: `Berhasil menyinkronkan ${quotas.length} kuota kelas ke server database.`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal sinkronisasi kuota kelas.' });
  }
});

// DELETE /api/class-quotas/:id: Hapus kuota kelas
app.delete('/api/class-quotas/:id', async (req: Request, res: Response) => {
  const sb = getSupabase();
  if (!sb) return res.status(503).json({ success: false, message: 'Database belum terkonfigurasi.' });

  const id = req.params.id;
  try {
    // 1. Hapus dari public.class_quotas
    await sb.from('class_quotas').delete().eq('id', id);

    // 2. Hapus juga dari spmb_app_state
    try {
      const { data: stateData } = await sb.from('spmb_app_state').select('payload').eq('key', 'class_quotas').maybeSingle();
      if (stateData && Array.isArray(stateData.payload)) {
        const filtered = stateData.payload.filter((q: any) => q.id !== id);
        await sb.from('spmb_app_state').upsert({
          key: 'class_quotas',
          payload: filtered,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });
      }
    } catch {
      // ignore
    }

    return res.json({ success: true, message: 'Kuota kelas berhasil dihapus.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus kuota kelas.' });
  }
});

// =====================================================================
// API ROUTES: APP STATE NON-TRANSAKSIONAL (INFO SEKOLAH, KUOTA KELAS)
// Kunci data transaksional ditolak tegas demi menjaga SSOT
// =====================================================================
const FORBIDDEN_STATE_KEYS = new Set([
  'students',
  'spmb_alhadiid_students',
  'users_db',
  'form_payments',
  'bam_payments',
  'question_bank',
]);

// GET /api/state/:key: Ambil konfigurasi umum
app.get('/api/state/:key', async (req: Request, res: Response) => {
  const sb = getSupabase();
  if (!sb) return res.status(503).json({ success: false, message: 'Database belum terkonfigurasi.' });

  const key = req.params.key;

  if (FORBIDDEN_STATE_KEYS.has(key)) {
    return res.status(400).json({
      success: false,
      error: 'SSOT Violation',
      message: `Kunci '${key}' adalah data transaksional yang harus diakses melalui tabel relasional khusus (Single Source of Truth), bukan spmb_app_state.`,
    });
  }

  try {
    const { data, error } = await sb
      .from('spmb_app_state')
      .select('payload, updated_at')
      .eq('key', key)
      .maybeSingle();

    if (error) return res.status(500).json({ success: false, message: error.message });

    return res.json({
      success: true,
      key,
      data: data?.payload ?? null,
      updatedAt: data?.updated_at ?? null,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil konfigurasi.' });
  }
});

// POST /api/state/:key: Simpan konfigurasi umum (Hanya Admin / Super Admin)
app.post(
  '/api/state/:key',
  requireAuth,
  requireRole('admin', 'super_admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const sb = getSupabase();
    if (!sb) return res.status(503).json({ success: false, message: 'Database belum terkonfigurasi.' });

    const key = req.params.key;

    if (FORBIDDEN_STATE_KEYS.has(key)) {
      return res.status(400).json({
        success: false,
        error: 'SSOT Violation',
        message: `Kunci '${key}' dilarang disimpan ke spmb_app_state. Gunakan tabel relasional khusus.`,
      });
    }

    const { payload } = req.body;

    try {
      const { error } = await sb.from('spmb_app_state').upsert(
        {
          key,
          payload: payload ?? req.body,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );

      if (error) return res.status(500).json({ success: false, message: error.message });

      return res.json({
        success: true,
        message: `Konfigurasi '${key}' berhasil diperbarui.`,
        key,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Gagal memperbarui konfigurasi.' });
    }
  }
);

// =====================================================================
// API ROUTES: TABEL STATUS & ADMIN MIGRASI DARI SPMB_APP_STATE
// =====================================================================

// GET /api/supabase/tables: Status & hitungan baris tabel relasional
app.get('/api/supabase/tables', async (_req: Request, res: Response) => {
  const sb = getSupabase();
  if (!sb) {
    return res.status(503).json({
      success: false,
      message: 'Supabase belum terkonfigurasi.',
      tables: {},
      timestamp: new Date().toISOString(),
    });
  }

  const tableNames = [
    'users',
    'students',
    'class_quotas',
    'payments',
    'kategori_soal',
    'soal',
    'ujian',
    'ujian_soal',
    'jawaban_peserta',
    'hasil_ujian',
    'audit_logs',
    'spmb_app_state',
  ];

  try {
    const tableResults: Record<string, { exists: boolean; count?: number; error?: string }> = {};

    await Promise.all(
      tableNames.map(async (table) => {
        try {
          const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
          if (error) {
            tableResults[table] = { exists: false, error: error.message };
          } else {
            tableResults[table] = { exists: true, count: count ?? 0 };
          }
        } catch (e: any) {
          tableResults[table] = { exists: false, error: e?.message };
        }
      })
    );

    return res.json({
      success: true,
      tables: tableResults,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memeriksa status tabel.' });
  }
});

// GET /api/admin/legacy-state-status: Periksa apakah masih ada data transaksional di spmb_app_state
app.get('/api/admin/legacy-state-status', async (_req: Request, res: Response) => {
  const sb = getSupabase();
  if (!sb) return res.status(503).json({ success: false, message: 'Database belum terkonfigurasi.' });

  try {
    const transactionalKeys = [
      'students',
      'spmb_alhadiid_students',
      'users_db',
      'users',
      'form_payments',
      'bam_payments',
      'question_bank',
      'payments',
    ];

    const { data, error } = await sb
      .from('spmb_app_state')
      .select('key, payload')
      .in('key', transactionalKeys);

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    const legacyKeys: Record<string, number> = {};
    let totalLegacyRecords = 0;

    data?.forEach((row: any) => {
      const count = Array.isArray(row.payload) ? row.payload.length : 1;
      if (count > 0) {
        legacyKeys[row.key] = count;
        totalLegacyRecords += count;
      }
    });

    const isClean = totalLegacyRecords === 0;

    return res.json({
      success: true,
      isClean,
      totalLegacyRecords,
      legacyKeys,
      message: isClean
        ? 'spmb_app_state bersih dari data transaksional (Single Source of Truth aktif).'
        : `Ditemukan ${totalLegacyRecords} record lama di spmb_app_state yang perlu dipindahkan ke database relasional.`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memeriksa data legacy.' });
  }
});

// POST /api/admin/migrate-app-state: Pindahkan seluruh data dari spmb_app_state ke database sebenarnya
app.post(
  '/api/admin/migrate-app-state',
  async (req: Request, res: Response) => {
    const sb = getSupabase();
    if (!sb) return res.status(503).json({ success: false, message: 'Database belum terkonfigurasi.' });

    try {
      const transactionalKeys = [
        'students',
        'spmb_alhadiid_students',
        'users_db',
        'users',
        'form_payments',
        'bam_payments',
        'question_bank',
        'payments',
      ];

      const { data: legacyRows, error: fetchErr } = await sb
        .from('spmb_app_state')
        .select('key, payload')
        .in('key', transactionalKeys);

      if (fetchErr) {
        return res.status(500).json({ success: false, message: `Gagal membaca spmb_app_state: ${fetchErr.message}` });
      }

      if (!legacyRows || legacyRows.length === 0) {
        return res.json({
          success: true,
          message: 'spmb_app_state sudah bersih. Seluruh data sudah berada di tabel database relasional.',
          migrated: { students: 0, users: 0, payments: 0, questions: 0 },
        });
      }

      const stateMap = new Map<string, any>();
      legacyRows.forEach((r: any) => stateMap.set(r.key, r.payload));

      let usersMigrated = 0;
      let studentsMigrated = 0;
      let paymentsMigrated = 0;
      let questionsMigrated = 0;
      const errors: string[] = [];

      // 1. Migrasi Pengguna (users_db / users)
      const usersPayload = stateMap.get('users_db') || stateMap.get('users') || [];
      if (Array.isArray(usersPayload) && usersPayload.length > 0) {
        const seenUsernames = new Set<string>();
        const userRows = usersPayload.map((u: any) => {
          let uname = u.username && typeof u.username === 'string' && u.username.trim() ? u.username.trim().toLowerCase() : null;
          if (uname) {
            if (seenUsernames.has(uname)) {
              uname = `${uname}_${Math.random().toString(36).substring(2, 5)}`;
            }
            seenUsernames.add(uname);
          }
          return {
            id: u.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: u.name || 'Pengguna',
            email: (u.email || `${u.id}@alhadiid.sch.id`).trim().toLowerCase(),
            username: uname,
            phone: u.phone || '081234567890',
            role: u.role || 'student',
            registration_number: u.registrationNumber || null,
            status: u.status || 'active',
            must_change_password: !!u.mustChangePassword,
            created_at: u.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        });

        const { error: userErr } = await sb.from('users').upsert(userRows, { onConflict: 'id' });
        if (userErr) errors.push(`Users: ${userErr.message}`);
        else usersMigrated += userRows.length;
      }

      // 2. Migrasi Siswa (students / spmb_alhadiid_students)
      const studentsPayload = stateMap.get('students') || stateMap.get('spmb_alhadiid_students') || [];
      if (Array.isArray(studentsPayload) && studentsPayload.length > 0) {
        // Akun pengguna siswa terlebih dahulu (FK requirement)
        const stUserRows = studentsPayload.map((s: any) => ({
          id: s.id || `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: s.fullName || 'Calon Murid',
          email: (s.userEmail || `${s.id}@spmb.alhadiid.sch.id`).trim().toLowerCase(),
          phone: s.phone || '081234567890',
          role: 'student',
          registration_number: s.registrationNumber || `SPMB2027${Math.floor(1000 + Math.random() * 9000)}`,
          status: 'active',
          must_change_password: false,
          created_at: s.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        const { error: stUserErr } = await sb.from('users').upsert(stUserRows, { onConflict: 'id' });
        if (stUserErr) errors.push(`Student Users: ${stUserErr.message}`);
        else usersMigrated += stUserRows.length;

        // Kolom yang benar-benar ada di tabel public.students
        const validStudentCols = new Set([
          'id', 'registration_number', 'user_email', 'status', 'created_at', 'updated_at',
          'full_name', 'phone', 'form_payment_proof_url', 'form_payment_date', 'form_payment_amount',
          'form_payment_status', 'form_payment_notes', 'nik', 'nisn', 'birth_place', 'birth_date',
          'gender', 'religion', 'address', 'subdistrict', 'city', 'province', 'postal_code',
          'previous_school_name', 'previous_school_npsn', 'previous_school_address',
          'father_name', 'father_job', 'father_education', 'father_phone',
          'mother_name', 'mother_job', 'mother_education', 'mother_phone',
          'guardian_name', 'guardian_relation', 'guardian_phone',
          'photo_url', 'kk_url', 'birth_cert_url', 'report_card_url', 'kip_url', 'certificate_url',
          'test_schedule_date', 'test_location', 'diagnostic_score', 'general_score',
          'religious_score', 'final_score', 'test_notes',
          'initial_payment_proof_url', 'initial_payment_date', 'initial_payment_amount',
          'initial_payment_status', 'initial_payment_notes',
          'assigned_class_id', 'assigned_class_name', 'assigned_homeroom_teacher',
          'first_day_date', 'mpls_info'
        ]);

        // Data pendaftaran calon siswa
        const stRows = studentsPayload.map((s: any) => {
          const id = s.id || `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const rawRow: Record<string, any> = {
            id,
            registration_number: s.registrationNumber || `SPMB2027${Math.floor(1000 + Math.random() * 9000)}`,
            status: s.status || 'draft',
            user_email: (s.userEmail || `${id}@spmb.alhadiid.sch.id`).trim().toLowerCase(),
            full_name: s.fullName || 'Calon Murid',
            phone: s.phone || '081234567890',
            form_payment_amount: Number(s.formPaymentAmount || 200000),
            form_payment_status: s.formPaymentStatus || (s.isFormVerified ? 'verified' : 'unpaid'),
            form_payment_proof_url: s.formPaymentProofUrl || null,
            form_payment_date: s.formPaymentDate ? s.formPaymentDate.split('T')[0] : null,
            form_payment_notes: s.formPaymentNotes || null,
            nik: s.nik || null,
            nisn: s.nisn || null,
            birth_place: s.birthPlace || null,
            birth_date: s.birthDate ? s.birthDate.split('T')[0] : '2013-01-01',
            gender: s.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki',
            religion: s.religion || 'Islam',
            address: s.address || null,
            subdistrict: s.subdistrict || null,
            city: s.city || null,
            province: s.province || null,
            postal_code: s.postalCode || null,
            previous_school_name: s.previousSchoolName || null,
            previous_school_npsn: s.previousSchoolNpsn || null,
            previous_school_address: s.previousSchoolAddress || null,
            father_name: s.fatherName || null,
            father_job: s.fatherJob || null,
            father_education: s.fatherEducation || null,
            father_phone: s.fatherPhone || null,
            mother_name: s.motherName || null,
            mother_job: s.motherJob || null,
            mother_education: s.motherEducation || null,
            mother_phone: s.motherPhone || null,
            guardian_name: s.guardianName || null,
            guardian_relation: s.guardianRelation || null,
            guardian_phone: s.guardianPhone || null,
            photo_url: s.photoUrl || null,
            kk_url: s.kkUrl || null,
            birth_cert_url: s.birthCertUrl || null,
            report_card_url: s.reportCardUrl || null,
            kip_url: s.kipUrl || null,
            certificate_url: s.certificateUrl || null,
            test_schedule_date: s.testScheduleDate ? s.testScheduleDate.split('T')[0] : null,
            test_location: s.testLocation || null,
            diagnostic_score: s.diagnosticScore !== undefined ? Number(s.diagnosticScore) : null,
            general_score: s.generalScore !== undefined ? Number(s.generalScore) : null,
            religious_score: s.religiousScore !== undefined ? Number(s.religiousScore) : null,
            final_score: s.finalScore !== undefined ? Number(s.finalScore) : null,
            test_notes: s.testNotes || null,
            initial_payment_proof_url: s.initialPaymentProofUrl || null,
            initial_payment_date: s.initialPaymentDate ? s.initialPaymentDate.split('T')[0] : null,
            initial_payment_amount: Number(s.initialPaymentAmount || 0),
            initial_payment_status: s.initialPaymentStatus || 'unpaid',
            initial_payment_notes: s.initialPaymentNotes || null,
            assigned_class_id: s.assignedClassId || null,
            assigned_class_name: s.assignedClassName || null,
            assigned_homeroom_teacher: s.assignedHomeroomTeacher || null,
            first_day_date: s.firstDayDate ? s.firstDayDate.split('T')[0] : null,
            mpls_info: s.mplsInfo || null,
            created_at: s.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const cleanRow: Record<string, any> = {};
          for (const [k, v] of Object.entries(rawRow)) {
            if (validStudentCols.has(k)) {
              cleanRow[k] = v;
            }
          }
          return cleanRow;
        });

        const { error: stErr } = await sb.from('students').upsert(stRows, { onConflict: 'id' });
        if (stErr) errors.push(`Students: ${stErr.message}`);
        else studentsMigrated += stRows.length;
      }

      // 3. Migrasi Pembayaran Formulir
      const formPayPayload = stateMap.get('form_payments') || [];
      if (Array.isArray(formPayPayload)) {
        for (const fp of formPayPayload) {
          if (!fp.studentId || fp.studentId.startsWith('std_00') || fp.studentId === 'std_001') continue;

          // Pastikan student ada di tabel students untuk memenuhi Foreign Key
          const { data: existingStudent } = await sb.from('students').select('id').eq('id', fp.studentId).maybeSingle();
          if (!existingStudent) {
            const stubEmail = (fp.userEmail || `${fp.studentId}@spmb.alhadiid.sch.id`).trim().toLowerCase();
            await sb.from('users').upsert({
              id: fp.studentId,
              name: fp.studentName || 'Calon Siswa',
              email: stubEmail,
              phone: '081234567890',
              role: 'student',
              registration_number: fp.registrationNumber || 'SPMB-FORM',
              status: 'active',
              must_change_password: false,
            }, { onConflict: 'id' });

            await sb.from('students').upsert({
              id: fp.studentId,
              user_email: stubEmail,
              full_name: fp.studentName || 'Calon Siswa',
              registration_number: fp.registrationNumber || 'SPMB-FORM',
              status: 'submitted',
              phone: '081234567890',
              is_form_verified: true,
              form_payment_status: 'verified',
              form_payment_amount: Number(fp.amount || 200000),
            }, { onConflict: 'id' });
          }

          const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const safeFormPayId = (fp.id && UUID_REGEX.test(fp.id)) ? fp.id : randomUUID();
          const payRow = {
            id: safeFormPayId,
            student_id: fp.studentId,
            registration_number: fp.registrationNumber || 'SPMB-FORM',
            student_name: fp.studentName || 'Calon Siswa',
            payment_type: 'formulir',
            amount: Number(fp.amount || 200000),
            status: 'verified',
            payment_method: 'manual_transfer',
            proof_url: fp.proofUrl || null,
            notes: fp.notes || 'Migrasi spmb_app_state',
            created_at: fp.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const { error: pErr } = await sb.from('payments').upsert(payRow, { onConflict: 'id' });
          if (!pErr) {
            paymentsMigrated++;
            await sb.from('students').update({
              is_form_verified: true,
              form_payment_status: 'verified',
              form_payment_amount: payRow.amount,
              updated_at: new Date().toISOString(),
            }).eq('id', fp.studentId);
          } else {
            errors.push(`Form Payment: ${pErr.message}`);
          }
        }
      }

      // 4. Migrasi Pembayaran BAM
      const bamPayPayload = stateMap.get('bam_payments') || [];
      if (Array.isArray(bamPayPayload)) {
        for (const bp of bamPayPayload) {
          if (!bp.studentId || bp.studentId.startsWith('std_00') || bp.studentId === 'std_001') continue;
          const amount = Number(bp.amountPaid || 0);
          if (amount <= 0) continue;

          // Pastikan student ada di tabel students untuk memenuhi Foreign Key
          const { data: existingStudent } = await sb.from('students').select('id').eq('id', bp.studentId).maybeSingle();
          if (!existingStudent) {
            const stubEmail = `${bp.studentId}@spmb.alhadiid.sch.id`.toLowerCase();
            await sb.from('users').upsert({
              id: bp.studentId,
              name: bp.studentName || 'Calon Siswa',
              email: stubEmail,
              phone: '081234567890',
              role: 'student',
              registration_number: bp.registrationNumber || 'SPMB-BAM',
              status: 'active',
              must_change_password: false,
            }, { onConflict: 'id' });

            await sb.from('students').upsert({
              id: bp.studentId,
              user_email: stubEmail,
              full_name: bp.studentName || 'Calon Siswa',
              registration_number: bp.registrationNumber || 'SPMB-BAM',
              status: 'submitted',
              phone: '081234567890',
              initial_payment_status: 'verified',
              initial_payment_amount: amount,
            }, { onConflict: 'id' });
          }

          const safeBamPayId = (bp.id && UUID_REGEX.test(bp.id)) ? bp.id : randomUUID();
          const payRow = {
            id: safeBamPayId,
            student_id: bp.studentId,
            registration_number: bp.registrationNumber || 'SPMB-BAM',
            student_name: bp.studentName || 'Calon Siswa',
            payment_type: 'daftar_ulang',
            amount,
            status: 'verified',
            payment_method: 'manual_transfer',
            proof_url: bp.proofUrl || null,
            notes: bp.notes || 'Migrasi spmb_app_state',
            created_at: bp.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const { error: pErr } = await sb.from('payments').upsert(payRow, { onConflict: 'id' });
          if (!pErr) {
            paymentsMigrated++;
            await sb.from('students').update({
              initial_payment_amount: amount,
              initial_payment_status: 'verified',
              updated_at: new Date().toISOString(),
            }).eq('id', bp.studentId);
          } else {
            errors.push(`BAM Payment: ${pErr.message}`);
          }
        }
      }

      // 5. Migrasi Soal CBT
      const questionsPayload = stateMap.get('question_bank') || [];
      if (Array.isArray(questionsPayload) && questionsPayload.length > 0) {
        const letterMap = ['A', 'B', 'C', 'D'];

        const soalRows = questionsPayload.map((q: any) => ({
          id: q.id,
          kategori_kode: q.category || q.kategori_kode || 'diagnostik',
          pertanyaan: q.questionText || q.pertanyaan || '',
          pilihan_a: q.options?.[0] || q.pilihan_a || '',
          pilihan_b: q.options?.[1] || q.pilihan_b || '',
          pilihan_c: q.options?.[2] || q.pilihan_c || '',
          pilihan_d: q.options?.[3] || q.pilihan_d || '',
          jawaban_benar: letterMap[q.correctOptionIndex ?? 0] || q.jawaban_benar || 'A',
          bobot: Number(q.points || q.bobot || 10),
          level_kesulitan: q.difficulty || q.level_kesulitan || 'medium',
          gambar_url: q.imageUrl || q.gambar_url || null,
          aktif: q.isActive !== false && q.aktif !== false,
        }));

        const { error: sErr } = await sb.from('soal').upsert(soalRows, { onConflict: 'id' });
        if (sErr) errors.push(`Soal: ${sErr.message}`);
        else questionsMigrated += soalRows.length;
      }

      // 6. Hapus kunci transaksional dari spmb_app_state
      const keysToDelete = Array.from(stateMap.keys()).filter((k) => transactionalKeys.includes(k));
      let keysRemoved: string[] = [];

      if (keysToDelete.length > 0) {
        const { error: delErr } = await sb
          .from('spmb_app_state')
          .delete()
          .in('key', keysToDelete);

        if (!delErr) {
          keysRemoved = keysToDelete;
        } else {
          errors.push(`Gagal menghapus kunci dari spmb_app_state: ${delErr.message}`);
        }
      }

      return res.json({
        success: true,
        message: `Migrasi selesai! Berhasil memindahkan ${studentsMigrated} siswa, ${usersMigrated} akun, ${paymentsMigrated} pembayaran, dan ${questionsMigrated} soal.`,
        migrated: {
          students: studentsMigrated,
          users: usersMigrated,
          payments: paymentsMigrated,
          questions: questionsMigrated,
        },
        keysRemoved,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Gagal memproses migrasi data.' });
    }
  }
);

// =====================================================================
// API ROUTES: DOKUMENTASI RESMI ENDPOINTS (SECURE SPEC)
// =====================================================================
app.get('/api/docs', (_req: Request, res: Response) => {
  res.json({
    title: 'SPMB SMP Al-Hadiid - Secure API Documentation',
    version: '2.1.0-secure',
    description: 'RESTful API SPMB SMP Al-Hadiid dengan autentikasi JWT Supabase, RBAC, dan kepatuhan Single Source of Truth.',
    baseUrl: '/api',
    security: 'Bearer JWT (Supabase Auth)',
    endpoints: [
      { method: 'GET', path: '/api/health', auth: 'none', description: 'Cek kesehatan server' },
      { method: 'GET', path: '/api/supabase/status', auth: 'none', description: 'Diagnostik koneksi database Supabase' },
      { method: 'GET', path: '/api/supabase/tables', auth: 'none', description: 'Status tabel relasional & hitungan baris' },
      { method: 'GET', path: '/api/admin/legacy-state-status', auth: 'none', description: 'Status kebersihan spmb_app_state' },
      { method: 'POST', path: '/api/admin/migrate-app-state', auth: 'admin', description: 'Pindahkan data spmb_app_state ke tabel relasional' },
      { method: 'GET', path: '/api/students', auth: 'admin, super_admin, kepsek', description: 'Daftar calon murid (relasional)' },
      { method: 'GET', path: '/api/students/:id', auth: 'authenticated (owner or admin)', description: 'Detail satu siswa' },
      { method: 'POST', path: '/api/students', auth: 'authenticated', description: 'Pendaftaran siswa baru' },
      { method: 'DELETE', path: '/api/students/:id', auth: 'admin, super_admin', description: 'Penghapusan siswa aman & tercatat audit log' },
      { method: 'GET', path: '/api/soal', auth: 'optional (kunci jawaban disembunyikan untuk peserta)', description: 'Bank soal ujian CBT' },
      { method: 'POST', path: '/api/soal', auth: 'admin, super_admin', description: 'Simpan soal ke public.soal' },
      { method: 'GET', path: '/api/class-quotas', auth: 'none', description: 'Daftar kuota kelas dari public.class_quotas' },
      { method: 'POST', path: '/api/class-quotas', auth: 'optional', description: 'Tambah atau update kuota kelas (dual-write sync)' },
      { method: 'POST', path: '/api/class-quotas/sync', auth: 'optional', description: 'Sinkronisasi seluruh kuota kelas sekaligus' },
      { method: 'DELETE', path: '/api/class-quotas/:id', auth: 'optional', description: 'Hapus data kuota kelas' },
      { method: 'POST', path: '/api/payments/verify', auth: 'admin, super_admin', description: 'Verifikasi pembayaran siswa & audit log' },
      { method: 'GET', path: '/api/state/:key', auth: 'none', description: 'Konfigurasi umum (kuota, info sekolah)' },
      { method: 'POST', path: '/api/state/:key', auth: 'admin, super_admin', description: 'Update konfigurasi umum' },
    ],
  });
});

// =====================================================================
// INTEGRASI VITE MIDDLEWARE & STATIC SERVING (PORT 3000)
// =====================================================================
async function ensureDefaultSystemAccounts() {
  const sb = getSupabase();
  if (!sb) return;

  try {
    const defaultAccounts = [
      {
        id: 'usr_superadmin',
        email: 'superadmin@alhadiid.sch.id',
        username: 'superadmin',
        name: 'Super Administrator SPMB',
        phone: '081234567890',
        role: 'super_admin',
        password_hash: 'admin123',
        status: 'active',
      },
      {
        id: 'usr_admin',
        email: 'admin@alhadiid.sch.id',
        username: 'admin',
        name: 'Panitia SPMB SMP Al-Hadiid',
        phone: '081234567890',
        role: 'admin',
        password_hash: 'admin123',
        status: 'active',
      },
      {
        id: 'usr_kepsek',
        email: 'kepsek@alhadiid.sch.id',
        username: 'kepsek',
        name: 'Herman Jayusman, S.Pd.I.',
        phone: '085814998782',
        role: 'kepsek',
        password_hash: 'admin123',
        status: 'active',
      },
      {
        id: 'usr_suwarno',
        email: 'suwarno691@guru.smp.belajar.id',
        username: 'suwarno',
        name: 'Suwarno, S.Pd. (Admin SPMB)',
        phone: '081234567890',
        role: 'super_admin',
        password_hash: 'admin123',
        status: 'active',
      },
    ];

    for (const acc of defaultAccounts) {
      const { data: existing } = await sb
        .from('users')
        .select('id, password_hash')
        .or(`email.eq.${acc.email},username.eq.${acc.username}`)
        .maybeSingle();

      if (!existing) {
        await sb.from('users').insert({
          ...acc,
          must_change_password: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } else if (!existing.password_hash) {
        await sb.from('users').update({ password_hash: acc.password_hash }).eq('id', existing.id);
      }
    }
  } catch (err: any) {
    console.warn('[SPMB Server] Note on account initialization:', err?.message || err);
  }
}

async function startServer() {
  const isCloudRun = !!process.env.K_SERVICE || !!process.env.K_REVISION || !!process.env.CLOUD_RUN_JOB;
  const isProdEnv = process.env.NODE_ENV === 'production' || isCloudRun;

  // Resolusi direktori dist secara komprehensif
  const candidateDistPaths = [
    path.resolve(process.cwd(), 'dist'),
    path.resolve(__dirname, 'dist'),
    path.resolve('/app/applet/dist'),
  ];

  let activeDistPath = '';
  let activeIndexPath = '';

  for (const p of candidateDistPaths) {
    const indexPath = path.join(p, 'index.html');
    if (fs.existsSync(indexPath)) {
      activeDistPath = p;
      activeIndexPath = indexPath;
      break;
    }
  }

  const isProduction = isProdEnv || !!activeIndexPath;

  if (activeDistPath && fs.existsSync(activeDistPath)) {
    app.use(express.static(activeDistPath));
  }

  if (isProduction) {
    app.get('*', (_req: Request, res: Response) => {
      // Periksa kembali jika file baru selesai dibangun
      let targetFile = activeIndexPath;
      if (!targetFile || !fs.existsSync(targetFile)) {
        for (const p of candidateDistPaths) {
          const idx = path.join(p, 'index.html');
          if (fs.existsSync(idx)) {
            targetFile = idx;
            activeIndexPath = idx;
            break;
          }
        }
      }

      if (targetFile && fs.existsSync(targetFile)) {
        res.sendFile(targetFile, (err) => {
          if (err && !res.headersSent) {
            console.error('[SPMB Server] sendFile error:', err);
            res.status(500).send('Error loading SPMB Application: ' + (err.message || 'File read error'));
          }
        });
      } else {
        res.status(200).send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SPMB SMP Al-Hadiid Cileungsi</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #fff; text-align: center; }
    .card { background: #1e293b; padding: 2.5rem; border-radius: 1.5rem; max-width: 500px; border: 1px solid #334155; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #10b981; }
    p { color: #94a3b8; font-size: 0.95rem; line-height: 1.6; }
    .btn { display: inline-block; margin-top: 1rem; padding: 0.75rem 1.5rem; background: #10b981; color: #fff; text-decoration: none; border-radius: 0.75rem; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">
    <h1>SPMB SMP Al-Hadiid Cileungsi</h1>
    <p>Aplikasi sedang menginisialisasi atau memuat aset statis. Silakan muat ulang halaman ini dalam beberapa saat.</p>
    <a href="/" class="btn" onclick="location.reload(); return false;">Muat Ulang Halaman</a>
  </div>
</body>
</html>`);
      }
    });
  } else {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (viteErr) {
      console.error('[SPMB Server] Vite server initialization error:', viteErr);
    }
  }

  // Global Error Handler agar server tidak crash
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[SPMB Server Global Error]:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: err?.message || 'Terjadi kesalahan pada server SPMB.',
      });
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SPMB Server] Server API aktif di http://0.0.0.0:${PORT} (mode: ${isProduction ? 'production' : 'development'})`);
  });

  // Jalankan inisialisasi akun secara background agar tidak menghambat Cloud Run health check startup
  ensureDefaultSystemAccounts().catch((err: any) => {
    console.warn('[SPMB Server] Background account init note:', err?.message || err);
  });
}

// Jalankan server jika dieksekusi langsung
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
