import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the filter (conditional message passing) object.
 */
export const filterSchema: ObjectSchema = {
  type: 'filter',
  category: 'programming',
  description: 'Filter messages based on a JavaScript expression condition',
  inlets: [
    {
      id: 'hot',
      description: 'Hot inlet ($1) - triggers evaluation',
      handle: { handleType: 'message' },
      messages: [
        { schema: Type.Any(), description: 'Value stored as $1, triggers filter evaluation' }
      ]
    }
  ],
  outlets: [
    {
      id: 'matched',
      description: 'Messages that match the filter condition',
      handle: { handleType: 'message' },
      messages: [{ schema: Type.Any(), description: 'Original message when condition is truthy' }]
    },
    {
      id: 'unmatched',
      description: 'Messages that do not match the filter condition',
      handle: { handleType: 'message' },
      messages: [{ schema: Type.Any(), description: 'Original message when condition is falsy' }]
    }
  ],
  tags: ['programming', 'filter', 'condition', 'control', 'routing']
};
