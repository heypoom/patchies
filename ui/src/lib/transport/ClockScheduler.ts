/**
 * Clock Scheduling API
 *
 * Unified scheduling interface for beat-synced callbacks that works across
 * all environments (main thread and workers) with best-available precision.
 *
 * - Main thread (LookaheadClockScheduler): Look-ahead scheduling with precise
 *   audio time passed to callbacks (~25ms look-ahead, sub-ms scheduling accuracy)
 * - Workers (PollingClockScheduler): Frame-based polling (~16ms precision)
 */

/** Callback that receives the precise transport time of the event. */
export type SchedulerCallback = (time: number) => void;

/**
 * Clock scheduler interface for beat-synced callbacks.
 * All callbacks receive a `time` argument — the precise transport time of the event.
 */
export interface ClockScheduler {
  /**
   * Subscribe to beat changes. Callback fires when the specified beat is reached.
   * @param beat - Beat number (0-3), array of beats, or "*" for all beats
   * @param callback - Function to call when beat is reached (receives transport time)
   * @returns ID for cancellation
   */
  onBeat(beat: number | number[] | '*', callback: SchedulerCallback): string;

  /**
   * Schedule a one-shot callback at a specific transport time.
   * @param time - Absolute time in seconds, or "bar:beat:sixteenth" notation
   * @param callback - Function to call at the specified time (receives scheduled time)
   * @returns ID for cancellation
   */
  schedule(time: number | string, callback: SchedulerCallback): string;

  /**
   * Schedule a repeating callback at a musical interval.
   * @param interval - Interval in "bar:beat:sixteenth" notation (e.g., "1:0:0" = every bar)
   * @param callback - Function to call at each interval (receives transport time)
   * @returns ID for cancellation
   */
  every(interval: string, callback: SchedulerCallback): string;

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
  readonly ticks: number;
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

  if (!Number.isFinite(bars)) {
    throw new Error(`Invalid bar value in notation "${notation}": parsed bars as NaN`);
  }

  if (!Number.isFinite(beats)) {
    throw new Error(`Invalid beat value in notation "${notation}": parsed beats as NaN`);
  }

  if (!Number.isFinite(sixteenths)) {
    throw new Error(`Invalid sixteenth value in notation "${notation}": parsed sixteenths as NaN`);
  }

  if (!Number.isFinite(bpm) || bpm <= 0) {
    throw new Error(`Invalid bpm (${bpm}): must be a finite number greater than 0`);
  }

  const beatsPerSecond = bpm / 60;
  const totalBeats = bars * 4 + beats + sixteenths / 4;

  return totalBeats / beatsPerSecond;
}

