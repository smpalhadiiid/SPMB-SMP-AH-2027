import { supabase, hashPassword, recordAuditLog } from './supabaseClient';
import { UserAccount, UserRole } from '../types';

export interface RoleDefaultCredential {
  role: 'super_admin' | 'admin' | 'kepsek' | 'student';
  roleLabel: string;
  defaultUsername: string;
  defaultEmail: string;
  defaultPassword: string;
  description: string;
  userId: string;
}

export interface DefaultCredentialsConfig {
  super_admin: RoleDefaultCredential;
  admin: RoleDefaultCredential;
  kepsek: RoleDefaultCredential;
  student: RoleDefaultCredential;
  updatedAt?: string;
  updatedBy?: string;
}

export const FACTORY_DEFAULT_CREDENTIALS: DefaultCredentialsConfig = {
  super_admin: {
    role: 'super_admin',
    roleLabel: 'Super Admin',
    defaultUsername: 'superadmin',
    defaultEmail: 'superadmin@alhadiid.sch.id',
    defaultPassword: 'admin123',
    description: 'Akses Pengelola Utama sistem SPMB & pengaturan keamanan tingkat tinggi.',
    userId: 'usr_superadmin',
  },
  admin: {
    role: 'admin',
    roleLabel: 'Panitia Admin',
    defaultUsername: 'admin',
    defaultEmail: 'admin@alhadiid.sch.id',
    defaultPassword: 'admin123',
    description: 'Akses Panitia SPMB untuk verifikasi formulir, bukti pembayaran, dan CBT.',
    userId: 'usr_admin',
  },
  kepsek: {
    role: 'kepsek',
    roleLabel: 'Kepala Sekolah',
    defaultUsername: 'kepsek',
    defaultEmail: 'kepsek@alhadiid.sch.id',
    defaultPassword: 'admin123',
    description: 'Akses Peninjauan dan Pengawasan oleh Kepala Sekolah.',
    userId: 'usr_kepsek',
  },
  student: {
    role: 'student',
    roleLabel: 'Calon Murid (Default)',
    defaultUsername: 'siswa',
    defaultEmail: 'siswa@alhadiid.sch.id',
    defaultPassword: 'siswa123',
    description: 'Akun pendaftaran calon murid baru.',
    userId: 'usr_student',
  },
};

const LOCAL_STORAGE_KEY = 'spmb_default_login_credentials_config';

let inMemoryConfig: DefaultCredentialsConfig = { ...FACTORY_DEFAULT_CREDENTIALS };

function loadLocalCache(): DefaultCredentialsConfig {
  if (typeof window === 'undefined') return inMemoryConfig;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        inMemoryConfig = {
          super_admin: { ...FACTORY_DEFAULT_CREDENTIALS.super_admin, ...(parsed.super_admin || {}) },
          admin: { ...FACTORY_DEFAULT_CREDENTIALS.admin, ...(parsed.admin || {}) },
          kepsek: { ...FACTORY_DEFAULT_CREDENTIALS.kepsek, ...(parsed.kepsek || {}) },
          student: { ...FACTORY_DEFAULT_CREDENTIALS.student, ...(parsed.student || {}) },
          updatedAt: parsed.updatedAt,
          updatedBy: parsed.updatedBy,
        };
      }
    }
  } catch {}
  return inMemoryConfig;
}

function saveLocalCache(config: DefaultCredentialsConfig): void {
  inMemoryConfig = { ...config };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
    } catch {}
  }
}

/**
 * Synchronous getter returning the active default credentials config
 */
export function getDefaultCredentials(): DefaultCredentialsConfig {
  return loadLocalCache();
}

/**
 * Asynchronously fetch the latest default credentials from Supabase spmb_app_state
 */
export async function fetchDefaultCredentialsFromSupabase(): Promise<DefaultCredentialsConfig> {
  loadLocalCache();
  try {
    const { data, error } = await supabase
      .from('spmb_app_state')
      .select('payload, updated_at')
      .eq('key', 'default_login_credentials')
      .maybeSingle();

    if (!error && data && data.payload && typeof data.payload === 'object') {
      const p = data.payload as any;
      const merged: DefaultCredentialsConfig = {
        super_admin: { ...FACTORY_DEFAULT_CREDENTIALS.super_admin, ...(p.super_admin || {}) },
        admin: { ...FACTORY_DEFAULT_CREDENTIALS.admin, ...(p.admin || {}) },
        kepsek: { ...FACTORY_DEFAULT_CREDENTIALS.kepsek, ...(p.kepsek || {}) },
        student: { ...FACTORY_DEFAULT_CREDENTIALS.student, ...(p.student || {}) },
        updatedAt: p.updatedAt || data.updated_at,
        updatedBy: p.updatedBy,
      };
      saveLocalCache(merged);
      return merged;
    }
  } catch (e) {
    console.warn('[defaultCredentials] Fetch error:', e);
  }
  return inMemoryConfig;
}

