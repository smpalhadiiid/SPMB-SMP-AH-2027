import { supabase } from '../utils/supabaseClient';
import { CbtKategori, CbtSoal, CbtUjian, CbtHasilUjian, CbtLogUjian } from '../types';
import { generateUUID } from '../utils/uuid';
import {
  getCbtKategori, saveCbtKategori,
  getCbtSoal, saveCbtSoal,
  getCbtUjian, saveCbtUjian,
  getCbtHasilUjian, saveCbtHasilUjian,
  getCbtLogUjian, saveCbtLogUjian,
  DEFAULT_CBT_KATEGORI, DEFAULT_CBT_SOAL, DEFAULT_CBT_UJIAN
} from '../utils/cbtStorage';

const INDEX_TO_LETTER = ['A', 'B', 'C', 'D'];
const LETTER_TO_INDEX: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

// ==========================================
// 1. KATEGORI SOAL SERVICE
// ==========================================
export async function fetchKategoriSoalSupabase(): Promise<CbtKategori[]> {
  try {
    const { data, error } = await supabase
      .from('kategori_soal')
      .select('*')
      .order('created_at', { ascending: true });

    if (error || !data) {
      console.warn('Supabase fetch kategori_soal error:', error?.message);
      return getCbtKategori();
    }

    const result: CbtKategori[] = data.map(item => ({
      id: item.id,
      namaKategori: item.nama_kategori,
      kodeKategori: item.kode_kategori,
      persentaseBobot: Number(item.persentase_bobot || 30),
      keterangan: item.keterangan || '',
    }));

    saveCbtKategori(result);
    return result;
  } catch (err) {
    console.warn('Error fetching kategori_soal from Supabase:', err);
    return getCbtKategori();
  }
}

export async function createKategoriSoalSupabase(kategori: Omit<CbtKategori, 'id'> & { id?: string }): Promise<CbtKategori> {
  const id = kategori.id || generateUUID();
  const payload = {
    id,
    nama_kategori: kategori.namaKategori,
    kode_kategori: kategori.kodeKategori,
    persentase_bobot: kategori.persentaseBobot,
    keterangan: kategori.keterangan || '',
    aktif: true,
  };

  try {
    const { data, error } = await supabase
      .from('kategori_soal')
      .upsert(payload, { onConflict: 'kode_kategori' })
      .select()
      .single();

    if (error) throw error;

    const newKat: CbtKategori = {
      id: data.id,
      namaKategori: data.nama_kategori,
      kodeKategori: data.kode_kategori,
      persentaseBobot: Number(data.persentase_bobot),
      keterangan: data.keterangan || '',
    };

    const local = getCbtKategori().filter(k => k.kodeKategori !== newKat.kodeKategori);
    local.push(newKat);
    saveCbtKategori(local);
    return newKat;
  } catch (err: any) {
    console.warn('Supabase create kategori failed, saving locally:', err?.message);
    const newKat: CbtKategori = { ...kategori, id };
    const local = getCbtKategori().filter(k => k.kodeKategori !== newKat.kodeKategori);
    local.push(newKat);
    saveCbtKategori(local);
    return newKat;
  }
}

export async function updateKategoriSoalSupabase(kategori: CbtKategori): Promise<CbtKategori> {
  try {
    const { data, error } = await supabase
      .from('kategori_soal')
      .update({
        nama_kategori: kategori.namaKategori,
        kode_kategori: kategori.kodeKategori,
        persentase_bobot: kategori.persentaseBobot,
        keterangan: kategori.keterangan || '',
      })
      .eq('id', kategori.id)
      .select()
      .single();

    if (error) throw error;
  } catch (err: any) {
    console.warn('Supabase update kategori failed:', err?.message);
  }

  const local = getCbtKategori();
  const index = local.findIndex(k => k.id === kategori.id || k.kodeKategori === kategori.kodeKategori);
  if (index >= 0) {
    local[index] = kategori;
  } else {
    local.push(kategori);
  }
  saveCbtKategori(local);
  return kategori;
}

export async function deleteKategoriSoalSupabase(id: string, kodeKategori: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('kategori_soal').delete().eq('id', id);
    if (error) {
      await supabase.from('kategori_soal').delete().eq('kode_kategori', kodeKategori);
    }
  } catch (err: any) {
    console.warn('Supabase delete kategori failed:', err?.message);
  }

  const local = getCbtKategori().filter(k => k.id !== id && k.kodeKategori !== kodeKategori);
  saveCbtKategori(local);
  return true;
}

