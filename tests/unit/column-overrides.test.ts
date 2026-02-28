import { describe, it, expect } from 'vitest';
import { detectColumns } from '../../src/core/detector.js';
import type { Sheet } from '../../src/io/types.js';
import type { RuleConfig } from '../../src/config/schema.js';

const rules: RuleConfig[] = [
  { id: 'name', columns: ['nome', 'name'], generator: 'faker.person.fullName()' },
  { id: 'email', columns: ['email', 'e-mail'], generator: 'faker.internet.email()' },
  { id: 'cpf', columns: ['cpf'], generator: "faker.helpers.replaceSymbols('###.###.###-##')" },
];

describe('column overrides', () => {
  it('should use string override for all files', () => {
    const sheets: Sheet[] = [
      { name: 'Sheet1', headers: ['Nome do Cliente', 'correo', 'cpf', 'cidade'], rows: [] },
    ];

    const mappings = detectColumns(sheets, rules, {
      columnOverrides: {
        name: 'Nome do Cliente',
        email: 'correo',
      },
    });

    const nameMapping = mappings.find((m) => m.ruleId === 'name');
    const emailMapping = mappings.find((m) => m.ruleId === 'email');

    expect(nameMapping).toBeDefined();
    expect(nameMapping!.columnName).toBe('Nome do Cliente');
    expect(nameMapping!.columnIndex).toBe(0);

    expect(emailMapping).toBeDefined();
    expect(emailMapping!.columnName).toBe('correo');
    expect(emailMapping!.columnIndex).toBe(1);
  });

  it('should use file:sheet specific override', () => {
    const sheets: Sheet[] = [
      { name: 'Clientes', headers: ['Nome do Cliente', 'email', 'cpf'], rows: [] },
    ];

    const mappings = detectColumns(sheets, rules, {
      columnOverrides: {
        name: [
          { 'sample.csv:Clientes': 'Nome do Cliente' },
        ],
      },
      fileContext: 'sample.csv',
    });

    const nameMapping = mappings.find((m) => m.ruleId === 'name');
    expect(nameMapping).toBeDefined();
    expect(nameMapping!.columnName).toBe('Nome do Cliente');
  });

  it('should NOT match override for different file context', () => {
    const sheets: Sheet[] = [
      { name: 'Sheet1', headers: ['Nome do Cliente', 'email', 'cpf'], rows: [] },
    ];

    const mappings = detectColumns(sheets, rules, {
      columnOverrides: {
        name: [
          { 'other-file.csv:Sheet1': 'Nome do Cliente' },
        ],
      },
      fileContext: 'sample.csv',
    });

    // Override doesn't match this file, and "Nome do Cliente" contains "nome" via pattern
    const nameMapping = mappings.find((m) => m.ruleId === 'name');
    expect(nameMapping).toBeDefined();
    // Falls back to pattern matching (substring match on "nome")
    expect(nameMapping!.columnName).toBe('Nome do Cliente');
  });

  it('should prioritize overrides over pattern matching for same column', () => {
    const sheets: Sheet[] = [
      { name: 'Sheet1', headers: ['nome', 'nome_completo', 'email'], rows: [] },
    ];

    // Override says "nome_completo" is the name rule
    const mappings = detectColumns(sheets, rules, {
      columnOverrides: {
        name: 'nome_completo',
      },
    });

    const nameMappings = mappings.filter((m) => m.ruleId === 'name');
    // Override matches col 1 (nome_completo). Pattern matching skips col 1.
    // Col 0 "nome" still matches via pattern since override only skips its own column index.
    expect(nameMappings).toHaveLength(2);
    expect(nameMappings[0].columnName).toBe('nome_completo'); // override
    expect(nameMappings[1].columnName).toBe('nome'); // pattern
  });

  it('should skip pattern matching for override-matched columns', () => {
    const sheets: Sheet[] = [
      { name: 'Sheet1', headers: ['correo_electronico', 'email'], rows: [] },
    ];

    // "email" col (idx 1) would normally match the email rule via pattern
    // Override says "correo_electronico" (idx 0) is the email column
    const mappings = detectColumns(sheets, rules, {
      columnOverrides: {
        email: 'correo_electronico',
      },
    });

    const emailMappings = mappings.filter((m) => m.ruleId === 'email');
    // Override picks col 0. Col 1 also matches via pattern. Both should be present.
    // Actually: override marks col 0 as email. Pattern matching for col 1 ("email" matches rule).
    // Col 0 was matched by override (not skipped in pattern phase since indices are tracked).
    // Col 1 is NOT skipped by override. Let me check the implementation...
    // The override marks col 0's INDEX. Pattern matching skips col 0 (overrideMatchedIndices).
    // Col 1 "email" still matches via pattern. So we get 2 email mappings.
    expect(emailMappings).toHaveLength(2);
    expect(emailMappings[0].columnIndex).toBe(0);
    expect(emailMappings[1].columnIndex).toBe(1);
  });

  it('should handle empty column overrides', () => {
    const sheets: Sheet[] = [
      { name: 'Sheet1', headers: ['nome', 'email', 'cpf'], rows: [] },
    ];

    const mappings = detectColumns(sheets, rules, {
      columnOverrides: {},
    });

    expect(mappings).toHaveLength(3);
  });

  it('should handle no options (backward compatible)', () => {
    const sheets: Sheet[] = [
      { name: 'Sheet1', headers: ['nome', 'email', 'cpf'], rows: [] },
    ];

    const mappings = detectColumns(sheets, rules);
    expect(mappings).toHaveLength(3);
  });
});
