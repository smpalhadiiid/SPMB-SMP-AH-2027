import React, { useState, useEffect } from 'react';
import {
  UserAccount, UserRole, StudentData, ClassQuota,
  CostBreakdown, SchoolInfo, TestSchedule, GasConfig, WebsiteConfig
} from './types';
import {
  getStoredClassQuotas, saveClassQuotas,
  getStoredCostBreakdown, saveCostBreakdown,
  getStoredSchoolInfo, saveSchoolInfo,
  getStoredTestSchedules, saveTestSchedules,
  getStoredGasConfig, saveGasConfig,
  getStoredWebsiteConfig, saveWebsiteConfig,
  getCurrentUser, setCurrentUser,
  loadDataFromSupabase,
  safeGetItem, safeSetItem, safeRemoveItem
} from './utils/storage';
import { supabase, signOutWithSupabase, getAuthUserProfile, syncCostBreakdownToSupabase } from './utils/supabaseClient';
import { StudentRepository } from './repositories/StudentRepository';
import { ClassQuotaRepository } from './repositories/ClassQuotaRepository';
import { fetchStudentCredentialsFromSupabase } from './utils/studentCredentials';
import { fetchDefaultCredentialsFromSupabase } from './utils/defaultCredentials';

import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { SidebarLayout } from './components/SidebarLayout';
import { StudentDashboard } from './components/StudentDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { KepsekDashboard } from './components/KepsekDashboard';
import { Lock } from 'lucide-react';

