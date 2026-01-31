import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import type { SendMessageOptions } from '$lib/messages/MessageContext';
import { MessageSystem, type MessageCallbackFn, type Message } from '$lib/messages/MessageSystem';
import { match } from 'ts-pattern';
import { JSRunner } from './JSRunner';
import {
  AudioAnalysisSystem,
  type AudioAnalysisFormat,
  type AudioAnalysisType
} from '$lib/audio/AudioAnalysisSystem';
import { VirtualFilesystem, isVFSPath } from '$lib/vfs';
import { capturePreviewFrame, bitmapToBase64Image } from '$lib/ai/google';
import JsWorker from '../../workers/js/jsWorker?worker';

// Message types sent from main thread to worker
export type WorkerMessage = { nodeId: string } & (
  | { type: 'executeCode'; code: string; processedCode: string }
  | { type: 'incomingMessage'; data: unknown; meta: Omit<Message, 'data'> }
  | { type: 'updateModule'; moduleName: string; code: string | null }
  | { type: 'cleanup' }
  | { type: 'destroy' }
  // Responses for proxied features
  | { type: 'vfsUrlResolved'; requestId: string; url?: string; error?: string }
  | { type: 'llmConfig'; requestId: string; apiKey?: string; imageBase64?: string; error?: string }
  | { type: 'setFFTData'; analysisType: string; format: string; array: Uint8Array | Float32Array }
);

// Message types sent from worker to main thread
export type WorkerResponse = { nodeId: string } & (
  | { type: 'ready' }
  | {
      type: 'executionComplete';
      success: boolean;
      error?: string;
    }
  | {
      type: 'consoleOutput';
      level: 'log' | 'warn' | 'error' | 'debug' | 'info';
      args: unknown[];
      lineErrors?: Record<number, string[]>;
    }
  | { type: 'sendMessage'; data: unknown; options?: SendMessageOptions }
  | { type: 'setPortCount'; inletCount: number; outletCount: number }
  | { type: 'setTitle'; title: string }
  | { type: 'setRunOnMount'; runOnMount: boolean }
  | { type: 'setHidePorts'; hidePorts: boolean }
  | { type: 'callbackRegistered'; callbackType: 'message' | 'interval' | 'timeout' }
  // Requests for proxied features
  | { type: 'fftEnabled'; enabled: boolean }
  | { type: 'registerFFTRequest'; analysisType: AudioAnalysisType; format: AudioAnalysisFormat }
  | { type: 'resolveVfsUrl'; requestId: string; path: string }
  | { type: 'llmRequest'; requestId: string; prompt: string; imageNodeId?: string }
);

interface WorkerInstance {
  worker: Worker;
  messageCallback: MessageCallbackFn;
}

/**
 * WorkerNodeSystem manages dedicated Web Workers for worker nodes.
 * Each worker node gets its own Worker instance for true threading.
 */
export class WorkerNodeSystem {
  private static instance: WorkerNodeSystem | null = null;

  private eventBus = PatchiesEventBus.getInstance();
  private messageSystem = MessageSystem.getInstance();
  private jsRunner = JSRunner.getInstance();
  private audioAnalysis = AudioAnalysisSystem.getInstance();
  private workers = new Map<string, WorkerInstance>();

  constructor() {
    // Subscribe to FFT data updates - forward to all workers that have FFT enabled
    this.setupFFTForwarding();
  }

  private setupFFTForwarding() {
    // Store the original callback if any
    const originalCallback = this.audioAnalysis.onFFTDataReady;

    // Set up our callback that also forwards to workers
    this.audioAnalysis.onFFTDataReady = (data) => {
      // Call the original callback (for render workers)
      if (originalCallback) {
        originalCallback(data);
      }

      // Forward to js workers that have this nodeId registered for FFT
      const instance = this.workers.get(data.nodeId);
      if (instance) {
        instance.worker.postMessage({
          type: 'setFFTData',
          nodeId: data.nodeId,
          analysisType: data.analysisType,
          format: data.format,
          array: data.array
        } satisfies WorkerMessage);
      }
    };
  }

