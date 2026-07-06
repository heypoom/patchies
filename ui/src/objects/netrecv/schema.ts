import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from '$lib/objects/schemas/types';
import { schema } from '$lib/objects/schemas/types';
import { msg } from '$lib/objects/schemas/helpers';

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
      handle: { handleType: 'message' },
      messages: [{ schema: SetChannel, description: 'Set the channel name' }]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Received messages',
      handle: { handleType: 'message' },
      messages: [{ schema: Type.Any(), description: 'Message received from peers in the room' }]
    }
  ],
  tags: ['network', 'webrtc', 'receive', 'collaboration', 'realtime']
};
