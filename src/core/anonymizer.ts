import { existsSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { loadConfig, type LoadConfigOptions } from '../config/loader.js';
import { readFile } from '../io/reader.js';
import { writeFile } from '../io/writer.js';
import type { Sheet, ColumnMapping } from '../io/types.js';
import { detectColumns } from './detector.js';
import { AnonymizationCache } from './cache.js';
import { FakeValueGenerator, createFaker } from './generator.js';
import { anonymizeCell, type AnonymizeCellDeps } from './anonymize-cell.js';
import { OverwriteError } from '../utils/errors.js';
import { Logger } from '../utils/logger.js';
import type { ProgressTracker } from '../cli/progress.js';
import type { RuleConfig } from '../config/schema.js';

export interface AnonymizeOptions {
  inputPath: string;
  outputPath?: string;
  configPath?: string;
  locale?: string;
  encoding?: string;
  delimiter?: string;
  yes?: boolean;
  dryRun?: boolean;
  noOverwrite?: boolean;
  verbose?: boolean;
  silent?: boolean;
}

export type ConfirmResult =
  | { action: 'proceed'; mappings: ColumnMapping[] }
  | { action: 'quit' };

export type ConfirmFn = (
  sheets: Sheet[],
  mappings: ColumnMapping[],
  rules: RuleConfig[],
) => Promise<ConfirmResult>;

export interface AnonymizeHooks {
  confirm?: ConfirmFn;
  progress?: ProgressTracker;
}

export interface AnonymizeContext {
  cache: AnonymizationCache;
  generator: FakeValueGenerator;
}

export interface AnonymizeResult {
  outputPath: string;
  totalCellsAnonymized: number;
  uniqueValuesPerRule: Record<string, number>;
  sheetsProcessed: number;
  mappings: ColumnMapping[];
}

export function resolveOutputPath(inputPath: string, outputOverride?: string): string {
  if (outputOverride) return resolve(outputOverride);

  const dir = dirname(inputPath);
  const ext = extname(inputPath);
  const base = basename(inputPath, ext);
  return join(dir, `${base}.anonymized${ext}`);
}

export async function anonymize(options: AnonymizeOptions, hooks?: AnonymizeHooks, context?: AnonymizeContext): Promise<AnonymizeResult> {
  const logger = new Logger({
    verbose: options.verbose ?? false,
    silent: options.silent ?? false,
  });

  // 1. Load config
  const configOptions: LoadConfigOptions = {
    configPath: options.configPath,
    inputFilePath: options.inputPath,
    localeOverride: options.locale,
  };
  const config = loadConfig(configOptions);
  logger.debug(`Config loaded with ${config.rules.length} rules, locale: ${config.locale}`);

  // 2. Read input file
  const sheets = readFile(options.inputPath, {
    encoding: options.encoding,
    delimiter: options.delimiter,
  });
  logger.info(`Read ${sheets.length} sheet(s) from ${options.inputPath}`);

  // 3. Detect sensitive columns
  let mappings = detectColumns(sheets, config.rules);
  logger.info(`Detected ${mappings.length} sensitive column(s)`);

  // 4. Dry run — return early
  if (options.dryRun) {
    return {
      outputPath: '',
      totalCellsAnonymized: 0,
      uniqueValuesPerRule: {},
      sheetsProcessed: sheets.length,
      mappings,
    };
  }

  // 4b. Interactive confirmation
  if (hooks?.confirm) {
    const result = await hooks.confirm(sheets, mappings, config.rules);
    if (result.action === 'quit') {
      return {
        outputPath: '',
        totalCellsAnonymized: 0,
        uniqueValuesPerRule: {},
        sheetsProcessed: sheets.length,
        mappings: [],
      };
    }
    mappings = result.mappings;
  }

  if (mappings.length === 0) {
    logger.warn('No sensitive columns detected. No anonymization performed.');
    return {
      outputPath: '',
      totalCellsAnonymized: 0,
      uniqueValuesPerRule: {},
      sheetsProcessed: sheets.length,
      mappings: [],
    };
  }

  // 5. Resolve output path
  const outputPath = resolveOutputPath(options.inputPath, options.outputPath);
  if (resolve(outputPath) === resolve(options.inputPath)) {
    throw new OverwriteError(options.inputPath);
  }
  if (options.noOverwrite && existsSync(outputPath)) {
    throw new OverwriteError(outputPath);
  }

  // 6. Initialize cache and generator (use shared context if provided)
  const cache = context?.cache ?? new AnonymizationCache();
  const generator = context?.generator ?? new FakeValueGenerator(await createFaker(config.locale));
  const deps: AnonymizeCellDeps = { cache, generator, logger };

  // 7. Build lookup for quick column matching
  const mappingsBySheet = new Map<string, ColumnMapping[]>();
  for (const m of mappings) {
    if (!mappingsBySheet.has(m.sheetName)) {
      mappingsBySheet.set(m.sheetName, []);
    }
    mappingsBySheet.get(m.sheetName)!.push(m);
  }

  // 8. Process sheets
  let totalCellsAnonymized = 0;
  const progress = hooks?.progress;

  for (const sheet of sheets) {
    const sheetMappings = mappingsBySheet.get(sheet.name);
    if (!sheetMappings) continue;

    logger.debug(`Processing sheet "${sheet.name}": ${sheet.rows.length} rows, ${sheetMappings.length} columns`);
    progress?.start(sheet.name, sheet.rows.length);

    for (const row of sheet.rows) {
      for (const mapping of sheetMappings) {
        const original = row[mapping.columnIndex];
        if (original === null || original === undefined) continue;

        const originalStr = String(original);
        const fake = anonymizeCell(deps, mapping.ruleId, mapping.generatorExpression, originalStr);
        if (fake !== originalStr) {
          row[mapping.columnIndex] = fake;
          totalCellsAnonymized++;
        }
      }
      progress?.increment();
    }

    progress?.stop();
  }

  // 9. Write output
  writeFile(outputPath, sheets, { delimiter: options.delimiter });
  logger.info(`Output written to ${outputPath}`);

  // 10. Build summary
  const uniqueValuesPerRule: Record<string, number> = {};
  for (const ruleId of cache.ruleIds()) {
    uniqueValuesPerRule[ruleId] = cache.size(ruleId);
  }

  return {
    outputPath,
    totalCellsAnonymized,
    uniqueValuesPerRule,
    sheetsProcessed: sheets.length,
    mappings,
  };
}
