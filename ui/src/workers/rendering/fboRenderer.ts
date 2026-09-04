import regl from 'regl';
import type {
  RenderGraph,
  RenderNode,
  FBONode,
  FBOFormat,
  FBOResolution
} from '../../lib/rendering/types';
import type { TransportState } from '$lib/transport/types';
import {
  DEFAULT_OUTPUT_SIZE,
  WEBGL_EXTENSIONS,
  WEBGL_OPTIONAL_EXTENSIONS
} from '$lib/canvas/constants';
import { PixelReadbackService } from './PixelReadbackService';
import { PreviewRenderer } from './PreviewRenderer';
import { CaptureRenderer } from './CaptureRenderer';
import { match, P } from 'ts-pattern';
import { ShaderParkThreeRenderer } from './renderers/shaderpark/shaderParkThreeRenderer';
import type { Message } from '$lib/messages/MessageSystem';
import { JSRunner } from '../../lib/js-runner/JSRunner.js';
import { RenderingProfiler } from './RenderingProfiler.js';
import { WorkerProfiler } from '../shared/WorkerProfiler.js';
import { VideoTextureManager } from './VideoTextureManager.js';
import { renderElementImageToBitmap } from './elementImageBitmap.js';
import type { ElementImageLike } from '$lib/html-in-canvas/html-canvas-video-output';
import { VideoChannelRegistry } from './VideoChannelRegistry.js';
import { PollingClockScheduler } from '../../lib/transport/ClockScheduler.js';
import { installWorkerTimeGlobal } from './workerClock';
import { isValidUniformData } from './renderers/glsl/glUniformUtils';
import { CookStateManager } from './CookStateManager';
import { createRenderNodeCookPolicy } from './cooking/policies';
import { isSameMouseData, type MouseData } from './mouseData';
import { getViewportCookRequiredNodeIds, shouldSkipCookForViewport } from './renderEligibility';
import { createFinalOutputPresentationCommand } from './finalOutputPresentation';
import { isPassthroughNodeType } from './videoGraph';
import { FboResources } from './FboResources';
import { drawToFinalOutput } from './drawToFinalOutput';
import { VideoSourceResolver } from './VideoSourceResolver';
import { NodeRendererRegistry } from './NodeRendererRegistry';
import { WorkerSettingsRegistry } from './WorkerSettingsRegistry';
import { ShaderRendererFactory } from './ShaderRendererFactory';
import { buildRenderGraph } from './buildRenderGraph';
import { FFTTextureStore } from './FFTTextureStore';
import { renderFrame } from './renderFrame';
import { resolveVfsText } from '$lib/glsl-include/vfs-resolver';

interface ViewportCookCache {
  renderGraph: RenderGraph;
  visibleNodeIds: Set<string> | null;
  connectedVideoOutputNodeIds: Set<string>;
  effectiveOutputNodeId: string | null;
  requiredNodeIds: Set<string> | null;
}

export const FBO_RENDERER_CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
  alpha: true,
  antialias: false,
  premultipliedAlpha: false,
  stencil: true
};

export class FBORenderer {
  public outputSize = DEFAULT_OUTPUT_SIZE;
  public backgroundSize: [number, number] = [...DEFAULT_OUTPUT_SIZE];

  public renderGraph: RenderGraph | null = null;

  /** Output node determined by bg.out connection in the render graph */
  public outputNodeId: string | null = null;

  /** Which color attachment of the output node to display (for MRT sources) */
  public outputOutletIndex: number = 0;

  /** Override output node set by the user (bypasses bg.out). Falls back to outputNodeId if the override node doesn't exist. */
  public overrideOutputNodeId: string | null = null;

  public isOutputEnabled: boolean = false;
  public shouldProcessPreviews: boolean = false;
  public isAnimating: boolean = false;

  public offscreenCanvas: OffscreenCanvas;
  public gl: WebGL2RenderingContext;
  public regl: regl.Regl;

