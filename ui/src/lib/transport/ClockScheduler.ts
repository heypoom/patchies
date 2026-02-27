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

// Shared internal types used by both scheduler implementations
export type BeatCallback = { beats: number[] | '*'; callback: SchedulerCallback };
export type ScheduleCallback = { time: number; callback: SchedulerCallback; fired: boolean };
export type RepeatCallback = {
  interval: number;
  lastFired: number;
  callback: SchedulerCallback;
  bpm: number;
};

let idCounter = 0;

export function generateId(): string {
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

// Re-export scheduler implementations for backwards compatibility
export { PollingClockScheduler } from './PollingClockScheduler';
export { LookaheadClockScheduler } from './LookaheadClockScheduler';
