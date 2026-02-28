import { describe, it, expect, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { existsSync, readFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const CLI = join(import.meta.dirname, '..', '..', '..', 'src', 'index.ts');
const FOLDER_INPUT = join(import.meta.dirname, '..', '..', 'examples', 'folders', 'input');

function run(args: string[]) {
  return exec('node', ['--import', 'jiti/register', CLI, ...args], { timeout: 60_000 });
}

function walkDir(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

const tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  tmpDirs.length = 0;
});

function tmpOut(): string {
  const p = join('/tmp', `anon-folder-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tmpDirs.push(p);
  return p;
}

describe('anonymize run (folder mode)', { timeout: 60_000 }, () => {
  it('should anonymize all files and replicate folder structure', async () => {
    const outputDir = tmpOut();
    const { stdout } = await run([
      'run', FOLDER_INPUT, '--output', outputDir, '--yes',
    ]);

    expect(stdout).toContain('Folder anonymization complete!');
    expect(stdout).toContain('Files anonymized:');
    expect(stdout).toContain('Files copied (unsupported format):');

    // Verify structure is replicated
    const inputFiles = walkDir(FOLDER_INPUT).map(f => f.replace(FOLDER_INPUT, ''));
    const outputFiles = walkDir(outputDir).map(f => f.replace(outputDir, ''));
    expect(outputFiles.sort()).toEqual(inputFiles.sort());
  });

  it('should copy non-anonymizable files unchanged', async () => {
    const outputDir = tmpOut();
    await run(['run', FOLDER_INPUT, '--output', outputDir, '--yes']);

    const inputReadme = readFileSync(join(FOLDER_INPUT, 'readme.md'), 'utf-8');
    const outputReadme = readFileSync(join(outputDir, 'readme.md'), 'utf-8');
    expect(outputReadme).toBe(inputReadme);
  });

  it('should anonymize CSV content (not just copy)', async () => {
    const outputDir = tmpOut();
    await run(['run', FOLDER_INPUT, '--output', outputDir, '--yes']);

    const inputCsv = readFileSync(join(FOLDER_INPUT, 'r_sample-comma.csv'), 'utf-8');
    const outputCsv = readFileSync(join(outputDir, 'r_sample-comma.csv'), 'utf-8');

    // Headers should be the same (trim \r from line endings)
    const inputHeader = inputCsv.split('\n')[0].trim();
    const outputHeader = outputCsv.split('\n')[0].trim();
    expect(outputHeader).toBe(inputHeader);

    // Data rows should differ (anonymized)
    const inputData = inputCsv.split('\n').slice(1).join('\n').trim();
    const outputData = outputCsv.split('\n').slice(1).join('\n').trim();
    expect(outputData).not.toBe(inputData);
  });

  it('should show dry-run plan without writing data files', async () => {
    const outputDir = tmpOut();
    const { stdout } = await run([
      'run', FOLDER_INPUT, '--output', outputDir, '--yes', '--dry-run',
    ]);

    expect(stdout).toContain('[DRY RUN] Folder anonymization plan:');
    expect(stdout).toContain('Files anonymized:');

    // Directories may be created but no files should exist
    if (existsSync(outputDir)) {
      const files = walkDir(outputDir);
      expect(files).toHaveLength(0);
    }
  });

  it('should require --output when input is a directory', async () => {
    await expect(
      run(['run', FOLDER_INPUT, '--yes']),
    ).rejects.toThrow();
  });

  it('should process nested subdirectories', async () => {
    const outputDir = tmpOut();
    await run(['run', FOLDER_INPUT, '--output', outputDir, '--yes']);

    // Verify deeply nested file exists
    const nestedFile = join(outputDir, 'root_folder_1', 'sub_folder_2', 'nested_folder', 'f_3_sample-comma.csv');
    expect(existsSync(nestedFile)).toBe(true);

    // Verify it was anonymized (content differs from input)
    const inputContent = readFileSync(
      join(FOLDER_INPUT, 'root_folder_1', 'sub_folder_2', 'nested_folder', 'f_3_sample-comma.csv'),
      'utf-8',
    );
    const outputContent = readFileSync(nestedFile, 'utf-8');
    const inputData = inputContent.split('\n').slice(1).join('\n');
    const outputData = outputContent.split('\n').slice(1).join('\n');
    expect(outputData).not.toBe(inputData);
  });
});
