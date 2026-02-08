import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the merge~ (channel merger) object.
 */
export const mergeSchema: ObjectSchema = {
  type: 'merge~',
  category: 'audio',
  description: 'Merges multiple mono channels into a single multichannel signal',
  inlets: [
    {
      id: 'audio',
      description: 'Channel inputs (dynamic based on channel count)'
    },
    {
      id: 'channels',
      description: 'Number of channels',
      messages: [{ schema: Type.Number(), description: 'Number of channels to merge (1-32)' }]
    }
  ],
  outlets: [
    {
      id: 'audio',
      description: 'Multichannel audio output'
    }
  ],
  tags: ['audio', 'channel', 'merge', 'stereo', 'multichannel']
};
