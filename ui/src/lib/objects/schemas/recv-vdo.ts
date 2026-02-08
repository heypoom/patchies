import type { ObjectSchema } from './types';

/**
 * Schema for the recv.vdo (video receive) object.
 */
export const recvVdoSchema: ObjectSchema = {
  type: 'recv.vdo',
  category: 'visual',
  description: 'Receive video from a named channel for wireless routing',
  inlets: [],
  outlets: [
    {
      id: 'video',
      description: 'Video output received from the channel'
    }
  ],
  tags: ['visual', 'routing', 'channel', 'wireless', 'video']
};
