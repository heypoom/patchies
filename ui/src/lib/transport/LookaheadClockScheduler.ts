/**
 * Look-ahead clock scheduler for main-thread use with audio-precise timing.
 *
 * Runs its own setInterval loop (~25ms) and fires callbacks whose deadline
 * falls within a configurable look-ahead window (~100ms). Each callback receives
 * the precise transport time of the event, allowing Web Audio API scheduling
 * at the exact sample.
 */
import {
  generateId,
  parseBarBeatSixteenth,
  type BeatCallback,
  type ClockScheduler,
  type ClockState,
  type RepeatCallback,
  type ScheduleCallback,
  type SchedulerCallback
} from './ClockScheduler';

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
