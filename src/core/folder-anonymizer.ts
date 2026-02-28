import { readdirSync, statSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, relative, extname, resolve } from 'node:path';
import { anonymize, type AnonymizeOptions, type AnonymizeResult } from './anonymizer.js';
import { Logger } from '../utils/logger.js';

const SUPPORTED_EXTENSIONS = new Set(['.csv', '.xls', '.xlsx']);

export interface FolderAnonymizeOptions {
  inputDir: string;
  outputDir: string;
  configPath?: string;
  locale?: string;
  encoding?: string;
  delimiter?: string;
  dryRun?: boolean;
  noOverwrite?: boolean;
  verbose?: boolean;
  silent?: boolean;
}

export interface FolderAnonymizeResult {
  filesAnonymized: number;
  filesCopied: number;
  filesSkipped: number;
  totalCellsAnonymized: number;
  errors: Array<{ file: string; error: string }>;
}

function walkDir(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function isSupportedFile(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extname(filePath).toLowerCase());
}

export async function anonymizeFolder(options: FolderAnonymizeOptions): Promise<FolderAnonymizeResult> {
  const logger = new Logger({
    verbose: options.verbose ?? false,
    silent: options.silent ?? false,
  });

  const inputDir = resolve(options.inputDir);
  const outputDir = resolve(options.outputDir);

  const allFiles = walkDir(inputDir);
  logger.info(`Found ${allFiles.length} file(s) in ${inputDir}`);

  const result: FolderAnonymizeResult = {
    filesAnonymized: 0,
    filesCopied: 0,
    filesSkipped: 0,
    totalCellsAnonymized: 0,
    errors: [],
  };

  for (const filePath of allFiles) {
    const relPath = relative(inputDir, filePath);
    const outputPath = join(outputDir, relPath);
    const outputParent = join(outputPath, '..');

    mkdirSync(outputParent, { recursive: true });

    if (!isSupportedFile(filePath)) {
      if (!options.dryRun) {
        copyFileSync(filePath, outputPath);
      }
      result.filesCopied++;
      logger.debug(`Copied: ${relPath}`);
      continue;
    }

    try {
      const fileOptions: AnonymizeOptions = {
        inputPath: filePath,
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
      };

      const fileResult = await anonymize(fileOptions);

      if (fileResult.totalCellsAnonymized > 0 || fileResult.mappings.length > 0) {
        result.filesAnonymized++;
        result.totalCellsAnonymized += fileResult.totalCellsAnonymized;
        logger.debug(`Anonymized: ${relPath} (${fileResult.totalCellsAnonymized} cells)`);
      } else {
        result.filesSkipped++;
        if (!options.dryRun) {
          copyFileSync(filePath, outputPath);
        }
        logger.debug(`No sensitive columns: ${relPath} (copied as-is)`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push({ file: relPath, error: message });
      logger.warn(`Failed: ${relPath} — ${message}`);
    }
  }

  return result;
}
