import { type AudioNodeV2, type AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { logger } from '$lib/utils/logger';
import { match, P } from 'ts-pattern';
import workletUrl from '../../../audio/dsp-processor?worker&url';

/**
 * DspNode implements the dsp~ (DSP processor) audio node.
 * Executes user-defined JavaScript for sample-level audio processing.
 */
export class DspNode implements AudioNodeV2 {
  static type = 'dsp~';
  static group: AudioNodeGroup = 'processors';
  static description = 'User-programmable DSP processor with dynamic inlets/outlets';

  static inlets: ObjectInlet[] = [
    {
      name: 'in',
      type: 'signal',
      description: 'Audio signal input'
    },
    {
      name: 'code',
      type: 'string',
      description: 'JavaScript code for audio processing'
    }
  ];

  static outlets: ObjectOutlet[] = [
    { name: 'out', type: 'signal', description: 'Processed audio output' }
  ];

  // Output gain
  audioNode: GainNode;

  readonly nodeId: string;

  private workletNode: AudioWorkletNode | null = null;
  private audioContext: AudioContext;

  private keepAliveGain: GainNode | null = null;
  private currentCode: string = '';
  private currentInletValues: unknown[] = [];
  private audioInletCount: number = 1;
  private audioOutletCount: number = 1;

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioContext = audioContext;

    // Create gain node immediately for connections
    this.audioNode = audioContext.createGain();
    this.audioNode.gain.value = 1.0;
  }

  async create(params: unknown[]): Promise<void> {
    await this.ensureModule();

    const [, code, audioInlets, audioOutlets] = params as [
      unknown,
      string,
      number | undefined,
      number | undefined
    ];
    this.currentCode = code || '';

    // Use saved port counts if provided (for loading saved patches)
    if (typeof audioInlets === 'number' && audioInlets > 0) {
      this.audioInletCount = audioInlets;
    }
    if (typeof audioOutlets === 'number' && audioOutlets > 0) {
      this.audioOutletCount = audioOutlets;
    }

    try {
      this.createWorklet();

      // Sync port counts to processor so setAudioPortCount() in user code
      // doesn't trigger unnecessary reconfiguration
      if (this.workletNode) {
        this.workletNode.port.postMessage({
          type: 'sync-audio-ports',
          inlets: this.audioInletCount,
          outlets: this.audioOutletCount
        });
      }

      if (code) {
        this.send('code', code);
      }
    } catch (error) {
      logger.error('Failed to create DSP node:', error);
    }
  }

  /**
   * Create or recreate the worklet with current audio port configuration.
   */
  private createWorklet(): void {
    // Disconnect old worklet if exists
    if (this.workletNode) {
      this.workletNode.disconnect();
    }

    // Disable keep-alive before recreating (will be re-enabled if needed)
    this.disableKeepAlive();

    this.workletNode = new AudioWorkletNode(this.audioContext, 'dsp-processor', {
      numberOfInputs: this.audioInletCount,
      numberOfOutputs: this.audioOutletCount
    });

    this.workletNode.connect(this.audioNode);
  }

  async send(key: string, msg: unknown): Promise<void> {
    await this.ensureModule();

    const port = this.workletNode?.port;

    if (!port) {
      logger.warn('cannot send message to dsp~ as worklet port is missing', { key, msg, port });
      return;
    }

    match([key, msg])
      .with(['code', P.string], ([, code]) => {
        this.currentCode = code;
        port.postMessage({ type: 'set-code', code });
      })
      .with(['inletValues', P.array(P.any)], ([, values]) => {
        this.currentInletValues = Array.from(values);
        port.postMessage({ type: 'set-inlet-values', values: this.currentInletValues });
      })
      .with(['messageInlet', P.any], ([, messageData]) => {
        const data = messageData as { inletIndex: number; message: unknown; meta: unknown };

        port.postMessage({
          type: 'message-inlet',
          message: data.message,
          meta: data.meta
        });
      })
      .with(['setKeepAlive', P.boolean], ([, enabled]) => {
        if (enabled) {
          if (this.workletNode) {
            this.enableKeepAlive(this.workletNode);
          }
        } else {
          this.disableKeepAlive();
        }

        port.postMessage({ type: 'set-keep-alive', enabled });
      })
      .with(['updateAudioPorts', P.any], ([, portConfig]) => {
        const config = portConfig as { inlets: number; outlets: number };

        this.updateAudioPorts(config.inlets, config.outlets);
      });
  }

  /**
   * Update audio port configuration by recreating the worklet.
   */
  private updateAudioPorts(inlets: number, outlets: number): void {
    // Only recreate if counts actually changed
    if (inlets === this.audioInletCount && outlets === this.audioOutletCount) {
      return;
    }

    this.audioInletCount = inlets;
    this.audioOutletCount = outlets;

    // Recreate worklet with new port configuration
    this.createWorklet();

    // Re-send configuration and code to the new worklet
    if (this.workletNode) {
      // First, sync the audio port counts so setAudioPortCount() in user code
      // doesn't trigger another reconfiguration
      this.workletNode.port.postMessage({
        type: 'sync-audio-ports',
        inlets: this.audioInletCount,
        outlets: this.audioOutletCount
      });

      if (this.currentCode) {
        this.workletNode.port.postMessage({ type: 'set-code', code: this.currentCode });
      }

      if (this.currentInletValues.length > 0) {
        this.workletNode.port.postMessage({
          type: 'set-inlet-values',
          values: this.currentInletValues
        });
      }
    }
  }

  /**
   * Handle incoming connections - route to worklet input.
   * Parses targetHandle to determine which input index to connect to.
   * For example, "audio-in-2" routes to input index 2.
   */
  async connectFrom(
    source: AudioNodeV2,
    _paramName?: string,
    _sourceHandle?: string,
    targetHandle?: string
  ): Promise<void> {
    await this.ensureModule();

    if (this.workletNode && source.audioNode) {
      let inputIndex = 0;

      // Parse handle like "audio-in-2" to get input index
      if (targetHandle) {
        const indexMatch = targetHandle.match(/audio-in-(\d+)/);
        if (indexMatch) {
          inputIndex = parseInt(indexMatch[1], 10);
        }
      }

      source.audioNode.connect(this.workletNode, 0, inputIndex);
    }
  }

  /**
   * Keep worklet active by connecting to destination at zero gain.
   * Ensures process() runs even when not connected to anything
   *
   * @param worklet
   */
  private enableKeepAlive(worklet: AudioWorkletNode) {
    if (!this.keepAliveGain) {
      this.keepAliveGain = this.audioContext.createGain();
      this.keepAliveGain.gain.value = 0;

      worklet.connect(this.keepAliveGain);

      this.keepAliveGain.connect(this.audioContext.destination);
    }
  }

  /**
   * Disconnect the keep-alive gain node to allow the worklet
   * to stop when it's not connected to anything.
   */
  private disableKeepAlive() {
    if (this.keepAliveGain) {
      this.keepAliveGain.disconnect();
      this.keepAliveGain = null;
    }
  }

  async ensureModule(): Promise<void> {
    await DspNode.ensureModule(this.audioContext);
  }

  destroy(): void {
    if (this.workletNode) {
      try {
        // Signal worklet to stop processing
        this.workletNode.port.postMessage({ type: 'stop' });
      } catch {
        // Port might be closed already
      }

      this.workletNode.disconnect();
    }

    this.keepAliveGain?.disconnect();
    this.audioNode.disconnect();
  }

  private static moduleReady = false;
  private static modulePromise: Promise<void> | null = null;

  private static async ensureModule(audioContext: AudioContext): Promise<void> {
    if (this.moduleReady) return;
    if (this.modulePromise) return this.modulePromise;

    this.modulePromise = (async () => {
      try {
        const processorUrl = new URL(workletUrl, import.meta.url);
        await audioContext.audioWorklet.addModule(processorUrl.href);
        this.moduleReady = true;
      } catch (error) {
        logger.error('cannot add dsp-processor worklet module:', error);
      }
    })();

    return this.modulePromise;
  }

  /** Get the internal worklet node (for UI to access port) */
  get worklet(): AudioWorkletNode | null {
    return this.workletNode;
  }
}
