import type { ITransport } from './types';
import { DEFAULT_AUTOPLAY, DEFAULT_BPM, DEFAULT_PPQ, DEFAULT_TIME_SIGNATURE } from './constants';

/**
 * Default transport implementation using AudioContext.currentTime when available,
 * falling back to performance.now(). Does not require Tone.js.
 */
export class DefaultTransport implements ITransport {
  private _elapsed = 0;
  private _lastSync = DEFAULT_AUTOPLAY ? performance.now() / 1000 : 0;
  private _isPlaying = DEFAULT_AUTOPLAY;
  private _bpm = DEFAULT_BPM;
  private _beatsPerBar = DEFAULT_TIME_SIGNATURE[0];
  private _denominator = DEFAULT_TIME_SIGNATURE[1];
  private _audioContext: AudioContext | null = null;

  readonly ppq = DEFAULT_PPQ;

  /**
   * Current time from the best available clock source (in seconds).
   * Uses AudioContext.currentTime when running (hardware clock, ~0.02ms accuracy),
   * falls back to performance.now() (subject to main-thread jank).
   */
  private now(): number {
    if (this._audioContext?.state === 'running') {
      return this._audioContext.currentTime;
    }
    return performance.now() / 1000;
  }

  /**
   * Capture current elapsed time and record new clock timestamp.
   * Called when clock source changes (e.g., AudioContext suspended → running).
   *
   * Guards against clock domain switches: performance.now() and AudioContext.currentTime
   * have different epochs, so the delta can go negative when switching between them.
   */
  private resync(): void {
    if (this._isPlaying) {
      const newNow = this.now();
      const delta = newNow - this._lastSync;

      if (delta >= 0) {
        this._elapsed += delta;
      }

      this._lastSync = newNow;
    }
  }

  /**
   * Provide an AudioContext for jank-resistant timing.
   * When the context is running, uses hardware audio clock instead of performance.now().
   * Automatically resyncs when context state changes (suspended → running).
   */
  setAudioContext(ctx: AudioContext): void {
    if (this._audioContext === ctx) return;

    // Capture elapsed time using the CURRENT clock before switching source
    if (this._isPlaying) {
      this._elapsed += this.now() - this._lastSync;
    }

    this._audioContext = ctx;

    // Re-anchor to the (possibly new) clock source
    if (this._isPlaying) {
      this._lastSync = this.now();
    }

    ctx.addEventListener('statechange', () => {
      if (ctx.state === 'running') {
        console.log('[transport] clock source: AudioContext.currentTime');
      }
      this.resync();
    });

    if (ctx.state === 'running') {
      console.log('[transport] clock source: AudioContext.currentTime');
    }
  }

  get seconds(): number {
    if (!this._isPlaying) return this._elapsed;
    return Math.max(0, this._elapsed + (this.now() - this._lastSync));
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

  /** Ticks per beat, adjusted for denominator. 4/4 = ppq, 6/8 = ppq/2 */
  private get ticksPerBeat(): number {
    return this.ppq * (4 / this._denominator);
  }

  get bar(): number {
    const totalBeats = Math.floor(this.ticks / this.ticksPerBeat);
    return Math.floor(totalBeats / this._beatsPerBar);
  }

  get beat(): number {
    const totalBeats = Math.floor(this.ticks / this.ticksPerBeat);
    return totalBeats % this._beatsPerBar;
  }

  get phase(): number {
    return (this.ticks % this.ticksPerBeat) / this.ticksPerBeat;
  }

  get beatsPerBar(): number {
    return this._beatsPerBar;
  }

  get denominator(): number {
    return this._denominator;
  }

  async play(): Promise<void> {
    this._lastSync = this.now();
    this._isPlaying = true;
  }

  pause(): void {
    this._elapsed = this.seconds;
    this._isPlaying = false;
  }

  stop(): void {
    this._elapsed = 0;
    this._isPlaying = false;
  }

  seek(seconds: number): void {
    this._elapsed = Math.max(0, seconds);

    if (this._isPlaying) {
      this._lastSync = this.now();
    }
  }

  setBpm(bpm: number): void {
    this._bpm = bpm;
  }

  setTimeSignature(numerator: number, denominator = 4): void {
    this._beatsPerBar = Math.max(1, Math.floor(numerator));
    this._denominator = Math.max(1, Math.floor(denominator));
  }

  async setDspEnabled(): Promise<void> {
    // No-op — audio context suspend/resume is handled by AudioService
  }
}
