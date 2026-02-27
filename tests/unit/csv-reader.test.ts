import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { readCsv } from '../../src/io/csv-reader.js';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

describe('readCsv', () => {
  it('should read comma-delimited CSV', () => {
    const sheets = readCsv(join(FIXTURES, 'sample-comma.csv'));
    expect(sheets).toHaveLength(1);
    expect(sheets[0].name).toBe('Sheet1');
    expect(sheets[0].headers).toEqual(['nome', 'email', 'cpf']);
    expect(sheets[0].rows).toHaveLength(2);
    expect(sheets[0].rows[0][0]).toBe('José da Silva');
  });

  it('should read semicolon-delimited CSV', () => {
    const sheets = readCsv(join(FIXTURES, 'sample-semicolon.csv'));
    expect(sheets).toHaveLength(1);
    expect(sheets[0].headers).toEqual(['nome', 'email', 'cpf']);
    expect(sheets[0].rows).toHaveLength(2);
  });

  it('should read tab-delimited CSV', () => {
    const sheets = readCsv(join(FIXTURES, 'sample-tab.csv'));
    expect(sheets).toHaveLength(1);
    expect(sheets[0].headers).toEqual(['nome', 'email', 'cpf']);
    expect(sheets[0].rows).toHaveLength(2);
  });

  it('should respect explicit delimiter override', () => {
    const sheets = readCsv(join(FIXTURES, 'sample-semicolon.csv'), { delimiter: ';' });
    expect(sheets[0].headers).toEqual(['nome', 'email', 'cpf']);
  });

  it('should handle empty file gracefully', async () => {
    const { writeFileSync, unlinkSync } = await import('node:fs');
    const tmpPath = join(FIXTURES, 'empty-test.csv');
    writeFileSync(tmpPath, '');
    try {
      const sheets = readCsv(tmpPath);
      expect(sheets[0].headers).toEqual([]);
      expect(sheets[0].rows).toEqual([]);
    } finally {
      unlinkSync(tmpPath);
    }
  });
});
