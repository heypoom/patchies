import { describe, expect, it } from 'vitest';
import { toWamMidiEvent } from './wam-midi';

describe('toWamMidiEvent', () => {
  it('converts Patchies note messages into scheduled WAM MIDI bytes', () => {
    expect(
      toWamMidiEvent({ type: 'noteOn', note: 60, velocity: 100, channel: 2, time: 12.5 }, 1)
    ).toEqual({
      type: 'wam-midi',
      time: 12.5,
      data: { bytes: [0x91, 60, 100] }
    });

    expect(toWamMidiEvent({ type: 'noteOff', note: 60, channel: 2 }, 1)).toEqual({
      type: 'wam-midi',
      time: 1,
      data: { bytes: [0x81, 60, 0] }
    });
  });

  it('converts normalized pitch bend and preserves raw MIDI bytes', () => {
    expect(toWamMidiEvent({ type: 'pitchBend', value: -1, channel: 1 }, 2)).toEqual({
      type: 'wam-midi',
      time: 2,
      data: { bytes: [0xe0, 0, 0] }
    });

    expect(toWamMidiEvent({ type: 'pitchBend', value: 1, channel: 1 }, 2)).toEqual({
      type: 'wam-midi',
      time: 2,
      data: { bytes: [0xe0, 127, 127] }
    });

    expect(toWamMidiEvent({ type: 'raw', data: [0x90, 60, 127] }, 2)).toEqual({
      type: 'wam-midi',
      time: 2,
      data: { bytes: [0x90, 60, 127] }
    });
  });
});
