import { Type } from '@sinclair/typebox';
import { type ObjectSchema } from './types';
import { Bang } from './common';
import { msg } from './helpers';

const SetSchedule = msg('set', {
  time: Type.Number(),
  value: Type.Number({ minimum: 0, maximum: 1 })
});

/**
 * Schema for the sequencer (step sequencer) object.
 */
export const sequencerSchema: ObjectSchema = {
  type: 'sequencer',
  category: 'control',
  description: 'DAW-style step sequencer with up to 8 tracks, synced to the global transport',
  inlets: [],
  outlets: [
    {
      id: 'track-0',
      description:
        'Per-track trigger outlet (one outlet per track, numbered 0–7). Fires on each active step.',
      messages: [
        { schema: Bang, description: 'Fired on active step when output mode is "bang" (default)' },
        {
          schema: Type.Number({ minimum: 0, maximum: 1 }),
          description: 'Velocity value 0–1 when output mode is "value"'
        },
        {
          schema: SetSchedule,
          description:
            'Lookahead-scheduled audio event with precise Web Audio time and velocity, when output mode is "audio"'
        }
      ]
    }
  ],
  tags: ['sequencer', 'step', 'rhythm', 'transport', 'trigger', 'control', 'beat', 'drum']
};
