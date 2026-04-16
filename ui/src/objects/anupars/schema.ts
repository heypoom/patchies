import { Type } from '@sinclair/typebox';

import type { ObjectSchema } from '$lib/objects/schemas/types';
import { Bang, Play } from '$lib/objects/schemas/common';
import { schema } from '$lib/objects/schemas/types';
import { msg, sym } from '$lib/objects/schemas/helpers';
import { messages } from '$lib/objects/schemas/common';

// Anupars-specific message schemas
const Stop = sym('stop');

/** Pre-wrapped matchers for use with ts-pattern */
export const anuparsMessages = {
  ...messages,
  stop: schema(Stop)
};

/**
 * Schema for the anupars (regex-driven terminal sequencer) object.
 */
export const anuparsSchema: ObjectSchema = {
  type: 'anupars',
  category: 'music',
  description:
    'Regex-driven terminal sequencer — roguelike musical sequencer using regular expressions',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      handle: { handleType: 'message' },
      messages: [
        { schema: Bang, description: 'Toggle play/pause' },
        { schema: Play, description: 'Start playback' },
        { schema: Stop, description: 'Stop playback' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'MIDI messages output',
      handle: { handleType: 'message' },
      messages: [
        {
          schema: Type.Object({
            type: Type.Literal('noteOn'),
            note: Type.Number(),
            velocity: Type.Number(),
            channel: Type.Number()
          }),
          description: 'MIDI note on message'
        },
        {
          schema: Type.Object({
            type: Type.Literal('noteOff'),
            note: Type.Number(),
            channel: Type.Number()
          }),
          description: 'MIDI note off message'
        },
        {
          schema: Type.Object({
            type: Type.Literal('controlChange'),
            control: Type.Number(),
            value: Type.Number(),
            channel: Type.Number()
          }),
          description: 'MIDI control change message'
        }
      ]
    }
  ],
  tags: ['audio', 'sequencer', 'midi', 'regex', 'terminal', 'esoteric']
};
