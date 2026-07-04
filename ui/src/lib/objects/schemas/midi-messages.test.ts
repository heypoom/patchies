import { Value } from '@sinclair/typebox/value';
import { describe, expect, it } from 'vitest';

import { MidiNoteOff, MidiNoteOn } from '$lib/objects/schemas/midi-messages';

describe('MIDI message schemas', () => {
  it('accept timed note messages', () => {
    expect(Value.Check(MidiNoteOn, { type: 'noteOn', note: 60, velocity: 127, time: 12.5 })).toBe(
      true
    );

    expect(Value.Check(MidiNoteOn, { type: 'noteOn', note: 60, velocity: 127, channel: 1 })).toBe(
      true
    );

    expect(Value.Check(MidiNoteOff, { type: 'noteOff', note: 60, time: 13 })).toBe(true);
  });
});
