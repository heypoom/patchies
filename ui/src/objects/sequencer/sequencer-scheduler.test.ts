import { afterEach, describe, expect, it, vi } from 'vitest';

import { SequencerScheduler } from './sequencer-scheduler';

const transportState = vi.hoisted(() => ({
  seconds: 0,
  beat: 0,
  bpm: 120,
  phase: 0,
  beatsPerBar: 4,
  denominator: 4,
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
    transportState.isPlaying = false;
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
