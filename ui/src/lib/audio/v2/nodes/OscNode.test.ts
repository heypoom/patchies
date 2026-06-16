import { describe, expect, it, vi } from 'vitest';

import { OscNode } from './OscNode';

function createFakeOscillator() {
  return {
    frequency: { value: 0 },
    detune: { value: 0 },
    type: 'sine',
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
    setPeriodicWave: vi.fn()
  };
}

describe('OscNode', () => {
  it('creates an oscillator from frequency, type, and detune params', () => {
    const oscillator = createFakeOscillator();
    const audioContext = {
      createOscillator: () => oscillator
    } as unknown as AudioContext;
    const node = new OscNode('osc-1', audioContext);

    node.create([440, 'sine', 12]);

    expect(oscillator.frequency.value).toBe(440);
    expect(oscillator.type).toBe('sine');
    expect(oscillator.detune.value).toBe(12);
    expect(oscillator.start).toHaveBeenCalledWith(0);
  });
});
