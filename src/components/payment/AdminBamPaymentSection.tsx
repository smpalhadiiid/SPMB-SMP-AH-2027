import React, { useState, useEffect } from 'react';
import { StudentData, BamPaymentRecord, BamInstallmentType, SchoolInfo, CostBreakdown } from '../../types';
import { getStoredBamPayments, saveBamPayments, getStoredCostBreakdown, saveCostBreakdown, saveSchoolInfo, getStoredSchoolInfo, getStoredFormPayments } from '../../utils/storage';
import { PaymentRepository } from '../../repositories/PaymentRepository';
import {
  BAM_CONFIG,
  BAM_BREAKDOWN_ITEMS,
  BAM_INSTALLMENT_STEPS,
  getStudentCategory,
  getTotalBamCost,
  calculateBamRemaining,
  getBamInstallmentType,
} from '../../utils/bamPricing';
import {
  FileText, Plus, Search, Filter, CheckCircle2,
  Calendar, DollarSign, Calculator, Trash2, Database, Pencil,
  Upload, Download, Save, AlertCircle, Info, Eye, Layers, ShieldCheck,
  Image as ImageIcon, ZoomIn, RefreshCw, Check
} from 'lucide-react';
import { PaymentProofModal, ProofModalData } from './PaymentProofModal';
import { getStoredPaymentProofs, downloadPaymentProof } from '../../utils/paymentProofStorage';
import { generatePaymentReceiptPDF } from '../../utils/pdfGenerator';
import {
  fetchBamPaymentsFromSupabase,
  syncSchoolInfoToSupabase,
  syncCostBreakdownToSupabase,
  syncBamPaymentsToSupabase,
} from '../../utils/supabaseClient';

interface AdminBamPaymentSectionProps {
  students: StudentData[];
  onUpdateStudents: (updated: StudentData[]) => void;
  schoolInfo?: SchoolInfo;
  onUpdateSchoolInfo?: (updated: SchoolInfo) => void;
  costBreakdowns?: CostBreakdown[];
  onUpdateCostBreakdowns?: (updated: CostBreakdown[]) => void;
}

