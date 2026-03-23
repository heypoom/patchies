import { Type } from '@sinclair/typebox';
import { msg } from '$lib/objects/schemas/helpers';
import type { ObjectSchema } from '$lib/objects/schemas/types';
import { Bang } from '$lib/objects/schemas/common';

export const SheetSet = msg('set', {
  row: Type.Number({ description: 'Row index (0-based)' }),
  col: Type.Number({ description: 'Column index (0-based)' }),
  value: Type.String({ description: 'Cell value' })
});

export const SheetClear = msg('clear', {});

/**
 * Schema for the sheet object.
 */
export const sheetSchema: ObjectSchema = {
  type: 'sheet',
  category: 'data',
  description:
    'Spreadsheet grid — bang to output all cells as a 2D array, double-click to edit cells',
  inlets: [
    {
      id: 'message',
      description: 'Bang or command',
      handle: { handleType: 'message' },
      messages: [
        { schema: Bang, description: 'Output all cells as a 2D array (string[][])' },
        {
          schema: SheetSet,
          description: 'Set a cell value by row and column (0-indexed)',
          example: '{ type: "set", row: 0, col: 1, value: "hello" }'
        },
        { schema: SheetClear, description: 'Clear all cells' }
      ]
    }
  ],
  outlets: [
    {
      id: 'data',
      description: 'Cell data',
      handle: { handleType: 'message' },
      messages: [
        {
          schema: Type.Array(Type.Array(Type.String())),
          description: '2D array of all cell values (string[][])'
        }
      ]
    }
  ],
  tags: ['data', 'spreadsheet', 'table', 'grid', 'ui']
};
