import { Type } from '@sinclair/typebox';
import type { Pd } from 'libpd-wasm';
import type {
  AudioNodeGroup,
  AudioNodeV2,
  RuntimeDataBinding
} from '$lib/audio/v2/interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { MessageSystem } from '$lib/messages/MessageSystem';
import { msg } from '$lib/objects/schemas/helpers';
import { isVFSPath, VirtualFilesystem } from '$lib/vfs';
import { loadPdCodeBundle, loadPdFileBundle, loadPdUrlBundle, type PdFileBundle } from './pd-files';
import { loadLibPd } from './libpd-loader';
import { pdMessageToPatchies, sendPdValue } from './pd-messages';
import { analyzePdPatch, createPdWrapper, getPdHostReceiver, type PdPort } from './pd-patch';
import { compilePdComments } from './pd-comments';

const FULL_PACKAGES = ['vanilla', 'cyclone', 'else'];

const SetReceiver = msg('set', {
  key: Type.String(),
  value: Type.Unknown()
});
const LoadSource = msg('load', { src: Type.String() });
const LoadCode = msg('load', { code: Type.String() });

type PdSource =
  | { kind: 'vfs'; value: string }
  | { kind: 'url'; value: string }
  | { kind: 'code'; value: string };

export type PdNodeData = {
  vfsPath?: string;
  sourceUrl?: string;
  sourceCode?: string | null;
  ports?: PdPort[];
  exposedPortIds?: string[];
  hasConfiguredPorts?: boolean;
};

export type PdRuntimeStatus =
  | { state: 'idle' }
  | { state: 'loading'; path: string }
  | { state: 'ready'; path: string }
  | { state: 'error'; path: string; message: string };

export class PdAudioNode implements AudioNodeV2 {
  static type = 'pd';
  static group: AudioNodeGroup = 'processors';
  static runtimeManaged = true;
  static hasRuntimeData = true;
  static dynamicMessageTarget = 'messageInlet';

  static description = 'Load and run a Pure Data patch';
  static tags = ['audio', 'pure data', 'pd', 'cyclone', 'else', 'experimental'];

  static inlets: ObjectInlet[] = [
    { name: 'in', type: 'signal', description: 'Stereo audio input' },
    {
      name: 'message',
      type: 'message',
      description: 'Control the running patch or load another source',
      messages: [
        { schema: SetReceiver, description: 'Send a value to a Pd receiver' },
        { schema: LoadSource, description: 'Load a Pd patch from a VFS path or URL' },
        { schema: LoadCode, description: 'Load Pd patch source code' }
      ]
    }
  ];

  static outlets: ObjectOutlet[] = [
    { name: 'out', type: 'signal', description: 'Stereo audio output' },
    { name: 'message', type: 'message', description: 'Messages from exposed Pd senders' }
  ];

  readonly nodeId: string;
  audioNode: GainNode;
  onStatusChange: (status: PdRuntimeStatus) => void = () => {};

