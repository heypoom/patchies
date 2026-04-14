import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { logger } from '$lib/utils/logger';
import { handleToPortIndex } from '$lib/utils/get-edge-types';
import { parseMultiOutletExpressions } from '$lib/utils/expr-parser';
import { match, P } from 'ts-pattern';
import workletUrl from '../../../audio/expression-processor?worker&url';

const MAX_SIGNAL_INLETS = 9;

/**
 * ExprNode implements the expr~ (expression evaluator) audio node.
 * Evaluates mathematical expressions on audio samples.
 * Supports multiple outlets via semicolon-separated expressions.
 *
 * audioNode IS the AudioWorkletNode — no intermediate gain node.
 * This ensures AudioService.updateEdges() properly disconnects all
 * outgoing connections via audioNode.disconnect().
 */
export class ExprNode implements AudioNodeV2 {
  static type = 'expr~';
  static group: AudioNodeGroup = 'processors';
  static description = 'Evaluates mathematical expressions on audio samples';

  // Note: Signal inlets are dynamically rendered in AudioExprNode.svelte based on expression.
  // This static definition is for documentation/object browser preview only.
  static inlets: ObjectInlet[] = [
    {
      name: 's',
      type: 'signal',
      description: 'Audio signal input (use s1-s9 in expression for multiple inputs)'
    },
    {
      name: 'expression',
      type: 'string',
      description:
        'Mathematical expression (s1-s9=signal inputs, s=alias for s1, i=index, t=time, $1-$9=control values)'
    }
  ];

  static outlets: ObjectOutlet[] = [
    { name: 'out', type: 'signal', description: 'Expression result as audio output' }
  ];

  audioNode: AudioNode | null = null;

  readonly nodeId: string;

  private audioContext: AudioContext;
  private currentOutletCount: number = 1;

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioContext = audioContext;
  }

  private get port(): MessagePort | undefined {
    return (this.audioNode as AudioWorkletNode)?.port;
  }

  async create(params: unknown[]): Promise<void> {
    await this.ensureModule();

    const [, expression] = params as [unknown, string];

    if (expression) {
      const parsed = parseMultiOutletExpressions(expression);

      await this.createWorklet(parsed.outletCount);

      this.port?.postMessage({
        type: 'set-expressions',
        assignments: parsed.assignments,
        outletExpressions: parsed.outletExpressions
      });
    } else {
      await this.createWorklet(1);
    }
  }

  private async createWorklet(outletCount: number): Promise<void> {
    if (this.audioNode) {
      this.audioNode.disconnect();
      this.audioNode = null;
    }

    try {
      this.audioNode = new AudioWorkletNode(this.audioContext, 'expression-processor', {
        numberOfInputs: MAX_SIGNAL_INLETS,
        numberOfOutputs: outletCount
      });

      this.currentOutletCount = outletCount;
    } catch (error) {
      logger.error('Failed to create expression node:', error);
    }
  }

  async send(key: string, msg: unknown): Promise<void> {
    await this.ensureModule();

    const port = this.port;

    if (!port) {
      logger.warn('cannot send message to expr~ as worklet port is missing', { key, msg, port });
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

        // Recreate worklet if outlet count changed
        if (outletCount !== this.currentOutletCount) {
          this.createWorklet(outletCount).then(() => {
            this.port?.postMessage({
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
   * Handles: audio-out-0, audio-out-1, etc.
   */
  connect(
    target: AudioNodeV2,
    _paramName?: string,
    sourceHandle?: string,
    targetHandle?: string
  ): void {
    if (!this.audioNode || !target.audioNode) return;

    const outputIndexRaw = sourceHandle ? handleToPortIndex(sourceHandle) : null;
    const outputIndex = outputIndexRaw !== null && !isNaN(outputIndexRaw) ? outputIndexRaw : 0;

    // Skip if output index exceeds current outlet count (stale edge from before outlet reduction)
    if (outputIndex >= this.currentOutletCount) return;

    if (targetHandle) {
      const inputIndex = handleToPortIndex(targetHandle);

      if (inputIndex !== null && !isNaN(inputIndex)) {
        this.audioNode.connect(target.audioNode, outputIndex, inputIndex);
        return;
      }
    }

    this.audioNode.connect(target.audioNode, outputIndex, 0);
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

    if (!this.audioNode || !source.audioNode) return;

    // Parse input index from target handle (e.g., "audio-in-2" -> 2)
    let inputIndex = 0;

    if (targetHandle) {
      const indexMatch = targetHandle.match(/audio-in-(\d+)/);

      if (indexMatch) {
        inputIndex = parseInt(indexMatch[1], 10);
      }
    }

    // Connect source to the correct worklet input
    source.audioNode.connect(this.audioNode, 0, inputIndex);
  }

  async ensureModule(): Promise<void> {
    await ExprNode.ensureModule(this.audioContext);
  }

  destroy(): void {
    this.audioNode?.disconnect();
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
        logger.error('cannot add expression-processor worklet module:', error);
      }
    })();

    return this.modulePromise;
  }
}
