import { Type } from '@sinclair/typebox';
import { msg, sym } from '$lib/objects/schemas/helpers';
import { schema } from '$lib/objects/schemas/types';
import type { ObjectSchema } from '$lib/objects/schemas/types';
import { Bang } from '$lib/objects/schemas';

// Inlet commands
export const SerialConnect = sym('connect');
export const SerialDisconnect = sym('disconnect');
export const SerialBaud = msg('setBaud', { rate: Type.Number() });

// Outlet messages
export const SerialData = msg('data', { line: Type.String() });

export const SerialConnected = msg('connected', {
  portId: Type.String(),
  label: Type.String()
});

export const SerialDisconnected = msg('disconnected', {
  portId: Type.String()
});

export const SerialError = msg('error', { message: Type.String() });

export const serialMessages = {
  connect: schema(SerialConnect),
  disconnect: schema(SerialDisconnect),
  baud: schema(SerialBaud),
  data: schema(SerialData),
  connected: schema(SerialConnected),
  disconnected: schema(SerialDisconnected),
  error: schema(SerialError)
};

/**
 * Schema for the serial object.
 */
export const serialSchema: ObjectSchema = {
  type: 'serial',
  category: 'network',
  description: 'WebSerial port for communicating with hardware devices',
  inlets: [
    {
      id: 'message',
      description: 'Control and data messages',
      messages: [
        { schema: Bang, description: 'Open port picker and connect' },
        { schema: Type.String(), description: 'Send a string to the port' },
        { schema: SerialConnect, description: 'Open port picker and connect' },
        { schema: SerialDisconnect, description: 'Disconnect from the port' },
        { schema: SerialBaud, description: 'Set the baud rate' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Received data and connection events',
      messages: [
        { schema: SerialData, description: 'A line received from the port' },
        { schema: SerialConnected, description: 'Port connected' },
        { schema: SerialDisconnected, description: 'Port disconnected' },
        { schema: SerialError, description: 'An error occurred' }
      ]
    }
  ],
  tags: ['serial', 'hardware', 'usb', 'uart', 'arduino', 'microcontroller', 'network']
};

/**
 * Schema for the serial.term object.
 */
export const serialTermSchema: ObjectSchema = {
  type: 'serial.term',
  category: 'network',
  description: 'Interactive serial terminal with scrollback and ANSI color support',
  inlets: [
    {
      id: 'message',
      description: 'Control and data messages',
      messages: [
        { schema: Bang, description: 'Open port picker and connect' },
        { schema: Type.String(), description: 'Send a string to the port' },
        { schema: SerialConnect, description: 'Open port picker and connect' },
        { schema: SerialDisconnect, description: 'Disconnect from the port' },
        { schema: SerialBaud, description: 'Set the baud rate' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Received lines from the port',
      messages: [{ schema: SerialData, description: 'A line received from the port' }]
    }
  ],
  tags: ['serial', 'terminal', 'hardware', 'usb', 'uart', 'arduino', 'console', 'network']
};
