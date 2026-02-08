import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg, sym } from './helpers';

// VDO.Ninja push message schemas
const Connect = msg('connect', {
  room: Type.Optional(Type.String()),
  streamId: Type.Optional(Type.String())
});
const ConnectSimple = sym('connect');
const Disconnect = sym('disconnect');

// Outlet message schemas
const Connected = msg('connected', { room: Type.String() });
const Disconnected = sym('disconnected');
const Data = msg('data', { data: Type.Any(), uuid: Type.String() });
const Track = msg('track', { kind: Type.String(), uuid: Type.String() });
const Streaming = msg('streaming', { tracks: Type.Number() });
const Error = msg('error', { message: Type.String() });

/** Pre-wrapped matchers for use with ts-pattern */
export const vdoNinjaPushMessages = {
  connect: schema(Connect),
  connectSimple: schema(ConnectSimple),
  disconnect: schema(Disconnect),
  connected: schema(Connected),
  disconnected: schema(Disconnected),
  data: schema(Data),
  track: schema(Track),
  streaming: schema(Streaming),
  error: schema(Error)
};

/**
 * Schema for the vdo.ninja.push object.
 */
export const vdoNinjaPushSchema: ObjectSchema = {
  type: 'vdo.ninja.push',
  category: 'network',
  description: 'Push audio, video, and messages to a VDO.Ninja room',
  inlets: [
    {
      id: 'message',
      description: 'Control messages and data to send',
      messages: [
        { schema: ConnectSimple, description: 'Connect using configured room/streamId' },
        { schema: Connect, description: 'Connect to a room with specified values' },
        { schema: Disconnect, description: 'Disconnect from the room' },
        { schema: Type.Any(), description: 'Data sent to all peers in the room' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Connection events and received data',
      messages: [
        { schema: Connected, description: 'Successfully connected' },
        { schema: Disconnected, description: 'Disconnected from room' },
        { schema: Data, description: 'Received data from a peer' },
        { schema: Track, description: 'Received media track' },
        { schema: Streaming, description: 'Started streaming with N tracks' },
        { schema: Error, description: 'Connection or streaming error' }
      ]
    }
  ],
  tags: ['network', 'webrtc', 'video', 'audio', 'streaming', 'vdoninja'],
  hasDynamicOutlets: true
};
