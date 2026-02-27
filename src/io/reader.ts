import { existsSync } from 'node:fs';
import { extname } from 'node:path';
import { FileNotFoundError, UnsupportedFormatError } from '../utils/errors.js';
import { readCsv, type CsvReaderOptions } from './csv-reader.js';
import { readXlsx } from './xlsx-reader.js';
import type { Sheet } from './types.js';

export interface ReaderOptions extends CsvReaderOptions {}

const SUPPORTED_EXTENSIONS = new Set(['.csv', '.xls', '.xlsx']);

export function readFile(filePath: string, options: ReaderOptions = {}): Sheet[] {
  if (!existsSync(filePath)) {
    throw new FileNotFoundError(filePath);
  }

  const ext = extname(filePath).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new UnsupportedFormatError(ext);
  }

  if (ext === '.csv') {
    return readCsv(filePath, options);
  }

  return readXlsx(filePath);
}
