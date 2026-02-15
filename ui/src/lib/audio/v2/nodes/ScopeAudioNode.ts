import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { logger } from '$lib/utils/logger';

import workletUrl from '$lib/audio/native-dsp/processors/scope.processor?worker&url';

const moduleState = { ready: false, promise: null as Promise<void> | null };

/**
 * Oscilloscope display node with XY/Lissajous mode.
 *
 * Uses a custom AudioWorklet processor with rising zero-crossing
 * trigger detection to capture stable waveform buffers.
 * The latest buffer is stored for the Svelte component to read.
 *
 * In waveform mode, displays a single signal over time.
 * In XY mode, plots two signals against each other (Lissajous figures).
 */
export class ScopeAudioNode implements AudioNodeV2 {
  static type = 'scope~';
  static group: AudioNodeGroup = 'processors';
  static description = 'Oscilloscope waveform display';

  static inlets: ObjectInlet[] = [
    {
      name: 'in',
      type: 'signal',
      description: 'Audio signal (or X axis in XY mode)'
    },
    {
      name: 'y',
      type: 'signal',
      description: 'Y axis signal (XY mode only)'
    }
  ];

  static outlets: ObjectOutlet[] = [];

  readonly nodeId: string;
  audioNode: AudioWorkletNode | null = null;
  latestWaveform: Float32Array | null = null;
  latestXY: { x: Float32Array; y: Float32Array } | null = null;

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
      numberOfInputs: 2,
      numberOfOutputs: 0,
      processorOptions: { nodeId: this.nodeId }
    });

    this.audioNode.port.onmessage = (event) => {
      if (event.data.type === 'send-message') {
        const msg = event.data.message;
        if (msg && typeof msg === 'object' && 'x' in msg) {
          this.latestXY = { x: msg.x, y: msg.y };
          this.latestWaveform = null;
        } else {
          this.latestWaveform = msg;
          this.latestXY = null;
        }
      }
    };
  }

  connectFrom(
    source: AudioNodeV2,
    _paramName?: string,
    _sourceHandle?: string,
    targetHandle?: string
  ): void {
    if (!this.audioNode || !source.audioNode) return;

    let inputIndex = 0;
    if (targetHandle) {
      const match = targetHandle.match(/audio-in-(\d+)/);
      if (match) {
        inputIndex = parseInt(match[1], 10);
      }
    }

    source.audioNode.connect(this.audioNode, 0, inputIndex);
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

  setMode(mode: 'waveform' | 'xy'): void {
    this.audioNode?.port.postMessage({
      type: 'message-inlet',
      message: { mode },
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