  // Draw command for outputting the final image
  private drawFinalOutput: regl.DrawCommand;

  // Mapping of nodeId -> uniform key -> uniform value
  // example: {'glsl-0': {'sliderValue': 0.5}}
  public uniformDataByNode: Map<string, Map<string, unknown>> = new Map();

  /** Video texture manager for external bitmap sources */
  public videoTextures: VideoTextureManager;
  public videoSources: VideoSourceResolver;

  /** Mapping of analyzer object's node id -> analysis type -> texture */
  public fftTextures: FFTTextureStore;

  /** Mapping of nodeID to pause state */
  public nodePausedMap: Map<string, boolean> = new Map();

  /** Mapping of nodeID to mouse state (iMouse vec4: xy = current, zw = click) */
  public mouseDataByNode: Map<string, MouseData> = new Map();

  /** Enable the WebGL workaround for iOS Safari */
  public usesMobileSafariWebGLWorkaround = false;

  public shaderParkThreeByNode = new Map<string, ShaderParkThreeRenderer | null>();
  public nodeRenderers: NodeRendererRegistry;
  private shaderRenderers: ShaderRendererFactory;

  /** Dedicated settings proxy registry — populated in BaseWorkerRenderer.resetState() before any async code runs, fixing the race where renderers aren't in their type-specific maps yet. */
  public settingsRegistry = new WorkerSettingsRegistry();

  public fboNodes = new Map<string, FBONode>();
  public fallbackTexture: regl.Texture2D;
  public lastTime: number = 0;
  public prevTransportTime: number = 0;
  public frameCount: number = 0;
  public contextLossReported = false;
  public renderFpsCap: number = 0;

  /** Transport time from main thread for synchronized timing */
  public transportState: TransportState | null = null;

  /** Profiler for frame timing and regl.read() metrics */
  public profiler = new RenderingProfiler();

  /** Per-node draw-loop profiler — times each node's render function each frame */
  public drawProfiler = new WorkerProfiler((nodeId, category, stats) => {
    self.postMessage({ type: 'drawStats', nodeId, category, stats });
  });

  public cookState = new CookStateManager();
  public startTime: number = Date.now();
  public jsRunner = JSRunner.getInstance();
  public lastCookStatusSignatures = new Map<string, string>();
  public connectedVideoOutputNodeIds: Set<string> = new Set();

  /** Clock scheduler for worker-based scheduling (frame-based precision) */
  public clockScheduler = new PollingClockScheduler();

  /** Shared pixel readback infrastructure */
  public pixelReadbackService: PixelReadbackService;

  /** Preview renderer with async PBO reads */
  public previewRenderer: PreviewRenderer;

  /** Capture renderer for video frames and sync captures */
  public captureRenderer: CaptureRenderer;

  /** Video channel registry for send.vdo/recv.vdo wireless routing */
  public videoChannelRegistry = VideoChannelRegistry.getInstance();

  private cookStatsEnabled = false;
  private renderErrorKeysByNode = new Map<string, Set<string>>();
  private visibleNodeIds: Set<string> | null = null;
  private viewportCookRequiredCache: ViewportCookCache | null = null;

  private frameCancellable: regl.Cancellable | null = null;
  private fboResources: FboResources;

  /** Minimum interval between rendered frames (ms). 0 = unlimited. */
  private renderIntervalMs: number = 0;
  private lastRenderTime: number = 0;

  /** Interval that flushes frame stats (fps, p50, p95, drops) every 500ms */
  private frameStatsInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.jsRunner.setVfsModuleLoader((path, requesterId) =>
      resolveVfsText(requesterId.replace(/^node-(.*)\.js$/, '$1'), path)
    );

    const [width, height] = this.outputSize;

    this.offscreenCanvas = new OffscreenCanvas(width, height);
    this.gl = this.offscreenCanvas.getContext('webgl2', FBO_RENDERER_CONTEXT_ATTRIBUTES)!;

