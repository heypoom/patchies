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
  type: 'bang';
  time?: unknown;
  value: number;
  playbackRate: number;
  replaceImmediate: false;
};

type SamplerNoteVoiceManagerOptions = {
  currentTime: () => number;
  getBasePlaybackRate: () => number;
  play: (message: SamplerNotePlayMessage) => AudioBufferSourceNode | null;
  stop: (source: AudioBufferSourceNode, time?: number) => void;
};

const ROOT_NOTE = 60;

const getNonNegativeNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

const noteToPlaybackRate = (note: number): number => 2 ** ((note - ROOT_NOTE) / 12);

export class SamplerNoteVoiceManager {
  private readonly currentTime: () => number;
  private readonly getBasePlaybackRate: () => number;
  private readonly play: (message: SamplerNotePlayMessage) => AudioBufferSourceNode | null;
  private readonly stop: (source: AudioBufferSourceNode, time?: number) => void;
  private readonly noteSources = new Map<number, Set<AudioBufferSourceNode>>();
  private readonly playbackRateMultipliers = new Map<AudioBufferSourceNode, number>();
  private noteOffMode: SamplerNoteOffMode = 'one-shot';

  constructor({ currentTime, getBasePlaybackRate, play, stop }: SamplerNoteVoiceManagerOptions) {
    this.currentTime = currentTime;
    this.getBasePlaybackRate = getBasePlaybackRate;
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

    const playbackRateMultiplier = noteToPlaybackRate(note);
    const source = this.play({
      type: 'bang',
      time: message.time,
      value: velocity / 127,
      playbackRate: this.getBasePlaybackRate() * playbackRateMultiplier,
      replaceImmediate: false
    });

    if (!source) return;

    const sources = this.noteSources.get(note) ?? new Set<AudioBufferSourceNode>();
    sources.add(source);
    this.playbackRateMultipliers.set(source, playbackRateMultiplier);

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
    this.playbackRateMultipliers.delete(source);

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

  updatePlaybackRates(basePlaybackRate: number): void {
    for (const [source, multiplier] of this.playbackRateMultipliers) {
      source.playbackRate.value = basePlaybackRate * multiplier;
    }
  }

  clear(): void {
    this.noteSources.clear();
    this.playbackRateMultipliers.clear();
  }
}
