import type { ObjectSchema } from './types';

/**
 * Schema for the recv.vdo (video receive) object.
 */
export const recvVdoSchema: ObjectSchema = {
  type: 'recv.vdo',
  category: 'visual',
  description: 'Receive video from a named channel for wireless routing',
  inlets: [
    {
      id: 'channel',
      description: 'Channel name (string)',
      handle: { handleType: 'message', handleId: 0 }
    }
  ],
  outlets: [
    {
      id: 'video',
      description: 'Video output received from the channel',
      handle: { handleType: 'video', handleId: 0 }
    }
  ],
  tags: ['visual', 'routing', 'channel', 'wireless', 'video']
};
