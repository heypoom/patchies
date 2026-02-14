/**
 * createWorkletDspNode — main-thread factory for native DSP nodes.
 *
 * Generates an AudioNodeV2 class from a declarative config.
 * Handles worklet module loading, message forwarding, and schema metadata.
 */

import type { AudioNodeGroup, AudioNodeV2 } from '$lib/audio/v2/interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { MessageContext } from '$lib/messages/MessageContext';
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
    private messageContext: MessageContext;

    constructor(nodeId: string, audioContext: AudioContext) {
      this.nodeId = nodeId;
      this.audioContext = audioContext;
      this.messageContext = new MessageContext(nodeId);
    }

    async create(_params: unknown[]): Promise<void> {
      await ensureModule(config.workletUrl, this.audioContext);

      this.audioNode = new AudioWorkletNode(this.audioContext, config.type, {
        numberOfInputs: config.audioInlets ?? 0,
        numberOfOutputs: config.audioOutlets ?? 1
      });

      // Listen for messages from the worklet (send() calls in process/recv)
      this.audioNode.port.onmessage = (event) => {
        if (event.data.type === 'send-message') {
          this.messageContext.send(event.data.message, { to: event.data.outlet });
        }
      };
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
      this.audioNode?.port.postMessage({ type: 'stop' });
      this.audioNode?.disconnect();
      this.audioNode = null;
      this.messageContext.destroy();
    }
  };
}
