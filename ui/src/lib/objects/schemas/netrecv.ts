import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg } from './helpers';

// NetRecv-specific message schemas
const SetChannel = msg('set-channel', { channel: Type.Union([Type.String(), Type.Number()]) });

/** Pre-wrapped matchers for use with ts-pattern */
export const netrecvMessages = {
  setChannel: schema(SetChannel)
};

/**
 * Schema for the netrecv (network receive) object.
 */
export const netrecvSchema: ObjectSchema = {
  type: 'netrecv',
  category: 'network',
  description: 'Receive messages over WebRTC network from other Patchies instances',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [{ schema: SetChannel, description: 'Set the channel name' }]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Received messages',
      messages: [{ schema: Type.Any(), description: 'Message received from peers in the room' }]
    }
  ],
  tags: ['network', 'webrtc', 'receive', 'collaboration', 'realtime']
};
