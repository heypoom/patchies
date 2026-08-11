import { Transport } from '$lib/transport';
import { LookaheadClockScheduler } from '$lib/transport/ClockScheduler';
import { SchedulerRegistry } from '$lib/transport/SchedulerRegistry';

export interface SequencerConfig {
  clockMode: 'auto' | 'manual';
  audioRate: boolean;
  steps: number;
  swing: number;
}

export function getSequencerVisualStep(numSteps: number): number {
  if (!Transport.isPlaying || numSteps <= 0) return -1;

  // A pattern keeps the duration it has in 4/4: changing the meter changes
  // bar boundaries, not the tempo or the sequencer's step rate.
  const ticksPerPattern = Transport.ppq * 4;
  const ticksPerStep = ticksPerPattern / numSteps;
  const ticksInPattern = Transport.ticks % ticksPerPattern;

  return Math.floor(ticksInPattern / ticksPerStep) % numSteps;
}

/**
 * Encapsulates the lookahead scheduling logic for the sequencer node.
 * Handles bar/step scheduling, swing, and visual step polling.
 */
export class SequencerScheduler {
  private scheduler: LookaheadClockScheduler;
  private patternSubId: string | null = null;
  private playStateSubId: string | null = null;
  private stepScheduleIds: string[] = [];
  private stepMarkerIds: string[] = [];

  constructor(
    private nodeId: string,
    private getConfig: () => SequencerConfig,
    private onFire: (step: number, time: number) => void,
    /** Optional: returns the colors of all active tracks at a given step for timeline markers. */
    private getStepColors?: (step: number) => string[]
  ) {
    this.scheduler = new LookaheadClockScheduler(() => ({
      time: Transport.seconds,
      beat: Transport.beat,
      bpm: Transport.bpm,
      phase: Transport.phase,
      beatsPerBar: Transport.beatsPerBar,
      isPlaying: Transport.isPlaying,
      playState: Transport.isPlaying ? 'playing' : Transport.seconds === 0 ? 'stopped' : 'paused'
    }));

    // Hide callback-derived markers (onBeat bar subscription, per-step schedules).
    // Explicit addMarker() calls still show through via SchedulerRegistry.getAllEvents().
    this.scheduler.setTimelineStyle({ visible: false });
  }

  private schedulePattern(patternTime: number): void {
    const { steps, swing, audioRate } = this.getConfig();

    if (this.patternSubId) {
      this.scheduler.cancel(this.patternSubId);
      this.patternSubId = null;
    }

    // Cancel any leftover step schedules and markers from the previous pattern.
    for (const id of this.stepScheduleIds) this.scheduler.cancel(id);
    this.stepScheduleIds = [];

    this.clearMarkers();

    const beatDuration = 60 / Transport.bpm;
    const stepInterval = (beatDuration * 4) / steps;

    // Swing operates at the 8th-note level: the off-beat 8th note in each beat pair is delayed.
    const stepsPerBeat = steps / 4;
    const halfBeat = Math.max(1, Math.round(stepsPerBeat / 2));
    const eighthInterval = stepInterval * halfBeat;

    for (let i = 0; i < steps; i++) {
      const isSwung = swing > 0 && i % (halfBeat * 2) === halfBeat;
      const swingOffset = isSwung ? (swing / 100) * 0.5 * eighthInterval : 0;
      const stepTime = patternTime + i * stepInterval + swingOffset;

      const id = this.scheduler.schedule(stepTime, (t) => this.onFire(i, t), {
        audio: audioRate
      });

      this.stepScheduleIds.push(id);

      for (const color of this.getStepColors?.(i) ?? []) {
        this.stepMarkerIds.push(this.scheduler.addMarker(stepTime, color));
      }
    }

    const patternDuration = stepInterval * steps;
    this.patternSubId = this.scheduler.schedule(
      patternTime + patternDuration,
      (nextPatternTime) => this.schedulePattern(nextPatternTime),
      { audio: audioRate }
    );
  }

  private scheduleCurrentPattern(): void {
    const patternDuration = (60 / Transport.bpm) * 4;
    const patternTime = Math.floor(Transport.seconds / patternDuration) * patternDuration;

    this.schedulePattern(patternTime);
  }

  /** Re-subscribe to the pattern clock, respecting current clockMode. */
  setup(): void {
    const { clockMode, audioRate } = this.getConfig();

    if (this.patternSubId) {
      this.scheduler.cancel(this.patternSubId);
      this.patternSubId = null;
    }

    if (this.playStateSubId) {
      this.scheduler.cancel(this.playStateSubId);
      this.playStateSubId = null;
    }

    for (const id of this.stepScheduleIds) this.scheduler.cancel(id);
    this.stepScheduleIds = [];

    this.clearMarkers();

    if (clockMode === 'manual') return;

    this.playStateSubId = this.scheduler.onPlayStateChange((state) => {
      if (state === 'playing') {
        this.scheduleCurrentPattern();
      }
    });

    if (Transport.isPlaying) {
      this.scheduleCurrentPattern();
    }
  }

  /** Initial setup + start the internal scheduler + register with SchedulerRegistry. */
  start(): void {
    this.setup();
    this.scheduler.start();
    SchedulerRegistry.getInstance().register(this.nodeId, this.scheduler);
  }

  /**
   * Returns the current visual step index based on transport position.
   * Returns -1 when transport is stopped.
   */
  getVisualStep(numSteps: number): number {
    return getSequencerVisualStep(numSteps);
  }

  /** Immediately remove all current step markers from the timeline. */
  clearMarkers(): void {
    for (const id of this.stepMarkerIds) {
      this.scheduler.cancelMarker(id);
    }

    this.stepMarkerIds = [];
  }

  dispose(): void {
    SchedulerRegistry.getInstance().unregister(this.nodeId);
    this.scheduler.dispose();
  }
}
