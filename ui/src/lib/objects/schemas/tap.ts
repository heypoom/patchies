import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the tap (debug and inspect) object.
 */
export const tapSchema: ObjectSchema = {
  type: 'tap',
  category: 'programming',
  description: 'Execute side effects while passing messages through unchanged',
  inlets: [
    {
      id: 'hot',
      description: 'Hot inlet ($1) - triggers expression and passes through',
      messages: [
        { schema: Type.Any(), description: 'Value triggers side effect, passes through unchanged' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Pass-through output',
      messages: [{ schema: Type.Any(), description: 'Original input message (unchanged)' }]
    }
  ],
  tags: ['programming', 'debug', 'logging', 'inspect', 'control'],
  hasDynamicOutlets: true
};