// ==========================================
// 2. BANK SOAL SERVICE
// ==========================================
export async function fetchSoalSupabase(forStudent: boolean = false): Promise<CbtSoal[]> {
  try {
    const { data, error } = await supabase
      .from('soal')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.warn('Supabase fetch soal error:', error?.message);
      const local = getCbtSoal();
      if (forStudent) {
        return local.map((s) => ({
          ...s,
          jawabanBenar: undefined as any,
          correctOptionIndex: undefined as any,
        }));
      }
      return local;
    }

    const result: CbtSoal[] = data.map(item => {
      // Siswa tidak menerima kunci jawaban pada response soal
      const idx = forStudent ? undefined : (LETTER_TO_INDEX[item.jawaban_benar?.toUpperCase()] ?? 0);
      return {
        id: item.id,
        category: item.kategori_kode,
        kategoriKode: item.kategori_kode,
        questionText: item.pertanyaan,
        question: item.pertanyaan,
        options: [item.pilihan_a, item.pilihan_b, item.pilihan_c, item.pilihan_d],
        pilihanA: item.pilihan_a,
        pilihanB: item.pilihan_b,
        pilihanC: item.pilihan_c,
        pilihanD: item.pilihan_d,
        jawabanBenar: idx as any,
        correctOptionIndex: idx as any,
        bobot: Number(item.bobot || 10),
        points: Number(item.bobot || 10),
        levelKesulitan: (item.level_kesulitan || 'medium') as 'easy' | 'medium' | 'hard',
        statusAktif: item.aktif !== false,
      };
    });

    if (!forStudent) {
      saveCbtSoal(result);
    }
    return result;
  } catch (err) {
    console.warn('Error fetching soal from Supabase:', err);
    return getCbtSoal();
  }
}

export async function createSoalSupabase(soal: Omit<CbtSoal, 'id'> & { id?: string }): Promise<CbtSoal> {
  const id = soal.id || generateUUID();
  const letterAnswer = INDEX_TO_LETTER[soal.jawabanBenar] || 'A';

  const payload = {
    id,
    kategori_kode: soal.kategoriKode || soal.category,
    pertanyaan: soal.questionText || (soal as any).question || '',
    pilihan_a: soal.pilihanA || soal.options?.[0] || '',

    pilihan_b: soal.pilihanB || soal.options?.[1] || '',
    pilihan_c: soal.pilihanC || soal.options?.[2] || '',
    pilihan_d: soal.pilihanD || soal.options?.[3] || '',
    jawaban_benar: letterAnswer,
    bobot: soal.bobot || 10,
    level_kesulitan: soal.levelKesulitan || 'medium',
    aktif: soal.statusAktif !== false,
  };

  try {
    const { data, error } = await supabase
      .from('soal')
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;

    const idx = LETTER_TO_INDEX[data.jawaban_benar?.toUpperCase()] ?? soal.jawabanBenar;
    const created: CbtSoal = {
      id: data.id,
      category: data.kategori_kode,
      kategoriKode: data.kategori_kode,
      questionText: data.pertanyaan,
      question: data.pertanyaan,
      options: [data.pilihan_a, data.pilihan_b, data.pilihan_c, data.pilihan_d],
      pilihanA: data.pilihan_a,
      pilihanB: data.pilihan_b,
      pilihanC: data.pilihan_c,
      pilihanD: data.pilihan_d,
      jawabanBenar: idx,
      correctOptionIndex: idx,
      bobot: Number(data.bobot),
      points: Number(data.bobot),
      levelKesulitan: data.level_kesulitan,
      statusAktif: data.aktif !== false,
    };

    const local = getCbtSoal().filter(s => s.id !== created.id);
    local.unshift(created);
    saveCbtSoal(local);
    return created;
  } catch (err: any) {
    console.warn('Supabase create soal failed, saving locally:', err?.message);
    const created: CbtSoal = { ...soal, id };
    const local = getCbtSoal().filter(s => s.id !== id);
    local.unshift(created);
    saveCbtSoal(local);
    return created;
  }
}

export async function updateSoalSupabase(soal: CbtSoal): Promise<CbtSoal> {
  const letterAnswer = INDEX_TO_LETTER[soal.jawabanBenar] || 'A';
  const payload = {
    kategori_kode: soal.kategoriKode || soal.category,
    pertanyaan: soal.questionText || (soal as any).question || '',
    pilihan_a: soal.pilihanA || soal.options?.[0] || '',

    pilihan_b: soal.pilihanB || soal.options?.[1] || '',
    pilihan_c: soal.pilihanC || soal.options?.[2] || '',
    pilihan_d: soal.pilihanD || soal.options?.[3] || '',
    jawaban_benar: letterAnswer,
    bobot: soal.bobot || 10,
    level_kesulitan: soal.levelKesulitan || 'medium',
    aktif: soal.statusAktif !== false,
  };

  try {
    const { error } = await supabase.from('soal').update(payload).eq('id', soal.id);
    if (error) throw error;
  } catch (err: any) {
    console.warn('Supabase update soal failed:', err?.message);
  }

  const local = getCbtSoal();
  const index = local.findIndex(s => s.id === soal.id);
  if (index >= 0) {
    local[index] = soal;
  } else {
    local.unshift(soal);
  }
  saveCbtSoal(local);
  return soal;
}

export async function deleteSoalSupabase(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('soal').delete().eq('id', id);
    if (error) console.warn('Supabase delete soal error:', error.message);
  } catch (err: any) {
    console.warn('Supabase delete soal failed:', err?.message);
  }

  const local = getCbtSoal().filter(s => s.id !== id);
  saveCbtSoal(local);
  return true;
}

