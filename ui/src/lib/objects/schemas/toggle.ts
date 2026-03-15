import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { Bang } from './common';

/**
 * Schema for the toggle button object.
 */
export const toggleSchema: ObjectSchema = {
  type: 'toggle',
  category: 'interface',
  description: 'A toggle button that sends true/false when clicked',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      handle: { handleType: 'message' },
      messages: [{ schema: Bang, description: 'Flip the toggle state' }]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Toggle output',
      handle: { handleType: 'message' },
      messages: [{ schema: Type.Boolean(), description: 'Current state' }]
    }
  ],
  tags: ['interface', 'control', 'switch', 'boolean', 'input']
};
