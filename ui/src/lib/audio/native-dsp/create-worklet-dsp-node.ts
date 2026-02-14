/**
 * createWorkletDspNode — main-thread factory for native DSP nodes.
 *
 * Generates an AudioNodeV2 class from a declarative config.
 * Handles worklet module loading, message forwarding, and schema metadata.
 */

import type { AudioNodeGroup, AudioNodeV2 } from '$lib/audio/v2/interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { MessageSystem } from '$lib/messages/MessageSystem';
import { WorkletDirectChannelService } from '$lib/audio/WorkletDirectChannelService';
import { logger } from '$lib/utils/logger';

export interface WorkletDspNodeConfig {
  type: string;
  group: AudioNodeGroup;
  description: string;
  workletUrl: string;

  audioInlets?: number;
  audioOutlets?: number;

  inlets: ObjectInlet[];
  outlets: ObjectOutlet[];

  tags?: string[];
  aliases?: string[];
}

// Track module loading state per worklet URL
const moduleState = new Map<string, { ready: boolean; promise: Promise<void> | null }>();

async function ensureModule(workletUrl: string, audioContext: AudioContext): Promise<void> {
  let state = moduleState.get(workletUrl);
  if (!state) {
    state = { ready: false, promise: null };
    moduleState.set(workletUrl, state);
  }

  if (state.ready) return;
  if (state.promise) return state.promise;

  state.promise = (async () => {
    try {
      const processorUrl = new URL(workletUrl, import.meta.url);
      await audioContext.audioWorklet.addModule(processorUrl.href);
      state!.ready = true;
    } catch (error) {
      state!.promise = null;
      state!.ready = false;
      logger.error('cannot add worklet module:', error);
      throw error;
    }
  })();

  return state.promise;
}

type NativeDspNodeClass = {
  type: string;
  group: AudioNodeGroup;
  description: string;
  inlets: ObjectInlet[];
  outlets: ObjectOutlet[];
  tags?: string[];
  aliases?: string[];
  new (nodeId: string, audioContext: AudioContext): AudioNodeV2;
};

export function createWorkletDspNode(config: WorkletDspNodeConfig): NativeDspNodeClass {
  return class NativeDspNode implements AudioNodeV2 {
    static type = config.type;
    static group = config.group;
    static description = config.description;
    static inlets = config.inlets;
    static outlets = config.outlets;
    static tags = config.tags;
    static aliases = config.aliases;

    readonly nodeId: string;
    audioNode: AudioWorkletNode | null = null;

    private audioContext: AudioContext;
    private messageSystem: MessageSystem;
    private directChannelService: WorkletDirectChannelService;

    constructor(nodeId: string, audioContext: AudioContext) {
      this.nodeId = nodeId;
      this.audioContext = audioContext;
      this.messageSystem = MessageSystem.getInstance();
      this.directChannelService = WorkletDirectChannelService.getInstance();
    }

    async create(params: unknown[]): Promise<void> {
      await ensureModule(config.workletUrl, this.audioContext);

      this.audioNode = new AudioWorkletNode(this.audioContext, config.type, {
        numberOfInputs: config.audioInlets ?? 0,
        numberOfOutputs: config.audioOutlets ?? 1,
        processorOptions: { nodeId: this.nodeId }
      });

      // Register with direct channel service for worklet-to-worklet routing
      this.directChannelService.registerWorklet(this.nodeId, this.audioNode.port);

      // Listen for messages from the worklet (send() calls in process/recv)
      this.audioNode.port.onmessage = (event) => {
        if (event.data.type === 'send-message') {
          this.messageSystem.sendMessage(this.nodeId, event.data.message, {
            to: event.data.outlet,
            excludeTargets: event.data.directTargets ?? []
          });
        }
      };

      // Forward initial params to the worklet
      for (let i = 0; i < params.length; i++) {
        if (params[i] !== undefined && params[i] !== null && i < config.inlets.length) {
          this.audioNode.port.postMessage({
            type: 'message-inlet',
            message: params[i],
            inlet: i
          });
        }
      }
    }

    send(key: string, message: unknown): void {
      const inletIndex = config.inlets.findIndex((i) => i.name === key);
      if (inletIndex === -1) return;

      this.audioNode?.port.postMessage({
        type: 'message-inlet',
        message,
        inlet: inletIndex
      });
    }

    destroy(): void {
      this.directChannelService.unregisterWorklet(this.nodeId);

      if (this.audioNode) {
        this.audioNode.port.onmessage = null;
        this.audioNode.port.postMessage({ type: 'stop' });
        this.audioNode.disconnect();
        this.audioNode = null;
      }
    }
  };
}
