import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { logger } from '$lib/utils/logger';
import { match, P } from 'ts-pattern';
import workletUrl from '../../../audio/fexpr-processor?worker&url';

const MAX_SIGNAL_INLETS = 9;

/**
 * FExprNode implements the fexpr~ (filter expression) audio node.
 * Evaluates mathematical expressions sample-by-sample with access to
 * previous input and output samples for building FIR/IIR filters.
 */
export class FExprNode implements AudioNodeV2 {
  static type = 'fexpr~';
  static group: AudioNodeGroup = 'processors';
  static description = 'Filter expression evaluator with sample history access for FIR/IIR filters';

  // Note: Signal inlets are dynamically rendered based on expression.
  static inlets: ObjectInlet[] = [
    {
      name: 'x1',
      type: 'signal',
      description: 'Audio signal input'
    }
  ];

  static outlets: ObjectOutlet[] = [
    { name: 'out', type: 'signal', description: 'Expression result as audio output' }
  ];

  // Output gain
  audioNode: GainNode;

  readonly nodeId: string;

  private workletNode: AudioWorkletNode | null = null;
  private audioContext: AudioContext;

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioContext = audioContext;
    // Create gain node immediately for connections
    this.audioNode = audioContext.createGain();
    this.audioNode.gain.value = 1.0;
  }

  async create(params: unknown[]): Promise<void> {
    await this.ensureModule();

    const [, expression] = params as [unknown, string];

    try {
      this.workletNode = new AudioWorkletNode(this.audioContext, 'fexpr-processor', {
        numberOfInputs: MAX_SIGNAL_INLETS,
        numberOfOutputs: 1
      });
      this.workletNode.connect(this.audioNode);

      if (expression) {
        this.send('expression', expression);
      }
    } catch (error) {
      logger.error('Failed to create fexpr~ node:', error);
    }
  }

  async send(key: string, msg: unknown): Promise<void> {
    await this.ensureModule();

    const port = this.workletNode?.port;

    if (!port) {
      logger.warn('cannot send message to fexpr~ as worklet port is missing', { key, msg, port });
      return;
    }

    match([key, msg])
      .with(['expression', P.string], ([, expression]) => {
        port.postMessage({ type: 'set-expression', expression });
      })
      .with(['inletValues', P.array(P.number)], ([, values]) => {
        port.postMessage({ type: 'set-inlet-values', values: Array.from(values) });
      });
  }

  /**
   * Handle incoming connections - route to correct worklet input based on handle.
   * Handles: audio-in (default to input 0), audio-in-0, audio-in-1, etc.
   */
  async connectFrom(
    source: AudioNodeV2,
    _paramName?: string,
    _sourceHandle?: string,
    targetHandle?: string
  ): Promise<void> {
    await this.ensureModule();

    if (!this.workletNode || !source.audioNode) return;

    // Parse input index from target handle (e.g., "audio-in-2" -> 2)
    let inputIndex = 0;
    if (targetHandle) {
      const indexMatch = targetHandle.match(/audio-in-(\d+)/);
      if (indexMatch) {
        inputIndex = parseInt(indexMatch[1], 10);
      }
    }

    // Connect source to the correct worklet input
    source.audioNode.connect(this.workletNode, 0, inputIndex);
  }

  async ensureModule(): Promise<void> {
    await FExprNode.ensureModule(this.audioContext);
  }

  destroy(): void {
    this.workletNode?.disconnect();
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
        logger.error('cannot add fexpr-processor worklet module:', error);
      }
    })();

    return this.modulePromise;
  }
}
