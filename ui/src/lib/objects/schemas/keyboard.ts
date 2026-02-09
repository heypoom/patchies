import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { Bang, messages, Start, Stop, Toggle } from './common';

/** Pre-wrapped matchers for use with ts-pattern */
export const keyboardMessages = {
  ...messages
};

/**
 * Schema for the keyboard (keyboard input listener) object.
 */
export const keyboardSchema: ObjectSchema = {
  type: 'keyboard',
  category: 'interface',
  description: 'Listen for keyboard input and output key events',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        { schema: Bang, description: 'Toggle listening on/off' },
        { schema: Start, description: 'Start listening for keyboard input' },
        { schema: Stop, description: 'Stop listening for keyboard input' },
        { schema: Toggle, description: 'Toggle listening state' },
        { schema: Type.String(), description: 'Set keybind (in filtered mode)' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Keyboard output',
      messages: [
        { schema: Bang, description: 'Sent when filtered key is pressed (filtered mode)' },
        { schema: Type.String(), description: 'Key name (all keys mode)' },
        { schema: Type.Boolean(), description: 'Key state true/false (up/down mode)' },
        {
          schema: Type.Tuple([Type.String(), Type.Boolean()]),
          description: '[key, state] tuple (all keys + up/down mode)'
        }
      ]
    }
  ],
  tags: ['interface', 'input', 'keyboard', 'keys', 'hotkey']
};
