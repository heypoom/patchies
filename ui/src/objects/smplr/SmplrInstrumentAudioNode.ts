import type { AudioNodeGroup, AudioNodeV2 } from '$lib/audio/v2/interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { normalizeSmplrMessage } from './messages';
import type { SmplrInstrument, SmplrInstrumentDescriptor, SmplrModule } from './descriptors';

export type SmplrRuntimeStatus =
  | { state: 'idle' }
  | { state: 'loading'; loaded: number; total: number }
  | { state: 'ready'; instrumentName: string; instrumentNames?: string[] }
  | { state: 'error'; message: string };

export class SmplrInstrumentAudioNode implements AudioNodeV2 {
  static type = 'smplr-instrument~';
  static group: AudioNodeGroup = 'processors';
  static headless = true;
  static description = 'Shared smplr sampled-instrument runtime';

  static inlets: ObjectInlet[] = [
    { name: 'message', type: 'message', description: 'MIDI and trigger messages' }
  ];

  static outlets: ObjectOutlet[] = [
    { name: 'out', type: 'signal', description: 'Instrument audio output' }
  ];

  readonly nodeId: string;
  audioNode: GainNode;
  instrument: SmplrInstrument | null = null;
  onStatusChange?: (status: SmplrRuntimeStatus) => void;
  onSettingsPatch?: (patch: Record<string, unknown>) => void;

  private settings: Record<string, unknown> = {};
  private loadToken = 0;

  constructor(
    nodeId: string,
    private audioContext: AudioContext,
    private descriptor: SmplrInstrumentDescriptor,
    private loadSmplrModule: () => Promise<SmplrModule> = () => import('smplr')
  ) {
    this.nodeId = nodeId;
    this.audioNode = audioContext.createGain();
  }

  async create(params: unknown[]): Promise<void> {
    const [settings] = params;
    if (settings === undefined) return;

    await this.reload(asSettings(settings));
  }

  async send(key: string, message: unknown): Promise<void> {
    if (key === 'settings') {
      await this.applySettings(asSettings(message));
      return;
    }

    if (key !== 'message') return;

    const command = normalizeSmplrMessage(message, {
      defaultBangNote: readNote(this.settings.defaultNote, this.descriptor.defaultBangNote),
      defaultVelocity: readNumber(this.settings.velocity, this.descriptor.defaultVelocity)
    });

    this.applyCommand(command);
  }

  destroy(): void {
    this.disposeInstrument(this.instrument);
    this.instrument = null;
    this.audioNode.disconnect();
  }

  private async applySettings(nextSettings: Record<string, unknown>): Promise<void> {
    const shouldReload = this.descriptor.reloadsOnSettings.some(
      (key) => this.settings[key] !== nextSettings[key]
    );

    this.settings = { ...nextSettings };

    if (shouldReload || !this.instrument) {
      await this.reload(this.settings);
      return;
    }

    this.applyLiveSettings(nextSettings);
  }

  private async reload(settings: Record<string, unknown>): Promise<void> {
    const token = ++this.loadToken;
    this.settings = { ...settings };
    this.onStatusChange?.({ state: 'loading', loaded: 0, total: 0 });

    try {
      const module = await this.loadSmplrModule();
      const instrument = await this.descriptor.loadInstrument({
        module,
        context: this.audioContext,
        destination: this.audioNode,
        settings,
        onLoadProgress: ({ loaded, total }) => {
          if (token === this.loadToken) {
            this.onStatusChange?.({ state: 'loading', loaded, total });
          }
        }
      });

      if (token !== this.loadToken) {
        this.disposeInstrument(instrument);
        return;
      }

      this.disposeInstrument(this.instrument);
      this.instrument = instrument;
      this.applyLiveSettings(settings);
      this.onStatusChange?.({
        state: 'ready',
        instrumentName: this.descriptor.getDisplayName(settings),
        instrumentNames: instrument.instrumentNames
      });
    } catch (error) {
      if (token !== this.loadToken) return;

      this.onStatusChange?.({
        state: 'error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private applyCommand(command: ReturnType<typeof normalizeSmplrMessage>): void {
    const instrument = this.instrument;
    if (!instrument) return;

    switch (command.type) {
      case 'start':
        instrument.start(command.event);
        break;
      case 'stop':
        instrument.stop(command.target);
        break;
      case 'stopAll':
        instrument.stop(command.time === undefined ? undefined : { time: command.time });
        break;
      case 'cc':
        instrument.setCC(command.control, command.value);
        break;
      case 'program':
        this.applyProgramChange(command.program);
        break;
      case 'volume':
        instrument.output.volume = command.value;
        break;
      case 'detune':
        instrument.setDetune(command.value);
        break;
      case 'reverse':
        instrument.setReverse(command.value);
        break;
      case 'ignored':
        break;
    }
  }

  private applyProgramChange(program: number): void {
    const patch = this.descriptor.handleProgramChange?.(program, {
      ...this.settings,
      instrumentNames: this.instrument?.instrumentNames
    });

    if (!patch) return;

    this.onSettingsPatch?.(patch);
    void this.applySettings({ ...this.settings, ...patch });
  }

  private applyLiveSettings(settings: Record<string, unknown>): void {
    if (!this.instrument) return;

    this.instrument.output.volume = readNumber(settings.volume, 100);
    if (typeof this.instrument.output.pan === 'number') {
      this.instrument.output.pan = readNumber(settings.pan, 0);
    }
    this.instrument.setDetune(readNumber(settings.detune, 0));
    this.instrument.setReverse(Boolean(settings.reverse));
  }

  private disposeInstrument(instrument: SmplrInstrument | null): void {
    if (!instrument) return;

    if (instrument.dispose) {
      instrument.dispose();
    } else {
      instrument.disconnect?.();
    }
  }
}

export function createSmplrAudioNodeClass(descriptor: SmplrInstrumentDescriptor) {
  return class DescriptorSmplrAudioNode extends SmplrInstrumentAudioNode {
    static type = descriptor.type;
    static group: AudioNodeGroup = 'processors';
    static description = descriptor.description;
    static inlets = SmplrInstrumentAudioNode.inlets;
    static outlets = SmplrInstrumentAudioNode.outlets;

    constructor(nodeId: string, audioContext: AudioContext) {
      super(nodeId, audioContext, descriptor);
    }
  };
}

function asSettings(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readNote(value: unknown, fallback: number | string): number | string {
  return typeof value === 'number' || typeof value === 'string' ? value : fallback;
}
