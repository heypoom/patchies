import type { AudioNodeGroup, AudioNodeV2 } from '$lib/audio/v2/interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { normalizeSmplrMessage } from './messages';
import type { SmplrInstrument, SmplrInstrumentDescriptor, SmplrModule } from './descriptors';
import { normalizeSustainPedalValue, SustainPedal } from './SustainPedal';

export type SmplrRuntimeStatus =
  | { state: 'idle' }
  | { state: 'loading'; loaded: number; total: number }
  | { state: 'ready'; instrumentName: string; instrumentNames?: string[] }
  | { state: 'error'; message: string };

export class SmplrInstrumentAudioNode implements AudioNodeV2 {
  static type = 'smplr-instrument~';
  static group: AudioNodeGroup = 'processors';
  static headless = true;
  static runtimeManaged = true;
  static description = 'Shared smplr sampled-instrument runtime';

  static inlets: ObjectInlet[] = [
    { name: 'message', type: 'message', description: 'MIDI and trigger messages' },
    {
      name: 'settings',
      type: 'any',
      description: 'Persisted instrument settings',
      defaultValue: {},
      hideInlet: true,
      hideDocs: true
    }
  ];

  static outlets: ObjectOutlet[] = [
    { name: 'out', type: 'signal', description: 'Instrument audio output' }
  ];

  readonly nodeId: string;
  audioNode: GainNode;
  instrument: SmplrInstrument | null = null;
  onStatusChange?: (status: SmplrRuntimeStatus) => void;
  onSettingsPatch?: (patch: Record<string, unknown>) => void;

  private loadToken = 0;
  private settings: Record<string, unknown> = {};

  private sustainPedal = new SustainPedal<{ stopId?: number | string; time?: number }>();

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
    const settings = params.length === 1 ? params[0] : params[1];

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
      this.sustainPedal.clear();
      this.applyLiveSettings(settings);
      this.applySustainPedalState();
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
        this.stopNote(instrument, command.target);
        break;
      case 'stopAll':
        this.sustainPedal.clear();
        instrument.stop(command.time === undefined ? undefined : { time: command.time });
        break;
      case 'cc':
        this.applyControlChange(instrument, command.control, command.value);
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
    this.applySettings({ ...this.settings, ...patch });
  }

  private stopNote(
    instrument: SmplrInstrument,
    target: { stopId?: number | string; time?: number }
  ): void {
    if (this.descriptor.supportsSustainPedal && this.sustainPedal.hold(target)) return;

    instrument.stop(target);
  }

  private applyControlChange(instrument: SmplrInstrument, control: number, value: number): void {
    const controlValue =
      this.descriptor.supportsSustainPedal && control === 64
        ? normalizeSustainPedalValue(value)
        : value;

    instrument.setCC(control, controlValue);

    if (!this.descriptor.supportsSustainPedal || control !== 64) return;

    for (const target of this.sustainPedal.set(controlValue)) {
      instrument.stop(target);
    }
  }

  private applySustainPedalState(): void {
    if (this.descriptor.supportsSustainPedal) {
      this.instrument?.setCC(64, this.sustainPedal.isDown ? 127 : 0);
    }
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

export const createSmplrAudioNodeClass = (descriptor: SmplrInstrumentDescriptor) =>
  class DescriptorSmplrAudioNode extends SmplrInstrumentAudioNode {
    static type = descriptor.type;
    static group: AudioNodeGroup = 'processors';
    static description = descriptor.description;
    static runtimeManaged = true;
    static inlets = SmplrInstrumentAudioNode.inlets;
    static outlets = SmplrInstrumentAudioNode.outlets;

    constructor(nodeId: string, audioContext: AudioContext) {
      super(nodeId, audioContext, descriptor);
    }
  };

const asSettings = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? { ...(value as Record<string, unknown>) } : {};

const readNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const readNote = (value: unknown, fallback: number | string): number | string =>
  typeof value === 'number' || typeof value === 'string' ? value : fallback;
