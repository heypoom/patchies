import { buildRenderGraph, type REdge, type RNode } from '$lib/rendering/graphUtils';
import type { RenderGraph, RenderNode, RenderWorkerMessage } from '$lib/rendering/types';
import RenderWorker from '$workers/rendering/renderWorker?worker';

import * as ohash from 'ohash';
import {
  previewVisibleMap,
  isGlslPlaying,
  overrideOutputNodeId,
  feedbackEdgeIds
} from '../../stores/renderer.store';
import { get } from 'svelte/store';
import { isBackgroundOutputCanvasEnabled } from '../../stores/canvas.store';
import { currentPatchId } from '../../stores/ui.store';
import { renderFpsCap } from '../../stores/renderer.store';
import { IpcSystem } from './IpcSystem';
import { isExternalTextureNode } from './node-types';
import { MessageSystem, type Message } from '$lib/messages/MessageSystem';
import { MessageChannelRegistry } from '$lib/messages/MessageChannelRegistry';
import { PatchiesEventBus } from '../eventbus/PatchiesEventBus';
import type {
  RequestWorkerVideoFramesEvent,
  RequestWorkerVideoFramesBatchEvent,
  RequestMediaPipeVideoFramesBatchEvent
} from '../eventbus/events';
import {
  AudioAnalysisSystem,
  type AudioAnalysisPayloadWithType,
  type OnFFTReadyCallback
} from '$lib/audio/AudioAnalysisSystem';
import { DEFAULT_OUTPUT_SIZE, PREVIEW_SCALE_FACTOR } from './constants';
import { logger } from '$lib/utils/logger';
import { match, P } from 'ts-pattern';
import { profiler, ProfilerCoordinator, typeFromNodeId } from '$lib/profiler';
import { VirtualFilesystem, isVFSPath } from '$lib/vfs';
import { Transport, type TransportState } from '$lib/transport';

export type UserUniformValue = number | boolean | number[] | number[][];

export class GLSystem {
  /** Web worker for offscreen rendering. */
  public renderWorker: Worker;

  public ipcSystem = IpcSystem.getInstance();
  public messageSystem = MessageSystem.getInstance();
  public eventBus = PatchiesEventBus.getInstance();
  public audioAnalysis = AudioAnalysisSystem.getInstance();

  /** Rendering context for the background output that covers the entire screen. */
  public backgroundOutputCanvasContext: ImageBitmapRenderingContext | null = null;

  /** Mapping of nodeId to rendering context for preview */
  public previewCanvasContexts: Record<string, ImageBitmapRenderingContext | null> = {};

  /** Stores FBO-compatible nodes */
  public nodes: RNode[] = [];

  /** Stores FBO-compatible edges */
  public edges: REdge[] = [];

  private static instance: GLSystem;
  private hashes = { nodes: '', edges: '', graph: '' };
  private renderGraph: RenderGraph | null = null;

  /** Cache for outgoing video connections to avoid recalculating on every frame */
  private outgoingConnectionsCache = new Map<string, boolean>();

  /** Tracks the current override output node for use in syncOutputEnabled */
  private overrideOutputNodeId: string | null = null;

  /** Interval ID for transport time sync to worker */
  private transportSyncInterval: ReturnType<typeof setInterval> | null = null;

  /** Tracks channel subscriptions made on behalf of render worker nodes */
  private renderWorkerChannelSubscriptions = new Map<string, Set<string>>();
  private channelRegistry = MessageChannelRegistry.getInstance();

  /** Cached singleton references to avoid repeated dynamic imports on hot paths */
  private workerNodeSystem: null | {
    deliverVideoFrames(targetNodeId: string, frames: unknown, timestamp: number): void;
  } = null;

  private workerNodeSystemReady: Promise<{
    deliverVideoFrames(targetNodeId: string, frames: unknown, timestamp: number): void;
  }>;

  private mediaPipeNodeSystem: null | {
    deliverVideoFrames(targetNodeId: string, frames: unknown, timestamp: number): void;
  } = null;

  private mediaPipeNodeSystemReady: Promise<{
    deliverVideoFrames(targetNodeId: string, frames: unknown, timestamp: number): void;
  }>;

  /** Settings callbacks for render worker nodes (canvas, hydra) */
  private settingsCallbacks = new Map<
    string,
    {
      onDefine: (requestId: string, schema: unknown[], nodeId: string) => void;
      onClear: (nodeId: string) => void;
    }
  >();

