import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the highpass~ (high-pass filter) object.
 */
export const highpassSchema: ObjectSchema = {
  type: 'highpass~',
  category: 'audio',
  description: 'High-pass filter that attenuates frequencies below the cutoff',
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
      id: 'Q',
      description: 'Resonance/quality factor',
      messages: [{ schema: Type.Number(), description: 'Q value' }]
    }
  ],
  outlets: [
    {
      id: 'audio',
      description: 'Filtered audio output'
    }
  ],
  tags: ['audio', 'filter', 'highpass', 'eq']
};