    // Float textures are created via raw WebGL2 in createFboTexture(), bypassing
    // regl entirely. No need to request float extensions through regl — doing so
    // triggers invalid texImage2D probes that emit WebGL warnings.
    this.regl = regl({
      gl: this.gl,
      extensions: WEBGL_EXTENSIONS,
      optionalExtensions: WEBGL_OPTIONAL_EXTENSIONS
    });

    // Draw final output by pre-multiplying alpha channel
    // Fixes alpha not being rendered in final output
    this.drawFinalOutput = createFinalOutputPresentationCommand(this.regl);

    this.fboResources = new FboResources(this.regl, this.gl);

    this.fallbackTexture = this.regl.texture({
      width: 1,
      height: 1,
      data: new Uint8Array([0, 0, 0, 0])
    });

    // Create shared pixel readback service
    this.pixelReadbackService = new PixelReadbackService(this.gl, this.regl, this.profiler);

    // Create renderers that use the shared service
    this.previewRenderer = new PreviewRenderer(this.pixelReadbackService);
    this.captureRenderer = new CaptureRenderer(this.pixelReadbackService);

    // Create video texture manager
    this.videoTextures = new VideoTextureManager(this.regl, this.gl);
    this.fftTextures = new FFTTextureStore(this.regl);

    this.videoSources = new VideoSourceResolver(
      () => this.renderGraph,
      this.fboNodes,
      this.videoTextures
    );

    this.nodeRenderers = new NodeRendererRegistry(this);
    this.shaderRenderers = new ShaderRendererFactory(this);

    this.usesMobileSafariWebGLWorkaround = this.detectMobileSafari();

    this.registerContextLossDiagnostics();

