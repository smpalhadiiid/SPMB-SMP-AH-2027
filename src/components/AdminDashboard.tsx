import React, { useState, useEffect } from 'react';
import { StudentData, ClassQuota, CostBreakdown, SchoolInfo, TestSchedule, GasConfig, UserAccount, WebsiteConfig, ExamQuestion, BamPaymentRecord, BamInstallmentType } from '../types';
import { exportToExcel } from '../utils/excelExporter';
import { generateReportPDF, generateRegistrationPDF, generateExamCardPDF, generateExamResultPDF } from '../utils/pdfGenerator';
import { getStudentCredentials, fetchStudentCredentialsFromSupabase } from '../utils/studentCredentials';
import { ExamQuestionRepository } from '../repositories/ExamQuestionRepository';
import {
  canDownloadStudentForm,
  isStudentFormFilled,
  hasUploadedPaymentProof,
  getStudentFormStatus
} from '../utils/formEligibility';
import {
  exportAllDataAsBackup, importBackupData, purgeApplicantData, resetAllDataToDefault, getStoredWebsiteConfig,
  getStoredQuestionBank, saveQuestionBank, saveTestSchedules,
  getStoredBamPayments, saveBamPayments
} from '../utils/storage';
import logoSvg from '../assets/logo.svg';
import {
  Users, User, CheckCircle2, Clock, XCircle, CreditCard, Award,
  School, FileSpreadsheet, Settings, ShieldAlert, Search, Filter,
  Eye, Edit, Trash2, Plus, Download, RefreshCw, Send, Check, X,
  Database, AlertCircle, FileText, Upload, Video, Globe, Phone,
  Mail, Building, Save, ExternalLink, Share2, Play, Sparkles,
  Palette, HardDrive, RotateCcw, AlertTriangle, Layers, EyeOff,
  CheckSquare, Square, RefreshCcw, FileCode, Archive, ShieldCheck,
  HelpCircle, FileJson, Calendar, BookOpen, PlusCircle, CheckSquare2, LayoutDashboard, Image as ImageIcon, Lock, GraduationCap,
  MessageCircle, Key
} from 'lucide-react';
import { SupabaseBadge } from './SupabaseBadge';
import { SupabaseSyncButton } from './SupabaseSyncButton';
import { SupabaseSyncTab } from './SupabaseSyncTab';
import { WhatsAppAnnouncementModal } from './WhatsAppAnnouncementModal';
import {
  getPrimaryParentContact,
  cleanWhatsAppNumber,
  getWhatsAppSentHistory,
  WhatsAppTemplateKey,
  WhatsAppSentRecord
} from '../utils/whatsappAnnouncement';
import { CbtDashboardAdmin } from './cbt/CbtDashboardAdmin';
import { CbtKategoriManager } from './cbt/CbtKategoriManager';
import { CbtBankSoalManager } from './cbt/CbtBankSoalManager';
import { CbtImportSoal } from './cbt/CbtImportSoal';
import { CbtJadwalUjianManager } from './cbt/CbtJadwalUjianManager';
import { CbtMonitoring } from './cbt/CbtMonitoring';
import { CbtHasilDanRanking } from './cbt/CbtHasilDanRanking';
import { AdminFormPaymentSection } from './payment/AdminFormPaymentSection';
import { AdminBamPaymentSection } from './payment/AdminBamPaymentSection';
import { AdminPaymentHistorySection } from './payment/AdminPaymentHistorySection';
import { UserManagementSection } from './UserManagementSection';
import { AccountSettingsSection } from './AccountSettingsSection';
import { FilledClassesSection } from './FilledClassesSection';
import { PaymentRepository } from '../repositories/PaymentRepository';
import { StudentRepository } from '../repositories/StudentRepository';
import { ClassQuotaRepository } from '../repositories/ClassQuotaRepository';
import { getStudentCategory, getTotalBamCost } from '../utils/bamPricing';
import { saveHasilUjianSupabase } from '../services/cbtSupabaseService';
import Swal from 'sweetalert2';


