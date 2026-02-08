import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

// MIDI message type schemas
const NoteOn = Type.Object({
  type: Type.Literal('noteOn'),
  note: Type.Number(),
  velocity: Type.Number(),
  channel: Type.Optional(Type.Number())
});

const NoteOff = Type.Object({
  type: Type.Literal('noteOff'),
  note: Type.Number(),
  velocity: Type.Optional(Type.Number()),
  channel: Type.Optional(Type.Number())
});

const ControlChange = Type.Object({
  type: Type.Literal('controlChange'),
  control: Type.Number(),
  value: Type.Number(),
  channel: Type.Optional(Type.Number())
});

/**
 * Schema for the midi.out (MIDI output) object.
 */
export const midiOutSchema: ObjectSchema = {
  type: 'midi.out',
  category: 'network',
  description: 'Send MIDI messages to external devices or software',
  inlets: [
    {
      id: 'message',
      description: 'MIDI messages to send',
      messages: [
        { schema: NoteOn, description: 'Send MIDI note on' },
        { schema: NoteOff, description: 'Send MIDI note off' },
        { schema: ControlChange, description: 'Send MIDI control change' }
      ]
    }
  ],
  outlets: [],
  tags: ['midi', 'output', 'music', 'synthesizer', 'hardware']
};