  /** Node types whose shaders may contain #include directives */
  private static SHADER_NODE_TYPES = new Set(['glsl', 'swgl', 'regl', 'three']);

  /** File extensions that could be #included in shaders */
  private static SHADER_EXTENSIONS = new Set([
    '.gl',
    '.glsl',
    '.frag',
    '.vert',
    '.glslf',
    '.glslv',
    '.hlsl',
    '.wgsl'
  ]);

  public outputSize = DEFAULT_OUTPUT_SIZE;

  public previewSize: [width: number, height: number] = [
    this.outputSize[0] / PREVIEW_SCALE_FACTOR,
    this.outputSize[1] / PREVIEW_SCALE_FACTOR
  ];

  static getInstance() {
    if (!GLSystem.instance) {
      GLSystem.instance = new GLSystem();
    }

    // @ts-expect-error -- expose globally for debugging
    window.glSystem = GLSystem.instance;

    return GLSystem.instance;
  }

  constructor() {
    this.renderWorker = new RenderWorker();
    this.renderWorker.addEventListener('message', this.handleRenderWorkerMessage.bind(this));
    this.audioAnalysis.onFFTDataReady = this.sendFFTDataToWorker.bind(this);

    // Sync profiler enable/disable state with render worker
    this.renderWorker.postMessage({ type: 'profilerEnable', enabled: profiler.enabled });
    profiler.onEnableChange((enabled) => {
      this.renderWorker.postMessage({ type: 'profilerEnable', enabled });
    });

    // Send initial patchId and subscribe to changes
    this.renderWorker.postMessage({ type: 'setPatchId', patchId: get(currentPatchId) });
    currentPatchId.subscribe((patchId) => {
      this.renderWorker.postMessage({ type: 'setPatchId', patchId });
    });

    // Sync render FPS cap with render worker
    renderFpsCap.subscribe((fps) => {
      this.renderWorker.postMessage({ type: 'setRenderFpsCap', fps });
    });

    // Invalidate shader nodes when VFS shader files are added, removed, or modified
    let lastShaderEntryHash = '';

    VirtualFilesystem.getInstance().entries$.subscribe((entries) => {
      // Build a fingerprint of only shader-relevant VFS entries, including content metadata
      const shaderPaths: string[] = [];

      for (const [path, entry] of entries.entries()) {
        const ext = path.slice(path.lastIndexOf('.'));

        if (GLSystem.SHADER_EXTENSIONS.has(ext)) {
          // Include content-sensitive metadata (size) so changes to file contents trigger invalidation
          const size = entry.size ?? '';

          shaderPaths.push(`${path}\0${size}`);
        }
      }

      const hash = shaderPaths.sort().join('\0');
      if (hash === lastShaderEntryHash) return;

      const isInitial = lastShaderEntryHash === '';
      lastShaderEntryHash = hash;

      // Skip the initial subscription — no change to react to yet
      if (isInitial) return;

      this.invalidateShaderIncludes();
    });

    // Listen for video frame requests from WorkerNodeSystem
    this.eventBus.addEventListener(
      'requestWorkerVideoFrames',
      (event: RequestWorkerVideoFramesEvent) => {
        this.send('captureWorkerVideoFrames', {
          targetNodeId: event.nodeId,
          sourceNodeIds: event.sourceNodeIds,
          resolution: event.resolution
        });
      }
    );

    // Listen for batched video frame requests from WorkerNodeSystem
    this.eventBus.addEventListener(
      'requestWorkerVideoFramesBatch',
      (event: RequestWorkerVideoFramesBatchEvent) => {
        this.send('captureWorkerVideoFramesBatch', {
          requests: event.requests
        });
      }
    );

    // Pre-warm singleton caches to avoid repeated dynamic imports on hot paths.
    // Store promises so frame delivery handlers can await if not yet resolved.
    this.workerNodeSystemReady = import('$lib/js-runner/WorkerNodeSystem').then(
      ({ WorkerNodeSystem }) => {
        const instance = WorkerNodeSystem.getInstance();
        this.workerNodeSystem = instance;
        return instance;
      }
    );

    this.mediaPipeNodeSystemReady = import('$objects/mediapipe/MediaPipeNodeSystem').then(
      ({ MediaPipeNodeSystem }) => {
        const instance = MediaPipeNodeSystem.getInstance();
        this.mediaPipeNodeSystem = instance;
        return instance;
      }
    );

    // Listen for batched video frame requests from MediaPipeNodeSystem
    this.eventBus.addEventListener(
      'requestMediaPipeVideoFramesBatch',
      (event: RequestMediaPipeVideoFramesBatchEvent) => {
        this.send('captureMediaPipeVideoFramesBatch', {
          requests: event.requests
        });
      }
    );
  }

