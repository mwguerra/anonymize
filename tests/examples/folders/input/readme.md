# Folder Test Fixtures

Test fixtures for folder-based (recursive) anonymization. Each file is a copy of the base fixtures from `tests/examples/single_files/input/`, prefixed to indicate its location in the hierarchy.

## Prefix Convention

| Prefix | Meaning |
|---|---|
| `r_` | Root level (no folder nesting) |
| `f_1_` | Level 1 — direct child folder |
| `f_2_` | Level 2 — subfolder |
| `f_3_` | Level 3 — nested subfolder |

## Structure

```
input/
├── r_*.{csv,xls,xlsx}                          # root level
├── readme.md
├── root_folder_1/                              # level 1
│   ├── f_1_*.{csv,xls,xlsx}
│   ├── sub_folder_1/                           # level 2
│   │   └── f_2_*.{csv,xls,xlsx}
│   └── sub_folder_2/                           # level 2
│       ├── f_2_*.{csv,xls,xlsx}
│       └── nested_folder/                      # level 3
│           └── f_3_*.{csv,xls,xlsx}
└── root_folder_2/                              # level 1
    └── f_1_*.{csv,xls,xlsx}
```

Each folder contains the same 8 base files (dupes.csv, headers-only.xlsx, multi-sheet.xlsx, sample-comma.csv, sample-semicolon.csv, sample-tab.csv, sample.xls, sample.xlsx).
