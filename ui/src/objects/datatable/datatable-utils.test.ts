import { describe, expect, it } from 'vitest';

import { buildDatatableOutput, ensureUniqueColumnKeys, parseCsvTable } from './datatable-utils';

describe('datatable utilities', () => {
  it('outputs a 2D array with headers as the first row by default', () => {
    expect(
      buildDatatableOutput({
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
      buildDatatableOutput({
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
});
