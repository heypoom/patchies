import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the split~ (channel splitter) object.
 */
export const splitSchema: ObjectSchema = {
  type: 'split~',
  category: 'audio',
  description: 'Splits a multichannel signal into separate mono channels',
  inlets: [
    {
      id: 'audio',
      description: 'Multichannel audio input'
    },
    {
      id: 'channels',
      description: 'Number of channels',
      messages: [{ schema: Type.Number(), description: 'Number of channels to split (1-32)' }]
    }
  ],
  outlets: [
    {
      id: 'audio',
      description: 'Individual channel outputs (dynamic based on channel count)'
    }
  ],
  tags: ['audio', 'channel', 'split', 'stereo', 'multichannel']
};
