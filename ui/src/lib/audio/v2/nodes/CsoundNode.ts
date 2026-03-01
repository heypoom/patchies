import { type AudioNodeV2, type AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { logger } from '$lib/utils/logger';
import { match, P } from 'ts-pattern';
import type { CsoundObj } from '@csound/browser';
import { canUseSharedArrayBuffer } from '$lib/audio/buffer-bridge';
import { transportStore, type TransportPlayState } from '../../../../stores/transport.store';

/**
 * CsoundNode implements the csound~ audio node.
 * Executes Csound code for sound synthesis and processing.
 */
export class CsoundNode implements AudioNodeV2 {
  static type = 'csound~';
  static group: AudioNodeGroup = 'processors';
  static description = 'Csound synthesis and audio processing';

  static inlets: ObjectInlet[] = [
    {
      name: 'in',
      type: 'signal',
      description: 'Audio signal input'
    },
    {
      name: 'msg',
      type: 'message',
      description: 'Control messages'
    }
  ];

  static outlets: ObjectOutlet[] = [{ name: 'out', type: 'signal', description: 'Audio output' }];

  // Output gain node
  audioNode: GainNode;

  readonly nodeId: string;

  private inputNode: GainNode;
  private protectionGain: GainNode;
  private audioContext: AudioContext;

  // Csound state
  private csound: CsoundObj | null = null;
  private initialized = false;
  private isProgramLoaded = false;
  private isPaused = true;
  private optionsString = '';
  private codeString = '';

  // Transport sync
  private syncTransport = false;
  private transportUnsub: (() => void) | null = null;
  private lastPlayState: TransportPlayState | null = null;

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioContext = audioContext;

    // Create gain nodes immediately for connections
    this.audioNode = audioContext.createGain();
    this.audioNode.gain.value = 1.0;

    // Protection gain: starts silent so Csound init noise never reaches output
    this.protectionGain = audioContext.createGain();
    this.protectionGain.gain.value = 0;
    this.protectionGain.connect(this.audioNode);

    this.inputNode = audioContext.createGain();
    this.inputNode.gain.value = 1.0;
  }

  async create(params: unknown[]): Promise<void> {
    const [, code] = params as [unknown, string];

    // Store code but defer initialization until first use to avoid init noise
    if (code) {
      this.codeString = code;
    }

    this.subscribeTransport();
  }

  setSyncTransport(sync: boolean): void {
    this.syncTransport = sync;

    if (sync) {
      this.subscribeTransport();
    } else {
      this.unsubscribeTransport();
    }
  }

  private subscribeTransport(): void {
    if (this.transportUnsub || !this.syncTransport) return;

    this.transportUnsub = transportStore.subscribe((state) => {
      if (!this.syncTransport) return;

      const { playState } = state;
      if (playState === this.lastPlayState) return;
      this.lastPlayState = playState;

      match(playState)
        .with('playing', () => this.resume())
        .with('paused', () => this.pause())
        .with('stopped', async () => {
          await this.csound?.stop();

          this.isPaused = true;
          this.isProgramLoaded = false;
        })
        .exhaustive();
    });
  }

  private unsubscribeTransport(): void {
    this.transportUnsub?.();
    this.transportUnsub = null;
    this.lastPlayState = null;
  }

  async send(key: string, value: unknown): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.csound) return;

    try {
      await match([key, value])
        .with(['code', P.string], async ([, code]) => this.setCode(code))
        .with(['run', P.string], async ([, code]) => this.runCode(code))
        .with(['messageInlet', { inletIndex: P.number, message: P.any, meta: P.any }], ([, data]) =>
          this.handleInletMessage(data.inletIndex, data.message)
        )
        .run();
    } catch (error) {
      logger.error('error in csound~ send:', error);
    }
  }

  /**
   * Handle incoming connections - route to input node
   */
  connectFrom(source: AudioNodeV2): void {
    if (source.audioNode) {
      source.audioNode.connect(this.inputNode);
    }
  }

  async initialize() {
    if (this.initialized) return;
    if (typeof window === 'undefined') return;

    const { Csound } = await import('@csound/browser');

    try {
      const csound = await Csound({
        audioContext: this.audioContext,
        autoConnect: false,
        useSAB: canUseSharedArrayBuffer()
      });

      if (!csound) return;

      this.csound = csound;

      const node = await this.csound.getNode();

      // Route through protectionGain so init noise never reaches output
      if (node) {
        node.connect(this.protectionGain);
      }

      this.initialized = true;
      // protectionGain stays at 0 until audio actually starts (see unmute())
    } catch (error) {
      logger.error('failed to initialize csound~:', error);
    }
  }

  async setCode(code: string) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.csound) return;

    this.codeString = code;

    try {
      await this.csound.stop();
      await this.csound.reset();

      let processedCode = code;

      if (!code.includes('<CsInstruments>')) {
        processedCode = `<CsInstruments>
    		  sr = 48000
          ksmps = 64
          nchnls = 2
          0dbfs = 1

				${processedCode}
			</CsInstruments>`;
      }

      let defaultCsOptions = '';

      if (!code.includes('<CsOptions>')) {
        defaultCsOptions = `<CsOptions>
		  	-odac
			</CsOptions>`;
      }

      const csd = `
        <CsoundSynthesizer>
          ${processedCode}

          ${defaultCsOptions}
        </CsoundSynthesizer>
      `;

      await this.csound.compileCSD(csd);
      await this.setOptions(this.optionsString);
    } catch (error) {
      logger.error('error compiling/running csound~ code:', error);
    }
  }

  async runCode(code: string) {
    if (!this.csound) return;

    await this.setCode(code);
    this.unmute();
    await this.csound.start();
    this.isPaused = false;
    this.isProgramLoaded = true;
  }

  private unmute() {
    this.protectionGain.gain.cancelScheduledValues(this.audioContext.currentTime);
    this.protectionGain.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.01);
  }

  async setOptions(options: string) {
    if (!this.csound) return;

    this.optionsString = options;

    const trimmedOptions = options.split(' ').map((option) => option.trim());

    for (const option of trimmedOptions) {
      await this.csound.setOption(option);
    }
  }

  private async handleInletMessage(inletIndex: number, message: unknown) {
    if (!this.csound) return;

    try {
      await match(message)
        .with({ type: 'bang' }, async () => {
          await this.resume();

          if (this.codeString) {
            await this.runCode(this.codeString);
          }
        })
        .with({ type: 'pause' }, () => this.pause())
        .with({ type: 'play' }, () => this.resume())
        .with({ type: 'stop' }, () => this.csound!.stop())
        .with({ type: 'reset' }, () => this.csound!.reset())
        .with({ type: 'setChannel', channel: P.string, value: P.number }, async (m) => {
          await this.csound!.setControlChannel(m.channel, m.value);
        })
        .with({ type: 'setChannel', channel: P.string, value: P.string }, async (m) => {
          await this.csound!.setStringChannel(m.channel, m.value);
        })
        .with({ type: 'setOptions', value: P.string }, async (m) => {
          await this.setOptions(m.value);
          await this.csound!.reset();
        })
        .with({ type: 'noteOn', note: P.number, velocity: P.number }, async (m) => {
          await this.ensureMidi();
          await this.csound!.midiMessage(144, m.note, m.velocity);
        })
        .with({ type: 'noteOff', note: P.number, velocity: P.number }, async (m) => {
          await this.ensureMidi();
          await this.csound!.midiMessage(128, m.note, m.velocity);
        })
        .with({ type: 'readScore', value: P.string }, async (m) => {
          await this.csound!.readScore(m.value);
        })
        .with({ type: 'eval', code: P.string }, async (m) => {
          await this.csound!.evalCode(m.code);
        })
        .with(P.number, async (value) => {
          await this.csound!.setControlChannel(String(inletIndex), value);
        })
        .with(P.string, async (m) => {
          if (m.startsWith('-')) {
            await this.setOptions(m);
            await this.csound!.reset();
            return;
          }

          await this.csound!.inputMessage(m);
        })
        .run();
    } catch (error) {
      logger.error('error handling csound~ inlet message:', error);
    }
  }

  async pause() {
    if (!this.csound || this.isPaused) return;

    try {
      await this.csound.pause();
      this.isPaused = true;
    } catch (error) {
      logger.error('error pausing csound~:', error);
    }
  }

  async resume() {
    if (!this.isPaused) return;

    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.csound) return;

    if (!this.isProgramLoaded && this.codeString) {
      await this.runCode(this.codeString);
      return;
    }

    this.unmute();

    try {
      await this.csound.resume();

      this.isPaused = false;
    } catch (error) {
      logger.error('error resuming csound~:', error);
    }
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  async ensureMidi() {
    if (this.optionsString.includes('-M0')) return;

    await this.setOptions(`${this.optionsString} -M0`);
    await this.runCode(this.codeString);
  }

  async destroy() {
    this.unsubscribeTransport();

    if (!this.csound) return;

    try {
      await this.csound.stop();
      await this.csound.reset();
      await this.csound.terminateInstance();
    } catch (error) {
      logger.error('error destroying csound~:', error);
    }

    this.audioNode.disconnect();
    this.protectionGain.disconnect();
    this.inputNode.disconnect();
  }
}
