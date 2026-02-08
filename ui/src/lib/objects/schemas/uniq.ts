import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { Bang, messages } from './common';

/** Pre-wrapped matchers for use with ts-pattern */
export const uniqMessages = {
  ...messages
};

/**
 * Schema for the uniq (filter consecutive duplicates) object.
 */
export const uniqSchema: ObjectSchema = {
  type: 'uniq',
  category: 'programming',
  description: 'Filter consecutive duplicates like Unix uniq ($1=prev, $2=curr)',
  inlets: [
    {
      id: 'input',
      description: 'Input value ($2) - compared to previous',
      messages: [{ schema: Type.Any(), description: 'Current value, becomes $2 in comparator' }]
    },
    {
      id: 'reset',
      description: 'Reset state',
      messages: [
        { schema: Bang, description: 'Forget last value' },
        { schema: Type.Any(), description: 'Set last value directly' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Unique values',
      messages: [{ schema: Type.Any(), description: 'Values that differ from previous' }]
    }
  ],
  tags: ['programming', 'uniq', 'distinct', 'filter', 'dedupe']
};
