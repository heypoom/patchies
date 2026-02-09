import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg, sym } from './helpers';

// MQTT-specific message schemas
const Connect = msg('connect', { url: Type.String() });
const Disconnect = sym('disconnect');
const Subscribe = msg('subscribe', {
  topic: Type.Union([Type.String(), Type.Array(Type.String())])
});
const Unsubscribe = msg('unsubscribe', {
  topic: Type.Union([Type.String(), Type.Array(Type.String())])
});
const Publish = msg('publish', { topic: Type.String(), message: Type.Any() });

// Outlet message schemas
const Connected = sym('connected');
const Disconnected = sym('disconnected');
const Message = msg('message', { topic: Type.String(), message: Type.String() });
const Subscribed = msg('subscribed', { topics: Type.Array(Type.String()) });
const Unsubscribed = msg('unsubscribed', { topics: Type.Array(Type.String()) });
const Error = msg('error', { message: Type.String() });

/** Pre-wrapped matchers for use with ts-pattern */
export const mqttMessages = {
  connect: schema(Connect),
  disconnect: schema(Disconnect),
  subscribe: schema(Subscribe),
  unsubscribe: schema(Unsubscribe),
  publish: schema(Publish),
  connected: schema(Connected),
  disconnected: schema(Disconnected),
  message: schema(Message),
  subscribed: schema(Subscribed),
  unsubscribed: schema(Unsubscribed),
  error: schema(Error)
};

/**
 * Schema for the mqtt (MQTT client) object.
 */
export const mqttSchema: ObjectSchema = {
  type: 'mqtt',
  category: 'network',
  description: 'Connect to MQTT brokers for pub/sub messaging with IoT devices',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        { schema: Connect, description: 'Connect to a broker' },
        { schema: Disconnect, description: 'Disconnect from the broker' },
        { schema: Subscribe, description: 'Subscribe to a topic' },
        { schema: Unsubscribe, description: 'Unsubscribe from a topic' },
        { schema: Publish, description: 'Publish a message to a topic' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Connection events and received messages',
      messages: [
        { schema: Connected, description: 'Successfully connected' },
        { schema: Disconnected, description: 'Disconnected from broker' },
        { schema: Message, description: 'Received a message' },
        { schema: Subscribed, description: 'Successfully subscribed' },
        { schema: Unsubscribed, description: 'Successfully unsubscribed' },
        { schema: Error, description: 'An error occurred' }
      ]
    }
  ],
  tags: ['network', 'mqtt', 'iot', 'pubsub', 'messaging']
};
