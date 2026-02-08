import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the allpass~ (all-pass filter) object.
 */
export const allpassSchema: ObjectSchema = {
  type: 'allpass~',
  category: 'audio',
  description: 'All-pass filter that changes phase relationships',
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
      description: 'Quality factor',
      messages: [{ schema: Type.Number(), description: 'Q value' }]
    }
  ],
  outlets: [
    {
      id: 'audio',
      description: 'Filtered audio output'
    }
  ],
  tags: ['audio', 'filter', 'allpass', 'phase']
};
