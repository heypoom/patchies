import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the mtof (MIDI to frequency) object.
 */
export const mtofSchema: ObjectSchema = {
  type: 'mtof',
  category: 'control',
  description: 'Converts MIDI note values to frequency float values',
  inlets: [
    {
      id: 'note',
      description: 'MIDI note input',
      messages: [{ schema: Type.Number(), description: 'MIDI note value (0-127)' }]
    }
  ],
  outlets: [
    {
      id: 'frequency',
      description: 'Frequency output in Hz'
    }
  ],
  tags: ['control', 'midi', 'frequency', 'conversion']
};
