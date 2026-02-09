import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { Bang, Run, Stop, SetCodeMessage } from './common';

/**
 * Schema for the js (JavaScript code block) object.
 */
export const jsSchema: ObjectSchema = {
  type: 'js',
  category: 'programming',
  description: 'General-purpose JavaScript code block for scripting and automation',
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
  tags: ['programming', 'javascript', 'code', 'scripting'],
  hasDynamicOutlets: true
};
