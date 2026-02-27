import { describe, it, expect } from 'vitest';
import {
  AnonymizeError,
  FileNotFoundError,
  UnsupportedFormatError,
  EmptyFileError,
  PasswordProtectedError,
  ConfigValidationError,
  PermissionError,
  OverwriteError,
} from '../../src/utils/errors.js';

describe('custom error classes', () => {
  it('FileNotFoundError includes file path', () => {
    const err = new FileNotFoundError('/tmp/missing.csv');
    expect(err).toBeInstanceOf(AnonymizeError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('FileNotFoundError');
    expect(err.message).toContain('/tmp/missing.csv');
  });

  it('UnsupportedFormatError lists supported formats', () => {
    const err = new UnsupportedFormatError('.json');
    expect(err).toBeInstanceOf(AnonymizeError);
    expect(err.name).toBe('UnsupportedFormatError');
    expect(err.message).toContain('.json');
    expect(err.message).toContain('.csv');
    expect(err.message).toContain('.xls');
    expect(err.message).toContain('.xlsx');
  });

  it('EmptyFileError includes file path', () => {
    const err = new EmptyFileError('/tmp/empty.xlsx');
    expect(err).toBeInstanceOf(AnonymizeError);
    expect(err.name).toBe('EmptyFileError');
    expect(err.message).toContain('/tmp/empty.xlsx');
  });

  it('PasswordProtectedError includes file path', () => {
    const err = new PasswordProtectedError('/tmp/locked.xlsx');
    expect(err).toBeInstanceOf(AnonymizeError);
    expect(err.name).toBe('PasswordProtectedError');
    expect(err.message).toContain('/tmp/locked.xlsx');
  });

  it('ConfigValidationError includes validation details', () => {
    const err = new ConfigValidationError('rules[0].columns must be non-empty');
    expect(err).toBeInstanceOf(AnonymizeError);
    expect(err.name).toBe('ConfigValidationError');
    expect(err.message).toContain('rules[0].columns must be non-empty');
  });

  it('PermissionError suggests --output flag', () => {
    const err = new PermissionError('/protected/output.csv');
    expect(err).toBeInstanceOf(AnonymizeError);
    expect(err.name).toBe('PermissionError');
    expect(err.message).toContain('--output');
  });

  it('OverwriteError mentions --no-overwrite', () => {
    const err = new OverwriteError('/tmp/exists.csv');
    expect(err).toBeInstanceOf(AnonymizeError);
    expect(err.name).toBe('OverwriteError');
    expect(err.message).toContain('--no-overwrite');
  });
});
