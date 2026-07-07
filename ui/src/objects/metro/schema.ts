import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from '$lib/objects/schemas/types';
import { Bang, Start, Stop } from '$lib/objects/schemas/common';

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
      type: 'message',
      description: 'Control messages',
      handle: { handleType: 'message', handleId: 0 },
      messages: [
        { schema: Type.Boolean(), description: 'true starts the metronome, false stops it' },
        { schema: Start, description: 'Start the metronome' },
        { schema: Stop, description: 'Stop the metronome' },
        { schema: Bang, description: 'Toggle the metronome' }
      ]
    },
    {
      id: 'interval',
      type: 'int',
      description: 'Interval in milliseconds',
      handle: { handleType: 'message', handleId: 1 },
      messages: [{ schema: Type.Integer(), description: 'Set interval in milliseconds' }]
    }
  ],
  outlets: [
    {
      id: 'out',
      type: 'bang',
      description: 'Bang signal sent at regular intervals',
      handle: { handleType: 'message', handleId: 0 },
      messages: [{ schema: Bang, description: 'Sent on each tick' }]
    }
  ],
  tags: ['control', 'timing', 'metronome', 'clock', 'trigger']
};