  handleRenderWorkerMessage = (event: MessageEvent<RenderWorkerMessage>) => {
    const data = event.data;
    if (!data) return;

    if (data.type === 'previewFrame') {
      const context = this.previewCanvasContexts[data.nodeId];
      if (!context || !data.bitmap) return;

      context.transferFromImageBitmap(data.bitmap);

      return;
    }

    if (data.type === 'animationFrame') {
      if (!data.outputBitmap) return;

      if (this.ipcSystem.outputWindow === null) {
        this.backgroundOutputCanvasContext?.transferFromImageBitmap(data.outputBitmap);
      } else {
        this.ipcSystem.sendRenderOutput(data.outputBitmap);
      }

      return;
    }

    // Use match for early returns - most frequent messages first
    match(data)
      .with({ type: 'sendMessageFromNode' }, (data) => {
        if (typeof data.options?.to === 'string') {
          this.channelRegistry.broadcast(data.options.to, data.data, data.fromNodeId);
        } else {
          this.messageSystem.sendMessage(data.fromNodeId, data.data, data.options);
        }
      })
      .with({ type: 'consoleOutput' }, (data) => {
        const args = data.args ?? [data.message];

        match(data.level)
          .with('error', () => {
            if (data.lineErrors && Object.keys(data.lineErrors).length > 0) {
              logger.nodeError(data.nodeId, { lineErrors: data.lineErrors }, ...args);
            } else {
              logger.nodeError(data.nodeId, ...args);
            }
          })
          .otherwise(() => {
            logger.addNodeLog(data.nodeId, data.level, args);
          });
      })
      .with({ type: 'shaderError' }, (data) => {
        if (data.lineErrors && Object.keys(data.lineErrors).length > 0) {
          logger.nodeError(
            data.nodeId,
            { lineErrors: data.lineErrors },
            'Shader compilation failed:',
            data.error
          );
        } else {
          logger.nodeError(data.nodeId, 'Shader compilation failed:', data.error);
        }
      })
      .with({ type: 'setPortCount' }, (data) => {
        this.eventBus.dispatch({
          type: 'nodePortCountUpdate',
          nodeId: data.nodeId,
          portType: data.portType,
          inletCount: data.inletCount,
          outletCount: data.outletCount
        });
      })
      .with({ type: 'setTitle' }, (data) => {
        this.eventBus.dispatch({
          type: 'nodeTitleUpdate',
          nodeId: data.nodeId,
          title: data.title
        });
      })
      .with({ type: 'setTextureFormat' }, (data) => {
        // Update internal node data and rebuild render graph so fboRenderer picks up the new format
        const index = this.nodes.findIndex((node) => node.id === data.nodeId);

        if (index !== -1) {
          const node = this.nodes[index];

          if ((node.data as Record<string, unknown>).fboFormat === data.format) return;

          this.nodes[index] = { ...node, data: { ...node.data, fboFormat: data.format } };
          this.updateRenderGraph(true);
        }
      })
      .with({ type: 'setResolution' }, (data) => {
        const index = this.nodes.findIndex((node) => node.id === data.nodeId);

        if (index !== -1) {
          const node = this.nodes[index];
          const current = (node.data as Record<string, unknown>).resolution;

          if (JSON.stringify(current) === JSON.stringify(data.resolution)) return;

          this.nodes[index] = { ...node, data: { ...node.data, resolution: data.resolution } };
          this.updateRenderGraph(true);
        }
      })
      .with({ type: 'setHidePorts' }, (data) => {
        this.eventBus.dispatch({
          type: 'nodeHidePortsUpdate',
          nodeId: data.nodeId,
          hidePorts: data.hidePorts
        });
      })
      .with({ type: 'setInteraction' }, (data) => {
        this.eventBus.dispatch({
          type: 'nodeInteractionUpdate',
          nodeId: data.nodeId,
          mode: data.mode,
          enabled: data.enabled
        });
      })
      .with({ type: 'setVideoOutputEnabled' }, (data) => {
        this.eventBus.dispatch({
          type: 'nodeVideoOutputEnabledUpdate',
          nodeId: data.nodeId,
          videoOutputEnabled: data.videoOutputEnabled
        });
      })
      .with({ type: 'setPrimaryButton' }, (data) => {
        this.eventBus.dispatch({
          type: 'nodePrimaryButtonUpdate',
          nodeId: data.nodeId,
          primaryButton: data.primaryButton
        });
      })
      .with({ type: 'setMouseScope' }, (data) => {
        this.eventBus.dispatch({
          type: 'nodeMouseScopeUpdate',
          nodeId: data.nodeId,
          scope: data.scope
        });
      })
      .with({ type: 'previewFrameCaptured' }, (data) => {
        // @ts-expect-error -- fix me
        this.eventBus.dispatch(data);
      })
      .with(P.union({ type: 'fftEnabled' }, { type: 'registerFFTRequest' }), (data) => {
        // @ts-expect-error -- fix me
        this.audioAnalysis.handleRenderWorkerMessage(data);
      })
      .with({ type: 'resolveVfsUrl' }, async (data) => {
        this.handleVfsUrlResolution(data.requestId, data.nodeId, data.path);
      })
      .with({ type: 'resolveVfsText' }, async (data) => {
        this.handleVfsTextResolution(data.requestId, data.nodeId, data.path);
      })
      .with({ type: 'workerVideoFramesCaptured' }, async (data) => {
        const sys = this.workerNodeSystem ?? (await this.workerNodeSystemReady);
        sys.deliverVideoFrames(data.targetNodeId, data.frames, data.timestamp);
      })
      .with({ type: 'workerVideoFramesCapturedBatch' }, async (data) => {
        const sys = this.workerNodeSystem ?? (await this.workerNodeSystemReady);

        for (const result of data.results) {
          sys.deliverVideoFrames(result.targetNodeId, result.frames, data.timestamp);
        }
      })
      .with({ type: 'mediaPipeVideoFramesCapturedBatch' }, async (data) => {
        const sys = this.mediaPipeNodeSystem ?? (await this.mediaPipeNodeSystemReady);

        for (const result of data.results) {
          sys.deliverVideoFrames(result.targetNodeId, result.frames, data.timestamp);
        }
      })
      // MediaBunny events from worker
      .with({ type: 'mediaBunnyMetadata' }, (data) => {
        this.eventBus.dispatch({
          type: 'mediaBunnyMetadata',
          nodeId: data.nodeId,
          metadata: data.metadata
        });
      })
      .with({ type: 'mediaBunnyFirstFrame' }, (data) => {
        this.eventBus.dispatch({
          type: 'mediaBunnyFirstFrame',
          nodeId: data.nodeId
        });
      })
      .with({ type: 'mediaBunnyTimeUpdate' }, (data) => {
        this.eventBus.dispatch({
          type: 'mediaBunnyTimeUpdate',
          nodeId: data.nodeId,
          currentTime: data.currentTime
        });
      })
      .with({ type: 'mediaBunnyEnded' }, (data) => {
        this.eventBus.dispatch({
          type: 'mediaBunnyEnded',
          nodeId: data.nodeId
        });
      })
      .with({ type: 'mediaBunnyError' }, (data) => {
        this.eventBus.dispatch({
          type: 'mediaBunnyError',
          nodeId: data.nodeId,
          error: data.error
        });
      })
      .with({ type: 'subscribeChannel' }, (data) => {
        const { nodeId, channel } = data;

        if (!this.renderWorkerChannelSubscriptions.has(nodeId)) {
          this.renderWorkerChannelSubscriptions.set(nodeId, new Set());
        }

        this.renderWorkerChannelSubscriptions.get(nodeId)!.add(channel);

        this.channelRegistry.subscribe(channel, nodeId, (msgData, sourceNodeId) => {
          this.renderWorker.postMessage({
            type: 'channelMessage',
            nodeId,
            channel,
            data: msgData,
            sourceNodeId
          });
        });
      })
      .with({ type: 'unsubscribeChannel' }, (data) => {
        const { nodeId, channel } = data;

        this.channelRegistry.unsubscribe(channel, nodeId);

        const subs = this.renderWorkerChannelSubscriptions.get(nodeId);

        if (subs) {
          subs.delete(channel);
        }
      })
      .with({ type: 'clockCommand' }, (data) => {
        // Handle clock control commands from worker
        match(data.command)
          .with({ action: 'play' }, () => Transport.play())
          .with({ action: 'pause' }, () => Transport.pause())
          .with({ action: 'stop' }, () => Transport.stop())
          .with({ action: 'setBpm' }, ({ value }) => Transport.setBpm(value))
          .with({ action: 'setTimeSignature' }, ({ numerator, denominator }) =>
            Transport.setTimeSignature(numerator, denominator)
          )
          .with({ action: 'seek' }, ({ value }) => Transport.seek(value))
          .exhaustive();
      })
      .with({ type: 'drawStats' }, (data) => {
        if (profiler.enabled) {
          ProfilerCoordinator.getInstance().recordWorkerStats(
            data.nodeId,
            typeFromNodeId(data.nodeId),
            data.category,
            data.stats
          );
        }
      })
      .with({ type: 'renderFrameStats' }, (data) => {
        if (profiler.enabled) {
          ProfilerCoordinator.getInstance().recordRenderFrameStats(data.stats);
        }
      })
      .with({ type: 'settingsDefine' }, (data) => {
        const callbacks = this.settingsCallbacks.get(data.nodeId);
        callbacks?.onDefine(data.requestId, data.schema as unknown[], data.nodeId);
      })
      .with({ type: 'settingsClear' }, (data) => {
        const callbacks = this.settingsCallbacks.get(data.nodeId);
        callbacks?.onClear(data.nodeId);
      })
      .with({ type: 'includeProcessing' }, (data) => {
        this.eventBus.dispatch({
          type: 'includeProcessing',
          nodeId: data.nodeId,
          active: data.active
        });
      })
      .otherwise(() => {});
  };

