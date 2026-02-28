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

  private toneUpgraded = false;
  private toneUpgradeDisabled = false;

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
  async ensureToneUpgraded(): Promise<void> {
    if (this.toneUpgraded || this.toneUpgradeDisabled) return;

    await this.upgradeToTone();
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

  private async upgradeToTone(): Promise<void> {
    const Tone = await import('tone');
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

    this.context = new ToneTransport(Tone);
    this.context.setBpm(currentBpm);
    this.context.setTimeSignature(currentBeatsPerBar, currentDenominator);
    this.context.seek(currentSeconds);
    this.toneUpgraded = true;

    if (wasPlaying) {
      await this.context.play();
    }

    console.log('[transport] upgraded to Tone.js transport');
  }
}

/** Global transport singleton */
export const Transport = new TransportManager();
