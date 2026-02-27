import { describe, it, expect } from 'vitest';
import { matchColumn, detectColumns } from '../../src/core/detector.js';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';
import type { Sheet } from '../../src/io/types.js';

const rules = DEFAULT_CONFIG.rules;

describe('matchColumn', () => {
  it('should match exact column name', () => {
    expect(matchColumn('nome', rules)?.id).toBe('name');
    expect(matchColumn('cpf', rules)?.id).toBe('cpf');
    expect(matchColumn('email', rules)?.id).toBe('email');
  });

  it('should match case-insensitively', () => {
    expect(matchColumn('NOME', rules)?.id).toBe('name');
    expect(matchColumn('CPF', rules)?.id).toBe('cpf');
    expect(matchColumn('Email', rules)?.id).toBe('email');
  });

  it('should match partial/substring patterns', () => {
    expect(matchColumn('Nome Completo', rules)?.id).toBe('name');
    expect(matchColumn('CPF do Cliente', rules)?.id).toBe('cpf');
    expect(matchColumn('E-mail do Contato', rules)?.id).toBe('email');
  });

  it('should trim whitespace', () => {
    expect(matchColumn('  nome  ', rules)?.id).toBe('name');
  });

  it('should return null for unmatched columns', () => {
    expect(matchColumn('observacoes', rules)).toBeNull();
    expect(matchColumn('id', rules)).toBeNull();
    expect(matchColumn('valor_total', rules)).toBeNull();
  });

  it('should return null for empty column name', () => {
    expect(matchColumn('', rules)).toBeNull();
    expect(matchColumn('   ', rules)).toBeNull();
  });
});

describe('detectColumns', () => {
  it('should detect columns across multiple sheets', () => {
    const sheets: Sheet[] = [
      { name: 'Plan1', headers: ['Nome Completo', 'CPF Cliente', 'Observações'], rows: [] },
      { name: 'Plan2', headers: ['E-mail', 'Telefone'], rows: [] },
    ];

    const mappings = detectColumns(sheets, rules);

    expect(mappings).toHaveLength(4);
    expect(mappings[0]).toEqual(expect.objectContaining({ sheetName: 'Plan1', columnName: 'Nome Completo', ruleId: 'name' }));
    expect(mappings[1]).toEqual(expect.objectContaining({ sheetName: 'Plan1', columnName: 'CPF Cliente', ruleId: 'cpf' }));
    expect(mappings[2]).toEqual(expect.objectContaining({ sheetName: 'Plan2', columnName: 'E-mail', ruleId: 'email' }));
    expect(mappings[3]).toEqual(expect.objectContaining({ sheetName: 'Plan2', columnName: 'Telefone', ruleId: 'phone' }));
  });

  it('should handle sheets with no sensitive columns', () => {
    const sheets: Sheet[] = [
      { name: 'Data', headers: ['id', 'valor', 'status'], rows: [] },
    ];
    const mappings = detectColumns(sheets, rules);
    expect(mappings).toHaveLength(0);
  });

  it('should include correct column indices', () => {
    const sheets: Sheet[] = [
      { name: 'S1', headers: ['id', 'nome', 'cpf', 'status'], rows: [] },
    ];
    const mappings = detectColumns(sheets, rules);
    expect(mappings[0].columnIndex).toBe(1); // nome
    expect(mappings[1].columnIndex).toBe(2); // cpf
  });
});
