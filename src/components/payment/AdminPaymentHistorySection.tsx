// =====================================================================
// src/components/payment/AdminPaymentHistorySection.tsx
// CRUD Transaksi Pembayaran Terkoneksi Langsung ke Supabase (public.payments)
// =====================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { StudentData } from '../../types';
import { PaymentRepository, PaymentItem } from '../../repositories/PaymentRepository';
import { exportToExcel } from '../../utils/excelExporter';
import { generateReportPDF } from '../../utils/pdfGenerator';
import { getStudentCategory, getTotalBamCost } from '../../utils/bamPricing';
import {
  Users, Search, Download, FileSpreadsheet, FileText,
  CreditCard, Calculator, CheckCircle2, User, Filter, Database,
  Plus, Pencil, Trash2, X, AlertCircle, RefreshCw, Eye, Check, Clock, XCircle,
  Image as ImageIcon, ZoomIn, ZoomOut, RotateCw
} from 'lucide-react';
import {
  downloadPaymentProof,
  getStoredPaymentProofs,
  StoredPaymentProof,
} from '../../utils/paymentProofStorage';

interface AdminPaymentHistorySectionProps {
  students?: StudentData[];
  onUpdateStudents?: (updated: StudentData[]) => void;
}

export const AdminPaymentHistorySection: React.FC<AdminPaymentHistorySectionProps> = ({
  students = [],
  onUpdateStudents,
}) => {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Filters & State
  const [activeGender, setActiveGender] = useState<'all' | 'Laki-laki' | 'Perempuan'>('Laki-laki');
  const [activeType, setActiveType] = useState<'all' | 'form' | 'bam' | 'tuition' | 'other'>('all');
  const [activeStatus, setActiveStatus] = useState<'all' | 'verified' | 'pending' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State: Create / Edit
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentItem | null>(null);
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Proof Gallery & Preview State
  const [showProofGalleryModal, setShowProofGalleryModal] = useState(false);
  const [galleryFilterType, setGalleryFilterType] = useState<'all' | 'form' | 'bam'>('all');
  const [galleryFilterGender, setGalleryFilterGender] = useState<'all' | 'Laki-laki' | 'Perempuan'>('all');
  const [galleryFilterStatus, setGalleryFilterStatus] = useState<'all' | 'verified' | 'pending'>('all');
  const [gallerySearchQuery, setGallerySearchQuery] = useState('');
  
  // Detailed Preview Modal State
  const [previewProofData, setPreviewProofData] = useState<{
    url: string;
    studentName: string;
    regNo: string;
    paymentType: string;
    amount?: number;
    status?: string;
    date?: string;
    notes?: string;
    fileName?: string;
  } | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewRotate, setPreviewRotate] = useState(0);

  // Form State
  const [formStudentId, setFormStudentId] = useState('');
  const [formRegNo, setFormRegNo] = useState('');
  const [formStudentName, setFormStudentName] = useState('');
  const [formGender, setFormGender] = useState<'Laki-laki' | 'Perempuan'>('Laki-laki');
  const [formPaymentType, setFormPaymentType] = useState<'form' | 'bam' | 'tuition' | 'other'>('form');
  const [formAmount, setFormAmount] = useState<number>(200000);
  const [formStatus, setFormStatus] = useState<'verified' | 'pending' | 'rejected'>('verified');
  const [formPaymentMethod, setFormPaymentMethod] = useState('Transfer Bank');
  const [formBankName, setFormBankName] = useState('Bank Syariah Indonesia (BSI)');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formSenderName, setFormSenderName] = useState('');
  const [formPaymentDate, setFormPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [formProofUrl, setFormProofUrl] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Load Payments directly from Supabase
  const loadPayments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await PaymentRepository.list();
      if (error) {
        console.warn('Gagal memuat pembayaran dari Supabase:', error.message);
      }
      
      // Merge with students map to populate student gender if missing
      const studentGenderMap = new Map<string, 'Laki-laki' | 'Perempuan'>();
      students.forEach(s => {
        studentGenderMap.set(s.id, s.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki');
        if (s.registrationNumber) {
          studentGenderMap.set(s.registrationNumber, s.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki');
        }
      });

      let loaded: PaymentItem[] = (data || []).map(p => ({
        ...p,
        gender: p.gender || studentGenderMap.get(p.studentId) || studentGenderMap.get(p.registrationNumber) || 'Laki-laki'
      }));

      // If database is brand new and has no payments yet, seed from students who have verified payments
      if (loaded.length === 0 && students.length > 0) {
        const seeded: PaymentItem[] = [];
        for (const s of students) {
          if (s.formPaymentStatus === 'verified' || s.isFormVerified) {
            seeded.push({
              id: `pay_form_${s.id}`,
              studentId: s.id,
              registrationNumber: s.registrationNumber || 'REG-SPMB',
              studentName: s.fullName,
              gender: s.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki',
              paymentType: 'form',
              amount: s.formPaymentAmount || 200000,
              status: 'verified',
              paymentMethod: 'Transfer Bank',
              bankName: 'BSI',
              paymentDate: s.formPaymentDate || new Date().toISOString().split('T')[0],
              proofUrl: s.formPaymentProofUrl,
              notes: s.formPaymentNotes || 'Pembayaran Formulir Pendaftaran',
              createdAt: s.createdAt || new Date().toISOString(),
            });
          }
          if (s.initialPaymentStatus === 'verified') {
            seeded.push({
              id: `pay_bam_${s.id}`,
              studentId: s.id,
              registrationNumber: s.registrationNumber || 'REG-SPMB',
              studentName: s.fullName,
              gender: s.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki',
              paymentType: 'bam',
              amount: s.initialPaymentAmount || getTotalBamCost(getStudentCategory(s)),
              status: 'verified',
              paymentMethod: 'Transfer Bank',
              bankName: 'BSI',
              paymentDate: s.initialPaymentDate || new Date().toISOString().split('T')[0],
              proofUrl: s.initialPaymentProofUrl,
              notes: s.initialPaymentNotes || 'Biaya Awal Masuk (BAM)',
              createdAt: s.createdAt || new Date().toISOString(),
            });
          }
        }
        if (seeded.length > 0) {
          loaded = seeded;
        }
      }

      setPayments(loaded);
    } catch (err: any) {
      console.error('Error loadPayments:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [students.length]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadPayments();
  };

  // Populate student info when student is selected in Create Modal
  const handleSelectStudent = (sId: string) => {
    setFormStudentId(sId);
    const target = students.find(s => s.id === sId);
    if (target) {
      setFormRegNo(target.registrationNumber || '');
      setFormStudentName(target.fullName || '');
      setFormGender(target.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki');
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingPayment(null);
    if (students.length > 0) {
      const first = students[0];
      setFormStudentId(first.id);
      setFormRegNo(first.registrationNumber || '');
      setFormStudentName(first.fullName);
      setFormGender(first.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki');
    } else {
      setFormStudentId('');
      setFormRegNo(`REG-${Date.now().toString().slice(-6)}`);
      setFormStudentName('');
      setFormGender('Laki-laki');
    }
    setFormPaymentType('form');
    setFormAmount(200000);
    setFormStatus('verified');
    setFormPaymentMethod('Transfer Bank');
    setFormBankName('Bank Syariah Indonesia (BSI)');
    setFormAccountNumber('');
    setFormSenderName('');
    setFormPaymentDate(new Date().toISOString().split('T')[0]);
    setFormProofUrl('');
    setFormNotes('Pembayaran Formulir Pendaftaran SPMB');
    setShowFormModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (p: PaymentItem) => {
    setEditingPayment(p);
    setFormStudentId(p.studentId);
    setFormRegNo(p.registrationNumber);
    setFormStudentName(p.studentName);
    setFormGender(p.gender || 'Laki-laki');
    setFormPaymentType(p.paymentType);
    setFormAmount(p.amount);
    setFormStatus(p.status === 'unpaid' ? 'pending' : p.status);
    setFormPaymentMethod(p.paymentMethod || 'Transfer Bank');
    setFormBankName(p.bankName || 'BSI');
    setFormAccountNumber(p.accountNumber || '');
    setFormSenderName(p.senderName || '');
    setFormPaymentDate(p.paymentDate ? p.paymentDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    setFormProofUrl(p.proofUrl || '');
    setFormNotes(p.notes || '');
    setShowFormModal(true);
  };

  // Save (Create or Update)
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStudentName.trim()) {
      alert('Nama Calon Murid wajib diisi.');
      return;
    }
    if (formAmount <= 0) {
      alert('Nominal pembayaran harus lebih dari 0.');
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      if (editingPayment) {
        // UPDATE
        const { data, error } = await PaymentRepository.update(editingPayment.id, {
          amount: Number(formAmount),
          status: formStatus,
          paymentMethod: formPaymentMethod,
          bankName: formBankName,
          accountNumber: formAccountNumber,
          senderName: formSenderName,
          proofUrl: formProofUrl || undefined,
          paymentDate: formPaymentDate,
          notes: formNotes,
        });

        if (error) {
          throw error;
        }

        setFeedback({ type: 'success', text: 'Data transaksi pembayaran berhasil diperbarui di Supabase!' });
      } else {
        // CREATE
        const sId = formStudentId || `std_${Date.now()}`;
        const regNo = formRegNo || `REG-${Date.now().toString().slice(-6)}`;

        const { data, error } = await PaymentRepository.create({
          studentId: sId,
          registrationNumber: regNo,
          studentName: formStudentName.trim(),
          paymentType: formPaymentType,
          amount: Number(formAmount),
          status: formStatus,
          paymentMethod: formPaymentMethod,
          bankName: formBankName,
          accountNumber: formAccountNumber,
          senderName: formSenderName,
          proofUrl: formProofUrl || undefined,
          paymentDate: formPaymentDate,
          notes: formNotes,
        });

        if (error) {
          throw error;
        }

        setFeedback({ type: 'success', text: 'Transaksi pembayaran baru berhasil ditambahkan ke database Supabase!' });
      }

      setShowFormModal(false);
      await loadPayments();

      // Refresh student list state if callback provided
      if (onUpdateStudents && formStudentId) {
        const updated = students.map(s => {
          if (s.id === formStudentId) {
            if (formPaymentType === 'form') {
              return {
                ...s,
                formPaymentStatus: (formStatus === 'verified' ? 'verified' : formStatus === 'rejected' ? 'rejected' : 'pending') as 'unpaid' | 'pending' | 'verified' | 'rejected',
                isFormVerified: formStatus === 'verified',
              };
            } else if (formPaymentType === 'bam') {
              return {
                ...s,
                initialPaymentStatus: (formStatus === 'verified' ? 'verified' : formStatus === 'rejected' ? 'rejected' : 'pending') as 'unpaid' | 'pending' | 'verified' | 'rejected',
              };
            }
          }
          return s;
        });
        onUpdateStudents(updated);
      }
    } catch (err: any) {
      alert(`Gagal menyimpan transaksi: ${err.message || String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Verification Toggle
  const handleQuickStatusChange = async (paymentId: string, newStatus: 'verified' | 'rejected' | 'pending') => {
    try {
      const { data, error } = await PaymentRepository.update(paymentId, {
        status: newStatus,
        verifiedAt: newStatus === 'verified' ? new Date().toISOString() : undefined,
        verifiedBy: 'Admin Panitia',
      });
      if (error) throw error;

      setPayments(prev =>
        prev.map(p => (p.id === paymentId ? { ...p, status: newStatus } : p))
      );
    } catch (err: any) {
      alert(`Gagal memperbarui status: ${err.message || String(err)}`);
    }
  };

  // Delete Payment Record
  const handleDeletePayment = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data transaksi pembayaran ini dari Supabase? Tindakan ini tidak dapat dibatalkan.')) {
      return;
    }

    try {
      const { success, error } = await PaymentRepository.remove(id);
      if (error) throw error;

      setPayments(prev => prev.filter(p => p.id !== id));
      setDeletingPaymentId(null);
      setFeedback({ type: 'success', text: 'Transaksi pembayaran berhasil dihapus dari database.' });
    } catch (err: any) {
      alert(`Gagal menghapus transaksi: ${err.message || String(err)}`);
    }
  };

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      // Filter Gender
      if (activeGender !== 'all' && p.gender !== activeGender) return false;

      // Filter Payment Type
      if (activeType !== 'all' && p.paymentType !== activeType) return false;

      // Filter Status
      if (activeStatus !== 'all' && p.status !== activeStatus) return false;

      // Filter Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.studentName.toLowerCase().includes(q);
        const matchReg = p.registrationNumber.toLowerCase().includes(q);
        const matchId = p.id.toLowerCase().includes(q);
        const matchBank = (p.bankName || '').toLowerCase().includes(q);
        const matchSender = (p.senderName || '').toLowerCase().includes(q);
        const matchNotes = (p.notes || '').toLowerCase().includes(q);
        return matchName || matchReg || matchId || matchBank || matchSender || matchNotes;
      }

      return true;
    });
  }, [payments, activeGender, activeType, activeStatus, searchQuery]);

  // Totals
  const totalNominal = useMemo(() => {
    return filteredPayments.reduce((acc, curr) => acc + (curr.status === 'verified' ? curr.amount : 0), 0);
  }, [filteredPayments]);

  const countVerified = filteredPayments.filter(p => p.status === 'verified').length;
  const countPending = filteredPayments.filter(p => p.status === 'pending').length;

  // Aggregated Proofs from payments + students + local storage
  const allStoredProofs = useMemo(() => {
    interface ProofItem {
      id: string;
      studentId: string;
      studentName: string;
      registrationNumber: string;
      gender: 'Laki-laki' | 'Perempuan';
      paymentType: 'form' | 'bam' | string;
      amount: number;
      status: 'verified' | 'pending' | 'rejected' | string;
      date: string;
      proofUrl: string;
      fileName?: string;
      notes?: string;
      source: 'database' | 'student' | 'cached';
    }

    const map = new Map<string, ProofItem>();

    // 1. From payments repository list
    payments.forEach(p => {
      if (p.proofUrl && p.proofUrl.trim() !== '') {
        const key = `${p.studentId || p.registrationNumber}_${p.paymentType}`;
        map.set(key, {
          id: p.id,
          studentId: p.studentId,
          studentName: p.studentName,
          registrationNumber: p.registrationNumber,
          gender: p.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki',
          paymentType: p.paymentType,
          amount: p.amount,
          status: p.status,
          date: p.paymentDate || p.createdAt.split('T')[0],
          proofUrl: p.proofUrl,
          notes: p.notes,
          source: 'database',
        });
      }
    });

    // 2. From students array
    students.forEach(s => {
      if (s.formPaymentProofUrl && s.formPaymentProofUrl.trim() !== '') {
        const key = `${s.id || s.registrationNumber}_form`;
        if (!map.has(key)) {
          map.set(key, {
            id: `proof_form_${s.id}`,
            studentId: s.id,
            studentName: s.fullName,
            registrationNumber: s.registrationNumber || 'REG-SPMB',
            gender: s.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki',
            paymentType: 'form',
            amount: s.formPaymentAmount || 200000,
            status: s.formPaymentStatus === 'verified' ? 'verified' : 'pending',
            date: s.formPaymentDate || new Date().toISOString().split('T')[0],
            proofUrl: s.formPaymentProofUrl,
            notes: s.formPaymentNotes || 'Bukti Pembayaran Formulir',
            source: 'student',
          });
        }
      }
      if (s.initialPaymentProofUrl && s.initialPaymentProofUrl.trim() !== '') {
        const key = `${s.id || s.registrationNumber}_bam`;
        if (!map.has(key)) {
          map.set(key, {
            id: `proof_bam_${s.id}`,
            studentId: s.id,
            studentName: s.fullName,
            registrationNumber: s.registrationNumber || 'REG-SPMB',
            gender: s.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki',
            paymentType: 'bam',
            amount: s.initialPaymentAmount || getTotalBamCost(getStudentCategory(s)),
            status: s.initialPaymentStatus === 'verified' ? 'verified' : 'pending',
            date: s.initialPaymentDate || new Date().toISOString().split('T')[0],
            proofUrl: s.initialPaymentProofUrl,
            notes: s.initialPaymentNotes || 'Bukti Biaya Awal Masuk (BAM)',
            source: 'student',
          });
        }
      }
    });

    // 3. From cached local proofs
    const cached = getStoredPaymentProofs();
    cached.forEach(c => {
      const key = `${c.studentId || c.registrationNumber}_${c.paymentType}`;
      if (!map.has(key) && c.dataUrl) {
        map.set(key, {
          id: c.id,
          studentId: c.studentId,
          studentName: c.studentName,
          registrationNumber: c.registrationNumber,
          gender: c.gender || 'Laki-laki',
          paymentType: c.paymentType,
          amount: c.amount,
          status: c.status || 'verified',
          date: c.uploadedAt.split('T')[0],
          proofUrl: c.dataUrl,
          fileName: c.fileName,
          source: 'cached',
        });
      }
    });

    return Array.from(map.values());
  }, [payments, students]);

  // Filtered Proofs for the Gallery
  const filteredGalleryProofs = useMemo(() => {
    return allStoredProofs.filter(item => {
      if (galleryFilterType !== 'all' && item.paymentType !== galleryFilterType) return false;
      if (galleryFilterGender !== 'all' && item.gender !== galleryFilterGender) return false;
      if (galleryFilterStatus !== 'all' && item.status !== galleryFilterStatus) return false;
      if (gallerySearchQuery.trim()) {
        const q = gallerySearchQuery.toLowerCase();
        return (
          item.studentName.toLowerCase().includes(q) ||
          item.registrationNumber.toLowerCase().includes(q) ||
          (item.notes || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allStoredProofs, galleryFilterType, galleryFilterGender, galleryFilterStatus, gallerySearchQuery]);

  // Export Excel
  const handleExportExcel = () => {
    const data = filteredPayments.map((p, i) => ({
      No: i + 1,
      ID_Transaksi: p.id,
      No_Pendaftaran: p.registrationNumber,
      Tanggal: p.paymentDate || p.createdAt.split('T')[0],
      Nama_Murid: p.studentName,
      Gender: p.gender || 'Laki-laki',
      Jenis_Pembayaran: p.paymentType.toUpperCase(),
      Nominal: p.amount,
      Metode: p.paymentMethod || 'Transfer Bank',
      Bank: p.bankName || '-',
      Pengirim: p.senderName || '-',
      Status: p.status === 'verified' ? 'LUNAS' : p.status.toUpperCase(),
      Catatan: p.notes || '-',
    }));
    exportToExcel(data, `Data_Transaksi_Pembayaran_SPMB_${activeGender}_${new Date().toISOString().split('T')[0]}`);
  };

  // Export PDF
  const handleExportPDF = () => {
    const data = filteredPayments.map((p, i) => ({
      No: i + 1,
      ID_Trx: p.id.slice(-8),
      Tanggal: p.paymentDate || p.createdAt.split('T')[0],
      Nama_Murid: p.studentName,
      JK: p.gender === 'Perempuan' ? 'P' : 'L',
      Jenis: p.paymentType.toUpperCase(),
      Nominal: `Rp ${p.amount.toLocaleString('id-ID')}`,
      Status: p.status === 'verified' ? 'LUNAS' : p.status.toUpperCase(),
    }));
    generateReportPDF(
      `Laporan_Pembayaran_${activeGender}`,
      data,
      ['No', 'ID_Trx', 'Tanggal', 'Nama_Murid', 'JK', 'Jenis', 'Nominal', 'Status']
    );
  };

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-4 rounded-xl flex items-center justify-between text-xs font-bold border ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Main Actions */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold mb-2">
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>Terkoneksi Database Supabase (public.payments)</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Transaksi Pembayaran Calon Murid
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Kelola data transaksi pembayaran Formulir, BAM, dan biaya lainnya dengan operasi CRUD penuh langsung ke database.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            title="Refresh Data dari Database"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tambah Transaksi</span>
          </button>

          <button
            onClick={() => setShowProofGalleryModal(true)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            title="Buka Arsip & Galeri File Bukti Pembayaran (Formulir & BAM)"
          >
            <ImageIcon className="w-4 h-4 text-amber-300" />
            <span>Arsip Bukti ({allStoredProofs.length})</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Cetak PDF</span>
          </button>
        </div>
      </div>

      {/* Gender Tab Switcher */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-200 p-1.5 rounded-2xl">
        <button
          onClick={() => setActiveGender('Laki-laki')}
          className={`py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeGender === 'Laki-laki'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-700 hover:bg-slate-300'
          }`}
        >
          <span>♂️ Calon Murid Laki-Laki (Ikhwan)</span>
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-[11px] shrink-0">
            {payments.filter(p => p.gender === 'Laki-laki').length} TRX
          </span>
        </button>

        <button
          onClick={() => setActiveGender('Perempuan')}
          className={`py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeGender === 'Perempuan'
              ? 'bg-pink-600 text-white shadow-md'
              : 'text-slate-700 hover:bg-slate-300'
          }`}
        >
          <span>♀️ Calon Murid Perempuan (Akhwat)</span>
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-[11px] shrink-0">
            {payments.filter(p => p.gender === 'Perempuan').length} TRX
          </span>
        </button>

        <button
          onClick={() => setActiveGender('all')}
          className={`py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeGender === 'all'
              ? 'bg-slate-800 text-white shadow-md'
              : 'text-slate-700 hover:bg-slate-300'
          }`}
        >
          <span>👥 Semua Gender (Gabungan)</span>
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-[11px] shrink-0">
            {payments.length} TRX
          </span>
        </button>
      </div>

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-500">Total Terbayar (Lunas)</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            Rp {totalNominal.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{countVerified} Transaksi Terverifikasi</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-500">Pembayaran Formulir</div>
          <div className="text-xl font-extrabold text-slate-900 mt-1">
            Rp {filteredPayments.filter(p => p.paymentType === 'form' && p.status === 'verified').reduce((a, c) => a + c.amount, 0).toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {filteredPayments.filter(p => p.paymentType === 'form').length} Transaksi Formulir
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-500">Biaya Awal Masuk (BAM)</div>
          <div className="text-xl font-extrabold text-blue-700 mt-1">
            Rp {filteredPayments.filter(p => p.paymentType === 'bam' && p.status === 'verified').reduce((a, c) => a + c.amount, 0).toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {filteredPayments.filter(p => p.paymentType === 'bam').length} Transaksi BAM
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-500">Menunggu Verifikasi</div>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {countPending} <span className="text-xs font-normal text-slate-500">Transaksi</span>
          </div>
          <div className="text-[11px] text-amber-600 mt-1 flex items-center gap-1 font-semibold">
            <Clock className="w-3.5 h-3.5" />
            <span>Perlu Ditinjau Admin</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Module Selector */}
          <button
            onClick={() => setActiveType('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeType === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Semua Jenis ({payments.length})
          </button>
          <button
            onClick={() => setActiveType('form')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeType === 'form' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Formulir ({payments.filter(p => p.paymentType === 'form').length})
          </button>
          <button
            onClick={() => setActiveType('bam')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeType === 'bam' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            BAM ({payments.filter(p => p.paymentType === 'bam').length})
          </button>

          {/* Status Filter */}
          <select
            value={activeStatus}
            onChange={e => setActiveStatus(e.target.value as any)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-700 focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Status: Semua</option>
            <option value="verified">Status: Lunas (Verified)</option>
            <option value="pending">Status: Pending</option>
            <option value="rejected">Status: Ditolak</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari Nama / No Reg / Bank / ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Main Payment Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <span>Daftar Transaksi Pembayaran ({filteredPayments.length} Data)</span>
          </h3>
          <span className="text-xs text-slate-500">
            Sumber Data: <strong className="text-emerald-700 font-bold">Supabase public.payments</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[950px]">
            <thead>
              <tr className="bg-slate-100 border-b font-bold text-slate-700 whitespace-nowrap">
                <th className="p-3 text-center">No</th>
                <th className="p-3">ID Transaksi</th>
                <th className="p-3">Tanggal</th>
                <th className="p-3">No. Pendaftaran</th>
                <th className="p-3">Nama Calon Murid</th>
                <th className="p-3 text-center">JK</th>
                <th className="p-3 text-center">Jenis</th>
                <th className="p-3">Nominal</th>
                <th className="p-3">Metode / Bank</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3">Catatan</th>
                <th className="p-3 text-center">Bukti</th>
                <th className="p-3 text-center">Aksi (CRUD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                      <span>Memuat data transaksi pembayaran dari Supabase...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-400 italic">
                    Tidak ada transaksi pembayaran yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p, i) => (
                  <tr key={p.id} className="hover:bg-slate-50 font-medium whitespace-nowrap">
                    <td className="p-3 text-center text-slate-500 font-mono">{i + 1}</td>
                    <td className="p-3 font-mono font-bold text-blue-700 text-[11px]">{p.id}</td>
                    <td className="p-3 text-slate-600">{p.paymentDate ? p.paymentDate.split('T')[0] : p.createdAt.split('T')[0]}</td>
                    <td className="p-3 font-mono text-slate-700 font-semibold">{p.registrationNumber}</td>
                    <td className="p-3 font-bold text-slate-900">{p.studentName}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.gender === 'Perempuan' ? 'bg-pink-100 text-pink-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {p.gender === 'Perempuan' ? 'P' : 'L'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        p.paymentType === 'form' ? 'bg-emerald-100 text-emerald-800' :
                        p.paymentType === 'bam' ? 'bg-indigo-100 text-indigo-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {p.paymentType}
                      </span>
                    </td>
                    <td className="p-3 font-extrabold text-emerald-700">
                      Rp {p.amount.toLocaleString('id-ID')}
                    </td>
                    <td className="p-3 text-slate-600">
                      <div>{p.bankName || p.paymentMethod || 'Transfer'}</div>
                      {p.senderName && <div className="text-[10px] text-slate-400">A.N: {p.senderName}</div>}
                    </td>
                    <td className="p-3 text-center">
                      {p.status === 'verified' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">
                          <Check className="w-3 h-3" /> LUNAS
                        </span>
                      ) : p.status === 'rejected' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full font-bold text-[10px]">
                          <XCircle className="w-3 h-3" /> DITOLAK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full font-bold text-[10px]">
                          <Clock className="w-3 h-3" /> PENDING
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-500 max-w-[150px] truncate" title={p.notes}>
                      {p.notes || '-'}
                    </td>
                    <td className="p-3 text-center">
                      {p.proofUrl ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewProofData({
                                url: p.proofUrl || '',
                                studentName: p.studentName,
                                regNo: p.registrationNumber,
                                paymentType: p.paymentType,
                                amount: p.amount,
                                status: p.status,
                                date: p.paymentDate || p.createdAt.split('T')[0],
                                notes: p.notes,
                              });
                              setPreviewZoom(1);
                              setPreviewRotate(0);
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            title="Lihat Pratinjau Foto Bukti"
                          >
                            <Eye className="w-3 h-3 text-blue-600" />
                            <span>Lihat</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadPaymentProof(p.proofUrl || '', `Bukti_${p.paymentType === 'form' ? 'Formulir' : 'BAM'}_${p.studentName}_${p.registrationNumber}.jpg`)}
                            className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded transition-colors cursor-pointer"
                            title="Unduh File Bukti Transfer"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Quick verify/reject buttons */}
                        {p.status !== 'verified' && (
                          <button
                            onClick={() => handleQuickStatusChange(p.id, 'verified')}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors cursor-pointer"
                            title="Tandai Lunas / Verifikasi"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {p.status === 'verified' && (
                          <button
                            onClick={() => handleQuickStatusChange(p.id, 'pending')}
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition-colors cursor-pointer"
                            title="Kembalikan ke Status Pending"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEditModal(p)}
                          className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors cursor-pointer"
                          title="Edit Transaksi"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeletePayment(p.id)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Transaksi dari Supabase"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* MODAL: CREATE / EDIT TRANSACTION */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {editingPayment ? 'Edit Transaksi Pembayaran' : 'Tambah Transaksi Pembayaran Baru'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tersimpan langsung ke tabel <code className="text-emerald-700 font-bold">public.payments</code> di Supabase.
                </p>
              </div>
              <button
                onClick={() => setShowFormModal(false)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Select Student */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Pilih Calon Murid (Terdaftar di SPMB)
                </label>
                <select
                  value={formStudentId}
                  onChange={e => handleSelectStudent(e.target.value)}
                  disabled={!!editingPayment}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-medium bg-white focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
                >
                  <option value="">-- Pilih dari Daftar Siswa --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.registrationNumber} - {s.fullName} ({s.gender})
                    </option>
                  ))}
                </select>
              </div>

              {/* Student Name & Reg Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Calon Murid *</label>
                  <input
                    type="text"
                    required
                    value={formStudentName}
                    onChange={e => setFormStudentName(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold"
                    placeholder="Nama Lengkap Siswa"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">No. Pendaftaran</label>
                  <input
                    type="text"
                    value={formRegNo}
                    onChange={e => setFormRegNo(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-slate-700 font-bold"
                    placeholder="SPMB20270001"
                  />
                </div>
              </div>

              {/* Payment Type & Gender */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis Pembayaran *</label>
                  <select
                    value={formPaymentType}
                    onChange={e => {
                      const val = e.target.value as any;
                      setFormPaymentType(val);
                      if (val === 'form') setFormAmount(200000);
                      else if (val === 'bam') setFormAmount(formGender === 'Perempuan' ? 6890000 : 6670000);
                    }}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold bg-white"
                  >
                    <option value="form">Formulir Pendaftaran</option>
                    <option value="bam">Biaya Awal Masuk (BAM)</option>
                    <option value="tuition">SPP Bulanan</option>
                    <option value="other">Lain-lain</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis Kelamin</label>
                  <select
                    value={formGender}
                    onChange={e => {
                      const val = e.target.value as any;
                      setFormGender(val);
                      if (formPaymentType === 'bam') {
                        setFormAmount(val === 'Perempuan' ? 6890000 : 6670000);
                      }
                    }}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold bg-white"
                  >
                    <option value="Laki-laki">♂️ Laki-Laki (Ikhwan)</option>
                    <option value="Perempuan">♀️ Perempuan (Akhwat)</option>
                  </select>
                </div>
              </div>

              {/* Amount & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nominal Pembayaran (Rp) *</label>
                  <input
                    type="number"
                    required
                    min={1000}
                    value={formAmount}
                    onChange={e => setFormAmount(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-extrabold text-emerald-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status Verifikasi *</label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold bg-white"
                  >
                    <option value="verified">✅ LUNAS (Verified)</option>
                    <option value="pending">⏳ PENDING (Menunggu)</option>
                    <option value="rejected">❌ DITOLAK (Rejected)</option>
                  </select>
                </div>
              </div>

              {/* Payment Date & Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Pembayaran</label>
                  <input
                    type="date"
                    value={formPaymentDate}
                    onChange={e => setFormPaymentDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Metode Pembayaran</label>
                  <select
                    value={formPaymentMethod}
                    onChange={e => setFormPaymentMethod(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold bg-white"
                  >
                    <option value="Transfer Bank">Transfer Bank</option>
                    <option value="Tunai / Kasir Sekolah">Tunai / Kasir Sekolah</option>
                    <option value="QRIS">QRIS</option>
                    <option value="Virtual Account">Virtual Account</option>
                  </select>
                </div>
              </div>

              {/* Bank & Sender Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bank Tujuan</label>
                  <input
                    type="text"
                    value={formBankName}
                    onChange={e => setFormBankName(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-medium"
                    placeholder="BSI / Mandiri / BCA"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nomor Rekening</label>
                  <input
                    type="text"
                    value={formAccountNumber}
                    onChange={e => setFormAccountNumber(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-xs"
                    placeholder="No Rekening Pengirim"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Pemilik / Pengirim</label>
                  <input
                    type="text"
                    value={formSenderName}
                    onChange={e => setFormSenderName(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-medium"
                    placeholder="A.N Pengirim"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan / Keterangan</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-medium"
                  placeholder="Catatan tambahan pembayaran..."
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menyimpan ke Database...</span>
                    </>
                  ) : (
                    <span>{editingPayment ? 'Simpan Perubahan' : 'Simpan Transaksi'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PROOF IMAGE PREVIEW (FULLSCREEN / ZOOM / ROTATE / DOWNLOAD) */}
      {previewProofData && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                    previewProofData.paymentType === 'form' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {previewProofData.paymentType === 'form' ? 'Bukti Formulir' : 'Bukti BAM'}
                  </span>
                  <h4 className="font-extrabold text-slate-900 text-sm">
                    {previewProofData.studentName} ({previewProofData.regNo})
                  </h4>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Nominal: <b>Rp {(previewProofData.amount || 0).toLocaleString('id-ID')}</b> • Tanggal: <b>{previewProofData.date || '-'}</b> • Status: <b className="uppercase">{previewProofData.status || 'verified'}</b>
                </div>
              </div>
              <button
                onClick={() => {
                  setPreviewProofData(null);
                  setPreviewZoom(1);
                  setPreviewRotate(0);
                }}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toolbar: Zoom & Rotate */}
            <div className="flex items-center justify-between bg-slate-100 p-2 rounded-xl text-xs">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPreviewZoom(prev => Math.min(prev + 0.25, 2.5))}
                  className="p-1.5 bg-white hover:bg-slate-200 text-slate-800 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                  title="Perbesar"
                >
                  <ZoomIn className="w-4 h-4 text-blue-600" />
                  <span>Zoom In</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewZoom(prev => Math.max(prev - 0.25, 0.75))}
                  className="p-1.5 bg-white hover:bg-slate-200 text-slate-800 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                  title="Perkecil"
                >
                  <ZoomOut className="w-4 h-4 text-blue-600" />
                  <span>Zoom Out</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewRotate(prev => (prev + 90) % 360)}
                  className="p-1.5 bg-white hover:bg-slate-200 text-slate-800 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                  title="Putar 90 Derajat"
                >
                  <RotateCw className="w-4 h-4 text-blue-600" />
                  <span>Putar</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewZoom(1);
                    setPreviewRotate(0);
                  }}
                  className="px-2 py-1.5 bg-white hover:bg-slate-200 text-slate-600 rounded-lg font-semibold text-[11px] cursor-pointer"
                >
                  Reset
                </button>
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                {Math.round(previewZoom * 100)}%
              </div>
            </div>

            {/* Image Box */}
            <div className="max-h-[62vh] overflow-auto flex items-center justify-center bg-slate-950 rounded-xl p-3">
              <div
                style={{
                  transform: `scale(${previewZoom}) rotate(${previewRotate}deg)`,
                  transition: 'transform 0.2s ease-in-out',
                }}
                className="inline-block"
              >
                <img
                  src={previewProofData.url}
                  alt="Bukti Transfer"
                  className="max-h-[58vh] max-w-full object-contain rounded-lg shadow"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">
                Tersimpan di Database Supabase • Siap diverifikasi & diunduh
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadPaymentProof(previewProofData.url, `Bukti_${previewProofData.paymentType === 'form' ? 'Formulir' : 'BAM'}_${previewProofData.studentName}_${previewProofData.regNo}.jpg`)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh File Bukti</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewProofData(null);
                    setPreviewZoom(1);
                    setPreviewRotate(0);
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

      {/* MODAL: ARSIP & GALERI BUKTI PEMBAYARAN (FORMULIR & BAM) */}
      {showProofGalleryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Arsip & Galeri Bukti Transfer Calon Murid
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kumpulan seluruh foto bukti pembayaran Formulir dan BAM yang telah diunggah calon murid dan tersimpan di database.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProofGalleryModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stats Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-indigo-50/50 border-b border-indigo-100 text-xs">
              <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-xs">
                <div className="text-slate-500 font-bold text-[10px] uppercase">Total Bukti File</div>
                <div className="text-xl font-black text-indigo-700 mt-0.5">{allStoredProofs.length} Bukti</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-xs">
                <div className="text-slate-500 font-bold text-[10px] uppercase">Bukti Formulir</div>
                <div className="text-xl font-black text-blue-700 mt-0.5">
                  {allStoredProofs.filter(p => p.paymentType === 'form').length} Berkas
                </div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-xs">
                <div className="text-slate-500 font-bold text-[10px] uppercase">Bukti BAM</div>
                <div className="text-xl font-black text-emerald-700 mt-0.5">
                  {allStoredProofs.filter(p => p.paymentType === 'bam').length} Berkas
                </div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-xs">
                <div className="text-slate-500 font-bold text-[10px] uppercase">Perlu Diverifikasi</div>
                <div className="text-xl font-black text-amber-700 mt-0.5">
                  {allStoredProofs.filter(p => p.status === 'pending').length} Menunggu
                </div>
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="p-4 border-b border-slate-200 bg-white space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                {/* Search */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama / no. reg murid..."
                    value={gallerySearchQuery}
                    onChange={(e) => setGallerySearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Filter Chips */}
                <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                  {/* Type Filter */}
                  <button
                    type="button"
                    onClick={() => setGalleryFilterType('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      galleryFilterType === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Semua Jenis
                  </button>
                  <button
                    type="button"
                    onClick={() => setGalleryFilterType('form')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      galleryFilterType === 'form' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Formulir Saja
                  </button>
                  <button
                    type="button"
                    onClick={() => setGalleryFilterType('bam')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      galleryFilterType === 'bam' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    BAM Saja
                  </button>

                  <span className="text-slate-300 mx-1">|</span>

                  {/* Gender Filter */}
                  <button
                    type="button"
                    onClick={() => setGalleryFilterGender(galleryFilterGender === 'all' ? 'Laki-laki' : galleryFilterGender === 'Laki-laki' ? 'Perempuan' : 'all')}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Gender: {galleryFilterGender === 'all' ? 'Semua' : galleryFilterGender === 'Laki-laki' ? '♂️ Ikhwan' : '♀️ Akhwat'}
                  </button>
                </div>
              </div>
            </div>

            {/* Gallery Grid Container */}
            <div className="flex-1 overflow-y-auto p-5 bg-slate-100">
              {filteredGalleryProofs.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-3xl text-slate-400">
                    📂
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">Tidak Ada Bukti Pembayaran Ditemukan</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {gallerySearchQuery || galleryFilterType !== 'all'
                      ? 'Coba ubah kata kunci pencarian atau filter kategori untuk menemukan berkas bukti.'
                      : 'Belum ada berkas bukti pembayaran formulir atau BAM yang diunggah oleh calon murid.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredGalleryProofs.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col group"
                    >
                      {/* Image Thumbnail Box */}
                      <div className="relative h-44 bg-slate-900 flex items-center justify-center overflow-hidden">
                        <img
                          src={item.proofUrl}
                          alt={`Bukti ${item.paymentType}`}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                        {/* Overlay Type Badge */}
                        <div className="absolute top-2.5 left-2.5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold shadow-sm uppercase ${
                            item.paymentType === 'form' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
                          }`}>
                            {item.paymentType === 'form' ? 'Formulir' : 'BAM'}
                          </span>
                        </div>
                        {/* Status Badge */}
                        <div className="absolute top-2.5 right-2.5">
                          {item.status === 'verified' ? (
                            <span className="px-2 py-0.5 bg-emerald-500 text-white rounded-full text-[10px] font-extrabold shadow-sm flex items-center gap-1">
                              <Check className="w-3 h-3" /> LUNAS
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-[10px] font-extrabold shadow-sm flex items-center gap-1">
                              <Clock className="w-3 h-3" /> PENDING
                            </span>
                          )}
                        </div>

                        {/* Quick View & Download Hover Overlay */}
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewProofData({
                                url: item.proofUrl,
                                studentName: item.studentName,
                                regNo: item.registrationNumber,
                                paymentType: item.paymentType,
                                amount: item.amount,
                                status: item.status,
                                date: item.date,
                                notes: item.notes,
                              });
                              setPreviewZoom(1);
                              setPreviewRotate(0);
                            }}
                            className="px-3 py-1.5 bg-white text-slate-900 rounded-xl text-xs font-bold flex items-center gap-1 shadow cursor-pointer hover:bg-slate-100"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            <span>Perbesar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadPaymentProof(item.proofUrl, `Bukti_${item.paymentType === 'form' ? 'Formulir' : 'BAM'}_${item.studentName}_${item.registrationNumber}.jpg`)}
                            className="p-2 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow cursor-pointer hover:bg-emerald-500"
                            title="Unduh File"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Content Details */}
                      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-mono">{item.registrationNumber}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              item.gender === 'Perempuan' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {item.gender === 'Perempuan' ? 'Akhwat' : 'Ikhwan'}
                            </span>
                          </div>
                          <div className="font-extrabold text-slate-900 text-xs truncate mt-0.5" title={item.studentName}>
                            {item.studentName}
                          </div>
                          <div className="font-bold font-mono text-emerald-700 text-xs mt-1">
                            Rp {item.amount.toLocaleString('id-ID')}
                          </div>
                        </div>

                        {/* Card Actions Bottom */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewProofData({
                                url: item.proofUrl,
                                studentName: item.studentName,
                                regNo: item.registrationNumber,
                                paymentType: item.paymentType,
                                amount: item.amount,
                                status: item.status,
                                date: item.date,
                                notes: item.notes,
                              });
                              setPreviewZoom(1);
                              setPreviewRotate(0);
                            }}
                            className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <Eye className="w-3 h-3 text-blue-600" />
                            <span>Lihat</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadPaymentProof(item.proofUrl, `Bukti_${item.paymentType === 'form' ? 'Formulir' : 'BAM'}_${item.studentName}_${item.registrationNumber}.jpg`)}
                            className="flex-1 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            <span>Unduh</span>
                          </button>
                          {item.status !== 'verified' && (
                            <button
                              type="button"
                              onClick={async () => {
                                await handleQuickStatusChange(item.id, 'verified');
                                setFeedback({ type: 'success', text: `Bukti ${item.studentName} berhasil diverifikasi LUNAS!` });
                              }}
                              className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                              title="Verifikasi Lunas Sekarang"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Menampilkan <b>{filteredGalleryProofs.length}</b> dari <b>{allStoredProofs.length}</b> berkas bukti pembayaran tersimpan
              </span>
              <button
                type="button"
                onClick={() => setShowProofGalleryModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Tutup Galeri
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
