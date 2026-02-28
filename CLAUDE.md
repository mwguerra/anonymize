# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@mwguerra/anonymize` — A TypeScript CLI for deterministic anonymization of personal data in XLS, XLSX, and CSV files. Detects sensitive columns by name, confirms with the user, and replaces values consistently across all occurrences within an execution (same original value → same fake value everywhere, including across sheets).

Full PRD: `docs/prd.md`

## Tech Stack

- **Runtime:** Node.js ≥ 18
- **Language:** TypeScript 5.x (strict mode)
- **Build:** tsup (ESM, dependencies externalized)
- **Spreadsheets:** xlsx (SheetJS Community Edition)
- **CSV:** papaparse
- **Fake data:** @faker-js/faker
- **CLI:** commander + inquirer + chalk + cli-table3 + cli-progress
- **Encoding detection:** chardet
- **Config validation:** zod

## Common Commands

```bash
# Install dependencies
npm install

# Build
npm run build          # tsup bundles ESM to dist/ (deps externalized)

# Run locally (dev)
npx tsx src/index.ts run ./file.xlsx

# Run built CLI
node dist/index.js run ./file.xlsx

# Tests (Vitest)
npm test               # vitest run (single pass)
npm run test:watch     # vitest watch mode
npx vitest run <path>  # run a single test file

# Lint (ESLint 9 + typescript-eslint flat config)
npm run lint
npm run lint:fix
```

## Architecture

```
src/
├── index.ts              # CLI entry point — thin registrar: creates program, registers commands, calls parse()
├── commands/
│   ├── run.ts            # `anonymize run <paths...>` — anonymize file(s) or a directory
│   ├── inspect.ts        # `anonymize inspect <file>` — show detected columns without modifying
│   ├── config-init.ts    # `anonymize config:init` — scaffold .anonymizerc.json from defaults
│   └── config-show.ts    # `anonymize config:show` — display resolved configuration
├── cli/
│   ├── shared-options.ts # Reusable option helpers: addFileInputOptions (variadic), addSingleFileInputOptions, addOutputOptions, addVerbosityOptions
│   ├── confirmation.ts   # inquirer interactive prompts (column confirmation/editing)
│   ├── table-display.ts  # cli-table3 detection table rendering
│   └── progress.ts       # cli-progress bar during processing
├── core/
│   ├── anonymizer.ts     # Main orchestrator: reads → detects → confirms → anonymizes → writes
│   ├── detector.ts       # Matches column names against config rules (case-insensitive partial match)
│   ├── cache.ts          # Global Map<ruleId, Map<originalValue, fakeValue>> — cross-sheet consistency
│   ├── anonymize-cell.ts # Cell-level anonymization with cache lookup + collision retry
│   ├── generator.ts      # faker wrapper + eval of generator expressions from config
│   ├── folder-anonymizer.ts # Recursive folder anonymization: walks tree, anonymizes supported files, copies the rest
│   └── multi-file-anonymizer.ts # Multi-file anonymization with shared cache for cross-file consistency
├── io/
│   ├── reader.ts         # Unified file reader (CSV via papaparse, XLS/XLSX via SheetJS)
│   ├── writer.ts         # Unified file writer — preserves structure, formatting, sheet order
│   └── types.ts          # Internal types: Sheet, Row, Cell, ColumnMapping
├── config/
│   ├── loader.ts         # Config resolution: --config flag > local .anonymizerc.json > home dir > defaults
│   ├── defaults.ts       # Built-in default rules (name, cpf, cnpj, email, address, phone, zipcode)
│   └── schema.ts         # Zod schema for config validation
└── utils/
    ├── logger.ts         # Logger respecting --verbose / --silent flags
    └── errors.ts         # Custom error classes
```

## Key Design Decisions

- **Deterministic cache is per-execution, not persisted.** The global cache (`Map<ruleId, Map<original, fake>>`) ensures the same original value always maps to the same fake value within a single run, across all sheets. It is never written to disk.
- **Generator expressions are evaluated at runtime** via `new Function()` with only `faker` in scope. This allows user-defined rules in `.anonymizerc.json` but carries eval risk — document accordingly.
- **Column detection** is name-based. Matches column header names against `rule.columns` patterns — case-insensitive, partial match (substring). `columnOverrides` in config can explicitly map rule IDs to column names with file:sheet specificity (priority: overrides > pattern matching).
- **Config precedence:** `--config` flag → `.anonymizerc.json` in input file's directory → `.anonymizerc.json` in `$HOME` → built-in defaults.
- **Never modify the original file.** Output goes to `<name>.anonymized.<ext>` by default.
- **Collision handling:** If faker generates a value already mapped to a different original, retry up to 10 times, then use the last attempt with a warning.
- **Folder anonymization** walks the input tree file-by-file (not copy-then-modify). Supported files (.csv, .xls, .xlsx) are anonymized to the output directory; unsupported files are copied as-is. Files with no detected sensitive columns are also copied unchanged. `--output` is required for directory input.
- **Multi-file anonymization** shares a single `AnonymizationCache` and `FakeValueGenerator` across all files, so the same original value maps to the same fake value regardless of which file it appears in. `--output` (directory) is required for multi-file mode. Cannot mix files and directories.
- **Identity-based grouping** allows differentiating same-name entries by an identity column (e.g., CPF). With `identityColumn` set, the cache key becomes `identityValue::originalValue` instead of just `originalValue`. Configured per-rule in config or globally via `--identity-column` CLI flag. Identity values are pre-read from each row before any cell modification.

## CLI Commands

| Command | Purpose |
|---|---|
| `anonymize run <paths...>` | Anonymize file(s) or a directory (main command) |
| `anonymize inspect <file>` | Show detected columns without modifying anything |
| `anonymize config:init` | Scaffold `.anonymizerc.json` in current directory |
| `anonymize config:show` | Display resolved configuration |

## CLI Flags Reference (`run`)

| Flag | Alias | Default |
|---|---|---|
| `--output` | `-o` | `<input>.anonymized.<ext>` |
| `--config` | `-c` | Auto-detect |
| `--yes` | `-y` | `false` (skip interactive confirmation) |
| `--dry-run` | `-d` | `false` (show plan, no file changes) |
| `--encoding` | `-e` | Auto-detect |
| `--delimiter` | | Auto-detect |
| `--locale` | `-l` | `pt_BR` |
| `--identity-column` | | `undefined` (group anonymization by identity rule) |
| `--no-overwrite` | | `false` |
| `--verbose` | `-v` | `false` |
| `--silent` | `-s` | `false` |

## Security Constraints

- Never log original data values (only column names and counters in verbose mode).
- Generator eval scope is restricted to `faker` object only.
- Never overwrite the source file.
- Never persist the mapping cache to disk.