export async function bulkInsertSoalSupabase(soalList: CbtSoal[]): Promise<CbtSoal[]> {
  const rows = soalList.map(soal => ({
    id: soal.id || generateUUID(),
    kategori_kode: soal.kategoriKode || soal.category,
    pertanyaan: soal.questionText || (soal as any).question || '',
    pilihan_a: soal.pilihanA || soal.options?.[0] || '',

    pilihan_b: soal.pilihanB || soal.options?.[1] || '',
    pilihan_c: soal.pilihanC || soal.options?.[2] || '',
    pilihan_d: soal.pilihanD || soal.options?.[3] || '',
    jawaban_benar: INDEX_TO_LETTER[soal.jawabanBenar] || 'A',
    bobot: soal.bobot || 10,
    level_kesulitan: soal.levelKesulitan || 'medium',
    aktif: soal.statusAktif !== false,
  }));

  try {
    const { error } = await supabase.from('soal').upsert(rows);
    if (error) console.warn('Supabase bulk insert soal warning:', error.message);
  } catch (err: any) {
    console.warn('Supabase bulk insert failed:', err?.message);
  }

  const existing = getCbtSoal();
  const merged = [...soalList, ...existing.filter(e => !soalList.some(s => s.id === e.id))];
  saveCbtSoal(merged);
  return merged;
}

export async function bulkUpdateSoalStatusSupabase(soalIds: string[], statusAktif: boolean): Promise<boolean> {
  if (soalIds.length === 0) return true;
  try {
    const { error } = await supabase
      .from('soal')
      .update({ aktif: statusAktif })
      .in('id', soalIds);
    if (error) console.warn('Supabase bulk update status error:', error.message);
  } catch (err: any) {
    console.warn('Supabase bulk update status failed:', err?.message);
  }

  const local = getCbtSoal().map(s => {
    if (soalIds.includes(s.id)) {
      return { ...s, statusAktif };
    }
    return s;
  });
  saveCbtSoal(local);
  return true;
}

export async function syncAndSaveSelectedSoalToSupabase(soalList: CbtSoal[]): Promise<boolean> {
  if (soalList.length === 0) return true;
  
  const rows = soalList.map(soal => ({
    id: soal.id || generateUUID(),
    kategori_kode: soal.kategoriKode || soal.category || 'diagnostik',
    pertanyaan: soal.questionText || (soal as any).question || '',
    pilihan_a: soal.pilihanA || soal.options?.[0] || '',
    pilihan_b: soal.pilihanB || soal.options?.[1] || '',
    pilihan_c: soal.pilihanC || soal.options?.[2] || '',
    pilihan_d: soal.pilihanD || soal.options?.[3] || '',
    jawaban_benar: INDEX_TO_LETTER[typeof soal.jawabanBenar === 'number' ? soal.jawabanBenar : soal.correctOptionIndex || 0] || 'A',
    bobot: soal.bobot || 10,
    level_kesulitan: soal.levelKesulitan || 'medium',
    aktif: soal.statusAktif !== false,
  }));

  try {
    const { error } = await supabase.from('soal').upsert(rows, { onConflict: 'id' });
    if (error) {
      console.warn('Supabase upsert public.soal error:', error.message);
    } else {
      console.log(`Berhasil menyimpan ${rows.length} soal ke tabel public.soal Supabase`);
    }
  } catch (err: any) {
    console.warn('Sync to public.soal failed:', err?.message);
  }

  saveCbtSoal(soalList);
  return true;
}

// ==========================================
// 3. JADWAL UJIAN SERVICE
// ==========================================
export async function fetchUjianSupabase(): Promise<CbtUjian[]> {
  try {
    const { data, error } = await supabase
      .from('ujian')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.warn('Supabase fetch ujian error:', error?.message);
      return getCbtUjian();
    }

    const result: CbtUjian[] = data.map(item => ({
      id: item.id,
      namaUjian: item.nama_ujian,
      gelombang: item.gelombang || 'Gelombang 1',
      tanggal: item.tanggal,
      jamMulai: item.jam_mulai,
      durasiMinutes: Number(item.durasi || 90),
      status: (item.status || 'aktif') as 'draft' | 'aktif' | 'selesai',
      jumlahDiagnostik: Number(item.jumlah_diagnostik || 6),
      jumlahTpu: Number(item.jumlah_tpu || 8),
      jumlahDiniyyah: Number(item.jumlah_diniyyah || 6),
      batasKelulusan: Number(item.batas_kelulusan || 70),
    }));

    saveCbtUjian(result);
    return result;
  } catch (err) {
    console.warn('Error fetching ujian from Supabase:', err);
    return getCbtUjian();
  }
}

