import { Command } from 'commander';
import chalk from 'chalk';
import { addFileInputOptions, addVerbosityOptions } from '../cli/shared-options.js';
import { loadConfig } from '../config/loader.js';
import { readFile } from '../io/reader.js';
import { detectColumns } from '../core/detector.js';
import { buildDisplayRows, renderDetectionTable } from '../cli/table-display.js';
import { AnonymizeError } from '../utils/errors.js';

export function registerInspectCommand(program: Command): void {
  const cmd = program
    .command('inspect')
    .description('Show detected sensitive columns without modifying anything');

  addFileInputOptions(cmd);
  addVerbosityOptions(cmd);

  cmd.action(async () => {
    const opts = cmd.opts();
    const inputPath = cmd.args[0];

    try {
      const config = loadConfig({
        configPath: opts.config,
        inputFilePath: inputPath,
        localeOverride: opts.locale,
      });

      const sheets = readFile(inputPath, {
        encoding: opts.encoding,
        delimiter: opts.delimiter,
      });

      const mappings = detectColumns(sheets, config.rules);
      const displayRows = buildDisplayRows(sheets, mappings);

      if (!opts.silent) {
        console.log(chalk.bold('\nDetected columns:'));
        console.log(renderDetectionTable(displayRows));
        console.log(`\n  Sheets: ${sheets.length}`);
        console.log(`  Columns to anonymize: ${mappings.length}`);
        for (const m of mappings) {
          console.log(`    - ${m.sheetName} → "${m.columnName}" (rule: ${m.ruleId})`);
        }
      }
    } catch (error) {
      if (error instanceof AnonymizeError) {
        console.error(chalk.red(`\nError: ${error.message}`));
        process.exit(1);
      }
      throw error;
    }
  });
}
