import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { Bang, Stop } from './common';
import {
  MidiControlChange,
  MidiNoteOff,
  MidiNoteOn,
  MidiPitchBend,
  MidiProgramChange
} from './midi-messages';

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
        { schema: MidiNoteOn, description: 'MIDI note on message' },
        { schema: MidiNoteOff, description: 'MIDI note off message' },
        { schema: MidiControlChange, description: 'MIDI control change message' },
        { schema: MidiProgramChange, description: 'MIDI program change message' },
        { schema: MidiPitchBend, description: 'MIDI pitch bend message' }
      ]
    }
  ],
  tags: ['midi', 'input', 'music', 'controller', 'hardware']
};
