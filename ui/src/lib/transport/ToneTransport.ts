import type * as ToneType from 'tone';
import type { ITransport } from './types';
import { DEFAULT_BPM, DEFAULT_PPQ } from './constants';

/**
 * Full transport implementation wrapping Tone.Transport.
 * Provides sample-accurate audio scheduling.
 */
export class ToneTransport implements ITransport {
  private tone: typeof ToneType;
  private _bpm = DEFAULT_BPM;
  private readonly ppq = DEFAULT_PPQ;

  constructor(tone: typeof ToneType) {
    this.tone = tone;
    this.tone.Transport.bpm.value = this._bpm;
  }

  get seconds(): number {
    return this.tone.Transport.seconds;
  }

  get ticks(): number {
    return this.tone.Transport.ticks;
  }

  get bpm(): number {
    return this._bpm;
  }

  get isPlaying(): boolean {
    return this.tone.Transport.state === 'started';
  }

  get beat(): number {
    return Math.floor(this.ticks / this.ppq) % 4;
  }

  get progress(): number {
    return (this.ticks % this.ppq) / this.ppq;
  }

  async play(): Promise<void> {
    await this.tone.start();
    this.tone.Transport.start();
  }

  pause(): void {
    this.tone.Transport.pause();
  }

  stop(): void {
    this.tone.Transport.stop();
    this.tone.Transport.seconds = 0;
  }

  setBpm(bpm: number): void {
    this._bpm = bpm;
    this.tone.Transport.bpm.value = bpm;
  }

  async setDspEnabled(enabled: boolean): Promise<void> {
    const ctx = this.tone.getContext().rawContext;
    // Cast to AudioContext since we're not using OfflineAudioContext
    // OfflineAudioContext.suspend() requires a time arg, AudioContext.suspend() doesn't
    if (enabled) {
      await ctx.resume();
    } else {
      await (ctx as AudioContext).suspend();
    }
  }
}
