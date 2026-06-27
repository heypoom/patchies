import type { AudioNodeGroup, AudioNodeV2 } from '$lib/audio/v2/interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { normalizeSmplrMessage, type SmplrCommand } from './messages';
import type { SmplrInstrument, SmplrModule } from './descriptors';
import {
  createGmChannelState,
  getChannelProgram,
  normalizeMidiChannel,
  resolveGmProgramInstrument,
  setChannelProgram,
  type GmProgramSource
} from './gm-channel-state';

type Soundfont2Constructor = (typeof import('soundfont2'))['SoundFont2'];
const CUSTOM_SOUNDFONT_KIT = 'Custom';

export type GmSettings = {
  source?: GmProgramSource;
  kit?: string;
  instrumentUrl?: string;
  url?: string;
  volume?: number;
  velocity?: number;
};

export type GmRuntimeStatus =
  | { state: 'idle' }
  | { state: 'loading'; channel: number; program: number }
  | { state: 'ready'; activeChannels: number }
  | { state: 'error'; message: string };

export type GmChannelMonitorStatus = 'idle' | 'loading' | 'ready' | 'error';

export type GmChannelMonitorState = {
  channel: number;
  program: number;
  instrumentName: string;
  activeNotes: number;
  status: GmChannelMonitorStatus;
  activity: number;
  lastNote?: number | string;
  lastVelocity?: number;
  lastControl?: number;
  error?: string;
};

export type GmMonitorSnapshot = {
  channels: GmChannelMonitorState[];
};

type LoadedChannel = {
  key: string;
  instrument: SmplrInstrument;
};

export class GmAudioNode implements AudioNodeV2 {
  static type = 'gm~';
  static group: AudioNodeGroup = 'processors';
  static description = 'Multi-channel General MIDI sampled instrument';

  static inlets: ObjectInlet[] = [
    { name: 'message', type: 'message', description: 'Channel-aware MIDI messages' }
  ];

  static outlets: ObjectOutlet[] = [
    { name: 'out', type: 'signal', description: 'Mixed instrument audio output' }
  ];

  readonly nodeId: string;
  audioNode: GainNode;
  onStatusChange?: (status: GmRuntimeStatus) => void;
  onMonitorChange?: (snapshot: GmMonitorSnapshot) => void;

  private settings: GmSettings = {};
  private channelState = createGmChannelState();
  private channels = new Map<number, LoadedChannel>();
  private loads = new Map<number, Promise<LoadedChannel | null>>();
  private activeNotes = new Map<number, Set<string>>();
  private monitorChannels = createInitialMonitorChannels();
  private soundfont2Names: string[] = [];
  private loadToken = 0;

  constructor(
    nodeId: string,
    private audioContext: AudioContext,
    private loadSmplrModule: () => Promise<SmplrModule> = () => import('smplr'),
    private loadSoundfont2Parser: () => Promise<Soundfont2Constructor> = async () => {
      const { SoundFont2 } = await import('soundfont2');
      return SoundFont2;
    }
  ) {
    this.nodeId = nodeId;
    this.audioNode = audioContext.createGain();
  }

  async create(params: unknown[]): Promise<void> {
    const [settings] = params;
    await this.applySettings(asGmSettings(settings));
  }

  async send(key: string, message: unknown): Promise<void> {
    if (key === 'settings') {
      await this.applySettings(asGmSettings(message));
      return;
    }

    if (key !== 'message') return;

    const command = normalizeSmplrMessage(message, {
      defaultBangNote: 60,
      defaultVelocity: readNumber(this.settings.velocity, 100)
    });
    await this.applyCommand(command, readMessageChannel(message));
  }

  getMonitorSnapshot(): GmMonitorSnapshot {
    return {
      channels: this.monitorChannels.map((channel) => ({ ...channel }))
    };
  }

  destroy(): void {
    this.loadToken += 1;
    this.disposeAllChannels();
    this.audioNode.disconnect();
  }

  private async applySettings(nextSettings: GmSettings): Promise<void> {
    const reload =
      this.settings.source !== nextSettings.source ||
      this.settings.kit !== nextSettings.kit ||
      this.settings.instrumentUrl !== nextSettings.instrumentUrl ||
      this.settings.url !== nextSettings.url;

    this.settings = { ...nextSettings };

    if (reload) {
      this.loadToken += 1;
      this.soundfont2Names = [];
      this.disposeAllChannels();
      this.resetMonitorChannels();
    } else {
      this.applyLiveSettings();
    }

    this.onStatusChange?.({ state: 'idle' });
    this.emitMonitorChange();
  }

