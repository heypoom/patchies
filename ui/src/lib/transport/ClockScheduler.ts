/**
 * Clock Scheduling API
 *
 * Unified scheduling interface for beat-synced visuals that works across
 * all environments (main thread and workers) with best-available precision.
 *
 * - Main thread + Tone.js: Audio-synced (~5ms precision)
 * - Main thread + Stub / Workers: Frame-based (~16ms precision)
 */

/**
 * Clock scheduler interface for beat-synced callbacks.
 */
export interface ClockScheduler {
  /**
   * Subscribe to beat changes. Callback fires when the specified beat is reached.
   * @param beat - Beat number (0-3), array of beats, or "*" for all beats
   * @param callback - Function to call when beat is reached
   * @returns ID for cancellation
   */
  onBeat(beat: number | number[] | '*', callback: () => void): string;

  /**
   * Schedule a one-shot callback at a specific transport time.
   * @param time - Absolute time in seconds, or "bar:beat:sixteenth" notation
   * @param callback - Function to call at the specified time
   * @returns ID for cancellation
   */
  schedule(time: number | string, callback: () => void): string;

  /**
   * Schedule a repeating callback at a musical interval.
   * @param interval - Interval in "bar:beat:sixteenth" notation (e.g., "1:0:0" = every bar)
   * @param callback - Function to call at each interval
   * @returns ID for cancellation
   */
  every(interval: string, callback: () => void): string;

  /**
   * Cancel a scheduled callback by its ID.
   */
  cancel(id: string): void;

  /**
   * Cancel all scheduled callbacks.
   */
  cancelAll(): void;
}

/**
 * Clock state passed to scheduler tick().
 */
export interface ClockState {
  time: number;
  beat: number;
  bpm: number;
}

type ClockWithScheduler = {
  readonly time: number;
  readonly beat: number;
  readonly phase: number;
  readonly bpm: number;
  onBeat: ClockScheduler['onBeat'];
  schedule: ClockScheduler['schedule'];
  every: ClockScheduler['every'];
  cancel: ClockScheduler['cancel'];
  cancelAll: ClockScheduler['cancelAll'];
};

let idCounter = 0;

function generateId(): string {
  return `sched_${++idCounter}_${Date.now()}`;
}

/**
 * Parse "bar:beat:sixteenth" notation to seconds.
 * @param notation - Time notation like "4:0:0" (bar 4, beat 0, sixteenth 0)
 * @param bpm - Beats per minute
 * @returns Time in seconds
 */
export function parseBarBeatSixteenth(notation: string, bpm: number): number {
  const parts = notation.split(':').map(Number);
  const bars = parts[0] ?? 0;
  const beats = parts[1] ?? 0;
  const sixteenths = parts[2] ?? 0;

  const beatsPerSecond = bpm / 60;
  const totalBeats = bars * 4 + beats + sixteenths / 4;
  return totalBeats / beatsPerSecond;
}

type BeatCallback = { beats: number[] | '*'; callback: () => void };
type ScheduleCallback = { time: number; callback: () => void; fired: boolean };
type RepeatCallback = { interval: number; lastFired: number; callback: () => void; bpm: number };

/**
 * Polling-based clock scheduler for stub transport and worker environments.
 * Uses frame-based polling (~16ms precision at 60fps).
 */
export class PollingClockScheduler implements ClockScheduler {
  private lastBeat = -1;
  private currentBpm = 120;

  private beatCallbacks = new Map<string, BeatCallback>();
  private scheduleCallbacks = new Map<string, ScheduleCallback>();
  private repeatCallbacks = new Map<string, RepeatCallback>();

  /**
   * Called each frame by the render loop to process scheduled callbacks.
   */
  tick(clock: ClockState): void {
    this.currentBpm = clock.bpm;

    // Check beat changes
    if (clock.beat !== this.lastBeat) {
      for (const [, { beats, callback }] of this.beatCallbacks) {
        const shouldFire = beats === '*' || (Array.isArray(beats) && beats.includes(clock.beat));

        if (shouldFire) {
          try {
            callback();
          } catch (e) {
            console.error('[ClockScheduler] onBeat callback error:', e);
          }
        }
      }

      this.lastBeat = clock.beat;
    }

    // Check one-shot schedules
    for (const [id, item] of this.scheduleCallbacks) {
      if (!item.fired && clock.time >= item.time) {
        try {
          item.callback();
        } catch (e) {
          console.error('[ClockScheduler] schedule callback error:', e);
        }

        item.fired = true;
        this.scheduleCallbacks.delete(id);
      }
    }

    // Check repeating schedules
    for (const [, item] of this.repeatCallbacks) {
      // Recalculate interval if BPM changed
      if (item.bpm !== clock.bpm) {
        // Preserve relative position when BPM changes
        const ratio = item.bpm / clock.bpm;

        item.interval = item.interval * ratio;
        item.bpm = clock.bpm;
      }

      if (clock.time >= item.lastFired + item.interval) {
        try {
          item.callback();
        } catch (e) {
          console.error('[ClockScheduler] every callback error:', e);
        }

        item.lastFired = clock.time;
      }
    }
  }

  onBeat(beat: number | number[] | '*', callback: () => void): string {
    const id = generateId();
    const beats = typeof beat === 'number' ? [beat] : beat;

    this.beatCallbacks.set(id, { beats, callback });

    return id;
  }

  schedule(time: number | string, callback: () => void): string {
    const id = generateId();
    const timeNum = typeof time === 'string' ? parseBarBeatSixteenth(time, this.currentBpm) : time;

    this.scheduleCallbacks.set(id, { time: timeNum, callback, fired: false });

    return id;
  }

  every(interval: string, callback: () => void): string {
    const id = generateId();
    const intervalSecs = parseBarBeatSixteenth(interval, this.currentBpm);

    this.repeatCallbacks.set(id, {
      interval: intervalSecs,
      lastFired: 0,
      callback,
      bpm: this.currentBpm
    });

    return id;
  }

  cancel(id: string): void {
    this.beatCallbacks.delete(id);
    this.scheduleCallbacks.delete(id);
    this.repeatCallbacks.delete(id);
  }

  cancelAll(): void {
    this.beatCallbacks.clear();
    this.scheduleCallbacks.clear();
    this.repeatCallbacks.clear();
    this.lastBeat = -1;
  }
}

/**
 * Create a clock object with scheduling methods bound to a scheduler.
 * The clock object provides both read-only time state and scheduling methods.
 */
export const createClockWithScheduler = (
  getTime: () => number,
  getBeat: () => number,
  getPhase: () => number,
  getBpm: () => number,
  scheduler: ClockScheduler
): ClockWithScheduler => ({
  get time() {
    return getTime();
  },
  get beat() {
    return getBeat();
  },
  get phase() {
    return getPhase();
  },
  get bpm() {
    return getBpm();
  },
  onBeat: scheduler.onBeat.bind(scheduler),
  schedule: scheduler.schedule.bind(scheduler),
  every: scheduler.every.bind(scheduler),
  cancel: scheduler.cancel.bind(scheduler),
  cancelAll: scheduler.cancelAll.bind(scheduler)
});
