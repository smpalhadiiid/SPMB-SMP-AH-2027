import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchUjianSupabase,
  saveJawabanPesertaSupabase,
  saveAllJawabanPesertaSupabase,
  saveHasilUjianSupabase,
  fetchHasilUjianSupabase,
} from '../services/cbtSupabaseService';
import { StudentData, SchoolInfo, CostBreakdown, UserAccount, ExamQuestion, TestSchedule } from '../types';
import { PaymentRepository } from '../repositories/PaymentRepository';
import { ExamQuestionRepository } from '../repositories/ExamQuestionRepository';
import { generateRegistrationPDF, generateExamCardPDF, generateExamResultPDF, generatePaymentReceiptPDF } from '../utils/pdfGenerator';
import {
  canDownloadStudentForm,
  canStudentDownloadDocuments,
  isStudentDataVerified,
  canStudentDownloadExamCard,
  hasUploadedPaymentProof,
} from '../utils/formEligibility';
import { safeConfetti } from '../utils/confettiHelper';
import { getStudentCredentials, fetchStudentCredentialsFromSupabase } from '../utils/studentCredentials';
import { getStoredQuestionBank, getStoredTestSchedules, getStoredFormPayments, saveFormPayments, getStoredBamPayments, saveBamPayments } from '../utils/storage';
import {
  CheckCircle2, Clock, AlertCircle, Download, Upload, CreditCard,
  FileText, GraduationCap, Award, Calendar, MapPin, User, Phone,
  School, HelpCircle, Check, ArrowRight, ShieldCheck, Sparkles, Image as ImageIcon,
  ChevronRight, RefreshCw, Send, Lock, Play, Timer, FileQuestion, BarChart,
  ChevronLeft, Flag, SendHorizontal, X, AlertTriangle, Eye, ZoomIn, ZoomOut, RotateCw, Save
} from 'lucide-react';
import {
  validateProofFile,
  formatFileSize,
  uploadPaymentProofToStorage,
  cleanupOrphanStorageProof,
  downloadPaymentProof,
  downloadPaymentProofFile,
  getPaymentProofSignedUrl,
  isPdfProof,
} from '../utils/paymentProofStorage';
import {
  BAM_CONFIG,
  BAM_BREAKDOWN_ITEMS,
  BAM_INSTALLMENT_STEPS,
  getStudentCategory,
  getTotalBamCost,
  calculateBamRemaining,
} from '../utils/bamPricing';

