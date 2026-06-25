import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the meter~ (audio level meter) object.
 */
export const meterSchema: ObjectSchema = {
  type: 'meter~',
  category: 'audio',
  description: 'Multichannel audio level meter display',
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
      description: 'Current RMS level of the loudest channel (0-1)',
      handle: { handleType: 'message' },
      messages: [
        { schema: Type.Number(), description: 'RMS amplitude level of the loudest channel' }
      ]
    }
  ],
  tags: ['audio', 'meter', 'level', 'monitoring', 'visualization']
};