  /**
   * Resolves a VFS path from the worker and sends back an object URL.
   * Object URLs created on main thread are accessible from workers (same origin).
   */
  private async handleVfsUrlResolution(requestId: string, nodeId: string, path: string) {
    try {
      // If not a VFS path, send back the original path unchanged
      if (!isVFSPath(path)) {
        this.send('vfsUrlResolved', { requestId, nodeId, url: path });
        return;
      }

      const vfs = VirtualFilesystem.getInstance();
      const blob = await vfs.resolve(path);

      // Create object URL on main thread - workers can use it (same origin)
      const url = URL.createObjectURL(blob);

      // TODO: Track for cleanup when node is destroyed
      this.send('vfsUrlResolved', { requestId, nodeId, url });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.send('vfsUrlResolved', { requestId, nodeId, error: errorMessage });
    }
  }

  /**
   * Resolves a VFS path from the worker and sends back the text content.
   * Used by the GLSL #include preprocessor to inline VFS shader files.
   */
  private async handleVfsTextResolution(requestId: string, nodeId: string, path: string) {
    if (!path.startsWith('user://')) {
      this.send('vfsTextResolved', {
        requestId,
        nodeId,
        error: `Invalid VFS path: "${path}". Only user:// paths are supported.`
      });

      return;
    }

    try {
      const vfs = VirtualFilesystem.getInstance();

      const blob = await vfs.resolve(path);
      const text = await blob.text();

      this.send('vfsTextResolved', { requestId, nodeId, text });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.send('vfsTextResolved', { requestId, nodeId, error: errorMessage });
    }
  }

