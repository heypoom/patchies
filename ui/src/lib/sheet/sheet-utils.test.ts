import { describe, expect, it } from 'vitest';

import {
  buildSheetOutput,
  buildSheetObjectsOutput,
  buildSheetRowsOutput,
  ensureUniqueColumnKeys,
  getCellsInRange,
  insertColumn,
  insertRow,
  moveColumn,
  moveRow,
  parseClipboardCells,
  parseCsvTable,
  pasteCells,
  serializeCellsForClipboard
} from './sheet-utils';

describe('sheet utilities', () => {
  it('outputs row objects by default', () => {
    expect(
      buildSheetOutput({
        columns: ['name', 'age'],
        rows: [
          ['Ada', '37'],
          ['Grace', '85']
        ]
      })
    ).toEqual([
      { name: 'Ada', age: '37' },
      { name: 'Grace', age: '85' }
    ]);
  });

  it('outputs a 2D array when row output mode is enabled', () => {
    expect(
      buildSheetOutput({
        columns: ['name', 'age'],
        rows: [
          ['Ada', '37'],
          ['Grace', '85']
        ],
        outputRows: true
      })
    ).toEqual([
      ['name', 'age'],
      ['Ada', '37'],
      ['Grace', '85']
    ]);
  });

  it('can force 2D row output regardless of object mode', () => {
    expect(
      buildSheetRowsOutput({
        columns: ['name', 'age'],
        rows: [['Ada', '37']],
        outputRows: false
      })
    ).toEqual([
      ['name', 'age'],
      ['Ada', '37']
    ]);
  });

  it('can force row-object output regardless of default row mode', () => {
    expect(
      buildSheetObjectsOutput({
        columns: ['name', 'age'],
        rows: [['Ada', '37']],
        outputRows: true
      })
    ).toEqual([{ name: 'Ada', age: '37' }]);
  });

  it('uses stable fallback keys for blank and duplicate object headers', () => {
    expect(ensureUniqueColumnKeys(['name', '', 'name', '  '])).toEqual([
      'name',
      'column_2',
      'name_2',
      'column_4'
    ]);
  });

  it('parses CSV text with quoted values and editable headers', () => {
    expect(parseCsvTable('name,note\nAda,"hello, world"\nGrace,"line ""quoted"""')).toEqual({
      columns: ['name', 'note'],
      rows: [
        ['Ada', 'hello, world'],
        ['Grace', 'line "quoted"']
      ]
    });
  });

  it('returns only public table fields for empty CSV input', () => {
    expect(parseCsvTable('')).toEqual({ columns: [], rows: [] });
    expect(Object.keys(parseCsvTable(''))).toEqual(['columns', 'rows']);
  });

  it('moves columns with their row cells and widths', () => {
    expect(
      moveColumn(
        {
          columns: ['id', 'name', 'age'],
          rows: [
            ['1', 'Ada', '37'],
            ['2', 'Grace', '85']
          ],
          columnWidths: [80, 160, 100]
        },
        2,
        1
      )
    ).toEqual({
      columns: ['id', 'age', 'name'],
      rows: [
        ['1', '37', 'Ada'],
        ['2', '85', 'Grace']
      ],
      columnWidths: [80, 100, 160]
    });
  });

  it('inserts columns at a target index', () => {
    expect(
      insertColumn(
        {
          columns: ['id', 'name'],
          rows: [
            ['1', 'Ada'],
            ['2', 'Grace']
          ],
          columnWidths: [80, 160]
        },
        1
      )
    ).toEqual({
      columns: ['id', 'column 3', 'name'],
      rows: [
        ['1', '', 'Ada'],
        ['2', '', 'Grace']
      ],
      columnWidths: [80, 110, 160]
    });
  });

  it('moves rows', () => {
    expect(
      moveRow(
        {
          columns: ['id', 'name'],
          rows: [
            ['1', 'Ada'],
            ['2', 'Grace']
          ]
        },
        1,
        0
      )
    ).toEqual({
      columns: ['id', 'name'],
      rows: [
        ['2', 'Grace'],
        ['1', 'Ada']
      ]
    });
  });

  it('inserts rows at a target index', () => {
    expect(
      insertRow(
        {
          columns: ['id', 'name'],
          rows: [
            ['1', 'Ada'],
            ['2', 'Grace']
          ]
        },
        1
      )
    ).toEqual({
      columns: ['id', 'name'],
      rows: [
        ['1', 'Ada'],
        ['', ''],
        ['2', 'Grace']
      ]
    });
  });

  it('serializes and parses selected cells for clipboard copy/paste', () => {
    const cells = [
      ['Ada', 'hello\tworld'],
      ['Grace', 'line\nbreak']
    ];

    const text = serializeCellsForClipboard(cells);

    expect(text).toBe('Ada\t"hello\tworld"\nGrace\t"line\nbreak"');
    expect(parseClipboardCells(text)).toEqual(cells);
  });

  it('extracts a selected cell range', () => {
    expect(
      getCellsInRange(
        {
          columns: ['a', 'b', 'c'],
          rows: [
            ['1a', '1b', '1c'],
            ['2a', '2b', '2c'],
            ['3a', '3b', '3c']
          ]
        },
        { minRow: 1, maxRow: 2, minColumn: 1, maxColumn: 2 }
      )
    ).toEqual([
      ['2b', '2c'],
      ['3b', '3c']
    ]);
  });

  it('pastes cells at a target cell and expands rows and columns', () => {
    expect(
      pasteCells(
        {
          columns: ['a', 'b'],
          rows: [['1a', '1b']],
          columnWidths: [80, 90]
        },
        0,
        1,
        [
          ['x', 'y'],
          ['z', 'w']
        ]
      )
    ).toEqual({
      columns: ['a', 'b', 'column 3'],
      rows: [
        ['1a', 'x', 'y'],
        ['', 'z', 'w']
      ],
      columnWidths: [80, 90, 110]
    });
  });
});
