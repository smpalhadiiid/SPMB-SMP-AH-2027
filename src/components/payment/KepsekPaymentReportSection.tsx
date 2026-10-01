// =====================================================================
// src/components/payment/KepsekPaymentReportSection.tsx
// Dashboard Kepala Sekolah: LAPORAN PEMBAYARAN SPMB
// Sesuai Spesifikasi:
// 1. PEMBAYARAN FORMULIR
// 2. PEMBAYARAN BAM
// Terpisah secara ketat, filter-aware, export Excel & PDF resmi.
// =====================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { SchoolInfo, StudentData, FormPaymentRecord, BamPaymentRecord } from '../../types';
import { getStoredFormPayments, getStoredBamPayments, getKepalaSekolahName } from '../../utils/storage';
import { PaymentRepository } from '../../repositories/PaymentRepository';
import { fetchFormPaymentsFromSupabase, fetchBamPaymentsFromSupabase } from '../../utils/supabaseClient';
import { exportToExcel } from '../../utils/excelExporter';
import { generateReportPDF, generateSuratTunggakanBamPDF } from '../../utils/pdfGenerator';
import {
  fetchAndCacheBamItems,
  getTotalBamCost,
  calculateBamRemaining,
  getBamPaymentStatus,
  normalizeBamGender,
  getLoadedBamItems,
} from '../../utils/bamPricing';
import {
  FileText, FileSpreadsheet, ShieldCheck, DollarSign,
  TrendingUp, Users, CheckCircle2, Filter, Database, RefreshCw,
  Search, RotateCcw, AlertTriangle, AlertCircle, Clock, Eye, Image as ImageIcon
} from 'lucide-react';
import { PaymentProofModal, ProofModalData } from './PaymentProofModal';

interface KepsekPaymentReportSectionProps {
  schoolInfo: SchoolInfo;
  students?: StudentData[];
}

