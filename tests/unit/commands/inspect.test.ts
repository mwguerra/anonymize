import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const CLI = join(import.meta.dirname, '..', '..', '..', 'src', 'index.ts');
const INPUT = join(import.meta.dirname, '..', '..', 'examples', 'single_files', 'input');

function run(args: string[]) {
  return exec('node', ['--import', 'jiti/register', CLI, ...args], { timeout: 30_000 });
}

describe('anonymize inspect', { timeout: 30_000 }, () => {
  it('should show detected columns for a CSV file', async () => {
    const { stdout } = await run([
      'inspect', join(INPUT, 'sample-comma.csv'),
    ]);

    expect(stdout).toContain('Detected columns:');
    expect(stdout).toContain('Columns to anonymize:');
  });

  it('should show detected columns for an XLSX file', async () => {
    const { stdout } = await run([
      'inspect', join(INPUT, 'multi-sheet.xlsx'),
    ]);

    expect(stdout).toContain('Detected columns:');
    expect(stdout).toContain('Sheets: 2');
  });

  it('should suppress output with --silent', async () => {
    const { stdout } = await run([
      'inspect', join(INPUT, 'sample-comma.csv'), '--silent',
    ]);

    expect(stdout.trim()).toBe('');
  });

  it('should fail with nonexistent file', async () => {
    await expect(
      run(['inspect', '/tmp/nonexistent.csv']),
    ).rejects.toThrow();
  });
});
