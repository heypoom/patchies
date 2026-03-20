/**
 * Abstract base class for MediaPipe vision workers.
 *
 * Handles WASM loading workaround for module workers, task init/destroy,
 * frame dispatch, FPS tracking, and GPU→CPU fallback.
 */

import type { TaskOptions, WorkerInMessage, WorkerOutMessage } from './types';

// MediaPipe WASM CDN (pinned to 0.10.0, matches installed package)
export const WASM_CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm';
export const MODEL_CDN_BASE = 'https://storage.googleapis.com/mediapipe-models/';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTask = any;

export abstract class MediaPipeWorkerBase<TTask extends AnyTask, TResult> {
  protected task: TTask | null = null;
  protected options: TaskOptions | null = null;
  private isProcessing = false;
  private isDestroyed = false;

  // FPS tracking
  private frameCount = 0;
  private fpsIntervalId: ReturnType<typeof setInterval> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected abstract initTask(vision: any, options: TaskOptions): Promise<TTask>;
  protected abstract detectFrame(task: TTask, bitmap: ImageBitmap, timestamp: number): TResult;
  protected abstract formatResult(raw: TResult): import('./types').TaskResult;

  protected post(msg: WorkerOutMessage, transfer?: Transferable[]) {
    if (transfer?.length) {
      self.postMessage(msg, { transfer });
    } else {
      self.postMessage(msg);
    }
  }

  async init(options: TaskOptions): Promise<void> {
    this.options = options;

    try {
      await this.initWithDelegate(options);
    } catch (err) {
      // GPU delegate may fail; retry with CPU
      if ((options as { delegate?: string }).delegate !== 'CPU') {
        try {
          const cpuOptions = { ...options, delegate: 'CPU' as const };
          await this.initWithDelegate(cpuOptions);
          this.post({ type: 'error', message: 'GPU unavailable, using CPU delegate' });
        } catch (cpuErr) {
          const msg = cpuErr instanceof Error ? cpuErr.message : String(cpuErr);
          this.post({ type: 'error', message: msg });
          throw cpuErr;
        }
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        this.post({ type: 'error', message: msg });
        throw err;
      }
    }

    this.startFpsTracking();
    this.post({ type: 'ready' });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async initWithDelegate(options: TaskOptions): Promise<void> {
    // Import FilesetResolver from the installed package.
    // Workers use `?worker&url` import — we load the ESM build directly.
    const { FilesetResolver } = await import('@mediapipe/tasks-vision');

    const vision = await FilesetResolver.forVisionTasks(WASM_CDN_BASE);

    // Workaround: MediaPipe calls importScripts() internally which is banned
    // in module workers. Eval the loader manually, then hide the path so
    // MediaPipe won't attempt importScripts().
    try {
      const loaderCode = await fetch(vision.wasmLoaderPath).then((r) => r.text());
      // eslint-disable-next-line no-eval
      (0, eval)(loaderCode);
      // @ts-expect-error — delete non-standard property
      delete vision.wasmLoaderPath;
    } catch {
      // Some environments don't need this workaround; proceed without it
    }

    this.task = await this.initTask(vision, options);
  }

  processFrame(bitmap: ImageBitmap, timestamp: number): void {
    if (!this.task || this.isProcessing || this.isDestroyed) {
      bitmap.close();
      return;
    }

    this.isProcessing = true;
    try {
      const raw = this.detectFrame(this.task, bitmap, timestamp);
      const result = this.formatResult(raw);
      this.post({ type: 'result', data: result });
      this.frameCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.post({ type: 'error', message: msg });
    } finally {
      bitmap.close();
      this.isProcessing = false;
    }
  }

  async updateSettings(settings: Partial<TaskOptions>): Promise<void> {
    if (!this.options) return;

    // Destroy existing task
    if (this.task) {
      try {
        this.task.close?.();
      } catch {
        // ignore
      }
      this.task = null;
    }

    // Merge new settings and reinit
    this.options = { ...this.options, ...settings } as TaskOptions;
    await this.init(this.options);
  }

  destroy(): void {
    this.isDestroyed = true;
    this.stopFpsTracking();

    if (this.task) {
      try {
        this.task.close?.();
      } catch {
        // ignore
      }
      this.task = null;
    }
  }

  private startFpsTracking(): void {
    this.fpsIntervalId = setInterval(() => {
      this.post({ type: 'fps', value: this.frameCount });
      this.frameCount = 0;
    }, 1000);
  }

  private stopFpsTracking(): void {
    if (this.fpsIntervalId !== null) {
      clearInterval(this.fpsIntervalId);
      this.fpsIntervalId = null;
    }
  }

  /**
   * Set up the onmessage handler for this worker.
   * Called once from each concrete worker file.
   */
  setupMessageHandler(): void {
    self.onmessage = async (event: MessageEvent<WorkerInMessage>) => {
      const msg = event.data;

      if (msg.type === 'init') {
        await this.init(msg.options);
      } else if (msg.type === 'frame') {
        this.processFrame(msg.bitmap, msg.timestamp);
      } else if (msg.type === 'updateSettings') {
        await this.updateSettings(msg.settings);
      } else if (msg.type === 'destroy') {
        this.destroy();
      }
    };
  }
}
