import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the delay~ (audio delay) object.
 */
export const delayAudioSchema: ObjectSchema = {
  type: 'delay~',
  category: 'audio',
  description: 'Creates a time-based delay effect on audio',
  inlets: [
    {
      id: 'audio',
      description: 'Audio input'
    },
    {
      id: 'time',
      description: 'Delay time',
      messages: [{ schema: Type.Number(), description: 'Delay time in milliseconds (max 1000ms)' }]
    }
  ],
  outlets: [
    {
      id: 'audio',
      description: 'Delayed audio output'
    }
  ],
  tags: ['audio', 'delay', 'time', 'effect']
};
