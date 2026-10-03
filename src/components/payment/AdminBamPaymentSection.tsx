// =====================================================================
// src/components/payment/AdminBamPaymentSection.tsx
// Modul Pengelolaan & Pembayaran Biaya Awal Masuk (BAM)
// SPMB SMPS Al-Hadiid Cileungsi
//
// FITUR LENGKAP:
// A. Audit & Single Source of Truth Supabase
// B. Nominal BAM Ikhwan & Akhwat Terpisah Ketat
// C. Struktur Data BAM (id, gender, nama_item, nominal, urutan, aktif)
// D. Alur Upload File -> Preview -> Validasi -> Tombol [SIMPAN DATA BAM]
// E. Validasi Ketat Sebelum Simpan (Deteksi Baris & Kolom Bermasalah)
// F. Tab Pengelolaan BAM Terpisah: IKHWAN & AKHWAT
// G. Modal Edit Item BAM -> Update ke Supabase
// H. Supabase SSOT
// I. Tabel Rincian Pembayaran BAM Calon Murid
// J. Perhitungan BAM: Total - Bayar = Tunggakan (BELUM BAYAR / SEBAGIAN / LUNAS)
// K. Filter Calon Murid (Nama, No Reg, Gender, Status, Reset Filter)
// L. Modal Rincian Pembayaran per Calon Murid (Data + Tabel Rincian)
// S. Cetak Surat Keterangan Tunggakan BAM
// =====================================================================

