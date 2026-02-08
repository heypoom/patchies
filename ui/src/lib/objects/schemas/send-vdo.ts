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
      description: 'Video input to broadcast on the channel'
    },
    {
      id: 'channel',
      description: 'Channel name (string)'
    }
  ],
  outlets: [],
  tags: ['visual', 'routing', 'channel', 'wireless', 'video']
};
