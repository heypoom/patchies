import { Type } from '@sinclair/typebox';
import { Bang } from './common';
import type { ObjectSchema } from './types';

export const peppermintSchema: ObjectSchema = {
  type: 'peppermint',
  category: 'programming',
  description: 'Run Peppermint data pipelines in the browser using Pyodide',
  inlets: [
    {
      id: 'message',
      description: 'Input value for input()',
      handle: { handleType: 'message' },
      messages: [
        { schema: Bang, description: 'Trigger a run with the last captured input() value' },
        { schema: Type.Any(), description: 'Data received by input() and used to trigger a run' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Output from print()',
      handle: { handleType: 'message' },
      messages: [{ schema: Type.Any(), description: 'Data emitted by print()' }]
    }
  ],
  tags: ['programming', 'peppermint', 'pyodide', 'data', 'pipeline']
};
