import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from '$lib/objects/schemas/types';

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
      handle: { handleType: 'message' },
      messages: [{ schema: Type.Any(), description: 'Value displayed in the object' }]
    }
  ],
  outlets: [],
  tags: ['programming', 'debug', 'display', 'inspect', 'value']
};
