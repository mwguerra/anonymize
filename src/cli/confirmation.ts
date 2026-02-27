import { input, select } from '@inquirer/prompts';
import type { ColumnMapping } from '../io/types.js';
import type { Sheet } from '../io/types.js';
import type { RuleConfig } from '../config/schema.js';
import type { ColumnDisplayRow } from './table-display.js';

export type ConfirmAction = 'proceed' | 'edit' | 'quit';

export async function confirmDetection(): Promise<ConfirmAction> {
  const answer = await select({
    message: 'Prosseguir com a anonimização?',
    choices: [
      { value: 'proceed' as const, name: 'Sim, anonimizar' },
      { value: 'edit' as const, name: 'Não, editar colunas' },
      { value: 'quit' as const, name: 'Cancelar' },
    ],
  });
  return answer;
}

export async function editMappings(
  displayRows: ColumnDisplayRow[],
  rules: RuleConfig[],
  sheets: Sheet[],
): Promise<ColumnMapping[]> {
  const updatedRows = [...displayRows];

  let editing = true;
  while (editing) {
    const columnChoices = updatedRows.map((row, idx) => ({
      value: idx,
      name: `${row.sheetName} → ${row.columnName} [${row.action === 'anonymize' ? `Regra: ${row.ruleId}` : 'Ignorar'}]`,
    }));

    const selectedIdx = await select({
      message: 'Selecione uma coluna para alterar:',
      choices: [
        ...columnChoices,
        { value: -1 as number, name: '✓ Concluir edição' },
      ],
    });

    if (selectedIdx === -1) {
      editing = false;
      continue;
    }

    const row = updatedRows[selectedIdx];

    if (row.action === 'anonymize') {
      const action = await select({
        message: `${row.columnName} (${row.ruleId}):`,
        choices: [
          { value: 'change-rule', name: 'Alterar regra' },
          { value: 'remove', name: 'Remover anonimização' },
          { value: 'cancel', name: 'Voltar' },
        ],
      });

      if (action === 'remove') {
        row.action = 'ignore';
        row.ruleId = null;
      } else if (action === 'change-rule') {
        const ruleId = await selectRule(rules);
        if (ruleId) {
          row.ruleId = ruleId;
        }
      }
    } else {
      const action = await select({
        message: `${row.columnName} (ignorada):`,
        choices: [
          { value: 'add', name: 'Adicionar anonimização' },
          { value: 'cancel', name: 'Voltar' },
        ],
      });

      if (action === 'add') {
        const ruleId = await selectRule(rules);
        if (ruleId) {
          row.action = 'anonymize';
          row.ruleId = ruleId;
        }
      }
    }
  }

  // Convert back to ColumnMapping[]
  const newMappings: ColumnMapping[] = [];

  for (const row of updatedRows) {
    if (row.action !== 'anonymize' || !row.ruleId) continue;

    const rule = rules.find((r) => r.id === row.ruleId);
    if (!rule) continue;

    const sheet = sheets.find((s) => s.name === row.sheetName);
    if (!sheet) continue;

    const colIdx = sheet.headers.indexOf(row.columnName);
    if (colIdx === -1) continue;

    newMappings.push({
      sheetName: row.sheetName,
      columnIndex: colIdx,
      columnName: row.columnName,
      ruleId: rule.id,
      generatorExpression: rule.generator,
    });
  }

  return newMappings;
}

async function selectRule(rules: RuleConfig[]): Promise<string | null> {
  const ruleId = await select({
    message: 'Selecione a regra:',
    choices: [
      ...rules.map((r) => ({
        value: r.id,
        name: `${r.id} (colunas: ${r.columns.join(', ')})`,
      })),
      { value: '', name: 'Cancelar' },
    ],
  });
  return ruleId || null;
}
