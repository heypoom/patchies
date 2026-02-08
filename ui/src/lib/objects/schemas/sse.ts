import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg, sym } from './helpers';

// SSE-specific message schemas
const Connect = msg('connect', { url: Type.String() });
const Disconnect = sym('disconnect');

/** Pre-wrapped matchers for use with ts-pattern */
export const sseMessages = {
  connect: schema(Connect),
  disconnect: schema(Disconnect)
};

/**
 * Schema for the sse (Server-Sent Events) object.
 */
export const sseSchema: ObjectSchema = {
  type: 'sse',
  category: 'network',
  description: 'Receive real-time events from a server using EventSource API',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        { schema: Connect, description: 'Connect to SSE endpoint' },
        { schema: Disconnect, description: 'Disconnect from endpoint' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Received events',
      messages: [
        {
          schema: Type.Any(),
          description: 'Event data (JSON parsed if possible, otherwise string)'
        }
      ]
    }
  ],
  tags: ['network', 'sse', 'events', 'realtime', 'streaming']
};
