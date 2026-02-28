import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import * as fs from 'node:fs';
import * as XLSX from 'xlsx';
import { readFile } from '../../src/io/reader.js';
import { writeFile } from '../../src/io/writer.js';
import { FileNotFoundError, UnsupportedFormatError } from '../../src/utils/errors.js';

XLSX.set_fs(fs);

const INPUT = join(import.meta.dirname, '..', 'examples', 'single_files', 'input');
const OUTPUT = join(import.meta.dirname, '..', 'examples', 'single_files', 'output');
const tmpFiles: string[] = [];

afterEach(() => {
  for (const f of tmpFiles) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
  tmpFiles.length = 0;
});

function tmp(name: string): string {
  const p = join(OUTPUT, name);
  tmpFiles.push(p);
  return p;
}

describe('readFile (unified reader)', () => {
  it('should read CSV files', () => {
    const sheets = readFile(join(INPUT, 'sample-comma.csv'));
    expect(sheets[0].headers).toEqual(['nome', 'email', 'cpf', 'cidade', 'valor']);
  });

  it('should read XLSX files', () => {
    const sheets = readFile(join(INPUT, 'sample.xlsx'));
    expect(sheets[0].headers).toEqual(['nome', 'email', 'cpf', 'cidade', 'valor']);
  });

  it('should read XLS files', () => {
    const sheets = readFile(join(INPUT, 'sample.xls'));
    expect(sheets[0].headers).toEqual(['nome', 'email', 'cpf']);
  });

  it('should throw FileNotFoundError for missing files', () => {
    expect(() => readFile('/nonexistent/file.csv')).toThrow(FileNotFoundError);
  });

  it('should throw UnsupportedFormatError for .json', () => {
    const jsonPath = tmp('bad.json');
    fs.writeFileSync(jsonPath, '{}');
    expect(() => readFile(jsonPath)).toThrow(UnsupportedFormatError);
  });
});

describe('writeFile (unified writer)', () => {
  it('should write CSV files', () => {
    const outPath = tmp('out.csv');
    writeFile(outPath, [{ name: 'Sheet1', headers: ['a', 'b'], rows: [['1', '2']] }]);
    const content = fs.readFileSync(outPath, 'utf-8');
    expect(content).toContain('a,b');
    expect(content).toContain('1,2');
  });

  it('should write XLSX files', () => {
    const outPath = tmp('out.xlsx');
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
    const outPath = tmp('out-semi.csv');
    writeFile(outPath, [{ name: 'Sheet1', headers: ['a', 'b'], rows: [['1', '2']] }], { delimiter: ';' });
    const content = fs.readFileSync(outPath, 'utf-8');
    expect(content).toContain('a;b');
  });
});
