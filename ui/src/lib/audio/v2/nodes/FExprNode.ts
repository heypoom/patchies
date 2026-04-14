import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { logger } from '$lib/utils/logger';
import { handleToPortIndex } from '$lib/utils/get-edge-types';
import { match, P } from 'ts-pattern';
import workletUrl from '../../../audio/fexpr-processor?worker&url';

const MAX_SIGNAL_INLETS = 9;

/**
 * FExprNode implements the fexpr~ (filter expression) audio node.
 * Evaluates mathematical expressions sample-by-sample with access to
 * previous input and output samples for building FIR/IIR filters.
 * Supports multiple outlets via semicolon-separated expressions.
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
  private currentOutletCount: number = 1;

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

    await this.createWorklet(1);

    if (expression) {
      this.send('expression', expression);
    }
  }

  private async createWorklet(outletCount: number): Promise<void> {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    try {
      this.workletNode = new AudioWorkletNode(this.audioContext, 'fexpr-processor', {
        numberOfInputs: MAX_SIGNAL_INLETS,
        numberOfOutputs: outletCount
      });

      this.workletNode.connect(this.audioNode, 0);
      this.currentOutletCount = outletCount;
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
      .with(['expressions', P.select()], (data) => {
        const { assignments, outletExpressions, outletCount } = data as {
          assignments: string[];
          outletExpressions: string[];
          outletCount: number;
        };

        if (outletCount !== this.currentOutletCount) {
          this.createWorklet(outletCount).then(() => {
            this.workletNode?.port.postMessage({
              type: 'set-expressions',
              assignments,
              outletExpressions
            });
          });
        } else {
          port.postMessage({ type: 'set-expressions', assignments, outletExpressions });
        }
      })
      .with(['inletValues', P.array(P.number)], ([, values]) => {
        port.postMessage({ type: 'set-inlet-values', values: Array.from(values) });
      });
  }

  /**
   * Handle outgoing connections - route from correct worklet output based on source handle.
   */
  connect(
    target: AudioNodeV2,
    _paramName?: string,
    sourceHandle?: string,
    targetHandle?: string
  ): void {
    if (!this.workletNode || !target.audioNode) return;

    const outputIndexRaw = sourceHandle ? handleToPortIndex(sourceHandle) : null;
    const outputIndex = outputIndexRaw !== null && !isNaN(outputIndexRaw) ? outputIndexRaw : 0;

    // Skip if output index exceeds current outlet count (stale edge)
    if (outputIndex >= this.currentOutletCount) return;

    if (targetHandle) {
      const inputIndex = handleToPortIndex(targetHandle);

      if (inputIndex !== null && !isNaN(inputIndex)) {
        this.workletNode.connect(target.audioNode, outputIndex, inputIndex);
        return;
      }
    }

    this.workletNode.connect(target.audioNode, outputIndex, 0);
  }

  /**
   * Handle incoming connections - route to correct worklet input based on handle.
   */
  async connectFrom(
    source: AudioNodeV2,
    _paramName?: string,
    _sourceHandle?: string,
    targetHandle?: string
  ): Promise<void> {
    await this.ensureModule();

    if (!this.workletNode || !source.audioNode) return;

    let inputIndex = 0;

    if (targetHandle) {
      const indexMatch = targetHandle.match(/audio-in-(\d+)/);

      if (indexMatch) {
        inputIndex = parseInt(indexMatch[1], 10);
      }
    }

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
