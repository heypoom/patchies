/**
 * BufferBridgeService — main-thread singleton for managing named audio buffers.
 *
 * Uses SharedArrayBuffer when cross-origin isolation is available for
 * zero-copy reads from the main thread. Falls back to snapshot copies
 * via MessagePort when SAB is unavailable.
 *
 * The actual buffer storage lives in the WorkletBufferRegistry on the
 * audio thread. This service communicates via a dedicated BufferBridgeProcessor.
 */

import { canUseSharedArrayBuffer } from './feature-detect';
import { logger } from '$lib/utils/logger';

import bridgeProcessorUrl from './buffer-bridge.processor?worker&url';

type BufferChangeEvent = 'create' | 'delete' | 'resize';
type BufferChangeCallback = (name: string, event: BufferChangeEvent) => void;

interface BufferView {
  sab: SharedArrayBuffer;
  view: Float32Array;
  length: number;
  channels: number;
}

interface SnapshotResponse {
  type: 'snapshot';
  name: string;
  data: Float32Array | null;
  length?: number;
  channels?: number;
}

interface BufferListResponse {
  type: 'buffer-list';
  names: string[];
}

export class BufferBridgeService {
  private static instance: BufferBridgeService | null = null;

  private bridgeNode: AudioWorkletNode | null = null;
  private readonly useSAB: boolean;
  private initialized = false;

  /** SAB mode: direct Float32Array views keyed by buffer name */
  private bufferViews = new Map<string, BufferView>();

  /** Pending snapshot requests (fallback mode) */
  private snapshotCallbacks = new Map<string, (data: Float32Array | null) => void>();

  /** Event listeners for buffer changes */
  private changeListeners = new Set<BufferChangeCallback>();

  /** Queued createBuffer calls made before init() */
  private pendingCreates: Array<{ name: string; length: number; channels: number }> = [];

  private constructor() {
    this.useSAB = canUseSharedArrayBuffer();
  }

  static getInstance(): BufferBridgeService {
    if (!BufferBridgeService.instance) {
      BufferBridgeService.instance = new BufferBridgeService();
    }
    return BufferBridgeService.instance;
  }

  /** Initialize the bridge processor on the AudioContext */
  async init(audioContext: AudioContext): Promise<void> {
    if (this.initialized) return;

    try {
      const processorUrl = new URL(bridgeProcessorUrl, import.meta.url);
      await audioContext.audioWorklet.addModule(processorUrl.href);

      // AudioWorkletNode requires at least 1 output to stay alive
      this.bridgeNode = new AudioWorkletNode(audioContext, 'buffer-bridge', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1]
      });

      this.bridgeNode.port.onmessage = (e: MessageEvent) => {
        this.handleWorkletMessage(e.data);
      };

      this.initialized = true;

      // Flush any buffer creates that were queued before init
      for (const pending of this.pendingCreates) {
        this.createBuffer(pending.name, pending.length, pending.channels);
      }

      this.pendingCreates = [];

