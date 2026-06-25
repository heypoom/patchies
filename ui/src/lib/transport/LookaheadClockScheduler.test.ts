import { afterEach, describe, expect, it, vi } from 'vitest';

import { LookaheadClockScheduler } from './LookaheadClockScheduler';
import type { ClockState } from './ClockScheduler';

describe('LookaheadClockScheduler', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires an audio beat callback once for the same lookahead beat', () => {
    vi.useFakeTimers();

    let clock: ClockState = {
      time: 0.41,
      beat: 0,
      bpm: 120,
      phase: 0.82,
      beatsPerBar: 4
    };

    const callback = vi.fn();
    const scheduler = new LookaheadClockScheduler(() => clock, 25, 0.1, { error: vi.fn() });

    scheduler.onBeat('*', callback, { audio: true });
    scheduler.start();

    const pollsForSameUpcomingBeat: ClockState[] = [
      clock,
      { time: 0.435, beat: 0, bpm: 120, phase: 0.869999, beatsPerBar: 4 },
      { time: 0.46, beat: 0, bpm: 120, phase: 0.92, beatsPerBar: 4 }
    ];

    for (const pollState of pollsForSameUpcomingBeat) {
      clock = pollState;
      vi.advanceTimersByTime(25);
    }

    scheduler.stop();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(expect.closeTo(0.5, 6));
  });
});
