import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { Run, Stop, SetCodeMessage } from './common';

/**
 * Schema for the ruby (Ruby code environment) object.
 */
export const rubySchema: ObjectSchema = {
  type: 'ruby',
  category: 'programming',
  description: 'Run Ruby code directly in the browser using ruby.wasm',
  inlets: [
    {
      id: 'message',
      description: 'Control messages and data input',
      messages: [
        { schema: SetCodeMessage, description: 'Update the code' },
        { schema: Run, description: 'Execute the code' },
        { schema: Stop, description: 'Stop running tasks' },
        { schema: Type.Any(), description: 'Data received via recv block' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Output from emit calls',
      messages: [{ schema: Type.Any(), description: 'Data sent via emit method' }]
    }
  ],
  tags: ['programming', 'ruby', 'wasm', 'scripting'],
  hasDynamicOutlets: true
};
