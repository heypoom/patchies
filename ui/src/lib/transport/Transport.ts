import { StubTransport } from './StubTransport';
import type { ITransport, TransportState } from './types';
import { transportStore } from '../../stores/transport.store';

/**
 * Global transport manager with lazy upgrade from stub to Tone.js.
 * Starts with StubTransport and upgrades on first play().
 */
class TransportManager implements ITransport {
  private impl: ITransport = new StubTransport();
  private upgraded = false;
  private upgradeDisabled = false;

  // Proxy all reads to current implementation
  get seconds(): number {
    return this.impl.seconds;
  }

  get ticks(): number {
    return this.impl.ticks;
  }

  get bpm(): number {
    return this.impl.bpm;
  }

  get isPlaying(): boolean {
    return this.impl.isPlaying;
  }

  get beat(): number {
    return this.impl.beat;
  }

  get progress(): number {
    return this.impl.progress;
  }

  async play(): Promise<void> {
    if (!this.upgraded && !this.upgradeDisabled) {
      await this.upgrade();
    }
    await this.impl.play();
    transportStore.setIsPlaying(true);
  }

  pause(): void {
    this.impl.pause();
    transportStore.setIsPlaying(false);
  }

  stop(): void {
    this.impl.stop();
    transportStore.setIsPlaying(false);
  }

  setBpm(bpm: number): void {
    this.impl.setBpm(bpm);
  }

  setDspEnabled(enabled: boolean): Promise<void> {
    return this.impl.setDspEnabled(enabled);
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
      progress: this.progress
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
    const currentBpm = this.impl.bpm;

    this.impl = new ToneTransport(Tone);
    this.impl.setBpm(currentBpm);
    this.upgraded = true;
  }
}

/** Global transport singleton */
export const Transport = new TransportManager();
