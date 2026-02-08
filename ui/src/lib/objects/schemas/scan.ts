import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { Bang, messages } from './common';

/** Pre-wrapped matchers for use with ts-pattern */
export const scanMessages = {
  ...messages
};

/**
 * Schema for the scan (stateful accumulation) object.
 */
export const scanSchema: ObjectSchema = {
  type: 'scan',
  category: 'programming',
  description: 'Accumulate values over time ($1=acc, $2=input)',
  inlets: [
    {
      id: 'input',
      description: 'Input value ($2) - triggers accumulation',
      messages: [{ schema: Type.Any(), description: 'New input value, becomes $2 in expression' }]
    },
    {
      id: 'reset',
      description: 'Reset/set accumulator',
      messages: [
        { schema: Bang, description: 'Reset to initial value' },
        { schema: Type.Any(), description: 'Set accumulator directly' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Accumulated result',
      messages: [{ schema: Type.Any(), description: 'Current accumulator value' }]
    }
  ],
  tags: ['programming', 'scan', 'accumulate', 'reduce', 'state']
};
