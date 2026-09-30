// =====================================================================
// src/utils/pdf/pdfTheme.ts
// Desain Sistem & Tema Visual Terpadu PDF SMPS Al-Hadiid Cileungsi
// =====================================================================

export const PDF_THEME = {
  // Palet Warna Resmi Sekolah (Profesional, Elegan, Islami)
  colors: {
    // Primary - Deep Emerald / Navy Al-Hadiid
    primary: [15, 118, 110] as [number, number, number], // #0f766e
    primaryDark: [13, 78, 73] as [number, number, number], // #0d4e49
    primaryLight: [236, 253, 245] as [number, number, number], // #ecfdf5 (emerald-50)

    // Secondary / Accent - Gold / Amber Al-Hadiid
    accent: [217, 119, 6] as [number, number, number], // #d97706
    accentLight: [254, 243, 199] as [number, number, number], // #fef3c7

    // Slate / Dark Tones untuk Tipografi
    textDark: [15, 23, 42] as [number, number, number], // #0f172a (slate-900)
    textBody: [30, 41, 59] as [number, number, number], // #1e293b (slate-800)
    textMuted: [71, 85, 105] as [number, number, number], // #475569 (slate-600)
    textLight: [148, 163, 184] as [number, number, number], // #94a3b8 (slate-400)

    // Garis & Background
    bgLight: [248, 250, 252] as [number, number, number], // #f8fafc (slate-50)
    bgZebra: [241, 245, 249] as [number, number, number], // #f1f5f9 (slate-100)
    borderLight: [203, 213, 225] as [number, number, number], // #cbd5e1 (slate-300)
    borderDark: [51, 65, 85] as [number, number, number], // #334155 (slate-700)

    // Status Verifikasi & Hasil
    verified: [22, 163, 74] as [number, number, number], // green-600
    verifiedBg: [240, 253, 244] as [number, number, number], // green-50
    pending: [217, 119, 6] as [number, number, number], // amber-600
    pendingBg: [254, 252, 232] as [number, number, number], // amber-50
    rejected: [220, 38, 38] as [number, number, number], // red-600
    rejectedBg: [254, 242, 242] as [number, number, number], // red-50

    white: [255, 255, 255] as [number, number, number],
  },

  // Font standard jsPDF
  fonts: {
    family: 'helvetica',
    bold: 'bold',
    normal: 'normal',
    italic: 'italic',
  },

  // Ukuran Kertas & Margin (mm)
  layout: {
    portrait: {
      width: 210,
      height: 297,
      marginLeft: 15,
      marginRight: 15,
      marginTop: 10,
      marginBottom: 12,
      contentWidth: 180, // 210 - 30
      centerX: 105,
    },
    landscape: {
      width: 297,
      height: 210,
      marginLeft: 15,
      marginRight: 15,
      marginTop: 10,
      marginBottom: 12,
      contentWidth: 267, // 297 - 30
      centerX: 148.5,
    },
  },
};
