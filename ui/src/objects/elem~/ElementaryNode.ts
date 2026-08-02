import {
  type AudioNodeV2,
  type AudioNodeGroup,
  type RuntimeDataBinding
} from '$lib/audio/v2/interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { logger } from '$lib/utils/logger';
import { createCustomConsole } from '$lib/utils/createCustomConsole';
import { handleCodeError } from '$lib/js-runner/handleCodeError';
import { match, P } from 'ts-pattern';
import { MessageSystem } from '$lib/messages/MessageSystem';
import { JSRunner } from '$lib/js-runner/JSRunner';
import type WebRenderer from '@elemaudio/web-renderer';
import { ELEM_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
import { createSettingsAPI } from '$lib/settings/create-settings-api';
import { hasAudioInputUsage } from '$lib/audio/visible-audio-inputs';
import { RuntimeAudioCodeState } from '$objects/audio-code/RuntimeAudioCodeState';
import { isRunMessage } from '$objects/audio-code/runtime-audio-code-messages';

type RecvCallback = (message: unknown, meta: unknown) => void;

/**
 * ElementaryNode implements the elem~ audio node.
 * Executes user-defined Elementary Audio code for DSP synthesis and processing.
 */
export class ElementaryNode implements AudioNodeV2 {
  static type = 'elem~';
  static group: AudioNodeGroup = 'processors';

  static runtimeManaged = true;
  static hasRuntimeData = true;

  static dynamicMessageTarget = 'messageInlet';
  static description = 'Elementary Audio DSP synthesis and processing node';

  static inlets: ObjectInlet[] = [
    {
      name: 'in',
      type: 'signal',
      description: 'Audio signal input'
    },
    {
      name: 'code',
      type: 'string',
      description: 'Elementary Audio code to execute'
    }
  ];

  static outlets: ObjectOutlet[] = [{ name: 'out', type: 'signal', description: 'Audio output' }];

  // Output gain node
  audioNode: GainNode;

  readonly nodeId: string;

  private inputNode: GainNode;
  private audioContext: AudioContext;
  private runtimeState: RuntimeAudioCodeState;
  private jsRunner: JSRunner;

  // Elementary Audio state
  private core: WebRenderer | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private elementaryCore: typeof import('@elemaudio/core') | null = null;
  private recvCallback: RecvCallback | null = null;

  // Dynamic port counts for UI
  private messageInletCount = 0;
  private messageOutletCount = 0;

  // Custom console for routing output to VirtualConsole
  private customConsole;

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioContext = audioContext;
    this.customConsole = createCustomConsole(nodeId);

    // Create gain nodes immediately for connections
    this.audioNode = audioContext.createGain();
    this.audioNode.gain.value = 1.0;

    this.inputNode = audioContext.createGain();
    this.inputNode.gain.value = 1.0;

    this.runtimeState = new RuntimeAudioCodeState(nodeId);
    this.jsRunner = JSRunner.getInstance();
  }

  async create(params: unknown[]): Promise<void> {
    const [, code] = params as [unknown, string];

    if (code) {
      await this.setCode(code);
    }
  }

  async send(key: string, msg: unknown): Promise<void> {
    return match([key, msg])
      .with(['code', P.string], ([, code]) => {
        return this.setCode(code);
      })
      .with(['messageInlet', P.any], ([, messageData]) => {
        this.handleMessageInlet(messageData);
      })
      .otherwise(() => {});
  }

  /**
   * Handle incoming connections - route to input node
   */
  connectFrom(source: AudioNodeV2): void {
    if (source.audioNode) {
      source.audioNode.connect(this.inputNode);
    }
  }

  private async ensureElementary() {
    if (!this.elementaryCore) {
      // Lazy load Elementary Audio packages
      const [core, WebRenderer] = await Promise.all([
        import('@elemaudio/core'),
        import('@elemaudio/web-renderer')
      ]);

      this.elementaryCore = core;

      // Initialize WebRenderer if not already done
      if (!this.core) {
        const coreInstance = new WebRenderer.default();

        // Initialize the AudioWorkletNode
        // TODO: support multiple inputs and outputs.
        const node = await coreInstance.initialize(this.audioContext, {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [2]
        });

        this.core = coreInstance;
        this.workletNode = node;

        // Connect the worklet node to our audio graph
        this.inputNode.connect(this.workletNode);
        this.workletNode.connect(this.audioNode);
      }
    }

    return this.elementaryCore;
  }

  private async setCode(code: string): Promise<void> {
    this.runtimeState.setCode(code);
    this.runtimeState.publish({ showAudioInput: hasAudioInputUsage('elem~', code) });
    this.resetMessagePorts();

    if (!code || code.trim() === '') {
      // render silence
      await this.core?.render();
      this.cleanup();

      return;
    }

    this.cleanup();

    try {
      // Ensure Elementary is loaded
      const elementaryCore = await this.ensureElementary();

      if (!this.core || !this.workletNode) {
        throw new Error('Elementary Audio not initialized');
      }

      const settingsManager = this.runtimeState.settingsManager;
      settingsManager.clearCallbacks();

      // Create recv function for receiving messages
      const recv = (callback: (message: unknown, meta: unknown) => void) => {
        this.recvCallback = callback;
      };

      // Create send function for sending messages
      const send = (message: unknown, options?: { to?: number | string }) =>
        MessageSystem.getInstance().sendMessage(this.nodeId, message, options);

      // Preprocess code using JSRunner
      const processedCode = await this.jsRunner.preprocessCode(code, { nodeId: this.nodeId });

      if (!processedCode) {
        logger.warn('code preprocessing returned null');
        return;
      }

      await this.jsRunner.executeJavaScript(this.nodeId, processedCode, {
        customConsole: this.customConsole,
        setPortCount: (inletCount: number = 0, outletCount: number = 0) => {
          this.messageInletCount = Math.max(0, inletCount);
          this.messageOutletCount = Math.max(0, outletCount);

          this.runtimeState.publish({
            messageInletCount: this.messageInletCount,
            messageOutletCount: this.messageOutletCount
          });
        },
        setTitle: (title: string) => {
          this.runtimeState.publish({ title });
        },
        extraContext: {
          el: elementaryCore.el,
          core: this.core,
          node: this.workletNode,
          inputNode: this.inputNode,
          outputNode: this.audioNode,
          recv,
          send,
          showAudioInput: () => this.runtimeState.publish({ showAudioInput: true }),
          ...(settingsManager ? { settings: createSettingsAPI(settingsManager) } : {})
        }
      });
    } catch (error) {
      handleCodeError(error, code, this.nodeId, this.customConsole, ELEM_WRAPPER_OFFSET);
    }
  }

  private handleMessageInlet(message: unknown): void {
    if (isRunMessage(message)) {
      this.setCode(this.runtimeState.getCode());
      return;
    }

    if (!this.recvCallback) return;

    const handleError = (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.customConsole.error(`Error in recv(): ${errorMessage}`);
    };

    try {
      // Type guard to ensure messageData has the expected structure
      if (
        typeof message === 'object' &&
        message !== null &&
        'message' in message &&
        'meta' in message
      ) {
        const data = message as { message: unknown; meta: unknown };
        const result = this.recvCallback(data.message, data.meta) as unknown;

        // Handle async callbacks that return a promise
        if (result instanceof Promise) {
          result.catch(handleError);
        }
      }
    } catch (error) {
      handleError(error);
    }
  }

  private resetMessagePorts(): void {
    this.messageInletCount = 0;
    this.messageOutletCount = 0;
    this.recvCallback = null;

    this.runtimeState.publish({ messageInletCount: 0, messageOutletCount: 0 });
  }

  bindRuntimeData(binding: RuntimeDataBinding): void {
    this.runtimeState.initialize(binding);
  }

  getSettingsManager() {
    return this.runtimeState.settingsManager;
  }

  private cleanup(): void {
    this.core?.gc();
    this.core?.pruneVirtualFileSystem();
  }

  destroy(): void {
    this.core?.render();

    this.cleanup();
    this.recvCallback = null;

    this.jsRunner.destroy(this.nodeId);

    // Disconnect audio nodes
    if (this.workletNode) {
      try {
        this.inputNode.disconnect(this.workletNode);
        this.workletNode.disconnect(this.audioNode);
      } catch (error) {
        logger.warn('cannot disconnect elem~ node:', error);
      }
    }

    this.audioNode.disconnect();
    this.inputNode.disconnect();
  }
}
