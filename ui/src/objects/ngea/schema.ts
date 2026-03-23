import { Type } from '@sinclair/typebox';

import type { ObjectSchema } from '$lib/objects/schemas/types';
import { Bang } from '$lib/objects/schemas/common';

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
      description: 'Gong index (0-based) or bang to output current; set tuning name',
      handle: { handleType: 'message' },
      messages: [
        { schema: Type.Number(), description: 'Output gong data at this index (0-based)' },
        { schema: Bang, description: 'Output gong data at current index' },
        { schema: Type.String(), description: 'Switch to a named tuning (partial match)' }
      ]
    }
  ],
  outlets: [
    {
      id: 'gong',
      description: 'Gong data for the triggered index',
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
          description:
            'Gong data: index, id, freq (Hz), cents interval, accumulate (cents from root)'
        }
      ]
    },
    {
      id: 'scale',
      description: 'Full tuning scale info (bang on inlet to trigger)',
      handle: { handleType: 'message', handleId: 1 },
      messages: [
        {
          schema: Type.Object({
            type: Type.Literal('scale'),
            name: Type.String(),
            location: Type.String(),
            freqs: Type.Array(Type.Number()),
            cents: Type.Array(Type.Number())
          }),
          description: 'Scale info: name, location, freqs[], cents[]'
        }
      ]
    }
  ],
  tags: ['music', 'tuning', 'microtonal', 'gong', 'world', 'frequency', 'scale']
};
