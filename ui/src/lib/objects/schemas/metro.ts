import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { Bang, Stop } from './common';

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
      handle: { handleType: 'message' },
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
      handle: { handleType: 'message' },
      messages: [{ schema: Bang, description: 'Sent on each tick' }]
    }
  ],
  tags: ['control', 'timing', 'metronome', 'clock', 'trigger']
};
