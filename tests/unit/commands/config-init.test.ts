import { describe, it, expect, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const PROJECT_ROOT = join(import.meta.dirname, '..', '..', '..');
const CLI = join(PROJECT_ROOT, 'src', 'index.ts');
const JITI_REGISTER = join(PROJECT_ROOT, 'node_modules', 'jiti', 'lib', 'jiti-register.mjs');

function run(args: string[], cwd: string) {
  return exec('node', ['--import', JITI_REGISTER, CLI, ...args], {
    timeout: 30_000,
    cwd,
  });
}

let tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs) {
    try { rmSync(d, { recursive: true }); } catch { /* ignore */ }
  }
  tmpDirs = [];
});

function makeTmpDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'anon-test-'));
  tmpDirs.push(d);
  return d;
}

describe('anonymize config:init', { timeout: 30_000 }, () => {
  it('should create .anonymizerc.json in cwd', async () => {
    const cwd = makeTmpDir();
    const { stdout } = await run(['config:init'], cwd);

    expect(stdout).toContain('Created');
    expect(existsSync(join(cwd, '.anonymizerc.json'))).toBe(true);
  });

  it('should refuse to overwrite without --force', async () => {
    const cwd = makeTmpDir();

    // First call — succeeds
    await run(['config:init'], cwd);
    expect(existsSync(join(cwd, '.anonymizerc.json'))).toBe(true);

    // Second call — should fail
    await expect(run(['config:init'], cwd)).rejects.toThrow();
  });

  it('should overwrite with --force', async () => {
    const cwd = makeTmpDir();

    await run(['config:init'], cwd);
    const { stdout } = await run(['config:init', '--force'], cwd);

    expect(stdout).toContain('Created');
    expect(existsSync(join(cwd, '.anonymizerc.json'))).toBe(true);
  });
});
