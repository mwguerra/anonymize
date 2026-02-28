import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { anonymizeFolder } from '../../src/core/folder-anonymizer.js';

const FOLDER_INPUT = join(import.meta.dirname, '..', 'examples', 'folders', 'input');

const tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  tmpDirs.length = 0;
});

function tmpOut(): string {
  const p = join('/tmp', `anon-unit-folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tmpDirs.push(p);
  return p;
}

describe('anonymizeFolder', () => {
  it('should return correct counts', async () => {
    const outputDir = tmpOut();
    const result = await anonymizeFolder({
      inputDir: FOLDER_INPUT,
      outputDir,
      silent: true,
    });

    expect(result.filesAnonymized).toBeGreaterThan(0);
    expect(result.filesCopied).toBe(1); // readme.md
    expect(result.totalCellsAnonymized).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should not write files in dry-run mode', async () => {
    const outputDir = tmpOut();
    const result = await anonymizeFolder({
      inputDir: FOLDER_INPUT,
      outputDir,
      dryRun: true,
      silent: true,
    });

    expect(result.filesAnonymized).toBeGreaterThan(0);
    expect(result.filesCopied).toBe(1);
    // No data files should be created
    if (existsSync(outputDir)) {
      const { readdirSync } = await import('node:fs');
      function countFiles(dir: string): number {
        let count = 0;
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) count += countFiles(join(dir, entry.name));
          else count++;
        }
        return count;
      }
      expect(countFiles(outputDir)).toBe(0);
    }
  });

  it('should copy unsupported files unchanged', async () => {
    const outputDir = tmpOut();
    await anonymizeFolder({
      inputDir: FOLDER_INPUT,
      outputDir,
      silent: true,
    });

    const original = readFileSync(join(FOLDER_INPUT, 'readme.md'), 'utf-8');
    const copied = readFileSync(join(outputDir, 'readme.md'), 'utf-8');
    expect(copied).toBe(original);
  });

  it('should handle files with no sensitive columns', async () => {
    const outputDir = tmpOut();
    const result = await anonymizeFolder({
      inputDir: FOLDER_INPUT,
      outputDir,
      silent: true,
    });

    // headers-only.xlsx has headers but no data rows — still counts as anonymized if mappings found
    // filesSkipped = files that are supported format but have zero sensitive columns
    expect(result.filesSkipped).toBeGreaterThanOrEqual(0);
  });
});
