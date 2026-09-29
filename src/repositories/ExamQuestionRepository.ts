// =====================================================================
// src/repositories/ExamQuestionRepository.ts
// Single Source of Truth Repository for public.soal (CBT Bank Soal)
// Menjamin data soal disimpan langsung di tabel relasional public.soal
// =====================================================================

import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';
import { ExamQuestion } from '../types';
import { initialQuestionBank } from '../data/initialData';
import { safeGetItem, safeSetItem, KEYS } from '../utils/storage';

const INDEX_TO_LETTER = ['A', 'B', 'C', 'D'];
const LETTER_TO_INDEX: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

/**
 * Konversi baris tabel 'soal' Supabase ke interface ExamQuestion
 */
export function mapRowToExamQuestion(row: any): ExamQuestion {
  let correctIndex = 0;
  if (typeof row.jawaban_benar === 'string') {
    const upper = row.jawaban_benar.toUpperCase().trim();
    if (upper in LETTER_TO_INDEX) {
      correctIndex = LETTER_TO_INDEX[upper];
    } else {
      const parsedNum = parseInt(upper, 10);
      if (!isNaN(parsedNum) && parsedNum >= 0 && parsedNum <= 3) {
        correctIndex = parsedNum;
      }
    }
  } else if (typeof row.jawaban_benar === 'number') {
    correctIndex = row.jawaban_benar;
  } else if (typeof row.correctOptionIndex === 'number') {
    correctIndex = row.correctOptionIndex;
  }

  const options: string[] = Array.isArray(row.options) && row.options.length > 0
    ? row.options
    : [
        row.pilihan_a ?? '',
        row.pilihan_b ?? '',
        row.pilihan_c ?? '',
        row.pilihan_d ?? '',
      ];

  return {
    id: String(row.id),
    category: row.kategori_kode || row.category || 'diagnostik',
    questionText: row.pertanyaan || row.questionText || row.question || '',
    options,
    correctOptionIndex: correctIndex,
    points: Number(row.bobot ?? row.points ?? 10),
    difficulty: (row.level_kesulitan || row.difficulty || 'medium') as 'easy' | 'medium' | 'hard',
    imageUrl: row.gambar_url || row.imageUrl || undefined,
    isActive: row.aktif !== undefined ? !!row.aktif : (row.isActive !== undefined ? !!row.isActive : true),
  };
}

/**
 * Konversi interface ExamQuestion ke payload tabel 'soal' Supabase
 */
export function mapExamQuestionToSoalRow(q: ExamQuestion) {
  const letter = INDEX_TO_LETTER[q.correctOptionIndex] || 'A';
  return {
    id: q.id,
    kategori_kode: q.category || 'diagnostik',
    pertanyaan: q.questionText || '',
    pilihan_a: q.options?.[0] || '',
    pilihan_b: q.options?.[1] || '',
    pilihan_c: q.options?.[2] || '',
    pilihan_d: q.options?.[3] || '',
    jawaban_benar: letter,
    bobot: q.points || 10,
    level_kesulitan: q.difficulty || 'medium',
    gambar_url: q.imageUrl || null,
    aktif: q.isActive !== false,
  };
}

