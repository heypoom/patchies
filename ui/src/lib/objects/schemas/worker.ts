import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { Bang, Run, Stop, SetCodeMessage } from './common';

/**
 * Schema for the worker (Web Worker JavaScript) object.
 */
export const workerSchema: ObjectSchema = {
  type: 'worker',
  category: 'programming',
  description: 'JavaScript in a Web Worker thread for CPU-intensive computations',
  inlets: [
    {
      id: 'message',
      description: 'Control messages and data input',
      messages: [
        { schema: Bang, description: 'Trigger code execution' },
        { schema: SetCodeMessage, description: 'Update the code' },
        { schema: Run, description: 'Execute the code' },
        { schema: Stop, description: 'Stop running code' },
        { schema: Type.Any(), description: 'Data received via recv() callback' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Output from send() calls',
      messages: [{ schema: Type.Any(), description: 'Data sent via send() function' }]
    }
  ],
  tags: ['programming', 'javascript', 'worker', 'threading', 'async'],
  hasDynamicOutlets: true
};
