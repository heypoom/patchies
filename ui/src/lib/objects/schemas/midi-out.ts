import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { Bang } from './common';
import {
  MidiChannelPressure,
  MidiControlChange,
  MidiNoteOff,
  MidiNoteOn,
  MidiPitchBend,
  MidiPolyPressure,
  MidiProgramChange,
  MidiRaw
} from './midi-messages';

const MidiOutputChannelEvent = Type.Union([
  Type.Literal('noteOn'),
  Type.Literal('noteOff'),
  Type.Literal('controlChange'),
  Type.Literal('programChange'),
  Type.Literal('pitchBend'),
  Type.Literal('channelPressure'),
  Type.Literal('polyPressure')
]);

const MidiOutputEvent = Type.Union([
  Type.Literal('noteOn'),
  Type.Literal('noteOff'),
  Type.Literal('controlChange'),
  Type.Literal('programChange'),
  Type.Literal('pitchBend'),
  Type.Literal('channelPressure'),
  Type.Literal('polyPressure'),
  Type.Literal('raw')
]);

const SetMidiOutputConfig = Type.Object({
  type: Type.Literal('set'),
  deviceId: Type.Optional(Type.String()),
  channel: Type.Optional(Type.Number()),
  active: Type.Optional(Type.Boolean()),
  event: Type.Optional(MidiOutputEvent),
  note: Type.Optional(Type.Number()),
  velocity: Type.Optional(Type.Number()),
  control: Type.Optional(Type.Number()),
  value: Type.Optional(Type.Number()),
  program: Type.Optional(Type.Number()),
  pressure: Type.Optional(Type.Number()),
  data: Type.Optional(Type.Array(Type.Number()))
});

const SendMidiOutputChannelConfig = Type.Object({
  type: Type.Literal('send'),
  deviceId: Type.String(),
  channel: Type.Number(),
  event: MidiOutputChannelEvent,
  note: Type.Optional(Type.Number()),
  velocity: Type.Optional(Type.Number()),
  control: Type.Optional(Type.Number()),
  value: Type.Optional(Type.Number()),
  program: Type.Optional(Type.Number()),
  pressure: Type.Optional(Type.Number())
});

const SendMidiOutputRawConfig = Type.Object({
  type: Type.Literal('send'),
  deviceId: Type.String(),
  event: Type.Literal('raw'),
  data: Type.Array(Type.Number())
});

const SendMidiOutputConfig = Type.Union([SendMidiOutputChannelConfig, SendMidiOutputRawConfig]);

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
      handle: { handleType: 'message' },
      messages: [
        { schema: Bang, description: 'Send the currently configured MIDI message' },
        { schema: MidiNoteOn, description: 'Send MIDI note on' },
        { schema: MidiNoteOff, description: 'Send MIDI note off' },
        { schema: MidiControlChange, description: 'Send MIDI control change' },
        { schema: MidiProgramChange, description: 'Send MIDI program change' },
        { schema: MidiPitchBend, description: 'Send MIDI pitch bend' },
        { schema: MidiChannelPressure, description: 'Send MIDI channel pressure' },
        { schema: MidiPolyPressure, description: 'Send MIDI poly pressure' },
        { schema: MidiRaw, description: 'Send raw MIDI bytes' },
        { schema: SetMidiOutputConfig, description: 'Update output configuration' },
        { schema: SendMidiOutputConfig, description: 'Send an explicit MIDI output configuration' }
      ]
    }
  ],
  outlets: [],
  tags: ['midi', 'output', 'music', 'synthesizer', 'hardware']
};
