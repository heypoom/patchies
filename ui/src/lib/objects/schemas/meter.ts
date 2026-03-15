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
      description: 'Audio signal to measure',
      handle: { handleType: 'audio' }
    }
  ],
  outlets: [
    {
      id: 'level',
      description: 'Current RMS level (0-1)',
      handle: { handleType: 'message' },
      messages: [{ schema: Type.Number(), description: 'RMS amplitude level' }]
    }
  ],
  tags: ['audio', 'meter', 'level', 'monitoring', 'visualization']
};
