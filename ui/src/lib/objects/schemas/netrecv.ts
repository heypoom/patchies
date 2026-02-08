import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the netrecv (network receive) object.
 */
export const netrecvSchema: ObjectSchema = {
  type: 'netrecv',
  category: 'network',
  description: 'Receive messages over WebRTC network from other Patchies instances',
  inlets: [],
  outlets: [
    {
      id: 'message',
      description: 'Received messages',
      messages: [{ schema: Type.Any(), description: 'Message received from peers in the room' }]
    }
  ],
  tags: ['network', 'webrtc', 'receive', 'collaboration', 'realtime']
};
