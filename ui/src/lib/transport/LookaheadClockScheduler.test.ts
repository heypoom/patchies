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

  it('fires an audio beat callback again after transport rewinds before that beat', () => {
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

    vi.advanceTimersByTime(25);

    clock = {
      time: 0.2,
      beat: 0,
      bpm: 120,
      phase: 0.4,
      beatsPerBar: 4
    };
    vi.advanceTimersByTime(25);

    clock = {
      time: 0.41,
      beat: 0,
      bpm: 120,
      phase: 0.82,
      beatsPerBar: 4
    };
    vi.advanceTimersByTime(25);

    scheduler.stop();

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(1, expect.closeTo(0.5, 6));
    expect(callback).toHaveBeenNthCalledWith(2, expect.closeTo(0.5, 6));
  });

  it('fires an audio every callback once while polling before the scheduled time', () => {
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

    scheduler.every('0:1:0', callback, { audio: true });
    scheduler.start();

    const pollsBeforeScheduledTime: ClockState[] = [
      clock,
      { time: 0.435, beat: 0, bpm: 120, phase: 0.87, beatsPerBar: 4 },
      { time: 0.46, beat: 0, bpm: 120, phase: 0.92, beatsPerBar: 4 }
    ];

    for (const pollState of pollsBeforeScheduledTime) {
      clock = pollState;
      vi.advanceTimersByTime(25);
    }

    scheduler.stop();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(expect.closeTo(0.5, 6));
  });
});
