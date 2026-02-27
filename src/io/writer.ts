import { extname } from 'node:path';
import { writeCsv, type CsvWriterOptions } from './csv-writer.js';
import { writeXlsx } from './xlsx-writer.js';
import type { Sheet } from './types.js';

export interface WriterOptions extends CsvWriterOptions {}

export function writeFile(filePath: string, sheets: Sheet[], options: WriterOptions = {}): void {
  const ext = extname(filePath).toLowerCase();

  if (ext === '.csv') {
    // CSV only supports single sheet
    writeCsv(filePath, sheets[0], options);
  } else {
    writeXlsx(filePath, sheets);
  }
}
