export class AnonymizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnonymizeError';
  }
}

export class FileNotFoundError extends AnonymizeError {
  constructor(filePath: string) {
    super(`File not found: ${filePath}`);
    this.name = 'FileNotFoundError';
  }
}

export class UnsupportedFormatError extends AnonymizeError {
  constructor(extension: string) {
    super(
      `Unsupported file format: "${extension}". Supported formats: .csv, .xls, .xlsx`,
    );
    this.name = 'UnsupportedFormatError';
  }
}

export class EmptyFileError extends AnonymizeError {
  constructor(filePath: string) {
    super(`File is empty or contains no data rows: ${filePath}`);
    this.name = 'EmptyFileError';
  }
}

export class PasswordProtectedError extends AnonymizeError {
  constructor(filePath: string) {
    super(
      `File appears to be password-protected: ${filePath}. Password-protected files are not supported.`,
    );
    this.name = 'PasswordProtectedError';
  }
}

export class ConfigValidationError extends AnonymizeError {
  constructor(details: string) {
    super(`Invalid configuration: ${details}`);
    this.name = 'ConfigValidationError';
  }
}

export class PermissionError extends AnonymizeError {
  constructor(filePath: string) {
    super(
      `Permission denied writing to: ${filePath}. Try a different output path with --output.`,
    );
    this.name = 'PermissionError';
  }
}

export class OverwriteError extends AnonymizeError {
  constructor(filePath: string) {
    super(
      `Output file already exists: ${filePath}. Use --output to specify a different path or remove --no-overwrite.`,
    );
    this.name = 'OverwriteError';
  }
}
