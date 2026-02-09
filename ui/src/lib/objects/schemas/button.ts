import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { Bang } from './common';

/**
 * Schema for the button object.
 */
export const buttonSchema: ObjectSchema = {
  type: 'button',
  category: 'interface',
  description: 'A simple button that sends bang when clicked',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [{ schema: Type.Any(), description: 'Flash button and output bang' }]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Button output',
      messages: [
        { schema: Bang, description: 'Sent when button is clicked or receives any message' }
      ]
    }
  ],
  tags: ['interface', 'control', 'trigger', 'input']
};
