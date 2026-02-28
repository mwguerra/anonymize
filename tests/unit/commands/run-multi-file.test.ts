import { describe, it, expect, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import * as fs from 'node:fs';
import * as XLSX from 'xlsx';
import { promisify } from 'node:util';

XLSX.set_fs(fs);

const exec = promisify(execFile);
const CLI = join(import.meta.dirname, '..', '..', '..', 'src', 'index.ts');
const MULTI_INPUT = join(import.meta.dirname, '..', '..', 'examples', '2_multiple_files', 'input');
const CSV_PATH = join(MULTI_INPUT, 'sample-comma.csv');
const XLSX_PATH = join(MULTI_INPUT, 'sample.xlsx');
const XLS_PATH = join(MULTI_INPUT, 'sample.xls');

function run(args: string[]) {
  return exec('node', ['--import', 'jiti/register', CLI, ...args], { timeout: 60_000 });
}

const tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  tmpDirs.length = 0;
});

function tmpOut(): string {
  const p = join('/tmp', `anon-multi-cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tmpDirs.push(p);
  return p;
}

describe('anonymize run (multi-file mode)', { timeout: 60_000 }, () => {
  it('should anonymize multiple files with --yes', async () => {
    const outputDir = tmpOut();
    const { stdout } = await run([
      'run', CSV_PATH, XLSX_PATH, '--output', outputDir, '--yes',
    ]);

    expect(stdout).toContain('Multi-file anonymization complete!');
    expect(stdout).toContain('Files anonymized:');
    expect(existsSync(join(outputDir, 'sample-comma.csv'))).toBe(true);
    expect(existsSync(join(outputDir, 'sample.xlsx'))).toBe(true);
  });

  it('should maintain cross-file consistency via CLI', async () => {
    const outputDir = tmpOut();
    await run([
      'run', CSV_PATH, XLSX_PATH, '--output', outputDir, '--yes',
    ]);

    // Read anonymized CSV
    const csvContent = readFileSync(join(outputDir, 'sample-comma.csv'), 'utf-8');
    const csvLines = csvContent.trim().split('\n').slice(1);
    const csvNames = csvLines.map(l => l.split(',')[0]);

    // Read anonymized XLSX
    const wb = XLSX.readFile(join(outputDir, 'sample.xlsx'));
    const sheetName = wb.SheetNames[0];
    const xlsxData = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], { header: 1, raw: false });
    const xlsxNames = xlsxData.slice(1).map(row => row[0]);

    // "José da Silva" in both files → same fake name
    expect(csvNames[0]).toBe(xlsxNames[0]);
    expect(csvNames[0]).not.toBe('José da Silva');
  });

  it('should require --output for multi-file mode', async () => {
    await expect(
      run(['run', CSV_PATH, XLSX_PATH, '--yes']),
    ).rejects.toThrow();
  });

  it('should reject mixed files and directories', async () => {
    const dirPath = join(import.meta.dirname, '..', '..', 'examples', '3_folders', 'input');
    await expect(
      run(['run', CSV_PATH, dirPath, '--output', tmpOut(), '--yes']),
    ).rejects.toThrow();
  });

  it('should show dry-run plan for multi-file', async () => {
    const outputDir = tmpOut();
    const { stdout } = await run([
      'run', CSV_PATH, XLSX_PATH, '--output', outputDir, '--yes', '--dry-run',
    ]);

    expect(stdout).toContain('[DRY RUN] Multi-file anonymization plan:');
    expect(stdout).toContain('Files anonymized:');
  });

  it('should handle three files (CSV + XLSX + XLS)', async () => {
    const outputDir = tmpOut();
    const { stdout } = await run([
      'run', CSV_PATH, XLSX_PATH, XLS_PATH, '--output', outputDir, '--yes',
    ]);

    expect(stdout).toContain('Multi-file anonymization complete!');
    expect(existsSync(join(outputDir, 'sample-comma.csv'))).toBe(true);
    expect(existsSync(join(outputDir, 'sample.xlsx'))).toBe(true);
    expect(existsSync(join(outputDir, 'sample.xls'))).toBe(true);
  });
});
