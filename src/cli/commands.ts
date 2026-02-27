import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AnonymizeOptions } from '../core/anonymizer.js';

const pkgPath = join(fileURLToPath(import.meta.url), '..', '..', '..', 'package.json');
let version = '1.0.0';
try {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  version = pkg.version;
} catch { /* use default */ }

export function createProgram(): Command {
  const program = new Command();

  program
    .name('anonymize')
    .description('CLI para anonimização determinística de dados pessoais em arquivos XLS, XLSX e CSV')
    .version(version)
    .argument('<file>', 'Input file path (.csv, .xls, .xlsx)')
    .option('-o, --output <path>', 'Output file path')
    .option('-c, --config <path>', 'Configuration file path')
    .option('-y, --yes', 'Skip interactive confirmation', false)
    .option('-d, --dry-run', 'Show anonymization plan without modifying files', false)
    .option('-e, --encoding <encoding>', 'Force CSV encoding (overrides auto-detection)')
    .option('--delimiter <char>', 'Force CSV delimiter (overrides auto-detection)')
    .option('-l, --locale <locale>', 'Override faker locale', undefined)
    .option('--no-overwrite', 'Fail if output file already exists')
    .option('-v, --verbose', 'Show detailed logs', false)
    .option('-s, --silent', 'Suppress all output except errors', false);

  return program;
}

export function parseOptions(program: Command): AnonymizeOptions {
  const opts = program.opts();
  const inputPath = program.args[0];

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
