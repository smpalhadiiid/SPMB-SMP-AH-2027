import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { safeConfetti } from '../../utils/confettiHelper';
import {
  Clock, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, HelpCircle,
  FileCheck2, User, Sparkles, Send, RefreshCw, Award, BookOpen, Layers, Check, Download
} from 'lucide-react';
import { StudentData, CbtSoal, CbtUjian, CbtHasilUjian } from '../../types';
import {
  fetchUjianSupabase,
  fetchSoalSupabase,
  saveJawabanPesertaSupabase,
  saveAllJawabanPesertaSupabase,
  fetchJawabanPesertaSupabase,
  saveHasilUjianSupabase,
  fetchHasilUjianSupabase,
  saveLogUjianSupabase,
} from '../../services/cbtSupabaseService';
import { shuffleArray, saveCbtExamSession, getCbtExamSession } from '../../utils/cbtStorage';
import { generateExamResultPDF } from '../../utils/pdfGenerator';
import { getStoredSchoolInfo } from '../../utils/storage';
import {
  sendCbtHeartbeatSupabase,
  recordCbtActivityLogSupabase,
  CBT_MONITORING_CONFIG,
} from '../../services/cbtMonitoringService';

interface ShuffledOption {
  originalIndex: number;
  text: string;
}

interface QuestionWithShuffledOptions extends CbtSoal {
  shuffledOptions: ShuffledOption[];
}

interface PesertaExamSession {
  ujianId: string;
  pesertaId: string;
  questions: QuestionWithShuffledOptions[];
  answers: Record<string, number>; // soalId -> originalIndex chosen
  doubtfuls: Record<string, boolean>; // soalId -> isRagu
  currentIndex: number;
  remainingTimeSeconds: number;
  isCompleted: boolean;
  serverStartTime?: string;
  serverEndTime?: string;
}

interface CbtPesertaPortalProps {
  student: StudentData;
}