export const ExamQuestionRepository = {
  /**
   * Mengambil daftar seluruh soal ujian dari Single Source of Truth (public.soal).
   * Menjamin data soal konsisten di semua perangkat tanpa menimpa data yang sudah diedit.
   */
  async list(): Promise<ExamQuestion[]> {
    try {
      if (!isSupabaseConfigured()) {
        const local = safeGetItem(KEYS.QUESTION_BANK);
        if (local) {
          try {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          } catch (e: any) {
            console.warn('[ExamQuestionRepository] Failed to parse local question bank:', e?.message || e);
          }
        }
        return initialQuestionBank;
      }

      // Ambil langsung dari tabel relasional public.soal
      const { data: soalData, error: soalErr } = await supabase
        .from('soal')
        .select('*')
        .order('created_at', { ascending: false });

      if (!soalErr && soalData && Array.isArray(soalData)) {
        const questions = soalData.map(mapRowToExamQuestion);
        safeSetItem(KEYS.QUESTION_BANK, JSON.stringify(questions));
        return questions;
      }

      // Fallback lokal HANYA jika ada error koneksi ke Supabase
      const local = safeGetItem(KEYS.QUESTION_BANK);
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) return parsed;
        } catch (e: any) {
          console.warn('[ExamQuestionRepository] Failed to parse fallback local questions:', e?.message || e);
        }
      }
      return [];
    } catch (err: any) {
      console.warn('Gagal mengambil soal dari Supabase, menggunakan fallback lokal:', err?.message || err);
      const local = safeGetItem(KEYS.QUESTION_BANK);
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e: any) {
          console.warn('[ExamQuestionRepository] Failed to parse catch local questions:', e?.message || e);
        }
      }
      return initialQuestionBank;
    }
  },

  /**
   * Menyimpan daftar soal secara permanen ke tabel relasional public.soal
   */
  async save(questions: ExamQuestion[]): Promise<{ success: boolean; error?: string }> {
    try {
      safeSetItem(KEYS.QUESTION_BANK, JSON.stringify(questions));

      if (!isSupabaseConfigured() || questions.length === 0) {
        return { success: true };
      }

      const rows = questions.map(mapExamQuestionToSoalRow);
      const { error } = await supabase.from('soal').upsert(rows, { onConflict: 'id' });

      if (error) {
        console.error('Gagal menyimpan ke tabel public.soal:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      console.error('Gagal menyimpan soal ke Supabase:', err);
      return { success: false, error: err?.message || 'Gagal menyimpan ke database Supabase' };
    }
  },

  /**
   * Menambahkan soal baru langsung ke tabel public.soal
   */
  async create(question: ExamQuestion): Promise<{ data: ExamQuestion; error?: string }> {
    try {
      if (isSupabaseConfigured()) {
        const row = mapExamQuestionToSoalRow(question);
        const { error } = await supabase.from('soal').insert(row);
        if (error) throw error;
      }
      const current = await this.list();
      const updated = [question, ...current.filter((q) => q.id !== question.id)];
      safeSetItem(KEYS.QUESTION_BANK, JSON.stringify(updated));
      return { data: question };
    } catch (err: any) {
      return { data: question, error: err?.message || String(err) };
    }
  },

  /**
   * Memperbarui satu soal tertentu di tabel public.soal
   */
  async update(question: ExamQuestion): Promise<{ data: ExamQuestion; error?: string }> {
    try {
      if (isSupabaseConfigured()) {
        const row = mapExamQuestionToSoalRow(question);
        const { error } = await supabase.from('soal').update(row).eq('id', question.id);
        if (error) throw error;
      }
      const current = await this.list();
      const updated = current.map((q) => (q.id === question.id ? question : q));
      safeSetItem(KEYS.QUESTION_BANK, JSON.stringify(updated));
      return { data: question };
    } catch (err: any) {
      return { data: question, error: err?.message || String(err) };
    }
  },

  /**
   * Menghapus satu soal dari tabel public.soal
   */
  async remove(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('soal').delete().eq('id', id);
        if (error) throw error;
      }
      const current = await this.list();
      const updated = current.filter((q) => q.id !== id);
      safeSetItem(KEYS.QUESTION_BANK, JSON.stringify(updated));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  },

  /**
   * Realtime Subscription perubahan soal langsung dari tabel public.soal
   */
  subscribe(onUpdate: (questions: ExamQuestion[]) => void): () => void {
    if (!isSupabaseConfigured()) {
      return () => {};
    }

    const channel = supabase
      .channel('realtime_public_soal')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'soal',
        },
        async () => {
          const fresh = await this.list();
          onUpdate(fresh);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