    /**
     * Define global `time` getter for Hydra compatibility.
     * This allows `() => time` to work in Hydra code.
     */
    installWorkerTimeGlobal(() => this.transportState?.seconds ?? this.lastTime);
  }

  private detectMobileSafari(): boolean {
    const userAgent = globalThis.navigator?.userAgent ?? '';
    const isIOS = /iP(hone|ad|od)/.test(userAgent);
    const isWebKitSafari = /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS/.test(userAgent);

    return isIOS && isWebKitSafari;
  }

  private registerContextLossDiagnostics() {
    const addEventListener = this.offscreenCanvas.addEventListener?.bind(this.offscreenCanvas);

    if (!addEventListener) return;

    addEventListener('webglcontextlost', (event) => {
      event.preventDefault();

      this.contextLossReported = true;
      this.reportWorkerError('WebGL context lost in render worker');
    });

    addEventListener('webglcontextrestored', () => {
      this.contextLossReported = false;
      this.reportWorkerError('WebGL context restored in render worker; rebuild the render graph');
    });
  }

  /**
   * Compute a fingerprint of a render node's data for change detection.
   * Used to skip renderer recreation when only edges changed.
   */
  public computeNodeFingerprint(node: RenderNode): string {
    return JSON.stringify(node.data);
  }

  private computeNodeGraphSignature(node: RenderNode): string {
    const inletMap = Array.from(node.inletMap.entries())
      .map(([inletIndex, { sourceNodeId, outletIndex }]) => [inletIndex, sourceNodeId, outletIndex])
      .sort(([a], [b]) => Number(a) - Number(b));

    return JSON.stringify({
      inputs: [...node.inputs].sort(),
      outputs: [...node.outputs].sort(),
      inletMap,
      backEdgeInlets: [...node.backEdgeInlets].sort((a, b) => a - b)
    });
  }

  /** Resolve per-node resolution override to [width, height]. */
  public resolveNodeSize(resolution: FBOResolution | undefined): [number, number] {
    return this.fboResources.resolveSize(resolution, this.outputSize);
  }

  /**
   * Create a regl texture, then re-initialize it with the correct WebGL2
   * internal format if float. regl doesn't support WebGL2 sized internal
   * formats (RGBA16F/RGBA32F) — it always uses GL_RGBA for internalformat,
   * which is invalid for float in WebGL2. So we create via regl (for tracking)
   * then fix the underlying GL texture with raw texImage2D.
   */
  public createFboTexture(width: number, height: number, format: FBOFormat): regl.Texture2D {
    return this.fboResources.createTexture(width, height, format);
  }

  /** Build FBOs for all nodes in the render graph */
  async buildFBOs(renderGraph: RenderGraph, connectedVideoOutputNodeIds?: Set<string>) {
    return buildRenderGraph(this, renderGraph, connectedVideoOutputNodeIds);
  }

  async createRenderer(
    node: RenderNode,
    framebuffer: regl.Framebuffer2D
  ): Promise<{ render: FBONode['render']; cleanup: () => void } | null> {
    return match(node)
      .with({ type: P.union('glsl', 'shaderpark') }, (renderer) =>
        this.shaderRenderers.create(renderer, framebuffer)
      )
      .with(
        {
          type: P.union('hydra', 'swgl', 'canvas', 'textmode', 'three', 'pixi', 'regl', 'projmap')
        },
        (renderer) => this.nodeRenderers.create(renderer, framebuffer)
      )
      .otherwise(() => ({ render: () => {}, cleanup: () => {} }));
  }

  /**
   * Reused renderers retain resources from the prior FBO until their replacement
   * has consumed or transferred that state.
   */
  public hasReusableRenderer(node: RenderNode): boolean {
    if (
      node.type === 'shaderpark' &&
      node.data.renderMode === '3d' &&
      this.shaderParkThreeByNode.has(node.id)
    ) {
      return true;
    }

    return this.nodeRenderers.hasReusableRenderer(node);
  }

  public destroyFboNode(fboNode: FBONode, cleanup = true): void {
    this.fboResources.destroyNode(fboNode, cleanup);
  }

  public destroyFeedbackResources(fboNode: FBONode): void {
    this.fboResources.destroyFeedbackResources(fboNode);
  }

  public rebuildCookingPolicies(mergedGraph: RenderGraph) {
    const outputs = this.cookState.getCookOutputsByNode(mergedGraph.nodes, (node) =>
      isPassthroughNodeType(node.type)
    );

    this.cookState.setOutputsByNode(outputs);

    for (const node of mergedGraph.nodes) {
      this.cookState.registerNode(node.id, createRenderNodeCookPolicy(node, mergedGraph));
    }

    const signatures = new Map(
      mergedGraph.nodes.map((node) => [node.id, this.computeNodeGraphSignature(node)])
    );

    this.cookState.setGraphSignatures(signatures);
  }

  updateProjectionMap(nodeId: string, surfaces: import('$lib/projmap/types').ProjMapSurface[]) {
    this.nodeRenderers.updateProjectionMap(nodeId, surfaces);
    this.cookState.markDirty(nodeId, 'config');
  }

  /**
   * Explicitly destroy a textmode renderer when its node is removed from the graph.
   * Called from destroyNodes() for nodes that no longer exist.
   */
  destroyTextmodeRenderer(nodeId: string) {
    this.nodeRenderers.destroyTextmodeRenderer(nodeId);
  }

  destroyNodes(newNodeIds?: Set<string>) {
    for (const fboNode of this.fboNodes.values()) {
      this.destroyFboNode(fboNode);
    }

    this.fboNodes.clear();
    this.cleanupExpensiveTextmodeRenderers(newNodeIds);
  }

  // Textmode.js is super expensive to setup.
  // We wanted to only clean them up if the node is destroyed.
  public cleanupExpensiveTextmodeRenderers(newNodeIds?: Set<string>) {
    this.nodeRenderers.cleanupRemovedTextmodeRenderers(newNodeIds);
  }

  setUniformData(
    nodeId: string,
    uniformName: string,
    uniformValue: number | boolean | number[] | boolean[] | number[][]
  ) {
    const renderNode = this.renderGraph?.nodes.find((n) => n.id === nodeId);

    const uniformDefs = match(renderNode)
      .with({ type: 'glsl' }, (node) => node.data.glUniformDefs)
      .with({ type: 'shaderpark' }, (node) => node.data.shaderParkUniformDefs)
      .otherwise(() => undefined);

    if (!uniformDefs) {
      return;
    }

    const uniformDef = uniformDefs.find((u) => u.name === uniformName);

    // Uniform does not exist in the node's uniform definitions.
    if (!uniformDef) {
      return;
    }

    // Sampler2D uniforms are handled separately as textures.
    if (uniformDef.type === 'sampler2D') {
      return;
    }

    if (!isValidUniformData(uniformDef, uniformValue)) {
      return;
    }

    if (!this.uniformDataByNode.has(nodeId)) {
      this.uniformDataByNode.set(nodeId, new Map());
    }

    this.uniformDataByNode.get(nodeId)!.set(uniformName, uniformValue);
    this.cookState.markDirty(nodeId, 'uniform');
  }

  /**
   * Sync transport state with main thread for synchronized timing.
   *
   * Called at 60fps to keep render nodes in sync with global transport.
   */
  setTransportState(state: TransportState) {
    this.transportState = state;
  }

  setPreviewEnabled(nodeId: string, enabled: boolean) {
    const node = this.renderGraph?.nodes.find((candidate) => candidate.id === nodeId);

    this.previewRenderer.setPreviewEnabled(
      nodeId,
      node ? enabled && !isPassthroughNodeType(node.type) : enabled
    );

    this.shouldProcessPreviews = this.previewRenderer.hasEnabledPreviews();
  }

  /** Toggle pause state for a node */
  toggleNodePause(nodeId: string) {
    const currentState = this.nodePausedMap.get(nodeId) ?? false;
    const newState = !currentState;

    this.nodePausedMap.set(nodeId, newState);

    // If resuming (unpausing), trigger animation resume on the renderer
    if (!newState) {
      this.resumeNodeAnimation(nodeId);
    }
  }

  /** Resume animation for a node's renderer (if it supports resuming) */
  private resumeNodeAnimation(nodeId: string) {
    // Check all renderer maps for the node
    const renderers = [
      this.nodeRenderers.canvasByNode.get(nodeId),
      this.nodeRenderers.hydraByNode.get(nodeId),
      this.nodeRenderers.textmodeByNode.get(nodeId),
      this.nodeRenderers.threeByNode.get(nodeId),
      this.nodeRenderers.swglByNode.get(nodeId),
      this.nodeRenderers.pixiByNode.get(nodeId)
    ];

    for (const renderer of renderers) {
      if (
        renderer &&
        'resumeAnimation' in renderer &&
        typeof renderer.resumeAnimation === 'function'
      ) {
        renderer.resumeAnimation();
      }
    }
  }

  /** Check if a node is paused */
  isNodePaused(nodeId: string): boolean {
    return this.nodePausedMap.get(nodeId) ?? false;
  }

  isNodeCookRequired(nodeId: string): boolean {
    const effectiveOutputNodeId = this.getEffectiveOutputNodeId();
    const requiredNodeIds = this.getViewportCookRequiredNodeIds(effectiveOutputNodeId);

    return !shouldSkipCookForViewport({ node: { id: nodeId }, requiredNodeIds });
  }

  setOverrideOutputNode(nodeId: string | null) {
    this.overrideOutputNodeId = nodeId;
    this.resumeViewportManagedRenderers();
  }

  /** Set mouse data for a node (Shadertoy iMouse format) */
  setMouseData(nodeId: string, x: number, y: number, z: number, w: number, buttons?: number) {
    const nextMouseData: MouseData = [x, y, z, w, buttons];
    const previousMouseData = this.mouseDataByNode.get(nodeId);

    if (isSameMouseData(previousMouseData, nextMouseData)) return;

    this.mouseDataByNode.set(nodeId, nextMouseData);
    this.cookState.markDirty(nodeId, 'mouse');
  }

  sendThreeWheelData(
    nodeId: string,
    event: { x?: number; y?: number; deltaX?: number; deltaY: number; deltaMode?: number }
  ) {
    this.nodeRenderers.threeByNode.get(nodeId)?.handleWheelData(event);
  }

  resetThreeOrbitControls(nodeId: string) {
    this.nodeRenderers.threeByNode.get(nodeId)?.resetOrbitControls();
  }

  zoomShaderParkOrbit(nodeId: string, deltaY: number) {
    this.shaderParkThreeByNode.get(nodeId)?.zoom(deltaY);
    this.cookState.markDirty(nodeId, 'mouse');
  }

  public reportNodeRenderError(node: RenderNode, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const errorKey = `${node.type}:${message}`;

    const reported = this.renderErrorKeysByNode.get(node.id) ?? new Set<string>();
    if (reported.has(errorKey)) return;

    reported.add(errorKey);
    this.renderErrorKeysByNode.set(node.id, reported);

    self.postMessage({
      type: 'consoleOutput',
      nodeId: node.id,
      level: 'error',
      args: [`Render error in ${node.type}: ${message}`]
    });
  }

  public reportWorkerError(message: string) {
    self.postMessage({ type: 'error', message });
  }

  public postCookStatusIfNeeded(nodeId: string, force = false): void {
    if (!this.cookStatsEnabled) return;

    const status = this.cookState.getStatus(nodeId);
    if (!status) return;

    const cachedBucket = Math.floor(status.cachedFrames / 15);

    const signature = JSON.stringify({
      status: status.status,
      cookedFrames: status.cookedFrames,
      cachedBucket,
      lastCookTimeMs: status.lastCookTimeMs,
      lastCookReasons: status.lastCookReasons
    });

    if (!force && this.lastCookStatusSignatures.get(nodeId) === signature) return;

    this.lastCookStatusSignatures.set(nodeId, signature);
    self.postMessage({ type: 'cookStatus', nodeId, ...status });
  }

  setCookStatsEnabled(enabled: boolean): void {
    if (this.cookStatsEnabled === enabled) return;

    this.cookStatsEnabled = enabled;
    this.lastCookStatusSignatures.clear();
  }

  public refreshReglState() {
    const reglInstance = this.regl as regl.Regl & {
      _refresh?: () => void;
    };

    reglInstance._refresh?.();
  }

  public hasValidOutputOverride(): boolean {
    return Boolean(
      this.overrideOutputNodeId && this.videoSources.resolveTexture(this.overrideOutputNodeId, 0)
    );
  }

  public getEffectiveOutputNodeId(isOverride = this.hasValidOutputOverride()): string | null {
    return isOverride ? this.overrideOutputNodeId : this.outputNodeId;
  }

  /**
   * Render previews for enabled nodes and return ImageBitmaps directly.
   * Uses async PBO reads - returns bitmaps from *previous* frame's reads
   * while initiating new reads for the current frame.
   *
   * This introduces 1 frame of latency but eliminates GPU stalls (~3ms per read).
   */
  renderPreviewBitmaps(): Map<string, ImageBitmap> {
    return this.previewRenderer.renderPreviewBitmaps(
      this.fboNodes,
      this.isOutputEnabled,
      this.cookState.getCookedNodeIdsThisFrame()
    );
  }

  /** Set which nodes are visible in the viewport for preview culling */
  setVisibleNodes(nodeIds: Set<string>) {
    this.visibleNodeIds = new Set(nodeIds);
    this.previewRenderer.setVisibleNodes(nodeIds);
    this.resumeViewportManagedRenderers();
  }

  public getViewportCookRequiredNodeIds(effectiveOutputNodeId: string | null): Set<string> | null {
    const cached = this.viewportCookRequiredCache;

    if (
      cached &&
      cached.renderGraph === this.renderGraph &&
      cached.visibleNodeIds === this.visibleNodeIds &&
      cached.connectedVideoOutputNodeIds === this.connectedVideoOutputNodeIds &&
      cached.effectiveOutputNodeId === effectiveOutputNodeId
    ) {
      return cached.requiredNodeIds;
    }

    if (!this.renderGraph) return null;

    const requiredNodeIds = getViewportCookRequiredNodeIds({
      nodes: this.renderGraph.nodes,
      visibleNodeIds: this.visibleNodeIds,
      connectedVideoOutputNodeIds: this.connectedVideoOutputNodeIds,
      effectiveOutputNodeId
    });

    this.viewportCookRequiredCache = {
      renderGraph: this.renderGraph,
      visibleNodeIds: this.visibleNodeIds,
      connectedVideoOutputNodeIds: this.connectedVideoOutputNodeIds,
      effectiveOutputNodeId,
      requiredNodeIds
    };

    return requiredNodeIds;
  }

  public resumeViewportManagedRenderers() {
    for (const renderer of this.nodeRenderers.canvasByNode.values()) {
      renderer?.resumeAnimation();
    }
  }

  /** Enable/disable all profiling (per-node draw timing + frame stats). */
  public setProfilingEnabled(enabled: boolean) {
    this.profiler.setEnabled(enabled);
    this.drawProfiler.setEnabled(enabled);

    if (enabled) {
      if (this.frameStatsInterval === null) {
        this.frameStatsInterval = setInterval(() => {
          const stats = this.profiler.flushStats();

          if (stats) {
            self.postMessage({ type: 'renderFrameStats', stats });
          }
        }, 500);
      }
    } else {
      if (this.frameStatsInterval !== null) {
        clearInterval(this.frameStatsInterval);

        this.frameStatsInterval = null;
      }
    }
  }

  public get isProfilingEnabled(): boolean {
    return this.profiler.isEnabled;
  }

  public renderNodeToMainOutput(nodeId: string): void {
    if (!this.isOutputEnabled) {
      return;
    }

    const source = this.videoSources.resolveTexture(nodeId, this.outputOutletIndex);

    if (!source) {
      console.warn('Could not find source framebuffer for final texture');
      return;
    }

    drawToFinalOutput({
      source,
      regl: this.regl,
      drawFinalOutput: this.drawFinalOutput,
      outputSize: this.outputSize,
      backgroundSize: this.backgroundSize
    });
  }

  /** Set the render FPS cap. 0 = unlimited (render every frame). */
  setRenderFpsCap(fps: number): void {
    this.renderFpsCap = fps;

    // Subtract 1ms tolerance so rAF timing jitter doesn't cause us to skip
    // the correct frame (e.g. 60 FPS on 120Hz: 16.6ms is just under 16.67ms)
    this.renderIntervalMs = fps > 0 ? 1000 / fps - 1 : 0;
  }

  startRenderLoop(onFrame?: () => void) {
    this.stopRenderLoop();
    this.isAnimating = true;

    this.frameCancellable = this.regl.frame(() => {
      if (!this.isAnimating) {
        this.frameCancellable?.cancel();
        return;
      }

      // Skip frame if under the FPS cap interval
      if (this.renderIntervalMs > 0) {
        const now = performance.now();
        if (now - this.lastRenderTime < this.renderIntervalMs) return;

        this.lastRenderTime = now;
      }

      renderFrame(this);
      onFrame?.();
    });
  }

  stopRenderLoop() {
    this.isAnimating = false;
  }

  /**
   * Set the output (FBO) resolution for the patch.
   * Updates all node FBOs and Hydra renderers.
   */
  setOutputSize(width: number, height: number) {
    this.outputSize = [width, height] as [number, number];

    // Resize the offscreen canvas to match the new output size
    this.offscreenCanvas.width = width;
    this.offscreenCanvas.height = height;

    // Update all hydra renderers to match the new output size
    for (const hydra of this.nodeRenderers.hydraByNode.values()) {
      hydra?.hydra?.setResolution(width, height);
    }

    // Rebuild FBOs at the new output dimensions
    if (this.renderGraph) {
      this.buildFBOs(this.renderGraph);

      for (const node of this.renderGraph.nodes) {
        this.cookState.markDirty(node.id, 'output-size');
      }
    }
  }

  /**
   * Set the background display size (viewport dimensions).
   * Only stores the value for cover-mode blit crop calculation.
   * Does NOT resize the offscreen canvas, FBOs, or node previews.
   */
  setBackgroundSize(width: number, height: number) {
    this.backgroundSize = [width, height] as [number, number];
  }

  /**
   * Sets a persistent pre-flipped bitmap image for a node.
   * Sets a bitmap for a node, flipping Y to match GL coordinate conventions.
   *
   * ImageBitmap data is top-to-bottom, but GL textures are bottom-to-top.
   * We use blitFramebuffer with swapped Y coordinates to flip efficiently on GPU.
   *
   * @param nodeId - The node ID to set the bitmap for
   * @param bitmap - ImageBitmap (will be flipped during upload)
   */
  setBitmap(nodeId: string, bitmap: ImageBitmap) {
    this.videoTextures.setBitmap(nodeId, bitmap);
    this.cookState.markDirty(nodeId, 'bitmap');
  }

  setElementImage(nodeId: string, elementImage: ElementImageLike, width: number, height: number) {
    const bitmap = renderElementImageToBitmap(elementImage, width, height);

    if (!bitmap) {
      console.warn(
        `[htmlCanvas] Worker cannot draw ElementImage for node ${nodeId}; missing drawElementImage support`
      );

      return;
    }

    this.setBitmap(nodeId, bitmap);
  }

  setFloatTexture(
    nodeId: string,
    width: number,
    height: number,
    data: Float32Array,
    textureFormat: FBOFormat = 'rgba32f'
  ) {
    this.videoTextures.setFloatTexture(nodeId, width, height, data, textureFormat);
    this.cookState.markDirty(nodeId, 'bitmap');
  }

  setVideoFrame(nodeId: string, width: number, height: number, data: Uint8ClampedArray) {
    this.videoTextures.setVideoFrame(nodeId, width, height, data);
    this.cookState.markDirty(nodeId, 'bitmap');
  }

  /** Send message to nodes */
  sendMessageToNode(nodeId: string, message: Message) {
    const node = this.renderGraph?.nodes.find((candidate) => candidate.id === nodeId);
    const renderer = node ? this.nodeRenderers.getMessageCapableRenderer(node) : null;

    if (!renderer) return;

    this.cookState.markDirty(nodeId, 'message');
    renderer.handleMessage(message);
  }

  /** Route a channel message to the renderer for a given node. */
  sendChannelMessageToNode(nodeId: string, channel: string, data: unknown, sourceNodeId: string) {
    const node = this.renderGraph?.nodes.find((candidate) => candidate.id === nodeId);
    const renderer = node ? this.nodeRenderers.getMessageCapableRenderer(node) : null;

    if (!renderer) return;

    this.cookState.markDirty(nodeId, 'message');
    renderer.handleChannelMessage(channel, data, sourceNodeId);
  }

  /** Update JS module in the worker's JSRunner instance */
  updateJSModule(moduleName: string, code: string | null) {
    if (code === null) {
      this.jsRunner.modules.delete(moduleName);
    } else {
      this.jsRunner.modules.set(moduleName, code);
    }
  }
}
