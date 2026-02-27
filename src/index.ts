import chalk from 'chalk';
import { createProgram, parseOptions } from './cli/commands.js';
import { anonymize, type AnonymizeHooks, type ConfirmResult } from './core/anonymizer.js';
import { AnonymizeError } from './utils/errors.js';
import { GeneratorError } from './core/generator.js';
import { buildDisplayRows, renderDetectionTable } from './cli/table-display.js';
import { confirmDetection, editMappings } from './cli/confirmation.js';
import { createProgressTracker } from './cli/progress.js';
import type { Sheet, ColumnMapping } from './io/types.js';
import type { RuleConfig } from './config/schema.js';

const program = createProgram();

program.action(async () => {
  const options = parseOptions(program);

  try {
    const hooks: AnonymizeHooks = {};

    // Interactive confirmation (unless --yes, --dry-run, or --silent)
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

    // Progress bar (unless --silent)
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
  } catch (error) {
    if (error instanceof AnonymizeError || error instanceof GeneratorError) {
      console.error(chalk.red(`\nError: ${error.message}`));
      process.exit(1);
    }
    throw error;
  }
});

program.parse();
