import { match, P } from 'ts-pattern';

import type { SendMessageOptions } from '$lib/messages/MessageContext';
import { DSP_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
import { parseJSError, countLines } from '$lib/js-runner/js-error-parser';
import { workletChannel } from './native-dsp/worklet-channel';

type DspMessage =
  | { type: 'set-code'; code: string }
  | { type: 'message-inlet'; message: unknown; meta: RecvMeta }
  | { type: 'set-inlet-values'; values: number[] }
  | { type: 'set-keep-alive'; enabled: boolean }
  | { type: 'sync-audio-ports'; inlets: number; outlets: number }
  | {
      type: 'update-direct-connections';
      connections: Array<{ outlet: number; targetNodeId: string; inlet: number }>;
    }
  | { type: 'stop' };

type RecvMeta = {
  source: string;
  outlet?: number;
  inlet?: number;
  inletKey?: string;
  outletKey?: string;
};

type ProcessFunction = (
  inputs: Float32Array[][],
  outputs: Float32Array[][],
  inlets: unknown[],
  counter: number
) => void;

class DSPProcessor extends AudioWorkletProcessor {
  private nodeId: string;
  private processFunction: ProcessFunction | null = null;
  private inletValues: unknown[] = new Array(10).fill(0);
  private counter = 0;
  private messageInletCount = 0;
  private messageOutletCount = 0;
  private audioInletCount = 1;
  private audioOutletCount = 1;
  private recvCallback: ((message: unknown, meta: RecvMeta) => void) | null = null;
  private shouldStop = false;
  private currentCode = ''; // Track current code for error line counting
  private lastRuntimeErrorTime = 0; // Throttle runtime errors (process() runs ~344 times/sec)
  private lastConsoleTime = 0; // Throttle console output (only in process())
  private isInProcess = false; // Track if we're inside process() for throttling
  private pendingAudioReconfiguration = false; // Skip process() during worklet recreation

  constructor(nodeOptions?: { processorOptions?: { nodeId?: string } }) {
    super();
    this.nodeId = nodeOptions?.processorOptions?.nodeId ?? '';

    // Register with worklet direct channel for receiving direct messages
    if (this.nodeId) {
      workletChannel.register(this.nodeId, (data, inlet) => {
        this.handleMessageInlet(data, { source: '', inlet });
      });
    }

    this.port.onmessage = (event: MessageEvent<DspMessage>) => {
      match(event.data)
        .with({ type: 'set-code', code: P.string }, ({ code }) => {
          this.setCode(code);
        })
        .with({ type: 'set-inlet-values', values: P.array(P.any) }, ({ values }) => {
          this.setInletValues(values);
        })
        .with({ type: 'message-inlet', message: P.any, meta: P.any }, ({ message, meta }) => {
          this.handleMessageInlet(message, meta);
        })
        .with(
          { type: 'sync-audio-ports', inlets: P.number, outlets: P.number },
          ({ inlets, outlets }) => {
            // Sync internal tracking to match actual worklet configuration
            // This prevents setAudioPortCount() from triggering unnecessary reconfiguration
            this.audioInletCount = inlets;
            this.audioOutletCount = outlets;
            this.pendingAudioReconfiguration = false;
          }
        )
        .with(
          { type: 'update-direct-connections', connections: P.array(P.any) },
          ({ connections }) => {
            workletChannel.updateConnections(this.nodeId, connections);
          }
        )
        .with({ type: 'stop' }, () => {
          this.shouldStop = true;
          if (this.nodeId) workletChannel.unregister(this.nodeId);
        });
    };
  }

  private setCode(code: string): void {
    if (!code || code.trim() === '') {
      this.processFunction = null;
      this.currentCode = '';
      return;
    }

    this.shouldStop = false;
    this.currentCode = code;

    try {
      // Reset message port count and recv callback for new code
      // Note: Don't reset audioInletCount/audioOutletCount - the worklet was created
      // with the correct configuration, and resetting would cause setAudioPortCount()
      // in user code to incorrectly trigger reconfiguration
      this.messageInletCount = 0;
      this.messageOutletCount = 0;
      this.pendingAudioReconfiguration = false; // Clear any pending flag from previous code

      this.recvCallback = null;

      const setPortCount = (inlets = 0, outlets = 0) => {
        this.messageInletCount = Math.max(0, inlets);
        this.messageOutletCount = Math.max(0, outlets);

        this.port.postMessage({
          type: 'message-port-count-changed',
          messageInletCount: this.messageInletCount,
          messageOutletCount: this.messageOutletCount
        });
      };

      const setAudioPortCount = (inlets = 1, outlets = 1) => {
        const newInlets = Math.max(0, inlets);
        const newOutlets = Math.max(0, outlets);

        // If port count changes, set pending flag to output silence during reconfiguration
        // This prevents errors from accessing inputs/outputs that don't exist yet
        if (newInlets !== this.audioInletCount || newOutlets !== this.audioOutletCount) {
          this.pendingAudioReconfiguration = true;
        }

        this.audioInletCount = newInlets;
        this.audioOutletCount = newOutlets;

        this.port.postMessage({
          type: 'audio-port-count-changed',
          audioInletCount: this.audioInletCount,
          audioOutletCount: this.audioOutletCount
        });
      };

      // Create send function — delivers directly to worklet targets, then notifies main thread
      const send = (message: unknown, options?: SendMessageOptions) => {
        const outlet = typeof options?.to === 'number' ? options.to : 0;
        const directTargets = this.nodeId ? workletChannel.send(this.nodeId, message, outlet) : [];

        this.port.postMessage({
          type: 'send-message',
          message,
          options,
          directTargets: directTargets.length > 0 ? [...directTargets] : undefined
        });
      };

      const setTitle = (value: string) => this.port.postMessage({ type: 'set-title', value });

      const recv = (callback: (message: unknown, meta: RecvMeta) => void) => {
        this.recvCallback = callback;
      };

      const setKeepAlive = (enabled: boolean) =>
        this.port.postMessage({ type: 'set-keep-alive', enabled });

      // Create custom console that forwards to main thread
      const customConsole = this.createCustomConsole();

      const createProcessorFn = new Function(
        'setPortCount',
        'setAudioPortCount',
        'setTitle',
        'recv',
        'send',
        'setKeepAlive',
        'console',
        `
			var $1, $2, $3, $4, $5, $6, $7, $8, $9;
			var counter = 0;

			${code}

			return (
				inputs,
				outputs,
				inlets,
				_counter
			) => {
				counter = _counter;
				$1 = inlets[0];
				$2 = inlets[1];
				$3 = inlets[2];
				$4 = inlets[3];
				$5 = inlets[4];
				$6 = inlets[5];
				$7 = inlets[6];
				$8 = inlets[7];
				$9 = inlets[8];

			  process(inputs, outputs)
			}
			`
      );

      this.processFunction = createProcessorFn(
        setPortCount,
        setAudioPortCount,
        setTitle,
        recv,
        send,
        setKeepAlive,
        customConsole
      );
    } catch (error) {
      this.handleCodeError(error, 'compile');
      this.processFunction = null;
    }
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    // Stop processing if destroy was called
    if (this.shouldStop) {
      return false;
    }

    const output = outputs[0] || [];

    // Output silence during audio port reconfiguration to prevent errors
    // The worklet will be recreated with new port configuration
    if (this.pendingAudioReconfiguration) {
      for (let channel = 0; channel < output.length; channel++) {
        if (output[channel]) {
          output[channel].fill(0);
        }
      }

      return true;
    }

    // Keep the DSP node alive even without process function
    if (!this.processFunction) {
      // Pass through silence if no process function
      for (let channel = 0; channel < output.length; channel++) {
        if (output[channel]) {
          output[channel].fill(0);
        }
      }

      return true;
    }

    try {
      this.counter++;
      this.isInProcess = true;

      // Normalize inputs: ensure all expected inputs have proper channel arrays
      // This prevents errors when accessing unconnected inputs (e.g., inputs[1][0])
      const normalizedInputs = this.normalizeInputs(inputs, outputs);

      this.processFunction(normalizedInputs, outputs, this.inletValues, this.counter);
      this.isInProcess = false;
    } catch (error) {
      this.isInProcess = false;

      // Throttle runtime errors to max 1 per second (process() runs ~344 times/sec)
      const now = currentTime * 1000; // currentTime is in seconds

      if (now - this.lastRuntimeErrorTime > 1000) {
        this.lastRuntimeErrorTime = now;
        this.handleCodeError(error, 'runtime');
      }

      // Fill with silence on error
      for (let channel = 0; channel < output.length; channel++) {
        if (output[channel]) {
          output[channel].fill(0);
        }
      }
    }

    return true;
  }

  /**
   * Creates a custom console object that forwards output to main thread.
   * Only throttled when called from within process() to prevent flooding.
   * Logs from main body, recv(), etc. are never throttled.
   */
  private createCustomConsole() {
    const CONSOLE_THROTTLE_MS = 100; // Max 10 messages/second (only in process())

    const sendLog = (level: 'log' | 'warn' | 'error' | 'info' | 'debug', args: unknown[]) => {
      // Only throttle if we're inside process()
      if (this.isInProcess) {
        const now = currentTime * 1000;

        if (now - this.lastConsoleTime < CONSOLE_THROTTLE_MS) {
          return;
        }

        this.lastConsoleTime = now;
      }

      this.port.postMessage({ type: 'console-output', level, args });
    };

    return {
      log: (...args: unknown[]) => sendLog('log', args),
      warn: (...args: unknown[]) => sendLog('warn', args),
      error: (...args: unknown[]) => sendLog('error', args),
      info: (...args: unknown[]) => sendLog('info', args),
      debug: (...args: unknown[]) => sendLog('debug', args)
    };
  }

  // Pre-allocated buffers to avoid GC pressure in the audio thread
  private silentBuffer: Float32Array | null = null;
  private normalizedInputs: Float32Array[][] = [];
  private normalizedInletCount = 0;
  private normalizedChannelCount = 0;

  /**
   * Normalize inputs array to ensure all expected inputs have proper channel arrays.
   * - Unconnected inputs get silent (zero-filled) buffers
   * - Connected inputs with fewer channels get silent buffers for missing channels
   *   (e.g., mono input expanded to stereo by adding silent second channel)
   *
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

    // Re-allocate structure only when inlet/channel count changes
    if (
      this.normalizedInletCount !== this.audioInletCount ||
      this.normalizedChannelCount !== channelCount
    ) {
      this.normalizedInputs = new Array(this.audioInletCount);
      for (let i = 0; i < this.audioInletCount; i++) {
        this.normalizedInputs[i] = new Array(channelCount);
      }
      this.normalizedInletCount = this.audioInletCount;
      this.normalizedChannelCount = channelCount;
    }

    // Update references (no allocation — just pointer swaps)
    for (let i = 0; i < this.audioInletCount; i++) {
      for (let ch = 0; ch < channelCount; ch++) {
        this.normalizedInputs[i][ch] =
          inputs[i]?.[ch]?.length > 0 ? inputs[i][ch] : this.silentBuffer;
      }
    }

    return this.normalizedInputs;
  }

  /**
   * Handle code errors and send them to the main thread for display.
   */
  private handleCodeError(error: unknown, context: 'compile' | 'runtime' | 'recv'): void {
    const codeLineCount = countLines(this.currentCode);
    const errorInfo = parseJSError(error, codeLineCount, DSP_WRAPPER_OFFSET);

    if (errorInfo) {
      this.port.postMessage({
        type: 'code-error',
        context,
        message: errorInfo.message,
        lineErrors: errorInfo.lineErrors
      });
    } else {
      // Fallback: no line info available
      const message = error instanceof Error ? error.message : String(error);

      this.port.postMessage({
        type: 'code-error',
        context,
        message,
        lineErrors: null
      });
    }
  }

  private setInletValues(values: unknown[]): void {
    this.inletValues = values;
  }

  private handleMessageInlet(message: unknown, meta: RecvMeta): void {
    if (!this.recvCallback) return;

    try {
      this.recvCallback(message, meta);
    } catch (error) {
      this.handleCodeError(error, 'recv');
    }
  }
}

registerProcessor('dsp-processor', DSPProcessor);
