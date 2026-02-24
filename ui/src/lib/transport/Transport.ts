import { StubTransport } from './StubTransport';
import type { ITransport, TransportState } from './types';

import { transportStore } from '../../stores/transport.store';

/**
 * Global transport manager with lazy upgrade from stub to Tone.js.
 * Starts with StubTransport and upgrades on first play().
 */
class TransportManager implements ITransport {
  private context: ITransport = new StubTransport();

  private upgraded = false;
  private upgradeDisabled = false;

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

  get beat(): number {
    return this.context.beat;
  }

  get phase(): number {
    return this.context.phase;
  }

  async play(): Promise<void> {
    if (!this.upgraded && !this.upgradeDisabled) {
      await this.upgrade();
    }

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

  setBpm(bpm: number): void {
    this.context.setBpm(bpm);
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
      phase: this.phase
    };
  }

  /**
   * Disable upgrade to Tone.js transport.
   * Use for lite/embed mode where sample-accurate audio isn't needed.
   */
  disableUpgrade(): void {
    this.upgradeDisabled = true;
  }

  /**
   * Check if transport has been upgraded to Tone.js.
   */
  get isUpgraded(): boolean {
    return this.upgraded;
  }

  private async upgrade(): Promise<void> {
    const Tone = await import('tone');
    const { ToneTransport } = await import('./ToneTransport');

    // Transfer state from stub to full transport
    const currentBpm = this.context.bpm;

    this.context = new ToneTransport(Tone);
    this.context.setBpm(currentBpm);
    this.upgraded = true;
  }
}

/** Global transport singleton */
export const Transport = new TransportManager();