export const CbtPesertaPortal: React.FC<CbtPesertaPortalProps> = ({ student }) => {
  // Queries for active exams and user's results
  const { data: allUjian = [], isLoading: isUjianLoading, refetch: refetchUjian } = useQuery({
    queryKey: ['cbt_ujian'],
    queryFn: fetchUjianSupabase,
  });

  const { data: userHasilList = [], refetch: refetchHasil } = useQuery({
    queryKey: ['cbt_hasil', student.id],
    queryFn: () => fetchHasilUjianSupabase(student.id),
  });

  const activeUjian = allUjian.find((u) => u.status === 'aktif') || allUjian[0];

  // State
  const [examSession, setExamSession] = useState<PesertaExamSession | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showFinishedAlert, setShowFinishedAlert] = useState(false);
  const [lastCalculatedHasil, setLastCalculatedHasil] = useState<CbtHasilUjian | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Check if student already completed active exam in Supabase
  const existingHasil = userHasilList.find((h) => h.ujianId === activeUjian?.id || h.pesertaId === student.id);

  // Load or restore session on mount/activeUjian change
  useEffect(() => {
    if (!activeUjian) return;

    if (existingHasil) {
      setLastCalculatedHasil(existingHasil);
      return;
    }

    // Try loading local cached session if available
    const cached = getCbtExamSession(activeUjian.id, student.id) as any;
    if (cached && !cached.isCompleted) {
      // Re-calculate remaining seconds against serverEndTime if available
      if (cached.serverEndTime) {
        const msLeft = new Date(cached.serverEndTime).getTime() - Date.now();
        const secsLeft = Math.max(0, Math.floor(msLeft / 1000));
        if (secsLeft <= 0) {
          toast.error('Waktu ujian telah berakhir selama sesi terputus. Jawaban disubmit.');
          autoSubmitExam(cached);
          return;
        }
        cached.remainingTimeSeconds = secsLeft;
      }
      setExamSession(cached);

      // Catat log peserta reconnect / kembali membuka portal ujian
      recordCbtActivityLogSupabase({
        examId: activeUjian.id,
        participantId: student.id,
        participantName: student.fullName,
        eventType: 'network_reconnect',
        title: 'Peserta Membuka Kembali Portal',
        description: 'Sesi ujian berhasil dipulihkan dari server.',
        questionNumber: (cached.currentIndex || 0) + 1,
      });
    }
  }, [activeUjian?.id, existingHasil]);

  // Window Focus, Blur, & Network Activity Detection
  useEffect(() => {
    if (!examSession || examSession.isCompleted) return;

    const handleWindowBlur = () => {
      recordCbtActivityLogSupabase({
        examId: examSession.ujianId,
        participantId: student.id,
        participantName: student.fullName,
        eventType: 'window_blur',
        title: 'Beralih Tab / Jendela',
        description: `Peserta beralih ke jendela lain pada soal nomor ${examSession.currentIndex + 1}`,
        questionNumber: examSession.currentIndex + 1,
        isSuspicious: true,
      });
    };

    const handleOffline = () => {
      recordCbtActivityLogSupabase({
        examId: examSession.ujianId,
        participantId: student.id,
        participantName: student.fullName,
        eventType: 'network_offline',
        title: 'Koneksi Terputus',
        description: 'Perangkat peserta kehilangan koneksi internet (offline).',
        questionNumber: examSession.currentIndex + 1,
        isSuspicious: true,
      });
    };

    const handleOnline = () => {
      recordCbtActivityLogSupabase({
        examId: examSession.ujianId,
        participantId: student.id,
        participantName: student.fullName,
        eventType: 'network_reconnect',
        title: 'Koneksi Pulih',
        description: 'Perangkat peserta kembali terhubung ke internet.',
        questionNumber: examSession.currentIndex + 1,
      });
    };

    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [examSession?.ujianId, examSession?.isCompleted, examSession?.currentIndex]);

  // Timer Countdown Effect & Heartbeat (18 seconds interval)
  useEffect(() => {
    if (!examSession || examSession.isCompleted) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setExamSession((prev) => {
        if (!prev) return null;

        // Hitung remaining seconds berdasarkan acuan serverEndTime
        let nextSeconds: number;
        if (prev.serverEndTime) {
          const msLeft = new Date(prev.serverEndTime).getTime() - Date.now();
          nextSeconds = Math.max(0, Math.floor(msLeft / 1000));
        } else {
          nextSeconds = Math.max(0, prev.remainingTimeSeconds - 1);
        }

        if (nextSeconds <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          toast.error('Waktu ujian telah habis! Jawaban otomatis dikirim.');
          autoSubmitExam(prev);
          return { ...prev, remainingTimeSeconds: 0, isCompleted: true };
        }

        const updated = { ...prev, remainingTimeSeconds: nextSeconds };

        // Save session locally as fallback
        saveCbtExamSession(updated as any);

        // Periodically kirim Heartbeat ke Supabase setiap 18 detik (15-30s)
        if (nextSeconds % 18 === 0) {
          const ansCount = Object.keys(prev.answers).length;
          const totQ = prev.questions.length;
          const progPct = totQ > 0 ? Math.min(100, Math.round((ansCount / totQ) * 100)) : 0;

          sendCbtHeartbeatSupabase({
            exam_id: prev.ujianId,
            participant_id: prev.pesertaId,
            user_id: student.id,
            last_seen_at: new Date().toISOString(),
            current_question: prev.currentIndex + 1,
            answered_count: ansCount,
            total_questions: totQ,
            progress_percentage: progPct,
            remaining_seconds: nextSeconds,
            session_id: `ses_${prev.ujianId}_${student.id}`,
            connection_status: navigator.onLine ? 'online' : 'offline',
            server_start_time: prev.serverStartTime,
            server_end_time: prev.serverEndTime,
          });

          // Juga simpan log_ujian kompatibilitas
          saveLogUjianSupabase({
            ujianId: prev.ujianId,
            pesertaId: prev.pesertaId,
            namaPeserta: student.fullName,
            nomorSoalTerakhir: prev.currentIndex + 1,
            sisaWaktuDetik: nextSeconds,
            statusOnline: navigator.onLine ? 'ONLINE' : 'OFFLINE',
            isSubmitted: false,
            updatedAt: new Date().toISOString(),
          });
        }

        return updated;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [examSession?.ujianId, examSession?.isCompleted]);

  // Handle Mulai Tes (Start Exam)
  const handleStartExam = async () => {
    if (!activeUjian) {
      toast.error('Belum ada jadwal ujian yang diaktifkan oleh admin/panitia.');
      return;
    }

    setIsSyncing(true);
    try {
      // Fetch fresh questions from Supabase / Storage
      const allSoal = await fetchSoalSupabase();
      // Strictly filter ONLY questions that are marked as selected/active by Panitia
      const activeSoal = allSoal.filter((s) => s.statusAktif !== false);

      if (activeSoal.length === 0) {
        toast.error('Belum ada soal yang dipilih/diaktifkan oleh panitia untuk ujian ini. Hubungi pengawas.');
        setIsSyncing(false);
        return;
      }

      // Categorize active selected questions
      const diagList = activeSoal.filter((s) => (s.kategoriKode || s.category) === 'diagnostik');
      const tpuList = activeSoal.filter((s) => (s.kategoriKode || s.category) === 'pengetahuan_umum');
      const diniyyahList = activeSoal.filter((s) => (s.kategoriKode || s.category) === 'diniyyah');
      const otherList = activeSoal.filter(
        (s) =>
          (s.kategoriKode || s.category) !== 'diagnostik' &&
          (s.kategoriKode || s.category) !== 'pengetahuan_umum' &&
          (s.kategoriKode || s.category) !== 'diniyyah'
      );

      // Select questions according to activeUjian quotas, or include all selected active questions
      let selectedQuestionsPool: CbtSoal[] = [];

      // If activeUjian specifies quotas, draw up to quota or all available active
      const diagChosen = activeUjian.jumlahDiagnostik && activeUjian.jumlahDiagnostik < diagList.length
        ? shuffleArray(diagList).slice(0, activeUjian.jumlahDiagnostik)
        : diagList;

      const tpuChosen = activeUjian.jumlahTpu && activeUjian.jumlahTpu < tpuList.length
        ? shuffleArray(tpuList).slice(0, activeUjian.jumlahTpu)
        : tpuList;

      const diniyyahChosen = activeUjian.jumlahDiniyyah && activeUjian.jumlahDiniyyah < diniyyahList.length
        ? shuffleArray(diniyyahList).slice(0, activeUjian.jumlahDiniyyah)
        : diniyyahList;

      selectedQuestionsPool = [...diagChosen, ...tpuChosen, ...diniyyahChosen, ...otherList];

      // Fallback: If pool is empty for any reason, use all activeSoal
      if (selectedQuestionsPool.length === 0) {
        selectedQuestionsPool = activeSoal;
      }

      // ACAK SOAL: Shuffle combined question list for candidate fairness
      const combinedQuestions = shuffleArray(selectedQuestionsPool);

      // ACAK PILIHAN: Shuffle options A, B, C, D for each question
      const processedQuestions: QuestionWithShuffledOptions[] = combinedQuestions.map((q) => {
        const rawOptions = [
          { originalIndex: 0, text: q.pilihanA || q.options?.[0] || '' },
          { originalIndex: 1, text: q.pilihanB || q.options?.[1] || '' },
          { originalIndex: 2, text: q.pilihanC || q.options?.[2] || '' },
          { originalIndex: 3, text: q.pilihanD || q.options?.[3] || '' },
        ];
        const shuffledOptions = shuffleArray(rawOptions);
        return {
          ...q,
          shuffledOptions,
        };
      });

      // Restore any previously saved answers from Supabase if candidate re-entered
      const restoredAnswersMap = await fetchJawabanPesertaSupabase(activeUjian.id, student.id);
      const restoredAnswers: Record<string, number> = {};
      const restoredDoubtfuls: Record<string, boolean> = {};

      Object.entries(restoredAnswersMap).forEach(([sId, val]) => {
        if (val.jawabanIndex !== undefined) {
          restoredAnswers[sId] = val.jawabanIndex;
        }
        if (val.isRaguRagu) {
          restoredDoubtfuls[sId] = true;
        }
      });

      const startTimeIso = new Date().toISOString();
      const endTimeIso = new Date(Date.now() + activeUjian.durasiMinutes * 60 * 1000).toISOString();

      const newSession: PesertaExamSession = {
        ujianId: activeUjian.id,
        pesertaId: student.id,
        questions: processedQuestions,
        answers: restoredAnswers,
        doubtfuls: restoredDoubtfuls,
        currentIndex: 0,
        remainingTimeSeconds: activeUjian.durasiMinutes * 60,
        isCompleted: false,
        serverStartTime: startTimeIso,
        serverEndTime: endTimeIso,
      };

      setExamSession(newSession);
      saveCbtExamSession(newSession as any);

      // Log start session to Supabase
      saveLogUjianSupabase({
        ujianId: activeUjian.id,
        pesertaId: student.id,
        namaPeserta: student.fullName,
        nomorSoalTerakhir: 1,
        sisaWaktuDetik: activeUjian.durasiMinutes * 60,
        statusOnline: 'ONLINE',
        isSubmitted: false,
        updatedAt: startTimeIso,
      });

      // Catat event log aktivitas mulai ujian
      recordCbtActivityLogSupabase({
        examId: activeUjian.id,
        participantId: student.id,
        participantName: student.fullName,
        eventType: 'exam_start',
        title: 'Memulai Ujian CBT',
        description: `Peserta mulai mengerjakan ujian dengan ${processedQuestions.length} butir soal.`,
        questionNumber: 1,
      });

      // Kirim heartbeat pertama
      sendCbtHeartbeatSupabase({
        exam_id: activeUjian.id,
        participant_id: student.id,
        user_id: student.id,
        last_seen_at: startTimeIso,
        current_question: 1,
        answered_count: Object.keys(restoredAnswers).length,
        total_questions: processedQuestions.length,
        progress_percentage: Math.min(100, Math.round((Object.keys(restoredAnswers).length / processedQuestions.length) * 100)),
        remaining_seconds: activeUjian.durasiMinutes * 60,
        session_id: `ses_${activeUjian.id}_${student.id}`,
        connection_status: 'online',
        server_start_time: startTimeIso,
        server_end_time: endTimeIso,
      });

      toast.success('Ujian CBT berhasil dimulai! Selamat mengerjakan.');
    } catch (err: any) {
      toast.error('Gagal memulai sesi ujian: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Select Option (Auto Save to Supabase per click)
  const handleSelectOption = (originalOptionIndex: number) => {
    if (!examSession || examSession.isCompleted) return;

    const currentQuestion = examSession.questions[examSession.currentIndex];
    const qId = currentQuestion.id;
    const qNum = examSession.currentIndex + 1;
    const optLetter = ['A', 'B', 'C', 'D'][originalOptionIndex] || 'A';

    const updatedAnswers = { ...examSession.answers, [qId]: originalOptionIndex };
    const updatedSession: PesertaExamSession = {
      ...examSession,
      answers: updatedAnswers,
    };

    setExamSession(updatedSession);
    saveCbtExamSession(updatedSession as any);

    // AUTO SAVE TO SUPABASE
    saveJawabanPesertaSupabase({
      ujianId: examSession.ujianId,
      pesertaId: examSession.pesertaId,
      soalId: qId,
      jawabanIndex: originalOptionIndex,
      isRaguRagu: Boolean(examSession.doubtfuls[qId]),
    });

    // Catat log aktivitas menjawab soal
    recordCbtActivityLogSupabase({
      examId: examSession.ujianId,
      participantId: student.id,
      participantName: student.fullName,
      eventType: 'save_answer',
      title: 'Menyimpan Jawaban',
      description: `Menyimpan jawaban nomor ${qNum} (Pilihan ${optLetter})`,
      questionNumber: qNum,
    });

    // Kirim heartbeat seketika agar progress bar di layar panitia langsung terupdate real-time
    const ansCount = Object.keys(updatedAnswers).length;
    const totQ = examSession.questions.length;
    const progPct = totQ > 0 ? Math.min(100, Math.round((ansCount / totQ) * 100)) : 0;

    sendCbtHeartbeatSupabase({
      exam_id: examSession.ujianId,
      participant_id: examSession.pesertaId,
      user_id: student.id,
      last_seen_at: new Date().toISOString(),
      current_question: qNum,
      answered_count: ansCount,
      total_questions: totQ,
      progress_percentage: progPct,
      remaining_seconds: examSession.remainingTimeSeconds,
      session_id: `ses_${examSession.ujianId}_${student.id}`,
      connection_status: navigator.onLine ? 'online' : 'offline',
      server_start_time: examSession.serverStartTime,
      server_end_time: examSession.serverEndTime,
    });
  };

  // Handle Toggle Ragu-ragu (Auto Save to Supabase)
  const handleToggleDoubtful = () => {
    if (!examSession || examSession.isCompleted) return;

    const currentQuestion = examSession.questions[examSession.currentIndex];
    const qId = currentQuestion.id;
    const qNum = examSession.currentIndex + 1;
    const nextDoubtful = !examSession.doubtfuls[qId];

    const updatedDoubtfuls = { ...examSession.doubtfuls, [qId]: nextDoubtful };
    const updatedSession: PesertaExamSession = {
      ...examSession,
      doubtfuls: updatedDoubtfuls,
    };

    setExamSession(updatedSession);
    saveCbtExamSession(updatedSession as any);

    // AUTO SAVE TO SUPABASE
    saveJawabanPesertaSupabase({
      ujianId: examSession.ujianId,
      pesertaId: examSession.pesertaId,
      soalId: qId,
      jawabanIndex: examSession.answers[qId],
      isRaguRagu: nextDoubtful,
    });

    // Catat log ragu-ragu
    recordCbtActivityLogSupabase({
      examId: examSession.ujianId,
      participantId: student.id,
      participantName: student.fullName,
      eventType: 'mark_doubtful',
      title: nextDoubtful ? 'Menandai Ragu-ragu' : 'Menghapus Ragu-ragu',
      description: nextDoubtful
        ? `Menandai ragu-ragu pada nomor ${qNum}`
        : `Menghapus tanda ragu-ragu pada nomor ${qNum}`,
      questionNumber: qNum,
    });
  };

  // Question Navigation with Audit Log
  const handleNextQuestion = () => {
    if (!examSession) return;
    if (examSession.currentIndex < examSession.questions.length - 1) {
      const nextIdx = examSession.currentIndex + 1;
      setExamSession({ ...examSession, currentIndex: nextIdx });
      recordCbtActivityLogSupabase({
        examId: examSession.ujianId,
        participantId: student.id,
        participantName: student.fullName,
        eventType: 'view_question',
        title: 'Membuka Soal',
        description: `Membuka soal nomor ${nextIdx + 1}`,
        questionNumber: nextIdx + 1,
      });
    }
  };

  const handlePrevQuestion = () => {
    if (!examSession) return;
    if (examSession.currentIndex > 0) {
      const prevIdx = examSession.currentIndex - 1;
      setExamSession({ ...examSession, currentIndex: prevIdx });
      recordCbtActivityLogSupabase({
        examId: examSession.ujianId,
        participantId: student.id,
        participantName: student.fullName,
        eventType: 'view_question',
        title: 'Membuka Soal',
        description: `Membuka soal nomor ${prevIdx + 1}`,
        questionNumber: prevIdx + 1,
      });
    }
  };

  const handleJumpToQuestion = (index: number) => {
    if (!examSession) return;
    setExamSession({ ...examSession, currentIndex: index });
    recordCbtActivityLogSupabase({
      examId: examSession.ujianId,
      participantId: student.id,
      participantName: student.fullName,
      eventType: 'view_question',
      title: 'Membuka Soal',
      description: `Membuka soal nomor ${index + 1}`,
      questionNumber: index + 1,
    });
  };

  // Submit & Automated Score Calculation
  const autoSubmitExam = async (sessionToSubmit: PesertaExamSession) => {
    let diagCorrect = 0, diagTotal = 0;
    let tpuCorrect = 0, tpuTotal = 0;
    let diniyyahCorrect = 0, diniyyahTotal = 0;

    sessionToSubmit.questions.forEach((q) => {
      const category = q.kategoriKode || q.category;
      const userOriginalChoice = sessionToSubmit.answers[q.id];
      const correctOriginalChoice = typeof q.jawabanBenar === 'number' ? q.jawabanBenar : q.correctOptionIndex;

      const isCorrect = userOriginalChoice !== undefined && userOriginalChoice === correctOriginalChoice;

      if (category === 'diagnostik') {
        diagTotal++;
        if (isCorrect) diagCorrect++;
      } else if (category === 'pengetahuan_umum') {
        tpuTotal++;
        if (isCorrect) tpuCorrect++;
      } else if (category === 'diniyyah') {
        diniyyahTotal++;
        if (isCorrect) diniyyahCorrect++;
      }
    });

    // Score Calculation Formula: (Correct / Total) * 100 * Bobot %
    const scoreDiag = diagTotal > 0 ? Math.round((diagCorrect / diagTotal) * 100 * 0.3) : 0;
    const scoreTpu = tpuTotal > 0 ? Math.round((tpuCorrect / tpuTotal) * 100 * 0.4) : 0;
    const scoreDiniyyah = diniyyahTotal > 0 ? Math.round((diniyyahCorrect / diniyyahTotal) * 100 * 0.3) : 0;

    const totalScore = scoreDiag + scoreTpu + scoreDiniyyah;
    const passingGrade = activeUjian?.batasKelulusan || 70;
    const isPass = totalScore >= passingGrade;

    const hasilRecord: CbtHasilUjian = {
      id: `hasil_${sessionToSubmit.ujianId}_${student.id}`,
      ujianId: sessionToSubmit.ujianId,
      pesertaId: student.id,
      registrationNumber: student.registrationNumber || 'REG-SPMB',
      namaPeserta: student.fullName,
      nilaiDiagnostik: scoreDiag,
      nilaiTpu: scoreTpu,
      nilaiDiniyyah: scoreDiniyyah,
      nilaiTotal: totalScore,
      statusKelulusan: isPass ? 'LULUS' : 'BELUM LULUS',
      tanggalUjian: new Date().toISOString().split('T')[0],
    };

    // 3. Save to Supabase jawaban_peserta table!
    await saveAllJawabanPesertaSupabase({
      ujianId: sessionToSubmit.ujianId,
      pesertaId: student.id,
      answers: sessionToSubmit.answers,
    });

    // 4. Save to Supabase hasil_ujian table!
    await saveHasilUjianSupabase(hasilRecord);

    // Save final log to log_ujian
    await saveLogUjianSupabase({
      ujianId: sessionToSubmit.ujianId,
      pesertaId: student.id,
      namaPeserta: student.fullName,
      nomorSoalTerakhir: sessionToSubmit.questions.length,
      sisaWaktuDetik: 0,
      statusOnline: 'OFFLINE',
      isSubmitted: true,
      updatedAt: new Date().toISOString(),
    });

    // Catat activity log submit ujian
    recordCbtActivityLogSupabase({
      examId: sessionToSubmit.ujianId,
      participantId: student.id,
      participantName: student.fullName,
      eventType: 'exam_submit',
      title: 'Ujian Berhasil Disubmit',
      description: `Peserta menyelesaikan ujian CBT secara resmi. Skor akhir: ${totalScore} (${isPass ? 'LULUS' : 'BELUM LULUS'}).`,
      questionNumber: sessionToSubmit.questions.length,
    });

    // Kirim final heartbeat dengan status SELESAI
    sendCbtHeartbeatSupabase({
      exam_id: sessionToSubmit.ujianId,
      participant_id: student.id,
      user_id: student.id,
      last_seen_at: new Date().toISOString(),
      current_question: sessionToSubmit.questions.length,
      answered_count: Object.keys(sessionToSubmit.answers).length,
      total_questions: sessionToSubmit.questions.length,
      progress_percentage: 100,
      remaining_seconds: 0,
      session_id: `ses_${sessionToSubmit.ujianId}_${student.id}`,
      connection_status: 'offline',
      server_start_time: sessionToSubmit.serverStartTime,
      server_end_time: sessionToSubmit.serverEndTime,
    });

    setLastCalculatedHasil(hasilRecord);
    setExamSession({ ...sessionToSubmit, remainingTimeSeconds: 0, isCompleted: true });

    // Trigger celebration confetti
    safeConfetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.6 },
    });

    setShowFinishedAlert(true);
    refetchHasil();
  };

  const handleSubmitConfirm = () => {
    if (!examSession) return;
    setShowSubmitModal(false);
    autoSubmitExam(examSession);
  };

  const formatTimer = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;

    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 1. STATE: FINISHED / COMPLETED RESULT DISPLAY
  if (showFinishedAlert || existingHasil || examSession?.isCompleted) {
    const hasilToShow = lastCalculatedHasil || existingHasil;

    return (
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-2xl mx-auto text-center space-y-6 my-6 transition-colors">
        <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
          <Sparkles className="w-10 h-10 animate-bounce" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            Terimakasih, Anda telah mengirimkan jawaban!
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Jawaban Anda telah tersimpan secara otomatis dan permanen di database Supabase SPMB SMP Al-Hadiid.
          </p>
        </div>

        {hasilToShow && (
          <div className="p-6 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-left space-y-4">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 pb-2 flex justify-between items-center">
              <span>Ringkasan Skor CBT SPMB</span>
              <span className="text-[10px] text-slate-400 font-normal">{hasilToShow.tanggalUjian}</span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/60 rounded-xl border border-blue-100 dark:border-blue-900">
                <div className="text-[10px] font-bold text-blue-700 dark:text-blue-300">Diagnostik (30%)</div>
                <div className="text-xl font-black text-blue-900 dark:text-blue-100">{hasilToShow.nilaiDiagnostik}</div>
              </div>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl border border-indigo-100 dark:border-indigo-900">
                <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300">Pengetahuan Umum (40%)</div>
                <div className="text-xl font-black text-indigo-900 dark:text-indigo-100">{hasilToShow.nilaiTpu}</div>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl border border-emerald-100 dark:border-emerald-900">
                <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">Diniyyah & Agama (30%)</div>
                <div className="text-xl font-black text-emerald-900 dark:text-emerald-100">{hasilToShow.nilaiDiniyyah}</div>
              </div>
            </div>

            <div className="flex justify-between items-center p-4 bg-emerald-900 text-white rounded-xl shadow-md">
              <div>
                <div className="text-[10px] text-emerald-300 font-bold uppercase">Nilai Total Akumulasi</div>
                <div className="text-3xl font-black">{hasilToShow.nilaiTotal} / 100</div>
              </div>
              <div className="text-right">
                <span
                  className={`px-4 py-1.5 font-black text-xs rounded-full uppercase shadow-sm ${
                    hasilToShow.statusKelulusan === 'LULUS'
                      ? 'bg-emerald-400 text-emerald-950'
                      : 'bg-amber-400 text-amber-950'
                  }`}
                >
                  {hasilToShow.statusKelulusan}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => {
              const school = getStoredSchoolInfo();
              generateExamResultPDF(student, school);
            }}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer border border-emerald-400/30"
          >
            <Download className="w-4 h-4 text-amber-300" />
            <span>Download Hasil Ujian (PDF)</span>
          </button>
          <button
            onClick={() => setShowFinishedAlert(false)}
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer"
          >
            Tutup Ringkasan Hasil
          </button>
        </div>
      </div>
    );
  }

  // 2. STATE: EXAM IN PROGRESS
  if (examSession && !examSession.isCompleted) {
    const currentQuestion = examSession.questions[examSession.currentIndex];
    const totalQuestions = examSession.questions.length;
    const answeredCount = Object.keys(examSession.answers).length;
    const doubtfulCount = Object.values(examSession.doubtfuls).filter(Boolean).length;
    const isCurrentDoubtful = Boolean(examSession.doubtfuls[currentQuestion.id]);
    const currentChosenOriginalIndex = examSession.answers[currentQuestion.id];

    return (
      <div className="space-y-4 max-w-6xl mx-auto">
        {/* Header Identitas & Timer Bar */}
        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-extrabold flex items-center gap-2">
                <span>{student.fullName}</span>
                <span className="text-[10px] bg-blue-500/30 text-blue-300 font-mono px-2 py-0.5 rounded-md border border-blue-400/30">
                  {student.registrationNumber || 'REG-SPMB'}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {activeUjian?.namaUjian} ({activeUjian?.gelombang})
              </div>
            </div>
          </div>

          {/* Right Timer Badge */}
          <div className="bg-amber-500/20 border border-amber-500/40 text-amber-300 px-4 py-2 rounded-xl flex items-center gap-3 self-start md:self-auto">
            <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
            <div>
              <div className="text-[9px] uppercase font-bold text-amber-200/80">Sisa Waktu Pengerjaan</div>
              <div className="text-xl font-mono font-black">{formatTimer(examSession.remainingTimeSeconds)}</div>
            </div>
          </div>
        </div>

        {/* Main CBT Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Left Panel: Nomor Soal Grid & Legend */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 lg:col-span-1">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="font-extrabold text-xs text-slate-800 dark:text-white">
                Nomor Soal ({answeredCount}/{totalQuestions})
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">Grid Ujian</span>
            </div>

            {/* Grid Buttons */}
            <div className="grid grid-cols-5 gap-2">
              {examSession.questions.map((q, idx) => {
                const isAnswered = examSession.answers[q.id] !== undefined;
                const isDoubtful = Boolean(examSession.doubtfuls[q.id]);
                const isCurrent = idx === examSession.currentIndex;

                let btnStyle = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200';
                if (isDoubtful) {
                  btnStyle = 'bg-amber-400 dark:bg-amber-500 text-amber-950 font-black border-amber-500 shadow-sm';
                } else if (isAnswered) {
                  btnStyle = 'bg-emerald-600 dark:bg-emerald-500 text-white font-black border-emerald-700 shadow-sm';
                }

                if (isCurrent) {
                  btnStyle += ' ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-slate-900 font-black scale-105';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => handleJumpToQuestion(idx)}
                    className={`h-9 rounded-xl border text-xs transition-all flex items-center justify-center ${btnStyle}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-[10px] space-y-1.5 font-bold text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-emerald-600 rounded-md shrink-0"></span>
                <span>Hijau = Sudah Dijawab ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-amber-400 rounded-md shrink-0"></span>
                <span>Kuning = Ragu-ragu ({doubtfulCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-slate-200 dark:bg-slate-700 rounded-md shrink-0"></span>
                <span>Abu-abu = Belum Dijawab</span>
              </div>
            </div>

            {/* Kirim Jawaban Button */}
            <div className="pt-2">
              <button
                onClick={() => setShowSubmitModal(true)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Kirim Jawaban (Selesai)</span>
              </button>
            </div>
          </div>

          {/* Right Panel: Pertanyaan & Opsi Jawaban */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 lg:col-span-3 flex flex-col justify-between min-h-[480px]">
            <div className="space-y-4">
              {/* Question Header & Category Badge */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <span className="px-3 py-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-black text-xs rounded-full uppercase border border-blue-200 dark:border-blue-800">
                  Soal Nomor {examSession.currentIndex + 1} Dari {totalQuestions}
                </span>

                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                  Bidang: {currentQuestion.kategoriKode || currentQuestion.category}
                </span>
              </div>

              {/* Question Text */}
              <div className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed pt-2">
                {currentQuestion.questionText || currentQuestion.question}
              </div>

              {/* Question Image Attachment */}
              {currentQuestion.imageUrl && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex justify-center max-h-64 overflow-hidden">
                  <img src={currentQuestion.imageUrl} alt="Lampiran Soal" className="max-h-60 object-contain rounded-xl" />
                </div>
              )}

              {/* Options (Acak Pilihan Render) */}
              <div className="space-y-2.5 pt-4">
                {currentQuestion.shuffledOptions.map((opt, optIndex) => {
                  const isSelected = currentChosenOriginalIndex === opt.originalIndex;
                  return (
                    <button
                      key={optIndex}
                      onClick={() => handleSelectOption(opt.originalIndex)}
                      className={`w-full p-4 rounded-2xl border text-left text-xs font-semibold transition-all flex items-center gap-3 ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/80 border-blue-600 dark:border-blue-500 text-blue-950 dark:text-blue-100 font-extrabold shadow-sm ring-2 ring-blue-600/20'
                          : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {String.fromCharCode(65 + optIndex)}
                      </span>
                      <span className="flex-1">{opt.text}</span>
                      {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Controls: PREVIOUS, RAGU-RAGU, NEXT */}
            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={handlePrevQuestion}
                disabled={examSession.currentIndex === 0}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Sebelumnya</span>
              </button>

              <button
                onClick={handleToggleDoubtful}
                className={`w-full sm:w-auto px-5 py-2.5 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 ${
                  isCurrentDoubtful
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                <span>{isCurrentDoubtful ? '✓ Ragu-Ragu (Tandai)' : 'Ragu-ragu'}</span>
              </button>

              <button
                onClick={handleNextQuestion}
                disabled={examSession.currentIndex === totalQuestions - 1}
                className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <span>Selanjutnya</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Submit Confirmation */}
        {showSubmitModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 text-center border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <Send className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Konfirmasi Kirim Jawaban CBT</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Anda telah menjawab <strong>{answeredCount} dari {totalQuestions}</strong> soal. Apakah Anda yakin ingin mengakhiri dan mengirimkan lembar jawaban ke Supabase?
              </p>
              <div className="flex justify-center gap-2 pt-2">
                <button
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl"
                >
                  Batal, Cek Lagi
                </button>
                <button
                  onClick={handleSubmitConfirm}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md"
                >
                  Ya, Kirim Sekarang
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. DEFAULT STATE: JADWAL UJIAN DASHBOARD (START EXAM SCREEN)
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 transition-colors">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <FileCheck2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span>Jadwal Tes Seleksi CBT Calon Murid</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Selamat datang di Portal Ujian Online SPMB SMP Al-Hadiid.
        </p>
      </div>

      {isUjianLoading ? (
        <div className="h-32 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl" />
      ) : activeUjian ? (
        <div className="p-6 bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl shadow-lg space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-blue-800/80 pb-4">
            <div>
              <span className="px-3 py-1 bg-blue-500/30 text-blue-300 font-extrabold text-[10px] rounded-full uppercase border border-blue-400/30">
                {activeUjian.gelombang} - SESI AKTIF
              </span>
              <h4 className="text-xl font-black mt-2">{activeUjian.namaUjian}</h4>
              <p className="text-xs text-blue-200 mt-1">
                Tanggal: {activeUjian.tanggal} | Pukul {activeUjian.jamMulai} WIB | Durasi: {activeUjian.durasiMinutes} Menit
              </p>
            </div>

            <button
              onClick={handleStartExam}
              disabled={isSyncing}
              className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-xl transition-all flex items-center gap-2 shrink-0 animate-pulse disabled:opacity-50"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memuat Soal...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Mulai Tes CBT Sekarang</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
              <div className="text-[10px] text-blue-200 font-bold uppercase">Tes Diagnostik (30%)</div>
              <div className="text-lg font-black">{activeUjian.jumlahDiagnostik} Soal</div>
            </div>
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
              <div className="text-[10px] text-blue-200 font-bold uppercase">Pengetahuan Umum (40%)</div>
              <div className="text-lg font-black">{activeUjian.jumlahTpu} Soal</div>
            </div>
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
              <div className="text-[10px] text-blue-200 font-bold uppercase">Diniyyah & Agama (30%)</div>
              <div className="text-lg font-black">{activeUjian.jumlahDiniyyah} Soal</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-center space-y-2">
          <Clock className="w-8 h-8 text-slate-400 mx-auto" />
          <div className="text-sm font-bold text-slate-700 dark:text-slate-300">Belum Ada Sesi Ujian Aktif</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Panitia belum mengaktifkan jadwal ujian. Silakan hubungi panitia SPMB.
          </p>
        </div>
      )}
    </div>
  );
};