interface StudentDashboardProps {
  currentUser: UserAccount;
  studentData: StudentData;
  schoolInfo: SchoolInfo;
  costBreakdowns: CostBreakdown[];
  testSchedules?: TestSchedule[];
  onUpdateStudentData: (updated: StudentData) => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  currentUser,
  studentData,
  schoolInfo,
  costBreakdowns,
  testSchedules: propsTestSchedules,
  onUpdateStudentData,
  activeTab: externalTab,
  onTabChange,
}) => {
  const [internalTab, setInternalTab] = useState<'timeline' | 'form' | 'payment_form' | 'test_schedule' | 'payment_initial' | 'result' | 'class'>('timeline');
  const activeTab = (externalTab as any) || internalTab;
  const setActiveTab = (tab: any) => {
    setInternalTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  // Schedules (Synced live with Supabase CBT Ujian)
  const { data: supabaseUjianList = [] } = useQuery({
    queryKey: ['cbt_ujian'],
    queryFn: fetchUjianSupabase,
    refetchInterval: 10000, // 10s auto sync between Admin and Student
  });

  const baseSchedulesList = propsTestSchedules || getStoredTestSchedules();

  const schedulesList: TestSchedule[] =
    supabaseUjianList.length > 0
      ? supabaseUjianList.map((u) => ({
          id: u.id,
          waveName: u.gelombang || 'Gelombang 1',
          testDate: u.tanggal,
          testTime: u.jamMulai ? `${u.jamMulai} WIB` : '08:00 - 11:30 WIB',
          durationMinutes: u.durasiMinutes || 90,
          location: 'Portal Ujian Online SPMB / Lab Komputer SMP Al-Hadiid',
          notes: 'Harap mempersiapkan perangkat & koneksi internet yang stabil.',
          isOnlineActive: u.status === 'aktif',
        }))
      : baseSchedulesList;

  const activeOnlineSchedule = schedulesList.find((s) => s.isOnlineActive === true);
  const hasActiveOnlineSchedule = schedulesList.some((s) => s.isOnlineActive === true) || studentData.isTestActive === true;

  // Local Form States
  const [fullName, setFullName] = useState(studentData?.fullName || currentUser?.name || '');
  const [phone, setPhone] = useState(studentData?.phone || currentUser?.phone || '');
  const [nik, setNik] = useState(studentData.nik || '');
  const [nisn, setNisn] = useState(studentData.nisn || '');
  const [birthPlace, setBirthPlace] = useState(studentData.birthPlace || '');
  const [birthDate, setBirthDate] = useState(studentData.birthDate || '2013-01-01');
  const [gender, setGender] = useState<'Laki-laki' | 'Perempuan'>(studentData.gender || 'Laki-laki');
  const [religion, setReligion] = useState(studentData.religion || 'Islam');
  const [childOrder, setChildOrder] = useState(studentData.childOrder || '1');
  const [totalSiblings, setTotalSiblings] = useState(studentData.totalSiblings || '1');
  const [address, setAddress] = useState(studentData.address || '');
  const [village, setVillage] = useState(studentData.village || '');
  const [subdistrict, setSubdistrict] = useState(studentData.subdistrict || 'Cileungsi');
  const [city, setCity] = useState(studentData.city || 'Kabupaten Bogor');
  const [province, setProvince] = useState(studentData.province || 'Jawa Barat');

  const [previousSchoolName, setPreviousSchoolName] = useState(studentData.previousSchoolName || '');
  const [previousSchoolNpsn, setPreviousSchoolNpsn] = useState(studentData.previousSchoolNpsn || '');

  const [fatherName, setFatherName] = useState(studentData.fatherName || '');
  const [fatherBirthPlace, setFatherBirthPlace] = useState(studentData.fatherBirthPlace || '');
  const [fatherBirthDate, setFatherBirthDate] = useState(studentData.fatherBirthDate || '');
  const [fatherJob, setFatherJob] = useState(studentData.fatherJob || '');
  const [fatherEducation, setFatherEducation] = useState(studentData.fatherEducation || 'S1');
  const [fatherPhone, setFatherPhone] = useState(studentData.fatherPhone || '');

  const [motherName, setMotherName] = useState(studentData.motherName || '');
  const [motherBirthPlace, setMotherBirthPlace] = useState(studentData.motherBirthPlace || '');
  const [motherBirthDate, setMotherBirthDate] = useState(studentData.motherBirthDate || '');
  const [motherJob, setMotherJob] = useState(studentData.motherJob || '');
  const [motherPhone, setMotherPhone] = useState(studentData.motherPhone || '');

  // Proof URLs & BAM Payment details (Supabase Storage integration)
  const [formPaymentProof, setFormPaymentProof] = useState(studentData.formPaymentProofUrl || '');
  const [formProofFileObj, setFormProofFileObj] = useState<File | null>(null);
  const [isUploadingFormProof, setIsUploadingFormProof] = useState(false);
  const [formUploadSuccessMsg, setFormUploadSuccessMsg] = useState('');
  const [formProofMeta, setFormProofMeta] = useState<{
    fileName: string;
    fileSize: number;
    fileType: string;
    isCompressing: boolean;
  }>({
    fileName: studentData.formPaymentProofUrl ? 'bukti_transfer_formulir.jpg' : '',
    fileSize: 0,
    fileType: 'image/jpeg',
    isCompressing: false,
  });
  const [showFormImageModal, setShowFormImageModal] = useState(false);
  const [formZoomScale, setFormZoomScale] = useState(1);
  const [formRotate, setFormRotate] = useState(0);

  const [initialPaymentProof, setInitialPaymentProof] = useState(studentData.initialPaymentProofUrl || '');
  const [bamProofFileObj, setBamProofFileObj] = useState<File | null>(null);
  const [isUploadingBamProof, setIsUploadingBamProof] = useState(false);
  const [bamUploadSuccessMsg, setBamUploadSuccessMsg] = useState('');
  const [bamProofMeta, setBamProofMeta] = useState<{
    fileName: string;
    fileSize: number;
    fileType: string;
    isCompressing: boolean;
  }>({
    fileName: studentData.initialPaymentProofUrl ? 'bukti_transfer_bam.jpg' : '',
    fileSize: 0,
    fileType: 'image/jpeg',
    isCompressing: false,
  });
  const [initialPaymentDateInput, setInitialPaymentDateInput] = useState(studentData.initialPaymentDate || new Date().toISOString().split('T')[0]);
  const [initialPaymentAmountInput, setInitialPaymentAmountInput] = useState<number | string>(studentData.initialPaymentAmount || '');
  const [initialPaymentTypeInput, setInitialPaymentTypeInput] = useState<'Lunas' | 'Cicilan 1' | 'Cicilan 2' | 'Cicilan 3'>('Lunas');
  const [initialPaymentNotesInput, setInitialPaymentNotesInput] = useState(studentData.initialPaymentNotes || '');
  const [showBamImageModal, setShowBamImageModal] = useState(false);
  const [bamZoomScale, setBamZoomScale] = useState(1);
  const [bamRotate, setBamRotate] = useState(0);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(studentData.photoUrl || '');
  const [kkUrl, setKkUrl] = useState(studentData.kkUrl || '');
  const [birthCertUrl, setBirthCertUrl] = useState(studentData.birthCertUrl || '');

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Celebrate with confetti if Passed
  useEffect(() => {
    if (studentData.status === 'passed' || studentData.status === 'class_assigned' || studentData.status === 're_registered') {
      safeConfetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [studentData.status]);

  // Sinkronisasi Hasil Nilai Ujian Real-Time dari Supabase hasil_ujian
  useEffect(() => {
    let isMounted = true;
    async function syncExamResultsFromSupabase() {
      if (!studentData?.id) return;
      try {
        const results = await fetchHasilUjianSupabase(studentData.id);
        if (results && results.length > 0 && isMounted) {
          const latest = results[0];
          const hasScoreDiff =
            studentData.finalScore !== latest.nilaiTotal ||
            studentData.diagnosticScore !== latest.nilaiDiagnostik ||
            studentData.generalScore !== latest.nilaiTpu ||
            studentData.religiousScore !== latest.nilaiDiniyyah;

          if (hasScoreDiff) {
            const isLulus = latest.statusKelulusan === 'LULUS';
            const updated: StudentData = {
              ...studentData,
              diagnosticScore: latest.nilaiDiagnostik,
              generalScore: latest.nilaiTpu,
              religiousScore: latest.nilaiDiniyyah,
              finalScore: latest.nilaiTotal,
              testSubmitted: true,
              status: isLulus
                ? (studentData.status === 're_registration_paid' || studentData.status === 're_registered' || studentData.status === 'class_assigned' ? studentData.status : 'passed')
                : 'failed',
            };
            onUpdateStudentData(updated);
          }
        }
      } catch (err) {
        console.warn('Sync exam results from Supabase notice:', err);
      }
    }
    syncExamResultsFromSupabase();
  }, [studentData?.id]);

  // Lookup data pembayaran BAM yang telah diupload / diverifikasi oleh Admin
  const linkedBamRecord = useMemo(() => {
    const allBam = getStoredBamPayments();
    return allBam.find(
      b => b.studentId === studentData.id ||
           (studentData.registrationNumber && b.registrationNumber === studentData.registrationNumber) ||
           (studentData.fullName && b.studentName && b.studentName.toLowerCase() === studentData.fullName.toLowerCase())
    );
  }, [studentData]);

  const studentCategory = getStudentCategory(studentData);
  const hasCustomCost = Boolean(costBreakdowns && costBreakdowns.length > 0);
  const calculatedCustomTotal = hasCustomCost
    ? costBreakdowns.reduce((acc, curr) => {
        const val = (studentData.gender === 'Perempuan' && curr.amountAkhwat)
          ? curr.amountAkhwat
          : (curr.amountIkhwan || curr.amount || 0);
        return acc + Number(val);
      }, 0)
    : 0;

  const totalBamCost = linkedBamRecord?.totalBamCost || (hasCustomCost ? calculatedCustomTotal : getTotalBamCost(studentCategory));
  const currentPaidAmount = (linkedBamRecord && linkedBamRecord.amountPaid > 0)
    ? linkedBamRecord.amountPaid
    : (studentData.initialPaymentAmount || 0);
  const currentRemaining = linkedBamRecord?.remainingBalance !== undefined
    ? linkedBamRecord.remainingBalance
    : Math.max(0, totalBamCost - currentPaidAmount);
  const currentInstallmentType = linkedBamRecord?.installmentType || (currentPaidAmount >= totalBamCost ? 'Lunas' : (currentPaidAmount > 0 ? 'Cicilan 1' : 'Belum Bayar'));
  const currentNotes = linkedBamRecord?.notes || studentData.initialPaymentNotes || '';

  // Sinkronisasi data BAM ke input form
  useEffect(() => {
    if (studentData.initialPaymentDate) {
      setInitialPaymentDateInput(studentData.initialPaymentDate);
    }
    if (studentData.initialPaymentNotes) {
      setInitialPaymentNotesInput(studentData.initialPaymentNotes);
    }
    if (studentData.initialPaymentProofUrl) {
      setInitialPaymentProof(studentData.initialPaymentProofUrl);
    }
    if (currentRemaining > 0 && (!initialPaymentAmountInput || Number(initialPaymentAmountInput) === 0)) {
      setInitialPaymentAmountInput(currentRemaining.toString());
      setInitialPaymentTypeInput(currentRemaining < totalBamCost ? 'Cicilan 2' : 'Lunas');
    } else if (currentPaidAmount > 0 && (!initialPaymentAmountInput || Number(initialPaymentAmountInput) === 0)) {
      setInitialPaymentAmountInput(currentPaidAmount.toString());
    }
  }, [studentData.initialPaymentDate, studentData.initialPaymentNotes, studentData.initialPaymentProofUrl, currentRemaining, currentPaidAmount, totalBamCost]);

  // Online Exam Simulator State
  const [isTakingExam, setIsTakingExam] = useState(false);
  const [isExamLoading, setIsExamLoading] = useState(false);
  const [questionsList, setQuestionsList] = useState<ExamQuestion[]>(() => getStoredQuestionBank());
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [examAnswers, setExamAnswers] = useState<{ [qId: string]: number }>({});
  const [hesitantAnswers, setHesitantAnswers] = useState<{ [qId: string]: boolean }>({});
  const [examTimeLeft, setExamTimeLeft] = useState(5400); // 90 mins = 5400s
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Sinkronisasi Soal Dinamis dari Database Supabase & Realtime Multi-Device
  useEffect(() => {
    let isMounted = true;
    async function loadDynamicQuestions() {
      try {
        const questions = await ExamQuestionRepository.list();
        if (isMounted && questions && questions.length > 0) {
          setQuestionsList(questions);
        }
      } catch (err) {
        console.warn('Gagal memuat soal Supabase di StudentDashboard:', err);
      }
    }
    loadDynamicQuestions();

    const unsubscribe = ExamQuestionRepository.subscribe((updated) => {
      if (isMounted && updated && updated.length > 0) {
        setQuestionsList(updated);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let timer: any;
    if (isTakingExam && examTimeLeft > 0) {
      timer = setInterval(() => {
        setExamTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleAutoSubmitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isTakingExam, examTimeLeft]);

  const [showRetakeConfirmModal, setShowRetakeConfirmModal] = useState(false);

  // Muat kredensial akun terpusat dari Supabase saat dashboard murid terbuka
  useEffect(() => {
    fetchStudentCredentialsFromSupabase().catch(() => {});
  }, []);

  const handleDownloadExamCard = () => {
    if (!canDownloadExamCard) {
      alert(
        '🔒 KARTU PESERTA UJIAN BELUM DAPAT DIUNDUH!\n\nSilakan unggah foto bukti transfer pembayaran formulir terlebih dahulu pada menu "2. Bayar Formulir".\n\nSetelah bukti pembayaran diunggah, fitur Isi Data & Berkas serta Download Kartu Ujian akan langsung AKTIF.'
      );
      return;
    }
    try {
      const activeSched = schedulesList.find(s => s.isOnlineActive === true) || schedulesList[0];
      const storedCred = getStudentCredentials(studentData.id) || getStudentCredentials(studentData.registrationNumber) || getStudentCredentials(studentData.userEmail);
      const embeddedCred = (studentData.testAnswers as any)?._accountCredentials || (studentData.testAnswers as any)?._credentials;

      const candidateUsername = (
        studentData.username ||
        studentData.examUsername ||
        embeddedCred?.username ||
        storedCred?.username ||
        currentUser?.username ||
        (typeof window !== 'undefined' ? (
          localStorage.getItem(`spmb_user_${studentData.id}`) ||
          localStorage.getItem(`spmb_user_${studentData.registrationNumber}`) ||
          localStorage.getItem(`spmb_user_${studentData.userEmail?.toLowerCase()}`) ||
          ''
        ) : '') ||
        sessionStorage.getItem('spmb_last_student_username') ||
        (studentData.userEmail ? studentData.userEmail.split('@')[0] : '') ||
        studentData.registrationNumber ||
        'siswa'
      ).trim();

      const candidatePassword = (
        studentData.password ||
        studentData.examPassword ||
        embeddedCred?.password ||
        storedCred?.password ||
        currentUser?.password ||
        (typeof window !== 'undefined' ? (
          localStorage.getItem(`spmb_cred_${studentData.id}`) ||
          localStorage.getItem(`spmb_cred_${studentData.registrationNumber}`) ||
          localStorage.getItem(`spmb_cred_${studentData.userEmail?.toLowerCase()}`) ||
          localStorage.getItem(`spmb_cred_${candidateUsername.toLowerCase()}`) ||
          ''
        ) : '') ||
        sessionStorage.getItem('spmb_last_student_password') ||
        'siswa123'
      ).trim();

      const creds = {
        username: candidateUsername,
        password: candidatePassword,
      };
      generateExamCardPDF(studentData, schoolInfo, activeSched, creds);
    } catch (err: any) {
      console.error('Gagal mengunduh kartu ujian:', err);
      alert('Terjadi kendala saat mencetak kartu ujian: ' + (err?.message || 'Pastikan data valid'));
    }
  };

  const handleDownloadExamResult = () => {
    try {
      generateExamResultPDF(studentData, schoolInfo);
    } catch (err: any) {
      console.error('Gagal mengunduh hasil ujian:', err);
      alert('Terjadi kendala saat mencetak hasil ujian: ' + (err?.message || 'Pastikan data valid'));
    }
  };

  const handleTriggerRetakeExam = () => {
    setShowRetakeConfirmModal(true);
  };

  const handleConfirmRetakeExam = async () => {
    setIsExamLoading(true);
    let bank = questionsList;
    try {
      const fresh = await ExamQuestionRepository.list();
      if (fresh && fresh.length > 0) {
        bank = fresh;
        setQuestionsList(fresh);
      }
    } catch {
      bank = getStoredQuestionBank();
    } finally {
      setIsExamLoading(false);
    }

    if (!bank || bank.length === 0) {
      alert('Panitia belum mengunggah Soal Ujian. Mohon hubungi Panitia Admin.');
      return;
    }
    const activeSched = schedulesList.find(s => s.isOnlineActive === true) || schedulesList[0];
    const duration = activeSched?.durationMinutes || 90;

    const prevRecord = {
      date: new Date().toISOString(),
      diagnosticScore: studentData.diagnosticScore || 0,
      generalScore: studentData.generalScore || 0,
      religiousScore: studentData.religiousScore || 0,
      finalScore: studentData.finalScore || 0,
      status: studentData.status,
    };

    const updated: StudentData = {
      ...studentData,
      retestCount: (studentData.retestCount || 0) + 1,
      previousScores: [...(studentData.previousScores || []), prevRecord],
      testSubmitted: false,
      isTestActive: true,
      status: 'scheduled_test',
    };

    onUpdateStudentData(updated);
    setShowRetakeConfirmModal(false);

    setQuestionsList(bank);
    setCurrentQuestionIndex(0);
    setExamAnswers({});
    setHesitantAnswers({});
    setExamTimeLeft(duration * 60);
    setIsTakingExam(true);
  };

  const handleStartExam = async () => {
    setIsExamLoading(true);
    let bank = questionsList;
    try {
      const fresh = await ExamQuestionRepository.list();
      if (fresh && fresh.length > 0) {
        bank = fresh;
        setQuestionsList(fresh);
      }
    } catch {
      bank = getStoredQuestionBank();
    } finally {
      setIsExamLoading(false);
    }

    if (!bank || bank.length === 0) {
      alert('Panitia belum mengunggah Soal Ujian ke database Supabase. Mohon tunggu informasi dari Panitia Admin.');
      return;
    }
    const isExamActive = schedulesList.some(s => s.isOnlineActive === true) || studentData.isTestActive === true;
    if (!isExamActive) {
      alert('🔒 Fitur Ujian Online belum aktif. Mohon tunggu pengaktifan jadwal tes dari Panitia Admin.');
      return;
    }
    const activeSched = schedulesList.find(s => s.isOnlineActive === true) || schedulesList[0];
    const duration = activeSched?.durationMinutes || 90;

    setQuestionsList(bank);
    setCurrentQuestionIndex(0);
    setExamAnswers({});
    setHesitantAnswers({});
    setExamTimeLeft(duration * 60);
    setIsTakingExam(true);
  };

  const handleSelectOption = (qId: string, optionIdx: number) => {
    setExamAnswers(prev => ({ ...prev, [qId]: optionIdx }));
    // 3. Jawaban ujian calon murid langsung masuk ke database Supabase tabel jawaban_peserta
    const activeSched = schedulesList.find(s => s.isOnlineActive === true) || schedulesList[0];
    saveJawabanPesertaSupabase({
      ujianId: activeSched?.id,
      pesertaId: studentData.id,
      soalId: qId,
      jawabanIndex: optionIdx,
      isRaguRagu: Boolean(hesitantAnswers[qId]),
    }).catch(err => console.warn('saveJawabanPesertaSupabase real-time warning:', err));
  };

  const handleToggleHesitant = (qId: string) => {
    setHesitantAnswers(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  const handlePrevQuestion = () => {
    setCurrentQuestionIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextQuestion = () => {
    setCurrentQuestionIndex(prev => Math.min(questionsList.length - 1, prev + 1));
  };

  const handleAutoSubmitExam = () => {
    calculateAndSaveScores();
  };

  const handleSubmitExamClick = () => {
    setShowSubmitModal(true);
  };

  const calculateAndSaveScores = () => {
    const diagQs = questionsList.filter(q => q.category === 'diagnostik');
    const tpuQs = questionsList.filter(q => q.category === 'pengetahuan_umum');
    const diniQs = questionsList.filter(q => q.category === 'diniyyah');

    const calcCategoryScore = (qs: ExamQuestion[]) => {
      if (qs.length === 0) return 85;
      let earned = 0;
      let totalPoints = 0;
      qs.forEach(q => {
        totalPoints += q.points || 10;
        if (examAnswers[q.id] === q.correctOptionIndex) {
          earned += q.points || 10;
        }
      });
      return Math.round((earned / totalPoints) * 100);
    };

    const diagnosticScore = calcCategoryScore(diagQs);
    const generalScore = calcCategoryScore(tpuQs);
    const religiousScore = calcCategoryScore(diniQs);

    const finalScore = Math.round(
      (diagnosticScore * 0.3) + (generalScore * 0.4) + (religiousScore * 0.3)
    );

    const updatedStudent: StudentData = {
      ...studentData,
      diagnosticScore,
      generalScore,
      religiousScore,
      finalScore,
      isTestActive: false,
      testSubmitted: true,
      status: 'test_completed',
    };

    onUpdateStudentData(updatedStudent);
    setIsTakingExam(false);
    setShowSubmitModal(false);

    // 3. JAWABAN UJIAN CALON MURID LANGSUNG MASUK KE DATABASE SUPABASE KE TABLE jawaban_peserta
    const activeSched = schedulesList.find(s => s.isOnlineActive === true) || schedulesList[0];
    const ujianId = activeSched?.id;

    saveAllJawabanPesertaSupabase({
      ujianId,
      pesertaId: studentData.id,
      answers: examAnswers,
      questions: questionsList.map(q => ({
        id: q.id,
        correctOptionIndex: q.correctOptionIndex,
      })),
    }).catch(err => console.warn('saveAllJawabanPesertaSupabase error:', err));

    // 4. HASIL UJIAN CALON MURID LANGSUNG MASUK KE DATABASE SUPABASE KE TABLE hasil_ujian
    saveHasilUjianSupabase({
      id: `hasil_${ujianId || 'cbt'}_${studentData.id}`,
      ujianId: ujianId || '145eacad-ef02-4180-ba26-85b34d1649da',
      pesertaId: studentData.id,
      registrationNumber: studentData.registrationNumber || '',
      namaPeserta: studentData.fullName,
      nilaiDiagnostik: diagnosticScore,
      nilaiTpu: generalScore,
      nilaiDiniyyah: religiousScore,
      nilaiTotal: finalScore,
      statusKelulusan: finalScore >= 70 ? 'LULUS' : 'BELUM LULUS',
      tanggalUjian: new Date().toISOString().split('T')[0],
    }).catch(err => console.warn('saveHasilUjianSupabase error:', err));

    safeConfetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.5 }
    });

    // 5. SETELAH CALON MURID SELESAI MENGERJAKAN UJIAN, TAMPILKAN FITUR DOWNLOAD HASIL UJIAN
    setShowSuccessModal(true);
    alert('Terimakasih anda telah mengirimkan jawaban, semoga lulus\n\nJawaban & hasil ujian telah berhasil tersimpan di database Supabase.\nSilakan gunakan tombol "Download Hasil Ujian (PDF)" untuk mengunduh bukti perolehan nilai Anda.');
  };

  // Handle File Upload to Base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload & Validasi Bukti Transfer Formulir (Supabase Storage)
  const handleFormProofFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Validasi Keamanan Berkas: Maksimal 5 MB, Format: JPG, PNG, WEBP, PDF
    const val = validateProofFile(file);
    if (!val.valid) {
      alert(val.error);
      e.target.value = '';
      return;
    }

    setFormProofFileObj(file);
    const objectUrl = URL.createObjectURL(file);
    setFormPaymentProof(objectUrl);
    setFormProofMeta({
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'image/jpeg',
      isCompressing: false,
    });
    setFormUploadSuccessMsg('');
  };

  // Upload & Validasi Bukti Transfer BAM (Supabase Storage)
  const handleBamProofFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Validasi Keamanan Berkas: Maksimal 5 MB, Format: JPG, PNG, WEBP, PDF
    const val = validateProofFile(file);
    if (!val.valid) {
      alert(val.error);
      e.target.value = '';
      return;
    }

    setBamProofFileObj(file);
    const objectUrl = URL.createObjectURL(file);
    setInitialPaymentProof(objectUrl);
    setBamProofMeta({
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'image/jpeg',
      isCompressing: false,
    });
    setBamUploadSuccessMsg('');
  };

  // Handle Form Payment Upload (Tahap 3 - Supabase Storage & Database Transaction)
  const handleUploadFormPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProofFileObj && !formPaymentProof) {
      alert('Silakan pilih berkas bukti transfer terlebih dahulu.');
      return;
    }

    if (!studentData.id) {
      alert('Sesi siswa tidak valid. Silakan login kembali.');
      return;
    }

    setIsUploadingFormProof(true);
    setFormUploadSuccessMsg('');

    const regNo = studentData.registrationNumber || `SPMB202700${Math.floor(1000 + Math.random() * 9000)}`;
    const paymentId = `pay_form_${studentData.id}_${Date.now()}`;

    let storagePath = formPaymentProof;
    let fileName = formProofMeta.fileName || 'bukti_transfer_formulir.jpg';
    let fileType = formProofMeta.fileType || 'image/jpeg';
    let fileSize = formProofMeta.fileSize || 0;
    let uploadedAt = new Date().toISOString();

    // 1. Upload ke Supabase Storage (Bucket 'payment-proofs')
    if (formProofFileObj) {
      const uploadRes = await uploadPaymentProofToStorage(formProofFileObj, studentData.id, paymentId);
      if (!uploadRes.success || !uploadRes.metadata) {
        alert(uploadRes.error || 'Gagal mengunggah bukti transfer ke Supabase Storage.');
        setIsUploadingFormProof(false);
        return;
      }
      storagePath = uploadRes.metadata.storagePath;
      fileName = uploadRes.metadata.fileName;
      fileType = uploadRes.metadata.fileType;
      fileSize = uploadRes.metadata.fileSize;
      uploadedAt = uploadRes.metadata.uploadedAt;
    }

    // 2. Simpan referensi dan metadata ke database public.payments
    const { data: createdPayment, error: dbErr } = await PaymentRepository.create({
      id: paymentId,
      studentId: studentData.id,
      registrationNumber: regNo,
      studentName: studentData.fullName,
      gender: studentData.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki',
      paymentType: 'form',
      amount: studentData.formPaymentAmount || 200000,
      status: 'pending', // Upload bukti != verifikasi. Status awal wajib MENUNGGU VERIFIKASI
      proofUrl: storagePath,
      proofStoragePath: storagePath,
      proofFileName: fileName,
      proofFileType: fileType,
      proofFileSize: fileSize,
      proofUploadedAt: uploadedAt,
      paymentDate: new Date().toISOString().split('T')[0],
      notes: 'Upload Bukti Formulir Calon Murid (Menunggu Verifikasi Admin)',
    });

    if (dbErr) {
      // Transaction Safety: Cleanup file Storage yang gagal direferensikan
      if (formProofFileObj && storagePath) {
        await cleanupOrphanStorageProof(storagePath);
      }
      alert('Gagal menyimpan catatan bukti ke database Supabase: ' + dbErr.message);
      setIsUploadingFormProof(false);
      return;
    }

    // 3. Update status siswa (status pembayaran tetap MENUNGGU VERIFIKASI)
    const updated: StudentData = {
      ...studentData,
      registrationNumber: regNo,
      formPaymentProofUrl: storagePath,
      formPaymentDate: new Date().toISOString().split('T')[0],
      formPaymentStatus: 'pending', // MENUNGGU VERIFIKASI
      isFormVerified: false,
      isFormVerifiedByAdmin: false,
      formPaymentNotes: 'Bukti transfer terunggah. Menunggu verifikasi Panitia Admin.',
      status: studentData.status === 'pending_payment' || studentData.status === 'draft' || studentData.status === 'verifying_payment' ? 'filling_form' : studentData.status,
    };

    onUpdateStudentData(updated);

    // Sinkronkan ke form payments admin cache jika perlu
    try {
      const existingFormPayments = getStoredFormPayments();
      const updatedFormPayments = [
        {
          id: paymentId,
          transactionNumber: `TRX-FORM-${regNo.slice(-6)}`,
          paymentDate: new Date().toISOString().split('T')[0],
          studentId: studentData.id,
          studentName: studentData.fullName,
          registrationNumber: regNo,
          gender: (studentData.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki') as 'Laki-laki' | 'Perempuan',
          amount: studentData.formPaymentAmount || 200000,
          category: 'Internal' as const,
          proofUrl: storagePath,
          status: 'pending' as const,
          notes: 'Upload Bukti Formulir Calon Murid (Menunggu Verifikasi Admin)',
          createdAt: new Date().toISOString(),
        },
        ...existingFormPayments.filter(f => f.studentId !== studentData.id),
      ];
      saveFormPayments(updatedFormPayments);
    } catch (e) {
      console.warn('saveFormPayments sync error:', e);
    }

    setIsUploadingFormProof(false);
    setFormProofFileObj(null);
    setFormUploadSuccessMsg('✓ Bukti transfer berhasil disimpan.');

    safeConfetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.5 }
    });

    alert(
      '✓ Bukti transfer berhasil disimpan.\n\nStatus Pembayaran: MENUNGGU VERIFIKASI ⏳\nNomor Pendaftaran: ' +
        regNo +
        '\n\nBukti transfer telah tersimpan aman di Supabase Storage. Panitia Admin akan segera memeriksa dan memverifikasi pembayaran Anda.'
    );
    
    // Switch to form tab
    setActiveTab('form');
  };

  // Handle Complete Form Submission (Tahap 4 & 5)
  const handleSaveCompleteForm = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    setTimeout(() => {
      // Auto generate registration number if not exists
      const regNo = studentData.registrationNumber || `SPMB202700${Math.floor(1000 + Math.random() * 9000)}`;

      const updated: StudentData = {
        ...studentData,
        registrationNumber: regNo,
        fullName,
        phone,
        nik,
        nisn,
        birthPlace,
        birthDate: birthDate || '2013-01-01',
        gender,
        religion,
        childOrder,
        totalSiblings,
        address,
        village,
        subdistrict,
        city,
        province,
        previousSchoolName,
        previousSchoolNpsn,
        fatherName,
        fatherBirthPlace,
        fatherBirthDate: fatherBirthDate || undefined,
        fatherJob,
        fatherEducation,
        fatherPhone,
        motherName,
        motherBirthPlace,
        motherBirthDate: motherBirthDate || undefined,
        motherJob,
        motherPhone,
        photoUrl,
        kkUrl,
        birthCertUrl,
        status: studentData.status === 'filling_form' || studentData.status === 'verifying_payment' || studentData.status === 'pending_payment'
          ? 'form_submitted'
          : studentData.status,
      };

      onUpdateStudentData(updated);
      setIsSaving(false);
      setSaveMessage('Formulir data lengkap calon murid berhasil disimpan!');
      setTimeout(() => setSaveMessage(''), 3000);
    }, 600);
  };

  // Handle Re-registration Initial Payment Upload (Tahap 10 - Supabase Storage & Database Transaction)
  const handleUploadInitialPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bamProofFileObj && !initialPaymentProof) {
      alert('Silakan pilih berkas bukti transfer Biaya Awal Masuk (BAM) terlebih dahulu!');
      return;
    }

    if (!studentData.id) {
      alert('Sesi siswa tidak valid. Silakan login kembali.');
      return;
    }

    setIsUploadingBamProof(true);
    setBamUploadSuccessMsg('');

    const category = getStudentCategory(studentData);
    const totalCost = getTotalBamCost(category);
    const amountToSave = Number(initialPaymentAmountInput) || totalCost;
    const paymentId = `pay_bam_${studentData.id}_${Date.now()}`;

    let storagePath = initialPaymentProof;
    let fileName = bamProofMeta.fileName || 'bukti_transfer_bam.jpg';
    let fileType = bamProofMeta.fileType || 'image/jpeg';
    let fileSize = bamProofMeta.fileSize || 0;
    let uploadedAt = new Date().toISOString();

    // 1. Upload file ke Supabase Storage (Bucket 'payment-proofs')
    if (bamProofFileObj) {
      const uploadRes = await uploadPaymentProofToStorage(bamProofFileObj, studentData.id, paymentId);
      if (!uploadRes.success || !uploadRes.metadata) {
        alert(uploadRes.error || 'Gagal mengunggah bukti BAM ke Supabase Storage.');
        setIsUploadingBamProof(false);
        return;
      }
      storagePath = uploadRes.metadata.storagePath;
      fileName = uploadRes.metadata.fileName;
      fileType = uploadRes.metadata.fileType;
      fileSize = uploadRes.metadata.fileSize;
      uploadedAt = uploadRes.metadata.uploadedAt;
    }

    // 2. Simpan referensi dan metadata ke database Supabase public.payments
    const { error: dbErr } = await PaymentRepository.create({
      id: paymentId,
      studentId: studentData.id,
      studentName: studentData.fullName,
      registrationNumber: studentData.registrationNumber || 'REG-SPMB',
      gender: (studentData.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki'),
      paymentType: 'bam',
      amount: amountToSave,
      paymentDate: initialPaymentDateInput || new Date().toISOString().split('T')[0],
      proofUrl: storagePath,
      proofStoragePath: storagePath,
      proofFileName: fileName,
      proofFileType: fileType,
      proofFileSize: fileSize,
      proofUploadedAt: uploadedAt,
      status: 'pending', // Upload bukti != verifikasi. Status awal wajib MENUNGGU VERIFIKASI
      notes: `Skema: ${initialPaymentTypeInput}${initialPaymentNotesInput ? ` | ${initialPaymentNotesInput}` : ''}`,
    });

    if (dbErr) {
      // Transaction Safety: Cleanup file Storage yang gagal direferensikan
      if (bamProofFileObj && storagePath) {
        await cleanupOrphanStorageProof(storagePath);
      }
      alert('Gagal menyimpan catatan bukti BAM ke database Supabase: ' + dbErr.message);
      setIsUploadingBamProof(false);
      return;
    }

    // 3. Update status siswa
    const updated: StudentData = {
      ...studentData,
      initialPaymentProofUrl: storagePath,
      initialPaymentDate: initialPaymentDateInput || new Date().toISOString().split('T')[0],
      initialPaymentAmount: amountToSave,
      initialPaymentStatus: 'pending', // MENUNGGU VERIFIKASI
      initialPaymentNotes: `Skema: ${initialPaymentTypeInput}${initialPaymentNotesInput ? ` | ${initialPaymentNotesInput}` : ''}`,
      status: 're_registration_paid',
    };

    onUpdateStudentData(updated);

    try {
      const existingBamPayments = getStoredBamPayments();
      const updatedBamPayments = [
        {
          id: paymentId,
          transactionNumber: `TRX-BAM-${Date.now().toString().slice(-6)}`,
          paymentDate: initialPaymentDateInput || new Date().toISOString().split('T')[0],
          studentId: studentData.id,
          studentName: studentData.fullName,
          registrationNumber: studentData.registrationNumber || 'REG-SPMB',
          gender: (studentData.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki') as 'Laki-laki' | 'Perempuan',
          totalBamCost: totalCost,
          amountPaid: amountToSave,
          installmentType: initialPaymentTypeInput,
          totalPaidToDate: amountToSave,
          remainingBalance: calculateBamRemaining(totalCost, amountToSave),
          proofUrl: storagePath,
          status: 'pending' as const,
          notes: `Skema: ${initialPaymentTypeInput}${initialPaymentNotesInput ? ` | ${initialPaymentNotesInput}` : ''}`,
          createdAt: new Date().toISOString(),
        },
        ...existingBamPayments.filter(b => b.studentId !== studentData.id),
      ];
      saveBamPayments(updatedBamPayments);
    } catch (e) {
      console.warn('saveBamPayments sync error:', e);
    }

    setIsUploadingBamProof(false);
    setBamProofFileObj(null);
    setBamUploadSuccessMsg('✓ Bukti transfer berhasil disimpan.');

    safeConfetti({
      particleCount: 100,
      spread: 75,
      origin: { y: 0.5 }
    });

    alert('✓ Bukti transfer berhasil disimpan.\n\nStatus Pembayaran: MENUNGGU VERIFIKASI ⏳\nNominal: Rp ' + amountToSave.toLocaleString('id-ID') + '\n\nBukti transfer Biaya Awal Masuk telah tersimpan aman di Supabase Storage dan sedang menunggu pemeriksaan Panitia SPMB.');
  };

  // Check if student has completed & submitted the full form
  const isFormSubmitted =
    studentData.status === 'form_submitted' ||
    studentData.status === 'form_verified' ||
    studentData.status === 'scheduled_test' ||
    studentData.status === 'test_completed' ||
    studentData.status === 'passed' ||
    studentData.status === 'passed_reserved' ||
    studentData.status === 're_registration_paid' ||
    studentData.status === 're_registered' ||
    studentData.status === 'class_assigned' ||
    studentData.status === 'completed';

  // Check if Admin has verified the payment and form submission
  const isPaymentVerified =
    studentData.formPaymentStatus === 'verified' ||
    studentData.isFormVerified === true ||
    studentData.isFormVerifiedByAdmin === true ||
    studentData.status === 'form_verified' ||
    studentData.status === 'scheduled_test' ||
    studentData.status === 'test_completed' ||
    studentData.status === 'passed' ||
    studentData.status === 'passed_reserved' ||
    studentData.status === 're_registration_paid' ||
    studentData.status === 're_registered' ||
    studentData.status === 'class_assigned' ||
    studentData.status === 'completed';

  const isFormVerified = isStudentDataVerified(studentData);

  // Fitur download formulir aktif setelah data pembayaran & formulir diverifikasi oleh Panitia Admin
  const canDownloadPDF = canStudentDownloadDocuments(studentData);
  // Sesuai revisi: setelah calon murid mengupload bukti pembayaran fitur isi data & berkas aktif dan tampilkan fitur Download Kartu ujian
  const canDownloadExamCard = canStudentDownloadExamCard(studentData);

  // Calculate 12-Step Progress Statuses
  const steps = [
    { num: 1, title: 'Landing Page & Informasi', desc: 'Selesai membaca informasi SPMB', isDone: true },
    { num: 2, title: 'Registrasi & Login Akun', desc: 'Akun Calon Murid Aktif', isDone: true },
    {
      num: 3,
      title: 'Pembayaran Formulir (Rp200.000)',
      desc: studentData.formPaymentStatus === 'verified'
        ? 'Lunas & Diverifikasi ✓'
        : studentData.formPaymentProofUrl || studentData.formPaymentStatus === 'pending'
        ? 'Bukti Terunggah - Menunggu Verifikasi Admin ⏳'
        : 'Upload Bukti Transfer Formulir',
      isDone: studentData.formPaymentStatus === 'verified',
      isCurrent: !studentData.formPaymentStatus || studentData.formPaymentStatus === 'unpaid' || studentData.formPaymentStatus === 'pending',
    },
    {
      num: 4,
      title: 'Pengisian Formulir Lengkap',
      desc: isFormSubmitted
        ? 'Biodata Lengkap Terisi ✓'
        : (studentData.formPaymentProofUrl || studentData.formPaymentStatus === 'verified' || studentData.formPaymentStatus === 'pending')
        ? 'Siap Diisi (Aktif)'
        : '🔒 Terkunci (Upload Bukti Bayar Dulu)',
      isDone: isFormSubmitted,
      isCurrent: !isFormSubmitted && (!!studentData.formPaymentProofUrl || studentData.formPaymentStatus === 'verified' || studentData.formPaymentStatus === 'pending'),
    },
    {
      num: 5,
      title: 'Kirim & Terbitkan No Pendaftaran',
      desc: isFormSubmitted && studentData.registrationNumber ? `Nomor: ${studentData.registrationNumber}` : 'Otomatis Setelah Formulir Dikirim',
      isDone: isFormSubmitted && !!studentData.registrationNumber,
      isCurrent: !isFormSubmitted && (!!studentData.formPaymentProofUrl || studentData.formPaymentStatus === 'verified'),
    },
    {
      num: 6,
      title: 'Verifikasi Admin & Download Formulir',
      desc: canDownloadPDF
        ? 'Diverifikasi Admin - Siap Cetak Formulir & Kartu Ujian ✓'
        : isFormSubmitted
        ? 'Menunggu Verifikasi Pembayaran & Data oleh Admin ⏳'
        : '🔒 Terkunci (Isi & Kirim Formulir Dahulu)',
      isDone: canDownloadPDF,
      isCurrent: isFormSubmitted && !canDownloadPDF,
    },
    {
      num: 7,
      title: 'Tes Diagnostik & Akademik',
      desc: studentData.finalScore ? `Nilai: ${studentData.finalScore}` : 'Jadwal: Tes Diagnostik Awal',
      isDone: !!studentData.finalScore,
      isCurrent: isFormSubmitted && !studentData.finalScore,
    },
    {
      num: 8,
      title: 'Perhitungan Nilai Akhir',
      desc: studentData.finalScore ? `Skor Weighted: ${studentData.finalScore}` : 'Diagnostik(30%) TPU(40%) Diniyyah(30%)',
      isDone: !!studentData.finalScore,
    },
    {
      num: 9,
      title: 'Pengumuman Kelulusan',
      desc: studentData.status === 'passed' || studentData.status === 're_registration_paid' || studentData.status === 're_registered' || studentData.status === 'class_assigned'
        ? 'Dinyatakan LULUS ✓'
        : studentData.status === 'failed'
        ? 'Belum Lulus'
        : 'Menunggu Pengumuman',
      isDone: studentData.status === 'passed' || studentData.status === 're_registration_paid' || studentData.status === 're_registered' || studentData.status === 'class_assigned',
      isCurrent: !!studentData.finalScore && studentData.status === 'test_completed',
    },
    {
      num: 10,
      title: 'Pembayaran Biaya Awal Masuk',
      desc: studentData.initialPaymentStatus === 'verified'
        ? 'Daftar Ulang Lunas'
        : studentData.initialPaymentStatus === 'pending'
        ? 'Verifikasi Daftar Ulang'
        : 'Biaya Masuk (Ikhwan/Akhwat)',
      isDone: studentData.initialPaymentStatus === 'verified',
      isCurrent: studentData.status === 'passed' && studentData.initialPaymentStatus !== 'verified',
    },
    {
      num: 11,
      title: 'Penentuan Kuota Kelas',
      desc: 'Otomatis Mengurangi Kuota',
      isDone: studentData.initialPaymentStatus === 'verified',
    },
    {
      num: 12,
      title: 'Penempatan Kelas & Selesai',
      desc: studentData.assignedClassName ? `Kelas: ${studentData.assignedClassName}` : 'Menunggu Plotting',
      isDone: !!studentData.assignedClassName,
      isCurrent: studentData.initialPaymentStatus === 'verified' && !studentData.assignedClassName,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Student Welcome Header Card */}
        <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-slate-800">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-semibold mb-2 border border-blue-500/30">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Portal Calon Murid SPMB Online</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Selamat Datang, {studentData?.fullName || currentUser?.name || 'Calon Murid'}!
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                Nomor Registrasi: <span className="font-mono font-bold text-blue-400">{studentData.registrationNumber || 'Menunggu Pembayaran Formulir'}</span>
              </p>
            </div>

            {/* Status Badge */}
            <div className="bg-slate-800/90 backdrop-blur-md p-4 rounded-xl border border-slate-700 text-right">
              <div className="text-[11px] text-slate-400">Status Pendaftaran Saat Ini:</div>
              <div className="text-sm font-bold text-blue-400 uppercase tracking-wide mt-0.5">
                {studentData.status.replace(/_/g, ' ')}
              </div>
              {studentData.status === 'passed' && (
                <div className="text-xs text-amber-300 font-semibold mt-1">
                  🎉 Selamat! Dinyatakan LULUS
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dashboard Nav Tabs */}
        <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm text-xs font-bold">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'timeline' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>1. Timeline & Alur</span>
          </button>

          <button
            onClick={() => setActiveTab('payment_form')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'payment_form' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>2. Bayar Formulir</span>
            {studentData.formPaymentStatus === 'verified' || !!studentData.formPaymentProofUrl ? (
              <span className="ml-1 text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-bold">
                LUNAS ✓
              </span>
            ) : (
              <span className="ml-1 text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold">
                Rp200k
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('form')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'form' ? 'bg-blue-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:bg-slate-100 font-medium'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>3. Isi Data & Berkas</span>
            {studentData.formPaymentStatus === 'verified' || !!studentData.formPaymentProofUrl ? (
              <span className="ml-1 text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-bold">
                AKTIF
              </span>
            ) : (
              <span className="ml-1 text-[10px] bg-slate-400 text-white px-1.5 py-0.5 rounded font-bold">
                🔒 TERKUNCI
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('download_form')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'download_form' ? 'bg-blue-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:bg-slate-100 font-medium'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>4. Download Formulir</span>
            {canDownloadPDF ? (
              <span className="ml-1 text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-bold">
                PDF READY ✓
              </span>
            ) : (
              <span className="ml-1 text-[10px] bg-slate-400 text-white px-1.5 py-0.5 rounded font-bold">
                🔒 TERKUNCI
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('test_schedule')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'test_schedule' ? 'bg-indigo-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:bg-slate-100 font-medium'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>5. Jadwal Tes & Ujian</span>
            {studentData.isTestActive || hasActiveOnlineSchedule ? (
              <span className="ml-1 text-[10px] bg-purple-500 text-white px-1.5 py-0.5 rounded font-bold animate-pulse">
                AKTIF ✓
              </span>
            ) : (
              <span className="ml-1 text-[10px] bg-slate-400 text-white px-1.5 py-0.5 rounded font-bold">
                🔒 TERKUNCI
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('result')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'result' ? 'bg-blue-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:bg-slate-100 font-medium'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>6. Hasil Tes & Kelulusan</span>
            {studentData.status === 'passed' || studentData.status === 're_registration_paid' || studentData.status === 're_registered' || studentData.status === 'class_assigned' ? (
              <span className="ml-1 text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-bold">
                LULUS ✓
              </span>
            ) : studentData.status === 'failed' ? (
              <span className="ml-1 text-[10px] bg-rose-500 text-white px-1.5 py-0.5 rounded font-bold">
                TDK LULUS
              </span>
            ) : (
              <span className="ml-1 text-[10px] bg-slate-400 text-white px-1.5 py-0.5 rounded font-bold">
                🔒 TERKUNCI
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('payment_initial')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'payment_initial' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>7. Daftar Ulang & BAM</span>
            {studentData.initialPaymentStatus === 'verified' ? (
              <span className="ml-1 text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-bold">
                LUNAS ✓
              </span>
            ) : studentData.status === 'passed' ? (
              <span className="ml-1 text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold">
                BAYAR
              </span>
            ) : (
              <span className="ml-1 text-[10px] bg-slate-400 text-white px-1.5 py-0.5 rounded font-bold">
                🔒 TERKUNCI
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('class')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'class' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <School className="w-4 h-4" />
            <span>8. Penempatan Kelas</span>
            {studentData.assignedClassName || studentData.initialPaymentStatus === 'verified' ? (
              <span className="ml-1 text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-bold">
                RESMI ✓
              </span>
            ) : (
              <span className="ml-1 text-[10px] bg-slate-400 text-white px-1.5 py-0.5 rounded font-bold">
                🔒 TERKUNCI
              </span>
            )}
          </button>

          {/* Action Buttons: Download Kartu Ujian & Download Formulir */}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Download Kartu Ujian (Aktif setelah upload bukti bayar) */}
            <button
              onClick={handleDownloadExamCard}
              className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all text-xs font-bold cursor-pointer ${
                canDownloadExamCard
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md ring-2 ring-indigo-400/40'
                  : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
              }`}
              title={
                canDownloadExamCard
                  ? 'Download Kartu Tanda Peserta Ujian SPMB (PDF)'
                  : 'Upload bukti transfer pembayaran formulir terlebih dahulu untuk mengunduh Kartu Ujian'
              }
            >
              {canDownloadExamCard ? (
                <Download className="w-4 h-4 text-amber-300" />
              ) : (
                <Lock className="w-4 h-4 text-slate-400" />
              )}
              <span>
                {canDownloadExamCard
                  ? 'Download Kartu Ujian (PDF)'
                  : 'Kartu Ujian (Upload Bukti Bayar)'}
              </span>
            </button>

            {/* Download Registration PDF Button */}
            <button
              onClick={() => {
                if (canDownloadPDF) {
                  generateRegistrationPDF(studentData, schoolInfo);
                  return;
                }
                alert(
                  '🔒 FORMULIR PENDAFTARAN BELUM DAPAT DIUNDUH!\n\nStatus: Menunggu Verifikasi Panitia Admin.\n\nSesuai alur pendaftaran:\n1. Calon murid membuat akun\n2. Upload bukti pembayaran formulir\n3. Mengisi data calon murid\n4. Admin panitia memverifikasi data pembayaran & data calon murid\n5. Calon murid dapat mendownload formulir.\n\nSetelah akun & berkas Anda diverifikasi oleh Admin, tombol download akan langsung aktif.'
                );
              }}
              className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all text-xs font-bold cursor-pointer ${
                canDownloadPDF
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                  : 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
              }`}
              title={
                canDownloadPDF
                  ? 'Download / Cetak Bukti Pendaftaran PDF'
                  : 'Menunggu verifikasi pembayaran & data oleh Panitia Admin'
              }
            >
              {canDownloadPDF ? (
                <Download className="w-4 h-4 text-amber-300" />
              ) : (
                <Lock className="w-4 h-4 text-amber-600" />
              )}
              <span>
                {canDownloadPDF
                  ? 'Download Formulir (PDF)'
                  : 'Download Formulir (Terkunci)'}
              </span>
            </button>
          </div>
        </div>

        {/* TAB 1: 12-STEP TIMELINE */}
        {activeTab === 'timeline' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Progress Pendaftaran (Timeline 12 Tahap)</h3>
                <p className="text-xs text-slate-500">
                  Ikuti langkah demi langkah dari pendaftaran hingga penempatan kelas.
                </p>
              </div>
              <div className="text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                Tahap Selesai: {steps.filter(s => s.isDone).length} / 12
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {steps.map((step) => (
                <div
                  key={step.num}
                  className={`p-4 rounded-xl border transition-all ${
                    step.isDone
                      ? 'bg-blue-50/50 border-blue-200 text-slate-900'
                      : step.isCurrent
                      ? 'bg-yellow-50/80 border-yellow-300 ring-2 ring-yellow-400/40'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                      Tahap {step.num}
                    </span>
                    {step.isDone ? (
                      <span className="p-1 rounded-full bg-blue-600 text-white">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    ) : step.isCurrent ? (
                      <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-[10px] font-extrabold">
                        PROSES
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400">TERKUNCI</span>
                    )}
                  </div>
                  <div className="font-bold text-sm text-slate-900">{step.title}</div>
                  <div className="text-xs text-slate-600 mt-1">{step.desc}</div>
                </div>
              ))}
            </div>

            {/* Quick Action guidance alert */}
            {studentData.formPaymentStatus === 'unpaid' && (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-amber-900">
                  <span className="font-bold">Langkah 3: Pembayaran Formulir Pendaftaran (Rp200.000)</span>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Upload bukti transfer Rp 200.000 untuk mengaktifkan menu Pengisian Formulir Lengkap.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('payment_form')}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer"
                >
                  Bayar Formulir Now
                </button>
              </div>
            )}

            {studentData.formPaymentStatus === 'verified' && !isFormSubmitted && (
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-blue-900">
                  <span className="font-bold">Langkah 4 & 5: Pengisian & Pengiriman Formulir</span>
                  <p className="text-[11px] text-blue-800 mt-0.5">
                    Formulir pendaftaran telah <b>AKTIF</b>! Silakan isi biodata lengkap dan klik "Kirim & Selesaikan Formulir" untuk mengaktifkan fitur Download Formulir.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('form')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <FileText className="w-4 h-4" />
                  <span>Isi Formulir Lengkap Now</span>
                </button>
              </div>
            )}

            {isFormSubmitted && (
              canDownloadPDF ? (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-emerald-950">
                    <span className="font-bold flex items-center gap-1.5 text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Langkah 4 & 5: Formulir & Pembayaran Lunas & Diverifikasi Admin ✓</span>
                    </span>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      Nomor Pendaftaran: <b>{studentData.registrationNumber}</b>. Formulir pendaftaran resmi siap dicetak/didownload.
                    </p>
                  </div>
                  <button
                    onClick={() => generateRegistrationPDF(studentData, schoolInfo)}
                    className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs shrink-0 cursor-pointer flex items-center gap-2 shadow-sm"
                  >
                    <Download className="w-4 h-4 text-amber-300" />
                    <span>Download Formulir (PDF)</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-amber-950">
                    <span className="font-bold flex items-center gap-1.5 text-amber-800">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>Langkah 4: Formulir Terkirim - Menunggu Verifikasi Admin ⏳</span>
                    </span>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Panitia Admin sedang memverifikasi bukti transfer dan data calon murid Anda. Tombol download formulir & kartu ujian akan otomatis aktif setelah diverifikasi.
                    </p>
                  </div>
                  <div className="px-3 py-1.5 bg-amber-100 border border-amber-300 rounded-lg text-[11px] text-amber-900 font-bold flex items-center gap-1 shrink-0">
                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                    <span>Menunggu Verifikasi</span>
                  </div>
                </div>
              )
            )}

            {/* Quick Action: Download Kartu Peserta Ujian */}
            {canDownloadExamCard && (
              <div className="p-4 bg-indigo-50/80 rounded-xl border border-indigo-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-indigo-950">
                  <span className="font-bold flex items-center gap-1.5 text-indigo-800">
                    <Award className="w-4 h-4 text-indigo-600" />
                    <span>Kartu Peserta Ujian Seleksi / Tes CBT Siap Dicetak! ✓</span>
                  </span>
                  <p className="text-[11px] text-indigo-700 mt-0.5">
                    Kartu resmi berisi identitas calon murid, nomor peserta, jadwal pelaksanaan ujian, dan tata tertib tes seleksi.
                  </p>
                </div>
                <button
                  onClick={handleDownloadExamCard}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shrink-0 cursor-pointer flex items-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4 text-amber-300" />
                  <span>Download Kartu Ujian (PDF)</span>
                </button>
              </div>
            )}

            {/* Quick Action: Ujian Diulang (Remedial) jika dinyatakan Tidak Lulus */}
            {studentData.status === 'failed' && (
              <div className="p-4 bg-rose-50 rounded-xl border-2 border-rose-300 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                <div className="text-xs text-rose-950">
                  <span className="font-bold flex items-center gap-1.5 text-rose-800">
                    <RefreshCw className="w-4 h-4 text-rose-600 animate-spin-slow" />
                    <span>Fitur Ujian Diulang (Remedial) Terbuka!</span>
                  </span>
                  <p className="text-[11px] text-rose-800 mt-0.5">
                    Status saat ini Belum Lulus. Sekolah memberikan kesempatan untuk mengulang tes diagnostik secara online guna memperbaiki perolehan skor Anda.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={handleDownloadExamResult}
                    className="px-3.5 py-2 bg-white border border-rose-300 hover:bg-rose-100 text-rose-800 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Hasil Ujian (PDF)</span>
                  </button>
                  <button
                    onClick={handleTriggerRetakeExam}
                    className="px-4 py-2 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-md animate-pulse cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>🔄 Mulai Ujian Diulang</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Action: Download Hasil Ujian & Kelulusan jika tes selesai / lulus */}
            {(studentData.status === 'test_completed' || studentData.status === 'passed' || studentData.status === 're_registered' || studentData.status === 'class_assigned' || studentData.finalScore !== undefined) && studentData.status !== 'failed' && (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-emerald-950">
                  <span className="font-bold flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Langkah 8-9: Surat Hasil Tes & Keterangan Kelulusan Tersedia</span>
                  </span>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Unduh surat resmi hasil perolehan skor ujian diagnostik dan keputusan seleksi panitia SPMB.
                  </p>
                </div>
                <button
                  onClick={handleDownloadExamResult}
                  className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs shrink-0 cursor-pointer flex items-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4 text-amber-300" />
                  <span>Download Hasil Ujian (PDF)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TAHAP 3 - PEMBAYARAN FORMULIR */}
        {activeTab === 'payment_form' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-lg font-bold text-slate-900">Tahap 3: Pembayaran Formulir Pendaftaran</h3>
              <p className="text-xs text-slate-500">
                Biaya formulir sebesar <span className="font-bold text-emerald-700">Rp 200.000</span> untuk membuka akses formulir data lengkap.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Virtual Account / Bank Details */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                  <span>Rekening Resmi Pembayaran SPMB</span>
                </div>

                <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                  <div className="text-xs text-slate-500 font-semibold">Bank Tujuan:</div>
                  <div className="text-base font-bold text-emerald-800">{schoolInfo.bankName}</div>
                  <div className="text-xs text-slate-500 font-semibold pt-1">Nomor Rekening / Virtual Account:</div>
                  <div className="text-xl font-mono font-bold text-slate-900 tracking-widest bg-slate-100 p-2 rounded-lg">
                    {schoolInfo.bankAccountNumber}
                  </div>
                  <div className="text-xs text-slate-500">a.n. {schoolInfo.bankAccountName}</div>
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <div>1. Transfer tepat Rp 200.000 via ATM / M-Banking / Internet Banking.</div>
                  <div>2. Simpan struk / tangkapan layar bukti transfer.</div>
                  <div>3. Unggah bukti pada formulir di samping untuk diverifikasi Panitia.</div>
                </div>
              </div>

              {/* Upload Proof Box */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="text-sm font-bold text-slate-900">Upload Bukti Transfer Pembayaran Formulir</div>

                <form onSubmit={handleUploadFormPayment} className="space-y-4 text-xs">
                  {/* Rejection Alert Banner jika bukti ditolak oleh Admin */}
                  {(studentData.formPaymentStatus === 'rejected' || (studentData.formPaymentNotes && studentData.formPaymentNotes.includes('Ditolak'))) && (
                    <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 space-y-1 animate-in fade-in">
                      <div className="flex items-center gap-2 font-bold text-xs text-rose-900">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Bukti Pembayaran Ditolak oleh Panitia Admin</span>
                      </div>
                      <p className="text-[11px] text-rose-800">
                        <span className="font-semibold">Catatan / Alasan:</span>{' '}
                        <span className="italic">{studentData.formPaymentNotes || 'Bukti transfer tidak memenuhi syarat / buram.'}</span>
                      </p>
                      <p className="text-[10px] text-rose-600 pt-0.5">
                        Silakan pilih dan upload ulang foto/file bukti transfer yang jelas di bawah ini. Histori pendaftaran Anda tetap aman.
                      </p>
                    </div>
                  )}

                  {/* Success Upload Banner */}
                  {formUploadSuccessMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{formUploadSuccessMsg} (Status: MENUNGGU VERIFIKASI)</span>
                    </div>
                  )}

                  {/* File Upload Selector / Dropzone */}
                  <div className="space-y-2">
                    <label className="block font-semibold text-slate-700">
                      Pilih Berkas Bukti Transfer (Rp 200.000)
                    </label>
                    <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 transition-colors rounded-2xl p-4 bg-white text-center relative group cursor-pointer">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={handleFormProofFile}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                        disabled={isUploadingFormProof}
                      />
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                          {isUploadingFormProof ? (
                            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                          ) : (
                            <Upload className="w-5 h-5" />
                          )}
                        </div>
                        <div className="text-xs font-semibold text-slate-700">
                          {isUploadingFormProof ? 'Sedang Mengunggah Berkas ke Supabase Storage...' : 'Pilih File Bukti Transfer (JPG, PNG, WEBP, atau PDF)'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Maksimal 5 MB • Disimpan secara permanen & aman di Supabase Storage
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Image/PDF Preview & File Metadata Details */}
                  {formPaymentProof && (
                    <div className="p-3.5 bg-white rounded-xl border border-blue-200 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-800 border-b border-slate-100 pb-2">
                        <span className="flex items-center gap-1.5 text-blue-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Pratinjau Berkas Bukti Transfer:</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setFormPaymentProof('');
                            setFormProofFileObj(null);
                            setFormProofMeta({ fileName: '', fileSize: 0, fileType: 'image/jpeg', isCompressing: false });
                            setFormUploadSuccessMsg('');
                          }}
                          className="text-rose-600 hover:underline text-[10px] cursor-pointer"
                        >
                          Ganti File
                        </button>
                      </div>

                      {/* File Metadata Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg text-[10px] text-slate-600 font-medium">
                        <div className="truncate">
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">Nama File</span>
                          <span className="font-mono text-slate-800 truncate block">
                            {formProofMeta.fileName || 'bukti_transfer.jpg'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">Ukuran File</span>
                          <span className="font-bold text-blue-700">
                            {formatFileSize(formProofMeta.fileSize || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">Tipe File</span>
                          <span className="font-mono text-slate-800">
                            {formProofMeta.fileType || 'image/jpeg'}
                          </span>
                        </div>
                      </div>

                      {/* Preview Viewer (Image / PDF) */}
                      {isPdfProof(formPaymentProof, formProofMeta.fileType || formProofMeta.fileName) ? (
                        <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2">
                          <FileText className="w-12 h-12 text-rose-500 mx-auto" />
                          <div className="font-bold text-xs text-slate-800">
                            Dokumen PDF Bukti Transfer Siap Diupload
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {formProofMeta.fileName || 'dokumen_bukti.pdf'}
                          </div>
                        </div>
                      ) : (
                        <div className="max-h-52 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center p-1 relative group">
                          <img
                            src={formPaymentProof}
                            alt="Pratinjau Bukti Transfer"
                            className="max-h-48 object-contain rounded"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setShowFormImageModal(true)}
                              className="px-2.5 py-1 bg-white text-slate-900 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-600" />
                              <span>Perbesar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadPaymentProof(formPaymentProof, `Bukti_Formulir_${studentData.fullName || 'Siswa'}.jpg`)}
                              className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Unduh</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status Indicator Card */}
                  <div className={`p-4 rounded-xl border text-xs ${
                    studentData.formPaymentStatus === 'verified'
                      ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                      : studentData.formPaymentStatus === 'rejected'
                      ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                      : studentData.formPaymentProofUrl || !!formPaymentProof
                      ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                    <div className="font-semibold text-slate-700">Status Pembayaran Formulir:</div>
                    <div className="font-extrabold text-sm uppercase mt-0.5 flex items-center gap-1.5">
                      {studentData.formPaymentStatus === 'verified' ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="text-emerald-700">TERVERIFIKASI (LUNAS) ✓</span>
                        </>
                      ) : studentData.formPaymentStatus === 'rejected' ? (
                        <>
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                          <span className="text-rose-700">DITOLAK ✕ (Silakan Upload Ulang)</span>
                        </>
                      ) : studentData.formPaymentProofUrl ? (
                        <>
                          <Clock className="w-4 h-4 text-amber-600" />
                          <span className="text-amber-700">MENUNGGU VERIFIKASI ⏳</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-600">BELUM UPLOAD BUKTI</span>
                        </>
                      )}
                    </div>

                    {studentData.formPaymentStatus === 'verified' || !!studentData.formPaymentProofUrl ? (
                      <div className="space-y-3 mt-3 pt-3 border-t border-slate-200/80">
                        <div className="text-[11px] text-slate-700 font-medium">
                          {studentData.formPaymentStatus === 'verified'
                            ? '✓ Pembayaran formulir telah diverifikasi oleh Admin Panitia. Formulir pendaftaran resmi siap dicetak/didownload.'
                            : '⏳ Bukti transfer telah terunggah ke Supabase Storage. Panitia sedang memverifikasi bukti Anda. Anda dapat melanjutkan pengisian data formulir.'}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              generatePaymentReceiptPDF(
                                {
                                  id: `PAY-FORM-${studentData.registrationNumber || studentData.id}`,
                                  amount: schoolInfo.formFee || 200000,
                                  payment_type: 'formulir',
                                  payment_date: studentData.createdAt,
                                  payment_method: 'Transfer Bank Syariah Indonesia (BSI)',
                                  status: studentData.formPaymentStatus || 'verified',
                                  verified_by: 'Panitia Keuangan SPMB',
                                },
                                studentData,
                                schoolInfo
                              );
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-amber-300" />
                            <span>Download Kuitansi Bayar (PDF)</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadExamCard}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-amber-300" />
                            <span>Download Kartu Ujian (PDF)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab('form')}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Lanjut Isi Data & Berkas</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-800 mt-2">
                        Silakan unggah foto/scan bukti transfer dan klik tombol di bawah untuk mengirimkan bukti transfer ke database dan Panitia Admin.
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isUploadingFormProof}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-400 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs cursor-pointer active:scale-98"
                  >
                    {isUploadingFormProof ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Menyimpan Bukti ke Supabase Storage...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>Upload Bukti Transfer Formulir (Rp 200.000)</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TAHAP 4 - PENGISIAN FORMULIR LENGKAP */}
        {activeTab === 'form' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Tahap 4: Pengisian Formulir Biodata Lengkap</h3>
                <p className="text-xs text-slate-500">
                  Isi data calon murid, sekolah asal, data orang tua, dan unggah dokumen pendukung.
                </p>
              </div>
              {studentData.formPaymentStatus === 'verified' || !!studentData.formPaymentProofUrl ? (
                <div className="px-3 py-1 bg-blue-50 text-blue-800 text-xs rounded-lg border border-blue-200 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span>Formulir Aktif (Bukti Bayar Terunggah)</span>
                </div>
              ) : (
                <div className="px-3 py-1 bg-amber-50 text-amber-800 text-xs rounded-lg border border-amber-200 font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Belum Lunas - Terkunci</span>
                </div>
              )}
            </div>

            {!(studentData.formPaymentStatus === 'verified' || studentData.formPaymentStatus === 'pending' || !!studentData.formPaymentProofUrl || (studentData.status !== 'draft' && studentData.status !== 'pending_payment')) ? (
              <div className="bg-amber-50/80 border-2 border-amber-200 rounded-2xl p-8 text-center space-y-5 max-w-2xl mx-auto my-6 shadow-sm">
                <div className="w-16 h-16 bg-amber-100 border border-amber-300 text-amber-700 rounded-2xl flex items-center justify-center mx-auto text-3xl shadow-inner">
                  🔒
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl font-bold text-slate-900">Formulir Pendaftaran Belum Aktif</h4>
                  <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                    Untuk membuka dan mengisi <b>Formulir Biodata Lengkap Calon Murid</b>, Anda harus melakukan pembayaran formulir sebesar <b>Rp 200.000</b> dan mengunggah bukti pembayaran terlebih dahulu di menu Bayar Formulir.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab('payment_form')}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg hover:shadow-xl transition-all inline-flex items-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Upload Bukti Bayar Formulir (Rp 200.000) Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                {canDownloadPDF ? (
                  <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-5 sm:p-6 rounded-2xl border border-emerald-700/60 shadow-md space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Formulir Terkirim & Diverifikasi Admin ✓</span>
                        </div>
                        <h4 className="text-lg sm:text-xl font-extrabold text-white">
                          Formulir Pendaftaran Lunas & Diverifikasi
                        </h4>
                        <p className="text-xs text-emerald-100">
                          Nomor Pendaftaran Resmi: <b className="font-mono text-amber-300 text-sm">{studentData.registrationNumber}</b>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => generateRegistrationPDF(studentData, schoolInfo)}
                        className="px-5 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Formulir (PDF)</span>
                      </button>
                    </div>
                  </div>
                ) : isFormSubmitted ? (
                  <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-2xl border border-slate-700 shadow-md space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Formulir Terkirim - Menunggu Verifikasi Admin</span>
                        </div>
                        <h4 className="text-lg sm:text-xl font-extrabold text-white">
                          Formulir Pendaftaran Telah Dikirim
                        </h4>
                        <p className="text-xs text-slate-300">
                          Nomor Registrasi: <b className="font-mono text-amber-300 text-sm">{studentData.registrationNumber || 'Menunggu Verifikasi'}</b>. Panitia Admin sedang memverifikasi data pembayaran & isian formulir Anda.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          alert(
                            '🔒 FITUR DOWNLOAD FORMULIR MENUNGGU VERIFIKASI ADMIN!\n\nPanitia Admin sedang memeriksa data pembayaran & isian formulir Anda. Setelah Panitia Admin menyetujui verifikasi di Dashboard Admin, fitur Download Formulir PDF dan Nomor Pendaftaran Resmi akan AKTIF secara otomatis.'
                          )
                        }
                        className="px-5 py-3 bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Lock className="w-4 h-4 text-amber-400" />
                        <span>PDF: Menunggu Verifikasi Admin</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-xs text-amber-900">
                    <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Status Fitur Download Formulir: TERKUNCI 🔒</div>
                      <div className="text-[11px] text-amber-800 mt-0.5">
                        Lengkapi seluruh data pribadi, sekolah asal, data orang tua & dokumen di bawah, kemudian klik tombol <b>"Kirim & Selesaikan Formulir Pendaftaran"</b>. Setelah dikirim dan diverifikasi Panitia Admin, fitur download bukti PDF akan <b>AKTIF</b> secara otomatis.
                      </div>
                    </div>
                  </div>
                )}

                {saveMessage && (
                  <div className="p-3 bg-emerald-50 text-emerald-900 rounded-xl text-xs font-bold border border-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{saveMessage}</span>
                  </div>
                )}

                {/* Banner Download Kartu Ujian (Aktif Setelah Upload Bukti Pembayaran) */}
                {canDownloadExamCard && (
                  <div className="p-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl border border-indigo-700/60 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
                    <div className="space-y-1 text-left">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                        <Award className="w-3.5 h-3.5" />
                        <span>KARTU PESERTA UJIAN AKTIF ✓</span>
                      </div>
                      <h4 className="text-sm font-bold text-white">
                        Kartu Peserta Ujian / Tes Seleksi CBT Siap Diunduh
                      </h4>
                      <p className="text-[11px] text-indigo-200">
                        Bukti pembayaran Anda telah terunggah. Username & Password akun login ujian online telah tercantum dalam kartu ujian resmi.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadExamCard}
                      className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Kartu Ujian (PDF)</span>
                    </button>
                  </div>
                )}

            <form onSubmit={handleSaveCompleteForm} className="space-y-8 text-xs">
              {/* Data Pribadi */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-emerald-800 border-b border-emerald-100 pb-2">
                  1. Data Pribadi Calon Murid
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-semibold mb-1">Nama Lengkap *</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">NIK (Sesuai KK) *</label>
                    <input
                      type="text"
                      required
                      placeholder="16 digit NIK"
                      value={nik}
                      onChange={(e) => setNik(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">NISN (Opsional)</label>
                    <input
                      type="text"
                      placeholder="10 digit NISN"
                      value={nisn}
                      onChange={(e) => setNisn(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Tempat Lahir *</label>
                    <input
                      type="text"
                      required
                      value={birthPlace}
                      onChange={(e) => setBirthPlace(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Tanggal Lahir *</label>
                    <input
                      type="date"
                      required
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Jenis Kelamin *</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Agama *</label>
                    <input
                      type="text"
                      required
                      value={religion}
                      onChange={(e) => setReligion(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Anak Ke *</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: 1"
                      value={childOrder}
                      onChange={(e) => setChildOrder(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Jumlah Saudara *</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: 3"
                      value={totalSiblings}
                      onChange={(e) => setTotalSiblings(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-semibold mb-1">Alamat Lengkap *</label>
                    <input
                      type="text"
                      required
                      placeholder="Jalan, Perumahan, RT/RW"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Desa / Kelurahan *</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Cileungsi"
                      value={village}
                      onChange={(e) => setVillage(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Kecamatan *</label>
                    <input
                      type="text"
                      required
                      value={subdistrict}
                      onChange={(e) => setSubdistrict(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Kabupaten / Kota *</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Data Sekolah Asal */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-emerald-800 border-b border-emerald-100 pb-2">
                  2. Data Sekolah Asal (SD/MI)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-1">Nama Sekolah Asal *</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: SDIT Al-Hadiid / SDN Cileungsi 01"
                      value={previousSchoolName}
                      onChange={(e) => setPreviousSchoolName(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">NPSN Sekolah Asal (Opsional)</label>
                    <input
                      type="text"
                      placeholder="NPSN Sekolah"
                      value={previousSchoolNpsn}
                      onChange={(e) => setPreviousSchoolNpsn(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Data Orang Tua */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-emerald-800 border-b border-emerald-100 pb-2">
                  3. Data Orang Tua (Ayah & Ibu)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-semibold mb-1">Nama Ayah *</label>
                    <input
                      type="text"
                      required
                      value={fatherName}
                      onChange={(e) => setFatherName(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Tempat Lahir Ayah</label>
                    <input
                      type="text"
                      placeholder="Kota lahir Ayah"
                      value={fatherBirthPlace}
                      onChange={(e) => setFatherBirthPlace(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Tanggal Lahir Ayah</label>
                    <input
                      type="date"
                      value={fatherBirthDate}
                      onChange={(e) => setFatherBirthDate(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Pekerjaan Ayah</label>
                    <input
                      type="text"
                      value={fatherJob}
                      onChange={(e) => setFatherJob(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">No HP Ayah *</label>
                    <input
                      type="tel"
                      required
                      value={fatherPhone}
                      onChange={(e) => setFatherPhone(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="hidden lg:block"></div>
                  <div>
                    <label className="block font-semibold mb-1">Nama Ibu *</label>
                    <input
                      type="text"
                      required
                      value={motherName}
                      onChange={(e) => setMotherName(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Tempat Lahir Ibu</label>
                    <input
                      type="text"
                      placeholder="Kota lahir Ibu"
                      value={motherBirthPlace}
                      onChange={(e) => setMotherBirthPlace(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Tanggal Lahir Ibu</label>
                    <input
                      type="date"
                      value={motherBirthDate}
                      onChange={(e) => setMotherBirthDate(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Pekerjaan Ibu</label>
                    <input
                      type="text"
                      value={motherJob}
                      onChange={(e) => setMotherJob(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">No HP Ibu *</label>
                    <input
                      type="tel"
                      required
                      value={motherPhone}
                      onChange={(e) => setMotherPhone(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Upload Documents */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-blue-800 border-b border-blue-100 pb-2">
                  4. Upload Dokumen Pendukung Pendaftaran
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <label className="block font-semibold text-slate-700">Pas Foto 3x4 (Wajib)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, setPhotoUrl)}
                      className="text-[11px] block w-full text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    <input
                      type="text"
                      placeholder="Atau tempel Link Foto..."
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      className="w-full p-2 rounded-lg border text-xs"
                    />
                    {photoUrl && (
                      <div className="text-[10px] text-blue-600 font-semibold">✓ Pas Foto Terunggah</div>
                    )}
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <label className="block font-semibold text-slate-700">Kartu Keluarga / KK (Wajib)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, setKkUrl)}
                      className="text-[11px] block w-full text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    <input
                      type="text"
                      placeholder="Atau tempel Link KK..."
                      value={kkUrl}
                      onChange={(e) => setKkUrl(e.target.value)}
                      className="w-full p-2 rounded-lg border text-xs"
                    />
                    {kkUrl && (
                      <div className="text-[10px] text-blue-600 font-semibold">✓ Document KK Terunggah</div>
                    )}
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <label className="block font-semibold text-slate-700">Akta Kelahiran (Wajib)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, setBirthCertUrl)}
                      className="text-[11px] block w-full text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    <input
                      type="text"
                      placeholder="Atau tempel Link Akta..."
                      value={birthCertUrl}
                      onChange={(e) => setBirthCertUrl(e.target.value)}
                      className="w-full p-2 rounded-lg border text-xs"
                    />
                    {birthCertUrl && (
                      <div className="text-[10px] text-blue-600 font-semibold">✓ Akta Lahir Terunggah</div>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className={`w-full py-4 text-white font-extrabold rounded-xl shadow-lg transition-all text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer ${
                  isFormSubmitted
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                }`}
              >
                <Send className="w-4 h-4 text-amber-300" />
                <span>
                  {isSaving
                    ? 'Mengirim Formulir...'
                    : isFormSubmitted
                    ? 'Update & Kirim Ulang Formulir Pendaftaran'
                    : 'Kirim & Selesaikan Formulir Pendaftaran (Aktifkan Download PDF)'}
                </span>
              </button>
            </form>
          </>
        )}
      </div>
    )}

        {/* TAB 4: DOWNLOAD FORMULIR PENDAFTARAN RESMI */}
        {activeTab === 'download_form' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Download className="w-5 h-5 text-emerald-600" />
                  <span>Download / Cetak Bukti Pendaftaran Resmi</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Dokumen cetak bukti pendaftaran resmi SPMB SMP Al-Hadiid Cileungsi.
                </p>
              </div>
              {canDownloadPDF && (
                <button
                  onClick={() => generateRegistrationPDF(studentData, schoolInfo)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 shrink-0"
                >
                  <Download className="w-4 h-4 text-amber-300" />
                  <span>Download PDF Sekarang</span>
                </button>
              )}
            </div>

            {!canDownloadPDF ? (
              <div className="bg-amber-50/80 border-2 border-amber-200 rounded-2xl p-8 text-center space-y-5 max-w-2xl mx-auto my-6 shadow-sm">
                <div className="w-16 h-16 bg-amber-100 border border-amber-300 text-amber-700 rounded-2xl flex items-center justify-center mx-auto text-3xl shadow-inner">
                  🔒
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl font-bold text-slate-900">Fitur Download Formulir Terkunci</h4>
                  <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                    Fitur download formulir pendaftaran (PDF resmi 3 halaman) akan otomatis dibuka setelah data pembayaran formulir calon murid diverifikasi oleh Panitia Admin.
                  </p>
                </div>
                <div className="p-4 bg-slate-900 text-slate-200 rounded-xl text-xs text-left max-w-lg mx-auto space-y-2">
                  <div className="font-bold text-amber-300 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>Status Verifikasi & Pembayaran Formulir:</span>
                  </div>
                  <div className="text-slate-300 text-[11px] space-y-1">
                    <div>1. Status Pembayaran Formulir: <b className="text-white">{studentData.formPaymentStatus === 'verified' ? '✓ Lunas' : studentData.formPaymentProofUrl ? '⏳ Bukti Transfer Telah Diunggah' : '❌ Belum Bayar'}</b></div>
                    <div>2. Verifikasi Panitia Admin: <b className="text-amber-400">{isPaymentVerified ? '✓ Telah Diverifikasi' : '⏳ Menunggu Verifikasi Panitia Admin'}</b></div>
                    <div>3. Status Isian Biodata: <b className="text-white">{isFormSubmitted ? '✓ Formulir Terkirim' : '⏳ Belum Mengisi Lengkap'}</b></div>
                  </div>
                </div>
                {studentData.formPaymentStatus !== 'verified' && !studentData.formPaymentProofUrl && (
                  <button
                    onClick={() => setActiveTab('payment_form')}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer inline-flex items-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Bayar & Unggah Bukti Transfer Sekarang</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-6 max-w-3xl mx-auto">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="text-xs">
                      <div className="font-bold text-emerald-950 text-sm">Formulir Pendaftaran Terverifikasi Resmi ✓</div>
                      <div className="text-emerald-800">
                        Nomor Pendaftaran: <b className="font-mono text-emerald-900">{studentData.registrationNumber || 'SPMB-2027-001'}</b>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => generateRegistrationPDF(studentData, schoolInfo)}
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 shrink-0"
                  >
                    <Download className="w-4 h-4 text-amber-300" />
                    <span>Cetak / Download PDF</span>
                  </button>
                </div>

                {/* Registration Card Document Preview */}
                <div className="p-6 bg-slate-50 border-2 border-slate-200 rounded-2xl space-y-4 text-xs">
                  <div className="flex items-center justify-between border-b pb-3 border-slate-200">
                    <div className="font-extrabold text-slate-900 text-sm">KARTU TANDA BUKTI PENDAFTARAN SPMB</div>
                    <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 font-bold rounded-full text-[10px]">
                      TAHUN AJARAN 2027/2028
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-slate-500 font-medium block">Nomor Pendaftaran:</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">{studentData.registrationNumber || 'SPMB-2027-001'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium block">Nama Calon Murid:</span>
                      <span className="font-bold text-slate-900 text-sm">{studentData?.fullName || currentUser?.name || 'Calon Murid'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium block">NISN / NIK:</span>
                      <span className="font-bold text-slate-900">{studentData.nisn || '-'} / {studentData.nik || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium block">Sekolah Asal:</span>
                      <span className="font-bold text-slate-900">{studentData.previousSchool || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium block">Jalur Pendaftaran:</span>
                      <span className="font-bold text-slate-900">{studentData.entryPath || 'Reguler'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium block">Program Pilihan:</span>
                      <span className="font-bold text-slate-900">{studentData.selectedProgram || 'Fullday Regular'}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
                    <div>Status Pembayaran Formulir: <b className="text-emerald-700">LUNAS ✓</b></div>
                    <div>Verifikasi Admin: <b className="text-emerald-700">TERVERIFIKASI ✓</b></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: JADWAL TES & PORTAL SOAL UJIAN */}
        {activeTab === 'test_schedule' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-extrabold text-[11px] uppercase tracking-wider">
                    Portal Ujian Online SPMB
                  </span>
                  {studentData.isTestActive || hasActiveOnlineSchedule ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[11px] flex items-center gap-1 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      UJIAN AKTIF
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-extrabold text-[11px] flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-600" /> MENUNGGU PENGAKTIFAN ADMIN
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-black text-slate-900">Jadwal Tes Diagnostik & Portal Soal</h3>
                <p className="text-xs text-slate-500">
                  Berikut adalah informasi jadwal tes dari Panitia Admin. Ketika status tes diaktifkan oleh Admin, tombol Klik Soal akan terbuka.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Database Soal Supabase Terhubung ({questionsList.length} Soal Ujian Dinamis)
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {/* Download Kartu Ujian Button */}
                <button
                  onClick={handleDownloadExamCard}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-2 transition-all cursor-pointer ${
                    canDownloadExamCard
                      ? 'bg-white border border-slate-300 hover:bg-slate-50 text-slate-800'
                      : 'bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100'
                  }`}
                  title={
                    canDownloadExamCard
                      ? "Download Kartu Peserta Ujian SPMB (PDF)"
                      : "Menunggu verifikasi pembayaran & data oleh Panitia Admin"
                  }
                >
                  {canDownloadExamCard ? (
                    <Download className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Lock className="w-4 h-4 text-amber-600" />
                  )}
                  <span>{canDownloadExamCard ? 'Download Kartu Ujian (PDF)' : 'Kartu Ujian (Menunggu Verifikasi)'}</span>
                </button>

                {studentData.status === 'failed' ? (
                  <button
                    onClick={handleTriggerRetakeExam}
                    disabled={isExamLoading}
                    className="px-5 py-2.5 bg-gradient-to-r from-rose-600 via-indigo-600 to-purple-600 hover:from-rose-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer animate-pulse disabled:opacity-60"
                  >
                    <RefreshCw className={`w-4 h-4 ${isExamLoading ? 'animate-spin' : ''}`} />
                    <span>🔄 Ujian Diulang (Mulai Remedial)</span>
                  </button>
                ) : studentData.isTestActive || hasActiveOnlineSchedule ? (
                  studentData.status !== 'test_completed' && !studentData.testSubmitted ? (
                    <button
                      onClick={handleStartExam}
                      disabled={isExamLoading}
                      className="px-6 py-3 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xl hover:shadow-indigo-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer animate-pulse border border-indigo-400/30 disabled:opacity-60"
                    >
                      {isExamLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                          <span>Menyiapkan Soal Server...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current text-amber-300" />
                          <span>🚀 Klik Soal (Mulai Ujian Online)</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="px-4 py-2.5 bg-emerald-100 text-emerald-800 font-extrabold text-xs rounded-xl flex items-center gap-2 border border-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Ujian Telah Dikerjakan & Selesai</span>
                      </div>
                      <button
                        onClick={handleDownloadExamResult}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
                        title="Download Surat Keterangan Hasil Ujian SPMB (PDF)"
                      >
                        <Download className="w-4 h-4 text-amber-300" />
                        <span>Download Hasil Ujian (PDF)</span>
                      </button>
                    </div>
                  )
                ) : (
                  <button
                    disabled
                    className="px-5 py-2.5 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl flex items-center gap-2 cursor-not-allowed border border-slate-200"
                    title="Fitur Klik Soal akan aktif jika Jadwal Tes sudah dibuka oleh Panitia Admin"
                  >
                    <Lock className="w-4 h-4 text-slate-400" />
                    <span>Fitur Klik Soal (Terkunci - Menunggu Admin)</span>
                  </button>
                )}
              </div>
            </div>

            {!(studentData.isTestActive === true || hasActiveOnlineSchedule || studentData.status === 'scheduled_test' || studentData.status === 'test_completed' || studentData.status === 'passed' || studentData.status === 're_registered' || studentData.status === 'class_assigned') ? (
              <div className="bg-amber-50/80 border-2 border-amber-200 rounded-2xl p-8 text-center space-y-5 max-w-2xl mx-auto my-6 shadow-sm">
                <div className="w-16 h-16 bg-amber-100 border border-amber-300 text-amber-700 rounded-2xl flex items-center justify-center mx-auto text-3xl shadow-inner">
                  🔒
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl font-bold text-slate-900">Jadwal Tes & Fitur Ujian Terkunci</h4>
                  <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                    Panitia Admin akan mengaktifkan jadwal fitur tes ujian CBT online setelah memverifikasi data pembayaran formulir dan isian formulir pendaftaran Anda.
                  </p>
                </div>
                <div className="p-4 bg-slate-900 text-slate-200 rounded-xl text-xs text-left space-y-2 max-w-lg mx-auto">
                  <div className="font-bold text-amber-300 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>Status Persyaratan Akses Ujian:</span>
                  </div>
                  <div className="text-slate-300 text-[11px] space-y-1">
                    <div>1. Pembayaran Formulir: <b className="text-white">{studentData.formPaymentStatus === 'verified' ? '✓ Lunas (Diverifikasi)' : studentData.formPaymentProofUrl ? '⏳ Bukti Terunggah (Menunggu Verifikasi)' : '❌ Belum Bayar'}</b></div>
                    <div>2. Isian Formulir Lengkap: <b className="text-white">{isFormSubmitted ? '✓ Formulir Terkirim' : '❌ Belum Mengisi Formulir'}</b></div>
                    <div>3. Aktivasi Ujian oleh Panitia Admin: <b className="text-amber-400">🔒 Menunggu Aktivasi Panitia Admin</b></div>
                  </div>
                </div>
              </div>
            ) : (
              /* Schedule Cards Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {schedulesList.map((sched) => {
                  const isSchedActive = sched.isOnlineActive === true || studentData.isTestActive === true;
                  return (
                    <div
                      key={sched.id}
                      className={`p-6 rounded-2xl border transition-all ${
                        isSchedActive
                          ? 'bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white border-indigo-500/50 shadow-xl'
                          : 'bg-slate-50 text-slate-800 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                          isSchedActive ? 'bg-amber-400 text-slate-950' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {sched.waveName || 'Gelombang 1'}
                        </span>
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                          isSchedActive
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-slate-200 text-slate-600 border-slate-300'
                        }`}>
                          {isSchedActive ? '● AKSES TERBUKA' : '○ TERKUNCI (Menunggu Admin)'}
                        </span>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div className="flex items-center gap-2">
                          <Calendar className={`w-4 h-4 ${isSchedActive ? 'text-amber-400' : 'text-slate-500'}`} />
                          <span className="font-semibold">Tanggal Tes:</span>
                          <span className="font-bold">{sched.testDate || '15 April 2027'}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className={`w-4 h-4 ${isSchedActive ? 'text-amber-400' : 'text-slate-500'}`} />
                          <span className="font-semibold">Waktu Pelaksanaan:</span>
                          <span className="font-bold">{sched.testTime || '08:00 - 11:30 WIB'}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Timer className={`w-4 h-4 ${isSchedActive ? 'text-amber-400' : 'text-slate-500'}`} />
                          <span className="font-semibold">Durasi Pengerjaan:</span>
                          <span className="font-bold">{sched.durationMinutes || 90} Menit</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <MapPin className={`w-4 h-4 ${isSchedActive ? 'text-amber-400' : 'text-slate-500'}`} />
                          <span className="font-semibold">Lokasi / Sifat:</span>
                          <span className="font-bold">{sched.location || 'Portal Online & Gedung Utama'}</span>
                        </div>

                        {sched.notes && (
                          <div className={`p-3 rounded-xl border mt-3 text-[11px] ${
                            isSchedActive ? 'bg-indigo-900/50 border-indigo-700/50 text-indigo-200' : 'bg-white border-slate-200 text-slate-600'
                          }`}>
                            <span className="font-bold block mb-0.5">Catatan Panitia:</span>
                            {sched.notes}
                          </div>
                        )}
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-800/80">
                        {studentData.status === 'failed' ? (
                          <button
                            onClick={handleTriggerRetakeExam}
                            className="w-full py-3 bg-gradient-to-r from-rose-600 via-indigo-600 to-purple-600 hover:from-rose-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer animate-pulse"
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span>🔄 Klik Di Sini Untuk Ujian Diulang (Remedial)</span>
                          </button>
                        ) : studentData.status === 'test_completed' || studentData.testSubmitted ? (
                          <div className="p-3 bg-emerald-900/60 border border-emerald-500/50 rounded-xl text-center text-emerald-200 font-bold text-xs flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Anda Telah Menyelesaikan Ujian Ini</span>
                          </div>
                        ) : isSchedActive ? (
                          <button
                            onClick={handleStartExam}
                            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Play className="w-4 h-4 fill-current" />
                            <span>🚀 Klik Soal Ujian (Mulai Kerjakan)</span>
                          </button>
                        ) : (
                          <button
                            disabled
                            className="w-full py-3 bg-slate-200 text-slate-500 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-not-allowed border border-slate-300 opacity-80"
                          >
                            <Lock className="w-4 h-4 text-slate-400" />
                            <span>🔒 Fitur Klik Soal (Terkunci - Menunggu Jadwal Dibuka Admin)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: HASIL TES & PENGUMUMAN (TAHAP 7, 8, 9) */}
        {activeTab === 'result' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Tahap 7 - 9: Tes Diagnostik Online & Hasil Pengumuman</h3>
                <p className="text-xs text-slate-500">
                  Kerjakan tes online saat jadwal diaktifkan oleh Panitia Admin. Nilai dihitung otomatis berdasarkan Bank Soal SPMB.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {/* Download Hasil Ujian Button */}
                {(studentData.status === 'test_completed' || studentData.status === 'passed' || studentData.status === 'failed' || studentData.status === 're_registered' || studentData.status === 'class_assigned' || studentData.finalScore !== undefined) && (
                  <button
                    onClick={handleDownloadExamResult}
                    className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
                    title="Download Surat Keterangan Hasil Ujian SPMB (PDF)"
                  >
                    <Download className="w-4 h-4 text-amber-300" />
                    <span>Download Hasil Ujian (PDF)</span>
                  </button>
                )}

                {/* Download Kartu Ujian Button */}
                <button
                  onClick={handleDownloadExamCard}
                  className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 transition-all cursor-pointer"
                  title="Download Kartu Peserta Ujian SPMB (PDF)"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>Download Kartu Ujian (PDF)</span>
                </button>

                {/* Jika status Tidak Lulus, tampilkan tombol Ujian Diulang */}
                {!isTakingExam && studentData.status === 'failed' && (
                  <button
                    onClick={handleTriggerRetakeExam}
                    className="px-5 py-2.5 bg-gradient-to-r from-rose-600 via-indigo-600 to-purple-600 hover:from-rose-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer animate-pulse shrink-0"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>🔄 Ujian Diulang (Mulai Remedial)</span>
                  </button>
                )}

                {!isTakingExam && studentData.status !== 'test_completed' && studentData.status !== 'passed' && studentData.status !== 'failed' && (
                  <button
                    onClick={handleStartExam}
                    className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer animate-pulse shrink-0"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Klik Soal (Mulai Ujian Online)</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Score breakdown card */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="text-sm font-bold text-slate-900 flex items-center justify-between">
                  <span>Rincian Nilai Tes:</span>
                  <span className="text-xs font-normal text-emerald-700">Gelombang 1</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border flex justify-between items-center">
                    <div>
                      <div className="font-bold">Tes Diagnostik Awal</div>
                      <div className="text-slate-500 text-[11px]">Bobot 30%</div>
                    </div>
                    <div className="text-base font-bold text-emerald-700">
                      {studentData.diagnosticScore !== undefined ? studentData.diagnosticScore : '-'}
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border flex justify-between items-center">
                    <div>
                      <div className="font-bold">Tes Pengetahuan Umum (TPU)</div>
                      <div className="text-slate-500 text-[11px]">Bobot 40%</div>
                    </div>
                    <div className="text-base font-bold text-emerald-700">
                      {studentData.generalScore !== undefined ? studentData.generalScore : '-'}
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border flex justify-between items-center">
                    <div>
                      <div className="font-bold">Tes Diniyyah & Baca Al-Qur'an</div>
                      <div className="text-slate-500 text-[11px]">Bobot 30%</div>
                    </div>
                    <div className="text-base font-bold text-emerald-700">
                      {studentData.religiousScore !== undefined ? studentData.religiousScore : '-'}
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-900 text-white rounded-xl flex justify-between items-center">
                    <div>
                      <div className="font-bold text-xs uppercase tracking-wider text-emerald-200">Nilai Akhir Rata-Rata</div>
                      <div className="text-[10px] text-emerald-300">Dihitung Otomatis</div>
                    </div>
                    <div className="text-2xl font-black font-mono text-amber-300">
                      {studentData.finalScore !== undefined ? studentData.finalScore : 'Menunggu Tes'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Announcement Decision Banner */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
                <div>
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">
                    Keputusan Panitia SPMB:
                  </div>

                  {studentData.status === 'passed' || studentData.status === 're_registration_paid' || studentData.status === 're_registered' || studentData.status === 'class_assigned' ? (
                    <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-200 text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-emerald-600 text-white mx-auto flex items-center justify-center font-bold text-2xl shadow-sm">
                        🎉
                      </div>
                      <h4 className="text-xl font-black text-emerald-800">
                        SELAMAT! ANDA DINYATAKAN LULUS
                      </h4>
                      <p className="text-xs text-emerald-900 leading-relaxed">
                        Selamat bergabung dengan keluarga besar SMP Al-Hadiid Cileungsi. Silakan lakukan prosedur Daftar Ulang.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                        <button
                          onClick={() => setActiveTab('payment_initial')}
                          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>Lanjut Daftar Ulang Now</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleDownloadExamResult}
                          className="px-5 py-2.5 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-800 font-bold text-xs rounded-xl shadow-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Download className="w-4 h-4 text-emerald-600" />
                          <span>Unduh Hasil Kelulusan (PDF)</span>
                        </button>
                      </div>
                    </div>
                  ) : studentData.status === 'failed' ? (
                    <div className="bg-rose-50/90 p-6 rounded-2xl border-2 border-rose-300 text-center space-y-4 shadow-sm">
                      <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 text-rose-700 mx-auto flex items-center justify-center font-bold text-2xl shadow-inner">
                        ⚠️
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-rose-800">MOHON MAAF, BELUM LULUS SELEKSI</h4>
                        <p className="text-xs text-rose-700 mt-1 max-w-md mx-auto leading-relaxed">
                          Skor tes Anda belum mencapai kriteria batas minimal kelulusan. Pihak sekolah membuka <strong>Fitur Ujian Diulang (Remedial)</strong> agar calon murid berkesempatan memperbaiki nilai.
                        </p>
                      </div>

                      {/* Prominent Retake Card */}
                      <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm text-left space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin-slow" />
                            <span>Fitur Ujian Diulang (Remedial) Terbuka</span>
                          </span>
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                            {studentData.retestCount ? `Sudah Ujian Ulang: ${studentData.retestCount}x` : 'Ujian Ulang ke-1'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          Anda dapat mengerjakan kembali bank soal tes diagnostik, pengetahuan umum, dan diniyyah secara online. Skor baru akan langsung menggantikan skor sebelumnya dan dievaluasi kembali oleh Panitia SPMB.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          <button
                            onClick={handleTriggerRetakeExam}
                            className="flex-1 py-3 px-4 bg-gradient-to-r from-rose-600 via-indigo-600 to-purple-600 hover:from-rose-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span>🔄 Mulai Ujian Diulang Sekarang</span>
                          </button>
                          <button
                            onClick={handleDownloadExamResult}
                            className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 border border-slate-300 transition-all cursor-pointer"
                          >
                            <Download className="w-4 h-4 text-slate-600" />
                            <span>Download Hasil Ujian (PDF)</span>
                          </button>
                        </div>
                      </div>

                      {/* Previous Scores Log if student has retaken before */}
                      {studentData.previousScores && studentData.previousScores.length > 0 && (
                        <div className="p-3 bg-white/80 rounded-xl border border-rose-200 text-left text-xs">
                          <div className="font-bold text-slate-800 mb-1.5 text-[11px]">Riwayat Percobaan Ujian Sebelumnya:</div>
                          <div className="space-y-1 text-[10px] text-slate-600">
                            {studentData.previousScores.map((prev, idx) => (
                              <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
                                <span>Percobaan #{idx + 1} ({new Date(prev.date).toLocaleDateString('id-ID')})</span>
                                <span className="font-bold font-mono text-rose-700">Skor Akhir: {prev.finalScore}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-100 rounded-2xl border border-slate-200 text-center space-y-3">
                      <Clock className="w-8 h-8 text-amber-600 mx-auto" />
                      <div className="font-bold text-slate-800 text-sm">Menunggu Pelaksanaan / Hasil Sidang Kelulusan</div>
                      <div className="text-xs text-slate-500">
                        Jadwal Tes: {studentData.testScheduleDate || '15 April 2027 (08.00 WIB)'}
                      </div>
                      <div className="pt-2 flex justify-center">
                        <button
                          onClick={handleDownloadExamCard}
                          className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-sm inline-flex items-center gap-2 cursor-pointer"
                        >
                          <Download className="w-4 h-4 text-emerald-600" />
                          <span>Download Kartu Peserta Ujian (PDF)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: DAFTAR ULANG & PEMBAYARAN AWAL MASUK (TAHAP 10) */}
        {activeTab === 'payment_initial' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>Tahap 10: Pembayaran & Upload Bukti Transfer Biaya Awal Masuk (BAM)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lakukan pembayaran Biaya Awal Masuk (Daftar Ulang) & unggah foto bukti transfer untuk diverifikasi Panitia Admin.
                </p>
              </div>

              {/* Status Badge */}
              <div className="shrink-0">
                <span className={`px-3 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 border ${
                  studentData.initialPaymentStatus === 'verified'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : studentData.initialPaymentStatus === 'pending' || !!studentData.initialPaymentProofUrl
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}>
                  {studentData.initialPaymentStatus === 'verified' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>BAM LUNAS & VERIFIED ✓</span>
                    </>
                  ) : studentData.initialPaymentStatus === 'pending' || !!studentData.initialPaymentProofUrl ? (
                    <>
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>MENUNGGU VERIFIKASI ADMIN ⏳</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-slate-500" />
                      <span>BELUM BAYAR / UPLOAD</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {!(studentData.status === 'passed' || studentData.status === 're_registration_paid' || studentData.status === 're_registered' || studentData.status === 'class_assigned' || studentData.status === 'completed') ? (
              <div className="bg-amber-50/80 border-2 border-amber-200 rounded-2xl p-8 text-center space-y-5 max-w-2xl mx-auto my-6 shadow-sm">
                <div className="w-16 h-16 bg-amber-100 border border-amber-300 text-amber-700 rounded-2xl flex items-center justify-center mx-auto text-3xl shadow-inner">
                  🔒
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl font-bold text-slate-900">Fitur Upload Bukti Transfer BAM Terkunci</h4>
                  <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                    Fitur ini hanya dapat diakses oleh calon murid yang telah dinyatakan <b>LULUS</b> pada pengumuman hasil tes SPMB oleh Panitia Admin.
                  </p>
                </div>
                <div className="p-4 bg-slate-900 text-slate-200 rounded-xl text-xs text-left max-w-lg mx-auto space-y-1">
                  <div className="font-bold text-amber-300">Tahapan Sebelum Upload Bukti BAM:</div>
                  <div>1. Mengerjakan Ujian Online CBT SPMB</div>
                  <div>2. Menunggu Pengumuman Kelulusan Resmi dari Admin</div>
                  <div>3. Setelah Dinyatakan Lulus → Upload Bukti Pembayaran BAM di sini</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* COLUMN 1: COST ITEMIZATION & BANK DETAILS */}
                <div className="space-y-6">
                  {/* Bank Account Details Card */}
                  <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-6 rounded-2xl border border-slate-700 shadow-lg space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                      <div className="text-sm font-bold text-amber-300 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-amber-400" />
                        <span>Rekening Resmi Pembayaran BAM</span>
                      </div>
                      <span className="text-[10px] bg-amber-400/20 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-400/30">
                        SMP Al-Hadiid Cileungsi
                      </span>
                    </div>

                    <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                      <div className="text-[11px] text-slate-400 font-semibold">Bank Tujuan Transfer:</div>
                      <div className="text-lg font-extrabold text-emerald-400">{schoolInfo.bankName || 'Bank Syariah Indonesia (BSI)'}</div>
                      <div className="text-[11px] text-slate-400 font-semibold pt-1">Nomor Rekening / Virtual Account:</div>
                      <div className="flex items-center justify-between gap-2 bg-slate-900 p-2.5 rounded-lg border border-slate-700">
                        <span className="text-xl font-mono font-bold text-amber-300 tracking-wider">
                          {schoolInfo.bankAccountNumber || '7001234567'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(schoolInfo.bankAccountNumber || '7001234567');
                            setCopiedAccount(true);
                            setTimeout(() => setCopiedAccount(false), 3000);
                          }}
                          className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] rounded transition-all cursor-pointer"
                        >
                          {copiedAccount ? '✓ Tersalin' : 'Salin No. Rek'}
                        </button>
                      </div>
                      <div className="text-xs text-slate-300">a.n. <b>{schoolInfo.bankAccountName || 'YAYASAN AL-HADIID CILEUNGSI'}</b></div>
                    </div>

                    {schoolInfo.bamBrochureUrl && (
                      <div className="pt-1">
                        <a
                          href={schoolInfo.bamBrochureUrl}
                          download={schoolInfo.bamBrochureFileName || 'Rincian_Biaya_Awal_Masuk_BAM.pdf'}
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow cursor-pointer"
                        >
                          <Download className="w-4 h-4 text-amber-300" />
                          <span>Unduh Brosur PDF Rincian Biaya BAM Resmi</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Cost Itemization Breakdown */}
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                    {(() => {
                      const category = getStudentCategory(studentData);
                      const totalBam = getTotalBamCost(category);
                      const lunasDiscounted = category === 'Internal' ? BAM_CONFIG.totalInternalLunas : BAM_CONFIG.totalExternalLunas;

                      return (
                        <>
                          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div>
                              <div className="text-sm font-bold text-slate-900">Rincian Komponen Biaya Awal Masuk (BAM):</div>
                              <div className="text-[11px] text-slate-500">Sesuai Brosur & Kebijakan SPMB SMP Al-Hadiid</div>
                            </div>
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                              category === 'Internal'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              Kategori: {category === 'Internal' ? 'Al-Hadiid (Internal)' : 'Umum (Eksternal)'}
                            </span>
                          </div>

                          <div className="space-y-2 text-xs">
                            {BAM_BREAKDOWN_ITEMS.map((item) => {
                              const amount = category === 'Internal' ? item.amountInternal : item.amountExternal;
                              return (
                                <div key={item.id} className="p-3 bg-white rounded-xl border border-slate-200 flex justify-between items-center hover:border-slate-300 transition-colors">
                                  <div className="pr-2">
                                    <div className="font-bold text-slate-900">{item.name}</div>
                                    <div className="text-slate-500 text-[10px]">{item.notes} ({item.period})</div>
                                  </div>
                                  <div className="font-bold font-mono text-emerald-800 whitespace-nowrap ml-2">
                                    Rp {amount.toLocaleString('id-ID')}
                                  </div>
                                </div>
                              );
                            })}

                            {/* Total Banner */}
                            <div className="p-4 bg-slate-900 text-white rounded-xl flex justify-between items-center mt-3 shadow-sm">
                              <div>
                                <span className="font-bold uppercase text-xs block">Total Biaya Awal Masuk ({category}):</span>
                                <span className="text-[10px] text-slate-400">Belum termasuk potongan diskon lunas</span>
                              </div>
                              <span className="text-xl font-black font-mono text-amber-300">
                                Rp {totalBam.toLocaleString('id-ID')}
                              </span>
                            </div>

                            {/* Diskon Lunas Info Banner */}
                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-[11px] flex items-start gap-2">
                              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold">Potongan Khusus Pelunasan Sekaligus (100%):</span>
                                <p className="text-emerald-800 mt-0.5">
                                  Bagi calon santri yang melunasi BAM saat daftar ulang berhak mendapatkan potongan <span className="font-bold underline">Rp 500.000</span> sehingga total biaya menjadi <span className="font-bold font-mono">Rp {lunasDiscounted.toLocaleString('id-ID')}</span>.
                                </p>
                              </div>
                            </div>

                            {/* Jadwal Angsuran / Cicilan */}
                            <div className="pt-2">
                              <div className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Pilihan Skema Angsuran (Maks. 3 Tahap):</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {BAM_INSTALLMENT_STEPS.map((step) => {
                                  const stepAmount = category === 'Internal' ? step.amountInternal : step.amountExternal;
                                  return (
                                    <div key={step.step} className="p-2.5 bg-white rounded-xl border border-slate-200 text-[11px]">
                                      <div className="font-bold text-slate-800">{step.title}</div>
                                      <div className="font-mono font-bold text-indigo-600 mt-0.5">
                                        Rp {stepAmount.toLocaleString('id-ID')}
                                      </div>
                                      <div className="text-[10px] text-slate-400 mt-1">{step.dueDate}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* COLUMN 2: UPLOAD BUKTI TRANSFER BAM FORM */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-5">
                  <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                        <Upload className="w-4 h-4 text-emerald-600" />
                        <span>Form Upload Bukti Transfer BAM</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Unggah foto struk / tangkapan layar bukti transfer pembayaran Biaya Awal Masuk.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                      Maksimal 5 MB
                    </span>
                  </div>

                  <form onSubmit={handleUploadInitialPayment} className="space-y-4 text-xs">
                    {/* Rejection Alert Banner jika bukti BAM ditolak oleh Admin */}
                    {(studentData.initialPaymentStatus === 'rejected' || (studentData.initialPaymentNotes && studentData.initialPaymentNotes.includes('Ditolak'))) && (
                      <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 space-y-1 animate-in fade-in">
                        <div className="flex items-center gap-2 font-bold text-xs text-rose-900">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Bukti Transfer BAM Ditolak oleh Panitia Admin</span>
                        </div>
                        <p className="text-[11px] text-rose-800">
                          <span className="font-semibold">Alasan Penolakan:</span>{' '}
                          <span className="italic">{studentData.initialPaymentNotes || 'Bukti transfer tidak memenuhi syarat / buram.'}</span>
                        </p>
                        <p className="text-[10px] text-rose-600 pt-0.5">
                          Silakan pilih dan upload ulang foto/berkas bukti transfer BAM yang jelas di bawah ini.
                        </p>
                      </div>
                    )}

                    {/* Success Upload Banner */}
                    {bamUploadSuccessMsg && (
                      <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{bamUploadSuccessMsg} (Status: MENUNGGU VERIFIKASI)</span>
                      </div>
                    )}

                    {/* File Dropzone Selector */}
                    <div className="space-y-2">
                      <label className="block font-bold text-slate-800">
                        1. Pilih / Unggah Berkas Bukti Transfer BAM <span className="text-rose-500">*</span>
                      </label>
                      <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 transition-colors rounded-2xl p-5 bg-white text-center relative group cursor-pointer">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={handleBamProofFile}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                          disabled={isUploadingBamProof}
                        />
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
                            {isUploadingBamProof ? (
                              <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                            ) : (
                              <Upload className="w-6 h-6 animate-pulse" />
                            )}
                          </div>
                          <div className="text-xs font-bold text-slate-800">
                            {isUploadingBamProof ? 'Sedang Menyimpan Berkas ke Supabase Storage...' : 'Klik di sini untuk Memilih Berkas Bukti Transfer BAM'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Mendukung JPG, PNG, WEBP, atau PDF (Maks. 5 MB) • Disimpan Aman di Supabase Storage
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Image / PDF Preview Box */}
                    {initialPaymentProof && (
                      <div className="p-4 bg-white rounded-2xl border border-emerald-200 space-y-3 shadow-sm">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-emerald-100 pb-2">
                          <span className="flex items-center gap-1.5 text-emerald-700">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Pratinjau Berkas Bukti Transfer BAM:</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setInitialPaymentProof('');
                              setBamProofFileObj(null);
                              setBamProofMeta({ fileName: '', fileSize: 0, fileType: 'image/jpeg', isCompressing: false });
                              setBamUploadSuccessMsg('');
                            }}
                            className="text-rose-600 hover:underline text-[11px] font-bold cursor-pointer"
                          >
                            Ganti File
                          </button>
                        </div>

                        {/* File Metadata Info Badge */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-emerald-50/50 p-2.5 rounded-lg text-[10px] text-slate-600 font-medium">
                          <div className="truncate">
                            <span className="text-slate-400 block text-[9px] uppercase font-bold">Nama File</span>
                            <span className="font-mono text-emerald-900 truncate block">
                              {bamProofMeta.fileName || 'bukti_transfer_bam.jpg'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px] uppercase font-bold">Ukuran File</span>
                            <span className="font-bold text-emerald-700">
                              {formatFileSize(bamProofMeta.fileSize || 0)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px] uppercase font-bold">Tipe File</span>
                            <span className="font-mono text-slate-800">
                              {bamProofMeta.fileType || 'image/jpeg'}
                            </span>
                          </div>
                        </div>

                        {isPdfProof(initialPaymentProof, bamProofMeta.fileType || bamProofMeta.fileName) ? (
                          <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2">
                            <FileText className="w-12 h-12 text-rose-500 mx-auto" />
                            <div className="font-bold text-xs text-slate-800">
                              Dokumen PDF Bukti Transfer BAM Siap Diupload
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {bamProofMeta.fileName || 'dokumen_bukti_bam.pdf'}
                            </div>
                          </div>
                        ) : (
                          <div className="max-h-56 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center p-2 relative group">
                            <img
                              src={initialPaymentProof}
                              alt="Bukti Transfer BAM"
                              className="max-h-52 object-contain rounded-lg"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setShowBamImageModal(true)}
                                className="px-3 py-1.5 bg-slate-900 text-white font-bold text-[10px] rounded-lg shadow flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-amber-300" />
                                <span>Pratinjau Full</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadPaymentProof(initialPaymentProof, `Bukti_BAM_${studentData.fullName || 'Siswa'}.jpg`)}
                                className="px-3 py-1.5 bg-emerald-600 text-white font-bold text-[10px] rounded-lg shadow flex items-center gap-1 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Unduh</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Actions below preview */}
                        <div className="space-y-2 pt-1">
                          <button
                            type="submit"
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-98"
                          >
                            <Save className="w-4 h-4 text-emerald-200" />
                            <span>Simpan Data BAM yang Diupload</span>
                          </button>
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setShowBamImageModal(true)}
                              className="flex-1 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Perbesar Foto Bukti BAM</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadPaymentProof(initialPaymentProof, `Bukti_BAM_${studentData.fullName || 'Siswa'}.jpg`)}
                              className="flex-1 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Unduh File Bukti BAM</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Form Controls: Skema & Nominal & Tanggal */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          2. Skema Pembayaran
                        </label>
                        <select
                          value={initialPaymentTypeInput}
                          onChange={(e) => setInitialPaymentTypeInput(e.target.value as any)}
                          className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="Lunas">Lunas (100% Full)</option>
                          <option value="Cicilan 1">Cicilan Ke-1 (DP Awal)</option>
                          <option value="Cicilan 2">Cicilan Ke-2</option>
                          <option value="Cicilan 3">Cicilan Ke-3</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          3. Tanggal Transfer
                        </label>
                        <input
                          type="date"
                          value={initialPaymentDateInput}
                          onChange={(e) => setInitialPaymentDateInput(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block font-bold text-slate-700">
                            4. Nominal Transfer (Rp) <span className="text-rose-500">*</span>
                          </label>
                          {(() => {
                            const category = getStudentCategory(studentData);
                            return (
                              <span className="text-[10px] text-slate-500">
                                Target BAM: <span className="font-bold font-mono text-emerald-700">Rp {getTotalBamCost(category).toLocaleString('id-ID')}</span>
                              </span>
                            );
                          })()}
                        </div>
                        <input
                          type="number"
                          placeholder={(() => {
                            const category = getStudentCategory(studentData);
                            return `Contoh: ${category === 'Internal' ? '10500000 (Lunas) / 5000000 (Tahap 1)' : '11500000 (Lunas) / 6000000 (Tahap 1)'}`;
                          })()}
                          value={initialPaymentAmountInput}
                          onChange={(e) => setInitialPaymentAmountInput(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-emerald-300 bg-emerald-50/50 font-extrabold text-emerald-900 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      {/* Quick Nominal Presets */}
                      {(() => {
                        const category = getStudentCategory(studentData);
                        const lunasAmount = category === 'Internal' ? BAM_CONFIG.totalInternalLunas : BAM_CONFIG.totalExternalLunas;
                        const tahap1 = category === 'Internal' ? BAM_INSTALLMENT_STEPS[0].amountInternal : BAM_INSTALLMENT_STEPS[0].amountExternal;
                        const tahap2 = category === 'Internal' ? BAM_INSTALLMENT_STEPS[1].amountInternal : BAM_INSTALLMENT_STEPS[1].amountExternal;
                        const tahap3 = category === 'Internal' ? BAM_INSTALLMENT_STEPS[2].amountInternal : BAM_INSTALLMENT_STEPS[2].amountExternal;

                        return (
                          <div className="bg-slate-100/80 p-2.5 rounded-xl border border-slate-200">
                            <div className="text-[10px] font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                              <span>⚡ Pilih Cepat Nominal ({category}):</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setInitialPaymentAmountInput(lunasAmount.toString());
                                  setInitialPaymentTypeInput('Lunas');
                                }}
                                className="px-2 py-1.5 bg-white hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-800 transition-all text-center cursor-pointer shadow-xs"
                              >
                                <span className="block text-emerald-700">Lunas Langsung</span>
                                <span className="font-mono">Rp {(lunasAmount / 1000000).toFixed(1)} jt</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setInitialPaymentAmountInput(tahap1.toString());
                                  setInitialPaymentTypeInput('Cicilan 1');
                                }}
                                className="px-2 py-1.5 bg-white hover:bg-indigo-50 hover:border-indigo-300 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-800 transition-all text-center cursor-pointer shadow-xs"
                              >
                                <span className="block text-indigo-700">Tahap 1 (DP)</span>
                                <span className="font-mono">Rp {(tahap1 / 1000000).toFixed(1)} jt</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setInitialPaymentAmountInput(tahap2.toString());
                                  setInitialPaymentTypeInput('Cicilan 2');
                                }}
                                className="px-2 py-1.5 bg-white hover:bg-indigo-50 hover:border-indigo-300 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-800 transition-all text-center cursor-pointer shadow-xs"
                              >
                                <span className="block text-indigo-700">Tahap 2</span>
                                <span className="font-mono">Rp {(tahap2 / 1000000).toFixed(1)} jt</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setInitialPaymentAmountInput(tahap3.toString());
                                  setInitialPaymentTypeInput('Cicilan 3');
                                }}
                                className="px-2 py-1.5 bg-white hover:bg-indigo-50 hover:border-indigo-300 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-800 transition-all text-center cursor-pointer shadow-xs"
                              >
                                <span className="block text-indigo-700">Tahap 3</span>
                                <span className="font-mono">Rp {(tahap3 / 1000000).toFixed(1)} jt</span>
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          5. Catatan / Nama Pemilik Rekening
                        </label>
                        <input
                          type="text"
                          placeholder="Atas Nama Pemilik Rekening Pengirim"
                          value={initialPaymentNotesInput}
                          onChange={(e) => setInitialPaymentNotesInput(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* URL Option */}
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">
                        Atau Masukkan Link / URL Foto Bukti (Opsional):
                      </label>
                      <input
                        type="text"
                        placeholder="https://..."
                        value={initialPaymentProof}
                        onChange={(e) => setInitialPaymentProof(e.target.value)}
                        className="w-full p-2 rounded-xl border border-slate-300 bg-white"
                      />
                    </div>

                    {/* Quick Demo Struk Button */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setInitialPaymentProof('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=60')}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Gunakan Contoh Demo Struk Transfer BAM</span>
                      </button>
                    </div>

                    {/* Status Box */}
                    <div className="p-4 rounded-xl border text-xs bg-white shadow-inner space-y-1">
                      <div className="font-semibold text-slate-600">Status Verifikasi Bukti BAM:</div>
                      <div className="font-extrabold uppercase text-sm flex items-center gap-2">
                        {studentData.initialPaymentStatus === 'verified' ? (
                          <span className="text-emerald-700 font-extrabold">✅ LUNAS & TERDAFTAR RESMI MURID</span>
                        ) : studentData.initialPaymentStatus === 'pending' || !!studentData.initialPaymentProofUrl ? (
                          <span className="text-amber-700 font-extrabold">⏳ MENUNGGU VERIFIKASI ADMIN</span>
                        ) : (
                          <span className="text-rose-700 font-extrabold">❌ BELUM DIBAYAR</span>
                        )}
                      </div>
                      {studentData.initialPaymentStatus === 'verified' && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              generatePaymentReceiptPDF(
                                {
                                  id: `PAY-BAM-${studentData.registrationNumber || studentData.id}`,
                                  amount: studentData.initialPaymentAmount || 11000000,
                                  payment_type: 'daftar_ulang',
                                  payment_date: studentData.initialPaymentDate || new Date().toISOString(),
                                  payment_method: 'Transfer Bank Syariah Indonesia (BSI)',
                                  status: 'verified',
                                  verified_by: 'Panitia Keuangan SPMB',
                                },
                                studentData,
                                schoolInfo
                              );
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-amber-300" />
                            <span>Download Kuitansi Pembayaran BAM (PDF)</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Submit Button */}
                    <button
                      id="btn-save-student-bam-main"
                      type="submit"
                      disabled={isUploadingBamProof}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                      {isUploadingBamProof ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          <span>Menyimpan Bukti BAM ke Supabase Storage...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 text-emerald-200" />
                          <span>Upload Bukti Transfer BAM</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FULLSCREEN / ZOOM MODAL FOR FORM BUKTI TRANSFER PREVIEW */}
        {showFormImageModal && formPaymentProof && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-4 shadow-2xl border border-slate-200 space-y-3 animate-scale-up">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-600" />
                  <span>Pratinjau Bukti Pembayaran Formulir</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">
                    Tersimpan di Database
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowFormImageModal(false);
                    setFormZoomScale(1);
                    setFormRotate(0);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg text-lg font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Controls Toolbar */}
              <div className="flex items-center justify-between bg-slate-100 p-2 rounded-xl text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFormZoomScale(prev => Math.min(prev + 0.25, 2.5))}
                    className="p-1.5 bg-white hover:bg-slate-200 text-slate-800 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                    title="Perbesar (Zoom In)"
                  >
                    <ZoomIn className="w-4 h-4 text-blue-600" />
                    <span>Zoom In</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormZoomScale(prev => Math.max(prev - 0.25, 0.75))}
                    className="p-1.5 bg-white hover:bg-slate-200 text-slate-800 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                    title="Perkecil (Zoom Out)"
                  >
                    <ZoomOut className="w-4 h-4 text-blue-600" />
                    <span>Zoom Out</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormRotate(prev => (prev + 90) % 360)}
                    className="p-1.5 bg-white hover:bg-slate-200 text-slate-800 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                    title="Putar 90 Derajat"
                  >
                    <RotateCw className="w-4 h-4 text-blue-600" />
                    <span>Putar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormZoomScale(1);
                      setFormRotate(0);
                    }}
                    className="px-2 py-1.5 bg-white hover:bg-slate-200 text-slate-600 rounded-lg font-semibold text-[11px] cursor-pointer"
                  >
                    Reset
                  </button>
                </div>

                <div className="text-[11px] font-mono text-slate-500">
                  {Math.round(formZoomScale * 100)}%
                </div>
              </div>

              {/* Image Viewport */}
              <div className="max-h-[65vh] overflow-auto bg-slate-950 rounded-xl p-4 flex items-center justify-center">
                <div
                  style={{
                    transform: `scale(${formZoomScale}) rotate(${formRotate}deg)`,
                    transition: 'transform 0.2s ease-in-out',
                  }}
                  className="inline-block"
                >
                  <img
                    src={formPaymentProof}
                    alt="Bukti Transfer Formulir Full"
                    className="max-h-[60vh] max-w-full object-contain rounded"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                <span className="text-[11px] text-slate-500">
                  Nominal: <b>Rp 200.000</b> • Status: <b>{studentData.formPaymentStatus === 'verified' ? 'LUNAS' : 'MENUNGGU'}</b>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => downloadPaymentProof(formPaymentProof, `Bukti_Formulir_${studentData.fullName || 'Siswa'}.jpg`)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh File Bukti</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFormImageModal(false);
                      setFormZoomScale(1);
                      setFormRotate(0);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FULLSCREEN / ZOOM MODAL FOR BAM BUKTI TRANSFER PREVIEW */}
        {showBamImageModal && initialPaymentProof && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-4 shadow-2xl border border-slate-200 space-y-3 animate-scale-up">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-600" />
                  <span>Pratinjau Bukti Transfer Biaya Awal Masuk (BAM)</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                    Tersimpan di Database
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowBamImageModal(false);
                    setBamZoomScale(1);
                    setBamRotate(0);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg text-lg font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Controls Toolbar */}
              <div className="flex items-center justify-between bg-slate-100 p-2 rounded-xl text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBamZoomScale(prev => Math.min(prev + 0.25, 2.5))}
                    className="p-1.5 bg-white hover:bg-slate-200 text-slate-800 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                    title="Perbesar (Zoom In)"
                  >
                    <ZoomIn className="w-4 h-4 text-emerald-600" />
                    <span>Zoom In</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBamZoomScale(prev => Math.max(prev - 0.25, 0.75))}
                    className="p-1.5 bg-white hover:bg-slate-200 text-slate-800 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                    title="Perkecil (Zoom Out)"
                  >
                    <ZoomOut className="w-4 h-4 text-emerald-600" />
                    <span>Zoom Out</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBamRotate(prev => (prev + 90) % 360)}
                    className="p-1.5 bg-white hover:bg-slate-200 text-slate-800 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                    title="Putar 90 Derajat"
                  >
                    <RotateCw className="w-4 h-4 text-emerald-600" />
                    <span>Putar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBamZoomScale(1);
                      setBamRotate(0);
                    }}
                    className="px-2 py-1.5 bg-white hover:bg-slate-200 text-slate-600 rounded-lg font-semibold text-[11px] cursor-pointer"
                  >
                    Reset
                  </button>
                </div>

                <div className="text-[11px] font-mono text-slate-500">
                  {Math.round(bamZoomScale * 100)}%
                </div>
              </div>

              {/* Image Viewport */}
              <div className="max-h-[65vh] overflow-auto bg-slate-900 rounded-xl p-4 flex items-center justify-center">
                <div
                  style={{
                    transform: `scale(${bamZoomScale}) rotate(${bamRotate}deg)`,
                    transition: 'transform 0.2s ease-in-out',
                  }}
                  className="inline-block"
                >
                  <img
                    src={initialPaymentProof}
                    alt="Bukti Transfer BAM Preview"
                    className="max-h-[60vh] max-w-full object-contain rounded"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                <span className="text-[11px] text-slate-500">
                  {studentData.initialPaymentAmount ? `Nominal: Rp ${studentData.initialPaymentAmount.toLocaleString('id-ID')}` : ''}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => downloadPaymentProof(initialPaymentProof, `Bukti_BAM_${studentData.fullName || 'Siswa'}.jpg`)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh File Bukti</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowBamImageModal(false);
                      setBamZoomScale(1);
                      setBamRotate(0);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: PENEMPATAN KELAS (TAHAP 11 & 12) */}
        {activeTab === 'class' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-lg font-bold text-slate-900">Tahap 11 - 12: Penempatan Kelas & Informasi Masuk</h3>
              <p className="text-xs text-slate-500">
                Informasi pembagian kelas, wali kelas, hari pertama masuk sekolah, dan petunjuk MPLS.
              </p>
            </div>

            {!(studentData.initialPaymentStatus === 'verified' || studentData.status === 're_registered' || studentData.status === 'class_assigned' || studentData.status === 'completed') ? (
              <div className="bg-amber-50/80 border-2 border-amber-200 rounded-2xl p-8 text-center space-y-5 max-w-2xl mx-auto my-6 shadow-sm">
                <div className="w-16 h-16 bg-amber-100 border border-amber-300 text-amber-700 rounded-2xl flex items-center justify-center mx-auto text-3xl shadow-inner">
                  🔒
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl font-bold text-slate-900">Fitur Penempatan Kelas & Kuota Terkunci</h4>
                  <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                    Setelah calon murid melakukan pembayaran Biaya Awal Masuk (BAM) dan diverifikasi LUNAS oleh Panitia Admin, calon murid dinyatakan <b>RESMI SEBAGAI MURID</b> dan dimasukkan ke dalam kuota penempatan kelas.
                  </p>
                </div>
                <div className="p-4 bg-slate-900 text-slate-200 rounded-xl text-xs text-left max-w-lg mx-auto space-y-1">
                  <div className="font-bold text-amber-300">Status Pembayaran BAM Anda:</div>
                  <div>Status: <b>{studentData.initialPaymentStatus === 'pending' ? '⏳ Bukti BAM Terunggah (Menunggu Verifikasi Admin)' : '❌ Belum Melakukan Pembayaran BAM'}</b></div>
                </div>
              </div>
            ) : studentData.assignedClassName ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-emerald-900 text-white p-6 rounded-2xl space-y-4 shadow-xl">
                  <div className="text-xs text-emerald-300 font-bold uppercase tracking-wider">
                    Hasil Plotting Kelas Resmi:
                  </div>
                  <div className="text-3xl font-black text-amber-300">
                    KELAS {studentData.assignedClassName}
                  </div>
                  <div className="space-y-2 text-xs text-slate-200">
                    <div><span className="font-semibold">Wali Kelas:</span> {studentData.assignedHomeroomTeacher || 'Ustadz Ahmad Fauzi, S.Pd.I.'}</div>
                    <div><span className="font-semibold">Hari Pertama Masuk:</span> {studentData.firstDayDate || '12 Juli 2027'}</div>
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-3 text-xs">
                  <div className="font-bold text-slate-900 text-sm">Informasi Kegiatan MPLS:</div>
                  <p className="text-slate-600 leading-relaxed">
                    {studentData.mplsInfo || 'Siswa wajib hadir pukul 07:00 WIB mengenakan seragam sekolah asal, membawa perlengkapan alat tulis dan bekal makanan sehat.'}
                  </p>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-semibold">
                    ✓ Seluruh proses SPMB telah selesai. Selamat belajar di SMP Al-Hadiid Cileungsi!
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <School className="w-12 h-12 text-slate-400 mx-auto" />
                <div className="font-bold text-slate-800 text-base">Penempatan Kelas Sedang Diproses</div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Penempatan kelas ditentukan oleh Panitia setelah verifikasi bukti pembayaran awal masuk (Daftar Ulang) dinyatakan lunas.
                </p>
              </div>
            )}
          </div>
        )}

        {/* FULL-SCREEN INTERACTIVE DASHBOARD SOAL (EXAM WORKSPACE) */}
        {isTakingExam && questionsList.length > 0 && (() => {
          const currentQ = questionsList[currentQuestionIndex];
          const isHesitant = hesitantAnswers[currentQ?.id];
          const selectedOption = examAnswers[currentQ?.id];
          const answeredCount = Object.keys(examAnswers).length;
          const hesitantCount = Object.values(hesitantAnswers).filter(Boolean).length;

          const hours = Math.floor(examTimeLeft / 3600);
          const minutes = Math.floor((examTimeLeft % 3600) / 60);
          const seconds = examTimeLeft % 60;

          return (
            <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden animate-fade-in">
              {/* 1. TOP HEADER IDENTITAS SOAL & UJIAN */}
              <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg font-black text-white text-lg">
                    S
                  </div>
                  <div>
                    <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                      Ujian Online SPMB • SMP Al-Hadiid
                    </div>
                    <div className="text-sm font-extrabold text-white flex items-center gap-2">
                      <span>{fullName || studentData?.fullName || currentUser?.name || 'Calon Murid'}</span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-mono">
                        {studentData.registrationNumber || 'SPMB-2027-001'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* TIMER WAKTU PENGERJAAN */}
                <div className="px-4 py-2 bg-slate-950/90 border border-amber-500/40 rounded-xl flex items-center gap-2.5 text-amber-300 font-mono font-black text-sm sm:text-base shadow-inner">
                  <Timer className="w-5 h-5 text-amber-400 animate-pulse" />
                  <span className="text-xs text-slate-400 font-sans font-semibold">Sisa Waktu:</span>
                  <span>
                    {hours > 0 ? `${hours.toString().padStart(2, '0')}:` : ''}
                    {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
                  </span>
                </div>

                {/* KIRIM BUTTON HEADER */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Apakah Anda yakin ingin keluar dari pengerjaan ujian? Jawaban sementara tersimpan.')) {
                        setIsTakingExam(false);
                      }
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer hidden sm:block"
                  >
                    Keluar Ujian
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitExamClick}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg hover:shadow-emerald-500/30 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Send className="w-4 h-4 text-amber-300" />
                    <span>Kirim Jawaban</span>
                  </button>
                </div>
              </div>

              {/* 2. MAIN BODY (QUESTION & NAVIGATION MAP) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto w-full">
                
                {/* LEFT 2 COLS: QUESTION BOX */}
                <div className="lg:col-span-2 flex flex-col justify-between bg-slate-900/90 p-5 sm:p-7 rounded-2xl border border-slate-800 shadow-2xl space-y-6">
                  <div>
                    {/* Identitas Soal Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-indigo-600 text-white font-extrabold text-xs rounded-lg">
                          Soal No. {currentQuestionIndex + 1} dari {questionsList.length}
                        </span>
                        <span className="px-2.5 py-0.5 bg-slate-800 text-slate-300 text-[11px] font-bold uppercase rounded border border-slate-700">
                          {currentQ.category === 'diagnostik' ? 'Tes Diagnostik' : currentQ.category === 'pengetahuan_umum' ? 'Pengetahuan Umum (TPU)' : 'Diniyyah & Agama'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isHesitant && (
                          <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/50 font-black text-[11px] rounded-full flex items-center gap-1 animate-pulse">
                            <Flag className="w-3 h-3 text-amber-400" />
                            RAGU-RAGU
                          </span>
                        )}
                        <span className="text-xs text-indigo-300 font-bold bg-indigo-950/60 px-3 py-1 rounded-full border border-indigo-800/50">
                          Bobot: {currentQ.points || 10} Poin
                        </span>
                      </div>
                    </div>

                    {/* Question Text */}
                    <div className="py-5 text-base sm:text-lg font-bold text-slate-100 leading-relaxed">
                      {currentQ.questionText}
                    </div>

                    {/* Options Grid */}
                    <div className="space-y-3 pt-2">
                      {currentQ.options.map((option, optIdx) => {
                        const isSelected = selectedOption === optIdx;
                        const optionLabels = ['A', 'B', 'C', 'D'];
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => handleSelectOption(currentQ.id, optIdx)}
                            className={`w-full p-4 rounded-xl text-left text-xs sm:text-sm font-semibold flex items-center gap-3 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white border-2 border-indigo-400 shadow-xl ring-2 ring-indigo-400/30 translate-x-1'
                                : 'bg-slate-950/70 text-slate-200 border border-slate-800 hover:bg-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <span className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 transition-all ${
                              isSelected ? 'bg-white text-indigo-900 shadow' : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}>
                              {optionLabels[optIdx]}
                            </span>
                            <span className="flex-1 leading-snug">{option}</span>
                            {isSelected && (
                              <CheckCircle2 className="w-5 h-5 text-amber-300 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* RIGHT 1 COL: NAVIGASI PETA SOAL */}
                <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-2xl flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                      <div className="font-extrabold text-sm text-white flex items-center gap-2">
                        <FileQuestion className="w-4 h-4 text-indigo-400" />
                        <span>Peta Nomor Soal</span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-400">
                        {answeredCount}/{questionsList.length} Dijawab
                      </span>
                    </div>

                    {/* Legend */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-bold mb-4 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-1.5 text-emerald-400">
                        <span className="w-3 h-3 rounded bg-emerald-600 border border-emerald-400 inline-block"></span>
                        <span>Sudah Dijawab</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-amber-400">
                        <span className="w-3 h-3 rounded bg-amber-500 border border-amber-300 inline-block"></span>
                        <span>Ragu-Ragu ({hesitantCount})</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <span className="w-3 h-3 rounded bg-slate-800 border border-slate-700 inline-block"></span>
                        <span>Belum Dijawab</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-indigo-300">
                        <span className="w-3 h-3 rounded bg-indigo-600 ring-2 ring-indigo-400 inline-block"></span>
                        <span>Soal Aktif</span>
                      </div>
                    </div>

                    {/* Question Number Tiles Grid */}
                    <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-2 max-h-[38vh] overflow-y-auto pr-1">
                      {questionsList.map((q, idx) => {
                        const isCurrent = idx === currentQuestionIndex;
                        const isAns = examAnswers[q.id] !== undefined;
                        const isHes = hesitantAnswers[q.id] === true;

                        let tileStyle = 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700';
                        if (isHes) {
                          tileStyle = 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md';
                        } else if (isAns) {
                          tileStyle = 'bg-emerald-600 text-white font-bold border-emerald-400 shadow-sm';
                        }

                        if (isCurrent) {
                          tileStyle += ' ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-950 font-black scale-105 z-10';
                        }

                        return (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => setCurrentQuestionIndex(idx)}
                            className={`h-10 rounded-xl text-xs flex items-center justify-center transition-all cursor-pointer relative ${tileStyle}`}
                          >
                            <span>{idx + 1}</span>
                            {isHes && (
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-300 rounded-full border border-slate-950"></span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Summary Footer in Nav Panel */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
                    <div className="flex justify-between text-slate-400">
                      <span>Status Ujian:</span>
                      <span className="text-emerald-400 font-bold">Sedang Berlangsung</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Ragu-Ragu:</span>
                      <span className="text-amber-400 font-bold">{hesitantCount} Soal</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* 3. TOMBOL CONTROL DI BAGIAN BAWAH DASHBOARD SOAL */}
              <div className="bg-slate-900 border-t border-slate-800 p-4 shrink-0">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
                  
                  {/* LEFT: PREVIOUS & RAGU-RAGU */}
                  <div className="flex items-center gap-3">
                    {/* TOMBOL 1: SEBELUMNYA */}
                    <button
                      type="button"
                      onClick={handlePrevQuestion}
                      disabled={currentQuestionIndex === 0}
                      className={`px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                        currentQuestionIndex === 0
                          ? 'bg-slate-800 text-slate-600 border border-slate-800 cursor-not-allowed'
                          : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 cursor-pointer shadow-md'
                      }`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Sebelumnya</span>
                    </button>

                    {/* TOMBOL 2: RAGU-RAGU */}
                    <button
                      type="button"
                      onClick={() => handleToggleHesitant(currentQ.id)}
                      className={`px-5 py-3 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                        isHesitant
                          ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-amber-300 ring-2 ring-amber-400/30'
                          : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      <Flag className={`w-4 h-4 ${isHesitant ? 'fill-slate-950' : 'text-amber-400'}`} />
                      <span>{isHesitant ? '✓ Marked Ragu-Ragu' : 'Ragu-Ragu'}</span>
                    </button>
                  </div>

                  {/* RIGHT: SELANJUTNYA & KIRIM */}
                  <div className="flex items-center gap-3">
                    {/* TOMBOL 3: SELANJUTNYA */}
                    <button
                      type="button"
                      onClick={handleNextQuestion}
                      disabled={currentQuestionIndex === questionsList.length - 1}
                      className={`px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                        currentQuestionIndex === questionsList.length - 1
                          ? 'bg-slate-800 text-slate-600 border border-slate-800 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/30 cursor-pointer shadow-md'
                      }`}
                    >
                      <span>Selanjutnya</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    {/* TOMBOL KIRIM */}
                    <button
                      type="button"
                      onClick={handleSubmitExamClick}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg hover:shadow-emerald-500/30 flex items-center gap-2 transition-all cursor-pointer border border-emerald-400/30"
                    >
                      <Send className="w-4 h-4 text-amber-300" />
                      <span>Kirim Jawaban Ujian</span>
                    </button>
                  </div>

                </div>
              </div>

            </div>
          );
        })()}

        {/* MODAL KONFIRMASI KIRIM JAWABAN */}
        {showSubmitModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-indigo-500/50 text-white max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-5 animate-scale-up">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="p-3 bg-indigo-600/30 text-indigo-400 rounded-xl border border-indigo-500/30">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-white">Konfirmasi Kirim Jawaban Ujian</h4>
                  <p className="text-xs text-slate-400">Pastikan seluruh soal telah selesai diperiksa.</p>
                </div>
              </div>

              <div className="space-y-2 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Total Soal Ujian:</span>
                  <span className="font-bold text-white">{questionsList.length} Soal</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Sudah Dijawab:</span>
                  <span className="font-bold text-emerald-400">{Object.keys(examAnswers).length} Soal</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Ditandai Ragu-Ragu:</span>
                  <span className="font-bold text-amber-400">{Object.values(hesitantAnswers).filter(Boolean).length} Soal</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Belum Dijawab:</span>
                  <span className="font-bold text-rose-400">{questionsList.length - Object.keys(examAnswers).length} Soal</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Setelah tombol kirim diklik, jawaban ujian Anda akan disimpan secara permanen dan nilai akhir akan dihitung secara otomatis.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Batal & Periksa Lagi
                </button>
                <button
                  type="button"
                  onClick={calculateAndSaveScores}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Send className="w-4 h-4 text-amber-300" />
                  <span>Ya, Kirim Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL NOTIFIKASI SUKSES SETELAH KIRIM */}
        {showSuccessModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border-2 border-emerald-500 text-white max-w-md w-full rounded-2xl p-6 text-center space-y-5 shadow-2xl animate-scale-up">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/40">
                <Sparkles className="w-8 h-8 text-amber-300 animate-bounce" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black text-emerald-400">
                  Pengiriman Jawaban Berhasil!
                </h3>
                {/* REQUIRED EXACT NOTIFICATION TEXT */}
                <p className="text-base font-bold text-slate-100 bg-slate-950 p-4 rounded-xl border border-slate-800 leading-relaxed">
                  "Terimakasih anda telah mengirimkan jawaban, semoga lulus"
                </p>
              </div>

              <p className="text-xs text-slate-400">
                Nilai ujian Anda telah tersimpan dan dapat dilihat pada menu Hasil Tes & Pengumuman Kelulusan.
              </p>

              {/* 5. FITUR DOWNLOAD HASIL UJIAN */}
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadExamResult}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-emerald-400/30 ring-2 ring-emerald-400/40"
                >
                  <Download className="w-4 h-4 text-amber-300" />
                  <span>Download Hasil Ujian (PDF)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSuccessModal(false);
                    setActiveTab('result');
                  }}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Lihat Hasil & Rekap Nilai Ujian</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL KONFIRMASI UJIAN DIULANG (REMEDIAL) */}
        {showRetakeConfirmModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border-2 border-indigo-500 text-white max-w-md w-full rounded-2xl p-6 space-y-5 shadow-2xl animate-scale-up">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 text-indigo-400 mx-auto flex items-center justify-center border border-indigo-500/40">
                <RefreshCw className="w-8 h-8 text-amber-300 animate-spin-slow" />
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-indigo-300">
                  Konfirmasi Ujian Diulang (Remedial)
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Anda akan memulai sesi Ujian Diulang SPMB. Nilai ujian sebelumnya akan diarsipkan ke riwayat, dan skor baru akan dihitung kembali setelah Anda menyelesaikan tes ini.
                </p>
              </div>

              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 text-xs space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Calon Murid:</span>
                  <span className="font-bold text-slate-200">{studentData.fullName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Nomor Registrasi:</span>
                  <span className="font-mono font-bold text-amber-400">{studentData.registrationNumber || '-'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Status Saat Ini:</span>
                  <span className="font-bold text-rose-400">Belum Lulus (Remedial)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Nilai Sebelumnya:</span>
                  <span className="font-mono font-bold text-amber-300">{studentData.finalScore || 0}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Durasi Ujian:</span>
                  <span className="font-bold text-emerald-400">90 Menit CBT</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRetakeConfirmModal(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRetakeExam}
                  className="flex-1 py-3 bg-gradient-to-r from-rose-600 via-indigo-600 to-purple-600 hover:from-rose-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Mulai Ujian Ulang</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
