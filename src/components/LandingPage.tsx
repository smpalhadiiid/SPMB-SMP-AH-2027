import React, { useState } from 'react';
import { SchoolInfo, CostBreakdown, TestSchedule, WebsiteConfig, UserAccount } from '../types';
import { 
  Sparkles, CheckCircle2, Award, BookOpen, ShieldCheck, Download, Video,
  MessageSquare, ChevronRight, HelpCircle, GraduationCap, MapPin, 
  ArrowRight, HeartHandshake, Layers, Monitor, Phone, FileText, Check, X,
  ExternalLink, Play, Bell, Settings, Palette, Eye, Save, Globe
} from 'lucide-react';
import { SchoolLogo } from './SchoolLogo';

interface LandingPageProps {
  schoolInfo: SchoolInfo;
  costBreakdowns: CostBreakdown[];
  testSchedules: TestSchedule[];
  websiteConfig?: WebsiteConfig;
  currentUser?: UserAccount | null;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onOpenWhatsApp: () => void;
  onSelectRoleView: (role: 'student' | 'admin' | 'kepsek') => void;
  onUpdateWebsiteConfig?: (updated: WebsiteConfig) => void;
  onUpdateSchoolInfo?: (updated: SchoolInfo) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  schoolInfo,
  costBreakdowns,
  testSchedules,
  websiteConfig,
  currentUser,
  onOpenAuth,
  onOpenWhatsApp,
  onSelectRoleView,
  onUpdateWebsiteConfig,
  onUpdateSchoolInfo,
}) => {
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showBrosurModal, setShowBrosurModal] = useState(false);

  const getEmbedUrl = (url?: string) => {
    if (!url) return 'https://www.youtube.com/embed/pBvlONwqC9g?autoplay=1';
    if (url.includes('youtube.com/embed/')) return url;
    if (url.includes('watch?v=')) {
      const videoId = url.split('v=')[1]?.split('&')[0];
      return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    }
    return url;
  };
  const [showWebsiteSettingsModal, setShowWebsiteSettingsModal] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const [quickSettingsForm, setQuickSettingsForm] = useState<WebsiteConfig>({
    heroTitle: websiteConfig?.heroTitle || 'Sistem Penerimaan Murid Baru (SPMB)',
    heroSubtitle: websiteConfig?.heroSubtitle || schoolInfo.tagline,
    heroBadgeText: websiteConfig?.heroBadgeText || 'SPMB TP 2027/2028 Telah Resmi Dibuka',
    showAnnouncementBanner: websiteConfig?.showAnnouncementBanner ?? true,
    announcementBannerText: websiteConfig?.announcementBannerText || '🔥 SPMB SMP Al-Hadiid Cileungsi segera dibuka',
    primaryColorTheme: websiteConfig?.primaryColorTheme || 'emerald',
    customWelcomeNotice: websiteConfig?.customWelcomeNotice || '',
    showVideoSection: websiteConfig?.showVideoSection ?? true,
    showBrochureSection: websiteConfig?.showBrochureSection ?? true,
    showQuotaSection: websiteConfig?.showQuotaSection ?? true,
    showCostSection: websiteConfig?.showCostSection ?? true,
    showScheduleSection: websiteConfig?.showScheduleSection ?? true,
    showFaqSection: websiteConfig?.showFaqSection ?? true,
  });

  const totalCosts = costBreakdowns.reduce((acc, curr) => acc + curr.amount, 0);

  const handleSaveQuickSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateWebsiteConfig) {
      onUpdateWebsiteConfig(quickSettingsForm);
    }
    setSaveSuccessMsg('Pengaturan Tampilan Landing Page Berhasil Disimpan & Diterapkan!');
    setTimeout(() => setSaveSuccessMsg(''), 3500);
    setShowWebsiteSettingsModal(false);
  };

  const faqs = [
    {
      q: 'Bagaimana alur pendaftaran murid baru secara online?',
      a: 'Alur pendaftaran terdiri dari 12 tahapan sederhana: 1. Buat akun SPMB -> 2. Bayar biaya formulir Rp200.000 -> 3. Verifikasi Panitia -> 4. Isi Formulir Biodata Lengkap & Upload Berkas -> 5. Cetak Bukti Pendaftaran -> 6. Mengikuti Tes Diagnostik -> 7. Pengumuman Kelulusan -> 8. Daftar Ulang & Penempatan Kelas.'
    },
    {
      q: 'Berapa biaya formulir pendaftaran dan ke rekening mana pembayarannya?',
      a: 'Biaya formulir pendaftaran adalah Rp200.000. Pembayaran dapat ditransfer ke rekening BSI (Bank Syariah Indonesia) 7123891011 a.n. Yayasan Pendidikan Islam Al-Hadiid Cileungsi.'
    },
    {
      q: 'Materi tes diagnostik apa saja yang diujikan?',
      a: 'Materi tes meliputi 3 komponen: 1. Tes Diagnostik Awal & Minat Bakat (bobot 30%), 2. Tes Pengetahuan Umum/Akademik Dasar (bobot 40%), dan 3. Tes Diniyyah (Membaca Al-Qur’an & Hafalan Juz Amma) (bobot 30%).'
    },
    {
      q: 'Apakah dokumen persyaratan fisik wajib dibawa saat tes?',
      a: 'Ya, saat tes calon murid wajib membawa cetak lembar Bukti Pendaftaran (PDF) yang diunduh dari akun SPMB beserta salinan Kartu Keluarga (KK) dan Pas Foto 3x4.'
    },
    {
      q: 'Berapa kuota penerimaan murid baru untuk Tahun Pelajaran 2027/2028?',
      a: 'Kuota terbatas dibuka untuk 8 Rombongan Belajar (Kelas 7A, 7B, 7C, 7D, 7E, 7F, 7G, 7H) dengan kuota 32 siswa per kelas. Sistem otomatis mengunci pendaftaran ketika kuota daftar ulang penuh.'
    },
  ];

  const advantages = [
    {
      title: 'Program Tahfizh Al-Qur’an 3 Juz',
      desc: 'Metode Bimbingan Murajaah & Ziyadah intensif harian.',
      icon: BookOpen,
      color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    },
    {
      title: 'Kurikulum Terpadu & Digital Learning',
      desc: 'Penggabungan Kurikulum Merdeka Nasional dengan Pendidikan Diniyyah & Smart Classroom.',
      icon: Monitor,
      color: 'bg-blue-500/10 text-blue-600 border-blue-200',
    },
    {
      title: '5 Basic Penguatan Al-Hadiid',
      desc: "Manhaj, Tahfizh Al-Qur'an, Bahasa Arab, Bahasa Inggris, Teknologi Informasi dan Komunikasi.",
      icon: Sparkles,
      color: 'bg-purple-500/10 text-purple-600 border-purple-200',
    },
    {
      title: 'Fasilitas Lengkap & Ber-AC',
      desc: 'Ruang kelas multimedia ber-AC, Lab Komputer, Lab IPA, Lapangan Olahraga, & Masjid Utama.',
      icon: Layers,
      color: 'bg-amber-500/10 text-amber-600 border-amber-200',
    },
    {
      title: 'Guru & Pengajar Profesional',
      desc: 'Tenaga pendidik lulusan PTN & Perguruan Tinggi Islam ternama dengan sertifikasi pendidik.',
      icon: Award,
      color: 'bg-rose-500/10 text-rose-600 border-rose-200',
    },
    {
      title: 'Prestasi Akademik & Non-Akademik',
      desc: 'Juara Olimpiade, Kompetisi Sains, Musabaqah Hifzhil Quran (MHQ), & Olah Raga.',
      icon: ShieldCheck,
      color: 'bg-teal-500/10 text-teal-600 border-teal-200',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* SUCCESS TOAST MESSAGE */}
      {saveSuccessMsg && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-500 flex items-center gap-3 animate-bounce text-xs font-bold">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* QUICK ADMIN TOOLBAR FOR LANDING PAGE CONFIGURATION */}
      {(currentUser?.role === 'admin' || currentUser?.role === 'kepsek' || currentUser?.role === 'super_admin') && (
        <div className="bg-slate-900 border-b border-rose-500/40 text-white text-xs py-2 px-4 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-lg sticky top-0 z-30">
          <div className="flex items-center gap-2 text-rose-300 font-medium">
            <Settings className="w-4 h-4 text-rose-400 shrink-0 animate-spin" style={{ animationDuration: '8s' }} />
            <span>Mode Pengelolaan Landing Page ({currentUser?.role === 'super_admin' ? 'Super Admin' : currentUser?.role === 'admin' ? 'Panitia Admin' : 'Kepala Sekolah'})</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setQuickSettingsForm({
                  heroTitle: websiteConfig?.heroTitle || 'Sistem Penerimaan Murid Baru (SPMB)',
                  heroSubtitle: websiteConfig?.heroSubtitle || schoolInfo.tagline,
                  heroBadgeText: websiteConfig?.heroBadgeText || 'SPMB TP 2027/2028 Telah Resmi Dibuka',
                  showAnnouncementBanner: websiteConfig?.showAnnouncementBanner ?? true,
                  announcementBannerText: websiteConfig?.announcementBannerText || '🔥 SPMB SMP Al-Hadiid Cileungsi segera dibuka',
                  primaryColorTheme: websiteConfig?.primaryColorTheme || 'emerald',
                  customWelcomeNotice: websiteConfig?.customWelcomeNotice || '',
                  showVideoSection: websiteConfig?.showVideoSection ?? true,
                  showBrochureSection: websiteConfig?.showBrochureSection ?? true,
                  showQuotaSection: websiteConfig?.showQuotaSection ?? true,
                  showCostSection: websiteConfig?.showCostSection ?? true,
                  showScheduleSection: websiteConfig?.showScheduleSection ?? true,
                  showFaqSection: websiteConfig?.showFaqSection ?? true,
                });
                setShowWebsiteSettingsModal(true);
              }}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>⚙️ Edit Pengaturan Landing Page</span>
            </button>
            <button
              onClick={() => onSelectRoleView(currentUser?.role || 'admin')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-[11px] rounded-lg border border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>Panel Dashboard</span>
            </button>
          </div>
        </div>
      )}

      {/* RUNNING ANNOUNCEMENT BANNER */}
      {websiteConfig?.showAnnouncementBanner && websiteConfig?.announcementBannerText && (
        <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-rose-950 text-white text-xs py-2.5 font-semibold shadow-md flex items-center overflow-hidden border-b border-white/10 relative">
          <div className="px-4 z-20 shrink-0 bg-slate-950 py-1 flex items-center gap-2 border-r border-slate-800 shadow-md">
            <span className="px-2 py-0.5 bg-rose-600 text-white font-bold text-[10px] rounded uppercase shrink-0 animate-pulse flex items-center gap-1">
              <Bell className="w-3 h-3" /> PENGUMUMAN
            </span>
          </div>
          <div className="overflow-hidden w-full whitespace-nowrap relative flex items-center">
            <div className="animate-marquee pl-4 text-emerald-200 font-medium tracking-wide">
              {websiteConfig.announcementBannerText} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 🔥 {websiteConfig.announcementBannerText}
            </div>
          </div>
        </div>
      )}

      {/* TAHAP 1: HERO BANNER SECTION */}
      <section className="relative bg-slate-900 text-white overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 border-b border-slate-800">
        {/* Background glow effects */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {websiteConfig?.customWelcomeNotice && (
            <div className="mb-6 p-4 rounded-2xl bg-slate-800/80 border border-emerald-500/40 backdrop-blur-md text-emerald-200 text-xs leading-relaxed flex items-start gap-3 shadow-lg">
              <Sparkles className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white font-bold text-sm mb-0.5">Pesan Resmi Sekolah:</strong>
                {websiteConfig.customWelcomeNotice}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Headlines & Call to Actions */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold backdrop-blur-md">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span>{websiteConfig?.heroBadgeText || `Penerimaan Murid Baru TP ${schoolInfo.academicYear} Telah Dibuka`}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 backdrop-blur-md w-fit">
                <SchoolLogo size="xl" showText={false} />
                <div>
                  <div className="text-xs font-bold text-blue-400 uppercase tracking-widest">Situs Resmi SPMB SMP Al-Hadiid Cileungsi</div>
                  <div className="text-lg font-extrabold text-white">{schoolInfo.name}</div>
                  <div className="text-xs text-slate-300">Bogor, Jawa Barat</div>
                </div>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-white">
                {websiteConfig?.heroTitle || 'Penerimaan Murid Baru'} <br />
                <span className="text-blue-400">
                  {schoolInfo.name}
                </span>
              </h1>

              <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl">
                {websiteConfig?.heroSubtitle || schoolInfo.tagline}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => onOpenAuth('register')}
                  className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition-all flex items-center gap-2"
                >
                  <GraduationCap className="w-5 h-5" />
                  Daftar Sekarang
                </button>

                <button
                  onClick={() => setShowBrosurModal(true)}
                  className="px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm border border-slate-700 backdrop-blur-md transition-all flex items-center gap-2"
                >
                  <Download className="w-4 h-4 text-blue-400" />
                  Unduh Brosur
                </button>

                <button
                  onClick={() => setShowVideoModal(true)}
                  className="px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm border border-slate-700 backdrop-blur-md transition-all flex items-center gap-2"
                >
                  <Video className="w-4 h-4 text-rose-400" />
                  Video Profil
                </button>

                <button
                  onClick={onOpenWhatsApp}
                  className="px-5 py-3.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-blue-300 font-semibold text-sm border border-slate-700 backdrop-blur-md transition-all flex items-center gap-2"
                >
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                  Hubungi WhatsApp
                </button>
              </div>

              {/* Quick Key Metrics / Stats */}
              <div className="pt-6 border-t border-slate-800 grid grid-cols-3 gap-4 text-center sm:text-left">
                <div>
                  <div className="text-2xl font-bold text-blue-400">3 Juz</div>
                  <div className="text-xs text-slate-400">Target Tahfizh Quran</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-400">100%</div>
                  <div className="text-xs text-slate-400">Gedung Ber-AC & Lab</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-400">8 Kelas</div>
                  <div className="text-xs text-slate-400">Kuota 32 Murid / Kelas</div>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Card Preview */}
            <div className="lg:col-span-5">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                      7A
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">SPMB ONLINE TP 2027/2028</div>
                      <div className="text-xs text-emerald-400">Gelombang 1 Masih Dibuka</div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 text-xs rounded-full border border-emerald-500/30">
                    Aktif
                  </span>
                </div>

                {/* Direct quick action card */}
                <div className="bg-slate-800/80 p-4 rounded-xl space-y-3">
                  <div className="text-xs text-slate-300 font-medium">
                    Tahapan Pendaftaran Online:
                  </div>
                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                      <span>Registrasi Akun Orang Tua / Calon Murid</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                      <span>Pembayaran Formulir Rp200.000 via BSI</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                      <span>Isi Formulir Lengkap & Upload Berkas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">4</span>
                      <span>Tes Diagnostik & Pengumuman Hasil</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={() => onOpenAuth('register')}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <span>Mulai Pendaftaran Sekarang</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onOpenAuth('login')}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition-all text-center"
                  >
                    Sudah Memiliki Akun? Login Disini
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROFIL SEKOLAH SECTION */}
      <section id="profil" className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold text-emerald-600 tracking-wider uppercase bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Profil Sekolah
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3">
              Tentang SMP Al-Hadiid Cileungsi
            </h2>
            <p className="text-slate-600 text-sm mt-3 leading-relaxed">
              Sekolah Menengah Pertama Al-Hadiid Cileungsi berkomitmen menyelenggarakan pendidikan holistik yang memadukan keunggulan akademik, keluhuran akhlak, dan hafalan Al-Qur’an dalam suasana belajar yang kondusif.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Visi */}
            <div className="bg-slate-50 p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xl shadow-md">
                🎯
              </div>
              <h3 className="text-xl font-bold text-slate-900">Visi Sekolah</h3>
              <p className="text-sm text-slate-700 leading-relaxed italic border-l-4 border-emerald-500 pl-4 py-1">
                "{schoolInfo.tagline}"
              </p>
            </div>

            {/* Misi */}
            <div className="bg-slate-50 p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-12 h-12 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-xl shadow-md">
                🚀
              </div>
              <h3 className="text-xl font-bold text-slate-900">Misi Utama</h3>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Menanamkan Aqidah ahlus sunnah Wal Jama’ah sebagai kekuatan dasar dalam menjalani kehidupan.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Menumbuhkan pemahaman Islam yang berpegang teguh kepada metode salafus sholih dalam seluruh aspek kehidupan.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Membangun karakter pribadi yang senantiasa bekerja keras, mandiri dan rajin belajar.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Menggali dan mengembangkan multiple intelegence murid pada sasaran yang terarah.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Menanamkan kedisiplinan diri dalam setiap sisi untuk dapat meraih kesuksesan.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* KEUNGGULAN SEKOLAH SECTION */}
      <section id="keunggulan" className="py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold text-emerald-600 tracking-wider uppercase bg-emerald-100/60 px-3 py-1 rounded-full border border-emerald-200">
              Keunggulan Kami
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3">
              Mengapa Memilih SMP Al-Hadiid?
            </h2>
            <p className="text-slate-600 text-sm mt-2">
              Keunggulan utama yang menjadikan murid kami unggul secara akademik dan spiritual.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {advantages.map((adv, idx) => {
              const IconComp = adv.icon;
              return (
                <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all space-y-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${adv.color}`}>
                    <IconComp className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{adv.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{adv.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PROGRAM TAHFIZH & KURIKULUM SECTION */}
      <section className="py-16 bg-gradient-to-br from-emerald-900 to-teal-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <span className="text-xs font-bold text-emerald-300 tracking-wider uppercase bg-emerald-800/80 px-3 py-1 rounded-full border border-emerald-700">
                Program Unggulan Tahfizh
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Mencetak Generasi Penghafal Al-Qur'an Berakhlak Mulia
              </h2>
              <p className="text-slate-200 text-sm leading-relaxed">
                Setiap Kelas dibimbing oleh dua orang guru tahfizh. Dengan target hafalan minimal 3 Juz selama 3 tahun sekolah, dilengkapi sertifikasi syahadah hafalan.
              </p>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="bg-emerald-950/80 p-4 rounded-xl border border-emerald-800">
                  <div className="text-lg font-bold text-emerald-400">Target 3+ Juz</div>
                  <div className="text-xs text-slate-300 mt-1">Juz 30, Juz 29 & Juz 1 / Pilihan</div>
                </div>
                <div className="bg-emerald-950/80 p-4 rounded-xl border border-emerald-800">
                  <div className="text-lg font-bold text-emerald-400">Setoran Harian</div>
                  <div className="text-xs text-slate-300 mt-1">setiap hari murid wajib setoran hafalan</div>
                </div>
              </div>
            </div>

            <div className="bg-emerald-950/90 border border-emerald-800 p-6 rounded-2xl space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                <span>Integrasi Kurikulum Merdeka & Diniyyah</span>
              </h3>
              <div className="space-y-3 text-xs text-slate-200">
                <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                  <div className="font-bold text-emerald-300">Kurikulum Nasional Merdeka</div>
                  <div className="text-slate-400 mt-0.5">Matematika, IPA Terpadu, IPS, Bahasa Indonesia, English, Bahasa Sunda.</div>
                </div>
                <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                  <div className="font-bold text-emerald-300">Pendidikan Diniyyah Islamiyyah</div>
                  <div className="text-slate-400 mt-0.5">Tahfizh, Tajwid Al-Qur’an, Aqidah Akhlak, Fiqih Ibadah, Bahasa Arab, Siroh Nabawiyah.</div>
                </div>
                <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                  <div className="font-bold text-emerald-300">Ekstrakurikuler & Skill</div>
                  <div className="text-slate-400 mt-0.5">Pramuka, Futsal, Karya Ilmiah, Basket, Bola Volly, Panahan, Karate, English Club, Desain Grafis Digital.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BIAYA PENDIDIKAN SECTION */}
      {(websiteConfig?.showCostSection ?? true) && (
        <section id="biaya" className="py-16 bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <span className="text-xs font-bold text-emerald-600 tracking-wider uppercase bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Transparansi Biaya Pendidikan
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3">
                Rincian Biaya Awal Masuk (BAM) TP {schoolInfo.academicYear}
              </h2>
              <p className="text-slate-600 text-sm mt-2">
                Acuan resmi rincian biaya penerimaan murid baru {schoolInfo.name}.
              </p>
            </div>

            <div className="max-w-5xl mx-auto space-y-8">
              {/* Form Fee & Total BAM Highlight Header */}
              <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-emerald-800/50 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-2 text-center md:text-left">
                  <span className="px-3 py-1 bg-amber-400 text-slate-950 font-extrabold text-[11px] rounded-full uppercase tracking-wider">
                    A. Formulir Pendaftaran: Rp {schoolInfo.formFee.toLocaleString('id-ID')}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-white">
                    Biaya Awal Masuk (BAM)
                  </h3>
                  <p className="text-xs text-emerald-200 max-w-xl">
                    Transparan & terjangkau untuk putra (Ikhwan) dan putri (Akhwat) dengan fasilitas pendidikan lengkap & terpadu.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  <div className="bg-emerald-950/80 border border-emerald-500/40 p-4 rounded-xl text-center min-w-[150px]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Total Biaya Ikhwan</div>
                    <div className="text-xl sm:text-2xl font-black font-mono text-white mt-0.5">Rp 6.665.000</div>
                  </div>
                  <div className="bg-emerald-950/80 border border-emerald-500/40 p-4 rounded-xl text-center min-w-[150px]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-rose-300">Total Biaya Akhwat</div>
                    <div className="text-xl sm:text-2xl font-black font-mono text-white mt-0.5">Rp 6.895.000</div>
                  </div>
                </div>
              </div>

              {/* BIAYA AWAL MASUK (BAM) TABLE */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
                <div className="bg-slate-100 p-4 sm:px-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <span>B. Rincian Komponen Biaya Awal Masuk (BAM)</span>
                  </h3>
                  <span className="text-xs font-semibold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
                    Sesuai SK Resmi Biaya Pendidikan
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-900 text-white font-bold uppercase text-[11px] tracking-wider">
                        <th className="py-3.5 px-4 text-center w-12">NO</th>
                        <th className="py-3.5 px-4">JENIS KEUANGAN</th>
                        <th className="py-3.5 px-4 text-right">BIAYA IKHWAN</th>
                        <th className="py-3.5 px-4 text-right">BIAYA AKHWAT</th>
                        <th className="py-3.5 px-4 text-center">KETERANGAN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {[
                        { no: 1, name: 'Dana Awal Pendidikan (DAP)', ikhwan: 4250000, akhwat: 4250000, ket: 'Sekali' },
                        { no: 2, name: 'Dana Praktik Komputer', ikhwan: 150000, akhwat: 150000, ket: 'Per Tahun' },
                        { no: 3, name: 'Dana Praktik IPA', ikhwan: 100000, akhwat: 100000, ket: 'Per Tahun' },
                        { no: 4, name: 'Perlengkapan / Seragam (Paket)*', ikhwan: 700000, akhwat: 920000, ket: 'Sekali', highlight: true },
                        { no: 5, name: 'Dana Penyelenggaraan Pendidikan (DPP / SPP)', ikhwan: 425000, akhwat: 425000, ket: 'Per Bulan' },
                        { no: 6, name: 'Tabungan Wajib', ikhwan: 25000, akhwat: 25000, ket: 'Per Bulan' },
                        { no: 7, name: 'MPLS / MOS', ikhwan: 100000, akhwat: 100000, ket: 'Sekali' },
                        { no: 8, name: 'Dana Sosial', ikhwan: 25000, akhwat: 25000, ket: 'Per Tahun' },
                        { no: 9, name: 'Penilaian Akhir Semester (PAS)', ikhwan: 220000, akhwat: 220000, ket: 'Per Tahun' },
                        { no: 10, name: 'Penilaian Akhir Tahun (PAT)', ikhwan: 225000, akhwat: 225000, ket: 'Per Tahun' },
                        { no: 11, name: 'Kegiatan Ekstrakurikuler / AMBAP', ikhwan: 125000, akhwat: 125000, ket: 'Per Tahun' },
                        { no: 12, name: 'Biaya Dauroh (Kegiatan Pesantren)', ikhwan: 120000, akhwat: 120000, ket: 'Per Tahun' },
                        { no: 13, name: 'Biaya Cetak (Raport, Foto, Name Tag, Kalender)', ikhwan: 200000, akhwat: 210000, ket: 'Per Tahun' },
                      ].map((row) => (
                        <tr key={row.no} className={`hover:bg-emerald-50/50 transition-colors ${row.highlight ? 'bg-amber-50/60 font-medium' : ''}`}>
                          <td className="py-3 px-4 text-center font-bold text-slate-500">{row.no}</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{row.name}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800">
                            Rp {row.ikhwan.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800">
                            Rp {row.akhwat.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-4 text-center text-slate-600 font-medium">{row.ket}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-emerald-900 text-white font-extrabold text-xs sm:text-sm">
                        <td colSpan={2} className="py-4 px-4 uppercase text-right tracking-wider">
                          TOTAL BIAYA AWAL MASUK (BAM):
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-amber-300 text-base">
                          Rp 6.665.000
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-amber-300 text-base">
                          Rp 6.895.000
                        </td>
                        <td className="py-4 px-4 text-center text-emerald-200 font-normal text-xs">Awal Masuk</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* DETAILS GRID: SERAGAM & TAHAPAN PEMBAYARAN */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* PAKET SERAGAM */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-3 shadow-sm">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 text-emerald-800">
                    <GraduationCap className="w-5 h-5 text-emerald-600" />
                    <span>*Perlengkapan / Seragam (Paket), Meliputi:</span>
                  </h4>
                  <ul className="space-y-2 text-xs text-slate-700 font-medium">
                    <li className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-200">
                      <span>1. Pakaian Seragam Putih Biru</span>
                      <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">1 Stel</span>
                    </li>
                    <li className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-200">
                      <span>2. Pakaian Seragam Biru Tosca</span>
                      <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">1 Stel</span>
                    </li>
                    <li className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-200">
                      <span>3. Pakaian Seragam Pramuka</span>
                      <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">1 Stel</span>
                    </li>
                    <li className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-200">
                      <span>4. Pakaian Seragam Olahraga</span>
                      <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">1 Stel</span>
                    </li>
                  </ul>
                </div>

                {/* TAHAPAN PEMBAYARAN */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-3 shadow-sm">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 text-emerald-800">
                    <Award className="w-5 h-5 text-emerald-600" />
                    <span>*Tahapan Pembayaran BAM:</span>
                  </h4>
                  <div className="space-y-2.5 text-xs">
                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl space-y-1">
                      <div className="font-bold text-emerald-950 flex justify-between">
                        <span>Pilihan 1: Langsung Lunas</span>
                        <span className="text-emerald-700">Skema Prioritas</span>
                      </div>
                      <div className="text-slate-600 text-[11px]">
                        Ikhwan: <b>Rp 6.665.000</b> | Akhwat: <b>Rp 6.895.000</b>
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl space-y-1">
                      <div className="font-bold text-amber-950 flex justify-between">
                        <span>Pilihan 2: Tahapan Angsuran</span>
                        <span className="text-amber-800">Skema Angsuran</span>
                      </div>
                      <div className="text-slate-700 text-[11px]">
                        DP Awal: <b>Rp 4.000.000</b> (Ikhwan/Akhwat) saat pendaftaran.<br />
                        Pelunasan Paling Lambat: <b>31 Oktober {schoolInfo.academicYear.split('/')[0]}</b>.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* KETENTUAN PEMBAYARAN & REKENING BANK */}
              <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
                <h4 className="font-bold text-amber-400 text-sm sm:text-base flex items-center gap-2 uppercase tracking-wide">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  <span>*Ketentuan Pembayaran Biaya Awal Pendidikan (BAM) {schoolInfo.name}:</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs border-y border-slate-800 py-4">
                  <div className="space-y-1.5">
                    <div className="text-slate-400 font-semibold uppercase text-[10px]">Bank Pembayaran Resmi:</div>
                    <div className="font-bold text-emerald-400 text-sm">{schoolInfo.bankName}</div>
                    <div className="font-mono text-base text-white font-bold">{schoolInfo.bankAccountNumber}</div>
                    <div className="text-slate-300">a.n. {schoolInfo.bankAccountName}</div>
                    <div className="text-[10px] text-slate-400">Kode Bank: <b>451</b></div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-slate-400 font-semibold uppercase text-[10px]">Format Keterangan Setoran:</div>
                    <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 font-mono text-amber-300 text-[11px]">
                      "BAM PPDB {schoolInfo.academicYear}, a.n. NAMA SISWA"
                    </div>
                    <div className="text-slate-400 text-[10px]">Cashless / Setoran Bank BSI atau Transfer</div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-slate-400 font-semibold uppercase text-[10px]">Konfirmasi WhatsApp Admin:</div>
                    <div className="font-bold text-emerald-400 text-sm flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-emerald-400" />
                      <span>0858 1499 8782 (Admin SMP)</span>
                    </div>
                    <button
                      onClick={onOpenWhatsApp}
                      className="mt-2 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all text-xs cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span>Kirim Bukti via WhatsApp</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] text-slate-300 leading-relaxed pt-1">
                  <p>1. Pembayaran harus memilih salah satu dari 2 pilihan tahapan pembayaran di atas.</p>
                  <p>2. Transfer melalui Bank BSI (3953157480 a.n. Al-Hadiid), Beda Bank (Kode: 451).</p>
                  <p>3. Konfirmasi dengan menunjukkan bukti pembayaran ke Sekolah atau mengirimkan foto/gambar via WhatsApp ke Admin SMP.</p>
                  <p>4. Pendaftar yang mengundurkan diri sebelum 1 Juli, biaya PPDB (selain DAP) dapat dikembalikan.</p>
                  <p>5. Pendaftar yang mengundurkan diri setelah 1 Juli, seluruh keuangan yang sudah dibayarkan tidak dikembalikan.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* JADWAL GELOMBANG SPMB SECTION */}
      {(websiteConfig?.showScheduleSection ?? true) && (
        <section id="jadwal" className="py-16 bg-slate-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <span className="text-xs font-bold text-emerald-600 tracking-wider uppercase bg-emerald-100/60 px-3 py-1 rounded-full border border-emerald-200">
                Agenda Penting
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3">
                Jadwal Gelombang Pendaftaran
              </h2>
              <p className="text-slate-600 text-sm mt-2">
                Pastikan Anda mendaftar pada gelombang yang tepat sebelum kuota kelas terpenuhi.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {testSchedules.map((ts, index) => (
                <div key={ts.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 relative overflow-hidden">
                  {index === 0 && (
                    <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase">
                      semoga tercapai
                    </div>
                  )}
                  <div className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm">
                      0{index + 1}
                    </span>
                    <span>{ts.waveName}</span>
                  </div>
                  <div className="space-y-2 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">Tanggal Tes:</span>
                      <span className="font-medium text-emerald-700">{ts.testDate} ({ts.testTime})</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-semibold text-slate-800">Lokasi:</span>
                      <span>{ts.location}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-slate-500 italic">
                      {ts.notes}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ SECTION */}
      {(websiteConfig?.showFaqSection ?? true) && (
        <section id="faq" className="py-16 bg-white border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <span className="text-xs font-bold text-emerald-600 tracking-wider uppercase bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Pertanyaan Umum
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3">
                FAQ (Frequently Asked Questions)
              </h2>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, idx) => (
                <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                    className="w-full text-left p-4 bg-slate-50 hover:bg-slate-100 font-bold text-sm text-slate-900 flex justify-between items-center transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <span className="text-emerald-600 text-lg font-bold">{activeFaq === idx ? '-' : '+'}</span>
                  </button>
                  {activeFaq === idx && (
                    <div className="p-4 bg-white text-xs text-slate-600 leading-relaxed border-t border-slate-200">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* KONTAK & LOKASI SECTION */}
      <section id="kontak" className="py-16 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider bg-emerald-950 px-3 py-1 rounded-full border border-emerald-800">
                Lokasi & Layanan
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Kunjungi Kampus SMP Al-Hadiid Cileungsi
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                Kami siap menyambut kehadiran Bapak/Ibu untuk melihat langsung fasilitas sekolah, berkonsultasi mengenai SPMB, atau melakukan verifikasi pendaftaran.
              </p>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{schoolInfo.address}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>{schoolInfo.phone} / Call Center Sekretariat SPMB</span>
                </div>
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>WA Center: +{schoolInfo.whatsapp}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={onOpenWhatsApp}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Chat dengan Panitia via WhatsApp</span>
                </button>
              </div>
            </div>

            {/* Simulated Google Maps Frame */}
            <div className="bg-slate-800 p-3 rounded-2xl border border-slate-700 shadow-2xl">
              <div className="w-full h-64 sm:h-80 rounded-xl bg-slate-900 flex flex-col items-center justify-center text-center p-6 space-y-3 border border-slate-800">
                <MapPin className="w-10 h-10 text-emerald-400 animate-bounce" />
                <div className="font-bold text-sm text-white">{schoolInfo.name}</div>
                <div className="text-xs text-slate-400 max-w-xs">{schoolInfo.address}</div>
                <a
                  href={`https://maps.google.com/?q=SMP+Al+Hadiid+Cileungsi`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Buka Peta di Google Maps
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MODAL VIDEO PROFIL */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 text-white relative shadow-2xl">
            <button
              onClick={() => setShowVideoModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Video className="w-5 h-5 text-rose-400" />
              <span>Video Profil {schoolInfo.name}</span>
            </h3>

            <div className="aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner">
              <iframe
                src={getEmbedUrl(schoolInfo.videoProfileUrl || 'https://youtu.be/pBvlONwqC9g?si=e_MDbYLh3-ViQQ6P')}
                title={`Video Profil ${schoolInfo.name}`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
              <span>Video Profil & Tur Sekolah SMP Al-Hadiid Cileungsi</span>
              <a
                href={schoolInfo.videoProfileUrl || 'https://youtu.be/pBvlONwqC9g?si=e_MDbYLh3-ViQQ6P'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-rose-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Buka di YouTube</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BROSUR DOWNLOAD */}
      {showBrosurModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 text-slate-900 relative shadow-2xl">
            <button
              onClick={() => setShowBrosurModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-lg font-bold text-emerald-800 mb-2 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              <span>Brosur Resmi SPMB {schoolInfo.academicYear}</span>
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              Silakan unduh brosur lengkap untuk informasi syarat, biaya, dan kurikulum {schoolInfo.name}.
            </p>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2 mb-6">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-600">Nama Dokumen:</span>
                <span className="font-bold text-slate-900">
                  {schoolInfo.brochureFileName || `Brosur_SPMB_${schoolInfo.name.replace(/\s+/g, '_')}_2027.pdf`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-600">Ukuran File:</span>
                <span className="text-slate-700">{schoolInfo.brochureFileSize || '2.4 MB'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-600">Status File:</span>
                <span className="text-emerald-700 font-bold">
                  {schoolInfo.brochureUrl ? '✓ File Khusus Terunggah' : 'File Brosur Standar'}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                if (schoolInfo.brochureUrl) {
                  const a = document.createElement('a');
                  a.href = schoolInfo.brochureUrl;
                  a.download = schoolInfo.brochureFileName || 'Brosur_SPMB.pdf';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                } else {
                  alert(`Mengunduh ${schoolInfo.brochureFileName || 'Brosur_SPMB.pdf'}...`);
                }
                setShowBrosurModal(false);
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Brosur PDF Sekarang</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL PENGATURAN LANDING PAGE & TAMPILAN WEBSITE */}
      {showWebsiteSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 text-slate-900 relative shadow-2xl my-8 max-h-[90vh] overflow-y-auto space-y-6">
            <button
              onClick={() => setShowWebsiteSettingsModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3 border-b pb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Pengaturan Tampilan & Teks Landing Page</h3>
                <p className="text-xs text-slate-500">Ubah teks hero, running banner, dan seksi tampilan website secara instan</p>
              </div>
            </div>

            <form onSubmit={handleSaveQuickSettings} className="space-y-5">
              {/* Card 1: Banner & Text Utama */}
              <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-rose-600" /> Teks Utama Banner Hero
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Judul Utama Hero Banner
                  </label>
                  <input
                    type="text"
                    required
                    value={quickSettingsForm.heroTitle || ''}
                    onChange={(e) => setQuickSettingsForm((prev) => ({ ...prev, heroTitle: e.target.value }))}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                    placeholder="Penerimaan Murid Baru (SPMB)"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sub-Judul / Tagline Hero Banner
                  </label>
                  <textarea
                    rows={2}
                    value={quickSettingsForm.heroSubtitle || ''}
                    onChange={(e) => setQuickSettingsForm((prev) => ({ ...prev, heroSubtitle: e.target.value }))}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800"
                    placeholder="Bersunnah---Berprestasi---Berkualitas"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Teks Badge Pengumuman Hero
                  </label>
                  <input
                    type="text"
                    value={quickSettingsForm.heroBadgeText || ''}
                    onChange={(e) => setQuickSettingsForm((prev) => ({ ...prev, heroBadgeText: e.target.value }))}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800"
                    placeholder="Pendaftaran TP 2027/2028 Telah Dibuka"
                  />
                </div>
              </div>

              {/* Card 2: Running Text Banner */}
              <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-emerald-600" /> Tampilkan Running Text Banner
                  </label>
                  <input
                    type="checkbox"
                    checked={quickSettingsForm.showAnnouncementBanner ?? true}
                    onChange={(e) => setQuickSettingsForm((prev) => ({ ...prev, showAnnouncementBanner: e.target.checked }))}
                    className="w-5 h-5 text-emerald-600 rounded cursor-pointer"
                  />
                </div>

                {quickSettingsForm.showAnnouncementBanner && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Isi Pesan Running Text (Berjalan)
                    </label>
                    <input
                      type="text"
                      value={quickSettingsForm.announcementBannerText || ''}
                      onChange={(e) => setQuickSettingsForm((prev) => ({ ...prev, announcementBannerText: e.target.value }))}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-rose-700"
                      placeholder="🔥 SPMB SMP Al-Hadiid Cileungsi segera dibuka"
                    />
                  </div>
                )}
              </div>

              {/* Card 3: Visibilitas Seksi */}
              <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-blue-600" /> Visibilitas Seksi Halaman Depan
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { key: 'showVideoSection', label: 'Seksi Video Profil' },
                    { key: 'showBrochureSection', label: 'Seksi Brosur SPMB' },
                    { key: 'showQuotaSection', label: 'Seksi Statistik Kuota' },
                    { key: 'showCostSection', label: 'Seksi Biaya Pendidikan' },
                    { key: 'showScheduleSection', label: 'Seksi Jadwal Gelombang Tes' },
                    { key: 'showFaqSection', label: 'Seksi FAQ' },
                  ].map((sec) => (
                    <label key={sec.key} className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(quickSettingsForm as any)[sec.key] ?? true}
                        onChange={(e) => setQuickSettingsForm((prev) => ({ ...prev, [sec.key]: e.target.checked }))}
                        className="w-4 h-4 text-emerald-600 rounded"
                      />
                      <span className="font-semibold text-slate-800">{sec.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowWebsiteSettingsModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan & Terapkan Ke Landing Page</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