export async function createUjianSupabase(ujian: Omit<CbtUjian, 'id'> & { id?: string }): Promise<CbtUjian> {
  const id = ujian.id || generateUUID();
  const payload = {
    id,
    nama_ujian: ujian.namaUjian,
    gelombang: ujian.gelombang || 'Gelombang 1',
    tanggal: ujian.tanggal,
    jam_mulai: ujian.jamMulai,
    durasi: ujian.durasiMinutes || 90,
    status: ujian.status || 'aktif',
    jumlah_diagnostik: ujian.jumlahDiagnostik || 6,
    jumlah_tpu: ujian.jumlahTpu || 8,
    jumlah_diniyyah: ujian.jumlahDiniyyah || 6,
    batas_kelulusan: ujian.batasKelulusan || 70,
    aktif: true,
  };

  try {
    const { error } = await supabase.from('ujian').upsert(payload);
    if (error) throw error;
  } catch (err: any) {
    console.warn('Supabase create ujian failed:', err?.message);
  }

  const created: CbtUjian = { ...ujian, id };
  const local = getCbtUjian().filter(u => u.id !== id);
  local.unshift(created);
  saveCbtUjian(local);
  return created;
}

export async function updateUjianSupabase(ujian: CbtUjian): Promise<CbtUjian> {
  const payload = {
    nama_ujian: ujian.namaUjian,
    gelombang: ujian.gelombang,
    tanggal: ujian.tanggal,
    jam_mulai: ujian.jamMulai,
    durasi: ujian.durasiMinutes,
    status: ujian.status,
    jumlah_diagnostik: ujian.jumlahDiagnostik,
    jumlah_tpu: ujian.jumlahTpu,
    jumlah_diniyyah: ujian.jumlahDiniyyah,
    batas_kelulusan: ujian.batasKelulusan,
  };

  try {
    const { error } = await supabase.from('ujian').update(payload).eq('id', ujian.id);
    if (error) throw error;
  } catch (err: any) {
    console.warn('Supabase update ujian failed:', err?.message);
  }

  const local = getCbtUjian();
  const index = local.findIndex(u => u.id === ujian.id);
  if (index >= 0) {
    local[index] = ujian;
  } else {
    local.unshift(ujian);
  }
  saveCbtUjian(local);
  return ujian;
}

export async function deleteUjianSupabase(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('ujian').delete().eq('id', id);
    if (error) console.warn('Supabase delete ujian error:', error.message);
  } catch (err: any) {
    console.warn('Supabase delete ujian failed:', err?.message);
  }

  const local = getCbtUjian().filter(u => u.id !== id);
  saveCbtUjian(local);
  return true;
}

// ==========================================
// 4. JAWABAN PESERTA SERVICE (AUTO-SAVE TO SUPABASE)
// ==========================================
const INDEX_TO_LETTER_MAP = ['A', 'B', 'C', 'D'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let cachedActiveUjianId: string | null = null;
export async function getValidDatabaseUjianId(providedId?: string): Promise<string> {
  if (providedId && UUID_REGEX.test(providedId)) {
    return providedId;
  }
  if (cachedActiveUjianId) {
    return cachedActiveUjianId;
  }
  try {
    const { data } = await supabase
      .from('ujian')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) {
      cachedActiveUjianId = data.id;
      return data.id;
    }
  } catch (err) {
    console.warn('getValidDatabaseUjianId fetch error:', err);
  }
  return '145eacad-ef02-4180-ba26-85b34d1649da';
}

let cachedSoalMap: Record<string, string> | null = null;
async function getValidDatabaseSoalId(soalId: string): Promise<string | null> {
  if (UUID_REGEX.test(soalId)) {
    return soalId;
  }
  if (!cachedSoalMap) {
    try {
      const { data } = await supabase.from('soal').select('id, kategori_kode, pertanyaan').limit(50);
      cachedSoalMap = {};
      data?.forEach((row, idx) => {
        cachedSoalMap![`soal_${idx}`] = row.id;
        cachedSoalMap![row.id] = row.id;
      });
    } catch {}
  }
  if (cachedSoalMap && cachedSoalMap[soalId]) {
    return cachedSoalMap[soalId];
  }
  return null;
}

export async function saveJawabanPesertaSupabase(params: {
  ujianId?: string;
  pesertaId: string;
  soalId: string;
  jawabanIndex?: number;
  jawabanDipilih?: string;
  isRaguRagu?: boolean;
}): Promise<boolean> {
  const { ujianId, pesertaId, soalId, jawabanIndex, jawabanDipilih, isRaguRagu } = params;
  const letterJawaban =
    jawabanDipilih || (jawabanIndex !== undefined ? INDEX_TO_LETTER_MAP[jawabanIndex] || 'A' : null);
  const validUjianId = await getValidDatabaseUjianId(ujianId);

  let validSoalId = soalId;
  if (!UUID_REGEX.test(soalId)) {
    const mapped = await getValidDatabaseSoalId(soalId);
    if (mapped) validSoalId = mapped;
    else return false;
  }

  const payload = {
    ujian_id: validUjianId,
    peserta_id: pesertaId,
    soal_id: validSoalId,
    jawaban_dipilih: letterJawaban,
    is_ragu: Boolean(isRaguRagu),
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabase
      .from('jawaban_peserta')
      .upsert(payload, { onConflict: 'ujian_id,peserta_id,soal_id' });

    if (error) {
      console.warn('saveJawabanPesertaSupabase warning:', error.message);
    }
    return !error;
  } catch (err: any) {
    console.warn('saveJawabanPesertaSupabase error:', err?.message);
    return false;
  }
}

