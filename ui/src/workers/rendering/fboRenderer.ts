import regl from 'regl';
import { createShaderToyDrawCommand } from '../../lib/canvas/shadertoy-draw';
import type {
  RenderGraph,
  RenderNode,
  FBONode,
  RenderFunction,
  UserParam,
  FBOFormat,
  FBOResolution
} from '../../lib/rendering/types';
import type { ClockCommandMessage } from '$lib/transport/types';
import {
  DEFAULT_OUTPUT_SIZE,
  WEBGL_EXTENSIONS,
  WEBGL_OPTIONAL_EXTENSIONS,
  PREVIEW_SCALE_FACTOR,
  capPreviewSize
} from '$lib/canvas/constants';
import { PixelReadbackService } from './PixelReadbackService';
import { PreviewRenderer } from './PreviewRenderer';
import { CaptureRenderer } from './CaptureRenderer';
import { match, P } from 'ts-pattern';
import { HydraRenderer } from './hydraRenderer';
import { CanvasRenderer } from './canvasRenderer';
import { TextmodeRenderer } from './textmodeRenderer';
import { ThreeRenderer } from './threeRenderer';
import { ReglRenderer } from './reglRenderer';
import { SwissGLRenderer } from './swglRenderer';
import { ProjectionMapRenderer } from '$objects/projmap/ProjectionMapRenderer';
import { getFramebuffer, getRawTexture } from './utils';
import { isExternalTextureNode } from '$lib/canvas/node-types';
import type { Message } from '$lib/messages/MessageSystem';
import type {
  AudioAnalysisType,
  AudioAnalysisPayloadWithType,
  GlslFFTInletMeta
} from '$lib/audio/AudioAnalysisSystem.js';
import { JSRunner } from '../../lib/js-runner/JSRunner.js';
import { RenderingProfiler } from './RenderingProfiler.js';
import { WorkerProfiler } from '../shared/WorkerProfiler.js';
import { VideoTextureManager } from './VideoTextureManager.js';
import { processIncludes } from '$lib/glsl-include/preprocessor';
import { createWorkerResolver } from '$lib/glsl-include/worker-resolver';
import { VideoChannelRegistry } from './VideoChannelRegistry.js';
import { PollingClockScheduler, type ClockState } from '../../lib/transport/ClockScheduler.js';
import type { RenderOp } from '$lib/profiler/types';
import { defaultUniformValue, isValidUniformData, toGLValue } from './glUniformUtils';
import type { WorkerSettingsProxy } from '../shared/workerSettingsProxy';

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

  // Mapping of nodeId -> uniform key -> uniform value
  // example: {'glsl-0': {'sliderValue': 0.5}}
  public uniformDataByNode: Map<string, Map<string, unknown>> = new Map();

  /** Video texture manager for external bitmap sources */
  public videoTextures: VideoTextureManager;

  /** Mapping of analyzer object's node id -> analysis type -> texture */
  public fftTexturesByAnalyzer: Map<string, Map<AudioAnalysisType, regl.Texture2D>> = new Map();

  /** Mapping of glsl node id -> fft inlet metadata */
  public fftInletsByGlslNode: Map<string, GlslFFTInletMeta> = new Map();

  /** Mapping of nodeID to pause state */
  public nodePausedMap: Map<string, boolean> = new Map();

  /** Mapping of nodeID to mouse state (iMouse vec4: xy = current, zw = click) */
  public mouseDataByNode: Map<string, [number, number, number, number]> = new Map();

  public hydraByNode = new Map<string, HydraRenderer | null>();
  public canvasByNode = new Map<string, CanvasRenderer | null>();
  public textmodeByNode = new Map<string, TextmodeRenderer | null>();
  public threeByNode = new Map<string, ThreeRenderer | null>();
  public reglByNode = new Map<string, ReglRenderer | null>();
  public projmapByNode = new Map<string, ProjectionMapRenderer | null>();
  public swglByNode = new Map<string, SwissGLRenderer | null>();

  /** Dedicated settings proxy registry — populated in BaseWorkerRenderer.resetState() before any async code runs, fixing the race where renderers aren't in their type-specific maps yet. */
  private settingsProxiesByNode = new Map<string, WorkerSettingsProxy>();

  /** During textmode loading, we need to refresh REGL. */

  /** Old Hydra renderers pending cleanup (deferred to avoid visual glitch) */
  private pendingHydraCleanup: HydraRenderer[] = [];
  private hydraCleanupTimer: ReturnType<typeof setInterval> | null = null;

  private fboNodes = new Map<string, FBONode>();
  private fallbackTexture: regl.Texture2D;
  private lastTime: number = 0;
  private prevTransportTime: number = 0;
  private frameCount: number = 0;

  /** Minimum interval between rendered frames (ms). 0 = unlimited. */
  private renderIntervalMs: number = 0;
  private lastRenderTime: number = 0;

  /** Transport time from main thread for synchronized timing */
  public transportTime: {
    seconds: number;
    ticks: number;
    bpm: number;
    isPlaying: boolean;
    beat: number;
    phase: number;
    bar: number;
    beatsPerBar: number;
    denominator: number;
    ppq: number;
  } | null = null;

  /** Profiler for frame timing and regl.read() metrics */
  public profiler = new RenderingProfiler();

  /** Per-node draw-loop profiler — times each node's render function each frame */
  public drawProfiler = new WorkerProfiler((nodeId, category, stats) => {
    self.postMessage({ type: 'drawStats', nodeId, category, stats });
  });

  /** Interval that flushes frame stats (fps, p50, p95, drops) every 500ms */
  private frameStatsInterval: ReturnType<typeof setInterval> | null = null;

  private startTime: number = Date.now();
  private frameCancellable: regl.Cancellable | null = null;
  public jsRunner = JSRunner.getInstance();

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

  /** Whether rendering to float FBOs is supported (EXT_color_buffer_float) */
  private colorBufferFloatSupported = false;

  /** Whether linear filtering is supported for half-float and float textures */
  private halfFloatLinearSupported = false;
  private floatLinearSupported = false;

  constructor() {
    const [width, height] = this.outputSize;

    this.offscreenCanvas = new OffscreenCanvas(width, height);
    this.gl = this.offscreenCanvas.getContext('webgl2', { antialias: false })!;

    // Float textures are created via raw WebGL2 in createFboTexture(), bypassing
    // regl entirely. No need to request float extensions through regl — doing so
    // triggers invalid texImage2D probes that emit WebGL warnings.
    this.regl = regl({
      gl: this.gl,
      extensions: WEBGL_EXTENSIONS,
      optionalExtensions: WEBGL_OPTIONAL_EXTENSIONS
    });

    // Detect float FBO support
    this.colorBufferFloatSupported = !!this.gl.getExtension('EXT_color_buffer_float');
    this.halfFloatLinearSupported = !!this.gl.getExtension('OES_texture_half_float_linear');
    this.floatLinearSupported = !!this.gl.getExtension('OES_texture_float_linear');

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

    this.defineWorkerGlobals();
  }

  /**
   * Compute a fingerprint of a render node's data for change detection.
   * Used to skip renderer recreation when only edges changed.
   */
  private computeNodeFingerprint(node: RenderNode): string {
    return JSON.stringify(node.data);
  }

  /** Resolve per-node resolution override to [width, height]. */
  private resolveNodeSize(resolution: FBOResolution | undefined): [number, number] {
    const [outputWidth, outputHeight] = this.outputSize;

    if (resolution == null) {
      return [outputWidth, outputHeight];
    }

    let width: number;
    let height: number;

    // Match 1/n fractional format (e.g. '1/2', '1/4', '1/8')
    const fractionalMatch = typeof resolution === 'string' ? resolution.match(/^1\/(\d+)$/) : null;

    if (fractionalMatch) {
      const divisor = Number(fractionalMatch[1]);

      width = Math.floor(outputWidth / divisor);
      height = Math.floor(outputHeight / divisor);
    } else if (typeof resolution === 'number') {
      width = Math.floor(resolution);
      height = Math.floor(resolution);
    } else if (Array.isArray(resolution)) {
      width = Math.floor(resolution[0]);
      height = Math.floor(resolution[1]);
    } else {
      return [outputWidth, outputHeight];
    }

    return [Math.max(1, width), Math.max(1, height)];
  }

  /**
   * Create a regl texture, then re-initialize it with the correct WebGL2
   * internal format if float. regl doesn't support WebGL2 sized internal
   * formats (RGBA16F/RGBA32F) — it always uses GL_RGBA for internalformat,
   * which is invalid for float in WebGL2. So we create via regl (for tracking)
   * then fix the underlying GL texture with raw texImage2D.
   */
  private createFboTexture(width: number, height: number, format: FBOFormat): regl.Texture2D {
    // Create as uint8 first so regl doesn't complain about float types.
    // regl's initial texImage2D with GL_RGBA emits a harmless WebGL warning
    // for float nodes — we immediately overwrite with the correct format below.
    const texture = this.regl.texture({ width, height, wrapS: 'clamp', wrapT: 'clamp' });

    if (format === 'rgba8') return texture;

    // Fall back to rgba8 if float render targets aren't supported
    if (!this.colorBufferFloatSupported) {
      console.warn(
        `[fbo] EXT_color_buffer_float not supported, falling back to rgba8 for ${format}`
      );
      return texture;
    }

    // Re-initialize the raw GL texture with the correct WebGL2-sized format
    const gl = this.gl;
    const rawTexture = getRawTexture(texture);
    const { internalFormat, type, linearSupported } = match(format)
      .with('rgba16f', () => ({
        internalFormat: gl.RGBA16F,
        type: gl.HALF_FLOAT,
        linearSupported: this.halfFloatLinearSupported
      }))
      .with('rgba32f', () => ({
        internalFormat: gl.RGBA32F,
        type: gl.FLOAT,
        linearSupported: this.floatLinearSupported
      }))
      .exhaustive();

    const filter = linearSupported ? gl.LINEAR : gl.NEAREST;

    gl.bindTexture(gl.TEXTURE_2D, rawTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, gl.RGBA, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return texture;
  }

  /** Build FBOs for all nodes in the render graph */
  async buildFBOs(renderGraph: RenderGraph) {
    // Get the set of node IDs that will exist in the new graph
    const newNodeIds = new Set(renderGraph.nodes.map((n) => n.id));

    // Only destroy FBOs for nodes that no longer exist in the new graph.
    // This prevents the black flash on Chrome when rebuilding the graph,
    // since existing FBOs retain their content until overwritten.
    for (const [nodeId, fboNode] of this.fboNodes) {
      if (!newNodeIds.has(nodeId)) {
        fboNode.framebuffer.destroy();

        for (const texture of fboNode.colorAttachments) {
          texture.destroy();
        }

        for (const framebuffer of fboNode.prevFramebuffers ?? []) {
          framebuffer?.destroy();
        }

        for (const texture of fboNode.prevTextures ?? []) {
          texture?.destroy();
        }

        fboNode.cleanup?.();

        this.fboNodes.delete(nodeId);

        // Unsubscribe removed nodes from video channels
        this.videoChannelRegistry.unsubscribeAll(nodeId);
      }
    }

    this.cleanupExpensiveTextmodeRenderers(newNodeIds);

    // Register send.vdo/recv.vdo nodes with video channel registry
    // Unsubscribe first to clean up stale subscriptions when channel names change
    for (const node of renderGraph.nodes) {
      match(node)
        .with({ type: 'send.vdo' }, (n) => {
          this.videoChannelRegistry.unsubscribeAll(n.id);
          this.videoChannelRegistry.subscribe(n.data.channel, n.id, 'send');
        })
        .with({ type: 'recv.vdo' }, (n) => {
          this.videoChannelRegistry.unsubscribeAll(n.id);
          this.videoChannelRegistry.subscribe(n.data.channel, n.id, 'recv');
        })
        .otherwise(() => {});
    }

    // Merge virtual edges from video channels into the render graph
    const virtualEdges = this.videoChannelRegistry.getVirtualEdges();
    const mergedGraph: RenderGraph = {
      ...renderGraph,
      edges: [...renderGraph.edges, ...virtualEdges]
    };

    // Update node relationships with virtual edges
    this.applyVirtualEdgesToNodes(mergedGraph);

    this.renderGraph = mergedGraph;
    this.outputNodeId = mergedGraph.outputNodeId;
    this.outputOutletIndex = mergedGraph.outputOutletIndex;

    // Phase 1 (sync): allocate FBOs and collect nodes that need renderer creation
    type PendingNode = {
      node: RenderNode;
      colorAttachments: regl.Texture2D[];
      framebuffer: regl.Framebuffer2D;
      fingerprint: string;
      fboFormat: FBOFormat;
      resolution?: FBOResolution;
    };

    const pending: PendingNode[] = [];

    for (const node of renderGraph.nodes) {
      const existingFbo = this.fboNodes.get(node.id);

      // MRT count: GLSL, REGL, SwissGL, and Hydra nodes can request multiple color attachments.
      // REGL/Hydra store outlet count as `videoOutletCount`; GLSL/SwissGL use `mrtCount`.
      const mrtCount =
        node.type === 'glsl'
          ? (node.data.mrtCount ?? 1)
          : node.type === 'swgl'
            ? (node.data.mrtCount ?? 1)
            : node.type === 'regl' || node.type === 'hydra'
              ? (node.data.videoOutletCount ?? 1)
              : 1;

      // FBO format: read from node data, default to rgba8
      const fboFormat: FBOFormat =
        ((node.data as Record<string, unknown>)?.fboFormat as FBOFormat) || 'rgba8';

      // Per-node resolution override (spec 122)
      const nodeResolution = (node.data as Record<string, unknown>)?.resolution as
        | FBOResolution
        | undefined;

      const [nodeWidth, nodeHeight] = this.resolveNodeSize(nodeResolution);

      const canReuseFbo =
        existingFbo &&
        existingFbo.texture.width === nodeWidth &&
        existingFbo.texture.height === nodeHeight &&
        existingFbo.colorAttachments.length === mrtCount &&
        (existingFbo.fboFormat ?? 'rgba8') === fboFormat;

      // Diff: check if the node's data has changed since last build.
      // If both FBO and data are unchanged, skip renderer recreation entirely.
      // This preserves state in JS-based renderers (canvas, three, regl, etc.)
      // that would otherwise lose their scene graphs, animation state, etc.
      // Passthrough nodes (send.vdo, recv.vdo) capture inletMap in their closure
      // so they must always be recreated when the graph changes.
      const fingerprint = this.computeNodeFingerprint(node);
      const isPassthroughNode = node.type === 'send.vdo' || node.type === 'recv.vdo';

      if (
        canReuseFbo &&
        !isPassthroughNode &&
        existingFbo.nodeType === node.type &&
        existingFbo.dataFingerprint === fingerprint
      ) {
        // Node unchanged — skip renderer recreation entirely
        continue;
      }

      let colorAttachments: regl.Texture2D[];
      let framebuffer: regl.Framebuffer2D;

      if (canReuseFbo) {
        // Reuse existing FBO - preserves content, prevents flash
        colorAttachments = existingFbo.colorAttachments;
        framebuffer = existingFbo.framebuffer;

        // For Hydra nodes: skip cleanup to avoid visual glitch.
        // The old Hydra instance stays alive until replaced in createHydraRenderer,
        // allowing us to read synth time directly. It then gets garbage collected.
        // For other nodes: run cleanup normally.
        const isHydraNode = this.hydraByNode.has(node.id);
        if (!isHydraNode) {
          existingFbo.cleanup?.();
        }
      } else {
        // Destroy old FBO if it exists but size or mrtCount doesn't match
        if (existingFbo) {
          // For Hydra: skip cleanup (will be GC'd after createHydraRenderer reads synth time)
          const isHydraNode = this.hydraByNode.has(node.id);
          if (!isHydraNode) {
            existingFbo.cleanup?.();
          }

          existingFbo.framebuffer.destroy();

          for (const texture of existingFbo.colorAttachments) {
            texture.destroy();
          }

          for (const framebuffer of existingFbo.prevFramebuffers ?? []) {
            framebuffer?.destroy();
          }

          for (const texture of existingFbo.prevTextures ?? []) {
            texture?.destroy();
          }

          this.fboNodes.delete(node.id);
        }

        // Create color attachments — one for standard nodes, N for MRT GLSL nodes
        colorAttachments = Array.from({ length: mrtCount }, () =>
          this.createFboTexture(nodeWidth, nodeHeight, fboFormat)
        );

        if (mrtCount > 1) {
          // regl's framebuffer({ colors: [...] }) requires WEBGL_draw_buffers which is
          // a WebGL1 extension not exposed on WebGL2 contexts (it's core there).
          // Instead: create a single-attachment regl framebuffer for attachment 0,
          // then manually attach the remaining textures via raw WebGL2.
          framebuffer = this.regl.framebuffer({ color: colorAttachments[0], depthStencil: false });

          const gl = this.gl;
          const rawFramebuffer = getFramebuffer(framebuffer);

          gl.bindFramebuffer(gl.FRAMEBUFFER, rawFramebuffer);

          for (let i = 1; i < mrtCount; i++) {
            const rawTexture = getRawTexture(colorAttachments[i]);

            gl.framebufferTexture2D(
              gl.FRAMEBUFFER,
              gl.COLOR_ATTACHMENT0 + i,
              gl.TEXTURE_2D,
              rawTexture,
              0
            );
          }

          gl.drawBuffers(colorAttachments.map((_, i) => gl.COLOR_ATTACHMENT0 + i));

          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        } else {
          framebuffer = this.regl.framebuffer({ color: colorAttachments[0], depthStencil: false });
        }
      }

      pending.push({
        node,
        colorAttachments,
        framebuffer,
        fingerprint,
        fboFormat,
        resolution: nodeResolution
      });
    }

    // Phase 2 (parallel): create all renderers concurrently
    const results = await Promise.all(
      pending.map(async ({ node, framebuffer }) =>
        match(node)
          .with({ type: 'glsl' }, (node) => this.createGlslRenderer(node, framebuffer))
          .with({ type: 'hydra' }, (node) => this.createHydraRenderer(node, framebuffer))
          .with({ type: 'swgl' }, (node) => this.createSwglRenderer(node, framebuffer))
          .with({ type: 'canvas' }, (node) => this.createCanvasRenderer(node, framebuffer))
          .with({ type: 'textmode' }, (node) => this.createTextmodeRenderer(node, framebuffer))
          .with({ type: 'three' }, (node) => this.createThreeRenderer(node, framebuffer))
          .with({ type: 'regl' }, (node) => this.createReglRenderer(node, framebuffer))
          .with({ type: 'projmap' }, (node) => this.createProjMapRenderer(node, framebuffer))
          .with({ type: 'img' }, () => this.createEmptyRenderer())
          .with({ type: 'bg.out' }, () => this.createEmptyRenderer())
          .with({ type: 'send.vdo' }, (node) => this.createPassthroughRenderer(node, framebuffer))
          .with({ type: 'recv.vdo' }, (node) => this.createPassthroughRenderer(node, framebuffer))
          .exhaustive()
      )
    );

    // Phase 3: collect results into FBO map
    for (let i = 0; i < pending.length; i++) {
      const { node, colorAttachments, framebuffer, fingerprint, fboFormat, resolution } =
        pending[i];
      const renderer = results[i];

      // If the renderer function is null, we skip defining this node.
      if (renderer === null) {
        console.warn(`skipped node ${node.type} ${node.id} - no renderer available`);

        // Evict stale FBO entry so the old render function is not reused
        this.fboNodes.delete(node.id);

        // Always destroy GPU resources when evicting from the map, regardless of canReuseFbo
        framebuffer.destroy();

        for (const texture of colorAttachments) {
          texture.destroy();
        }

        continue;
      }

      const nodeSize = this.resolveNodeSize(resolution);
      // Canvas/textmode nodes use output/2 for sharper previews (vs output/4 for GL nodes)
      const isCanvasNode = node.type === 'canvas' || node.type === 'textmode';
      const previewScaleFactor = isCanvasNode ? PREVIEW_SCALE_FACTOR / 2 : PREVIEW_SCALE_FACTOR;
      const fboNode: FBONode = {
        id: node.id,
        framebuffer,
        colorAttachments,
        texture: colorAttachments[0],
        render: renderer.render,
        cleanup: renderer.cleanup,
        dataFingerprint: fingerprint,
        nodeType: node.type,
        fboFormat,
        resolution,
        previewSize: capPreviewSize(
          Math.max(1, Math.floor(nodeSize[0] / previewScaleFactor)),
          Math.max(1, Math.floor(nodeSize[1] / previewScaleFactor))
        )
      };

      this.fboNodes.set(node.id, fboNode);

      // Do not send previews back to external texture nodes,
      // as the texture is managed by the node on the frontend.
      const defaultPreviewEnabled = !isExternalTextureNode(node.type);

      this.previewRenderer.setPreviewEnabled(node.id, defaultPreviewEnabled);
    }

    this.shouldProcessPreviews = this.previewRenderer.hasEnabledPreviews();

    // Phase 4 (sync): allocate previous-frame textures for feedback nodes.
    // Idempotent — skipped if the node already has prevTextures from a prior build.
    // One prev texture + framebuffer is allocated per color attachment so MRT
    // feedback nodes can provide previous-frame data for each outlet independently.
    for (const nodeId of renderGraph.feedbackNodes) {
      const fboNode = this.fboNodes.get(nodeId);
      if (!fboNode || fboNode.prevTextures) continue;

      // Match the format of the node's color attachments for feedback textures.
      // Read the format from the render graph node data.
      const feedbackNode = renderGraph.nodes.find((n) => n.id === nodeId);
      const feedbackData = feedbackNode?.data as Record<string, unknown> | undefined;
      const feedbackFormat: FBOFormat = (feedbackData?.fboFormat as FBOFormat) || 'rgba8';
      const feedbackResolution = feedbackData?.resolution as FBOResolution | undefined;

      const [feedbackTextureWidth, feedbackTextureHeight] =
        this.resolveNodeSize(feedbackResolution);

      fboNode.prevTextures = fboNode.colorAttachments.map(() =>
        this.createFboTexture(feedbackTextureWidth, feedbackTextureHeight, feedbackFormat)
      );

      fboNode.prevFramebuffers = fboNode.prevTextures.map((prevTexture) =>
        this.regl.framebuffer({
          color: prevTexture,
          depthStencil: false
        })
      );
    }
  }

  // Some nodes are externally managed, e.g. the texture will be uploaded on it.
  createEmptyRenderer() {
    return { render: () => {}, cleanup: () => {} };
  }

  /**
   * Apply virtual edges to nodes by updating their inputs, outputs, and inletMap.
   * This ensures virtual edges from send.vdo/recv.vdo are properly connected.
   */
  private applyVirtualEdgesToNodes(graph: RenderGraph): void {
    const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

    for (const edge of graph.edges) {
      // Skip if this edge was already processed (non-virtual edges are pre-processed)
      if (!edge.id.startsWith('virtual-video-')) continue;

      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);

      if (sourceNode && targetNode) {
        // Add to inputs/outputs if not already present
        if (!sourceNode.outputs.includes(edge.target)) {
          sourceNode.outputs.push(edge.target);
        }

        if (!targetNode.inputs.includes(edge.source)) {
          targetNode.inputs.push(edge.source);
        }

        // Parse inlet index from target handle (e.g., "video-in-0" -> 0)
        if (edge.targetHandle?.startsWith('video-in')) {
          const inletMatch = edge.targetHandle.match(/video-in-(\d+)/);

          if (inletMatch) {
            const inletIndex = parseInt(inletMatch[1], 10);

            // Virtual edges always come from outlet 0 of the source
            targetNode.inletMap.set(inletIndex, { sourceNodeId: edge.source, outletIndex: 0 });
          }
        }
      }
    }
  }

  /**
   * Create a passthrough renderer for video routing nodes (send.vdo, recv.vdo).
   * Copies input texture from inlet 0 to the output framebuffer.
   */
  createPassthroughRenderer(
    node: RenderNode,
    framebuffer: regl.Framebuffer2D
  ): { render: RenderFunction; cleanup: () => void } {
    const nodeId = node.id;

    return {
      render: () => {
        // Get input texture from inlet 0
        const inlet0 = node.inletMap.get(0);
        if (!inlet0) return;

        const sourceFbo = this.fboNodes.get(inlet0.sourceNodeId);
        if (!sourceFbo) return;

        // Blit input FBO to output framebuffer.
        // Source and destination may differ when the source uses @resolution.
        const srcW = sourceFbo.texture.width;
        const srcH = sourceFbo.texture.height;
        const dstFbo = this.fboNodes.get(node.id);
        const dstW = dstFbo?.texture.width ?? srcW;
        const dstH = dstFbo?.texture.height ?? srcH;
        const gl = this.gl;

        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, getFramebuffer(sourceFbo.framebuffer));
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, getFramebuffer(framebuffer));

        gl.blitFramebuffer(0, 0, srcW, srcH, 0, 0, dstW, dstH, gl.COLOR_BUFFER_BIT, gl.LINEAR);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      },
      cleanup: () => {
        // Unsubscribe from video channel when node is destroyed
        this.videoChannelRegistry.unsubscribeAll(nodeId);
      }
    };
  }

  async createHydraRenderer(
    node: RenderNode,
    framebuffer: regl.Framebuffer2D
  ): Promise<{ render: RenderFunction; cleanup: () => void } | null> {
    if (node.type !== 'hydra') return null;

    const existingRenderer = this.hydraByNode.get(node.id);

    // Reuse existing renderer when only code changed (preserves last frame on error).
    // Must recreate if video port counts changed since Hydra needs new sources/outputs.
    const canReuse =
      existingRenderer?.hydra &&
      existingRenderer.config.videoInletCount === (node.data.videoInletCount ?? 1) &&
      existingRenderer.config.videoOutletCount === (node.data.videoOutletCount ?? 1);

    if (canReuse) {
      existingRenderer.framebuffer = framebuffer;

      if (existingRenderer.config.code !== node.data.code) {
        existingRenderer.config.code = node.data.code;

        await existingRenderer.updateCode();
      }

      return {
        render: existingRenderer.renderFrame.bind(existingRenderer),
        cleanup: () => {
          existingRenderer.destroy();
          this.hydraByNode.delete(node.id);
        }
      };
    }

    // Full recreation needed (first run or video port count changed)
    const previousSynthTime = existingRenderer?.hydra?.synth.time;

    // Queue old renderer for deferred cleanup
    if (existingRenderer) {
      this.pendingHydraCleanup.push(existingRenderer);
      this.scheduleHydraCleanup();
    }

    const hydraRenderer = await HydraRenderer.create(
      {
        code: node.data.code,
        nodeId: node.id,
        videoInletCount: node.data.videoInletCount ?? 1,
        videoOutletCount: node.data.videoOutletCount ?? 1
      },
      framebuffer,
      this
    );

    // Restore synth time if we had a previous value
    if (previousSynthTime !== undefined && hydraRenderer.hydra) {
      hydraRenderer.hydra.synth.time = previousSynthTime;
    }

    this.hydraByNode.set(node.id, hydraRenderer);

    return {
      render: hydraRenderer.renderFrame.bind(hydraRenderer),
      cleanup: () => {
        hydraRenderer.destroy();
        this.hydraByNode.delete(node.id);
      }
    };
  }

  /** Schedule deferred cleanup of old Hydra renderers (runs once after delay) */
  private scheduleHydraCleanup() {
    // Don't schedule if already scheduled
    if (this.hydraCleanupTimer !== null) return;

    // Wait 500ms then clean up all pending renderers
    this.hydraCleanupTimer = setTimeout(() => {
      for (const renderer of this.pendingHydraCleanup) {
        renderer.destroy();
      }

      this.pendingHydraCleanup = [];
      this.hydraCleanupTimer = null;
    }, 500);
  }

  async createCanvasRenderer(
    node: RenderNode,
    framebuffer: regl.Framebuffer2D
  ): Promise<{ render: RenderFunction; cleanup: () => void } | null> {
    if (node.type !== 'canvas') return null;

    // Delete existing canvas renderer if it exists.
    if (this.canvasByNode.has(node.id)) {
      this.canvasByNode.get(node.id)?.destroy();
    }

    const canvasRenderer = await CanvasRenderer.create(
      { code: node.data.code, nodeId: node.id },
      framebuffer,
      this
    );

    this.canvasByNode.set(node.id, canvasRenderer);

    return {
      render: () => {},
      cleanup: () => {
        canvasRenderer.destroy();
        this.canvasByNode.delete(node.id);
      }
    };
  }

  async createTextmodeRenderer(
    node: RenderNode,
    framebuffer: regl.Framebuffer2D
  ): Promise<{ render: RenderFunction; cleanup: () => void } | null> {
    if (node.type !== 'textmode') return null;

    let textmodeRenderer: TextmodeRenderer | null = null;

    // 1. re-use existing textmode renderer if available
    if (this.textmodeByNode.has(node.id)) {
      const renderer = this.textmodeByNode.get(node.id)!;

      // Only reuse if there is a valid non-disposed renderer
      if (renderer.tm && renderer.textmode && !renderer.tm.isDisposed) {
        textmodeRenderer = renderer;

        // Update framebuffer reference (new one is created each buildFBOs call)
        textmodeRenderer.framebuffer = framebuffer;

        // If textmode user code has changed, we update the underlying code
        if (renderer.config.code !== node.data.code) {
          textmodeRenderer.config.code = node.data.code;
          textmodeRenderer.updateCode();
        }
      }
    }

    // 2. if there are no renderer to re-use, we create a new one!
    if (!textmodeRenderer) {
      textmodeRenderer = await TextmodeRenderer.create(
        { code: node.data.code, nodeId: node.id },
        framebuffer,
        this
      );

      this.textmodeByNode.set(node.id, textmodeRenderer);
    }

    if (!textmodeRenderer) return null;

    return {
      render: textmodeRenderer.renderFrame.bind(textmodeRenderer),

      // No-op cleanup - textmode renderers are expensive to create,
      // so we keep them alive and reuse them across graph rebuilds.
      // They are only destroyed when explicitly removed via destroyTextmodeRenderer().
      cleanup: () => {}
    };
  }

  async createThreeRenderer(
    node: RenderNode,
    framebuffer: regl.Framebuffer2D
  ): Promise<{ render: RenderFunction; cleanup: () => void } | null> {
    if (node.type !== 'three') return null;

    // Delete existing three renderer if it exists.
    if (this.threeByNode.has(node.id)) {
      this.threeByNode.get(node.id)?.destroy();
    }

    const threeRenderer = await ThreeRenderer.create(
      { code: node.data.code, nodeId: node.id },
      framebuffer,
      this
    );

    this.threeByNode.set(node.id, threeRenderer);

    return {
      render: threeRenderer.renderFrame.bind(threeRenderer),
      cleanup: () => {
        threeRenderer.destroy();
        this.threeByNode.delete(node.id);
      }
    };
  }

  async createReglRenderer(
    node: RenderNode,
    framebuffer: regl.Framebuffer2D
  ): Promise<{ render: RenderFunction; cleanup: () => void } | null> {
    if (node.type !== 'regl') return null;

    // Delete existing regl renderer if it exists.
    if (this.reglByNode.has(node.id)) {
      this.reglByNode.get(node.id)?.destroy();
    }

    const reglRenderer = await ReglRenderer.create(
      { code: node.data.code, nodeId: node.id },
      framebuffer,
      this
    );

    this.reglByNode.set(node.id, reglRenderer);

    return {
      render: reglRenderer.renderFrame.bind(reglRenderer),
      cleanup: () => {
        reglRenderer.destroy();

        this.reglByNode.delete(node.id);
      }
    };
  }

  async createProjMapRenderer(
    node: RenderNode,
    framebuffer: regl.Framebuffer2D
  ): Promise<{ render: RenderFunction; cleanup: () => void } | null> {
    if (node.type !== 'projmap') return null;

    if (this.projmapByNode.has(node.id)) {
      this.projmapByNode.get(node.id)?.destroy();
    }

    const projmapRenderer = await ProjectionMapRenderer.create(
      { nodeId: node.id, surfaces: node.data.surfaces ?? [] },
      framebuffer,
      this
    );

    this.projmapByNode.set(node.id, projmapRenderer);

    return {
      render: projmapRenderer.renderFrame.bind(projmapRenderer),
      cleanup: () => {
        projmapRenderer.destroy();

        this.projmapByNode.delete(node.id);
      }
    };
  }

  updateProjectionMap(nodeId: string, surfaces: import('$objects/projmap/types').ProjMapSurface[]) {
    this.projmapByNode.get(nodeId)?.updateSurfaces(surfaces);
  }

  /**
   * Explicitly destroy a textmode renderer when its node is removed from the graph.
   * Called from destroyNodes() for nodes that no longer exist.
   */
  destroyTextmodeRenderer(nodeId: string) {
    const renderer = this.textmodeByNode.get(nodeId);

    if (renderer) {
      renderer.destroy();
      this.textmodeByNode.delete(nodeId);
    }
  }

  async createGlslRenderer(
    node: RenderNode,
    framebuffer: regl.Framebuffer2D
  ): Promise<{ render: RenderFunction; cleanup: () => void } | null> {
    if (node.type !== 'glsl') return null;

    const nodeResolution = node.data.resolution;
    const [width, height] = this.resolveNodeSize(nodeResolution);

    // Prepare uniform defaults to prevent crashes.
    // Use saved uniformValues from node data when available, so that persisted
    // settings are applied immediately without waiting for setUniformData messages.
    if (node.data.glUniformDefs) {
      const uniformData = this.uniformDataByNode.get(node.id) ?? new Map();
      const savedValues = node.data.uniformValues as Record<string, unknown> | undefined;

      for (const def of node.data.glUniformDefs) {
        const uniformFieldValue = uniformData.get(def.name);

        if (!isValidUniformData(def, uniformFieldValue)) {
          const savedValue = savedValues?.[def.name];

          if (savedValue !== undefined) {
            uniformData.set(def.name, toGLValue(def, savedValue));
          } else {
            uniformData.set(def.name, defaultUniformValue(def));
          }
        }
      }

      this.uniformDataByNode.set(node.id, uniformData);
    }

    // Resolve #include directives before shader compilation
    let code = node.data.code;

    if (code && code.includes('#include')) {
      try {
        self.postMessage({ type: 'includeProcessing', nodeId: node.id, active: true });

        const resolver = createWorkerResolver(node.id);

        code = await processIncludes(code, resolver);
      } catch (error) {
        self.postMessage({
          type: 'shaderError',
          nodeId: node.id,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });

        return null;
      } finally {
        self.postMessage({ type: 'includeProcessing', nodeId: node.id, active: false });
      }
    }

    const renderCommand = createShaderToyDrawCommand({
      width,
      height,
      framebuffer,
      regl: this.regl,
      gl: this.gl!,
      code,
      mrtCount: node.data.mrtCount ?? 1,
      uniformDefs: node.data.glUniformDefs ?? [],
      onError: (error: Error & { lineErrors?: Record<number, string[]> }) => {
        // Send error message back to main thread
        self.postMessage({
          type: 'shaderError',
          nodeId: node.id,
          error: error.message,
          stack: error.stack,
          lineErrors: error.lineErrors
        });
      }
    });

    return {
      render: (params) => renderCommand?.(params),
      cleanup: () => {}
    };
  }

  async createSwglRenderer(
    node: RenderNode,
    framebuffer: regl.Framebuffer2D
  ): Promise<{ render: RenderFunction; cleanup: () => void } | null> {
    if (node.type !== 'swgl') return null;

    // Delete existing SwissGL renderer if it exists
    if (this.swglByNode.has(node.id)) {
      this.swglByNode.get(node.id)?.destroy();
    }

    const swglRenderer = await SwissGLRenderer.create(
      { code: node.data.code, nodeId: node.id },
      framebuffer,
      this
    );

    this.swglByNode.set(node.id, swglRenderer);

    return {
      render: swglRenderer.renderFrame.bind(swglRenderer),
      cleanup: () => {
        swglRenderer.destroy();
        this.swglByNode.delete(node.id);
      }
    };
  }

  destroyNodes(newNodeIds?: Set<string>) {
    for (const fboNode of this.fboNodes.values()) {
      fboNode.framebuffer.destroy();

      for (const texture of fboNode.colorAttachments) {
        texture.destroy();
      }

      fboNode.cleanup?.();
    }

    this.fboNodes.clear();
    this.cleanupExpensiveTextmodeRenderers(newNodeIds);
  }

  // Textmode.js is super expensive to setup.
  // We wanted to only clean them up if the node is destroyed.
  cleanupExpensiveTextmodeRenderers(newNodeIds?: Set<string>) {
    // Clean up textmode renderers for nodes that no longer exist in the new graph
    if (newNodeIds) {
      const existingTextmodeIds = Array.from(this.textmodeByNode.keys());

      // Collect IDs to delete first to avoid modifying map while iterating
      const nodeIdsToDelete = existingTextmodeIds.filter((id) => !newNodeIds.has(id));

      for (const nodeId of nodeIdsToDelete) {
        this.destroyTextmodeRenderer(nodeId);
      }
    }
  }

  setUniformData(nodeId: string, uniformName: string, uniformValue: number | boolean | number[]) {
    const renderNode = this.renderGraph?.nodes.find((n) => n.id === nodeId);

    // You cannot set uniform data for non-GLSL nodes yet.
    if (renderNode?.type !== 'glsl') {
      return;
    }

    const uniformDef = renderNode?.data.glUniformDefs.find((u) => u.name === uniformName);

    // Uniform does not exist in the node's uniform definitions.
    if (!uniformDef) {
      return;
    }

    // Sampler2D uniforms are handled separately as textures.
    if (uniformDef.type === 'sampler2D') {
      return;
    }

    // Float and int uniforms must be numbers.
    if (['float', 'int'].includes(uniformDef.type) && typeof uniformValue !== 'number') {
      return;
    }

    if (!this.uniformDataByNode.has(nodeId)) {
      this.uniformDataByNode.set(nodeId, new Map());
    }

    this.uniformDataByNode.get(nodeId)!.set(uniformName, uniformValue);
  }

  /**
   * Set transport time from main thread for synchronized timing.
   * Called at 60fps to keep GLSL/Hydra in sync with global transport.
   */
  setTransportTime(state: {
    seconds: number;
    ticks: number;
    bpm: number;
    isPlaying: boolean;
    beat: number;
    phase: number;
    bar: number;
    beatsPerBar: number;
    denominator: number;
    ppq: number;
  }) {
    this.transportTime = state;
  }

  setPreviewEnabled(nodeId: string, enabled: boolean) {
    this.previewRenderer.setPreviewEnabled(nodeId, enabled);
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
      this.canvasByNode.get(nodeId),
      this.hydraByNode.get(nodeId),
      this.textmodeByNode.get(nodeId),
      this.threeByNode.get(nodeId),
      this.swglByNode.get(nodeId)
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

  /** Set mouse data for a node (Shadertoy iMouse format) */
  setMouseData(nodeId: string, x: number, y: number, z: number, w: number) {
    this.mouseDataByNode.set(nodeId, [x, y, z, w]);
  }

  /** Get list of nodes with preview enabled */
  getEnabledPreviews(): string[] {
    return this.previewRenderer.getEnabledPreviews();
  }

  /** Render a single frame using the render graph */
  renderFrame(): void {
    if (!this.renderGraph || this.fboNodes.size === 0) {
      return;
    }

    // Update time for animation
    const currentTime = (Date.now() - this.startTime) / 1000; // Convert to seconds
    this.lastTime = currentTime;
    this.frameCount++;

    // Tick the clock scheduler with current transport state
    const clockState: ClockState = {
      time: this.transportTime?.seconds ?? this.lastTime,
      beat: this.transportTime?.beat ?? -1,
      bpm: this.transportTime?.bpm ?? 120
    };

    this.clockScheduler.tick(clockState);

    // Render each node in topological order
    for (const nodeId of this.renderGraph.sortedNodes) {
      if (!this.renderGraph) continue;

      const node = this.renderGraph.nodes.find((n) => n.id === nodeId);
      const fboNode = this.fboNodes.get(nodeId);

      if (!node || !fboNode) continue;

      this.renderFboNode(node, fboNode);
    }

    // Render the final result to the main canvas.
    // Use override if set and the node exists; otherwise fall back to bg.out.
    const isOverride = this.overrideOutputNodeId && this.fboNodes.has(this.overrideOutputNodeId);

    const effectiveOutputNodeId = isOverride ? this.overrideOutputNodeId : this.outputNodeId;

    // Override always uses attachment 0; bg.out respects the connected outlet index.
    const savedOutletIndex = this.outputOutletIndex;
    if (isOverride) this.outputOutletIndex = 0;

    if (effectiveOutputNodeId !== null) {
      const outputFBONode = this.fboNodes.get(effectiveOutputNodeId);

      if (outputFBONode) {
        this.profiler.measureOp('blit', () => this.renderNodeToMainOutput(outputFBONode));
      }
    }

    this.outputOutletIndex = savedOutletIndex;

    // Blit current frame into prevFramebuffer for all feedback nodes.
    //
    // We blit instead of swapping pointers because each renderer closes over
    // its framebuffer at creation time — swapping fboNode.framebuffer would
    // leave the render function pointing at the wrong buffer, causing every
    // other frame to read stale content (flickering). Blitting keeps
    // fboNode.framebuffer as the stable write target while prevTexture always
    // holds the previous frame's output for back-edge consumers.
    for (const nodeId of this.renderGraph.feedbackNodes) {
      const fboNode = this.fboNodes.get(nodeId);
      if (!fboNode?.prevFramebuffers?.length) continue;

      const width = fboNode.texture.width;
      const height = fboNode.texture.height;

      const gl = this.gl;
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, getFramebuffer(fboNode.framebuffer));

      for (let i = 0; i < fboNode.prevFramebuffers.length; i++) {
        gl.readBuffer(gl.COLOR_ATTACHMENT0 + i);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, getFramebuffer(fboNode.prevFramebuffers[i]));

        gl.blitFramebuffer(
          0,
          0,
          width,
          height,
          0,
          0,
          width,
          height,
          gl.COLOR_BUFFER_BIT,
          gl.NEAREST
        );
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    // Track previous transport time for iTimeDelta computation
    this.prevTransportTime = this.transportTime?.seconds ?? this.lastTime;
  }

  renderFboNode(node: RenderNode, fboNode: FBONode): void {
    // Check if the node is paused, skip rendering if it is
    if (this.isNodePaused(node.id)) {
      return;
    }

    const inputTextureMap = this.getInputTextureMap(node);

    let userUniformParams: unknown[] = [];

    // GLSL supports custom uniforms
    if (node.type === 'glsl') {
      const uniformDefs = node.data.glUniformDefs ?? [];
      const uniformData = this.uniformDataByNode.get(node.id) ?? new Map();

      // If this is a GLSL node with FFT inlet, use the FFT texture
      const fftInlet = this.fftInletsByGlslNode.get(node.id);

      let textureSlotIndex = 0;

      // Define input parameters
      for (const n of uniformDefs) {
        if (n.type === 'sampler2D') {
          // If FFT analysis is enabled.
          if (fftInlet?.uniformName === n.name) {
            const fftTex = this.fftTexturesByAnalyzer
              .get(fftInlet.analyzerNodeId)
              ?.get(fftInlet.analysisType);

            if (fftTex) {
              userUniformParams.push(fftTex);
              continue;
            }
          }

          // Use texture from specific inlet slot, fallback to default texture
          const texture = inputTextureMap.get(textureSlotIndex) ?? this.fallbackTexture;

          userUniformParams.push(texture);
          textureSlotIndex++;
        } else {
          const value = uniformData.get(n.name);

          if (value !== undefined && value !== null) {
            userUniformParams.push(value);
          } else {
            // Push a zero default so indices stay aligned with uniformDefs indices.
            // Without this, a missing uniform causes all subsequent params to shift.
            userUniformParams.push(defaultUniformValue(n));
          }
        }
      }
    }

    // Convert texture map to array.
    // Preserves gaps for unused video inlets.
    if (
      node.type === 'hydra' ||
      node.type === 'three' ||
      node.type === 'regl' ||
      node.type === 'swgl' ||
      node.type === 'projmap'
    ) {
      const maxInletIndex = Math.max(-1, ...inputTextureMap.keys());
      const textureArray: (regl.Texture2D | undefined)[] = [];

      for (let i = 0; i <= maxInletIndex; i++) {
        textureArray[i] = inputTextureMap.get(i);
      }

      userUniformParams = textureArray;
    }

    // Get mouse data for this node (defaults to [0, 0, 0, 0])
    const mouseData = this.mouseDataByNode.get(node.id) ?? [0, 0, 0, 0];

    // Render to FBO
    // Use transport time if available, otherwise fall back to local time
    const transportTime = this.transportTime?.seconds ?? this.lastTime;

    fboNode.framebuffer.use(() => {
      this.drawProfiler.measure(node.id, 'draw', () => {
        fboNode.render({
          prevTransportTime: this.prevTransportTime,
          iFrame: this.frameCount,
          mouseX: mouseData[0],
          mouseY: mouseData[1],
          mouseZ: mouseData[2],
          mouseW: mouseData[3],
          userParams: userUniformParams as UserParam[],
          transportTime
        });
      });
    });
  }

  /**
   * Render previews for enabled nodes and return ImageBitmaps directly.
   * Uses async PBO reads - returns bitmaps from *previous* frame's reads
   * while initiating new reads for the current frame.
   *
   * This introduces 1 frame of latency but eliminates GPU stalls (~3ms per read).
   */
  renderPreviewBitmaps(): Map<string, ImageBitmap> {
    return this.previewRenderer.renderPreviewBitmaps(this.fboNodes, this.isOutputEnabled);
  }

  /** Set which nodes are visible in the viewport for preview culling */
  setVisibleNodes(nodeIds: Set<string>) {
    this.previewRenderer.setVisibleNodes(nodeIds);
  }

  /** Globally enable/disable all previews */
  setAllPreviewsDisabled(disabled: boolean) {
    this.previewRenderer.setAllPreviewsDisabled(disabled);
  }

  /** Update preview LOD multiplier. Called only when LOD tier changes. */
  setPreviewScaleMultiplier(multiplier: number) {
    this.previewRenderer.setPreviewScaleMultiplier(multiplier);
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

  /** Record frame time (call this at end of each frame) */
  public recordFrameTime() {
    this.profiler.recordFrameTime();
  }

  /** Measure a function's execution time under the given render op. */
  public measureOp<T>(op: RenderOp, fn: () => T): T {
    return this.profiler.measureOp(op, fn);
  }

  private renderNodeToMainOutput(node: FBONode): void {
    // outputSize controls the offscreen canvas dimensions (blit destination).
    // backgroundSize is used only for the cover-mode aspect ratio crop.
    const [outputWidth, outputHeight] = this.outputSize;
    const [backgroundWidth, backgroundHeight] = this.backgroundSize;

    if (!this.isOutputEnabled) {
      return;
    }

    if (!node) {
      console.warn('Could not find source framebuffer for final texture');
      return;
    }

    const gl = this.regl._gl as WebGL2RenderingContext;

    let framebuffer: regl.Framebuffer2D | null = null;

    // Source size comes from the node's FBO (not the background)
    let sourceWidth = node.texture.width;
    let sourceHeight = node.texture.height;

    if (this.videoTextures.has(node.id)) {
      const tex = this.videoTextures.getDestinationTexture(node.id)!;

      // Use cached FBO instead of creating new one every frame (fixes massive leak)
      framebuffer = this.videoTextures.getDestinationFBO(node.id) || null;
      sourceWidth = tex.width;
      sourceHeight = tex.height;
    } else {
      framebuffer = node.framebuffer;
    }

    if (!framebuffer) {
      return;
    }

    gl.viewport(0, 0, outputWidth, outputHeight);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, getFramebuffer(framebuffer));
    gl.readBuffer(gl.COLOR_ATTACHMENT0 + this.outputOutletIndex);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

    // Cover-mode blit: crop the source to match the background's aspect ratio,
    // so the output fills the screen without stretching (spec 128).
    const sourceAspect = sourceWidth / sourceHeight;
    const backgroundAspect = backgroundWidth / backgroundHeight;

    let sourceX0 = 0;
    let sourceY0 = 0;
    let sourceX1 = sourceWidth;
    let sourceY1 = sourceHeight;

    if (sourceAspect > backgroundAspect) {
      // Source is wider — crop sides
      const cropWidth = sourceHeight * backgroundAspect;
      const offset = (sourceWidth - cropWidth) / 2;

      sourceX0 = Math.floor(offset);
      sourceX1 = Math.floor(offset + cropWidth);
    } else if (sourceAspect < backgroundAspect) {
      // Source is taller — crop top/bottom
      const cropHeight = sourceWidth / backgroundAspect;
      const offset = (sourceHeight - cropHeight) / 2;

      sourceY0 = Math.floor(offset);
      sourceY1 = Math.floor(offset + cropHeight);
    }

    gl.blitFramebuffer(
      sourceX0,
      sourceY0,
      sourceX1,
      sourceY1,
      0,
      0,
      outputWidth,
      outputHeight,
      gl.COLOR_BUFFER_BIT,
      gl.LINEAR
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  getOutputBitmap(): ImageBitmap | null {
    return this.offscreenCanvas.transferToImageBitmap();
  }

  /** Set the render FPS cap. 0 = unlimited (render every frame). */
  setRenderFpsCap(fps: number): void {
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

      this.renderFrame();
      onFrame?.();
    });
  }

  stopRenderLoop() {
    this.isAnimating = false;
  }

  /**
   * Get input texture mapping for a node based on the
   * render graph, mapped by inlet index
   **/
  private getInputTextureMap(node: RenderNode): Map<number, regl.Texture2D> {
    const textureMap = new Map<number, regl.Texture2D>();

    // Use inletMap for proper slot-based assignment
    for (const [inletIndex, { sourceNodeId, outletIndex }] of node.inletMap) {
      const inputFBO = this.fboNodes.get(sourceNodeId);

      // If there exists an external texture for an input node, use it (always outlet 0).
      if (this.videoTextures.has(sourceNodeId)) {
        textureMap.set(inletIndex, this.videoTextures.getDestinationTexture(sourceNodeId)!);
        continue;
      }

      if (inputFBO) {
        // For back-edge inlets (feedback loops), read from the previous frame's texture.
        // This implements the 1-frame delay that prevents the cycle from deadlocking.
        if (node.backEdgeInlets.has(inletIndex) && inputFBO.prevTextures?.length) {
          const prevTex = inputFBO.prevTextures[outletIndex] ?? inputFBO.prevTextures[0];
          textureMap.set(inletIndex, prevTex);
        } else {
          // Index into the correct color attachment for MRT sources
          const texture = inputFBO.colorAttachments[outletIndex] ?? inputFBO.colorAttachments[0];

          textureMap.set(inletIndex, texture);
        }
      }
    }

    return textureMap;
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
    for (const hydra of this.hydraByNode.values()) {
      hydra?.hydra?.setResolution(width, height);
    }

    // Rebuild FBOs at the new output dimensions
    if (this.renderGraph) {
      this.buildFBOs(this.renderGraph);
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
  }

  /**
   * Removes a persistent bitmap image.
   *
   * We should only call this from the frontend when the node is removed.
   * This is because we often reconstruct the render graph,
   * and we don't want to remove persistent textures when reconstructing.
   **/
  removeBitmap(nodeId: string) {
    this.videoTextures.removeBitmap(nodeId);
  }

  /**
   * Removes persistent uniform data for a node.
   *
   * We should only call this from the frontend when the node is removed.
   * This is because we often reconstruct the render graph,
   * and we don't want to remove persistent uniform data when reconstructing.
   **/
  removeUniformData(nodeId: string) {
    this.uniformDataByNode.delete(nodeId);
  }

  setFFTAsGlslUniforms(payload: AudioAnalysisPayloadWithType) {
    // TODO: support multiple inlets.
    // TODO: only send a single inlet in the payload, not all of them!
    const inlet = payload.inlets?.[0];
    if (!inlet) return;

    const { analyzerNodeId } = inlet;

    // Store the FFT inlet associated with a GLSL node.
    // TODO: support multiple inlets.
    // TODO: only do this once instead of on every single frame!!!
    this.fftInletsByGlslNode.set(payload.nodeId, inlet);

    if (!this.fftTexturesByAnalyzer.has(analyzerNodeId)) {
      this.fftTexturesByAnalyzer.set(analyzerNodeId, new Map());
    }

    const textureByAnalyzer = this.fftTexturesByAnalyzer.get(analyzerNodeId)!;
    const texture = textureByAnalyzer.get(payload.analysisType);

    const width = payload.array.length;
    const height = 1;

    const shouldCreateNewTexture = !texture || texture.height !== 1;

    // The existing texture is unsuitable for FFT. We must delete it.
    if (texture && shouldCreateNewTexture) {
      texture.destroy();
    }

    const texType = payload.format === 'int' ? 'uint8' : 'float';
    const texFormat = 'luminance';

    if (shouldCreateNewTexture) {
      const nextTexture = this.regl.texture({
        width,
        height,
        data: payload.array,
        format: texFormat,
        type: texType,
        wrapS: 'clamp',
        wrapT: 'clamp',
        min: 'nearest',
        mag: 'nearest'
      });

      textureByAnalyzer.set(payload.analysisType, nextTexture);

      return;
    }

    texture({
      width,
      height,
      data: payload.array,
      format: texFormat,
      type: texType
    });
  }

  /** Send message to nodes */
  sendMessageToNode(nodeId: string, message: Message) {
    const node = this.renderGraph?.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    match(node.type)
      .with('hydra', () => {
        const hydraRenderer = this.hydraByNode.get(nodeId);
        if (!hydraRenderer) return;

        hydraRenderer.handleMessage(message);
      })
      .with('canvas', () => {
        const canvasRenderer = this.canvasByNode.get(nodeId);
        if (!canvasRenderer) return;

        canvasRenderer.handleMessage(message);
      })
      .with('swgl', () => {
        const swglRenderer = this.swglByNode.get(nodeId);
        if (!swglRenderer) return;

        swglRenderer.handleMessage(message);
      })
      .with('textmode', () => {
        const textmodeRenderer = this.textmodeByNode.get(nodeId);
        if (!textmodeRenderer) return;

        textmodeRenderer.handleMessage(message);
      })
      .with('three', () => {
        const threeRenderer = this.threeByNode.get(nodeId);
        if (!threeRenderer) return;

        threeRenderer.handleMessage(message);
      })
      .with('regl', () => {
        const reglRenderer = this.reglByNode.get(nodeId);
        if (!reglRenderer) return;

        reglRenderer.handleMessage(message);
      })
      .with(P.union('glsl', 'img', 'bg.out', 'send.vdo', 'recv.vdo', 'projmap'), () => {})
      .exhaustive();
  }

  /** Route a channel message to the renderer for a given node. */
  sendChannelMessageToNode(nodeId: string, channel: string, data: unknown, sourceNodeId: string) {
    const node = this.renderGraph?.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    match(node.type)
      .with('hydra', () => {
        this.hydraByNode.get(nodeId)?.handleChannelMessage(channel, data, sourceNodeId);
      })
      .with('canvas', () => {
        this.canvasByNode.get(nodeId)?.handleChannelMessage(channel, data, sourceNodeId);
      })
      .with('textmode', () => {
        this.textmodeByNode.get(nodeId)?.handleChannelMessage(channel, data, sourceNodeId);
      })
      .with('three', () => {
        this.threeByNode.get(nodeId)?.handleChannelMessage(channel, data, sourceNodeId);
      })
      .with('regl', () => {
        this.reglByNode.get(nodeId)?.handleChannelMessage(channel, data, sourceNodeId);
      })
      .with('swgl', () => {
        this.swglByNode.get(nodeId)?.handleChannelMessage(channel, data, sourceNodeId);
      })
      .with(P.union('glsl', 'img', 'bg.out', 'send.vdo', 'recv.vdo', 'projmap'), () => {})
      .exhaustive();
  }

  registerSettingsProxy(nodeId: string, proxy: WorkerSettingsProxy) {
    this.settingsProxiesByNode.set(nodeId, proxy);
  }

  /**
   * Only removes the registry entry if it still points to the given proxy.
   * Prevents the deferred Hydra cleanup from clobbering a freshly-registered
   * proxy belonging to the new renderer instance for the same nodeId.
   */
  unregisterSettingsProxy(nodeId: string, proxy: WorkerSettingsProxy) {
    if (this.settingsProxiesByNode.get(nodeId) === proxy) {
      this.settingsProxiesByNode.delete(nodeId);
    }
  }

  private getSettingsProxy(nodeId: string): WorkerSettingsProxy | null {
    return this.settingsProxiesByNode.get(nodeId) ?? null;
  }

  receiveSettingsValues(nodeId: string, requestId: string, values: Record<string, unknown>) {
    this.getSettingsProxy(nodeId)?._receiveValuesInit(requestId, values);
  }

  receiveSettingsValueChanged(nodeId: string, key: string, value: unknown) {
    this.getSettingsProxy(nodeId)?._receiveValueChanged(key, value);
  }

  getFboNodeById(nodeId: string): FBONode | undefined {
    return this.fboNodes.get(nodeId);
  }

  /**
   * Captures a preview frame as an ImageBitmap (ready for zero-copy transfer).
   * Handles both FBO nodes and external texture nodes.
   * This is a synchronous capture for on-demand use (export, Gemini, etc.)
   */
  capturePreviewBitmap(nodeId: string, customSize?: [number, number]): ImageBitmap | null {
    const fboNode = this.fboNodes.get(nodeId);
    const defaultPreview: [number, number] = [
      Math.floor(DEFAULT_OUTPUT_SIZE[0] / PREVIEW_SCALE_FACTOR),
      Math.floor(DEFAULT_OUTPUT_SIZE[1] / PREVIEW_SCALE_FACTOR)
    ];
    const fallbackSize = customSize ?? fboNode?.previewSize ?? defaultPreview;

    const externalTexture = this.videoTextures.getDestinationTexture(nodeId);

    if (externalTexture) {
      // Use cached FBO to avoid creating/destroying on every capture
      const sourceFbo = this.videoTextures.getDestinationFBO(nodeId);

      if (sourceFbo) {
        const bitmap = this.captureRenderer.capturePreviewBitmapSync(
          sourceFbo,
          externalTexture.width,
          externalTexture.height,
          fallbackSize
        );

        return bitmap;
      }
    }

    if (!fboNode) return null;

    return this.captureRenderer.capturePreviewBitmapSync(
      fboNode.framebuffer,
      fboNode.texture.width,
      fboNode.texture.height,
      fallbackSize
    );
  }

  /**
   * Initiate async PBO reads for video frame capture.
   * Call harvestVideoFrames() in subsequent frames to get completed results.
   */
  initiateVideoFrameCaptureAsync(
    requests: Array<{
      targetNodeId: string;
      sourceNodeIds: (string | null)[];
      resolution?: [number, number];
    }>
  ): void {
    this.captureRenderer.initiateVideoFrameBatchAsync(
      requests,
      this.fboNodes,
      this.videoTextures.destinationTextures
    );
  }

  /**
   * Harvest completed async video frame captures.
   * Returns completed batches ready for transfer.
   */
  harvestVideoFrames(): Array<{
    targetNodeId: string;
    frames: (ImageBitmap | null)[];
    timestamp: number;
  }> {
    return this.captureRenderer.harvestVideoFrameBatches();
  }

  /**
   * Check if there are pending async video frame captures.
   */
  hasPendingVideoFrames(): boolean {
    return this.captureRenderer.hasPendingVideoFrames();
  }

  /** Update JS module in the worker's JSRunner instance */
  updateJSModule(moduleName: string, code: string | null) {
    if (code === null) {
      this.jsRunner.modules.delete(moduleName);
    } else {
      this.jsRunner.modules.set(moduleName, code);
    }
  }

  /**
   * Define global `time` getter for Hydra compatibility.
   * This allows `() => time` to work in Hydra code.
   */
  private defineWorkerGlobals() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const renderer: FBORenderer = this;

    Object.defineProperty(globalThis, 'time', {
      configurable: true,
      get() {
        return renderer.transportTime?.seconds ?? renderer.lastTime ?? 0;
      }
    });
  }

  /**
   * Create a worker-compatible clock object that reads from transportTime.
   * Use this in extraContext to override JSRunner's broken main-thread Transport-based clock.
   * Applies to: Hydra, Three.js, Canvas, Textmode renderers.
   *
   * Includes scheduling methods (onBeat, schedule, every, cancel, cancelAll) that
   * use frame-based polling precision (~16ms at 60fps).
   *
   * Also includes control methods (play, pause, stop, setBpm, etc.) that send
   * commands back to the main thread.
   */
  createWorkerClock() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const renderer: FBORenderer = this;
    const scheduler = this.clockScheduler;

    // Helper to send clock commands to main thread
    const send = (command: ClockCommandMessage['command']) =>
      self.postMessage({ type: 'clockCommand', command });

    return {
      // Read properties
      get time() {
        return renderer.transportTime?.seconds ?? renderer.lastTime ?? 0;
      },
      get ticks() {
        return renderer.transportTime?.ticks ?? 0;
      },
      get beat() {
        return renderer.transportTime?.beat ?? 0;
      },
      get phase() {
        return renderer.transportTime?.phase ?? 0;
      },
      get bpm() {
        return renderer.transportTime?.bpm ?? 120;
      },
      get bar() {
        return renderer.transportTime?.bar ?? 0;
      },
      get beatsPerBar() {
        return renderer.transportTime?.beatsPerBar ?? 4;
      },
      get denominator() {
        return renderer.transportTime?.denominator ?? 4;
      },

      // Subdivision helpers. Computed locally from ticks + ppq.
      subdiv(n: number) {
        const ticks = renderer.transportTime?.ticks ?? 0;
        const ppq = renderer.transportTime?.ppq ?? 192;
        const ticksPerSubdiv = ppq / n;

        return Math.floor((ticks % ppq) / ticksPerSubdiv);
      },
      subdivPhase(n: number) {
        const ticks = renderer.transportTime?.ticks ?? 0;
        const ppq = renderer.transportTime?.ppq ?? 192;
        const ticksPerSubdiv = ppq / n;

        return ((ticks % ppq) % ticksPerSubdiv) / ticksPerSubdiv;
      },

      // Control methods (send to main thread)
      play: () => send({ action: 'play' }),
      pause: () => send({ action: 'pause' }),
      stop: () => send({ action: 'stop' }),
      seek: (time: number) => send({ action: 'seek', value: time }),

      // Set BPM and time signature
      setBpm: (bpm: number) => send({ action: 'setBpm', value: bpm }),
      setTimeSignature: (numerator: number, denominator = 4) =>
        send({ action: 'setTimeSignature', numerator, denominator }),

      // Scheduling methods
      onBeat: scheduler.onBeat.bind(scheduler),
      schedule: scheduler.schedule.bind(scheduler),
      every: scheduler.every.bind(scheduler),
      cancel: scheduler.cancel.bind(scheduler),
      cancelAll: scheduler.cancelAll.bind(scheduler)
    };
  }
}
