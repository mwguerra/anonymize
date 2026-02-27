import { describe, it, expect, beforeEach } from 'vitest';
import { AnonymizationCache } from '../../src/core/cache.js';

describe('AnonymizationCache', () => {
  let cache: AnonymizationCache;

  beforeEach(() => {
    cache = new AnonymizationCache();
  });

  it('should return undefined for unknown entries', () => {
    expect(cache.get('cpf', '123.456.789-00')).toBeUndefined();
  });

  it('should store and retrieve values', () => {
    cache.set('cpf', '123.456.789-00', '987.654.321-00');
    expect(cache.get('cpf', '123.456.789-00')).toBe('987.654.321-00');
  });

  it('should check existence with has()', () => {
    expect(cache.has('cpf', '123.456.789-00')).toBe(false);
    cache.set('cpf', '123.456.789-00', '987.654.321-00');
    expect(cache.has('cpf', '123.456.789-00')).toBe(true);
  });

  it('should isolate rules from each other', () => {
    cache.set('cpf', 'original', 'fake-cpf');
    cache.set('name', 'original', 'fake-name');

    expect(cache.get('cpf', 'original')).toBe('fake-cpf');
    expect(cache.get('name', 'original')).toBe('fake-name');
  });

  it('should detect collision with hasValue()', () => {
    cache.set('cpf', '111.111.111-11', '999.999.999-99');
    expect(cache.hasValue('cpf', '999.999.999-99')).toBe(true);
    expect(cache.hasValue('cpf', '888.888.888-88')).toBe(false);
  });

  it('should not detect collision across different rules', () => {
    cache.set('cpf', '111.111.111-11', 'same-value');
    expect(cache.hasValue('name', 'same-value')).toBe(false);
  });

  it('should return false for hasValue on empty rule', () => {
    expect(cache.hasValue('nonexistent', 'anything')).toBe(false);
  });

  it('should report size per rule', () => {
    expect(cache.size('cpf')).toBe(0);
    cache.set('cpf', 'a', 'x');
    cache.set('cpf', 'b', 'y');
    expect(cache.size('cpf')).toBe(2);
  });

  it('should list rule IDs', () => {
    cache.set('cpf', 'a', 'x');
    cache.set('name', 'b', 'y');
    expect(cache.ruleIds()).toEqual(expect.arrayContaining(['cpf', 'name']));
  });

  it('should clear all data', () => {
    cache.set('cpf', 'a', 'x');
    cache.set('name', 'b', 'y');
    cache.clear();
    expect(cache.get('cpf', 'a')).toBeUndefined();
    expect(cache.get('name', 'b')).toBeUndefined();
    expect(cache.ruleIds()).toEqual([]);
  });
});
