import { describe, expect, it } from 'vitest';

import { ChannelSustainPedals, normalizeSustainPedalValue, SustainPedal } from './SustainPedal';

describe('SustainPedal', () => {
  it('holds note-offs until the pedal is released', () => {
    const pedal = new SustainPedal<string>();

    expect(pedal.hold('C4')).toBe(false);
    expect(pedal.set(1)).toEqual([]);
    expect(pedal.isDown).toBe(true);
    expect(pedal.hold('C4')).toBe(true);
    expect(pedal.hold('E4')).toBe(true);
    expect(pedal.set(0)).toEqual(['C4', 'E4']);
    expect(pedal.isDown).toBe(false);
  });

  it('normalizes Patchies pedal-on values for raw MIDI consumers', () => {
    expect(normalizeSustainPedalValue(1)).toBe(127);
    expect(normalizeSustainPedalValue(64)).toBe(64);
    expect(normalizeSustainPedalValue(0)).toBe(0);
  });

  it('keeps pedal state independent for each channel', () => {
    const pedals = new ChannelSustainPedals<string>();

    pedals.set(1, 1);
    pedals.hold(1, 'C4');
    pedals.hold(2, 'D4');

    expect(pedals.isDown(1)).toBe(true);
    expect(pedals.isDown(2)).toBe(false);
    expect(pedals.set(2, 0)).toEqual([]);
    expect(pedals.set(1, 0)).toEqual(['C4']);
  });
});
