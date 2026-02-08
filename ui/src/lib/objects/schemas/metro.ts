import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { Bang, Stop, messages } from './common';

/** Pre-wrapped matchers for use with ts-pattern */
export const metroMessages = {
  ...messages
};

/**
 * Schema for the metro (metronome) object.
 */
export const metroSchema: ObjectSchema = {
  type: 'metro',
  category: 'control',
  description: 'Metronome for regular timing intervals',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        { schema: Bang, description: 'Start the metronome' },
        { schema: Stop, description: 'Stop the metronome' },
        { schema: Type.Number(), description: 'Set interval in milliseconds' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Metronome ticks',
      messages: [{ schema: Bang, description: 'Sent on each tick' }]
    }
  ],
  tags: ['control', 'timing', 'metronome', 'clock', 'trigger']
};
