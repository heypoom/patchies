import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the gain~ (amplifier) object.
 */
export const gainSchema: ObjectSchema = {
  type: 'gain~',
  category: 'audio',
  description: 'Amplify or attenuate audio signals',
  inlets: [
    {
      id: 'audio',
      description: 'Audio input'
    },
    {
      id: 'gain',
      description: 'Gain control',
      messages: [
        {
          schema: Type.Number(),
          description: 'Gain value (1 = unity, >1 = amplify, <1 = attenuate)'
        }
      ]
    }
  ],
  outlets: [
    {
      id: 'audio',
      description: 'Audio output'
    }
  ],
  tags: ['audio', 'gain', 'volume', 'amplifier']
};
