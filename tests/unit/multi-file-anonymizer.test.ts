import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import * as fs from 'node:fs';
import * as XLSX from 'xlsx';
import { anonymizeMultipleFiles, detectAllFiles, buildMultiFileOutputPath } from '../../src/core/multi-file-anonymizer.js';
import { loadConfig } from '../../src/config/loader.js';

XLSX.set_fs(fs);

const MULTI_INPUT = join(import.meta.dirname, '..', 'examples', '2_multiple_files', 'input');
const CSV_PATH = join(MULTI_INPUT, 'sample-comma.csv');
const XLSX_PATH = join(MULTI_INPUT, 'sample.xlsx');
const XLS_PATH = join(MULTI_INPUT, 'sample.xls');

const tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  tmpDirs.length = 0;
});

function tmpOut(): string {
  const p = join('/tmp', `anon-multi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tmpDirs.push(p);
  return p;
}

describe('detectAllFiles', () => {
  it('should detect columns across multiple files', () => {
    const config = loadConfig({ inputFilePath: CSV_PATH });
    const detections = detectAllFiles([CSV_PATH, XLSX_PATH], config, {});

    expect(detections).toHaveLength(2);
    expect(detections[0].inputPath).toBe(CSV_PATH);
    expect(detections[0].mappings.length).toBeGreaterThan(0);
    expect(detections[1].inputPath).toBe(XLSX_PATH);
    expect(detections[1].mappings.length).toBeGreaterThan(0);
  });
});

describe('buildMultiFileOutputPath', () => {
  it('should place output file in the specified directory', () => {
    const result = buildMultiFileOutputPath('/data/clientes.csv', '/output');
    expect(result).toContain('/output/clientes.csv');
  });
});

describe('anonymizeMultipleFiles', () => {
  it('should anonymize multiple files', async () => {
    const outputDir = tmpOut();
    const result = await anonymizeMultipleFiles({
      inputPaths: [CSV_PATH, XLSX_PATH],
      outputDir,
      silent: true,
    });

    expect(result.filesAnonymized).toBe(2);
    expect(result.totalCellsAnonymized).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);

    expect(existsSync(join(outputDir, 'sample-comma.csv'))).toBe(true);
    expect(existsSync(join(outputDir, 'sample.xlsx'))).toBe(true);
  });

  it('should maintain cross-file cache consistency', async () => {
    const outputDir = tmpOut();
    await anonymizeMultipleFiles({
      inputPaths: [CSV_PATH, XLSX_PATH],
      outputDir,
      silent: true,
    });

    // Read the anonymized CSV
    const csvContent = readFileSync(join(outputDir, 'sample-comma.csv'), 'utf-8');
    const csvLines = csvContent.trim().split('\n').slice(1);
    const csvNames = csvLines.map(l => l.split(',')[0]);

    // Read the anonymized XLSX
    const wb = XLSX.readFile(join(outputDir, 'sample.xlsx'));
    const sheetName = wb.SheetNames[0];
    const xlsxData = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], { header: 1, raw: false });
    const xlsxNames = xlsxData.slice(1).map(row => row[0]);

    // Both files have "José da Silva" — should map to the SAME fake name across files
    expect(csvNames[0]).toBe(xlsxNames[0]);

    // Both should NOT be the original value
    expect(csvNames[0]).not.toBe('José da Silva');
    expect(xlsxNames[0]).not.toBe('José da Silva');
  });

  it('should maintain cross-file email consistency', async () => {
    const outputDir = tmpOut();
    await anonymizeMultipleFiles({
      inputPaths: [CSV_PATH, XLSX_PATH],
      outputDir,
      silent: true,
    });

    const csvContent = readFileSync(join(outputDir, 'sample-comma.csv'), 'utf-8');
    const csvLines = csvContent.trim().split('\n').slice(1);
    const csvEmails = csvLines.map(l => l.split(',')[1]);

    const wb = XLSX.readFile(join(outputDir, 'sample.xlsx'));
    const sheetName = wb.SheetNames[0];
    const xlsxData = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], { header: 1, raw: false });
    const xlsxEmails = xlsxData.slice(1).map(row => row[1]);

    // "jose@example.com" appears in both → same fake email
    expect(csvEmails[0]).toBe(xlsxEmails[0]);
    expect(csvEmails[0]).not.toBe('jose@example.com');
  });

  it('should handle three files (CSV + XLSX + XLS)', async () => {
    const outputDir = tmpOut();
    const result = await anonymizeMultipleFiles({
      inputPaths: [CSV_PATH, XLSX_PATH, XLS_PATH],
      outputDir,
      silent: true,
    });

    expect(result.filesAnonymized).toBe(3);
    expect(result.errors).toHaveLength(0);

    expect(existsSync(join(outputDir, 'sample-comma.csv'))).toBe(true);
    expect(existsSync(join(outputDir, 'sample.xlsx'))).toBe(true);
    expect(existsSync(join(outputDir, 'sample.xls'))).toBe(true);
  });

  it('should not create files in dry-run mode', async () => {
    const outputDir = tmpOut();
    const result = await anonymizeMultipleFiles({
      inputPaths: [CSV_PATH, XLSX_PATH],
      outputDir,
      dryRun: true,
      silent: true,
    });

    expect(result.filesAnonymized).toBe(2);
    expect(result.totalCellsAnonymized).toBe(0);
    expect(existsSync(join(outputDir, 'sample-comma.csv'))).toBe(false);
  });

  it('should abort when confirm hook returns quit', async () => {
    const outputDir = tmpOut();
    const result = await anonymizeMultipleFiles(
      {
        inputPaths: [CSV_PATH, XLSX_PATH],
        outputDir,
        silent: true,
      },
      { confirm: async () => ({ action: 'quit' }) },
    );

    expect(result.filesAnonymized).toBe(0);
    expect(result.filesSkipped).toBe(2);
  });

  it('should support identity column in multi-file mode', async () => {
    const outputDir = tmpOut();
    await anonymizeMultipleFiles({
      inputPaths: [CSV_PATH, XLSX_PATH],
      outputDir,
      silent: true,
      identityColumn: 'cpf',
    });

    // Read anonymized CSV
    const csvContent = readFileSync(join(outputDir, 'sample-comma.csv'), 'utf-8');
    const csvLines = csvContent.trim().split('\n').slice(1);
    const csvNames = csvLines.map(l => l.split(',')[0]);

    // With identity column, "José da Silva" with CPF 123.456.789-00 should get same name
    // Row 0 and row 2 have same name+CPF → same fake name
    expect(csvNames[0]).toBe(csvNames[2]);
    expect(csvNames[0]).not.toBe('José da Silva');
  });
});
