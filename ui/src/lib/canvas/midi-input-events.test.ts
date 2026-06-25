import { describe, expect, it } from 'vitest';

import { toChannelPressureMessage, toPolyPressureMessage } from './midi-input-events';

describe('MIDI input event normalization', () => {
  it('normalizes channel pressure events with raw pressure and channel', () => {
    expect(
      toChannelPressureMessage({
        rawValue: 72,
        message: { channel: 3 }
      })
    ).toEqual({ type: 'channelPressure', pressure: 72, channel: 3 });
  });

  it('normalizes poly pressure events with note, raw pressure, and channel', () => {
    expect(
      toPolyPressureMessage({
        note: { number: 64 },
        rawValue: 45,
        message: { channel: 2 }
      })
    ).toEqual({ type: 'polyPressure', note: 64, pressure: 45, channel: 2 });
  });
});
