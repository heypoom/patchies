import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { Bang } from './common';

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
      handle: { handleType: 'message' },
      messages: [{ schema: Type.Any(), description: 'New input value, becomes $2 in expression' }]
    },
    {
      id: 'reset',
      description: 'Reset/set accumulator',
      handle: { handleType: 'message' },
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
      handle: { handleType: 'message' },
      messages: [{ schema: Type.Any(), description: 'Current accumulator value' }]
    }
  ],
  tags: ['programming', 'scan', 'accumulate', 'reduce', 'state']
};
