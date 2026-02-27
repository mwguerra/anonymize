import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import * as fs from 'node:fs';
import * as XLSX from 'xlsx';
import { anonymize, resolveOutputPath, type AnonymizeHooks, type ConfirmResult } from '../../src/core/anonymizer.js';
import { OverwriteError } from '../../src/utils/errors.js';
import type { Sheet, ColumnMapping } from '../../src/io/types.js';
import type { RuleConfig } from '../../src/config/schema.js';

XLSX.set_fs(fs);

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');
const tmpFiles: string[] = [];

afterEach(() => {
  for (const f of tmpFiles) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
  tmpFiles.length = 0;
});

function tmp(name: string): string {
  const p = join(FIXTURES, name);
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
    const inputPath = join(FIXTURES, 'sample-comma.csv');
    const outputPath = tmp('sample-comma.anonymized.csv');

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
  });

  it('should maintain cross-row consistency', async () => {
    // Create a CSV with duplicate names
    const inputPath = tmp('dupes.csv');
    fs.writeFileSync(inputPath, 'nome,valor\nJosé,100\nJosé,200\nMaria,300');
    const outputPath = tmp('dupes.anonymized.csv');

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
});

describe('anonymize (XLSX)', () => {
  it('should anonymize multi-sheet XLSX with cross-sheet consistency', async () => {
    const inputPath = tmp('multi.xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.aoa_to_sheet([['nome', 'cpf'], ['José', '111.111.111-11']]),
      'S1');
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.aoa_to_sheet([['nome', 'email'], ['José', 'jose@test.com']]),
      'S2');
    XLSX.writeFile(wb, inputPath);

    const outputPath = tmp('multi.anonymized.xlsx');
    const result = await anonymize({ inputPath, outputPath, silent: true });

    expect(result.sheetsProcessed).toBe(2);
    expect(result.totalCellsAnonymized).toBe(4); // S1: nome + cpf, S2: nome + email = 4 cells replaced

    // Read output and check cross-sheet consistency
    const outSheets = XLSX.readFile(outputPath);
    const s1 = XLSX.utils.sheet_to_json<string[]>(outSheets.Sheets['S1'], { header: 1, raw: false });
    const s2 = XLSX.utils.sheet_to_json<string[]>(outSheets.Sheets['S2'], { header: 1, raw: false });

    // Same person in both sheets should have same fake name
    expect(s1[1][0]).toBe(s2[1][0]);
    // But it shouldn't be the original
    expect(s1[1][0]).not.toBe('José');
  });
});

describe('anonymize (dry run)', () => {
  it('should not create output file in dry run mode', async () => {
    const inputPath = join(FIXTURES, 'sample-comma.csv');
    const result = await anonymize({ inputPath, dryRun: true, silent: true });

    expect(result.outputPath).toBe('');
    expect(result.totalCellsAnonymized).toBe(0);
    expect(result.mappings.length).toBeGreaterThan(0);
  });
});

describe('anonymize (no-overwrite)', () => {
  it('should throw OverwriteError when output exists and --no-overwrite', async () => {
    const inputPath = join(FIXTURES, 'sample-comma.csv');
    const outputPath = tmp('existing.csv');
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
    const inputPath = join(FIXTURES, 'sample-comma.csv');
    const hooks: AnonymizeHooks = {
      confirm: async () => ({ action: 'quit' }),
    };

    const result = await anonymize({ inputPath, silent: true }, hooks);
    expect(result.outputPath).toBe('');
    expect(result.totalCellsAnonymized).toBe(0);
  });

  it('should use modified mappings from confirm hook', async () => {
    const inputPath = join(FIXTURES, 'sample-comma.csv');
    const outputPath = tmp('hooks-modified.csv');

    const hooks: AnonymizeHooks = {
      confirm: async (sheets: Sheet[], mappings: ColumnMapping[]) => {
        // Only keep the first mapping (drop the rest)
        return { action: 'proceed', mappings: mappings.slice(0, 1) };
      },
    };

    const result = await anonymize({ inputPath, outputPath, silent: true }, hooks);
    expect(result.totalCellsAnonymized).toBeGreaterThan(0);
    // Should have fewer anonymized cells than without the hook
    expect(result.mappings).toHaveLength(1);
  });

  it('should invoke progress tracker during processing', async () => {
    const inputPath = join(FIXTURES, 'sample-comma.csv');
    const outputPath = tmp('hooks-progress.csv');

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