type BeatCallback = { beats: number[] | '*'; callback: SchedulerCallback };
type ScheduleCallback = { time: number; callback: SchedulerCallback; fired: boolean };
type RepeatCallback = {
  interval: number;
  lastFired: number;
  callback: SchedulerCallback;
  bpm: number;
};

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
            callback(clock.time);
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
          item.callback(item.time);
        } catch (e) {
          console.error('[ClockScheduler] schedule callback error:', e);
        }

        item.fired = true;
        this.scheduleCallbacks.delete(id);
      }
    }

    // Check repeating schedules
    for (const [, item] of this.repeatCallbacks) {
      // Detect transport rewind (stop -> play from beginning)
      // Reset lastFired so the callback can fire again
      if (clock.time < item.lastFired) {
        item.lastFired = 0;
      }

      // Recalculate interval if BPM changed
      if (item.bpm !== clock.bpm) {
        // Preserve relative position when BPM changes
        const ratio = item.bpm / clock.bpm;

        item.interval = item.interval * ratio;
        item.bpm = clock.bpm;
      }

      if (clock.time >= item.lastFired + item.interval) {
        try {
          item.callback(clock.time);
        } catch (e) {
          console.error('[ClockScheduler] every callback error:', e);
        }

        item.lastFired = clock.time;
      }
    }
  }

  onBeat(beat: number | number[] | '*', callback: SchedulerCallback): string {
    const id = generateId();
    const beats = typeof beat === 'number' ? [beat] : beat;

    this.beatCallbacks.set(id, { beats, callback });

    return id;
  }

  schedule(time: number | string, callback: SchedulerCallback): string {
    const id = generateId();
    const timeNum = typeof time === 'string' ? parseBarBeatSixteenth(time, this.currentBpm) : time;

    this.scheduleCallbacks.set(id, { time: timeNum, callback, fired: false });

    return id;
  }

  every(interval: string, callback: SchedulerCallback): string {
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
 * Look-ahead clock scheduler for main-thread use with audio-precise timing.
 *
 * Runs its own setInterval loop (~25ms) and fires callbacks whose deadline
 * falls within a configurable look-ahead window (~100ms). Each callback receives
 * the precise transport time of the event, allowing Web Audio API scheduling
 * at the exact sample.
 */
export class LookaheadClockScheduler implements ClockScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastBeat = -1;
  private currentBpm = 120;

  private beatCallbacks = new Map<string, BeatCallback>();
  private scheduleCallbacks = new Map<string, ScheduleCallback>();
  private repeatCallbacks = new Map<string, RepeatCallback>();

  constructor(
    private getState: () => ClockState,
    private lookAheadMs = 25,
    private scheduleAheadS = 0.1
  ) {}

  /** Start the internal scheduling loop. */
  start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.tick(), this.lookAheadMs);
  }

  /** Stop the internal scheduling loop. */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Stop the loop and cancel all callbacks. */
  dispose(): void {
    this.stop();
    this.cancelAll();
  }

  private tick(): void {
    const clock = this.getState();
    this.currentBpm = clock.bpm;
    const horizon = clock.time + this.scheduleAheadS;

    // Check beat changes
    if (clock.beat !== this.lastBeat) {
      for (const [, { beats, callback }] of this.beatCallbacks) {
        const shouldFire = beats === '*' || (Array.isArray(beats) && beats.includes(clock.beat));

        if (shouldFire) {
          try {
            callback(clock.time);
          } catch (e) {
            console.error('[ClockScheduler] onBeat callback error:', e);
          }
        }
      }

      this.lastBeat = clock.beat;
    }

    // Check one-shot schedules (fire if deadline within horizon)
    for (const [id, item] of this.scheduleCallbacks) {
      if (!item.fired && item.time <= horizon) {
        try {
          item.callback(item.time);
        } catch (e) {
          console.error('[ClockScheduler] schedule callback error:', e);
        }

        item.fired = true;
        this.scheduleCallbacks.delete(id);
      }
    }

    // Check repeating schedules
    for (const [, item] of this.repeatCallbacks) {
      // Detect transport rewind (stop -> play from beginning)
      if (clock.time < item.lastFired) {
        item.lastFired = 0;
      }

      // Recalculate interval if BPM changed
      if (item.bpm !== clock.bpm) {
        const ratio = item.bpm / clock.bpm;
        item.interval = item.interval * ratio;
        item.bpm = clock.bpm;
      }

      if (clock.time >= item.lastFired + item.interval) {
        // Compute precise fire time aligned to the interval grid
        const fireTime = item.lastFired + item.interval;

        if (fireTime <= horizon) {
          try {
            item.callback(fireTime);
          } catch (e) {
            console.error('[ClockScheduler] every callback error:', e);
          }

          item.lastFired = fireTime;
        }
      }
    }
  }

  onBeat(beat: number | number[] | '*', callback: SchedulerCallback): string {
    const id = generateId();
    const beats = typeof beat === 'number' ? [beat] : beat;
    this.beatCallbacks.set(id, { beats, callback });
    return id;
  }

  schedule(time: number | string, callback: SchedulerCallback): string {
    const id = generateId();
    const timeNum = typeof time === 'string' ? parseBarBeatSixteenth(time, this.currentBpm) : time;
    this.scheduleCallbacks.set(id, { time: timeNum, callback, fired: false });
    return id;
  }

  every(interval: string, callback: SchedulerCallback): string {
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
  getTicks: () => number,
  getBeat: () => number,
  getPhase: () => number,
  getBpm: () => number,
  scheduler: ClockScheduler
): ClockWithScheduler => ({
  get time() {
    return getTime();
  },
  get ticks() {
    return getTicks();
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