/**
 * Menyimpan seluruh jawaban ujian peserta langsung ke database Supabase tabel jawaban_peserta
 */
export async function saveAllJawabanPesertaSupabase(params: {
  ujianId?: string;
  pesertaId: string;
  answers: Record<string, number | string>;
  questions?: Array<{ id: string; correctOptionIndex?: number; answer?: string | number }>;
}): Promise<{ count: number; error: Error | null }> {
  const { ujianId, pesertaId, answers } = params;
  if (!answers || Object.keys(answers).length === 0) {
    return { count: 0, error: null };
  }

  const validUjianId = await getValidDatabaseUjianId(ujianId);

  const rows = [];
  for (const [soalId, ansVal] of Object.entries(answers)) {
    let letter: string | null = null;
    if (typeof ansVal === 'number') {
      letter = INDEX_TO_LETTER[ansVal] || null;
    } else if (typeof ansVal === 'string') {
      letter = ansVal.toUpperCase();
    }

    let targetSoalId = soalId;
    if (!UUID_REGEX.test(soalId)) {
      const mapped = await getValidDatabaseSoalId(soalId);
      if (mapped) targetSoalId = mapped;
      else continue;
    }

    rows.push({
      ujian_id: validUjianId,
      peserta_id: pesertaId,
      soal_id: targetSoalId,
      jawaban_dipilih: letter,
      is_ragu: false,
      updated_at: new Date().toISOString(),
    });
  }

  if (rows.length === 0) {
    return { count: 0, error: null };
  }

  try {
    const { error } = await supabase
      .from('jawaban_peserta')
      .upsert(rows, { onConflict: 'ujian_id,peserta_id,soal_id' });

    if (error) {
      console.warn('saveAllJawabanPesertaSupabase warning:', error.message);
      return { count: 0, error: new Error(error.message) };
    }
    return { count: rows.length, error: null };
  } catch (err: any) {
    console.warn('saveAllJawabanPesertaSupabase error:', err);
    return { count: 0, error: err };
  }
}

export async function finishCbtExamServerRpc(ujianId: string): Promise<{
  success: boolean;
  final_score?: number;
  status_kelulusan?: string;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('rpc_finish_cbt_exam', {
      p_ujian_id: ujianId,
    });
    if (error) {
      console.warn('rpc_finish_cbt_exam error:', error.message);
      return { success: false, error: error.message };
    }
    return data || { success: true };
  } catch (err: any) {
    console.warn('rpc_finish_cbt_exam call failed:', err?.message);
    return { success: false, error: err?.message };
  }
}

export async function fetchJawabanPesertaSupabase(
  ujianId: string,
  pesertaId: string
): Promise<Record<string, { jawabanIndex?: number; isRaguRagu?: boolean }>> {
  const result: Record<string, { jawabanIndex?: number; isRaguRagu?: boolean }> = {};

  try {
    const { data, error } = await supabase
      .from('jawaban_peserta')
      .select('*')
      .eq('ujian_id', ujianId)
      .eq('peserta_id', pesertaId);

    if (error || !data) return result;

    data.forEach((row) => {
      const idx = LETTER_TO_INDEX[row.jawaban_dipilih?.toUpperCase() || row.jawaban?.toUpperCase()] ?? undefined;
      result[row.soal_id] = {
        jawabanIndex: idx,
        isRaguRagu: Boolean(row.is_ragu || row.ragu_ragu),
      };
    });
  } catch (err: any) {
    console.warn('fetchJawabanPesertaSupabase failed:', err?.message);
  }

  return result;
}

