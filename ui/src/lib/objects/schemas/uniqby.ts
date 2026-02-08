import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the uniqby object.
 */
export const uniqbySchema: ObjectSchema = {
  type: 'uniqby',
  category: 'control',
  description: 'Filters consecutive duplicates by a specific key',
  inlets: [
    {
      id: 'message',
      description: 'Message input',
      messages: [{ schema: Type.Any(), description: 'Message to filter' }]
    },
    {
      id: 'key',
      description: 'Key path',
      messages: [
        {
          schema: Type.String(),
          description: 'Property path to compare (e.g., "id" or "user.name")'
        }
      ]
    }
  ],
  outlets: [
    {
      id: 'out',
      description: 'Unique messages output'
    }
  ],
  tags: ['control', 'filter', 'unique', 'dedupe']
};
