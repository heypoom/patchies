import { Type } from '@sinclair/typebox';

import type { ObjectSchema } from '$lib/objects/schemas/types';
import { Bang } from '$lib/objects/schemas/common';

const ScaleField = Type.Object({
  name: Type.String(),
  location: Type.String(),
  freqs: Type.Array(Type.Number()),
  cents: Type.Array(Type.Number())
});

/**
 * Schema for the ngea (Network Gong Ensemble Archive) object.
 * Provides real-world microtonal tuning data from Southeast Asian gong ensembles.
 */
export const ngeaSchema: ObjectSchema = {
  type: 'ngea',
  category: 'music',
  description: 'Microtonal tuning from the Network Gong Ensemble Archive (NGEA)',
  inlets: [
    {
      id: 'index',
      description: 'Gong index, bang, tuning name, or MIDI note',
      handle: { handleType: 'message' },
      messages: [
        {
          schema: Type.Number(),
          description: 'Output gong at this index (0-based), includes scale'
        },
        { schema: Bang, description: 'Output gong at current index' },
        { schema: Type.String(), description: 'Switch to a named tuning (partial match)' },
        {
          schema: Type.Object({
            type: Type.Literal('noteOn'),
            note: Type.Number(),
            velocity: Type.Number(),
            channel: Type.Number()
          }),
          description: 'MIDI noteOn — maps note to gong, outputs pitchBend + noteOn'
        },
        {
          schema: Type.Object({
            type: Type.Literal('noteOff'),
            note: Type.Number(),
            velocity: Type.Number(),
            channel: Type.Number()
          }),
          description: 'MIDI noteOff — outputs tuned noteOff with frequency'
        }
      ]
    }
  ],
  outlets: [
    {
      id: 'out',
      description: 'Gong data (bang/number input) or tuned MIDI (noteOn/noteOff input)',
      handle: { handleType: 'message', handleId: 0 },
      messages: [
        {
          schema: Type.Object({
            type: Type.Literal('gong'),
            index: Type.Number(),
            id: Type.String(),
            freq: Type.Number(),
            cents: Type.Number(),
            accumulate: Type.Number()
          }),
          description: 'Gong data (bang): index, id, freq (Hz), cents, accumulate'
        },
        {
          schema: Type.Object({
            type: Type.Literal('gong'),
            index: Type.Number(),
            id: Type.String(),
            freq: Type.Number(),
            cents: Type.Number(),
            accumulate: Type.Number(),
            scale: ScaleField
          }),
          description: 'Gong data (number): same as above, plus full scale info'
        },
        {
          schema: Type.Object({
            type: Type.Literal('pitchBend'),
            value: Type.Number(),
            channel: Type.Number(),
            frequency: Type.Number()
          }),
          description:
            'Pitch bend to reach exact gong frequency (-1.0 to 1.0, ±2 semitone range, sent before noteOn)'
        },
        {
          schema: Type.Object({
            type: Type.Literal('noteOn'),
            note: Type.Number(),
            velocity: Type.Number(),
            channel: Type.Number(),
            frequency: Type.Number()
          }),
          description: 'MIDI noteOn at nearest semitone with frequency metadata'
        },
        {
          schema: Type.Object({
            type: Type.Literal('noteOff'),
            note: Type.Number(),
            velocity: Type.Number(),
            channel: Type.Number(),
            frequency: Type.Number()
          }),
          description: 'MIDI noteOff with frequency metadata'
        }
      ]
    }
  ],
  tags: ['music', 'tuning', 'microtonal', 'gong', 'world', 'frequency', 'scale', 'midi']
};