/**
 * Save updated default credentials for a role, persisting to:
 * 1. spmb_app_state table (key: 'default_login_credentials')
 * 2. public.users table (updates username and password_hash for the target role user)
 * 3. audit_logs table
 */
export async function saveDefaultCredentialForRole(params: {
  adminUser: UserAccount;
  targetRole: 'super_admin' | 'admin' | 'kepsek' | 'student';
  newUsername?: string;
  newEmail?: string;
  newPassword?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const current = loadLocalCache();
    const roleKey = params.targetRole;
    const targetItem = current[roleKey];

    const updatedUsername = (params.newUsername !== undefined ? params.newUsername : targetItem.defaultUsername).trim().toLowerCase();
    const updatedEmail = (params.newEmail !== undefined ? params.newEmail : targetItem.defaultEmail).trim().toLowerCase();
    const updatedPassword = (params.newPassword !== undefined ? params.newPassword : targetItem.defaultPassword).trim();

    if (!updatedUsername || updatedUsername.length < 3) {
      return { ok: false, error: 'Username default minimal 3 karakter!' };
    }
    if (!updatedPassword || updatedPassword.length < 6) {
      return { ok: false, error: 'Password default minimal 6 karakter!' };
    }

    const newTarget: RoleDefaultCredential = {
      ...targetItem,
      defaultUsername: updatedUsername,
      defaultEmail: updatedEmail,
      defaultPassword: updatedPassword,
    };

    const newConfig: DefaultCredentialsConfig = {
      ...current,
      [roleKey]: newTarget,
      updatedAt: new Date().toISOString(),
      updatedBy: params.adminUser?.name || params.adminUser?.email || 'Super Admin',
    };

    // 1. Update public.spmb_app_state
    const { error: stateErr } = await supabase.from('spmb_app_state').upsert({
      key: 'default_login_credentials',
      payload: newConfig,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

    if (stateErr) {
      console.warn('spmb_app_state update notice:', stateErr.message);
    }

    // 2. Update public.users table for the system default account
    const targetUserId = targetItem.userId;
    const hashedPassword = await hashPassword(updatedPassword);

    // Upsert/Update the user record
    const { error: userErr } = await supabase.from('users').upsert({
      id: targetUserId,
      name: targetItem.roleLabel,
      email: updatedEmail,
      username: updatedUsername,
      phone: '08123456789',
      role: targetItem.role,
      registration_number: targetItem.role === 'student' ? 'SPMB20270000' : undefined,
      password_hash: hashedPassword,
      status: 'active',
      must_change_password: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    if (userErr) {
      console.warn('public.users update notice for default role:', userErr.message);
    }

    // 3. Record Audit Log
    try {
      await recordAuditLog({
        adminId: params.adminUser?.id || 'usr_superadmin',
        adminName: params.adminUser?.name || 'Super Admin',
        action: 'UPDATE_PASSWORD',
        targetUserId: targetItem.userId,
        targetUserName: `${targetItem.roleLabel} (Default Credentials)`,
        details: `Mengubah username default menjadi "${updatedUsername}" dan memperbarui password login default.`,
      });
    } catch {}

    saveLocalCache(newConfig);
    return { ok: true };
  } catch (err: any) {
    console.error('saveDefaultCredentialForRole error:', err);
    return { ok: false, error: err?.message || 'Gagal menyimpan kredensial default' };
  }
}

/**
 * Reset default credentials for a role back to factory defaults
 */
export async function resetDefaultCredentialToFactory(params: {
  adminUser: UserAccount;
  targetRole: 'super_admin' | 'admin' | 'kepsek' | 'student';
}): Promise<{ ok: boolean; error?: string }> {
  const factory = FACTORY_DEFAULT_CREDENTIALS[params.targetRole];
  return saveDefaultCredentialForRole({
    adminUser: params.adminUser,
    targetRole: params.targetRole,
    newUsername: factory.defaultUsername,
    newEmail: factory.defaultEmail,
    newPassword: factory.defaultPassword,
  });
}
