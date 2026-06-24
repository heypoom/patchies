import { type AudioNodeV2, type AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { logger } from '$lib/utils/logger';
import { match, P } from 'ts-pattern';
import { MessageContext } from '$lib/messages/MessageContext';
import type { Chuck } from 'webchuck';
import { writable } from 'svelte/store';
import { getChuckGlobalVariableArrayType, getChuckGlobalVariableType } from '../chuck-helpers';

export interface ChuckShred {
  id: number;
  chuckId: number;
  time: number;
  code: string;
}

const ADC_REBUILD_FADE_OUT_SECONDS = 0.18;
const ADC_REBUILD_SILENCE_HOLD_SECONDS = 0.08;
const ADC_REBUILD_DETACH_HOLD_SECONDS = 0.12;
const ADC_REBUILD_FADE_IN_SECONDS = 0.2;

/**
 * ChuckNode implements the chuck~ audio node.
 * Executes ChucK code for strongly-timed, concurrent audio synthesis.
 */
export class ChuckNode implements AudioNodeV2 {
  static type = 'chuck~';
  static group: AudioNodeGroup = 'processors';
  static description = 'ChucK strongly-timed concurrent audio programming';

  static inlets: ObjectInlet[] = [
    {
      name: 'in',
      type: 'signal',
      description: 'Audio input (accessible via adc in ChucK code)'
    },
    {
      name: 'msg',
      type: 'message',
      description: 'Control input (code, bang, stop)'
    }
  ];

  static outlets: ObjectOutlet[] = [
    { name: 'out', type: 'signal', description: 'Audio output' },
    { name: 'msg', type: 'message', description: 'Message output (print)' }
  ];

  // Output gain node
  audioNode: GainNode;

  readonly nodeId: string;

  private audioContext: AudioContext;
  private messageContext: MessageContext;

  // ChucK state
  private chuck: Chuck | null = null;
  private shreds: ChuckShred[] = [];
  private nextShredRunId = 1;
  private ready = false;
  private inputConnections = new Set<AudioNode>();
  private eventListenerIds: Map<string, number> = new Map();
  private errorMessage: string | null = null;
  private chuckOutputConnected = false;

  /** Allows Svelte to subscribe to the shreds */
  public shredsStore = writable<ChuckShred[]>([]);
  public onError: (error: string | null) => void = () => {};

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioContext = audioContext;

    // Create gain node immediately for connections
    this.audioNode = audioContext.createGain();
    this.audioNode.gain.value = 1.0;

    this.messageContext = new MessageContext(nodeId);
  }

  async create(): Promise<void> {
    await this.ensureChuck();
  }

  async send(key: string, value: unknown): Promise<void> {
    await match([key, value])
      .with(['init', P.any], async () => {
        await this.ensureChuck();
      })
      .with(['add', P.string], async ([, code]) => {
        await this.addShredCode(code);
      })
      .with(['replace', P.string], async ([, code]) => {
        await this.replaceCode(code);
      })
      .with(['remove', P.any], async () => {
        await this.removeLastCode();
      })
      .with(['removeShred', P.number], async ([, shredId]) => {
        await this.removeShred(shredId);
      })
      .with(['clearAll', P.any], async () => {
        await this.clearAll();
      })
      .with(['signal', { event: P.string }], ([, m]) => {
        this.chuck?.signalEvent(m.event);
      })
      .with(['broadcast', { event: P.string }], ([, m]) => {
        this.chuck?.broadcastEvent(m.event);
      })
      .with(['set', { key: P.string, value: P.string }], async ([, m]) => {
        this.chuck?.setString(m.key, m.value);
      })
      .with(['set', { key: P.string, value: P.array(P.number) }], async ([, m]) => {
        const currentShred = this.shreds.at(-1);
        if (!currentShred) return;

        const varType = getChuckGlobalVariableArrayType(currentShred?.code, m.key);

        if (varType == 'float' || m.value.every((num) => !Number.isInteger(num))) {
          this.chuck?.setFloatArray(m.key, m.value);
        } else {
          this.chuck?.setIntArray(m.key, m.value);
        }
      })
      .with(['set', { key: P.string, value: P.number }], async ([, m]) => {
        const currentShred = this.shreds.at(-1);
        if (!currentShred) return;

        const varType = getChuckGlobalVariableType(currentShred?.code, m.key);

        if (varType == 'float' || !Number.isInteger(m.value)) {
          this.chuck?.setFloat(m.key, m.value);
        } else {
          this.chuck?.setInt(m.key, m.value);
        }
      })
      .with(['setInt', { key: P.string, value: P.number }], async ([, m]) => {
        this.chuck?.setInt(m.key, m.value);
      })
      .with(['setFloat', { key: P.string, value: P.number }], async ([, m]) => {
        this.chuck?.setFloat(m.key, m.value);
      })
      .with(['setIntArray', { key: P.string, value: P.array(P.number) }], async ([, m]) => {
        this.chuck?.setIntArray(m.key, m.value);
      })
      .with(['setFloatArray', { key: P.string, value: P.array(P.number) }], async ([, m]) => {
        this.chuck?.setFloatArray(m.key, m.value);
      })
      .with(['get', { key: P.string }], async ([, m]) => {
        if (!this.chuck) return;

        const currentShred = this.shreds.at(-1);
        if (!currentShred) return;

        // Detect type from code and call appropriate getter
        const varType = getChuckGlobalVariableType(currentShred.code, m.key);
        const arrayType = getChuckGlobalVariableArrayType(currentShred.code, m.key);

        let value: unknown;
        if (arrayType === 'int') {
          value = await this.chuck.getIntArray(m.key);
        } else if (arrayType === 'float') {
          value = await this.chuck.getFloatArray(m.key);
        } else if (varType === 'int') {
          value = await this.chuck.getInt(m.key);
        } else if (varType === 'float') {
          value = await this.chuck.getFloat(m.key);
        } else if (varType === 'string') {
          value = await this.chuck.getString(m.key);
        } else {
          // Default to float for unknown types
          value = await this.chuck.getFloat(m.key);
        }

        this.messageContext.send({ key: m.key, value });
      })
      .with(['getInt', { key: P.string }], async ([, m]) => {
        const value = await this.chuck?.getInt(m.key);
        if (value !== undefined) this.messageContext.send({ key: m.key, value });
      })
      .with(['getFloat', { key: P.string }], async ([, m]) => {
        const value = await this.chuck?.getFloat(m.key);
        if (value !== undefined) this.messageContext.send({ key: m.key, value });
      })
      .with(['getString', { key: P.string }], async ([, m]) => {
        const value = await this.chuck?.getString(m.key);
        if (value !== undefined) this.messageContext.send({ key: m.key, value });
      })
      .with(['getIntArray', { key: P.string }], async ([, m]) => {
        const value = await this.chuck?.getIntArray(m.key);
        if (value !== undefined) this.messageContext.send({ key: m.key, value });
      })
      .with(['getFloatArray', { key: P.string }], async ([, m]) => {
        const value = await this.chuck?.getFloatArray(m.key);
        if (value !== undefined) this.messageContext.send({ key: m.key, value });
      })
      .with(['listenOnce', { event: P.string }], ([, m]) => {
        this.chuck?.listenForEventOnce(m.event, () => {
          this.messageContext.send({ event: m.event });
        });
      })
      .with(['listenStart', { event: P.string }], ([, m]) => {
        // Stop existing listener if any
        const existingId = this.eventListenerIds.get(m.event);
        if (existingId !== undefined) {
          this.chuck?.stopListeningForEvent(m.event, existingId);
        }

        const callbackId = this.chuck?.startListeningForEvent(m.event, () => {
          this.messageContext.send({ event: m.event });
        });

        if (callbackId !== undefined) {
          this.eventListenerIds.set(m.event, callbackId);
        }
      })
      .with(['listenStop', { event: P.string }], ([, m]) => {
        const callbackId = this.eventListenerIds.get(m.event);
        if (callbackId !== undefined) {
          this.chuck?.stopListeningForEvent(m.event, callbackId);
          this.eventListenerIds.delete(m.event);
        }
      })
      .run();
  }

  async addShredCode(code: string): Promise<void> {
    const chuck = await this.ensureChuck();
    if (!chuck) return;

    try {
      const shredId = await chuck.runCode(this.withKeepAlive(code));
      const now = await chuck.now();

      if (now === 0) {
        logger.warn('[chuck~] chuck.now() returned 0, chuck is likely broken! reloading.');
        await this.reloadChuck();
        return;
      }

      this.shreds.push({
        id: this.nextShredRunId++,
        chuckId: shredId,
        time: now,
        code: code.trim()
      });

      this.clearError();
      this.updateStore();
    } catch (error) {
      logger.error('chuck~ run error:', error);
      this.setError(error, 'ChucK run error');
      throw error;
    }
  }

  async replaceCode(code: string): Promise<void> {
    const chuck = await this.ensureChuck();
    if (!chuck) return;

    try {
      if (this.shreds.length === 0) {
        // if no shreds, just run the code.
        await this.addShredCode(code);
      } else {
        const nextShreds = [...this.shreds];
        nextShreds[nextShreds.length - 1] = {
          ...nextShreds[nextShreds.length - 1],
          code: code.trim()
        };

        const replacedShred = this.shreds.at(-1);
        if (replacedShred && this.needsVmRebuild(replacedShred.code, code)) {
          await this.rebuildChuckWithShreds(nextShreds);
        } else {
          await chuck.replaceCode(this.withKeepAlive(code));
          this.shreds = nextShreds;
          this.clearError();
          this.updateStore();
        }
      }
    } catch (error) {
      logger.error('chuck~ replace error:', error);
      this.setError(error, 'ChucK replace error');
      throw error;
    }
  }

  async removeLastCode(): Promise<void> {
    const chuck = await this.ensureChuck();
    if (!chuck) return;

    try {
      const shred = this.shreds.at(-1);
      if (shred && this.needsVmRebuild(shred.code)) {
        await this.rebuildChuckWithShreds(this.shreds.slice(0, -1));
      } else {
        await chuck.removeLastCode();
        this.shreds.pop();
        this.updateStore();
      }
    } catch (error) {
      logger.warn('[chuck~] remove last shred failed; clearing ChucK instance instead:', error);
      this.clearChuckInstance();
    }
  }

  async removeShred(runId: number): Promise<void> {
    const chuck = await this.ensureChuck();
    if (!chuck) return;

    const shred = this.shreds.find((entry) => entry.id === runId);
    if (!shred) return;

    try {
      if (this.needsVmRebuild(shred.code)) {
        await this.rebuildChuckWithShreds(this.shreds.filter((entry) => entry.id !== runId));
      } else {
        await chuck.removeShred(shred.chuckId);
        this.shreds = this.shreds.filter((entry) => entry.id !== runId);
        this.updateStore();
      }
    } catch (error) {
      logger.warn(
        `[chuck~] remove shred run ${runId} / ChucK ID ${shred.chuckId} failed; clearing ChucK instance instead`,
        error
      );
      this.clearChuckInstance();
    }
  }

  async clearAll(): Promise<void> {
    const chuck = await this.ensureChuck();
    if (!chuck) throw new Error('chuck~ not initialized');

    try {
      await this.withOutputFade(async () => {
        this.clearChuckInstance();
      });
    } catch (error) {
      logger.error('chuck~ clear error:', error);
      throw error;
    }
  }

  getShreds(): ChuckShred[] {
    return [...this.shreds];
  }

  getError(): string | null {
    return this.errorMessage;
  }

  private updateStore() {
    this.shredsStore.set([...this.shreds]);
  }

  private setError(error: unknown, fallback: string) {
    const message = this.getErrorMessage(error, fallback);
    this.errorMessage = message;

    this.onError(message);
  }

  private getErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    if (error && typeof error === 'object' && 'type' in error && typeof error.type === 'string') {
      return `${fallback}: ${error.type}`;
    }

    return fallback;
  }

  private clearError() {
    this.errorMessage = null;
    this.onError(null);
  }

  private clearChuckInstance() {
    this.chuck?.clearChuckInstance();
    this.shreds = [];
    this.nextShredRunId = 1;
    this.clearError();
    this.updateStore();
  }

  private withKeepAlive(code: string) {
    if (/=>\s*now\b/.test(code)) {
      return code;
    }

    return `${code}\n\n// Keep immediate audio patches removable from Patchies.\nwhile (true) 1::day => now;`;
  }

  private needsVmRebuild(...codes: string[]) {
    return codes.some((code) => /\badc\b/.test(code));
  }

  private async rebuildChuckWithShreds(shreds: ChuckShred[]) {
    await this.withOutputFade(async () => {
      await this.reloadChuck();

      const nextShreds: ChuckShred[] = [];

      for (const shred of shreds) {
        const chuck = this.chuck;
        if (!chuck) return;

        const chuckId = await chuck.runCode(this.withKeepAlive(shred.code));
        const time = await chuck.now();

        nextShreds.push({
          ...shred,
          chuckId,
          time
        });
      }

      this.shreds = nextShreds;
      this.clearError();
      this.updateStore();
    });
  }

  private async withOutputFade(action: () => void | Promise<void>) {
    this.rampOutputGain(0, ADC_REBUILD_FADE_OUT_SECONDS);
    await this.wait(ADC_REBUILD_FADE_OUT_SECONDS * 1000);
    this.holdOutputSilence();
    this.disconnectChuckInputs();
    this.disconnectChuckOutput();
    await this.wait(ADC_REBUILD_DETACH_HOLD_SECONDS * 1000);

    try {
      await action();
      await this.wait(ADC_REBUILD_SILENCE_HOLD_SECONDS * 1000);
    } finally {
      this.connectChuckOutput();
      this.rampOutputGain(1, ADC_REBUILD_FADE_IN_SECONDS, 0);
    }
  }

  private connectChuckOutput() {
    if (!this.chuck || this.chuckOutputConnected) return;

    this.chuck.connect(this.audioNode);
    this.chuckOutputConnected = true;
  }

  private disconnectChuckOutput() {
    if (!this.chuck || !this.chuckOutputConnected) return;

    try {
      this.chuck.disconnect(this.audioNode);
    } catch {
      this.chuck.disconnect();
    }

    this.chuckOutputConnected = false;
  }

  private disconnectChuckInputs() {
    if (!this.chuck) return;

    for (const inputNode of this.inputConnections) {
      try {
        inputNode.disconnect(this.chuck);
      } catch {
        // The graph may already have been disconnected by AudioService.
      }
    }
  }

  private holdOutputSilence() {
    const gain = this.audioNode.gain;
    const now = this.audioContext.currentTime;

    gain.cancelScheduledValues(now);
    gain.setValueAtTime(0, now);
    gain.value = 0;
  }

  private rampOutputGain(
    value: number,
    durationSeconds: number,
    startValue = this.audioNode.gain.value
  ) {
    const gain = this.audioNode.gain;
    const now = this.audioContext.currentTime;

    gain.cancelScheduledValues(now);
    gain.setValueAtTime(startValue, now);
    gain.linearRampToValueAtTime(value, now + durationSeconds);
    gain.value = value;
  }

  private wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async ensureChuck(): Promise<Chuck | null> {
    if (this.ready) return this.chuck;

    try {
      await this.reloadChuck();
      this.ready = true;
      this.clearError();

      return this.chuck;
    } catch (error) {
      if (!this.errorMessage) {
        logger.error('failed to initialize chuck~:', error);
        this.setError(error, 'Failed to initialize ChucK');
      }

      return null;
    }
  }

  async reloadChuck() {
    const { Chuck } = await import('webchuck');

    if (this.chuck) {
      this.chuck.clearChuckInstance();
      this.chuck.clearGlobals();
      this.disconnectChuckOutput();
    }

    try {
      this.chuck = await Chuck.init(
        [],
        this.audioContext,
        this.audioNode.channelCount,
        './webchuck/'
      );
    } catch (error) {
      logger.error('chuck~ init error:', error);
      this.setError(error, 'Failed to initialize ChucK');

      throw error;
    }

    this.chuckOutputConnected = false;
    this.connectChuckOutput();

    // Redirect ChucK print to message system
    this.chuck.chuckPrint = (message: string) => {
      this.messageContext.send(message);
    };

    this.chuck.addEventListener('processorerror', (event) => {
      logger.error('chuck~ AudioWorkletProcessor error:', event);
      this.setError(event, 'ChucK AudioWorkletProcessor error');
    });

    // Reconnect audio inputs so `adc` keeps working after VM rebuilds.
    for (const inputNode of this.inputConnections) {
      inputNode.connect(this.chuck);
    }

    logger.log('[chuck~] reloaded');
  }

  /**
   * Handle incoming audio connections.
   * Routes audio to the ChucK instance so it's accessible via `adc` in ChucK code.
   */
  connectFrom(source: AudioNodeV2): void {
    if (!source.audioNode) return;

    this.inputConnections.add(source.audioNode);

    // Connect the source to the ChucK instance (not our output gain node)
    // This makes the audio available via `adc` in ChucK code
    if (this.chuck) {
      source.audioNode.connect(this.chuck);
    }
  }

  disconnectInputs(): void {
    this.inputConnections.clear();
  }

  destroy(): void {
    if (this.chuck) {
      // Stop all event listeners
      for (const [event, callbackId] of this.eventListenerIds) {
        this.chuck.stopListeningForEvent(event, callbackId);
      }

      try {
        this.chuck.clearChuckInstance();
        this.disconnectChuckOutput();
      } catch (error) {
        logger.error('failed to cleanup chuck~ during destroy:', error);
      }
    }

    this.audioNode.disconnect();
    this.shreds = [];
    this.nextShredRunId = 1;
    this.updateStore();
    this.chuck = null;
    this.ready = false;
    this.inputConnections.clear();
    this.eventListenerIds.clear();
    this.messageContext.destroy();
  }
}
