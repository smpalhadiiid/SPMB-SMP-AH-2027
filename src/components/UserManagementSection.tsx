import React, { useState } from 'react';
import { UserAccount, UserRole, StudentData } from '../types';
import { getUsersDb, saveUserToDb, deleteUserFromDb, saveUsersDb, ensureStudentDataExists, setCurrentUser } from '../utils/storage';
import { signUpWithSupabase, updateUserAccountCredentials } from '../utils/supabaseClient';
import Swal from 'sweetalert2';
import {
  Users, UserPlus, Shield, ShieldAlert, ShieldCheck, GraduationCap,
  Search, Filter, Edit, Trash2, Key, RefreshCw, CheckCircle2, XCircle,
  Mail, Phone, Lock, Calendar, AlertCircle, Database, Check, X
} from 'lucide-react';

interface UserManagementSectionProps {
  currentUser: UserAccount;
  students: StudentData[];
  onUpdateStudents: (updated: StudentData[]) => void;
  onRefreshAllData?: () => void;
}

export const UserManagementSection: React.FC<UserManagementSectionProps> = ({
  currentUser,
  students,
  onUpdateStudents,
  onRefreshAllData,
}) => {
  const [users, setUsers] = useState<UserAccount[]>(() => getUsersDb());
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'super_admin' | 'admin' | 'kepsek' | 'student'>('all');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'student' as UserRole,
    password: '',
    status: 'active' as 'active' | 'disabled',
  });

  const [newPassword, setNewPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const refreshUsers = () => {
    const list = getUsersDb();
    setUsers(list);
  };

  // Sync Student accounts to Students list rekap
  const handleSyncStudentData = () => {
    let currentStudents = [...students];
    const studentUsers = users.filter(u => u.role === 'student');
    let addedCount = 0;

    studentUsers.forEach(su => {
      const initialLength = currentStudents.length;
      currentStudents = ensureStudentDataExists(su, currentStudents);
      if (currentStudents.length > initialLength) {
        addedCount++;
      }
    });

    if (addedCount > 0) {
      onUpdateStudents(currentStudents);
      setSuccessMsg(`✓ Berhasil menyinkronkan ${addedCount} akun calon murid baru ke rekap data pendaftar!`);
    } else {
      setSuccessMsg('✓ Seluruh data akun calon murid telah tersinkronisasi lengkap dengan rekap pendaftar.');
    }
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'student',
      password: '',
      status: 'active',
    });
    setErrMsg('');
    setShowAddModal(true);
  };

  const isSuperAdmin = currentUser?.role === 'super_admin' || currentUser?.email === 'superadmin@alhadiid.sch.id';

  // Open Edit Modal
  const handleOpenEdit = (user: UserAccount) => {
    if (!isSuperAdmin && user.role !== 'student') {
      Swal.fire({
        icon: 'error',
        title: 'Akses Dibatasi (Super Admin Only)',
        text: 'Hanya Super Admin yang berhak mengatur username, password, atau hak akses akun Panitia dan Kepala Sekolah.',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-2xl font-sans' },
      });
      return;
    }

    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      password: user.password || '',
      status: user.status || 'active',
    });
    setErrMsg('');
    setShowEditModal(true);
  };

  // Open Reset Password Modal
  const handleOpenReset = (user: UserAccount) => {
    if (!isSuperAdmin && user.role !== 'student') {
      Swal.fire({
        icon: 'error',
        title: 'Akses Dibatasi (Super Admin Only)',
        text: 'Hanya Super Admin yang berhak mengatur dan mereset password akun Panitia serta Kepala Sekolah.',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-2xl font-sans' },
      });
      return;
    }

    setEditingUser(user);
    setNewPassword('');
    setErrMsg('');
    setShowResetModal(true);
  };

  // Save New User (Create)
  const handleSaveNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.phone) {
      setErrMsg('Nama, Email, dan No. HP wajib diisi!');
      return;
    }

    const existing = users.find(u => u.email.toLowerCase() === formData.email.toLowerCase().trim());
    if (existing) {
      setErrMsg('Email sudah terdaftar pada akun lain!');
      return;
    }

    const initialPassword = formData.password.trim() || '123456';
    const cleanEmail = formData.email.toLowerCase().trim();

    const res = await signUpWithSupabase({
      email: cleanEmail,
      password: initialPassword,
      fullName: formData.name.trim(),
      phone: formData.phone.trim(),
      role: formData.role,
    });

    const newUser: UserAccount = (res.ok && res.userAccount) ? res.userAccount : {
      id: formData.role === 'student' ? `std_${Date.now()}` : `usr_${Date.now()}`,
      name: formData.name.trim(),
      email: cleanEmail,
      username: cleanEmail.split('@')[0],
      phone: formData.phone.trim(),
      role: formData.role,
      password: initialPassword,
      status: formData.status || 'active',
      createdAt: new Date().toISOString(),
    };

    saveUserToDb(newUser);
    if (newUser.role === 'student') {
      const updatedStudents = ensureStudentDataExists(newUser, students);
      onUpdateStudents(updatedStudents);
    }

    refreshUsers();
    setShowAddModal(false);
    setSuccessMsg(`✓ Berhasil membuat/menambahkan akun ${newUser.name} (${newUser.role.toUpperCase()}) ke database.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Save Edit User (Update)
  const handleSaveEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (!formData.name || !formData.email || !formData.phone) {
      setErrMsg('Nama, Email, dan No. HP wajib diisi!');
      return;
    }

    const updatedUser: UserAccount = {
      ...editingUser,
      name: formData.name.trim(),
      email: formData.email.toLowerCase().trim(),
      phone: formData.phone.trim(),
      role: formData.role,
      status: formData.status,
    };

    saveUserToDb(updatedUser);
    if (updatedUser.role === 'student') {
      const updatedStudents = ensureStudentDataExists(updatedUser, students);
      onUpdateStudents(updatedStudents);
    }

    if (currentUser && (editingUser.id === currentUser.id || editingUser.email.toLowerCase() === currentUser.email.toLowerCase())) {
      setCurrentUser(updatedUser);
    }

    refreshUsers();
    setShowEditModal(false);
    setEditingUser(null);
    setSuccessMsg(`✓ Perubahan data akun ${updatedUser.name} berhasil disimpan!`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Save Reset Password
  const handleSaveResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !newPassword.trim()) {
      setErrMsg('Password baru tidak boleh kosong!');
      return;
    }

    const res = await updateUserAccountCredentials({
      adminUser: currentUser,
      targetUserId: editingUser.id,
      newPassword: newPassword.trim(),
      newName: editingUser.name,
    });

    if (!res.ok) {
      setErrMsg(res.error || 'Gagal mereset password pengguna.');
      return;
    }

    const updatedUser: UserAccount = {
      ...editingUser,
      password: newPassword.trim(),
      mustChangePassword: false,
    };

    saveUserToDb(updatedUser);
    refreshUsers();
    setShowResetModal(false);
    setEditingUser(null);
    setSuccessMsg(`✓ Password untuk akun ${updatedUser.email} berhasil diperbarui di Supabase Auth & Database!`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Delete User
  const handleDeleteUser = async (user: UserAccount) => {
    if (currentUser && user.id === currentUser.id) {
      Swal.fire({
        icon: 'warning',
        title: 'Tindakan Ditolak',
        text: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif digunakan.',
        confirmButtonColor: '#2563eb',
        customClass: { popup: 'rounded-2xl font-sans' }
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Hapus Akun User?',
      html: `
        <div style="text-align: left; font-size: 13px; color: #334155; line-height: 1.6;">
          <p style="margin-bottom: 8px;">Apakah Anda yakin ingin menghapus akun panitia/user berikut?</p>
          <div style="background: #f1f5f9; padding: 10px; border-radius: 10px; font-weight: 600; margin-bottom: 8px;">
            <div>• Nama: <b>${user.name}</b></div>
            <div>• Email: <b>${user.email}</b></div>
            <div>• Role: <b>${user.role.toUpperCase()}</b></div>
          </div>
          <p style="color: #dc2626; font-weight: 700;">
            ⚠️ Perhatian: Setelah dihapus oleh Super Admin, akun ini tidak akan bisa login lagi ke portal SPMB.
          </p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus Akun',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      customClass: {
        popup: 'rounded-2xl font-sans',
        confirmButton: 'px-4 py-2 rounded-xl text-xs font-bold',
        cancelButton: 'px-4 py-2 rounded-xl text-xs font-bold',
      },
    });

    if (!result.isConfirmed) return;

    deleteUserFromDb(user.id);
    if (user.role === 'student' || user.email) {
      const updatedStudents = students.filter(
        s => s.id !== user.id && s.userEmail.toLowerCase() !== user.email.toLowerCase()
      );
      onUpdateStudents(updatedStudents);
    }
    refreshUsers();
    setSuccessMsg(`✓ Akun "${user.name}" (${user.email}) telah berhasil dihapus secara permanen oleh Super Admin.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Filtered Users
  const filteredUsers = users.filter(u => {
    const matchSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.phone && u.phone.includes(searchQuery)) ||
      (u.registrationNumber && u.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  // Counts
  const totalUsers = users.length;
  const totalStudents = users.filter(u => u.role === 'student').length;
  const totalAdmins = users.filter(u => u.role === 'admin').length;
  const totalKepsek = users.filter(u => u.role === 'kepsek').length;
  const totalSuperAdmin = users.filter(u => u.role === 'super_admin').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Shield className="w-4 h-4" /> Pengaturan Hak Akses & Manajemen Akun
          </div>
          <h2 className="text-2xl font-black text-white">
            Manajemen User & Akun Sistem SPMB
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Fitur lengkap CRUD (Create, Read, Update, Delete) untuk akun Panitia Admin, Kepala Sekolah, dan Calon Murid terdaftar.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncStudentData}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            title="Sinkronkan seluruh akun calon murid yang login/register ke rekap data pendaftar"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Sinkronkan Rekap Murid</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah User Baru</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="bg-emerald-900/60 border border-emerald-500/50 text-emerald-200 px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-300 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-slate-100 text-slate-800 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-semibold">Total User Akun</div>
            <div className="text-xl font-extrabold text-slate-900">{totalUsers} Akun</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-semibold">Calon Murid Terdaftar</div>
            <div className="text-xl font-extrabold text-blue-600">{totalStudents} Akun</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-semibold">Panitia Admin</div>
            <div className="text-xl font-extrabold text-indigo-600">{totalAdmins} Akun</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-semibold">Kepala Sekolah</div>
            <div className="text-xl font-extrabold text-sky-600">{totalKepsek} Akun</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama, email, HP, no registrasi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-slate-500 font-semibold whitespace-nowrap flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter Role:
          </span>
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
              roleFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({users.length})
          </button>
          <button
            onClick={() => setRoleFilter('super_admin')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
              roleFilter === 'super_admin'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            Super Admin ({totalSuperAdmin})
          </button>
          <button
            onClick={() => setRoleFilter('admin')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
              roleFilter === 'admin'
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            Panitia ({totalAdmins})
          </button>
          <button
            onClick={() => setRoleFilter('kepsek')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
              roleFilter === 'kepsek'
                ? 'bg-sky-600 text-white'
                : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
            }`}
          >
            Kepala Sekolah ({totalKepsek})
          </button>
          <button
            onClick={() => setRoleFilter('student')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
              roleFilter === 'student'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            Calon Murid ({totalStudents})
          </button>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600" />
            <span>Daftar User Akun Terdaftar ({filteredUsers.length} Data)</span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Otomatis tersinkron dengan Supabase Database
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                <th className="p-3">No</th>
                <th className="p-3">Nama & Email</th>
                <th className="p-3">No. Telepon / HP</th>
                <th className="p-3">Role Hak Akses</th>
                <th className="p-3">Status Akun</th>
                <th className="p-3">Tanggal Dibuat</th>
                <th className="p-3 text-center">Aksi / Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                    Tidak ada akun user yang sesuai dengan pencarian atau filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((usr, idx) => (
                  <tr key={usr.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{usr.name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>{usr.email}</span>
                      </div>
                      {usr.username && (
                        <div className="text-[11px] text-slate-600 font-mono flex items-center gap-1 mt-0.5">
                          <span className="text-slate-400 font-bold">@</span>
                          <span className="font-semibold bg-slate-100 text-slate-700 px-1 py-0.2 rounded text-[10px]">{usr.username}</span>
                        </div>
                      )}
                      {usr.registrationNumber && (
                        <span className="inline-block font-mono text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold mt-1">
                          Reg: {usr.registrationNumber}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 font-mono text-slate-700">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{usr.phone || '-'}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      {usr.role === 'super_admin' ? (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-900 font-extrabold rounded-md text-[10px] inline-flex items-center gap-1">
                          <Shield className="w-3 h-3 text-amber-600" /> Super Admin
                        </span>
                      ) : usr.role === 'admin' ? (
                        <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 font-extrabold rounded-md text-[10px] inline-flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-indigo-600" /> Panitia Admin
                        </span>
                      ) : usr.role === 'kepsek' ? (
                        <span className="px-2.5 py-1 bg-sky-100 text-sky-800 font-extrabold rounded-md text-[10px] inline-flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-sky-600" /> Kepala Sekolah
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-blue-100 text-blue-800 font-extrabold rounded-md text-[10px] inline-flex items-center gap-1">
                          <GraduationCap className="w-3 h-3 text-blue-600" /> Calon Murid
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {usr.status === 'disabled' ? (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-700 font-bold rounded text-[10px] inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Non-Aktif
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px] inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Aktif
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-500 font-mono text-[11px]">
                      {usr.createdAt ? usr.createdAt.split('T')[0] : '2027-01-01'}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(usr)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Data User"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenReset(usr)}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          title="Reset Password"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(usr)}
                          disabled={Boolean(currentUser && usr.id === currentUser.id)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            currentUser && usr.id === currentUser.id
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-rose-600 hover:bg-rose-50'
                          }`}
                          title={currentUser && usr.id === currentUser.id ? 'Akun Anda Sendiri' : 'Hapus User'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: TAMBAH USER BARU */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                Tambah Akun User Baru
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            {errMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-semibold">
                {errMsg}
              </div>
            )}

            <form onSubmit={handleSaveNewUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Role Hak Akses Akun:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'student' })}
                    className={`py-2 px-2 rounded-xl font-bold border text-center cursor-pointer ${
                      formData.role === 'student'
                        ? 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    Calon Murid
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'admin' })}
                    className={`py-2 px-2 rounded-xl font-bold border text-center cursor-pointer ${
                      formData.role === 'admin'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    Panitia Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'kepsek' })}
                    className={`py-2 px-2 rounded-xl font-bold border text-center cursor-pointer ${
                      formData.role === 'kepsek'
                        ? 'bg-sky-50 border-sky-500 text-sky-900 ring-2 ring-sky-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    Kepala Sekolah
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'super_admin' })}
                    className={`py-2 px-2 rounded-xl font-bold border text-center cursor-pointer ${
                      formData.role === 'super_admin'
                        ? 'bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    Super Admin
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Pengguna:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Alamat Email Login:</label>
                <input
                  type="email"
                  required
                  placeholder="budi@gmail.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nomor Telepon / WhatsApp:</label>
                <input
                  type="text"
                  required
                  placeholder="081234567890"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Password Awal Akun:</label>
                <input
                  type="text"
                  placeholder="Default: 123456"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl"
                >
                  Simpan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT USER */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-600" />
                Edit Data Akun User
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            {errMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-semibold">
                {errMsg}
              </div>
            )}

            <form onSubmit={handleSaveEditUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Role Hak Akses Akun:
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-blue-500"
                >
                  <option value="student">Calon Murid</option>
                  <option value="admin">Panitia Admin</option>
                  <option value="kepsek">Kepala Sekolah</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Pengguna:</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Alamat Email Login:</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nomor Telepon / WhatsApp:</label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Status Keaktifan Akun:</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">✓ Aktif</option>
                  <option value="disabled">✕ Non-Aktif (Di-block)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RESET PASSWORD */}
      {showResetModal && editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-600" />
                Reset Password Akun
              </h3>
              <button
                onClick={() => setShowResetModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900">
              Ubah password untuk user: <span className="font-bold">{editingUser.name}</span> ({editingUser.email})
            </div>

            {errMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-semibold">
                {errMsg}
              </div>
            )}

            <form onSubmit={handleSaveResetPassword} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Password Baru:</label>
                <input
                  type="text"
                  required
                  placeholder="Masukkan password baru..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
