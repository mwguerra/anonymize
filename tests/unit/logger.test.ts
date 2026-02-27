import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '../../src/utils/logger.js';

describe('Logger', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('default mode (verbose: false, silent: false)', () => {
    const logger = new Logger({ verbose: false, silent: false });

    it('should output error()', () => {
      logger.error('test error');
      expect(errorSpy).toHaveBeenCalledOnce();
    });

    it('should output warn()', () => {
      logger.warn('test warn');
      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it('should output info()', () => {
      logger.info('test info');
      expect(logSpy).toHaveBeenCalledOnce();
    });

    it('should NOT output debug()', () => {
      logger.debug('test debug');
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe('verbose mode', () => {
    const logger = new Logger({ verbose: true, silent: false });

    it('should output debug() in verbose mode', () => {
      logger.debug('verbose debug');
      expect(logSpy).toHaveBeenCalledOnce();
    });

    it('should output all other levels', () => {
      logger.error('e');
      logger.warn('w');
      logger.info('i');
      expect(errorSpy).toHaveBeenCalledOnce();
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(logSpy).toHaveBeenCalledOnce();
    });
  });

  describe('silent mode', () => {
    const logger = new Logger({ verbose: false, silent: true });

    it('should still output error()', () => {
      logger.error('critical');
      expect(errorSpy).toHaveBeenCalledOnce();
    });

    it('should suppress warn()', () => {
      logger.warn('suppressed');
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should suppress info()', () => {
      logger.info('suppressed');
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should suppress debug()', () => {
      logger.debug('suppressed');
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should suppress success()', () => {
      logger.success('suppressed');
      expect(logSpy).not.toHaveBeenCalled();
    });
  });
});
