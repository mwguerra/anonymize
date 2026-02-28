import type { Command } from 'commander';

export function addFileInputOptions(cmd: Command): Command {
  return cmd
    .argument('<paths...>', 'Input file(s) (.csv, .xls, .xlsx) or a single directory')
    .option('-e, --encoding <encoding>', 'Force CSV encoding (overrides auto-detection)')
    .option('--delimiter <char>', 'Force CSV delimiter (overrides auto-detection)')
    .option('-c, --config <path>', 'Configuration file path')
    .option('-l, --locale <locale>', 'Override faker locale')
    .option('--identity-column <ruleId>', 'Group anonymization by identity column (references a rule ID, e.g. "cpf")');
}

export function addSingleFileInputOptions(cmd: Command): Command {
  return cmd
    .argument('<path>', 'Input file (.csv, .xls, .xlsx)')
    .option('-e, --encoding <encoding>', 'Force CSV encoding (overrides auto-detection)')
    .option('--delimiter <char>', 'Force CSV delimiter (overrides auto-detection)')
    .option('-c, --config <path>', 'Configuration file path')
    .option('-l, --locale <locale>', 'Override faker locale');
}

export function addOutputOptions(cmd: Command): Command {
  return cmd
    .option('-o, --output <path>', 'Output file path')
    .option('--no-overwrite', 'Fail if output file already exists');
}

export function addVerbosityOptions(cmd: Command): Command {
  return cmd
    .option('-v, --verbose', 'Show detailed logs', false)
    .option('-s, --silent', 'Suppress all output except errors', false);
}
