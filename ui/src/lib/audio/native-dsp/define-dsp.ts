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
   * Default constant values per audio inlet (by inlet index).
   * When an inlet is disconnected, its buffer is filled with this value instead of silence.
   * Float messages to these inlets automatically update the constant.
   *
   * Example: `{ 1: 0 }` — audio inlet 1 defaults to 0, updatable via messages.
   */
  inletDefaults?: Record<number, number>;

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
  const inletDefaults = options.inletDefaults ?? {};

  class NativeDSPProcessor extends AudioWorkletProcessor {
    private state: S;
    private shouldStop = false;
    private nodeId: string;

    // Pre-allocated buffers to avoid GC pressure in the audio thread
    private silentBuffer: Float32Array | null = null;
    private normalizedInputs: Float32Array[][] = [];
    private normalizedInletCount = 0;
    private normalizedChannelCount = 0;

    // Constant value buffers for inlets with defaults (filled with constant when disconnected)
    private inletValues: Map<number, number> = new Map();
    private inletBuffers: Map<number, Float32Array> = new Map();

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

      // Initialize inlet default values
      for (const [inlet, value] of Object.entries(inletDefaults)) {
        this.setInletValue(Number(inlet), value);
      }

      // Register with worklet direct channel for receiving direct messages
      if (this.nodeId) {
        workletChannel.register(this.nodeId, (data, inlet) => {
          this.handleMessage(data, inlet);
        });
      }

      this.port.onmessage = (event) => {
        if (event.data.type === 'message-inlet') {
          this.handleMessage(event.data.message, event.data.inlet);
        } else if (event.data.type === 'update-direct-connections') {
          workletChannel.updateConnections(this.nodeId, event.data.connections);
        } else if (event.data.type === 'stop') {
          this.shouldStop = true;
          if (this.nodeId) workletChannel.unregister(this.nodeId);
        }
      };
    }

    /** Route incoming messages: update inlet constants or forward to user recv */
    private handleMessage(data: unknown, inlet: number): void {
      // Auto-update constant for inlets with defaults
      if (this.inletValues.has(inlet)) {
        const val = typeof data === 'number' ? data : parseFloat(data as string);
        if (!isNaN(val)) {
          this.setInletValue(inlet, val);
        }
      }

      // Still call user recv for custom handling
      if (options.recv) {
        options.recv(this.state, data, inlet, this.send);
      }
    }

    /** Update an inlet's constant value and refill its buffer */
    private setInletValue(inlet: number, value: number): void {
      this.inletValues.set(inlet, value);
      const buf = this.inletBuffers.get(inlet);
      if (buf) buf.fill(value);
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

      // Create or resize inlet constant buffers
      for (const [inlet, value] of this.inletValues) {
        const existing = this.inletBuffers.get(inlet);
        if (!existing || existing.length !== bufferSize) {
          const buf = new Float32Array(bufferSize);
          buf.fill(value);
          this.inletBuffers.set(inlet, buf);
        }
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
        const hasSignal = inputs[i]?.[0]?.length > 0;

        for (let ch = 0; ch < channelCount; ch++) {
          if (hasSignal) {
            this.normalizedInputs[i][ch] = inputs[i][ch];
          } else {
            // Use constant buffer for inlets with defaults, silent buffer otherwise
            this.normalizedInputs[i][ch] = this.inletBuffers.get(i) ?? this.silentBuffer!;
          }
        }
      }

      return this.normalizedInputs;
    }
  }

  registerProcessor(options.name, NativeDSPProcessor);
}
