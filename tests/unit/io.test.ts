import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import * as fs from 'node:fs';
import * as XLSX from 'xlsx';
import { readFile } from '../../src/io/reader.js';
import { writeFile } from '../../src/io/writer.js';
import { FileNotFoundError, UnsupportedFormatError } from '../../src/utils/errors.js';

XLSX.set_fs(fs);

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');
const tmpFiles: string[] = [];

afterEach(() => {
  for (const f of tmpFiles) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
  tmpFiles.length = 0;
});

function tmpFile(name: string): string {
  const p = join(FIXTURES, name);
  tmpFiles.push(p);
  return p;
}

describe('readFile (unified reader)', () => {
  it('should read CSV files', () => {
    const sheets = readFile(join(FIXTURES, 'sample-comma.csv'));
    expect(sheets[0].headers).toEqual(['nome', 'email', 'cpf']);
  });

  it('should read XLSX files', () => {
    const xlsxPath = tmpFile('reader-test.xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['a'], [1]]), 'S1');
    XLSX.writeFile(wb, xlsxPath);

    const sheets = readFile(xlsxPath);
    expect(sheets[0].headers).toEqual(['a']);
  });

  it('should throw FileNotFoundError for missing files', () => {
    expect(() => readFile('/nonexistent/file.csv')).toThrow(FileNotFoundError);
  });

  it('should throw UnsupportedFormatError for .json', () => {
    const jsonPath = tmpFile('bad.json');
    fs.writeFileSync(jsonPath, '{}');
    expect(() => readFile(jsonPath)).toThrow(UnsupportedFormatError);
  });
});

describe('writeFile (unified writer)', () => {
  it('should write CSV files', () => {
    const outPath = tmpFile('out.csv');
    writeFile(outPath, [{ name: 'Sheet1', headers: ['a', 'b'], rows: [['1', '2']] }]);
    const content = fs.readFileSync(outPath, 'utf-8');
    expect(content).toContain('a,b');
    expect(content).toContain('1,2');
  });

  it('should write XLSX files', () => {
    const outPath = tmpFile('out.xlsx');
    writeFile(outPath, [
      { name: 'S1', headers: ['x', 'y'], rows: [['a', 'b']] },
      { name: 'S2', headers: ['z'], rows: [['c']] },
    ]);

    const sheets = readFile(outPath);
    expect(sheets).toHaveLength(2);
    expect(sheets[0].name).toBe('S1');
    expect(sheets[1].name).toBe('S2');
  });

  it('should preserve delimiter in CSV', () => {
    const outPath = tmpFile('out-semi.csv');
    writeFile(outPath, [{ name: 'Sheet1', headers: ['a', 'b'], rows: [['1', '2']] }], { delimiter: ';' });
    const content = fs.readFileSync(outPath, 'utf-8');
    expect(content).toContain('a;b');
  });
});
