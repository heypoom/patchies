/**
 * UiuaService - Worker-based Uiua WASM runtime
 *
 * Provides evaluation and formatting of Uiua code with media output support.
 * The 10MB WASM module runs in a web worker to avoid blocking the main thread.
 *
 * Media detection (via SmartOutput):
 * - Audio: arrays with ≥11,025 elements and values in [-5, 5] → WAV Uint8Array
 * - Images: 2D/3D arrays ≥30×30 → PNG Uint8Array
 * - Animations: 4D arrays with ≥5 frames → GIF Uint8Array
 */

import { match } from 'ts-pattern';
import type { UiuaWorkerMessage, UiuaWorkerResponse } from '../../workers/uiua/uiuaWorker';
import UiuaWorker from '../../workers/uiua/uiuaWorker?worker';

/**
 * Output item representing a single stack value after media detection
 */
export type OutputItem =
  | { type: 'text'; value: string }
  | { type: 'audio'; data: Uint8Array; label?: string }
  | { type: 'image'; data: Uint8Array; label?: string }
  | { type: 'gif'; data: Uint8Array; label?: string }
  | { type: 'svg'; svg: string };

/**
 * Result of evaluating Uiua code
 */
export type UiuaEvalResult =
  | { success: true; stack: OutputItem[]; formatted?: string }
  | { success: false; error: string; stack: OutputItem[]; formatted?: string };

/**
 * Result of formatting Uiua code
 */
export type UiuaFormatResult =
  | { success: true; formatted: string }
  | { success: false; error: string };

/**
 * Legacy result type for backward compatibility
 * @deprecated Use UiuaEvalResult instead
 */
export type UiuaResult =
  | { success: true; output: string; stack: OutputItem[]; formatted?: string }
  | { success: false; error: string };

type PendingRequest<T> = {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

export class UiuaService {
  private static instance: UiuaService | null = null;

  private worker: Worker;
  private lastId = 0;
  private _isLoaded = false;
  private pendingRequests = new Map<string, PendingRequest<unknown>>();

  private constructor() {
    this.worker = new UiuaWorker();
    this.worker.addEventListener('message', this.handleWorkerMessage.bind(this));
  }

  static getInstance(): UiuaService {
    if (!UiuaService.instance) {
      UiuaService.instance = new UiuaService();
    }
    return UiuaService.instance;
  }

  get isLoaded(): boolean {
    return this._isLoaded;
  }

  private handleWorkerMessage = ({ data }: MessageEvent<UiuaWorkerResponse>) => {
    match(data)
      .with({ type: 'ready' }, () => {
        // Worker is initialized but WASM not yet loaded
      })
      .with({ type: 'evalResult' }, ({ id, result }) => {
        this._isLoaded = true;
        this.resolveRequest(id, result);
      })
      .with({ type: 'formatResult' }, ({ id, result }) => {
        this._isLoaded = true;
        this.resolveRequest(id, result);
      })
      .with({ type: 'versionResult' }, ({ id, version }) => {
        this._isLoaded = true;
        this.resolveRequest(id, version);
      })
      .with({ type: 'error' }, ({ id, error }) => {
        this.rejectRequest(id, new Error(error));
      })
      .otherwise(() => {});
  };

  private resolveRequest(id: string, value: unknown) {
    const pending = this.pendingRequests.get(id);

    if (pending) {
      this.pendingRequests.delete(id);
      pending.resolve(value);
    }
  }

  private rejectRequest(id: string, error: Error) {
    const pending = this.pendingRequests.get(id);
    if (pending) {
      this.pendingRequests.delete(id);
      pending.reject(error);
    }
  }

  private send<T>(message: UiuaWorkerMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(message.id, {
        resolve: resolve as (value: unknown) => void,
        reject
      });

      this.worker.postMessage(message);
    });
  }

  private nextId(): string {
    return String(++this.lastId);
  }

  /**
   * Eagerly load the WASM module so it's ready before eval/format calls.
   */
  init(): void {
    this.worker.postMessage({ type: 'init', id: this.nextId() });
  }

  /**
   * Get Uiua version string
   */
  async getVersion(): Promise<string> {
    return this.send<string>({ type: 'getVersion', id: this.nextId() });
  }

  /**
   * Evaluate Uiua code with full media support
   *
   * Returns stack items with automatic media detection:
   * - Audio arrays → { type: 'audio', data: Uint8Array }
   * - Image arrays → { type: 'image', data: Uint8Array }
   * - GIF arrays → { type: 'gif', data: Uint8Array }
   * - SVG → { type: 'svg', svg: string }
   * - Other → { type: 'text', value: string }
   */
  async eval(code: string): Promise<UiuaEvalResult> {
    return this.send<UiuaEvalResult>({ type: 'eval', id: this.nextId(), code });
  }

  /**
   * Format Uiua code using the built-in formatter
   */
  async format(code: string): Promise<UiuaFormatResult> {
    return this.send<UiuaFormatResult>({ type: 'format', id: this.nextId(), code });
  }

  /**
   * Substitute $N placeholders with values and evaluate
   * Only supports $1-$9 (single-digit placeholders)
   */
  async evalWithValues(code: string, values: unknown[]): Promise<UiuaEvalResult> {
    // Clone values to avoid Svelte $state Proxy objects that can't be cloned via postMessage
    const clonedValues = JSON.parse(JSON.stringify(values));

    return this.send<UiuaEvalResult>({
      type: 'evalWithValues',
      id: this.nextId(),
      code,
      values: clonedValues
    });
  }
}
