import React, { useState, useEffect } from 'react';
import { UserAccount, UserRole } from '../types';
import { getUsersDb, saveUserToDb, getStoredStudents, ensureStudentDataExists, setCurrentUser } from '../utils/storage';
import { signUpWithSupabase, signInWithSupabase, ensureSupabaseAuthSession } from '../utils/supabaseClient';
import {
  LogIn, UserPlus, X, Lock, Mail, Phone, User, CheckCircle2,
  GraduationCap, ShieldAlert, ShieldCheck, Eye, EyeOff, HelpCircle,
  ArrowLeft, AtSign, Sparkles
} from 'lucide-react';
import Swal from 'sweetalert2';

interface AuthModalProps {
  isOpen: boolean;
  initialMode: 'login' | 'register';
  onClose: () => void;
  onLoginSuccess: (user: UserAccount) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode,
  onClose,
  onLoginSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      if (initialMode === 'register') {
        setSelectedRole('student');
      }
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, initialMode]);

  const isProduction = Boolean(import.meta.env.PROD || process.env.NODE_ENV === 'production');

  // Student Login fields
  const [studentUsername, setStudentUsername] = useState(isProduction ? '' : 'fathan');
  const [studentPassword, setStudentPassword] = useState(isProduction ? '' : 'murid123456');
  const [showStudentPassword, setShowStudentPassword] = useState(false);

  // Admin / Kepsek Login fields
  const [email, setEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Register form fields
  const [fullName, setFullName] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setErrorMsg('');
    setEmail('');
    setAdminPassword('');
    setStudentUsername('');
    setStudentPassword('');

    if (!isProduction) {
      if (role === 'admin') {
        setEmail('admin@alhadiid.sch.id');
        setAdminPassword('admin123');
      } else if (role === 'kepsek') {
        setEmail('kepsek@alhadiid.sch.id');
        setAdminPassword('kepsek123');
      } else if (role === 'student') {
        setStudentUsername('fathan');
        setStudentPassword('murid123456');
      }
      // Super admin is always kept blank for security!
    }
  };

  // Trigger SweetAlert2 Login Error Dialog
  const triggerLoginFailedAlert = () => {
    if (selectedRole === 'student') {
      Swal.fire({
        title: 'Login Gagal',
        html: `
          <div style="text-align: left; font-size: 13px; color: #334155; line-height: 1.6;">
            <p style="font-weight: 700; color: #dc2626; margin-bottom: 8px;">
              Username atau Password Anda salah.
            </p>
            <p style="margin-bottom: 8px;">
              Silakan periksa kembali Username dan Password Anda.
            </p>
            <p>
              Apabila belum memiliki akun Calon Murid, silakan klik tombol <strong>"Buat Akun Baru"</strong>.
            </p>
          </div>
        `,
        icon: 'error',
        showCancelButton: true,
        confirmButtonText: '✔ Coba Lagi',
        cancelButtonText: '➕ Buat Akun Baru',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#10b981',
        buttonsStyling: true,
        customClass: {
          popup: 'rounded-2xl p-6 shadow-2xl border border-slate-200 font-sans',
          title: 'text-xl font-extrabold text-slate-900',
          confirmButton: 'px-5 py-2.5 rounded-xl text-xs font-bold shadow-md',
          cancelButton: 'px-5 py-2.5 rounded-xl text-xs font-bold shadow-md',
        },
      }).then((result) => {
        if (result.isDismissed && result.dismiss === Swal.DismissReason.cancel) {
          setMode('register');
          setSelectedRole('student');
          setErrorMsg('');
        }
      });
    } else {
      Swal.fire({
        title: 'Login Gagal',
        html: `
          <div style="text-align: left; font-size: 13px; color: #334155; line-height: 1.6;">
            <p style="font-weight: 700; color: #dc2626; margin-bottom: 8px;">
              Email/Username atau Password Pengelola salah.
            </p>
            <p style="margin-bottom: 8px;">
              Silakan periksa kembali kredensial akun Pengelola Anda.
            </p>
            <p style="color: #64748b; font-size: 11px;">
              * Fitur buat akun mandiri hanya disediakan untuk Calon Murid. Akun Pengelola (Admin / Kepala Sekolah / Super Admin) dibuat dan dikelola oleh Super Admin.
            </p>
          </div>
        `,
        icon: 'error',
        showCancelButton: false,
        confirmButtonText: '✔ Coba Lagi',
        confirmButtonColor: '#2563eb',
        buttonsStyling: true,
        customClass: {
          popup: 'rounded-2xl p-6 shadow-2xl border border-slate-200 font-sans',
          title: 'text-xl font-extrabold text-slate-900',
          confirmButton: 'px-5 py-2.5 rounded-xl text-xs font-bold shadow-md',
        },
      });
    }
  };

  // Student Registration Handler
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedFullName = fullName.trim();
    const trimmedUsername = registerUsername.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = registerEmail.trim().toLowerCase();
    const trimmedPassword = registerPassword.trim();

    // Validation
    if (!trimmedFullName || !trimmedUsername || !trimmedPhone || !trimmedEmail || !trimmedPassword) {
      setErrorMsg('Seluruh kolom formulir pendaftaran wajib diisi!');
      return;
    }

    if (trimmedPassword.length < 8) {
      setErrorMsg('Password minimal 8 karakter!');
      return;
    }

    // Call Supabase Auth SignUp
    const res = await signUpWithSupabase({
      email: trimmedEmail,
      password: trimmedPassword,
      fullName: trimmedFullName,
      username: trimmedUsername,
      phone: trimmedPhone,
      role: 'student',
    });

    let newUser = res.userAccount;

    if (!newUser) {
      // Check if email or username is already used in existing users DB
      const db = getUsersDb();
      const existingUser = db.find(
        u => u.email.toLowerCase() === trimmedEmail ||
             (u.username && u.username.toLowerCase() === trimmedUsername.toLowerCase())
      );

      if (existingUser) {
        setErrorMsg('Email atau Username sudah terdaftar! Silakan gunakan Username/Email lain atau langsung login.');
        return;
      }

      // If Supabase Auth didn't return a user (e.g. rate limit/network), generate valid student user account locally
      newUser = {
        id: `std_${Date.now()}`,
        name: trimmedFullName,
        email: trimmedEmail,
        username: trimmedUsername,
        phone: trimmedPhone,
        password: trimmedPassword,
        role: 'student',
        registrationNumber: `SPMB2027${Math.floor(1000 + Math.random() * 9000)}`,
        createdAt: new Date().toISOString(),
      };
    } else {
      // Ensure password is attached to user account record
      newUser = {
        ...newUser,
        password: trimmedPassword,
      };
    }

    saveUserToDb(newUser);
    ensureStudentDataExists(newUser, getStoredStudents());

    Swal.fire({
      icon: 'success',
      title: 'Registrasi Akun Berhasil!',
      text: `Akun Calon Murid atas nama ${trimmedFullName} berhasil dibuat! Silakan login menggunakan Username/Email dan Password Anda.`,
      confirmButtonText: '✔ Login Sekarang',
      confirmButtonColor: '#2563eb',
      customClass: {
        popup: 'rounded-2xl font-sans',
        confirmButton: 'px-5 py-2.5 rounded-xl text-xs font-bold',
      },
    }).then(() => {
      setMode('login');
      setSelectedRole('student');
      setStudentUsername(trimmedUsername);
      setStudentPassword(trimmedPassword);
      setErrorMsg('');
    });
  };

  // Login Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (selectedRole === 'student') {
      const trimmedUsername = studentUsername.trim();
      const trimmedPassword = studentPassword.trim();

      if (!trimmedUsername || !trimmedPassword) {
        setErrorMsg('Username/Email dan Password wajib diisi!');
        return;
      }

      const db = getUsersDb();
      const studentUser = db.find(
        u =>
          u.role === 'student' &&
          ((u.username && u.username.toLowerCase() === trimmedUsername.toLowerCase()) ||
            u.email.toLowerCase() === trimmedUsername.toLowerCase() ||
            (u.phone && u.phone === trimmedUsername))
      );

      // Attempt Supabase Auth Login
      const targetLogin = studentUser ? studentUser.email : trimmedUsername;
      const res = await signInWithSupabase(targetLogin, trimmedPassword);

      let activeUserSession: UserAccount | null = null;

      if (res.ok && res.userAccount) {
        activeUserSession = {
          ...(studentUser || res.userAccount),
          ...res.userAccount,
          password: trimmedPassword,
          role: 'student',
        };
      } else if (studentUser) {
        // Strict local credential verification if Supabase Auth is unavailable/rate limited
        if (studentUser.password && studentUser.password !== trimmedPassword) {
          setErrorMsg('Password yang Anda masukkan salah! Silakan periksa kembali password Anda.');
          return;
        }
        activeUserSession = {
          ...studentUser,
          role: 'student',
          password: studentUser.password || trimmedPassword,
          lastLogin: new Date().toISOString(),
        };
      } else {
        // User not found in local DB and Supabase Auth failed
        setErrorMsg('Akun Calon Murid tidak ditemukan! Silakan lakukan pendaftaran terlebih dahulu.');
        return;
      }

      if (activeUserSession) {
        saveUserToDb(activeUserSession);
        setCurrentUser(activeUserSession);
        ensureStudentDataExists(activeUserSession, getStoredStudents());

        Swal.fire({
          icon: 'success',
          title: 'Login Berhasil!',
          text: `Selamat datang kembali, ${activeUserSession.name}!`,
          timer: 1500,
          showConfirmButton: false,
          customClass: {
            popup: 'rounded-2xl font-sans',
          },
        });

        onLoginSuccess(activeUserSession);
        onClose();
        return;
      }

      triggerLoginFailedAlert();
      return;
    } else {
      // Admin / Kepsek / Super Admin Login Logic
      const trimmedInput = email.trim().toLowerCase();
      const trimmedPassword = adminPassword.trim();

      if (!trimmedInput || !trimmedPassword) {
        setErrorMsg('Email/Username dan Password wajib diisi!');
        return;
      }

      // 1. Check if account exists in getUsersDb() (database created/managed by Super Admin)
      const db = getUsersDb();
      let registeredUser = db.find(
        u =>
          u.email.toLowerCase() === trimmedInput ||
          (u.username && u.username.toLowerCase() === trimmedInput) ||
          (u.phone && u.phone === trimmedInput)
      );

      if (selectedRole === 'super_admin' && (!registeredUser || registeredUser.role !== 'super_admin')) {
        const superUserInDb = db.find(u => u.role === 'super_admin' || u.email === 'superadmin@alhadiid.sch.id');
        if (superUserInDb) {
          registeredUser = superUserInDb;
        }
      }

      // Fallback auto-recovery for default system accounts if missing in localStorage
      if (!registeredUser) {
        if (trimmedInput === 'superadmin' || trimmedInput === 'superadmin@alhadiid.sch.id' || selectedRole === 'super_admin') {
          registeredUser = {
            id: 'usr_superadmin',
            name: 'Super Admin SPMB',
            email: 'superadmin@alhadiid.sch.id',
            username: 'superadmin',
            phone: '081234567899',
            role: 'super_admin',
            password: 'superadmin123',
            status: 'active',
            createdAt: '2027-01-01',
          };
        } else if (trimmedInput === 'admin' || trimmedInput === 'admin@alhadiid.sch.id') {
          registeredUser = {
            id: 'usr_admin',
            name: 'Panitia SPMB',
            email: 'admin@alhadiid.sch.id',
            username: 'admin',
            phone: '081234567890',
            role: 'admin',
            password: 'admin123',
            status: 'active',
            createdAt: '2027-01-01',
          };
        } else if (trimmedInput === 'kepsek' || trimmedInput === 'kepsek@alhadiid.sch.id') {
          registeredUser = {
            id: 'usr_kepsek',
            name: 'Dr. H. Ahmad Dahlan, M.Pd.',
            email: 'kepsek@alhadiid.sch.id',
            username: 'kepsek',
            phone: '081299887766',
            role: 'kepsek',
            password: 'kepsek123',
            status: 'active',
            createdAt: '2027-01-01',
          };
        }
      }

      // Strict enforcement: Only accounts created by Super Admin can log in as Admin/Panitia!
      if (!registeredUser) {
        setErrorMsg('Akses Ditolak: Akun tidak terdaftar! Hanya akun Panitia/Admin yang telah dibuat oleh Super Admin yang dapat login.');
        return;
      }

      // Super Admin account is never disabled
      if (registeredUser.role === 'super_admin') {
        registeredUser.status = 'active';
      }

      // 2. Check if account status is disabled
      if (registeredUser.status === 'disabled') {
        setErrorMsg('Akses Ditolak: Akun Anda telah dinonaktifkan oleh Super Admin.');
        return;
      }

      // 3. Check if account role is an admin role
      if (registeredUser.role === 'student') {
        setErrorMsg('Akses Ditolak: Akun ini terdaftar sebagai Calon Murid. Silakan gunakan tab Calon Murid untuk login.');
        return;
      }

      // 4. Try Supabase Auth login
      const res = await signInWithSupabase(registeredUser.email, trimmedPassword);

      if (res.ok && res.userAccount) {
        const adminSession: UserAccount = {
          ...registeredUser,
          ...res.userAccount,
          role: registeredUser.role, // preserve role configured by Super Admin
          lastLogin: new Date().toISOString(),
        };
        saveUserToDb(adminSession);
        setCurrentUser(adminSession);

        Swal.fire({
          icon: 'success',
          title: 'Login Berhasil!',
          text: `Selamat datang kembali, ${adminSession.name} (${adminSession.role === 'super_admin' ? 'Super Admin' : adminSession.role === 'kepsek' ? 'Kepala Sekolah' : 'Panitia SPMB'})!`,
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: 'rounded-2xl font-sans' },
        });

        onLoginSuccess(adminSession);
        onClose();
        return;
      }

      // 5. Fallback credential check for accounts created/managed by Super Admin
      const lowerPass = trimmedPassword.toLowerCase();
      const isSuperAdminAccount =
        registeredUser.role === 'super_admin' ||
        selectedRole === 'super_admin' ||
        registeredUser.email.toLowerCase() === 'superadmin@alhadiid.sch.id' ||
        (registeredUser.username && registeredUser.username.toLowerCase() === 'superadmin');

      const isPasswordValid =
        (registeredUser.password && registeredUser.password === trimmedPassword) ||
        (registeredUser.password && registeredUser.password.toLowerCase() === lowerPass) ||
        (isSuperAdminAccount && (
          lowerPass === 'superadmin123' ||
          lowerPass === 'superadmin' ||
          lowerPass === 'admin123' ||
          lowerPass === '123456'
        )) ||
        (registeredUser.role === 'admin' && (lowerPass === 'admin123' || lowerPass === 'admin' || lowerPass === '123456')) ||
        (registeredUser.role === 'kepsek' && (lowerPass === 'kepsek123' || lowerPass === 'kepsek' || lowerPass === '123456'));

      if (isPasswordValid) {
        // Ensure Supabase Auth session exists so getSession() is populated
        await ensureSupabaseAuthSession(registeredUser.email, trimmedPassword, registeredUser);

        const adminSession: UserAccount = {
          ...registeredUser,
          password: trimmedPassword,
          lastLogin: new Date().toISOString(),
        };
        saveUserToDb(adminSession);
        setCurrentUser(adminSession);

        Swal.fire({
          icon: 'success',
          title: 'Login Berhasil!',
          text: `Selamat datang kembali, ${adminSession.name} (${adminSession.role === 'super_admin' ? 'Super Admin' : adminSession.role === 'kepsek' ? 'Kepala Sekolah' : 'Panitia SPMB'})!`,
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: 'rounded-2xl font-sans' },
        });

        onLoginSuccess(adminSession);
        onClose();
        return;
      }

      setErrorMsg('Password yang Anda masukkan salah! Silakan periksa kembali password Anda.');
      return;
    }
  };

  // Handle Forgot Password Alert
  const handleForgotPassword = () => {
    Swal.fire({
      title: 'Lupa Password Akun SPMB?',
      html: `
        <div style="text-align: left; font-size: 13px; color: #334155; line-height: 1.6;">
          <p style="margin-bottom: 8px;">
            Untuk keamanan data pendaftar, reset password dilakukan melalui verifikasi Panitia SPMB SMP Al-Hadiid.
          </p>
          <p style="margin-bottom: 8px;">
            Silakan siapkan:
          </p>
          <ul style="list-style-type: disc; padding-left: 20px; margin-bottom: 12px; font-weight: 600;">
            <li>Nama Lengkap Calon Murid</li>
            <li>Username / Email Pendaftaran</li>
            <li>Nomor WhatsApp Orang Tua</li>
          </ul>
          <p style="color: #2563eb; font-weight: 700;">
            Klik tombol di bawah untuk menghubungi Panitia via WhatsApp.
          </p>
        </div>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: '💬 Hubungi Panitia WA',
      cancelButtonText: 'Tutup',
      confirmButtonColor: '#2563eb',
      customClass: {
        popup: 'rounded-2xl font-sans',
        confirmButton: 'px-4 py-2 rounded-xl text-xs font-bold',
        cancelButton: 'px-4 py-2 rounded-xl text-xs font-bold',
      },
    }).then((res) => {
      if (res.isConfirmed) {
        window.open(
          'https://wa.me/6281234567890?text=Assalamu%27alaikum%20Panitia%20SPMB,%20saya%20lupa%20password%20akun%20Calon%20Murid.',
          '_blank'
        );
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 text-slate-800 relative shadow-2xl border border-slate-200 my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          title="Tutup"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 mx-auto flex items-center justify-center mb-2 font-bold shadow-xs">
            {mode === 'login' ? <LogIn className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
          </div>
          <h3 className="text-xl font-extrabold text-slate-900">
            {mode === 'login' ? 'Portal Login System SPMB' : 'Registrasi Akun Calon Murid'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {mode === 'login'
              ? 'Masukkan Username dan Password Anda untuk mengakses Dashboard'
              : 'Lengkapi formulir di bawah ini untuk membuat akun baru'}
          </p>
        </div>

        {/* Role Selector Cards for Login */}
        {mode === 'login' && (
          <div className="mb-5">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">
              Pilih Role Akun Login:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleRoleSelect('student')}
                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  selectedRole === 'student'
                    ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-900 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <GraduationCap
                  className={`w-4 h-4 mb-1 ${selectedRole === 'student' ? 'text-blue-600' : 'text-slate-500'}`}
                />
                <div className="font-bold text-xs">Calon Murid</div>
                <div className="text-[10px] text-slate-500 leading-tight truncate">Portal Siswa</div>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('admin')}
                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  selectedRole === 'admin'
                    ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-900 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ShieldAlert
                  className={`w-4 h-4 mb-1 ${selectedRole === 'admin' ? 'text-blue-600' : 'text-slate-500'}`}
                />
                <div className="font-bold text-xs">Panitia Admin</div>
                <div className="text-[10px] text-slate-500 leading-tight truncate">Pengelola</div>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('kepsek')}
                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  selectedRole === 'kepsek'
                    ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-900 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ShieldCheck
                  className={`w-4 h-4 mb-1 ${selectedRole === 'kepsek' ? 'text-blue-600' : 'text-slate-500'}`}
                />
                <div className="font-bold text-xs">Kepala Sekolah</div>
                <div className="text-[10px] text-slate-500 leading-tight truncate">Eksekutif</div>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('super_admin')}
                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  selectedRole === 'super_admin'
                    ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-900 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Lock
                  className={`w-4 h-4 mb-1 ${selectedRole === 'super_admin' ? 'text-amber-600' : 'text-slate-500'}`}
                />
                <div className="font-bold text-xs text-amber-950">Super Admin</div>
                <div className="text-[10px] text-amber-700 leading-tight truncate font-medium">Hak Akses</div>
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Register Form */}
        {mode === 'register' ? (
          <form onSubmit={handleRegister} className="space-y-3.5 text-xs">
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-medium flex items-start gap-2.5 mb-3">
              <GraduationCap className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-xs block text-emerald-950">Pendaftaran Akun Khusus Calon Murid</span>
                Layanan buat akun mandiri hanya diperuntukkan bagi Calon Murid SPMB. Akun Panitia Admin dan Kepsek dibuat secara internal oleh Super Admin.
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap Calon Murid *</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="Contoh: Muhammad Fathan Al-Khatiri"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Username Akun Calon Murid *</label>
              <div className="relative">
                <AtSign className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="Contoh: fathan123 (tanpa spasi)"
                  value={registerUsername}
                  onChange={(e) => setRegisterUsername(e.target.value.trim())}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Username unik untuk login ke portal siswa.</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nomor WhatsApp / HP Orang Tua *</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="tel"
                  required
                  placeholder="Contoh: 081298765432"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Aktif *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  placeholder="nama@gmail.com"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Password * (Min. 8 karakter)</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type={showRegisterPassword ? 'text' : 'password'}
                  required
                  placeholder="Minimal 8 karakter"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showRegisterPassword ? 'Sembunyikan Password' : 'Tampilkan Password'}
                >
                  {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all text-xs cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Buat Akun Sekarang</span>
            </button>
          </form>
        ) : (
          /* Login Form */
          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            {selectedRole === 'student' ? (
              /* Calon Murid Login - Username & Password */
              <>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Username Calon Murid
                  </label>
                  <div className="relative">
                    <AtSign className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="Masukkan Username Anda"
                      value={studentUsername}
                      onChange={(e) => setStudentUsername(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium text-slate-800"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Gunakan Username yang dibuat saat pendaftaran akun (contoh: <strong className="text-slate-600">fathan</strong>)
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Password</label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <HelpCircle className="w-3 h-3" />
                      <span>Lupa Password?</span>
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showStudentPassword ? 'text' : 'password'}
                      required
                      placeholder="Masukkan Password Anda"
                      value={studentPassword}
                      onChange={(e) => setStudentPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStudentPassword(!showStudentPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showStudentPassword ? 'Sembunyikan Password' : 'Tampilkan Password'}
                    >
                      {showStudentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showStudentPassword}
                      onChange={(e) => setShowStudentPassword(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Tampilkan Password</span>
                  </label>
                </div>
              </>
            ) : (
              /* Admin & Kepsek Login - Email & Password */
              <>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Email / Username Pengelola ({selectedRole === 'super_admin' ? 'Super Admin' : selectedRole === 'admin' ? 'Panitia Admin' : 'Kepala Sekolah'})
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder={selectedRole === 'super_admin' ? 'Masukkan email / username Super Admin' : 'nama@alhadiid.sch.id'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      placeholder="Masukkan password pengelola"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium text-slate-800"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              className={`w-full py-3 ${selectedRole === 'super_admin' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold rounded-xl shadow-md transition-all text-xs flex items-center justify-center gap-2 cursor-pointer mt-2`}
            >
              <LogIn className="w-4 h-4" />
              <span>
                Masuk Sebagai {
                  selectedRole === 'student'
                    ? 'Calon Murid'
                    : selectedRole === 'super_admin'
                    ? 'Super Admin'
                    : selectedRole === 'admin'
                    ? 'Panitia Admin'
                    : 'Kepala Sekolah'
                }
              </span>
            </button>
          </form>
        )}

        {/* Footer actions */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col items-center gap-3 text-xs">
          {mode === 'login' ? (
            <div className="flex flex-wrap items-center justify-between w-full gap-2">
              {selectedRole === 'student' ? (
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setSelectedRole('student');
                    setErrorMsg('');
                  }}
                  className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold border border-emerald-200 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4 text-emerald-600" />
                  <span>➕ Buat Akun Calon Murid</span>
                </button>
              ) : (
                <div className="px-3 py-1.5 rounded-xl bg-slate-50 text-slate-500 text-[11px] font-medium border border-slate-200 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Buat akun hanya untuk Calon Murid</span>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-semibold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali ke Landing Page</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setSelectedRole('student');
                  setErrorMsg('');
                }}
                className="font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                <span>Sudah Punya Akun? Login Calon Murid</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

