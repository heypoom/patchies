import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { Bang, Stop } from './common';

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

const MidiInputEventType = Type.Union([
  Type.Literal('noteOn'),
  Type.Literal('noteOff'),
  Type.Literal('controlChange'),
  Type.Literal('programChange'),
  Type.Literal('pitchBend')
]);

const SetMidiInputConfig = Type.Object({
  type: Type.Literal('set'),
  deviceId: Type.String(),
  channel: Type.Number(),
  events: Type.Array(MidiInputEventType)
});

/**
 * Schema for the midi.in (MIDI input) object.
 */
export const midiInSchema: ObjectSchema = {
  type: 'midi.in',
  category: 'network',
  description: 'Receive MIDI messages from connected devices',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      handle: { handleType: 'message' },
      messages: [
        { schema: Bang, description: 'Start listening for MIDI input' },
        { schema: Stop, description: 'Stop listening for MIDI input' },
        { schema: SetMidiInputConfig, description: 'Set device, channel, and event filter' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'MIDI messages from connected devices',
      handle: { handleType: 'message' },
      messages: [
        { schema: NoteOn, description: 'MIDI note on message' },
        { schema: NoteOff, description: 'MIDI note off message' },
        { schema: ControlChange, description: 'MIDI control change message' }
      ]
    }
  ],
  tags: ['midi', 'input', 'music', 'controller', 'hardware']
};
