// =====================================================================
// src/utils/apiClient.ts
// Client Helper untuk berkomunikasi dengan Server API Supabase (/api/*)
// =====================================================================

export interface SupabaseApiStatus {
  configured: boolean;
  connected: boolean;
  message: string;
  projectUrl: string | null;
  latencyMs: number | null;
  timestamp: string;
  errorCode?: string;
}

export interface SupabaseTablesStatus {
  success: boolean;
  tables: Record<string, { exists: boolean; count?: number; error?: string }>;
  timestamp: string;
}

export interface ApiDocEndpoint {
  method: string;
  path: string;
  description: string;
}

export interface ApiDocsResponse {
  title: string;
  version: string;
  description: string;
  baseUrl: string;
  endpoints: ApiDocEndpoint[];
}

export const apiClient = {
  /**
   * Cek kesehatan server API
   */
  async getHealth() {
    try {
      const res = await fetch('/api/health');
      return await res.json();
    } catch (err: any) {
      return { status: 'error', message: err?.message };
    }
  },

  /**
   * Cek status koneksi langsung ke Supabase dari server
   */
  async getSupabaseStatus(): Promise<SupabaseApiStatus> {
    try {
      const res = await fetch('/api/supabase/status');
      return await res.json();
    } catch (err: any) {
      return {
        configured: false,
        connected: false,
        message: err?.message || 'Gagal menghubungi server API',
        projectUrl: null,
        latencyMs: null,
        timestamp: new Date().toISOString(),
      };
    }
  },

  /**
   * Cek ketersediaan tabel di database Supabase
   */
  async getSupabaseTables(): Promise<SupabaseTablesStatus> {
    try {
      const res = await fetch('/api/supabase/tables');
      return await res.json();
    } catch (err: any) {
      return {
        success: false,
        tables: {},
        timestamp: new Date().toISOString(),
      };
    }
  },

  /**
   * Ambil daftar calon murid via API
   */
  async getStudents(params?: { search?: string; jalur?: string; status?: string; limit?: number }) {
    try {
      const query = new URLSearchParams();
      if (params?.search) query.append('search', params.search);
      if (params?.jalur) query.append('jalur', params.jalur);
      if (params?.status) query.append('status', params.status);
      if (params?.limit) query.append('limit', String(params.limit));

      const res = await fetch(`/api/students?${query.toString()}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err?.message, data: [] };
    }
  },

  /**
   * Simpan atau perbarui data siswa via API
   */
  async saveStudent(studentData: any) {
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentData),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err?.message };
    }
  },

  /**
   * Ambil bank soal ujian dari Supabase via API
   */
  async getQuestions(category?: string) {
    try {
      const url = category ? `/api/soal?category=${category}` : '/api/soal';
      const res = await fetch(url);
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err?.message, data: [] };
    }
  },

  /**
   * Simpan bank soal ke Supabase via API
   */
  async saveQuestions(questions: any[]) {
    try {
      const res = await fetch('/api/soal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(questions),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err?.message };
    }
  },

  /**
   * Ambil daftar kuota kelas dari database Supabase via API
   */
  async getClassQuotas() {
    try {
      const res = await fetch('/api/class-quotas');
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err?.message, data: [] };
    }
  },

  /**
   * Simpan atau perbarui kuota kelas via API
   */
  async saveClassQuota(quotaData: any) {
    try {
      const res = await fetch('/api/class-quotas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quotaData),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err?.message };
    }
  },

  /**
   * Sinkronisasi seluruh kuota kelas sekaligus via API
   */
  async syncClassQuotas(quotas: any[]) {
    try {
      const res = await fetch('/api/class-quotas/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quotas }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err?.message };
    }
  },

  /**
   * Hapus kuota kelas via API
   */
  async deleteClassQuota(id: string) {
    try {
      const res = await fetch(`/api/class-quotas/${id}`, {
        method: 'DELETE',
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err?.message };
    }
  },

  /**
   * Ambil state/config terpusat
   */
  async getState(key: string) {
    try {
      const res = await fetch(`/api/state/${key}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err?.message, data: null };
    }
  },

  /**
   * Simpan state/config terpusat
   */
  async saveState(key: string, payload: any) {
    try {
      const res = await fetch(`/api/state/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err?.message };
    }
  },

  /**
   * Cek status kebersihan spmb_app_state dari server
   */
  async getLegacyStateStatus() {
    try {
      const res = await fetch('/api/admin/legacy-state-status');
      return await res.json();
    } catch (err: any) {
      return { success: false, isClean: false, message: err?.message, totalLegacyRecords: 0, legacyKeys: {} };
    }
  },

  /**
   * Jalankan pemindahan seluruh data spmb_app_state ke tabel relasional via Server
   */
  async migrateAppState() {
    try {
      const res = await fetch('/api/admin/migrate-app-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err?.message };
    }
  },

  /**
   * Ambil daftar dokumentasi API endpoints
   */
  async getDocs(): Promise<ApiDocsResponse | null> {
    try {
      const res = await fetch('/api/docs');
      return await res.json();
    } catch {
      return null;
    }
  },
};