export default function App() {
  // App State
  const [currentUser, setCurrentUserLocal] = useState<UserAccount | null>(() => getCurrentUser());
  const [activeRoleView, setActiveRoleView] = useState<UserRole>(() => {
    const saved = safeGetItem('alhadiid_spmb_active_role_view') as UserRole | null;
    const user = getCurrentUser();
    if (user) {
      if (user.role === 'super_admin' && saved && ['super_admin', 'admin', 'kepsek'].includes(saved)) {
        return saved;
      }
      return user.role;
    }
    return saved && ['student', 'admin', 'kepsek', 'super_admin'].includes(saved) ? saved : 'student';
  });

  // Students SSOT is Supabase: initialized as empty array [] and populated via StudentRepository
  const [students, setStudents] = useState<StudentData[]>([]);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);

  const [classQuotas, setClassQuotas] = useState<ClassQuota[]>(() => getStoredClassQuotas());
  const [costBreakdowns, setCostBreakdowns] = useState<CostBreakdown[]>(() => getStoredCostBreakdown());
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>(() => getStoredSchoolInfo());
  const [testSchedules, setTestSchedules] = useState<TestSchedule[]>(() => getStoredTestSchedules());
  const [gasConfig, setGasConfig] = useState<GasConfig>(() => getStoredGasConfig());
  const [websiteConfig, setWebsiteConfig] = useState<WebsiteConfig>(() => getStoredWebsiteConfig());

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [viewMode, setViewMode] = useState<'home' | 'dashboard'>(() => {
    const savedView = safeGetItem('alhadiid_spmb_view_mode') as 'home' | 'dashboard' | null;
    if (savedView) return savedView;
    return currentUser ? 'dashboard' : 'home';
  });
  const [activeTab, setActiveTab] = useState<string>(() => {
    const savedTab = safeGetItem('alhadiid_spmb_active_tab');
    if (savedTab) return savedTab;
    return activeRoleView === 'student' ? 'timeline' : 'overview';
  });

  // Refresh All Data strictly from Supabase Server
  const handleRefreshAllData = async () => {
    setIsDataLoading(true);
    try {
      const [studentRes, quotaRes] = await Promise.all([
        StudentRepository.list(),
        ClassQuotaRepository.list(),
      ]);

      if (!studentRes.error && studentRes.data !== null) {
        setStudents(studentRes.data);
      } else {
        setStudents([]);
      }

      if (!quotaRes.error && quotaRes.data && quotaRes.data.length > 0) {
        setClassQuotas(quotaRes.data);
      }

      const configData = await loadDataFromSupabase();
      if (configData.schoolInfo) setSchoolInfo(configData.schoolInfo);
      if (configData.costBreakdown) setCostBreakdowns(configData.costBreakdown);
      if (configData.testSchedules) setTestSchedules(configData.testSchedules);
      if (configData.gasConfig) setGasConfig(configData.gasConfig);
      if (configData.websiteConfig) setWebsiteConfig(configData.websiteConfig);
    } catch (err) {
      console.warn('Refresh data failed:', err);
    } finally {
      setIsDataLoading(false);
    }
  };

  // Student CRUD operations strictly routed through StudentRepository per record
  const handleUpdateStudents = async (updatedList: StudentData[]) => {
    // Filter out any tombstoned / legacy demo records
    const validList = updatedList.filter(
      item => item && !item.id?.startsWith('std_00') && item.userEmail !== 'fathan.alkhatiri@gmail.com'
    );

    // 1. Detect and execute deletions
    const deleted = students.filter(s => !validList.some(u => u.id === s.id));
    for (const d of deleted) {
      await StudentRepository.remove(d.id);
    }

    // 2. Process changes per record (insert for new, update with eq(id) for existing)
    const processed = await Promise.all(
      validList.map(async (item) => {
        const existing = students.find(o => o.id === item.id || (o.userEmail && item.userEmail && o.userEmail.toLowerCase() === item.userEmail.toLowerCase()));
        if (!existing) {
          // Record belum ada di memori lokal, panggil create (StudentRepository menangani create atau update jika record sudah ada di server)
          const res = await StudentRepository.create(item);
          return res.data; // Only retain if successfully stored in database
        } else if (JSON.stringify(existing) !== JSON.stringify(item)) {
          // UPDATE WITH eq(id) and optimistic concurrency control
          const res = await StudentRepository.update(item.id, item, existing.version);
          if (res.conflict || res.error) {
            console.error('Pembaruan data siswa ditolak:', res.error);
            return existing; // Tetap pakai versi server
          }
          return res.data || existing;
        }
        return item;
      })
    );

    setStudents(processed.filter(Boolean) as StudentData[]);
  };

  const handleUpdateStudentSingle = async (updated: StudentData) => {
    // If attempting to update a legacy demo or permanently deleted student
    if (!updated || updated.id?.startsWith('std_00') || updated.userEmail === 'fathan.alkhatiri@gmail.com') {
      console.warn(`[App] Pembaruan untuk ID [${updated?.id}] dibatalkan karena record telah dihapus secara permanen.`);
      return updated;
    }

    const existing = students.find(s => s.id === updated.id || (s.userEmail && updated.userEmail && s.userEmail.toLowerCase() === updated.userEmail.toLowerCase()));
    if (!existing) {
      // Record belum ada di memori lokal: create() secara aman menangani apakah baru atau sudah ada di server untuk menghindari pelanggaran students_pkey
      const res = await StudentRepository.create(updated);
      if (res.data) {
        setStudents(prev => [res.data!, ...prev.filter(s => s.id !== res.data!.id)]);
        return res.data;
      } else {
        if (res.error?.message?.includes('telah dihapus secara permanen')) {
          console.warn('[App] Record telah dihapus secara permanen di server:', res.error.message);
          return updated;
        }
        throw res.error || new Error('Gagal menyimpan pendaftaran siswa di server');
      }
    } else {
      // UPDATE WITH eq(id) - OCC version check
      const res = await StudentRepository.update(updated.id, updated, existing.version);
      if (res.data) {
        setStudents(prev => prev.map(s => (s.id === updated.id ? res.data! : s)));
        return res.data;
      } else {
        if (res.error?.message?.includes('telah dihapus secara permanen')) {
          console.warn('[App] Record telah dihapus secara permanen di server:', res.error.message);
          return updated;
        }
        throw res.error || new Error('Data siswa telah diperbarui oleh pengguna lain atau sudah dihapus.');
      }
    }
  };

  const handleUpdateQuotas = async (updated: ClassQuota[]) => {
    setClassQuotas(updated);
    saveClassQuotas(updated);
    try {
      await ClassQuotaRepository.syncAll(updated);
    } catch (err) {
      console.warn('[App] ClassQuotaRepository.syncAll warning:', err);
    }
  };

  const handleUpdateSchoolInfo = (updated: SchoolInfo) => {
    setSchoolInfo(updated);
    saveSchoolInfo(updated);
  };

  const handleUpdateCostBreakdowns = (updated: CostBreakdown[]) => {
    setCostBreakdowns(updated);
    saveCostBreakdown(updated);
    syncCostBreakdownToSupabase(updated).catch(err => console.warn('syncCostBreakdownToSupabase warning:', err));
  };

  const handleUpdateGasConfig = (updated: GasConfig) => {
    setGasConfig(updated);
    saveGasConfig(updated);
  };

  const handleUpdateWebsiteConfig = (updated: WebsiteConfig) => {
    setWebsiteConfig(updated);
    saveWebsiteConfig(updated);
  };

  const handleUpdateSchedules = (updated: TestSchedule[]) => {
    setTestSchedules(updated);
    saveTestSchedules(updated);
  };

  // Role-based dashboard permission helper - strict separation per user requirement
  const getAllowedRoleViews = (role: UserRole): UserRole[] => {
    if (role === 'super_admin') return ['super_admin', 'admin', 'kepsek'];
    if (role === 'kepsek') return ['kepsek'];
    if (role === 'admin') return ['admin'];
    return ['student']; // Calon Murid strictly accesses student view
  };

  const handleSelectRoleView = (role: UserRole, overrideUserRole?: UserRole) => {
    const userRole = overrideUserRole || currentUser?.role || 'student';
    const allowed = getAllowedRoleViews(userRole);
    const targetRole = allowed.includes(role) ? role : (userRole === 'super_admin' ? 'super_admin' : userRole);

    setActiveRoleView(targetRole);
    safeSetItem('alhadiid_spmb_active_role_view', targetRole);
    safeSetItem('alhadiid_spmb_view_mode', 'dashboard');

    if (targetRole === 'student') {
      setActiveTab('timeline');
      safeSetItem('alhadiid_spmb_active_tab', 'timeline');
    } else {
      setActiveTab('overview');
      safeSetItem('alhadiid_spmb_active_tab', 'overview');
    }
    setViewMode('dashboard');
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    safeSetItem('alhadiid_spmb_active_tab', tab);
  };

  const handleNavigateHome = () => {
    setViewMode('home');
    safeSetItem('alhadiid_spmb_view_mode', 'home');
  };

  // Load initial data from Supabase & listen to Supabase Auth state changes
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsDataLoading(true);
      try {
        // Fetch Students, Class Quotas, and Credentials in parallel from Supabase
        const [studentRes, quotaRes] = await Promise.all([
          StudentRepository.list(),
          ClassQuotaRepository.list(),
          fetchStudentCredentialsFromSupabase(),
          fetchDefaultCredentialsFromSupabase(),
        ]);

        if (isMounted) {
          if (!studentRes.error && studentRes.data !== null) {
            setStudents(studentRes.data);
          } else {
            console.warn('Student fetch returned error or empty:', studentRes.error);
            setStudents([]);
          }

          if (!quotaRes.error && quotaRes.data && quotaRes.data.length > 0) {
            setClassQuotas(quotaRes.data);
          }
        }

        // Fetch configurations from Supabase
        const configData = await loadDataFromSupabase();
        if (isMounted) {
          if (configData.schoolInfo) setSchoolInfo(configData.schoolInfo);
          if (configData.costBreakdown) setCostBreakdowns(configData.costBreakdown);
          if (configData.testSchedules) setTestSchedules(configData.testSchedules);
          if (configData.gasConfig) setGasConfig(configData.gasConfig);
          if (configData.websiteConfig) setWebsiteConfig(configData.websiteConfig);
        }
      } catch (err) {
        console.warn('Initial Supabase sync check:', err);
        if (isMounted) setStudents([]);
      } finally {
        if (isMounted) setIsDataLoading(false);
      }
    }

    loadData();

    // Supabase Auth listener
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        const localUser = getCurrentUser();
        if (localUser) {
          if (session?.user && localUser.email.toLowerCase() === session.user.email?.toLowerCase()) {
            const userProfile = await getAuthUserProfile(session.user.id, session.user.email);
            if (userProfile && isMounted) {
              setCurrentUserLocal(userProfile);
              setCurrentUser(userProfile);
            }
          }
          return;
        }

        if (session?.user) {
          const userProfile = await getAuthUserProfile(session.user.id, session.user.email);
          if (userProfile && isMounted) {
            setCurrentUserLocal(userProfile);
            setCurrentUser(userProfile);
          }
        }
      } catch (err) {
        console.warn('Auth state change handler error:', err);
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Auto-sync filled quota counts with assigned students in public.students
  useEffect(() => {
    if (students && classQuotas && classQuotas.length > 0) {
      let hasChanges = false;
      const updated = classQuotas.map(q => {
        const count = students.filter(s =>
          s.assignedClassId === q.id ||
          (s.assignedClassName && s.assignedClassName.toLowerCase() === q.className.toLowerCase())
        ).length;
        if (q.filled !== count) {
          hasChanges = true;
          return { ...q, filled: count };
        }
        return q;
      });

      if (hasChanges) {
        setClassQuotas(updated);
        saveClassQuotas(updated);
        ClassQuotaRepository.syncAll(updated).catch(() => {});
      }
    }
  }, [students]);

  // Sync activeRoleView whenever currentUser changes or updates
  useEffect(() => {
    const userRole = currentUser?.role || 'student';
    const allowed = getAllowedRoleViews(userRole);
    if (!allowed.includes(activeRoleView)) {
      const defaultRole = allowed.includes(userRole) ? userRole : 'student';
      setActiveRoleView(defaultRole);
      safeSetItem('alhadiid_spmb_active_role_view', defaultRole);
      if (defaultRole === 'student') setActiveTab('timeline');
      else setActiveTab('overview');
    }
  }, [currentUser]);

  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUserLocal(user);
    setCurrentUser(user);
    handleSelectRoleView(user.role, user.role);
  };

  const handleLogout = async () => {
    await signOutWithSupabase();
    setCurrentUserLocal(null);
    setCurrentUser(null);
    safeRemoveItem('alhadiid_spmb_active_role_view');
    safeRemoveItem('alhadiid_spmb_view_mode');
    safeRemoveItem('alhadiid_spmb_active_tab');
    setActiveRoleView('student');
    setViewMode('home');
    setActiveTab('timeline');
  };

  const handleOpenWhatsApp = () => {
    window.open(`https://wa.me/${schoolInfo.whatsapp}?text=Assalamu%27alaikum%20Panitia%20SPMB%20SMP%20Al-Hadiid%20Cileungsi,%20saya%20ingin%20bertanya%20mengenai%20pendaftaran.`, '_blank');
  };

  // Find or create current student record for logged-in user (no demo mock records)
  const currentStudentData: StudentData = React.useMemo(() => {
    if (!currentUser) {
      return {
        id: '',
        registrationNumber: '',
        status: 'draft',
        userEmail: '',
        createdAt: new Date().toISOString(),
        fullName: '',
        phone: '',
        formPaymentAmount: schoolInfo.formFee || 200000,
        formPaymentStatus: 'unpaid',
        nik: '',
        birthPlace: 'Bogor',
        birthDate: '2013-01-01',
        gender: 'Laki-laki',
        religion: 'Islam',
        address: '',
        subdistrict: '',
        city: 'Kabupaten Bogor',
        province: 'Jawa Barat',
        previousSchoolName: '',
        fatherName: '',
        fatherPhone: '',
        motherName: '',
        motherJob: '',
        motherPhone: '',
        fatherEducation: '',
        initialPaymentStatus: 'unpaid',
        initialPaymentAmount: 8500000,
        version: 1,
      };
    }

    const userEmailClean = currentUser.email ? currentUser.email.toLowerCase() : '';
    const found = students.find(s => (s.userEmail && userEmailClean && s.userEmail.toLowerCase() === userEmailClean) || (s.id && s.id === currentUser.id));
    if (found) {
      return {
        ...found,
        username: found.username || currentUser.username,
        password: found.password || currentUser.password,
        examUsername: found.examUsername || found.username || currentUser.username,
        examPassword: found.examPassword || found.password || currentUser.password,
      };
    }

    return {
      id: currentUser.id,
      registrationNumber: currentUser.registrationNumber || `SPMB2027${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'draft',
      userEmail: currentUser.email || '',
      username: currentUser.username,
      password: currentUser.password,
      examUsername: currentUser.username,
      examPassword: currentUser.password,
      createdAt: currentUser.createdAt || new Date().toISOString(),
      fullName: currentUser.name || '',
      phone: currentUser.phone || '',
      formPaymentAmount: schoolInfo.formFee || 200000,
      formPaymentStatus: 'unpaid',
      nik: '',
      birthPlace: 'Bogor',
      birthDate: '2013-01-01',
      gender: 'Laki-laki',
      religion: 'Islam',
      address: '',
      subdistrict: '',
      city: 'Kabupaten Bogor',
      province: 'Jawa Barat',
      previousSchoolName: '',
      fatherName: '',
      fatherPhone: currentUser.phone || '',
      motherName: '',
      motherJob: '',
      motherPhone: currentUser.phone || '',
      fatherEducation: '',
      initialPaymentStatus: 'unpaid',
      initialPaymentAmount: 8500000,
      version: 1,
    };
  }, [currentUser, students, schoolInfo.formFee]);

  if (isDataLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-white">Memuat Sistem SPMB</h2>
          <p className="text-xs text-slate-400">Sinkronisasi data relasional Supabase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {viewMode === 'home' ? (
        <div className="flex flex-col min-h-screen">
          {/* Header Navigation for Landing Page */}
          <Navbar
            currentUser={currentUser}
            activeRoleView={activeRoleView}
            onSelectRoleView={handleSelectRoleView}
            onOpenAuth={(mode) => {
              setAuthMode(mode);
              setAuthModalOpen(true);
            }}
            onLogout={handleLogout}
            onNavigateHome={handleNavigateHome}
            onOpenWhatsApp={handleOpenWhatsApp}
            onRefreshAllData={handleRefreshAllData}
          />

          {/* Landing Page Content */}
          <main className="flex-1">
            <LandingPage
              schoolInfo={schoolInfo}
              costBreakdowns={costBreakdowns}
              testSchedules={testSchedules}
              websiteConfig={websiteConfig}
              currentUser={currentUser}
              classQuotas={classQuotas}
              students={students}
              onOpenAuth={(mode) => {
                setAuthMode(mode);
                setAuthModalOpen(true);
              }}
              onOpenWhatsApp={handleOpenWhatsApp}
              onSelectRoleView={handleSelectRoleView}
              onUpdateWebsiteConfig={handleUpdateWebsiteConfig}
              onUpdateSchoolInfo={handleUpdateSchoolInfo}
            />
          </main>

          {/* Landing Page Footer */}
          <Footer schoolInfo={schoolInfo} onOpenWhatsApp={handleOpenWhatsApp} />
        </div>
      ) : !currentUser ? (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
          <div className="max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-5">
            <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-white">Otentikasi Diperlukan</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Anda harus masuk menggunakan akun terdaftar untuk mengakses Dashboard SPMB SMP Al-Hadiid Cileungsi.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => { setAuthMode('login'); setAuthModalOpen(true); }}
                className="flex-1 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-sm transition-all"
              >
                Masuk / Login
              </button>
              <button
                onClick={handleNavigateHome}
                className="flex-1 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition-all"
              >
                Halaman Utama
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Dashboard Mode with Left Sidebar Navigation Layout */
        <SidebarLayout
          currentUser={currentUser}
          activeRoleView={activeRoleView}
          onSelectRoleView={handleSelectRoleView}
          onLogout={handleLogout}
          onNavigateHome={handleNavigateHome}
          onOpenWhatsApp={handleOpenWhatsApp}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          studentData={currentStudentData}
          onRefreshAllData={handleRefreshAllData}
        >
          {activeRoleView === 'student' && (
            <StudentDashboard
              currentUser={currentUser}
              studentData={currentStudentData}
              schoolInfo={schoolInfo}
              costBreakdowns={costBreakdowns}
              testSchedules={testSchedules}
              onUpdateStudentData={handleUpdateStudentSingle}
              activeTab={activeTab}
              onTabChange={(tab) => setActiveTab(tab)}
            />
          )}

          {(activeRoleView === 'admin' || activeRoleView === 'super_admin') && (
            <AdminDashboard
              currentUser={currentUser}
              students={students}
              classQuotas={classQuotas}
              costBreakdowns={costBreakdowns}
              schoolInfo={schoolInfo}
              testSchedules={testSchedules}
              gasConfig={gasConfig}
              websiteConfig={websiteConfig}
              onUpdateStudents={handleUpdateStudents}
              onUpdateQuotas={handleUpdateQuotas}
              onUpdateSchoolInfo={handleUpdateSchoolInfo}
              onUpdateCostBreakdowns={handleUpdateCostBreakdowns}
              onUpdateGasConfig={handleUpdateGasConfig}
              onUpdateWebsiteConfig={handleUpdateWebsiteConfig}
              onUpdateSchedules={handleUpdateSchedules}
              onRefreshAllData={handleRefreshAllData}
              activeTab={activeTab}
              onTabChange={(tab) => setActiveTab(tab)}
            />
          )}

          {activeRoleView === 'kepsek' && (
            <KepsekDashboard
              currentUser={currentUser}
              students={students}
              classQuotas={classQuotas}
              schoolInfo={schoolInfo}
              activeTab={activeTab}
              onUpdateStudents={handleUpdateStudents}
              onRefreshAllData={handleRefreshAllData}
            />
          )}
        </SidebarLayout>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authMode}
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
