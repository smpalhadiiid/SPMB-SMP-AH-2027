import React, { useState } from 'react';
import { UserAccount, UserRole, StudentData } from '../types';
import {
  GraduationCap, ShieldAlert, ShieldCheck, Users, FileText,
  CreditCard, Award, CheckCircle2, School, Clock, LogOut,
  Home, Menu, X, ChevronRight, Sparkles, Bell, User,
  MessageSquare, LayoutDashboard, BarChart3, ChevronDown, Settings,
  Palette, Database, Calendar, BookOpen, Laptop, Lock, Download
} from 'lucide-react';
import { SchoolLogo } from './SchoolLogo';
import { SupabaseBadge } from './SupabaseBadge';

interface SidebarLayoutProps {
  currentUser: UserAccount | null;
  activeRoleView: UserRole;
  onSelectRoleView: (role: UserRole) => void;
  onLogout: () => void;
  onNavigateHome: () => void;
  onOpenWhatsApp: () => void;
  children: React.ReactNode;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  studentData?: StudentData;
}

export const SidebarLayout: React.FC<SidebarLayoutProps> = ({
  currentUser,
  activeRoleView,
  onSelectRoleView,
  onLogout,
  onNavigateHome,
  onOpenWhatsApp,
  children,
  activeTab,
  onTabChange,
  studentData,
}) => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [cbtMenuOpen, setCbtMenuOpen] = useState(true);

  // Role details metadata
  const roleConfig = {
    student: {
      title: 'Calon Murid',
      subtitle: 'Portal Pendaftaran & Status',
      badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      icon: GraduationCap,
      navItems: [
        { id: 'timeline', label: '1. Timeline & Alur', icon: Clock },
        { id: 'payment_form', label: '2. Bayar Formulir', icon: CreditCard },
        { id: 'form', label: '3. Isi Data & Berkas', icon: FileText },
        { id: 'download_form', label: '4. Download Formulir', icon: Download },
        { id: 'test_schedule', label: '5. Jadwal Tes & Ujian', icon: Calendar },
        { id: 'result', label: '6. Hasil Tes & Kelulusan', icon: Award },
        { id: 'payment_initial', label: '7. Daftar Ulang & BAM', icon: CheckCircle2 },
        { id: 'class', label: '8. Penempatan Kelas', icon: School },
      ],
    },
    admin: {
      title: 'Panitia Admin',
      subtitle: 'Verifikator & Pengelola SPMB',
      badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      icon: ShieldAlert,
      navItems: [
        { id: 'overview', label: 'Ringkasan & Statistik', icon: LayoutDashboard },
        { id: 'account_settings', label: 'Pengaturan Akun Pengguna', icon: Lock },
        { id: 'applicants', label: 'Data Seluruh Pendaftar', icon: Users },
        { id: 'payment_form', label: 'Input & Bayar Formulir', icon: CreditCard },
        { id: 'payment_initial', label: 'Biaya Awal Masuk (BAM)', icon: FileText },
        { id: 'payment_history', label: 'Riwayat Pembayaran (L / P)', icon: BarChart3 },
        { id: 'scores', label: 'Input Nilai Tes SPMB', icon: Award },
        {
          id: 'cbt_group',
          label: 'Sistem CBT Online',
          icon: BookOpen,
          subItems: [
            { id: 'cbt_dashboard', label: 'Dashboard CBT', icon: LayoutDashboard },
            { id: 'cbt_kategori', label: 'Kategori Soal', icon: Palette },
            { id: 'cbt_bank_soal', label: 'Bank Soal', icon: FileText },
            { id: 'cbt_import', label: 'Import Soal', icon: Database },
            { id: 'cbt_jadwal', label: 'Jadwal Ujian', icon: Calendar },
            { id: 'cbt_monitoring', label: 'Live Monitoring', icon: Clock },
            { id: 'cbt_hasil', label: 'Hasil Ujian', icon: CheckCircle2 },
            { id: 'cbt_ranking', label: 'Ranking Nilai', icon: Award },
          ],
        },
        { id: 'announcements', label: 'Pengumuman Kelulusan', icon: CheckCircle2 },
        { id: 'quotas', label: 'Pengaturan Kuota Gelombang', icon: School },
        { id: 'placement', label: 'Penempatan Kelas AI', icon: Sparkles },
        { id: 'filled_classes', label: 'Data Kelas Terisi', icon: Users },
        { id: 'settings', label: 'Informasi & Media Sekolah', icon: Settings },
        { id: 'website_settings', label: 'Tampilan Website', icon: Palette },
        { id: 'user_management', label: 'Manajemen User & Akun (CRUD)', icon: User },
        { id: 'database_management', label: 'Database (Hapus & Backup)', icon: Database },
      ],
    },
    kepsek: {
      title: 'Kepala Sekolah',
      subtitle: 'Laporan & Ringkasan Eksekutif',
      badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
      icon: ShieldCheck,
      navItems: [
        { id: 'overview', label: 'Ringkasan Eksekutif', icon: BarChart3 },
        { id: 'reports', label: 'Laporan Pembayaran Formulir & BAM', icon: FileText },
        { id: 'filled_classes', label: 'Data Kelas Terisi', icon: Users },
      ],
    },
    super_admin: {
      title: 'Panitia Utama (Super Admin)',
      subtitle: 'Administrator Hak Akses & Kredensial',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      icon: ShieldCheck,
      navItems: [
        { id: 'overview', label: 'Ringkasan & Statistik', icon: LayoutDashboard },
        { id: 'user_management', label: 'Manajemen User & Akun (CRUD)', icon: User },
        { id: 'account_settings', label: 'Pengaturan Akun Pengguna', icon: Lock },
        { id: 'applicants', label: 'Data Seluruh Pendaftar', icon: Users },
        { id: 'payment_form', label: 'Input & Bayar Formulir', icon: CreditCard },
        { id: 'payment_initial', label: 'Biaya Awal Masuk (BAM)', icon: FileText },
        { id: 'payment_history', label: 'Riwayat Pembayaran (L / P)', icon: BarChart3 },
        { id: 'scores', label: 'Input Nilai Tes SPMB', icon: Award },
        {
          id: 'cbt_group',
          label: 'Sistem CBT Online',
          icon: BookOpen,
          subItems: [
            { id: 'cbt_dashboard', label: 'Dashboard CBT', icon: LayoutDashboard },
            { id: 'cbt_kategori', label: 'Kategori Soal', icon: Palette },
            { id: 'cbt_bank_soal', label: 'Bank Soal', icon: FileText },
            { id: 'cbt_import', label: 'Import Soal', icon: Database },
            { id: 'cbt_jadwal', label: 'Jadwal Ujian', icon: Calendar },
            { id: 'cbt_monitoring', label: 'Live Monitoring', icon: Clock },
            { id: 'cbt_hasil', label: 'Hasil Ujian', icon: CheckCircle2 },
            { id: 'cbt_ranking', label: 'Ranking Nilai', icon: Award },
          ],
        },
        { id: 'announcements', label: 'Pengumuman Kelulusan', icon: CheckCircle2 },
        { id: 'quotas', label: 'Pengaturan Kuota Gelombang', icon: School },
        { id: 'placement', label: 'Penempatan Kelas AI', icon: Sparkles },
        { id: 'filled_classes', label: 'Data Kelas Terisi', icon: Users },
        { id: 'settings', label: 'Informasi & Media Sekolah', icon: Settings },
        { id: 'website_settings', label: 'Tampilan Website', icon: Palette },
        { id: 'database_management', label: 'Database (Hapus & Backup)', icon: Database },
      ],
    },
  };

  const userRole = currentUser?.role || 'student';
  const currentRoleMeta = roleConfig[activeRoleView] || roleConfig.admin;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col lg:flex-row text-slate-100 font-sans">
      {/* Mobile Backdrop */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* SIDEBAR CONTAINER */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-72 bg-slate-950 border-r border-slate-800 flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* 1. Sidebar Header / Branding */}
          <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
            <button
              onClick={onNavigateHome}
              className="flex items-center gap-3 text-left group"
            >
              <SchoolLogo size="md" showText={true} />
            </button>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 2. Active Role Card & Switcher */}
          <div className="p-4 mx-3 my-3 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Peran Akses Sistem:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${currentRoleMeta.badgeBg}`}>
                {currentRoleMeta.title}
              </span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-xs font-semibold text-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <currentRoleMeta.icon className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-extrabold text-white truncate">{currentRoleMeta.title}</span>
              </div>
              <span className="text-[10px] bg-blue-900/40 text-blue-300 border border-blue-800/50 px-2 py-0.5 rounded font-mono shrink-0">
                Akses
              </span>
            </div>

            {/* If logged in user is Super Admin, allow instant perspective switching */}
            {(currentUser?.role === 'super_admin' || currentUser?.email === 'superadmin@alhadiid.sch.id') && (
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                <div className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Switch Perspektif:</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => onSelectRoleView('super_admin')}
                    className={`px-1.5 py-1 rounded text-[10px] font-bold transition-all text-center cursor-pointer ${
                      activeRoleView === 'super_admin'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Super Admin
                  </button>
                  <button
                    onClick={() => onSelectRoleView('admin')}
                    className={`px-1.5 py-1 rounded text-[10px] font-bold transition-all text-center cursor-pointer ${
                      activeRoleView === 'admin'
                        ? 'bg-indigo-500 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Panitia
                  </button>
                  <button
                    onClick={() => onSelectRoleView('kepsek')}
                    className={`px-1.5 py-1 rounded text-[10px] font-bold transition-all text-center cursor-pointer ${
                      activeRoleView === 'kepsek'
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Kepsek
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. Navigation Links List */}
          <div className="px-3 py-2 flex-1 space-y-6">
            <div>
              <div className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2">
                Menu Utama ({currentRoleMeta.title})
              </div>
              <div className="space-y-1">
                {currentRoleMeta.navItems.map((item: any) => {
                  const IconComp = item.icon;

                  if (item.subItems) {
                    const isChildActive = item.subItems.some((sub: any) => sub.id === activeTab);
                    return (
                      <div key={item.id} className="space-y-1">
                        <button
                          onClick={() => {
                            setCbtMenuOpen(!cbtMenuOpen);
                            if (!cbtMenuOpen && !isChildActive && onTabChange) {
                              onTabChange('cbt_dashboard');
                            }
                          }}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isChildActive
                              ? 'bg-gradient-to-r from-indigo-900/60 to-purple-900/40 text-indigo-200 border border-indigo-500/50 shadow-md'
                              : 'text-slate-300 hover:bg-slate-900/80 hover:text-white border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <IconComp className={`w-4 h-4 ${isChildActive ? 'text-amber-400' : 'text-indigo-400'}`} />
                            <span>{item.label}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-[10px] text-indigo-300 font-extrabold">
                              {item.subItems.length}
                            </span>
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${cbtMenuOpen ? 'rotate-180' : ''}`} />
                          </div>
                        </button>

                        {cbtMenuOpen && (
                          <div className="ml-3 pl-3 border-l-2 border-indigo-500/30 space-y-1 py-1">
                            {item.subItems.map((sub: any) => {
                              const SubIcon = sub.icon;
                              const isSubActive = activeTab === sub.id;
                              return (
                                <button
                                  key={sub.id}
                                  onClick={() => {
                                    if (onTabChange) onTabChange(sub.id);
                                    setMobileSidebarOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                    isSubActive
                                      ? 'bg-indigo-600/30 text-amber-300 font-bold border border-indigo-500/50 shadow-sm'
                                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <SubIcon className={`w-3.5 h-3.5 ${isSubActive ? 'text-amber-400' : 'text-slate-500'}`} />
                                    <span>{sub.label}</span>
                                  </div>
                                  {isSubActive && <ChevronRight className="w-3 h-3 text-amber-400" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  const isActive = activeTab === item.id;

                  // Student Lock Status Helper
                  let studentBadge: React.ReactNode = null;
                  if (activeRoleView === 'student' && studentData) {
                    if (item.id === 'payment_form') {
                      if (studentData.formPaymentStatus === 'verified') {
                        studentBadge = <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 font-bold">LUNAS</span>;
                      } else {
                        studentBadge = <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 font-bold">Rp200k</span>;
                      }
                    } else if (item.id === 'form') {
                      const isFormUnlocked = studentData.formPaymentStatus === 'verified' || !!studentData.formPaymentProofUrl || studentData.formPaymentStatus === 'pending' || (studentData.status !== 'draft' && studentData.status !== 'pending_payment');
                      if (!isFormUnlocked) {
                        studentBadge = <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 flex items-center gap-0.5 font-bold"><Lock className="w-2.5 h-2.5 text-amber-500" /> TERKUNCI</span>;
                      } else {
                        studentBadge = <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30 font-bold">AKTIF</span>;
                      }
                    } else if (item.id === 'download_form') {
                      const isFormSubmitted = studentData.status !== 'draft' && studentData.status !== 'pending_payment';
                      const isDownloadUnlocked = studentData.isFormVerifiedByAdmin === true || (studentData.formPaymentStatus === 'verified' && isFormSubmitted);
                      if (!isDownloadUnlocked) {
                        studentBadge = <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 flex items-center gap-0.5 font-bold"><Lock className="w-2.5 h-2.5 text-amber-500" /> TERKUNCI</span>;
                      } else {
                        studentBadge = <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 font-bold">PDF READY</span>;
                      }
                    } else if (item.id === 'test_schedule') {
                      const isTestUnlocked = studentData.isTestActive === true || studentData.status === 'scheduled_test' || studentData.status === 'test_completed';
                      if (!isTestUnlocked) {
                        studentBadge = <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 flex items-center gap-0.5 font-bold"><Lock className="w-2.5 h-2.5 text-amber-500" /> TERKUNCI</span>;
                      } else {
                        studentBadge = <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30 font-bold animate-pulse">AKTIF</span>;
                      }
                    } else if (item.id === 'result') {
                      const isResultUnlocked = studentData.status === 'passed' || studentData.status === 'failed' || studentData.status === 'passed_reserved' || studentData.status === 're_registration_paid' || studentData.status === 're_registered' || studentData.status === 'class_assigned';
                      if (!isResultUnlocked) {
                        studentBadge = <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 flex items-center gap-0.5 font-bold"><Lock className="w-2.5 h-2.5 text-amber-500" /> TERKUNCI</span>;
                      } else if (studentData.status === 'passed') {
                        studentBadge = <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 font-bold">LULUS</span>;
                      }
                    } else if (item.id === 'payment_initial') {
                      const isBamUnlocked = studentData.status === 'passed' || studentData.status === 're_registration_paid' || studentData.status === 're_registered' || studentData.status === 'class_assigned';
                      if (!isBamUnlocked) {
                        studentBadge = <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 flex items-center gap-0.5 font-bold"><Lock className="w-2.5 h-2.5 text-amber-500" /> TERKUNCI</span>;
                      } else if (studentData.initialPaymentStatus === 'verified') {
                        studentBadge = <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 font-bold">LUNAS</span>;
                      }
                    } else if (item.id === 'class') {
                      const isClassUnlocked = studentData.initialPaymentStatus === 'verified' || studentData.status === 're_registered' || studentData.status === 'class_assigned';
                      if (!isClassUnlocked) {
                        studentBadge = <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 flex items-center gap-0.5 font-bold"><Lock className="w-2.5 h-2.5 text-amber-500" /> TERKUNCI</span>;
                      } else {
                        studentBadge = <span className="text-[9px] bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded font-black">MURID</span>;
                      }
                    }
                  }

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (onTabChange) onTabChange(item.id);
                        setMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 shadow-sm'
                          : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <IconComp className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                        <span>{item.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {studentBadge}
                        {isActive && <ChevronRight className="w-3.5 h-3.5 text-blue-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* General Actions */}
            <div>
              <div className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2">
                Pusat Bantuan & Navigasi
              </div>
              <div className="space-y-1">
                <button
                  onClick={onNavigateHome}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent transition-all"
                >
                  <Home className="w-4 h-4 text-slate-500" />
                  <span>Halaman Depan Website</span>
                </button>

                <button
                  onClick={onOpenWhatsApp}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent transition-all"
                >
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                  <span>Call Center WA SPMB</span>
                </button>
              </div>
            </div>
          </div>

          {/* 4. Bottom User Profile Card */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/60">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-blue-600/30 text-blue-300 border border-blue-500/40 flex items-center justify-center font-bold text-xs shrink-0">
                  {(currentUser?.name || 'User').charAt(0).toUpperCase()}
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold text-slate-200 truncate">
                    {currentUser?.name || 'Pengguna Guest'}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {currentUser?.email || 'Belum Login'}
                  </div>
                </div>
              </div>

              <button
                onClick={onLogout}
                title="Keluar / Logout"
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-100 text-slate-800">
        {/* Top Header Bar inside Dashboard */}
        <header className="bg-slate-900 border-b border-slate-800 text-white px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                <span>Dashboard</span>
                <span>/</span>
                <span className="text-blue-400 font-bold capitalize">{currentRoleMeta.title}</span>
                {currentUser && currentUser.role !== activeRoleView && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold">
                    Perspektif Tinjau ({currentUser?.role === 'super_admin' ? 'Super Admin' : currentUser?.role === 'admin' ? 'Panitia' : 'Kepsek'})
                  </span>
                )}
              </div>
              <div className="text-sm font-bold text-white hidden sm:block">
                Sistem Pendaftaran Murid Baru SMP Al-Hadiid
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SupabaseBadge variant="compact" className="hidden md:inline-flex" />

            <button
              onClick={onOpenWhatsApp}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold rounded-lg transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
              <span>Bantuan WA</span>
            </button>

            <button
              onClick={onNavigateHome}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Website SPMB</span>
            </button>

            <div className="h-4 w-px bg-slate-800" />

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-inner">
                {(currentUser?.name || 'User').charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block text-right">
                <div className="text-xs font-bold text-slate-200 leading-tight">
                  {currentUser?.name || 'Calon Murid'}
                </div>
                <div className="text-[10px] text-blue-400 font-semibold uppercase">
                  {currentRoleMeta.title}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Dashboard View Content */}
        <main className="flex-1 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};
