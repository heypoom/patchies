import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the lowpass~ (low-pass filter) object.
 */
export const lowpassSchema: ObjectSchema = {
  type: 'lowpass~',
  category: 'audio',
  description: 'Low-pass filter that attenuates frequencies above the cutoff',
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
  tags: ['audio', 'filter', 'lowpass', 'eq']
};
