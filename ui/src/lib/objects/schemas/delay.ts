import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { Bang, Stop, Clear, messages } from './common';

/** Pre-wrapped matchers for use with ts-pattern */
export const delayMessages = {
  ...messages
};

/**
 * Schema for the delay (message delay) object.
 */
export const delaySchema: ObjectSchema = {
  type: 'delay',
  category: 'control',
  description: 'Delay messages by a specified time',
  inlets: [
    {
      id: 'message',
      description: 'Input messages',
      messages: [
        {
          schema: Bang,
          description: 'Trigger delay and output bang'
        },
        {
          schema: Clear,
          description: 'Cancel pending delays'
        },
        {
          schema: Type.Any(),
          description: 'Message to delay'
        }
      ]
    },
    {
      id: 'time',
      description: 'Delay time',
      messages: [
        {
          schema: Type.Number(),
          description: 'Delay time in milliseconds'
        }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Delayed output',
      messages: [{ schema: Type.Any(), description: 'Message after delay' }]
    }
  ],
  tags: ['control', 'timing', 'delay', 'schedule']
};
