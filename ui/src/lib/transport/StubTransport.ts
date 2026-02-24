import type { ITransport } from './types';
import { DEFAULT_AUTOPLAY, DEFAULT_BPM, DEFAULT_PPQ } from './constants';

/**
 * Stub transport implementation using performance.now().
 * Default implementation that doesn't require Tone.js.
 */
export class StubTransport implements ITransport {
  private startTime = DEFAULT_AUTOPLAY ? performance.now() : 0;
  private pausedAt = 0;
  private _isPlaying = DEFAULT_AUTOPLAY;
  private _bpm = DEFAULT_BPM;

  private readonly ppq = DEFAULT_PPQ;

  get seconds(): number {
    if (!this._isPlaying) return this.pausedAt;

    return (performance.now() - this.startTime) / 1000;
  }

  get ticks(): number {
    return this.seconds * (this._bpm / 60) * this.ppq;
  }

  get bpm(): number {
    return this._bpm;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get beat(): number {
    return Math.floor(this.ticks / this.ppq) % 4;
  }

  get phase(): number {
    return (this.ticks % this.ppq) / this.ppq;
  }

  async play(): Promise<void> {
    this.startTime = performance.now() - this.pausedAt * 1000;
    this._isPlaying = true;
  }

  pause(): void {
    this.pausedAt = this.seconds;
    this._isPlaying = false;
  }

  stop(): void {
    this.pausedAt = 0;
    this._isPlaying = false;
  }

  seek(seconds: number): void {
    this.pausedAt = Math.max(0, seconds);

    if (this._isPlaying) {
      // Adjust startTime so (performance.now() - startTime) / 1000 = seconds
      this.startTime = performance.now() - this.pausedAt * 1000;
    }
  }

  setBpm(bpm: number): void {
    this._bpm = bpm;
  }

  async setDspEnabled(): Promise<void> {
    // No-op in stub - no audio context to suspend
  }
}
