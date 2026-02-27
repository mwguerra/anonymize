import { describe, it, expect } from 'vitest';
import type { ColumnMapping } from '../../src/io/types.js';
import type { Sheet } from '../../src/io/types.js';
import type { ColumnDisplayRow } from '../../src/cli/table-display.js';
import { buildDisplayRows } from '../../src/cli/table-display.js';

// We test the data transformation logic, not the interactive prompts themselves.
// The editMappings and confirmDetection functions require TTY and are verified manually.

describe('confirmation data flow', () => {
  const sheets: Sheet[] = [
    {
      name: 'Plan1',
      headers: ['nome', 'cpf', 'email', 'cidade'],
      rows: [['José', '111.111.111-11', 'jose@test.com', 'São Paulo']],
    },
  ];

  const mappings: ColumnMapping[] = [
    { sheetName: 'Plan1', columnIndex: 0, columnName: 'nome', ruleId: 'name', generatorExpression: 'faker.person.fullName()' },
    { sheetName: 'Plan1', columnIndex: 1, columnName: 'cpf', ruleId: 'cpf', generatorExpression: 'faker.number.int({min:10000000000,max:99999999999}).toString()' },
    { sheetName: 'Plan1', columnIndex: 2, columnName: 'email', ruleId: 'email', generatorExpression: 'faker.internet.email()' },
  ];

  it('should build correct display rows from sheets and mappings', () => {
    const rows = buildDisplayRows(sheets, mappings);

    expect(rows).toHaveLength(4);
    expect(rows.filter(r => r.action === 'anonymize')).toHaveLength(3);
    expect(rows.filter(r => r.action === 'ignore')).toHaveLength(1);
  });

  it('should show correct rule assignments', () => {
    const rows = buildDisplayRows(sheets, mappings);

    const nomeRow = rows.find(r => r.columnName === 'nome')!;
    expect(nomeRow.ruleId).toBe('name');
    expect(nomeRow.action).toBe('anonymize');

    const cidadeRow = rows.find(r => r.columnName === 'cidade')!;
    expect(cidadeRow.ruleId).toBeNull();
    expect(cidadeRow.action).toBe('ignore');
  });

  it('should handle empty mappings (no columns detected)', () => {
    const rows = buildDisplayRows(sheets, []);
    expect(rows).toHaveLength(4);
    expect(rows.every(r => r.action === 'ignore')).toBe(true);
  });

  it('should simulate toggle anonymize → ignore', () => {
    const rows = buildDisplayRows(sheets, mappings);
    const nomeRow = rows.find(r => r.columnName === 'nome')!;

    // Simulate removing anonymization
    nomeRow.action = 'ignore';
    nomeRow.ruleId = null;

    expect(nomeRow.action).toBe('ignore');
    expect(rows.filter(r => r.action === 'anonymize')).toHaveLength(2);
  });

  it('should simulate toggle ignore → anonymize', () => {
    const rows = buildDisplayRows(sheets, mappings);
    const cidadeRow = rows.find(r => r.columnName === 'cidade')!;

    // Simulate adding anonymization
    cidadeRow.action = 'anonymize';
    cidadeRow.ruleId = 'address';

    expect(cidadeRow.action).toBe('anonymize');
    expect(rows.filter(r => r.action === 'anonymize')).toHaveLength(4);
  });
});
