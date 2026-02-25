import type * as ToneType from 'tone';
import type { ITransport } from './types';
import {
  DEFAULT_BPM,
  DEFAULT_PPQ,
  DEFAULT_BEATS_PER_BAR,
  DEFAULT_SUBDIVISIONS_PER_BEAT
} from './constants';

/**
 * Full transport implementation wrapping Tone.Transport.
 * Provides sample-accurate audio scheduling.
 */
export class ToneTransport implements ITransport {
  private tone: typeof ToneType;
  private _bpm = DEFAULT_BPM;
  private _beatsPerBar = DEFAULT_BEATS_PER_BAR;
  private _subdivisionsPerBeat = DEFAULT_SUBDIVISIONS_PER_BEAT;
  private readonly ppq = DEFAULT_PPQ;

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

  get bar(): number {
    const totalBeats = Math.floor(this.ticks / this.ppq);
    return Math.floor(totalBeats / this._beatsPerBar);
  }

  get beat(): number {
    const totalBeats = Math.floor(this.ticks / this.ppq);
    return totalBeats % this._beatsPerBar;
  }

  get phase(): number {
    return (this.ticks % this.ppq) / this.ppq;
  }

  get subdivision(): number {
    const ticksPerSubdivision = this.ppq / this._subdivisionsPerBeat;
    return Math.floor((this.ticks % this.ppq) / ticksPerSubdivision);
  }

  get beatsPerBar(): number {
    return this._beatsPerBar;
  }

  get subdivisionsPerBeat(): number {
    return this._subdivisionsPerBeat;
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

  setTimeSignature(beatsPerBar: number): void {
    this._beatsPerBar = Math.max(1, Math.floor(beatsPerBar));
  }

  setSubdivisions(subdivisionsPerBeat: number): void {
    this._subdivisionsPerBeat = Math.max(1, Math.floor(subdivisionsPerBeat));
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
