import * as XLSX from 'xlsx';

export interface ExcelReportMetadata {
  title?: string;
  schoolName?: string;
  academicYear?: string;
  printDate?: string;
}

export function exportToExcel(
  data: any[],
  filename: string,
  sheetName: string = 'Data SPMB',
  metadata?: ExcelReportMetadata
) {
  let worksheet: XLSX.WorkSheet;

  if (metadata && (metadata.title || metadata.schoolName)) {
    // Buat worksheet dengan Header Laporan Resmi di bagian atas
    const headerRows: any[][] = [];
    if (metadata.title) headerRows.push([metadata.title.toUpperCase()]);
    if (metadata.schoolName) headerRows.push([`Nama Sekolah: ${metadata.schoolName}`]);
    if (metadata.academicYear) headerRows.push([`Tahun Pelajaran: ${metadata.academicYear}`]);
    if (metadata.printDate) headerRows.push([`Tanggal Cetak: ${metadata.printDate}`]);
    headerRows.push([]); // Baris kosong pemisah

    worksheet = XLSX.utils.aoa_to_sheet(headerRows);
    XLSX.utils.sheet_add_json(worksheet, data, { origin: -1 });
  } else {
    worksheet = XLSX.utils.json_to_sheet(data);
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const cleanFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, cleanFilename);
}