  registerSettingsCallbacks(
    nodeId: string,
    callbacks: {
      onDefine: (requestId: string, schema: unknown[], nodeId: string) => void;
      onClear: (nodeId: string) => void;
    }
  ) {
    this.settingsCallbacks.set(nodeId, callbacks);
  }

  unregisterSettingsCallbacks(nodeId: string) {
    this.settingsCallbacks.delete(nodeId);
  }

  sendSettingsValues(nodeId: string, requestId: string, values: Record<string, unknown>) {
    this.renderWorker.postMessage({ type: 'settingsValuesInit', nodeId, requestId, values });
  }

  sendSettingsValueChanged(nodeId: string, key: string, value: unknown) {
    this.renderWorker.postMessage({ type: 'settingsValueChanged', nodeId, key, value });
  }

  start() {
    if (get(isGlslPlaying)) return;

    this.send('startAnimation');
    isGlslPlaying.set(true);
    this.startTransportSync();
  }

  stop() {
    if (!get(isGlslPlaying)) return;

    this.send('stopAnimation');
    isGlslPlaying.set(false);
    this.stopTransportSync();
  }

  /**
   * Start syncing transport time to the render worker.
   * Sends at 60fps for smooth visual sync.
   */
  private startTransportSync(): void {
    if (this.transportSyncInterval) return;

    this.transportSyncInterval = setInterval(() => {
      this.syncTransportTime(Transport.getState());
    }, 1000 / 60);
  }

