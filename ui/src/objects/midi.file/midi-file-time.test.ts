import { describe, expect, it } from 'vitest';

import { midiTicksToSeconds } from './midi-file-time';
import type { ParsedMidiFile } from './midi-file-player';

const file: ParsedMidiFile = {
  fileName: 'timing.mid',
  ppq: 480,
  durationSeconds: 2,
  durationTicks: 960,
  trackCount: 1,
  events: [
    {
      seconds: 1,
      ticks: 480,
      track: 0,
      message: { type: 'noteOn', note: 60, velocity: 100, channel: 1 }
    }
  ],
  tempos: [{ tick: 0, seconds: 0, bpm: 120 }],
  timeSignatures: []
};

describe('midiTicksToSeconds', () => {
  it('converts exact tick positions without snapping to the next event', () => {
    expect(midiTicksToSeconds(240, file)).toBe(0.25);
  });

  it('walks tempo changes with the same default tempo as the parser', () => {
    const tempoFile: ParsedMidiFile = {
      ...file,
      durationSeconds: 4,
      durationTicks: 960,
      tempos: [{ tick: 480, seconds: 0.5, bpm: 60 }]
    };

    expect(midiTicksToSeconds(960, tempoFile)).toBe(1.5);
  });
});
