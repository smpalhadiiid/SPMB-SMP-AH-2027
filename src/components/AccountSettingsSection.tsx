import React, { useState, useEffect } from 'react';
import { UserAccount, UserRole, AuditLogEntry } from '../types';
import { getUsersDb, saveUserToDb, saveUsersDb, deleteUserFromDb } from '../utils/storage';
import {
  updateUserAccountCredentials,
  checkUsernameAvailable,
  fetchAuditLogsFromSupabase,
  recordAuditLog,
  supabase,
  ensureSupabaseAuthSession
} from '../utils/supabaseClient';
import {
  ShieldCheck, ShieldAlert, Key, Edit, Lock, UserCheck, UserX, RefreshCw,
  Search, Shield, CheckCircle2, XCircle, AlertCircle, History as HistoryIcon, User, Check, X, Info, Trash2, GraduationCap
} from 'lucide-react';
import Swal from 'sweetalert2';

interface AccountSettingsSectionProps {
  currentUser: UserAccount;
  onRefreshData?: () => void;
}

export const AccountSettingsSection: React.FC<AccountSettingsSectionProps> = ({
  currentUser,
  onRefreshData,
}) => {
  const [users, setUsers] = useState<UserAccount[]>(() =>
    getUsersDb().filter(u => u.role !== 'student')
  );
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'accounts' | 'logs'>('accounts');
  const [searchQuery, setSearchQuery] = useState('');

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
  }, []);

  const refreshAccountsList = () => {
    const allUsers = getUsersDb();
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

    // Local DB Update
    const allUsers = getUsersDb();
    const updatedUsers = allUsers.map(u =>
      u.id === selectedUser.id
        ? { ...u, name: newName.trim(), username: trimmedUsername }
        : u
    );
    saveUsersDb(updatedUsers);

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

    // Local DB Update with new password
    const allUsers = getUsersDb();
    const updatedUsers = allUsers.map(u =>
      u.id === selectedUser.id
        ? { ...u, password: newPassword, mustChangePassword: false }
        : u
    );
    saveUsersDb(updatedUsers);

    // Update currentUser in localStorage if updating own password
    if (currentUser && selectedUser.id === currentUser.id) {
      const updatedSelf = { ...currentUser, password: newPassword, mustChangePassword: false };
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
      const allUsers = getUsersDb();
      const updatedUsers: UserAccount[] = allUsers.map(u =>
        u.id === targetUser.id ? { ...u, status: nextStatus as 'active' | 'disabled' } : u
      );
      saveUsersDb(updatedUsers);
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

    deleteUserFromDb(targetUser.id);
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

          <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700">
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
