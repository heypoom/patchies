import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the throttle object.
 */
export const throttleSchema: ObjectSchema = {
  type: 'throttle',
  category: 'control',
  description: 'Rate limits messages to at most one per time period',
  inlets: [
    {
      id: 'message',
      description: 'Message input',
      messages: [{ schema: Type.Any(), description: 'Message to throttle' }]
    },
    {
      id: 'time',
      description: 'Throttle time',
      messages: [{ schema: Type.Number(), description: 'Throttle time in milliseconds' }]
    }
  ],
  outlets: [
    {
      id: 'out',
      description: 'Throttled message output'
    }
  ],
  tags: ['control', 'timing', 'throttle', 'rate-limit']
};
