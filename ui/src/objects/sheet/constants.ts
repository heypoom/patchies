export type SheetCells = string[][];

export interface SheetNodeData {
  rows?: number;
  cols?: number;
  cells?: SheetCells;
  colWidths?: number[];
}

export const DEFAULT_SHEET_ROWS = 4;
export const DEFAULT_SHEET_COLS = 4;
export const DEFAULT_COL_WIDTH = 80;
export const MIN_COL_WIDTH = 40;

export const DEFAULT_SHEET_NODE_DATA: SheetNodeData = {
  rows: DEFAULT_SHEET_ROWS,
  cols: DEFAULT_SHEET_COLS,
  cells: [],
  colWidths: []
};
