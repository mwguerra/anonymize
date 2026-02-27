import * as fs from 'node:fs';
import * as XLSX from 'xlsx';
import type { Sheet } from './types.js';

XLSX.set_fs(fs);

export function writeXlsx(filePath: string, sheets: Sheet[]): void {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const allRows = [sheet.headers, ...sheet.rows];
    const worksheet = XLSX.utils.aoa_to_sheet(allRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }

  XLSX.writeFile(workbook, filePath);
}
