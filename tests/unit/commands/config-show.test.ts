import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const CLI = join(import.meta.dirname, '..', '..', '..', 'src', 'index.ts');

function run(args: string[]) {
  return exec('node', ['--import', 'jiti/register', CLI, ...args], { timeout: 30_000 });
}

describe('anonymize config:show', { timeout: 30_000 }, () => {
  it('should output valid JSON with default config', async () => {
    const { stdout } = await run(['config:show']);
    const config = JSON.parse(stdout);

    expect(config).toHaveProperty('locale');
    expect(config).toHaveProperty('rules');
    expect(Array.isArray(config.rules)).toBe(true);
    expect(config.rules.length).toBeGreaterThan(0);
  });

  it('should respect --locale override', async () => {
    const { stdout } = await run(['config:show', '--locale', 'en_US']);
    const config = JSON.parse(stdout);

    expect(config.locale).toBe('en_US');
  });

  it('should include default rules', async () => {
    const { stdout } = await run(['config:show']);
    const config = JSON.parse(stdout);
    const ruleIds = config.rules.map((r: { id: string }) => r.id);

    expect(ruleIds).toContain('name');
    expect(ruleIds).toContain('cpf');
    expect(ruleIds).toContain('email');
  });

  it('should fail with invalid config path', async () => {
    await expect(
      run(['config:show', '--config', '/tmp/nonexistent.json']),
    ).rejects.toThrow();
  });
});
