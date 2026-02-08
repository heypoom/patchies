import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the netsend (network send) object.
 */
export const netsendSchema: ObjectSchema = {
  type: 'netsend',
  category: 'network',
  description: 'Send messages over WebRTC network to other Patchies instances',
  inlets: [
    {
      id: 'message',
      description: 'Messages to send',
      messages: [
        { schema: Type.Any(), description: 'Message to broadcast to all peers in the room' }
      ]
    }
  ],
  outlets: [],
  tags: ['network', 'webrtc', 'send', 'collaboration', 'realtime']
};
