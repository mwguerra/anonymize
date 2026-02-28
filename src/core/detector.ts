import type { RuleConfig, ColumnOverrides } from '../config/schema.js';
import type { Sheet, ColumnMapping } from '../io/types.js';

export interface DetectColumnsOptions {
  columnOverrides?: ColumnOverrides;
  fileContext?: string;
  identityColumnOverride?: string;
}

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

function resolveOverride(
  ruleId: string,
  sheetName: string,
  columnOverrides: ColumnOverrides,
  fileContext?: string,
): string | null {
  const overrideValue = columnOverrides[ruleId];
  if (!overrideValue) return null;

  if (typeof overrideValue === 'string') {
    return overrideValue;
  }

  // Array of { "file:sheet": "colName" }
  for (const entry of overrideValue) {
    for (const [key, colName] of Object.entries(entry)) {
      const contextKey = fileContext ? `${fileContext}:${sheetName}` : sheetName;
      if (key === contextKey) {
        return colName;
      }
    }
  }

  return null;
}

function resolveIdentityColumnIndex(
  sheet: Sheet,
  mappings: ColumnMapping[],
  identityRuleId: string,
): number | undefined {
  // Find the column index in this sheet that maps to the identity rule
  const identityMapping = mappings.find(
    (m) => m.sheetName === sheet.name && m.ruleId === identityRuleId,
  );
  if (identityMapping) return identityMapping.columnIndex;

  // Also check raw headers for unmapped columns matching the ruleId as column name
  const idx = sheet.headers.findIndex(
    (h) => h.toLowerCase().trim() === identityRuleId.toLowerCase(),
  );
  return idx >= 0 ? idx : undefined;
}

export function detectColumns(
  sheets: Sheet[],
  rules: RuleConfig[],
  options?: DetectColumnsOptions,
): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];
  const columnOverrides = options?.columnOverrides;

  for (const sheet of sheets) {
    // Track which column indices are already matched by overrides
    const overrideMatchedIndices = new Set<number>();

    // Phase 1: Apply column overrides (highest priority)
    if (columnOverrides) {
      for (const rule of rules) {
        const overrideColName = resolveOverride(
          rule.id,
          sheet.name,
          columnOverrides,
          options?.fileContext,
        );
        if (!overrideColName) continue;

        const colIdx = sheet.headers.findIndex(
          (h) => h.toLowerCase().trim() === overrideColName.toLowerCase().trim(),
        );
        if (colIdx >= 0) {
          mappings.push({
            sheetName: sheet.name,
            columnIndex: colIdx,
            columnName: sheet.headers[colIdx],
            ruleId: rule.id,
            generatorExpression: rule.generator,
          });
          overrideMatchedIndices.add(colIdx);
        }
      }
    }

    // Phase 2: Pattern matching for remaining columns
    for (let i = 0; i < sheet.headers.length; i++) {
      if (overrideMatchedIndices.has(i)) continue;

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

  // Phase 3: Resolve identity column indices
  const globalIdentityOverride = options?.identityColumnOverride;

  for (const mapping of mappings) {
    const rule = rules.find((r) => r.id === mapping.ruleId);
    const identityRuleId = globalIdentityOverride ?? rule?.identityColumn;

    if (identityRuleId && identityRuleId !== mapping.ruleId) {
      const sheet = sheets.find((s) => s.name === mapping.sheetName);
      if (sheet) {
        mapping.identityColumnIndex = resolveIdentityColumnIndex(
          sheet,
          mappings,
          identityRuleId,
        );
      }
    }
  }

  return mappings;
}
