import { Command } from 'commander';
import { writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import chalk from 'chalk';
import { DEFAULT_CONFIG } from '../config/defaults.js';

export function registerConfigInitCommand(program: Command): void {
  const cmd = program
    .command('config:init')
    .description('Scaffold .anonymizerc.json in the current directory from defaults')
    .option('-f, --force', 'Overwrite existing .anonymizerc.json', false);

  cmd.action(() => {
    const opts = cmd.opts();
    const dest = resolve('.anonymizerc.json');

    if (existsSync(dest) && !opts.force) {
      console.error(chalk.red(`\nError: ${dest} already exists. Use --force to overwrite.`));
      process.exit(1);
    }

    writeFileSync(dest, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n', 'utf-8');
    console.log(chalk.green(`\nCreated ${dest}`));
    console.log('Edit the file to customize anonymization rules.');
  });
}
