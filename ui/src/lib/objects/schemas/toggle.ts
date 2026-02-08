import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { Bang, messages } from './common';

/** Pre-wrapped matchers for use with ts-pattern */
export const toggleMessages = {
  ...messages
};

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
      messages: [{ schema: Bang, description: 'Flip the toggle state' }]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Toggle output',
      messages: [{ schema: Type.Boolean(), description: 'Current state (true = on, false = off)' }]
    }
  ],
  tags: ['interface', 'control', 'switch', 'boolean', 'input']
};
