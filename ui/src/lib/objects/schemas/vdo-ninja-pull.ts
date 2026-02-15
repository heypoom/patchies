import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg, sym } from './helpers';

// VDO.Ninja pull message schemas
const Connect = msg('connect', {
  room: Type.String(),
  streamId: Type.Optional(Type.String())
});
const ConnectSimple = sym('connect');
const View = msg('view', { streamId: Type.String() });
const Disconnect = sym('disconnect');

// Outlet message schemas
const Connected = msg('connected', { room: Type.String() });
const Disconnected = sym('disconnected');
const Viewing = msg('viewing', { streamId: Type.String() });
const Track = msg('track', { kind: Type.String(), uuid: Type.String(), streamId: Type.String() });
const Message = msg('message', { data: Type.Any(), uuid: Type.String() });
const Error = msg('error', { message: Type.String() });

/** Pre-wrapped matchers for use with ts-pattern */
export const vdoNinjaPullMessages = {
  connect: schema(Connect),
  connectSimple: schema(ConnectSimple),
  view: schema(View),
  disconnect: schema(Disconnect),
  connected: schema(Connected),
  disconnected: schema(Disconnected),
  viewing: schema(Viewing),
  track: schema(Track),
  message: schema(Message),
  error: schema(Error)
};

/**
 * Schema for the vdo.ninja.pull object.
 */
export const vdoNinjaPullSchema: ObjectSchema = {
  type: 'vdo.ninja.pull',
  category: 'network',
  description: 'Pull audio, video, and messages from a VDO.Ninja room',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        { schema: ConnectSimple, description: 'Connect using configured room/streamId' },
        { schema: Connect, description: 'Connect to a room with specified values' },
        { schema: View, description: 'Start viewing a specific stream' },
        { schema: Disconnect, description: 'Disconnect from the room' }
      ]
    }
  ],
  outlets: [
    {
      id: 'audio',
      type: 'signal',
      description: 'Audio output from stream'
    },
    {
      id: 'message',
      description: 'Connection events and received data',
      messages: [
        { schema: Connected, description: 'Successfully connected' },
        { schema: Disconnected, description: 'Disconnected from room' },
        { schema: Viewing, description: 'Started viewing a stream' },
        { schema: Track, description: 'Received media track' },
        { schema: Message, description: 'Received data from a peer' },
        { schema: Error, description: 'Connection error' }
      ]
    }
  ],
  tags: ['network', 'webrtc', 'video', 'audio', 'streaming', 'vdoninja'],
  hasDynamicOutlets: true
};