      logger.info(`BufferBridge initialized (SAB: ${this.useSAB})`);
    } catch (error) {
      logger.error('Failed to initialize BufferBridgeService:', error);
      throw error;
    }
  }

  /** Create a named buffer */
  createBuffer(name: string, length: number, channels = 1): void {
    if (!this.bridgeNode) {
      this.pendingCreates.push({ name, length, channels });
      return;
    }

    if (this.useSAB) {
      const byteLength = length * channels * Float32Array.BYTES_PER_ELEMENT;
      const sab = new SharedArrayBuffer(byteLength);
      const view = new Float32Array(sab);

      this.bufferViews.set(name, { sab, view, length, channels });
      this.bridgeNode.port.postMessage({ type: 'create', name, length, channels, sab });
    } else {
      this.bridgeNode.port.postMessage({ type: 'create', name, length, channels });
    }

    this.notifyChange(name, 'create');
  }

  /** Delete a named buffer */
  deleteBuffer(name: string): void {
    this.bufferViews.delete(name);
    this.bridgeNode?.port.postMessage({ type: 'delete', name });
    this.notifyChange(name, 'delete');
  }

  /** Resize a named buffer (preserves data up to min of old/new length) */
  resizeBuffer(name: string, newLength: number): void {
    if (!this.bridgeNode) return;

    const existing = this.bufferViews.get(name);
    const channels = existing?.channels ?? 1;

    if (this.useSAB) {
      const byteLength = newLength * channels * Float32Array.BYTES_PER_ELEMENT;
      const sab = new SharedArrayBuffer(byteLength);
      const view = new Float32Array(sab);

      // Copy existing data
      if (existing) {
        const copyLen = Math.min(existing.view.length, view.length);
        view.set(existing.view.subarray(0, copyLen));
      }

      this.bufferViews.set(name, { sab, view, length: newLength, channels });
      this.bridgeNode.port.postMessage({ type: 'resize', name, length: newLength, sab });
    } else {
      this.bridgeNode.port.postMessage({ type: 'resize', name, length: newLength });
    }

    this.notifyChange(name, 'resize');
  }

  /** Clear a buffer (fill with zeros, reset write head) */
  clearBuffer(name: string): void {
    const view = this.bufferViews.get(name);
    if (view) view.view.fill(0);

    this.bridgeNode?.port.postMessage({ type: 'clear', name });
  }

  /** Set a single sample value */
  setBufferSample(name: string, index: number, value: number): void {
    const view = this.bufferViews.get(name);
    if (view) {
      const wrapped = ((index % view.length) + view.length) % view.length;
      view.view[wrapped] = value;
    }

    this.bridgeNode?.port.postMessage({ type: 'set', name, index, value });
  }

  /**
   * Read buffer data from the main thread (sync).
   *
   * SAB mode: returns the live Float32Array view (zero-copy, real-time).
   * Fallback mode: returns null (use readBufferAsync instead).
   */
  readBuffer(name: string): Float32Array | null {
    if (this.useSAB) {
      return this.bufferViews.get(name)?.view ?? null;
    }
    return null;
  }

  /** Async read — works in both modes */
  readBufferAsync(name: string): Promise<Float32Array | null> {
    if (this.useSAB) {
      return Promise.resolve(this.readBuffer(name));
    }

    return new Promise((resolve) => {
      this.snapshotCallbacks.set(name, resolve);
      this.bridgeNode?.port.postMessage({ type: 'get-snapshot', name });
    });
  }

  /** Get buffer metadata */
  getBufferInfo(name: string): { length: number; channels: number } | null {
    const view = this.bufferViews.get(name);
    if (view) return { length: view.length, channels: view.channels };
    return null;
  }

  /** Whether SAB is available */
  get isSharedMemory(): boolean {
    return this.useSAB;
  }

  /** Whether the service has been initialized */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /** Subscribe to buffer lifecycle changes. Returns unsubscribe function. */
  onBufferChange(cb: BufferChangeCallback): () => void {
    this.changeListeners.add(cb);
    return () => this.changeListeners.delete(cb);
  }

  destroy(): void {
    if (this.bridgeNode) {
      this.bridgeNode.port.onmessage = null;
      this.bridgeNode.disconnect();
      this.bridgeNode = null;
    }

    this.bufferViews.clear();
    this.snapshotCallbacks.clear();
    this.changeListeners.clear();
    this.initialized = false;
  }

  private handleWorkletMessage(msg: SnapshotResponse | BufferListResponse): void {
    if (msg.type === 'snapshot') {
      const cb = this.snapshotCallbacks.get(msg.name);
      if (cb) {
        this.snapshotCallbacks.delete(msg.name);
        cb(msg.data);
      }
    }
  }

  private notifyChange(name: string, event: BufferChangeEvent): void {
    for (const cb of this.changeListeners) {
      cb(name, event);
    }
  }
}
