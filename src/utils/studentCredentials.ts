import { supabase } from './supabaseClient';

export interface StudentCredentialRecord {
  studentId: string;
  registrationNumber: string;
  userEmail: string;
  fullName: string;
  username: string;
  password?: string;
  createdAt: string;
  updatedAt?: string;
}

const STORAGE_KEY_MAP = 'spmb_all_student_credentials_map';

// Memory cache
let inMemoryCredMap: Record<string, StudentCredentialRecord> = {};

function safeLoadCache(): Record<string, StudentCredentialRecord> {
  if (typeof window === 'undefined') return inMemoryCredMap;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MAP);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        inMemoryCredMap = { ...inMemoryCredMap, ...parsed };
      }
    }
  } catch {}
  return inMemoryCredMap;
}

function safeSaveCache(map: Record<string, StudentCredentialRecord>): void {
  inMemoryCredMap = { ...inMemoryCredMap, ...map };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_MAP, JSON.stringify(inMemoryCredMap));
    } catch {}
  }
}

/**
 * Fetch all stored student credentials from Supabase spmb_app_state
 */
export async function fetchStudentCredentialsFromSupabase(): Promise<Record<string, StudentCredentialRecord>> {
  safeLoadCache();
  try {
    const { data, error } = await supabase
      .from('spmb_app_state')
      .select('payload')
      .eq('key', 'student_account_credentials')
      .maybeSingle();

    if (!error && data && data.payload && typeof data.payload === 'object') {
      const serverMap = data.payload as Record<string, StudentCredentialRecord>;
      safeSaveCache(serverMap);
      return inMemoryCredMap;
    }
  } catch (e) {
    console.warn('[studentCredentials] Fetch notice:', e);
  }
  return inMemoryCredMap;
}

/**
 * Save or update credentials for a student in Supabase spmb_app_state and local cache
 */
export async function saveStudentAccountCredentials(cred: {
  studentId: string;
  registrationNumber: string;
  userEmail: string;
  fullName: string;
  username: string;
  password?: string;
}): Promise<void> {
  safeLoadCache();

  const record: StudentCredentialRecord = {
    ...cred,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Index by multiple keys for instant lookup
  inMemoryCredMap[cred.studentId] = record;
  if (cred.registrationNumber) inMemoryCredMap[cred.registrationNumber] = record;
  if (cred.userEmail) inMemoryCredMap[cred.userEmail.toLowerCase()] = record;
  if (cred.username) inMemoryCredMap[cred.username.toLowerCase()] = record;

  safeSaveCache(inMemoryCredMap);

  // Also save individually to localStorage for fallback compatibility
  if (typeof window !== 'undefined') {
    try {
      if (cred.password) {
        localStorage.setItem(`spmb_cred_${cred.studentId}`, cred.password);
        localStorage.setItem(`spmb_cred_${cred.registrationNumber}`, cred.password);
        localStorage.setItem(`spmb_cred_${cred.userEmail.toLowerCase()}`, cred.password);
        localStorage.setItem(`spmb_cred_${cred.username.toLowerCase()}`, cred.password);
      }
      localStorage.setItem(`spmb_user_${cred.studentId}`, cred.username);
      localStorage.setItem(`spmb_user_${cred.registrationNumber}`, cred.username);
      localStorage.setItem(`spmb_user_${cred.userEmail.toLowerCase()}`, cred.username);
      sessionStorage.setItem('spmb_last_student_username', cred.username);
      if (cred.password) {
        sessionStorage.setItem('spmb_last_student_password', cred.password);
      }
    } catch {}
  }

  // Push to Supabase spmb_app_state in background
  try {
    await supabase.from('spmb_app_state').upsert({
      key: 'student_account_credentials',
      payload: inMemoryCredMap,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
  } catch (e) {
    console.warn('[studentCredentials] Save to Supabase notice:', e);
  }
}

/**
 * Get credentials for a student by ID, Registration Number, or Email
 */
export function getStudentCredentials(
  identifier?: string
): StudentCredentialRecord | null {
  if (!identifier) return null;
  safeLoadCache();
  const clean = identifier.trim().toLowerCase();

  // Try direct or lowercased lookup
  const found = (
    inMemoryCredMap[identifier] ||
    inMemoryCredMap[clean] ||
    null
  );
  if (found) return found;

  // Local storage fallback for individual keys
  if (typeof window !== 'undefined') {
    try {
      const u = localStorage.getItem(`spmb_user_${identifier}`) || localStorage.getItem(`spmb_user_${clean}`);
      const p = localStorage.getItem(`spmb_cred_${identifier}`) || localStorage.getItem(`spmb_cred_${clean}`);
      if (u || p) {
        return {
          studentId: identifier,
          registrationNumber: identifier,
          userEmail: clean,
          fullName: '',
          username: u || '',
          password: p || '',
          createdAt: new Date().toISOString(),
        };
      }
    } catch {}
  }
  return null;
}
