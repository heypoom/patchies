import type { ITransport } from './types';
import { DEFAULT_BPM, DEFAULT_PPQ } from './constants';

/**
 * Stub transport implementation using performance.now().
 * Default implementation that doesn't require Tone.js.
 */
export class StubTransport implements ITransport {
  private startTime = 0;
  private pausedAt = 0;
  private _isPlaying = false;
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

  get progress(): number {
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

  setBpm(bpm: number): void {
    this._bpm = bpm;
  }

  async setDspEnabled(_enabled: boolean): Promise<void> {
    // No-op in stub - no audio context to suspend
  }
}
