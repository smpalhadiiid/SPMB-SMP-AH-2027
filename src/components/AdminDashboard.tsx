import React, { useState } from 'react';
import { StudentData, ClassQuota, CostBreakdown, SchoolInfo, TestSchedule, GasConfig, UserAccount, WebsiteConfig, ExamQuestion } from '../types';
import { exportToExcel } from '../utils/excelExporter';
import { generateReportPDF } from '../utils/pdfGenerator';
import {
  exportAllDataAsBackup, importBackupData, purgeApplicantData, resetAllDataToDefault, getStoredWebsiteConfig,
  getStoredQuestionBank, saveQuestionBank, saveTestSchedules
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
  HelpCircle, FileJson, Calendar, BookOpen, PlusCircle, CheckSquare2, LayoutDashboard, Image as ImageIcon, Lock
} from 'lucide-react';
import { SupabaseBadge } from './SupabaseBadge';
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
    'overview', 'user_management', 'account_settings', 'applicants', 'payment_form',
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

  // Score editing modal state
  const [editingScoreStudent, setEditingScoreStudent] = useState<StudentData | null>(null);
  const [diagScore, setDiagScore] = useState<number>(80);
  const [generalScore, setGeneralScore] = useState<number>(80);
  const [relScore, setRelScore] = useState<number>(80);

  // Quota editing / new class modal state
  const [newClassName, setNewClassName] = useState('');
  const [newCapacity, setNewCapacity] = useState<number>(32);
  const [newHomeroom, setNewHomeroom] = useState('');

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

  // Filtered Students
  const filteredStudents = students.filter(s => {
    const matchSearch =
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone.includes(searchQuery) ||
      s.userEmail.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Action: Verify Form Payment (Tahap 3)
  const handleVerifyFormPayment = (studentId: string, status: 'verified' | 'rejected') => {
    const updated = students.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          formPaymentStatus: status,
          status: status === 'verified' ? ('filling_form' as const) : ('pending_payment' as const),
        };
      }
      return s;
    });
    onUpdateStudents(updated);
  };

  // Action: Verify Payment + Form Data (Activates PDF Download & Verification)
  const handleVerifyFormAndData = (studentId: string, isVerified: boolean) => {
    const updated = students.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          isFormVerified: isVerified,
          formPaymentStatus: isVerified ? ('verified' as const) : ('pending' as const),
          status: isVerified ? ('form_verified' as const) : ('form_submitted' as const),
        };
      }
      return s;
    });
    onUpdateStudents(updated);
    alert(
      isVerified
        ? '✓ Berhasil Memverifikasi Data Pembayaran & Isian Formulir!\n\nFitur Download Formulir PDF pada dashboard calon murid telah DIAKTIFKAN.'
        : 'Status verifikasi dibatalkan.'
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
    setQCategory(q.category);
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
          firstDayDate: '12 Juli 2027',
          mplsInfo: 'Hadir Pukul 07:00 WIB memakai seragam SD asal.',
          status: 'class_assigned' as const,
        };
      }
      return s;
    });

    onUpdateStudents(updated);
  };

  // Action: Add New Class Quota
  const handleAddClassQuota = (e: React.FormEvent) => {
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

    onUpdateQuotas([...classQuotas, newQuota]);
    setNewClassName('');
    setNewCapacity(32);
    setNewHomeroom('');
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
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'announcements' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Pengumuman Kelulusan</span>
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
            onClick={() => setActiveTab('database_management')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'database_management' ? 'bg-amber-600 text-white shadow-sm font-semibold' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Database (Hapus & Backup)</span>
          </button>

          {currentUser?.role === 'super_admin' && (
            <button
              onClick={() => setActiveTab('account_settings')}
              className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'account_settings'
                  ? 'bg-amber-600 text-white shadow-sm font-bold ring-2 ring-amber-500/30'
                  : 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 font-semibold'
              }`}
            >
              <Lock className="w-4 h-4 text-amber-600" />
              <span>Pengaturan Hak Akses Akun (Super Admin)</span>
            </button>
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
            <SupabaseBadge variant="full" />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            </div>

            {/* Recent Applicants Quick List */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Pendaftar Terbaru</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b text-slate-600 font-bold">
                      <th className="p-3">No. Pendaftaran</th>
                      <th className="p-3">Nama Lengkap</th>
                      <th className="p-3">Sekolah Asal</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {students.slice(0, 5).map(s => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-emerald-800">{s.registrationNumber}</td>
                        <td className="p-3 font-semibold">{s.fullName}</td>
                        <td className="p-3 text-slate-600">{s.previousSchoolName}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-bold uppercase">
                            {s.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500">{s.createdAt.split('T')[0]}</td>
                      </tr>
                    ))}
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
              <div className="flex items-center gap-2">
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
                  <option value="draft">Draft</option>
                  <option value="verifying_payment">Verifikasi Pembayaran</option>
                  <option value="filling_form">Pengisian Formulir</option>
                  <option value="form_submitted">Formulir Terkirim</option>
                  <option value="scheduled_test">Menunggu Tes</option>
                  <option value="passed">Lulus</option>
                  <option value="class_assigned">Penempatan Kelas</option>
                </select>
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
                    <th className="p-3">Formulir</th>
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
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.formPaymentStatus === 'verified'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {s.formPaymentStatus}
                        </span>
                      </td>
                      <td className="p-3 font-bold font-mono text-slate-900">{s.finalScore || '-'}</td>
                      <td className="p-3 font-semibold text-blue-700">{s.assignedClassName || '-'}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setSelectedStudent(s)}
                          className="px-2.5 py-1 bg-slate-800 text-white rounded text-[10px] font-bold hover:bg-slate-700"
                        >
                          Detail Modal
                        </button>
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
          />
        )}

        {/* TAB 3C: RIWAYAT PEMBAYARAN TERPISAH (LAKI-LAKI & PEREMPUAN) */}
        {activeTab === 'payment_history' && (
          <AdminPaymentHistorySection />
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

        {/* TAB 5: PENGUMUMAN KELULUSAN */}
        {activeTab === 'announcements' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3">
              Penetapan Status Kelulusan (Lulus / Cadangan / Tidak Lulus)
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b font-bold text-slate-700">
                    <th className="p-3">No. Reg</th>
                    <th className="p-3">Nama Siswa</th>
                    <th className="p-3">Nilai Akhir</th>
                    <th className="p-3">Status Saat Ini</th>
                    <th className="p-3 text-center">Tentukan Keputusan</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-emerald-800">{s.registrationNumber}</td>
                      <td className="p-3 font-semibold">{s.fullName}</td>
                      <td className="p-3 font-bold font-mono text-slate-900">{s.finalScore ?? '-'}</td>
                      <td className="p-3 font-bold uppercase">{s.status.replace(/_/g, ' ')}</td>
                      <td className="p-3 text-center flex justify-center gap-1.5">
                        <button
                          onClick={() => handleSetDecision(s.id, 'passed')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[10px]"
                        >
                          LULUS
                        </button>
                        <button
                          onClick={() => handleSetDecision(s.id, 'passed_reserved')}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[10px]"
                        >
                          CADANGAN
                        </button>
                        <button
                          onClick={() => handleSetDecision(s.id, 'failed')}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-[10px]"
                        >
                          TIDAK LULUS
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: MANAJEMEN KUOTA KELAS */}
        {activeTab === 'quotas' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Manajemen Kuota Kelas (Rombel Kelas 7)</h3>
            </div>

            {/* Quota List Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {classQuotas.map(q => (
                <div key={q.id} className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
                  <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">{q.academicYear}</div>
                  <div className="text-xl font-extrabold text-slate-900">{q.className}</div>
                  <div className="text-xs text-slate-600">Wali Kelas: {q.homeroomTeacher}</div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span>Kuota Terisi:</span>
                      <span>{q.filled} / {q.capacity} murid</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
                        style={{ width: `${Math.min(100, (q.filled / q.capacity) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add New Class Form */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="font-bold text-sm text-slate-900">Tambah Rombongan Belajar (Kelas Baru)</h4>
              <form onSubmit={handleAddClassQuota} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <input
                  type="text"
                  required
                  placeholder="Nama Kelas (Contoh: 7 D)"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="p-2.5 rounded-xl border"
                />
                <input
                  type="number"
                  required
                  placeholder="Kuota (Contoh: 32)"
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(Number(e.target.value))}
                  className="p-2.5 rounded-xl border"
                />
                <input
                  type="text"
                  placeholder="Nama Wali Kelas"
                  value={newHomeroom}
                  onChange={(e) => setNewHomeroom(e.target.value)}
                  className="p-2.5 rounded-xl border"
                />
                <button type="submit" className="py-2.5 bg-emerald-600 text-white font-bold rounded-xl">
                  + Tambah Kelas
                </button>
              </form>
            </div>
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
          />
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
                Gunakan menu ini untuk membuat cadangan (backup) seluruh data sistem, memulihkan (restore) dari file arsip, membersihkan data pendaftar lama, atau melakukan reset pabrik.
              </p>
            </div>

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
        {selectedStudent && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 text-slate-900 relative shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setSelectedStudent(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-bold text-slate-900 border-b pb-2">
                Detail Calon Murid: {selectedStudent.fullName}
              </h3>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div><span className="font-semibold">No Reg:</span> {selectedStudent.registrationNumber}</div>
                <div><span className="font-semibold">NIK:</span> {selectedStudent.nik}</div>
                <div><span className="font-semibold">TTL:</span> {selectedStudent.birthPlace}, {selectedStudent.birthDate}</div>
                <div><span className="font-semibold">Sekolah Asal:</span> {selectedStudent.previousSchoolName}</div>
                <div><span className="font-semibold">Ayah:</span> {selectedStudent.fatherName} ({selectedStudent.fatherPhone})</div>
                <div><span className="font-semibold">Ibu:</span> {selectedStudent.motherName}</div>
                <div><span className="font-semibold">Nilai Final:</span> {selectedStudent.finalScore || '-'}</div>
                <div><span className="font-semibold">Status:</span> {selectedStudent.status}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
