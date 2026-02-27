import { describe, it, expect, vi } from 'vitest';
import { createProgressTracker } from '../../src/cli/progress.js';

describe('createProgressTracker', () => {
  it('should return noop tracker when silent is true', () => {
    const tracker = createProgressTracker(true);
    // Should not throw
    tracker.start('Sheet1', 100);
    tracker.increment();
    tracker.stop();
  });

  it('should return functional tracker when silent is false', () => {
    const tracker = createProgressTracker(false);
    // Ensure TTY methods exist for cli-progress (non-TTY environments lack them)
    if (!process.stdout.clearLine) {
      (process.stdout as any).clearLine = () => true;
    }
    if (!process.stdout.cursorTo) {
      (process.stdout as any).cursorTo = () => true;
    }
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    tracker.start('TestSheet', 10);
    for (let i = 0; i < 10; i++) {
      tracker.increment();
    }
    tracker.stop();

    writeSpy.mockRestore();
  });

  it('should handle calling stop without start', () => {
    const tracker = createProgressTracker(false);
    // Should not throw
    tracker.stop();
  });
});
