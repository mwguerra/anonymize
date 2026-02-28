export type CellValue = string | number | boolean | null | undefined;

export interface Sheet {
  name: string;
  headers: string[];
  rows: CellValue[][];
}

export interface ColumnMapping {
  sheetName: string;
  columnIndex: number;
  columnName: string;
  ruleId: string;
  generatorExpression: string;
  identityColumnIndex?: number;
}
