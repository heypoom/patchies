export type MidiFileChannelMessage =
  | { type: 'noteOn'; note: number; velocity: number; channel: number }
  | { type: 'noteOff'; note: number; velocity: number; channel: number }
  | { type: 'controlChange'; control: number; value: number; channel: number }
  | { type: 'programChange'; program: number; channel: number }
  | { type: 'pitchBend'; value: number; channel: number }
  | { type: 'channelPressure'; pressure: number; channel: number }
  | { type: 'polyPressure'; note: number; pressure: number; channel: number };

export type MidiFileMetaMessage =
  | { type: 'loaded'; fileName: string; durationSeconds: number; trackCount: number; ppq: number }
  | { type: 'position'; seconds: number; progress: number }
  | { type: 'ended' }
  | { type: 'tempo'; bpm: number; tick: number }
  | { type: 'timeSignature'; numerator: number; denominator: number; tick: number }
  | { type: 'keySignature'; key: string; tick: number }
  | { type: 'trackName'; name: string; track: number }
  | { type: 'error'; message: string };

export type MidiFileOutputMessage = MidiFileChannelMessage | MidiFileMetaMessage;

export interface ScheduledMidiFileEvent {
  seconds: number;
  ticks: number;
  track: number;
  message: MidiFileOutputMessage;
}

export interface ParsedMidiFile {
  fileName: string;
  ppq: number;
  durationSeconds: number;
  durationTicks: number;
  trackCount: number;
  events: ScheduledMidiFileEvent[];
  tempos: Array<{ tick: number; seconds: number; bpm: number }>;
  timeSignatures: Array<{
    tick: number;
    seconds: number;
    numerator: number;
    denominator: number;
  }>;
}

export interface MidiFilePlayerOptions {
  send: (message: MidiFileOutputMessage) => void;
  outputMetaEvents?: () => boolean;
  loop?: () => boolean;
}

export class MidiFilePlayer {
  private file: ParsedMidiFile | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private activeNotes = new Map<string, { note: number; channel: number }>();
  private startedAtMs = 0;
  private startPositionSeconds = 0;
  private _positionSeconds = 0;
  private _playState: 'stopped' | 'playing' | 'paused' = 'stopped';

  constructor(private options: MidiFilePlayerOptions) {}

  get positionSeconds(): number {
    if (this._playState !== 'playing') return this._positionSeconds;
    return Math.min(
      this.file?.durationSeconds ?? Number.POSITIVE_INFINITY,
      this.startPositionSeconds + (Date.now() - this.startedAtMs) / 1000
    );
  }

  get playState(): 'stopped' | 'playing' | 'paused' {
    return this._playState;
  }

  get loadedFile(): ParsedMidiFile | null {
    return this.file;
  }

  load(file: ParsedMidiFile): void {
    this.stop();
    this.file = file;
    this.options.send({
      type: 'loaded',
      fileName: file.fileName,
      durationSeconds: file.durationSeconds,
      trackCount: file.trackCount,
      ppq: file.ppq
    });
  }

  play(): void {
    if (!this.file || this._playState === 'playing') return;

    this.clearTimers();
    this.startedAtMs = Date.now();
    this.startPositionSeconds = this._positionSeconds;
    this._playState = 'playing';
    this.scheduleFrom(this._positionSeconds);
  }

  pause(): void {
    if (this._playState !== 'playing') return;

    this._positionSeconds = this.positionSeconds;
    this._playState = 'paused';
    this.clearTimers();
    this.flushActiveNotes();
  }

  stop(): void {
    this.clearTimers();
    this.flushActiveNotes();
    this._positionSeconds = 0;
    this.startPositionSeconds = 0;
    this._playState = 'stopped';
  }

  seek(seconds: number): void {
    const wasPlaying = this._playState === 'playing';
    this.clearTimers();
    this.flushActiveNotes();
    this._positionSeconds = Math.max(0, Math.min(seconds, this.file?.durationSeconds ?? seconds));
    this.startPositionSeconds = this._positionSeconds;

    if (wasPlaying) {
      this.startedAtMs = Date.now();
      this.scheduleFrom(this._positionSeconds);
    }
  }

  destroy(): void {
    this.stop();
    this.file = null;
  }

  private scheduleFrom(positionSeconds: number): void {
    if (!this.file) return;

    for (const event of this.file.events) {
      if (event.seconds < positionSeconds) continue;
      if (!this.shouldEmit(event.message)) continue;

      const delayMs = Math.max(0, (event.seconds - positionSeconds) * 1000);
      if (delayMs === 0) {
        this.sendScheduledMessage(event.message);
        continue;
      }

      const timer = setTimeout(() => {
        this.timers.delete(timer);
        this.sendScheduledMessage(event.message);
      }, delayMs);
      this.timers.add(timer);
    }

    const endDelayMs = Math.max(0, (this.file.durationSeconds - positionSeconds) * 1000);
    const endTimer = setTimeout(() => {
      this.timers.delete(endTimer);
      this.handleEnd();
    }, endDelayMs);
    this.timers.add(endTimer);
  }

  private shouldEmit(message: MidiFileOutputMessage): boolean {
    if (isChannelMessage(message)) return true;
    if (message.type === 'loaded' || message.type === 'position' || message.type === 'ended') {
      return true;
    }
    return this.options.outputMetaEvents?.() === true;
  }

  private sendScheduledMessage(message: MidiFileOutputMessage): void {
    if (message.type === 'noteOn' && message.velocity > 0) {
      this.activeNotes.set(noteKey(message.channel, message.note), {
        channel: message.channel,
        note: message.note
      });
    } else if (
      message.type === 'noteOff' ||
      (message.type === 'noteOn' && message.velocity === 0)
    ) {
      if ('note' in message) this.activeNotes.delete(noteKey(message.channel, message.note));
    }

    this.options.send(message);
  }

  private handleEnd(): void {
    if (!this.file) return;

    this.flushActiveNotes();

    if (this.options.loop?.() === true) {
      this._positionSeconds = 0;
      this.startedAtMs = Date.now();
      this.startPositionSeconds = 0;
      this.scheduleFrom(0);
      return;
    }

    this._positionSeconds = this.file.durationSeconds;
    this._playState = 'stopped';
    this.options.send({ type: 'ended' });
  }

  private clearTimers(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  private flushActiveNotes(): void {
    for (const { note, channel } of this.activeNotes.values()) {
      this.options.send({ type: 'noteOff', note, velocity: 0, channel });
    }
    this.activeNotes.clear();
  }
}

function isChannelMessage(message: MidiFileOutputMessage): message is MidiFileChannelMessage {
  return (
    message.type === 'noteOn' ||
    message.type === 'noteOff' ||
    message.type === 'controlChange' ||
    message.type === 'programChange' ||
    message.type === 'pitchBend' ||
    message.type === 'channelPressure' ||
    message.type === 'polyPressure'
  );
}

function noteKey(channel: number, note: number): string {
  return `${channel}:${note}`;
}
