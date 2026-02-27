import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerRunCommand } from './commands/run.js';
import { registerInspectCommand } from './commands/inspect.js';
import { registerConfigInitCommand } from './commands/config-init.js';
import { registerConfigShowCommand } from './commands/config-show.js';

const pkgPath = join(fileURLToPath(import.meta.url), '..', '..', 'package.json');
let version = '1.0.0';
try {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  version = pkg.version;
} catch { /* use default */ }

const program = new Command();

program
  .name('anonymize')
  .description('CLI para anonimização determinística de dados pessoais em arquivos XLS, XLSX e CSV')
  .version(version);

registerRunCommand(program);
registerInspectCommand(program);
registerConfigInitCommand(program);
registerConfigShowCommand(program);

program.parse();
