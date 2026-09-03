import React from 'react';
import { SchoolInfo } from '../types';
import { MapPin, Phone, Mail, Globe, MessageSquare, Facebook, Instagram, Youtube } from 'lucide-react';
import { SchoolLogo } from './SchoolLogo';

interface FooterProps {
  schoolInfo: SchoolInfo;
  onOpenWhatsApp: () => void;
}

export const Footer: React.FC<FooterProps> = ({ schoolInfo, onOpenWhatsApp }) => {
  return (
    <footer className="bg-slate-950 text-slate-400 text-sm border-t border-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* Col 1: School Info */}
        <div className="space-y-4">
          <SchoolLogo size="lg" showText={true} />
          <p className="text-xs leading-relaxed text-slate-400">
            {schoolInfo.tagline}
          </p>
          <div className="pt-2 flex items-center gap-3 text-slate-300">
            <a href="#" className="p-2 bg-slate-900 rounded-lg hover:bg-blue-600 hover:text-white transition-colors" title="Facebook">
              <Facebook className="w-4 h-4" />
            </a>
            <a href="#" className="p-2 bg-slate-900 rounded-lg hover:bg-blue-600 hover:text-white transition-colors" title="Instagram">
              <Instagram className="w-4 h-4" />
            </a>
            <a href="#" className="p-2 bg-slate-900 rounded-lg hover:bg-blue-600 hover:text-white transition-colors" title="YouTube">
              <Youtube className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Col 2: Quick Links */}
        <div>
          <h4 className="text-white font-semibold text-sm mb-4 border-l-2 border-blue-500 pl-2">
            Tautan Cepat
          </h4>
          <ul className="space-y-2 text-xs">
            <li><a href="#profil" className="hover:text-blue-400 transition-colors">Profil & Visi Misi</a></li>
            <li><a href="#keunggulan" className="hover:text-blue-400 transition-colors">Keunggulan & Program Tahfizh</a></li>
            <li><a href="#fasilitas" className="hover:text-blue-400 transition-colors">Fasilitas & Gedung Pembelajaran</a></li>
            <li><a href="#biaya" className="hover:text-blue-400 transition-colors">Rincian Biaya Pendidikan</a></li>
            <li><a href="#jadwal" className="hover:text-blue-400 transition-colors">Jadwal Gelombang SPMB</a></li>
            <li><a href="#faq" className="hover:text-blue-400 transition-colors">Pertanyaan Umum (FAQ)</a></li>
          </ul>
        </div>

        {/* Col 3: Contact & Hours */}
        <div>
          <h4 className="text-white font-semibold text-sm mb-4 border-l-2 border-blue-500 pl-2">
            Kontak Panitia SPMB
          </h4>
          <ul className="space-y-2.5 text-xs">
            <li className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>{schoolInfo.address}</span>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-blue-400 shrink-0" />
              <span>{schoolInfo.phone}</span>
            </li>
            <li className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-400 shrink-0" />
              <button onClick={onOpenWhatsApp} className="hover:underline text-blue-300 font-medium">
                WA: +{schoolInfo.whatsapp} (Fast Response)
              </button>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-400 shrink-0" />
              <span>{schoolInfo.email}</span>
            </li>
            <li className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400 shrink-0" />
              <span>{schoolInfo.website}</span>
            </li>
          </ul>
        </div>

        {/* Col 4: Bank Account & Google Map Badge */}
        <div>
          <h4 className="text-white font-semibold text-sm mb-4 border-l-2 border-blue-500 pl-2">
            Rekening Resmi SPMB
          </h4>
          <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="text-xs text-blue-400 font-bold">{schoolInfo.bankName}</div>
            <div className="text-lg font-mono font-bold text-white tracking-wider">{schoolInfo.bankAccountNumber}</div>
            <div className="text-[11px] text-slate-400">a.n. {schoolInfo.bankAccountName}</div>
            <p className="text-[10px] text-yellow-400/90 pt-1 border-t border-slate-800">
              *Hati-hati penipuan. Transfer biaya formulir & pendaftaran hanya ke rekening resmi yayasan di atas.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-slate-900 bg-slate-950 py-4 px-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            © {new Date().getFullYear()} {schoolInfo.name}. All rights reserved.
          </div>
          <div className="text-slate-400 text-[11px]">
            Selamat bergabung, belajar bersama untuk menuntut ilmu yang bermanfaat.
          </div>
        </div>
      </div>
    </footer>
  );
};
