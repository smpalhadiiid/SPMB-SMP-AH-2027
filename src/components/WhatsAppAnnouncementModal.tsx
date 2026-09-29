import React, { useState, useEffect } from 'react';
import {
  X, Send, Copy, Check, MessageSquare, Phone, User, Users,
  ExternalLink, Sparkles, CheckCircle2, AlertCircle, FileText,
  RotateCcw, Info, MessageCircle
} from 'lucide-react';
import Swal from 'sweetalert2';
import { StudentData, SchoolInfo } from '../types';
import {
  ParentContactInfo,
  WhatsAppTemplateKey,
  WHATSAPP_TEMPLATES,
  getAvailableParentContacts,
  getPrimaryParentContact,
  cleanWhatsAppNumber,
  compileWhatsAppMessage,
  openWhatsAppLink,
  recordWhatsAppAnnouncementSent,
  createWhatsAppUrl
} from '../utils/whatsappAnnouncement';

interface WhatsAppAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentData | null;
  schoolInfo: SchoolInfo;
  defaultTemplateKey?: WhatsAppTemplateKey;
  onSentSuccess?: () => void;
}

export const WhatsAppAnnouncementModal: React.FC<WhatsAppAnnouncementModalProps> = ({
  isOpen,
  onClose,
  student,
  schoolInfo,
  defaultTemplateKey,
  onSentSuccess,
}) => {
  if (!isOpen || !student) return null;

  // Available contacts for this student
  const availableContacts = getAvailableParentContacts(student);
  const primaryContact = getPrimaryParentContact(student);

  // Selected recipient
  const [selectedRole, setSelectedRole] = useState<string>(primaryContact.role);
  const [customPhone, setCustomPhone] = useState<string>(primaryContact.phone);

  // Determine initial template key based on student status
  const getInitialTemplate = (): WhatsAppTemplateKey => {
    if (defaultTemplateKey) return defaultTemplateKey;
    if (student.status === 'passed') return 'passed';
    if (student.status === 'passed_reserved') return 'passed_reserved';
    if (student.status === 'failed') return 'failed';
    if (student.status === 'class_assigned') return 'class_placement';
    if (student.status === 're_registration_paid' || student.status === 're_registered') return 'payment_reminder';
    if (student.status === 'scheduled_test') return 'test_schedule';
    return 'custom';
  };

  const [selectedTemplateKey, setSelectedTemplateKey] = useState<WhatsAppTemplateKey>(getInitialTemplate());
  const [messageText, setMessageText] = useState<string>('');
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

  // Find active contact
  const activeContact = availableContacts.find(c => c.role === selectedRole) || primaryContact;
  const currentCleanPhone = cleanWhatsAppNumber(customPhone || activeContact.phone);
  const isValidPhone = !!currentCleanPhone;

  // Re-compile message when student, template, or contact changes
  useEffect(() => {
    const template = WHATSAPP_TEMPLATES.find(t => t.key === selectedTemplateKey) || WHATSAPP_TEMPLATES[0];
    const compiled = compileWhatsAppMessage(
      template.defaultMessage,
      student,
      schoolInfo,
      activeContact.name
    );
    setMessageText(compiled);
  }, [student, selectedTemplateKey, selectedRole, schoolInfo]);

  // When selected role changes, update custom phone
  const handleSelectRole = (role: string) => {
    setSelectedRole(role);
    const contact = availableContacts.find(c => c.role === role);
    if (contact) {
      setCustomPhone(contact.phone);
    }
  };

  // Insert variable tag into message text
  const handleInsertVariable = (variableTag: string) => {
    setMessageText(prev => prev + ' ' + variableTag);
  };

  // Reset to original template text
  const handleResetTemplate = () => {
    const template = WHATSAPP_TEMPLATES.find(t => t.key === selectedTemplateKey) || WHATSAPP_TEMPLATES[0];
    const compiled = compileWhatsAppMessage(
      template.defaultMessage,
      student,
      schoolInfo,
      activeContact.name
    );
    setMessageText(compiled);
  };

  // Copy message text to clipboard
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
      Swal.fire({
        icon: 'success',
        title: 'Teks Berhasil Disalin!',
        text: 'Teks pesan WhatsApp siap ditempel (paste).',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch {
      // fallback
    }
  };

  // Copy wa.me link
  const handleCopyLink = async () => {
    const url = createWhatsAppUrl(currentCleanPhone, messageText);
    if (!url) {
      Swal.fire({
        icon: 'warning',
        title: 'Nomor Tidak Valid',
        text: 'Harap periksa nomor WhatsApp sebelum menyalin link.',
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      Swal.fire({
        icon: 'success',
        title: 'Tautan WhatsApp Disalin!',
        text: 'Tautan langsung ke WhatsApp telah tersalin.',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch {
      // fallback
    }
  };

  // Send WhatsApp message
  const handleSendWhatsApp = () => {
    if (!isValidPhone) {
      Swal.fire({
        icon: 'warning',
        title: 'Nomor WhatsApp Tidak Valid',
        text: `Nomor tujuan (${customPhone || 'kosong'}) tidak memenuhi format WhatsApp Indonesia (harus diawali 08/628 dan minimal 10 digit).`,
      });
      return;
    }

    const ok = openWhatsAppLink(currentCleanPhone, messageText);
    if (ok) {
      recordWhatsAppAnnouncementSent(
        student.id,
        student.fullName,
        selectedRole,
        currentCleanPhone,
        selectedTemplateKey
      );

      if (onSentSuccess) {
        onSentSuccess();
      }

      Swal.fire({
        icon: 'success',
        title: 'WhatsApp Dibuka!',
        text: `Pesan pengumuman telah diarahkan ke WhatsApp ${activeContact.name} (+${currentCleanPhone}).`,
        timer: 2000,
        showConfirmButton: false,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-slate-900 px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-emerald-300">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white">Kirim Pengumuman WhatsApp Orang Tua</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-400 text-slate-950 uppercase tracking-wider">
                  Resmi
                </span>
              </div>
              <p className="text-xs text-emerald-200 mt-0.5">
                SMP Al-Hadiid Cileungsi &bull; TP {schoolInfo.academicYear}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Student Summary Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-[10px] text-slate-500 block">Calon Murid:</span>
              <strong className="text-slate-900 text-sm font-black">{student.fullName}</strong>
            </div>
            <div className="h-6 w-px bg-slate-300 hidden sm:block" />
            <div>
              <span className="text-[10px] text-slate-500 block">No. Registrasi:</span>
              <span className="font-mono font-bold text-emerald-700">{student.registrationNumber}</span>
            </div>
            <div className="h-6 w-px bg-slate-300 hidden sm:block" />
            <div>
              <span className="text-[10px] text-slate-500 block">Nilai Akhir:</span>
              <strong className="text-slate-900">{student.finalScore !== undefined ? student.finalScore : '-'}</strong>
            </div>
          </div>

          <div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
              student.status === 'passed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
              student.status === 'passed_reserved' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
              student.status === 'failed' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
              'bg-slate-100 text-slate-700 border border-slate-300'
            }`}>
              Status: {student.status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Modal Body: Two Columns */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form Controls & Template Selector (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Step 1: Choose Target Parent / Guardian */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                <span>1. Pilih Penerima Pengumuman (Orang Tua / Wali)</span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {['Ayah', 'Ibu', 'Wali', 'Murid'].map(role => {
                  const contact = availableContacts.find(c => c.role === role);
                  const isSelected = selectedRole === role;
                  const hasNumber = !!contact && !!cleanWhatsAppNumber(contact.phone);

                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleSelectRole(role)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-slate-800">{role}</span>
                        {hasNumber ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" title="Nomor tersedia" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-300" title="Belum ada nomor" />
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 truncate mt-1 font-medium">
                        {contact?.name || '-'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {contact?.phone || 'Tanpa No.'}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Contact Phone & Name Input */}
              <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-emerald-600" />
                    <span>Nomor WhatsApp {selectedRole}:</span>
                  </span>
                  {isValidPhone ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                      <Check className="w-3 h-3" /> Valid: +{currentCleanPhone}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                      <AlertCircle className="w-3 h-3" /> Nomor tidak valid
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    placeholder="Contoh: 08123456789 atau 628123456789"
                    className="flex-1 p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  * Format nomor otomatis dinormalisasi ke standar internasional Indonesia (+62).
                </p>
              </div>
            </div>

            {/* Step 2: Choose Announcement Template */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  <span>2. Pilih Template Pesan Pengumuman</span>
                </label>
                <button
                  type="button"
                  onClick={handleResetTemplate}
                  className="text-[11px] text-slate-500 hover:text-emerald-700 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                  title="Kembalikan teks sesuai template asli"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Teks</span>
                </button>
              </div>

              <select
                value={selectedTemplateKey}
                onChange={(e) => setSelectedTemplateKey(e.target.value as WhatsAppTemplateKey)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {WHATSAPP_TEMPLATES.map(tmpl => (
                  <option key={tmpl.key} value={tmpl.key}>
                    [{tmpl.category}] {tmpl.title}
                  </option>
                ))}
              </select>

              <p className="text-[11px] text-slate-500 mt-1.5">
                {WHATSAPP_TEMPLATES.find(t => t.key === selectedTemplateKey)?.description}
              </p>
            </div>

            {/* Step 3: Message Content & Customization */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>3. Isi Pesan Pengumuman (Dapat Disesuaikan)</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {messageText.length} karakter
                </span>
              </div>

              {/* Placeholder helper chips */}
              <div className="flex flex-wrap gap-1 mb-2">
                <span className="text-[10px] text-slate-400 self-center mr-1">Sisipkan:</span>
                {[
                  { tag: '{{NAMA_SISWA}}', label: '+ Nama Siswa' },
                  { tag: '{{NO_REGISTRASI}}', label: '+ No. Reg' },
                  { tag: '{{NILAI_AKHIR}}', label: '+ Nilai' },
                  { tag: '{{STATUS_SELEKSI}}', label: '+ Status' },
                  { tag: '{{KELAS}}', label: '+ Kelas' },
                  { tag: '{{LINK_PORTAL}}', label: '+ Link Web' },
                ].map(item => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => handleInsertVariable(item.tag)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-600 rounded-md text-[10px] font-mono transition-colors cursor-pointer border border-slate-200"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <textarea
                rows={9}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Tulis pesan pengumuman..."
                className="w-full p-3.5 bg-white border border-slate-300 rounded-2xl text-xs font-mono leading-relaxed focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-y"
              />
            </div>
          </div>

          {/* Right Column: Real-Time WhatsApp Bubble Preview (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Pratinjau Tampilan Pesan WhatsApp</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Live Preview
                </span>
              </div>

              {/* Mock WhatsApp Chat Window */}
              <div className="bg-[#efeae2] rounded-3xl border border-slate-300 overflow-hidden shadow-inner flex flex-col">
                {/* Chat Top Bar */}
                <div className="bg-[#075e54] text-white p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center font-bold text-xs">
                      AH
                    </div>
                    <div>
                      <div className="font-bold text-xs leading-none">Panitia SPMB Al-Hadiid</div>
                      <div className="text-[10px] text-emerald-200 mt-0.5">Online &bull; Penerima: {activeContact.name}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono bg-white/15 px-2 py-0.5 rounded-full">
                    {activeContact.role}
                  </span>
                </div>

                {/* Chat Message Bubble Area */}
                <div className="p-3.5 min-h-[320px] max-h-[440px] overflow-y-auto space-y-2">
                  <div className="flex justify-center">
                    <span className="px-2.5 py-0.5 rounded-full bg-white/70 text-[9px] font-bold text-slate-600 shadow-xs uppercase tracking-wider">
                      HARI INI
                    </span>
                  </div>

                  {/* Outgoing Bubble */}
                  <div className="flex justify-end">
                    <div className="bg-[#d9fdd3] text-slate-900 rounded-2xl rounded-tr-xs p-3.5 max-w-[92%] shadow-sm text-xs leading-relaxed space-y-1 relative">
                      <div className="whitespace-pre-wrap font-sans text-[11.5px] break-words">
                        {messageText}
                      </div>
                      <div className="flex items-center justify-end gap-1 text-[9px] text-slate-500 pt-1">
                        <span>{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="text-[#53bdeb] font-bold">&#10003;&#10003;</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chat Footer Mock */}
                <div className="bg-[#f0f2f5] p-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400 px-3">
                  <span>Nomor Tujuan: +{currentCleanPhone || '-'}</span>
                  <span>Enkripsi End-to-End</span>
                </div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
              <div className="text-[11px] font-bold text-slate-600">Aksi Pengumuman:</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="py-2.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                >
                  {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedText ? 'Tersalin!' : 'Salin Pesan'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="py-2.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <ExternalLink className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Link Tersalin!' : 'Salin Link WA'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleSendWhatsApp}
                disabled={!isValidPhone}
                className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>Kirim via WhatsApp (+{currentCleanPhone || '-'})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-blue-500" />
            <span>Pesan akan membuka WhatsApp Web atau aplikasi WhatsApp dengan pesan terformat otomatis.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
