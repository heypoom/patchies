import type { ObjectSchema } from './types';

/**
 * Schema for the send.vdo (video send) object.
 */
export const sendVdoSchema: ObjectSchema = {
  type: 'send.vdo',
  category: 'visual',
  description: 'Send video to a named channel for wireless routing',
  inlets: [
    {
      id: 'video',
      description: 'Video input to broadcast on the channel',
      handle: { handleType: 'video', handleId: 0 }
    },
    {
      id: 'channel',
      description: 'Channel name (string)',
      handle: { handleType: 'message', handleId: 1 }
    }
  ],
  outlets: [],
  tags: ['visual', 'routing', 'channel', 'wireless', 'video']
};
