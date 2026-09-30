// =====================================================================
// src/utils/pdf/pdfLogo.ts
// Manajemen & Rendering Logo Resmi SMPS Al-Hadiid Cileungsi untuk Dokumen PDF
// Menggunakan Logo Resmi Hasil Upload Pengguna (LOGO SMP.png / SVG)
// =====================================================================

import { jsPDF } from 'jspdf';
import { SchoolInfo } from '../../types';

// SVG resmi lambang heksagon SMP Al-Hadiid (Hexagon, Blue stripes, Yellow Star, Green Dome, Al-Qur'an, Rehal)
export const OFFICIAL_SMP_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 492" width="100%" height="100%">
  <defs>
    <clipPath id="hex-clip">
      <polygon points="200,8 392,110 392,380 200,482 8,380 8,110" />
    </clipPath>
  </defs>
  <g id="emblem">
    <polygon points="200,8 392,110 392,380 200,482 8,380 8,110" fill="#68c5f5" />
    <g clip-path="url(#hex-clip)" stroke="#000000" stroke-width="7">
      <line x1="50" y1="0" x2="50" y2="500" />
      <line x1="95" y1="0" x2="95" y2="500" />
      <line x1="140" y1="0" x2="140" y2="500" />
      <line x1="185" y1="0" x2="185" y2="500" />
      <line x1="230" y1="0" x2="230" y2="500" />
      <line x1="275" y1="0" x2="275" y2="500" />
      <line x1="320" y1="0" x2="320" y2="500" />
      <line x1="365" y1="0" x2="365" y2="500" />
    </g>
    <polygon points="200,30 207,52 230,52 211,66 218,88 200,74 182,88 189,66 170,52 193,52" fill="#ffdd00" stroke="#000000" stroke-width="4.5" stroke-linejoin="round" />
    <path d="M 200,82 C 248,135 345,165 345,240 C 345,300 292,320 200,320 C 108,320 55,300 55,240 C 55,165 152,135 200,82 Z" fill="#75c83b" stroke="#000000" stroke-width="6.5" stroke-linejoin="round" />
    <polygon points="175,280 135,415 170,360 200,340" fill="#75c83b" stroke="#000000" stroke-width="5.5" stroke-linejoin="round" />
    <polygon points="225,280 265,415 230,360 200,340" fill="#75c83b" stroke="#000000" stroke-width="5.5" stroke-linejoin="round" />
    <polygon points="200,360 130,300 170,270 200,295 230,270 270,300" fill="#c3eed5" stroke="#000000" stroke-width="6.5" stroke-linejoin="round" />
    <path d="M 200,310 L 52,265 C 100,220 160,200 200,215 Z" fill="#c3eed5" stroke="#000000" stroke-width="6.5" stroke-linejoin="round" />
    <path d="M 200,310 L 348,265 C 300,220 240,200 200,215 Z" fill="#c3eed5" stroke="#000000" stroke-width="6.5" stroke-linejoin="round" />
    <path d="M 200,310 L 56,268 M 200,310 L 344,268" fill="none" stroke="#000000" stroke-width="4" />
    <polygon points="200,8 392,110 392,380 200,482 8,380 8,110" fill="none" stroke="#000000" stroke-width="13" stroke-linejoin="round" />
  </g>