  private async applyCommand(command: SmplrCommand, channel: number): Promise<void> {
    switch (command.type) {
      case 'start': {
        const instrument = await this.ensureChannelInstrument(channel);
        if (!instrument) break;

        instrument.start(command.event);
        this.addActiveNote(channel, command.event.note);
        this.updateMonitorChannel(channel, {
          activeNotes: this.getActiveNoteCount(channel),
          lastNote: command.event.note,
          lastVelocity: command.event.velocity
        });
        break;
      }
      case 'stop': {
        const loaded = this.channels.get(channel);
        loaded?.instrument.stop(command.target);
        this.removeActiveNote(channel, command.target.stopId);
        this.updateMonitorChannel(channel, {
          activeNotes: this.getActiveNoteCount(channel),
          lastNote: command.target.stopId
        });
        break;
      }
      case 'stopAll':
        this.stopAll(command.time);
        this.clearActiveNotes();
        break;
      case 'cc': {
        const loaded = this.channels.get(channel);
        loaded?.instrument.setCC(command.control, command.value);
        this.updateMonitorChannel(channel, { lastControl: command.control });
        break;
      }
      case 'program':
        setChannelProgram(this.channelState, channel, command.program);
        this.updateMonitorChannel(channel, {
          program: command.program,
          instrumentName: this.getMonitorInstrumentName(command.program),
          status: this.channels.has(channel) ? 'ready' : 'idle',
          error: undefined
        });
        if (this.isCustomSoundfont()) break;

        this.activeNotes.delete(channel);
        this.updateMonitorChannel(channel, { activeNotes: 0 });
        this.disposeChannel(channel);
        void this.ensureChannelInstrument(channel);
        break;
      case 'volume':
        this.settings.volume = command.value;
        this.applyLiveSettings();
        break;
      case 'ignored':
      case 'detune':
      case 'reverse':
        break;
    }
  }

  private async ensureChannelInstrument(channel: number): Promise<SmplrInstrument | null> {
    const program = getChannelProgram(this.channelState, channel);
    const source = readSource(this.settings.source);
    const instrumentName = resolveGmProgramInstrument(source, program, this.soundfont2Names);
    if (!instrumentName && source === 'soundfont') return null;

    const key = this.getChannelKey(channel, program, instrumentName);
    const loaded = this.channels.get(channel);
    if (loaded?.key === key) return loaded.instrument;

    const existingLoad = this.loads.get(channel);
    if (existingLoad) {
      const loadedChannel = await existingLoad;
      return loadedChannel?.instrument ?? null;
    }

    const load = this.loadChannelInstrument(channel, program, key);
    this.loads.set(channel, load);
    try {
      const loadedChannel = await load;
      return loadedChannel?.instrument ?? null;
    } finally {
      if (this.loads.get(channel) === load) this.loads.delete(channel);
    }
  }

  private async loadChannelInstrument(
    channel: number,
    program: number,
    key: string
  ): Promise<LoadedChannel | null> {
    const token = this.loadToken;
    this.onStatusChange?.({ state: 'loading', channel, program });
    this.updateMonitorChannel(channel, {
      program,
      instrumentName: this.getMonitorInstrumentName(program),
      status: 'loading',
      error: undefined
    });

    try {
      const module = await this.loadSmplrModule();
      const source = readSource(this.settings.source);
      const instrument =
        source === 'soundfont2'
          ? await this.createSoundfont2Instrument(module, program)
          : await this.createSoundfontInstrument(module, program);

      if (token !== this.loadToken) {
        disposeInstrument(instrument);
        return null;
      }

      const oldChannel = this.channels.get(channel);
      if (oldChannel?.instrument !== instrument) disposeInstrument(oldChannel?.instrument);

      this.applyLiveSettingsTo(instrument);

      const loaded = { key, instrument };
      this.channels.set(channel, loaded);
      this.updateMonitorChannel(channel, {
        instrumentName: this.getMonitorInstrumentName(program),
        status: 'ready',
        error: undefined
      });
      this.onStatusChange?.({ state: 'ready', activeChannels: this.channels.size });
      return loaded;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (token === this.loadToken) {
        this.onStatusChange?.({
          state: 'error',
          message
        });
        this.updateMonitorChannel(channel, { status: 'error', error: message });
      }
      return null;
    }
  }

  private async createSoundfontInstrument(
    module: SmplrModule,
    program: number
  ): Promise<SmplrInstrument> {
    const instrumentName =
      resolveGmProgramInstrument('soundfont', program, this.soundfont2Names) ??
      'acoustic_grand_piano';
    const instrumentUrl = readString(this.settings.instrumentUrl, '').trim();
    const customOptions =
      readKit(this.settings.kit) === CUSTOM_SOUNDFONT_KIT
        ? { instrumentUrl }
        : { instrument: instrumentName, kit: readKit(this.settings.kit) };

    if (readKit(this.settings.kit) === CUSTOM_SOUNDFONT_KIT && !instrumentUrl) {
      throw new Error('Set an Instrument URL when Soundfont Kit is Custom');
    }

    const instrument = module.Soundfont(this.audioContext, {
      destination: this.audioNode,
      ...customOptions,
      volume: readNumber(this.settings.volume, 100),
      velocity: readNumber(this.settings.velocity, 100)
    });
    await instrument.ready;
    return instrument;
  }

