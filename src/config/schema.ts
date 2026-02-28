import { z } from 'zod';

export const ruleSchema = z.object({
  id: z.string().min(1),
  columns: z.array(z.string().min(1)).min(1),
  generator: z.string().min(1),
  identityColumn: z.string().min(1).optional(),
});

// columnOverrides value per rule: string (all files) or array of { "file:sheet": "colName" }
const columnOverrideEntry = z.record(z.string().min(1), z.string().min(1)).refine(
  (obj) => Object.keys(obj).length === 1,
  { message: 'Each column override entry must have exactly one file:sheet key' },
);
const columnOverrideValue = z.union([
  z.string().min(1),
  z.array(columnOverrideEntry).min(1),
]);

export const configSchema = z.object({
  locale: z.string().min(1).optional().default('pt_BR'),
  rules: z.array(ruleSchema).min(1).refine(
    (rules) => {
      const ids = rules.map((r) => r.id);
      return new Set(ids).size === ids.length;
    },
    { message: 'Rule IDs must be unique' },
  ),
  columnOverrides: z.record(z.string().min(1), columnOverrideValue).optional(),
});

export type RuleConfig = z.infer<typeof ruleSchema>;
export type AnonymizeConfig = z.infer<typeof configSchema>;
export type ColumnOverrides = z.infer<typeof configSchema>['columnOverrides'];
