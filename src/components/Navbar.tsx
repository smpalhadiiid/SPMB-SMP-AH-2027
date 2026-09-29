import React, { useState } from 'react';
import { UserAccount, UserRole } from '../types';
import { LogIn, UserPlus, LogOut, Shield, Menu, X } from 'lucide-react';
import { SchoolLogo } from './SchoolLogo';
import { SupabaseBadge } from './SupabaseBadge';

interface NavbarProps {
  currentUser: UserAccount | null;
  activeRoleView: UserRole;
  onSelectRoleView: (role: UserRole) => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onLogout: () => void;
  onNavigateHome: () => void;
  onOpenWhatsApp: () => void;
  onRefreshAllData?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeRoleView,
  onSelectRoleView,
  onOpenAuth,
  onLogout,
  onNavigateHome,
  onOpenWhatsApp,
  onRefreshAllData,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white shadow-xl">
      {/* Top Banner Info */}
      <div className="bg-slate-950/80 text-slate-300 text-xs py-1.5 px-4 hidden md:block border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6 text-[11px] text-slate-400">
            <span>📍 Jl. Raya Cileungsi - Jonggol Km. 1.5, Cileungsi Kidul, Cileungsi, Bogor</span>
            <span>📞 Telp: (021) 82493659</span>
            <span>🕒 Layanan SPMB: Senin - Sabtu 08.00 - 14.00 WIB</span>
          </div>
          <div className="flex items-center gap-4">
            <SupabaseBadge variant="compact" onDataSynced={onRefreshAllData} />
            <button
              onClick={onOpenWhatsApp}
              className="hover:text-white transition-colors flex items-center gap-1 font-medium bg-blue-600/30 text-blue-300 px-2.5 py-0.5 rounded text-[11px] border border-blue-500/30"
            >
              💬 Call Center WA: 0812-3456-7890
            </button>
            <span className="text-blue-400 font-semibold text-[11px] bg-blue-900/40 px-2 py-0.5 rounded border border-blue-800/50">
              TP 2027/2028
            </span>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        {/* Logo & School Name */}
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-3 text-left group focus:outline-none"
        >
          <SchoolLogo size="md" showText={true} />
        </button>

        {/* Desktop Quick Nav Links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button onClick={onNavigateHome} className="hover:text-blue-400 transition-colors">
            Beranda
          </button>
          <a href="#profil" className="hover:text-blue-400 transition-colors">
            Profil
          </a>
          <a href="#keunggulan" className="hover:text-blue-400 transition-colors">
            Keunggulan
          </a>
          <a href="#biaya" className="hover:text-blue-400 transition-colors">
            Biaya Pendidikan
          </a>
          <a href="#jadwal" className="hover:text-blue-400 transition-colors">
            Jadwal SPMB
          </a>
          <a href="#faq" className="hover:text-blue-400 transition-colors">
            FAQ
          </a>
          <a href="#kontak" className="hover:text-blue-400 transition-colors">
            Kontak
          </a>
        </nav>

        {/* Right Action Controls: Login State */}
        <div className="hidden sm:flex items-center gap-3">
          {/* User Auth state */}
          {currentUser ? (
            <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
              <button
                onClick={() => onSelectRoleView(activeRoleView || currentUser?.role || 'admin')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span>Buka Dashboard</span>
              </button>
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-200 line-clamp-1">{currentUser?.name || 'Pengguna'}</div>
                <div className="text-[10px] text-amber-400 font-bold capitalize flex items-center justify-end gap-1">
                  <Shield className="w-3 h-3 text-amber-400" />
                  {currentUser?.role === 'student'
                    ? 'Calon Murid'
                    : currentUser?.role === 'admin'
                    ? 'Panitia SPMB'
                    : currentUser?.role === 'super_admin'
                    ? 'Super Admin'
                    : 'Kepala Sekolah'}
                </div>
              </div>
              <button
                onClick={onLogout}
                title="Keluar / Logout"
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 border border-slate-700/50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenAuth('login')}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800 border border-slate-700 transition-all flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                Masuk
              </button>
              <button
                onClick={() => onOpenAuth('register')}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Daftar Sekarang
              </button>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Menu button */}
        <div className="flex sm:hidden items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-slate-800 bg-slate-900 px-4 py-4 space-y-4">
          <div className="flex flex-col gap-2 font-medium text-sm text-slate-300">
            <button onClick={() => { onNavigateHome(); setMobileMenuOpen(false); }} className="text-left py-1.5 hover:text-blue-400">
              Beranda
            </button>
            <a href="#profil" onClick={() => setMobileMenuOpen(false)} className="py-1.5 hover:text-blue-400">
              Profil Sekolah
            </a>
            <a href="#keunggulan" onClick={() => setMobileMenuOpen(false)} className="py-1.5 hover:text-blue-400">
              Keunggulan
            </a>
            <a href="#biaya" onClick={() => setMobileMenuOpen(false)} className="py-1.5 hover:text-blue-400">
              Biaya Pendidikan
            </a>
            <a href="#jadwal" onClick={() => setMobileMenuOpen(false)} className="py-1.5 hover:text-blue-400">
              Jadwal SPMB
            </a>
            <a href="#kontak" onClick={() => setMobileMenuOpen(false)} className="py-1.5 hover:text-blue-400">
              Kontak & Lokasi
            </a>
          </div>

          <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
            {currentUser ? (
              <div className="flex items-center justify-between bg-slate-800 p-2.5 rounded-lg">
                <div>
                  <div className="text-xs font-semibold text-white">{currentUser?.name || 'Pengguna'}</div>
                  <div className="text-[10px] text-blue-400 capitalize">{currentUser?.email || ''}</div>
                </div>
                <button
                  onClick={() => { onLogout(); setMobileMenuOpen(false); }}
                  className="px-3 py-1 bg-rose-900/60 text-rose-200 text-xs rounded border border-rose-700"
                >
                  Keluar
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { onOpenAuth('login'); setMobileMenuOpen(false); }}
                  className="w-full py-2 bg-slate-800 text-xs font-medium text-white rounded border border-slate-700"
                >
                  Masuk Akun
                </button>
                <button
                  onClick={() => { onOpenAuth('register'); setMobileMenuOpen(false); }}
                  className="w-full py-2 bg-blue-600 text-xs font-medium text-white rounded"
                >
                  Daftar Akun
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
