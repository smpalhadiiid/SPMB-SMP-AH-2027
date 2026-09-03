import React from 'react';
import logoSvg from '../assets/logo.svg';
import { getStoredSchoolInfo } from '../utils/storage';

interface SchoolLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  textColor?: string;
  subtextColor?: string;
  customLogoUrl?: string;
}

export const SchoolLogo: React.FC<SchoolLogoProps> = ({
  className = '',
  size = 'md',
  showText = false,
  textColor = 'text-white',
  subtextColor = 'text-slate-400',
  customLogoUrl,
}) => {
  const storedInfo = typeof window !== 'undefined' ? getStoredSchoolInfo() : null;
  const activeLogo = customLogoUrl || storedInfo?.logoUrl || logoSvg;

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`relative ${sizeClasses[size]} rounded-lg overflow-hidden bg-white p-1 border border-slate-200/30 shadow-md shrink-0 flex items-center justify-center`}>
        <img
          src={activeLogo}
          alt="Logo SMP Al-Hadiid Cileungsi"
          className="w-full h-full object-contain"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = logoSvg;
          }}
        />
      </div>
      {showText && (
        <div>
          <div className={`font-extrabold text-base sm:text-lg tracking-tight ${textColor} flex items-center gap-2`}>
            <span>SMP AL-HADIID</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
              CILEUNGSI
            </span>
          </div>
          <div className={`text-[10px] ${subtextColor} font-medium uppercase tracking-wider`}>
            SPMB ONLINE 2027/2028
          </div>
        </div>
      )}
    </div>
  );
};
