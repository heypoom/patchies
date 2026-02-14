/**
 * defineDSP — worklet-side helper for native DSP nodes.
 *
 * Eliminates AudioWorkletProcessor boilerplate. Each processor file
 * calls defineDSP() with state, recv, and process functions.
 *
 * Zero allocation in steady state (pre-allocated normalizeInputs).
 */

import { workletChannel } from './worklet-channel';

type SendFn = (message: unknown, outlet?: number) => void;

export interface DefineDSPOptions<S> {
  /** Node type — used as processor name (e.g. 'line~' → registerProcessor('line~', ...)) */
  name: string;

  /** Number of audio input ports (default: 0) */
  audioInlets?: number;

  /** Number of audio output ports (default: 1) */
  audioOutlets?: number;

  /** Factory function that creates initial state. Called once per processor instance. */
  state: () => S;

  /**
   * Handle incoming messages from message inlets.
   * Called on the audio thread but outside the process() hot path.
   */
  recv?: (state: S, data: unknown, inlet: number, send: SendFn) => void;

  /**
   * Process one audio block (128 samples).
   * This is the hot path — runs ~344 times/sec.
   *
   * inputs/outputs are pre-normalized (missing channels get silent buffers).
   */
  process: (state: S, inputs: Float32Array[][], outputs: Float32Array[][], send: SendFn) => void;
}

export function defineDSP<S>(options: DefineDSPOptions<S>): void {
  const audioInletCount = options.audioInlets ?? 0;

  class NativeDSPProcessor extends AudioWorkletProcessor {
    private state: S;
    private shouldStop = false;
    private nodeId: string;

    // Pre-allocated buffers to avoid GC pressure in the audio thread
    private silentBuffer: Float32Array | null = null;
    private normalizedInputs: Float32Array[][] = [];
    private normalizedInletCount = 0;
    private normalizedChannelCount = 0;

    // Bound send function — delivers directly to worklet targets, then notifies main thread
    private send: SendFn = (message, outlet = 0) => {
      const directTargets = this.nodeId ? workletChannel.send(this.nodeId, message, outlet) : [];

      this.port.postMessage({
        type: 'send-message',
        message,
        outlet,
        directTargets: directTargets.length > 0 ? [...directTargets] : undefined
      });
    };

    constructor(nodeOptions?: { processorOptions?: { nodeId?: string } }) {
      super();
      this.nodeId = nodeOptions?.processorOptions?.nodeId ?? '';
      this.state = options.state();

      // Register with worklet direct channel for receiving direct messages
      if (this.nodeId) {
        workletChannel.register(this.nodeId, (data, inlet) => {
          if (options.recv) {
            options.recv(this.state, data, inlet, this.send);
          }
        });
      }

      this.port.onmessage = (event) => {
        if (event.data.type === 'message-inlet' && options.recv) {
          options.recv(this.state, event.data.message, event.data.inlet, this.send);
        } else if (event.data.type === 'update-direct-connections') {
          workletChannel.updateConnections(this.nodeId, event.data.connections);
        } else if (event.data.type === 'stop') {
          this.shouldStop = true;
          if (this.nodeId) workletChannel.unregister(this.nodeId);
        }
      };
    }

    process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
      if (this.shouldStop) return false;

      const normalized = this.normalizeInputs(inputs, outputs);
      options.process(this.state, normalized, outputs, this.send);

      return true;
    }

    /**
     * Pre-allocates the array structure once, then reuses it — only swapping
     * Float32Array references each call (zero allocation in steady state).
     */
    private normalizeInputs(inputs: Float32Array[][], outputs: Float32Array[][]): Float32Array[][] {
      const bufferSize = outputs[0]?.[0]?.length || inputs[0]?.[0]?.length || 128;
      const channelCount = outputs[0]?.length || 2;

      // Create or resize silent buffer if needed
      if (!this.silentBuffer || this.silentBuffer.length !== bufferSize) {
        this.silentBuffer = new Float32Array(bufferSize);
      }

      // Re-allocate structure only when channel count changes
      if (
        this.normalizedInletCount !== audioInletCount ||
        this.normalizedChannelCount !== channelCount
      ) {
        this.normalizedInputs = new Array(audioInletCount);
        for (let i = 0; i < audioInletCount; i++) {
          this.normalizedInputs[i] = new Array(channelCount);
        }
        this.normalizedInletCount = audioInletCount;
        this.normalizedChannelCount = channelCount;
      }

      // Update references (no allocation — just pointer swaps)
      for (let i = 0; i < audioInletCount; i++) {
        for (let ch = 0; ch < channelCount; ch++) {
          this.normalizedInputs[i][ch] =
            inputs[i]?.[ch]?.length > 0 ? inputs[i][ch] : this.silentBuffer;
        }
      }

      return this.normalizedInputs;
    }
  }

  registerProcessor(options.name, NativeDSPProcessor);
}
