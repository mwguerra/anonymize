import { z } from 'zod';

export const ruleSchema = z.object({
  id: z.string().min(1),
  columns: z.array(z.string().min(1)).min(1),
  generator: z.string().min(1),
});

export const configSchema = z.object({
  locale: z.string().min(1).optional().default('pt_BR'),
  rules: z.array(ruleSchema).min(1).refine(
    (rules) => {
      const ids = rules.map((r) => r.id);
      return new Set(ids).size === ids.length;
    },
    { message: 'Rule IDs must be unique' },
  ),
});

export type RuleConfig = z.infer<typeof ruleSchema>;
export type AnonymizeConfig = z.infer<typeof configSchema>;
