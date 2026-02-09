import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { Run, Stop, SetCodeMessage } from './common';

/**
 * Schema for the dom (vanilla JS DOM) object.
 */
export const domSchema: ObjectSchema = {
  type: 'dom',
  category: 'programming',
  description: 'Build custom UI components using vanilla JavaScript and DOM API',
  inlets: [
    {
      id: 'message',
      description: 'Control messages and data input',
      messages: [
        { schema: SetCodeMessage, description: 'Set the code in the editor' },
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
  tags: ['programming', 'dom', 'ui', 'interface', 'vanilla'],
  hasDynamicOutlets: true
};
