import { describe, expect, it } from 'vitest';

import { getSequencerData, sequencerMessageReducer } from './sequencer-state';

describe('sequencer state', () => {
  it('defaults unsupported persisted step counts before state is used', () => {
    expect(getSequencerData({ steps: 8 }).steps).toBe(8);
    expect(getSequencerData({ steps: 6 }).steps).toBe(16);
    expect(getSequencerData({ steps: 1_000_000 }).steps).toBe(16);
  });

  it('rejects unsupported step-count messages before allocating track arrays', () => {
    const data = getSequencerData({ steps: 16 });

    expect(sequencerMessageReducer(data, { type: 'setStepCount', value: 6 })).toBeNull();
    expect(sequencerMessageReducer(data, { type: 'setStepCount', value: 8 })).toMatchObject({
      updates: { steps: 8 }
    });
  });

  it('normalizes persisted output modes against their outlet mode', () => {
    expect(getSequencerData({ outletMode: 'single', outputMode: 'midi' }).outputMode).toBe('midi');
    expect(getSequencerData({ outletMode: 'single', outputMode: 'bang' }).outputMode).toBe('index');
    expect(getSequencerData({ outletMode: 'multi', outputMode: 'value' }).outputMode).toBe('value');
    expect(getSequencerData({ outletMode: 'multi', outputMode: 'midi' }).outputMode).toBe('bang');
  });

  it('keeps resizing disabled unless explicitly enabled', () => {
    expect(getSequencerData({}).resizable).toBe(false);
    expect(getSequencerData({ resizable: true }).resizable).toBe(true);
  });
});
