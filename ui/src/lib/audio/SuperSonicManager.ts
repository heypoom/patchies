// ❌ BAD: import SuperSonic from 'supersonic-scsynth';
// ❌ BAD: import type SuperSonic from 'supersonic-scsynth';
// ✅ GOOD: Use dynamic imports only

import { logger } from '$lib/utils/logger';

import { canUseSharedArrayBuffer } from './buffer-bridge';

// Use generic types to avoid importing SuperSonic
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SuperSonicInstance = any; // Will be actual SuperSonic instance

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SuperSonicClass = any; // Will be actual SuperSonic constructor

/** Max stereo output pairs available for sonic~ nodes */
/** WebAudio spec caps AudioWorkletNode channels at 32 */
const MAX_SONIC_STEREO_PAIRS = 16;
const MAX_OUTPUT_CHANNELS = MAX_SONIC_STEREO_PAIRS * 2;

export interface SonicBusAllocation {
  /** scsynth output bus index (0, 2, 4, ...) — use with Out.ar(outBus, signal) */
  busIndex: number;

  /** GainNode carrying this node's isolated stereo output */
  outputNode: GainNode;
}

export class SuperSonicManager {
  private static instance: SuperSonicManager | null = null;
  private sonicInstance: SuperSonicInstance | null = null;
  private SuperSonicClass: SuperSonicClass = null;
  private initPromise: Promise<void> | null = null;
  private audioContext: AudioContext | null = null;

  /** Shared input GainNode → sonic.node.input (connected once) */
  private sharedInputNode: GainNode | null = null;

  /** Splits sonic.node's multi-channel output into individual channels */
  private splitter: ChannelSplitterNode | null = null;

  /** Tracks which stereo pairs are allocated (index = pair number) */
  private allocatedPairs = new Set<number>();

  /** Per-pair merger + gain nodes, created on demand */
  private pairOutputs = new Map<number, { merger: ChannelMergerNode; gain: GainNode }>();

  private constructor() {}

  /**
   * Lazy load SuperSonic only when needed.
   * This is called when the first sonic~ node is created.
   */
  async ensureSuperSonic(audioContext: AudioContext): Promise<{
    sonic: SuperSonicInstance;
    SuperSonic: SuperSonicClass;
    sharedInputNode: GainNode;
  }> {
    if (!this.initPromise) {
      this.audioContext = audioContext;
      this.initPromise = this.initialize();
    }
    await this.initPromise;
    return {
      sonic: this.sonicInstance!,
      SuperSonic: this.SuperSonicClass!,
      sharedInputNode: this.sharedInputNode!
    };
  }

  /**
   * Allocate an isolated stereo bus pair for a sonic~ node.
   * Returns the scsynth bus index and a GainNode with that pair's audio.
   */
  allocateBusPair(): SonicBusAllocation {
    if (!this.audioContext || !this.splitter) {
      throw new Error('SuperSonicManager not initialized — call ensureSuperSonic() first');
    }

    // Find first free pair
    for (let i = 0; i < MAX_SONIC_STEREO_PAIRS; i++) {
      if (!this.allocatedPairs.has(i)) {
        this.allocatedPairs.add(i);

        const busIndex = i * 2;
        const output = this.getOrCreatePairOutput(i);

        logger.log(`[SuperSonic] allocated bus pair ${i} (buses ${busIndex}-${busIndex + 1})`);
        return { busIndex, outputNode: output.gain };
      }
    }

    // All pairs taken — fall back to bus 0 (shared with the first node)
    logger.warn(
      `[SuperSonic] all ${MAX_SONIC_STEREO_PAIRS} bus pairs allocated, falling back to bus 0`
    );

    const fallback = this.getOrCreatePairOutput(0);

    return { busIndex: 0, outputNode: fallback.gain };
  }

  /**
   * Release a bus pair when a sonic~ node is destroyed.
   */
  releaseBusPair(busIndex: number): void {
    const pairIndex = busIndex / 2;
    this.allocatedPairs.delete(pairIndex);

    // Disconnect and clean up the pair's output nodes
    const output = this.pairOutputs.get(pairIndex);
    if (output) {
      try {
        output.merger.disconnect();
        output.gain.disconnect();
      } catch {
        // Already disconnected
      }
      this.pairOutputs.delete(pairIndex);
    }

    logger.log(`[SuperSonic] released bus pair (buses ${busIndex}-${busIndex + 1})`);
  }

