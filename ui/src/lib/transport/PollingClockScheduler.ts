/**
 * Polling-based clock scheduler for stub transport and worker environments.
 * Uses frame-based polling (~16ms precision at 60fps).
 */
import {
  generateId,
  parseBarBeatSixteenth,
  type BeatCallback,
  type ClockScheduler,
  type ClockState,
  type RepeatCallback,
  type ScheduleCallback,
  type SchedulerCallback,
  type SchedulerOptions
} from './ClockScheduler';

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
            console.error('[clock] onBeat callback error:', e);
          }
        }
      }

      this.lastBeat = clock.beat;
    }

    // Check one-shot schedules
    for (const [id, item] of this.scheduleCallbacks) {
      // Recalculate time if BPM changed (only for musical notation times)
      if (item.bpm !== undefined && item.bpm !== clock.bpm) {
        const ratio = item.bpm / clock.bpm;
        item.time = item.time * ratio;
        item.bpm = clock.bpm;
      }

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

  onBeat(
    beat: number | number[] | '*',
    callback: SchedulerCallback,
    options?: SchedulerOptions
  ): string {
    const id = generateId();
    const beats = typeof beat === 'number' ? [beat] : beat;

    this.beatCallbacks.set(id, { beats, callback, audio: options?.audio ?? false });

    return id;
  }

  schedule(time: number | string, callback: SchedulerCallback, options?: SchedulerOptions): string {
    const id = generateId();
    const isMusical = typeof time === 'string';
    const timeNum = isMusical ? parseBarBeatSixteenth(time, this.currentBpm) : time;

    this.scheduleCallbacks.set(id, {
      time: timeNum,
      callback,
      fired: false,
      audio: options?.audio ?? false,
      bpm: isMusical ? this.currentBpm : undefined
    });

    return id;
  }

  every(interval: string, callback: SchedulerCallback, options?: SchedulerOptions): string {
    const id = generateId();
    const intervalSecs = parseBarBeatSixteenth(interval, this.currentBpm);

    this.repeatCallbacks.set(id, {
      interval: intervalSecs,
      lastFired: 0,
      callback,
      bpm: this.currentBpm,
      audio: options?.audio ?? false
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
