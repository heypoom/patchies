import { describe, expect, it } from 'vitest';

import { normalizeSmplrMessage, normalizeVelocity, parseDefaultNote } from './messages';

const descriptor = {
  defaultBangNote: '60',
  defaultVelocity: 100
};

describe('smplr message mapping', () => {
  it('maps noteOn to a start event with note velocity time and duration', () => {
    expect(
      normalizeSmplrMessage(
        { type: 'noteOn', note: 64, velocity: 88, time: 12.5, duration: 0.75 },
        descriptor
      )
    ).toEqual({
      type: 'start',
      event: { note: 64, velocity: 88, time: 12.5, duration: 0.75 }
    });
  });

  it('maps velocity zero noteOn to a stop event', () => {
    expect(normalizeSmplrMessage({ type: 'noteOn', note: 64, velocity: 0 }, descriptor)).toEqual({
      type: 'stop',
      target: { stopId: 64 }
    });
  });

  it('maps noteOff to a stop event with stopId and time', () => {
    expect(normalizeSmplrMessage({ type: 'noteOff', note: 'C4', time: 8 }, descriptor)).toEqual({
      type: 'stop',
      target: { stopId: 'C4', time: 8 }
    });
  });

  it('maps bang value to default note velocity and scheduled time', () => {
    expect(normalizeSmplrMessage({ type: 'bang', value: 0.5, time: 4 }, descriptor)).toEqual({
      type: 'start',
      event: { note: 60, velocity: 64, time: 4 }
    });
  });

  it('maps numbers to default note velocity', () => {
    expect(normalizeSmplrMessage(2, descriptor)).toEqual({
      type: 'start',
      event: { note: 60, velocity: 127 }
    });
  });

  it('maps controlChange and set messages to runtime commands', () => {
    expect(
      normalizeSmplrMessage({ type: 'controlChange', control: 64, value: 127 }, descriptor)
    ).toEqual({ type: 'cc', control: 64, value: 127 });

    expect(
      normalizeSmplrMessage({ type: 'controlChange', control: 200, value: -10 }, descriptor)
    ).toEqual({ type: 'cc', control: 127, value: 0 });

    expect(normalizeSmplrMessage({ type: 'programChange', program: 10 }, descriptor)).toEqual({
      type: 'program',
      program: 10
    });

    expect(normalizeSmplrMessage({ type: 'setGain', value: 84 }, descriptor)).toEqual({
      type: 'volume',
      value: 84
    });

    expect(normalizeSmplrMessage({ type: 'setDetune', value: -12 }, descriptor)).toEqual({
      type: 'detune',
      value: -12
    });

    expect(normalizeSmplrMessage({ type: 'setReverse', value: true }, descriptor)).toEqual({
      type: 'reverse',
      value: true
    });
  });

  it('normalizes velocity values and parses default notes', () => {
    expect(normalizeVelocity(undefined, 91)).toBe(91);
    expect(normalizeVelocity(0.25, 91)).toBe(32);
    expect(normalizeVelocity(127, 91)).toBe(127);
    expect(normalizeVelocity(200, 91)).toBe(127);
    expect(parseDefaultNote('60')).toBe(60);
    expect(parseDefaultNote('kick')).toBe('kick');
  });
});
