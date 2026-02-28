import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { readFileSync, rmSync } from 'node:fs';
import { anonymize } from '../../src/core/anonymizer.js';
import { composeCacheKey } from '../../src/core/anonymize-cell.js';
import { detectColumns } from '../../src/core/detector.js';
import type { Sheet } from '../../src/io/types.js';
import type { RuleConfig } from '../../src/config/schema.js';

const IDENTITY_CSV = join(import.meta.dirname, '..', 'examples', '1_single_files', 'input', 'identity-test.csv');

const tmpFiles: string[] = [];

afterEach(() => {
  for (const f of tmpFiles) {
    try { rmSync(f, { force: true }); } catch { /* ignore */ }
  }
  tmpFiles.length = 0;
});

function tmpOut(): string {
  const p = join('/tmp', `anon-identity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.csv`);
  tmpFiles.push(p);
  return p;
}

describe('composeCacheKey', () => {
  it('should return original when no identityValue', () => {
    expect(composeCacheKey('Marcelo')).toBe('Marcelo');
  });

  it('should compose key with identityValue', () => {
    expect(composeCacheKey('Marcelo', '111.222.333-44')).toBe('111.222.333-44::Marcelo');
  });

  it('should compose different keys for different identities', () => {
    const key1 = composeCacheKey('Marcelo', '111.222.333-44');
    const key2 = composeCacheKey('Marcelo', '555.666.777-88');
    expect(key1).not.toBe(key2);
  });
});

describe('identity column detection', () => {
  const rules: RuleConfig[] = [
    { id: 'name', columns: ['nome'], generator: 'faker.person.fullName()', identityColumn: 'cpf' },
    { id: 'email', columns: ['email'], generator: 'faker.internet.email()', identityColumn: 'cpf' },
    { id: 'cpf', columns: ['cpf'], generator: "faker.helpers.replaceSymbols('###.###.###-##')" },
  ];

  it('should resolve identityColumnIndex for rules with identityColumn', () => {
    const sheets: Sheet[] = [
      { name: 'Sheet1', headers: ['nome', 'email', 'cpf', 'cidade'], rows: [] },
    ];

    const mappings = detectColumns(sheets, rules);

    const nameMapping = mappings.find((m) => m.ruleId === 'name');
    const emailMapping = mappings.find((m) => m.ruleId === 'email');
    const cpfMapping = mappings.find((m) => m.ruleId === 'cpf');

    expect(nameMapping!.identityColumnIndex).toBe(2); // cpf is at index 2
    expect(emailMapping!.identityColumnIndex).toBe(2);
    expect(cpfMapping!.identityColumnIndex).toBeUndefined(); // cpf rule has no identity (it IS the identity)
  });

  it('should resolve identityColumnIndex via CLI override', () => {
    const rulesNoIdentity: RuleConfig[] = [
      { id: 'name', columns: ['nome'], generator: 'faker.person.fullName()' },
      { id: 'cpf', columns: ['cpf'], generator: "faker.helpers.replaceSymbols('###.###.###-##')" },
    ];

    const sheets: Sheet[] = [
      { name: 'Sheet1', headers: ['nome', 'cpf'], rows: [] },
    ];

    const mappings = detectColumns(sheets, rulesNoIdentity, {
      identityColumnOverride: 'cpf',
    });

    const nameMapping = mappings.find((m) => m.ruleId === 'name');
    expect(nameMapping!.identityColumnIndex).toBe(1);
  });
});

describe('identity-based anonymization', () => {
  it('should produce different fake names for same name with different CPFs', async () => {
    const outputPath = tmpOut();
    await anonymize({
      inputPath: IDENTITY_CSV,
      outputPath,
      yes: true,
      silent: true,
      identityColumn: 'cpf',
    });

    const content = readFileSync(outputPath, 'utf-8');
    const lines = content.trim().split('\n').slice(1); // skip header
    const names = lines.map((l) => l.split(',')[0]);

    // Row 0: Marcelo (CPF 111) → FakeA
    // Row 1: Marcelo (CPF 555) → FakeB
    // Row 2: Marcelo (CPF 111) → FakeA (same as row 0)
    // Row 3: Ana (CPF 999) → FakeC
    // Row 4: Marcelo (CPF 333) → FakeD

    // Same name + same CPF → same fake
    expect(names[0]).toBe(names[2]);
    // Same name + different CPF → different fake
    expect(names[0]).not.toBe(names[1]);
    expect(names[0]).not.toBe(names[4]);
    expect(names[1]).not.toBe(names[4]);
    // All should be anonymized
    expect(names[0]).not.toBe('Marcelo Silva');
    expect(names[3]).not.toBe('Ana Oliveira');
  });

  it('should produce same fake names without identity column (old behavior)', async () => {
    const outputPath = tmpOut();
    await anonymize({
      inputPath: IDENTITY_CSV,
      outputPath,
      yes: true,
      silent: true,
      // No identityColumn → old behavior
    });

    const content = readFileSync(outputPath, 'utf-8');
    const lines = content.trim().split('\n').slice(1);
    const names = lines.map((l) => l.split(',')[0]);

    // Without identity, all "Marcelo Silva" → same fake
    expect(names[0]).toBe(names[1]);
    expect(names[0]).toBe(names[2]);
    expect(names[0]).toBe(names[4]);
    expect(names[0]).not.toBe('Marcelo Silva');
  });

  it('should anonymize identity column itself normally', async () => {
    const outputPath = tmpOut();
    await anonymize({
      inputPath: IDENTITY_CSV,
      outputPath,
      yes: true,
      silent: true,
      identityColumn: 'cpf',
    });

    const content = readFileSync(outputPath, 'utf-8');
    const lines = content.trim().split('\n').slice(1);
    const cpfs = lines.map((l) => l.split(',')[2]);

    // CPF should be anonymized
    expect(cpfs[0]).not.toBe('111.222.333-44');
    // Same original CPF → same fake CPF
    expect(cpfs[0]).toBe(cpfs[2]);
    // Different CPFs → different fakes
    expect(cpfs[0]).not.toBe(cpfs[1]);
  });

  it('should group emails by identity too', async () => {
    const outputPath = tmpOut();
    await anonymize({
      inputPath: IDENTITY_CSV,
      outputPath,
      yes: true,
      silent: true,
      identityColumn: 'cpf',
    });

    const content = readFileSync(outputPath, 'utf-8');
    const lines = content.trim().split('\n').slice(1);
    const emails = lines.map((l) => l.split(',')[1]);

    // Row 0: marcelo@a.com (CPF 111) → FakeEmailA
    // Row 2: marcelo@a.com (CPF 111) → FakeEmailA (same identity + same email)
    expect(emails[0]).toBe(emails[2]);

    // Row 1: marcelo@b.com (CPF 555) → different from row 0 (different identity)
    // Even if the original emails were different, the key is identity::email
    expect(emails[0]).not.toBe('marcelo@a.com');
  });
});
