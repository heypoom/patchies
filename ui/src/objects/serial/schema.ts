import { Type } from '@sinclair/typebox';
import { msg, sym } from '$lib/objects/schemas/helpers';
import { schema } from '$lib/objects/schemas/types';

// Inlet commands
export const SerialConnect = sym('connect');
export const SerialDisconnect = sym('disconnect');
export const SerialSend = msg('send', { data: Type.String() });
export const SerialBaud = msg('baud', { rate: Type.Number() });

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
  send: schema(SerialSend),
  baud: schema(SerialBaud),
  data: schema(SerialData),
  connected: schema(SerialConnected),
  disconnected: schema(SerialDisconnected),
  error: schema(SerialError)
};
