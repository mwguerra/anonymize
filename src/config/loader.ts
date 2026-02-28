import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { configSchema, type AnonymizeConfig, type RuleConfig } from './schema.js';
import { DEFAULT_CONFIG } from './defaults.js';
import { ConfigValidationError } from '../utils/errors.js';

export interface LoadConfigOptions {
  configPath?: string;
  inputFilePath?: string;
  localeOverride?: string;
}

function readJsonFile(filePath: string): unknown {
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function findConfigFile(inputFilePath?: string): string | null {
  const candidates: string[] = [];

  if (inputFilePath) {
    candidates.push(resolve(dirname(inputFilePath), '.anonymizerc.json'));
  }

  candidates.push(resolve(homedir(), '.anonymizerc.json'));

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function mergeRules(defaults: RuleConfig[], overrides: RuleConfig[]): RuleConfig[] {
  const merged = new Map<string, RuleConfig>();

  for (const rule of defaults) {
    merged.set(rule.id, rule);
  }

  for (const rule of overrides) {
    merged.set(rule.id, rule);
  }

  return [...merged.values()];
}

export function loadConfig(options: LoadConfigOptions): AnonymizeConfig {
  let rawConfig: unknown = null;
  let configSource = 'defaults';

  // Precedence: --config flag > input dir > home dir > defaults
  if (options.configPath) {
    if (!existsSync(options.configPath)) {
      throw new ConfigValidationError(`Config file not found: ${options.configPath}`);
    }
    rawConfig = readJsonFile(options.configPath);
    configSource = options.configPath;
  } else {
    const found = findConfigFile(options.inputFilePath);
    if (found) {
      rawConfig = readJsonFile(found);
      configSource = found;
    }
  }

  let config: AnonymizeConfig;

  if (rawConfig) {
    const result = configSchema.safeParse(rawConfig);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new ConfigValidationError(`${configSource}: ${issues}`);
    }

    // Merge user rules with defaults (user rules override by ID)
    config = {
      locale: result.data.locale,
      rules: mergeRules(DEFAULT_CONFIG.rules, result.data.rules),
      columnOverrides: result.data.columnOverrides,
    };
  } else {
    config = { ...DEFAULT_CONFIG };
  }

  // --locale flag overrides config locale
  if (options.localeOverride) {
    config.locale = options.localeOverride;
  }

  return config;
}
