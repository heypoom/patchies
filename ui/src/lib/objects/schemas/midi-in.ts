import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

// MIDI message type schemas
const NoteOn = Type.Object({
  type: Type.Literal('noteOn'),
  note: Type.Number(),
  velocity: Type.Number(),
  channel: Type.Number()
});

const NoteOff = Type.Object({
  type: Type.Literal('noteOff'),
  note: Type.Number(),
  velocity: Type.Number(),
  channel: Type.Number()
});

const ControlChange = Type.Object({
  type: Type.Literal('controlChange'),
  control: Type.Number(),
  value: Type.Number(),
  channel: Type.Number()
});

/**
 * Schema for the midi.in (MIDI input) object.
 */
export const midiInSchema: ObjectSchema = {
  type: 'midi.in',
  category: 'network',
  description: 'Receive MIDI messages from connected devices',
  inlets: [],
  outlets: [
    {
      id: 'message',
      description: 'MIDI messages from connected devices',
      messages: [
        { schema: NoteOn, description: 'MIDI note on message' },
        { schema: NoteOff, description: 'MIDI note off message' },
        { schema: ControlChange, description: 'MIDI control change message' }
      ]
    }
  ],
  tags: ['midi', 'input', 'music', 'controller', 'hardware']
};
