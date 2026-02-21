import { match } from 'ts-pattern';

import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { logger } from '$lib/utils/logger';
import { Type } from '@sinclair/typebox';
import { msg, sym } from '$lib/objects/schemas/helpers';
import { schema } from '$lib/objects/schemas/types';

import workletUrl from '$lib/bytebeat/bytebeat-worklet?worker&url';

// Message schemas
export const PlayMsg = sym('play');
export const StopMsg = sym('stop');
export const PauseMsg = sym('pause');
export const BangMsg = sym('bang');

export const SetTypeMsg = msg('setType', {
  value: Type.Union([
    Type.Literal('bytebeat'),
    Type.Literal('floatbeat'),
    Type.Literal('signedBytebeat')
  ])
});

export const SetSyntaxMsg = msg('setSyntax', {
  value: Type.Union([
    Type.Literal('infix'),
    Type.Literal('postfix'),
    Type.Literal('glitch'),
    Type.Literal('function')
  ])
});

export const SetSampleRateMsg = msg('setSampleRate', { value: Type.Number() });

// Pre-wrapped matchers for ts-pattern
export const bytebeatMessages = {
  play: schema(PlayMsg),
  stop: schema(StopMsg),
  pause: schema(PauseMsg),
  bang: schema(BangMsg),
  setType: schema(SetTypeMsg),
  setSyntax: schema(SetSyntaxMsg),
  setSampleRate: schema(SetSampleRateMsg)
};

// Types for settings
export type BytebeatType = 'bytebeat' | 'floatbeat' | 'signedBytebeat';
export type BytebeatSyntax = 'infix' | 'postfix' | 'glitch' | 'function';

// Type/syntax numeric mappings (matching bytebeat-processor.ts)
const TypeMap: Record<BytebeatType, number> = {
  bytebeat: 0,
  floatbeat: 1,
  signedBytebeat: 2
};

const SyntaxMap: Record<BytebeatSyntax, number> = {
  infix: 0,
  postfix: 1,
  glitch: 2,
  function: 3
};

/**
 * BytebeatNode implements the bytebeat~ audio node.
 * Uses a local fork of bytebeat.js for algorithmic bytebeat synthesis.
 */
export class BytebeatNode implements AudioNodeV2 {
  static type = 'bytebeat~';
  static group: AudioNodeGroup = 'sources';
  static description = 'Bytebeat algorithmic synthesis';
  static tags = ['audio', 'generator', 'synthesis', 'algorithmic', 'bytebeat'];

  static inlets: ObjectInlet[] = [
    {
      name: 'control',
      type: 'message',
      description: 'Control messages',
      messages: [
        { schema: PlayMsg, description: 'Start playback' },
        { schema: StopMsg, description: 'Stop and reset t=0' },
        { schema: PauseMsg, description: 'Pause playback (keep t)' },
        { schema: BangMsg, description: 'Evaluate expression and play' },
        { schema: SetTypeMsg, description: 'Set bytebeat type' },
        { schema: SetSyntaxMsg, description: 'Set expression syntax' },
        { schema: SetSampleRateMsg, description: 'Set sample rate' }
      ]
    }
  ];

  static outlets: ObjectOutlet[] = [{ name: 'out', type: 'signal', description: 'Audio output' }];

  readonly nodeId: string;

  // GainNode for play/pause control
  audioNode: GainNode;

  private audioContext: AudioContext;
  private workletNode: AudioWorkletNode | null = null;
  private ready = false;

