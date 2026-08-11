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

  // Each step is one tempo beat. Meter controls bar boundaries only, so a
  // longer pattern continues across more bars instead of playing faster.
  const ticksPerStep = Transport.ppq;
  const ticksPerPattern = ticksPerStep * numSteps;
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

    const stepInterval = 60 / Transport.bpm;

    // Swing delays every other step by up to half a step interval.

    for (let i = 0; i < steps; i++) {
      const isSwung = swing > 0 && i % 2 === 1;
      const swingOffset = isSwung ? (swing / 100) * 0.5 * stepInterval : 0;
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
    const patternDuration = (60 / Transport.bpm) * this.getConfig().steps;
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
