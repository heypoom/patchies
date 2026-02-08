import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the pan~ (stereo panner) object.
 */
export const panSchema: ObjectSchema = {
  type: 'pan~',
  category: 'audio',
  description: 'Controls stereo panning (-1 left to 1 right)',
  inlets: [
    {
      id: 'audio',
      description: 'Audio input'
    },
    {
      id: 'pan',
      description: 'Pan position',
      messages: [
        { schema: Type.Number(), description: 'Pan value (-1 = left, 0 = center, 1 = right)' }
      ]
    }
  ],
  outlets: [
    {
      id: 'audio',
      description: 'Panned audio output'
    }
  ],
  tags: ['audio', 'pan', 'stereo', 'spatial']
};
