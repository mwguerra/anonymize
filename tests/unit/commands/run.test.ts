import { describe, it, expect, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { existsSync, unlinkSync } from 'node:fs';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const CLI = join(import.meta.dirname, '..', '..', '..', 'src', 'index.ts');
const INPUT = join(import.meta.dirname, '..', '..', 'examples', '1_single_files', 'input');
const OUTPUT = join(import.meta.dirname, '..', '..', 'examples', '1_single_files', 'output');

function run(args: string[]) {
  return exec('node', ['--import', 'jiti/register', CLI, ...args], { timeout: 30_000 });
}

const tmpFiles: string[] = [];
afterEach(() => {
  for (const f of tmpFiles) {
    try { unlinkSync(f); } catch { /* ignore */ }
  }
  tmpFiles.length = 0;
});

function out(name: string): string {
  const p = join(OUTPUT, name);
  tmpFiles.push(p);
  return p;
}

describe('anonymize run', { timeout: 30_000 }, () => {
  it('should anonymize a CSV file with --yes', async () => {
    const outputPath = out('run-test.anonymized.csv');
    const { stdout } = await run([
      'run', join(INPUT, 'sample-comma.csv'),
      '--yes', '--output', outputPath,
    ]);

    expect(existsSync(outputPath)).toBe(true);
    expect(stdout).toContain('Anonymization complete!');
  });

  it('should show dry-run plan without creating output', async () => {
    const { stdout } = await run([
      'run', join(INPUT, 'sample-comma.csv'),
      '--dry-run',
    ]);

    expect(stdout).toContain('[DRY RUN]');
    expect(stdout).toContain('No files were modified.');
  });

  it('should suppress output with --silent', async () => {
    const outputPath = out('run-silent.anonymized.csv');
    const { stdout } = await run([
      'run', join(INPUT, 'sample-comma.csv'),
      '--yes', '--silent', '--output', outputPath,
    ]);

    expect(stdout.trim()).toBe('');
    expect(existsSync(outputPath)).toBe(true);
  });

  it('should fail with nonexistent file', async () => {
    await expect(
      run(['run', '/tmp/nonexistent.csv', '--yes']),
    ).rejects.toThrow();
  });
});
