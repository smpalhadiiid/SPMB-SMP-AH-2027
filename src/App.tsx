import React, { useState, useEffect } from 'react';
import {
  UserAccount, UserRole, StudentData, ClassQuota,
  CostBreakdown, SchoolInfo, TestSchedule, GasConfig, WebsiteConfig
} from './types';
import {
  getStoredStudents, saveStudents,
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
import { supabase, signOutWithSupabase, getAuthUserProfile } from './utils/supabaseClient';

import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { SidebarLayout } from './components/SidebarLayout';
import { StudentDashboard } from './components/StudentDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { KepsekDashboard } from './components/KepsekDashboard';

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

  const [students, setStudents] = useState<StudentData[]>(() => getStoredStudents());
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

  const handleRefreshAllData = () => {
    setStudents(getStoredStudents());
    setClassQuotas(getStoredClassQuotas());
    setCostBreakdowns(getStoredCostBreakdown());
    setSchoolInfo(getStoredSchoolInfo());
    setTestSchedules(getStoredTestSchedules());
    setGasConfig(getStoredGasConfig());
    setWebsiteConfig(getStoredWebsiteConfig());
  };

  // Persistence Sync Effects
  const handleUpdateStudents = (updated: StudentData[]) => {
    setStudents(updated);
    saveStudents(updated);
  };

  const handleUpdateStudentSingle = (updated: StudentData) => {
    const list = students.map(s => (s.id === updated.id ? updated : s));
    const exists = list.some(s => s.id === updated.id);
    const newList = exists ? list : [...list, updated];
    setStudents(newList);
    saveStudents(newList);
  };

  const handleUpdateQuotas = (updated: ClassQuota[]) => {
    setClassQuotas(updated);
    saveClassQuotas(updated);
  };

  const handleUpdateSchoolInfo = (updated: SchoolInfo) => {
    setSchoolInfo(updated);
    saveSchoolInfo(updated);
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

  // Load initial data from Supabase if available & listen to Supabase Auth state changes
  useEffect(() => {
    loadDataFromSupabase().then((data) => {
      if (data.students && data.students.length > 0) setStudents(data.students);
      if (data.classQuotas && data.classQuotas.length > 0) setClassQuotas(data.classQuotas);
      if (data.schoolInfo) setSchoolInfo(data.schoolInfo);
      if (data.costBreakdown && data.costBreakdown.length > 0) setCostBreakdowns(data.costBreakdown);
      if (data.testSchedules && data.testSchedules.length > 0) setTestSchedules(data.testSchedules);
      if (data.gasConfig) setGasConfig(data.gasConfig);
      if (data.websiteConfig) setWebsiteConfig(data.websiteConfig);
    }).catch((err) => {
      console.warn('Initial Supabase sync check:', err);
    });

    // Supabase Auth listener
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      const localUser = getCurrentUser();
      // If we already have a valid local session, DO NOT overwrite it automatically with a different Supabase Auth email
      if (localUser) {
        if (session?.user && localUser.email.toLowerCase() === session.user.email?.toLowerCase()) {
          const userProfile = await getAuthUserProfile(session.user.id, session.user.email);
          if (userProfile) {
            setCurrentUserLocal(userProfile);
            setCurrentUser(userProfile);
          }
        }
        return;
      }

      if (session?.user) {
        const userProfile = await getAuthUserProfile(session.user.id, session.user.email);
        if (userProfile) {
          setCurrentUserLocal(userProfile);
          setCurrentUser(userProfile);
        }
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

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

  // Find or create current student record for logged-in user
  const currentStudentData: StudentData = React.useMemo(() => {
    if (!currentUser) {
      // Default fallback student data
      return students[0] || {
        id: 'std_demo',
        registrationNumber: 'SPMB20270001',
        status: 'draft',
        userEmail: 'calon@gmail.com',
        createdAt: new Date().toISOString(),
        fullName: 'Calon Murid Demo',
        phone: '081234567890',
        formPaymentAmount: 200000,
        formPaymentStatus: 'unpaid',
        nik: '',
        birthPlace: 'Bogor',
        birthDate: '2013-01-01',
        gender: 'Laki-laki',
        religion: 'Islam',
        address: 'Cileungsi, Bogor',
        subdistrict: 'Cileungsi',
        city: 'Kabupaten Bogor',
        province: 'Jawa Barat',
        previousSchoolName: 'SDN Cileungsi',
        fatherName: 'Ayah Demo',
        fatherPhone: '081234567890',
        motherName: 'Ibu Demo',
        motherJob: 'Ibu Rumah Tangga',
        motherPhone: '081234567890',
        fatherEducation: 'S1',
        initialPaymentStatus: 'unpaid',
        initialPaymentAmount: 8500000,
      };
    }

    const userEmailClean = currentUser.email ? currentUser.email.toLowerCase() : '';
    const found = students.find(s => (s.userEmail && userEmailClean && s.userEmail.toLowerCase() === userEmailClean) || (s.id && s.id === currentUser.id));
    if (found) return found;

    // Create initial record
    return {
      id: currentUser.id || `usr_${Date.now()}`,
      registrationNumber: currentUser.registrationNumber || `SPMB2027${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'draft',
      userEmail: currentUser.email || 'calon@gmail.com',
      createdAt: currentUser.createdAt || new Date().toISOString(),
      fullName: currentUser.name || 'Calon Murid',
      phone: currentUser.phone || '081234567890',
      formPaymentAmount: schoolInfo.formFee,
      formPaymentStatus: 'unpaid',
      nik: '',
      birthPlace: 'Bogor',
      birthDate: '2013-01-01',
      gender: 'Laki-laki',
      religion: 'Islam',
      address: 'Cileungsi, Bogor',
      subdistrict: 'Cileungsi',
      city: 'Kabupaten Bogor',
      province: 'Jawa Barat',
      previousSchoolName: '',
      fatherName: '',
      fatherPhone: currentUser.phone || '081234567890',
      motherName: '',
      motherJob: 'Ibu Rumah Tangga',
      motherPhone: currentUser.phone || '081234567890',
      fatherEducation: 'S1',
      initialPaymentStatus: 'unpaid',
      initialPaymentAmount: 8500000,
    };
  }, [currentUser, students, schoolInfo.formFee]);

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
          />

          {/* Landing Page Content */}
          <main className="flex-1">
            <LandingPage
              schoolInfo={schoolInfo}
              costBreakdowns={costBreakdowns}
              testSchedules={testSchedules}
              websiteConfig={websiteConfig}
              currentUser={currentUser}
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
        >
          {activeRoleView === 'student' && (
            <StudentDashboard
              currentUser={currentUser || { id: 'guest', name: 'Calon Murid', email: 'calon@gmail.com', phone: '081234567890', role: 'student', createdAt: '' }}
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
              currentUser={currentUser || (
                activeRoleView === 'super_admin'
                  ? { id: 'usr_superadmin', name: 'Super Admin SPMB', email: 'superadmin@alhadiid.sch.id', phone: '081234567899', role: 'super_admin', createdAt: '' }
                  : { id: 'admin', name: 'Panitia SPMB', email: 'admin@alhadiid.sch.id', phone: '081234567890', role: 'admin', createdAt: '' }
              )}
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
              currentUser={currentUser || { id: 'kepsek', name: 'Dr. H. Ahmad Dahlan, M.Pd.', email: 'kepsek@alhadiid.sch.id', phone: '081234567890', role: 'kepsek', createdAt: '' }}
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
