import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { Bang, Reset } from './common';

/**
 * Schema for the meter~ (audio level meter) object.
 */
export const meterSchema: ObjectSchema = {
  type: 'meter~',
  category: 'audio',
  description: 'Audio level meter display',
  inlets: [
    {
      id: 'audio',
      type: 'signal',
      description: 'Audio signal to measure'
    },
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        { schema: Bang, description: 'Output current level' },
        { schema: Reset, description: 'Reset level and peak' }
      ]
    }
  ],
  outlets: [
    {
      id: 'level',
      description: 'Current RMS level (0-1)',
      messages: [{ schema: Type.Number(), description: 'RMS amplitude level' }]
    }
  ],
  tags: ['audio', 'meter', 'level', 'monitoring', 'visualization']
};
