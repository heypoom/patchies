export type SamplerNoteOffMode = 'one-shot' | 'held';

export type SamplerNoteOnMessage = {
  type: 'noteOn';
  note: number;
  velocity: number;
  time?: unknown;
};

export type SamplerNoteOffMessage = {
  type: 'noteOff';
  note: number;
  time?: unknown;
};

type SamplerNotePlayMessage = {
  type: 'play';
  time?: unknown;
  gain: number;
  playbackRate: number;
  replaceImmediate: false;
};

type SamplerNoteVoiceManagerOptions = {
  currentTime: () => number;
  play: (message: SamplerNotePlayMessage) => AudioBufferSourceNode | null;
  stop: (source: AudioBufferSourceNode, time?: number) => void;
};

const ROOT_NOTE = 60;

const getNonNegativeNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

const noteToPlaybackRate = (note: number): number => 2 ** ((note - ROOT_NOTE) / 12);

export class SamplerNoteVoiceManager {
  private readonly currentTime: () => number;
  private readonly play: (message: SamplerNotePlayMessage) => AudioBufferSourceNode | null;
  private readonly stop: (source: AudioBufferSourceNode, time?: number) => void;
  private readonly noteSources = new Map<number, Set<AudioBufferSourceNode>>();
  private noteOffMode: SamplerNoteOffMode = 'one-shot';

  constructor({ currentTime, play, stop }: SamplerNoteVoiceManagerOptions) {
    this.currentTime = currentTime;
    this.play = play;
    this.stop = stop;
  }

  setNoteOffMode(mode: SamplerNoteOffMode): void {
    this.noteOffMode = mode;
  }

  handleNoteOn(message: SamplerNoteOnMessage): void {
    const note = getNonNegativeNumber(message.note);
    const velocity = getNonNegativeNumber(message.velocity);

    if (note === undefined || velocity === undefined) return;

    if (velocity === 0) {
      if (this.noteOffMode === 'held') {
        this.handleNoteOff({ type: 'noteOff', note, time: message.time });
      }
      return;
    }

    const source = this.play({
      type: 'play',
      time: message.time,
      gain: velocity / 127,
      playbackRate: noteToPlaybackRate(note),
      replaceImmediate: false
    });

    if (!source) return;

    const sources = this.noteSources.get(note) ?? new Set<AudioBufferSourceNode>();
    sources.add(source);

    this.noteSources.set(note, sources);
  }

  handleNoteOff(message: SamplerNoteOffMessage): void {
    if (this.noteOffMode !== 'held') return;

    const note = getNonNegativeNumber(message.note);
    if (note === undefined) return;

    const sources = this.noteSources.get(note);
    if (!sources) return;

    const time = getNonNegativeNumber(message.time);
    const isFutureStop = time !== undefined && time > this.currentTime();

    for (const source of [...sources]) {
      this.stop(source, time);
    }

    if (!isFutureStop) {
      this.noteSources.delete(note);
    }
  }

  removeSource(source: AudioBufferSourceNode): void {
    for (const [note, sources] of this.noteSources) {
      sources.delete(source);

      if (sources.size === 0) {
        this.noteSources.delete(note);
      }
    }
  }

  getSources(): Set<AudioBufferSourceNode> {
    const sources = new Set<AudioBufferSourceNode>();

    for (const noteSet of this.noteSources.values()) {
      for (const source of noteSet) {
        sources.add(source);
      }
    }

    return sources;
  }

  clear(): void {
    this.noteSources.clear();
  }
}