interface AdminDashboardProps {
  currentUser: UserAccount;
  students: StudentData[];
  classQuotas: ClassQuota[];
  costBreakdowns: CostBreakdown[];
  schoolInfo: SchoolInfo;
  testSchedules: TestSchedule[];
  gasConfig: GasConfig;
  websiteConfig?: WebsiteConfig;
  onUpdateStudents: (updated: StudentData[]) => void;
  onUpdateQuotas: (updated: ClassQuota[]) => void;
  onUpdateSchoolInfo: (updated: SchoolInfo) => void;
  onUpdateGasConfig: (updated: GasConfig) => void;
  onUpdateCostBreakdowns?: (updated: CostBreakdown[]) => void;
  onUpdateWebsiteConfig?: (updated: WebsiteConfig) => void;
  onUpdateSchedules?: (updated: TestSchedule[]) => void;
  onRefreshAllData?: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  students,
  classQuotas,
  costBreakdowns,
  schoolInfo,
  testSchedules,
  gasConfig,
  websiteConfig,
  onUpdateStudents,
  onUpdateQuotas,
  onUpdateSchoolInfo,
  onUpdateGasConfig,
  onUpdateCostBreakdowns,
  onUpdateWebsiteConfig,
  onUpdateSchedules,
  onRefreshAllData,
  activeTab: externalTab,
  onTabChange,
}) => {
  const [internalTab, setInternalTab] = useState<
    'overview' | 'applicants' | 'payment_form' | 'payment_initial' | 'payment_history' | 'documents' | 'scores' | 'announcements' | 'quotas' | 'placement' | 'reports' | 'gas_sync' | 'settings' | 'website_settings' | 'database_management' | 'question_bank' | 'user_management'
  >('overview');


  const ALL_SUPPORTED_ADMIN_TABS = [
    'overview', 'user_management', 'account_settings', 'default_credentials', 'applicants', 'payment_form',
    'payment_initial', 'payment_history', 'scores', 'announcements', 'quotas',
    'placement', 'filled_classes', 'question_bank', 'gas_sync', 'settings',
    'website_settings', 'database_management', 'cbt_dashboard', 'cbt_kategori',
    'cbt_bank_soal', 'cbt_import', 'cbt_jadwal', 'cbt_monitoring', 'cbt_hasil', 'cbt_ranking'
  ];

  const rawTab = (externalTab as string) || internalTab;
  const activeTab = (ALL_SUPPORTED_ADMIN_TABS.includes(rawTab) || rawTab.startsWith('cbt_')) ? rawTab : 'overview';

  const setActiveTab = (tab: any) => {
    setInternalTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  // State: Bank Soal
  const [questionBank, setQuestionBank] = useState<ExamQuestion[]>(() => getStoredQuestionBank());
  const [questionCategoryFilter, setQuestionCategoryFilter] = useState<'all' | 'diagnostik' | 'pengetahuan_umum' | 'diniyyah'>('all');
  const [isQuestionsLoading, setIsQuestionsLoading] = useState(false);
  const [lastQuestionsSync, setLastQuestionsSync] = useState<Date | null>(null);

  const fetchQuestionsFromSupabase = async () => {
    setIsQuestionsLoading(true);
    try {
      const data = await ExamQuestionRepository.list();
      if (data && data.length > 0) {
        setQuestionBank(data);
        setLastQuestionsSync(new Date());
      }
    } catch (err) {
      console.warn('Error fetching questions in AdminDashboard:', err);
    } finally {
      setIsQuestionsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestionsFromSupabase();

    const unsubscribe = ExamQuestionRepository.subscribe((updated) => {
      if (updated && updated.length > 0) {
        setQuestionBank(updated);
        setLastQuestionsSync(new Date());
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);
  
  // Modal & Form State: Tambah / Edit Soal
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [qCategory, setQCategory] = useState<'diagnostik' | 'pengetahuan_umum' | 'diniyyah'>('diagnostik');
  const [qText, setQText] = useState('');
  const [qOptA, setQOptA] = useState('');
  const [qOptB, setQOptB] = useState('');
  const [qOptC, setQOptC] = useState('');
  const [qOptD, setQOptD] = useState('');
  const [qCorrectIndex, setQCorrectIndex] = useState<number>(0);
  const [qPoints, setQPoints] = useState<number>(10);

  // Modal & Form State: Import Soal Massal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importInputText, setImportInputText] = useState('');
  const [importMode, setImportMode] = useState<'json' | 'text'>('json');
  const [importSuccessMsg, setImportSuccessMsg] = useState('');

  // Modal & Form State: Schedule Management
  const [schedulesList, setSchedulesList] = useState<TestSchedule[]>(testSchedules);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedId, setEditingSchedId] = useState<string | null>(null);
  const [schedWave, setSchedWave] = useState('Gelombang 1');
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('08:00 - 11:30 WIB');
  const [schedDuration, setSchedDuration] = useState<number>(90);
  const [schedLocation, setSchedLocation] = useState('Ruang Ujian Online SPMB / Lab Komputer SMP Al-Hadiid');
  const [schedNotes, setSchedNotes] = useState('Harap membawa Bukti Pendaftaran & Alat Tulis lengkap.');
  const [schedOnlineActive, setSchedOnlineActive] = useState<boolean>(true);

  React.useEffect(() => {
    setSchedulesList(testSchedules);
  }, [testSchedules]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);

  // State: WhatsApp Announcement Modal & Sent Records
  const [waModalStudent, setWaModalStudent] = useState<StudentData | null>(null);
  const [waDefaultTemplate, setWaDefaultTemplate] = useState<WhatsAppTemplateKey | undefined>(undefined);
  const [waSentHistory, setWaSentHistory] = useState<Record<string, WhatsAppSentRecord>>(() => getWhatsAppSentHistory());
  const [announcementFilter, setAnnouncementFilter] = useState<'all' | 'passed' | 'passed_reserved' | 'failed' | 'wa_sent' | 'wa_not_sent'>('all');
  const [announcementSearch, setAnnouncementSearch] = useState<string>('');

  // BAM Verification form state (Tahap 8 Alur SPMB: Verifikasi Bukti & Input Nominal ke Tabel Pembayaran)
  const [bamVerifyNominal, setBamVerifyNominal] = useState<number>(11000000);
  const [bamVerifyDate, setBamVerifyDate] = useState<string>('');
  const [bamVerifyType, setBamVerifyType] = useState<BamInstallmentType>('Lunas');
  const [bamVerifyNotes, setBamVerifyNotes] = useState<string>('');

  React.useEffect(() => {
    if (selectedStudent) {
      const category = getStudentCategory(selectedStudent);
      const defaultNominal = selectedStudent.initialPaymentAmount || getTotalBamCost(category);
      setBamVerifyNominal(defaultNominal);
      setBamVerifyDate(selectedStudent.initialPaymentDate || new Date().toISOString().split('T')[0]);
      setBamVerifyType('Lunas');
      setBamVerifyNotes(selectedStudent.initialPaymentNotes || `Pembayaran BAM ${selectedStudent.fullName}`);
    }
  }, [selectedStudent]);

  // Score editing modal state
  const [editingScoreStudent, setEditingScoreStudent] = useState<StudentData | null>(null);
  const [diagScore, setDiagScore] = useState<number>(80);
  const [generalScore, setGeneralScore] = useState<number>(80);
  const [relScore, setRelScore] = useState<number>(80);

  // Quota editing / new class modal state
  const [newClassName, setNewClassName] = useState('');
  const [newCapacity, setNewCapacity] = useState<number>(32);
  const [newHomeroom, setNewHomeroom] = useState('');
  const [editingQuota, setEditingQuota] = useState<ClassQuota | null>(null);
  const [editClassName, setEditClassName] = useState('');
  const [editCapacity, setEditCapacity] = useState<number>(32);
  const [editHomeroom, setEditHomeroom] = useState('');
  const [editAcademicYear, setEditAcademicYear] = useState('2027/2028');
  const [isSyncingQuota, setIsSyncingQuota] = useState(false);
  const [showQuotaSqlModal, setShowQuotaSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [quotaTableStatus, setQuotaTableStatus] = useState<{
    tableExists: boolean;
    rowCount: number;
    source: 'table' | 'state' | 'initial';
    error: string | null;
  } | null>(null);

  React.useEffect(() => {
    if (activeTab === 'quotas') {
      ClassQuotaRepository.getTableStatus().then(setQuotaTableStatus).catch(() => {});
    }
  }, [activeTab]);

  // School Info Form state
  const [schoolForm, setSchoolForm] = useState<SchoolInfo>(schoolInfo);
  const [saveSchoolSuccess, setSaveSchoolSuccess] = useState<string>('');
  const [isUploadingBrochure, setIsUploadingBrochure] = useState<boolean>(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState<boolean>(false);

  React.useEffect(() => {
    setSchoolForm(schoolInfo);
  }, [schoolInfo]);

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file logo sekolah maksimal 5 MB.');
      return;
    }

    setIsUploadingLogo(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64Url = reader.result as string;
      const formattedSize = (file.size / 1024).toFixed(0) + ' KB';

      setSchoolForm((prev) => ({
        ...prev,
        logoUrl: base64Url,
        logoFileName: file.name,
        logoFileSize: formattedSize,
      }));
      setIsUploadingLogo(false);
    };
    reader.readAsDataURL(file);
  };

  const handleBrochureFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('Ukuran file brosur maksimal 15 MB.');
      return;
    }

    setIsUploadingBrochure(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64Url = reader.result as string;
      const formattedSize = (file.size / (1024 * 1024)).toFixed(1) + ' MB';

      setSchoolForm((prev) => ({
        ...prev,
        brochureUrl: base64Url,
        brochureFileName: file.name,
        brochureFileType: file.type,
        brochureFileSize: formattedSize,
      }));
      setIsUploadingBrochure(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSchoolInfo = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSchoolInfo(schoolForm);
    setSaveSchoolSuccess('Data Informasi Sekolah, Brosur, & Video Profil Berhasil Diperbarui!');
    setTimeout(() => {
      setSaveSchoolSuccess('');
    }, 5000);
  };

  // Website Settings Form state
  const [webForm, setWebForm] = useState<WebsiteConfig>(() => websiteConfig || getStoredWebsiteConfig());
  const [saveWebSuccess, setSaveWebSuccess] = useState<string>('');

  React.useEffect(() => {
    if (websiteConfig) {
      setWebForm(websiteConfig);
    }
  }, [websiteConfig]);

  const handleSaveWebsiteSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateWebsiteConfig) {
      onUpdateWebsiteConfig(webForm);
    }
    setSaveWebSuccess('Pengaturan Tampilan Website Berhasil Disimpan!');
    setTimeout(() => {
      setSaveWebSuccess('');
    }, 4000);
  };

  // Database Management states
  const [dbSuccessMsg, setDbSuccessMsg] = useState<string>('');
  const [dbErrMsg, setDbErrMsg] = useState<string>('');
  const [purgeModalOpen, setPurgeModalOpen] = useState<boolean>(false);
  const [purgeInputText, setPurgeInputText] = useState<string>('');
  const [resetModalOpen, setResetModalOpen] = useState<boolean>(false);
  const [resetInputText, setResetInputText] = useState<string>('');

  const handleDownloadBackupJson = () => {
    try {
      const jsonStr = exportAllDataAsBackup();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `Backup_SPMB_${schoolInfo.name.replace(/\s+/g, '_')}_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDbSuccessMsg('File backup JSON berhasil dibuat dan diunduh!');
      setTimeout(() => setDbSuccessMsg(''), 5000);
    } catch (err: any) {
      setDbErrMsg('Gagal mengunduh backup: ' + err.message);
      setTimeout(() => setDbErrMsg(''), 5000);
    }
  };

  const handleRestoreJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      const res = importBackupData(content);
      if (res.success) {
        setDbSuccessMsg(res.message);
        if (onRefreshAllData) onRefreshAllData();
        setTimeout(() => setDbSuccessMsg(''), 6000);
      } else {
        setDbErrMsg(res.message);
        setTimeout(() => setDbErrMsg(''), 6000);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset input
  };

  const handleConfirmPurgeApplicants = () => {
    if (purgeInputText.trim() !== 'HAPUS PENDAFTAR') return;
    purgeApplicantData();
    if (onRefreshAllData) onRefreshAllData();
    setPurgeModalOpen(false);
    setPurgeInputText('');
    setDbSuccessMsg('Seluruh data pendaftar dan statistik kuota kelas terisi berhasil dibersihkan!');
    setTimeout(() => setDbSuccessMsg(''), 6000);
  };

  const handleConfirmResetTotal = () => {
    if (resetInputText.trim() !== 'RESET TOTAL') return;
    resetAllDataToDefault();
    if (onRefreshAllData) onRefreshAllData();
    setResetModalOpen(false);
    setResetInputText('');
    setDbSuccessMsg('Database berhasil di-reset ke setelan awal pabrik!');
    setTimeout(() => setDbSuccessMsg(''), 6000);
  };

  // Muat kredensial akun terpusat dari Supabase saat dashboard admin terbuka
  useEffect(() => {
    fetchStudentCredentialsFromSupabase().catch(() => {});
  }, []);

  // State & Handler for Form PDF Download
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string>('');

  const handleDownloadStudentForm = (student: StudentData) => {
    try {
      generateRegistrationPDF(student, schoolInfo);
      setDownloadSuccessMsg(`✓ Berhasil mengunduh formulir SPMB: ${student.fullName} (${student.registrationNumber || 'No-Reg'})`);
      setTimeout(() => setDownloadSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error('Gagal mengunduh formulir:', err);
      alert('Terjadi kendala saat mengunduh formulir: ' + (err?.message || 'Pastikan data murid valid'));
    }
  };

  const handleDownloadExamCard = (student: StudentData) => {
    try {
      const activeSched = testSchedules?.find(s => s.isOnlineActive === true) || testSchedules?.[0];
      const storedCred = getStudentCredentials(student.id) || getStudentCredentials(student.registrationNumber) || getStudentCredentials(student.userEmail);
      const embeddedCred = (student.testAnswers as any)?._accountCredentials || (student.testAnswers as any)?._credentials;

      const candidateUsername = (
        student.username ||
        student.examUsername ||
        embeddedCred?.username ||
        storedCred?.username ||
        (typeof window !== 'undefined' ? (
          localStorage.getItem(`spmb_user_${student.id}`) ||
          localStorage.getItem(`spmb_user_${student.registrationNumber}`) ||
          localStorage.getItem(`spmb_user_${student.userEmail?.toLowerCase()}`) ||
          ''
        ) : '') ||
        (student.userEmail ? student.userEmail.split('@')[0] : '') ||
        student.registrationNumber ||
        'siswa'
      ).trim();

      const candidatePassword = (
        student.password ||
        student.examPassword ||
        embeddedCred?.password ||
        storedCred?.password ||
        (typeof window !== 'undefined' ? (
          localStorage.getItem(`spmb_cred_${student.id}`) ||
          localStorage.getItem(`spmb_cred_${student.registrationNumber}`) ||
          localStorage.getItem(`spmb_cred_${student.userEmail?.toLowerCase()}`) ||
          localStorage.getItem(`spmb_cred_${candidateUsername.toLowerCase()}`) ||
          ''
        ) : '') ||
        'siswa123'
      ).trim();

      const creds = {
        username: candidateUsername,
        password: candidatePassword,
      };
      generateExamCardPDF(student, schoolInfo, activeSched, creds);
      setDownloadSuccessMsg(`✓ Berhasil mengunduh Kartu Ujian: ${student.fullName} (${student.registrationNumber || 'No-Reg'})`);
      setTimeout(() => setDownloadSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error('Gagal mengunduh kartu ujian:', err);
      alert('Terjadi kendala saat mengunduh kartu ujian: ' + (err?.message || 'Pastikan data murid valid'));
    }
  };

  const handleDownloadExamResult = (student: StudentData) => {
    try {
      generateExamResultPDF(student, schoolInfo);
      setDownloadSuccessMsg(`✓ Berhasil mengunduh Hasil Ujian: ${student.fullName} (${student.registrationNumber || 'No-Reg'})`);
      setTimeout(() => setDownloadSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error('Gagal mengunduh hasil ujian:', err);
      alert('Terjadi kendala saat mengunduh hasil ujian: ' + (err?.message || 'Pastikan data murid valid'));
    }
  };

  const handleAllowRetest = (studentId: string) => {
    const updated = students.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          isTestActive: true,
          testSubmitted: false,
          status: 'scheduled_test' as const,
        };
      }
      return s;
    });
    onUpdateStudents(updated);
    setDownloadSuccessMsg('✓ Fitur Ujian Diulang (Remedial) berhasil diaktifkan untuk calon murid!');
    setTimeout(() => setDownloadSuccessMsg(''), 5000);
  };

  // Filtered Students
  const filteredStudents = students.filter(s => {
    const matchSearch =
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone.includes(searchQuery) ||
      s.userEmail.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchStatus = false;
    if (statusFilter === 'all') {
      matchStatus = true;
    } else if (statusFilter === 'ready_download') {
      matchStatus = canDownloadStudentForm(s);
    } else {
      matchStatus = s.status === statusFilter;
    }

    return matchSearch && matchStatus;
  });

  // Action: Verify Form Payment (Tahap 3) & Unlock Form Download
  const handleVerifyFormPayment = (studentId: string, status: 'verified' | 'rejected') => {
    const targetStudent = students.find(s => s.id === studentId);
    if (!targetStudent) return;
    const isVerified = status === 'verified';

    const updated = students.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          formPaymentStatus: status,
          isFormVerified: isVerified,
          isFormVerifiedByAdmin: isVerified,
          status: isVerified
            ? (s.status === 'draft' || s.status === 'pending_payment' || s.status === 'verifying_payment' ? ('filling_form' as const) : s.status)
            : ('pending_payment' as const),
        };
      }
      return s;
    });
    onUpdateStudents(updated);

    // Sync to Supabase payments table
    PaymentRepository.create({
      studentId: targetStudent.id,
      registrationNumber: targetStudent.registrationNumber || `SPMB${Date.now().toString().slice(-8)}`,
      studentName: targetStudent.fullName,
      paymentType: 'form',
      amount: targetStudent.formPaymentAmount || 200000,
      status: status,
      paymentMethod: 'Transfer Bank',
      bankName: 'BSI',
      paymentDate: targetStudent.formPaymentDate || new Date().toISOString().split('T')[0],
      proofUrl: targetStudent.formPaymentProofUrl,
      notes: isVerified ? 'Verifikasi Pembayaran Formulir oleh Panitia Admin' : 'Pembayaran Formulir Ditolak',
    }).catch(err => console.warn('PaymentRepository form verify sync error:', err));

    // Update student row in Supabase
    StudentRepository.update(targetStudent.id, {
      formPaymentStatus: status,
    }).catch(err => console.warn('StudentRepository update error:', err));

    // Also update selectedStudent modal state if currently open
    if (selectedStudent && selectedStudent.id === studentId) {
      setSelectedStudent(prev => prev ? {
        ...prev,
        formPaymentStatus: status,
      } : null);
    }

    alert(
      isVerified
        ? `✓ Pembayaran Formulir untuk ${targetStudent.fullName} Berhasil Diverifikasi Lunas!`
        : `Status pembayaran formulir untuk ${targetStudent.fullName} diubah menjadi Ditolak.`
    );
  };

  // Action: Verify Payment + Form Data (Activates PDF Download & Verification for Student & Admin)
  const handleVerifyFormAndData = (studentId: string, isVerified: boolean) => {
    const targetStudent = students.find(s => s.id === studentId);
    if (!targetStudent) return;

    const updated = students.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          formPaymentStatus: isVerified ? ('verified' as const) : ('rejected' as const),
          isFormVerified: isVerified,
          isFormVerifiedByAdmin: isVerified,
          status: isVerified
            ? ('form_verified' as const)
            : (s.status === 'form_verified' ? ('form_submitted' as const) : s.status),
        };
      }
      return s;
    });
    onUpdateStudents(updated);

    // Sync to Supabase payments table
    PaymentRepository.create({
      studentId: targetStudent.id,
      registrationNumber: targetStudent.registrationNumber || `SPMB${Date.now().toString().slice(-8)}`,
      studentName: targetStudent.fullName,
      paymentType: 'form',
      amount: targetStudent.formPaymentAmount || 200000,
      status: isVerified ? 'verified' : 'rejected',
      paymentMethod: 'Transfer Bank',
      bankName: 'BSI',
      paymentDate: targetStudent.formPaymentDate || new Date().toISOString().split('T')[0],
      proofUrl: targetStudent.formPaymentProofUrl,
      notes: isVerified ? 'Verifikasi Pembayaran & Data Calon Murid oleh Panitia Admin' : 'Verifikasi Ditolak',
    }).catch(err => console.warn('PaymentRepository form verify sync error:', err));

    StudentRepository.update(targetStudent.id, {
      formPaymentStatus: isVerified ? 'verified' : targetStudent.formPaymentStatus,
    }).catch(err => console.warn('StudentRepository update error:', err));

    if (selectedStudent && selectedStudent.id === studentId) {
      setSelectedStudent(prev => prev ? {
        ...prev,
        formPaymentStatus: isVerified ? ('verified' as const) : ('rejected' as const),
        isFormVerified: isVerified,
        isFormVerifiedByAdmin: isVerified,
        status: isVerified ? ('form_verified' as const) : (prev.status === 'form_verified' ? ('form_submitted' as const) : prev.status),
      } : null);
    }

    alert(
      isVerified
        ? `✓ Verifikasi Berhasil!\n\nPembayaran & Data Calon Murid atas nama ${targetStudent.fullName} telah DIVERIFIKASI RESMI oleh Panitia Admin.\n\n1. Panitia Admin dapat langsung mendownload Formulir Pendaftaran calon murid.\n2. Calon murid kini dapat mendownload Formulir Pendaftaran dan Kartu Ujian di dashboard mereka.`
        : `Status verifikasi pendaftaran untuk ${targetStudent.fullName} dibatalkan.`
    );
  };

  // Action: Toggle Active Test Schedule for Candidate
  const handleToggleTestActive = (studentId: string, isActive: boolean) => {
    const updated = students.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          isTestActive: isActive,
          status: isActive ? ('scheduled_test' as const) : s.status,
        };
      }
      return s;
    });
    onUpdateStudents(updated);
    alert(isActive ? '🔓 Fitur Ujian Online untuk Calon Murid telah DIAKTIFKAN!' : '🔒 Fitur Ujian Online di-Nonaktifkan.');
  };

  // Action: Add / Update Question in Bank
  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qText.trim() || !qOptA.trim() || !qOptB.trim() || !qOptC.trim() || !qOptD.trim()) {
      alert('Mohon lengkapi teks soal dan seluruh opsi pilihan A, B, C, dan D.');
      return;
    }

    const newQuestion: ExamQuestion = {
      id: editingQuestionId || `q_${Date.now()}`,
      category: qCategory,
      questionText: qText.trim(),
      options: [qOptA.trim(), qOptB.trim(), qOptC.trim(), qOptD.trim()],
      correctOptionIndex: qCorrectIndex,
      points: Number(qPoints) || 10,
    };

    let updatedList: ExamQuestion[];
    if (editingQuestionId) {
      updatedList = questionBank.map(q => (q.id === editingQuestionId ? newQuestion : q));
    } else {
      updatedList = [newQuestion, ...questionBank];
    }

    setQuestionBank(updatedList);
    saveQuestionBank(updatedList);
    setShowQuestionModal(false);
    setEditingQuestionId(null);
    setQText('');
    setQOptA('');
    setQOptB('');
    setQOptC('');
    setQOptD('');
    alert('✓ Soal berhasil disimpan ke dalam Bank Soal!');
  };

  const handleEditQuestion = (q: ExamQuestion) => {
    setEditingQuestionId(q.id);
    setQCategory(q.category as any);
    setQText(q.questionText);
    setQOptA(q.options[0] || '');
    setQOptB(q.options[1] || '');
    setQOptC(q.options[2] || '');
    setQOptD(q.options[3] || '');
    setQCorrectIndex(q.correctOptionIndex);
    setQPoints(q.points);
    setShowQuestionModal(true);
  };

  const handleDeleteQuestion = (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus soal ini dari Bank Soal?')) return;
    const updatedList = questionBank.filter(q => q.id !== id);
    setQuestionBank(updatedList);
    saveQuestionBank(updatedList);
  };

  const handleOpenNewQuestionModal = () => {
    setEditingQuestionId(null);
    setQCategory('diagnostik');
    setQText('');
    setQOptA('');
    setQOptB('');
    setQOptC('');
    setQOptD('');
    setQCorrectIndex(0);
    setQPoints(10);
    setShowQuestionModal(true);
  };

  // Action: Import Soal Massal (JSON / Text)
  const handleImportQuestions = () => {
    if (!importInputText.trim()) {
      alert('Masukkan data JSON atau Teks Format Soal.');
      return;
    }

    try {
      if (importMode === 'json') {
        const parsed = JSON.parse(importInputText);
        if (!Array.isArray(parsed)) {
          alert('Format JSON harus berupa Array / Daftar Objek Soal [ { ... } ].');
          return;
        }

        const validQuestions: ExamQuestion[] = parsed.map((item: any, idx: number) => ({
          id: item.id || `q_imp_${Date.now()}_${idx}`,
          category: ['diagnostik', 'pengetahuan_umum', 'diniyyah'].includes(item.category)
            ? item.category
            : 'diagnostik',
          questionText: String(item.questionText || item.question || item.soal || 'Soal Tanpa Teks'),
          options: Array.isArray(item.options) && item.options.length >= 4
            ? item.options.slice(0, 4).map(String)
            : [
                String(item.optionA || item.a || 'Pilihan A'),
                String(item.optionB || item.b || 'Pilihan B'),
                String(item.optionC || item.c || 'Pilihan C'),
                String(item.optionD || item.d || 'Pilihan D'),
              ],
          correctOptionIndex: typeof item.correctOptionIndex === 'number'
            ? item.correctOptionIndex
            : typeof item.correct === 'number'
            ? item.correct
            : item.kunci === 'B' || item.kunci === 'b' ? 1
            : item.kunci === 'C' || item.kunci === 'c' ? 2
            : item.kunci === 'D' || item.kunci === 'd' ? 3 : 0,
          points: Number(item.points) || 10,
        }));

        const updated = [...validQuestions, ...questionBank];
        setQuestionBank(updated);
        saveQuestionBank(updated);
        setImportSuccessMsg(`✓ Berhasil mengimpor ${validQuestions.length} soal ke dalam Bank Soal!`);
        setTimeout(() => setImportSuccessMsg(''), 4000);
        setShowImportModal(false);
        setImportInputText('');
      } else {
        const blocks = importInputText.split(/---|===|\n\n+/);
        const parsedQuestions: ExamQuestion[] = [];

        blocks.forEach((block, idx) => {
          const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
          if (lines.length >= 5) {
            let cat: 'diagnostik' | 'pengetahuan_umum' | 'diniyyah' = 'diagnostik';
            let qStr = '';
            let optA = '', optB = '', optC = '', optD = '';
            let keyIndex = 0;

            lines.forEach(line => {
              const lower = line.toLowerCase();
              if (lower.startsWith('kategori:') || lower.startsWith('category:')) {
                const val = line.split(':')[1]?.trim().toLowerCase();
                if (val?.includes('umum') || val?.includes('tpu')) cat = 'pengetahuan_umum';
                else if (val?.includes('dini') || val?.includes('agama')) cat = 'diniyyah';
                else cat = 'diagnostik';
              } else if (lower.startsWith('soal:') || lower.startsWith('q:')) {
                qStr = line.substring(line.indexOf(':') + 1).trim();
              } else if (lower.startsWith('a:') || lower.startsWith('a.')) {
                optA = line.substring(line.indexOf(':') > -1 ? line.indexOf(':') + 1 : line.indexOf('.') + 1).trim();
              } else if (lower.startsWith('b:') || lower.startsWith('b.')) {
                optB = line.substring(line.indexOf(':') > -1 ? line.indexOf(':') + 1 : line.indexOf('.') + 1).trim();
              } else if (lower.startsWith('c:') || lower.startsWith('c.')) {
                optC = line.substring(line.indexOf(':') > -1 ? line.indexOf(':') + 1 : line.indexOf('.') + 1).trim();
              } else if (lower.startsWith('d:') || lower.startsWith('d.')) {
                optD = line.substring(line.indexOf(':') > -1 ? line.indexOf(':') + 1 : line.indexOf('.') + 1).trim();
              } else if (lower.startsWith('kunci:') || lower.startsWith('key:')) {
                const k = line.split(':')[1]?.trim().toUpperCase();
                if (k === 'B') keyIndex = 1;
                else if (k === 'C') keyIndex = 2;
                else if (k === 'D') keyIndex = 3;
                else keyIndex = 0;
              } else if (!qStr) {
                qStr = line;
              }
            });

            if (qStr && optA && optB) {
              parsedQuestions.push({
                id: `q_txt_${Date.now()}_${idx}`,
                category: cat,
                questionText: qStr,
                options: [optA, optB, optC || 'Opsi C', optD || 'Opsi D'],
                correctOptionIndex: keyIndex,
                points: 10,
              });
            }
          }
        });

        if (parsedQuestions.length === 0) {
          alert('Tidak dapat mendeteksi format soal. Pastikan menyertakan Soal, Opsi A/B/C/D, dan Kunci.');
          return;
        }

        const updated = [...parsedQuestions, ...questionBank];
        setQuestionBank(updated);
        saveQuestionBank(updated);
        setImportSuccessMsg(`✓ Berhasil mengimpor ${parsedQuestions.length} soal dari format teks!`);
        setTimeout(() => setImportSuccessMsg(''), 4000);
        setShowImportModal(false);
        setImportInputText('');
      }
    } catch (err: any) {
      alert('Gagal mengimpor soal. Periksa kembali format input data: ' + (err.message || ''));
    }
  };

  // Action: Add / Update Test Schedule
  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedWave.trim() || !schedDate) {
      alert('Mohon isi Nama Gelombang dan Tanggal Ujian.');
      return;
    }

    const newSched: TestSchedule = {
      id: editingSchedId || `ts_${Date.now()}`,
      waveName: schedWave.trim(),
      testDate: schedDate,
      testTime: schedTime.trim(),
      durationMinutes: Number(schedDuration) || 90,
      location: schedLocation.trim(),
      notes: schedNotes.trim(),
      isOnlineActive: schedOnlineActive,
    };

    let updated: TestSchedule[];
    if (editingSchedId) {
      updated = schedulesList.map(s => (s.id === editingSchedId ? newSched : s));
    } else {
      updated = [...schedulesList, newSched];
    }

    setSchedulesList(updated);
    saveTestSchedules(updated);
    if (onUpdateSchedules) onUpdateSchedules(updated);

    setShowScheduleModal(false);
    setEditingSchedId(null);
    alert('✓ Jadwal Ujian berhasil disimpan!');
  };

  const handleEditSchedule = (s: TestSchedule) => {
    setEditingSchedId(s.id);
    setSchedWave(s.waveName);
    setSchedDate(s.testDate);
    setSchedTime(s.testTime);
    setSchedDuration(s.durationMinutes || 90);
    setSchedLocation(s.location);
    setSchedNotes(s.notes);
    setSchedOnlineActive(s.isOnlineActive !== false);
    setShowScheduleModal(true);
  };

  const handleDeleteSchedule = (id: string) => {
    if (!confirm('Hapus jadwal tes ini?')) return;
    const updated = schedulesList.filter(s => s.id !== id);
    setSchedulesList(updated);
    saveTestSchedules(updated);
    if (onUpdateSchedules) onUpdateSchedules(updated);
  };

  const handleToggleScheduleOnline = (id: string, active: boolean) => {
    const updated = schedulesList.map(s => (s.id === id ? { ...s, isOnlineActive: active } : s));
    setSchedulesList(updated);
    saveTestSchedules(updated);
    if (onUpdateSchedules) onUpdateSchedules(updated);
  };

  // Action: Mass Toggle Ujian Online untuk Seluruh Calon Murid
  const handleMassToggleOnlineExam = (activate: boolean) => {
    const count = students.filter(s => s.status !== 'draft').length;
    if (!confirm(activate ? `Aktifkan akses Ujian Online untuk seluruh (${count}) calon murid?` : `Nonaktifkan Ujian Online untuk semua murid?`)) return;

    const updated = students.map(s => ({
      ...s,
      isTestActive: activate,
      status: activate && s.status === 'form_verified' ? ('scheduled_test' as const) : s.status,
    }));
    onUpdateStudents(updated);
    alert(activate ? `🔓 Ujian Online berhasil DIAKTIFKAN untuk ${count} calon murid!` : `🔒 Akses Ujian Online telah DITUTUP.`);
  };

  // Action: Save Grades & Calculate Score (Tahap 7 & 8)
  const handleSaveGrades = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingScoreStudent) return;

    // Weighted score: Diagnostik 30%, TPU 40%, Diniyyah 30%
    const weighted = parseFloat(((diagScore * 0.3) + (generalScore * 0.4) + (relScore * 0.3)).toFixed(1));

    const updated = students.map(s => {
      if (s.id === editingScoreStudent.id) {
        return {
          ...s,
          diagnosticScore: diagScore,
          generalScore,
          religiousScore: relScore,
          finalScore: weighted,
          status: 'test_completed' as const,
        };
      }
      return s;
    });

    onUpdateStudents(updated);

    // Sync to Supabase hasil_ujian directly to prevent discrepancies
    saveHasilUjianSupabase({
      id: `hasil_cbt_${editingScoreStudent.id}`,
      ujianId: '145eacad-ef02-4180-ba26-85b34d1649da',
      pesertaId: editingScoreStudent.id,
      registrationNumber: editingScoreStudent.registrationNumber || '',
      namaPeserta: editingScoreStudent.fullName,
      nilaiDiagnostik: diagScore,
      nilaiTpu: generalScore,
      nilaiDiniyyah: relScore,
      nilaiTotal: weighted,
      statusKelulusan: weighted >= 70 ? 'LULUS' : 'BELUM LULUS',
      tanggalUjian: new Date().toISOString().split('T')[0],
    }).catch(err => console.warn('saveHasilUjianSupabase in handleSaveGrades notice:', err));

    setEditingScoreStudent(null);
  };

  // Action: Set Admission Decision (Tahap 8 & 9)
  const handleSetDecision = (studentId: string, decision: 'passed' | 'passed_reserved' | 'failed') => {
    const updated = students.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          status: decision,
        };
      }
      return s;
    });
    onUpdateStudents(updated);

    const targetStudent = students.find(s => s.id === studentId);
    if (targetStudent) {
      const label = decision === 'passed' ? 'LULUS' : decision === 'passed_reserved' ? 'CADANGAN' : 'TIDAK LULUS';
      const templateKey: WhatsAppTemplateKey = decision === 'passed' ? 'passed' : decision === 'passed_reserved' ? 'passed_reserved' : 'failed';
      Swal.fire({
        icon: 'success',
        title: `Status: ${label}`,
        text: `Keputusan untuk ${targetStudent.fullName} berhasil disimpan. Kirim pesan pengumuman resmi ke nomor WhatsApp orang tua sekarang?`,
        showCancelButton: true,
        confirmButtonText: 'Kirim WA Sekarang',
        cancelButtonText: 'Nanti',
        confirmButtonColor: '#059669',
      }).then((res) => {
        if (res.isConfirmed) {
          setWaModalStudent({ ...targetStudent, status: decision });
          setWaDefaultTemplate(templateKey);
        }
      });
    }
  };

  // Action: Verify Initial Payment (Tahap 10 & 11)
  const handleVerifyInitialPayment = (studentId: string, status: 'verified' | 'rejected') => {
    const updated = students.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          initialPaymentStatus: status,
          status: status === 'verified' ? ('re_registered' as const) : ('passed' as const),
        };
      }
      return s;
    });
    onUpdateStudents(updated);
  };

  // Action: Verify BAM Transfer Proof with Nominal Input & Record into Payments Table (Tahap 8 Alur SPMB)
  const handleVerifyAndRecordBamPayment = async (
    student: StudentData,
    nominal: number,
    paymentDate: string,
    installmentType: BamInstallmentType,
    notes: string
  ) => {
    try {
      const category = getStudentCategory(student);
      const totalCost = getTotalBamCost(category);
      const effectiveNominal = Number(nominal) > 0 ? Number(nominal) : totalCost;
      const isLunas = effectiveNominal >= totalCost || installmentType === 'Lunas';
      const formattedDate = paymentDate || new Date().toISOString().split('T')[0];

      // 1. Update students state
      const updated = students.map(s => {
        if (s.id === student.id) {
          return {
            ...s,
            initialPaymentStatus: 'verified' as const,
            initialPaymentAmount: effectiveNominal,
            initialPaymentDate: formattedDate,
            initialPaymentNotes: notes || `Verifikasi Pembayaran BAM (${installmentType})`,
            status: isLunas ? ('re_registered' as const) : s.status,
          };
        }
        return s;
      });
      onUpdateStudents(updated);

      // 2. Add to BAM payment records
      const existingBamRecords = getStoredBamPayments();
      const newRecord: BamPaymentRecord = {
        id: `bam_${Date.now()}`,
        transactionNumber: `TRX-BAM-${Date.now().toString().slice(-6)}`,
        paymentDate: formattedDate,
        studentId: student.id,
        studentName: student.fullName,
        registrationNumber: student.registrationNumber || `SPMB${Date.now().toString().slice(-6)}`,
        gender: (student.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki'),
        totalBamCost: totalCost,
        amountPaid: effectiveNominal,
        installmentType: installmentType,
        totalPaidToDate: effectiveNominal,
        remainingBalance: Math.max(0, totalCost - effectiveNominal),
        proofUrl: student.initialPaymentProofUrl,
        notes: notes || `Verifikasi Pembayaran BAM Panitia SPMB (${installmentType})`,
        createdAt: new Date().toISOString(),
      };
      const updatedBamRecords = [newRecord, ...existingBamRecords.filter(r => r.studentId !== student.id)];
      saveBamPayments(updatedBamRecords);

      // 3. Sync to Supabase payments table
      try {
        await PaymentRepository.create({
          studentId: student.id,
          registrationNumber: student.registrationNumber || `SPMB${Date.now().toString().slice(-8)}`,
          studentName: student.fullName,
          paymentType: 'bam',
          amount: effectiveNominal,
          status: 'verified',
          paymentMethod: 'Transfer Bank',
          bankName: 'BSI',
          paymentDate: formattedDate,
          proofUrl: student.initialPaymentProofUrl,
          notes: notes || `Verifikasi Pembayaran BAM Panitia SPMB (${installmentType})`,
        });
      } catch (err) {
        console.warn('PaymentRepository BAM sync warning:', err);
      }

      // Update student in modal
      setSelectedStudent(prev => prev ? {
        ...prev,
        initialPaymentStatus: 'verified',
        initialPaymentAmount: effectiveNominal,
        initialPaymentDate: formattedDate,
        initialPaymentNotes: notes,
        status: isLunas ? 're_registered' : prev.status,
      } : null);

      setDownloadSuccessMsg(`✓ Berhasil verifikasi pembayaran BAM: ${student.fullName} (Rp ${effectiveNominal.toLocaleString('id-ID')}) tercatat di tabel pembayaran.`);
      setTimeout(() => setDownloadSuccessMsg(''), 5000);
      alert(`✓ Berhasil memverifikasi pembayaran BAM atas nama ${student.fullName} senilai Rp ${effectiveNominal.toLocaleString('id-ID')}. Data pembayaran telah masuk ke tabel pembayaran!`);
    } catch (err: any) {
      console.error('Gagal verifikasi BAM:', err);
      alert('Gagal memverifikasi pembayaran BAM: ' + (err?.message || 'Terjadi kesalahan'));
    }
  };

  // Action: Assign Class (Tahap 11 & 12)
  const handleAssignClass = (studentId: string, quotaId: string) => {
    const targetQuota = classQuotas.find(q => q.id === quotaId);
    if (!targetQuota) return;

    if (targetQuota.filled >= targetQuota.capacity) {
      alert(`Kuota kelas ${targetQuota.className} sudah penuh (Maksimal ${targetQuota.capacity} murid)!`);
      return;
    }

    const updated = students.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          assignedClassId: targetQuota.id,
          assignedClassName: targetQuota.className,
          assignedHomeroomTeacher: targetQuota.homeroomTeacher,
          firstDayDate: '2027-07-12',
          mplsInfo: 'Hadir Pukul 07:00 WIB memakai seragam SD asal.',
          status: 'class_assigned' as const,
        };
      }
      return s;
    });

    onUpdateStudents(updated);
  };

  // Action: Add New Class Quota
  const handleAddClassQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName) return;

    const newQuota: ClassQuota = {
      id: `q_${Date.now()}`,
      academicYear: schoolInfo.academicYear,
      level: 'Kelas 7',
      className: newClassName,
      capacity: newCapacity,
      filled: 0,
      homeroomTeacher: newHomeroom || 'Pengajar Al-Hadiid',
    };

    const nextQuotas = [...classQuotas, newQuota];
    onUpdateQuotas(nextQuotas);
    try {
      await ClassQuotaRepository.create(newQuota);
      ClassQuotaRepository.getTableStatus().then(setQuotaTableStatus).catch(() => {});
    } catch (err) {
      console.warn('Class quota create notice:', err);
    }

    setNewClassName('');
    setNewCapacity(32);
    setNewHomeroom('');
    Swal.fire({
      icon: 'success',
      title: 'Kelas Berhasil Ditambahkan!',
      text: `Rombel ${newQuota.className} dengan kuota ${newQuota.capacity} murid berhasil didaftarkan dan disinkronkan ke database.`,
      timer: 1800,
      showConfirmButton: false,
    });
  };

  const handleStartEditQuota = (quota: ClassQuota) => {
    setEditingQuota(quota);
    setEditClassName(quota.className);
    setEditCapacity(quota.capacity);
    setEditHomeroom(quota.homeroomTeacher || '');
    setEditAcademicYear(quota.academicYear || schoolInfo.academicYear);
  };

  const handleSaveEditQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuota || !editClassName.trim()) return;

    const targetId = editingQuota.id;
    const updates = {
      className: editClassName.trim(),
      capacity: Number(editCapacity) || 32,
      homeroomTeacher: editHomeroom.trim() || 'Pengajar Al-Hadiid',
      academicYear: editAcademicYear.trim() || schoolInfo.academicYear,
    };

    const updatedQuotas = classQuotas.map(q => {
      if (q.id === targetId) {
        return { ...q, ...updates };
      }
      return q;
    });

    onUpdateQuotas(updatedQuotas);
    try {
      await ClassQuotaRepository.update(targetId, updates);
      ClassQuotaRepository.getTableStatus().then(setQuotaTableStatus).catch(() => {});
    } catch (err) {
      console.warn('Class quota update notice:', err);
    }

    setEditingQuota(null);
    Swal.fire({
      icon: 'success',
      title: 'Kuota Kelas Diperbarui!',
      text: `Data rombel ${editClassName} berhasil diperbarui di database.`,
      timer: 1800,
      showConfirmButton: false,
    });
  };

  const handleDeleteClassQuota = (id: string, className: string) => {
    const assignedCount = students.filter(
      s => s.assignedClassId === id || s.assignedClassName?.toLowerCase() === className.toLowerCase()
    ).length;

    Swal.fire({
      title: `Hapus Kelas ${className}?`,
      html: assignedCount > 0
        ? `<div style="text-align: left; font-size: 13px; color: #334155; line-height: 1.5;">
            <p style="color: #e11d48; font-weight: bold; margin-bottom: 6px;">
              ⚠️ Peringatan: Terdapat ${assignedCount} calon murid yang telah ditempatkan pada rombel ini!
            </p>
            <p style="color: #64748b; font-size: 12px;">
              Menghapus rombel ini akan mengosongkan status kelas murid terkait pada database.
            </p>
           </div>`
        : `<p style="color: #334155; font-size: 13px;">Apakah Anda yakin ingin menghapus kelas ${className} dari database?</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus Rombel',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
    }).then(async (result) => {
      if (result.isConfirmed) {
        const filtered = classQuotas.filter(q => q.id !== id);
        onUpdateQuotas(filtered);
        try {
          await ClassQuotaRepository.remove(id);
          ClassQuotaRepository.getTableStatus().then(setQuotaTableStatus).catch(() => {});
        } catch (e) {
          console.warn('Remove class quota notice:', e);
        }
        Swal.fire({
          icon: 'success',
          title: 'Kelas Berhasil Dihapus',
          text: `Kelas ${className} telah dihapus dari sistem.`,
          timer: 1800,
          showConfirmButton: false,
        });
      }
    });
  };

  const handleRecalculateAndSyncQuotas = async () => {
    setIsSyncingQuota(true);
    try {
      const recalculated = await ClassQuotaRepository.recalculateFilledCounts(classQuotas, students);
      onUpdateQuotas(recalculated);
      await ClassQuotaRepository.syncAll(recalculated);
      const newStatus = await ClassQuotaRepository.getTableStatus();
      setQuotaTableStatus(newStatus);

      Swal.fire({
        icon: 'success',
        title: 'Sinkronisasi Selesai!',
        text: `Statistik kuota terisi berhasil dihitung ulang dari ${students.length} data murid dan disinkronkan ke Supabase.`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Sinkronisasi',
        text: err?.message || 'Terjadi kesalahan saat sinkronisasi kuota kelas.',
      });
    } finally {
      setIsSyncingQuota(false);
    }
  };

  // Export handlers
  const handleExportApplicantsExcel = () => {
    const data = students.map(s => ({
      No_Pendaftaran: s.registrationNumber,
      Nama_Lengkap: s.fullName,
      NIK: s.nik,
      NISN: s.nisn,
      Jenis_Kelamin: s.gender,
      Sekolah_Asal: s.previousSchoolName,
      No_HP_Ortu: s.phone,
      Nilai_Akhir: s.finalScore || '-',
      Status_SPMB: s.status,
      Bayar_Formulir: s.formPaymentStatus,
      Daftar_Ulang: s.initialPaymentStatus,
      Kelas: s.assignedClassName || '-',
    }));
    exportToExcel(data, `Data_Pendaftar_SPMB_${schoolInfo.academicYear.replace('/', '_')}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Admin Header */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-semibold mb-2 border border-blue-500/30">
              <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
              <span>Panel Panitia SPMB SMP Al-Hadiid Cileungsi</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Dashboard Administrator & Verifikator
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Petugas: {currentUser?.name || 'Panitia Admin'} ({currentUser?.email || 'admin@alhadiid.sch.id'})
            </p>
          </div>

          <div className="flex items-center gap-3">
            <SupabaseSyncButton variant="header" onDataSynced={onRefreshAllData} />

            <button
              onClick={handleExportApplicantsExcel}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel Pendaftar</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm text-xs font-bold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'overview' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('applicants')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'applicants' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Data Pendaftar ({students.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('payment_form')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'payment_form' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Verifikasi Bayar Formulir</span>
          </button>

          <button
            onClick={() => setActiveTab('scores')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'scores' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Input Nilai Tes</span>
          </button>

          <button
            onClick={() => setActiveTab('question_bank')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'question_bank' ? 'bg-indigo-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4 text-amber-300" />
            <span>Bank Soal & Jadwal Tes</span>
          </button>

          <button
            onClick={() => setActiveTab('cbt_dashboard')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab.startsWith('cbt_') ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md font-extrabold' : 'text-slate-600 hover:bg-slate-100 font-bold'
            }`}
          >
            <BookOpen className="w-4 h-4 text-amber-300" />
            <span>Sistem CBT Online</span>
            <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-black text-[10px]">8</span>
          </button>

          <button
            onClick={() => setActiveTab('announcements')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'announcements' ? 'bg-emerald-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:bg-slate-100 font-medium'
            }`}
          >
            <MessageCircle className="w-4 h-4 text-emerald-300" />
            <span>Pengumuman & WA Ortu</span>
          </button>

          <button
            onClick={() => setActiveTab('payment_initial')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'payment_initial' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Verifikasi Daftar Ulang</span>
          </button>

          <button
            onClick={() => setActiveTab('quotas')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'quotas' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <School className="w-4 h-4" />
            <span>Kuota Kelas</span>
          </button>

          <button
            onClick={() => setActiveTab('placement')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'placement' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Penempatan Kelas</span>
          </button>

          <button
            onClick={() => setActiveTab('gas_sync')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'gas_sync' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Database className="w-4 h-4 text-emerald-500" />
            <span>Google Sheet DB Sync</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Informasi & Media Sekolah</span>
          </button>

          <button
            onClick={() => setActiveTab('website_settings')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'website_settings' ? 'bg-rose-600 text-white shadow-sm font-semibold' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Tampilan Website</span>
          </button>

          <button
            onClick={() => setActiveTab('user_management')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'user_management' ? 'bg-amber-600 text-white shadow-sm font-bold ring-2 ring-amber-500/30' : 'bg-slate-900 text-amber-300 border border-amber-500/40 hover:bg-slate-800 font-bold'
            }`}
          >
            <User className="w-4 h-4 text-amber-400" />
            <span>Manajemen User & Akun (CRUD)</span>
          </button>

          <button
            onClick={() => setActiveTab('supabase_sync')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'supabase_sync' ? 'bg-blue-600 text-white shadow-sm font-bold ring-2 ring-blue-500/30' : 'text-slate-600 hover:bg-slate-100 font-semibold'
            }`}
          >
            <Database className="w-4 h-4 text-blue-500" />
            <span>Sinkron Supabase</span>
          </button>

          <button
            onClick={() => setActiveTab('database_management')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'database_management' ? 'bg-amber-600 text-white shadow-sm font-semibold' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Database (Hapus & Backup)</span>
          </button>

          {currentUser?.role === 'super_admin' && (
            <>
              <button
                onClick={() => setActiveTab('account_settings')}
                className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'account_settings'
                    ? 'bg-amber-600 text-white shadow-sm font-bold ring-2 ring-amber-500/30'
                    : 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 font-semibold'
                }`}
              >
                <Lock className="w-4 h-4 text-amber-600" />
                <span>Pengaturan Hak Akses Akun</span>
              </button>

              <button
                onClick={() => setActiveTab('default_credentials')}
                className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'default_credentials'
                    ? 'bg-amber-600 text-white shadow-sm font-bold ring-2 ring-amber-500/30'
                    : 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 font-semibold'
                }`}
              >
                <Key className="w-4 h-4 text-amber-600" />
                <span>Ubah Login Default</span>
              </button>
            </>
          )}
        </div>

        {/* CBT MODULE VIEWS */}
        {activeTab.startsWith('cbt_') && (
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 rounded-2xl border border-indigo-800/60 text-white shadow-xl space-y-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-800/60 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600/30 text-indigo-300 rounded-xl border border-indigo-500/40 shadow-inner">
                  <BookOpen className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-white tracking-wide">
                      SISTEM CBT ONLINE (COMPUTER BASED TEST)
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Submenu Terintegrasi
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    Kelola bank soal, kategori, jadwal ujian, monitoring peserta live, dan analisis ranking nilai
                  </p>
                </div>
              </div>
            </div>

            {/* Submenu Pill Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold pt-1">
              {[
                { id: 'cbt_dashboard', label: 'Dashboard CBT', icon: LayoutDashboard },
                { id: 'cbt_kategori', label: 'Kategori Soal', icon: Palette },
                { id: 'cbt_bank_soal', label: 'Bank Soal', icon: FileText },
                { id: 'cbt_import', label: 'Import Soal', icon: Database },
                { id: 'cbt_jadwal', label: 'Jadwal Ujian', icon: Calendar },
                { id: 'cbt_monitoring', label: 'Live Monitoring', icon: Clock },
                { id: 'cbt_hasil', label: 'Hasil Ujian', icon: CheckCircle2 },
                { id: 'cbt_ranking', label: 'Ranking Nilai', icon: Award },
              ].map((sub) => {
                const SubIcon = sub.icon;
                const isCurrent = activeTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setActiveTab(sub.id)}
                    className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                      isCurrent
                        ? 'bg-amber-400 text-slate-950 font-black shadow-md scale-102'
                        : 'bg-slate-800/80 text-indigo-200 hover:bg-slate-800 hover:text-white border border-indigo-800/50'
                    }`}
                  >
                    <SubIcon className={`w-4 h-4 ${isCurrent ? 'text-slate-950' : 'text-indigo-400'}`} />
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'cbt_dashboard' && <CbtDashboardAdmin students={students} />}
        {activeTab === 'cbt_kategori' && <CbtKategoriManager />}
        {activeTab === 'cbt_bank_soal' && <CbtBankSoalManager />}
        {activeTab === 'cbt_import' && <CbtImportSoal />}
        {activeTab === 'cbt_jadwal' && <CbtJadwalUjianManager />}
        {activeTab === 'cbt_monitoring' && <CbtMonitoring students={students} />}
        {activeTab === 'cbt_hasil' && <CbtHasilDanRanking students={students} mode="hasil" />}
        {activeTab === 'cbt_ranking' && <CbtHasilDanRanking students={students} mode="ranking" />}

        {/* TAB 1: OVERVIEW METRICS */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <SupabaseSyncButton variant="card" onDataSynced={onRefreshAllData} />

            {/* Download Success Alert Toast */}
            {downloadSuccessMsg && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{downloadSuccessMsg}</span>
                </div>
                <button
                  onClick={() => setDownloadSuccessMsg('')}
                  className="text-emerald-700 hover:text-emerald-900 text-sm font-bold cursor-pointer ml-4"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500 font-semibold">Total Pendaftar</div>
                <div className="text-3xl font-extrabold text-slate-900 mt-1">{students.length}</div>
                <div className="text-[10px] text-emerald-600 font-bold mt-1">Siswa Terdaftar</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500 font-semibold">Formulir Lunas</div>
                <div className="text-3xl font-extrabold text-emerald-700 mt-1">
                  {students.filter(s => s.formPaymentStatus === 'verified').length}
                </div>
                <div className="text-[10px] text-slate-400 font-medium mt-1">Lunas Rp200.000</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500 font-semibold">Dinyatakan Lulus</div>
                <div className="text-3xl font-extrabold text-blue-700 mt-1">
                  {students.filter(s => s.status === 'passed' || s.status === 're_registered' || s.status === 'class_assigned').length}
                </div>
                <div className="text-[10px] text-blue-600 font-bold mt-1">Siap Daftar Ulang</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500 font-semibold">Daftar Ulang Lunas</div>
                <div className="text-3xl font-extrabold text-amber-600 mt-1">
                  {students.filter(s => s.initialPaymentStatus === 'verified').length}
                </div>
                <div className="text-[10px] text-amber-600 font-bold mt-1">Sudah Masuk Kelas</div>
              </div>

              <div 
                onClick={() => {
                  setStatusFilter('ready_download');
                  setActiveTab('applicants');
                }}
                className="bg-gradient-to-br from-emerald-50 to-teal-50 p-5 rounded-2xl border border-emerald-200 shadow-sm col-span-2 lg:col-span-1 cursor-pointer hover:border-emerald-400 transition-all group"
              >
                <div className="text-xs text-emerald-900 font-semibold flex items-center justify-between">
                  <span>Siap Unduh Formulir</span>
                  <Download className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-3xl font-extrabold text-emerald-700 mt-1">
                  {students.filter(s => canDownloadStudentForm(s)).length}
                </div>
                <div className="text-[10px] text-emerald-700 font-bold mt-1 flex items-center gap-1">
                  <span>Form Terisi + Bukti Diunggah</span>
                </div>
              </div>
            </div>

            {/* Recent Applicants Quick List */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900">Pendaftar Terbaru</h3>
                <button
                  onClick={() => setActiveTab('applicants')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Lihat Semua Siswa →
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b text-slate-600 font-bold">
                      <th className="p-3">No. Pendaftaran</th>
                      <th className="p-3">Nama Lengkap</th>
                      <th className="p-3">Sekolah Asal</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Tanggal</th>
                      <th className="p-3 text-center">Aksi & Formulir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {students.slice(0, 5).map(s => {
                      const isEligible = canDownloadStudentForm(s);
                      return (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-emerald-800">{s.registrationNumber}</td>
                          <td className="p-3 font-semibold">{s.fullName}</td>
                          <td className="p-3 text-slate-600">{s.previousSchoolName || '-'}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-bold uppercase">
                              {s.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500">{s.createdAt.split('T')[0]}</td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {isEligible ? (
                                <button
                                  onClick={() => handleDownloadStudentForm(s)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                                  title="Calon murid telah mengisi formulir & upload bukti transfer. Download PDF Formulir!"
                                >
                                  <Download className="w-3 h-3 text-emerald-100" />
                                  <span>Download</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">
                                  {!isStudentFormFilled(s) ? 'Form Belum Isi' : 'Bukti Belum Ada'}
                                </span>
                              )}
                              <button
                                onClick={() => setSelectedStudent(s)}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                                title="Lihat Detail"
                              >
                                Detail
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DATA PENDAFTAR (DATATABLE) */}
        {activeTab === 'applicants' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Data Pendaftar SPMB Online</h3>
                <p className="text-xs text-slate-500">Cari, filter, dan kelola seluruh calon murid SMP Al-Hadiid.</p>
              </div>

              {/* Search & Filter Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Cari nama, no pendaftaran, HP..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="p-2 border rounded-xl text-xs bg-white font-medium"
                >
                  <option value="all">Semua Status</option>
                  <option value="ready_download">📄 Siap Unduh Formulir (Form Terisi + Bukti Transfer)</option>
                  <option value="draft">Draft</option>
                  <option value="verifying_payment">Verifikasi Pembayaran</option>
                  <option value="filling_form">Pengisian Formulir</option>
                  <option value="form_submitted">Formulir Terkirim</option>
                  <option value="scheduled_test">Menunggu Tes</option>
                  <option value="passed">Lulus</option>
                  <option value="class_assigned">Penempatan Kelas</option>
                </select>

                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === 'ready_download' ? 'all' : 'ready_download')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    statusFilter === 'ready_download'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  }`}
                  title="Filter hanya calon murid yang sudah mengisi formulir dan mengunggah bukti transfer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Siap Unduh Formulir ({students.filter(s => canDownloadStudentForm(s)).length})</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b text-slate-700 font-bold">
                    <th className="p-3">No. Reg</th>
                    <th className="p-3">Nama Siswa</th>
                    <th className="p-3">JK</th>
                    <th className="p-3">Sekolah Asal</th>
                    <th className="p-3">No. HP Ortu</th>
                    <th className="p-3">Status Form & Bayar</th>
                    <th className="p-3">Nilai</th>
                    <th className="p-3">Kelas</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700">
                  {filteredStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-emerald-800">{s.registrationNumber}</td>
                      <td className="p-3 font-semibold">{s.fullName}</td>
                      <td className="p-3">{s.gender === 'Laki-laki' ? 'L' : 'P'}</td>
                      <td className="p-3 text-slate-600">{s.previousSchoolName || '-'}</td>
                      <td className="p-3 font-mono">{s.phone}</td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold w-fit ${
                              s.formPaymentStatus === 'verified'
                                ? 'bg-emerald-100 text-emerald-800'
                                : s.formPaymentProofUrl
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {s.formPaymentStatus === 'verified' ? '✓ Bayar Lunas' : s.formPaymentProofUrl ? '⏳ Bukti Terunggah' : 'Belum Bayar'}
                          </span>
                          <span className={`text-[10px] font-medium flex items-center gap-1 ${isStudentFormFilled(s) ? 'text-emerald-700 font-bold' : 'text-slate-400 italic'}`}>
                            {isStudentFormFilled(s) ? '✓ Form Terisi' : '⏳ Form Belum Terisi'}
                          </span>
                          {s.isFormVerified || s.status === 'form_verified' ? (
                            <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-0.5">
                              ✓ Data Terverifikasi
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-700 font-medium flex items-center gap-0.5">
                              ⏳ Data Belum Diverifikasi
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-bold font-mono text-slate-900">{s.finalScore || '-'}</td>
                      <td className="p-3 font-semibold text-blue-700">{s.assignedClassName || '-'}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {!(s.isFormVerified || s.status === 'form_verified') ? (
                            <button
                              type="button"
                              onClick={() => handleVerifyFormAndData(s.id, true)}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                              title="Verifikasi Pembayaran & Data Calon Murid (Buka Akses Download Formulir & Kartu Ujian Murid)"
                            >
                              <ShieldCheck className="w-3 h-3 text-emerald-100" />
                              <span>Verifikasi Data & Bayar</span>
                            </button>
                          ) : (
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Terverifikasi</span>
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDownloadStudentForm(s)}
                            className="px-2.5 py-1.5 bg-teal-700 hover:bg-teal-600 text-white rounded-lg text-[10px] font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer animate-in fade-in"
                            title="Download Formulir Pendaftaran Lengkap Calon Murid (PDF 3 Halaman)"
                          >
                            <Download className="w-3 h-3 text-teal-100" />
                            <span>Download Formulir</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadExamCard(s)}
                            className="px-2.5 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer animate-in fade-in"
                            title="Download Kartu Peserta Ujian Seleksi Calon Murid (PDF)"
                          >
                            <Award className="w-3 h-3 text-indigo-100" />
                            <span>Download Kartu Ujian</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedStudent(s)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                            title="Buka Modal Detail Calon Murid"
                          >
                            <Eye className="w-3 h-3 text-slate-300" />
                            <span>Detail</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setWaModalStudent(s);
                              setWaDefaultTemplate(
                                s.status === 'passed' ? 'passed' :
                                s.status === 'passed_reserved' ? 'passed_reserved' :
                                s.status === 'failed' ? 'failed' :
                                s.status === 'scheduled_test' ? 'test_schedule' :
                                s.status === 'class_assigned' ? 'class_placement' : 'custom'
                              );
                            }}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-sm"
                            title="Kirim Pesan Pengumuman WhatsApp ke Orang Tua Murid"
                          >
                            <MessageCircle className="w-3 h-3 text-emerald-100" />
                            <span>Kirim WA</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: INPUT & VERIFIKASI PEMBAYARAN FORMULIR */}
        {activeTab === 'payment_form' && (
          <AdminFormPaymentSection
            students={students}
            onUpdateStudents={onUpdateStudents}
            schoolInfo={schoolInfo}
          />
        )}

        {/* TAB 3B: BIAYA AWAL MASUK (BAM) & ANGSURAN */}
        {activeTab === 'payment_initial' && (
          <AdminBamPaymentSection
            students={students}
            onUpdateStudents={onUpdateStudents}
            schoolInfo={schoolInfo}
            onUpdateSchoolInfo={onUpdateSchoolInfo}
            costBreakdowns={costBreakdowns}
            onUpdateCostBreakdowns={onUpdateCostBreakdowns}
          />
        )}

        {/* TAB 3C: RIWAYAT PEMBAYARAN TERPISAH (LAKI-LAKI & PEREMPUAN) */}
        {activeTab === 'payment_history' && (
          <AdminPaymentHistorySection
            students={students}
            onUpdateStudents={onUpdateStudents}
          />
        )}


        {/* TAB 4: INPUT NILAI TES DIAGNOSTIK */}
        {activeTab === 'scores' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3">
              Input Nilai Tes Diagnostik, TPU & Diniyyah
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b font-bold text-slate-700">
                    <th className="p-3">No. Reg</th>
                    <th className="p-3">Nama Siswa</th>
                    <th className="p-3">Diagnostik (30%)</th>
                    <th className="p-3">TPU (40%)</th>
                    <th className="p-3">Diniyyah (30%)</th>
                    <th className="p-3">Nilai Akhir</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-emerald-800">{s.registrationNumber}</td>
                      <td className="p-3 font-semibold">{s.fullName}</td>
                      <td className="p-3">{s.diagnosticScore ?? '-'}</td>
                      <td className="p-3">{s.generalScore ?? '-'}</td>
                      <td className="p-3">{s.religiousScore ?? '-'}</td>
                      <td className="p-3 font-bold font-mono text-emerald-700">{s.finalScore ?? '-'}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => {
                            setEditingScoreStudent(s);
                            setDiagScore(s.diagnosticScore || 85);
                            setGeneralScore(s.generalScore || 85);
                            setRelScore(s.religiousScore || 85);
                          }}
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[10px]"
                        >
                          Input / Edit Nilai
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: PENGUMUMAN KELULUSAN & PESAN WHATSAPP ORANG TUA */}
        {activeTab === 'announcements' && (() => {
          const totalCount = students.length;
          const passedCount = students.filter(s => s.status === 'passed').length;
          const reservedCount = students.filter(s => s.status === 'passed_reserved').length;
          const failedCount = students.filter(s => s.status === 'failed').length;
          const sentWaCount = students.filter(s => !!waSentHistory[s.id]).length;
          const unsentWaCount = totalCount - sentWaCount;

          const filteredAnnouncementStudents = students.filter(s => {
            if (announcementSearch.trim()) {
              const q = announcementSearch.toLowerCase();
              const primary = getPrimaryParentContact(s);
              const matchName = s.fullName?.toLowerCase().includes(q);
              const matchReg = s.registrationNumber?.toLowerCase().includes(q);
              const matchParent = (s.fatherName?.toLowerCase().includes(q) || s.motherName?.toLowerCase().includes(q) || primary.name?.toLowerCase().includes(q));
              const matchPhone = (s.phone?.includes(q) || s.fatherPhone?.includes(q) || s.motherPhone?.includes(q) || primary.phone?.includes(q));
              if (!matchName && !matchReg && !matchParent && !matchPhone) {
                return false;
              }
            }

            if (announcementFilter === 'passed') return s.status === 'passed';
            if (announcementFilter === 'passed_reserved') return s.status === 'passed_reserved';
            if (announcementFilter === 'failed') return s.status === 'failed';
            if (announcementFilter === 'wa_sent') return !!waSentHistory[s.id];
            if (announcementFilter === 'wa_not_sent') return !waSentHistory[s.id];
            return true;
          });

          return (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              {/* Header Banner */}
              <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 p-6 rounded-2xl text-white shadow-md relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-400 text-slate-950">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Fitur Baru: Pengumuman WhatsApp Orang Tua / Wali</span>
                    </div>
                    <h3 className="text-2xl font-black tracking-tight text-white">
                      Pusat Pengumuman & Keputusan Hasil Seleksi
                    </h3>
                    <p className="text-xs text-emerald-100/90 leading-relaxed">
                      Sampaikan surat keputusan kelulusan, jadwal tes, pengingat daftar ulang, dan penempatan rombel langsung ke nomor WhatsApp masing-masing calon orang tua/wali murid dengan template resmi SMP Al-Hadiid Cileungsi.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="px-4 py-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/15 text-center">
                      <div className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider">Terkirim WA</div>
                      <div className="text-xl font-black text-white">{sentWaCount} <span className="text-xs font-normal text-emerald-200">/ {totalCount}</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistics Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Total Murid</div>
                  <div className="text-lg font-black text-slate-900 mt-0.5">{totalCount}</div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="text-[10px] font-bold text-emerald-700 uppercase">Lulus Seleksi</div>
                  <div className="text-lg font-black text-emerald-800 mt-0.5">{passedCount}</div>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="text-[10px] font-bold text-amber-700 uppercase">Cadangan (Waiting)</div>
                  <div className="text-lg font-black text-amber-800 mt-0.5">{reservedCount}</div>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <div className="text-[10px] font-bold text-rose-700 uppercase">Tidak Lulus</div>
                  <div className="text-lg font-black text-rose-800 mt-0.5">{failedCount}</div>
                </div>
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl">
                  <div className="text-[10px] font-bold text-teal-700 uppercase">✓ WA Terkirim</div>
                  <div className="text-lg font-black text-teal-800 mt-0.5">{sentWaCount}</div>
                </div>
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <div className="text-[10px] font-bold text-indigo-700 uppercase">⏳ Belum Kirim WA</div>
                  <div className="text-lg font-black text-indigo-800 mt-0.5">{unsentWaCount}</div>
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Cari siswa, no reg, nama wali, atau nomor WhatsApp..."
                    value={announcementSearch}
                    onChange={(e) => setAnnouncementSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  {announcementSearch && (
                    <button
                      type="button"
                      onClick={() => setAnnouncementSearch('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'all', label: `Semua (${totalCount})` },
                    { id: 'passed', label: `Lulus (${passedCount})` },
                    { id: 'passed_reserved', label: `Cadangan (${reservedCount})` },
                    { id: 'failed', label: `Tidak Lulus (${failedCount})` },
                    { id: 'wa_sent', label: `✓ Sudah WA (${sentWaCount})` },
                    { id: 'wa_not_sent', label: `⏳ Belum WA (${unsentWaCount})` },
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setAnnouncementFilter(f.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        announcementFilter === f.id
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Announcements Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b font-bold text-slate-700">
                      <th className="p-3">No. Reg</th>
                      <th className="p-3">Nama Siswa</th>
                      <th className="p-3">Kontak Orang Tua (WhatsApp)</th>
                      <th className="p-3 text-center">Nilai CBT</th>
                      <th className="p-3">Status Seleksi</th>
                      <th className="p-3 text-center">Tentukan Keputusan</th>
                      <th className="p-3 text-center">Pesan Pengumuman WA</th>
                      <th className="p-3 text-center">Dokumen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-700">
                    {filteredAnnouncementStudents.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">
                          Tidak ada calon murid yang sesuai dengan filter pencarian.
                        </td>
                      </tr>
                    ) : (
                      filteredAnnouncementStudents.map(s => {
                        const primaryContact = getPrimaryParentContact(s);
                        const sentRecord = waSentHistory[s.id];
                        const cleanPhone = cleanWhatsAppNumber(primaryContact.phone);

                        return (
                          <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                            {/* Reg Number */}
                            <td className="p-3 font-mono font-bold text-emerald-800 whitespace-nowrap">
                              {s.registrationNumber}
                            </td>

                            {/* Student Name */}
                            <td className="p-3">
                              <div className="font-bold text-slate-900">{s.fullName}</div>
                              <div className="text-[10px] text-slate-400">{s.previousSchoolName || 'SMP Al-Hadiid'}</div>
                            </td>

                            {/* Parent Contact */}
                            <td className="p-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 font-medium text-slate-800">
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                                    {primaryContact.role}
                                  </span>
                                  <span className="truncate max-w-[120px]" title={primaryContact.name}>
                                    {primaryContact.name}
                                  </span>
                                </div>
                                {primaryContact.isValid ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    <Phone className="w-2.5 h-2.5" /> +{cleanPhone}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    <AlertCircle className="w-2.5 h-2.5" /> {primaryContact.phone || 'Belum diisi'}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Exam Score */}
                            <td className="p-3 text-center">
                              <span className="font-bold font-mono text-slate-900 bg-slate-100 px-2 py-1 rounded">
                                {s.finalScore ?? '-'}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="p-3 whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                                s.status === 'passed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                s.status === 'failed' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                                s.status === 'passed_reserved' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                s.status === 'class_assigned' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                                'bg-slate-100 text-slate-700 border border-slate-300'
                              }`}>
                                {s.status.replace(/_/g, ' ')}
                              </span>
                            </td>

                            {/* Decision Buttons */}
                            <td className="p-3 text-center">
                              <div className="flex justify-center gap-1 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleSetDecision(s.id, 'passed')}
                                  className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                                    s.status === 'passed'
                                      ? 'bg-emerald-700 text-white ring-2 ring-emerald-400'
                                      : 'bg-emerald-100 hover:bg-emerald-600 text-emerald-800 hover:text-white'
                                  }`}
                                  title="Tetapkan status LULUS"
                                >
                                  LULUS
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetDecision(s.id, 'passed_reserved')}
                                  className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                                    s.status === 'passed_reserved'
                                      ? 'bg-amber-600 text-white ring-2 ring-amber-400'
                                      : 'bg-amber-100 hover:bg-amber-500 text-amber-900 hover:text-white'
                                  }`}
                                  title="Tetapkan status CADANGAN (Waiting List)"
                                >
                                  CADANGAN
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetDecision(s.id, 'failed')}
                                  className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                                    s.status === 'failed'
                                      ? 'bg-rose-700 text-white ring-2 ring-rose-400'
                                      : 'bg-rose-100 hover:bg-rose-600 text-rose-800 hover:text-white'
                                  }`}
                                  title="Tetapkan status TIDAK LULUS"
                                >
                                  TDK LULUS
                                </button>
                              </div>
                            </td>

                            {/* WhatsApp Announcement Button & Status */}
                            <td className="p-3 text-center whitespace-nowrap">
                              <div className="flex flex-col items-center gap-1.5">
                                {sentRecord ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      <span>Terkirim ({sentRecord.parentRole})</span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setWaModalStudent(s);
                                        setWaDefaultTemplate(
                                          s.status === 'passed' ? 'passed' :
                                          s.status === 'passed_reserved' ? 'passed_reserved' :
                                          s.status === 'failed' ? 'failed' :
                                          s.status === 'class_assigned' ? 'class_placement' : 'custom'
                                        );
                                      }}
                                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-emerald-700 border border-emerald-300 rounded-lg text-[10px] font-bold shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                                      title="Kirim ulang pengumuman via WhatsApp"
                                    >
                                      <MessageCircle className="w-3 h-3" />
                                      <span>Kirim Ulang WA</span>
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setWaModalStudent(s);
                                      setWaDefaultTemplate(
                                        s.status === 'passed' ? 'passed' :
                                        s.status === 'passed_reserved' ? 'passed_reserved' :
                                        s.status === 'failed' ? 'failed' :
                                        s.status === 'class_assigned' ? 'class_placement' :
                                        s.status === 'scheduled_test' ? 'test_schedule' : 'custom'
                                      );
                                    }}
                                    className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-[10px] font-extrabold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                                    title={`Kirim pesan pengumuman WhatsApp ke orang tua ${s.fullName}`}
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    <span>Kirim Pengumuman WA</span>
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Documents & Remedial */}
                            <td className="p-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleDownloadExamResult(s)}
                                  className="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[10px] font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                                  title="Download Surat Keputusan Hasil Seleksi SPMB (PDF)"
                                >
                                  <Download className="w-3 h-3 text-amber-300" />
                                  <span>Hasil (PDF)</span>
                                </button>
                                {s.status === 'failed' && (
                                  <button
                                    type="button"
                                    onClick={() => handleAllowRetest(s.id)}
                                    className="px-2 py-1 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white rounded text-[10px] font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                                    title="Buka Akses Ujian Diulang (Remedial) untuk Calon Murid"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    <span>{s.retestCount ? `Ujian Ulang (${s.retestCount}x)` : 'Remedial'}</span>
                                  </button>
                                )}
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
          );
        })()}

        {/* TAB 7: MANAJEMEN KUOTA KELAS */}
        {activeTab === 'quotas' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 mb-1.5">
                  <Database className="w-3.5 h-3.5" />
                  <span>Tabel Database: public.class_quotas</span>
                </div>
                <h3 className="text-xl font-extrabold text-slate-900">Manajemen Kuota Kelas (Rombel Kelas 7)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pengaturan kapasitas rombongan belajar terintegrasi langsung dengan database relasional Supabase.
                </p>
              </div>

              <div className="flex items-center flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={handleRecalculateAndSyncQuotas}
                  disabled={isSyncingQuota}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
                  title="Hitung ulang keterisian kuota dari data siswa aktif di database"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingQuota ? 'animate-spin' : ''}`} />
                  <span>{isSyncingQuota ? 'Menyinkronkan...' : 'Hitung Ulang & Sinkronkan'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowQuotaSqlModal(true)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
                >
                  <FileCode className="w-3.5 h-3.5 text-blue-400" />
                  <span>Skrip SQL Migrasi (011)</span>
                </button>
              </div>
            </div>

            {/* Supabase Table Integration Banner */}
            {quotaTableStatus?.rowCount && quotaTableStatus.rowCount > 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs text-emerald-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Terintegrasi Penuh:</strong> {quotaTableStatus.rowCount} rombel aktif tersinkronisasi langsung dengan tabel <code className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-900 font-bold">public.class_quotas</code> di database Supabase.
                  </span>
                </div>
                <span className="font-mono text-[11px] bg-emerald-200/60 px-2 py-0.5 rounded font-bold text-emerald-900 shrink-0">
                  SSOT Relasional Aktif
                </span>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span>Integrasi Tabel Relasional (public.class_quotas) Siap Diaktifkan</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed max-w-2xl">
                    Data kuota kelas saat ini berjalan dan terlindungi via fallback database server (<code className="font-mono text-amber-900 font-bold">spmb_app_state</code>). Untuk memindahkan kuota kelas secara permanen ke tabel relasional <code className="font-mono font-bold text-amber-900">public.class_quotas</code> dan membuka izin RLS, silakan jalankan skrip SQL migrasi (011) di Supabase Dashboard.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuotaSqlModal(true)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Buka &amp; Salin SQL Migrasi</span>
                </button>
              </div>
            )}

            {/* Quota Summary Statistics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Rombel</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {classQuotas.length} <span className="text-xs font-semibold text-slate-500">Kelas</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">{schoolInfo.academicYear}</div>
              </div>

              <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-4">
                <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Total Kapasitas</div>
                <div className="text-2xl font-black text-blue-900 mt-1">
                  {classQuotas.reduce((acc, q) => acc + q.capacity, 0)} <span className="text-xs font-semibold text-blue-600">Murid</span>
                </div>
                <div className="text-[11px] text-blue-500 mt-0.5">Daya tampung seluruh rombel</div>
              </div>

              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4">
                <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Kuota Terisi</div>
                <div className="text-2xl font-black text-emerald-900 mt-1">
                  {classQuotas.reduce((acc, q) => acc + q.filled, 0)} <span className="text-xs font-semibold text-emerald-600">Murid</span>
                </div>
                <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                  {classQuotas.reduce((acc, q) => acc + q.capacity, 0) > 0
                    ? `${Math.round((classQuotas.reduce((acc, q) => acc + q.filled, 0) / classQuotas.reduce((acc, q) => acc + q.capacity, 0)) * 100)}% Terisi`
                    : '0% Terisi'}
                </div>
              </div>

              <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4">
                <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Sisa Kuota Tersedia</div>
                <div className="text-2xl font-black text-amber-900 mt-1">
                  {Math.max(0, classQuotas.reduce((acc, q) => acc + q.capacity, 0) - classQuotas.reduce((acc, q) => acc + q.filled, 0))} <span className="text-xs font-semibold text-amber-600">Bangku</span>
                </div>
                <div className="text-[11px] text-amber-600 font-semibold mt-0.5">Siap menerima pendaftar</div>
              </div>
            </div>

            {/* Quota List Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                  <School className="w-4 h-4 text-emerald-600" />
                  <span>Daftar Rombel & Kuota Tersedia</span>
                </h4>
                <span className="text-xs text-slate-500 font-medium">
                  {classQuotas.length} rombongan belajar terdaftar
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {classQuotas.map(q => {
                  const percent = q.capacity > 0 ? Math.min(100, Math.round((q.filled / q.capacity) * 100)) : 0;
                  const isFull = q.filled >= q.capacity;
                  return (
                    <div key={q.id} className="bg-slate-50 hover:bg-slate-100/80 p-5 rounded-2xl border border-slate-200 transition-all flex flex-col justify-between shadow-xs">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md uppercase tracking-wider">
                            {q.academicYear || schoolInfo.academicYear}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditQuota(q)}
                              className="p-1.5 hover:bg-white text-slate-500 hover:text-blue-600 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                              title="Edit Kuota Kelas"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteClassQuota(q.id, q.className)}
                              className="p-1.5 hover:bg-white text-slate-500 hover:text-rose-600 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                              title="Hapus Kelas"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <div className="text-base font-extrabold text-slate-900 leading-snug">{q.className}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{q.homeroomTeacher || 'Belum Ditentukan'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-200/80 space-y-2">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-600">Terisi:</span>
                          <span className={isFull ? 'text-rose-600 font-extrabold' : 'text-slate-900'}>
                            {q.filled} / {q.capacity} <span className="font-normal text-slate-500">murid</span>
                          </span>
                        </div>

                        <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isFull ? 'bg-rose-500' : percent > 75 ? 'bg-amber-500' : 'bg-emerald-600'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                          <span>{percent}% Penuh</span>
                          <span className={q.capacity - q.filled <= 5 ? 'text-amber-600 font-bold' : 'text-slate-500'}>
                            Sisa: {Math.max(0, q.capacity - q.filled)} bangku
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Add New Class Form */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                <h4 className="font-extrabold text-sm text-slate-900">Tambah Rombongan Belajar (Kelas Baru)</h4>
              </div>
              <form onSubmit={handleAddClassQuota} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Nama Rombel / Kelas *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 7 E (Tahfizh Intensif)"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="w-full p-2.5 bg-white rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Kapasitas Maksimal (Siswa) *</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    placeholder="Contoh: 32"
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(Number(e.target.value))}
                    className="w-full p-2.5 bg-white rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Nama Wali Kelas (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: Ustadz Fulan, S.Pd."
                    value={newHomeroom}
                    onChange={(e) => setNewHomeroom(e.target.value)}
                    className="w-full p-2.5 bg-white rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Simpan Kelas</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Modal Edit Class Quota */}
            {editingQuota && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <Edit className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-base font-extrabold text-slate-900">Edit Data Rombel</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingQuota(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveEditQuota} className="space-y-4 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Nama Rombel / Kelas *</label>
                      <input
                        type="text"
                        required
                        value={editClassName}
                        onChange={(e) => setEditClassName(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Kapasitas (Murid) *</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          required
                          value={editCapacity}
                          onChange={(e) => setEditCapacity(Number(e.target.value))}
                          className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Tahun Ajaran</label>
                        <input
                          type="text"
                          value={editAcademicYear}
                          onChange={(e) => setEditAcademicYear(e.target.value)}
                          className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Wali Kelas</label>
                      <input
                        type="text"
                        placeholder="Nama Ustadz / Guru Pembimbing"
                        value={editHomeroom}
                        onChange={(e) => setEditHomeroom(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setEditingQuota(null)}
                        className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-bold transition-all cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                      >
                        Simpan Perubahan
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal SQL Migration Helper */}
            {showQuotaSqlModal && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-slate-950 text-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-5 h-5 text-emerald-400" />
                      <div>
                        <h4 className="text-base font-extrabold text-white">Skrip SQL Migrasi Kuota Kelas</h4>
                        <p className="text-[11px] text-slate-400">File: supabase/migrations/011_class_quotas_schema_and_policies.sql</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowQuotaSqlModal(false)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Salin dan jalankan skrip SQL berikut di <strong>SQL Editor Dashboard Supabase</strong> Anda untuk memastikan tabel <code className="text-emerald-400 font-mono">public.class_quotas</code> memiliki izin akses RLS Policy dan terisi data kelas resmi:
                  </p>

                  <div className="relative">
                    <pre className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-[11px] font-mono text-emerald-300 max-h-60 overflow-y-auto leading-relaxed">
{`-- =====================================================================
-- 011_class_quotas_schema_and_policies.sql
-- Integrasi Tabel Relasional Kuota Kelas (Single Source of Truth)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.class_quotas (
    id VARCHAR(100) PRIMARY KEY,
    academic_year VARCHAR(50) DEFAULT '2027/2028' NOT NULL,
    level VARCHAR(50) DEFAULT 'Kelas 7' NOT NULL,
    class_name VARCHAR(100) NOT NULL,
    capacity INTEGER DEFAULT 32 NOT NULL,
    filled INTEGER DEFAULT 0 NOT NULL,
    homeroom_teacher VARCHAR(255) DEFAULT 'Pengajar Al-Hadiid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.class_quotas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.class_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for class_quotas" ON public.class_quotas;
DROP POLICY IF EXISTS "Allow all for class_quotas" ON public.class_quotas;

CREATE POLICY "Allow all for class_quotas" ON public.class_quotas 
FOR ALL USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.class_quotas TO anon, authenticated, service_role;

-- Masukkan rombel kelas 7 resmi SMP Al-Hadiid jika belum ada
INSERT INTO public.class_quotas (id, academic_year, level, class_name, capacity, filled, homeroom_teacher, created_at)
VALUES 
    ('cls-7a', '2027/2028', 'Kelas 7', '7 A', 32, 0, '-', NOW()),
    ('cls-7b', '2027/2028', 'Kelas 7', '7 B', 32, 0, '-', NOW()),
    ('cls-7c', '2027/2028', 'Kelas 7', '7 C', 32, 0, '-', NOW()),
    ('cls-7d', '2027/2028', 'Kelas 7', '7 D', 32, 0, '-', NOW())
ON CONFLICT (id) DO UPDATE SET
    class_name = EXCLUDED.class_name,
    capacity = EXCLUDED.capacity,
    homeroom_teacher = EXCLUDED.homeroom_teacher;

NOTIFY pgrst, 'reload schema';`}
                    </pre>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-slate-400">
                      * Selesai dijalankan di SQL Editor Supabase, skema &amp; RLS akan langsung aktif seketika.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const sql = `-- =====================================================================
-- 011_class_quotas_schema_and_policies.sql
-- Integrasi Tabel Relasional Kuota Kelas (Single Source of Truth)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.class_quotas (
    id VARCHAR(100) PRIMARY KEY,
    academic_year VARCHAR(50) DEFAULT '2027/2028' NOT NULL,
    level VARCHAR(50) DEFAULT 'Kelas 7' NOT NULL,
    class_name VARCHAR(100) NOT NULL,
    capacity INTEGER DEFAULT 32 NOT NULL,
    filled INTEGER DEFAULT 0 NOT NULL,
    homeroom_teacher VARCHAR(255) DEFAULT 'Pengajar Al-Hadiid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.class_quotas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.class_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for class_quotas" ON public.class_quotas;
DROP POLICY IF EXISTS "Allow all for class_quotas" ON public.class_quotas;

CREATE POLICY "Allow all for class_quotas" ON public.class_quotas 
FOR ALL USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.class_quotas TO anon, authenticated, service_role;

-- Masukkan rombel kelas 7 resmi SMP Al-Hadiid jika belum ada
INSERT INTO public.class_quotas (id, academic_year, level, class_name, capacity, filled, homeroom_teacher, created_at)
VALUES 
    ('cls-7a', '2027/2028', 'Kelas 7', '7 A', 32, 0, '-', NOW()),
    ('cls-7b', '2027/2028', 'Kelas 7', '7 B', 32, 0, '-', NOW()),
    ('cls-7c', '2027/2028', 'Kelas 7', '7 C', 32, 0, '-', NOW()),
    ('cls-7d', '2027/2028', 'Kelas 7', '7 D', 32, 0, '-', NOW())
ON CONFLICT (id) DO UPDATE SET
    class_name = EXCLUDED.class_name,
    capacity = EXCLUDED.capacity,
    homeroom_teacher = EXCLUDED.homeroom_teacher;

NOTIFY pgrst, 'reload schema';`;
                        navigator.clipboard.writeText(sql);
                        setCopiedSql(true);
                        setTimeout(() => setCopiedSql(false), 2000);
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{copiedSql ? 'Tersalin ke Clipboard!' : 'Salin Skrip SQL'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 8: PENEMPATAN KELAS */}
        {activeTab === 'placement' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3">
              Penempatan Kelas Murid Baru (Plotting Rombel)
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b font-bold text-slate-700">
                    <th className="p-3">No. Reg</th>
                    <th className="p-3">Nama Siswa</th>
                    <th className="p-3">Daftar Ulang</th>
                    <th className="p-3">Kelas Terpasang</th>
                    <th className="p-3">Pilih Kelas</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-emerald-800">{s.registrationNumber}</td>
                      <td className="p-3 font-semibold">{s.fullName}</td>
                      <td className="p-3 font-bold uppercase">{s.initialPaymentStatus}</td>
                      <td className="p-3 font-bold text-blue-700">{s.assignedClassName || 'Belum'}</td>
                      <td className="p-3">
                        <select
                          value={s.assignedClassId || ''}
                          onChange={(e) => handleAssignClass(s.id, e.target.value)}
                          className="p-1.5 border rounded text-xs bg-white"
                        >
                          <option value="">-- Pilih Kelas --</option>
                          {classQuotas.map(q => (
                            <option key={q.id} value={q.id}>
                              {q.className} (Sisa: {q.capacity - q.filled})
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 8B: DATA KELAS TERISI */}
        {activeTab === 'filled_classes' && (
          <FilledClassesSection
            students={students}
            classQuotas={classQuotas}
            onUpdateStudents={onUpdateStudents}
            isAdminMode={true}
          />
        )}

        {/* TAB: BANK SOAL & JADWAL TES */}
        {activeTab === 'question_bank' && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-purple-950 text-white p-6 rounded-2xl border border-indigo-800/50 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/20 text-amber-300 rounded-full text-xs font-semibold mb-2 border border-amber-400/30">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Modul Ujian & Diagnostik SPMB</span>
                </div>
                <h2 className="text-xl font-black text-white">Bank Soal Tes & Pengaturan Jadwal Ujian</h2>
                <p className="text-xs text-indigo-200 mt-1">
                  Kelola soal tes diagnostik, pengetahuan umum & diniyyah, import soal massal, serta atur jadwal dan aktivasi ujian online untuk calon murid.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={fetchQuestionsFromSupabase}
                  disabled={isQuestionsLoading}
                  className="px-3.5 py-2.5 bg-slate-800/90 hover:bg-slate-700 border border-slate-600 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  title="Sinkronkan data soal langsung dari database Supabase"
                >
                  <RefreshCw className={`w-4 h-4 text-emerald-400 ${isQuestionsLoading ? 'animate-spin' : ''}`} />
                  <span>{isQuestionsLoading ? 'Sinkronisasi...' : 'Refresh dari Supabase'}</span>
                </button>

                <button
                  onClick={handleOpenNewQuestionModal}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>+ Tambah Soal Manual</span>
                </button>

                <button
                  onClick={() => {
                    setImportSuccessMsg('');
                    setShowImportModal(true);
                  }}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <FileJson className="w-4 h-4" />
                  <span>Import Soal Massal</span>
                </button>

                <button
                  onClick={() => {
                    setEditingSchedId(null);
                    setSchedWave(`Gelombang ${schedulesList.length + 1}`);
                    setSchedDate('');
                    setShowScheduleModal(true);
                  }}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                  <span>+ Tambah Jadwal Tes</span>
                </button>
              </div>
            </div>

            {/* Supabase Dynamic Data Status Ribbon */}
            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-950 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <div>
                  <span className="font-extrabold text-emerald-900">Database Supabase Terhubung (Data Dinamis Multi-Perangkat)</span>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Semua penambahan, perubahan, dan impor soal tersinkronisasi dinamis ke database Supabase. Perangkat calon murid (HP, laptop, tablet) mengakses bank soal yang sama secara realtime.
                  </p>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-200">
                  {lastQuestionsSync ? `Sinkron: ${lastQuestionsSync.toLocaleTimeString('id-ID')}` : 'Sinkronisasi Otomatis'}
                </span>
              </div>
            </div>

            {importSuccessMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 text-xs font-bold flex items-center gap-2 shadow-sm animate-fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{importSuccessMsg}</span>
              </div>
            )}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500 font-semibold">Total Soal di Bank</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{questionBank.length} <span className="text-xs font-normal text-slate-500">soal</span></div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs text-blue-600 font-semibold">Tes Diagnostik (30%)</div>
                <div className="text-2xl font-black text-blue-700 mt-1">
                  {questionBank.filter(q => q.category === 'diagnostik').length} <span className="text-xs font-normal text-slate-500">soal</span>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs text-emerald-600 font-semibold">Pengetahuan Umum (40%)</div>
                <div className="text-2xl font-black text-emerald-700 mt-1">
                  {questionBank.filter(q => q.category === 'pengetahuan_umum').length} <span className="text-xs font-normal text-slate-500">soal</span>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs text-purple-600 font-semibold">Diniyyah / Agama (30%)</div>
                <div className="text-2xl font-black text-purple-700 mt-1">
                  {questionBank.filter(q => q.category === 'diniyyah').length} <span className="text-xs font-normal text-slate-500">soal</span>
                </div>
              </div>
            </div>

            {/* SECTION 1: JADWAL TES & AKSES UJIAN ONLINE */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                    <span>Jadwal Ujian SPMB & Akses Online</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Atur gelombang, tanggal, waktu, durasi, dan aktivasi massal fitur ujian online untuk calon murid.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleMassToggleOnlineExam(true)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>🔓 Aktifkan Ujian Semua Murid</span>
                  </button>
                  <button
                    onClick={() => handleMassToggleOnlineExam(false)}
                    className="px-3 py-1.5 bg-rose-100 text-rose-700 hover:bg-rose-200 font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>🔒 Tutup Akses Ujian</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {schedulesList.map(s => (
                  <div key={s.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 relative">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-extrabold text-[11px]">
                          {s.waveName}
                        </span>
                        <h4 className="font-extrabold text-slate-900 text-sm mt-1">
                          📅 {s.testDate} ({s.testTime})
                        </h4>
                      </div>

                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        s.isOnlineActive !== false ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {s.isOnlineActive !== false ? '● Ujian Online Aktif' : '○ Non-Aktif'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 bg-white p-3 rounded-lg border border-slate-200">
                      <div><b>Durasi Ujian:</b> {s.durationMinutes || 90} Menit</div>
                      <div><b>Lokasi:</b> {s.location}</div>
                      <div><b>Instruksi:</b> {s.notes}</div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => handleToggleScheduleOnline(s.id, !s.isOnlineActive)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                          s.isOnlineActive !== false
                            ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                            : 'bg-emerald-600 text-white hover:bg-emerald-500'
                        }`}
                      >
                        {s.isOnlineActive !== false ? 'Non-aktifkan Jadwal' : 'Aktifkan Ujian'}
                      </button>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditSchedule(s)}
                          className="p-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 cursor-pointer"
                          title="Edit Jadwal"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSchedule(s.id)}
                          className="p-1.5 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 cursor-pointer"
                          title="Hapus Jadwal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 2: DAFTAR SOAL DALAM BANK SOAL */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-bold text-slate-900">Daftar Soal di Bank Soal</h3>
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  <button
                    onClick={() => setQuestionCategoryFilter('all')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      questionCategoryFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Semua ({questionBank.length})
                  </button>
                  <button
                    onClick={() => setQuestionCategoryFilter('diagnostik')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      questionCategoryFilter === 'diagnostik' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Diagnostik ({questionBank.filter(q => q.category === 'diagnostik').length})
                  </button>
                  <button
                    onClick={() => setQuestionCategoryFilter('pengetahuan_umum')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      questionCategoryFilter === 'pengetahuan_umum' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    TPU ({questionBank.filter(q => q.category === 'pengetahuan_umum').length})
                  </button>
                  <button
                    onClick={() => setQuestionCategoryFilter('diniyyah')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      questionCategoryFilter === 'diniyyah' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Diniyyah ({questionBank.filter(q => q.category === 'diniyyah').length})
                  </button>
                </div>
              </div>

              {/* List of Questions */}
              <div className="space-y-4">
                {questionBank
                  .filter(q => questionCategoryFilter === 'all' || q.category === questionCategoryFilter)
                  .map((q, idx) => (
                    <div key={q.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 hover:border-slate-300 transition-all">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                            q.category === 'diagnostik' ? 'bg-blue-100 text-blue-800' :
                            q.category === 'pengetahuan_umum' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {q.category === 'diagnostik' ? 'Tes Diagnostik' : q.category === 'pengetahuan_umum' ? 'Pengetahuan Umum' : 'Diniyyah'}
                          </span>
                          <span className="text-xs text-slate-500 font-semibold">({q.points} Poin)</span>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditQuestion(q)}
                            className="p-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 cursor-pointer text-xs font-bold flex items-center gap-1"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-1.5 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 cursor-pointer text-xs font-bold flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="font-bold text-slate-900 text-sm pl-8">
                        {q.questionText}
                      </div>

                      {/* Options Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8 pt-1">
                        {q.options.map((opt, optIdx) => {
                          const isCorrect = optIdx === q.correctOptionIndex;
                          const labels = ['A', 'B', 'C', 'D'];
                          return (
                            <div
                              key={optIdx}
                              className={`p-2.5 rounded-lg text-xs flex items-center gap-2 border ${
                                isCorrect
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                                  : 'bg-white border-slate-200 text-slate-700'
                              }`}
                            >
                              <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                                isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                              }`}>
                                {labels[optIdx]}
                              </span>
                              <span className="flex-1">{opt}</span>
                              {isCorrect && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                {questionBank.length === 0 && (
                  <div className="p-8 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center space-y-3">
                    <HelpCircle className="w-10 h-10 text-slate-400 mx-auto" />
                    <div className="font-bold text-slate-700">Bank Soal Masih Kosong</div>
                    <p className="text-xs text-slate-500">
                      Klik "+ Tambah Soal Manual" atau "Import Soal Massal" untuk mulai mengisi soal tes.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* MODAL: TAMBAH / EDIT SOAL MANUAL */}
            {showQuestionModal && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                    <h3 className="text-lg font-bold text-slate-900">
                      {editingQuestionId ? 'Edit Soal Ujian' : 'Tambah Soal Baru ke Bank Soal'}
                    </h3>
                    <button
                      onClick={() => setShowQuestionModal(false)}
                      className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveQuestion} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold mb-1">Kategori Soal *</label>
                        <select
                          value={qCategory}
                          onChange={e => setQCategory(e.target.value as any)}
                          className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-white font-semibold"
                        >
                          <option value="diagnostik">Tes Diagnostik (30%)</option>
                          <option value="pengetahuan_umum">Pengetahuan Umum / TPU (40%)</option>
                          <option value="diniyyah">Diniyyah & Agama (30%)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold mb-1">Bobot / Poin Soal *</label>
                        <input
                          type="number"
                          required
                          value={qPoints}
                          onChange={e => setQPoints(Number(e.target.value))}
                          className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold mb-1">Pertanyaan / Pertanyaan Soal *</label>
                      <textarea
                        required
                        rows={3}
                        placeholder="Tuliskan pertanyaan soal di sini..."
                        value={qText}
                        onChange={e => setQText(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-2 border-t border-slate-200 pt-3">
                      <div className="font-bold text-slate-900 mb-1">Pilihan Opsi Jawaban (A, B, C, D) & Kunci Jawaban *</div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className={`p-2.5 rounded-xl border ${qCorrectIndex === 0 ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-300'}`}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-800">Opsi A</span>
                            <label className="inline-flex items-center gap-1 cursor-pointer text-[11px] text-emerald-800 font-bold">
                              <input
                                type="radio"
                                name="correctIndex"
                                checked={qCorrectIndex === 0}
                                onChange={() => setQCorrectIndex(0)}
                              />
                              <span>Kunci Jawaban</span>
                            </label>
                          </div>
                          <input
                            type="text"
                            required
                            placeholder="Jawaban Pilihan A"
                            value={qOptA}
                            onChange={e => setQOptA(e.target.value)}
                            className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>

                        <div className={`p-2.5 rounded-xl border ${qCorrectIndex === 1 ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-300'}`}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-800">Opsi B</span>
                            <label className="inline-flex items-center gap-1 cursor-pointer text-[11px] text-emerald-800 font-bold">
                              <input
                                type="radio"
                                name="correctIndex"
                                checked={qCorrectIndex === 1}
                                onChange={() => setQCorrectIndex(1)}
                              />
                              <span>Kunci Jawaban</span>
                            </label>
                          </div>
                          <input
                            type="text"
                            required
                            placeholder="Jawaban Pilihan B"
                            value={qOptB}
                            onChange={e => setQOptB(e.target.value)}
                            className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>

                        <div className={`p-2.5 rounded-xl border ${qCorrectIndex === 2 ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-300'}`}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-800">Opsi C</span>
                            <label className="inline-flex items-center gap-1 cursor-pointer text-[11px] text-emerald-800 font-bold">
                              <input
                                type="radio"
                                name="correctIndex"
                                checked={qCorrectIndex === 2}
                                onChange={() => setQCorrectIndex(2)}
                              />
                              <span>Kunci Jawaban</span>
                            </label>
                          </div>
                          <input
                            type="text"
                            required
                            placeholder="Jawaban Pilihan C"
                            value={qOptC}
                            onChange={e => setQOptC(e.target.value)}
                            className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>

                        <div className={`p-2.5 rounded-xl border ${qCorrectIndex === 3 ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-300'}`}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-800">Opsi D</span>
                            <label className="inline-flex items-center gap-1 cursor-pointer text-[11px] text-emerald-800 font-bold">
                              <input
                                type="radio"
                                name="correctIndex"
                                checked={qCorrectIndex === 3}
                                onChange={() => setQCorrectIndex(3)}
                              />
                              <span>Kunci Jawaban</span>
                            </label>
                          </div>
                          <input
                            type="text"
                            required
                            placeholder="Jawaban Pilihan D"
                            value={qOptD}
                            onChange={e => setQOptD(e.target.value)}
                            className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setShowQuestionModal(false)}
                        className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl shadow-md cursor-pointer"
                      >
                        Simpan Soal ke Bank Soal
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* MODAL: IMPORT SOAL MASSAL */}
            {showImportModal && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <FileJson className="w-5 h-5 text-amber-500" />
                      <span>Import Soal Massal (JSON / Teks Format)</span>
                    </h3>
                    <button
                      onClick={() => setShowImportModal(false)}
                      className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setImportMode('json')}
                        className={`flex-1 py-2 rounded-xl font-bold cursor-pointer transition-all ${
                          importMode === 'json' ? 'bg-amber-500 text-slate-900 shadow-sm' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        Format JSON Array
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportMode('text')}
                        className={`flex-1 py-2 rounded-xl font-bold cursor-pointer transition-all ${
                          importMode === 'text' ? 'bg-amber-500 text-slate-900 shadow-sm' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        Format Teks Baris
                      </button>
                    </div>

                    {importMode === 'json' ? (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div className="font-bold text-slate-800">Contoh Format JSON Array:</div>
                        <pre className="bg-slate-900 text-amber-300 p-2.5 rounded-lg text-[10px] font-mono overflow-x-auto">
{`[
  {
    "category": "diagnostik",
    "questionText": "Jika 5x + 3 = 18, berapa x?",
    "options": ["2", "3", "4", "5"],
    "correctOptionIndex": 1,
    "points": 10
  }
]`}
                        </pre>
                        <button
                          type="button"
                          onClick={() => {
                            const sample = JSON.stringify([
                              {
                                category: "diagnostik",
                                questionText: "Berapakah hasil dari 12 x 12?",
                                options: ["124", "134", "144", "154"],
                                correctOptionIndex: 2,
                                points: 10
                              },
                              {
                                category: "pengetahuan_umum",
                                questionText: "Ibu kota negara Indonesia adalah...",
                                options: ["Surabaya", "Nusantara (IKN)", "Bandung", "Medan"],
                                correctOptionIndex: 1,
                                points: 10
                              },
                              {
                                category: "diniyyah",
                                questionText: "Membaca Al-Qur'an secara tartil hukumnya...",
                                options: ["Mubah", "Sunnah", "Wajib / Fardhu", "Makruh"],
                                correctOptionIndex: 2,
                                points: 10
                              }
                            ], null, 2);
                            setImportInputText(sample);
                          }}
                          className="px-3 py-1 bg-indigo-100 text-indigo-800 font-bold rounded-lg hover:bg-indigo-200 cursor-pointer text-[11px]"
                        >
                          📋 Paste Contoh JSON Template
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div className="font-bold text-slate-800">Contoh Format Teks Baris (Pisahkan dengan baris kosong):</div>
                        <pre className="bg-slate-900 text-amber-300 p-2.5 rounded-lg text-[10px] font-mono overflow-x-auto">
{`Kategori: diagnostik
Soal: Berapakah 25 + 75?
A: 80
B: 90
C: 100
D: 110
Kunci: C
---
Kategori: diniyyah
Soal: Surah pertama dalam Al-Qur'an adalah...
A: Al-Baqarah
B: Al-Fatihah
C: Al-Ikhlas
D: An-Nas
Kunci: B`}
                        </pre>
                      </div>
                    )}

                    <div>
                      <label className="block font-bold mb-1 text-slate-800">Tempelkan Data Soal di Bawah Ini: *</label>
                      <textarea
                        rows={8}
                        placeholder={importMode === 'json' ? 'Paste [ { "category": "...", "questionText": "..." } ]' : 'Paste Teks Soal...'}
                        value={importInputText}
                        onChange={e => setImportInputText(e.target.value)}
                        className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 font-mono text-xs"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowImportModal(false)}
                        className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleImportQuestions}
                        className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-extrabold rounded-xl shadow-md cursor-pointer"
                      >
                        Proses Import Soal Massal
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL: TAMBAH / EDIT JADWAL TES */}
            {showScheduleModal && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                    <h3 className="text-lg font-bold text-slate-900">
                      {editingSchedId ? 'Edit Jadwal Ujian' : 'Tambah Jadwal Ujian SPMB'}
                    </h3>
                    <button
                      onClick={() => setShowScheduleModal(false)}
                      className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveSchedule} className="space-y-4 text-xs">
                    <div>
                      <label className="block font-bold mb-1">Nama Gelombang *</label>
                      <input
                        type="text"
                        required
                        placeholder="Gelombang 1 / Gelombang Susulan"
                        value={schedWave}
                        onChange={e => setSchedWave(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold mb-1">Tanggal Ujian *</label>
                        <input
                          type="date"
                          required
                          value={schedDate}
                          onChange={e => setSchedDate(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block font-bold mb-1">Jam Pelaksanaan *</label>
                        <input
                          type="text"
                          required
                          placeholder="08:00 - 11:30 WIB"
                          value={schedTime}
                          onChange={e => setSchedTime(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold mb-1">Durasi Ujian (Menit) *</label>
                        <input
                          type="number"
                          required
                          value={schedDuration}
                          onChange={e => setSchedDuration(Number(e.target.value))}
                          className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex items-center pt-5">
                        <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                          <input
                            type="checkbox"
                            checked={schedOnlineActive}
                            onChange={e => setSchedOnlineActive(e.target.checked)}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>Aktifkan Fitur Ujian Online</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold mb-1">Lokasi Ujian / Portal Link *</label>
                      <input
                        type="text"
                        required
                        value={schedLocation}
                        onChange={e => setSchedLocation(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold mb-1">Catatan / Instruksi Bagi Calon Murid</label>
                      <textarea
                        rows={2}
                        value={schedNotes}
                        onChange={e => setSchedNotes(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setShowScheduleModal(false)}
                        className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl shadow-md cursor-pointer"
                      >
                        Simpan Jadwal Ujian
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 9: GOOGLE APPS SCRIPT & SPREADSHEET SYNC SIMULATOR */}
        {activeTab === 'gas_sync' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-600" />
                <span>Simulasi Integrasi Google Apps Script & Spreadsheet Database</span>
              </h3>
              <p className="text-xs text-slate-500">
                Aplikasi ini terhubung secara native dengan Google Spreadsheet sebagai database utama dan Google Drive untuk penyimpanan dokumen.
              </p>
            </div>

            <div className="bg-slate-900 text-slate-200 p-5 rounded-2xl font-mono text-xs space-y-3">
              <div className="text-emerald-400 font-bold">CONFIG GOOGLE APPS SCRIPT:</div>
              <div>Spreadsheet ID : {gasConfig.spreadsheetId}</div>
              <div>Web App URL    : {gasConfig.webAppUrl}</div>
              <div>Last Synced    : {gasConfig.lastSyncedAt}</div>
            </div>

            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900">
              ✓ Status Webhook: Connected (REST API Endpoint OK).
            </div>
          </div>
        )}

        {/* TAB 10: PENGATURAN INFORMASI SEKOLAH, BROSUR, VIDEO, & REKENING */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSchoolInfo} className="space-y-6">
            {/* Header & Sticky Action Bar */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
                  <Settings className="w-6 h-6 text-indigo-600" />
                  <span>Pengaturan Informasi & Media Sekolah</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Kelola profil resmi sekolah, upload brosur pendaftaran (PDF/Gambar), video profil YouTube, alamat, kontak, rekening, dan sosial media.
                </p>
              </div>

              <button
                type="submit"
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 shrink-0"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Perubahan Data</span>
              </button>
            </div>

            {/* Notification Banner */}
            {saveSchoolSuccess && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 rounded-2xl text-xs font-semibold flex items-center gap-3 animate-fade-in shadow-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{saveSchoolSuccess}</span>
              </div>
            )}

            {/* SECTION 1: LOGO RESMI SEKOLAH & KOP SURAT CETAK FORMULIR */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-indigo-600" />
                    <span>1. Logo Resmi Sekolah (Untuk Kop Surat & Cetak Formulir PDF)</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Upload logo sekolah resmi. Logo ini akan digunakan pada Kop Surat Formulir Pendaftaran PDF, Kartu Peserta SPMB, serta tampilan header aplikasi.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upload Area */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700">
                    Upload File Logo Baru (Maks 5MB, Format PNG Transparan / JPG / SVG)
                  </label>

                  <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50/80 rounded-2xl p-6 text-center transition-all cursor-pointer relative">
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.svg"
                      onChange={handleLogoFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="text-xs font-bold text-slate-800">
                        {isUploadingLogo ? 'Mengunggah Logo...' : 'Klik atau Drag & Drop File Logo Sekolah'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Format disarankan: PNG Transparan atau JPG Persegi (Maks 5 MB)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Current Logo Preview Card */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Pratinjau Logo Aktif</span>
                      {schoolForm.logoUrl ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold flex items-center gap-1 border border-emerald-200">
                          <Check className="w-3 h-3" /> Logo Custom Terunggah
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold border border-amber-200">
                          Logo Default Sistem
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                      <div className="w-16 h-16 rounded-xl bg-slate-100 p-2 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                        <img
                          src={schoolForm.logoUrl || logoSvg}
                          alt="Logo Sekolah"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="overflow-hidden space-y-1">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {schoolForm.logoFileName || 'Logo_SMP_AlHadiid.png'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {schoolForm.logoFileSize ? `Ukuran: ${schoolForm.logoFileSize}` : 'Logo standar aktif'}
                        </div>
                        <div className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                          <span>✓ Otomatis tercetak pada Kop PDF Formulir Pendaftaran</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {schoolForm.logoUrl && (
                    <div className="flex items-center justify-end pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() =>
                          setSchoolForm((prev) => ({
                            ...prev,
                            logoUrl: '',
                            logoFileName: '',
                            logoFileSize: '',
                          }))
                        }
                        className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-rose-200"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Reset Ke Logo Default</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 2: BROSUR SPMB & MEDIA PROMOSI */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <span>2. Brosur Resmi SPMB (PDF / Gambar)</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Upload file brosur pendaftaran resmi yang dapat diunduh oleh calon murid di Halaman Depan.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upload File Area */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700">
                    Upload File Brosur Baru (Maks 15MB, Format PDF/PNG/JPG)
                  </label>

                  <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50/80 rounded-2xl p-6 text-center transition-all cursor-pointer relative">
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleBrochureFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="text-xs font-bold text-slate-800">
                        {isUploadingBrochure ? 'Mengunggah File...' : 'Klik atau Drag & Drop File Brosur'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Mendukung PDF, PNG, JPG hingga 15 Megabytes
                      </div>
                    </div>
                  </div>
                </div>

                {/* Current Brochure Preview Card */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Status Brosur Aktif</span>
                      {schoolForm.brochureUrl ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold flex items-center gap-1 border border-emerald-200">
                          <Check className="w-3 h-3" /> Tersedia & Siap Diunduh
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold border border-amber-200">
                          Menggunakan Brosur Default
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                      <div className="p-3 bg-indigo-100 text-indigo-700 rounded-lg shrink-0">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {schoolForm.brochureFileName || 'Brosur_SPMB_SMP_AlHadiid_2027.pdf'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Ukuran: {schoolForm.brochureFileSize || '2.4 MB'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
                    {schoolForm.brochureUrl && (
                      <a
                        href={schoolForm.brochureUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh / Lihat Brosur</span>
                      </a>
                    )}

                    {schoolForm.brochureUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setSchoolForm((prev) => ({
                            ...prev,
                            brochureUrl: '',
                            brochureFileName: '',
                            brochureFileSize: '',
                          }))
                        }
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border border-rose-200"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus File</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: VIDEO PROFIL SEKOLAH */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="border-b border-slate-200 pb-3">
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Video className="w-5 h-5 text-rose-600" />
                  <span>3. Video Profil Sekolah (YouTube / Link Video)</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Masukkan link video profil YouTube untuk ditampilkan di tombol "Video Profil" Halaman Depan.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      URL Video Profil (YouTube Embed / Link Tonton)
                    </label>
                    <div className="relative">
                      <Video className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="url"
                        placeholder="https://www.youtube.com/watch?v=... atau https://youtu.be/..."
                        value={schoolForm.videoProfileUrl || ''}
                        onChange={(e) =>
                          setSchoolForm((prev) => ({ ...prev, videoProfileUrl: e.target.value }))
                        }
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Sistem akan secara otomatis mengubah link YouTube standar menjadi player interaktif.
                    </p>
                  </div>
                </div>

                {/* Video Player Live Preview */}
                <div className="lg:col-span-6 bg-slate-950 p-3 rounded-2xl border border-slate-800 text-white space-y-2">
                  <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
                    <span>Pratinjau Video Profil:</span>
                    <span className="text-rose-400 font-mono">Live Player</span>
                  </div>

                  <div className="aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center border border-slate-800">
                    {schoolForm.videoProfileUrl ? (
                      <iframe
                        src={
                          schoolForm.videoProfileUrl.includes('youtube.com/embed/')
                            ? schoolForm.videoProfileUrl
                            : schoolForm.videoProfileUrl.includes('watch?v=')
                            ? `https://www.youtube.com/embed/${schoolForm.videoProfileUrl.split('v=')[1]?.split('&')[0]}`
                            : schoolForm.videoProfileUrl.includes('youtu.be/')
                            ? `https://www.youtube.com/embed/${schoolForm.videoProfileUrl.split('youtu.be/')[1]?.split('?')[0]}`
                            : schoolForm.videoProfileUrl
                        }
                        title="Video Profil Sekolah"
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <div className="text-center p-6 text-slate-500 space-y-2">
                        <Play className="w-10 h-10 mx-auto text-slate-700" />
                        <div className="text-xs">Belum ada video profil dimasukkan.</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: IDENTITAS & PROFIL SEKOLAH */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="border-b border-slate-200 pb-3">
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building className="w-5 h-5 text-emerald-600" />
                  <span>3. Identitas Resmi & Sambutan Kepala Sekolah</span>
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Sekolah</label>
                  <input
                    type="text"
                    required
                    value={schoolForm.name}
                    onChange={(e) => setSchoolForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tahun Pelajaran SPMB</label>
                  <input
                    type="text"
                    required
                    value={schoolForm.academicYear}
                    onChange={(e) => setSchoolForm((prev) => ({ ...prev, academicYear: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Sub-Judul / Deskripsi Lembaga</label>
                  <input
                    type="text"
                    value={schoolForm.subTitle}
                    onChange={(e) => setSchoolForm((prev) => ({ ...prev, subTitle: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">NPSN Sekolah</label>
                  <input
                    type="text"
                    placeholder="Contoh: 20231234"
                    value={schoolForm.npsn || ''}
                    onChange={(e) => setSchoolForm((prev) => ({ ...prev, npsn: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block font-bold text-slate-700 mb-1">Tagline / Visi Misi Slogan</label>
                  <input
                    type="text"
                    value={schoolForm.tagline}
                    onChange={(e) => setSchoolForm((prev) => ({ ...prev, tagline: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Kepala Sekolah</label>
                  <input
                    type="text"
                    placeholder="Contoh: Drs. H. M. Syarifuddin, M.Pd."
                    value={schoolForm.headmasterName || ''}
                    onChange={(e) => setSchoolForm((prev) => ({ ...prev, headmasterName: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status Akreditasi</label>
                  <input
                    type="text"
                    placeholder="Contoh: A (Sangat Baik / Unggulan)"
                    value={schoolForm.accreditation || ''}
                    onChange={(e) => setSchoolForm((prev) => ({ ...prev, accreditation: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block font-bold text-slate-700 mb-1">Sambutan Singkat Kepala Sekolah</label>
                  <textarea
                    rows={2}
                    placeholder="Pesan sambutan untuk calon wali murid..."
                    value={schoolForm.principalGreeting || ''}
                    onChange={(e) => setSchoolForm((prev) => ({ ...prev, principalGreeting: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 4: KONTAK & ALAMAT */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="border-b border-slate-200 pb-3">
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Phone className="w-5 h-5 text-blue-600" />
                  <span>4. Alamat, Telepon & WA Center SPMB</span>
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div className="md:col-span-3">
                  <label className="block font-bold text-slate-700 mb-1">Alamat Lengkap Sekolah</label>
                  <input
                    type="text"
                    required
                    value={schoolForm.address}
                    onChange={(e) => setSchoolForm((prev) => ({ ...prev, address: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">No. Telepon Sekretariat</label>
                  <input
                    type="text"
                    value={schoolForm.phone}
                    onChange={(e) => setSchoolForm((prev) => ({ ...prev, phone: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nomor WhatsApp Center (Tanpa +/0)</label>
                  <input
                    type="text"
                    placeholder="Contoh: 6281234567890"
                    value={schoolForm.whatsapp}
                    onChange={(e) => setSchoolForm((prev) => ({ ...prev, whatsapp: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-blue-700"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Resmi</label>
                  <input
                    type="email"
                    value={schoolForm.email}
                    onChange={(e) => setSchoolForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Website Resmi</label>
                  <input
                    type="text"
                    value={schoolForm.website}
                    onChange={(e) => setSchoolForm((prev) => ({ ...prev, website: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 5: REKENING BANK & BIAYA FORMULIR */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="border-b border-slate-200 pb-3">
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-amber-600" />
                  <span>5. Rekening Bank & Biaya Formulir Pendaftaran</span>
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Bank</label>
                  <input
                    type="text"
                    required
                    value={schoolForm.bankName}
                    onChange={(e) => setSchoolForm((prev) => ({ ...prev, bankName: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nomor Rekening</label>
                  <input
                    type="text"
                    required
                    value={schoolForm.bankAccountNumber}
                    onChange={(e) => setSchoolForm((prev) => ({ ...prev, bankAccountNumber: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-emerald-700 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Atas Nama Rekening</label>
                  <input
                    type="text"
                    required
                    value={schoolForm.bankAccountName}
                    onChange={(e) => setSchoolForm((prev) => ({ ...prev, bankAccountName: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Biaya Formulir (Rp)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={10000}
                    value={schoolForm.formFee}
                    onChange={(e) => setSchoolForm((prev) => ({ ...prev, formFee: Number(e.target.value) }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-indigo-700 font-bold"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 6: MEDIA SOSIAL OFFICIAL */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="border-b border-slate-200 pb-3">
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-purple-600" />
                  <span>6. Akun Media Sosial Resmi</span>
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Instagram URL</label>
                  <input
                    type="url"
                    placeholder="https://instagram.com/..."
                    value={schoolForm.socialMedia?.instagram || ''}
                    onChange={(e) =>
                      setSchoolForm((prev) => ({
                        ...prev,
                        socialMedia: { ...prev.socialMedia, instagram: e.target.value },
                      }))
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Facebook URL</label>
                  <input
                    type="url"
                    placeholder="https://facebook.com/..."
                    value={schoolForm.socialMedia?.facebook || ''}
                    onChange={(e) =>
                      setSchoolForm((prev) => ({
                        ...prev,
                        socialMedia: { ...prev.socialMedia, facebook: e.target.value },
                      }))
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">YouTube Channel URL</label>
                  <input
                    type="url"
                    placeholder="https://youtube.com/@..."
                    value={schoolForm.socialMedia?.youtube || ''}
                    onChange={(e) =>
                      setSchoolForm((prev) => ({
                        ...prev,
                        socialMedia: { ...prev.socialMedia, youtube: e.target.value },
                      }))
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">TikTok Handle URL</label>
                  <input
                    type="url"
                    placeholder="https://tiktok.com/@..."
                    value={schoolForm.socialMedia?.tiktok || ''}
                    onChange={(e) =>
                      setSchoolForm((prev) => ({
                        ...prev,
                        socialMedia: { ...prev.socialMedia, tiktok: e.target.value },
                      }))
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Save Bar */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center gap-2"
              >
                <Save className="w-5 h-5" />
                <span>Simpan Seluruh Perubahan Informasi Sekolah</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB: WEBSITE SETTINGS */}
        {activeTab === 'website_settings' && (
          <form onSubmit={handleSaveWebsiteSettings} className="space-y-6">
            {saveWebSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 font-medium text-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>{saveWebSuccess}</span>
              </div>
            )}

            {/* Live Preview Card */}
            <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-6 rounded-2xl text-white shadow-xl space-y-4">
              <div className="flex items-center justify-between text-xs text-emerald-300 font-semibold border-b border-emerald-800/60 pb-3">
                <span className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  Pratinjau Langsung Tampilan Hero Website
                </span>
                <span className="px-2.5 py-1 bg-emerald-500/20 rounded-full border border-emerald-400/30 text-[10px]">
                  Mode Live Preview
                </span>
              </div>

              {/* Running Banner Preview */}
              {webForm.showAnnouncementBanner && (
                <div className="bg-emerald-800/80 border border-emerald-500/40 px-4 py-2 rounded-xl text-xs font-semibold text-emerald-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping"></span>
                  <span className="truncate">{webForm.announcementBannerText || '🔥 SPMB SMP Al-Hadiid Cileungsi segera dibuka'}</span>
                </div>
              )}

              <div className="space-y-2 py-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-emerald-300 border border-white/10">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{webForm.heroBadgeText || 'SPMB TP 2027/2028 Telah Dibuka'}</span>
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight leading-tight">
                  {webForm.heroTitle || 'Sistem Penerimaan Murid Baru (SPMB)'}
                </h2>
                <p className="text-xs text-emerald-100/90 max-w-xl">
                  {webForm.heroSubtitle || 'Mewujudkan Generasi Rabbani...'}
                </p>
              </div>
            </div>

            {/* Main Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Hero & Banner Text */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-3">
                  <Palette className="w-4 h-4 text-rose-600" />
                  <span>Pengaturan Teks Utama & Banner Hero</span>
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Judul Utama Hero Banner
                  </label>
                  <input
                    type="text"
                    required
                    value={webForm.heroTitle || ''}
                    onChange={(e) => setWebForm((prev) => ({ ...prev, heroTitle: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    placeholder="Penerimaan Murid Baru (SPMB) Online"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sub-Judul / Tagline Hero Banner
                  </label>
                  <textarea
                    rows={2}
                    value={webForm.heroSubtitle || ''}
                    onChange={(e) => setWebForm((prev) => ({ ...prev, heroSubtitle: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    placeholder="Mewujudkan Generasi Rabbani yang Cerdas & Berakhlak..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Teks Badge Pengumuman Hero
                  </label>
                  <input
                    type="text"
                    value={webForm.heroBadgeText || ''}
                    onChange={(e) => setWebForm((prev) => ({ ...prev, heroBadgeText: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    placeholder="SPMB TP 2027/2028 Telah Resmi Dibuka"
                  />
                </div>

                <div className="pt-2 border-t space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">
                      Tampilkan Running Text Banner
                    </label>
                    <input
                      type="checkbox"
                      checked={webForm.showAnnouncementBanner ?? true}
                      onChange={(e) => setWebForm((prev) => ({ ...prev, showAnnouncementBanner: e.target.checked }))}
                      className="w-5 h-5 text-rose-600 rounded focus:ring-rose-500 cursor-pointer"
                    />
                  </div>

                  {webForm.showAnnouncementBanner && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Isi Pesan Running Text Banner
                      </label>
                      <input
                        type="text"
                        value={webForm.announcementBannerText || ''}
                        onChange={(e) => setWebForm((prev) => ({ ...prev, announcementBannerText: e.target.value }))}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-rose-700 font-medium"
                        placeholder="🔥 SPMB SMP Al-Hadiid Cileungsi segera dibuka"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: Theme Color & Custom Notice */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-3">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Tema Warna & Pesan Sambutan Khusus</span>
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Tema Warna Aksen Utama Website
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-600', text: 'text-emerald-700' },
                      { id: 'blue', label: 'Blue', bg: 'bg-blue-600', text: 'text-blue-700' },
                      { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-600', text: 'text-indigo-700' },
                      { id: 'purple', label: 'Purple', bg: 'bg-purple-600', text: 'text-purple-700' },
                      { id: 'teal', label: 'Teal', bg: 'bg-teal-600', text: 'text-teal-700' },
                    ].map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setWebForm((prev) => ({ ...prev, primaryColorTheme: theme.id as any }))}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          webForm.primaryColorTheme === theme.id
                            ? 'border-2 border-slate-900 shadow-md bg-slate-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-full ${theme.bg} shadow-sm`} />
                        <span className="text-[10px] font-bold text-slate-700">{theme.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pesan Sambutan Khusus / Pengumuman Header
                  </label>
                  <textarea
                    rows={4}
                    value={webForm.customWelcomeNotice || ''}
                    onChange={(e) => setWebForm((prev) => ({ ...prev, customWelcomeNotice: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    placeholder="Tulis pesan pengumuman penting bagi pengunjung website..."
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Visibilitas Seksi Halaman Utama */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center justify-between border-b pb-3">
                <span className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-600" />
                  <span>Pengaturan Visibilitas Seksi Halaman Depan</span>
                </span>
                <span className="text-xs text-slate-500 font-normal">
                  Aktifkan atau sembunyikan seksi di Landing Page
                </span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                {[
                  { key: 'showVideoSection', label: 'Seksi Video Profil Sekolah', desc: 'Menampilkan player video Youtube profil & fasilitas' },
                  { key: 'showBrochureSection', label: 'Seksi Brosur SPMB PDF', desc: 'Menampilkan tombol download & pratinjau brosur' },
                  { key: 'showQuotaSection', label: 'Seksi Statistik Kuota Gelombang', desc: 'Menampilkan sisa kuota pendaftaran kelas' },
                  { key: 'showCostSection', label: 'Seksi Rincian Biaya SPMB', desc: 'Menampilkan rincian biaya masuk & SPP' },
                  { key: 'showScheduleSection', label: 'Seksi Jadwal Tes Seleksi', desc: 'Menampilkan jadwal gelombang tes diagnostik' },
                  { key: 'showFaqSection', label: 'Seksi FAQ & Tanya Jawab', desc: 'Menampilkan jawaban pertanyaan umum pendaftar' },
                ].map((item) => {
                  const isChecked = (webForm as any)[item.key] ?? true;
                  return (
                    <label
                      key={item.key}
                      className={`p-4 rounded-xl border flex items-start gap-3 transition-all cursor-pointer ${
                        isChecked ? 'bg-emerald-50/50 border-emerald-300 text-slate-900' : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          setWebForm((prev) => ({
                            ...prev,
                            [item.key]: e.target.checked,
                          }))
                        }
                        className="mt-0.5 w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                      <div>
                        <div className="font-bold">{item.label}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-8 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-5 h-5" />
                <span>Simpan Pengaturan Tampilan Website</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB: ACCOUNT SETTINGS (SUPER ADMIN & PANITIA) */}
        {activeTab === 'account_settings' && (
          <AccountSettingsSection
            currentUser={currentUser}
            initialTab="accounts"
            onRefreshData={onRefreshAllData}
          />
        )}

        {/* TAB: DEFAULT CREDENTIALS (SUPER ADMIN) */}
        {activeTab === 'default_credentials' && (
          <AccountSettingsSection
            currentUser={currentUser}
            initialTab="default_credentials"
            onRefreshData={onRefreshAllData}
          />
        )}

        {/* TAB: USER MANAGEMENT (CRUD) */}
        {activeTab === 'user_management' && (
          <UserManagementSection
            currentUser={currentUser}
            students={students}
            onUpdateStudents={onUpdateStudents}
            onRefreshAllData={onRefreshAllData}
            onNavigateToDefaultCredentials={() => setActiveTab('default_credentials')}
          />
        )}

        {/* TAB: SUPABASE SYNC */}
        {activeTab === 'supabase_sync' && (
          <SupabaseSyncTab onRefreshAllData={onRefreshAllData} />
        )}

        {/* TAB: DATABASE MANAGEMENT */}
        {activeTab === 'database_management' && (
          <div className="space-y-6">
            {dbSuccessMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 font-medium text-xs shadow-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{dbSuccessMsg}</span>
              </div>
            )}

            {dbErrMsg && (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 font-medium text-xs shadow-sm">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{dbErrMsg}</span>
              </div>
            )}

            {/* Header info */}
            <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <HardDrive className="w-5 h-5" />
                <span>Pusat Pengelolaan Database SPMB</span>
              </div>
              <p className="text-xs text-slate-300 max-w-2xl">
                Gunakan menu ini untuk membuat cadangan (backup) seluruh data sistem, memulihkan (restore) dari file arsip, menyinkronkan dengan Supabase Cloud, membersihkan data pendaftar lama, atau melakukan reset pabrik.
              </p>
            </div>

            {/* Supabase Live Cloud Sync Card */}
            <SupabaseSyncButton variant="card" onDataSynced={onRefreshAllData} />

            {/* 4 Database Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Backup Download */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Cadangkan Data (Backup JSON & Excel)</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Unduh seluruh isi database (pendaftar, kuota, biaya, informasi sekolah, jadwal tes, & akun) dalam bentuk file arsip aman.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <button
                    onClick={handleDownloadBackupJson}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileCode className="w-4 h-4" />
                    <span>Download Backup JSON Lengkap</span>
                  </button>

                  <button
                    onClick={() => exportToExcel(students, 'Backup_Pendaftar_SPMB')}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl border border-slate-300 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Ekspor Format Excel (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Restore */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Pulihkan Data (Restore Backup)</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Unggah file backup `.json` untuk memperbarui atau mengembalikan seluruh data sistem dari cadangan sebelumnya.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <label className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-center">
                    <Upload className="w-4 h-4" />
                    <span>Pilih & Unggah File Backup JSON</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleRestoreJsonFile}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[10px] text-slate-400 text-center">
                    Format file harus berupa `.json` hasil backup resmi dari portal ini.
                  </p>
                </div>
              </div>

              {/* Card 3: Purge Applicants Only */}
              <div className="bg-white p-6 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-sm flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Hapus Seluruh Data Pendaftar</h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Menghapus <strong className="text-amber-900">{students.length} data pendaftar</strong> dan mengosongkan statistik terisi kuota kelas. Data profil sekolah & akun panitia tetap aman.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-amber-200">
                  <button
                    onClick={() => {
                      setPurgeInputText('');
                      setPurgeModalOpen(true);
                    }}
                    className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus Data Pendaftar...</span>
                  </button>
                </div>
              </div>

              {/* Card 4: Factory Reset Total */}
              <div className="bg-white p-6 rounded-2xl border border-rose-200 bg-rose-50/30 shadow-sm flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Reset Total Database (Setelan Pabrik)</h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Mengembalikan SELURUH database (pendaftar, kuota, biaya, jadwal tes, & informasi sekolah) ke kondisi awal pabrik secara permanen.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-rose-200">
                  <button
                    onClick={() => {
                      setResetInputText('');
                      setResetModalOpen(true);
                    }}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Reset Total Ke Setelan Pabrik...</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL PURGE APPLICANTS CONFIRMATION */}
        {purgeModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 text-slate-900 relative shadow-2xl space-y-4">
              <button
                onClick={() => setPurgeModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 text-amber-600 border-b pb-3">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-bold text-slate-900">Konfirmasi Hapus Data Pendaftar</h3>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                <p className="font-bold">⚠️ Perhatian Tindakan Berbahaya:</p>
                <p>Tindakan ini akan menghapus permanen <strong>{students.length} data pendaftar</strong> dari sistem & database.</p>
              </div>

              <div className="space-y-2 text-xs">
                <label className="block font-semibold text-slate-700">
                  Ketik frasa <strong className="text-rose-700 underline">HAPUS PENDAFTAR</strong> di bawah ini untuk mengonfirmasi:
                </label>
                <input
                  type="text"
                  value={purgeInputText}
                  onChange={(e) => setPurgeInputText(e.target.value)}
                  placeholder="Ketik: HAPUS PENDAFTAR"
                  className="w-full p-2.5 border-2 border-amber-400 rounded-xl font-bold text-center tracking-widest text-slate-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setPurgeModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={purgeInputText.trim() !== 'HAPUS PENDAFTAR'}
                  onClick={handleConfirmPurgeApplicants}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Ya, Hapus Pendaftar</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL RESET TOTAL FACTORY DEFAULT */}
        {resetModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 text-slate-900 relative shadow-2xl space-y-4">
              <button
                onClick={() => setResetModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 text-rose-600 border-b pb-3">
                <AlertCircle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-bold text-slate-900">Reset Total Database Pabrik</h3>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
                <p className="font-bold">🚨 BAHAYA! PENGEMBALIAN PABRIK TOTAL:</p>
                <p>Seluruh data pendaftar, statistik kuota, rincian biaya, jadwal tes, dan profil sekolah akan di-reset total ke kondisi awal pabrik saat pertama kali dibuat.</p>
              </div>

              <div className="space-y-2 text-xs">
                <label className="block font-semibold text-slate-700">
                  Ketik frasa <strong className="text-rose-700 underline">RESET TOTAL</strong> di bawah ini untuk mengonfirmasi:
                </label>
                <input
                  type="text"
                  value={resetInputText}
                  onChange={(e) => setResetInputText(e.target.value)}
                  placeholder="Ketik: RESET TOTAL"
                  className="w-full p-2.5 border-2 border-rose-400 rounded-xl font-bold text-center tracking-widest text-slate-900 focus:outline-none focus:border-rose-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setResetModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={resetInputText.trim() !== 'RESET TOTAL'}
                  onClick={handleConfirmResetTotal}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Ya, Reset Pabrik Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SCORE MODAL EDIT */}
        {editingScoreStudent && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 text-slate-900 relative shadow-2xl">
              <button
                onClick={() => setEditingScoreStudent(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-base font-bold mb-1">Input Nilai Tes Diagnostik</h3>
              <p className="text-xs text-slate-500 mb-4">{editingScoreStudent.fullName} ({editingScoreStudent.registrationNumber})</p>

              <form onSubmit={handleSaveGrades} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Nilai Tes Diagnostik Awal (Bobot 30%)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={100}
                    value={diagScore}
                    onChange={(e) => setDiagScore(Number(e.target.value))}
                    className="w-full p-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Nilai Tes Pengetahuan Umum (Bobot 40%)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={100}
                    value={generalScore}
                    onChange={(e) => setGeneralScore(Number(e.target.value))}
                    className="w-full p-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Nilai Tes Diniyyah & Al-Qur'an (Bobot 30%)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={100}
                    value={relScore}
                    onChange={(e) => setRelScore(Number(e.target.value))}
                    className="w-full p-2 border rounded-xl"
                  />
                </div>

                <div className="p-3 bg-slate-100 rounded-xl font-bold flex justify-between">
                  <span>Estimasi Skor Akhir:</span>
                  <span className="text-emerald-700 font-mono text-sm">
                    {((diagScore * 0.3) + (generalScore * 0.4) + (relScore * 0.3)).toFixed(1)}
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl"
                >
                  Simpan & Hitung Skor
                </button>
              </form>
            </div>
          </div>
        )}

        {/* STUDENT DETAIL MODAL */}
        {selectedStudent && (() => {
          const formFilled = isStudentFormFilled(selectedStudent);
          const proofUploaded = hasUploadedPaymentProof(selectedStudent);
          const canDownload = canDownloadStudentForm(selectedStudent);

          return (
            <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-2xl w-full p-6 text-slate-900 relative shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-scale-up">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Tutup Modal"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Modal Header */}
                <div className="border-b pb-3 pr-8">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-900 text-white font-black text-lg flex items-center justify-center shrink-0">
                      {selectedStudent.fullName.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {selectedStudent.fullName}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {selectedStudent.registrationNumber}
                        </span>
                        <span>•</span>
                        <span>{selectedStudent.gender}</span>
                        <span>•</span>
                        <span className="capitalize font-semibold text-slate-700">
                          Status: {selectedStudent.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* FITUR VERIFIKASI PEMBAYARAN & DATA CALON MURID */}
                <div className={`p-4 rounded-2xl border space-y-3 ${
                  selectedStudent.formPaymentStatus === 'verified' && (selectedStudent.isFormVerified || selectedStudent.status === 'form_verified')
                    ? 'bg-emerald-50/80 border-emerald-400'
                    : 'bg-amber-50/80 border-amber-300'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Verifikasi Data & Pembayaran Formulir (Rp {(selectedStudent.formPaymentAmount || 200000).toLocaleString('id-ID')})</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      selectedStudent.formPaymentStatus === 'verified' && (selectedStudent.isFormVerified || selectedStudent.status === 'form_verified')
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-500 text-white'
                    }`}>
                      {selectedStudent.formPaymentStatus === 'verified' && (selectedStudent.isFormVerified || selectedStudent.status === 'form_verified')
                        ? '✓ Terverifikasi Resmi'
                        : 'Menunggu Verifikasi'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed">
                    {selectedStudent.formPaymentStatus === 'verified' && (selectedStudent.isFormVerified || selectedStudent.status === 'form_verified')
                      ? 'Data calon murid dan bukti pembayaran formulir telah disahkan oleh Panitia Admin. Akses download formulir pendaftaran dan kartu ujian telah aktif bagi calon murid.'
                      : 'Verifikasi berkas dan pembayaran calon murid ini untuk mengaktifkan akses download Formulir Pendaftaran dan Kartu Peserta Ujian.'}
                  </p>

                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    {!(selectedStudent.formPaymentStatus === 'verified' && (selectedStudent.isFormVerified || selectedStudent.status === 'form_verified')) ? (
                      <button
                        type="button"
                        onClick={() => handleVerifyFormAndData(selectedStudent.id, true)}
                        className="flex-1 min-w-[200px] py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Verifikasi Data & Pembayaran (Sahkan Murid)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleVerifyFormAndData(selectedStudent.id, false)}
                        className="py-2 px-3 bg-white border border-slate-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-500" />
                        <span>Batalkan Verifikasi Data</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* DOWNLOAD FORMULIR & KARTU UJIAN OLEH ADMIN */}
                <div className="p-4 bg-gradient-to-br from-slate-50 to-teal-50/50 border-2 border-slate-300 rounded-2xl shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-xs sm:text-sm">
                      <Download className="w-4 h-4 text-teal-700 shrink-0" />
                      <span>Download Dokumen Calon Murid (Panitia Admin)</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Admin panitia dapat langsung mengunduh Formulir Pendaftaran lengkap (PDF 3 Halaman) dan Kartu Peserta Ujian calon murid:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadStudentForm(selectedStudent)}
                      className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Formulir (PDF 3 Hal)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadExamCard(selectedStudent)}
                      className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Kartu Ujian (PDF)</span>
                    </button>
                  </div>
                </div>

                {/* DOKUMEN UJIAN & FITUR UJIAN DIULANG */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-indigo-600" />
                      <span>Dokumen Ujian Seleksi & Hasil Kelulusan (PDF)</span>
                    </span>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                      selectedStudent.status === 'passed' ? 'bg-emerald-100 text-emerald-800' :
                      selectedStudent.status === 'failed' ? 'bg-rose-100 text-rose-800' :
                      'bg-slate-200 text-slate-700'
                    }`}>
                      {selectedStudent.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadExamCard(selectedStudent)}
                      className="py-2.5 px-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Download Kartu Ujian (PDF)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadExamResult(selectedStudent)}
                      className="py-2.5 px-3 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-300" />
                      <span>Download Hasil Ujian (PDF)</span>
                    </button>
                  </div>

                  {/* If student is failed, provide Panitia button to manage/re-allow Ujian Diulang */}
                  {selectedStudent.status === 'failed' && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs text-rose-900 font-bold">
                        <span className="flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 text-rose-600" />
                          <span>Status: Tidak Lulus (Remedial Aktif)</span>
                        </span>
                        <span className="text-[10px] bg-rose-200 text-rose-900 px-2 py-0.5 rounded font-bold">
                          {selectedStudent.retestCount ? `Ujian Ulang: ${selectedStudent.retestCount}x` : 'Belum Ujian Ulang'}
                        </span>
                      </div>
                      <p className="text-[11px] text-rose-800 leading-relaxed">
                        Fitur Ujian Diulang telah terbuka otomatis di akun murid. Anda juga dapat mereset dan mengaktifkan kembali sesi pengerjaan soal secara langsung.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleAllowRetest(selectedStudent.id)}
                        className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Buka / Reset Akses Ujian Diulang</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* PENGUMUMAN WHATSAPP ORANG TUA / WALI */}
                <div className="p-4 bg-gradient-to-br from-emerald-50 via-teal-50/60 to-white border border-emerald-300 rounded-2xl shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-emerald-950 flex items-center gap-1.5">
                      <MessageCircle className="w-4 h-4 text-emerald-600" />
                      <span>Pengumuman Resmi via WhatsApp Orang Tua / Wali</span>
                    </span>
                    {waSentHistory[selectedStudent.id] ? (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        ✓ Terkirim ({waSentHistory[selectedStudent.id].parentRole})
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                        Belum Terkirim
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-emerald-800/90 leading-relaxed">
                    Kirimkan surat keputusan kelulusan, jadwal tes seleksi, pengingat biaya daftar ulang, atau pemberitahuan rombel langsung ke WhatsApp nomor orang tua calon murid ini.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setWaModalStudent(selectedStudent);
                      setWaDefaultTemplate(
                        selectedStudent.status === 'passed' ? 'passed' :
                        selectedStudent.status === 'passed_reserved' ? 'passed_reserved' :
                        selectedStudent.status === 'failed' ? 'failed' :
                        selectedStudent.status === 'class_assigned' ? 'class_placement' :
                        selectedStudent.status === 'scheduled_test' ? 'test_schedule' : 'custom'
                      );
                    }}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-100" />
                    <span>{waSentHistory[selectedStudent.id] ? 'Kirim Ulang Pesan Pengumuman WhatsApp' : 'Kirim Pesan Pengumuman WhatsApp Sekarang'}</span>
                  </button>
                </div>

                {/* Bukti Transfer Formulir Box jika sudah upload */}
                {selectedStudent.formPaymentProofUrl && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-emerald-600" />
                        Bukti Transfer Biaya Formulir
                      </span>
                      <span className="font-mono font-bold text-emerald-700">
                        Rp {(selectedStudent.formPaymentAmount || 200000).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <a
                        href={selectedStudent.formPaymentProofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative block w-20 h-20 rounded-lg border border-slate-300 overflow-hidden bg-slate-900 shrink-0"
                        title="Klik untuk membuka gambar ukuran penuh"
                      >
                        <img
                          src={selectedStudent.formPaymentProofUrl}
                          alt="Bukti Transfer Formulir"
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                          <Eye className="w-4 h-4 text-amber-300" />
                        </div>
                      </a>
                      <div className="text-xs text-slate-600 space-y-1">
                        <div><span className="font-semibold">Tanggal Upload:</span> {selectedStudent.formPaymentDate || '-'}</div>
                        <div>
                          <span className="font-semibold">Status Pembayaran:</span>{' '}
                          <span className="font-bold text-emerald-700 uppercase">{selectedStudent.formPaymentStatus}</span>
                        </div>
                        {selectedStudent.formPaymentNotes && (
                          <div className="text-slate-500 italic">"{selectedStudent.formPaymentNotes}"</div>
                        )}
                        <div className="pt-2 flex items-center gap-2">
                          {selectedStudent.formPaymentStatus !== 'verified' ? (
                            <button
                              type="button"
                              onClick={() => handleVerifyFormPayment(selectedStudent.id, 'verified')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Verifikasi Bukti Pembayaran</span>
                            </button>
                          ) : (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Lunas & Terverifikasi</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bukti Transfer BAM / Daftar Ulang & Input Verifikasi Panitia (Tahap 8 Alur SPMB) */}
                {(selectedStudent.initialPaymentProofUrl || selectedStudent.initialPaymentStatus === 'verified' || selectedStudent.status === 'passed' || selectedStudent.status === 're_registered') && (
                  <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-xl space-y-3">
                    <div className="font-bold text-xs text-blue-900 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-blue-600" />
                        <span>Tahap 8: Verifikasi Bukti Transfer & Input Nominal BAM</span>
                      </span>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                        selectedStudent.initialPaymentStatus === 'verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {selectedStudent.initialPaymentStatus === 'verified' ? '✓ Lunas & Tercatat di Tabel' : 'Menunggu Verifikasi'}
                      </span>
                    </div>

                    {selectedStudent.initialPaymentProofUrl && (
                      <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-blue-100">
                        <a
                          href={selectedStudent.initialPaymentProofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="group relative block w-20 h-20 rounded-lg border border-blue-300 overflow-hidden bg-slate-900 shrink-0"
                          title="Klik untuk membuka gambar ukuran penuh"
                        >
                          <img
                            src={selectedStudent.initialPaymentProofUrl}
                            alt="Bukti Transfer BAM"
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                            <Eye className="w-4 h-4 text-amber-300" />
                          </div>
                        </a>
                        <div className="text-xs text-slate-600 space-y-1">
                          <div><span className="font-semibold">Tanggal Upload Murid:</span> {selectedStudent.initialPaymentDate || '-'}</div>
                          <div>
                            <span className="font-semibold">Catatan Murid:</span>{' '}
                            <span className="italic text-slate-500">{selectedStudent.initialPaymentNotes || 'Tidak ada catatan'}</span>
                          </div>
                          <a
                            href={selectedStudent.initialPaymentProofUrl}
                            download={`Bukti_BAM_${selectedStudent.registrationNumber}.jpg`}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 pt-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Unduh File Bukti BAM</span>
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Form Input Nominal & Verifikasi untuk Panitia */}
                    {selectedStudent.initialPaymentStatus !== 'verified' ? (
                      <div className="p-3 bg-white rounded-lg border border-blue-200 space-y-3">
                        <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                          <span>Input Nominal Transfer & Verifikasi ke Tabel Pembayaran:</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Nominal Transfer (Rp) *
                            </label>
                            <input
                              type="number"
                              value={bamVerifyNominal}
                              onChange={(e) => setBamVerifyNominal(Number(e.target.value))}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 font-mono"
                              placeholder={selectedStudent ? getTotalBamCost(getStudentCategory(selectedStudent)).toString() : '11000000'}
                            />
                            <span className="text-[10px] text-slate-400">
                              Standar {selectedStudent && getStudentCategory(selectedStudent) === 'Internal' ? 'Al-Hadiid (Internal): Rp 11.000.000' : 'Umum (Eksternal): Rp 12.000.000'}
                            </span>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Tanggal Pembayaran *
                            </label>
                            <input
                              type="date"
                              value={bamVerifyDate}
                              onChange={(e) => setBamVerifyDate(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Kategori Angsuran *
                            </label>
                            <select
                              value={bamVerifyType}
                              onChange={(e) => setBamVerifyType(e.target.value as BamInstallmentType)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 bg-white"
                            >
                              <option value="Lunas">Lunas (100%)</option>
                              <option value="Cicilan 1">Cicilan 1</option>
                              <option value="Cicilan 2">Cicilan 2</option>
                              <option value="Cicilan 3">Cicilan 3</option>
                              <option value="Custom">Custom</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Catatan Panitia
                            </label>
                            <input
                              type="text"
                              value={bamVerifyNotes}
                              onChange={(e) => setBamVerifyNotes(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
                              placeholder="e.g. Pembayaran Lunas via Transfer BSI"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleVerifyAndRecordBamPayment(
                            selectedStudent,
                            bamVerifyNominal,
                            bamVerifyDate,
                            bamVerifyType,
                            bamVerifyNotes
                          )}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4 text-blue-100" />
                          <span>Verifikasi Bukti Transfer & Simpan ke Tabel Pembayaran</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="font-bold text-emerald-800 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Pembayaran BAM Telah Diverifikasi & Masuk Tabel Pembayaran</span>
                          </div>
                          <div className="text-emerald-700 text-[11px]">
                            Nominal: <b className="font-mono">Rp {(selectedStudent.initialPaymentAmount || 0).toLocaleString('id-ID')}</b> | Tanggal: {selectedStudent.initialPaymentDate || '-'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudent(null);
                            setActiveTab('payment_initial');
                          }}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-bold shadow-sm cursor-pointer"
                        >
                          Buka Tabel BAM →
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Student Details Grid */}
                <div className="space-y-3 text-xs">
                  <div className="font-bold text-slate-800 border-b pb-1">Data Pribadi Calon Murid</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-slate-500">NIK:</span> <strong className="font-mono">{selectedStudent.nik || '-'}</strong></div>
                    <div><span className="text-slate-500">NISN:</span> <strong className="font-mono">{selectedStudent.nisn || '-'}</strong></div>
                    <div><span className="text-slate-500">Tempat, Tgl Lahir:</span> <strong>{selectedStudent.birthPlace || '-'}, {selectedStudent.birthDate || '-'}</strong></div>
                    <div><span className="text-slate-500">Agama:</span> <strong>{selectedStudent.religion || 'Islam'}</strong></div>
                    <div><span className="text-slate-500">No. WhatsApp/HP:</span> <strong className="font-mono">{selectedStudent.phone || '-'}</strong></div>
                    <div><span className="text-slate-500">Email Akun:</span> <strong>{selectedStudent.userEmail || '-'}</strong></div>
                    <div className="col-span-2"><span className="text-slate-500">Alamat Rumah:</span> <strong>{selectedStudent.address || '-'}</strong></div>
                  </div>

                  <div className="font-bold text-slate-800 border-b pb-1 pt-2">Data Sekolah Asal & Orang Tua</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-slate-500">Sekolah Asal:</span> <strong>{selectedStudent.previousSchoolName || '-'}</strong></div>
                    <div><span className="text-slate-500">NPSN Asal:</span> <strong className="font-mono">{selectedStudent.previousSchoolNpsn || '-'}</strong></div>
                    <div><span className="text-slate-500">Nama Ayah:</span> <strong>{selectedStudent.fatherName || '-'}</strong> ({selectedStudent.fatherPhone || '-'})</div>
                    <div><span className="text-slate-500">Pekerjaan Ayah:</span> <strong>{selectedStudent.fatherJob || '-'}</strong></div>
                    <div><span className="text-slate-500">Nama Ibu:</span> <strong>{selectedStudent.motherName || '-'}</strong> ({selectedStudent.motherPhone || '-'})</div>
                    <div><span className="text-slate-500">Pekerjaan Ibu:</span> <strong>{selectedStudent.motherJob || '-'}</strong></div>
                    <div><span className="text-slate-500">Nilai CBT / Tes:</span> <strong className="font-mono">{selectedStudent.finalScore !== undefined ? selectedStudent.finalScore : '-'}</strong></div>
                    <div><span className="text-slate-500">Penempatan Kelas:</span> <strong className="text-blue-700">{selectedStudent.assignedClassName || '-'}</strong></div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* MODAL PENGUMUMAN WHATSAPP ORANG TUA / WALI */}
      {waModalStudent && (
        <WhatsAppAnnouncementModal
          isOpen={!!waModalStudent}
          onClose={() => setWaModalStudent(null)}
          student={waModalStudent}
          schoolInfo={schoolInfo}
          defaultTemplateKey={waDefaultTemplate}
          onSentSuccess={() => {
            setWaSentHistory(getWhatsAppSentHistory());
          }}
        />
      )}
    </div>
  );
};
