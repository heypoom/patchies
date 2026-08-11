import { afterEach, describe, expect, it, vi } from 'vitest';

import { getSequencerVisualStep, SequencerScheduler } from './sequencer-scheduler';

const transportState = vi.hoisted(() => ({
  seconds: 0,
  beat: 0,
  bpm: 120,
  phase: 0,
  beatsPerBar: 4,
  denominator: 4,
  ppq: 192,
  ticks: 0,
  isPlaying: false
}));

vi.mock('$lib/transport', () => ({
  Transport: {
    get seconds() {
      return transportState.seconds;
    },
    get beat() {
      return transportState.beat;
    },
    get bpm() {
      return transportState.bpm;
    },
    get phase() {
      return transportState.phase;
    },
    get beatsPerBar() {
      return transportState.beatsPerBar;
    },
    get denominator() {
      return transportState.denominator;
    },
    get ppq() {
      return transportState.ppq;
    },
    get ticks() {
      return transportState.ticks;
    },
    get isPlaying() {
      return transportState.isPlaying;
    }
  }
}));

describe('SequencerScheduler', () => {
  afterEach(() => {
    vi.useRealTimers();
    transportState.seconds = 0;
    transportState.beat = 0;
    transportState.bpm = 120;
    transportState.phase = 0;
    transportState.beatsPerBar = 4;
    transportState.denominator = 4;
    transportState.ppq = 192;
    transportState.ticks = 0;
    transportState.isPlaying = false;
  });

  it('returns the inactive sentinel for non-positive step counts', () => {
    transportState.isPlaying = true;

    expect(getSequencerVisualStep(0)).toBe(-1);
    expect(getSequencerVisualStep(-4)).toBe(-1);
  });

  it('keeps the step rate constant when the pattern length changes', () => {
    transportState.isPlaying = true;

    // Both patterns advance one step per tempo beat, regardless of the number
    // of steps in their pattern.
    transportState.ticks = 192;
    expect(getSequencerVisualStep(4)).toBe(1);
    expect(getSequencerVisualStep(32)).toBe(1);
  });

  it('lets patterns continue across a 5/4 bar boundary', () => {
    transportState.isPlaying = true;
    transportState.beatsPerBar = 5;

    transportState.ticks = 5 * transportState.ppq;
    expect(getSequencerVisualStep(8)).toBe(5);
  });

  it('fires 8-step patterns once per tempo beat in 5/4', () => {
    vi.useFakeTimers();
    transportState.isPlaying = true;
    transportState.beatsPerBar = 5;

    const onFire = vi.fn();
    const scheduler = new SequencerScheduler(
      'seq-1',
      () => ({ clockMode: 'auto', audioRate: true, steps: 8, swing: 0 }),
      onFire
    );

    scheduler.start();
    vi.advanceTimersByTime(25);

    transportState.seconds = 0.4;
    transportState.phase = 0.8;
    vi.advanceTimersByTime(25);
    scheduler.dispose();

    expect(onFire).toHaveBeenNthCalledWith(1, 0, 0);
    expect(onFire).toHaveBeenNthCalledWith(2, 1, 0.5);
  });

  it('schedules the first bar when transport starts in audio lookahead mode', () => {
    vi.useFakeTimers();

    const onFire = vi.fn();
    const scheduler = new SequencerScheduler(
      'seq-1',
      () => ({ clockMode: 'auto', audioRate: true, steps: 4, swing: 0 }),
      onFire
    );

    scheduler.start();
    vi.advanceTimersByTime(25);

    transportState.isPlaying = true;
    transportState.seconds = 0.025;
    transportState.phase = 0.05;

    vi.advanceTimersByTime(25);
    scheduler.dispose();

    expect(onFire).toHaveBeenCalled();
    expect(onFire).toHaveBeenCalledWith(0, 0);
  });

  it('does not double-schedule the current bar when already playing on start', () => {
    vi.useFakeTimers();

    transportState.isPlaying = true;
    transportState.seconds = 0.025;
    transportState.phase = 0.05;

    const onFire = vi.fn();
    const scheduler = new SequencerScheduler(
      'seq-1',
      () => ({ clockMode: 'auto', audioRate: true, steps: 4, swing: 0 }),
      onFire
    );

    scheduler.start();
    vi.advanceTimersByTime(25);
    scheduler.dispose();

    expect(onFire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenCalledWith(0, 0);
  });
});
