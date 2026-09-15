import type {
  AudioNodeGroup,
  AudioNodeV2,
  RuntimeDataBinding
} from '$lib/audio/v2/interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { Type } from '@sinclair/typebox';
import {
  MidiChannelPressure,
  MidiControlChange,
  MidiNoteOff,
  MidiNoteOn,
  MidiPitchBend,
  MidiPolyPressure,
  MidiProgramChange,
  MidiRaw
} from '$lib/objects/schemas/midi-messages';
import { msg, sym } from '$lib/objects/schemas/helpers';
import { toWamMidiEvent, type WamMidiEvent } from './wam-midi';

export const DEFAULT_WAM_URL =
  'https://www.webaudiomodules.com/community/plugins/wimmics/BigMuff/index.js';

const WAM_SDK_URL =
  'https://www.webaudiomodules.com/community/plugins/wimmics/utils/sdk/src/initializeWamHost.js';

const SetByKey = msg('set', {
  key: Type.String(),
  value: Type.Number(),
  time: Type.Optional(Type.Number()),
  timeMode: Type.Optional(Type.Union([Type.Literal('absolute'), Type.Literal('relative')]))
});
const SetByParameters = msg('set', { params: Type.Record(Type.String(), Type.Number()) });
const Save = sym('save');
const LoadByUrl = msg('load', { url: Type.String() });
const LoadByState = msg('load', { state: Type.Unknown() });
const LoadByUrlAndState = msg('load', { url: Type.String(), state: Type.Unknown() });
const Mute = sym('mute');
const Unmute = sym('unmute');

type WamAutomationEvent = {
  type: 'wam-automation';
  time: number;
  data: { id: string; value: number; normalized: boolean };
};

type WamParameterValues = Record<string, { id: string; value: number; normalized: boolean }>;

type WamParameterInfo = Record<string, { id?: unknown; label?: unknown }>;
type WamParameterValue = Record<string, { id?: unknown; value?: unknown }>;

export type WamParameter = {
  id: string;
  label: string | null;
  value: number | null;
};

type WamPluginAudioNode = AudioNode & {
  destroy?: () => void;
  getState?: () => Promise<unknown>;
  getParameterInfo?: () => Promise<WamParameterInfo>;
  getParameterValues?: (normalized: boolean) => Promise<WamParameterValue>;
  setState?: (state: unknown) => Promise<void>;
  setParameterValues?: (values: WamParameterValues) => Promise<void>;
  scheduleEvents?: (...events: (WamMidiEvent | WamAutomationEvent)[]) => void;
};

type WamInstance = {
  audioNode: WamPluginAudioNode;
  descriptor?: WamDescriptor;
  createGui?: () => Promise<HTMLElement>;
  destroyGui?: (element: HTMLElement) => void;
};

type WamConstructor = {
  descriptor?: WamDescriptor;
  createInstance: (
    hostGroupId: string,
    audioContext: AudioContext,
    initialState?: unknown
  ) => Promise<WamInstance>;
};

type WamDescriptor = {
  name?: unknown;
};

type WamSdk = {
  default?: (audioContext: AudioContext, hostGroupId: string) => Promise<unknown>;
  initializeWamHost?: (audioContext: AudioContext, hostGroupId: string) => Promise<unknown>;
};

export type WamNodeData = {
  url?: string;
  state?: unknown;
  muted?: boolean;
  resizable?: boolean;
};

export type WamRuntimeStatus =
  | { state: 'idle' }
  | { state: 'loading'; url: string }
  | { state: 'ready'; url: string; name: string }
  | { state: 'error'; url: string; message: string };

export function shouldResetWamGuiSize(
  previousStatus: WamRuntimeStatus,
  nextStatus: WamRuntimeStatus
): boolean {
  if (nextStatus.state !== 'loading') return false;
  if (previousStatus.state !== 'ready' && previousStatus.state !== 'error') return false;

  return previousStatus.url !== nextStatus.url;
}

const hosts = new WeakMap<AudioContext, Promise<string>>();

const MAX_WAM_NAME_LENGTH = 20;

function truncateWamName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= MAX_WAM_NAME_LENGTH) return trimmed;

  return `${trimmed.slice(0, MAX_WAM_NAME_LENGTH - 1)}…`;
}

