/**
 * Look-ahead clock scheduler for main-thread use.
 *
 * By default, callbacks fire **after** the event (visual-friendly).
 * With `{ audio: true }`, callbacks fire within a look-ahead window (~100ms)
 * before the event, with the precise transport time for Web Audio API scheduling.
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
import type { ScheduledEventDescriptor, FiredEventRecord } from './SchedulerRegistry';

export class LookaheadClockScheduler implements ClockScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastBeat = -1;
  private currentBpm = 120;

  private beatCallbacks = new Map<string, BeatCallback>();
  private scheduleCallbacks = new Map<string, ScheduleCallback>();
  private repeatCallbacks = new Map<string, RepeatCallback>();

  /** Ring buffer of recently-fired events for timeline visualization. */
  private firedEvents: FiredEventRecord[] = [];
  private static MAX_FIRED_BUFFER = 64;

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
    this.firedEvents = [];
  }

  /** Return a snapshot of all registered events for timeline visualization. */
  getEventSnapshot(): ScheduledEventDescriptor[] {
    const events: ScheduledEventDescriptor[] = [];

    for (const [id, cb] of this.beatCallbacks) {
      events.push({ id, kind: 'beat', beats: cb.beats });
    }

    for (const [id, cb] of this.scheduleCallbacks) {
      events.push({ id, kind: 'schedule', time: cb.time, fired: cb.fired });
    }

    for (const [id, cb] of this.repeatCallbacks) {
      events.push({ id, kind: 'every', interval: cb.interval, lastFired: cb.lastFired });
    }

    return events;
  }

  /** Drain fired events buffer. Returns and clears accumulated events. */
  drainFiredEvents(): FiredEventRecord[] {
    const events = this.firedEvents;
    this.firedEvents = [];
    return events;
  }

  /** Record that a callback fired (for timeline flash animation). */
  private recordFired(id: string, firedAt: number): void {
    this.firedEvents.push({ id, firedAt, wallTime: performance.now() });
    if (this.firedEvents.length > LookaheadClockScheduler.MAX_FIRED_BUFFER) {
      this.firedEvents.shift();
    }
  }

  private tick(): void {
    const clock = this.getState();
    this.currentBpm = clock.bpm;
    const horizon = clock.time + this.scheduleAheadS;

    // --- onBeat: visual mode (fire after beat change) ---
    if (clock.beat !== this.lastBeat) {
      for (const [id, item] of this.beatCallbacks) {
        if (item.audio) continue;
        const shouldFire =
          item.beats === '*' || (Array.isArray(item.beats) && item.beats.includes(clock.beat));

        if (shouldFire) {
          try {
            item.callback(clock.time);
            this.recordFired(id, clock.time);
          } catch (e) {
            console.error('[ClockScheduler] onBeat callback error:', e);
          }
        }
      }

      this.lastBeat = clock.beat;
    }

    // --- onBeat: audio mode (lookahead — predict next beat) ---
    if (clock.phase != null && clock.beatsPerBar != null) {
      const beatDuration = 60 / clock.bpm;
      const timeUntilNextBeat = (1 - clock.phase) * beatDuration;
      const nextBeatTime = clock.time + timeUntilNextBeat;
      const nextBeat = (clock.beat + 1) % clock.beatsPerBar;

      if (nextBeatTime <= horizon) {
        for (const [id, item] of this.beatCallbacks) {
          if (!item.audio) continue;
          const shouldFire =
            item.beats === '*' || (Array.isArray(item.beats) && item.beats.includes(nextBeat));

          if (shouldFire && item.lastFiredBeatTime !== nextBeatTime) {
            try {
              item.callback(nextBeatTime);
              this.recordFired(id, nextBeatTime);
            } catch (e) {
              console.error('[ClockScheduler] onBeat audio callback error:', e);
            }
            item.lastFiredBeatTime = nextBeatTime;
          }
        }
      }
    }

    // --- schedule ---
    for (const [id, item] of this.scheduleCallbacks) {
      if (item.fired) continue;

      // Recalculate time if BPM changed (only for musical notation times)
      if (item.bpm !== undefined && item.bpm !== clock.bpm) {
        const ratio = item.bpm / clock.bpm;
        item.time = item.time * ratio;
        item.bpm = clock.bpm;
      }

      const shouldFire = item.audio
        ? item.time <= horizon // audio: fire when within lookahead window
        : clock.time >= item.time; // visual: fire after the event

      if (shouldFire) {
        try {
          item.callback(item.time);
          this.recordFired(id, item.time);
        } catch (e) {
          console.error('[ClockScheduler] schedule callback error:', e);
        }

        item.fired = true;
        this.scheduleCallbacks.delete(id);
      }
    }

    // --- every ---
    for (const [id, item] of this.repeatCallbacks) {
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

      const fireTime = item.lastFired + item.interval;

      if (item.audio) {
        // Audio mode: lookahead with grid-aligned fire time
        if (fireTime <= horizon) {
          try {
            item.callback(fireTime);
            this.recordFired(id, fireTime);
          } catch (e) {
            console.error('[ClockScheduler] every callback error:', e);
          }
          item.lastFired = fireTime;
        }
      } else {
        // Visual mode: fire after the event
        if (clock.time >= fireTime) {
          try {
            item.callback(clock.time);
            this.recordFired(id, clock.time);
          } catch (e) {
            console.error('[ClockScheduler] every callback error:', e);
          }
          item.lastFired = clock.time;
        }
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
