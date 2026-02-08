import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the peek (display message values) object.
 */
export const peekSchema: ObjectSchema = {
  type: 'peek',
  category: 'programming',
  description: 'Display latest received value for debugging message flow',
  inlets: [
    {
      id: 'message',
      description: 'Value to display',
      messages: [{ schema: Type.Any(), description: 'Value displayed in the object' }]
    }
  ],
  outlets: [],
  tags: ['programming', 'debug', 'display', 'inspect', 'value']
};