  private async createSoundfont2Instrument(
    module: SmplrModule,
    program: number
  ): Promise<SmplrInstrument> {
    const url = readString(this.settings.url, '').trim();
    if (!url) throw new Error('Set an SF2 URL in settings');

    const SoundFont2 = await this.loadSoundfont2Parser();
    const instrument = module.Soundfont2(this.audioContext, {
      destination: this.audioNode,
      url,
      createSoundfont: (data) => new SoundFont2(data),
      volume: readNumber(this.settings.volume, 100),
      velocity: readNumber(this.settings.velocity, 100)
    });

    await instrument.ready;
    this.soundfont2Names = instrument.instrumentNames ?? this.soundfont2Names;
    const instrumentName = resolveGmProgramInstrument('soundfont2', program, this.soundfont2Names);
    if (instrumentName) await instrument.loadInstrument?.(instrumentName);
    return instrument;
  }

  private getChannelKey(channel: number, program: number, instrumentName: string | null): string {
    const source = readSource(this.settings.source);
    const programKey = this.isCustomSoundfont() ? 'custom' : program;
    const instrumentKey = this.isCustomSoundfont() ? 'custom' : (instrumentName ?? '');

    return [
      source,
      channel,
      programKey,
      instrumentKey,
      readKit(this.settings.kit),
      readString(this.settings.instrumentUrl, ''),
      readString(this.settings.url, '')
    ].join(':');
  }

  private isCustomSoundfont(): boolean {
    return (
      readSource(this.settings.source) === 'soundfont' && readKit(this.settings.kit) === 'Custom'
    );
  }

  private getMonitorInstrumentName(program: number): string {
    const source = readSource(this.settings.source);
    if (this.isCustomSoundfont()) return 'Custom Soundfont';

    return (
      resolveGmProgramInstrument(source, program, this.soundfont2Names) ?? `program ${program}`
    );
  }

  private applyLiveSettings(): void {
    for (const { instrument } of this.channels.values()) {
      this.applyLiveSettingsTo(instrument);
    }
  }

  private applyLiveSettingsTo(instrument: SmplrInstrument): void {
    instrument.output.volume = readNumber(this.settings.volume, 100);
  }

  private stopAll(time?: number): void {
    for (const { instrument } of this.channels.values()) {
      instrument.stop(time === undefined ? undefined : { time });
    }
  }

  private addActiveNote(channel: number, note: number | string): void {
    const notes = this.activeNotes.get(channel) ?? new Set<string>();
    notes.add(String(note));
    this.activeNotes.set(channel, notes);
  }

  private removeActiveNote(channel: number, note: number | string | undefined): void {
    if (note === undefined) return;

    const notes = this.activeNotes.get(channel);
    notes?.delete(String(note));
  }

  private getActiveNoteCount(channel: number): number {
    return this.activeNotes.get(channel)?.size ?? 0;
  }

  private clearActiveNotes(): void {
    this.activeNotes.clear();
    for (const channel of this.monitorChannels) {
      channel.activeNotes = 0;
      channel.activity += 1;
    }
    this.emitMonitorChange();
  }

  private resetMonitorChannels(): void {
    this.activeNotes.clear();
    this.monitorChannels = createInitialMonitorChannels().map((channel) => {
      const program = getChannelProgram(this.channelState, channel.channel);
      return {
        ...channel,
        program,
        instrumentName: this.getMonitorInstrumentName(program)
      };
    });
  }

  private updateMonitorChannel(
    channel: number,
    patch: Partial<Omit<GmChannelMonitorState, 'channel' | 'activity'>>
  ): void {
    const index = normalizeMidiChannel(channel) - 1;
    const current = this.monitorChannels[index];
    this.monitorChannels[index] = {
      ...current,
      ...patch,
      activity: current.activity + 1
    };
    this.emitMonitorChange();
  }

  private emitMonitorChange(): void {
    this.onMonitorChange?.(this.getMonitorSnapshot());
  }

  private disposeChannel(channel: number): void {
    const loaded = this.channels.get(channel);
    if (!loaded) return;

    disposeInstrument(loaded.instrument);
    this.channels.delete(channel);
  }

  private disposeAllChannels(): void {
    for (const { instrument } of this.channels.values()) {
      disposeInstrument(instrument);
    }
    this.channels.clear();
    this.loads.clear();
  }
}

function createInitialMonitorChannels(): GmChannelMonitorState[] {
  return Array.from({ length: 16 }, (_, index) => ({
    channel: index + 1,
    program: 0,
    instrumentName: 'acoustic_grand_piano',
    activeNotes: 0,
    status: 'idle',
    activity: 0
  }));
}

function asGmSettings(value: unknown): GmSettings {
  return typeof value === 'object' && value !== null ? { ...(value as GmSettings) } : {};
}

function readMessageChannel(message: unknown): number {
  if (typeof message !== 'object' || message === null) return 1;
  return normalizeMidiChannel((message as Record<string, unknown>).channel);
}

function readSource(value: unknown): GmProgramSource {
  return value === 'soundfont2' ? 'soundfont2' : 'soundfont';
}

function readKit(value: unknown): string {
  return readString(value, 'MusyngKite');
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function disposeInstrument(instrument: SmplrInstrument | undefined): void {
  if (!instrument) return;

  if (instrument.dispose) {
    instrument.dispose();
  } else {
    instrument.disconnect?.();
  }
}
