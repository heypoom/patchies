import { match } from 'ts-pattern';

import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { logger } from '$lib/utils/logger';
import { Type } from '@sinclair/typebox';
import { msg, sym } from '$lib/objects/schemas/helpers';
import { schema } from '$lib/objects/schemas/types';
import type ByteBeatNodeType from 'bytebeat.js';

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

/**
 * BytebeatNode implements the bytebeat~ audio node.
 * Uses bytebeat.js library for algorithmic bytebeat synthesis.
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

  // GainNode for play/pause control (bytebeat.js has no pause)
  audioNode: GainNode;

  private audioContext: AudioContext;
  private byteBeatNode: ByteBeatNodeType | null = null;
  private ready = false;

  // Current settings
  private expression = '((t >> 10) & 42) * t';
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

    if (expression) this.expression = expression;
    if (type) this.bytebeatType = type;
    if (syntax) this.syntax = syntax;
    if (sampleRate) this.sampleRate = sampleRate;

    await this.ensureBytebeat();
  }

  async send(key: string, message: unknown): Promise<void> {
    // Handle expression updates
    if (key === 'expression' && typeof message === 'string') {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.byteBeatNode as any)?.reset?.();
  }

  async bang(): Promise<void> {
    await this.setExpression(this.expression);
    await this.play();
  }

  async setExpression(expression: string): Promise<void> {
    this.expression = expression;
    this.onError(null);

    try {
      const node = await this.ensureBytebeat();
      if (!node) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (node as any).setExpressions([expression]);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('[bytebeat~] expression error:', errorMsg);
      this.onError(errorMsg);
    }
  }

  async setType(type: BytebeatType): Promise<void> {
    this.bytebeatType = type;

    const node = await this.ensureBytebeat();
    if (!node) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ByteBeatNode = (node as any).constructor;
    const typeMap: Record<BytebeatType, number> = {
      bytebeat: ByteBeatNode.Type?.byteBeat ?? 0,
      floatbeat: ByteBeatNode.Type?.floatBeat ?? 1,
      signedBytebeat: ByteBeatNode.Type?.signedByteBeat ?? 2
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node as any).setType?.(typeMap[type]);
  }

  async setSyntax(syntax: BytebeatSyntax): Promise<void> {
    this.syntax = syntax;

    const node = await this.ensureBytebeat();
    if (!node) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ByteBeatNode = (node as any).constructor;
    const syntaxMap: Record<BytebeatSyntax, number> = {
      infix: ByteBeatNode.ExpressionType?.infix ?? 0,
      postfix: ByteBeatNode.ExpressionType?.postfix ?? 1,
      glitch: ByteBeatNode.ExpressionType?.glitch ?? 2,
      function: ByteBeatNode.ExpressionType?.function ?? 3
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node as any).setExpressionType?.(syntaxMap[syntax]);
  }

  async setSampleRate(rate: number): Promise<void> {
    this.sampleRate = rate;

    const node = await this.ensureBytebeat();
    if (!node) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node as any).setDesiredSampleRate?.(rate);
  }

  getExpression(): string {
    return this.expression;
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

  private async ensureBytebeat(): Promise<ByteBeatNodeType | null> {
    if (this.ready && this.byteBeatNode) return this.byteBeatNode;

    try {
      const ByteBeatNode = (await import('bytebeat.js')).default;

      // Setup worklet
      await ByteBeatNode.setup(this.audioContext);

      // Create node
      this.byteBeatNode = new ByteBeatNode(this.audioContext);

      // Apply settings
      this.byteBeatNode.setType(
        match(this.bytebeatType)
          .with('bytebeat', () => ByteBeatNode.Type.byteBeat)
          .with('floatbeat', () => ByteBeatNode.Type.floatBeat)
          .with('signedBytebeat', () => ByteBeatNode.Type.signedByteBeat)
          .exhaustive()
      );

      this.byteBeatNode.setExpressionType(
        match(this.syntax)
          .with('infix', () => ByteBeatNode.ExpressionType.infix)
          .with('postfix', () => ByteBeatNode.ExpressionType.postfix)
          .with('glitch', () => ByteBeatNode.ExpressionType.glitch)
          .with('function', () => ByteBeatNode.ExpressionType.function)
          .exhaustive()
      );

      this.byteBeatNode.setDesiredSampleRate(this.sampleRate);

      // Set initial expression
      await this.byteBeatNode.setExpressions([this.expression]);

      // Connect to gain node for play/pause control
      this.byteBeatNode.connect(this.audioNode);

      this.ready = true;
      logger.log('[bytebeat~] initialized');

      return this.byteBeatNode;
    } catch (error) {
      logger.error('[bytebeat~] initialization error:', error);
      return null;
    }
  }

  destroy(): void {
    if (this.byteBeatNode) {
      try {
        this.byteBeatNode.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }

    this.audioNode.disconnect();
    this.byteBeatNode = null;
    this.ready = false;
  }
}
