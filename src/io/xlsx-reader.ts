import * as fs from 'node:fs';
import * as XLSX from 'xlsx';
import type { Sheet } from './types.js';

XLSX.set_fs(fs);

export function readXlsx(filePath: string): Sheet[] {
  const workbook = XLSX.readFile(filePath, { type: 'file' });

  const sheets: Sheet[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const raw = XLSX.utils.sheet_to_json<string[]>(worksheet, {
      header: 1,
      defval: '',
      raw: false,
    });

    if (raw.length === 0) {
      sheets.push({ name: sheetName, headers: [], rows: [] });
      continue;
    }

    const headers = raw[0].map(String);
    const dataRows = raw.slice(1);

    sheets.push({ name: sheetName, headers, rows: dataRows });
  }

  return sheets;
}
