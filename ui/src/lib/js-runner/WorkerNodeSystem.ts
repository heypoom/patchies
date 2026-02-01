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
import { DirectChannelService } from '$lib/messages/DirectChannelService';
import JsWorker from '../../workers/js/jsWorker?worker';

/** Render connection for direct worker→render messaging */
export interface RenderConnection {
  outlet: number;
  targetNodeId: string;
  inlet: number;
  inletKey?: string;
}

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
  // Direct render channel (port transferred via transfer list)
  | { type: 'setRenderPort' }
  | { type: 'updateRenderConnections'; connections: RenderConnection[] }
  // Direct worker-to-worker channel (port transferred via transfer list)
  | { type: 'setWorkerPort'; targetNodeId?: string; sourceNodeId?: string }
  | { type: 'updateWorkerConnections'; connections: RenderConnection[] }
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
  | { type: 'videoFrameCallbackRegistered'; resolution?: [number, number] }
  | { type: 'requestVideoFrames'; requestId: string; resolution?: [number, number] }
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
  resolution?: [number, number]; // Custom capture resolution
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

  // Global video frame loop (single loop for all worker nodes)
  private globalVideoLoopId: number | null = null;
  private lastGlobalFrameTime = 0;

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
      .with({ type: 'videoFrameCallbackRegistered' }, (event) => {
        this.handleVideoFrameCallbackRegistered(nodeId, event.resolution);
      })
      .with({ type: 'requestVideoFrames' }, (event) => {
        this.handleRequestVideoFrames(nodeId, event.resolution);
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
    // Initialize or update video state, preserving any existing hasVideoCallback
    let videoState = this.videoStates.get(nodeId);
    if (!videoState) {
      videoState = {
        inletCount: 0,
        outletCount: 0,
        sourceNodeIds: [],
        hasVideoCallback: false
      };
      this.videoStates.set(nodeId, videoState);
    }

    // Update counts but preserve hasVideoCallback (may have been set before setVideoCount was called)
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
   * Initializes videoState if absent (handles registration before setVideoCount).
   */
  private handleVideoFrameCallbackRegistered(nodeId: string, resolution?: [number, number]) {
    let videoState = this.videoStates.get(nodeId);

    if (!videoState) {
      // Initialize videoState with defaults - setVideoCount will update counts later
      videoState = {
        inletCount: 0,
        outletCount: 0,
        sourceNodeIds: [],
        hasVideoCallback: false
      };

      this.videoStates.set(nodeId, videoState);
    }

    videoState.hasVideoCallback = true;
    videoState.resolution = resolution;
    this.startGlobalVideoLoop();

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
  private handleRequestVideoFrames(nodeId: string, resolution?: [number, number]) {
    // Request frames immediately for manual grab (single node)
    const videoState = this.videoStates.get(nodeId);
    if (!videoState || videoState.sourceNodeIds.length === 0) return;

    this.eventBus.dispatch({
      type: 'requestWorkerVideoFrames',
      nodeId,
      sourceNodeIds: videoState.sourceNodeIds,
      resolution
    });
  }

  /**
   * Start the global video frame capture loop (single loop for all nodes).
   */
  private startGlobalVideoLoop() {
    // Already running
    if (this.globalVideoLoopId !== null) return;

    const loop = () => {
      // Check if any nodes still have video callbacks
      const nodesWithCallbacks = this.getNodesWithVideoCallbacks();
      if (nodesWithCallbacks.length === 0) {
        this.globalVideoLoopId = null;
        return;
      }

      const now = performance.now();
      if (now - this.lastGlobalFrameTime >= WorkerNodeSystem.VIDEO_FRAME_INTERVAL_MS) {
        this.requestBatchedVideoFrames(nodesWithCallbacks);
        this.lastGlobalFrameTime = now;
      }

      this.globalVideoLoopId = requestAnimationFrame(loop);
    };

    this.globalVideoLoopId = requestAnimationFrame(loop);
  }

  /**
   * Get all nodes that have active video callbacks.
   */
  private getNodesWithVideoCallbacks(): string[] {
    const nodes: string[] = [];
    for (const [nodeId, state] of this.videoStates) {
      if (state.hasVideoCallback && state.sourceNodeIds.some((id) => id !== null)) {
        nodes.push(nodeId);
      }
    }
    return nodes;
  }

  /**
   * Request video frames for multiple nodes in a single batched request.
   */
  private requestBatchedVideoFrames(nodeIds: string[]) {
    const requests: Array<{
      targetNodeId: string;
      sourceNodeIds: (string | null)[];
      resolution?: [number, number];
    }> = [];

    for (const nodeId of nodeIds) {
      const videoState = this.videoStates.get(nodeId);
      if (videoState && videoState.sourceNodeIds.length > 0) {
        requests.push({
          targetNodeId: nodeId,
          sourceNodeIds: videoState.sourceNodeIds,
          resolution: videoState.resolution
        });
      }
    }

    if (requests.length === 0) return;

    // Send batched request to GLSystem which will forward to render worker
    this.eventBus.dispatch({
      type: 'requestWorkerVideoFramesBatch',
      requests
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

    // Restart global loop if any nodes now have valid connections
    // (loop may have stopped when all connections were removed)
    if (this.getNodesWithVideoCallbacks().length > 0) {
      this.startGlobalVideoLoop();
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

    // Register with DirectChannelService for direct render/worker messaging
    DirectChannelService.getInstance().registerWorker(nodeId, worker);
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
    this.videoStates.delete(nodeId);

    // Stop global loop if no more nodes have video callbacks
    if (this.getNodesWithVideoCallbacks().length === 0 && this.globalVideoLoopId !== null) {
      cancelAnimationFrame(this.globalVideoLoopId);
      this.globalVideoLoopId = null;
    }

    // Unregister from message system
    this.messageSystem.unregisterNode(nodeId);

    // Unregister from DirectChannelService
    DirectChannelService.getInstance().unregisterWorker(nodeId);
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
