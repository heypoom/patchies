import { Type } from '@sinclair/typebox';

import type { ObjectSchema } from '$lib/objects/schemas/types';
import { Bang, LoadBySrc } from '$lib/objects/schemas/common';
import { sym } from '$lib/objects/schemas/helpers';

export const DatatableClear = sym('clear');
export { LoadBySrc as DatatableLoad } from '$lib/objects/schemas/common';

const DatatableRowsOutput = Type.Array(Type.Array(Type.Any()));
const DatatableObjectsOutput = Type.Array(Type.Record(Type.String(), Type.Any()));

export const datatableSchema: ObjectSchema = {
  type: 'datatable',
  category: 'control',
  description: 'Editable CSV-style data table',
  inlets: [
    {
      id: 'command',
      description: 'Table commands',
      handle: { handleType: 'message' },
      messages: [
        { schema: Bang, description: 'Output the table' },
        { schema: DatatableClear, description: 'Clear all cells' },
        { schema: LoadBySrc, description: 'Load CSV text from a VFS path or URL' },
        {
          schema: DatatableRowsOutput,
          description: 'Replace table from a 2D array, using first row as column headers'
        },
        {
          schema: DatatableObjectsOutput,
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
          schema: DatatableRowsOutput,
          description: '2D array with headers as first row'
        },
        {
          schema: DatatableObjectsOutput,
          description: 'Array of row objects when object output is enabled'
        }
      ]
    }
  ],
  tags: ['data', 'csv', 'table', 'spreadsheet', 'control']
};