  // Async message handling
  private msgIdToResolveMap = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: unknown) => void }
  >();
  private nextMsgId = 0;

  // Current settings
  private expr = '((t >> 10) & 42) * t';
  private bytebeatType: BytebeatType = 'bytebeat';
  private syntax: BytebeatSyntax = 'infix';
  private sampleRate = 8000;
  private isPlaying = false;

  // Callbacks for UI updates
  public onPlayStateChange: (isPlaying: boolean) => void = () => {};
  public onError: (error: string | null) => void = () => {};

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioContext = audioContext;

    // Create gain node for play/pause control
    this.audioNode = audioContext.createGain();
    this.audioNode.gain.value = 0; // Start paused
  }

  async create(params: unknown[]): Promise<void> {
    // params could include initial expression, type, syntax, sampleRate
    const [expression, type, syntax, sampleRate] = params as [
      string | undefined,
      BytebeatType | undefined,
      BytebeatSyntax | undefined,
      number | undefined
    ];

    if (expression) this.expr = expression;
    if (type) this.bytebeatType = type;
    if (syntax) this.syntax = syntax;
    if (sampleRate) this.sampleRate = sampleRate;

    await this.ensureBytebeat();
  }

  async send(key: string, message: unknown): Promise<void> {
    // Handle expression updates
    if (key === 'expr' && typeof message === 'string') {
      await this.setExpression(message);
      return;
    }

    // Handle control messages (key can be 'control' or any inlet name)
    return match(message)
      .with(bytebeatMessages.play, async () => {
        await this.play();
      })
      .with(bytebeatMessages.pause, () => {
        this.pause();
      })
      .with(bytebeatMessages.stop, () => {
        this.stop();
      })
      .with(bytebeatMessages.bang, async () => {
        await this.bang();
      })
      .with(bytebeatMessages.setType, async (msg) => {
        await this.setType(msg.value);
      })
      .with(bytebeatMessages.setSyntax, async (msg) => {
        await this.setSyntax(msg.value);
      })
      .with(bytebeatMessages.setSampleRate, async (msg) => {
        await this.setSampleRate(msg.value);
      })
      .otherwise(() => {});
  }

  async play(): Promise<void> {
    await this.ensureBytebeat();
    this.audioNode.gain.value = 1;
    this.isPlaying = true;
    this.onPlayStateChange(true);
  }

  pause(): void {
    this.audioNode.gain.value = 0;
    this.isPlaying = false;
    this.onPlayStateChange(false);
  }

  stop(): void {
    this.audioNode.gain.value = 0;
    this.isPlaying = false;
    this.onPlayStateChange(false);

    // Reset t to 0
    this.callFunc('reset');
  }

  async bang(): Promise<void> {
    await this.setExpression(this.expr);
    await this.play();
  }

  async setExpression(expression: string): Promise<void> {
    this.expr = expression;
    this.onError(null);

    try {
      await this.ensureBytebeat();
      await this.callAsync('setExpressions', [expression], true);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('[bytebeat~] expression error:', errorMsg);
      this.onError(errorMsg);
    }
  }

  async setType(type: BytebeatType): Promise<void> {
    this.bytebeatType = type;
    await this.ensureBytebeat();
    this.callFunc('setType', TypeMap[type]);
  }

  async setSyntax(syntax: BytebeatSyntax): Promise<void> {
    this.syntax = syntax;
    await this.ensureBytebeat();
    this.callFunc('setExpressionType', SyntaxMap[syntax]);
  }

  async setSampleRate(rate: number): Promise<void> {
    this.sampleRate = rate;
    await this.ensureBytebeat();
    this.callFunc('setDesiredSampleRate', rate);
  }

  getExpression(): string {
    return this.expr;
  }

  getType(): BytebeatType {
    return this.bytebeatType;
  }

  getSyntax(): BytebeatSyntax {
    return this.syntax;
  }

  getSampleRate(): number {
    return this.sampleRate;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  // Send a command to the worklet (fire-and-forget)
  private callFunc(fnName: string, ...args: unknown[]): void {
    this.workletNode?.port.postMessage({
      cmd: 'callFunc',
      data: { fn: fnName, args }
    });
  }

  // Send a command to the worklet and wait for response
  private callAsync(fnName: string, ...args: unknown[]): Promise<unknown> {
    const msgId = this.nextMsgId++;
    this.workletNode?.port.postMessage({
      cmd: 'callAsync',
      data: { fn: fnName, msgId, args }
    });

    return new Promise((resolve, reject) => {
      this.msgIdToResolveMap.set(msgId, { resolve, reject });
    });
  }

  private async ensureBytebeat(): Promise<AudioWorkletNode | null> {
    if (this.ready && this.workletNode) return this.workletNode;

    try {
      // Register the worklet
      await this.audioContext.audioWorklet.addModule(workletUrl);

      // Create the worklet node
      this.workletNode = new AudioWorkletNode(this.audioContext, 'bytebeat-processor', {
        outputChannelCount: [2]
      });

      // Handle async responses
      this.workletNode.port.onmessage = (event) => {
        const { cmd, data } = event.data;
        if (cmd === 'asyncResult') {
          const { msgId, error, result } = data;
          const handlers = this.msgIdToResolveMap.get(msgId);
          if (handlers) {
            this.msgIdToResolveMap.delete(msgId);
            if (error) {
              handlers.reject(error);
            } else {
              handlers.resolve(result);
            }
          }
        }
      };

      // Apply initial settings
      this.callFunc('setActualSampleRate', this.audioContext.sampleRate);
      this.callFunc('setDesiredSampleRate', this.sampleRate);
      this.callFunc('setType', TypeMap[this.bytebeatType]);
      this.callFunc('setExpressionType', SyntaxMap[this.syntax]);

      // Set initial expression
      await this.callAsync('setExpressions', [this.expr], true);

      // Connect to gain node for play/pause control
      this.workletNode.connect(this.audioNode);

      this.ready = true;
      logger.log('[bytebeat~] initialized');

      return this.workletNode;
    } catch (error) {
      logger.error('[bytebeat~] initialization error:', error);
      return null;
    }
  }

  destroy(): void {
    if (this.workletNode) {
      try {
        this.workletNode.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }

    this.audioNode.disconnect();
    this.workletNode = null;
    this.ready = false;
  }
}
