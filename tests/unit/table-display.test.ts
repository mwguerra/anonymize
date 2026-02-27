import { describe, it, expect } from 'vitest';
import { buildDisplayRows, renderDetectionTable, type ColumnDisplayRow } from '../../src/cli/table-display.js';
import type { Sheet, ColumnMapping } from '../../src/io/types.js';

describe('buildDisplayRows', () => {
  const sheets: Sheet[] = [
    {
      name: 'Sheet1',
      headers: ['nome', 'email', 'cidade', 'valor'],
      rows: [],
    },
  ];

  const mappings: ColumnMapping[] = [
    { sheetName: 'Sheet1', columnIndex: 0, columnName: 'nome', ruleId: 'name', generatorExpression: 'faker.person.fullName()' },
    { sheetName: 'Sheet1', columnIndex: 1, columnName: 'email', ruleId: 'email', generatorExpression: 'faker.internet.email()' },
  ];

  it('should mark matched columns as anonymize', () => {
    const rows = buildDisplayRows(sheets, mappings);
    const nameRow = rows.find(r => r.columnName === 'nome');
    expect(nameRow?.action).toBe('anonymize');
    expect(nameRow?.ruleId).toBe('name');
  });

  it('should mark unmatched columns as ignore', () => {
    const rows = buildDisplayRows(sheets, mappings);
    const cidadeRow = rows.find(r => r.columnName === 'cidade');
    expect(cidadeRow?.action).toBe('ignore');
    expect(cidadeRow?.ruleId).toBeNull();
  });

  it('should include all columns from all sheets', () => {
    const rows = buildDisplayRows(sheets, mappings);
    expect(rows).toHaveLength(4);
  });

  it('should handle multiple sheets', () => {
    const multiSheets: Sheet[] = [
      { name: 'S1', headers: ['nome'], rows: [] },
      { name: 'S2', headers: ['email'], rows: [] },
    ];
    const multiMappings: ColumnMapping[] = [
      { sheetName: 'S1', columnIndex: 0, columnName: 'nome', ruleId: 'name', generatorExpression: 'faker.person.fullName()' },
    ];
    const rows = buildDisplayRows(multiSheets, multiMappings);
    expect(rows).toHaveLength(2);
    expect(rows[0].action).toBe('anonymize');
    expect(rows[1].action).toBe('ignore');
  });
});

describe('renderDetectionTable', () => {
  it('should render a table string', () => {
    const rows: ColumnDisplayRow[] = [
      { sheetName: 'Sheet1', columnName: 'nome', ruleId: 'name', action: 'anonymize' },
      { sheetName: 'Sheet1', columnName: 'valor', ruleId: null, action: 'ignore' },
    ];

    const output = renderDetectionTable(rows);
    expect(output).toContain('Sheet1');
    expect(output).toContain('nome');
    expect(output).toContain('name');
    expect(output).toContain('valor');
    expect(output).toContain('—');
  });
});
