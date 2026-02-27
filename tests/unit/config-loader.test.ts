import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from '../../src/config/loader.js';
import { ConfigValidationError } from '../../src/utils/errors.js';

const TEST_DIR = join(tmpdir(), 'anonymize-test-' + Date.now());

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

function writeConfig(dir: string, config: object): string {
  const path = join(dir, '.anonymizerc.json');
  writeFileSync(path, JSON.stringify(config));
  return path;
}

const validUserConfig = {
  locale: 'en_US',
  rules: [
    { id: 'name', columns: ['full_name'], generator: 'faker.person.fullName()' },
  ],
};

describe('loadConfig', () => {
  it('should return defaults when no config exists', () => {
    const config = loadConfig({});
    expect(config.locale).toBe('pt_BR');
    expect(config.rules.length).toBe(7);
  });

  it('should load config from --config flag', () => {
    const configPath = writeConfig(TEST_DIR, validUserConfig);
    const config = loadConfig({ configPath });
    expect(config.locale).toBe('en_US');
  });

  it('should throw on missing --config file', () => {
    expect(() => loadConfig({ configPath: '/nonexistent/config.json' }))
      .toThrow(ConfigValidationError);
  });

  it('should load config from input file directory', () => {
    writeConfig(TEST_DIR, validUserConfig);
    const inputFilePath = join(TEST_DIR, 'data.csv');
    writeFileSync(inputFilePath, 'dummy');
    const config = loadConfig({ inputFilePath });
    expect(config.locale).toBe('en_US');
  });

  it('should merge user rules with defaults by ID', () => {
    const customConfig = {
      rules: [
        { id: 'name', columns: ['customer_name'], generator: 'faker.person.firstName()' },
      ],
    };
    const configPath = writeConfig(TEST_DIR, customConfig);
    const config = loadConfig({ configPath });

    // User's 'name' rule should override default
    const nameRule = config.rules.find((r) => r.id === 'name');
    expect(nameRule?.columns).toEqual(['customer_name']);
    expect(nameRule?.generator).toBe('faker.person.firstName()');

    // Other defaults should still be present
    const cpfRule = config.rules.find((r) => r.id === 'cpf');
    expect(cpfRule).toBeDefined();
  });

  it('should override locale with --locale flag', () => {
    const config = loadConfig({ localeOverride: 'de' });
    expect(config.locale).toBe('de');
  });

  it('should override config locale with --locale flag', () => {
    const configPath = writeConfig(TEST_DIR, validUserConfig);
    const config = loadConfig({ configPath, localeOverride: 'ja' });
    expect(config.locale).toBe('ja');
  });

  it('should throw on invalid config JSON', () => {
    const configPath = join(TEST_DIR, 'bad.json');
    writeFileSync(configPath, '{ invalid json }');
    expect(() => loadConfig({ configPath })).toThrow();
  });

  it('should throw on config with duplicate rule IDs', () => {
    const badConfig = {
      rules: [
        { id: 'dup', columns: ['a'], generator: 'faker.person.fullName()' },
        { id: 'dup', columns: ['b'], generator: 'faker.person.firstName()' },
      ],
    };
    const configPath = writeConfig(TEST_DIR, badConfig);
    expect(() => loadConfig({ configPath })).toThrow(ConfigValidationError);
  });
});
