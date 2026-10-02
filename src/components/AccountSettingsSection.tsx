import React, { useState, useEffect } from 'react';
import { UserAccount, UserRole, AuditLogEntry } from '../types';
import { getUsersDb, saveUserToDb, cacheUsersDbOnly, deleteUserFromDb } from '../utils/storage';
import {
  updateUserAccountCredentials,
  checkUsernameAvailable,
  fetchAuditLogsFromSupabase,
  recordAuditLog,
  supabase,
  ensureSupabaseAuthSession,
  fetchUsersDbFromSupabase
} from '../utils/supabaseClient';
import { UserProfileRepository } from '../repositories/UserProfileRepository';
import {
  DefaultCredentialsConfig,
  RoleDefaultCredential,
  getDefaultCredentials,
  fetchDefaultCredentialsFromSupabase,
  saveDefaultCredentialForRole,
  resetDefaultCredentialToFactory,
  FACTORY_DEFAULT_CREDENTIALS,
} from '../utils/defaultCredentials';
import {
  ShieldCheck, ShieldAlert, Key, Edit, Lock, UserCheck, UserX, RefreshCw,
  Search, Shield, CheckCircle2, XCircle, AlertCircle, History as HistoryIcon, User, Check, X, Info, Trash2, GraduationCap,
  Eye, EyeOff, RotateCcw, Sparkles
} from 'lucide-react';
import Swal from 'sweetalert2';

interface AccountSettingsSectionProps {
  currentUser: UserAccount;
  initialTab?: 'accounts' | 'default_credentials' | 'logs';
  onRefreshData?: () => void;
}