  /**
   * Stop syncing transport time to the render worker.
   */
  private stopTransportSync(): void {
    if (this.transportSyncInterval) {
      clearInterval(this.transportSyncInterval);
      this.transportSyncInterval = null;
    }
  }

  /**
   * Send transport state to render worker for GLSL/Hydra time sync.
   */
  syncTransportTime(state: TransportState): void {
    this.send('syncTransportTime', state);
  }

  setOutputEnabled(enabled: boolean) {
    this.send('setOutputEnabled', { enabled });
  }

  setPreviewEnabled(nodeId: string, enabled: boolean) {
    this.send('setPreviewEnabled', { nodeId, enabled });
  }

  togglePreview(nodeId: string) {
    const visibleMap = get(previewVisibleMap);

    visibleMap[nodeId] = !visibleMap[nodeId];
    previewVisibleMap.set(visibleMap);

    this.setPreviewEnabled(nodeId, visibleMap[nodeId]);
  }

  /** Toggle pause state for a node */
  toggleNodePause(nodeId: string) {
    this.send('toggleNodePause', { nodeId });
  }

  /** Override background output to a specific node, bypassing bg.out. Pass null to clear. */
  setOverrideOutputNode(nodeId: string | null) {
    this.overrideOutputNodeId = nodeId;

    // Clear connection cache so bitmap transfers are re-evaluated
    this.outgoingConnectionsCache.clear();

    this.send('setOverrideOutputNode', { nodeId });
    this.syncOutputEnabled();
  }

  /**
   * Sync the output-enabled state to the worker
   * and canvas store based on current edges + override.
   **/
  private syncOutputEnabled() {
    const hasBgOutEdge = this.edges.some((edge) => edge.target.startsWith('bg.out'));
    const outputEnabled = this.overrideOutputNodeId !== null || hasBgOutEdge;

    if (this.ipcSystem.outputWindow === null) {
      isBackgroundOutputCanvasEnabled.set(outputEnabled);
    }

    this.setOutputEnabled(outputEnabled);
  }

  send<T>(type: string, data?: T) {
    this.renderWorker.postMessage({ type, ...data });
  }

  upsertNode(
    id: string,
    type: RenderNode['type'],
    data: Record<string, unknown>,
    options?: { force?: boolean }
  ): boolean {
    const nodeIndex = this.nodes.findIndex((node) => node.id === id);

    if (nodeIndex === -1) {
      this.nodes.push({ id: id, type, data });
    } else {
      const node = this.nodes[nodeIndex];
      this.nodes[nodeIndex] = { ...node, type, data };
    }

    return this.updateRenderGraph(options?.force ?? false);
  }

  setUniformData(nodeId: string, uniformName: string, uniformValue: UserUniformValue) {
    this.send('setUniformData', {
      nodeId,
      uniformName,
      uniformValue
    });
  }

  setMouseData(nodeId: string, x: number, y: number, z: number, w: number) {
    this.send('setMouseData', {
      nodeId,
      x,
      y,
      z,
      w
    });
  }

  removeNode(nodeId: string) {
    const node = this.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Cleanup persistent external texture.
    if (isExternalTextureNode(node.type as RenderNode['type'])) {
      this.removeBitmap(nodeId);
    }

    // Cleanup persistent uniform data for GLSL nodes.
    if (node.type === 'glsl') {
      this.removeUniformData(nodeId);
    }

    this.nodes = this.nodes.filter((node) => node.id !== nodeId);

    // Disable sending FFT analysis to the said node.
    this.audioAnalysis.disableFFT(nodeId);

    // Clear connection cache for this node
    this.outgoingConnectionsCache.delete(nodeId);

    // If the deleted node was the background override, unpin it
    if (this.overrideOutputNodeId === nodeId) {
      this.setOverrideOutputNode(null);
      overrideOutputNodeId.set(null);
    }

    this.updateRenderGraph();
  }

  removePreviewContext(nodeId: string, context: ImageBitmapRenderingContext) {
    if (this.previewCanvasContexts[nodeId] === context) {
      this.previewCanvasContexts[nodeId] = null;
    }
  }

