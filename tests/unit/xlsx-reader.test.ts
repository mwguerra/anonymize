import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import * as fs from 'node:fs';
import * as XLSX from 'xlsx';
import { readXlsx } from '../../src/io/xlsx-reader.js';

XLSX.set_fs(fs);

const INPUT = join(import.meta.dirname, '..', 'examples', '1_single_files', 'input');

describe('readXlsx', () => {
  it('should read all sheets from XLSX', () => {
    const sheets = readXlsx(join(INPUT, 'multi-sheet.xlsx'));
    expect(sheets).toHaveLength(2);
    expect(sheets[0].name).toBe('Clientes');
    expect(sheets[1].name).toBe('Contatos');
  });

  it('should extract headers correctly', () => {
    const sheets = readXlsx(join(INPUT, 'multi-sheet.xlsx'));
    expect(sheets[0].headers).toEqual(['nome', 'cpf', 'email']);
    expect(sheets[1].headers).toEqual(['nome', 'telefone', 'endereco']);
  });

  it('should extract data rows', () => {
    const sheets = readXlsx(join(INPUT, 'sample.xlsx'));
    expect(sheets[0].rows).toHaveLength(5);
    expect(sheets[0].rows[0][0]).toBe('José da Silva');
    expect(sheets[0].rows[0][2]).toBe('123.456.789-00');
  });

  it('should handle sheet with only headers', () => {
    const sheets = readXlsx(join(INPUT, 'headers-only.xlsx'));
    expect(sheets[0].headers).toEqual(['nome', 'email', 'cpf']);
    expect(sheets[0].rows).toHaveLength(0);
  });

  it('should read XLS (biff8) format', () => {
    const sheets = readXlsx(join(INPUT, 'sample.xls'));
    expect(sheets).toHaveLength(1);
    expect(sheets[0].name).toBe('Plan1');
    expect(sheets[0].headers).toEqual(['nome', 'email', 'cpf']);
    expect(sheets[0].rows).toHaveLength(2);
  });
});
