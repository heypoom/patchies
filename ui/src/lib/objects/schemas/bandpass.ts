import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the bandpass~ (band-pass filter) object.
 */
export const bandpassSchema: ObjectSchema = {
  type: 'bandpass~',
  category: 'audio',
  description: 'Band-pass filter that allows frequencies near the center frequency',
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
      description: 'Bandwidth/quality factor',
      messages: [{ schema: Type.Number(), description: 'Q value' }]
    }
  ],
  outlets: [
    {
      id: 'audio',
      description: 'Filtered audio output'
    }
  ],
  tags: ['audio', 'filter', 'bandpass', 'eq']
};
