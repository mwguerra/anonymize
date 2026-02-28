import { mkdirSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { loadConfig, type LoadConfigOptions } from '../config/loader.js';
import { readFile } from '../io/reader.js';
import { detectColumns } from './detector.js';
import { AnonymizationCache } from './cache.js';
import { FakeValueGenerator, createFaker } from './generator.js';
import { anonymize, resolveOutputPath, type AnonymizeContext, type AnonymizeHooks } from './anonymizer.js';
import type { Sheet, ColumnMapping } from '../io/types.js';
import type { AnonymizeConfig } from '../config/schema.js';
import { Logger } from '../utils/logger.js';
import { UnsupportedFormatError } from '../utils/errors.js';

export interface MultiFileAnonymizeOptions {
  inputPaths: string[];
  outputDir: string;
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

export interface MultiFileAnonymizeResult {
  filesAnonymized: number;
  filesSkipped: number;
  totalCellsAnonymized: number;
  errors: Array<{ file: string; error: string }>;
}

export interface FileDetection {
  inputPath: string;
  sheets: Sheet[];
  mappings: ColumnMapping[];
}

export function detectAllFiles(
  inputPaths: string[],
  config: AnonymizeConfig,
  options: { encoding?: string; delimiter?: string },
): FileDetection[] {
  return inputPaths.map((inputPath) => {
    const sheets = readFile(inputPath, {
      encoding: options.encoding,
      delimiter: options.delimiter,
    });
    const mappings = detectColumns(sheets, config.rules);
    return { inputPath, sheets, mappings };
  });
}

export function buildMultiFileOutputPath(inputPath: string, outputDir: string): string {
  return resolveOutputPath(inputPath, resolve(outputDir, basename(inputPath)));
}

export async function anonymizeMultipleFiles(
  options: MultiFileAnonymizeOptions,
  hooks?: AnonymizeHooks,
): Promise<MultiFileAnonymizeResult> {
  const logger = new Logger({
    verbose: options.verbose ?? false,
    silent: options.silent ?? false,
  });

  // 1. Validate all inputs are files
  for (const inputPath of options.inputPaths) {
    const stat = statSync(inputPath);
    if (!stat.isFile()) {
      throw new UnsupportedFormatError(inputPath);
    }
  }

  // 2. Load config once
  const configOptions: LoadConfigOptions = {
    configPath: options.configPath,
    inputFilePath: options.inputPaths[0],
    localeOverride: options.locale,
  };
  const config = loadConfig(configOptions);
  logger.debug(`Config loaded with ${config.rules.length} rules, locale: ${config.locale}`);

  // 3. Read all files and detect columns
  const detections = detectAllFiles(options.inputPaths, config, {
    encoding: options.encoding,
    delimiter: options.delimiter,
  });

  const totalMappings = detections.reduce((sum, d) => sum + d.mappings.length, 0);
  logger.info(`Detected ${totalMappings} sensitive column(s) across ${detections.length} file(s)`);

  // 4. Unified confirmation (combine all sheets and mappings for display)
  let allMappings = detections.flatMap((d) =>
    d.mappings.map((m) => ({
      ...m,
      sheetName: `${basename(d.inputPath)}:${m.sheetName}`,
    })),
  );

  const allSheets: Sheet[] = detections.flatMap((d) =>
    d.sheets.map((s) => ({
      ...s,
      name: `${basename(d.inputPath)}:${s.name}`,
    })),
  );

  if (!options.dryRun && hooks?.confirm) {
    const result = await hooks.confirm(allSheets, allMappings, config.rules);
    if (result.action === 'quit') {
      return {
        filesAnonymized: 0,
        filesSkipped: detections.length,
        totalCellsAnonymized: 0,
        errors: [],
      };
    }
    allMappings = result.mappings;
  }

  // 5. Create shared cache + generator
  const cache = new AnonymizationCache();
  const faker = await createFaker(config.locale);
  const generator = new FakeValueGenerator(faker);
  const sharedContext: AnonymizeContext = { cache, generator };

  // 6. Ensure output directory exists
  if (!options.dryRun) {
    mkdirSync(resolve(options.outputDir), { recursive: true });
  }

  // 7. Process each file with shared context
  const result: MultiFileAnonymizeResult = {
    filesAnonymized: 0,
    filesSkipped: 0,
    totalCellsAnonymized: 0,
    errors: [],
  };

  for (const detection of detections) {
    // Filter mappings for this file (strip the filename prefix back out)
    const filePrefix = `${basename(detection.inputPath)}:`;
    const fileMappings = allMappings
      .filter((m) => m.sheetName.startsWith(filePrefix))
      .map((m) => ({ ...m, sheetName: m.sheetName.slice(filePrefix.length) }));

    if (fileMappings.length === 0) {
      result.filesSkipped++;
      logger.debug(`No sensitive columns in ${basename(detection.inputPath)} — skipped`);
      continue;
    }

    const outputPath = buildMultiFileOutputPath(detection.inputPath, options.outputDir);

    try {
      const fileResult = await anonymize(
        {
          inputPath: detection.inputPath,
          outputPath,
          configPath: options.configPath,
          locale: options.locale,
          encoding: options.encoding,
          delimiter: options.delimiter,
          yes: true,
          dryRun: options.dryRun,
          noOverwrite: options.noOverwrite,
          verbose: false,
          silent: true,
        },
        { progress: hooks?.progress },
        sharedContext,
      );

      if (fileResult.totalCellsAnonymized > 0 || fileResult.mappings.length > 0) {
        result.filesAnonymized++;
        result.totalCellsAnonymized += fileResult.totalCellsAnonymized;
        logger.debug(`Anonymized: ${basename(detection.inputPath)} (${fileResult.totalCellsAnonymized} cells)`);
      } else {
        result.filesSkipped++;
        logger.debug(`No sensitive columns: ${basename(detection.inputPath)} — skipped`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push({ file: basename(detection.inputPath), error: message });
      logger.warn(`Failed: ${basename(detection.inputPath)} — ${message}`);
    }
  }

  return result;
}
