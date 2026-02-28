import { Command } from 'commander';
import { statSync } from 'node:fs';
import chalk from 'chalk';
import { addFileInputOptions, addOutputOptions, addVerbosityOptions } from '../cli/shared-options.js';
import { anonymize, type AnonymizeOptions, type AnonymizeHooks, type ConfirmResult } from '../core/anonymizer.js';
import { anonymizeFolder, type FolderAnonymizeOptions } from '../core/folder-anonymizer.js';
import { anonymizeMultipleFiles, type MultiFileAnonymizeOptions } from '../core/multi-file-anonymizer.js';
import { AnonymizeError } from '../utils/errors.js';
import { GeneratorError } from '../core/generator.js';
import { buildDisplayRows, renderDetectionTable } from '../cli/table-display.js';
import { confirmDetection, editMappings } from '../cli/confirmation.js';
import { createProgressTracker } from '../cli/progress.js';
import type { Sheet, ColumnMapping } from '../io/types.js';
import type { RuleConfig } from '../config/schema.js';

function parseRunOptions(cmd: Command): AnonymizeOptions {
  const opts = cmd.opts();
  const inputPath = cmd.args[0];

  return {
    inputPath,
    outputPath: opts.output,
    configPath: opts.config,
    locale: opts.locale,
    encoding: opts.encoding,
    delimiter: opts.delimiter,
    yes: opts.yes,
    dryRun: opts.dryRun,
    noOverwrite: !opts.overwrite,
    verbose: opts.verbose,
    silent: opts.silent,
  };
}

function parseFolderOptions(cmd: Command): FolderAnonymizeOptions {
  const opts = cmd.opts();
  const inputDir = cmd.args[0];

  return {
    inputDir,
    outputDir: opts.output,
    configPath: opts.config,
    locale: opts.locale,
    encoding: opts.encoding,
    delimiter: opts.delimiter,
    dryRun: opts.dryRun,
    noOverwrite: !opts.overwrite,
    verbose: opts.verbose,
    silent: opts.silent,
  };
}

function parseMultiFileOptions(cmd: Command): MultiFileAnonymizeOptions {
  const opts = cmd.opts();
  const inputPaths = cmd.args;

  return {
    inputPaths,
    outputDir: opts.output,
    configPath: opts.config,
    locale: opts.locale,
    encoding: opts.encoding,
    delimiter: opts.delimiter,
    yes: opts.yes,
    dryRun: opts.dryRun,
    noOverwrite: !opts.overwrite,
    verbose: opts.verbose,
    silent: opts.silent,
  };
}

async function runFile(options: AnonymizeOptions): Promise<void> {
  const hooks: AnonymizeHooks = {};

  if (!options.yes && !options.dryRun && !options.silent) {
    hooks.confirm = async (
      sheets: Sheet[],
      mappings: ColumnMapping[],
      rules: RuleConfig[],
    ): Promise<ConfirmResult> => {
      const displayRows = buildDisplayRows(sheets, mappings);
      console.log(chalk.bold('\nDetected columns:'));
      console.log(renderDetectionTable(displayRows));

      let currentMappings = mappings;
      let confirmed = false;

      while (!confirmed) {
        const action = await confirmDetection();

        if (action === 'quit') {
          console.log(chalk.yellow('\nAborted.'));
          return { action: 'quit' };
        }

        if (action === 'edit') {
          currentMappings = await editMappings(displayRows, rules, sheets);
          const updatedRows = buildDisplayRows(sheets, currentMappings);
          console.log(chalk.bold('\nUpdated columns:'));
          console.log(renderDetectionTable(updatedRows));
          continue;
        }

        confirmed = true;
      }

      return { action: 'proceed', mappings: currentMappings };
    };
  }

  if (!options.silent && !options.dryRun) {
    hooks.progress = createProgressTracker(false);
  }

  const result = await anonymize(options, hooks);

  if (options.dryRun) {
    if (!options.silent) {
      console.log(chalk.yellow('\n[DRY RUN] Anonymization plan:'));
      console.log(`  Sheets: ${result.sheetsProcessed}`);
      console.log(`  Columns to anonymize: ${result.mappings.length}`);
      for (const m of result.mappings) {
        console.log(`    - ${m.sheetName} → "${m.columnName}" (rule: ${m.ruleId})`);
      }
      console.log('\nNo files were modified.');
    }
    return;
  }

  if (!options.silent && result.outputPath) {
    console.log(chalk.green('\nAnonymization complete!'));
    console.log(`  Output: ${result.outputPath}`);
    console.log(`  Sheets processed: ${result.sheetsProcessed}`);
    console.log(`  Cells anonymized: ${result.totalCellsAnonymized}`);
    if (Object.keys(result.uniqueValuesPerRule).length > 0) {
      console.log('  Unique values per rule:');
      for (const [rule, count] of Object.entries(result.uniqueValuesPerRule)) {
        console.log(`    - ${rule}: ${count}`);
      }
    }
  }
}

