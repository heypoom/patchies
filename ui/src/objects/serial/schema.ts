import { Type } from '@sinclair/typebox';
import { msg, sym } from '$lib/objects/schemas/helpers';
import { schema } from '$lib/objects/schemas/types';
import type { ObjectSchema } from '$lib/objects/schemas/types';
import { Bang } from '$lib/objects/schemas';
import { P } from 'ts-pattern';

// Inlet commands
export const SerialConnect = sym('connect');
export const SerialDisconnect = sym('disconnect');
export const SerialBaud = msg('setBaud', { value: Type.Number() });
export const SerialSendBreak = sym('sendBreak');

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
  sendBreak: schema(SerialSendBreak),
  uint8Array: P.instanceOf(Uint8Array),
  numberArray: P.array(P.number),
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
      handle: { handleType: 'message' },
      messages: [
        { schema: Bang, description: 'Open port picker and connect' },
        { schema: Type.String(), description: 'Send a string to the port' },
        {
          schema: Type.Object({ type: Type.Literal('Uint8Array') }),
          description: 'Send raw bytes to the port'
        },
        {
          schema: Type.Array(Type.Integer({ minimum: 0, maximum: 255 })),
          description: 'Send raw bytes as a number array to the port'
        },
        {
          schema: SerialSendBreak,
          description: 'Send a BREAK signal via setSignals() — required for DMX-512 framing'
        },
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
      handle: { handleType: 'message' },
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
      handle: { handleType: 'message' },
      messages: [
        { schema: Bang, description: 'Open port picker and connect' },
        { schema: Type.String(), description: 'Send a string to the port' },
        {
          schema: Type.Object({ type: Type.Literal('Uint8Array') }),
          description: 'Send raw bytes to the port'
        },
        {
          schema: Type.Array(Type.Integer({ minimum: 0, maximum: 255 })),
          description: 'Send raw bytes as a number array to the port'
        },
        {
          schema: SerialSendBreak,
          description: 'Send a BREAK signal via setSignals() — required for DMX-512 framing'
        },
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
      handle: { handleType: 'message' },
      messages: [{ schema: SerialData, description: 'A line received from the port' }]
    }
  ],
  tags: ['serial', 'terminal', 'hardware', 'usb', 'uart', 'arduino', 'console', 'network']
};

// DMX-specific messages
export const DmxBlackout = sym('blackout');

export const dmxMessages = {
  connect: schema(SerialConnect),
  disconnect: schema(SerialDisconnect),
  blackout: schema(DmxBlackout),
  uint8Array: P.instanceOf(Uint8Array),
  numberArray: P.array(P.number)
};

/**
 * Schema for the dmx object.
 */
export const dmxSchema: ObjectSchema = {
  type: 'serial.dmx',
  category: 'network',
  description: 'DMX-512 universe output (250kbaud, 8N2) — send channel arrays to control lighting',
  inlets: [
    {
      id: 'message',
      description: 'Channel data and control messages',
      handle: { handleType: 'message' },
      messages: [
        { schema: Bang, description: 'Open port picker and connect' },
        {
          schema: Type.Array(Type.Integer({ minimum: 0, maximum: 255 })),
          description: 'Set channel values and send a DMX frame (up to 512 values)'
        },
        {
          schema: Type.Object({ type: Type.Literal('Uint8Array') }),
          description: 'Set channel values from raw bytes and send a DMX frame'
        },
        { schema: DmxBlackout, description: 'Send a blackout frame (all channels to 0)' },
        { schema: SerialConnect, description: 'Open port picker and connect' },
        { schema: SerialDisconnect, description: 'Disconnect from the port' }
      ]
    }
  ],
  outlets: [],
  tags: ['serial.dmx', 'dmx', 'dmx512', 'lighting', 'hardware', 'usb', 'uart', 'network']
};
