import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the debounce object.
 */
export const debounceSchema: ObjectSchema = {
  type: 'debounce',
  category: 'control',
  description: 'Waits for quiet period before emitting last value',
  inlets: [
    {
      id: 'message',
      description: 'Message input',
      messages: [{ schema: Type.Any(), description: 'Message to debounce' }]
    },
    {
      id: 'time',
      description: 'Debounce time',
      messages: [{ schema: Type.Number(), description: 'Debounce time in milliseconds' }]
    }
  ],
  outlets: [
    {
      id: 'out',
      description: 'Debounced message output'
    }
  ],
  tags: ['control', 'timing', 'debounce', 'filter']
};
