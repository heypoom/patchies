import { describe, expect, it } from 'vitest';

import {
  buildSheetOutput,
  buildSheetObjectsOutput,
  buildSheetRowsOutput,
  ensureUniqueColumnKeys,
  moveColumn,
  moveRow,
  parseCsvTable
} from './sheet-utils';

describe('sheet utilities', () => {
  it('outputs a 2D array with headers as the first row by default', () => {
    expect(
      buildSheetOutput({
        columns: ['name', 'age'],
        rows: [
          ['Ada', '37'],
          ['Grace', '85']
        ]
      })
    ).toEqual([
      ['name', 'age'],
      ['Ada', '37'],
      ['Grace', '85']
    ]);
  });

  it('outputs row objects when object mode is enabled', () => {
    expect(
      buildSheetOutput({
        columns: ['name', 'age'],
        rows: [
          ['Ada', '37'],
          ['Grace', '85']
        ],
        outputObjects: true
      })
    ).toEqual([
      { name: 'Ada', age: '37' },
      { name: 'Grace', age: '85' }
    ]);
  });

  it('can force 2D row output regardless of object mode', () => {
    expect(
      buildSheetRowsOutput({
        columns: ['name', 'age'],
        rows: [['Ada', '37']],
        outputObjects: true
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
        outputObjects: false
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
});
