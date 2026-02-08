import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the notch~ (notch/band-reject filter) object.
 */
export const notchSchema: ObjectSchema = {
  type: 'notch~',
  category: 'audio',
  description: 'Notch filter that attenuates frequencies near the center frequency',
  inlets: [
    {
      id: 'audio',
      description: 'Audio input'
    },
    {
      id: 'frequency',
      description: 'Center frequency',
      messages: [
        {
          schema: Type.Number(),
          description: 'Center frequency in Hz'
        }
      ]
    },
    {
      id: 'Q',
      description: 'Width of the notch',
      messages: [
        {
          schema: Type.Number(),
          description: 'Q value'
        }
      ]
    }
  ],
  outlets: [
    {
      id: 'audio',
      description: 'Filtered audio output'
    }
  ],
  tags: ['audio', 'filter', 'notch', 'eq']
};