async function runFolder(options: FolderAnonymizeOptions): Promise<void> {
  if (!options.outputDir) {
    console.error(chalk.red('\nError: --output is required when input is a directory.'));
    process.exit(1);
  }

  const result = await anonymizeFolder(options);

  if (!options.silent) {
    if (options.dryRun) {
      console.log(chalk.yellow('\n[DRY RUN] Folder anonymization plan:'));
    } else {
      console.log(chalk.green('\nFolder anonymization complete!'));
    }
    console.log(`  Files anonymized: ${result.filesAnonymized}`);
    console.log(`  Files copied (unsupported format): ${result.filesCopied}`);
    if (result.filesSkipped > 0) {
      console.log(`  Files copied (no sensitive columns): ${result.filesSkipped}`);
    }
    console.log(`  Total cells anonymized: ${result.totalCellsAnonymized}`);
    if (result.errors.length > 0) {
      console.log(chalk.yellow(`  Errors: ${result.errors.length}`));
      for (const e of result.errors) {
        console.log(chalk.red(`    - ${e.file}: ${e.error}`));
      }
    }
  }
}

async function runMultiFile(options: MultiFileAnonymizeOptions): Promise<void> {
  if (!options.outputDir) {
    console.error(chalk.red('\nError: --output is required when processing multiple files.'));
    process.exit(1);
  }

  const hooks: AnonymizeHooks = {};

  if (!options.yes && !options.dryRun && !options.silent) {
    hooks.confirm = async (
      sheets: Sheet[],
      mappings: ColumnMapping[],
      rules: RuleConfig[],
    ): Promise<ConfirmResult> => {
      const displayRows = buildDisplayRows(sheets, mappings);
      console.log(chalk.bold('\nDetected columns across all files:'));
      console.log(renderDetectionTable(displayRows));

      let currentMappings = mappings;
      let confirmed = false;

      while (!confirmed) {
        const action = await confirmDetection();

        if (action === 'quit') {
          console.log(chalk.yellow('\nAborted.'));
          return { action: 'quit' };
        }

        if (action === 'edit') {
          currentMappings = await editMappings(displayRows, rules, sheets);
          const updatedRows = buildDisplayRows(sheets, currentMappings);
          console.log(chalk.bold('\nUpdated columns:'));
          console.log(renderDetectionTable(updatedRows));
          continue;
        }

        confirmed = true;
      }

      return { action: 'proceed', mappings: currentMappings };
    };
  }

  if (!options.silent && !options.dryRun) {
    hooks.progress = createProgressTracker(false);
  }

  const result = await anonymizeMultipleFiles(options, hooks);

  if (!options.silent) {
    if (options.dryRun) {
      console.log(chalk.yellow('\n[DRY RUN] Multi-file anonymization plan:'));
    } else {
      console.log(chalk.green('\nMulti-file anonymization complete!'));
    }
    console.log(`  Files anonymized: ${result.filesAnonymized}`);
    if (result.filesSkipped > 0) {
      console.log(`  Files skipped (no sensitive columns): ${result.filesSkipped}`);
    }
    console.log(`  Total cells anonymized: ${result.totalCellsAnonymized}`);
    if (result.errors.length > 0) {
      console.log(chalk.yellow(`  Errors: ${result.errors.length}`));
      for (const e of result.errors) {
        console.log(chalk.red(`    - ${e.file}: ${e.error}`));
      }
    }
  }
}

export function registerRunCommand(program: Command): void {
  const cmd = program
    .command('run')
    .description('Anonymize file(s) or a directory — detects sensitive columns and replaces values');

  addFileInputOptions(cmd);
  addOutputOptions(cmd);
  addVerbosityOptions(cmd);

  cmd
    .option('-y, --yes', 'Skip interactive confirmation', false)
    .option('-d, --dry-run', 'Show anonymization plan without modifying files', false);

  cmd.action(async () => {
    const paths = cmd.args;

    try {
      if (paths.length > 1) {
        // Multi-file mode: validate no directories are mixed in
        for (const p of paths) {
          const stat = statSync(p);
          if (stat.isDirectory()) {
            console.error(chalk.red('\nError: Cannot mix files and directories. Pass either multiple files or a single directory.'));
            process.exit(1);
          }
        }
        await runMultiFile(parseMultiFileOptions(cmd));
      } else {
        const stat = statSync(paths[0]);

        if (stat.isDirectory()) {
          await runFolder(parseFolderOptions(cmd));
        } else {
          await runFile(parseRunOptions(cmd));
        }
      }
    } catch (error) {
      if (error instanceof AnonymizeError || error instanceof GeneratorError) {
        console.error(chalk.red(`\nError: ${error.message}`));
        process.exit(1);
      }
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.error(chalk.red(`\nError: Path not found: ${paths[0]}`));
        process.exit(1);
      }
      throw error;
    }
  });
}
