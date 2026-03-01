import { Transport } from '$lib/transport';
import { LookaheadClockScheduler } from '$lib/transport/ClockScheduler';
import { SchedulerRegistry } from '$lib/transport/SchedulerRegistry';

export interface SequencerConfig {
  clockMode: 'auto' | 'manual';
  outputMode: 'bang' | 'value' | 'audio';
  steps: number;
  swing: number;
}

/**
 * Encapsulates the lookahead scheduling logic for the sequencer node.
 * Handles bar/step scheduling, swing, and visual step polling.
 */
export class SequencerScheduler {
  private scheduler: LookaheadClockScheduler;
  private barSubId: string | null = null;
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
      beatsPerBar: Transport.beatsPerBar
    }));

    // Hide callback-derived markers (onBeat bar subscription, per-step schedules).
    // Explicit addMarker() calls still show through via SchedulerRegistry.getAllEvents().
    this.scheduler.setTimelineStyle({ visible: false });
  }

  private scheduleBar(barTime: number): void {
    const { steps, swing, outputMode } = this.getConfig();

    // Cancel any leftover step schedules and markers from the previous bar
    for (const id of this.stepScheduleIds) this.scheduler.cancel(id);
    this.stepScheduleIds = [];

    this.clearMarkers();

    const beatDuration = (60 / Transport.bpm) * (4 / Transport.denominator);
    const stepInterval = (beatDuration * Transport.beatsPerBar) / steps;

    // Swing operates at the 8th-note level: the off-beat 8th note in each beat pair is delayed.
    const stepsPerBeat = steps / Transport.beatsPerBar;
    const halfBeat = Math.max(1, Math.round(stepsPerBeat / 2));
    const eighthInterval = stepInterval * halfBeat;

    for (let i = 0; i < steps; i++) {
      const isSwung = swing > 0 && i % (halfBeat * 2) === halfBeat;
      const swingOffset = isSwung ? (swing / 100) * 0.5 * eighthInterval : 0;
      const stepTime = barTime + i * stepInterval + swingOffset;

      const id = this.scheduler.schedule(stepTime, (t) => this.onFire(i, t), {
        audio: outputMode === 'audio'
      });

      this.stepScheduleIds.push(id);

      for (const color of this.getStepColors?.(i) ?? []) {
        this.stepMarkerIds.push(this.scheduler.addMarker(stepTime, color));
      }
    }
  }

  /** Re-subscribe to the bar clock, respecting current clockMode. */
  setup(): void {
    const { clockMode, outputMode } = this.getConfig();

    if (this.barSubId) {
      this.scheduler.cancel(this.barSubId);
      this.barSubId = null;
    }

    for (const id of this.stepScheduleIds) this.scheduler.cancel(id);
    this.stepScheduleIds = [];

    this.clearMarkers();

    if (clockMode === 'manual') return;

    this.barSubId = this.scheduler.onBeat(0, (barTime) => this.scheduleBar(barTime), {
      audio: outputMode === 'audio'
    });
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
    if (!Transport.isPlaying) return -1;

    const ticksPerBeat = Transport.ppq * (4 / Transport.denominator);
    const ticksPerBar = ticksPerBeat * Transport.beatsPerBar;
    const ticksPerStep = ticksPerBar / numSteps;
    const ticksInBar = Transport.ticks % ticksPerBar;

    return Math.floor(ticksInBar / ticksPerStep) % numSteps;
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