  updateEdges(edges: REdge[]) {
    this.edges = edges;

    this.updateRenderGraph();
    this.syncOutputEnabled();
  }

  /**
   * Bump _includeRevision on all shader nodes so their fingerprint changes,
   * forcing the render worker to recompile shaders with fresh #include content.
   */
  private invalidateShaderIncludes() {
    let dirty = false;

    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      if (!GLSystem.SHADER_NODE_TYPES.has(node.type)) continue;

      const rev = ((node.data._includeRevision as number) ?? 0) + 1;
      this.nodes[i] = { ...node, data: { ...node.data, _includeRevision: rev } };

      dirty = true;
    }

    if (dirty) this.updateRenderGraph(true);
  }

  private updateRenderGraph(force = false) {
    if (!force && !this.hasFlowGraphChanged(this.nodes, this.edges)) return false;

    const graph = buildRenderGraph(this.nodes, this.edges);
    if (!force && !this.hasHashChanged('graph', graph)) return false;

    this.send('buildRenderGraph', { graph });
    this.renderGraph = graph;

    // Expose feedback back-edges to UI for dashed edge styling
    feedbackEdgeIds.set(graph.backEdges);

    // Clear connection cache when render graph changes
    this.outgoingConnectionsCache.clear();

    return true;
  }

  // TODO: optimize this!
  hasFlowGraphChanged(nodes: RNode[], edges: REdge[]) {
    return this.hasHashChanged('nodes', nodes) || this.hasHashChanged('edges', edges);
  }

  hasHashChanged<K extends keyof GLSystem['hashes'], T>(key: K, object: T) {
    const hash = ohash.hash(object);
    if (this.hashes[key] === hash) return false;

    this.hashes[key] = hash;
    return true;
  }

  setPreviewSize(width: number, height: number) {
    this.previewSize = [width, height];

    for (const nodeId in this.previewCanvasContexts) {
      const context = this.previewCanvasContexts[nodeId];

      if (context) {
        const canvas = context.canvas;
        canvas.width = width;
        canvas.height = height;

        // re-create the context to accommodate the new size
        delete this.previewCanvasContexts[nodeId];

        this.previewCanvasContexts[nodeId] = canvas.getContext(
          'bitmaprenderer'
        ) as ImageBitmapRenderingContext;
      }
    }

    this.send('setPreviewSize', { width, height });
  }

  setOutputSize(width: number, height: number) {
    this.outputSize = [width, height];
    this.send('setOutputSize', { width, height });

    // Update preview size to match the new aspect ratio
    this.setPreviewSize(
      Math.floor(width / PREVIEW_SCALE_FACTOR),
      Math.floor(height / PREVIEW_SCALE_FACTOR)
    );
  }

  setBitmapSource(nodeId: string, source: ImageBitmapSource) {
    createImageBitmap(source).then((bitmap) => {
      this.setBitmap(nodeId, bitmap);
    });
  }

  /**
   * Set an ImageBitmap for a node.
   * The fboRenderer will Y-flip this for us.
   *
   * @param nodeId - The node ID to set the bitmap for
   * @param bitmap - ImageBitmap
   */
  setBitmap(nodeId: string, bitmap: ImageBitmap) {
    this.renderWorker.postMessage(
      {
        type: 'setBitmap',
        nodeId,
        bitmap
      },
      { transfer: [bitmap] }
    );
  }

  removeBitmap(nodeId: string) {
    this.send('removeBitmap', { nodeId });
  }

  removeUniformData(nodeId: string) {
    this.send('removeUniformData', { nodeId });
  }

  sendMessageToNode(nodeId: string, message: Message) {
    this.send('sendMessageToNode', { nodeId, message });
  }

  updateProjectionMap(nodeId: string, surfaces: import('$objects/projmap/types').ProjMapSurface[]) {
    this.send('updateProjectionMap', { nodeId, surfaces });
  }

  /** Set which nodes are visible in the viewport for preview culling */
  setVisibleNodes(nodeIds: Set<string>) {
    this.send('setVisibleNodes', { nodeIds: Array.from(nodeIds) });
  }

  /** Globally enable/disable all previews */
  setAllPreviewsDisabled(disabled: boolean) {
    this.send('setAllPreviewsDisabled', { disabled });
  }

  /** Update preview readback resolution. Called only when LOD tier changes. */
  setPreviewScaleMultiplier(multiplier: number) {
    this.send('setPreviewScaleMultiplier', { multiplier });
  }

  /**
   * Check if a node has outgoing connections to GPU video nodes (glsl, hydra, swgl)
   * Used to optimize bitmap transfers - no need to send bitmaps if nothing consumes them
   * Results are cached to avoid recalculation on every frame
   */
  public hasOutgoingVideoConnections(nodeId: string): boolean {
    if (this.outgoingConnectionsCache.has(nodeId)) {
      return this.outgoingConnectionsCache.get(nodeId)!;
    }

    // Check all edges (not just FBO-filtered ones) for video connections
    // This allows external texture nodes (webcam, img) to upload when connected
    // to non-FBO nodes like vdo.ninja.push
    const hasOutgoingVideoEdges = this.edges.some(
      (edge) => edge.source === nodeId && /(video-out|video-in|sampler2D)/.test(edge.id)
    );

    const isOutputNode =
      this.renderGraph?.outputNodeId === nodeId || this.overrideOutputNodeId === nodeId;

    const hasConnections = hasOutgoingVideoEdges || isOutputNode;

    this.outgoingConnectionsCache.set(nodeId, hasConnections);

    return hasConnections;
  }

  /**
   * Register a worker's render port for direct messaging.
   * Called by DirectChannelService when setting up a direct channel.
   */
  registerWorkerRenderPort(nodeId: string, port: MessagePort): void {
    this.renderWorker.postMessage({ type: 'registerWorkerRenderPort', nodeId }, [port]);
  }

  /**
   * Unregister a worker's render port.
   * Called by DirectChannelService when a worker is destroyed.
   */
  unregisterWorkerRenderPort(nodeId: string): void {
    this.send('unregisterWorkerRenderPort', { nodeId });
  }

  /** Callback for when AudioAnalysisSystem has FFT data ready */
  sendFFTDataToWorker: OnFFTReadyCallback = (payload) => {
    const node = this.nodes.find((n) => n.id === payload.nodeId);
    if (!node) return;

    const payloadWithType: AudioAnalysisPayloadWithType = {
      ...payload,
      type: 'setFFTData',
      nodeType: node.type as 'hydra' | 'glsl' | 'canvas'
    };

    this.renderWorker.postMessage(payloadWithType, { transfer: [payloadWithType.array.buffer] });
  };

  // ============================================
  // MediaBunny Worker API
  // ============================================

  /** Create a MediaBunnyPlayer in the worker for a node */
  createMediaBunnyPlayer(nodeId: string): void {
    this.send('createMediaBunnyPlayer', { nodeId });
  }

  /** Load a video file into the worker's MediaBunnyPlayer */
  loadMediaBunnyFile(nodeId: string, file: File): void {
    // File can be sent via postMessage (cloned, blob data is shared)
    this.renderWorker.postMessage({ type: 'loadMediaBunnyFile', nodeId, file });
  }

  /** Load a video URL into the worker's MediaBunnyPlayer */
  loadMediaBunnyUrl(nodeId: string, url: string): void {
    this.send('loadMediaBunnyUrl', { nodeId, url });
  }

  /** Start playback */
  mediaBunnyPlay(nodeId: string): void {
    this.send('mediaBunnyPlay', { nodeId });
  }

  /** Pause playback */
  mediaBunnyPause(nodeId: string): void {
    this.send('mediaBunnyPause', { nodeId });
  }

  /** Seek to time */
  mediaBunnySeek(nodeId: string, time: number): void {
    this.send('mediaBunnySeek', { nodeId, time });
  }

  /** Restart video from beginning (atomic seek + play) */
  mediaBunnyRestart(nodeId: string): void {
    this.send('mediaBunnyRestart', { nodeId });
  }

  /** Set loop mode */
  mediaBunnySetLoop(nodeId: string, loop: boolean): void {
    this.send('mediaBunnySetLoop', { nodeId, loop });
  }

  /** Set playback rate */
  mediaBunnySetPlaybackRate(nodeId: string, rate: number): void {
    this.send('mediaBunnySetPlaybackRate', { nodeId, rate });
  }

  /** Destroy the MediaBunnyPlayer for a node */
  destroyMediaBunnyPlayer(nodeId: string): void {
    this.send('destroyMediaBunnyPlayer', { nodeId });
  }
}
