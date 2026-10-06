import { loadTone } from '$lib/audio/load-tone';
import { DefaultTransport } from './DefaultTransport';
import type { ITransport, TransportState } from './types';

import { transportStore } from '../../stores/transport.store';

/**
 * Global transport manager with lazy upgrade from default to Tone.js.
 * Starts with DefaultTransport (performance.now / AudioContext.currentTime)
 * and upgrades to ToneTransport when the Tone.js (tone~) object is mounted.
 */
class TransportManager implements ITransport {
  private context: ITransport = new DefaultTransport();
  private unsubscribeStore: (() => void) | null = null;

  private toneUpgraded = false;
  private toneUpgrade: Promise<void> | null = null;
  private toneUpgradeDisabled = false;

  constructor() {
    this.syncTransportWithStore();
  }

  /** Syncs BPM and time signature with store */
  private syncTransportWithStore() {
    this.unsubscribeStore = transportStore.subscribe(({ bpm, timeSignature }) => {
      if (this.context.bpm !== bpm) {
        this.context.setBpm(bpm);
      }

      const [beatsPerBar, denominator] = timeSignature;

      if (this.context.beatsPerBar !== beatsPerBar || this.context.denominator !== denominator) {
        this.context.setTimeSignature(beatsPerBar, denominator);
      }
    });
  }

  destroy(): void {
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
  }

  // Proxy all reads to current implementation
  get seconds(): number {
    return this.context.seconds;
  }

  get ticks(): number {
    return this.context.ticks;
  }

  get bpm(): number {
    return this.context.bpm;
  }

  get isPlaying(): boolean {
    return this.context.isPlaying;
  }

  get bar(): number {
    return this.context.bar;
  }

  get beat(): number {
    return this.context.beat;
  }

  get phase(): number {
    return this.context.phase;
  }

  get ppq(): number {
    return this.context.ppq;
  }

  get beatsPerBar(): number {
    return this.context.beatsPerBar;
  }

  get denominator(): number {
    return this.context.denominator;
  }

  async play(): Promise<void> {
    await this.context.play();

    transportStore.setPlayState('playing');
  }

  pause(): void {
    this.context.pause();

    transportStore.setPlayState('paused');
  }

  stop(): void {
    this.context.stop();

    transportStore.setPlayState('stopped');
  }

  seek(seconds: number): void {
    this.context.seek(seconds);
  }

  setBpm(bpm: number): void {
    this.context.setBpm(bpm);
    transportStore.setBpm(bpm);
  }

  setTimeSignature(numerator: number, denominator = 4): void {
    this.context.setTimeSignature(numerator, denominator);
    transportStore.setTimeSignature(numerator, denominator);
  }

  setDspEnabled(enabled: boolean): Promise<void> {
    return this.context.setDspEnabled(enabled);
  }

  /**
   * Get current transport state snapshot for worker sync.
   */
  getState(): TransportState {
    return {
      seconds: this.seconds,
      ticks: this.ticks,
      bpm: this.bpm,
      isPlaying: this.isPlaying,
      playState: this.isPlaying ? 'playing' : this.seconds === 0 ? 'stopped' : 'paused',
      beat: this.beat,
      phase: this.phase,
      bar: this.bar,
      beatsPerBar: this.beatsPerBar,
      denominator: this.denominator,
      ppq: this.ppq
    };
  }

  /**
   * Provide an AudioContext for jank-resistant timing.
   * Only applies to DefaultTransport — ToneTransport uses its own AudioContext.
   */
  setAudioContext(ctx: AudioContext): void {
    if (this.context instanceof DefaultTransport) {
      this.context.setAudioContext(ctx);
    }
  }

  /**
   * Upgrade to Tone.js transport if not already upgraded.
   * Called by AudioService when an audio node is created,
   * so the upgrade happens immediately even if already playing.
   */
  async ensureToneUpgraded(audioContext: AudioContext): Promise<void> {
    if (this.toneUpgraded || this.toneUpgradeDisabled) return;

    this.toneUpgrade ??= this.upgradeToTone(audioContext);

    try {
      await this.toneUpgrade;
    } finally {
      this.toneUpgrade = null;
    }
  }

  /**
   * Disable upgrade to Tone.js transport.
   * Use for lite/embed mode where sample-accurate audio isn't needed.
   */
  disableToneUpgrade(): void {
    this.toneUpgradeDisabled = true;
  }

  /**
   * Check if transport has been upgraded to Tone.js.
   */
  get isToneUpgraded(): boolean {
    return this.toneUpgraded;
  }

  private async upgradeToTone(audioContext: AudioContext): Promise<void> {
    const Tone = await loadTone(audioContext);
    const { ToneTransport } = await import('./ToneTransport');

    // Wait for AudioContext to be running before swapping.
    // Tone.start() resolves once the user has interacted with the page,
    // so DefaultTransport keeps running until then.
    await Tone.start();

    // Capture state from DefaultTransport *after* Tone.start() resolves,
    // so we get the most up-to-date time.
    const wasPlaying = this.isPlaying;
    const currentBpm = this.context.bpm;
    const currentBeatsPerBar = this.context.beatsPerBar;
    const currentDenominator = this.context.denominator;
    const currentSeconds = this.context.seconds;

    const toneTransport = new ToneTransport(Tone);
    toneTransport.setBpm(currentBpm);
    toneTransport.setTimeSignature(currentBeatsPerBar, currentDenominator);
    toneTransport.seek(currentSeconds);

    if (wasPlaying) {
      await toneTransport.play();
    }

    this.context = toneTransport;
    this.toneUpgraded = true;

    console.log('[transport] upgraded to Tone.js transport');
  }
}

/** Global transport singleton */
export const Transport = new TransportManager();
