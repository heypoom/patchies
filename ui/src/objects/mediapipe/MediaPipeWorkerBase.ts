/**
 * Abstract base class for MediaPipe vision workers.
 *
 * Handles WASM loading workaround for module workers, task init/destroy,
 * frame dispatch, FPS tracking, and GPU→CPU fallback.
 */

import type { TaskOptions, TaskResult, WorkerInMessage, WorkerOutMessage } from './types';
import {
  createDirectChannelHandler,
  type DirectChannelHandler
} from '../../workers/shared/directChannelHandler';
import { WorkerProfiler } from '../../workers/shared/WorkerProfiler';

// MediaPipe WASM CDN (pinned version must match installed package)
export const WASM_CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.33/wasm';

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

  // Profiler — shared with subclasses (e.g. SegmentWorker overrides processFrame)
  protected workerProfiler = new WorkerProfiler((nodeId, category, stats) => {
    self.postMessage({ type: 'profilerStats', nodeId, category, stats } satisfies WorkerOutMessage);
  });

  // Direct channel (bypasses main thread when connected to render/worker nodes)
  protected directChannel: DirectChannelHandler | null = null;
  protected nodeId = '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected abstract initTask(vision: any, options: TaskOptions): Promise<TTask>;
  protected abstract detectFrame(task: TTask, bitmap: ImageBitmap, timestamp: number): TResult;
  protected abstract formatResult(raw: TResult, timestamp: number): TaskResult;

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
      console.warn('GPU delegate failed. falling back to CPU.', err);

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

  private async initWithDelegate(options: TaskOptions): Promise<void> {
    // Import FilesetResolver from the installed package.
    // Workers use `?worker&url` import — we load the ESM build directly.
    const { FilesetResolver } = await import('@mediapipe/tasks-vision');

    const vision = await FilesetResolver.forVisionTasks(WASM_CDN_BASE);

    // Workaround: MediaPipe calls importScripts() internally which is banned
    // in module workers. Eval the loader manually, then hide the path so
    // MediaPipe won't attempt importScripts().
    try {
      const visionWithLoader = vision as typeof vision & { wasmLoaderPath?: string };
      if (!visionWithLoader.wasmLoaderPath) return;

      const loaderCode = await fetch(visionWithLoader.wasmLoaderPath).then((r) => r.text());

      (0, eval)(loaderCode);
      Reflect.deleteProperty(visionWithLoader, 'wasmLoaderPath');
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
      this.workerProfiler.measure(this.nodeId, 'draw', () => {
        // ! detectFrame is the slowest part
        const raw = this.detectFrame(this.task!, bitmap, timestamp);
        const result = this.formatResult(raw, timestamp);

        this.sendResult(result);
        this.frameCount++;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      this.post({ type: 'error', message: msg });
    } finally {
      bitmap.close();

      this.isProcessing = false;
    }
  }

  protected sendResult(result: TaskResult, outlet = 0): void {
    const excludeTargets = this.directChannel
      ? this.directChannel.sendToTargets(result, { to: outlet })
      : [];

    this.post({ type: 'result', data: result, excludeTargets });
  }

  async updateSettings(settings: Partial<TaskOptions>): Promise<void> {
    if (!this.options) return;

    // Destroy existing task
    if (this.task) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.task as any).close?.();
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
    this.workerProfiler.setEnabled(false);

    if (this.task) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.task as any).close?.();
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
        this.nodeId = msg.nodeId;
        await this.init(msg.options);
      } else if (msg.type === 'frame') {
        this.processFrame(msg.bitmap, msg.timestamp);
      } else if (msg.type === 'updateSettings') {
        await this.updateSettings(msg.settings);
      } else if (msg.type === 'destroy') {
        this.directChannel?.cleanup();
        this.destroy();
      } else if (msg.type === 'profilerEnable') {
        this.workerProfiler.setEnabled(msg.enabled);
      } else if (msg.type === 'setRenderPort' || msg.type === 'setWorkerPort') {
        if (!this.directChannel) {
          this.nodeId = msg.nodeId;
          this.directChannel = createDirectChannelHandler({
            nodeId: msg.nodeId,
            onIncomingMessage: () => {},
            onError: () => {}
          });
        }
        if (msg.type === 'setRenderPort') {
          this.directChannel.handleSetRenderPort(event.ports[0]);
        } else {
          this.directChannel.handleSetWorkerPort(
            event.ports[0],
            msg.targetNodeId,
            msg.sourceNodeId
          );
        }
      } else if (msg.type === 'updateRenderConnections') {
        this.directChannel?.handleUpdateRenderConnections(msg.connections);
      } else if (msg.type === 'updateWorkerConnections') {
        this.directChannel?.handleUpdateWorkerConnections(msg.connections);
      }
    };
  }
}
