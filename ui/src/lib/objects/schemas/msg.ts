import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg } from './helpers';
import { Bang, messages } from './common';

// Msg-specific message schemas
const SetValue = msg('set', { value: Type.Any() });

/** Pre-wrapped matchers for use with ts-pattern */
export const msgMessages = {
  ...messages,
  setValue: schema(SetValue)
};

/**
 * Schema for the msg (message box) object.
 */
export const msgSchema: ObjectSchema = {
  type: 'msg',
  category: 'interface',
  description: 'Store and send predefined messages',
  inlets: [
    {
      id: 'message',
      description: 'Control and placeholder values',
      messages: [
        { schema: Bang, description: 'Output the stored message' },
        { schema: SetValue, description: 'Set message without triggering output' },
        { schema: Type.Any(), description: 'Store as $1 and trigger output (hot inlet)' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Message output',
      messages: [
        { schema: Type.Any(), description: 'The stored message with placeholders replaced' }
      ]
    }
  ],
  tags: ['interface', 'message', 'trigger', 'data']
};