// ==========================================
// 5. HASIL UJIAN SERVICE (SUPABASE)
// ==========================================
export async function saveHasilUjianSupabase(hasil: CbtHasilUjian): Promise<boolean> {
  const validUjianId = await getValidDatabaseUjianId(hasil.ujianId);
  const payload = {
    ujian_id: validUjianId,
    peserta_id: hasil.pesertaId,
    nilai_diagnostik: hasil.nilaiDiagnostik,
    nilai_tpu: hasil.nilaiTpu,
    nilai_diniyyah: hasil.nilaiDiniyyah,
    nilai_akhir: hasil.nilaiTotal,
    status_kelulusan: hasil.statusKelulusan,
    waktu_selesai: new Date().toISOString(),
  };

  try {
    const { error } = await supabase
      .from('hasil_ujian')
      .upsert(payload, { onConflict: 'ujian_id,peserta_id' });

    if (error) {
      console.warn('saveHasilUjianSupabase notice:', error.message);
    }
  } catch (err: any) {
    console.warn('saveHasilUjianSupabase error:', err?.message);
  }

  // Also save to localStorage cache
  const existing = getCbtHasilUjian();
  const updated = [hasil, ...existing.filter((h) => h.id !== hasil.id && h.pesertaId !== hasil.pesertaId)];
  saveCbtHasilUjian(updated);

  // Sync scores to student table if exists
  try {
    await supabase
      .from('students')
      .update({
        diagnostic_score: hasil.nilaiDiagnostik,
        general_score: hasil.nilaiTpu,
        religious_score: hasil.nilaiDiniyyah,
        final_score: hasil.nilaiTotal,
        status: 'test_completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', hasil.pesertaId);
  } catch (err) {
    // Ignore student table sync failure
  }

  return true;
}

export async function fetchHasilUjianSupabase(pesertaId?: string): Promise<CbtHasilUjian[]> {
  try {
    let query = supabase.from('hasil_ujian').select('*').order('created_at', { ascending: false });
    if (pesertaId) {
      query = query.eq('peserta_id', pesertaId);
    }

    const { data, error } = await query;
    if (error || !data) {
      const local = getCbtHasilUjian();
      return pesertaId ? local.filter((h) => h.pesertaId === pesertaId) : local;
    }

    const result: CbtHasilUjian[] = data.map((item) => ({
      id: item.id,
      ujianId: item.ujian_id,
      pesertaId: item.peserta_id,
      registrationNumber: item.no_pendaftaran || item.registration_number || '',
      namaPeserta: item.nama_peserta,
      nilaiDiagnostik: Number(item.nilai_diagnostik || 0),
      nilaiTpu: Number(item.nilai_tpu || 0),
      nilaiDiniyyah: Number(item.nilai_diniyyah || 0),
      nilaiTotal: Number(item.nilai_akhir ?? item.nilai_total ?? 0),
      statusKelulusan: item.status_kelulusan === 'LULUS' ? 'LULUS' : 'BELUM LULUS',
      tanggalUjian: item.tanggal_ujian || new Date().toISOString().split('T')[0],
    }));

    saveCbtHasilUjian(result);
    return result;
  } catch (err) {
    console.warn('fetchHasilUjianSupabase error:', err);
    return getCbtHasilUjian();
  }
}

// ==========================================
// 6. LOG UJIAN SERVICE (SUPABASE)
// ==========================================
export async function saveLogUjianSupabase(log: CbtLogUjian): Promise<boolean> {
  const payload1 = {
    id: log.id || `log_${log.ujianId}_${log.pesertaId}`,
    ujian_id: log.ujianId,
    peserta_id: log.pesertaId,
    nama_peserta: log.namaPeserta,
    nomor_soal_terakhir: log.nomorSoalTerakhir,
    sisa_waktu_detik: log.sisaWaktuDetik,
    status_online: log.statusOnline || 'ONLINE',
    is_submitted: log.isSubmitted,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabase.from('log_ujian').upsert(payload1, { onConflict: 'id' });
    if (error) {
      const payload2: any = { ...payload1, sisa_waktu: log.sisaWaktuDetik };
      delete payload2.sisa_waktu_detik;
      await supabase.from('log_ujian').upsert(payload2, { onConflict: 'id' });
    }
  } catch (err: any) {
    // Tolerant: spmb_app_state handles real-time sessions cleanly
  }

  saveCbtLogUjian([log]);
  return true;
}

// =====================================================================
// 7. VERIFIKASI & OTOMATISASI PENYIAPAN DATABASE SUPABASE CBT
// =====================================================================

export interface CbtTableCheckResult {
  tableName: string;
  exists: boolean;
  rowCount: number;
  status: 'ready' | 'empty' | 'error';
  message: string;
}

export interface CbtDatabaseSetupReport {
  success: boolean;
  timestamp: string;
  tables: CbtTableCheckResult[];
  createdDefaults: string[];
  summary: string;
}

export const CBT_SUPABASE_SQL_SCRIPT = `-- =====================================================================
-- SQL SCHEMA DATABASE SUPABASE: MODUL COMPUTER-BASED TEST (CBT) SPMB
-- SMP AL-HADIID CILEUNGSI (2027/2028)
-- =====================================================================

-- 0. Function auto updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. TABEL KATEGORI_SOAL
CREATE TABLE IF NOT EXISTS public.kategori_soal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_kategori VARCHAR(100) NOT NULL UNIQUE,
  kode_kategori VARCHAR(50) NOT NULL UNIQUE,
  persentase_bobot DECIMAL(5,2) NOT NULL DEFAULT 30.00 CHECK (persentase_bobot > 0),
  keterangan TEXT,
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 2. TABEL SOAL (BANK SOAL CBT)
CREATE TABLE IF NOT EXISTS public.soal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kategori_kode VARCHAR(50) NOT NULL REFERENCES public.kategori_soal(kode_kategori) ON DELETE CASCADE ON UPDATE CASCADE,
  pertanyaan TEXT NOT NULL,
  gambar_url TEXT,
  pilihan_a TEXT NOT NULL,
  pilihan_b TEXT NOT NULL,
  pilihan_c TEXT NOT NULL,
  pilihan_d TEXT NOT NULL,
  jawaban_benar VARCHAR(1) NOT NULL CHECK (jawaban_benar IN ('A', 'B', 'C', 'D')),
  bobot INT NOT NULL DEFAULT 10 CHECK (bobot > 0),
  level_kesulitan VARCHAR(20) DEFAULT 'medium' CHECK (level_kesulitan IN ('easy', 'medium', 'hard')),
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 3. TABEL UJIAN (JADWAL UJIAN CBT)
CREATE TABLE IF NOT EXISTS public.ujian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_ujian VARCHAR(255) NOT NULL,
  gelombang VARCHAR(100) NOT NULL DEFAULT 'Gelombang 1',
  tanggal DATE NOT NULL,
  jam_mulai TIME NOT NULL DEFAULT '08:00:00',
  durasi INT NOT NULL DEFAULT 90 CHECK (durasi > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'aktif' CHECK (status IN ('draft', 'aktif', 'selesai')),
  jumlah_diagnostik INT NOT NULL DEFAULT 6 CHECK (jumlah_diagnostik >= 0),
  jumlah_tpu INT NOT NULL DEFAULT 8 CHECK (jumlah_tpu >= 0),
  jumlah_diniyyah INT NOT NULL DEFAULT 6 CHECK (jumlah_diniyyah >= 0),
  batas_kelulusan DECIMAL(5,2) DEFAULT 70.00 CHECK (batas_kelulusan >= 0),
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 4. TABEL JAWABAN_PESERTA (AUTO-SAVE REALTIME)
CREATE TABLE IF NOT EXISTS public.jawaban_peserta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ujian_id UUID NOT NULL REFERENCES public.ujian(id) ON DELETE CASCADE,
  peserta_id VARCHAR(100) NOT NULL,
  soal_id UUID NOT NULL,
  jawaban_dipilih VARCHAR(1) CHECK (jawaban_dipilih IN ('A', 'B', 'C', 'D')),
  is_ragu BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT uq_jawaban_peserta UNIQUE(ujian_id, peserta_id, soal_id)
);

-- 5. TABEL HASIL_UJIAN (REKAP NILAI & KELULUSAN CBT)
CREATE TABLE IF NOT EXISTS public.hasil_ujian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ujian_id UUID NOT NULL REFERENCES public.ujian(id) ON DELETE CASCADE,
  peserta_id VARCHAR(100) NOT NULL,
  registration_number VARCHAR(100),
  nama_peserta VARCHAR(255),
  nilai_diagnostik DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (nilai_diagnostik >= 0),
  nilai_tpu DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (nilai_tpu >= 0),
  nilai_diniyyah DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (nilai_diniyyah >= 0),
  nilai_akhir DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (nilai_akhir >= 0),
  status_kelulusan VARCHAR(50) NOT NULL DEFAULT 'BELUM LULUS',
  tanggal_ujian TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  waktu_mulai TIMESTAMP WITH TIME ZONE,
  waktu_selesai TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT uq_hasil_ujian UNIQUE(ujian_id, peserta_id)
);

-- 6. TABEL LOG_UJIAN (REALTIME MONITORING SESI)
CREATE TABLE IF NOT EXISTS public.log_ujian (
  id VARCHAR(120) PRIMARY KEY,
  ujian_id UUID NOT NULL REFERENCES public.ujian(id) ON DELETE CASCADE,
  peserta_id VARCHAR(100) NOT NULL,
  nama_peserta VARCHAR(255),
  nomor_soal_terakhir INT DEFAULT 1,
  sisa_waktu_detik INT NOT NULL DEFAULT 5400,
  status_online VARCHAR(20) DEFAULT 'ONLINE' CHECK (status_online IN ('ONLINE', 'OFFLINE')),
  is_submitted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 7. TABEL SPMB_APP_STATE (SSOT PERSISTENT STORE)
CREATE TABLE IF NOT EXISTS public.spmb_app_state (
  key VARCHAR(100) PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- RLS & POLICIES (Full Access untuk Admin & Peserta)
ALTER TABLE public.kategori_soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jawaban_peserta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hasil_ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spmb_app_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access kategori_soal" ON public.kategori_soal;
CREATE POLICY "Public full access kategori_soal" ON public.kategori_soal FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access soal" ON public.soal;
CREATE POLICY "Public full access soal" ON public.soal FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access ujian" ON public.ujian;
CREATE POLICY "Public full access ujian" ON public.ujian FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access jawaban_peserta" ON public.jawaban_peserta;
CREATE POLICY "Public full access jawaban_peserta" ON public.jawaban_peserta FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access hasil_ujian" ON public.hasil_ujian;
CREATE POLICY "Public full access hasil_ujian" ON public.hasil_ujian FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access log_ujian" ON public.log_ujian;
CREATE POLICY "Public full access log_ujian" ON public.log_ujian FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access spmb_app_state" ON public.spmb_app_state;
CREATE POLICY "Public full access spmb_app_state" ON public.spmb_app_state FOR ALL USING (true) WITH CHECK (true);

-- SEED DEFAULT KATEGORI SOAL
INSERT INTO public.kategori_soal (nama_kategori, kode_kategori, persentase_bobot, keterangan, aktif)
VALUES 
  ('Tes Diagnostik', 'diagnostik', 30.00, 'Pengukuran kemampuan dasar dan bakat skolastik (30%)', true),
  ('Pengetahuan Umum', 'pengetahuan_umum', 40.00, 'Tes Pengetahuan Umum / TPU (40%)', true),
  ('Diniyyah & Agama', 'diniyyah', 30.00, 'Tes Pemahaman Diniyyah, PAI, & Kemampuan Mengaji (30%)', true)
ON CONFLICT (kode_kategori) DO UPDATE 
SET 
  nama_kategori = EXCLUDED.nama_kategori,
  persentase_bobot = EXCLUDED.persentase_bobot,
  aktif = EXCLUDED.aktif;
`;

/**
 * Melakukan verifikasi dan inisialisasi tabel-tabel CBT pada database Supabase
 */
export async function verifyAndSetupCbtDatabaseSupabase(): Promise<CbtDatabaseSetupReport> {
  const tableNames = [
    'kategori_soal',
    'soal',
    'ujian',
    'jawaban_peserta',
    'hasil_ujian',
    'log_ujian',
    'spmb_app_state',
  ];

  const results: CbtTableCheckResult[] = [];
  const createdDefaults: string[] = [];

  for (const t of tableNames) {
    try {
      const { data, count, error } = await supabase
        .from(t)
        .select('*', { count: 'exact', head: false })
        .limit(5);

      if (error) {
        results.push({
          tableName: t,
          exists: false,
          rowCount: 0,
          status: 'error',
          message: error.message,
        });
      } else {
        const rows = count !== null ? count : (data ? data.length : 0);
        results.push({
          tableName: t,
          exists: true,
          rowCount: rows,
          status: rows > 0 ? 'ready' : 'empty',
          message: rows > 0 ? `${rows} data terdeteksi` : 'Tabel siap (kosong)',
        });
      }
    } catch (err: any) {
      results.push({
        tableName: t,
        exists: false,
        rowCount: 0,
        status: 'error',
        message: err?.message || 'Gagal query tabel',
      });
    }
  }

  // 1. Inisialisasi Kategori Default jika tabel kategori_soal kosong
  const kategoriRes = results.find(r => r.tableName === 'kategori_soal');
  if (kategoriRes?.exists && kategoriRes.rowCount === 0) {
    try {
      const defaultCats = [
        { nama_kategori: 'Tes Diagnostik', kode_kategori: 'diagnostik', persentase_bobot: 30, aktif: true },
        { nama_kategori: 'Pengetahuan Umum', kode_kategori: 'pengetahuan_umum', persentase_bobot: 40, aktif: true },
        { nama_kategori: 'Diniyyah & Agama', kode_kategori: 'diniyyah', persentase_bobot: 30, aktif: true },
      ];
      await supabase.from('kategori_soal').upsert(defaultCats, { onConflict: 'kode_kategori' });
      createdDefaults.push('3 Kategori Soal Standar (Diagnostik, TPU, Diniyyah)');
      kategoriRes.rowCount = 3;
      kategoriRes.status = 'ready';
    } catch {}
  }

  // 2. Inisialisasi Jadwal Ujian Default jika tabel ujian kosong
  const ujianRes = results.find(r => r.tableName === 'ujian');
  if (ujianRes?.exists && ujianRes.rowCount === 0) {
    try {
      const defaultExam = {
        id: '29ead736-1ef5-4c3e-b287-05ad404c0d9f',
        nama_ujian: 'Ujian Seleksi SPMB Online 2027/2028',
        gelombang: 'Gelombang 1',
        tanggal: new Date().toISOString().split('T')[0],
        jam_mulai: '08:00:00',
        durasi: 90,
        status: 'aktif',
        jumlah_diagnostik: 10,
        jumlah_tpu: 10,
        jumlah_diniyyah: 10,
        batas_kelulusan: 70,
        aktif: true,
      };
      await supabase.from('ujian').upsert(defaultExam);
      createdDefaults.push('Jadwal Ujian Aktif (Ujian Seleksi SPMB Online 2027/2028)');
      ujianRes.rowCount = 1;
      ujianRes.status = 'ready';
    } catch {}
  }

  // 3. Inisialisasi Bank Soal ke public.soal jika kosong
  const soalRes = results.find(r => r.tableName === 'soal');
  if (soalRes?.exists && soalRes.rowCount === 0) {
    try {
      const defaultSoal = getCbtSoal();
      if (defaultSoal && defaultSoal.length > 0) {
        await syncAndSaveSelectedSoalToSupabase(defaultSoal);
        createdDefaults.push(`${defaultSoal.length} Butir Soal Bank CBT Default`);
        soalRes.rowCount = defaultSoal.length;
        soalRes.status = 'ready';
      }
    } catch {}
  }

  const allReady = results.every(r => r.exists);

  return {
    success: allReady,
    timestamp: new Date().toISOString(),
    tables: results,
    createdDefaults,
    summary: allReady
      ? 'Seluruh tabel CBT pada database Supabase telah siap dan aktif terhubung.'
      : 'Beberapa tabel CBT memerlukan eksekusi skrip SQL di SQL Editor Supabase.',
  };
}

