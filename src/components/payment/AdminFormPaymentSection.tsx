import React, { useState } from 'react';
import { StudentData, FormPaymentRecord } from '../../types';
import { getStoredFormPayments, saveFormPayments } from '../../utils/storage';
import {
  CreditCard, Plus, Search, Filter, CheckCircle2, User,
  Calendar, Hash, DollarSign, Tag, FileText, Trash2, Database, Pencil,
  ShieldCheck, Eye
} from 'lucide-react';
import { getStoredBamPayments } from '../../utils/storage';
import { PaymentSqlModal } from './PaymentSqlModal';

interface AdminFormPaymentSectionProps {
  students: StudentData[];
  onUpdateStudents: (updated: StudentData[]) => void;
}

export const AdminFormPaymentSection: React.FC<AdminFormPaymentSectionProps> = ({
  students,
  onUpdateStudents,
}) => {
  const [records, setRecords] = useState<FormPaymentRecord[]>(() => getStoredFormPayments());
  const [showModal, setShowModal] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGender, setFilterGender] = useState<'all' | 'Laki-laki' | 'Perempuan'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'Internal' | 'Eksternal' | 'Bazaar'>('all');

  const handleVerifyStudentForm = (studentId: string, isVerified: boolean) => {
    const targetStudent = students.find(s => s.id === studentId);
    if (!targetStudent) return;

    const updatedStudents = students.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          formPaymentStatus: isVerified ? ('verified' as const) : ('rejected' as const),
          isFormVerified: isVerified,
          status: isVerified && (s.status === 'pending_payment' || s.status === 'draft' || s.status === 'verifying_payment')
            ? ('filling_form' as const)
            : s.status,
        };
      }
      return s;
    });

    onUpdateStudents(updatedStudents);

    if (isVerified) {
      const existingRecord = records.find(r => r.studentId === studentId || r.studentName.toLowerCase() === targetStudent.fullName.toLowerCase());
      if (!existingRecord) {
        const newRecord: FormPaymentRecord = {
          id: `fpay_${Date.now()}`,
          transactionNumber: `TRX-FORM-${Date.now().toString().slice(-6)}`,
          paymentDate: targetStudent.formPaymentDate || new Date().toISOString().split('T')[0],
          studentId: targetStudent.id,
          studentName: targetStudent.fullName,
          registrationNumber: targetStudent.registrationNumber || `SPMB${Date.now().toString().slice(-8)}`,
          gender: targetStudent.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki',
          amount: targetStudent.formPaymentAmount || 200000,
          category: 'Internal',
          notes: targetStudent.formPaymentNotes || 'Verifikasi Otomatis Upload Bukti Formulir',
          createdAt: new Date().toISOString(),
        };
        const updatedRecords = [newRecord, ...records];
        setRecords(updatedRecords);
        saveFormPayments(updatedRecords);
      }
    }
  };

  // Form State
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [transactionNumber, setTransactionNumber] = useState(`TRX-FORM-${Date.now().toString().slice(-6)}`);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [studentName, setStudentName] = useState('');
  const [gender, setGender] = useState<'Laki-laki' | 'Perempuan'>('Laki-laki');
  const [amount, setAmount] = useState<number>(200000);
  const [category, setCategory] = useState<'Internal' | 'Eksternal' | 'Bazaar'>('Internal');
  const [notes, setNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Handle student select change
  const handleStudentSelect = (studentId: string) => {
    setSelectedStudentId(studentId);
    const s = students.find(item => item.id === studentId);
    if (s) {
      setStudentName(s.fullName);
      setGender(s.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki');
    }
  };

  // Handle open modal for new payment
  const handleOpenModal = () => {
    setEditingRecordId(null);
    setTransactionNumber(`TRX-FORM-${Math.floor(100000 + Math.random() * 900000)}`);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setSelectedStudentId('');
    setStudentName('');
    setGender('Laki-laki');
    setAmount(200000);
    setCategory('Internal');
    setNotes('');
    setShowModal(true);
  };

  // Handle edit existing record
  const handleEditRecord = (record: FormPaymentRecord) => {
    setEditingRecordId(record.id);
    setTransactionNumber(record.transactionNumber);
    setPaymentDate(record.paymentDate);
    setSelectedStudentId(record.studentId || '');
    setStudentName(record.studentName);
    setGender(record.gender);
    setAmount(record.amount);
    setCategory(record.category);
    setNotes(record.notes || '');
    setShowModal(true);
  };

  // Submit Form Payment
  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      alert('Mohon pilih atau masukkan Nama Calon Murid');
      return;
    }

    const selectedStudent = students.find(s => s.id === selectedStudentId);
    const regNo = selectedStudent?.registrationNumber || `SPMB${Date.now().toString().slice(-8)}`;

    let updatedRecords: FormPaymentRecord[];

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
            amount: Number(amount) || 200000,
            category,
            notes,
          };
        }
        return r;
      });
      setSuccessMsg('✓ Perubahan data pembayaran formulir berhasil disimpan!');
    } else {
      const newRecord: FormPaymentRecord = {
        id: `fpay_${Date.now()}`,
        transactionNumber,
        registrationNumber: regNo,
        studentId: selectedStudentId || `std_${Date.now()}`,
        studentName,
        gender,
        paymentDate,
        amount: Number(amount) || 200000,
        category,
        notes,
        createdAt: new Date().toISOString(),
      };
      updatedRecords = [newRecord, ...records];
      setSuccessMsg('✓ Pembayaran Formulir berhasil disimpan dan diverifikasi!');
    }

    setRecords(updatedRecords);
    saveFormPayments(updatedRecords);

    // Update student form status in main state if student is linked
    if (selectedStudentId) {
      const updatedStudents = students.map(s => {
        if (s.id === selectedStudentId) {
          return {
            ...s,
            formPaymentStatus: 'verified' as const,
            formPaymentAmount: Number(amount) || 200000,
            formPaymentDate: paymentDate,
            formPaymentNotes: category,
            isFormVerified: true,
          };
        }
        return s;
      });
      onUpdateStudents(updatedStudents);
    }

    setShowModal(false);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Delete payment record
  const handleDeleteRecord = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus catatan pembayaran formulir ini?')) {
      const updated = records.filter(r => r.id !== id);
      setRecords(updated);
      saveFormPayments(updated);
    }
  };

  // Filter records
  const filteredRecords = records.filter(r => {
    const matchesSearch =
      r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.transactionNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesGender = filterGender === 'all' || r.gender === filterGender;
    const matchesCategory = filterCategory === 'all' || r.category === filterCategory;

    return matchesSearch && matchesGender && matchesCategory;
  });

  // Calculate totals
  const totalAmount = filteredRecords.reduce((acc, curr) => acc + curr.amount, 0);
  const countInternal = records.filter(r => r.category === 'Internal').length;
  const countEksternal = records.filter(r => r.category === 'Eksternal').length;
  const countBazaar = records.filter(r => r.category === 'Bazaar').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold mb-2">
            <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
            <span>Modul Pembayaran Formulir Pendaftaran</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Input & Pengelolaan Pembayaran Formulir
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Input transaksi formulir pendaftaran murid baru dengan kategori Internal, Eksternal, maupun Bazaar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowSqlModal(true)}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs rounded-xl border border-slate-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Skrip SQL</span>
          </button>
          <button
            onClick={handleOpenModal}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Input Pembayaran Formulir</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Total Transaksi Form</div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">{records.length} Transaksi</div>
          <div className="text-[10px] text-emerald-600 font-bold mt-0.5">Rp {totalAmount.toLocaleString('id-ID')}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-emerald-700 uppercase">Kategori Internal</div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-800 mt-1">{countInternal} Siswa</div>
          <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Asal SD Al-Hadiid / YPI</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-blue-700 uppercase">Kategori Eksternal</div>
          <div className="text-xl sm:text-2xl font-extrabold text-blue-800 mt-1">{countEksternal} Siswa</div>
          <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Pendaftar Umum / Luar</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-purple-700 uppercase">Kategori Bazaar</div>
          <div className="text-xl sm:text-2xl font-extrabold text-purple-800 mt-1">{countBazaar} Siswa</div>
          <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Event Bazaar SPMB</div>
        </div>
      </div>

      {/* SECTION VERIFIKASI BUKTI TRANSFER FORMULIR DARI CALON MURID */}
      {(() => {
        const pendingFormStudents = students.filter(s => !!s.formPaymentProofUrl);
        if (pendingFormStudents.length === 0) return null;

        return (
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl border border-indigo-500/30 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500 text-slate-950 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-indigo-300">
                    Verifikasi Bukti Transfer Formulir Terunggah ({pendingFormStudents.length} Pendaftar)
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Daftar calon murid yang telah mengunggah foto Bukti Transfer Biaya Formulir Pendaftaran (Rp200.000).
                  </p>
                </div>
              </div>
              <span className="text-xs bg-indigo-400/20 text-indigo-300 font-bold px-3 py-1 rounded-full border border-indigo-400/30">
                Memerlukan Verifikasi Admin
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingFormStudents.map(st => (
                <div key={st.id} className="bg-slate-900/90 p-4 rounded-xl border border-slate-700 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] bg-slate-800 text-amber-300 font-bold px-2 py-0.5 rounded">
                        {st.registrationNumber || 'NO-REG'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        st.formPaymentStatus === 'verified' || st.isFormVerified
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : st.formPaymentStatus === 'rejected'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                      }`}>
                        {st.formPaymentStatus === 'verified' || st.isFormVerified
                          ? '✓ VERIFIED LUNAS'
                          : st.formPaymentStatus === 'rejected'
                          ? '✕ DITOLAK'
                          : '⏳ MENUNGGU VERIFIKASI'}
                      </span>
                    </div>

                    <div>
                      <div className="font-extrabold text-sm text-white">{st.fullName}</div>
                      <div className="text-[11px] text-slate-400">
                        {st.gender} • Tgl: {st.formPaymentDate || '-'}
                      </div>
                      <div className="text-xs font-mono font-bold text-emerald-400 mt-1">
                        Nominal: Rp {(st.formPaymentAmount || 200000).toLocaleString('id-ID')}
                      </div>
                      {st.formPaymentNotes ? (
                        <div className="text-[10px] text-slate-300 italic truncate mt-0.5">
                          "{st.formPaymentNotes}"
                        </div>
                      ) : null}
                    </div>

                    {/* Image Thumbnail */}
                    {st.formPaymentProofUrl && (
                      <div className="relative group rounded-lg overflow-hidden border border-slate-700 bg-slate-950 h-28 flex items-center justify-center p-1">
                        <img
                          src={st.formPaymentProofUrl}
                          alt="Bukti Transfer Formulir"
                          className="max-h-26 object-contain rounded"
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={() => setPreviewProofUrl(st.formPaymentProofUrl || null)}
                          className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1 cursor-pointer"
                        >
                          <Eye className="w-4 h-4 text-amber-300" />
                          <span>Lihat Gambar Penuh</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleVerifyStudentForm(st.id, true)}
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verifikasi Lunas</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerifyStudentForm(st.id, false)}
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

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari Nama / No Transaksi / Reg..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
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
            <span className="font-bold text-slate-600 shrink-0">Kategori:</span>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value as any)}
              className="w-full sm:w-auto border border-slate-300 rounded-lg p-1.5 text-xs bg-white font-semibold"
            >
              <option value="all">Semua Kategori</option>
              <option value="Internal">Internal</option>
              <option value="Eksternal">Eksternal</option>
              <option value="Bazaar">Bazaar</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Data Pembayaran Formulir */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h3 className="font-bold text-slate-900 text-sm">
            Daftar Pembayaran Formulir ({filteredRecords.length} Data)
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            Total Nilai: <strong className="text-emerald-700 font-extrabold">Rp {totalAmount.toLocaleString('id-ID')}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-100 border-b font-bold text-slate-700 whitespace-nowrap">
                <th className="p-3">No</th>
                <th className="p-3">No. Transaksi</th>
                <th className="p-3">No. Reg</th>
                <th className="p-3">Tgl Pembayaran</th>
                <th className="p-3">Nama Calon Murid</th>
                <th className="p-3">Jenis Kelamin</th>
                <th className="p-3">Nominal</th>
                <th className="p-3">Keterangan</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 italic font-medium">
                    Belum ada data pembayaran formulir yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50 font-medium whitespace-nowrap">
                    <td className="p-3 text-slate-500 font-mono">{idx + 1}</td>
                    <td className="p-3 font-mono font-bold text-blue-700">{r.transactionNumber}</td>
                    <td className="p-3 font-mono text-slate-600">{r.registrationNumber}</td>
                    <td className="p-3 text-slate-600">{r.paymentDate}</td>
                    <td className="p-3 font-bold text-slate-900">{r.studentName}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                        r.gender === 'Perempuan' ? 'bg-pink-100 text-pink-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {r.gender}
                      </span>
                    </td>
                    <td className="p-3 font-extrabold text-emerald-700">
                      Rp {r.amount.toLocaleString('id-ID')}
                    </td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                        r.category === 'Internal' ? 'bg-emerald-100 text-emerald-800' :
                        r.category === 'Eksternal' ? 'bg-sky-100 text-sky-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {r.category}
                      </span>
                      {r.notes && <div className="text-[10px] text-slate-400 mt-0.5 italic">{r.notes}</div>}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEditRecord(r)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Transaksi"
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Input/Edit Pembayaran Formulir */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{editingRecordId ? 'Edit Data Pembayaran Formulir' : 'Form Input Pembayaran Formulir'}</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-4 text-xs">
              {/* Select Existing Student Optional */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Pilih Calon Murid Terdaftar (Opsional / Otomatis Isu)
                </label>
                <select
                  value={selectedStudentId}
                  onChange={e => handleStudentSelect(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500"
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
                    onChange={e => setGender(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold text-slate-800"
                  >
                    <option value="Laki-laki">Laki-laki (Ikhwan)</option>
                    <option value="Perempuan">Perempuan (Akhwat)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nominal Pembayaran (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={e => setAmount(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-extrabold text-emerald-800 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Keterangan (Asal / Program) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Internal', 'Eksternal', 'Bazaar'] as const).map(cat => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`py-2 px-2 sm:px-3 rounded-xl font-bold border text-center transition-all text-xs ${
                        category === cat
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Pembayaran tunai di loket / via transfer BSI"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-medium text-slate-800"
                />
              </div>

              <div className="pt-3 flex gap-2 justify-end border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingRecordId ? 'Simpan Perubahan' : 'Simpan Pembayaran'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SQL Modal */}
      <PaymentSqlModal
        isOpen={showSqlModal}
        onClose={() => setShowSqlModal(false)}
        formPayments={records}
        bamPayments={getStoredBamPayments()}
      />

      {/* PREVIEW IMAGE MODAL FOR ADMIN */}
      {previewProofUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-extrabold text-slate-900 text-sm">Pratinjau Foto Bukti Transfer Formulir</span>
              <button
                type="button"
                onClick={() => setPreviewProofUrl(null)}
                className="text-slate-500 hover:text-slate-800 font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto bg-slate-900 p-2 rounded-xl flex items-center justify-center">
              <img
                src={previewProofUrl}
                alt="Bukti Transfer Full"
                className="max-h-[70vh] object-contain rounded"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewProofUrl(null)}
                className="px-4 py-2 bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
