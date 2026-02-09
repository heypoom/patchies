import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg } from './helpers';

// NetSend-specific message schemas
const SetChannel = msg('set-channel', { channel: Type.Union([Type.String(), Type.Number()]) });

/** Pre-wrapped matchers for use with ts-pattern */
export const netsendMessages = {
  setChannel: schema(SetChannel)
};

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
        { schema: SetChannel, description: 'Set the channel name' },
        { schema: Type.Any(), description: 'Message to broadcast to all peers in the room' }
      ]
    }
  ],
  outlets: [],
  tags: ['network', 'webrtc', 'send', 'collaboration', 'realtime']
};
