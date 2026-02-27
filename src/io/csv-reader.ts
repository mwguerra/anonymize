import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import chardet from 'chardet';
import type { Sheet } from './types.js';

export interface CsvReaderOptions {
  encoding?: string;
  delimiter?: string;
}

export function readCsv(filePath: string, options: CsvReaderOptions = {}): Sheet[] {
  const buffer = readFileSync(filePath);

  const encoding = options.encoding ?? chardet.detect(buffer) ?? 'utf-8';
  const decoder = new TextDecoder(encoding);
  const content = decoder.decode(buffer);

  const parsed = Papa.parse(content, {
    delimiter: options.delimiter || undefined,
    header: false,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const hasFatalErrors = parsed.errors.some(
    (e) => e.type === 'Delimiter' ? false : true,
  );
  if (hasFatalErrors && parsed.data.length === 0) {
    throw new Error(`Failed to parse CSV: ${parsed.errors[0].message}`);
  }

  const rows = parsed.data as string[][];
  if (rows.length === 0) {
    return [{ name: 'Sheet1', headers: [], rows: [] }];
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  return [{
    name: 'Sheet1',
    headers,
    rows: dataRows,
  }];
}

export function detectDelimiter(filePath: string, encoding?: string): string {
  const buffer = readFileSync(filePath);
  const enc = encoding ?? chardet.detect(buffer) ?? 'utf-8';
  const decoder = new TextDecoder(enc);
  const content = decoder.decode(buffer);

  // Check first line for common delimiters
  const firstLine = content.split('\n')[0] ?? '';
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };

  for (const char of firstLine) {
    if (char in counts) {
      counts[char]++;
    }
  }

  let maxChar = ',';
  let maxCount = 0;
  for (const [char, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      maxChar = char;
    }
  }

  return maxChar;
}
