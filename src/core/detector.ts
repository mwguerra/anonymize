import type { RuleConfig } from '../config/schema.js';
import type { Sheet, ColumnMapping } from '../io/types.js';

export function matchColumn(columnName: string, rules: RuleConfig[]): RuleConfig | null {
  const normalized = columnName.toLowerCase().trim();
  if (!normalized) return null;

  for (const rule of rules) {
    for (const pattern of rule.columns) {
      if (normalized.includes(pattern.toLowerCase().trim())) {
        return rule;
      }
    }
  }

  return null;
}

export function detectColumns(sheets: Sheet[], rules: RuleConfig[]): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];

  for (const sheet of sheets) {
    for (let i = 0; i < sheet.headers.length; i++) {
      const header = sheet.headers[i];
      const rule = matchColumn(header, rules);

      if (rule) {
        mappings.push({
          sheetName: sheet.name,
          columnIndex: i,
          columnName: header,
          ruleId: rule.id,
          generatorExpression: rule.generator,
        });
      }
    }
  }

  return mappings;
}
