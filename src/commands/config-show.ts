import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../config/loader.js';
import { AnonymizeError } from '../utils/errors.js';

export function registerConfigShowCommand(program: Command): void {
  const cmd = program
    .command('config:show')
    .description('Display the resolved configuration (respects precedence chain)')
    .option('-c, --config <path>', 'Configuration file path')
    .option('-l, --locale <locale>', 'Override faker locale');

  cmd.action(() => {
    const opts = cmd.opts();

    try {
      const config = loadConfig({
        configPath: opts.config,
        localeOverride: opts.locale,
      });

      console.log(JSON.stringify(config, null, 2));
    } catch (error) {
      if (error instanceof AnonymizeError) {
        console.error(chalk.red(`\nError: ${error.message}`));
        process.exit(1);
      }
      throw error;
    }
  });
}
