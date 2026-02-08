import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the peaking~ (peaking EQ filter) object.
 */
export const peakingSchema: ObjectSchema = {
  type: 'peaking~',
  category: 'audio',
  description: 'Peaking filter allows peak EQ adjustments at a specific frequency',
  inlets: [
    {
      id: 'audio',
      description: 'Audio input'
    },
    {
      id: 'frequency',
      description: 'Center frequency',
      messages: [{ schema: Type.Number(), description: 'Center frequency in Hz' }]
    },
    {
      id: 'Q',
      description: 'Quality factor (width of peak)',
      messages: [{ schema: Type.Number(), description: 'Q value' }]
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
  tags: ['audio', 'filter', 'peaking', 'eq', 'parametric']
};
