import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg, sym } from './helpers';
import { Bang, messages, Play, Set } from './common';

// Orca-specific message schemas
const Stop = sym('stop');
const SetBpm = msg('setBpm', { value: Type.Number() });

/** Pre-wrapped matchers for use with ts-pattern */
export const orcaMessages = {
  ...messages,
  setBpm: schema(SetBpm)
};

/**
 * Schema for the orca (Orca livecoding sequencer) object.
 */
export const orcaSchema: ObjectSchema = {
  type: 'orca',
  category: 'audio',
  description: 'Orca livecoding sequencer - esoteric programming language for procedural sequences',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        { schema: Set, description: 'Set the grid content' },
        { schema: Bang, description: 'Toggle play/pause' },
        { schema: Play, description: 'Start playback' },
        { schema: Stop, description: 'Stop playback' },
        { schema: SetBpm, description: 'Set tempo in BPM' }
      ]
    }
  ],
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
