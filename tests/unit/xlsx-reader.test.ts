import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import * as fs from 'node:fs';
import * as XLSX from 'xlsx';
import { readXlsx } from '../../src/io/xlsx-reader.js';

XLSX.set_fs(fs);

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');
const XLSX_PATH = join(FIXTURES, 'sample.xlsx');

beforeAll(() => {
  const wb = XLSX.utils.book_new();

  const ws1Data = [
    ['nome', 'email', 'cpf'],
    ['José da Silva', 'jose@example.com', '123.456.789-00'],
    ['Maria Santos', 'maria@example.com', '987.654.321-00'],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
  XLSX.utils.book_append_sheet(wb, ws1, 'Clientes');

  const ws2Data = [
    ['nome', 'telefone'],
    ['José da Silva', '(11) 99999-0000'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
  XLSX.utils.book_append_sheet(wb, ws2, 'Contatos');

  XLSX.writeFile(wb, XLSX_PATH);
});

afterAll(() => {
  try { fs.unlinkSync(XLSX_PATH); } catch { /* ignore */ }
});

describe('readXlsx', () => {
  it('should read all sheets from XLSX', () => {
    const sheets = readXlsx(XLSX_PATH);
    expect(sheets).toHaveLength(2);
    expect(sheets[0].name).toBe('Clientes');
    expect(sheets[1].name).toBe('Contatos');
  });

  it('should extract headers correctly', () => {
    const sheets = readXlsx(XLSX_PATH);
    expect(sheets[0].headers).toEqual(['nome', 'email', 'cpf']);
    expect(sheets[1].headers).toEqual(['nome', 'telefone']);
  });

  it('should extract data rows', () => {
    const sheets = readXlsx(XLSX_PATH);
    expect(sheets[0].rows).toHaveLength(2);
    expect(sheets[0].rows[0][0]).toBe('José da Silva');
    expect(sheets[0].rows[0][2]).toBe('123.456.789-00');
  });

  it('should handle sheet with only headers', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['col1', 'col2']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Empty');
    const tmpPath = join(FIXTURES, 'headers-only.xlsx');
    XLSX.writeFile(wb, tmpPath);

    try {
      const sheets = readXlsx(tmpPath);
      expect(sheets[0].headers).toEqual(['col1', 'col2']);
      expect(sheets[0].rows).toHaveLength(0);
    } finally {
      fs.unlinkSync(tmpPath);
    }
  });
});
