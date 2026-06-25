/**
 * Look-ahead clock scheduler for main-thread use.
 *
 * By default, callbacks fire **after** the event (visual-friendly).
 * With `{ audio: true }`, callbacks fire within a look-ahead window (~100ms)
 * before the event, with the precise transport time for Web Audio API scheduling.
 */
import {
  generateId,
  getClockPlayState,
  parseBarBeatSixteenth,
  type BeatCallback,
  type ClockScheduler,
  type ClockPlayState,
  type ClockState,
  type PlayStateCallback,
  type PlayStateChangeCallback,
  type RepeatCallback,
  type ScheduleCallback,
  type SchedulerCallback,
  type SchedulerOptions
} from './ClockScheduler';
import type { ScheduledEventDescriptor, FiredEventRecord } from './SchedulerRegistry';

export interface NodeTimelineStyle {
  color?: string;
  visible?: boolean;
}

export class LookaheadClockScheduler implements ClockScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastBeat = -1;
  private lastClockTime = 0;
  private lastPlayState: ClockPlayState | null = null;
  private currentBpm = 120;

  private beatCallbacks = new Map<string, BeatCallback>();
  private scheduleCallbacks = new Map<string, ScheduleCallback>();
  private repeatCallbacks = new Map<string, RepeatCallback>();
  private playStateCallbacks = new Map<string, PlayStateChangeCallback>();

  /** Ring buffer of recently-fired events for timeline visualization. */
  private firedEvents: FiredEventRecord[] = [];
  private static MAX_FIRED_BUFFER = 64;

  /** Explicit visual markers (no callbacks). Always shown in timeline regardless of timelineStyle.visible. */
  private markers = new Map<string, { time: number; color?: string }>();

  /** Per-node timeline appearance overrides. */
  private _timelineStyle: NodeTimelineStyle = {};

  constructor(
    private getState: () => ClockState,
    private lookAheadMs = 25,
    private scheduleAheadS = 0.1,
    private nodeLog: { error(...args: unknown[]): void } = console
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

    this.markers.clear();
    this.firedEvents = [];
    this._timelineStyle = {};
  }

  get timelineStyle(): NodeTimelineStyle {
    return this._timelineStyle;
  }

  setTimelineStyle(options: NodeTimelineStyle): void {
    this._timelineStyle = { ...this._timelineStyle, ...options };
  }

  /**
   * Place a visual-only marker in the timeline at an absolute transport time.
   * Unlike `schedule()`, this has no callback — it exists purely for visualization.
   * Markers are always shown regardless of `setTimelineStyle({ visible: false })`.
   * @returns ID for cancellation via `cancelMarker()`
   */
  addMarker(time: number, color?: string): string {
    const id = generateId();
    this.markers.set(id, { time, color });

    return id;
  }

  /** Remove a previously placed marker. */
  cancelMarker(id: string): void {
    this.markers.delete(id);
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

    for (const [id, { time, color }] of this.markers) {
      events.push({ id, kind: 'marker', time, color });
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
    const didRewind = clock.time < this.lastClockTime;

    this.processPlayStateChange(clock);

    if (didRewind) {
      this.resetAudioBeatFireTracking();
    }

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
            this.nodeLog.error('[clock] onBeat callback error:', e);
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
      const nextBeatIndex = Math.floor(clock.time / beatDuration) + 1;
      const nextBeat = (clock.beat + 1) % clock.beatsPerBar;

      if (nextBeatTime <= horizon) {
        for (const [id, item] of this.beatCallbacks) {
          if (!item.audio) continue;

          const shouldFire =
            item.beats === '*' || (Array.isArray(item.beats) && item.beats.includes(nextBeat));

          if (shouldFire && item.lastFiredBeatIndex !== nextBeatIndex) {
            const futureClock = this.createFutureClock(clock, nextBeatTime);

            try {
              item.callback(nextBeatTime, futureClock);
              this.recordFired(id, nextBeatTime);
            } catch (e) {
              this.nodeLog.error('[clock] onBeat audio callback error:', e);
            }

            item.lastFiredBeatTime = nextBeatTime;
            item.lastFiredBeatIndex = nextBeatIndex;
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
          this.nodeLog.error('[clock] schedule callback error:', e);
        }

        item.fired = true;
        this.scheduleCallbacks.delete(id);
      }
    }

    // --- every ---
    for (const [id, item] of this.repeatCallbacks) {
      // Detect transport rewind (stop -> play from beginning)
      if (didRewind) {
        item.lastFired = 0;
      }

      // Recalculate interval if BPM changed
      if (item.bpm !== clock.bpm) {
        const ratio = item.bpm / clock.bpm;

        item.interval = item.interval * ratio;
        item.bpm = clock.bpm;
      }

      const fireTime = item.lastFired + item.interval;

      // Audio precision: lookahead with grid-aligned fire time
      if (item.audio && fireTime <= horizon) {
        this.fireEveryCallback(item, id, fireTime, this.createFutureClock(clock, fireTime));
      }

      // Non-audio precision: fire after the event
      if (!item.audio && clock.time >= fireTime) {
        this.fireEveryCallback(item, id, clock.time);
      }
    }

    this.lastClockTime = clock.time;
  }

  private processPlayStateChange(clock: ClockState): void {
    const playState = getClockPlayState(clock);

    if (this.lastPlayState === null) {
      this.lastPlayState = playState;
      return;
    }

    if (playState === this.lastPlayState) return;

    this.lastPlayState = playState;

    for (const { callback } of this.playStateCallbacks.values()) {
      try {
        callback(playState, clock.time);
      } catch (e) {
        this.nodeLog.error('[clock] onPlayStateChange callback error:', e);
      }
    }
  }

  private resetAudioBeatFireTracking(): void {
    for (const item of this.beatCallbacks.values()) {
      if (!item.audio) continue;

      item.lastFiredBeatTime = undefined;
      item.lastFiredBeatIndex = undefined;
    }
  }

  private createFutureClock(clock: ClockState, time: number): ClockState {
    const beatDuration = 60 / clock.bpm;
    const beatsPerBar = clock.beatsPerBar ?? 4;

    if (!Number.isFinite(beatDuration) || beatDuration <= 0 || beatsPerBar <= 0) {
      return { ...clock, time };
    }

    const rawAbsoluteBeat = time / beatDuration;
    const nearestBeat = Math.round(rawAbsoluteBeat);

    const absoluteBeat =
      Math.abs(rawAbsoluteBeat - nearestBeat) < 1e-9 ? nearestBeat : rawAbsoluteBeat;

    const beatIndex = Math.floor(absoluteBeat);
    const phase = absoluteBeat - beatIndex;
    const beat = ((beatIndex % beatsPerBar) + beatsPerBar) % beatsPerBar;

    return {
      ...clock,
      time,
      beat,
      phase: Math.abs(phase) < 1e-9 ? 0 : phase,
      beatsPerBar
    };
  }

  private fireEveryCallback(item: RepeatCallback, id: string, time: number, clock?: ClockState) {
    try {
      item.callback(time, clock);
      this.recordFired(id, time);
    } catch (e) {
      this.nodeLog.error('[clock] every callback error:', e);
    }

    item.lastFired = time;
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

  onPlayStateChange(callback: PlayStateCallback): string {
    const id = generateId();

    this.playStateCallbacks.set(id, { callback });

    return id;
  }

  cancel(id: string): void {
    this.beatCallbacks.delete(id);
    this.scheduleCallbacks.delete(id);
    this.repeatCallbacks.delete(id);
    this.playStateCallbacks.delete(id);
  }

  cancelAll(): void {
    this.beatCallbacks.clear();
    this.scheduleCallbacks.clear();
    this.repeatCallbacks.clear();
    this.playStateCallbacks.clear();
    this.lastBeat = -1;
    this.lastClockTime = 0;
    this.lastPlayState = null;
    this._timelineStyle = {};
  }
}
