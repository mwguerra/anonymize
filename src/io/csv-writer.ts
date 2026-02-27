import { writeFileSync } from 'node:fs';
import Papa from 'papaparse';
import type { Sheet } from './types.js';

export interface CsvWriterOptions {
  delimiter?: string;
}

export function writeCsv(filePath: string, sheet: Sheet, options: CsvWriterOptions = {}): void {
  const allRows = [sheet.headers, ...sheet.rows];
  const csv = Papa.unparse(allRows, {
    delimiter: options.delimiter || ',',
  });
  writeFileSync(filePath, csv, 'utf-8');
}
