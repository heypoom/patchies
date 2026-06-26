import { describe, expect, it } from 'vitest';

import {
  createSequencerPayload,
  sequencerOutputCarriesTiming,
  transportTimeToAudioContextTime
} from './sequencer-output';

describe('sequencer output payloads', () => {
  it('adds time to bang output only when audio lookahead is enabled', () => {
    expect(
      createSequencerPayload({
        outletMode: 'multi',
        outputMode: 'bang',
        audioRate: false,
        trackIndex: 0,
        velocity: 0.75,
        time: 12.5
      })
    ).toEqual({ type: 'bang' });

    expect(
      createSequencerPayload({
        outletMode: 'multi',
        outputMode: 'bang',
        audioRate: true,
        trackIndex: 0,
        velocity: 0.75,
        time: 12.5
      })
    ).toEqual({ type: 'bang', time: 12.5 });
  });

  it('keeps value output as a number unless audio lookahead is enabled', () => {
    expect(
      createSequencerPayload({
        outletMode: 'multi',
        outputMode: 'value',
        audioRate: false,
        trackIndex: 0,
        velocity: 0.75,
        time: 12.5
      })
    ).toBe(0.75);

    expect(
      createSequencerPayload({
        outletMode: 'multi',
        outputMode: 'value',
        audioRate: true,
        trackIndex: 0,
        velocity: 0.75,
        time: 12.5
      })
    ).toEqual({ type: 'bang', time: 12.5, value: 0.75 });
  });

  it('adds scheduled bang metadata to single index output when audio lookahead is enabled', () => {
    const options = {
      outletMode: 'single' as const,
      outputMode: 'index' as const,
      trackIndex: 2,
      velocity: 0.75,
      time: 12.5
    };

    expect(createSequencerPayload({ ...options, audioRate: false })).toBe(2);
    expect(createSequencerPayload({ ...options, audioRate: true })).toEqual({
      type: 'bang',
      index: 2,
      value: 0.75,
      time: 12.5
    });
  });

  it('adds time to single midi output only when audio lookahead is enabled', () => {
    expect(
      createSequencerPayload({
        outletMode: 'single',
        outputMode: 'midi',
        audioRate: false,
        trackIndex: 2,
        velocity: 0.75,
        time: 12.5
      })
    ).toEqual({ type: 'noteOn', note: 38, index: 2, velocity: 95 });

    expect(
      createSequencerPayload({
        outletMode: 'single',
        outputMode: 'midi',
        audioRate: true,
        trackIndex: 2,
        velocity: 0.75,
        time: 12.5
      })
    ).toEqual({ type: 'noteOn', note: 38, index: 2, velocity: 95, time: 12.5 });
  });

  it('identifies which outputs can carry timing', () => {
    expect(sequencerOutputCarriesTiming('multi', 'bang')).toBe(true);
    expect(sequencerOutputCarriesTiming('multi', 'value')).toBe(true);
    expect(sequencerOutputCarriesTiming('single', 'index')).toBe(true);
    expect(sequencerOutputCarriesTiming('single', 'midi')).toBe(true);
  });

  it('rejects invalid outlet/output mode combinations', () => {
    expect(() =>
      createSequencerPayload({
        outletMode: 'multi',
        outputMode: 'index',
        audioRate: false,
        trackIndex: 2,
        velocity: 0.75,
        time: 12.5
      } as never)
    ).toThrow('Invalid sequencer output mode');

    expect(() =>
      createSequencerPayload({
        outletMode: 'single',
        outputMode: 'value',
        audioRate: false,
        trackIndex: 2,
        velocity: 0.75,
        time: 12.5
      } as never)
    ).toThrow('Invalid sequencer output mode');
  });

  it('converts scheduled transport time to AudioContext time', () => {
    expect(
      transportTimeToAudioContextTime({
        scheduledTransportTime: 12.08,
        currentTransportTime: 12,
        audioContextTime: 30
      })
    ).toBeCloseTo(30.08);
  });

  it('clamps late scheduled transport times to the current AudioContext time', () => {
    expect(
      transportTimeToAudioContextTime({
        scheduledTransportTime: 11.98,
        currentTransportTime: 12,
        audioContextTime: 30
      })
    ).toBe(30);
  });
});
