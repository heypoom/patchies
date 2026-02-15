import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { logger } from '$lib/utils/logger';

import workletUrl from '$lib/audio/native-dsp/processors/scope.processor?worker&url';

const moduleState = { ready: false, promise: null as Promise<void> | null };

/**
 * Oscilloscope display node.
 *
 * Uses a custom AudioWorklet processor with rising zero-crossing
 * trigger detection to capture stable waveform buffers.
 * The latest buffer is stored for the Svelte component to read.
 */
export class ScopeAudioNode implements AudioNodeV2 {
  static type = 'scope~';
  static group: AudioNodeGroup = 'processors';
  static description = 'Oscilloscope waveform display';

  static inlets: ObjectInlet[] = [
    {
      name: 'in',
      type: 'signal',
      description: 'Audio signal to display'
    }
  ];

  static outlets: ObjectOutlet[] = [];

  readonly nodeId: string;
  audioNode: AudioWorkletNode | null = null;
  latestBuffer: Float32Array | null = null;

  private audioContext: AudioContext;

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioContext = audioContext;
  }

  async create(): Promise<void> {
    if (!moduleState.ready) {
      if (!moduleState.promise) {
        moduleState.promise = (async () => {
          try {
            const processorUrl = new URL(workletUrl, import.meta.url);
            await this.audioContext.audioWorklet.addModule(processorUrl.href);
            moduleState.ready = true;
          } catch (error) {
            moduleState.promise = null;
            moduleState.ready = false;
            logger.error('cannot add scope~ worklet module:', error);
            throw error;
          }
        })();
      }
      await moduleState.promise;
    }

    this.audioNode = new AudioWorkletNode(this.audioContext, 'scope~', {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      processorOptions: { nodeId: this.nodeId }
    });

    this.audioNode.port.onmessage = (event) => {
      if (event.data.type === 'send-message') {
        this.latestBuffer = event.data.message;
      }
    };
  }

  setBufferSize(size: number): void {
    this.audioNode?.port.postMessage({
      type: 'message-inlet',
      message: { bufferSize: size },
      inlet: 0
    });
  }

  setFps(fps: number): void {
    this.audioNode?.port.postMessage({
      type: 'message-inlet',
      message: { fps },
      inlet: 0
    });
  }

  destroy(): void {
    if (this.audioNode) {
      this.audioNode.port.onmessage = null;
      this.audioNode.port.postMessage({ type: 'stop' });
      this.audioNode.disconnect();
      this.audioNode = null;
    }
  }
}
