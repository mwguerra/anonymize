import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import * as fs from 'node:fs';
import * as XLSX from 'xlsx';
import { anonymize, resolveOutputPath, type AnonymizeHooks, type ConfirmResult } from '../../src/core/anonymizer.js';
import { OverwriteError } from '../../src/utils/errors.js';
import type { Sheet, ColumnMapping } from '../../src/io/types.js';
import type { RuleConfig } from '../../src/config/schema.js';

XLSX.set_fs(fs);

const INPUT = join(import.meta.dirname, '..', 'input');
const OUTPUT = join(import.meta.dirname, '..', 'output');
const tmpFiles: string[] = [];

afterEach(() => {
  for (const f of tmpFiles) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
  tmpFiles.length = 0;
});

function out(name: string): string {
  const p = join(OUTPUT, name);
  tmpFiles.push(p);
  return p;
}

describe('resolveOutputPath', () => {
  it('should generate <name>.anonymized.<ext> by default', () => {
    expect(resolveOutputPath('/data/clientes.csv')).toContain('clientes.anonymized.csv');
  });

  it('should use override if provided', () => {
    const result = resolveOutputPath('/data/clientes.csv', '/output/safe.csv');
    expect(result).toContain('safe.csv');
  });
});

describe('anonymize (CSV)', () => {
  it('should anonymize CSV and produce output file', async () => {
    const inputPath = join(INPUT, 'sample-comma.csv');
    const outputPath = out('sample-comma.anonymized.csv');

    const result = await anonymize({
      inputPath,
      outputPath,
      silent: true,
    });

    expect(result.outputPath).toBe(outputPath);
    expect(result.totalCellsAnonymized).toBeGreaterThan(0);
    expect(result.sheetsProcessed).toBe(1);
    expect(fs.existsSync(outputPath)).toBe(true);

    // Verify original values are NOT in output
    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).not.toContain('José da Silva');
    expect(content).not.toContain('jose@example.com');
    expect(content).not.toContain('123.456.789-00');

    // Verify input file was NOT modified
    const originalContent = fs.readFileSync(inputPath, 'utf-8');
    expect(originalContent).toContain('José da Silva');
    expect(originalContent).toContain('jose@example.com');
  });

  it('should anonymize semicolon-delimited CSV', async () => {
    const inputPath = join(INPUT, 'sample-semicolon.csv');
    const outputPath = out('sample-semicolon.anonymized.csv');

    const result = await anonymize({
      inputPath,
      outputPath,
      silent: true,
    });

    expect(result.totalCellsAnonymized).toBeGreaterThan(0);
    expect(fs.existsSync(outputPath)).toBe(true);

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).not.toContain('José da Silva');
    expect(content).not.toContain('Rua das Flores 123');
    expect(content).not.toContain('(11) 99999-0001');
  });

  it('should maintain cross-row consistency', async () => {
    const inputPath = join(INPUT, 'dupes.csv');
    const outputPath = out('dupes.anonymized.csv');

    const result = await anonymize({ inputPath, outputPath, silent: true });

    const content = fs.readFileSync(outputPath, 'utf-8');
    const lines = content.trim().split('\n').slice(1); // skip header
    const names = lines.map(l => l.split(',')[0]);

    // Same original name → same fake name
    expect(names[0]).toBe(names[1]);
    // Different original name → different fake name
    expect(names[0]).not.toBe(names[2]);
    expect(result.uniqueValuesPerRule['name']).toBe(2);
  });

  it('should maintain cross-row consistency in comma CSV with duplicate rows', async () => {
    const inputPath = join(INPUT, 'sample-comma.csv');
    const outputPath = out('comma-consistency.anonymized.csv');

    const result = await anonymize({ inputPath, outputPath, silent: true });

    const content = fs.readFileSync(outputPath, 'utf-8');
    const lines = content.trim().split('\n').slice(1);
    const names = lines.map(l => l.split(',')[0]);

    // Rows 0 and 2 are both "José da Silva" in original → same fake name
    expect(names[0]).toBe(names[2]);
    // Different people get different names
    expect(names[0]).not.toBe(names[1]); // Maria Santos
    expect(names[0]).not.toBe(names[3]); // Ana Oliveira
  });
});

