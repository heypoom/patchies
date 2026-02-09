import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg, sym } from './helpers';
import { messages } from './common';

// Orca-specific message schemas
const SetValue = msg('set', { value: Type.String() });
const Play = sym('play');
const Stop = sym('stop');
const SetBpm = msg('setBpm', { value: Type.Number() });

/** Pre-wrapped matchers for use with ts-pattern */
export const orcaMessages = {
  ...messages,
  setValue: schema(SetValue),
  play: schema(Play),
  stop: schema(Stop),
  setBpm: schema(SetBpm)
};

/**
 * Schema for the orca (Orca livecoding sequencer) object.
 */
export const orcaSchema: ObjectSchema = {
  type: 'orca',
  category: 'audio',
  description: 'Orca livecoding sequencer - esoteric programming language for procedural sequences',
  inlets: [],
  outlets: [
    {
      id: 'message',
      description: 'MIDI messages output',
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
  tags: ['audio', 'sequencer', 'livecoding', 'midi', 'esoteric']
};
