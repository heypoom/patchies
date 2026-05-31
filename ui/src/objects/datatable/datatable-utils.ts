export type DatatableCell = string | number | boolean | null;

export type DatatableData = {
  columns: string[];
  rows: DatatableCell[][];
  outputObjects?: boolean;
};

export type ParsedCsvTable = Pick<DatatableData, 'columns' | 'rows'>;

const EMPTY_PARSED_TABLE: ParsedCsvTable = { columns: [], rows: [] };

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

export function buildDatatableOutput(
  data: DatatableData
): DatatableCell[][] | Record<string, DatatableCell>[] {
  return data.outputObjects ? buildDatatableObjectsOutput(data) : buildDatatableRowsOutput(data);
}

export function buildDatatableRowsOutput(data: DatatableData): DatatableCell[][] {
  return [data.columns, ...data.rows];
}

export function buildDatatableObjectsOutput(data: DatatableData): Record<string, DatatableCell>[] {
  const keys = ensureUniqueColumnKeys(data.columns);

  return data.rows.map((row) => {
    const object: Record<string, DatatableCell> = {};

    keys.forEach((key, index) => {
      object[key] = row[index] ?? null;
    });

    return object;
  });
}

export function createEmptyDatatable(): DatatableData {
  return {
    columns: ['column 1', 'column 2'],
    rows: [
      ['', ''],
      ['', '']
    ],
    outputObjects: false
  };
}

export function addColumn(data: DatatableData): DatatableData {
  const nextIndex = data.columns.length + 1;

  return {
    ...data,
    columns: [...data.columns, `column ${nextIndex}`],
    rows: data.rows.map((row) => [...row, ''])
  };
}

export function removeColumn(data: DatatableData, index: number): DatatableData {
  if (data.columns.length <= 1 || index < 0 || index >= data.columns.length) return data;

  return {
    ...data,
    columns: data.columns.filter((_, columnIndex) => columnIndex !== index),
    rows: data.rows.map((row) => row.filter((_, columnIndex) => columnIndex !== index))
  };
}

export function addRow(data: DatatableData): DatatableData {
  return {
    ...data,
    rows: [...data.rows, data.columns.map(() => '')]
  };
}

export function removeRow(data: DatatableData, index: number): DatatableData {
  if (data.rows.length <= 1 || index < 0 || index >= data.rows.length) return data;

  return {
    ...data,
    rows: data.rows.filter((_, rowIndex) => rowIndex !== index)
  };
}

export function updateCell(
  data: DatatableData,
  rowIndex: number,
  columnIndex: number,
  value: DatatableCell
): DatatableData {
  return {
    ...data,
    rows: data.rows.map((row, currentRowIndex) =>
      currentRowIndex === rowIndex
        ? row.map((cell, currentColumnIndex) => (currentColumnIndex === columnIndex ? value : cell))
        : row
    )
  };
}

export function updateColumnName(
  data: DatatableData,
  columnIndex: number,
  value: string
): DatatableData {
  return {
    ...data,
    columns: data.columns.map((column, index) => (index === columnIndex ? value : column))
  };
}

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

function normalizeRow(row: string[], columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, index) => row[index] ?? '');
}

function normalizeUnknownRow(row: unknown[], columnCount: number): DatatableCell[] {
  return Array.from({ length: columnCount }, (_, index) => normalizeCell(row[index]));
}

function normalizeCell(value: unknown): DatatableCell {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return value === null || value === undefined ? '' : String(value);
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
