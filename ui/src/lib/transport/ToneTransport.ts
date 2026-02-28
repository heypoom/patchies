import type * as ToneType from 'tone';
import type { ITransport } from './types';
import { DEFAULT_BPM, DEFAULT_PPQ, DEFAULT_TIME_SIGNATURE } from './constants';

/**
 * Full transport implementation wrapping Tone.Transport.
 * Provides sample-accurate audio scheduling.
 */
export class ToneTransport implements ITransport {
  private tone: typeof ToneType;
  private _bpm = DEFAULT_BPM;
  private _beatsPerBar = DEFAULT_TIME_SIGNATURE[0];
  private _denominator = DEFAULT_TIME_SIGNATURE[1];

  readonly ppq = DEFAULT_PPQ;

  constructor(tone: typeof ToneType) {
    this.tone = tone;
    this.tone.getTransport().bpm.value = this._bpm;
  }

  get seconds(): number {
    return this.tone.getTransport().seconds;
  }

  get ticks(): number {
    return this.tone.getTransport().ticks;
  }

  get bpm(): number {
    return this._bpm;
  }

  get isPlaying(): boolean {
    return this.tone.getTransport().state === 'started';
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
    await this.tone.start();
    this.tone.getTransport().start();
  }

  pause(): void {
    this.tone.getTransport().pause();
  }

  stop(): void {
    this.tone.getTransport().stop();
    this.tone.getTransport().seconds = 0;
  }

  seek(seconds: number): void {
    this.tone.getTransport().seconds = Math.max(0, seconds);
  }

  setBpm(bpm: number): void {
    this._bpm = bpm;
    this.tone.getTransport().bpm.value = bpm;
  }

  setTimeSignature(numerator: number, denominator = 4): void {
    this._beatsPerBar = Math.max(1, Math.floor(numerator));
    this._denominator = Math.max(1, Math.floor(denominator));
    this.tone.getTransport().timeSignature = [this._beatsPerBar, this._denominator];
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