  private syncModulesToWorker(nodeId: string, worker: Worker) {
    // Sync all modules from JSRunner to worker
    for (const [name, code] of this.jsRunner.modules) {
      worker.postMessage({
        type: 'updateModule',
        nodeId,
        moduleName: name,
        code
      } satisfies WorkerMessage);
    }
  }

  private handleWorkerMessage(nodeId: string, worker: Worker, data: WorkerResponse) {
    match(data)
      .with({ type: 'consoleOutput' }, (event) => {
        // Dispatch to EventBus - VirtualConsole listens for 'consoleOutput' events
        this.eventBus.dispatch({
          type: 'consoleOutput',
          nodeId,
          messageType: event.level === 'info' ? 'log' : event.level,
          timestamp: Date.now(),
          args: event.args,
          lineErrors: event.lineErrors
        });
      })
      .with({ type: 'sendMessage' }, (event) => {
        // Route message through MessageSystem to connected nodes
        this.messageSystem.sendMessage(nodeId, event.data, event.options ?? {});

        // Also dispatch to EventBus for any listeners
        this.eventBus.dispatch({
          type: 'workerSendMessage',
          nodeId,
          data: event.data,
          options: event.options
        });
      })
      .with({ type: 'setPortCount' }, (event) => {
        this.eventBus.dispatch({
          type: 'nodePortCountUpdate',
          portType: 'message',
          nodeId,
          inletCount: event.inletCount,
          outletCount: event.outletCount
        });
      })
      .with({ type: 'setTitle' }, (event) => {
        this.eventBus.dispatch({
          type: 'nodeTitleUpdate',
          nodeId,
          title: event.title
        });
      })
      .with({ type: 'callbackRegistered' }, (event) => {
        this.eventBus.dispatch({
          type: 'workerCallbackRegistered',
          nodeId,
          callbackType: event.callbackType
        });
      })
      // FFT proxy messages
      .with({ type: 'fftEnabled' }, (event) => {
        if (event.enabled) {
          this.audioAnalysis.enableFFT(nodeId);
        } else {
          this.audioAnalysis.disableFFT(nodeId);
        }
      })
      .with({ type: 'registerFFTRequest' }, (event) => {
        this.audioAnalysis.registerFFTRequest(nodeId, event.analysisType, event.format);
      })
      // VFS proxy messages
      .with({ type: 'resolveVfsUrl' }, (event) => {
        this.handleVfsUrlResolution(nodeId, worker, event.requestId, event.path);
      })
      // LLM proxy messages
      .with({ type: 'llmRequest' }, (event) => {
        this.handleLLMRequest(nodeId, worker, event.requestId, event.prompt, event.imageNodeId);
      })
      .otherwise(() => {});
  }

