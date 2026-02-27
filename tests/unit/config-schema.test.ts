import { describe, it, expect } from 'vitest';
import { configSchema } from '../../src/config/schema.js';

const validConfig = {
  locale: 'pt_BR',
  rules: [
    { id: 'name', columns: ['nome', 'name'], generator: 'faker.person.fullName()' },
    { id: 'cpf', columns: ['cpf'], generator: "faker.helpers.replaceSymbols('###.###.###-##')" },
  ],
};

describe('configSchema', () => {
  it('should accept a valid configuration', () => {
    const result = configSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('should default locale to pt_BR when omitted', () => {
    const result = configSchema.parse({ rules: validConfig.rules });
    expect(result.locale).toBe('pt_BR');
  });

  it('should reject config with no rules', () => {
    const result = configSchema.safeParse({ rules: [] });
    expect(result.success).toBe(false);
  });

  it('should reject rule with empty id', () => {
    const result = configSchema.safeParse({
      rules: [{ id: '', columns: ['nome'], generator: 'faker.person.fullName()' }],
    });
    expect(result.success).toBe(false);
  });

  it('should reject rule with empty columns array', () => {
    const result = configSchema.safeParse({
      rules: [{ id: 'name', columns: [], generator: 'faker.person.fullName()' }],
    });
    expect(result.success).toBe(false);
  });

  it('should reject rule with empty generator', () => {
    const result = configSchema.safeParse({
      rules: [{ id: 'name', columns: ['nome'], generator: '' }],
    });
    expect(result.success).toBe(false);
  });

  it('should reject duplicate rule IDs', () => {
    const result = configSchema.safeParse({
      rules: [
        { id: 'name', columns: ['nome'], generator: 'faker.person.fullName()' },
        { id: 'name', columns: ['name'], generator: 'faker.person.firstName()' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing rules field', () => {
    const result = configSchema.safeParse({ locale: 'en_US' });
    expect(result.success).toBe(false);
  });
});
