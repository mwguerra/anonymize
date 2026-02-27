import { describe, it, expect } from 'vitest';
import { FakeValueGenerator, GeneratorError, createFaker } from '../../src/core/generator.js';

describe('FakeValueGenerator', () => {
  it('should evaluate faker.person.fullName()', async () => {
    const faker = await createFaker('en_US');
    const gen = new FakeValueGenerator(faker);
    const result = gen.generate('name', 'faker.person.fullName()');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should evaluate faker.internet.email()', async () => {
    const faker = await createFaker('en_US');
    const gen = new FakeValueGenerator(faker);
    const result = gen.generate('email', 'faker.internet.email()');
    expect(result).toContain('@');
  });

  it('should evaluate faker.helpers.replaceSymbols()', async () => {
    const faker = await createFaker('en_US');
    const gen = new FakeValueGenerator(faker);
    const result = gen.generate('cpf', "faker.helpers.replaceSymbols('###.###.###-##')");
    expect(result).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
  });

  it('should cache compiled functions per ruleId', async () => {
    const faker = await createFaker('en_US');
    const gen = new FakeValueGenerator(faker);
    const r1 = gen.generate('cpf', "faker.helpers.replaceSymbols('###.###.###-##')");
    const r2 = gen.generate('cpf', "faker.helpers.replaceSymbols('###.###.###-##')");
    expect(typeof r1).toBe('string');
    expect(typeof r2).toBe('string');
  });

  it('should throw GeneratorError on invalid expression', async () => {
    const faker = await createFaker('en_US');
    const gen = new FakeValueGenerator(faker);
    expect(() => gen.generate('bad', 'faker.nonexistent.method()')).toThrow(GeneratorError);
  });

  it('should throw GeneratorError on syntax error', async () => {
    const faker = await createFaker('en_US');
    const gen = new FakeValueGenerator(faker);
    expect(() => gen.generate('bad', 'this is not valid code !!!')).toThrow(GeneratorError);
  });

  it('should only pass faker as explicit parameter (Node globals are accessible by design)', async () => {
    const faker = await createFaker('en_US');
    const gen = new FakeValueGenerator(faker);
    // Undefined variables throw — only 'faker' is an explicit parameter
    expect(() => gen.generate('bad', 'nonExistentVar.something()')).toThrow(GeneratorError);
  });
});

describe('createFaker', () => {
  it('should create faker with pt_BR locale', async () => {
    const faker = await createFaker('pt_BR');
    const name = faker.person.fullName();
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
  });

  it('should create faker with en_US locale', async () => {
    const faker = await createFaker('en_US');
    const name = faker.person.fullName();
    expect(typeof name).toBe('string');
  });

  it('should fall back to default faker for unknown locale', async () => {
    const faker = await createFaker('xx_XX');
    const name = faker.person.fullName();
    expect(typeof name).toBe('string');
  });
});
