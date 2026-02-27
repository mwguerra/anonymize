import Table from 'cli-table3';
import chalk from 'chalk';
import type { ColumnMapping } from '../io/types.js';
import type { Sheet } from '../io/types.js';

export interface ColumnDisplayRow {
  sheetName: string;
  columnName: string;
  ruleId: string | null;
  action: 'anonymize' | 'ignore';
}

export function buildDisplayRows(
  sheets: Sheet[],
  mappings: ColumnMapping[],
): ColumnDisplayRow[] {
  const mapped = new Set(mappings.map((m) => `${m.sheetName}::${m.columnIndex}`));
  const rows: ColumnDisplayRow[] = [];

  for (const sheet of sheets) {
    for (let i = 0; i < sheet.headers.length; i++) {
      const key = `${sheet.name}::${i}`;
      const mapping = mappings.find(
        (m) => m.sheetName === sheet.name && m.columnIndex === i,
      );

      rows.push({
        sheetName: sheet.name,
        columnName: sheet.headers[i],
        ruleId: mapping ? mapping.ruleId : null,
        action: mapped.has(key) ? 'anonymize' : 'ignore',
      });
    }
  }

  return rows;
}

export function renderDetectionTable(displayRows: ColumnDisplayRow[]): string {
  const table = new Table({
    head: [
      chalk.bold('Aba'),
      chalk.bold('Coluna'),
      chalk.bold('Regra'),
      chalk.bold('Ação'),
    ],
    style: { head: [], border: [] },
  });

  for (const row of displayRows) {
    table.push([
      row.sheetName,
      row.columnName,
      row.ruleId ?? '—',
      row.action === 'anonymize'
        ? chalk.green('Anonimizar')
        : chalk.gray('Ignorar'),
    ]);
  }

  return table.toString();
}
