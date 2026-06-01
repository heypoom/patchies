export type SheetCell = string | number | boolean | null;

export type SheetData = {
  columns: string[];
  rows: SheetCell[][];
  outputRows?: boolean;
  allowResize?: boolean;
  showFooter?: boolean;
  autoFitHeight?: boolean;
  width?: number;
  height?: number;
  columnWidths?: number[];
};

export type ParsedCsvTable = Pick<SheetData, 'columns' | 'rows'>;

const EMPTY_PARSED_TABLE: ParsedCsvTable = { columns: [], rows: [] };
const DEFAULT_INSERTED_COLUMN_WIDTH = 110;

export function ensureUniqueColumnKeys(columns: string[]): string[] {
  const seen = new Map<string, number>();

  return columns.map((column, index) => {
    const trimmed = column.trim();
    const base = trimmed.length > 0 ? trimmed : `column_${index + 1}`;
    const count = seen.get(base) ?? 0;

    seen.set(base, count + 1);

    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

export const buildSheetOutput = (data: SheetData): SheetCell[][] | Record<string, SheetCell>[] =>
  data.outputRows ? buildSheetRowsOutput(data) : buildSheetObjectsOutput(data);

export const buildSheetRowsOutput = (data: SheetData): SheetCell[][] => [
  data.columns,
  ...data.rows
];

export function buildSheetObjectsOutput(data: SheetData): Record<string, SheetCell>[] {
  const keys = ensureUniqueColumnKeys(data.columns);

  return data.rows.map((row) => {
    const object: Record<string, SheetCell> = {};

    keys.forEach((key, index) => {
      object[key] = row[index] ?? null;
    });

    return object;
  });
}

export const createEmptySheet = (): SheetData => ({
  columns: ['column 1', 'column 2'],
  rows: [
    ['', ''],
    ['', '']
  ],
  outputRows: false,
  allowResize: true,
  showFooter: true,
  autoFitHeight: true
});

export const addColumn = (data: SheetData): SheetData => insertColumn(data, data.columns.length);

export function insertColumn(data: SheetData, index: number): SheetData {
  const insertIndex = Math.max(0, Math.min(data.columns.length, index));
  const nextIndex = data.columns.length + 1;

  return {
    ...data,
    columns: [
      ...data.columns.slice(0, insertIndex),
      `column ${nextIndex}`,
      ...data.columns.slice(insertIndex)
    ],
    rows: data.rows.map((row) => [...row.slice(0, insertIndex), '', ...row.slice(insertIndex)]),
    columnWidths: data.columnWidths
      ? [
          ...data.columnWidths.slice(0, insertIndex),
          DEFAULT_INSERTED_COLUMN_WIDTH,
          ...data.columnWidths.slice(insertIndex)
        ]
      : undefined
  };
}

export function removeColumn(data: SheetData, index: number): SheetData {
  if (data.columns.length <= 1 || index < 0 || index >= data.columns.length) return data;

  return {
    ...data,
    columns: data.columns.filter((_, columnIndex) => columnIndex !== index),
    rows: data.rows.map((row) => row.filter((_, columnIndex) => columnIndex !== index)),
    columnWidths: data.columnWidths?.filter((_, columnIndex) => columnIndex !== index)
  };
}

export function moveColumn(data: SheetData, fromIndex: number, toIndex: number): SheetData {
  if (
    fromIndex < 0 ||
    fromIndex >= data.columns.length ||
    toIndex < 0 ||
    toIndex >= data.columns.length ||
    fromIndex === toIndex
  ) {
    return data;
  }

  return {
    ...data,
    columns: moveItem(data.columns, fromIndex, toIndex),
    rows: data.rows.map((row) => moveItem(row, fromIndex, toIndex)),
    columnWidths: data.columnWidths ? moveItem(data.columnWidths, fromIndex, toIndex) : undefined
  };
}

export const addRow = (data: SheetData): SheetData => insertRow(data, data.rows.length);

export function insertRow(data: SheetData, index: number): SheetData {
  const insertIndex = Math.max(0, Math.min(data.rows.length, index));

  return {
    ...data,
    rows: [
      ...data.rows.slice(0, insertIndex),
      data.columns.map(() => ''),
      ...data.rows.slice(insertIndex)
    ]
  };
}

export function removeRow(data: SheetData, index: number): SheetData {
  if (data.rows.length <= 1 || index < 0 || index >= data.rows.length) {
    return data;
  }

  return {
    ...data,
    rows: data.rows.filter((_, rowIndex) => rowIndex !== index)
  };
}

export function moveRow(data: SheetData, fromIndex: number, toIndex: number): SheetData {
  if (
    fromIndex < 0 ||
    fromIndex >= data.rows.length ||
    toIndex < 0 ||
    toIndex >= data.rows.length ||
    fromIndex === toIndex
  ) {
    return data;
  }

  return {
    ...data,
    rows: moveItem(data.rows, fromIndex, toIndex)
  };
}

export const updateCell = (
  data: SheetData,
  rowIndex: number,
  columnIndex: number,
  value: SheetCell
): SheetData => ({
  ...data,
  rows: data.rows.map((row, currentRowIndex) =>
    currentRowIndex === rowIndex
      ? row.map((cell, currentColumnIndex) => (currentColumnIndex === columnIndex ? value : cell))
      : row
  )
});

export const updateColumnName = (
  data: SheetData,
  columnIndex: number,
  value: string
): SheetData => ({
  ...data,
  columns: data.columns.map((column, index) => (index === columnIndex ? value : column))
});

export const serializeCellsForClipboard = (cells: SheetCell[][]): string =>
  cells.map((row) => row.map(escapeClipboardCell).join('\t')).join('\n');

function escapeClipboardCell(cell: SheetCell): string {
  const value = cell === null ? '' : String(cell);

  if (!/["\n\r\t]/.test(value)) return value;

  return `"${value.replaceAll('"', '""')}"`;
}

export function parseClipboardCells(text: string): SheetCell[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (!inQuotes && char === '\t') {
      row.push(cell);
      cell = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';

      if (char === '\r' && text[index + 1] === '\n') {
        index++;
      }

      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  if (rows.length > 1 && rows.at(-1)?.length === 1 && rows.at(-1)?.[0] === '') {
    rows.pop();
  }

  return rows;
}

export const getCellsInRange = (
  data: SheetData,
  range: {
    minRow: number;
    maxRow: number;
    minColumn: number;
    maxColumn: number;
  }
): SheetCell[][] =>
  data.rows
    .slice(range.minRow, range.maxRow + 1)
    .map((row) => row.slice(range.minColumn, range.maxColumn + 1));

export function pasteCells(
  data: SheetData,
  startRowIndex: number,
  startColumnIndex: number,
  cells: SheetCell[][]
): SheetData {
  if (cells.length === 0 || cells.every((row) => row.length === 0)) {
    return data;
  }

  const columnCount = Math.max(data.columns.length, startColumnIndex + maxRowLength(cells));
  const rowCount = Math.max(data.rows.length, startRowIndex + cells.length);
  const columns = normalizeColumnsForCount(data.columns, columnCount);

  const columnWidths = data.columnWidths
    ? normalizeColumnWidthsForCount(data.columnWidths, columnCount)
    : undefined;

  const rows: SheetCell[][] = Array.from({ length: rowCount }, (_, rowIndex) => {
    const existingRow = data.rows[rowIndex] ?? [];

    return Array.from({ length: columnCount }, (_, columnIndex) => existingRow[columnIndex] ?? '');
  });

  cells.forEach((sourceRow, rowOffset) => {
    sourceRow.forEach((cell, columnOffset) => {
      rows[startRowIndex + rowOffset][startColumnIndex + columnOffset] = cell;
    });
  });

  return {
    ...data,
    columns,
    rows,
    columnWidths
  };
}

const maxRowLength = (rows: SheetCell[][]): number =>
  rows.reduce((max, row) => Math.max(max, row.length), 0);

const normalizeColumnsForCount = (columns: string[], count: number): string[] =>
  Array.from({ length: count }, (_, index) => columns[index] ?? `column ${index + 1}`);

const normalizeColumnWidthsForCount = (widths: number[], count: number): number[] =>
  Array.from({ length: count }, (_, index) => widths[index] ?? DEFAULT_INSERTED_COLUMN_WIDTH);

export function parseCsvTable(csv: string): ParsedCsvTable {
  if (csv.trim() === '') return EMPTY_PARSED_TABLE;

  const parsedRows = parseCsvRows(csv);
  const [headerRow, ...bodyRows] = parsedRows;

  if (!headerRow) {
    return EMPTY_PARSED_TABLE;
  }

  const columnCount = Math.max(1, headerRow.length, ...bodyRows.map((row) => row.length));

  const columns = normalizeRow(headerRow, columnCount).map((value, index) =>
    value.length > 0 ? value : `column ${index + 1}`
  );

  const rows = bodyRows.map((row) => normalizeRow(row, columnCount));

  return {
    columns,
    rows: rows.length > 0 ? rows : [columns.map(() => '')]
  };
}

export function tableFromArray(rows: unknown[][]): ParsedCsvTable {
  const [headerRow, ...bodyRows] = rows;

  if (!headerRow) {
    return EMPTY_PARSED_TABLE;
  }

  const columnCount = Math.max(1, headerRow.length, ...bodyRows.map((row) => row.length));

  return {
    columns: normalizeUnknownRow(headerRow, columnCount).map((value, index) =>
      value === '' ? `column ${index + 1}` : String(value)
    ),
    rows: bodyRows.map((row) => normalizeUnknownRow(row, columnCount))
  };
}

export function tableFromObjects(objects: Record<string, unknown>[]): ParsedCsvTable {
  const columns = Array.from(new Set(objects.flatMap((object) => Object.keys(object))));

  if (columns.length === 0) {
    return EMPTY_PARSED_TABLE;
  }

  return {
    columns,
    rows: objects.map((object) => columns.map((column) => normalizeCell(object[column])))
  };
}

const normalizeRow = (row: string[], columnCount: number): string[] =>
  Array.from({ length: columnCount }, (_, index) => row[index] ?? '');

const normalizeUnknownRow = (row: unknown[], columnCount: number): SheetCell[] =>
  Array.from({ length: columnCount }, (_, index) => normalizeCell(row[index]));

function normalizeCell(value: unknown): SheetCell {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return value === null || value === undefined ? '' : String(value);
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];

  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);

  return next;
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < csv.length; index++) {
    const char = csv[index];
    const next = csv[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        value += '"';
        index++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        value += char;
      }

      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else if (char !== '\r') {
      value += char;
    }
  }

  row.push(value);

  if (row.length > 1 || row[0] !== '' || rows.length === 0) {
    rows.push(row);
  }

  return rows;
}