export const AdminBamPaymentSection: React.FC<AdminBamPaymentSectionProps> = ({
  students,
  onUpdateStudents,
  schoolInfo: propSchoolInfo,
  onUpdateSchoolInfo,
  costBreakdowns: propCostBreakdowns,
  onUpdateCostBreakdowns,
}) => {
  const [records, setRecords] = useState<BamPaymentRecord[]>(() => getStoredBamPayments());

  // Function to merge BAM records from Supabase, localStorage, payment proofs, and students
  const mergeAllBamRecords = (supabaseData?: any[]) => {
    const localBamPayments = getStoredBamPayments();
    const storedProofs = getStoredPaymentProofs().filter(p => p.paymentType === 'bam');
    const recordMap = new Map<string, BamPaymentRecord>();

    // 1. Dari Supabase payments (Primary SSOT)
    if (supabaseData && supabaseData.length > 0) {
      supabaseData.forEach(p => {
        const key = p.studentId || p.registrationNumber || p.id;
        const linkedStudent = students.find(s => s.id === p.studentId || s.registrationNumber === p.registrationNumber);
        const category = getStudentCategory(linkedStudent || { category: p.category });
        const totalCost = getTotalBamCost(category);
        const amountPaid = p.amount || 0;

        recordMap.set(key, {
          id: p.id,
          transactionNumber: p.transactionNumber || p.id,
          paymentDate: p.paymentDate ? p.paymentDate.split('T')[0] : (p.createdAt ? p.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
          studentId: p.studentId,
          studentName: p.studentName || 'Calon Murid',
          registrationNumber: p.registrationNumber || 'SPMB',
          gender: p.gender || 'Laki-laki',
          totalBamCost: totalCost,
          amountPaid: amountPaid,
          installmentType: getBamInstallmentType(totalCost, amountPaid, category) as BamInstallmentType,
          totalPaidToDate: amountPaid,
          remainingBalance: calculateBamRemaining(totalCost, amountPaid),
          proofUrl: p.proofUrl,
          notes: p.notes,
        });
      });
    }

    // 2. Dari students prop yang tersimpan di database Supabase
    students.forEach(st => {
      if (st.initialPaymentProofUrl || st.initialPaymentStatus === 'verified' || st.status === 're_registered' || (st.initialPaymentAmount && st.initialPaymentAmount > 0)) {
        const key = st.id || st.registrationNumber;
        const existing = recordMap.get(key);
        const category = getStudentCategory(st);
        const totalCost = getTotalBamCost(category);
        const amountPaid = (st.initialPaymentAmount && st.initialPaymentAmount > 0)
          ? st.initialPaymentAmount
          : (existing?.amountPaid || 0);
        const remaining = calculateBamRemaining(totalCost, amountPaid);
        const installment = getBamInstallmentType(totalCost, amountPaid, category) as BamInstallmentType;

        if (existing) {
          existing.totalBamCost = totalCost;
          if (st.initialPaymentAmount && st.initialPaymentAmount > 0) {
            existing.amountPaid = st.initialPaymentAmount;
            existing.totalPaidToDate = st.initialPaymentAmount;
            existing.remainingBalance = remaining;
            existing.installmentType = installment;
          }
          if (st.initialPaymentProofUrl) existing.proofUrl = st.initialPaymentProofUrl;
          if (st.gender) existing.gender = st.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki';
          if (st.fullName) existing.studentName = st.fullName;
          if (st.initialPaymentNotes) existing.notes = st.initialPaymentNotes;
        } else {
          recordMap.set(key, {
            id: `bam_std_${st.id}`,
            transactionNumber: `TRX-BAM-${st.registrationNumber?.slice(-6) || Date.now().toString().slice(-6)}`,
            paymentDate: st.initialPaymentDate || new Date().toISOString().split('T')[0],
            studentId: st.id,
            studentName: st.fullName,
            registrationNumber: st.registrationNumber || 'SPMB',
            gender: st.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki',
            totalBamCost: totalCost,
            amountPaid: amountPaid,
            installmentType: installment,
            totalPaidToDate: amountPaid,
            remainingBalance: remaining,
            proofUrl: st.initialPaymentProofUrl,
            notes: st.initialPaymentNotes || (amountPaid > 0 ? `${installment} - Saldo Sisa: Rp ${remaining.toLocaleString('id-ID')}` : 'Belum Bayar'),
          });
        }
      }
    });

    // 3. Dari stored payment proofs jika ada
    storedProofs.forEach(sp => {
      const key = sp.studentId || sp.registrationNumber || sp.id;
      const existing = recordMap.get(key);
      if (existing) {
        if (!existing.proofUrl) existing.proofUrl = sp.dataUrl;
      }
    });

    // 4. Fallback jika map masih kosong
    if (recordMap.size === 0 && localBamPayments.length > 0) {
      localBamPayments.forEach(r => {
        const key = r.studentId || r.registrationNumber || r.id;
        recordMap.set(key, { ...r });
      });
    }

    const merged = Array.from(recordMap.values()).sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''));
    setRecords(merged);
    saveBamPayments(merged);
  };

  // Load from Supabase on mount & synchronize
  useEffect(() => {
    PaymentRepository.list('bam').then(({ data }) => {
      if (data && data.length > 0) {
        mergeAllBamRecords(data);
      } else {
        fetchBamPaymentsFromSupabase().then(cloudData => {
          mergeAllBamRecords(cloudData || []);
        });
      }
    }).catch(err => {
      console.warn('Supabase BAM load:', err);
      fetchBamPaymentsFromSupabase().then(cloudData => {
        mergeAllBamRecords(cloudData || []);
      });
    });
  }, [students]);

  const [showModal, setShowModal] = useState(false);
  const [showOfficialDocModal, setShowOfficialDocModal] = useState(false);
  const [activeProofData, setActiveProofData] = useState<ProofModalData | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGender, setFilterGender] = useState<'all' | 'Laki-laki' | 'Perempuan'>('all');
  const [filterType, setFilterType] = useState<'all' | 'Lunas' | 'Cicilan'>('all');
  const [filterProof, setFilterProof] = useState<'all' | 'has_proof' | 'no_proof'>('all');

  const handleVerifyStudentBam = (studentId: string, isVerified: boolean) => {
    const targetStudent = students.find(s => s.id === studentId);
    if (!targetStudent) return;

    const category = getStudentCategory(targetStudent);
    const totalCost = targetStudent.initialPaymentAmount || getTotalBamCost(category);

    const updatedStudents = students.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          initialPaymentStatus: isVerified ? ('verified' as const) : ('rejected' as const),
          status: isVerified ? ('re_registered' as const) : s.status,
        };
      }
      return s;
    });

    onUpdateStudents(updatedStudents);

    // Sync to Supabase
    PaymentRepository.create({
      studentId: targetStudent.id,
      registrationNumber: targetStudent.registrationNumber || `SPMB${Date.now().toString().slice(-8)}`,
      studentName: targetStudent.fullName,
      paymentType: 'bam',
      amount: totalCost,
      status: isVerified ? 'verified' : 'rejected',
      paymentMethod: 'Transfer Bank',
      bankName: 'BSI',
      paymentDate: targetStudent.initialPaymentDate || new Date().toISOString().split('T')[0],
      proofUrl: targetStudent.initialPaymentProofUrl,
      notes: targetStudent.initialPaymentNotes || 'Verifikasi Otomatis Bukti BAM Admin',
    }).catch(err => console.warn('PaymentRepository BAM verify sync error:', err));

    if (isVerified) {
      const existingRecord = records.find(r => r.studentId === studentId || r.studentName.toLowerCase() === targetStudent.fullName.toLowerCase());
      if (!existingRecord) {
        const newRecord: BamPaymentRecord = {
          id: `bam-${Date.now()}`,
          transactionNumber: `TRX-BAM-${Date.now().toString().slice(-6)}`,
          paymentDate: targetStudent.initialPaymentDate || new Date().toISOString().split('T')[0],
          studentId: targetStudent.id,
          studentName: targetStudent.fullName,
          registrationNumber: targetStudent.registrationNumber,
          gender: targetStudent.gender,
          totalBamCost: totalCost,
          amountPaid: totalCost,
          installmentType: 'Lunas',
          totalPaidToDate: totalCost,
          remainingBalance: 0,
          proofUrl: targetStudent.initialPaymentProofUrl,
          notes: targetStudent.initialPaymentNotes || 'Verifikasi Otomatis Upload Bukti BAM',
        };
        const updatedRecords = [newRecord, ...records];
        setRecords(updatedRecords);
        saveBamPayments(updatedRecords);
      }
    }
  };

  // School info & BAM Brochure Document State
  const currentSchoolInfo = propSchoolInfo || getStoredSchoolInfo();
  const [bamDocUrl, setBamDocUrl] = useState<string>(currentSchoolInfo.bamBrochureUrl || '');
  const [bamDocName, setBamDocName] = useState<string>(currentSchoolInfo.bamBrochureFileName || 'Rincian_Biaya_Awal_Masuk_SMP_AlHadiid_2026_2027.pdf');
  const [bamDocSize, setBamDocSize] = useState<string>(currentSchoolInfo.bamBrochureFileSize || '');
  const [bamDocType, setBamDocType] = useState<string>(currentSchoolInfo.bamBrochureFileType || 'application/pdf');
  const [isUploadingDoc, setIsUploadingDoc] = useState<boolean>(false);
  const [isSavingDoc, setIsSavingDoc] = useState<boolean>(false);
  const [docSaveSuccess, setDocSaveSuccess] = useState<boolean>(false);
  const [pendingBamDoc, setPendingBamDoc] = useState<{
    url: string;
    name: string;
    size: string;
    type: string;
  } | null>(null);

  // Cost Breakdown Items (Rincian Biaya Awal Masuk) State
  const [costItems, setCostItems] = useState<CostBreakdown[]>(() => propCostBreakdowns || getStoredCostBreakdown());
  const [isEditingNominals, setIsEditingNominals] = useState<boolean>(false);

  useEffect(() => {
    if (propCostBreakdowns && propCostBreakdowns.length > 0) {
      setCostItems(propCostBreakdowns);
    }
  }, [propCostBreakdowns]);

  useEffect(() => {
    if (propSchoolInfo) {
      if (propSchoolInfo.bamBrochureUrl) setBamDocUrl(propSchoolInfo.bamBrochureUrl);
      if (propSchoolInfo.bamBrochureFileName) setBamDocName(propSchoolInfo.bamBrochureFileName);
      if (propSchoolInfo.bamBrochureFileSize) setBamDocSize(propSchoolInfo.bamBrochureFileSize);
      if (propSchoolInfo.bamBrochureFileType) setBamDocType(propSchoolInfo.bamBrochureFileType);
    }
  }, [propSchoolInfo]);

  // Quick Edit Nominal Modal State
  const [showQuickNominalModal, setShowQuickNominalModal] = useState(false);
  const [quickTargetRecord, setQuickTargetRecord] = useState<BamPaymentRecord | null>(null);
  const [quickTotalCost, setQuickTotalCost] = useState<number>(BAM_CONFIG.totalInternal);
  const [quickAmountPaid, setQuickAmountPaid] = useState<number>(0);
  const [quickNotes, setQuickNotes] = useState<string>('');

  // Main Form state
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [transactionNumber, setTransactionNumber] = useState(`TRX-BAM-${Date.now().toString().slice(-6)}`);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [studentName, setStudentName] = useState('');
  const [gender, setGender] = useState<'Laki-laki' | 'Perempuan'>('Laki-laki');
  const [totalBamCost, setTotalBamCost] = useState<number>(BAM_CONFIG.totalInternal);
  const [amountPaid, setAmountPaid] = useState<number>(5000000);
  const [installmentType, setInstallmentType] = useState<BamInstallmentType>('Cicilan 1');
  const [notes, setNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Calculated sum of itemized costs
  const totalCalculatedItemsCost = costItems.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  // Auto calculate existing total paid for selected student (excluding current record being edited)
  const existingPaid = records
    .filter(
      r =>
        r.id !== editingRecordId &&
        ((selectedStudentId && r.studentId === selectedStudentId) ||
          (studentName && r.studentName.toLowerCase() === studentName.toLowerCase()))
    )
    .reduce((acc, curr) => acc + curr.amountPaid, 0);

  const totalPaidAfterThis = existingPaid + (Number(amountPaid) || 0);
  const remainingBalanceAfterThis = Math.max(0, totalBamCost - totalPaidAfterThis);

  // Handler Upload / Pilih File Brosur Dokumen Biaya Awal Masuk (Stage file)
  const handleBamDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('Ukuran file dokumen Biaya Awal Masuk maksimal 15 MB.');
      return;
    }

    setIsUploadingDoc(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64Url = reader.result as string;
      const formattedSize = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
      const fileType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

      // Stage the pending file
      setPendingBamDoc({
        url: base64Url,
        name: file.name,
        size: formattedSize,
        type: fileType,
      });

      // Update immediate visual preview
      setBamDocUrl(base64Url);
      setBamDocName(file.name);
      setBamDocSize(formattedSize);
      setBamDocType(fileType);
      setIsUploadingDoc(false);
      setDocSaveSuccess(false);

      setSuccessMsg('✓ File berhasil dipilih! Klik tombol "Simpan Data BAM yang Diupload" di bawah untuk menyimpan permanen.');
      setTimeout(() => setSuccessMsg(''), 6000);
    };
    reader.readAsDataURL(file);
  };

  // Handler Simpan Dokumen / Data BAM yang Diupload (Explicit Save Button)
  const handleSaveUploadedBamDoc = async () => {
    const docUrlToSave = pendingBamDoc?.url || bamDocUrl;
    const docNameToSave = pendingBamDoc?.name || bamDocName;
    const docSizeToSave = pendingBamDoc?.size || bamDocSize;
    const docTypeToSave = pendingBamDoc?.type || bamDocType || (docNameToSave.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

    if (!docUrlToSave) {
      alert('Belum ada file dokumen BAM yang dipilih atau diunggah. Silakan pilih file terlebih dahulu.');
      return;
    }

    setIsSavingDoc(true);
    try {
      const updatedInfo: SchoolInfo = {
        ...currentSchoolInfo,
        bamBrochureUrl: docUrlToSave,
        bamBrochureFileName: docNameToSave,
        bamBrochureFileType: docTypeToSave,
        bamBrochureFileSize: docSizeToSave,
      };

      // 1. Simpan ke Local Storage
      saveSchoolInfo(updatedInfo);

      // 2. Sinkronkan ke Database Cloud Supabase
      await syncSchoolInfoToSupabase(updatedInfo).catch(err => {
        console.warn('Gagal sinkronisasi school_info ke Supabase:', err);
      });

      // 3. Callback ke parent App/Admin state
      if (onUpdateSchoolInfo) {
        onUpdateSchoolInfo(updatedInfo);
      }

      setPendingBamDoc(null);
      setDocSaveSuccess(true);
      setSuccessMsg('✓ File Dokumen & Data Biaya Awal Masuk (BAM) Berhasil Disimpan ke Sistem & Database!');
      setTimeout(() => {
        setSuccessMsg('');
        setDocSaveSuccess(false);
      }, 5000);
    } catch (err: any) {
      alert('Gagal menyimpan data BAM: ' + (err?.message || 'Terjadi kesalahan sistem'));
    } finally {
      setIsSavingDoc(false);
    }
  };

  const handleRemoveBamDoc = async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus file Dokumen Biaya Awal Masuk ini?')) return;
    setBamDocUrl('');
    setBamDocName('');
    setBamDocSize('');
    setBamDocType('');
    setPendingBamDoc(null);
    setDocSaveSuccess(false);

    const updatedInfo: SchoolInfo = {
      ...currentSchoolInfo,
      bamBrochureUrl: '',
      bamBrochureFileName: '',
      bamBrochureFileType: '',
      bamBrochureFileSize: '',
    };

    saveSchoolInfo(updatedInfo);
    await syncSchoolInfoToSupabase(updatedInfo).catch(err => console.warn(err));
    if (onUpdateSchoolInfo) {
      onUpdateSchoolInfo(updatedInfo);
    }
    setSuccessMsg('Dokumen BAM berhasil dihapus.');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Handlers for Edit Nominal Biaya (Cost Breakdown Items)
  const handleItemAmountChange = (id: string, newAmount: number) => {
    setCostItems(prev => prev.map(item => item.id === id ? { ...item, amount: newAmount } : item));
  };

  const handleItemTitleChange = (id: string, newTitle: string) => {
    setCostItems(prev => prev.map(item => item.id === id ? { ...item, title: newTitle } : item));
  };

  const handleAddCostItem = () => {
    const newItem: CostBreakdown = {
      id: `c_${Date.now()}`,
      title: 'Biaya Penyesuaian Baru',
      amount: 100000,
      description: 'Komponen Tambahan BAM',
      isMandatory: true,
    };
    setCostItems([...costItems, newItem]);
  };

  const handleDeleteCostItem = (id: string) => {
    if (!confirm('Hapus item biaya ini dari rincian?')) return;
    setCostItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSaveCostItems = () => {
    saveCostBreakdown(costItems);
    syncCostBreakdownToSupabase(costItems).catch(e => console.warn('syncCostBreakdownToSupabase err:', e));
    if (onUpdateCostBreakdowns) {
      onUpdateCostBreakdowns(costItems);
    }
    setIsEditingNominals(false);
    setSuccessMsg('✓ Nominal Rincian Biaya Awal Masuk (BAM) Berhasil Diperbarui & Disimpan ke Database!');
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  // Handle student select
  const handleStudentSelect = (studentId: string) => {
    setSelectedStudentId(studentId);
    const s = students.find(item => item.id === studentId);
    if (s) {
      setStudentName(s.fullName);
      const isAkhwat = s.gender === 'Perempuan';
      setGender(isAkhwat ? 'Perempuan' : 'Laki-laki');
      const category = getStudentCategory(s);
      const cost = getTotalBamCost(category);
      setTotalBamCost(cost);
      setAmountPaid(category === 'Internal' ? 5000000 : 6000000);
      setInstallmentType('Cicilan 1');
    }
  };

  const handleGenderChange = (newGender: 'Laki-laki' | 'Perempuan') => {
    setGender(newGender);
  };

  // Open modal for new payment
  const handleOpenModal = () => {
    setEditingRecordId(null);
    setTransactionNumber(`TRX-BAM-${Math.floor(100000 + Math.random() * 900000)}`);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setSelectedStudentId('');
    setStudentName('');
    setGender('Laki-laki');
    setTotalBamCost(BAM_CONFIG.totalInternal);
    setAmountPaid(5000000);
    setInstallmentType('Cicilan 1');
    setNotes('');
    setShowModal(true);
  };

  // Open modal for editing record
  const handleEditRecord = (record: BamPaymentRecord) => {
    setEditingRecordId(record.id);
    setTransactionNumber(record.transactionNumber);
    setPaymentDate(record.paymentDate);
    setSelectedStudentId(record.studentId || '');
    setStudentName(record.studentName);
    setGender(record.gender);
    setTotalBamCost(record.totalBamCost);
    setAmountPaid(record.amountPaid);
    setInstallmentType(record.installmentType);
    setNotes(record.notes || '');
    setShowModal(true);
  };

  // Open Quick Edit Nominal Modal
  const handleOpenQuickNominalModal = (record: BamPaymentRecord) => {
    setQuickTargetRecord(record);
    setQuickTotalCost(record.totalBamCost);
    setQuickAmountPaid(record.amountPaid);
    setQuickNotes(record.notes || '');
    setShowQuickNominalModal(true);
  };

  // Save Quick Edit Nominal
  const handleSaveQuickNominal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTargetRecord) return;

    const targetTotal = Number(quickTotalCost) || 0;
    const targetPaid = Number(quickAmountPaid) || 0;

    // Recalculate paid & balance
    const otherPaid = records
      .filter(r => r.id !== quickTargetRecord.id && r.studentId === quickTargetRecord.studentId)
      .reduce((acc, curr) => acc + curr.amountPaid, 0);

    const newTotalPaid = otherPaid + targetPaid;
    const newRemaining = Math.max(0, targetTotal - newTotalPaid);
    const newInstallmentType: BamInstallmentType = newTotalPaid >= targetTotal ? 'Lunas' : (newTotalPaid > 0 ? 'Cicilan 1' : 'Belum Bayar');
    const autoNotes = quickNotes || (newTotalPaid > 0 ? `${newInstallmentType} - Saldo Sisa: Rp ${newRemaining.toLocaleString('id-ID')}` : 'Belum Bayar');

    const updatedRecords: BamPaymentRecord[] = records.map(r => {
      if (r.id === quickTargetRecord.id) {
        return {
          ...r,
          totalBamCost: targetTotal,
          amountPaid: targetPaid,
          installmentType: newInstallmentType,
          totalPaidToDate: newTotalPaid,
          remainingBalance: newRemaining,
          notes: autoNotes,
        };
      }
      return r;
    });

    setRecords(updatedRecords);
    saveBamPayments(updatedRecords);
    syncBamPaymentsToSupabase(updatedRecords).catch(e => console.warn('syncBamPaymentsToSupabase:', e));

    // Update student in main state and Supabase students table
    if (quickTargetRecord.studentId) {
      const isFullyPaid = newRemaining <= 0 || newInstallmentType === 'Lunas';
      const studentNotes = `${newInstallmentType} - Saldo Sisa: Rp ${newRemaining.toLocaleString('id-ID')}`;

      const updatedStudents = students.map(s => {
        if (s.id === quickTargetRecord.studentId) {
          return {
            ...s,
            initialPaymentAmount: newTotalPaid,
            initialPaymentNotes: studentNotes,
            initialPaymentStatus: (isFullyPaid ? 'verified' : 'pending') as any,
            status: isFullyPaid ? ('re_registered' as const) : s.status,
          };
        }
        return s;
      });
      onUpdateStudents(updatedStudents);

      // Persist to relational payments table (SSOT)
      PaymentRepository.create({
        studentId: quickTargetRecord.studentId,
        registrationNumber: quickTargetRecord.registrationNumber,
        studentName: quickTargetRecord.studentName,
        paymentType: 'bam',
        amount: targetPaid,
        status: isFullyPaid ? 'verified' : 'pending',
        paymentMethod: 'Transfer Bank',
        bankName: 'BSI',
        paymentDate: new Date().toISOString().split('T')[0],
        notes: autoNotes,
      }).catch(err => console.warn('PaymentRepository BAM create err in QuickNominal:', err));

      fetch(`/api/students/${quickTargetRecord.studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initial_payment_amount: newTotalPaid,
          initial_payment_notes: studentNotes,
          initial_payment_status: isFullyPaid ? 'verified' : 'pending',
          status: isFullyPaid ? 're_registered' : undefined,
        })
      }).catch(e => console.warn('Update student table err:', e));
    }

    setShowQuickNominalModal(false);
    setSuccessMsg('✓ Nominal Bayar BAM Berhasil Diinput ke Tabel & Disimpan ke Database!');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // One-click Sync to apply uploaded BAM brochure nominals across all table rows
  const handleSyncUploadedBamNominals = async () => {
    const updated = records.map(r => {
      // Check if student has initial payment recorded
      const linkedStudent = students.find(
        s => s.id === r.studentId || 
        (s.registrationNumber && s.registrationNumber === r.registrationNumber) ||
        (s.fullName && s.fullName.toLowerCase() === r.studentName.toLowerCase())
      );
      const category = getStudentCategory(linkedStudent || { category: (r as any).category });
      const targetTotal = getTotalBamCost(category);

      const paymentAmount = (linkedStudent?.initialPaymentAmount && linkedStudent.initialPaymentAmount > 0)
        ? linkedStudent.initialPaymentAmount
        : (r.amountPaid > 0 ? r.amountPaid : 0);

      const newRemaining = calculateBamRemaining(targetTotal, paymentAmount);
      const newStatus: BamInstallmentType = getBamInstallmentType(targetTotal, paymentAmount, category) as BamInstallmentType;

      return {
        ...r,
        totalBamCost: targetTotal,
        amountPaid: paymentAmount,
        totalPaidToDate: paymentAmount,
        remainingBalance: newRemaining,
        installmentType: newStatus,
        notes: r.notes || (paymentAmount > 0 ? `${newStatus} - Saldo Sisa: Rp ${newRemaining.toLocaleString('id-ID')}` : 'Belum Bayar')
      };
    });

    setRecords(updated);
    saveBamPayments(updated);
    syncBamPaymentsToSupabase(updated).catch(e => console.warn('syncBamPaymentsToSupabase:', e));

    setSuccessMsg('✓ Seluruh nominal BAM di tabel berhasil diperbarui mengikuti data dokumen BAM yang diupload! (Internal: Rp 11.000.000 | Eksternal: Rp 12.000.000)');
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  // Submit BAM payment
  const handleSubmitBam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      alert('Mohon pilih atau masukkan Nama Calon Murid');
      return;
    }

    const selectedStudent = students.find(s => s.id === selectedStudentId);
    const regNo = selectedStudent?.registrationNumber || `SPMB${Date.now().toString().slice(-8)}`;

    let updatedRecords: BamPaymentRecord[];

    if (editingRecordId) {
      updatedRecords = records.map(r => {
        if (r.id === editingRecordId) {
          return {
            ...r,
            transactionNumber,
            registrationNumber: regNo,
            studentId: selectedStudentId || r.studentId,
            studentName,
            gender,
            paymentDate,
            totalBamCost,
            amountPaid: Number(amountPaid) || 0,
            installmentType,
            totalPaidToDate: totalPaidAfterThis,
            remainingBalance: remainingBalanceAfterThis,
            notes,
          };
        }
        return r;
      });
      setSuccessMsg('✓ Perubahan transaksi Biaya Awal Masuk (BAM) berhasil disimpan!');
    } else {
      const newRecord: BamPaymentRecord = {
        id: `bampay_${Date.now()}`,
        transactionNumber,
        registrationNumber: regNo,
        studentId: selectedStudentId || `std_${Date.now()}`,
        studentName,
        gender,
        paymentDate,
        totalBamCost,
        amountPaid: Number(amountPaid) || 0,
        installmentType,
        totalPaidToDate: totalPaidAfterThis,
        remainingBalance: remainingBalanceAfterThis,
        notes,
        createdAt: new Date().toISOString(),
      };
      updatedRecords = [newRecord, ...records];
      setSuccessMsg('✓ Transaksi Biaya Awal Masuk (BAM) berhasil disimpan! Sisa saldo otomatis terhitung.');

      PaymentRepository.create({
        studentId: selectedStudentId || `std_${Date.now()}`,
        registrationNumber: regNo,
        studentName,
        paymentType: 'bam',
        amount: Number(amountPaid) || 0,
        status: remainingBalanceAfterThis <= 0 || installmentType === 'Lunas' ? 'verified' : 'pending',
        paymentMethod: 'Transfer Bank',
        bankName: 'BSI',
        paymentDate,
        notes: `${installmentType} - Saldo Sisa: Rp ${remainingBalanceAfterThis.toLocaleString('id-ID')}${notes ? ` | ${notes}` : ''}`,
      }).catch(err => console.warn('PaymentRepository BAM create err:', err));
    }

    setRecords(updatedRecords);
    saveBamPayments(updatedRecords);

    // Update student in main state if linked
    if (selectedStudentId) {
      const updatedStudents = students.map(s => {
        if (s.id === selectedStudentId) {
          const isFullyPaid = remainingBalanceAfterThis <= 0 || installmentType === 'Lunas';
          return {
            ...s,
            initialPaymentStatus: (isFullyPaid ? 'verified' : 'pending') as any,
            initialPaymentAmount: totalPaidAfterThis,
            initialPaymentDate: paymentDate,
            initialPaymentNotes: `${installmentType} - Saldo Sisa: Rp ${remainingBalanceAfterThis.toLocaleString('id-ID')}`,
            status: isFullyPaid ? ('re_registered' as const) : s.status,
          };
        }
        return s;
      });
      onUpdateStudents(updatedStudents);
    }

    setShowModal(false);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Delete transaction
  const handleDeleteRecord = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus transaksi BAM ini? Sisa saldo murid akan dihitung ulang.')) {
      const updated = records.filter(r => r.id !== id);
      setRecords(updated);
      saveBamPayments(updated);
      PaymentRepository.remove(id).catch(err => console.warn('PaymentRepository BAM remove err:', err));
    }
  };

  // Filter records
  const filteredRecords = records.filter(r => {
    const linkedStudent = students.find(
      s => s.id === r.studentId ||
      (s.registrationNumber && s.registrationNumber === r.registrationNumber) ||
      (s.fullName && s.fullName.toLowerCase() === r.studentName.toLowerCase())
    );
    const hasProof = !!(r.proofUrl || linkedStudent?.initialPaymentProofUrl);

    const matchesSearch =
      r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.transactionNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesGender = filterGender === 'all' || r.gender === filterGender;
    const matchesType =
      filterType === 'all'
        ? true
        : filterType === 'Lunas'
        ? r.installmentType === 'Lunas'
        : r.installmentType.startsWith('Cicilan');

    const matchesProof =
      filterProof === 'all' ||
      (filterProof === 'has_proof' && hasProof) ||
      (filterProof === 'no_proof' && !hasProof);

    return matchesSearch && matchesGender && matchesType && matchesProof;
  });

  // Calculate totals
  const totalBamCollected = records.reduce((acc, curr) => acc + curr.amountPaid, 0);
  const totalLunasCount = records.filter(r => r.remainingBalance === 0 || r.installmentType === 'Lunas').length;
  const totalCicilanCount = records.filter(r => r.installmentType.startsWith('Cicilan')).length;
  const countWithProof = records.filter(r => {
    const linked = students.find(s => s.id === r.studentId || s.registrationNumber === r.registrationNumber);
    return !!(r.proofUrl || linked?.initialPaymentProofUrl);
  }).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold mb-2">
            <Calculator className="w-3.5 h-3.5 text-blue-600" />
            <span>Sistem Biaya Awal Masuk (BAM) & Pengaturan Nominal</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Upload & Pengaturan Biaya Awal Masuk (BAM)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Unggah brosur resmi rincian biaya, atur nominal komponen biaya, dan edit nominal pembayaran murid secara langsung.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowOfficialDocModal(true)}
            className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold text-xs rounded-xl border border-indigo-200 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Eye className="w-4 h-4 text-indigo-600" />
            <span>Lihat Tabel Rincian Resmi</span>
          </button>
          <button
            onClick={handleOpenModal}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Input Pembayaran BAM</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* SECTION 1: FITUR UPLOAD BIAYA AWAL MASUK (BAM) & EDIT NOMINAL RINCIAN BIAYA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CARD 1: FITUR UPLOAD DOKUMEN / BROSUR BIAYA AWAL MASUK */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-600" />
                <span>Upload Dokumen / Brosur BAM</span>
              </h3>
              <div className="flex items-center gap-1.5">
                {bamDocUrl && (
                  <button
                    id="btn-save-bam-doc-header"
                    type="button"
                    onClick={handleSaveUploadedBamDoc}
                    disabled={isSavingDoc}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1 shadow-sm transition-all cursor-pointer ${
                      pendingBamDoc
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400 animate-pulse'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                    title="Simpan data dokumen BAM yang diupload ke database"
                  >
                    <Save className="w-3.5 h-3.5 text-emerald-200" />
                    <span>{isSavingDoc ? 'Menyimpan...' : 'Simpan BAM'}</span>
                  </button>
                )}
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                  PDF / Gambar
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              Unggah file rincian Biaya Awal Masuk agar dapat diunduh/dilihat oleh Calon Wali Murid di portal utama.
            </p>

            {bamDocUrl ? (
              <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden flex-1">
                    <div className="font-bold text-slate-900 text-xs truncate">{bamDocName}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-slate-500 font-semibold">{bamDocSize || 'Tersimpan'}</span>
                      <span className="text-[10px] text-slate-300">•</span>
                      {pendingBamDoc ? (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                          File Baru — Klik Simpan
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                          ✓ Tersimpan di Sistem
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* TOMBOL SIMPAN UTAMA UNTUK DATA BAM YANG DIUPLOAD */}
                <button
                  id="btn-save-uploaded-bam-doc"
                  type="button"
                  onClick={handleSaveUploadedBamDoc}
                  disabled={isSavingDoc}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-98 disabled:opacity-60 ${
                    pendingBamDoc
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400 animate-pulse'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                  title="Simpan data dokumen BAM yang diupload ke database dan sistem"
                >
                  {isSavingDoc ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  ) : docSaveSuccess ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  ) : (
                    <Save className="w-4 h-4 text-emerald-200" />
                  )}
                  <span>
                    {isSavingDoc
                      ? 'Menyimpan ke Database Supabase...'
                      : docSaveSuccess
                      ? 'Data BAM Berhasil Disimpan!'
                      : pendingBamDoc
                      ? 'Simpan Data BAM yang Diupload'
                      : 'Simpan Data BAM yang Diupload'}
                  </span>
                </button>

                {/* ACTION BUTTONS: GANTI FILE, UNDUH, HAPUS */}
                <div className="flex gap-2 pt-1">
                  <label className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg text-center flex items-center justify-center gap-1 cursor-pointer transition-all border border-slate-300">
                    <Upload className="w-3.5 h-3.5 text-slate-600" />
                    <span>Ganti File</span>
                    <input
                      type="file"
                      accept="application/pdf,image/png,image/jpeg,image/webp"
                      onChange={handleBamDocUpload}
                      className="hidden"
                      disabled={isUploadingDoc}
                    />
                  </label>
                  <a
                    href={bamDocUrl}
                    download={bamDocName}
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg text-center flex items-center justify-center gap-1 shadow-sm transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Dokumen</span>
                  </a>
                  <button
                    onClick={handleRemoveBamDoc}
                    className="px-3 py-2 bg-rose-100 text-rose-700 hover:bg-rose-200 font-bold text-xs rounded-lg cursor-pointer transition-all"
                    title="Hapus Dokumen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <label className="block border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/30 hover:bg-indigo-50/60 p-5 rounded-2xl text-center cursor-pointer transition-all">
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  onChange={handleBamDocUpload}
                  className="hidden"
                  disabled={isUploadingDoc}
                />
                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-2">
                  <Upload className="w-6 h-6 animate-bounce" />
                </div>
                <div className="text-xs font-bold text-indigo-900">
                  {isUploadingDoc ? 'Mengunggah file...' : 'Klik untuk Upload Biaya Awal Masuk'}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Format: PDF, PNG, JPG (Maks. 15MB)</div>
              </label>
            )}
          </div>

          <div className="text-[11px] bg-amber-50 text-amber-900 p-3 rounded-xl border border-amber-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>File rincian yang diunggah akan langsung tersimpan ke sistem dan muncul di dashboard wali murid.</span>
          </div>
        </div>

        {/* CARD 2: TABEL EDIT NOMINAL RINCIAN BIAYA AWAL MASUK */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-600" />
                <span>Rincian & Edit Nominal Biaya Awal Masuk (BAM)</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Sesuaikan nominal biaya komponen secara mandiri untuk perhitungan total BAM.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isEditingNominals ? (
                <>
                  <button
                    onClick={handleAddCostItem}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Biaya</span>
                  </button>
                  <button
                    onClick={handleSaveCostItems}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg shadow-sm flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Nominal</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditingNominals(true)}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-lg shadow-sm flex items-center gap-1 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Fitur Edit Nominal</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b font-bold text-slate-700 sticky top-0 bg-slate-100 z-10">
                  <th className="p-2">No</th>
                  <th className="p-2">Komponen / Rincian Biaya</th>
                  <th className="p-2">Nominal Biaya (Rp)</th>
                  <th className="p-2">Keterangan</th>
                  {isEditingNominals && <th className="p-2 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {costItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-2 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                    <td className="p-2 font-bold text-slate-800">
                      {isEditingNominals ? (
                        <input
                          type="text"
                          value={item.title}
                          onChange={e => handleItemTitleChange(item.id, e.target.value)}
                          className="w-full p-1 border rounded text-xs font-semibold"
                        />
                      ) : (
                        item.title
                      )}
                    </td>
                    <td className="p-2 font-extrabold text-emerald-700">
                      {isEditingNominals ? (
                        <input
                          type="number"
                          value={item.amount}
                          onChange={e => handleItemAmountChange(item.id, Number(e.target.value))}
                          className="w-full p-1 border border-emerald-300 bg-emerald-50/50 rounded text-xs font-extrabold text-emerald-900"
                        />
                      ) : (
                        `Rp ${item.amount.toLocaleString('id-ID')}`
                      )}
                    </td>
                    <td className="p-2 text-[11px] text-slate-500">{item.description}</td>
                    {isEditingNominals && (
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleDeleteCostItem(item.id)}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between font-bold text-xs shadow-inner">
            <span className="text-slate-300">Standard Ikhwan: Rp 6.670.000 | Akhwat: Rp 6.890.000</span>
            <span className="text-base text-amber-300 font-extrabold">
              Akumulasi Tabel: Rp {totalCalculatedItemsCost.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Total Dana BAM Terkumpul</div>
          <div className="text-xl sm:text-2xl font-extrabold text-blue-900 mt-1">
            Rp {totalBamCollected.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-emerald-600 font-bold mt-0.5">{records.length} Transaksi Terdata</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-emerald-700 uppercase">Siswa Lunas Direct BAM</div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-800 mt-1">{totalLunasCount} Siswa</div>
          <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Saldo Sisa Rp 0</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-amber-700 uppercase">Siswa Skema Cicilan</div>
          <div className="text-xl sm:text-2xl font-extrabold text-amber-800 mt-1">{totalCicilanCount} Siswa</div>
          <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Angsuran Berjalan</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-indigo-700 uppercase">Standard Target BAM</div>
          <div className="text-xl sm:text-2xl font-extrabold text-indigo-900 mt-1">
            Rp 6.670.000 / Rp 6.890.000
          </div>
          <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Ikhwan (L) / Akhwat (P)</div>
        </div>
      </div>

      {/* SECTION VERIFIKASI BUKTI TRANSFER BAM DARI CALON MURID */}
      {(() => {
        const pendingProofStudents = students.filter(s => !!s.initialPaymentProofUrl);
        if (pendingProofStudents.length === 0) return null;

        return (
          <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-indigo-950 text-white p-5 rounded-2xl border border-emerald-500/30 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-emerald-400">
                    Verifikasi Bukti Transfer BAM Terunggah Calon Murid ({pendingProofStudents.length} Pendaftar)
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Daftar calon murid yang telah mengunggah foto Bukti Transfer Biaya Awal Masuk di Dashboard Murid.
                  </p>
                </div>
              </div>
              <span className="text-xs bg-emerald-400/20 text-emerald-300 font-bold px-3 py-1 rounded-full border border-emerald-400/30">
                Memerlukan Verifikasi Admin
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingProofStudents.map(st => (
                <div key={st.id} className="bg-slate-900/90 p-4 rounded-xl border border-slate-700 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] bg-slate-800 text-amber-300 font-bold px-2 py-0.5 rounded">
                        {st.registrationNumber}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        st.initialPaymentStatus === 'verified'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : st.initialPaymentStatus === 'rejected'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                      }`}>
                        {st.initialPaymentStatus === 'verified'
                          ? '✓ VERIFIED LUNAS'
                          : st.initialPaymentStatus === 'rejected'
                          ? '✕ DITOLAK'
                          : '⏳ MENUNGGU VERIFIKASI'}
                      </span>
                    </div>

                    <div>
                      <div className="font-extrabold text-sm text-white">{st.fullName}</div>
                      <div className="text-[11px] text-slate-400">
                        {st.gender} • Tgl: {st.initialPaymentDate || '-'}
                      </div>
                      {st.initialPaymentAmount ? (
                        <div className="text-xs font-mono font-bold text-amber-300 mt-1">
                          Nominal: Rp {st.initialPaymentAmount.toLocaleString('id-ID')}
                        </div>
                      ) : null}
                      {st.initialPaymentNotes ? (
                        <div className="text-[10px] text-slate-300 italic truncate mt-0.5">
                          "{st.initialPaymentNotes}"
                        </div>
                      ) : null}
                    </div>

                    {/* Image Thumbnail */}
                    {st.initialPaymentProofUrl && (
                      <div className="relative group rounded-lg overflow-hidden border border-slate-700 bg-slate-950 h-28 flex items-center justify-center p-1">
                        <img
                          src={st.initialPaymentProofUrl}
                          alt="Bukti Transfer"
                          className="max-h-26 object-contain rounded"
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={() => setActiveProofData({
                            url: st.initialPaymentProofUrl!,
                            studentName: st.fullName,
                            regNo: st.registrationNumber || 'NO-REG',
                            paymentType: 'bam',
                            amount: st.initialPaymentAmount || getTotalBamCost(getStudentCategory(st)),
                            status: st.initialPaymentStatus || 'pending',
                            date: st.initialPaymentDate,
                            notes: st.initialPaymentNotes,
                            gender: st.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki',
                          })}
                          className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1 cursor-pointer"
                        >
                          <Eye className="w-4 h-4 text-amber-300" />
                          <span>Lihat & Perbesar Gambar</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleVerifyStudentBam(st.id, true)}
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verifikasi Lunas</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerifyStudentBam(st.id, false)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-900 text-slate-300 hover:text-white font-bold text-xs rounded-lg transition-all cursor-pointer"
                    >
                      Tolak
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Search & Filter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari Nama / No Transaksi / Reg..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Proof Filter Buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setFilterProof('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                filterProof === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({records.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterProof('has_proof')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                filterProof === 'has_proof' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ImageIcon className="w-3 h-3" />
              <span>Ada Bukti ({countWithProof})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterProof('no_proof')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                filterProof === 'no_proof' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Belum Upload ({records.length - countWithProof})
            </button>
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="font-bold text-slate-600 shrink-0">Gender:</span>
            <select
              value={filterGender}
              onChange={e => setFilterGender(e.target.value as any)}
              className="w-full sm:w-auto border border-slate-300 rounded-lg p-1.5 text-xs bg-white font-semibold"
            >
              <option value="all">Semua Gender</option>
              <option value="Laki-laki">Laki-laki (Ikhwan)</option>
              <option value="Perempuan">Perempuan (Akhwat)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="font-bold text-slate-600 shrink-0">Skema:</span>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
              className="w-full sm:w-auto border border-slate-300 rounded-lg p-1.5 text-xs bg-white font-semibold"
            >
              <option value="all">Semua Skema</option>
              <option value="Lunas">Lunas Direct</option>
              <option value="Cicilan">Diangsur (Cicilan)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Data Pembayaran BAM */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-600" />
              <span>Tabel Pembayaran BAM & Pengurangan Saldo Sisa ({filteredRecords.length} Transaksi)</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Target BAM Dokumen: <span className="font-bold text-slate-700">Internal Rp 11.000.000</span> | <span className="font-bold text-slate-700">Eksternal Rp 12.000.000</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <button
              type="button"
              onClick={handleSyncUploadedBamNominals}
              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
              title="Perbarui seluruh nominal BAM di tabel agar mengikuti data dokumen brosur yang telah diupload"
            >
              <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
              <span>Perbarui Nominal Sesuai Data BAM</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingRecordId(null);
                setSelectedStudentId('');
                setStudentName('');
                setGender('Laki-laki');
                setTotalBamCost(BAM_CONFIG.totalInternal);
                setAmountPaid(5000000);
                setInstallmentType('Cicilan 1');
                setNotes('Tahap 1 (Saat Daftar Ulang)');
                setShowModal(true);
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-98"
              title="Input nominal bayar BAM murid baru langsung ke dalam tabel"
            >
              <Plus className="w-4 h-4 text-emerald-100" />
              <span>+ Input Nominal Bayar BAM ke Tabel</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-100 border-b font-bold text-slate-700 whitespace-nowrap">
                <th className="p-3">No</th>
                <th className="p-3">No. Transaksi</th>
                <th className="p-3">Tgl Pembayaran</th>
                <th className="p-3">Nama Calon Murid</th>
                <th className="p-3">Jenis Kelamin</th>
                <th className="p-3">Total Nominal BAM</th>
                <th className="p-3">Nominal Bayar</th>
                <th className="p-3">Status / Cicilan</th>
                <th className="p-3">Total Terbayar</th>
                <th className="p-3">Saldo Sisa Tagihan</th>
                <th className="p-3 text-center">Bukti Transfer</th>
                <th className="p-3 text-center">Aksi (Edit Nominal Saja)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-slate-400 italic font-medium">
                    Belum ada data transaksi BAM yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, idx) => {
                  const linkedStudent = students.find(
                    s => s.id === r.studentId ||
                    (s.registrationNumber && s.registrationNumber === r.registrationNumber) ||
                    (s.fullName && s.fullName.toLowerCase() === r.studentName.toLowerCase())
                  );
                  const proofUrl = r.proofUrl || linkedStudent?.initialPaymentProofUrl;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50 font-medium whitespace-nowrap">
                      <td className="p-3 text-slate-500 font-mono">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-blue-700">{r.transactionNumber}</td>
                      <td className="p-3 text-slate-600">{r.paymentDate}</td>
                      <td className="p-3 font-bold text-slate-900">{r.studentName}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          r.gender === 'Perempuan' ? 'bg-pink-100 text-pink-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {r.gender}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 font-semibold">
                        Rp {r.totalBamCost.toLocaleString('id-ID')}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-blue-700 text-xs sm:text-sm">
                            Rp {r.amountPaid.toLocaleString('id-ID')}
                          </span>
                          <button
                            onClick={() => handleOpenQuickNominalModal(r)}
                            className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded border border-amber-200 cursor-pointer transition-colors shadow-xs"
                            title="Input / Edit Nominal Bayar Transaksi BAM Ini"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          r.installmentType === 'Lunas'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {r.installmentType}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-800">
                        Rp {r.totalPaidToDate.toLocaleString('id-ID')}
                      </td>
                      <td className="p-3">
                        {r.remainingBalance === 0 ? (
                          <span className="font-extrabold text-emerald-600 flex items-center gap-1">
                            ✓ LUNAS
                          </span>
                        ) : (
                          <span className="font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                            Sisa: Rp {r.remainingBalance.toLocaleString('id-ID')}
                          </span>
                        )}
                      </td>
                      {/* BUKTI TRANSFER BAM COLUMN */}
                      <td className="p-3 text-center">
                        {proofUrl ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <div
                              onClick={() => setActiveProofData({
                                url: proofUrl,
                                studentName: r.studentName,
                                regNo: r.registrationNumber || 'SPMB',
                                paymentType: 'bam',
                                amount: r.amountPaid,
                                status: linkedStudent?.initialPaymentStatus || (r.installmentType === 'Lunas' ? 'verified' : 'pending'),
                                date: r.paymentDate,
                                notes: r.notes || linkedStudent?.initialPaymentNotes,
                                gender: r.gender,
                              })}
                              className="relative group w-9 h-9 rounded-lg border border-slate-300 overflow-hidden bg-slate-900 cursor-pointer shrink-0 hover:ring-2 hover:ring-blue-500 transition-all shadow-xs"
                              title="Klik untuk lihat bukti transfer BAM penuh"
                            >
                              <img
                                src={proofUrl}
                                alt="Bukti BAM"
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                <Eye className="w-3.5 h-3.5 text-amber-300" />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveProofData({
                                url: proofUrl,
                                studentName: r.studentName,
                                regNo: r.registrationNumber || 'SPMB',
                                paymentType: 'bam',
                                amount: r.amountPaid,
                                status: linkedStudent?.initialPaymentStatus || (r.installmentType === 'Lunas' ? 'verified' : 'pending'),
                                date: r.paymentDate,
                                notes: r.notes || linkedStudent?.initialPaymentNotes,
                                gender: r.gender,
                              })}
                              className="px-2 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-300 hover:border-blue-300 rounded-md font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                              title="Lihat Bukti Transfer BAM"
                            >
                              <Eye className="w-3 h-3 text-blue-600" />
                              <span>Lihat</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadPaymentProof(proofUrl, `Bukti_BAM_${r.registrationNumber || r.studentName}.jpg`)}
                              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                              title="Download Bukti Transfer BAM"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-600" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded italic">
                            Belum Upload
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => generatePaymentReceiptPDF(
                              {
                                id: r.id,
                                amount: r.amountPaid,
                                payment_type: 'daftar_ulang',
                                payment_date: r.paymentDate,
                                payment_method: (r as any).paymentMethod || 'Transfer Bank BSI',
                                status: (r as any).status || 'verified',
                                verified_by: (r as any).verifiedBy || 'Admin Panitia Keuangan',
                                notes: `Skema: ${r.installmentType || 'BAM'}`,
                              },
                              { registrationNumber: r.registrationNumber, fullName: r.studentName },
                              currentSchoolInfo || ({} as any)
                            )}
                            className="p-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg transition-colors cursor-pointer"
                            title="Cetak Kuitansi Resmi Pembayaran BAM (PDF)"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenQuickNominalModal(r)}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer shadow-sm transition-all"
                            title="Fitur Edit Nominal Saja untuk Menyesuaikan Jumlah Biaya"
                          >
                          <DollarSign className="w-3.5 h-3.5 text-slate-950" />
                          <span>Edit Nominal</span>
                        </button>
                        <button
                          onClick={() => handleEditRecord(r)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Seluruh Data Transaksi"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(r.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Transaksi"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL QUICK EDIT NOMINAL SAJA */}
      {showQuickNominalModal && quickTargetRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Input / Edit Nominal Bayar BAM ke Tabel</span>
              </h3>
              <button
                onClick={() => setShowQuickNominalModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuickNominal} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-bold text-slate-800 text-sm">{quickTargetRecord.studentName} ({quickTargetRecord.gender})</div>
                <div className="text-slate-500">No. Transaksi: <span className="font-mono text-blue-700 font-bold">{quickTargetRecord.transactionNumber}</span></div>
                <div className="text-slate-500">Status Saat Ini: <span className="font-bold text-slate-700">{quickTargetRecord.installmentType}</span></div>
              </div>

              {/* Pilihan Cepat Sesuai Brosur BAM yang Diupload */}
              {(() => {
                const linkedStudent = students.find(s => s.id === quickTargetRecord.studentId || s.registrationNumber === quickTargetRecord.registrationNumber);
                const category = getStudentCategory(linkedStudent || { category: (quickTargetRecord as any).category });
                const officialTotal = getTotalBamCost(category);
                const lunasDirect = officialTotal - 500000;
                const tahap1 = category === 'Internal' ? 5000000 : 6000000;

                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-700 text-[11px]">Pilih Nominal Berdasarkan Brosur BAM ({category}):</div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">{category}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setQuickTotalCost(officialTotal);
                          setQuickAmountPaid(lunasDirect);
                          setQuickNotes('Pilihan 1 (Lunas Langsung - Diskon Rp 500.000)');
                        }}
                        className="p-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-left transition-colors cursor-pointer"
                      >
                        <div className="font-bold text-emerald-900 text-[11px]">Pilihan 1: Lunas Langsung</div>
                        <div className="text-emerald-700 font-extrabold text-sm mt-0.5">
                          Rp {lunasDirect.toLocaleString('id-ID')}
                        </div>
                        <div className="text-[10px] text-emerald-600 font-semibold">Diskon Khusus Rp 500.000 • Sisa Rp 0</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setQuickTotalCost(officialTotal);
                          setQuickAmountPaid(tahap1);
                          setQuickNotes('Tahap 1 (Saat Daftar Ulang)');
                        }}
                        className="p-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-left transition-colors cursor-pointer"
                      >
                        <div className="font-bold text-amber-900 text-[11px]">Tahap 1: Saat Daftar Ulang</div>
                        <div className="text-amber-800 font-extrabold text-sm mt-0.5">
                          Rp {tahap1.toLocaleString('id-ID')}
                        </div>
                        <div className="text-[10px] text-amber-700 font-semibold">
                          Sisa Saldo: Rp {(officialTotal - tahap1).toLocaleString('id-ID')}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setQuickTotalCost(officialTotal);
                          setQuickAmountPaid(tahap1 + 3000000);
                          setQuickNotes('Tahap 2 (Sebelum Masuk Sekolah / Juni)');
                        }}
                        className="p-2 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-left transition-colors cursor-pointer"
                      >
                        <div className="font-bold text-blue-900 text-[11px]">Tahap 2: Sebelum Masuk Sekolah</div>
                        <div className="text-blue-800 font-bold text-xs mt-0.5">+ Rp 3.000.000 (Total Rp {(tahap1 + 3000000).toLocaleString('id-ID')})</div>
                        <div className="text-[10px] text-blue-600">Sisa: Rp {Math.max(0, officialTotal - (tahap1 + 3000000)).toLocaleString('id-ID')}</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setQuickTotalCost(officialTotal);
                          setQuickAmountPaid(officialTotal);
                          setQuickNotes('Tahap 3 (Sebelum PTS Semester 1 / Pelunasan Penuh)');
                        }}
                        className="p-2 rounded-xl border border-purple-200 bg-purple-50/70 hover:bg-purple-100 text-left transition-colors cursor-pointer"
                      >
                        <div className="font-bold text-purple-900 text-[11px]">Tahap 3: Sebelum PTS (Pelunasan)</div>
                        <div className="text-purple-800 font-bold text-xs mt-0.5">Lunas Rp {officialTotal.toLocaleString('id-ID')}</div>
                        <div className="text-[10px] text-purple-600">Pelunasan 100% Selesai</div>
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Target Total Biaya BAM Murid Ini (Rp) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  value={quickTotalCost}
                  onChange={e => setQuickTotalCost(Number(e.target.value))}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 text-sm focus:ring-2 focus:ring-blue-500"
                />
                <div className="text-[10px] text-slate-500 mt-1">
                  Standard Brosur Uploaded: <span className="font-bold text-slate-700">Internal Rp 11.000.000</span> | <span className="font-bold text-slate-700">Eksternal Rp 12.000.000</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nominal Bayar Murid Ini ke Tabel (Rp) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  value={quickAmountPaid}
                  onChange={e => setQuickAmountPaid(Number(e.target.value))}
                  className="w-full p-2.5 border border-emerald-400 bg-emerald-50/50 rounded-xl font-extrabold text-emerald-900 text-base focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Catatan Pembayaran / Penyesuaian Nominal
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Pilihan 2 (Cicilan 1) / Keringanan"
                  value={quickNotes}
                  onChange={e => setQuickNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-800 font-medium"
                />
              </div>

              {/* Box Kalkulasi Pengurangan Saldo */}
              <div className="p-3 bg-slate-900 text-white rounded-xl space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Total Biaya BAM:</span>
                  <span className="font-bold text-amber-300">Rp {(Number(quickTotalCost) || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Nominal Terbayar:</span>
                  <span className="font-bold text-emerald-400">Rp {(Number(quickAmountPaid) || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-700 font-bold">
                  <span className="text-slate-400">Sisa Saldo Tagihan:</span>
                  <span className={Math.max(0, (Number(quickTotalCost) || 0) - (Number(quickAmountPaid) || 0)) === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    Rp {Math.max(0, (Number(quickTotalCost) || 0) - (Number(quickAmountPaid) || 0)).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400">Status Skema:</span>
                  <span className="font-bold text-blue-300">
                    {(Number(quickAmountPaid) || 0) >= (Number(quickTotalCost) || 0) ? 'LUNAS (100%)' : ((Number(quickAmountPaid) || 0) > 0 ? 'CICILAN 1' : 'BELUM BAYAR')}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex gap-2 justify-end border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowQuickNominalModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-98"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Nominal ke Tabel</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Input/Edit Full Transaksi BAM */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <Calculator className="w-5 h-5 text-blue-600 shrink-0" />
                <span>{editingRecordId ? 'Edit Transaksi Biaya Awal Masuk (BAM)' : 'Form Transaksi Biaya Awal Masuk (BAM)'}</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitBam} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Pilih Calon Murid Terdaftar (Otomatis Isi Data)
                </label>
                <select
                  value={selectedStudentId}
                  onChange={e => handleStudentSelect(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Pilih dari Daftar Pendaftar atau Ketik Manual --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.registrationNumber || 'No-Reg'}) - {s.gender}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    No. Transaksi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={transactionNumber}
                    onChange={e => setTransactionNumber(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-800 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tanggal Pembayaran <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-medium text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Calon Murid <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masukkan Nama Lengkap Murid"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Jenis Kelamin <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={gender}
                    onChange={e => handleGenderChange(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold text-slate-800"
                  >
                    <option value="Laki-laki">Laki-laki (Ikhwan)</option>
                    <option value="Perempuan">Perempuan (Akhwat)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Skema / Cicilan Ke <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={installmentType}
                    onChange={e => setInstallmentType(e.target.value as any)}
                    className="w-full p-2.5 border border-blue-300 bg-blue-50 rounded-xl font-bold text-blue-900"
                  >
                    <option value="Lunas">Lunas Direct (100%)</option>
                    <option value="Cicilan 1">Cicilan 1 (Angsuran Pertama / DP)</option>
                    <option value="Cicilan 2">Cicilan 2</option>
                    <option value="Cicilan 3">Cicilan 3</option>
                    <option value="Cicilan 4">Cicilan 4</option>
                    <option value="Cicilan 5">Cicilan 5</option>
                    <option value="Cicilan 6">Cicilan 6</option>
                    <option value="Cicilan 7">Cicilan 7</option>
                    <option value="Cicilan 8">Cicilan 8</option>
                    <option value="Cicilan 9">Cicilan 9</option>
                    <option value="Cicilan 10">Cicilan 10</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Total Nominal BAM (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={totalBamCost}
                    onChange={e => setTotalBamCost(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nominal Bayar Transaksi Ini <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={amountPaid}
                    onChange={e => setAmountPaid(Number(e.target.value))}
                    className="w-full p-2.5 border border-blue-300 bg-blue-50/50 rounded-xl font-extrabold text-blue-900 text-sm"
                  />
                </div>
              </div>

              {/* Automatic Deducting Balance Calculator Box */}
              <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-2 border border-slate-800">
                <div className="text-[11px] font-bold text-blue-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Kalkulator Saldo Sisa Otomatis</span>
                  <Calculator className="w-3.5 h-3.5" />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400">Total Biaya BAM:</span>
                    <div className="font-bold text-slate-200">Rp {totalBamCost.toLocaleString('id-ID')}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Terbayar Sebelum Ini:</span>
                    <div className="font-bold text-amber-300">Rp {existingPaid.toLocaleString('id-ID')}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Bayar Transaksi Ini:</span>
                    <div className="font-bold text-emerald-400">+ Rp {(Number(amountPaid) || 0).toLocaleString('id-ID')}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Sisa Tagihan Setelah Ini:</span>
                    <div className="font-extrabold text-amber-400">Rp {remainingBalanceAfterThis.toLocaleString('id-ID')}</div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan / Keterangan</label>
                <textarea
                  rows={2}
                  placeholder="Catatan tambahan pembayaran (opsional)"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-medium"
                />
              </div>

              <div className="pt-2 flex gap-2 justify-end border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-98"
                >
                  <Save className="w-4 h-4 text-emerald-200" />
                  <span>{editingRecordId ? 'Simpan Perubahan Transaksi BAM' : 'Simpan Data Pembayaran BAM'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL LIHAT TABEL RINCIAN RESMI BIAYA AWAL MASUK (SESUAI DOKUMEN RESMI) */}
      {showOfficialDocModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  <span>RINCIAN BIAYA AWAL MASUK (BAM) SMP AL-HADIID CILEUNGSI</span>
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">Tahun Pelajaran 2026/2027 • Yayasan Al-Hadiid</p>
              </div>
              <button
                onClick={() => setShowOfficialDocModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl font-bold text-indigo-900 flex justify-between items-center">
                <span>A. FORMULIR PENDAFTARAN</span>
                <span className="text-base text-indigo-700 font-extrabold">Rp. 200.000</span>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-2">B. BIAYA AWAL MASUK (BAM) RESMI</h4>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-800 text-white font-bold">
                        <th className="p-2 text-center">NO</th>
                        <th className="p-2">JENIS KEUANGAN</th>
                        <th className="p-2">INTERNAL (AL-HADIID)</th>
                        <th className="p-2">EKSTERNAL (UMUM)</th>
                        <th className="p-2">KET.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      <tr><td className="p-2 text-center">1</td><td className="p-2 font-bold">Dana Sarana & Prasarana</td><td className="p-2 font-semibold text-slate-800">Rp 4.500.000</td><td className="p-2 font-semibold text-slate-800">Rp 5.500.000</td><td className="p-2 text-slate-500">Sekali</td></tr>
                      <tr><td className="p-2 text-center">2</td><td className="p-2">Seragam Sekolah (5 Stel Lengkap)</td><td className="p-2">Rp 1.500.000</td><td className="p-2">Rp 1.500.000</td><td className="p-2 text-slate-500">Sekali</td></tr>
                      <tr><td className="p-2 text-center">3</td><td className="p-2">Buku Paket & Modul Pembelajaran (1 Tahun)</td><td className="p-2">Rp 1.200.000</td><td className="p-2">Rp 1.200.000</td><td className="p-2 text-slate-500">Per Tahun</td></tr>
                      <tr><td className="p-2 text-center">4</td><td className="p-2">Kegiatan Kesiswaan & Dauroh Al-Qur'an</td><td className="p-2">Rp 1.000.000</td><td className="p-2">Rp 1.000.000</td><td className="p-2 text-slate-500">Per Tahun</td></tr>
                      <tr><td className="p-2 text-center">5</td><td className="p-2">Ekstrakurikuler Wajib & Pilihan</td><td className="p-2">Rp 800.000</td><td className="p-2">Rp 800.000</td><td className="p-2 text-slate-500">Per Tahun</td></tr>
                      <tr><td className="p-2 text-center">6</td><td className="p-2">Masa Pengenalan Lingkungan Sekolah (MPLS)</td><td className="p-2">Rp 500.000</td><td className="p-2">Rp 500.000</td><td className="p-2 text-slate-500">Sekali</td></tr>
                      <tr><td className="p-2 text-center">7</td><td className="p-2">SPP Bulan Pertama (Bulan Juli)</td><td className="p-2">Rp 1.500.000</td><td className="p-2">Rp 1.500.000</td><td className="p-2 text-slate-500">Bulan Pertama</td></tr>
                      <tr className="bg-slate-900 text-white font-extrabold text-sm">
                        <td colSpan={2} className="p-3 text-right">TOTAL BIAYA RESMI:</td>
                        <td className="p-3 text-amber-300">Rp 11.000.000</td>
                        <td className="p-3 text-amber-300">Rp 12.000.000</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-900">Skema & Tahapan Pembayaran BAM Resmi:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <span className="font-bold text-emerald-900">Pilihan 1: Pembayaran Lunas Langsung</span>
                    <div className="text-emerald-700 font-extrabold mt-0.5">Internal: Rp 10.500.000 | Eksternal: Rp 11.500.000</div>
                    <div className="text-[10px] text-emerald-600 mt-0.5 font-semibold">Mendapat Potongan Diskon Khusus Rp 500.000 • Sisa Tagihan Rp 0</div>
                  </div>
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                    <span className="font-bold text-amber-900">Pilihan 2: Pembayaran Bertahap (3 Tahap)</span>
                    <div className="text-amber-800 font-bold mt-0.5 text-[11px]">
                      • Tahap 1: Internal Rp 5.000.000 / Eksternal Rp 6.000.000 (Saat Daftar Ulang)
                    </div>
                    <div className="text-amber-800 font-bold text-[11px]">
                      • Tahap 2: Rp 3.000.000 (Sebelum Masuk Sekolah / Juni)
                    </div>
                    <div className="text-amber-800 font-bold text-[11px]">
                      • Tahap 3: Rp 3.000.000 (Sebelum PTS Semester 1 / Oktober)
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1 text-slate-700">
                <div className="font-bold text-blue-900">Rekening Pembayaran Resmi:</div>
                <div className="font-bold text-slate-900">Bank Syariah Indonesia (BSI) No. Rek: <span className="text-blue-700 font-mono text-sm">3953157480</span> a.n. Al-Hadiid (Kode Bank: 451)</div>
                <div className="text-[11px] text-slate-500">WA Admin SMP: 0858 1499 8782</div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowOfficialDocModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      )}


      {/* PAYMENT PROOF MODAL FOR ADMIN */}
      <PaymentProofModal
        isOpen={!!activeProofData}
        onClose={() => setActiveProofData(null)}
        data={activeProofData}
        onVerify={activeProofData ? (approved) => {
          const matchedStudent = students.find(
            s => s.fullName.toLowerCase() === activeProofData.studentName.toLowerCase() ||
                 s.registrationNumber === activeProofData.regNo
          );
          if (matchedStudent) {
            handleVerifyStudentBam(matchedStudent.id, approved);
            setActiveProofData(null);
          }
        } : undefined}
      />
    </div>
  );
};
