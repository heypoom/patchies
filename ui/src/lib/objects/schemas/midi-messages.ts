import { Type } from '@sinclair/typebox';

/**
 * Standard Patchies MIDI message schemas shared by MIDI objects.
 */
export const MidiNoteOn = Type.Object({
  type: Type.Literal('noteOn'),
  note: Type.Number(),
  velocity: Type.Number(),
  time: Type.Optional(Type.Number()),
  channel: Type.Optional(Type.Number())
});

export const MidiNoteOff = Type.Object({
  type: Type.Literal('noteOff'),
  note: Type.Number(),
  velocity: Type.Optional(Type.Number()),
  time: Type.Optional(Type.Number()),
  channel: Type.Optional(Type.Number())
});

export const MidiControlChange = Type.Object({
  type: Type.Literal('controlChange'),
  control: Type.Number(),
  value: Type.Number(),
  channel: Type.Optional(Type.Number())
});

export const MidiProgramChange = Type.Object({
  type: Type.Literal('programChange'),
  program: Type.Number(),
  channel: Type.Optional(Type.Number())
});

export const MidiPitchBend = Type.Object({
  type: Type.Literal('pitchBend'),
  value: Type.Number(),
  control: Type.Optional(Type.Number()),
  channel: Type.Optional(Type.Number())
});

export const MidiChannelPressure = Type.Object({
  type: Type.Literal('channelPressure'),
  pressure: Type.Number(),
  channel: Type.Optional(Type.Number())
});

export const MidiPolyPressure = Type.Object({
  type: Type.Literal('polyPressure'),
  note: Type.Number(),
  pressure: Type.Number(),
  channel: Type.Optional(Type.Number())
});

export const MidiRaw = Type.Object({
  type: Type.Literal('raw'),
  data: Type.Array(Type.Number()),
  deviceId: Type.Optional(Type.String()),
  channel: Type.Optional(Type.Number())
});
