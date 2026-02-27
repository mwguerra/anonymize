import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';
import { configSchema } from '../../src/config/schema.js';

describe('DEFAULT_CONFIG', () => {
  it('should pass Zod validation', () => {
    const result = configSchema.safeParse(DEFAULT_CONFIG);
    expect(result.success).toBe(true);
  });

  it('should have pt_BR as default locale', () => {
    expect(DEFAULT_CONFIG.locale).toBe('pt_BR');
  });

  it('should have all 7 default rules', () => {
    expect(DEFAULT_CONFIG.rules).toHaveLength(7);
    const ids = DEFAULT_CONFIG.rules.map((r) => r.id);
    expect(ids).toEqual(['name', 'cpf', 'cnpj', 'email', 'address', 'zipcode', 'phone']);
  });

  it('should have non-empty columns for every rule', () => {
    for (const rule of DEFAULT_CONFIG.rules) {
      expect(rule.columns.length).toBeGreaterThan(0);
    }
  });

  it('should have non-empty generator for every rule', () => {
    for (const rule of DEFAULT_CONFIG.rules) {
      expect(rule.generator.length).toBeGreaterThan(0);
    }
  });
});
