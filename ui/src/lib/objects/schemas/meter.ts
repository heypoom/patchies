import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

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