export const KepsekPaymentReportSection: React.FC<KepsekPaymentReportSectionProps> = ({
  schoolInfo,
  students = [],
}) => {
  // Main Tab: 1. PEMBAYARAN FORMULIR | 2. PEMBAYARAN BAM
  const [activeMainTab, setActiveMainTab] = useState<'form' | 'bam'>('form');

  const [formPayments, setFormPayments] = useState<FormPaymentRecord[]>(() => getStoredFormPayments());
  const [bamPayments, setBamPayments] = useState<BamPaymentRecord[]>(() => getStoredBamPayments());
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);

  // Bukti Modal State
  const [activeProofData, setActiveProofData] = useState<ProofModalData | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'ikhwan' | 'akhwat'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Load latest BAM items from Supabase to ensure single source of truth for pricing
  useEffect(() => {
    fetchAndCacheBamItems().catch(e => console.warn('BAM items sync:', e));
  }, []);

  // Fetch payments from Supabase
  const loadPaymentsFromSupabase = async () => {
    setIsLoadingPayments(true);
    try {
      const [formRes, bamRes] = await Promise.all([
        PaymentRepository.list('form'),
        PaymentRepository.list('bam'),
      ]);

      if (formRes.data && formRes.data.length > 0) {
        setFormPayments(formRes.data.map(p => ({
          id: p.id,
          transactionNumber: p.id,
          paymentDate: p.paymentDate || (p.createdAt ? p.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
          studentId: p.studentId,
          studentName: p.studentName || 'Calon Murid',
          registrationNumber: p.registrationNumber || 'SPMB',
          gender: p.gender || 'Laki-laki',
          amount: Number(p.amount || 200000),
          category: 'Internal',
          proofUrl: p.proofUrl,
          status: (p.status as any) || 'verified',
          notes: p.notes,
          createdAt: p.createdAt || new Date().toISOString(),
        })));
      } else {
        const cloud = await fetchFormPaymentsFromSupabase();
        if (cloud && cloud.length > 0) setFormPayments(cloud);
      }

      if (bamRes.data && bamRes.data.length > 0) {
        setBamPayments(bamRes.data.map(p => {
          const matchedStudent = students.find(s => s.id === p.studentId || s.registrationNumber === p.registrationNumber);
          const gender = matchedStudent ? normalizeBamGender(matchedStudent) : (p.gender === 'Perempuan' ? 'akhwat' : 'ikhwan');
          const totalCost = getTotalBamCost(matchedStudent || { gender: p.gender });
          const amountPaid = Number(p.amount || 0);
          return {
            id: p.id,
            transactionNumber: p.id,
            paymentDate: p.paymentDate || (p.createdAt ? p.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
            studentId: p.studentId,
            studentName: p.studentName || 'Calon Murid',
            registrationNumber: p.registrationNumber || 'SPMB',
            gender: p.gender || 'Laki-laki',
            totalBamCost: totalCost,
            amountPaid,
            installmentType: amountPaid >= totalCost ? 'Lunas' : 'Cicilan 1',
            paymentStatus: getBamPaymentStatus(totalCost, amountPaid),
            totalPaidToDate: amountPaid,
            remainingBalance: calculateBamRemaining(totalCost, amountPaid),
            proofUrl: p.proofUrl,
            notes: p.notes,
          };
        }));
      } else {
        const cloud = await fetchBamPaymentsFromSupabase();
        if (cloud && cloud.length > 0) setBamPayments(cloud);
      }
    } catch (err) {
      console.warn('Kepsek payments load error:', err);
    } finally {
      setIsLoadingPayments(false);
    }
  };

  useEffect(() => {
    loadPaymentsFromSupabase();
  }, [students]);

  // Reset filter helper
  const handleResetFilter = () => {
    setSearchQuery('');
    setGenderFilter('all');
    setStatusFilter('all');
  };

  // =====================================================================
  // 1. DATA PEMBAYARAN FORMULIR (MAPPING DARI STUDENTS & PAYMENTS)
  // =====================================================================
  interface FormReportRow {
    id: string;
    registrationNumber: string;
    studentName: string;
    gender: 'Laki-laki' | 'Perempuan';
    paymentDate: string;
    nominal: number;
    status: 'Sudah Bayar' | 'Belum Bayar';
    proofUrl?: string;
    student: StudentData;
  }

  const formReportRows: FormReportRow[] = useMemo(() => {
    // Gunakan students sebagai basis agar semua pendaftar ter-cover
    return students.map(st => {
      const pRecord = formPayments.find(p => p.studentId === st.id || p.registrationNumber === st.registrationNumber);
      const isPaid = st.formPaymentStatus === 'verified' || (pRecord && pRecord.status === 'verified');
      const date = pRecord?.paymentDate || st.formPaymentDate || (st.createdAt ? st.createdAt.split('T')[0] : '-');
      const nominal = pRecord?.amount || st.formPaymentAmount || 200000;
      const proofUrl = pRecord?.proofUrl || st.formPaymentProofUrl;

      return {
        id: st.id,
        registrationNumber: st.registrationNumber || 'SPMB',
        studentName: st.fullName || 'Calon Murid',
        gender: (st.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki') as 'Laki-laki' | 'Perempuan',
        paymentDate: isPaid ? date : '-',
        nominal: isPaid ? nominal : 0,
        status: isPaid ? 'Sudah Bayar' : 'Belum Bayar',
        proofUrl,
        student: st,
      };
    });
  }, [students, formPayments]);

  // Metrics Formulir
  const formMetrics = useMemo(() => {
    const totalPendaftar = formReportRows.length;
    const sudahBayar = formReportRows.filter(r => r.status === 'Sudah Bayar').length;
    const belumBayar = formReportRows.filter(r => r.status === 'Belum Bayar').length;
    const totalNominalDiterima = formReportRows
      .filter(r => r.status === 'Sudah Bayar')
      .reduce((acc, curr) => acc + curr.nominal, 0);

    return { totalPendaftar, sudahBayar, belumBayar, totalNominalDiterima };
  }, [formReportRows]);

  // Filtered Formulir
  const filteredFormRows = useMemo(() => {
    return formReportRows.filter(row => {
      // Filter Gender
      if (genderFilter === 'ikhwan' && row.gender !== 'Laki-laki') return false;
      if (genderFilter === 'akhwat' && row.gender !== 'Perempuan') return false;

      // Filter Status
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;

      // Filter Search (Nama / No Pendaftaran)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = row.studentName.toLowerCase().includes(q);
        const matchReg = row.registrationNumber.toLowerCase().includes(q);
        if (!matchName && !matchReg) return false;
      }

      return true;
    });
  }, [formReportRows, genderFilter, statusFilter, searchQuery]);

  // =====================================================================
  // 2. DATA PEMBAYARAN BAM (MAPPING DARI STUDENTS, ITEMS SUPABASE & PAYMENTS)
  // =====================================================================
  interface BamReportRow {
    id: string;
    registrationNumber: string;
    studentName: string;
    gender: 'Laki-laki' | 'Perempuan';
    rawGender: 'ikhwan' | 'akhwat';
    totalBam: number;
    sudahDibayar: number;
    tunggakan: number;
    status: 'LUNAS' | 'SEBAGIAN' | 'BELUM BAYAR';
    paymentDate: string;
    proofUrl?: string;
    student: StudentData;
  }

  const bamReportRows: BamReportRow[] = useMemo(() => {
    return students.map(st => {
      const rawGender = normalizeBamGender(st);
      const genderDisplay = rawGender === 'akhwat' ? 'Perempuan' : 'Laki-laki';
      // Total BAM dihitung secara dinamis dari item BAM Supabase sesuai gender calon murid
      const totalBam = getTotalBamCost(st);

      // Cari total pembayaran BAM siswa ini
      const matchingPayments = bamPayments.filter(p => p.studentId === st.id || p.registrationNumber === st.registrationNumber);
      let sudahDibayar = matchingPayments.reduce((acc, p) => acc + (Number(p.amountPaid) || 0), 0);

      // Sinkronkan juga jika student.initialPaymentAmount sudah terisi
      if (st.initialPaymentAmount && st.initialPaymentAmount > sudahDibayar) {
        sudahDibayar = st.initialPaymentAmount;
      }

      const tunggakan = calculateBamRemaining(totalBam, sudahDibayar);
      const status = getBamPaymentStatus(totalBam, sudahDibayar);
      const latestPayDate = matchingPayments[0]?.paymentDate || st.initialPaymentDate || '-';
      const proofUrl = matchingPayments[0]?.proofUrl || st.initialPaymentProofUrl;

      return {
        id: st.id,
        registrationNumber: st.registrationNumber || 'SPMB',
        studentName: st.fullName || 'Calon Murid',
        gender: genderDisplay,
        rawGender,
        totalBam,
        sudahDibayar,
        tunggakan,
        status,
        paymentDate: latestPayDate,
        proofUrl,
        student: st,
      };
    });
  }, [students, bamPayments]);

  const handlePrintSuratTunggakan = (row: BamReportRow) => {
    const rawGender = row.rawGender;
    const itemsForLetter = getLoadedBamItems(rawGender).map(i => ({
      nama_item: i.nama_item,
      nominal: i.nominal,
    }));

    generateSuratTunggakanBamPDF(
      row.student,
      {
        totalBam: row.totalBam,
        totalPaid: row.sudahDibayar,
        remaining: row.tunggakan,
        items: itemsForLetter,
      },
      schoolInfo
    );
  };

  // Metrics BAM
  const bamMetrics = useMemo(() => {
    const totalCalonMurid = bamReportRows.length;
    const totalTagihanBAM = bamReportRows.reduce((acc, r) => acc + r.totalBam, 0);
    const totalPembayaranBAM = bamReportRows.reduce((acc, r) => acc + r.sudahDibayar, 0);
    const totalTunggakan = bamReportRows.reduce((acc, r) => acc + r.tunggakan, 0);

    const jumlahLunas = bamReportRows.filter(r => r.status === 'LUNAS').length;
    const jumlahSebagian = bamReportRows.filter(r => r.status === 'SEBAGIAN').length;
    const jumlahBelumBayar = bamReportRows.filter(r => r.status === 'BELUM BAYAR').length;

    return {
      totalCalonMurid,
      totalTagihanBAM,
      totalPembayaranBAM,
      totalTunggakan,
      jumlahLunas,
      jumlahSebagian,
      jumlahBelumBayar,
    };
  }, [bamReportRows]);

  // Filtered BAM
  const filteredBamRows = useMemo(() => {
    return bamReportRows.filter(row => {
      // Filter Gender
      if (genderFilter === 'ikhwan' && row.rawGender !== 'ikhwan') return false;
      if (genderFilter === 'akhwat' && row.rawGender !== 'akhwat') return false;

      // Filter Status (Lunas, Sebagian, Belum Bayar)
      if (statusFilter !== 'all') {
        if (row.status !== statusFilter.toUpperCase()) return false;
      }

      // Filter Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = row.studentName.toLowerCase().includes(q);
        const matchReg = row.registrationNumber.toLowerCase().includes(q);
        if (!matchName && !matchReg) return false;
      }

      return true;
    });
  }, [bamReportRows, genderFilter, statusFilter, searchQuery]);

  // =====================================================================
  // EXPORT EXCEL (SESUAI DOKUMEN & FILTER SAAT INI)
  // =====================================================================
  const handleExportExcel = () => {
    const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const cleanYear = schoolInfo.academicYear.replace('/', '-');

    if (activeMainTab === 'form') {
      const excelData = filteredFormRows.map((r, idx) => ({
        'No': idx + 1,
        'No Pendaftaran': r.registrationNumber,
        'Nama Calon Murid': r.studentName,
        'Jenis Kelamin': r.gender,
        'Tanggal Pembayaran': r.paymentDate,
        'Nominal Formulir': r.nominal,
        'Status': r.status,
      }));

      exportToExcel(
        excelData,
        `Laporan_Pembayaran_Formulir_${cleanYear}`,
        'Laporan Formulir',
        {
          title: 'LAPORAN REKAPITULASI PEMBAYARAN FORMULIR PENDAFTARAN SPMB',
          schoolName: schoolInfo.name || 'SMPS AL-HADIID CILEUNGSI',
          academicYear: schoolInfo.academicYear,
          printDate: todayStr,
        }
      );
    } else {
      // Laporan BAM
      const excelData = filteredBamRows.map((r, idx) => ({
        'No': idx + 1,
        'No Pendaftaran': r.registrationNumber,
        'Nama Calon Murid': r.studentName,
        'Gender': r.gender,
        'Total BAM': r.totalBam,
        'Sudah Dibayar': r.sudahDibayar,
        'Tunggakan': r.tunggakan,
        'Status': r.status,
      }));

      exportToExcel(
        excelData,
        `Laporan_Pembayaran_BAM_${cleanYear}`,
        'Laporan BAM',
        {
          title: 'LAPORAN REKAPITULASI PEMBAYARAN BIAYA AWAL MASUK (BAM)',
          schoolName: schoolInfo.name || 'SMPS AL-HADIID CILEUNGSI',
          academicYear: schoolInfo.academicYear,
          printDate: todayStr,
        }
      );
    }
  };

  // =====================================================================
  // EXPORT PDF (TEMPLATE RESMI APLIKASI, LOGO, HEADER BERULANG, FOOTER)
  // =====================================================================
  const handleExportPDF = () => {
    const cleanYear = schoolInfo.academicYear.replace('/', '_');

    if (activeMainTab === 'form') {
      const pdfData = filteredFormRows.map((r, idx) => ({
        'No': idx + 1,
        'No_Pendaftaran': r.registrationNumber,
        'Nama': r.studentName,
        'Gender': r.gender,
        'Tanggal': r.paymentDate,
        'Nominal': `Rp ${r.nominal.toLocaleString('id-ID')}`,
        'Status': r.status,
      }));

      generateReportPDF(
        `Laporan_Pembayaran_Formulir_${cleanYear}`,
        pdfData,
        ['No', 'No_Pendaftaran', 'Nama', 'Gender', 'Tanggal', 'Nominal', 'Status'],
        schoolInfo
      );
    } else {
      // BAM
      const pdfData = filteredBamRows.map((r, idx) => ({
        'No': idx + 1,
        'No_Pendaftaran': r.registrationNumber,
        'Nama': r.studentName,
        'Gender': r.gender,
        'Total_BAM': `Rp ${r.totalBam.toLocaleString('id-ID')}`,
        'Total_Dibayar': `Rp ${r.sudahDibayar.toLocaleString('id-ID')}`,
        'Tunggakan': r.tunggakan > 0 ? `Rp ${r.tunggakan.toLocaleString('id-ID')}` : 'Rp 0 (LUNAS)',
        'Status': r.status,
      }));

      generateReportPDF(
        `Laporan_Pembayaran_BAM_${cleanYear}`,
        pdfData,
        ['No', 'No_Pendaftaran', 'Nama', 'Gender', 'Total_BAM', 'Total_Dibayar', 'Tunggakan', 'Status'],
        schoolInfo
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Kepsek Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-semibold mb-2 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Dashboard Kepala Sekolah SMPS Al-Hadiid</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            LAPORAN PEMBAYARAN SPMB
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Laporan resmi pembayaran Formulir Pendaftaran dan Biaya Awal Masuk (BAM) real-time dari database Supabase.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadPaymentsFromSupabase}
            disabled={isLoadingPayments}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Refresh Data dari Supabase"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPayments ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{isLoadingPayments ? 'Memuat...' : 'Refresh Data'}</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>CETAK PDF</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>EXPORT EXCEL</span>
          </button>
        </div>
      </div>

      {/* DUA TAB UTAMA: 1. PEMBAYARAN FORMULIR | 2. PEMBAYARAN BAM */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-2">
        <button
          onClick={() => {
            setActiveMainTab('form');
            setStatusFilter('all');
          }}
          className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeMainTab === 'form'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>1. PEMBAYARAN FORMULIR</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            activeMainTab === 'form' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200 text-slate-700'
          }`}>
            {formMetrics.totalPendaftar} Siswa
          </span>
        </button>

        <button
          onClick={() => {
            setActiveMainTab('bam');
            setStatusFilter('all');
          }}
          className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeMainTab === 'bam'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>2. PEMBAYARAN BAM (BIAYA AWAL MASUK)</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            activeMainTab === 'bam' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-700'
          }`}>
            {bamMetrics.totalCalonMurid} Siswa
          </span>
        </button>
      </div>

      {/* ================================================================= */}
      {/* BAGIAN 1: PEMBAYARAN FORMULIR */}
      {/* ================================================================= */}
      {activeMainTab === 'form' && (
        <div className="space-y-5">
          {/* KPI CARDS FORMULIR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Total Pendaftar</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                {formMetrics.totalPendaftar} Calon Murid
              </div>
              <div className="text-[10px] text-slate-400 font-semibold pt-1 border-t border-slate-100">
                Pendaftaran Resmi SPMB
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold text-emerald-700 uppercase">Jumlah Sudah Bayar</div>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1">
                {formMetrics.sudahBayar} Siswa
              </div>
              <div className="text-[10px] text-emerald-600 font-bold pt-1 border-t border-slate-100">
                ✓ Formulir Terverifikasi
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold text-rose-700 uppercase">Jumlah Belum Bayar</div>
              <div className="text-2xl font-extrabold text-rose-600 mt-1">
                {formMetrics.belumBayar} Siswa
              </div>
              <div className="text-[10px] text-rose-500 font-semibold pt-1 border-t border-slate-100">
                Menunggu Pembayaran
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold text-indigo-700 uppercase">Total Nominal Diterima</div>
              <div className="text-2xl font-extrabold text-indigo-900 mt-1">
                Rp {formMetrics.totalNominalDiterima.toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] text-slate-400 font-semibold pt-1 border-t border-slate-100">
                Dana Kas Formulir Masuk
              </div>
            </div>
          </div>

          {/* FILTER FORMULIR */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari Nama Calon Murid / No. Pendaftaran..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-emerald-500 bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-600">Gender:</span>
                <select
                  value={genderFilter}
                  onChange={e => setGenderFilter(e.target.value as any)}
                  className="border border-slate-300 rounded-lg p-2 text-xs bg-white font-semibold"
                >
                  <option value="all">Semua</option>
                  <option value="ikhwan">Ikhwan (Laki-laki)</option>
                  <option value="akhwat">Akhwat (Perempuan)</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-600">Status:</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="border border-slate-300 rounded-lg p-2 text-xs bg-white font-semibold"
                >
                  <option value="all">Semua</option>
                  <option value="Sudah Bayar">Sudah Bayar</option>
                  <option value="Belum Bayar">Belum Bayar</option>
                </select>
              </div>

              {(searchQuery || genderFilter !== 'all' || statusFilter !== 'all') && (
                <button
                  onClick={handleResetFilter}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>RESET FILTER</span>
                </button>
              )}
            </div>
          </div>

          {/* TABEL RINCIAN PEMBAYARAN FORMULIR */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-sm">
                Tabel Rincian Pembayaran Formulir ({filteredFormRows.length} Data)
              </h3>
              <span className="text-xs text-emerald-700 font-bold">
                Total Terverifikasi: Rp {filteredFormRows.filter(r => r.status === 'Sudah Bayar').reduce((a, c) => a + c.nominal, 0).toLocaleString('id-ID')}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[750px]">
                <thead>
                  <tr className="bg-slate-100 border-b font-bold text-slate-700 whitespace-nowrap">
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">No. Pendaftaran</th>
                    <th className="p-3">Nama Calon Murid</th>
                    <th className="p-3">Jenis Kelamin</th>
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">Nominal</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-center">Bukti</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredFormRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                        Tidak ada data pembayaran formulir yang sesuai dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredFormRows.map((r, i) => (
                      <tr key={r.id} className="hover:bg-slate-50 font-medium whitespace-nowrap">
                        <td className="p-3 text-center text-slate-400 font-mono">{i + 1}</td>
                        <td className="p-3 font-mono font-bold text-slate-700">{r.registrationNumber}</td>
                        <td className="p-3 font-extrabold text-slate-900">{r.studentName}</td>
                        <td className="p-3 font-semibold">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            r.gender === 'Laki-laki' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                          }`}>
                            {r.gender === 'Laki-laki' ? 'Ikhwan' : 'Akhwat'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 font-mono text-[11px]">{r.paymentDate}</td>
                        <td className="p-3 font-extrabold text-emerald-700">
                          {r.nominal > 0 ? `Rp ${r.nominal.toLocaleString('id-ID')}` : '-'}
                        </td>
                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                            r.status === 'Sudah Bayar'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            {r.status === 'Sudah Bayar' ? '✓ SUDAH BAYAR' : 'BELUM BAYAR'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {r.proofUrl ? (
                            <button
                              onClick={() => setActiveProofData({
                                url: r.proofUrl,
                                studentName: r.studentName,
                                regNo: r.registrationNumber,
                                paymentType: 'form',
                                amount: r.nominal,
                                date: r.paymentDate,
                                status: r.status,
                              })}
                              className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                              title="Lihat Bukti Pembayaran Formulir"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Bukti</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">-</span>
                          )}
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
      {/* BAGIAN 2: PEMBAYARAN BAM (BIAYA AWAL MASUK) */}
      {/* ================================================================= */}
      {activeMainTab === 'bam' && (
        <div className="space-y-5">
          {/* KPI CARDS BAM */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Total Calon Murid</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                {bamMetrics.totalCalonMurid} Siswa
              </div>
              <div className="text-[10px] text-slate-400 font-semibold pt-1 border-t border-slate-100">
                Ikhwan & Akhwat Terdaftar
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold text-indigo-700 uppercase">Total Tagihan BAM</div>
              <div className="text-2xl font-extrabold text-indigo-900 mt-1">
                Rp {bamMetrics.totalTagihanBAM.toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] text-indigo-600 font-bold pt-1 border-t border-slate-100">
                Akumulasi Tagihan Resmi
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold text-emerald-700 uppercase">Total Pembayaran Terkumpul</div>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1">
                Rp {bamMetrics.totalPembayaranBAM.toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] text-emerald-600 font-bold pt-1 border-t border-slate-100">
                Penerimaan Dana BAM Kas
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold text-rose-700 uppercase">Total Tunggakan BAM</div>
              <div className="text-2xl font-extrabold text-rose-600 mt-1">
                Rp {bamMetrics.totalTunggakan.toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] text-rose-500 font-bold pt-1 border-t border-slate-100">
                Piutang Wajib Dilunasi
              </div>
            </div>
          </div>

          {/* SECOND ROW: STATISTIK STATUS BAM */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-emerald-800 uppercase">Jumlah Lunas</div>
                <div className="text-xl font-extrabold text-emerald-900 mt-0.5">{bamMetrics.jumlahLunas} Siswa</div>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-80" />
            </div>

            <div className="bg-amber-50/80 p-3.5 rounded-xl border border-amber-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-amber-800 uppercase">Jumlah Sebagian (Cicilan)</div>
                <div className="text-xl font-extrabold text-amber-900 mt-0.5">{bamMetrics.jumlahSebagian} Siswa</div>
              </div>
              <Clock className="w-8 h-8 text-amber-500 opacity-80" />
            </div>

            <div className="bg-rose-50/80 p-3.5 rounded-xl border border-rose-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-rose-800 uppercase">Jumlah Belum Bayar</div>
                <div className="text-xl font-extrabold text-rose-900 mt-0.5">{bamMetrics.jumlahBelumBayar} Siswa</div>
              </div>
              <AlertTriangle className="w-8 h-8 text-rose-500 opacity-80" />
            </div>
          </div>

          {/* FILTER DASHBOARD KEPALA SEKOLAH (SESUAI SECTION P) */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari Nama Calon Murid / No. Pendaftaran..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-indigo-500 bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-600">Gender:</span>
                <select
                  value={genderFilter}
                  onChange={e => setGenderFilter(e.target.value as any)}
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
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="border border-slate-300 rounded-lg p-2 text-xs bg-white font-semibold"
                >
                  <option value="all">Semua</option>
                  <option value="LUNAS">Lunas</option>
                  <option value="SEBAGIAN">Sebagian</option>
                  <option value="BELUM BAYAR">Belum Bayar</option>
                </select>
              </div>

              {(searchQuery || genderFilter !== 'all' || statusFilter !== 'all') && (
                <button
                  onClick={handleResetFilter}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>RESET FILTER</span>
                </button>
              )}
            </div>
          </div>

          {/* TABEL RINCIAN PEMBAYARAN BAM (SESUAI SECTION O) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <h3 className="font-extrabold text-slate-900 text-sm">
                Tabel Rincian Pembayaran BAM ({filteredBamRows.length} Data Calon Murid)
              </h3>
              <div className="text-xs space-x-3 font-bold">
                <span className="text-emerald-700">
                  Total Dibayar: Rp {filteredBamRows.reduce((a, c) => a + c.sudahDibayar, 0).toLocaleString('id-ID')}
                </span>
                <span className="text-rose-600">
                  Tunggakan: Rp {filteredBamRows.reduce((a, c) => a + c.tunggakan, 0).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[950px]">
                <thead>
                  <tr className="bg-slate-100 border-b font-bold text-slate-700 whitespace-nowrap">
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">No. Pendaftaran</th>
                    <th className="p-3">Nama</th>
                    <th className="p-3">Gender</th>
                    <th className="p-3">Total BAM</th>
                    <th className="p-3">Sudah Dibayar</th>
                    <th className="p-3">Tunggakan</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-center">Bukti</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredBamRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400 italic">
                        Tidak ada data pembayaran BAM yang sesuai dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredBamRows.map((r, i) => (
                      <tr key={r.id} className="hover:bg-slate-50 font-medium whitespace-nowrap">
                        <td className="p-3 text-center text-slate-400 font-mono">{i + 1}</td>
                        <td className="p-3 font-mono font-bold text-slate-700">{r.registrationNumber}</td>
                        <td className="p-3 font-extrabold text-slate-900">{r.studentName}</td>
                        <td className="p-3 font-semibold">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            r.rawGender === 'ikhwan' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                          }`}>
                            {r.gender}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-700">
                          Rp {r.totalBam.toLocaleString('id-ID')}
                        </td>
                        <td className="p-3 font-extrabold text-emerald-700">
                          Rp {r.sudahDibayar.toLocaleString('id-ID')}
                        </td>
                        <td className="p-3 font-extrabold">
                          {r.tunggakan === 0 ? (
                            <span className="text-emerald-600">Rp 0 (LUNAS)</span>
                          ) : (
                            <span className="text-rose-600">Rp {r.tunggakan.toLocaleString('id-ID')}</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                            r.status === 'LUNAS'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : r.status === 'SEBAGIAN'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {r.proofUrl ? (
                            <button
                              onClick={() => setActiveProofData({
                                url: r.proofUrl,
                                studentName: r.studentName,
                                regNo: r.registrationNumber,
                                paymentType: 'bam',
                                amount: r.sudahDibayar,
                                date: r.paymentDate,
                                status: r.status,
                              })}
                              className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                              title="Lihat Bukti Pembayaran BAM"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Bukti</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {r.tunggakan > 0 ? (
                            <button
                              onClick={() => handlePrintSuratTunggakan(r)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg transition-all text-xs inline-flex items-center gap-1 cursor-pointer"
                              title="Cetak Surat Keterangan Tunggakan BAM"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Surat Tunggakan</span>
                            </button>
                          ) : (
                            <span className="text-emerald-600 font-bold text-xs inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Lunas</span>
                            </span>
                          )}
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

      {/* Pengesahan Laporan Keuangan Kepala Sekolah */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs">
        <h3 className="font-bold text-slate-900 text-sm border-b pb-2">
          Pengesahan Laporan Keuangan Kepala Sekolah
        </h3>
        <p className="text-slate-600 leading-relaxed">
          Seluruh data penerimaan pembayaran Formulir Pendaftaran dan Biaya Awal Masuk (BAM) di atas telah disajikan secara transparan dan akurat berdasarkan transaksi riil panitia penerimaan murid baru SMPS Al-Hadiid Cileungsi TP {schoolInfo.academicYear}.
        </p>
        <div className="pt-4 flex justify-end">
          <div className="text-center space-y-1">
            <div>Cileungsi, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            <div className="font-bold text-slate-900 pt-8 border-b border-slate-800">
              {getKepalaSekolahName(schoolInfo)}
            </div>
            <div className="text-[11px] text-slate-500">
              {schoolInfo.headmasterNiy ? `NIY. ${schoolInfo.headmasterNiy}` : 'Kepala Sekolah SMPS Al-Hadiid Cileungsi'}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Bukti Pembayaran */}
      <PaymentProofModal
        isOpen={!!activeProofData}
        onClose={() => setActiveProofData(null)}
        data={activeProofData}
      />
    </div>
  );
};
