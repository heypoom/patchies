import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the lowshelf~ (low shelf filter) object.
 */
export const lowshelfSchema: ObjectSchema = {
  type: 'lowshelf~',
  category: 'audio',
  description: 'Low shelf filter boosts or cuts frequencies below the cutoff frequency',
  inlets: [
    {
      id: 'audio',
      description: 'Audio input'
    },
    {
      id: 'frequency',
      description: 'Cutoff frequency',
      messages: [{ schema: Type.Number(), description: 'Cutoff frequency in Hz' }]
    },
    {
      id: 'gain',
      description: 'Gain control',
      messages: [{ schema: Type.Number(), description: 'Gain in dB (-40 to 40)' }]
    }
  ],
  outlets: [
    {
      id: 'audio',
      description: 'Filtered audio output'
    }
  ],
  tags: ['audio', 'filter', 'lowshelf', 'eq']
};