import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  StudentData,
  BamPaymentRecord,
  BamInstallmentType,
  SchoolInfo,
  BamItem,
  BamGender,
  CostBreakdown,
} from '../../types';
import {
  getStoredBamPayments,
  saveBamPayments,
  getStoredSchoolInfo,
  saveSchoolInfo,
} from '../../utils/storage';
import { PaymentRepository } from '../../repositories/PaymentRepository';
import {
  BAM_CONFIG,
  DEFAULT_BAM_ITEMS_IKHWAN,
  DEFAULT_BAM_ITEMS_AKHWAT,
  getLoadedBamItems,
  setLoadedBamItems,
  calculateTotalFromItems,
  fetchAndCacheBamItems,
  getTotalBamCost,
  calculateBamRemaining,
  getBamPaymentStatus,
  normalizeBamGender,
  getStudentCategory,
} from '../../utils/bamPricing';
import {
  fetchBamItemsFromSupabase,
  saveBamItemsToSupabase,
  deleteBamItemFromSupabase,
  fetchBamPaymentsFromSupabase,
} from '../../utils/supabaseClient';
import {
  FileText, Plus, Search, Filter, CheckCircle2,
  Calendar, DollarSign, Calculator, Trash2, Database, Pencil,
  Upload, Download, Save, AlertCircle, Info, Eye, Layers, ShieldCheck,
  Image as ImageIcon, ZoomIn, RefreshCw, Check, RotateCcw,
  AlertTriangle, FileSpreadsheet, X, UserCheck, User
} from 'lucide-react';
import { PaymentProofModal, ProofModalData } from './PaymentProofModal';
import { getStoredPaymentProofs } from '../../utils/paymentProofStorage';
import {
  generatePaymentReceiptPDF,
  generateReportPDF,
  generateSuratTunggakanBamPDF,
} from '../../utils/pdfGenerator';
import { exportToExcel } from '../../utils/excelExporter';

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
}) => {
  const effectiveSchoolInfo = propSchoolInfo || getStoredSchoolInfo();

  // -------------------------------------------------------------------
  // MAIN NAVIGATION TABS:
  // 1. 'payments' (Tabel Pembayaran & Rincian Calon Murid)
  // 2. 'items'    (Kelola Item BAM Terpisah IKHWAN / AKHWAT)
  // 3. 'upload'   (Upload & Validasi Data BAM Baru)
  // -------------------------------------------------------------------
  const [activeTopTab, setActiveTopTab] = useState<'payments' | 'items' | 'upload'>('payments');

  // -------------------------------------------------------------------
  // 1. STATE ITEM BAM (IKHWAN & AKHWAT) DARI SUPABASE
  // -------------------------------------------------------------------
  const [activeGenderTab, setActiveGenderTab] = useState<BamGender>('ikhwan');
  const [ikhwanItems, setIkhwanItems] = useState<BamItem[]>(() => getLoadedBamItems('ikhwan'));
  const [akhwatItems, setAkhwatItems] = useState<BamItem[]>(() => getLoadedBamItems('akhwat'));
  const [isLoadingBamItems, setIsLoadingBamItems] = useState(false);
  const [isSavingToSupabase, setIsSavingToSupabase] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Load items from Supabase on mount
  const reloadBamItemsFromSupabase = async () => {
    setIsLoadingBamItems(true);
    try {
      const res = await fetchBamItemsFromSupabase();
      if (res.ikhwan && res.ikhwan.length > 0) {
        setIkhwanItems(res.ikhwan);
        setLoadedBamItems('ikhwan', res.ikhwan);
      } else {
        // Fallback default
        setIkhwanItems(DEFAULT_BAM_ITEMS_IKHWAN);
        setLoadedBamItems('ikhwan', DEFAULT_BAM_ITEMS_IKHWAN);
      }

      if (res.akhwat && res.akhwat.length > 0) {
        setAkhwatItems(res.akhwat);
        setLoadedBamItems('akhwat', res.akhwat);
      } else {
        setAkhwatItems(DEFAULT_BAM_ITEMS_AKHWAT);
        setLoadedBamItems('akhwat', DEFAULT_BAM_ITEMS_AKHWAT);
      }
    } catch (e) {
      console.warn('Gagal memuat item BAM dari Supabase:', e);
    } finally {
      setIsLoadingBamItems(false);
    }
  };

  useEffect(() => {
    reloadBamItemsFromSupabase();
  }, []);

  // -------------------------------------------------------------------
  // 2. STATE MODAL EDIT / TAMBAH ITEM BAM
  // -------------------------------------------------------------------
  const [editingItem, setEditingItem] = useState<{
    id?: string;
    gender: BamGender;
    nama_item: string;
    nominal: number;
    urutan: number;
    aktif: boolean;
    keterangan?: string;
  } | null>(null);

  const handleOpenEditItem = (item: BamItem) => {
    setEditingItem({ ...item });
  };

  const handleOpenAddItem = (gender: BamGender) => {
    const list = gender === 'ikhwan' ? ikhwanItems : akhwatItems;
    setEditingItem({
      gender,
      nama_item: '',
      nominal: 0,
      urutan: list.length + 1,
      aktif: true,
      keterangan: '',
    });
  };

  const handleSaveEditedItem = async () => {
    if (!editingItem) return;
    if (!editingItem.nama_item.trim()) {
      alert('Nama item BAM tidak boleh kosong.');
      return;
    }
    if (editingItem.nominal < 0 || isNaN(editingItem.nominal)) {
      alert('Nominal BAM harus berupa angka lebih besar atau sama dengan 0.');
      return;
    }

    const gender = editingItem.gender;
    const currentList = gender === 'ikhwan' ? [...ikhwanItems] : [...akhwatItems];

    let updatedList: BamItem[];
    if (editingItem.id) {
      // Update existing item
      updatedList = currentList.map(it => (it.id === editingItem.id ? { ...it, ...editingItem } : it));
    } else {
      // Add new item
      const newItem: BamItem = {
        id: `bam_${gender}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        gender,
        nama_item: editingItem.nama_item.trim(),
        nominal: Number(editingItem.nominal),
        urutan: Number(editingItem.urutan),
        aktif: editingItem.aktif,
        keterangan: editingItem.keterangan?.trim() || undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      updatedList = [...currentList, newItem];
    }

    // Urutkan berdasarkan urutan
    updatedList.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

    // Update state & cache
    if (gender === 'ikhwan') {
      setIkhwanItems(updatedList);
      setLoadedBamItems('ikhwan', updatedList);
    } else {
      setAkhwatItems(updatedList);
      setLoadedBamItems('akhwat', updatedList);
    }

    setEditingItem(null);

    // Langsung simpan ke Supabase agar tersimpan permanen
    setIsSavingToSupabase(true);
    const saveRes = await saveBamItemsToSupabase(gender, updatedList);
    setIsSavingToSupabase(false);

    if (saveRes.success) {
      setSaveSuccessMessage(`Item BAM ${gender.toUpperCase()} berhasil disimpan permanen ke Supabase.`);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } else {
      alert(`Gagal menyimpan ke Supabase: ${saveRes.error}`);
    }
  };

  const handleDeleteItem = async (id: string, gender: BamGender) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus item BAM ini? Perubahan akan disimpan ke Supabase.')) {
      return;
    }

    const currentList = gender === 'ikhwan' ? [...ikhwanItems] : [...akhwatItems];
    const updatedList = currentList.filter(it => it.id !== id);

    if (gender === 'ikhwan') {
      setIkhwanItems(updatedList);
      setLoadedBamItems('ikhwan', updatedList);
    } else {
      setAkhwatItems(updatedList);
      setLoadedBamItems('akhwat', updatedList);
    }

    setIsSavingToSupabase(true);
    await deleteBamItemFromSupabase(id, gender);
    await saveBamItemsToSupabase(gender, updatedList);
    setIsSavingToSupabase(false);

    setSaveSuccessMessage(`Item BAM ${gender.toUpperCase()} berhasil dihapus dari Supabase.`);
    setTimeout(() => setSaveSuccessMessage(null), 4000);
  };

  // Simpan seluruh data item aktif ke Supabase secara eksplisit
  const handleSaveAllItemsToSupabase = async (gender: BamGender) => {
    setIsSavingToSupabase(true);
    const list = gender === 'ikhwan' ? ikhwanItems : akhwatItems;
    const res = await saveBamItemsToSupabase(gender, list);
    setIsSavingToSupabase(false);

    if (res.success) {
      setSaveSuccessMessage(`Seluruh Data BAM ${gender.toUpperCase()} berhasil disimpan permanen ke Supabase.`);
      setTimeout(() => setSaveSuccessMessage(null), 5000);
    } else {
      alert(`Gagal menyimpan: ${res.error}`);
    }
  };

  // -------------------------------------------------------------------
  // 3. UPLOAD & VALIDASI DATA BAM (SECTION D & E)
  // -------------------------------------------------------------------
  interface ParsedBamRow {
    rowNumber: number;
    gender: BamGender;
    nama_item: string;
    nominal: number;
    urutan: number;
    keterangan?: string;
  }

  interface ValidationError {
    rowNumber: number;
    column: string;
    message: string;
  }

  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [previewParsedRows, setPreviewParsedRows] = useState<ParsedBamRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isProcessingUpload, setIsProcessingUpload] = useState<boolean>(false);
  const [uploadSuccessAlert, setUploadSuccessAlert] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setUploadSuccessAlert(null);
    setIsProcessingUpload(true);
    setValidationErrors([]);
    setPreviewParsedRows([]);

    const reader = new FileReader();

    reader.onload = evt => {
      try {
        const data = evt.target?.result;
        let rows: any[] = [];

        if (file.name.endsWith('.json')) {
          const parsedJson = JSON.parse(data as string);
          rows = Array.isArray(parsedJson) ? parsedJson : parsedJson.items || [];
        } else {
          // XLSX / CSV
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        }

        // Parse and validate rows
        const parsed: ParsedBamRow[] = [];
        const errors: ValidationError[] = [];
        const seenItems = new Set<string>();

        if (rows.length === 0) {
          errors.push({
            rowNumber: 1,
            column: 'File',
            message: 'File tidak memuat data atau lembar kerja kosong.',
          });
        }

        rows.forEach((row, idx) => {
          const rowNum = idx + 2; // Menganggap baris 1 adalah header kolom

          // 1. Ekstraksi Gender
          const rawGender = String(row.gender || row.Gender || row.kategori || row.Kategori || '').toLowerCase().trim();
          let gender: BamGender | null = null;
          if (rawGender.includes('ikhwan') || rawGender.includes('laki') || rawGender === 'l') {
            gender = 'ikhwan';
          } else if (rawGender.includes('akhwat') || rawGender.includes('perempuan') || rawGender === 'p') {
            gender = 'akhwat';
          }

          if (!gender) {
            errors.push({
              rowNumber: rowNum,
              column: 'gender / kategori',
              message: `Nilai gender "${rawGender || '(kosong)'}" tidak valid. Harus diisi 'ikhwan' atau 'akhwat'.`,
            });
          }

          // 2. Ekstraksi Nama Item
          const namaItem = String(row.nama_item || row.nama || row.item || row.Item || row.komponen || '').trim();
          if (!namaItem) {
            errors.push({
              rowNumber: rowNum,
              column: 'nama_item',
              message: 'Nama item BAM kosong atau tidak ditemukan.',
            });
          }

          // 3. Ekstraksi Nominal
          const rawNominal = row.nominal ?? row.Nominal ?? row.biaya ?? row.Biaya ?? row.jumlah ?? row.Jumlah;
          const cleanNominalStr = String(rawNominal).replace(/[^0-9.-]+/g, '');
          const nominal = Number(cleanNominalStr);

          if (rawNominal === undefined || rawNominal === null || rawNominal === '' || isNaN(nominal)) {
            errors.push({
              rowNumber: rowNum,
              column: 'nominal',
              message: `Nominal "${rawNominal}" bukan angka yang valid.`,
            });
          } else if (nominal < 0) {
            errors.push({
              rowNumber: rowNum,
              column: 'nominal',
              message: `Nominal tidak boleh negatif (${nominal}).`,
            });
          }

          // 4. Deteksi Duplikasi
          if (gender && namaItem) {
            const key = `${gender}_${namaItem.toLowerCase()}`;
            if (seenItems.has(key)) {
              errors.push({
                rowNumber: rowNum,
                column: 'nama_item',
                message: `Duplikasi item tidak diperbolehkan: "${namaItem}" untuk gender ${gender}.`,
              });
            } else {
              seenItems.add(key);
            }
          }

          // Urutan
          const urutan = Number(row.urutan || row.Urutan || row.no || row.No || idx + 1) || idx + 1;
          const keterangan = String(row.keterangan || row.Keterangan || row.notes || row.Notes || '').trim();

          if (gender) {
            parsed.push({
              rowNumber: rowNum,
              gender,
              nama_item: namaItem,
              nominal: isNaN(nominal) ? 0 : nominal,
              urutan,
              keterangan: keterangan || undefined,
            });
          }
        });

        setValidationErrors(errors);
        setPreviewParsedRows(parsed);
      } catch (err: any) {
        setValidationErrors([
          {
            rowNumber: 1,
            column: 'Format File',
            message: `Gagal membaca file: ${err.message || 'Format tidak didukung.'}`,
          },
        ]);
      } finally {
        setIsProcessingUpload(false);
      }
    };

    if (file.name.endsWith('.json')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  // TOMBOL EKSPLISIT: "SIMPAN DATA BAM" (SECTION D)
  const handleSaveUploadedDataBam = async () => {
    if (validationErrors.length > 0) {
      alert('Data BAM belum dapat disimpan. Mohon periksa baris dan kolom yang bermasalah terlebih dahulu.');
      return;
    }

    if (previewParsedRows.length === 0) {
      alert('Tidak ada data BAM yang dapat disimpan. Silakan unggah file terlebih dahulu.');
      return;
    }

    setIsSavingToSupabase(true);

    try {
      // Pisahkan baris sesuai gender
      const newIkhwanRows = previewParsedRows.filter(r => r.gender === 'ikhwan');
      const newAkhwatRows = previewParsedRows.filter(r => r.gender === 'akhwat');

      let updatedIkhwanList = [...ikhwanItems];
      let updatedAkhwatList = [...akhwatItems];

      if (newIkhwanRows.length > 0) {
        updatedIkhwanList = newIkhwanRows.map((r, i) => ({
          id: `bam_ikhwan_${Date.now()}_${i + 1}`,
          gender: 'ikhwan' as const,
          nama_item: r.nama_item,
          nominal: r.nominal,
          urutan: r.urutan,
          aktif: true,
          keterangan: r.keterangan,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        setIkhwanItems(updatedIkhwanList);
        setLoadedBamItems('ikhwan', updatedIkhwanList);
        await saveBamItemsToSupabase('ikhwan', updatedIkhwanList);
      }

      if (newAkhwatRows.length > 0) {
        updatedAkhwatList = newAkhwatRows.map((r, i) => ({
          id: `bam_akhwat_${Date.now()}_${i + 1}`,
          gender: 'akhwat' as const,
          nama_item: r.nama_item,
          nominal: r.nominal,
          urutan: r.urutan,
          aktif: true,
          keterangan: r.keterangan,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        setAkhwatItems(updatedAkhwatList);
        setLoadedBamItems('akhwat', updatedAkhwatList);
        await saveBamItemsToSupabase('akhwat', updatedAkhwatList);
      }

      setUploadSuccessAlert(
        `✓ Berhasil! Sebanyak ${previewParsedRows.length} item BAM (${newIkhwanRows.length} Ikhwan, ${newAkhwatRows.length} Akhwat) telah disimpan secara permanen ke Supabase.`
      );
      setPreviewParsedRows([]);
      setUploadedFileName('');
    } catch (err: any) {
      alert(`Terjadi kesalahan saat menyimpan data BAM: ${err.message}`);
    } finally {
      setIsSavingToSupabase(false);
    }
  };

  // Download Sample Template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        kategori: 'ikhwan',
        nama_item: 'Dana Pengembangan Sarana & Prasarana',
        nominal: 4500000,
        urutan: 1,
        keterangan: 'Fasilitas multimedia & sarpras digital',
      },
      {
        kategori: 'ikhwan',
        nama_item: 'Paket Seragam Lengkap Ikhwan (5 Stel)',
        nominal: 1500000,
        urutan: 2,
        keterangan: 'Putih Biru, Pramuka, Batik, Olahraga, Muslim',
      },
      {
        kategori: 'akhwat',
        nama_item: 'Dana Pengembangan Sarana & Prasarana',
        nominal: 4500000,
        urutan: 1,
        keterangan: 'Fasilitas multimedia & sarpras digital',
      },
      {
        kategori: 'akhwat',
        nama_item: 'Paket Seragam Lengkap Akhwat + Jilbab Syar\'i (5 Stel)',
        nominal: 1720000,
        urutan: 2,
        keterangan: 'Putih Biru + Jilbab, Pramuka, Batik, Olahraga, Gamis',
      },
    ];

    exportToExcel(
      templateData,
      'Template_Data_BAM_SMP_AlHadiid',
      'Template BAM',
      {
        title: 'TEMPLATE IMPORT DATA BIAYA AWAL MASUK (BAM)',
        schoolName: effectiveSchoolInfo.name || 'SMPS AL-HADIID CILEUNGSI',
        academicYear: effectiveSchoolInfo.academicYear,
        printDate: new Date().toLocaleDateString('id-ID'),
      }
    );
  };

  // -------------------------------------------------------------------
  // 4. DATA PEMBAYARAN BAM DARI SELURUH CALON MURID (SECTION I, J, K, L)
  // -------------------------------------------------------------------
  const [bamPayments, setBamPayments] = useState<BamPaymentRecord[]>(() => getStoredBamPayments());
  const [activeProofData, setActiveProofData] = useState<ProofModalData | null>(null);

  // Sync payments from Supabase
  useEffect(() => {
    PaymentRepository.list('bam').then(({ data }) => {
      if (data && data.length > 0) {
        const mapped: BamPaymentRecord[] = data.map(p => ({
          id: p.id,
          transactionNumber: p.id,
          registrationNumber: p.registrationNumber || 'SPMB',
          studentId: p.studentId,
          studentName: p.studentName || 'Calon Murid',
          gender: p.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki',
          paymentDate: p.paymentDate || new Date().toISOString().split('T')[0],
          totalBamCost: p.amount || 0,
          amountPaid: p.amount || 0,
          installmentType: 'Lunas',
          totalPaidToDate: p.amount || 0,
          remainingBalance: 0,
          proofUrl: p.proofUrl,
          notes: p.notes,
        }));
        setBamPayments(mapped);
        saveBamPayments(mapped);
      } else {
        fetchBamPaymentsFromSupabase().then(cloud => {
          if (cloud && cloud.length > 0) {
            setBamPayments(cloud);
            saveBamPayments(cloud);
          }
        });
      }
    }).catch(e => console.warn('Load bam payments error:', e));
  }, [students]);

  // Combined Rows of BAM for each Student
  interface StudentBamSummary {
    student: StudentData;
    registrationNumber: string;
    fullName: string;
    gender: 'Laki-laki' | 'Perempuan';
    rawGender: BamGender;
    totalBam: number;
    amountPaid: number;
    remaining: number;
    status: 'BELUM BAYAR' | 'SEBAGIAN' | 'LUNAS';
    latestPaymentDate?: string;
    paymentMethod?: string;
    proofUrl?: string;
    notes?: string;
    matchingPayments: BamPaymentRecord[];
  }

  const studentBamSummaries: StudentBamSummary[] = useMemo(() => {
    return students.map(st => {
      const rawGender = normalizeBamGender(st);
      const genderDisplay = rawGender === 'akhwat' ? 'Perempuan' : 'Laki-laki';

      // Total BAM dihitung secara dinamis dari item BAM aktif Supabase sesuai gender calon murid!
      const totalBam = getTotalBamCost(st);

      // Cari total pembayaran BAM siswa ini
      const matchingPayments = bamPayments.filter(
        p => p.studentId === st.id || p.registrationNumber === st.registrationNumber
      );

      let paid = matchingPayments.reduce((acc, p) => acc + (Number(p.amountPaid) || 0), 0);
      if (st.initialPaymentAmount && st.initialPaymentAmount > paid) {
        paid = st.initialPaymentAmount;
      }

      const remaining = calculateBamRemaining(totalBam, paid);
      const status = getBamPaymentStatus(totalBam, paid);
      const latestPayDate = matchingPayments[0]?.paymentDate || st.initialPaymentDate || undefined;
      const proofUrl = matchingPayments.find(p => !!p.proofUrl)?.proofUrl || st.initialPaymentProofUrl;

      return {
        student: st,
        registrationNumber: st.registrationNumber || 'SPMB',
        fullName: st.fullName || 'Calon Murid',
        gender: genderDisplay,
        rawGender,
        totalBam,
        amountPaid: paid,
        remaining,
        status,
        latestPaymentDate: latestPayDate,
        paymentMethod: matchingPayments[0]?.paymentMethod || (paid > 0 ? 'Transfer Bank' : undefined),
        proofUrl,
        notes: matchingPayments[0]?.notes || st.initialPaymentNotes,
        matchingPayments,
      };
    });
  }, [students, bamPayments, ikhwanItems, akhwatItems]);

  // KPI Calculations
  const kpiData = useMemo(() => {
    const totalCalonMurid = studentBamSummaries.length;
    const totalTagihanBAM = studentBamSummaries.reduce((a, c) => a + c.totalBam, 0);
    const totalPembayaranBAM = studentBamSummaries.reduce((a, c) => a + c.amountPaid, 0);
    const totalTunggakan = studentBamSummaries.reduce((a, c) => a + c.remaining, 0);

    const jumlahLunas = studentBamSummaries.filter(s => s.status === 'LUNAS').length;
    const jumlahSebagian = studentBamSummaries.filter(s => s.status === 'SEBAGIAN').length;
    const jumlahBelumBayar = studentBamSummaries.filter(s => s.status === 'BELUM BAYAR').length;

    return {
      totalCalonMurid,
      totalTagihanBAM,
      totalPembayaranBAM,
      totalTunggakan,
      jumlahLunas,
      jumlahSebagian,
      jumlahBelumBayar,
    };
  }, [studentBamSummaries]);

  // Filter Calon Murid (Section K)
  const [searchStudentQuery, setSearchStudentQuery] = useState('');
  const [filterStudentGender, setFilterStudentGender] = useState<'all' | 'ikhwan' | 'akhwat'>('all');
  const [filterStudentStatus, setFilterStudentStatus] = useState<string>('all');

  const filteredStudentSummaries = useMemo(() => {
    return studentBamSummaries.filter(row => {
      // Filter Gender
      if (filterStudentGender === 'ikhwan' && row.rawGender !== 'ikhwan') return false;
      if (filterStudentGender === 'akhwat' && row.rawGender !== 'akhwat') return false;

      // Filter Status
      if (filterStudentStatus !== 'all' && row.status !== filterStudentStatus) return false;

      // Filter Search
      if (searchStudentQuery.trim()) {
        const q = searchStudentQuery.toLowerCase().trim();
        const matchName = row.fullName.toLowerCase().includes(q);
        const matchReg = row.registrationNumber.toLowerCase().includes(q);
        if (!matchName && !matchReg) return false;
      }

      return true;
    });
  }, [studentBamSummaries, filterStudentGender, filterStudentStatus, searchStudentQuery]);

  const handleResetStudentFilter = () => {
    setSearchStudentQuery('');
    setFilterStudentGender('all');
    setFilterStudentStatus('all');
  };

  // -------------------------------------------------------------------
  // 5. MODAL RINCIAN PEMBAYARAN PER CALON MURID (SECTION L & S)
  // -------------------------------------------------------------------
  const [selectedStudentSummary, setSelectedStudentSummary] = useState<StudentBamSummary | null>(null);

  // Perhitungan rincian item BAM calon murid yang dipilih
  const selectedStudentItemsBreakdown = useMemo(() => {
    if (!selectedStudentSummary) return [];
    const items = getLoadedBamItems(selectedStudentSummary.rawGender);
    const paidTotal = selectedStudentSummary.amountPaid;

    let runningAccumulator = 0;

    return items.map((it, idx) => {
      const itemCost = it.nominal;
      let itemPaid = 0;

      if (paidTotal >= runningAccumulator + itemCost) {
        itemPaid = itemCost;
      } else if (paidTotal > runningAccumulator) {
        itemPaid = paidTotal - runningAccumulator;
      } else {
        itemPaid = 0;
      }

      const itemRemaining = Math.max(0, itemCost - itemPaid);
      let itemStatus: 'LUNAS' | 'SEBAGIAN' | 'BELUM BAYAR' = 'BELUM BAYAR';
      if (itemPaid >= itemCost) itemStatus = 'LUNAS';
      else if (itemPaid > 0) itemStatus = 'SEBAGIAN';

      runningAccumulator += itemCost;

      return {
        no: idx + 1,
        nama_item: it.nama_item,
        nominal: itemCost,
        dibayar: itemPaid,
        sisa: itemRemaining,
        status: itemStatus,
      };
    });
  }, [selectedStudentSummary, ikhwanItems, akhwatItems]);

  // Cetak Surat Keterangan Tunggakan BAM (Section S)
  const handlePrintSuratTunggakan = (summary: StudentBamSummary) => {
    if (summary.remaining <= 0) {
      alert(`Calon murid ${summary.fullName} telah LUNAS BAM (Sisa Rp 0). Surat keterangan tunggakan hanya untuk siswa yang memiliki tunggakan.`);
      return;
    }

    const itemsForLetter = getLoadedBamItems(summary.rawGender).map(i => ({
      nama_item: i.nama_item,
      nominal: i.nominal,
    }));

    generateSuratTunggakanBamPDF(
      summary.student,
      {
        totalBam: summary.totalBam,
        totalPaid: summary.amountPaid,
        remaining: summary.remaining,
        items: itemsForLetter,
      },
      effectiveSchoolInfo
    );
  };

  // Cetak Kuitansi Pembayaran
  const handlePrintReceipt = (summary: StudentBamSummary) => {
    const payRecord = summary.matchingPayments[0] || {
      id: `TRX-BAM-${summary.registrationNumber.slice(-6)}`,
      amountPaid: summary.amountPaid,
      paymentDate: summary.latestPaymentDate || new Date().toISOString().split('T')[0],
      notes: 'Pembayaran Biaya Awal Masuk (BAM)',
    };

    generatePaymentReceiptPDF(
      {
        id: payRecord.id,
        student_id: summary.student.id,
        student_name: summary.fullName,
        registration_number: summary.registrationNumber,
        payment_type: 'bam',
        amount: summary.amountPaid,
        payment_method: 'Transfer Bank',
        bank_name: 'BSI',
        payment_date: summary.latestPaymentDate || new Date().toISOString().split('T')[0],
        status: summary.status === 'LUNAS' ? 'verified' : 'pending',
        notes: `Pembayaran BAM (${summary.status}) - Saldo Sisa: Rp ${summary.remaining.toLocaleString('id-ID')}`,
        verified_by: 'Bagian Administrasi Keuangan SPMB',
      },
      summary.student,
      effectiveSchoolInfo
    );
  };

  // Input Pembayaran Baru Modal State
  const [payingStudent, setPayingStudent] = useState<StudentBamSummary | null>(null);
  const [inputPaymentAmount, setInputPaymentAmount] = useState<number>(0);
  const [inputPaymentDate, setInputPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [inputPaymentMethod, setInputPaymentMethod] = useState<string>('Transfer Bank BSI');
  const [inputPaymentNotes, setInputPaymentNotes] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  const handleOpenInputPayment = (summary: StudentBamSummary) => {
    setPayingStudent(summary);
    setInputPaymentAmount(summary.remaining > 0 ? summary.remaining : summary.totalBam);
    setInputPaymentDate(new Date().toISOString().split('T')[0]);
    setInputPaymentMethod('Transfer Bank BSI');
    setInputPaymentNotes(`Pembayaran BAM ${summary.fullName} (${summary.registrationNumber})`);
  };

  const handleSaveStudentPayment = async () => {
    if (!payingStudent) return;
    if (inputPaymentAmount <= 0 || isNaN(inputPaymentAmount)) {
      alert('Jumlah pembayaran harus lebih dari 0.');
      return;
    }

    setIsSubmittingPayment(true);
    const newTotalPaid = payingStudent.amountPaid + inputPaymentAmount;
    const remaining = calculateBamRemaining(payingStudent.totalBam, newTotalPaid);
    const newStatus = getBamPaymentStatus(payingStudent.totalBam, newTotalPaid);

    try {
      // 1. Simpan ke PaymentRepository (Supabase payments table)
      await PaymentRepository.create({
        studentId: payingStudent.student.id,
        registrationNumber: payingStudent.registrationNumber,
        studentName: payingStudent.fullName,
        paymentType: 'bam',
        amount: inputPaymentAmount,
        status: 'verified',
        paymentMethod: inputPaymentMethod,
        bankName: inputPaymentMethod.includes('BSI') ? 'BSI' : 'Mandiri',
        paymentDate: inputPaymentDate,
        notes: inputPaymentNotes || `Pembayaran BAM (${newStatus}) - Sisa: Rp ${remaining.toLocaleString('id-ID')}`,
      });

      // 2. Perbarui data siswa di student state
      const updatedStudents = students.map(s => {
        if (s.id === payingStudent.student.id) {
          return {
            ...s,
            initialPaymentAmount: newTotalPaid,
            initialPaymentDate: inputPaymentDate,
            initialPaymentStatus: (newStatus === 'LUNAS' ? 'verified' : 'pending') as any,
            initialPaymentNotes: inputPaymentNotes,
            status: newStatus === 'LUNAS' ? ('re_registered' as const) : s.status,
          };
        }
        return s;
      });
      onUpdateStudents(updatedStudents);

      // 3. Tambahkan ke records lokal
      const newRecord: BamPaymentRecord = {
        id: `bam_${Date.now()}`,
        transactionNumber: `TRX-BAM-${Date.now().toString().slice(-6)}`,
        registrationNumber: payingStudent.registrationNumber,
        studentId: payingStudent.student.id,
        studentName: payingStudent.fullName,
        gender: payingStudent.gender,
        paymentDate: inputPaymentDate,
        totalBamCost: payingStudent.totalBam,
        amountPaid: inputPaymentAmount,
        installmentType: newStatus === 'LUNAS' ? 'Lunas' : 'Cicilan 1',
        paymentStatus: newStatus,
        paymentMethod: inputPaymentMethod,
        totalPaidToDate: newTotalPaid,
        remainingBalance: remaining,
        notes: inputPaymentNotes,
      };

      const updatedRecords = [newRecord, ...bamPayments];
      setBamPayments(updatedRecords);
      saveBamPayments(updatedRecords);

      setPayingStudent(null);
      setSaveSuccessMessage(`Pembayaran Rp ${inputPaymentAmount.toLocaleString('id-ID')} untuk ${payingStudent.fullName} berhasil disimpan ke Supabase.`);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (e: any) {
      alert(`Gagal menyimpan pembayaran: ${e.message}`);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Export Excel Pembayaran BAM (Filter Aware)
  const handleExportBamExcel = () => {
    const cleanYear = effectiveSchoolInfo.academicYear.replace('/', '-');
    const todayStr = new Date().toLocaleDateString('id-ID');

    const data = filteredStudentSummaries.map((s, idx) => ({
      'No. Urut': idx + 1,
      'No Pendaftaran': s.registrationNumber,
      'Nama Calon Murid': s.fullName,
      'Jenis Kelamin': s.gender,
      'Total BAM': s.totalBam,
      'Sudah Dibayar': s.amountPaid,
      'Tunggakan': s.remaining,
      'Status': s.status,
      'Tanggal Terakhir': s.latestPaymentDate || '-',
      'Metode': s.paymentMethod || '-',
    }));

    exportToExcel(
      data,
      `Laporan_Pembayaran_BAM_${cleanYear}`,
      'Rekap Pembayaran BAM',
      {
        title: 'LAPORAN REKAPITULASI PEMBAYARAN BIAYA AWAL MASUK (BAM)',
        schoolName: effectiveSchoolInfo.name || 'SMPS AL-HADIID CILEUNGSI',
        academicYear: effectiveSchoolInfo.academicYear,
        printDate: todayStr,
      }
    );
  };

  // Export PDF Pembayaran BAM (Filter Aware)
  const handleExportBamPDF = () => {
    const cleanYear = effectiveSchoolInfo.academicYear.replace('/', '_');

    const data = filteredStudentSummaries.map((s, idx) => ({
      'No. Urut': idx + 1,
      'No_Pendaftaran': s.registrationNumber,
      'Nama': s.fullName,
      'Gender': s.gender,
      'Total_BAM': `Rp ${s.totalBam.toLocaleString('id-ID')}`,
      'Total_Dibayar': `Rp ${s.amountPaid.toLocaleString('id-ID')}`,
      'Tunggakan': s.remaining > 0 ? `Rp ${s.remaining.toLocaleString('id-ID')}` : 'Rp 0 (LUNAS)',
      'Status': s.status,
    }));

    generateReportPDF(
      `Laporan_Pembayaran_BAM_${cleanYear}`,
      data,
      ['No. Urut', 'No_Pendaftaran', 'Nama', 'Gender', 'Total_BAM', 'Total_Dibayar', 'Tunggakan', 'Status'],
      effectiveSchoolInfo
    );
  };

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-semibold mb-2 border border-amber-500/30">
            <Calculator className="w-3.5 h-3.5 text-amber-400" />
            <span>Modul Keuangan & Biaya Awal Masuk (BAM)</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            BIAYA AWAL MASUK (BAM) SPMB SMP AL-HADIID
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Pengelolaan nominal terpisah Ikhwan & Akhwat, upload data BAM, validasi data, serta pencatatan tunggakan calon murid berbasis Supabase SSOT.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={reloadBamItemsFromSupabase}
            disabled={isLoadingBamItems}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Muat ulang dari Supabase"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBamItems ? 'animate-spin text-amber-400' : ''}`} />
            <span>{isLoadingBamItems ? 'Sinkron...' : 'Sync Supabase'}</span>
          </button>
          <button
            onClick={handleExportBamPDF}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Cetak PDF</span>
          </button>
          <button
            onClick={handleExportBamExcel}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* NOTIFIKASI BERHASIL DISIMPAN */}
      {saveSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl flex items-center gap-3 text-emerald-900 font-bold text-xs shadow-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* 3 TAB UTAMA NAVIGASI */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-2">
        <button
          onClick={() => setActiveTopTab('payments')}
          className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTopTab === 'payments'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <span>1. Tabel Rincian & Pembayaran BAM</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-200">
            {studentBamSummaries.length} Murid
          </span>
        </button>

        <button
          onClick={() => setActiveTopTab('items')}
          className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTopTab === 'items'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4 text-indigo-300" />
          <span>2. Data Item BAM (Ikhwan & Akhwat)</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-800 text-indigo-100">
            {ikhwanItems.length + akhwatItems.length} Item
          </span>
        </button>

        <button
          onClick={() => setActiveTopTab('upload')}
          className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTopTab === 'upload'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Upload className="w-4 h-4 text-amber-300" />
          <span>3. Upload / Import Data BAM Baru</span>
        </button>
      </div>

      {/* ================================================================= */}
      {/* TAB 1: TABEL RINCIAN PEMBAYARAN BAM CALON MURID (SECTION I, J, K)  */}
      {/* ================================================================= */}
      {activeTopTab === 'payments' && (
        <div className="space-y-6">
          {/* KPI CARDS (SECTION O & J) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Total Calon Murid</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                {kpiData.totalCalonMurid} Siswa
              </div>
              <div className="text-[10px] text-slate-400 font-semibold pt-1 border-t border-slate-100">
                Pendaftar Ikhwan & Akhwat
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold text-indigo-700 uppercase">Total Tagihan BAM</div>
              <div className="text-2xl font-extrabold text-indigo-900 mt-1">
                Rp {kpiData.totalTagihanBAM.toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] text-indigo-600 font-bold pt-1 border-t border-slate-100">
                Akumulasi Tagihan Resmi
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold text-emerald-700 uppercase">Total Pembayaran Terkumpul</div>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1">
                Rp {kpiData.totalPembayaranBAM.toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] text-emerald-600 font-bold pt-1 border-t border-slate-100">
                Dana BAM Kas Masuk
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold text-rose-700 uppercase">Total Tunggakan BAM</div>
              <div className="text-2xl font-extrabold text-rose-600 mt-1">
                Rp {kpiData.totalTunggakan.toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] text-rose-500 font-bold pt-1 border-t border-slate-100">
                Piutang Wajib Dilunasi
              </div>
            </div>
          </div>

          {/* SECOND ROW: STATISTIK STATUS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-emerald-800 uppercase">Jumlah Lunas</div>
                <div className="text-xl font-extrabold text-emerald-900 mt-0.5">{kpiData.jumlahLunas} Siswa</div>
                <div className="text-[10px] text-emerald-700 font-semibold">Tunggakan Rp 0</div>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-80" />
            </div>

            <div className="bg-amber-50/80 p-3.5 rounded-xl border border-amber-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-amber-800 uppercase">Jumlah Sebagian (Cicilan)</div>
                <div className="text-xl font-extrabold text-amber-900 mt-0.5">{kpiData.jumlahSebagian} Siswa</div>
                <div className="text-[10px] text-amber-700 font-semibold">Angsuran Berjalan</div>
              </div>
              <Calculator className="w-8 h-8 text-amber-500 opacity-80" />
            </div>

            <div className="bg-rose-50/80 p-3.5 rounded-xl border border-rose-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-rose-800 uppercase">Jumlah Belum Bayar</div>
                <div className="text-xl font-extrabold text-rose-900 mt-0.5">{kpiData.jumlahBelumBayar} Siswa</div>
                <div className="text-[10px] text-rose-700 font-semibold">Belum Ada Setoran</div>
              </div>
              <AlertTriangle className="w-8 h-8 text-rose-500 opacity-80" />
            </div>
          </div>

          {/* FILTER BERDASARKAN CALON MURID (SECTION K) */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchStudentQuery}
                onChange={e => setSearchStudentQuery(e.target.value)}
                placeholder="Cari Nama Calon Murid / No. Pendaftaran..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-indigo-500 bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-600">Gender:</span>
                <select
                  value={filterStudentGender}
                  onChange={e => setFilterStudentGender(e.target.value as any)}
                  className="border border-slate-300 rounded-lg p-2 text-xs bg-white font-semibold"
                >
                  <option value="all">Semua</option>
                  <option value="ikhwan">Ikhwan</option>
                  <option value="akhwat">Akhwat</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-600">Status:</span>
                <select
                  value={filterStudentStatus}
                  onChange={e => setFilterStudentStatus(e.target.value)}
                  className="border border-slate-300 rounded-lg p-2 text-xs bg-white font-semibold"
                >
                  <option value="all">Semua</option>
                  <option value="LUNAS">Lunas</option>
                  <option value="SEBAGIAN">Sebagian</option>
                  <option value="BELUM BAYAR">Belum Bayar</option>
                </select>
              </div>

              {(searchStudentQuery || filterStudentGender !== 'all' || filterStudentStatus !== 'all') && (
                <button
                  onClick={handleResetStudentFilter}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>RESET FILTER</span>
                </button>
              )}
            </div>
          </div>

          {/* TABEL RINCIAN PEMBAYARAN BAM (SECTION I) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Tabel Rincian Pembayaran BAM ({filteredStudentSummaries.length} Data Calon Murid)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Total BAM dihitung otomatis sesuai item BAM Supabase gender Ikhwan / Akhwat.
                </p>
              </div>
              <div className="text-xs space-x-3 font-bold">
                <span className="text-emerald-700">
                  Total Terbayar: Rp {filteredStudentSummaries.reduce((a, c) => a + c.amountPaid, 0).toLocaleString('id-ID')}
                </span>
                <span className="text-rose-600">
                  Tunggakan: Rp {filteredStudentSummaries.reduce((a, c) => a + c.remaining, 0).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[950px]">
                <thead>
                  <tr className="bg-slate-100 border-b font-bold text-slate-700 whitespace-nowrap">
                    <th className="p-3 w-14 text-center">No. Urut</th>
                    <th className="p-3">No. Pendaftaran</th>
                    <th className="p-3">Nama Calon Murid</th>
                    <th className="p-3">Jenis Kelamin</th>
                    <th className="p-3">Total BAM (Tagihan)</th>
                    <th className="p-3">Jumlah Dibayar</th>
                    <th className="p-3">Sisa / Tunggakan</th>
                    <th className="p-3">Tanggal Bayar</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-center">Bukti</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredStudentSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400 italic">
                        Tidak ada data calon murid yang cocok dengan pencarian dan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredStudentSummaries.map((s, idx) => (
                      <tr key={s.student.id} className="hover:bg-slate-50 font-medium whitespace-nowrap">
                        <td className="p-3 text-center text-slate-600 font-mono font-bold">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-slate-700">{s.registrationNumber}</td>
                        <td className="p-3 font-extrabold text-slate-900">{s.fullName}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            s.rawGender === 'ikhwan' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                          }`}>
                            {s.gender}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-700">
                          Rp {s.totalBam.toLocaleString('id-ID')}
                        </td>
                        <td className="p-3 font-extrabold text-emerald-700">
                          Rp {s.amountPaid.toLocaleString('id-ID')}
                        </td>
                        <td className="p-3 font-extrabold">
                          {s.remaining === 0 ? (
                            <span className="text-emerald-600">Rp 0 (LUNAS)</span>
                          ) : (
                            <span className="text-rose-600">Rp {s.remaining.toLocaleString('id-ID')}</span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-500">
                          {s.latestPaymentDate || '-'}
                        </td>
                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                            s.status === 'LUNAS'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : s.status === 'SEBAGIAN'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {s.proofUrl ? (
                            <button
                              onClick={() => setActiveProofData({
                                url: s.proofUrl!,
                                studentName: s.fullName,
                                regNo: s.registrationNumber,
                                paymentType: 'bam',
                              })}
                              className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg cursor-pointer"
                              title="Lihat Bukti Transfer"
                            >
                              <ImageIcon className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Tombol Lihat Rincian Calon Murid (Section L) */}
                            <button
                              onClick={() => setSelectedStudentSummary(s)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition-all text-xs flex items-center gap-1 cursor-pointer"
                              title="Lihat Rincian Seluruh BAM Calon Murid"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Rincian</span>
                            </button>

                            {/* Tombol Input Pembayaran */}
                            <button
                              onClick={() => handleOpenInputPayment(s)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg transition-all text-xs flex items-center gap-1 cursor-pointer"
                              title="Input Pembayaran Baru"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Bayar</span>
                            </button>

                            {/* Tombol Cetak Surat Keterangan Tunggakan BAM (Section S) */}
                            {s.remaining > 0 && (
                              <button
                                onClick={() => handlePrintSuratTunggakan(s)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg transition-all text-xs flex items-center gap-1 cursor-pointer"
                                title="Cetak Surat Keterangan Tunggakan BAM"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Surat Tunggakan</span>
                              </button>
                            )}

                            {/* Cetak Kuitansi jika ada pembayaran */}
                            {s.amountPaid > 0 && (
                              <button
                                onClick={() => handlePrintReceipt(s)}
                                className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100 cursor-pointer"
                                title="Cetak Kuitansi Pembayaran Terakhir"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: PENGELOLAAN ITEM BAM TERPISAH IKHWAN & AKHWAT (SECTION F & G) */}
      {/* ================================================================= */}
      {activeTopTab === 'items' && (
        <div className="space-y-6">
          {/* TAB SWITCHER: [ IKHWAN ] [ AKHWAT ] (SESUAI SECTION F) */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setActiveGenderTab('ikhwan')}
                className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeGenderTab === 'ikhwan'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>TAB 1: IKHWAN (LAKI-LAKI)</span>
                <span className="px-2 py-0.5 rounded-full text-xs bg-blue-800 text-blue-100">
                  {ikhwanItems.length} Item
                </span>
              </button>

              <button
                onClick={() => setActiveGenderTab('akhwat')}
                className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeGenderTab === 'akhwat'
                    ? 'bg-pink-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>TAB 2: AKHWAT (PEREMPUAN)</span>
                <span className="px-2 py-0.5 rounded-full text-xs bg-pink-800 text-pink-100">
                  {akhwatItems.length} Item
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => handleOpenAddItem(activeGenderTab)}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Tambah Item {activeGenderTab.toUpperCase()}</span>
              </button>

              <button
                onClick={() => handleSaveAllItemsToSupabase(activeGenderTab)}
                disabled={isSavingToSupabase}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4 text-emerald-200" />
                <span>{isSavingToSupabase ? 'Menyimpan ke Supabase...' : `Simpan ke Supabase (${activeGenderTab.toUpperCase()})`}</span>
              </button>
            </div>
          </div>

          {/* TOTAL BANNER UNTUK GENDER AKTIF */}
          <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl border border-slate-700 shadow flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <div className="text-xs text-amber-300 font-bold uppercase tracking-wider">
                Total Akumulasi Biaya Awal Masuk ({activeGenderTab.toUpperCase()})
              </div>
              <div className="text-2xl font-black text-white mt-0.5">
                Rp {(activeGenderTab === 'ikhwan'
                  ? calculateTotalFromItems(ikhwanItems)
                  : calculateTotalFromItems(akhwatItems)
                ).toLocaleString('id-ID')}
              </div>
            </div>
            <div className="text-xs text-slate-300 bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700">
              {activeGenderTab === 'ikhwan' ? ikhwanItems.length : akhwatItems.length} Rincian Komponen Terdaftar di Supabase
            </div>
          </div>

          {/* TABEL ITEM BAM GENDER AKTIF */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-sm">
                Daftar Komponen Biaya Awal Masuk ({activeGenderTab.toUpperCase()})
              </h3>
              <span className="text-xs text-slate-500 font-semibold">
                Setiap perubahan akan disimpan secara permanen di database Supabase.
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-100 border-b font-bold text-slate-700 whitespace-nowrap">
                    <th className="p-3 w-14 text-center">No. Urut</th>
                    <th className="p-3">Nama Item BAM</th>
                    <th className="p-3">Nominal (Rp)</th>
                    <th className="p-3 w-20 text-center">Urutan</th>
                    <th className="p-3 w-24 text-center">Status</th>
                    <th className="p-3">Keterangan</th>
                    <th className="p-3 w-28 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {(() => {
                    const currentList = activeGenderTab === 'ikhwan' ? ikhwanItems : akhwatItems;
                    if (currentList.length === 0) {
                      return (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                            Belum ada item BAM untuk {activeGenderTab}. Silakan tambahkan atau upload data.
                          </td>
                        </tr>
                      );
                    }

                    return currentList.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50 font-medium">
                        <td className="p-3 text-center text-slate-600 font-mono font-bold">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{item.nama_item}</td>
                        <td className="p-3 font-extrabold text-emerald-700">
                          Rp {item.nominal.toLocaleString('id-ID')}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-500">{item.urutan}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            item.aktif !== false
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-slate-100 text-slate-600 border border-slate-300'
                          }`}>
                            {item.aktif !== false ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 text-[11px] max-w-xs truncate">
                          {item.keterangan || '-'}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditItem(item)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-lg transition-all text-xs flex items-center gap-1 cursor-pointer"
                              title="Edit Item BAM"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id, activeGenderTab)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-all cursor-pointer"
                              title="Hapus Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 3: UPLOAD / IMPORT DATA BAM (SECTION D & E)                    */}
      {/* ================================================================= */}
      {activeTopTab === 'upload' && (
        <div className="space-y-6">
          {/* UPLOAD INSTRUCTION CARD */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <Upload className="w-5 h-5 text-amber-600" />
                  <span>Upload & Validasi Data Biaya Awal Masuk (BAM)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Format yang didukung: Excel (.xlsx, .xls), CSV, atau JSON. Data akan divalidasi terlebih dahulu sebelum disimpan permanen ke database Supabase.
                </p>
              </div>

              <button
                onClick={handleDownloadTemplate}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              >
                <Download className="w-4 h-4 text-slate-600" />
                <span>Unduh Format Template Excel</span>
              </button>
            </div>

            {/* DROPZONE / FILE SELECTOR */}
            <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/20 hover:bg-indigo-50/40 p-8 rounded-2xl text-center transition-all cursor-pointer">
              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv, .json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-7 h-7" />
                </div>
                <div className="text-sm font-extrabold text-slate-800">
                  {uploadedFileName ? `File Terpilih: ${uploadedFileName}` : 'Klik untuk Memilih File Data BAM'}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Kolom minimal: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-bold text-indigo-700">kategori/gender</code> (ikhwan/akhwat), <code className="bg-slate-100 px-1.5 py-0.5 rounded font-bold text-indigo-700">nama_item</code>, <code className="bg-slate-100 px-1.5 py-0.5 rounded font-bold text-indigo-700">nominal</code>
                </div>
              </label>
            </div>
          </div>

          {/* ALERT VALIDASI ERROR (SECTION E: "Data BAM belum dapat disimpan. Periksa baris/kolom berikut...") */}
          {validationErrors.length > 0 && (
            <div className="bg-rose-50 border-2 border-rose-300 p-5 rounded-2xl text-rose-900 space-y-3 shadow-sm animate-fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <h4 className="font-black text-sm text-rose-900">
                  Data BAM belum dapat disimpan. Periksa baris/kolom berikut:
                </h4>
              </div>
              <p className="text-xs text-rose-700">
                Sistem menolak menyimpan sebagian data demi menjaga konsistensi keuangan. Harap perbaiki kesalahan berikut pada file Anda lalu upload ulang:
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2">
                {validationErrors.map((err, idx) => (
                  <div key={idx} className="text-xs bg-white/80 p-2 rounded-lg border border-rose-200 flex items-start gap-2">
                    <span className="font-bold text-rose-800 font-mono shrink-0">
                      [Baris {err.rowNumber}]
                    </span>
                    <span className="font-semibold text-rose-700">
                      Kolom <span className="underline font-bold">{err.column}</span>: {err.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ALERT BERHASIL UPLOAD */}
          {uploadSuccessAlert && (
            <div className="bg-emerald-50 border-2 border-emerald-300 p-4 rounded-xl flex items-center gap-3 text-emerald-900 font-bold text-xs shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{uploadSuccessAlert}</span>
            </div>
          )}

          {/* PREVIEW TABEL HASIL PARSE & TOMBOL [SIMPAN DATA BAM] (SECTION D) */}
          {previewParsedRows.length > 0 && validationErrors.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Pratinjau Data BAM Terbaca ({previewParsedRows.length} Item Valid)</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Data siap disimpan ke Supabase. Periksa rincian di bawah ini sebelum menekan tombol simpan.
                  </p>
                </div>

                {/* TOMBOL EKSPLISIT: "SIMPAN DATA BAM" */}
                <button
                  onClick={handleSaveUploadedDataBam}
                  disabled={isSavingToSupabase}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4 text-white" />
                  <span>{isSavingToSupabase ? 'Menyimpan ke Supabase...' : 'SIMPAN DATA BAM KE SUPABASE'}</span>
                </button>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b font-bold text-slate-700 sticky top-0">
                      <th className="p-2.5 w-14 text-center">No. Urut</th>
                      <th className="p-2.5">Gender / Kategori</th>
                      <th className="p-2.5">Nama Item BAM</th>
                      <th className="p-2.5">Nominal (Rp)</th>
                      <th className="p-2.5 w-20 text-center">Urutan</th>
                      <th className="p-2.5">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {previewParsedRows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 text-center text-slate-600 font-mono font-bold">{idx + 1}</td>
                        <td className="p-2.5 font-bold">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${
                            r.gender === 'ikhwan' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                          }`}>
                            {r.gender}
                          </span>
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">{r.nama_item}</td>
                        <td className="p-2.5 font-extrabold text-emerald-700">
                          Rp {r.nominal.toLocaleString('id-ID')}
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-500">{r.urutan}</td>
                        <td className="p-2.5 text-slate-500 text-[11px]">{r.keterangan || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL EDIT / TAMBAH ITEM BAM (SECTION G)                          */}
      {/* ================================================================= */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {editingItem.id ? 'Edit Data BAM' : 'Tambah Data BAM Baru'}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase mt-1 inline-block ${
                  editingItem.gender === 'ikhwan' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                }`}>
                  Kategori: {editingItem.gender}
                </span>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Kategori Gender</label>
                <select
                  value={editingItem.gender}
                  onChange={e => setEditingItem({ ...editingItem, gender: e.target.value as BamGender })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-bold bg-white"
                >
                  <option value="ikhwan">Ikhwan (Laki-laki)</option>
                  <option value="akhwat">Akhwat (Perempuan)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Item BAM</label>
                <input
                  type="text"
                  value={editingItem.nama_item}
                  onChange={e => setEditingItem({ ...editingItem, nama_item: e.target.value })}
                  placeholder="Contoh: Paket Seragam Lengkap Ikhwan (5 Stel)"
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold focus:outline-indigo-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nominal (Rp)</label>
                <input
                  type="number"
                  value={editingItem.nominal}
                  onChange={e => setEditingItem({ ...editingItem, nominal: Number(e.target.value) })}
                  min="0"
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-extrabold text-emerald-700 focus:outline-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Urutan Tampilan</label>
                <input
                  type="number"
                  value={editingItem.urutan}
                  onChange={e => setEditingItem({ ...editingItem, urutan: Number(e.target.value) })}
                  min="1"
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Keterangan / Rincian</label>
                <textarea
                  value={editingItem.keterangan || ''}
                  onChange={e => setEditingItem({ ...editingItem, keterangan: e.target.value })}
                  rows={2}
                  placeholder="Keterangan tambahan item..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-medium"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="statusAktif"
                  checked={editingItem.aktif}
                  onChange={e => setEditingItem({ ...editingItem, aktif: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                />
                <label htmlFor="statusAktif" className="font-bold text-slate-700 cursor-pointer">
                  Status Item Aktif (Dihitung ke Total BAM)
                </label>
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEditedItem}
                disabled={isSavingToSupabase}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingToSupabase ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL RINCIAN PEMBAYARAN PER CALON MURID (SECTION L & S)          */}
      {/* ================================================================= */}
      {selectedStudentSummary && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  DATA CALON MURID & RINCIAN BAM
                </h3>
                <p className="text-xs text-slate-500">
                  Rincian tagihan BAM terperinci berdasarkan data resmi Supabase.
                </p>
              </div>
              <button
                onClick={() => setSelectedStudentSummary(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* DATA CALON MURID (SECTION L) */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="font-extrabold text-slate-800 uppercase tracking-wide border-b pb-1 text-[11px]">
                DATA CALON MURID
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                <div>
                  <span className="text-slate-500">Nama Calon Murid:</span>{' '}
                  <strong className="text-slate-900">{selectedStudentSummary.fullName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Nomor Pendaftaran:</span>{' '}
                  <strong className="font-mono text-slate-900">{selectedStudentSummary.registrationNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Jenis Kelamin:</span>{' '}
                  <strong className="text-slate-900">
                    {selectedStudentSummary.gender} ({selectedStudentSummary.rawGender})
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Status Pembayaran:</span>{' '}
                  <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                    selectedStudentSummary.status === 'LUNAS'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedStudentSummary.status === 'SEBAGIAN'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {selectedStudentSummary.status}
                  </span>
                </div>
              </div>
            </div>

            {/* TABEL RINCIAN BAM (SECTION L) */}
            <div>
              <div className="font-extrabold text-slate-800 uppercase tracking-wide text-xs mb-2">
                RINCIAN ITEM BAM
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b font-bold text-slate-700">
                      <th className="p-2.5 w-14 text-center">No. Urut</th>
                      <th className="p-2.5">Item BAM</th>
                      <th className="p-2.5">Tagihan (Rp)</th>
                      <th className="p-2.5">Dibayar (Rp)</th>
                      <th className="p-2.5">Sisa (Rp)</th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {selectedStudentItemsBreakdown.map(item => (
                      <tr key={item.no} className="hover:bg-slate-50 font-medium">
                        <td className="p-2.5 text-center text-slate-600 font-mono font-bold">{item.no}</td>
                        <td className="p-2.5 font-bold text-slate-900">{item.nama_item}</td>
                        <td className="p-2.5 text-slate-700 font-semibold">
                          Rp {item.nominal.toLocaleString('id-ID')}
                        </td>
                        <td className="p-2.5 font-bold text-emerald-700">
                          Rp {item.dibayar.toLocaleString('id-ID')}
                        </td>
                        <td className="p-2.5 font-bold text-rose-600">
                          Rp {item.sisa.toLocaleString('id-ID')}
                        </td>
                        <td className="p-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.status === 'LUNAS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'SEBAGIAN'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RINGKASAN TOTAL BAM (SECTION L) */}
            <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>TOTAL BAM:</span>
                <span className="font-extrabold text-white text-sm">
                  Rp {selectedStudentSummary.totalBam.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between items-center text-emerald-400 font-bold">
                <span>TOTAL DIBAYAR:</span>
                <span className="text-sm">
                  Rp {selectedStudentSummary.amountPaid.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between items-center text-rose-400 font-extrabold text-sm border-t border-slate-800 pt-2">
                <span>TOTAL TUNGGAKAN:</span>
                <span>
                  {selectedStudentSummary.remaining === 0 ? 'Rp 0 (LUNAS)' : `Rp ${selectedStudentSummary.remaining.toLocaleString('id-ID')}`}
                </span>
              </div>
            </div>

            {/* AKSI DI MODAL */}
            <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-2">
              <div>
                {selectedStudentSummary.remaining > 0 && (
                  <button
                    onClick={() => handlePrintSuratTunggakan(selectedStudentSummary)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Cetak Surat Keterangan Tunggakan BAM</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleOpenInputPayment(selectedStudentSummary);
                    setSelectedStudentSummary(null);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Input Bayar Siswa Ini</span>
                </button>
                <button
                  onClick={() => setSelectedStudentSummary(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL INPUT PEMBAYARAN BAM                                        */}
      {/* ================================================================= */}
      {payingStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Input Pembayaran BAM
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  {payingStudent.fullName} ({payingStudent.registrationNumber})
                </p>
              </div>
              <button
                onClick={() => setPayingStudent(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs border border-slate-200">
              <div className="flex justify-between text-slate-600">
                <span>Total Biaya BAM:</span>
                <strong>Rp {payingStudent.totalBam.toLocaleString('id-ID')}</strong>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Telah Terbayar:</span>
                <strong>Rp {payingStudent.amountPaid.toLocaleString('id-ID')}</strong>
              </div>
              <div className="flex justify-between text-rose-600 font-extrabold pt-1 border-t border-slate-200">
                <span>Sisa Tunggakan Saat Ini:</span>
                <span>Rp {payingStudent.remaining.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nominal Pembayaran (Rp)</label>
                <input
                  type="number"
                  value={inputPaymentAmount}
                  onChange={e => setInputPaymentAmount(Number(e.target.value))}
                  min="1"
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-extrabold text-emerald-700 text-sm focus:outline-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Tanggal Pembayaran</label>
                <input
                  type="date"
                  value={inputPaymentDate}
                  onChange={e => setInputPaymentDate(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Metode Pembayaran</label>
                <select
                  value={inputPaymentMethod}
                  onChange={e => setInputPaymentMethod(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold bg-white"
                >
                  <option value="Transfer Bank BSI">Transfer Bank BSI (451 - 3953157480)</option>
                  <option value="Transfer Bank Mandiri">Transfer Bank Mandiri</option>
                  <option value="Tunai di Kasir Sekolah">Tunai di Kasir Sekolah</option>
                  <option value="Virtual Account">Virtual Account</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Keterangan / Catatan</label>
                <input
                  type="text"
                  value={inputPaymentNotes}
                  onChange={e => setInputPaymentNotes(e.target.value)}
                  placeholder="Contoh: Cicilan Tahap 1 / Pelunasan BAM"
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-medium"
                />
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button
                onClick={() => setPayingStudent(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveStudentPayment}
                disabled={isSubmittingPayment}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmittingPayment ? 'Menyimpan...' : 'Simpan Pembayaran'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT PROOF MODAL */}
      <PaymentProofModal
        isOpen={!!activeProofData}
        onClose={() => setActiveProofData(null)}
        data={activeProofData}
      />
    </div>
  );
};
