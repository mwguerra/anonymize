import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import * as fs from 'node:fs';
import { readCsv } from '../../src/io/csv-reader.js';

const INPUT = join(import.meta.dirname, '..', 'examples', 'single_files', 'input');
const OUTPUT = join(import.meta.dirname, '..', 'examples', 'single_files', 'output');

const tmpFiles: string[] = [];
afterEach(() => {
  for (const f of tmpFiles) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
  tmpFiles.length = 0;
});

describe('readCsv', () => {
  it('should read comma-delimited CSV', () => {
    const sheets = readCsv(join(INPUT, 'sample-comma.csv'));
    expect(sheets).toHaveLength(1);
    expect(sheets[0].name).toBe('Sheet1');
    expect(sheets[0].headers).toEqual(['nome', 'email', 'cpf', 'cidade', 'valor']);
    expect(sheets[0].rows).toHaveLength(5);
    expect(sheets[0].rows[0][0]).toBe('José da Silva');
  });

  it('should read semicolon-delimited CSV', () => {
    const sheets = readCsv(join(INPUT, 'sample-semicolon.csv'));
    expect(sheets).toHaveLength(1);
    expect(sheets[0].headers).toEqual(['nome', 'email', 'cpf', 'endereco', 'telefone']);
    expect(sheets[0].rows).toHaveLength(3);
  });

  it('should read tab-delimited CSV', () => {
    const sheets = readCsv(join(INPUT, 'sample-tab.csv'));
    expect(sheets).toHaveLength(1);
    expect(sheets[0].headers).toEqual(['nome', 'email', 'cpf']);
    expect(sheets[0].rows).toHaveLength(2);
  });

  it('should respect explicit delimiter override', () => {
    const sheets = readCsv(join(INPUT, 'sample-semicolon.csv'), { delimiter: ';' });
    expect(sheets[0].headers).toEqual(['nome', 'email', 'cpf', 'endereco', 'telefone']);
  });

  it('should handle empty file gracefully', () => {
    const tmpPath = join(OUTPUT, 'empty-test.csv');
    tmpFiles.push(tmpPath);
    fs.writeFileSync(tmpPath, '');

    const sheets = readCsv(tmpPath);
    expect(sheets[0].headers).toEqual([]);
    expect(sheets[0].rows).toEqual([]);
  });
});