function getNameFromUrl(url: string): string {
  try {
    const pathSegments = new URL(url).pathname.split('/').filter(Boolean);
    const lastSegment = pathSegments.at(-1) ?? '';

    const nameSegment = /^(index|main)\.[^.]+$/i.test(lastSegment)
      ? (pathSegments.at(-2) ?? '')
      : lastSegment.replace(/\.[^.]+$/, '');

    const spacedName = decodeURIComponent(nameSegment)
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[._-]+/g, ' ')
      .trim();

    return spacedName || 'Plugin';
  } catch {
    return 'Plugin';
  }
}

export function getWamDisplayName(
  url: string,
  moduleDescriptor?: WamDescriptor,
  instanceDescriptor?: WamDescriptor
): string {
  const descriptorName = moduleDescriptor?.name ?? instanceDescriptor?.name;

  const name =
    typeof descriptorName === 'string' && descriptorName.trim()
      ? descriptorName
      : getNameFromUrl(url);

  return truncateWamName(name);
}

async function getWamHost(audioContext: AudioContext): Promise<string> {
  const existing = hosts.get(audioContext);
  if (existing) return existing;

  const host = (async () => {
    const sdk = (await import(/* @vite-ignore */ WAM_SDK_URL)) as WamSdk;
    const initializeWamHost = sdk.initializeWamHost ?? sdk.default;
    if (!initializeWamHost) throw new Error('The WAM SDK did not export initializeWamHost().');

    const hostGroupId = `patchies-wam-${crypto.randomUUID()}`;
    await initializeWamHost(audioContext, hostGroupId);

    return hostGroupId;
  })();

  hosts.set(audioContext, host);
  void host.catch(() => {
    if (hosts.get(audioContext) === host) hosts.delete(audioContext);
  });

  return host;
}

export class WamAudioNode implements AudioNodeV2 {
  static type = 'wam~';
  static group: AudioNodeGroup = 'processors';
  static runtimeManaged = true;
  static hasRuntimeData = true;

  static description = 'Web Audio Module instrument and effect host';
  static tags = ['audio', 'plugin', 'wam', 'midi', 'experimental'];

  static inlets: ObjectInlet[] = [
    { name: 'in', type: 'signal', description: 'Audio signal input' },
    {
      name: 'message',
      type: 'message',
      description: 'message',
      messages: [
        { schema: SetByKey, description: 'Set parameter by key' },
        { schema: SetByParameters, description: 'Set parameters by object' },
        { schema: Save, description: 'Save the current state' },
        { schema: LoadByUrl, description: 'Load a module by URL' },
        { schema: LoadByState, description: 'Load a module state' },
        { schema: LoadByUrlAndState, description: 'Load a module by URL with state' },
        { schema: Mute, description: 'Mute audio output' },
        { schema: Unmute, description: 'Unmute audio output' },
        { schema: MidiNoteOn, description: 'Send MIDI note-on' },
        { schema: MidiNoteOff, description: 'Send MIDI note-off' },
        { schema: MidiControlChange, description: 'Send MIDI control change' },
        { schema: MidiProgramChange, description: 'Send MIDI program change' },
        { schema: MidiPitchBend, description: 'Send MIDI pitch bend' },
        { schema: MidiChannelPressure, description: 'Send MIDI channel pressure' },
        { schema: MidiPolyPressure, description: 'Send MIDI polyphonic pressure' },
        { schema: MidiRaw, description: 'Send raw MIDI bytes' }
      ]
    }
  ];

  static outlets: ObjectOutlet[] = [{ name: 'out', type: 'signal', description: 'audio output' }];

  readonly nodeId: string;
  audioNode: GainNode;
  onStatusChange: (status: WamRuntimeStatus) => void = () => {};
  onGuiMount: (gui: HTMLElement, shouldFit: boolean) => void = () => {};

