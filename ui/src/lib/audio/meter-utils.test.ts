import { describe, expect, it } from 'vitest';

import {
  amplitudeToMeterPosition,
  calculateRms,
  updateMeterChannels,
  type MeterChannelState
} from './meter-utils';

describe('meter utils', () => {
  it('calculates RMS for a single channel of audio samples', () => {
    const rms = calculateRms(Float32Array.from([1, -1, 0, 0]));

    expect(rms).toBeCloseTo(Math.sqrt(0.5));
  });

  it('creates one meter state per input channel', () => {
    const channels = updateMeterChannels({
      previous: [],
      levels: [0.25, 0.5, 0.75],
      smoothing: 0.8,
      peakHold: true,
      now: 100
    });

    expect(channels.map((channel) => channel.level)).toEqual([0.25, 0.5, 0.75]);
    expect(channels.map((channel) => channel.peak)).toEqual([0.25, 0.5, 0.75]);
  });

  it('smooths and holds peaks independently per channel', () => {
    const previous: MeterChannelState[] = [
      { level: 0.8, peak: 0.8, peakHoldTime: 100 },
      { level: 0.1, peak: 0.1, peakHoldTime: 100 }
    ];

    const channels = updateMeterChannels({
      previous,
      levels: [0.3, 0.5],
      smoothing: 0.75,
      peakHold: true,
      now: 200
    });

    expect(channels[0].level).toBeCloseTo(0.675);
    expect(channels[0].peak).toBeCloseTo(0.8);
    expect(channels[0].peakHoldTime).toBe(100);

    expect(channels[1].level).toBeCloseTo(0.5);
    expect(channels[1].peak).toBeCloseTo(0.5);
    expect(channels[1].peakHoldTime).toBe(200);
  });

  it('maps silence and full scale to the meter range', () => {
    expect(amplitudeToMeterPosition(0)).toBe(0);
    expect(amplitudeToMeterPosition(1)).toBe(1);
  });
});
