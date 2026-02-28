import { match } from 'ts-pattern';
import {
  transportStore,
  type TransportPlayState,
  type TransportStoreState
} from '../../stores/transport.store';
import { Transport } from '$lib/transport/Transport';

// Minimal type for the Strudel Cyclist scheduler.
// We access internal properties for phase sync and pause/resume bypass.
interface CyclistScheduler {
  cps: number;
  started: boolean;
  lastBegin: number;
  lastEnd: number;
  lastTick: number;

  num_cycles_at_cps_change: number;
  num_ticks_since_cps_change: number;

  clock: { start(): void; stop(): void; pause(): void };
  setCps(cps: number): void;

  stop(): void;
  getTime(): number;
}

export interface StrudelTransportSyncOptions {
  getScheduler: () => CyclistScheduler | undefined;
  evaluate: () => void;
  stop: () => void;
  onPlayingChange: (playing: boolean) => void;
}

/**
 * Syncs a Strudel Cyclist scheduler to the global transport.
 *
 * Handles CPS (tempo), play/pause/stop, and phase alignment.
 * On pause, bypasses scheduler.pause() to avoid onToggle(false) → cleanupDraw()
 * which would kill visualization animation frames (_pianoroll, _scope, etc.).
 */
export class StrudelTransportSync {
  private options: StrudelTransportSyncOptions;
  private transportUnsub: (() => void) | null = null;
  private lastPlayState: TransportPlayState | null = null;
  private lastBpm: number | null = null;
  private wasPaused = false;
  private playing = false;

  constructor(options: StrudelTransportSyncOptions) {
    this.options = options;
  }

  subscribe(): void {
    if (this.transportUnsub) return;

    this.transportUnsub = transportStore.subscribe((state) => {
      this.handleStateChange(state);
    });
  }

  unsubscribe(): void {
    this.transportUnsub?.();
    this.transportUnsub = null;
    this.lastPlayState = null;
    this.lastBpm = null;
  }

  destroy(): void {
    this.unsubscribe();
  }

  // -- Private --

  private handleStateChange(state: TransportStoreState): void {
    const { playState, bpm, timeSignature } = state;
    const [beatsPerBar] = timeSignature;

    // Handle BPM changes (re-apply CPS while playing)
    if (bpm !== this.lastBpm) {
      this.lastBpm = bpm;

      if (this.playing) {
        this.applyTransportCps(bpm, beatsPerBar);
      }
    }

    // Handle play state changes
    if (playState !== this.lastPlayState) {
      this.lastPlayState = playState;

      match(playState)
        .with('playing', () => this.handlePlay(bpm, beatsPerBar))
        .with('paused', () => this.handlePause())
        .with('stopped', () => this.handleStop())
        .exhaustive();
    }
  }

  private handlePlay(bpm: number, beatsPerBar: number): void {
    if (this.playing) return;

    if (this.wasPaused) {
      this.applyTransportCps(bpm, beatsPerBar);
      this.resumeScheduler();
    } else {
      this.options.evaluate();
      this.applyTransportCps(bpm, beatsPerBar);
      this.syncSchedulerPhase();
    }

    this.wasPaused = false;
    this.playing = true;
    this.options.onPlayingChange(true);
  }

  private handlePause(): void {
    if (!this.playing) return;

    const scheduler = this.options.getScheduler();
    if (scheduler) {
      // Pause clock directly without triggering onToggle(false).
      // scheduler.pause() calls setStarted(false) → onToggle(false) → cleanupDraw(),
      // which kills Pattern.prototype.draw() animation frames used by visualizations
      // (_pianoroll, _scope, etc.). By bypassing this, the draw loops stay alive
      // and freeze at time 0 (since scheduler.now() returns 0 when started=false).
      scheduler.clock.pause();
      scheduler.started = false;
    }

    this.wasPaused = true;
    this.playing = false;
    this.options.onPlayingChange(false);
  }

  private handleStop(): void {
    if (this.playing || this.wasPaused) {
      // Call stop() to fully clean up (including draw loops via onToggle(false)).
      // This is the correct behavior for stop — unlike pause, we want a full teardown.
      this.options.stop();
    }

    this.wasPaused = false;
    this.playing = false;
    this.options.onPlayingChange(false);
  }

  private applyTransportCps(bpm: number, beatsPerBar: number): void {
    try {
      this.options.getScheduler()?.setCps(bpm / beatsPerBar / 60);
    } catch {
      // Scheduler may not be ready yet
    }
  }

  /** Set the scheduler's cycle position to match the transport's current bar/beat. */
  private syncSchedulerPhase(): void {
    const scheduler = this.options.getScheduler();
    if (!scheduler) return;

    const { bar, beat, phase, beatsPerBar } = Transport.getState();
    const targetCycle = bar + (beat + phase) / beatsPerBar;

    scheduler.num_cycles_at_cps_change = targetCycle;
    scheduler.lastEnd = targetCycle;
    scheduler.lastBegin = targetCycle;
    scheduler.num_ticks_since_cps_change = 0;
  }

  /** Resume the scheduler from its paused position without re-evaluating. */
  private resumeScheduler(): void {
    const scheduler = this.options.getScheduler();
    if (!scheduler) return;

    // Re-align cycle position to the transport to prevent drift across pause/resume cycles.
    // Using lastEnd (Strudel's paused position) would accumulate small timing differences
    // vs the transport's clock over multiple pause/resume cycles.
    this.syncSchedulerPhase();

    // Update lastTick so now() doesn't overshoot due to the pause gap.
    // Without this, now() = lastBegin + (currentTime - staleLastTick) * cps → way in the future,
    // causing the Drawer to query empty future cycles and freeze.
    scheduler.lastTick = scheduler.getTime();

    // Reset the zyklus clock phase so ticks use current timestamps (not stale ones from before pause).
    // clock.stop() only resets the clock's internal timer — Cyclist's lastEnd is preserved.
    scheduler.clock.stop();
    scheduler.clock.start();

    // Set started directly (not via setStarted) to avoid triggering onToggle(true)
    // which would double-start the Drawer (it was never stopped during our bypass pause).
    scheduler.started = true;
  }
}