  private getOrCreatePairOutput(pairIndex: number): { merger: ChannelMergerNode; gain: GainNode } {
    const existing = this.pairOutputs.get(pairIndex);
    if (existing) return existing;

    const ctx = this.audioContext!;
    const leftChannel = pairIndex * 2;
    const rightChannel = pairIndex * 2 + 1;

    // Merge 2 channels from the splitter into a stereo output
    const merger = ctx.createChannelMerger(2);
    this.splitter!.connect(merger, leftChannel, 0);
    this.splitter!.connect(merger, rightChannel, 1);

    const gain = ctx.createGain();
    gain.gain.value = 1.0;
    merger.connect(gain);

    const output = { merger, gain };
    this.pairOutputs.set(pairIndex, output);
    return output;
  }

  private async initialize(): Promise<void> {
    logger.log('Lazy loading SuperSonic...');

    if (!this.audioContext) {
      throw new Error('AudioContext must be provided to SuperSonicManager');
    }

    // Dynamic import - only loads when first sonic~ node is created
    // @ts-expect-error -- no typedef
    const SuperSonicModule = await import('supersonic-scsynth');
    this.SuperSonicClass = SuperSonicModule.default || SuperSonicModule.SuperSonic;

    const cdnBase = 'https://unpkg.com/';

    // Configure SuperSonic to use unpkg.com CDN for sampels and synth defs.
    // This is necessary because the npm package only includes the main JS file.
    const assetVersion = 'latest';

    this.sonicInstance = new this.SuperSonicClass({
      // Use the shared AudioContext from AudioService
      audioContext: this.audioContext,

      // Use shared array buffer when it is available
      mode: canUseSharedArrayBuffer() ? 'sab' : 'postMessage',

      // Disable auto-connect to speakers - we'll connect through SonicNode's gain node
      autoConnect: false,

      // Local core (enables SAB mode with proper headers)
      baseURL: '/supersonic-scsynth-core/',

      // CDN for large assets
      sampleBaseURL: `${cdnBase}supersonic-scsynth-samples@${assetVersion}/samples/`,
      synthdefBaseURL: `${cdnBase}supersonic-scsynth-synthdefs@${assetVersion}/synthdefs/`,

      // Multi-channel output for per-node bus isolation
      scsynthOptions: {
        numOutputBusChannels: MAX_OUTPUT_CHANNELS
      }
    });

    // Set up event listeners for debugging
    this.sonicInstance.on('ready', () => logger.log('SuperSonic ready'));

    this.sonicInstance.on('error', (err: unknown) => logger.error('[SuperSonic] error:', err));

    this.sonicInstance.on(
      'loading:start',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ type, name }: any) => logger.log(`[SuperSonic] loading ${type}: ${name}`)
    );

    this.sonicInstance.on(
      'loading:complete',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ type, name }: any) => logger.log(`[SuperSonic] loaded ${type}: ${name}`)
    );

    await this.sonicInstance.init();

    // Shared input: all sonic~ nodes' inputNode → sharedInput → sonic.node.input
    this.sharedInputNode = this.audioContext.createGain();
    this.sharedInputNode.gain.value = 1.0;
    this.sharedInputNode.connect(this.sonicInstance.node.input);

    // Split sonic.node's multi-channel output so each sonic~ can extract its bus pair.
    // This splitter is never disconnected by AudioService — it's manager-owned.
    // We must use "discrete" interpretation to prevent Web Audio from downmixing
    // the multi-channel output to stereo before it reaches the splitter.
    this.splitter = this.audioContext.createChannelSplitter(MAX_OUTPUT_CHANNELS);
    this.splitter.channelInterpretation = 'discrete';
    this.sonicInstance.node.connect(this.splitter);

    logger.log(
      `[SuperSonic] initialized with ${MAX_OUTPUT_CHANNELS} output channels (${MAX_SONIC_STEREO_PAIRS} stereo pairs)`
    );
  }

  static getInstance(): SuperSonicManager {
    if (!SuperSonicManager.instance) {
      SuperSonicManager.instance = new SuperSonicManager();
    }

    return SuperSonicManager.instance;
  }

  destroy(): void {
    if (this.sonicInstance) {
      // Use shutdown() instead of destroy() to allow re-init
      this.sonicInstance.shutdown();
    }

    this.allocatedPairs.clear();
    for (const output of this.pairOutputs.values()) {
      try {
        output.merger.disconnect();
        output.gain.disconnect();
      } catch {
        // Already disconnected
      }
    }
    this.pairOutputs.clear();
  }
}
