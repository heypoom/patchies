import type { ToWorker, FromWorker, CompileResult, DispatchResult } from './types';
import WebGPUWorker from '$workers/webgpu/webgpuComputeWorker?worker';

type PendingCallback = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
};

export class WebGPUComputeSystem {
  private static instance: WebGPUComputeSystem | null = null;

  private worker: Worker | null = null;
  private supported: boolean | null = null;
  private initPromise: Promise<boolean> | null = null;

  // Pending callbacks keyed by `${type}:${nodeId}`
  private pendingCallbacks = new Map<string, PendingCallback>();

  static getInstance(): WebGPUComputeSystem {
    if (!WebGPUComputeSystem.instance) {
      WebGPUComputeSystem.instance = new WebGPUComputeSystem();
    }
    return WebGPUComputeSystem.instance;
  }

  async init(): Promise<boolean> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      try {
        this.worker = new WebGPUWorker();
        this.setupWorkerListener();
        this.postMessage({ type: 'init' });

        this.pendingCallbacks.set('ready', {
          resolve: (supported: boolean) => {
            this.supported = supported;
            resolve(supported);
          },
          reject: () => resolve(false)
        });
      } catch {
        this.supported = false;
        resolve(false);
      }
    });
  }

  private setupWorkerListener() {
    if (!this.worker) return;

    this.worker.onerror = (event) => {
      console.error('WebGPU worker error:', event);
    };

    this.worker.onmessage = (event: MessageEvent<FromWorker>) => {
      const msg = event.data;

      switch (msg.type) {
        case 'ready': {
          const cb = this.pendingCallbacks.get('ready');
          if (cb) {
            cb.resolve(msg.supported);
            this.pendingCallbacks.delete('ready');
          }
          break;
        }
        case 'compiled': {
          const key = `compile:${msg.nodeId}`;
          const cb = this.pendingCallbacks.get(key);
          if (cb) {
            cb.resolve({ error: msg.error } satisfies CompileResult);
            this.pendingCallbacks.delete(key);
          }
          break;
        }
        case 'result': {
          const key = `dispatch:${msg.nodeId}`;
          const cb = this.pendingCallbacks.get(key);
          if (cb) {
            cb.resolve({ outputs: msg.outputs } satisfies DispatchResult);
            this.pendingCallbacks.delete(key);
          }
          break;
        }
        case 'error': {
          const key = `dispatch:${msg.nodeId}`;
          const cb = this.pendingCallbacks.get(key);
          if (cb) {
            cb.resolve({ error: msg.message } satisfies DispatchResult);
            this.pendingCallbacks.delete(key);
          }
          break;
        }
      }
    };
  }

  private postMessage(msg: ToWorker, transfer?: Transferable[]) {
    if (!this.worker) return;
    if (transfer) {
      this.worker.postMessage(msg, transfer);
    } else {
      this.worker.postMessage(msg);
    }
  }

  async compile(nodeId: string, code: string): Promise<CompileResult> {
    if (!this.worker) return { error: 'WebGPU worker not initialized' };

    return new Promise<CompileResult>((resolve) => {
      const key = `compile:${nodeId}`;
      this.pendingCallbacks.set(key, { resolve, reject: () => resolve({ error: 'Worker error' }) });
      this.postMessage({ type: 'compile', nodeId, code });
    });
  }

  setBuffer(nodeId: string, binding: number, data: ArrayBuffer): void {
    // Transfer the buffer for zero-copy
    const copy = data.slice(0);
    this.postMessage({ type: 'setBuffer', nodeId, binding, data: copy }, [copy]);
  }

  async dispatch(
    nodeId: string,
    dispatchCount?: [number, number, number]
  ): Promise<DispatchResult> {
    if (!this.worker) return { error: 'WebGPU worker not initialized' };

    return new Promise<DispatchResult>((resolve) => {
      const key = `dispatch:${nodeId}`;
      this.pendingCallbacks.set(key, { resolve, reject: () => resolve({ error: 'Worker error' }) });
      this.postMessage({ type: 'dispatch', nodeId, dispatchCount });
    });
  }

  destroy(nodeId: string): void {
    this.postMessage({ type: 'destroy', nodeId });
    this.pendingCallbacks.delete(`compile:${nodeId}`);
    this.pendingCallbacks.delete(`dispatch:${nodeId}`);
  }

  isSupported(): boolean {
    return this.supported === true;
  }
}
