import { supabase, isSupabaseConfigured, saveSupabaseState, fetchSupabaseState } from '../utils/supabaseClient';
import { ClassQuota, StudentData } from '../types';
import { initialClassQuotas } from '../data/initialData';

export function mapRowToClassQuota(row: any): ClassQuota {
  return {
    id: String(row.id),
    academicYear: row.academic_year || '2027/2028',
    level: row.level || 'Kelas 7',
    className: row.class_name || 'Kelas',
    capacity: Number(row.capacity ?? 32),
    filled: Number(row.filled ?? 0),
    homeroomTeacher: row.homeroom_teacher || '',
  };
}

export function mapClassQuotaToRow(quota: Partial<ClassQuota>): any {
  return {
    id: quota.id || `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    academic_year: quota.academicYear || '2027/2028',
    level: quota.level || 'Kelas 7',
    class_name: quota.className || 'Kelas Baru',
    capacity: Number(quota.capacity ?? 32),
    filled: Number(quota.filled ?? 0),
    homeroom_teacher: quota.homeroomTeacher || '',
    created_at: new Date().toISOString(),
  };
}

export const ClassQuotaRepository = {
  /**
   * Mengambil daftar kuota kelas langsung dari tabel relasional public.class_quotas di Supabase.
   * Jika tabel kosong, fallback membaca dari spmb_app_state atau initialClassQuotas.
   */
  async list(): Promise<{ data: ClassQuota[]; error: Error | null; source: 'table' | 'state' | 'initial' }> {
    if (!isSupabaseConfigured()) {
      return { data: initialClassQuotas, error: null, source: 'initial' };
    }

    try {
      // 1. Ambil langsung dari tabel relasional public.class_quotas di Supabase
      const { data, error } = await supabase
        .from('class_quotas')
        .select('*')
        .order('class_name', { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped = data.map(mapRowToClassQuota);
        return { data: mapped, error: null, source: 'table' };
      }

      // 2. Jika tabel relasional kosong (belum di-seed atau RLS pending), coba baca via /api/class-quotas
      try {
        const apiRes = await fetch('/api/class-quotas');
        if (apiRes.ok) {
          const apiJson = await apiRes.json();
          if (apiJson.success && Array.isArray(apiJson.data) && apiJson.data.length > 0) {
            return { data: apiJson.data, error: null, source: apiJson.source?.includes('table') ? 'table' : 'state' };
          }
        }
      } catch {
        // Abaikan jika offline / running tanpa server proxy
      }

      // 3. Fallback baca langsung dari spmb_app_state key 'class_quotas'
      const legacyState = await fetchSupabaseState<ClassQuota[]>('class_quotas');
      if (legacyState && Array.isArray(legacyState) && legacyState.length > 0) {
        // Coba migrasikan otomatis ke tabel public.class_quotas jika write diperbolehkan
        try {
          const rows = legacyState.map(mapClassQuotaToRow);
          const { error: seedErr } = await supabase.from('class_quotas').upsert(rows, { onConflict: 'id' });
          if (!seedErr) {
            console.log('[ClassQuotaRepository] Berhasil migrasi kuota kelas dari spmb_app_state ke tabel class_quotas.');
          }
        } catch {
          // ignore
        }
        return { data: legacyState, error: null, source: 'state' };
      }

      // 4. Fallback ke initialClassQuotas
      return { data: initialClassQuotas, error: null, source: 'initial' };
    } catch (err: any) {
      console.warn('[ClassQuotaRepository] list exception:', err);
      return { data: initialClassQuotas, error: err instanceof Error ? err : new Error(String(err)), source: 'initial' };
    }
  },

  /**
   * Mengambil 1 data kuota kelas berdasarkan ID
   */
  async getById(id: string): Promise<{ data: ClassQuota | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('class_quotas')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        // Coba cari dari list keseluruhan
        const list = await this.list();
        const found = list.data.find(q => q.id === id) || null;
        return { data: found, error: null };
      }
      return { data: data ? mapRowToClassQuota(data) : null, error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Menambahkan kuota kelas baru ke tabel public.class_quotas
   * Dilengkapi dual-write: menyimpan ke tabel relasional dan spmb_app_state sebagai proteksi.
   */
  async create(quota: Partial<ClassQuota>): Promise<{ data: ClassQuota | null; error: Error | null }> {
    try {
      const row = mapClassQuotaToRow(quota);
      const createdObj = mapRowToClassQuota(row);

      // 1. Simpan ke tabel relasional public.class_quotas
      const { data, error } = await supabase
        .from('class_quotas')
        .insert(row)
        .select()
        .single();

      if (error) {
        console.info('[ClassQuotaRepository] Tabel public.class_quotas notice:', error.message);
      }

      // 2. Dual-write ke spmb_app_state key 'class_quotas' sebagai proteksi data
      try {
        const currentList = await this.list();
        const exists = currentList.data.some(q => q.id === createdObj.id);
        const newList = exists
          ? currentList.data.map(q => q.id === createdObj.id ? createdObj : q)
          : [...currentList.data, createdObj];
        await saveSupabaseState('class_quotas', newList);
      } catch (e) {
        console.warn('[ClassQuotaRepository] state backup notice:', e);
      }

      // 3. Panggil juga server endpoint /api/class-quotas
      try {
        await fetch('/api/class-quotas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createdObj),
        });
      } catch {
        // ignore
      }

      return { data: data ? mapRowToClassQuota(data) : createdObj, error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Memperbarui kuota kelas di tabel public.class_quotas
   */
  async update(id: string, updates: Partial<ClassQuota>): Promise<{ data: ClassQuota | null; error: Error | null }> {
    try {
      const updateRow: any = {};
      if (updates.academicYear !== undefined) updateRow.academic_year = updates.academicYear;
      if (updates.level !== undefined) updateRow.level = updates.level;
      if (updates.className !== undefined) updateRow.class_name = updates.className;
      if (updates.capacity !== undefined) updateRow.capacity = Number(updates.capacity);
      if (updates.filled !== undefined) updateRow.filled = Number(updates.filled);
      if (updates.homeroomTeacher !== undefined) updateRow.homeroom_teacher = updates.homeroomTeacher;

      // 1. Update di tabel public.class_quotas
      const { data, error } = await supabase
        .from('class_quotas')
        .update(updateRow)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        console.info('[ClassQuotaRepository] update notice:', error.message);
      }

      // 2. Dual-write update di spmb_app_state
      const currentList = await this.list();
      const updatedList = currentList.data.map(q => q.id === id ? { ...q, ...updates } : q);
      await saveSupabaseState('class_quotas', updatedList);

      // 3. Panggil juga server API
      try {
        const targetObj = updatedList.find(q => q.id === id);
        if (targetObj) {
          await fetch('/api/class-quotas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(targetObj),
          });
        }
      } catch {
        // ignore
      }

      const fallbackObj = updatedList.find(q => q.id === id) || null;
      return { data: data ? mapRowToClassQuota(data) : fallbackObj, error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Menghapus kuota kelas dari tabel public.class_quotas
   */
  async remove(id: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      // 1. Hapus dari public.class_quotas
      const { error } = await supabase
        .from('class_quotas')
        .delete()
        .eq('id', id);

      if (error) {
        console.info('[ClassQuotaRepository] remove notice:', error.message);
      }

      // 2. Hapus juga dari spmb_app_state
      const currentList = await this.list();
      const filtered = currentList.data.filter(q => q.id !== id);
      await saveSupabaseState('class_quotas', filtered);

      // 3. Panggil juga server API DELETE
      try {
        await fetch(`/api/class-quotas/${id}`, { method: 'DELETE' });
      } catch {
        // ignore
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Simpan atau perbarui seluruh array kuota kelas (Sync All)
   */
  async syncAll(quotas: ClassQuota[]): Promise<{ count: number; error: Error | null }> {
    try {
      if (!quotas || quotas.length === 0) return { count: 0, error: null };
      const rows = quotas.map(mapClassQuotaToRow);

      // 1. Upsert ke public.class_quotas
      const { data, error } = await supabase
        .from('class_quotas')
        .upsert(rows, { onConflict: 'id' })
        .select('id');

      if (error) {
        console.info('[ClassQuotaRepository] syncAll table notice:', error.message);
      }

      // 2. Selalu perbarui juga spmb_app_state sebagai backup sekunder
      await saveSupabaseState('class_quotas', quotas);

      // 3. Panggil juga server sync endpoint
      try {
        await fetch('/api/class-quotas/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quotas }),
        });
      } catch {
        // ignore
      }

      return { count: data?.length || quotas.length, error: null };
    } catch (err: any) {
      return { count: quotas.length, error: null };
    }
  },

  /**
   * Menghitung ulang jumlah siswa yang telah terisi (filled) per kuota kelas
   * berdasarkan data siswa aktif di public.students
   */
  async recalculateFilledCounts(
    quotas: ClassQuota[],
    students: StudentData[]
  ): Promise<ClassQuota[]> {
    const updatedQuotas = quotas.map(q => {
      const count = students.filter(s =>
        s.assignedClassId === q.id ||
        (s.assignedClassName && s.assignedClassName.toLowerCase() === q.className.toLowerCase())
      ).length;

      return {
        ...q,
        filled: count,
      };
    });

    // Perbarui ke server secara asynchronous
    this.syncAll(updatedQuotas).catch(err => {
      console.warn('[ClassQuotaRepository] Auto-recalculate sync warning:', err);
    });

    return updatedQuotas;
  },

  /**
   * Memeriksa status tabel relasional public.class_quotas di Supabase
   */
  async getTableStatus(): Promise<{
    tableExists: boolean;
    rowCount: number;
    source: 'table' | 'state' | 'initial';
    error: string | null;
  }> {
    if (!isSupabaseConfigured()) {
      return { tableExists: false, rowCount: 0, source: 'initial', error: 'Supabase belum dikonfigurasi' };
    }
    try {
      const { count, error } = await supabase
        .from('class_quotas')
        .select('*', { count: 'exact', head: true });

      if (error) {
        return { tableExists: false, rowCount: 0, source: 'state', error: error.message };
      }

      const numRows = count ?? 0;
      return {
        tableExists: true,
        rowCount: numRows,
        source: numRows > 0 ? 'table' : 'state',
        error: null,
      };
    } catch (e: any) {
      return { tableExists: false, rowCount: 0, source: 'state', error: e?.message || 'Gagal memeriksa status tabel' };
    }
  },
};

