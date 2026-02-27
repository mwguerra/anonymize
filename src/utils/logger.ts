import chalk from 'chalk';

export interface LoggerOptions {
  verbose: boolean;
  silent: boolean;
}

export class Logger {
  constructor(private readonly options: LoggerOptions) {}

  error(message: string, ...args: unknown[]): void {
    console.error(chalk.red(`[ERROR] ${message}`), ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.options.silent) return;
    console.warn(chalk.yellow(`[WARN] ${message}`), ...args);
  }

  info(message: string, ...args: unknown[]): void {
    if (this.options.silent) return;
    console.log(chalk.blue(`[INFO] ${message}`), ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    if (!this.options.verbose || this.options.silent) return;
    console.log(chalk.gray(`[DEBUG] ${message}`), ...args);
  }

  success(message: string, ...args: unknown[]): void {
    if (this.options.silent) return;
    console.log(chalk.green(message), ...args);
  }
}
