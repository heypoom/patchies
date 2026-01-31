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
  // Video frame delivery
  | { type: 'videoFramesReady'; frames: (ImageBitmap | null)[]; timestamp: number }
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
  | { type: 'callbackRegistered'; callbackType: 'message' | 'interval' | 'timeout' }
  | { type: 'flash' }
  // Requests for proxied features
  | { type: 'fftEnabled'; enabled: boolean }
  | { type: 'registerFFTRequest'; analysisType: AudioAnalysisType; format: AudioAnalysisFormat }
  | { type: 'resolveVfsUrl'; requestId: string; path: string }
  | { type: 'llmRequest'; requestId: string; prompt: string; imageNodeId?: string }
  // Video frame APIs
  | { type: 'setVideoCount'; inletCount: number; outletCount: number }
  | { type: 'videoFrameCallbackRegistered' }
  | { type: 'requestVideoFrames'; requestId: string }
);

interface WorkerInstance {
  worker: Worker;
  messageCallback: MessageCallbackFn;
}

interface WorkerVideoState {
  inletCount: number;
  outletCount: number;
  sourceNodeIds: (string | null)[]; // Maps inlet index to source node ID
  hasVideoCallback: boolean;
  animationFrameId: number | null;
  lastFrameRequestTime: number;
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

  // Video frame state tracking
  private videoStates = new Map<string, WorkerVideoState>();
  private currentEdges: Array<{ source: string; target: string; targetHandle?: string | null }> =
    [];
  private static readonly VIDEO_FRAME_INTERVAL_MS = 1000 / 30; // 30fps

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
      .with({ type: 'setRunOnMount' }, (event) => {
        this.eventBus.dispatch({
          type: 'nodeRunOnMountUpdate',
          nodeId,
          runOnMount: event.runOnMount
        });
      })
      .with({ type: 'callbackRegistered' }, (event) => {
        this.eventBus.dispatch({
          type: 'workerCallbackRegistered',
          nodeId,
          callbackType: event.callbackType
        });
      })
      .with({ type: 'flash' }, () => {
        this.eventBus.dispatch({
          type: 'workerFlash',
          nodeId
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
      // Video frame APIs
      .with({ type: 'setVideoCount' }, (event) => {
        this.handleSetVideoCount(nodeId, event.inletCount, event.outletCount);
      })
      .with({ type: 'videoFrameCallbackRegistered' }, () => {
        this.handleVideoFrameCallbackRegistered(nodeId);
      })
      .with({ type: 'requestVideoFrames' }, (event) => {
        this.handleRequestVideoFrames(nodeId, event.requestId);
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

  /**
   * Handle setVideoCount from worker - update video port count and dispatch event.
   */
  private handleSetVideoCount(nodeId: string, inletCount: number, outletCount: number) {
    // Initialize or update video state
    let videoState = this.videoStates.get(nodeId);
    if (!videoState) {
      videoState = {
        inletCount: 0,
        outletCount: 0,
        sourceNodeIds: [],
        hasVideoCallback: false,
        animationFrameId: null,
        lastFrameRequestTime: 0
      };
      this.videoStates.set(nodeId, videoState);
    }

    videoState.inletCount = inletCount;
    videoState.outletCount = outletCount;

    // Update connections from stored edges (handles case where edges existed before setVideoCount was called)
    this.updateVideoConnectionsForNode(nodeId, videoState, this.currentEdges);

    // Dispatch event for UI to update ports
    this.eventBus.dispatch({
      type: 'nodePortCountUpdate',
      portType: 'video',
      nodeId,
      inletCount,
      outletCount
    });
  }

  /**
   * Handle video frame callback registration - start frame capture loop.
   */
  private handleVideoFrameCallbackRegistered(nodeId: string) {
    const videoState = this.videoStates.get(nodeId);
    if (!videoState) return;

    videoState.hasVideoCallback = true;
    this.startVideoFrameLoop(nodeId);

    // Dispatch event for UI to show long-running indicator (treat as interval-like)
    this.eventBus.dispatch({
      type: 'workerCallbackRegistered',
      nodeId,
      callbackType: 'interval'
    });
  }

  /**
   * Handle manual video frame request.
   */
  private handleRequestVideoFrames(nodeId: string, _requestId: string) {
    // Request frames immediately for manual grab
    this.requestVideoFramesFromRenderWorker(nodeId);
  }

  /**
   * Start the video frame capture loop for a node.
   */
  private startVideoFrameLoop(nodeId: string) {
    const videoState = this.videoStates.get(nodeId);
    if (!videoState || videoState.animationFrameId !== null) return;

    const loop = () => {
      const state = this.videoStates.get(nodeId);
      if (!state || !state.hasVideoCallback) {
        return;
      }

      const now = performance.now();
      if (now - state.lastFrameRequestTime >= WorkerNodeSystem.VIDEO_FRAME_INTERVAL_MS) {
        this.requestVideoFramesFromRenderWorker(nodeId);
        state.lastFrameRequestTime = now;
      }

      state.animationFrameId = requestAnimationFrame(loop);
    };

    videoState.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * Request video frames from the render worker.
   */
  private requestVideoFramesFromRenderWorker(nodeId: string) {
    const videoState = this.videoStates.get(nodeId);
    if (!videoState || videoState.sourceNodeIds.length === 0) return;

    // Send request to GLSystem which will forward to render worker
    this.eventBus.dispatch({
      type: 'requestWorkerVideoFrames',
      nodeId,
      sourceNodeIds: videoState.sourceNodeIds
    });
  }

  /**
   * Deliver captured video frames to a worker node.
   * Called by GLSystem when frames are received from render worker.
   */
  deliverVideoFrames(nodeId: string, frames: (ImageBitmap | null)[], timestamp: number) {
    const instance = this.workers.get(nodeId);
    if (!instance) return;

    instance.worker.postMessage(
      {
        type: 'videoFramesReady',
        nodeId,
        frames,
        timestamp
      } satisfies WorkerMessage,
      { transfer: frames.filter((f): f is ImageBitmap => f !== null) }
    );
  }

  /**
   * Update video connections based on current edges.
   * Called when edges change to keep source node mappings up to date.
   */
  updateVideoConnections(
    edges: Array<{ source: string; target: string; targetHandle?: string | null }>
  ) {
    // Store edges for later use when video states are created
    this.currentEdges = edges;

    for (const [nodeId, videoState] of this.videoStates) {
      this.updateVideoConnectionsForNode(nodeId, videoState, edges);
    }
  }

  /**
   * Update video connections for a specific node.
   */
  private updateVideoConnectionsForNode(
    nodeId: string,
    videoState: WorkerVideoState,
    edges: Array<{ source: string; target: string; targetHandle?: string | null }>
  ) {
    const sourceNodeIds: (string | null)[] = new Array(videoState.inletCount).fill(null);

    for (let i = 0; i < videoState.inletCount; i++) {
      const edge = edges.find((e) => e.target === nodeId && e.targetHandle === `video-in-${i}`);
      sourceNodeIds[i] = edge?.source ?? null;
    }

    videoState.sourceNodeIds = sourceNodeIds;
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
      setLibraryName: (name) => {
        // Only warn when user is trying to create a library (name is truthy)
        // name=null means "no library" or "unregister library"
        if (name) {
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

    // Clean up video state
    const videoState = this.videoStates.get(nodeId);
    if (videoState?.animationFrameId !== null) {
      cancelAnimationFrame(videoState!.animationFrameId!);
    }
    this.videoStates.delete(nodeId);

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