export const AccountSettingsSection: React.FC<AccountSettingsSectionProps> = ({
  currentUser,
  initialTab = 'accounts',
  onRefreshData,
}) => {
  const [users, setUsers] = useState<UserAccount[]>(() =>
    getUsersDb().filter(u => u.role !== 'student')
  );
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'accounts' | 'default_credentials' | 'logs'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Default credentials state & management
  const [defaultsConfig, setDefaultsConfig] = useState<DefaultCredentialsConfig>(() => getDefaultCredentials());
  const [isFetchingDefaults, setIsFetchingDefaults] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  // Modal Ubah Kredensial Default
  const [showDefaultModal, setShowDefaultModal] = useState(false);
  const [targetDefaultRole, setTargetDefaultRole] = useState<'super_admin' | 'admin' | 'kepsek' | 'student' | null>(null);
  const [formDefaultUsername, setFormDefaultUsername] = useState('');
  const [formDefaultEmail, setFormDefaultEmail] = useState('');
  const [formDefaultPassword, setFormDefaultPassword] = useState('');
  const [formDefaultConfirm, setFormDefaultConfirm] = useState('');
  const [showDefaultPassInput, setShowDefaultPassInput] = useState(false);
  const [defaultFormError, setDefaultFormError] = useState('');
  const [isSavingDefault, setIsSavingDefault] = useState(false);

  // Modals
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);

  // Form states
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Access Control Guard
  const isSuperAdmin = currentUser?.role === 'super_admin' || currentUser?.email === 'superadmin@alhadiid.sch.id';

  useEffect(() => {
    refreshAccountsList();
    loadAuditLogs();
    loadDefaultCredentials();
  }, []);

  const loadDefaultCredentials = async () => {
    setIsFetchingDefaults(true);
    try {
      const cfg = await fetchDefaultCredentialsFromSupabase();
      if (cfg) setDefaultsConfig(cfg);
    } catch (e) {
      console.warn('loadDefaultCredentials error:', e);
    } finally {
      setIsFetchingDefaults(false);
    }
  };

  const togglePasswordVisibility = (roleKey: string) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [roleKey]: !prev[roleKey],
    }));
  };

  const handleOpenEditDefault = (role: 'super_admin' | 'admin' | 'kepsek' | 'student') => {
    const item = defaultsConfig[role];
    setTargetDefaultRole(role);
    setFormDefaultUsername(item.defaultUsername);
    setFormDefaultEmail(item.defaultEmail);
    setFormDefaultPassword(item.defaultPassword);
    setFormDefaultConfirm(item.defaultPassword);
    setShowDefaultPassInput(false);
    setDefaultFormError('');
    setShowDefaultModal(true);
  };

  const handleSaveDefault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDefaultRole) return;
    setDefaultFormError('');

    const cleanUsername = formDefaultUsername.trim().toLowerCase();
    const cleanEmail = formDefaultEmail.trim().toLowerCase();
    const cleanPass = formDefaultPassword.trim();

    if (!cleanUsername || cleanUsername.length < 3) {
      setDefaultFormError('Username default minimal 3 karakter!');
      return;
    }

    if (!cleanPass || cleanPass.length < 6) {
      setDefaultFormError('Password default minimal 6 karakter!');
      return;
    }

    if (cleanPass !== formDefaultConfirm.trim()) {
      setDefaultFormError('Konfirmasi password tidak cocok dengan password baru!');
      return;
    }

    const roleName = defaultsConfig[targetDefaultRole].roleLabel;

    const confirmRes = await Swal.fire({
      title: `Simpan Kredensial ${roleName}?`,
      html: `
        <div style="text-align: left; font-size: 13px; color: #334155; line-height: 1.6;">
          <p style="margin-bottom: 8px;">Perubahan ini akan otomatis memperbarui database dan login cepat:</p>
          <div style="background-color: #f1f5f9; padding: 10px; border-radius: 10px; margin-bottom: 8px;">
            <div>👤 <strong>Username Baru:</strong> <code>${cleanUsername}</code></div>
            <div>📧 <strong>Email Login:</strong> <code>${cleanEmail}</code></div>
            <div>🔑 <strong>Password Baru:</strong> <code>${cleanPass}</code></div>
          </div>
          <p style="color: #059669; font-size: 11px;">
            ✓ Tersinkronisasi ke <strong>public.users</strong> dan <strong>spmb_app_state</strong> di Supabase.
          </p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Simpan Kredensial',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#64748b',
      customClass: { popup: 'rounded-2xl font-sans' },
    });

    if (!confirmRes.isConfirmed) return;

    setIsSavingDefault(true);
    const saveRes = await saveDefaultCredentialForRole({
      adminUser: currentUser,
      targetRole: targetDefaultRole,
      newUsername: cleanUsername,
      newEmail: cleanEmail,
      newPassword: cleanPass,
    });
    setIsSavingDefault(false);

    if (!saveRes.ok) {
      setDefaultFormError(saveRes.error || 'Gagal menyimpan kredensial default.');
      return;
    }

    setShowDefaultModal(false);
    await loadDefaultCredentials();
    await refreshAccountsList();
    await loadAuditLogs();
    if (onRefreshData) onRefreshData();

    Swal.fire({
      icon: 'success',
      title: 'Kredensial Default Berhasil Diubah!',
      text: `Username dan password default untuk ${roleName} telah diperbarui dan langsung aktif.`,
      timer: 2500,
      showConfirmButton: false,
      customClass: { popup: 'rounded-2xl font-sans' },
    });
  };

  const handleResetDefault = async (role: 'super_admin' | 'admin' | 'kepsek' | 'student') => {
    const factory = FACTORY_DEFAULT_CREDENTIALS[role];
    const roleName = factory.roleLabel;

    const confirmRes = await Swal.fire({
      title: `Reset Kredensial ${roleName}?`,
      html: `
        <div style="text-align: left; font-size: 13px; color: #334155; line-height: 1.6;">
          <p style="margin-bottom: 8px;">Kredensial akan dikembalikan ke setelan awal pabrik:</p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 10px;">
            <div>👤 <strong>Username:</strong> <code>${factory.defaultUsername}</code></div>
            <div>🔑 <strong>Password:</strong> <code>${factory.defaultPassword}</code></div>
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Kembalikan ke Awal',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#d97706',
      cancelButtonColor: '#64748b',
      customClass: { popup: 'rounded-2xl font-sans' },
    });

    if (!confirmRes.isConfirmed) return;

    const res = await resetDefaultCredentialToFactory({
      adminUser: currentUser,
      targetRole: role,
    });

    if (res.ok) {
      await loadDefaultCredentials();
      await refreshAccountsList();
      await loadAuditLogs();
      if (onRefreshData) onRefreshData();

      Swal.fire({
        icon: 'success',
        title: 'Kredensial Dikembalikan ke Default',
        text: `Kredensial ${roleName} berhasil direset ke username "${factory.defaultUsername}" dan password "${factory.defaultPassword}".`,
        timer: 2000,
        showConfirmButton: false,
        customClass: { popup: 'rounded-2xl font-sans' },
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Reset',
        text: res.error || 'Terjadi kendala saat mereset kredensial.',
        customClass: { popup: 'rounded-2xl font-sans' },
      });
    }
  };

  const refreshAccountsList = async () => {
    try {
      const { data, error } = await UserProfileRepository.listForAdmin();
      if (!error && data && data.length > 0) {
        const staff = data.filter(u => u.role !== 'student');
        setUsers(staff);
        cacheUsersDbOnly(data);
        return;
      }
      const cloudUsers = await fetchUsersDbFromSupabase();
      if (cloudUsers && cloudUsers.length > 0) {
        const staff = cloudUsers.filter(u => u.role !== 'student');
        setUsers(staff);
        cacheUsersDbOnly(cloudUsers);
        return;
      }
    } catch (e) {
      console.warn('refreshAccountsList error:', e);
    }
    const allUsers = getUsersDb().filter(u => u.role !== 'student');
    setUsers(allUsers);
  };

  const loadAuditLogs = async () => {
    const logs = await fetchAuditLogsFromSupabase();
    if (logs) {
      setAuditLogs(logs);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-8 text-center max-w-2xl mx-auto my-12 text-red-200">
        <ShieldAlert className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold mb-2">Akses Dibatasi (Super Admin Only)</h3>
        <p className="text-sm text-red-300/80">
          Halaman Pengaturan Akun Pengguna hanya dapat diakses oleh Panitia Utama (Super Admin).
          Akses Anda dengan role <span className="font-semibold capitalize text-white">{currentUser?.role || 'Guest'}</span> tidak diizinkan.
        </p>
      </div>
    );
  }

  // Handle Edit Username
  const handleOpenEditUsername = (user: UserAccount) => {
    setSelectedUser(user);
    setNewName(user.name);
    setNewUsername(user.username || user.email.split('@')[0]);
    setFormError('');
    setShowUsernameModal(true);
  };

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFormError('');

    const trimmedUsername = newUsername.trim().toLowerCase();
    if (!trimmedUsername) {
      setFormError('Username tidak boleh kosong!');
      return;
    }

    if (trimmedUsername.length < 3) {
      setFormError('Username minimal 3 karakter!');
      return;
    }

    // Check unique username
    const checkRes = await checkUsernameAvailable(trimmedUsername, selectedUser.id);
    if (!checkRes.available) {
      setFormError(checkRes.message || 'Username sudah digunakan. Silakan gunakan username lain.');
      return;
    }

    // SweetAlert2 Confirmation
    const result = await Swal.fire({
      title: 'Konfirmasi Perubahan Username',
      text: `Apakah Anda yakin ingin mengubah username akun ${selectedUser.name} menjadi "${trimmedUsername}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Simpan Perubahan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#64748b',
      customClass: { popup: 'rounded-2xl font-sans' },
    });

    if (!result.isConfirmed) return;

    setIsSubmitting(true);
    const updateRes = await updateUserAccountCredentials({
      adminUser: currentUser,
      targetUserId: selectedUser.id,
      newUsername: trimmedUsername,
      newName: newName.trim(),
    });
    setIsSubmitting(false);

    if (!updateRes.ok) {
      setFormError(updateRes.error || 'Gagal memperbarui username.');
      return;
    }

    // Direct React state & read cache update
    setUsers(prev => prev.map(u =>
      u.id === selectedUser.id
        ? { ...u, name: newName.trim(), username: trimmedUsername }
        : u
    ));
    const allUsers = getUsersDb();
    const updatedUsers = allUsers.map(u =>
      u.id === selectedUser.id
        ? { ...u, name: newName.trim(), username: trimmedUsername }
        : u
    );
    cacheUsersDbOnly(updatedUsers);

    setShowUsernameModal(false);
    refreshAccountsList();
    loadAuditLogs();

    Swal.fire({
      icon: 'success',
      title: 'Username Berhasil Diperbarui',
      text: 'Perubahan akun berhasil disimpan.',
      timer: 2000,
      showConfirmButton: false,
      customClass: { popup: 'rounded-2xl font-sans' },
    });
  };

  // Handle Edit/Reset Password
  const handleOpenEditPassword = async (user: UserAccount) => {
    // Try to ensure active Supabase session in background if possible
    const { data: { session } } = await supabase.auth.getSession();
    if (!session && currentUser && currentUser.password) {
      await ensureSupabaseAuthSession(
        currentUser.email,
        currentUser.password,
        currentUser
      );
    }
    setSelectedUser(user);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setFormError('');
    setShowPasswordModal(true);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFormError('');

    if (!newPassword) {
      setFormError('Password baru tidak boleh kosong!');
      return;
    }

    if (newPassword.length < 8) {
      setFormError('Password minimal 8 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError('Konfirmasi password tidak sesuai.');
      return;
    }

    // Try background refresh of Supabase session if password is present
    const { data: { session } } = await supabase.auth.getSession();
    if (!session && currentUser && currentUser.password) {
      await ensureSupabaseAuthSession(
        currentUser.email,
        currentUser.password,
        currentUser
      );
    }

    // SweetAlert2 Confirmation
    const result = await Swal.fire({
      title: 'Konfirmasi Perubahan Password',
      text: `Apakah Anda yakin ingin mengubah password akun ${selectedUser.name}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Simpan Perubahan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      customClass: { popup: 'rounded-2xl font-sans' },
    });

    if (!result.isConfirmed) return;

    setIsSubmitting(true);
    const updateRes = await updateUserAccountCredentials({
      adminUser: currentUser,
      targetUserId: selectedUser.id,
      newPassword,
      newName: selectedUser.name,
    });
    setIsSubmitting(false);

    if (!updateRes.ok) {
      setFormError(updateRes.error || 'Gagal memperbarui password.');
      return;
    }

    // Direct React state & read cache update (never store plaintext password)
    setUsers(prev => prev.map(u =>
      u.id === selectedUser.id
        ? { ...u, mustChangePassword: false }
        : u
    ));
    const allUsers = getUsersDb();
    const updatedUsers = allUsers.map(u =>
      u.id === selectedUser.id
        ? { ...u, mustChangePassword: false }
        : u
    );
    cacheUsersDbOnly(updatedUsers);

    // Update currentUser in localStorage if updating own password (without plaintext password)
    if (currentUser && selectedUser.id === currentUser.id) {
      const updatedSelf = { ...currentUser, mustChangePassword: false };
      delete (updatedSelf as any).password;
      saveUserToDb(updatedSelf);
    }

    setShowPasswordModal(false);
    refreshAccountsList();
    loadAuditLogs();

    Swal.fire({
      icon: 'success',
      title: 'Password Berhasil Diubah!',
      text: 'Password akun Supabase Auth dan database berhasil diperbarui.',
      timer: 2000,
      showConfirmButton: false,
      customClass: { popup: 'rounded-2xl font-sans' },
    });
  };

  // Handle Toggle Status (Active / Disabled)
  const handleToggleStatus = async (targetUser: UserAccount) => {
    const isTargetSuperAdmin = targetUser.role === 'super_admin';
    const activeSuperAdmins = users.filter(u => u.role === 'super_admin' && (u.status || 'active') === 'active');

    if (isTargetSuperAdmin && (targetUser.status || 'active') === 'active' && activeSuperAdmins.length <= 1) {
      Swal.fire({
        icon: 'error',
        title: 'Tindakan Ditolak',
        text: 'Minimal harus terdapat satu akun Super Admin yang aktif.',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-2xl font-sans' },
      });
      return;
    }

    const nextStatus = (targetUser.status || 'active') === 'active' ? 'disabled' : 'active';
    const actionText = nextStatus === 'active' ? 'Mengaktifkan' : 'Menonaktifkan';

    const result = await Swal.fire({
      title: `Konfirmasi ${actionText} Akun`,
      text: `Apakah Anda yakin ingin ${actionText.toLowerCase()} akun ${targetUser.name}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: `Ya, ${actionText}`,
      cancelButtonText: 'Batal',
      confirmButtonColor: nextStatus === 'active' ? '#10b981' : '#ef4444',
      cancelButtonColor: '#64748b',
      customClass: { popup: 'rounded-2xl font-sans' },
    });

    if (!result.isConfirmed) return;

    const res = await updateUserAccountCredentials({
      adminUser: currentUser,
      targetUserId: targetUser.id,
      newStatus: nextStatus,
      newName: targetUser.name,
    });

    if (res.ok) {
      setUsers(prev => prev.map(u =>
        u.id === targetUser.id ? { ...u, status: nextStatus as 'active' | 'disabled' } : u
      ));
      const allUsers = getUsersDb();
      const updatedUsers: UserAccount[] = allUsers.map(u =>
        u.id === targetUser.id ? { ...u, status: nextStatus as 'active' | 'disabled' } : u
      );
      cacheUsersDbOnly(updatedUsers);
      refreshAccountsList();
      loadAuditLogs();

      Swal.fire({
        icon: 'success',
        title: 'Status Akun Diperbarui',
        text: 'Perubahan akun berhasil disimpan.',
        timer: 1500,
        showConfirmButton: false,
        customClass: { popup: 'rounded-2xl font-sans' },
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Gagal',
        text: res.error || 'Gagal mengubah status akun.',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-2xl font-sans' },
      });
    }
  };

  // Handle Delete User (Super Admin Delete)
  const handleDeleteUser = async (targetUser: UserAccount) => {
    if (currentUser && targetUser.id === currentUser.id) {
      Swal.fire({
        icon: 'error',
        title: 'Tindakan Ditolak',
        text: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif digunakan.',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-2xl font-sans' },
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Hapus Akun Pengguna?',
      html: `
        <div style="text-align: left; font-size: 13px; color: #334155; line-height: 1.6;">
          <p style="margin-bottom: 8px;">Apakah Anda yakin ingin menghapus akun panitia/admin berikut?</p>
          <div style="background: #f1f5f9; padding: 10px; border-radius: 10px; font-weight: 600; margin-bottom: 8px;">
            <div>• Nama: <b>${targetUser.name}</b></div>
            <div>• Email: <b>${targetUser.email}</b></div>
            <div>• Role: <b>${targetUser.role.toUpperCase()}</b></div>
          </div>
          <p style="color: #dc2626; font-weight: 700;">
            ⚠️ Perhatian: Akun yang dihapus oleh Super Admin tidak akan bisa digunakan untuk login lagi.
          </p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus Akun',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      customClass: { popup: 'rounded-2xl font-sans' },
    });

    if (!result.isConfirmed) return;

    await UserProfileRepository.remove(targetUser.id);
    deleteUserFromDb(targetUser.id);
    setUsers(prev => prev.filter(u => u.id !== targetUser.id));
    refreshAccountsList();
    loadAuditLogs();

    Swal.fire({
      icon: 'success',
      title: 'Akun Berhasil Dihapus',
      text: `Akun "${targetUser.name}" (${targetUser.email}) telah dihapus secara permanen oleh Super Admin.`,
      timer: 2000,
      showConfirmButton: false,
      customClass: { popup: 'rounded-2xl font-sans' },
    });
  };

  const filteredUsers = users.filter(
    u =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-blue-800/40 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-blue-600/20 border border-blue-500/30 rounded-2xl text-blue-400">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Pengaturan Akun Pengguna</h2>
              <p className="text-slate-300 text-sm mt-1">
                Kelola kredensial username & password terenkripsi untuk Admin/Panitia SPMB dan Kepala Sekolah
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700">
            <button
              onClick={() => setActiveTab('accounts')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'accounts'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <User className="w-4 h-4" /> Daftar Akun
            </button>
            <button
              onClick={() => setActiveTab('default_credentials')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'default_credentials'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Key className="w-4 h-4" /> Kredensial Login Default
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'logs'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <HistoryIcon className="w-4 h-4" /> Audit Log ({auditLogs.length})
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'accounts' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          {/* Search bar & info notice */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama atau username..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 px-3 py-2 rounded-xl border border-slate-800">
              <Info className="w-4 h-4 text-blue-400" />
              <span>Password terenkripsi via Supabase Auth. Tanpa plain-text storage.</span>
            </div>
          </div>

          {/* Accounts Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs text-slate-400 uppercase border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">No</th>
                  <th className="py-3.5 px-4">Nama</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Username</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Aksi Kredensial</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 text-sm">
                      Tidak ada akun pengelola yang ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user, idx) => {
                    const isSuper = user.role === 'super_admin';
                    const isKepsek = user.role === 'kepsek';
                    const isStudent = user.role === 'student';
                    const isActive = (user.status || 'active') === 'active';

                    return (
                      <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-500">{idx + 1}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">{user.name}</div>
                          <div className="text-xs text-slate-400">{user.email}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          {isSuper ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              <ShieldCheck className="w-3.5 h-3.5" /> Super Admin
                            </span>
                          ) : isKepsek ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              <Shield className="w-3.5 h-3.5" /> Kepala Sekolah
                            </span>
                          ) : isStudent ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              <GraduationCap className="w-3.5 h-3.5" /> Calon Murid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              <User className="w-3.5 h-3.5" /> Panitia SPMB
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-blue-300">
                          @{user.username || user.email.split('@')[0]}
                        </td>
                        <td className="py-3.5 px-4">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" /> Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                              <XCircle className="w-3 h-3" /> Nonaktif
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEditUsername(user)}
                              className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-blue-600 rounded-xl transition-colors border border-slate-700 text-xs flex items-center gap-1.5"
                              title="Ubah Username"
                            >
                              <Edit className="w-3.5 h-3.5 text-blue-400" />
                              <span className="hidden md:inline">Ubah Username</span>
                            </button>

                            <button
                              onClick={() => handleOpenEditPassword(user)}
                              className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-emerald-600 rounded-xl transition-colors border border-slate-700 text-xs flex items-center gap-1.5"
                              title="Ubah / Reset Password"
                            >
                              <Key className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="hidden md:inline">Password</span>
                            </button>

                            <button
                              onClick={() => handleToggleStatus(user)}
                              className={`p-2 rounded-xl transition-colors border text-xs flex items-center gap-1.5 ${
                                isActive
                                  ? 'bg-red-900/30 text-red-300 hover:bg-red-600 border-red-800/50'
                                  : 'bg-emerald-900/30 text-emerald-300 hover:bg-emerald-600 border-emerald-800/50'
                              }`}
                              title={isActive ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                            >
                              {isActive ? (
                                <>
                                  <UserX className="w-3.5 h-3.5" />
                                  <span className="hidden lg:inline">Nonaktifkan</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span className="hidden lg:inline">Aktifkan</span>
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => handleDeleteUser(user)}
                              disabled={Boolean(currentUser && user.id === currentUser.id)}
                              className={`p-2 rounded-xl transition-colors border text-xs flex items-center gap-1.5 ${
                                currentUser && user.id === currentUser.id
                                  ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'
                                  : 'bg-rose-900/30 text-rose-300 hover:bg-rose-600 border-rose-800/50 cursor-pointer'
                              }`}
                              title={currentUser && user.id === currentUser.id ? 'Akun Anda Sendiri' : 'Hapus Akun'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden lg:inline">Hapus</span>
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
      )}

      {/* Audit Log Tab */}
      {activeTab === 'logs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <HistoryIcon className="w-5 h-5 text-blue-400" /> Riwayat Perubahan Akun (Audit Logs)
            </h3>
            <button
              onClick={loadAuditLogs}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-colors border border-slate-700 text-xs flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Log
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Admin Pelaku</th>
                  <th className="py-3 px-4">Aksi</th>
                  <th className="py-3 px-4">Target User</th>
                  <th className="py-3 px-4">Detail Perubahan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      Belum ada catatan aktivitas perubahan akun.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-mono">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString('id-ID') : '-'}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-200">{log.adminName}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded font-mono font-bold bg-blue-900/40 text-blue-300 border border-blue-800/50">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-200">{log.targetUserName}</td>
                      <td className="py-3 px-4 text-slate-300">{log.details || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: KREDENSIAL LOGIN DEFAULT */}
      {activeTab === 'default_credentials' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400">
                  <Key className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Kredensial Login Default SPMB
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-700/60">
                      Super Admin Only
                    </span>
                  </h3>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Ubah username, email login, dan password default resmi sistem. Perubahan otomatis disinkronkan ke database Supabase dan langsung berlaku saat login.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Tersinkron Database</span>
                </div>
                <button
                  type="button"
                  onClick={loadDefaultCredentials}
                  disabled={isFetchingDefaults}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-700 cursor-pointer disabled:opacity-50"
                  title="Muat ulang dari Supabase"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetchingDefaults ? 'animate-spin text-amber-400' : ''}`} />
                  <span>{isFetchingDefaults ? 'Memuat...' : 'Refresh'}</span>
                </button>
              </div>
            </div>

            {/* Info callout */}
            <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200/90 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-300">
                  Keamanan & Dampak Perubahan Kredensial Default:
                </p>
                <p className="text-amber-200/80 text-[11px] leading-relaxed">
                  1. Mengubah username atau password di sini akan langsung memperbarui data di tabel <strong>public.users</strong> dan <strong>public.spmb_app_state</strong>.<br/>
                  2. Tombol bantuan login cepat ("Akun Default") di halaman login murid & pengelola akan otomatis menyesuaikan dengan username dan password baru ini.<br/>
                  3. Jika sewaktu-waktu dibutuhkan, Anda dapat mengembalikan setelan akun ke setelan awal pabrik menggunakan tombol <strong>Reset Pabrik</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Role Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 1. SUPER ADMIN CARD */}
            {(() => {
              const item = defaultsConfig.super_admin;
              const isPassRevealed = !!revealedPasswords['super_admin'];
              return (
                <div className="bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-400">
                          <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-white text-base">Super Admin SPMB</div>
                          <div className="text-[11px] text-amber-400/90 font-medium">Pengelola Utama & Keamanan</div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-950 border border-amber-500/50 text-amber-300 uppercase">
                        SUPER ADMIN
                      </span>
                    </div>

                    <p className="text-slate-400 text-xs leading-relaxed">
                      {item.description}
                    </p>

                    {/* Credential Box */}
                    <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-2.5 text-xs font-mono">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="text-slate-400 font-sans text-[11px]">Username Default:</span>
                        <span className="font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-900/50">
                          {item.defaultUsername}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="text-slate-400 font-sans text-[11px]">Email Login:</span>
                        <span className="text-slate-300 font-semibold">{item.defaultEmail}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-sans text-[11px]">Password Default:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900/50">
                            {isPassRevealed ? item.defaultPassword : '••••••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility('super_admin')}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                            title={isPassRevealed ? 'Sembunyikan Password' : 'Lihat Password'}
                          >
                            {isPassRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-5 border-t border-slate-800/80 mt-5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditDefault('super_admin')}
                      className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Ubah Kredensial</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResetDefault('super_admin')}
                      className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                      title="Kembalikan ke username & password awal pabrik"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* 2. PANITIA ADMIN CARD */}
            {(() => {
              const item = defaultsConfig.admin;
              const isPassRevealed = !!revealedPasswords['admin'];
              return (
                <div className="bg-slate-900/90 border border-blue-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-blue-600/20 border border-blue-500/40 rounded-xl text-blue-400">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-white text-base">Panitia SPMB</div>
                          <div className="text-[11px] text-blue-400/90 font-medium">Verifikator Berkas & CBT</div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-950 border border-blue-500/50 text-blue-300 uppercase">
                        PANITIA ADMIN
                      </span>
                    </div>

                    <p className="text-slate-400 text-xs leading-relaxed">
                      {item.description}
                    </p>

                    {/* Credential Box */}
                    <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-2.5 text-xs font-mono">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="text-slate-400 font-sans text-[11px]">Username Default:</span>
                        <span className="font-bold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-900/50">
                          {item.defaultUsername}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="text-slate-400 font-sans text-[11px]">Email Login:</span>
                        <span className="text-slate-300 font-semibold">{item.defaultEmail}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-sans text-[11px]">Password Default:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900/50">
                            {isPassRevealed ? item.defaultPassword : '••••••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility('admin')}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                            title={isPassRevealed ? 'Sembunyikan Password' : 'Lihat Password'}
                          >
                            {isPassRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-5 border-t border-slate-800/80 mt-5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditDefault('admin')}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Ubah Kredensial</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResetDefault('admin')}
                      className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                      title="Kembalikan ke username & password awal pabrik"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* 3. KEPSEK CARD */}
            {(() => {
              const item = defaultsConfig.kepsek;
              const isPassRevealed = !!revealedPasswords['kepsek'];
              return (
                <div className="bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-emerald-600/20 border border-emerald-500/40 rounded-xl text-emerald-400">
                          <GraduationCap className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-white text-base">Kepala Sekolah</div>
                          <div className="text-[11px] text-emerald-400/90 font-medium">Peninjau & Supervisi</div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950 border border-emerald-500/50 text-emerald-300 uppercase">
                        KEPALA SEKOLAH
                      </span>
                    </div>

                    <p className="text-slate-400 text-xs leading-relaxed">
                      {item.description}
                    </p>

                    {/* Credential Box */}
                    <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-2.5 text-xs font-mono">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="text-slate-400 font-sans text-[11px]">Username Default:</span>
                        <span className="font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900/50">
                          {item.defaultUsername}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="text-slate-400 font-sans text-[11px]">Email Login:</span>
                        <span className="text-slate-300 font-semibold">{item.defaultEmail}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-sans text-[11px]">Password Default:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900/50">
                            {isPassRevealed ? item.defaultPassword : '••••••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility('kepsek')}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                            title={isPassRevealed ? 'Sembunyikan Password' : 'Lihat Password'}
                          >
                            {isPassRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-5 border-t border-slate-800/80 mt-5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditDefault('kepsek')}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Ubah Kredensial</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResetDefault('kepsek')}
                      className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                      title="Kembalikan ke username & password awal pabrik"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* 4. STUDENT DEMO CARD */}
            {(() => {
              const item = defaultsConfig.student;
              const isPassRevealed = !!revealedPasswords['student'];
              return (
                <div className="bg-slate-900/90 border border-indigo-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/40 rounded-xl text-indigo-400">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-white text-base">Akun Calon Murid (Default)</div>
                          <div className="text-[11px] text-indigo-400/90 font-medium">Preset Kredensial Login Siswa</div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-950 border border-indigo-500/50 text-indigo-300 uppercase">
                        CALON MURID
                      </span>
                    </div>

                    <p className="text-slate-400 text-xs leading-relaxed">
                      {item.description}
                    </p>

                    {/* Credential Box */}
                    <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-2.5 text-xs font-mono">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="text-slate-400 font-sans text-[11px]">Username Default:</span>
                        <span className="font-bold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-900/50">
                          {item.defaultUsername}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-sans text-[11px]">Password Default:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900/50">
                            {isPassRevealed ? item.defaultPassword : '••••••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility('student')}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                            title={isPassRevealed ? 'Sembunyikan Password' : 'Lihat Password'}
                          >
                            {isPassRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-5 border-t border-slate-800/80 mt-5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditDefault('student')}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Ubah Kredensial</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResetDefault('student')}
                      className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                      title="Kembalikan ke username & password awal pabrik"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal Edit Username */}
      {showUsernameModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-400" /> Ubah Username Akun
              </h3>
              <button
                onClick={() => setShowUsernameModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUsername} className="space-y-4">
              {formError && (
                <div className="bg-red-900/30 border border-red-500/40 p-3 rounded-xl text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nama Pengguna</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Username Lama</label>
                <input
                  type="text"
                  value={selectedUser.username || selectedUser.email.split('@')[0]}
                  disabled
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Username Baru</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  placeholder="Contoh: panitia_spmb"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  required
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Username harus unik dan minimal 3 karakter.
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUsernameModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-600/30"
                >
                  {isSubmitting ? 'Memproses...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit / Reset Password */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-400" /> Ubah / Reset Password
              </h3>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePassword} className="space-y-4">
              {formError && (
                <div className="bg-red-900/30 border border-red-500/40 p-3 rounded-xl text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Target Akun</label>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="font-semibold text-white text-sm">{selectedUser.name}</div>
                  <div className="text-xs text-blue-400">@{selectedUser.username || selectedUser.email.split('@')[0]}</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Password Baru</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Konfirmasi Password Baru</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/30"
                >
                  {isSubmitting ? 'Memproses...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