  /**
   * Resolve VFS path and send URL back to worker.
   */
  private async handleVfsUrlResolution(
    nodeId: string,
    worker: Worker,
    requestId: string,
    path: string
  ) {
    try {
      // If not a VFS path, send back the original path unchanged
      if (!isVFSPath(path)) {
        worker.postMessage({
          type: 'vfsUrlResolved',
          nodeId,
          requestId,
          url: path
        } satisfies WorkerMessage);
        return;
      }

      const vfs = VirtualFilesystem.getInstance();
      const blob = await vfs.resolve(path);
      const url = URL.createObjectURL(blob);

      worker.postMessage({
        type: 'vfsUrlResolved',
        nodeId,
        requestId,
        url
      } satisfies WorkerMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      worker.postMessage({
        type: 'vfsUrlResolved',
        nodeId,
        requestId,
        error: errorMessage
      } satisfies WorkerMessage);
    }
  }

  /**
   * Get LLM credentials and optionally capture image, send config to worker.
   * Worker will make the actual HTTP request.
   */
  private async handleLLMRequest(
    nodeId: string,
    worker: Worker,
    requestId: string,
    _prompt: string,
    imageNodeId?: string
  ) {
    try {
      const apiKey = localStorage.getItem('gemini-api-key');

      if (!apiKey) {
        worker.postMessage({
          type: 'llmConfig',
          nodeId,
          requestId,
          error: 'API key is not set. Please set it in the settings.'
        } satisfies WorkerMessage);
        return;
      }

      let imageBase64: string | undefined;

      // If image node is specified, capture the preview frame
      if (imageNodeId) {
        const bitmap = await capturePreviewFrame(imageNodeId);
        if (bitmap) {
          imageBase64 = bitmapToBase64Image({
            bitmap,
            format: 'image/jpeg',
            quality: 0.7
          });
        }
      }

      worker.postMessage({
        type: 'llmConfig',
        nodeId,
        requestId,
        apiKey,
        imageBase64
      } satisfies WorkerMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      worker.postMessage({
        type: 'llmConfig',
        nodeId,
        requestId,
        error: errorMessage
      } satisfies WorkerMessage);
    }
  }

  async create(nodeId: string): Promise<void> {
    if (this.workers.has(nodeId)) return;

    const worker = new JsWorker();

    // Set up message handler
    worker.addEventListener('message', ({ data }: MessageEvent<WorkerResponse>) => {
      this.handleWorkerMessage(nodeId, worker, data);
    });

    // Create message callback to forward messages to worker
    const messageCallback: MessageCallbackFn = (data, meta) => {
      worker.postMessage({
        type: 'incomingMessage',
        nodeId,
        data,
        meta
      } satisfies WorkerMessage);
    };

    // Register with MessageSystem to receive messages
    const queue = this.messageSystem.registerNode(nodeId);
    queue.addCallback(messageCallback);

    this.workers.set(nodeId, { worker, messageCallback });

    // Sync existing modules to worker
    this.syncModulesToWorker(nodeId, worker);
  }

  async executeCode(nodeId: string, code: string): Promise<void> {
    const instance = this.workers.get(nodeId);
    if (!instance) throw new Error(`No worker for node ${nodeId}`);

    // Sync modules before execution to ensure we have the latest libraries
    this.syncModulesToWorker(nodeId, instance.worker);

    // Preprocess code (handle modules, @lib, etc.)
    const processedCode = await this.jsRunner.preprocessCode(code, {
      nodeId,
      setLibraryName: () => {
        // Libraries not supported in worker context - warn the user
        this.eventBus.dispatch({
          type: 'consoleOutput',
          nodeId,
          messageType: 'warn',
          timestamp: Date.now(),
          args: [
            '@lib modules are not supported in worker nodes. Use a regular js node for shared libraries.'
          ]
        });
      }
    });

    if (processedCode === null) {
      // Code was registered as library - already warned above
      return;
    }

    instance.worker.postMessage({
      type: 'executeCode',
      nodeId,
      code,
      processedCode
    } satisfies WorkerMessage);
  }

  cleanup(nodeId: string): void {
    const instance = this.workers.get(nodeId);
    if (!instance) return;

    instance.worker.postMessage({
      type: 'cleanup',
      nodeId
    } satisfies WorkerMessage);
  }

  destroy(nodeId: string): void {
    const instance = this.workers.get(nodeId);
    if (!instance) return;

    // Remove message callback from queue
    const queue = this.messageSystem.registerNode(nodeId);
    queue.removeCallback(instance.messageCallback);

    // Send destroy message and terminate worker
    instance.worker.postMessage({
      type: 'destroy',
      nodeId
    } satisfies WorkerMessage);
    instance.worker.terminate();

    this.workers.delete(nodeId);

    // Unregister from message system
    this.messageSystem.unregisterNode(nodeId);
  }

  has(nodeId: string): boolean {
    return this.workers.has(nodeId);
  }

  static getInstance(): WorkerNodeSystem {
    if (!this.instance) {
      this.instance = new WorkerNodeSystem();
    }
    return this.instance;
  }
}
