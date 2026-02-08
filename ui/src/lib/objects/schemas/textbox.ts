import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { Bang, messages } from './common';

/** Pre-wrapped matchers for use with ts-pattern */
export const textboxMessages = {
  ...messages
};

/**
 * Schema for the textbox (multi-line text input) object.
 */
export const textboxSchema: ObjectSchema = {
  type: 'textbox',
  category: 'interface',
  description: 'Multi-line text input field',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        { schema: Bang, description: 'Output the current text' },
        { schema: Type.String(), description: 'Set the text content' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Text output',
      messages: [{ schema: Type.String(), description: 'Current text content' }]
    }
  ],
  tags: ['interface', 'text', 'input', 'multiline']
};
