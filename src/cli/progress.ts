import cliProgress from 'cli-progress';
import chalk from 'chalk';

export interface ProgressTracker {
  start(sheetName: string, totalRows: number): void;
  increment(): void;
  stop(): void;
}

export function createProgressTracker(silent: boolean): ProgressTracker {
  if (silent) {
    return {
      start: () => {},
      increment: () => {},
      stop: () => {},
    };
  }

  let bar: cliProgress.SingleBar | null = null;

  return {
    start(sheetName: string, totalRows: number) {
      bar = new cliProgress.SingleBar({
        format: `${chalk.cyan('Processando')} ${chalk.bold(sheetName)} ${chalk.cyan('[{bar}]')} {percentage}% ({value}/{total} linhas)`,
        barCompleteChar: '█',
        barIncompleteChar: '░',
        hideCursor: true,
      });
      bar.start(totalRows, 0);
    },

    increment() {
      bar?.increment();
    },

    stop() {
      bar?.stop();
      bar = null;
    },
  };
}
