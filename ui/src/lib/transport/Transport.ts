import { DefaultTransport } from './DefaultTransport';
import type { ITransport, TransportState } from './types';

import { transportStore } from '../../stores/transport.store';

/**
 * Global transport manager with lazy upgrade from default to Tone.js.
 * Starts with DefaultTransport (performance.now / AudioContext.currentTime)
 * and upgrades to ToneTransport on first play().
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

  async play(): Promise<void> {
    await this.context.play();

    transportStore.setIsPlaying(true);
  }

  pause(): void {
    this.context.pause();

    transportStore.setIsPlaying(false);
  }

  stop(): void {
    this.context.stop();

    transportStore.setIsPlaying(false);
  }

  seek(seconds: number): void {
    this.context.seek(seconds);
  }

  setBpm(bpm: number): void {
    this.context.setBpm(bpm);
  }

  setTimeSignature(beatsPerBar: number): void {
    this.context.setTimeSignature(beatsPerBar);
    transportStore.setBeatsPerBar(beatsPerBar);
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

    const wasPlaying = this.isPlaying;
    await this.upgradeToTone();

    if (wasPlaying) {
      await this.context.play();
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

  private async upgradeToTone(): Promise<void> {
    const Tone = await import('tone');
    const { ToneTransport } = await import('./ToneTransport');

    // Transfer state from default to full transport
    const currentBpm = this.context.bpm;
    const currentBeatsPerBar = this.context.beatsPerBar;

    this.context = new ToneTransport(Tone);
    this.context.setBpm(currentBpm);
    this.context.setTimeSignature(currentBeatsPerBar);
    this.toneUpgraded = true;

    console.log('[transport] upgraded to Tone.js transport');
  }
}

/** Global transport singleton */
export const Transport = new TransportManager();