</svg>`;

// Cache data URL untuk performa instan tanpa re-fetching berulang
let cachedLogoDataUrl: string | null = null;
let isCaching = false;

// Fallback synchronous untuk environment Node.js / test
if (typeof process !== 'undefined' && typeof window === 'undefined' && !cachedLogoDataUrl) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    const candidatePath = path.resolve('src/assets/images/school_logo_1785638700405.jpg');
    if (fs.existsSync(candidatePath)) {
      const buf = fs.readFileSync(candidatePath);
      cachedLogoDataUrl = 'data:image/jpeg;base64,' + buf.toString('base64');
    }
  } catch {}
}

/**
 * Konversi SVG / URL Logo ke DataURL (Base64) di browser secara aman dan ultra-cepat
 */
export async function preloadSchoolLogo(customLogoUrl?: string): Promise<string | null> {
  if (cachedLogoDataUrl && !customLogoUrl) {
    return cachedLogoDataUrl;
  }

  // Jika ada custom URL dari database yang sudah berupa data URI
  if (customLogoUrl && customLogoUrl.startsWith('data:image/')) {
    return customLogoUrl;
  }

  if (typeof window === 'undefined') {
    return cachedLogoDataUrl;
  }

  try {
    return await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 400;
          canvas.height = 492;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(cachedLogoDataUrl);
            return;
          }
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/png');
          if (!customLogoUrl) {
            cachedLogoDataUrl = dataUrl;
          }
          resolve(dataUrl);
        } catch (e) {
          console.warn('Canvas export logo failed:', e);
          resolve(cachedLogoDataUrl);
        }
      };
      img.onerror = () => {
        resolve(cachedLogoDataUrl);
      };

      // Prioritas sumber gambar: customUrl atau raw SVG resmi SMP
      if (customLogoUrl) {
        img.src = customLogoUrl;
      } else {
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(OFFICIAL_SMP_LOGO_SVG);
      }
    });
  } catch (err) {
    console.warn('Gagal preload logo sekolah:', err);
    return cachedLogoDataUrl;
  }
}

/**
 * Gambar logo sekolah resmi pada dokumen jsPDF secara proporsional
 * @param doc jsPDF instance
 * @param x Posisi horizontal kiri (mm)
 * @param y Posisi vertikal atas (mm)
 * @param boxWidth Lebar maksimum (mm)
 * @param boxHeight Tinggi maksimum (mm)
 * @param schoolInfo Informasi sekolah dari database / state
 */
export function drawSchoolLogo(
  doc: jsPDF,
  x: number,
  y: number,
  boxWidth: number,
  boxHeight: number,
  schoolInfo?: SchoolInfo
): boolean {
  // Rasio aspek lambang resmi: 400 : 492 (width : height)
  const targetAspect = 400 / 492; // ~0.813
  let renderW = boxWidth;
  let renderH = boxWidth / targetAspect;

  if (renderH > boxHeight) {
    renderH = boxHeight;
    renderW = boxHeight * targetAspect;
  }

  // Posisikan di tengah area box
  const posX = x + (boxWidth - renderW) / 2;
  const posY = y + (boxHeight - renderH) / 2;

  const customUrl = schoolInfo?.logoUrl?.trim();
  const candidates = [
    customUrl,
    cachedLogoDataUrl,
    'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(OFFICIAL_SMP_LOGO_SVG),
  ].filter(Boolean) as string[];

  for (const src of candidates) {
    try {
      const isPng = src.includes('image/png') || src.startsWith('data:image/png');
      const format = isPng ? 'PNG' : 'JPEG';
      doc.addImage(src, format, posX, posY, renderW, renderH, undefined, 'FAST');
      return true;
    } catch {
      continue;
    }
  }

  // Fallback visual jika logo gambar gagal dimuat
  try {
    doc.saveGraphicsState();
    doc.setDrawColor(15, 118, 110);
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(posX, posY, renderW, renderH, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 118, 110);
    doc.text('AL-HADIID', posX + renderW / 2, posY + renderH / 2 - 1, { align: 'center' });
    doc.setFontSize(6);
    doc.text('CILEUNGSI', posX + renderW / 2, posY + renderH / 2 + 3, { align: 'center' });
    doc.restoreGraphicsState();
    return true;
  } catch {
    return false;
  }
}

// Inisialisasi preload logo di background browser
if (typeof window !== 'undefined' && !isCaching) {
  isCaching = true;
  setTimeout(() => {
    preloadSchoolLogo().catch(() => {});
  }, 50);
}
