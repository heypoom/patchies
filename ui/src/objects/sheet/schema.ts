import { Type } from '@sinclair/typebox';

import type { ObjectSchema } from '$lib/objects/schemas/types';
import { Bang, Collapse, Expand, LoadBySrc } from '$lib/objects/schemas/common';
import { sym } from '$lib/objects/schemas/helpers';

export const SheetClear = sym('clear');
export const SheetRows = sym('rows');
export const SheetObjects = sym('objects');
export { LoadBySrc as SheetLoad } from '$lib/objects/schemas/common';

const SheetRowsOutput = Type.Array(Type.Array(Type.Any()));
const SheetObjectsOutput = Type.Array(Type.Record(Type.String(), Type.Any()));

export const sheetSchema: ObjectSchema = {
  type: 'sheet',
  category: 'control',
  description: 'Editable spreadsheet-style data grid',
  inlets: [
    {
      id: 'command',
      description: 'Table commands',
      handle: { handleType: 'message' },
      messages: [
        { schema: Bang, description: 'Output the table' },
        { schema: SheetRows, description: 'Output the table as a 2D array' },
        { schema: SheetObjects, description: 'Output the table as row objects' },
        { schema: SheetClear, description: 'Clear all cells' },
        { schema: LoadBySrc, description: 'Load CSV text from a VFS path or URL' },
        { schema: Expand, description: 'Open the expanded sheet editor' },
        { schema: Collapse, description: 'Close the expanded sheet editor' },
        {
          schema: Type.String(),
          description: 'Parse CSV text and replace the table'
        },
        {
          schema: SheetRowsOutput,
          description: 'Replace table from a 2D array, using first row as column headers'
        },
        {
          schema: SheetObjectsOutput,
          description: 'Replace table from an array of row objects'
        }
      ]
    }
  ],
  outlets: [
    {
      id: 'data',
      description: 'Table data output',
      handle: { handleType: 'message' },
      messages: [
        {
          schema: SheetRowsOutput,
          description: '2D array with headers as first row'
        },
        {
          schema: SheetObjectsOutput,
          description: 'Array of row objects when object output is enabled'
        }
      ]
    }
  ],
  tags: ['data', 'csv', 'table', 'spreadsheet', 'control']
};
