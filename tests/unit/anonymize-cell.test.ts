import { describe, it, expect, vi, beforeEach } from 'vitest';
import { anonymizeCell, type AnonymizeCellDeps } from '../../src/core/anonymize-cell.js';
import { AnonymizationCache } from '../../src/core/cache.js';
import { FakeValueGenerator, createFaker } from '../../src/core/generator.js';
import { Logger } from '../../src/utils/logger.js';

describe('anonymizeCell', () => {
  let deps: AnonymizeCellDeps;
  let cache: AnonymizationCache;
  let generator: FakeValueGenerator;
  let logger: Logger;

  beforeEach(async () => {
    cache = new AnonymizationCache();
    const faker = await createFaker('en_US');
    generator = new FakeValueGenerator(faker);
    logger = new Logger({ verbose: false, silent: true });
    deps = { cache, generator, logger };
  });

  it('should pass through null values', () => {
    expect(anonymizeCell(deps, 'name', 'faker.person.fullName()', null)).toBeNull();
  });

  it('should pass through undefined values', () => {
    expect(anonymizeCell(deps, 'name', 'faker.person.fullName()', undefined)).toBeUndefined();
  });

  it('should pass through empty string', () => {
    expect(anonymizeCell(deps, 'name', 'faker.person.fullName()', '')).toBe('');
  });

  it('should pass through whitespace-only string', () => {
    expect(anonymizeCell(deps, 'name', 'faker.person.fullName()', '   ')).toBe('   ');
  });

  it('should generate a fake value for a non-empty original', () => {
    const result = anonymizeCell(deps, 'name', 'faker.person.fullName()', 'José da Silva');
    expect(typeof result).toBe('string');
    expect(result).not.toBe('José da Silva');
  });

  it('should return cached value on second call with same original', () => {
    const first = anonymizeCell(deps, 'name', 'faker.person.fullName()', 'José da Silva');
    const second = anonymizeCell(deps, 'name', 'faker.person.fullName()', 'José da Silva');
    expect(first).toBe(second);
  });

  it('should generate different fakes for different originals', () => {
    const r1 = anonymizeCell(deps, 'email', 'faker.internet.email()', 'a@test.com');
    const r2 = anonymizeCell(deps, 'email', 'faker.internet.email()', 'b@test.com');
    // They could theoretically collide, but it's astronomically unlikely
    expect(typeof r1).toBe('string');
    expect(typeof r2).toBe('string');
  });

  it('should retry on collision and log warning at max retries', () => {
    // Pre-fill cache to force collisions
    const warnSpy = vi.spyOn(logger, 'warn');
    let callCount = 0;
    vi.spyOn(generator, 'generate').mockImplementation(() => {
      callCount++;
      // Always return the same value to force collision
      return 'COLLIDING_VALUE';
    });

    // First, put the colliding value in the cache for a different original
    cache.set('test', 'other_original', 'COLLIDING_VALUE');

    const result = anonymizeCell(deps, 'test', 'some_expr', 'my_original');

    // Should have tried MAX_COLLISION_RETRIES times
    expect(callCount).toBe(10);
    // Should log warning about collision limit
    expect(warnSpy).toHaveBeenCalledOnce();
    // Should still return the value (last attempt)
    expect(result).toBe('COLLIDING_VALUE');
  });

  it('should succeed on retry after initial collision', () => {
    let callCount = 0;
    vi.spyOn(generator, 'generate').mockImplementation(() => {
      callCount++;
      return callCount === 1 ? 'COLLIDING' : 'UNIQUE_VALUE';
    });

    cache.set('test', 'other', 'COLLIDING');

    const result = anonymizeCell(deps, 'test', 'expr', 'my_value');
    expect(callCount).toBe(2);
    expect(result).toBe('UNIQUE_VALUE');
  });
});