  private audioContext: AudioContext;
  private inputNode: GainNode;
  private pd: Pd | null = null;
  private binding: RuntimeDataBinding | null = null;
  private runtimeData: Required<PdNodeData> = {
    vfsPath: '',
    sourceUrl: '',
    sourceCode: null,
    ports: [],
    exposedPortIds: [],
    hasConfiguredPorts: false
  };
  private status: PdRuntimeStatus = { state: 'idle' };
  private loadedSourceCode = '';
  private loadToken = 0;
  private unsubscribers: Array<() => void> = [];

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioContext = audioContext;
    this.inputNode = audioContext.createGain();
    this.audioNode = audioContext.createGain();
  }

  bindRuntimeData(binding: RuntimeDataBinding): void {
    this.binding = binding;
    this.runtimeData = {
      vfsPath: typeof binding.initialData.vfsPath === 'string' ? binding.initialData.vfsPath : '',
      sourceUrl:
        typeof binding.initialData.sourceUrl === 'string' ? binding.initialData.sourceUrl : '',
      sourceCode:
        typeof binding.initialData.sourceCode === 'string' && binding.initialData.sourceCode !== ''
          ? binding.initialData.sourceCode
          : null,
      ports: Array.isArray(binding.initialData.ports)
        ? (binding.initialData.ports as PdPort[])
        : [],
      exposedPortIds: Array.isArray(binding.initialData.exposedPortIds)
        ? (binding.initialData.exposedPortIds as string[])
        : [],
      hasConfiguredPorts: binding.initialData.hasConfiguredPorts === true
    };
    this.loadedSourceCode = this.runtimeData.sourceCode ?? '';
  }

  async create(): Promise<void> {
    const source = this.getSource();
    if (!source) return;

    await this.load(source);
  }

  getStatus(): PdRuntimeStatus {
    return this.status;
  }

  getData(): Required<PdNodeData> {
    return this.runtimeData;
  }

  getSourceCode(): string {
    return this.loadedSourceCode;
  }

  async setPath(vfsPath: string): Promise<void> {
    const path = vfsPath.trim();
    this.loadedSourceCode = '';
    this.runtimeData = {
      ...this.runtimeData,
      vfsPath: path,
      sourceUrl: '',
      sourceCode: null,
      hasConfiguredPorts: false
    };
    this.binding?.update({
      vfsPath: path,
      sourceUrl: '',
      sourceCode: null,
      hasConfiguredPorts: false
    });

    if (!path) {
      this.loadedSourceCode = '';
      await this.disposePd();
      this.setStatus({ state: 'idle' });
      return;
    }

    await this.load({ kind: 'vfs', value: path });
  }

  async setSourceUrl(url: string): Promise<void> {
    const sourceUrl = url.trim();
    if (!sourceUrl) throw new Error('Pd URL cannot be empty.');

    this.loadedSourceCode = '';
    this.runtimeData = {
      ...this.runtimeData,
      vfsPath: '',
      sourceUrl,
      sourceCode: null,
      hasConfiguredPorts: false
    };
    this.binding?.update({
      vfsPath: '',
      sourceUrl,
      sourceCode: null,
      hasConfiguredPorts: false
    });

    await this.load({ kind: 'url', value: sourceUrl });
  }

  async setSourceCode(sourceCode: string): Promise<void> {
    if (!sourceCode.trim()) throw new Error('Pd code cannot be empty.');

    this.loadedSourceCode = sourceCode;
    this.runtimeData = {
      ...this.runtimeData,
      vfsPath: '',
      sourceUrl: '',
      sourceCode,
      hasConfiguredPorts: false
    };
    this.binding?.update({
      vfsPath: '',
      sourceUrl: '',
      sourceCode,
      hasConfiguredPorts: false
    });

    await this.load({ kind: 'code', value: sourceCode });
  }

  async setEditedCode(sourceCode: string): Promise<void> {
    this.loadedSourceCode = sourceCode;
    this.runtimeData = {
      ...this.runtimeData,
      sourceCode,
      hasConfiguredPorts: false
    };
    this.binding?.update({ sourceCode, hasConfiguredPorts: false });

    await this.load({ kind: 'code', value: sourceCode });
  }

  async setExposedPortIds(exposedPortIds: string[]): Promise<void> {
    this.runtimeData = { ...this.runtimeData, exposedPortIds, hasConfiguredPorts: true };
    this.binding?.update({ exposedPortIds, hasConfiguredPorts: true });

    const source = this.getSource();
    if (source) await this.load(source);
  }

  async send(key: string, value: unknown): Promise<void> {
    if (key !== 'messageInlet') return;

    const envelope =
      typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

    const inletIndex = typeof envelope?.inletIndex === 'number' ? envelope.inletIndex : 0;
    const message = envelope?.message;

    if (inletIndex === 1) {
      const genericMessage =
        typeof message === 'object' && message !== null
          ? (message as Record<string, unknown>)
          : null;

      if (genericMessage?.type === 'load') {
        if (typeof genericMessage.code === 'string') {
          await this.setSourceCode(genericMessage.code);
        } else if (typeof genericMessage.src === 'string') {
          await this.loadFromSrc(genericMessage.src);
        }

        return;
      }

      if (genericMessage?.type !== 'set' || typeof genericMessage.key !== 'string' || !this.pd) {
        return;
      }

      sendPdValue(this.pd, genericMessage.key, genericMessage.value);

      return;
    }

    if (!this.pd) return;

    const port = this.exposedMessageInputs()[inletIndex - 2];
    if (!port) return;

    const receiver = port.source === 'named' ? port.name : getPdHostReceiver(this.nodeId, port);

    if (receiver) {
      sendPdValue(this.pd, receiver, message);
    }
  }

  connectFrom(source: AudioNodeV2): void {
    source.audioNode?.connect(this.inputNode);
  }

  destroy(): void {
    this.loadToken += 1;
    this.inputNode.disconnect();
    this.audioNode.disconnect();

    this.disposePd();
  }

  private exposedMessageInputs(): PdPort[] {
    return this.runtimeData.ports.filter(
      (port) => port.kind === 'message-in' && this.runtimeData.exposedPortIds.includes(port.id)
    );
  }

  private getSource(): PdSource | null {
    if (this.runtimeData.sourceCode !== null) {
      return { kind: 'code', value: this.runtimeData.sourceCode };
    }
    if (this.runtimeData.sourceUrl) return { kind: 'url', value: this.runtimeData.sourceUrl };
    if (this.runtimeData.vfsPath) return { kind: 'vfs', value: this.runtimeData.vfsPath };

    return null;
  }

  private async loadFromSrc(src: string): Promise<void> {
    const source = src.trim();
    if (isVFSPath(source)) {
      await this.setPath(source);
      return;
    }

    await this.setSourceUrl(source);
  }

  private async resolveSource(source: PdSource): Promise<PdFileBundle> {
    if (source.kind === 'vfs') return loadPdFileBundle(source.value);
    if (source.kind === 'url') return loadPdUrlBundle(source.value);

    if (this.runtimeData.vfsPath) {
      try {
        const bundle = await loadPdFileBundle(this.runtimeData.vfsPath);

        return {
          ...bundle,
          files: { ...bundle.files, [bundle.entry]: source.value },
          source: source.value
        };
      } catch (error) {
        console.debug('[pd] unable to resolve edited patch siblings; loading entry only', {
          nodeId: this.nodeId,
          path: this.runtimeData.vfsPath,
          error
        });
      }
    }

    if (this.runtimeData.sourceUrl) {
      const parsedUrl = new URL(this.runtimeData.sourceUrl);
      const filename = decodeURIComponent(parsedUrl.pathname.split('/').at(-1) || 'remote.pd');
      const entry = filename.toLowerCase().endsWith('.pd') ? filename : 'remote.pd';

      return loadPdCodeBundle(source.value, entry);
    }

    return loadPdCodeBundle(source.value);
  }

  private async load(source: PdSource): Promise<void> {
    const token = ++this.loadToken;
    const sourceLabel = source.kind === 'code' ? 'inline Pd code' : source.value;
    this.setStatus({ state: 'loading', path: sourceLabel });

    try {
      const bundle = await this.resolveSource(source);
      this.loadedSourceCode = bundle.source;
      if (source.kind !== 'code') {
        VirtualFilesystem.getInstance().objectFiles.setRuntimeContent(
          this.nodeId,
          'patch.pd',
          source.value,
          bundle.source
        );
      }
      const compiledFiles = Object.fromEntries(
        Object.entries(bundle.files).map(([name, code]) => [name, compilePdComments(code)])
      );
      const compiledSource = compiledFiles[bundle.entry];
      const ports = analyzePdPatch(compiledSource);

      const exposedPortIds = this.runtimeData.hasConfiguredPorts
        ? this.runtimeData.exposedPortIds
        : ports.filter((port) => port.source === 'abstraction').map((port) => port.id);

      const needsWrapper = ports.some(
        (port) => port.source === 'abstraction' && exposedPortIds.includes(port.id)
      );
      const wrapperEntry = `__patchies_${this.nodeId.replace(/[^a-zA-Z0-9_]/g, '_')}.pd`;
      const abstraction = bundle.entry.replace(/\.pd$/i, '');
      const files = needsWrapper
        ? {
            ...compiledFiles,
            [wrapperEntry]: createPdWrapper({
              abstraction,
              nodeId: this.nodeId,
              ports,
              exposedPortIds
            })
          }
        : compiledFiles;
      const entry = needsWrapper ? wrapperEntry : bundle.entry;

      const library = await loadLibPd();

      const check = library.checkPatch({
        packages: FULL_PACKAGES,
        files: compiledFiles,
        entry: bundle.entry
      });

      if (!check.ok) {
        console.debug('[pd] compatibility check warnings', {
          nodeId: this.nodeId,
          source: sourceLabel,
          messages: check.messages
        });
      }

      const pd = await library.createPd({
        packages: FULL_PACKAGES,
        files,
        entry,
        workletUrl: library.workletUrl,
        audioContext: this.audioContext,
        onPrint: (text) => console.debug('[pd]', { nodeId: this.nodeId, text }),
        onError: (error) => console.error('[pd]', { nodeId: this.nodeId, error })
      });

      if (token !== this.loadToken) {
        await pd.close();
        return;
      }

      await this.disposePd();

      this.runtimeData = {
        ...this.runtimeData,
        ports,
        exposedPortIds,
        hasConfiguredPorts: true
      };

      this.binding?.update({ ports, exposedPortIds, hasConfiguredPorts: true });

      this.pd = pd;
      this.inputNode.connect(pd.node);
      pd.node.connect(this.audioNode);

      this.subscribeToOutputs(pd);
      this.setStatus({ state: 'ready', path: sourceLabel });
    } catch (error) {
      if (token !== this.loadToken) return;

      const message = error instanceof Error ? error.message : String(error);
      console.error('[pd] unable to load patch', {
        nodeId: this.nodeId,
        source: sourceLabel,
        error
      });
      this.setStatus({ state: 'error', path: sourceLabel, message });
    }
  }

  private subscribeToOutputs(pd: Pd): void {
    const outputs = this.runtimeData.ports.filter(
      (port) => port.kind === 'message-out' && this.runtimeData.exposedPortIds.includes(port.id)
    );

    this.unsubscribers = outputs.map((port, outletIndex) => {
      const receiver = port.source === 'named' ? port.name : getPdHostReceiver(this.nodeId, port);
      if (!receiver) return () => {};

      return pd.subscribe(receiver, (message) => {
        MessageSystem.getInstance().sendMessage(this.nodeId, pdMessageToPatchies(message), {
          to: outletIndex + 1
        });
      });
    });
  }

  private async disposePd(): Promise<void> {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
    this.inputNode.disconnect();

    const pd = this.pd;
    this.pd = null;
    if (pd) await pd.close();
  }

  private setStatus(status: PdRuntimeStatus): void {
    this.status = status;
    this.onStatusChange(status);
  }
}
