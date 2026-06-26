import { describe, expect, it } from 'vitest';

import { createSequencerPayload } from './sequencer-output';

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
    ).toEqual({ type: 'set', time: 12.5, value: 0.75 });
  });
});
