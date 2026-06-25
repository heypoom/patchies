import { describe, expect, it, vi } from 'vitest';

import { PollingClockScheduler } from './PollingClockScheduler';
import type { ClockState } from './ClockScheduler';

describe('PollingClockScheduler', () => {
  it('fires play state change callbacks from ticked clock state', () => {
    const scheduler = new PollingClockScheduler();
    const callback = vi.fn();
    const stopped: ClockState = {
      time: 0,
      beat: 0,
      bpm: 120,
      isPlaying: false,
      playState: 'stopped'
    };

    scheduler.onPlayStateChange(callback);
    scheduler.tick(stopped);
    scheduler.tick({ ...stopped, time: 0.25, isPlaying: true, playState: 'playing' });
    scheduler.tick({ ...stopped, time: 0.5, isPlaying: false, playState: 'paused' });

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(1, 'playing', 0.25);
    expect(callback).toHaveBeenNthCalledWith(2, 'paused', 0.5);
  });
});
