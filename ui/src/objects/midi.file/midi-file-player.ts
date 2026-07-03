export type MidiFileChannelMessage =
  | { type: 'noteOn'; note: number; velocity: number; channel: number }
  | { type: 'noteOff'; note: number; velocity: number; channel: number }
  | { type: 'controlChange'; control: number; value: number; channel: number }
  | { type: 'programChange'; program: number; channel: number }
  | { type: 'pitchBend'; value: number; channel: number }
  | { type: 'channelPressure'; pressure: number; channel: number }
  | { type: 'polyPressure'; note: number; pressure: number; channel: number };

export type MidiFileMetaMessage =
  | {
      type: 'loaded';
      fileName: string;
      durationSeconds: number;
      trackCount: number;
      ppq: number;
      programs: MidiFileProgramState[];
      preloadPrograms: MidiFileProgramState[];
    }
  | { type: 'position'; seconds: number; progress: number }
  | { type: 'ended' }
  | { type: 'tempo'; bpm: number; tick: number }
  | { type: 'timeSignature'; numerator: number; denominator: number; tick: number }
  | { type: 'keySignature'; key: string; tick: number }
  | { type: 'trackName'; name: string; track: number }
  | { type: 'error'; message: string };

export type MidiFileOutputMessage = MidiFileChannelMessage | MidiFileMetaMessage;

export type MidiFileProgramState = {
  channel: number;
  program: number;
};

export interface ScheduledMidiFileEvent {
  seconds: number;
  ticks: number;
  track: number;
  message: MidiFileOutputMessage;
}

export type ScheduledMidiFileMessage = MidiFileOutputMessage & {
  seconds: number;
  ticks: number;
  track: number;
};

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
  sendPositionEvents?: () => boolean;
  loop?: () => boolean;
}

export class MidiFilePlayer {
  private file: ParsedMidiFile | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private activeNotes = new Map<string, { note: number; channel: number; count: number }>();
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

  getEvents(): ScheduledMidiFileMessage[] {
    return (
      this.file?.events.map(({ seconds, ticks, track, message }) => ({
        seconds,
        ticks,
        track,
        ...message
      })) ?? []
    );
  }

  preload(): void {
    if (!this.file) return;

    this.sendLoaded(this.file);
  }

  load(file: ParsedMidiFile): void {
    this.stop();
    this.file = file;

    this.sendLoaded(file);
    this.sendPosition();
  }

  private sendLoaded(file: ParsedMidiFile): void {
    this.options.send({
      type: 'loaded',
      fileName: file.fileName,
      durationSeconds: file.durationSeconds,
      trackCount: file.trackCount,
      ppq: file.ppq,
      programs: getProgramStateAt(file, 0),
      preloadPrograms: getUniqueProgramStates(file)
    });
  }

  play(): void {
    if (!this.file || this._playState === 'playing') return;

    this.clearTimers();

    if (this._positionSeconds >= this.file.durationSeconds) {
      this._positionSeconds = 0;
    }

    this.startedAtMs = Date.now();
    this.startPositionSeconds = this._positionSeconds;
    this._playState = 'playing';

    this.scheduleFrom(this._positionSeconds);
    this.sendPosition();
  }

  pause(): void {
    if (this._playState !== 'playing') return;

    this._positionSeconds = this.positionSeconds;
    this._playState = 'paused';

    this.clearTimers();
    this.flushActiveNotes();
    this.sendPosition();
  }

  stop(): void {
    this.clearTimers();
    this.flushActiveNotes();

    this._positionSeconds = 0;
    this.startPositionSeconds = 0;
    this._playState = 'stopped';

    this.sendPosition();
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

    this.sendPosition();
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
      const key = noteKey(message.channel, message.note);
      const activeNote = this.activeNotes.get(key);

      this.activeNotes.set(key, {
        channel: message.channel,
        note: message.note,
        count: (activeNote?.count ?? 0) + 1
      });
    } else if (
      message.type === 'noteOff' ||
      (message.type === 'noteOn' && message.velocity === 0)
    ) {
      if ('note' in message) {
        this.releaseActiveNote(message.channel, message.note);
      }
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
      this.sendPosition();

      return;
    }

    this._positionSeconds = this.file.durationSeconds;
    this._playState = 'stopped';

    this.sendPosition();
    this.options.send({ type: 'ended' });
  }

  private clearTimers(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }

    this.timers.clear();
  }

  private flushActiveNotes(): void {
    for (const { note, channel, count } of this.activeNotes.values()) {
      for (let i = 0; i < count; i++) {
        this.options.send({ type: 'noteOff', note, velocity: 0, channel });
      }
    }

    this.activeNotes.clear();
  }

  private releaseActiveNote(channel: number, note: number): void {
    const key = noteKey(channel, note);
    const activeNote = this.activeNotes.get(key);

    if (!activeNote) return;

    if (activeNote.count <= 1) {
      this.activeNotes.delete(key);
      return;
    }

    this.activeNotes.set(key, { ...activeNote, count: activeNote.count - 1 });
  }

  private sendPosition(): void {
    if (!this.file) return;
    if (this.options.sendPositionEvents?.() !== true) return;

    const seconds = this.positionSeconds;

    this.options.send({
      type: 'position',
      seconds,
      progress: this.file.durationSeconds > 0 ? seconds / this.file.durationSeconds : 0
    });
  }
}

const isChannelMessage = (message: MidiFileOutputMessage): message is MidiFileChannelMessage =>
  message.type === 'noteOn' ||
  message.type === 'noteOff' ||
  message.type === 'controlChange' ||
  message.type === 'programChange' ||
  message.type === 'pitchBend' ||
  message.type === 'channelPressure' ||
  message.type === 'polyPressure';

const noteKey = (channel: number, note: number): string => `${channel}:${note}`;

function getProgramStateAt(file: ParsedMidiFile, seconds: number): MidiFileProgramState[] {
  const programsByChannel = new Map<number, number>(
    getUsedChannels(file).map((channel) => [channel, 0])
  );

  for (const event of file.events) {
    if (event.seconds > seconds) continue;
    if (event.message.type !== 'programChange') continue;

    programsByChannel.set(event.message.channel, event.message.program);
  }

  return Array.from(programsByChannel.entries())
    .sort(([leftChannel], [rightChannel]) => leftChannel - rightChannel)
    .map(([channel, program]) => ({ channel, program }));
}

function getUniqueProgramStates(file: ParsedMidiFile): MidiFileProgramState[] {
  const programs = new Map<string, MidiFileProgramState>();
  const channelsWithProgramChanges = new Set<number>();

  for (const event of file.events) {
    if (event.message.type !== 'programChange') continue;

    const { channel, program } = event.message;
    channelsWithProgramChanges.add(channel);
    programs.set(`${channel}:${program}`, { channel, program });
  }

  for (const channel of getUsedChannels(file)) {
    if (!channelsWithProgramChanges.has(channel)) {
      programs.set(`${channel}:0`, { channel, program: 0 });
    }
  }

  return Array.from(programs.values()).sort(
    (left, right) => left.channel - right.channel || left.program - right.program
  );
}

function getUsedChannels(file: ParsedMidiFile): number[] {
  const channels = new Set<number>();

  for (const event of file.events) {
    if (isChannelMessage(event.message)) {
      channels.add(event.message.channel);
    }
  }

  return Array.from(channels).sort((left, right) => left - right);
}