describe('anonymize (XLSX)', () => {
  it('should anonymize single-sheet XLSX', async () => {
    const inputPath = join(INPUT, 'sample.xlsx');
    const outputPath = out('sample.anonymized.xlsx');

    const result = await anonymize({ inputPath, outputPath, silent: true });

    expect(result.sheetsProcessed).toBe(1);
    expect(result.totalCellsAnonymized).toBeGreaterThan(0);
    expect(fs.existsSync(outputPath)).toBe(true);

    // Verify output
    const outWb = XLSX.readFile(outputPath);
    const data = XLSX.utils.sheet_to_json<string[]>(outWb.Sheets['Clientes'], { header: 1, raw: false });
    // Header row preserved
    expect(data[0]).toEqual(['nome', 'email', 'cpf', 'cidade', 'valor']);
    // Data anonymized
    expect(data[1][0]).not.toBe('José da Silva');
    expect(data[1][1]).not.toBe('jose@example.com');

    // Verify input NOT modified
    const inWb = XLSX.readFile(inputPath);
    const inData = XLSX.utils.sheet_to_json<string[]>(inWb.Sheets['Clientes'], { header: 1, raw: false });
    expect(inData[1][0]).toBe('José da Silva');
  });

  it('should anonymize multi-sheet XLSX with cross-sheet consistency', async () => {
    const inputPath = join(INPUT, 'multi-sheet.xlsx');
    const outputPath = out('multi-sheet.anonymized.xlsx');

    const result = await anonymize({ inputPath, outputPath, silent: true });

    expect(result.sheetsProcessed).toBe(2);
    expect(result.totalCellsAnonymized).toBeGreaterThan(0);

    // Read output and check cross-sheet consistency
    const outWb = XLSX.readFile(outputPath);
    const s1 = XLSX.utils.sheet_to_json<string[]>(outWb.Sheets['Clientes'], { header: 1, raw: false });
    const s2 = XLSX.utils.sheet_to_json<string[]>(outWb.Sheets['Contatos'], { header: 1, raw: false });

    // "José da Silva" appears in both sheets → should get same fake name
    expect(s1[1][0]).toBe(s2[1][0]);
    // But NOT the original
    expect(s1[1][0]).not.toBe('José da Silva');
  });

  it('should anonymize XLS (biff8) format', async () => {
    const inputPath = join(INPUT, 'sample.xls');
    const outputPath = out('sample.anonymized.xls');

    const result = await anonymize({ inputPath, outputPath, silent: true });

    expect(result.sheetsProcessed).toBe(1);
    expect(result.totalCellsAnonymized).toBeGreaterThan(0);
    expect(fs.existsSync(outputPath)).toBe(true);
  });
});

describe('anonymize (dry run)', () => {
  it('should not create output file in dry run mode', async () => {
    const inputPath = join(INPUT, 'sample-comma.csv');
    const result = await anonymize({ inputPath, dryRun: true, silent: true });

    expect(result.outputPath).toBe('');
    expect(result.totalCellsAnonymized).toBe(0);
    expect(result.mappings.length).toBeGreaterThan(0);
  });

  it('should detect columns in XLSX dry run', async () => {
    const inputPath = join(INPUT, 'multi-sheet.xlsx');
    const result = await anonymize({ inputPath, dryRun: true, silent: true });

    expect(result.sheetsProcessed).toBe(2);
    expect(result.mappings.length).toBeGreaterThan(0);
    // Should detect columns from both sheets
    const sheetNames = [...new Set(result.mappings.map(m => m.sheetName))];
    expect(sheetNames).toHaveLength(2);
  });
});

describe('anonymize (no-overwrite)', () => {
  it('should throw OverwriteError when output exists and --no-overwrite', async () => {
    const inputPath = join(INPUT, 'sample-comma.csv');
    const outputPath = out('existing.csv');
    fs.writeFileSync(outputPath, 'dummy');

    await expect(anonymize({
      inputPath,
      outputPath,
      noOverwrite: true,
      silent: true,
    })).rejects.toThrow(OverwriteError);
  });
});

describe('anonymize (hooks)', () => {
  it('should abort when confirm hook returns quit', async () => {
    const inputPath = join(INPUT, 'sample-comma.csv');
    const hooks: AnonymizeHooks = {
      confirm: async () => ({ action: 'quit' }),
    };

    const result = await anonymize({ inputPath, silent: true }, hooks);
    expect(result.outputPath).toBe('');
    expect(result.totalCellsAnonymized).toBe(0);
  });

  it('should use modified mappings from confirm hook', async () => {
    const inputPath = join(INPUT, 'sample-comma.csv');
    const outputPath = out('hooks-modified.csv');

    const hooks: AnonymizeHooks = {
      confirm: async (sheets: Sheet[], mappings: ColumnMapping[]) => {
        // Only keep the first mapping (drop the rest)
        return { action: 'proceed', mappings: mappings.slice(0, 1) };
      },
    };

    const result = await anonymize({ inputPath, outputPath, silent: true }, hooks);
    expect(result.totalCellsAnonymized).toBeGreaterThan(0);
    expect(result.mappings).toHaveLength(1);
  });

  it('should invoke progress tracker during processing', async () => {
    const inputPath = join(INPUT, 'sample-comma.csv');
    const outputPath = out('hooks-progress.csv');

    const events: string[] = [];
    const hooks: AnonymizeHooks = {
      progress: {
        start: (name: string, total: number) => events.push(`start:${name}:${total}`),
        increment: () => events.push('tick'),
        stop: () => events.push('stop'),
      },
    };

    await anonymize({ inputPath, outputPath, silent: true }, hooks);
    expect(events[0]).toMatch(/^start:/);
    expect(events).toContain('tick');
    expect(events[events.length - 1]).toBe('stop');
  });
});