  private inputNode: GainNode;
  private audioContext: AudioContext;
  private instance: WamInstance | null = null;
  private gui: HTMLElement | null = null;
  private runtimeData: WamNodeData = { url: DEFAULT_WAM_URL };
  private binding: RuntimeDataBinding | null = null;
  private loadToken = 0;
  private guiToken = 0;
  private status: WamRuntimeStatus = { state: 'idle' };
  private shouldFitGui = false;

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioContext = audioContext;
    this.inputNode = audioContext.createGain();
    this.audioNode = audioContext.createGain();
  }

  bindRuntimeData(binding: RuntimeDataBinding): void {
    this.binding = binding;

    this.runtimeData = {
      url: typeof binding.initialData.url === 'string' ? binding.initialData.url : DEFAULT_WAM_URL,
      state: binding.initialData.state,
      muted: binding.initialData.muted === true
    };

    this.applyMuted();
  }

  async create(): Promise<void> {
    await this.load(this.runtimeData.url ?? DEFAULT_WAM_URL, this.runtimeData.state);
  }

  getStatus(): WamRuntimeStatus {
    return this.status;
  }

  async send(key: string, message: unknown): Promise<void> {
    if (key !== 'message') return;

    const messageData =
      typeof message === 'object' && message !== null ? (message as Record<string, unknown>) : null;

    if (messageData?.type === 'set') {
      await this.handleSet(messageData);

      return;
    }

    if (messageData?.type === 'save') {
      await this.saveState();

      return;
    }

    if (messageData?.type === 'load') {
      await this.handleLoad(messageData);

      return;
    }

    if (messageData?.type === 'mute') {
      this.setMuted(true);

      return;
    }

    if (messageData?.type === 'unmute') {
      this.setMuted(false);

      return;
    }

    const event = toWamMidiEvent(message, this.audioContext.currentTime);

    if (event) {
      this.instance?.audioNode.scheduleEvents?.(event);
    }
  }

  connectFrom(source: AudioNodeV2): void {
    source.audioNode?.connect(this.inputNode);
  }

  async setUrl(url: string, state?: unknown): Promise<void> {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    console.debug('[wam~] loading module', { nodeId: this.nodeId, url: trimmedUrl });

    this.runtimeData = { url: trimmedUrl, state, muted: this.runtimeData.muted };
    this.binding?.update({ url: trimmedUrl, state });

    if (state === undefined) {
      await this.load(trimmedUrl);
    } else {
      await this.load(trimmedUrl, state);
    }
  }

  async saveState(): Promise<void> {
    const instance = this.instance;
    const loadToken = this.loadToken;

    const state = await instance?.audioNode.getState?.();
    if (state === undefined || this.instance !== instance || this.loadToken !== loadToken) return;

    this.runtimeData = { ...this.runtimeData, state };
    this.binding?.update({ state });
  }

  async getState(): Promise<unknown | undefined> {
    return this.instance?.audioNode.getState?.();
  }

  async getParameters(): Promise<WamParameter[]> {
    const audioNode = this.instance?.audioNode;
    if (!audioNode) return [];

    const [info, values] = await Promise.all([
      audioNode.getParameterInfo?.() ?? ({} as WamParameterInfo),
      audioNode.getParameterValues?.(false) ?? ({} as WamParameterValue)
    ]);

    const parameterIds = new Set([...Object.keys(info), ...Object.keys(values)]);

    return [...parameterIds]
      .map((id) => {
        const parameterInfo = info[id];
        const parameterValue = values[id];

        return {
          id,
          label: typeof parameterInfo?.label === 'string' ? parameterInfo.label : null,
          value: typeof parameterValue?.value === 'number' ? parameterValue.value : null
        };
      })
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  async setParameter(id: string, value: number): Promise<void> {
    if (!id || !Number.isFinite(value)) return;

    await this.applyParameterValues({ [id]: value });
  }

  private async handleSet(message: Record<string, unknown>): Promise<void> {
    if (Object.hasOwn(message, 'params')) {
      await this.applyParameterValues(message.params);

      return;
    }

    const key = message.key;
    const value = message.value;

    const skip =
      typeof key !== 'string' || !key || typeof value !== 'number' || !Number.isFinite(value);

    if (skip) return;

    const time = message.time;

    if (typeof time === 'number' && Number.isFinite(time)) {
      const scheduledTime =
        message.timeMode === 'relative' ? this.audioContext.currentTime + time : time;

      this.instance?.audioNode.scheduleEvents?.({
        type: 'wam-automation',
        time: scheduledTime,
        data: { id: key, value, normalized: false }
      });

      return;
    }

    await this.setParameter(key, value);
  }

  private async applyParameterValues(params: unknown): Promise<void> {
    if (typeof params !== 'object' || params === null || Array.isArray(params)) return;

    const values = Object.entries(params).reduce<WamParameterValues>((result, [id, value]) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        result[id] = { id, value, normalized: false };
      }

      return result;
    }, {});
    if (Object.keys(values).length === 0) return;

    await this.instance?.audioNode.setParameterValues?.(values);
  }

  private async handleLoad(message: Record<string, unknown>): Promise<void> {
    const url = message.url;
    const hasState = Object.hasOwn(message, 'state');

    if (typeof url === 'string') {
      if (hasState) {
        await this.setUrl(url, message.state);
      } else {
        await this.setUrl(url);
      }

      return;
    }

    if (hasState) {
      await this.loadState(message.state);
    }
  }

  private async loadState(state: unknown): Promise<void> {
    const instance = this.instance;
    if (!instance?.audioNode.setState) return;

    const loadToken = this.loadToken;
    await instance.audioNode.setState(state);

    if (this.instance !== instance || this.loadToken !== loadToken) return;

    this.runtimeData = { ...this.runtimeData, state };
    this.binding?.update({ state });
  }

  setMuted(muted: boolean): void {
    this.runtimeData = { ...this.runtimeData, muted };
    this.applyMuted();
    this.binding?.update({ muted });
  }

  private applyMuted(): void {
    this.audioNode.gain.setValueAtTime(
      this.runtimeData.muted ? 0 : 1,
      this.audioContext.currentTime
    );
  }

  async mountGui(container: HTMLElement): Promise<void> {
    const guiToken = ++this.guiToken;
    this.destroyGui();

    if (!this.instance?.createGui) return;

    const instance = this.instance;
    const createGui = instance.createGui;
    if (!createGui) return;

    const gui = await createGui.call(instance);
    if (guiToken !== this.guiToken || this.instance !== instance || this.gui) {
      instance.destroyGui?.(gui);
      return;
    }

    this.gui = gui;
    container.append(gui);

    const shouldFit = this.shouldFitGui;
    this.shouldFitGui = false;
    this.onGuiMount(gui, shouldFit);
  }

  unmountGui(): void {
    this.guiToken += 1;
    this.destroyGui();
  }

  private destroyGui(): void {
    if (!this.gui) return;

    this.instance?.destroyGui?.(this.gui);
    this.gui.remove();
    this.gui = null;
  }

  destroy(): void {
    this.loadToken += 1;
    this.unmountGui();
    this.disconnectInstance();
    this.inputNode.disconnect();
    this.audioNode.disconnect();
    this.binding = null;
  }

  private async load(url: string, state?: unknown): Promise<void> {
    const token = ++this.loadToken;
    this.setStatus({ state: 'loading', url });
    this.unmountGui();
    this.disconnectInstance();

    try {
      const hostGroupId = await getWamHost(this.audioContext);

      const imported = (await import(/* @vite-ignore */ url)) as { default?: WamConstructor };

      if (!imported.default) {
        throw new Error('The module did not provide a default WAM constructor.');
      }

      const instance = await imported.default.createInstance(hostGroupId, this.audioContext, state);
      if (token !== this.loadToken) {
        instance.audioNode.destroy?.();
        return;
      }

      this.instance = instance;
      this.shouldFitGui = true;

      if (instance.audioNode.numberOfInputs > 0) {
        this.inputNode.connect(instance.audioNode);
      }

      if (instance.audioNode.numberOfOutputs > 0) {
        instance.audioNode.connect(this.audioNode);
      }

      const name = getWamDisplayName(url, imported.default.descriptor, instance.descriptor);

      console.debug('[wam~] module ready', { nodeId: this.nodeId, url, name });
      this.setStatus({ state: 'ready', url, name });
    } catch (caught) {
      if (token !== this.loadToken) return;

      const message = caught instanceof Error ? caught.message : String(caught);
      console.error('[wam~] failed to load WAM', { url, error: caught });
      this.setStatus({ state: 'error', url, message });
    }
  }

  private disconnectInstance(): void {
    if (!this.instance) return;

    if (this.instance.audioNode.numberOfInputs > 0) {
      this.inputNode.disconnect(this.instance.audioNode);
    }

    this.instance.audioNode.disconnect();
    this.instance.audioNode.destroy?.();
    this.instance = null;
  }

  private setStatus(status: WamRuntimeStatus): void {
    this.status = status;
    this.onStatusChange(status);
  }
}
