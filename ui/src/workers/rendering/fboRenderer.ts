import regl from 'regl';
import { createShaderToyDrawCommand } from '../../lib/canvas/shadertoy-draw';
import type {
  RenderGraph,
  RenderNode,
  FBONode,
  RenderFunction,
  UserParam
} from '../../lib/rendering/types';
import { DEFAULT_OUTPUT_SIZE, WEBGL_EXTENSIONS, PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';
import { PixelReadbackService } from './PixelReadbackService';
import { PreviewRenderer } from './PreviewRenderer';
import { CaptureRenderer } from './CaptureRenderer';
import { match, P } from 'ts-pattern';
import { HydraRenderer } from './hydraRenderer';
import { CanvasRenderer } from './canvasRenderer';
import { TextmodeRenderer } from './textmodeRenderer';
import { ThreeRenderer } from './threeRenderer';
import { getFramebuffer } from './utils';
import { isExternalTextureNode, type SwissGLContext } from '$lib/canvas/node-types';
import type { Message, MessageCallbackFn } from '$lib/messages/MessageSystem';
import { SwissGL } from '$lib/rendering/swissgl';
import type {
  AudioAnalysisType,
  AudioAnalysisPayloadWithType,
  GlslFFTInletMeta
} from '$lib/audio/AudioAnalysisSystem.js';
import type { SendMessageOptions } from '$lib/messages/MessageContext';
import { JSRunner } from '../../lib/js-runner/JSRunner.js';
import { RenderingProfiler } from './RenderingProfiler.js';
import { VideoTextureManager } from './VideoTextureManager.js';
import { VideoChannelRegistry } from './VideoChannelRegistry.js';

export class FBORenderer {
  public outputSize = DEFAULT_OUTPUT_SIZE;

  public renderGraph: RenderGraph | null = null;
  public outputNodeId: string | null = null;

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
  public swglByNode = new Map<string, SwissGLContext>();

  /** Old Hydra renderers pending cleanup (deferred to avoid visual glitch) */
  private pendingHydraCleanup: HydraRenderer[] = [];
  private hydraCleanupTimer: ReturnType<typeof setInterval> | null = null;

  private fboNodes = new Map<string, FBONode>();
  private fallbackTexture: regl.Texture2D;
  private lastTime: number = 0;
  private frameCount: number = 0;

  /** Profiler for frame timing and regl.read() metrics */
  public profiler = new RenderingProfiler();
  private startTime: number = Date.now();
  private frameCancellable: regl.Cancellable | null = null;
  public jsRunner = JSRunner.getInstance();

  /** Shared pixel readback infrastructure */
  public pixelReadbackService: PixelReadbackService;

  /** Preview renderer with async PBO reads */
  public previewRenderer: PreviewRenderer;

  /** Capture renderer for video frames and sync captures */
  public captureRenderer: CaptureRenderer;

  /** Video channel registry for send.vdo/recv.vdo wireless routing */
  public videoChannelRegistry = VideoChannelRegistry.getInstance();

  /** Reusable passthrough draw command for video routing nodes */
  private passthroughDraw: regl.DrawCommand | null = null;

  constructor() {
    const [width, height] = this.outputSize;

    this.offscreenCanvas = new OffscreenCanvas(width, height);
    this.gl = this.offscreenCanvas.getContext('webgl2', { antialias: false })!;
    this.regl = regl({ gl: this.gl, extensions: WEBGL_EXTENSIONS });

    this.fallbackTexture = this.regl.texture({
      width: 1,
      height: 1,
      data: new Uint8Array([0, 0, 0, 0])
    });

    // Calculate preview size from output size
    const previewSize: [number, number] = [
      Math.floor(this.outputSize[0] / PREVIEW_SCALE_FACTOR),
      Math.floor(this.outputSize[1] / PREVIEW_SCALE_FACTOR)
    ];

    // Create shared pixel readback service
    this.pixelReadbackService = new PixelReadbackService(
      this.gl,
      this.regl,
      this.profiler,
      this.outputSize,
      previewSize
    );

    // Create renderers that use the shared service
    this.previewRenderer = new PreviewRenderer(this.pixelReadbackService);
    this.captureRenderer = new CaptureRenderer(this.pixelReadbackService);

    // Create video texture manager
    this.videoTextures = new VideoTextureManager(this.regl, this.gl);

    // Create passthrough draw command for video routing nodes
    this.passthroughDraw = this.regl({
      vert: `
        precision mediump float;
        attribute vec2 position;
        varying vec2 uv;
        void main() {
          uv = position * 0.5 + 0.5;
          gl_Position = vec4(position, 0, 1);
        }
      `,
      frag: `
        precision mediump float;
        varying vec2 uv;
        uniform sampler2D inputTexture;
        void main() {
          gl_FragColor = texture2D(inputTexture, uv);
        }
      `,
      attributes: {
        position: [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]
      },
      uniforms: {
        inputTexture: this.regl.prop<{ inputTexture: regl.Texture2D }, 'inputTexture'>(
          'inputTexture'
        )
      },
      count: 6,
      framebuffer: this.regl.prop<{ framebuffer: regl.Framebuffer2D }, 'framebuffer'>('framebuffer')
    });
  }

  /** Build FBOs for all nodes in the render graph */
  async buildFBOs(renderGraph: RenderGraph) {
    const [width, height] = this.outputSize;

    // Get the set of node IDs that will exist in the new graph
    const newNodeIds = new Set(renderGraph.nodes.map((n) => n.id));

    // Only destroy FBOs for nodes that no longer exist in the new graph.
    // This prevents the black flash on Chrome when rebuilding the graph,
    // since existing FBOs retain their content until overwritten.
    for (const [nodeId, fboNode] of this.fboNodes) {
      if (!newNodeIds.has(nodeId)) {
        fboNode.framebuffer.destroy();
        fboNode.texture.destroy();
        fboNode.cleanup?.();
        this.fboNodes.delete(nodeId);

        // Unsubscribe removed nodes from video channels
        this.videoChannelRegistry.unsubscribeAll(nodeId);
      }
    }

    this.cleanupExpensiveTextmodeRenderers(newNodeIds);

    // Register send.vdo/recv.vdo nodes with video channel registry
    for (const node of renderGraph.nodes) {
      if (node.type === 'send.vdo') {
        this.videoChannelRegistry.subscribe(node.data.channel, node.id, 'send');
      } else if (node.type === 'recv.vdo') {
        this.videoChannelRegistry.subscribe(node.data.channel, node.id, 'recv');
      }
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

    for (const node of renderGraph.nodes) {
      // Check if we can reuse an existing FBO for this node.
      // Reuse if available and size matches (size may change on resize).
      const existingFbo = this.fboNodes.get(node.id);

      const canReuseFbo =
        existingFbo && existingFbo.texture.width === width && existingFbo.texture.height === height;

      let texture: regl.Texture2D;
      let framebuffer: regl.Framebuffer2D;

      if (canReuseFbo) {
        // Reuse existing FBO - preserves content, prevents flash
        texture = existingFbo.texture;
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
        // Destroy old FBO if it exists but size doesn't match
        if (existingFbo) {
          // For Hydra: skip cleanup (will be GC'd after createHydraRenderer reads synth time)
          const isHydraNode = this.hydraByNode.has(node.id);
          if (!isHydraNode) {
            existingFbo.cleanup?.();
          }

          existingFbo.framebuffer.destroy();
          existingFbo.texture.destroy();
          this.fboNodes.delete(node.id);
        }

        // Create new FBO
        texture = this.regl.texture({
          width,
          height,
          wrapS: 'clamp',
          wrapT: 'clamp'
        });

        framebuffer = this.regl.framebuffer({
          color: texture,
          depthStencil: false
        });
      }

      const renderer = await match(node)
        .with({ type: 'glsl' }, (node) => this.createGlslRenderer(node, framebuffer))
        .with({ type: 'hydra' }, (node) => this.createHydraRenderer(node, framebuffer))
        .with({ type: 'swgl' }, (node) => this.createSwglRenderer(node, framebuffer))
        .with({ type: 'canvas' }, (node) => this.createCanvasRenderer(node, framebuffer))
        .with({ type: 'textmode' }, (node) => this.createTextmodeRenderer(node, framebuffer))
        .with({ type: 'three' }, (node) => this.createThreeRenderer(node, framebuffer))
        .with({ type: 'img' }, () => this.createEmptyRenderer())
        .with({ type: 'bg.out' }, () => this.createEmptyRenderer())
        .with({ type: 'send.vdo' }, (node) => this.createPassthroughRenderer(node, framebuffer))
        .with({ type: 'recv.vdo' }, (node) => this.createPassthroughRenderer(node, framebuffer))
        .exhaustive();

      // If the renderer function is null, we skip defining this node.
      if (renderer === null) {
        console.warn(`skipped node ${node.type} ${node.id} - no renderer available`);

        if (!canReuseFbo) {
          framebuffer.destroy();
          texture.destroy();
        }

        continue;
      }

      const fboNode: FBONode = {
        id: node.id,
        framebuffer,
        texture,
        render: renderer.render,
        cleanup: renderer.cleanup
      };

      this.fboNodes.set(node.id, fboNode);

      // Do not send previews back to external texture nodes,
      // as the texture is managed by the node on the frontend.
      const defaultPreviewEnabled = !isExternalTextureNode(node.type);
      this.previewRenderer.setPreviewEnabled(node.id, defaultPreviewEnabled);
    }

    this.shouldProcessPreviews = this.previewRenderer.hasEnabledPreviews();
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
            targetNode.inletMap.set(inletIndex, edge.source);
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
        const sourceNodeId = node.inletMap.get(0);
        if (!sourceNodeId) return;

        const sourceFbo = this.fboNodes.get(sourceNodeId);
        if (!sourceFbo) return;

        // Blit input texture to output framebuffer
        this.passthroughDraw?.({
          inputTexture: sourceFbo.texture,
          framebuffer
        });
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

    // Get synth time from old renderer (still alive since we skip cleanup for Hydra)
    const oldRenderer = this.hydraByNode.get(node.id);
    const previousSynthTime = oldRenderer?.hydra?.synth.time;

    // Queue old renderer for deferred cleanup (runs on timer, not every frame)
    if (oldRenderer) {
      this.pendingHydraCleanup.push(oldRenderer);
      this.scheduleHydraCleanup();
    }

    const hydraRenderer = await HydraRenderer.create(
      { code: node.data.code, nodeId: node.id },
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

        // Force recreate draw command with new framebuffer
        textmodeRenderer.resetDrawCommand();

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

    return {
      render: () => {
        textmodeRenderer.render();
      },
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

  createGlslRenderer(
    node: RenderNode,
    framebuffer: regl.Framebuffer2D
  ): { render: RenderFunction; cleanup: () => void } | null {
    if (node.type !== 'glsl') return null;

    const [width, height] = this.outputSize;

    // Prepare uniform defaults to prevent crashes
    if (node.data.glUniformDefs) {
      const uniformData = this.uniformDataByNode.get(node.id) ?? new Map();

      for (const def of node.data.glUniformDefs) {
        const currentUniformData = uniformData.get(def.name);

        const isValidData = match(def.type)
          .with('bool', () => typeof currentUniformData === 'boolean')
          .with('float', () => typeof currentUniformData === 'number')
          .with('int', () => typeof currentUniformData === 'number')
          .with('vec2', () => Array.isArray(currentUniformData) && currentUniformData.length === 2)
          .with('vec3', () => Array.isArray(currentUniformData) && currentUniformData.length === 3)
          .with('vec4', () => Array.isArray(currentUniformData) && currentUniformData.length === 4)
          .with('sampler2D', () => currentUniformData === null)
          .otherwise(() => false);

        if (!isValidData) {
          const defaultUniformValue = match(def.type)
            .with('bool', () => true)
            .with('float', () => 0.0)
            .with('int', () => 0)
            .with('vec2', () => [0, 0])
            .with('vec3', () => [0, 0, 0])
            .with('vec4', () => [0, 0, 0, 0])
            .with('sampler2D', () => null)
            .otherwise(() => null);

          uniformData.set(def.name, defaultUniformValue);
        }
      }

      this.uniformDataByNode.set(node.id, uniformData);
    }

    const renderCommand = createShaderToyDrawCommand({
      width,
      height,
      framebuffer,
      regl: this.regl,
      gl: this.gl!,
      code: node.data.code,
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

  createSwglRenderer(
    node: RenderNode,
    framebuffer: regl.Framebuffer2D
  ): { render: RenderFunction; cleanup: () => void } | null {
    if (node.type !== 'swgl') return null;

    const [width, height] = this.outputSize;

    // Delete existing SwissGL renderer if it exists
    if (this.swglByNode.has(node.id)) {
      const existingSwgl = this.swglByNode.get(node.id);
      existingSwgl?.glsl.reset();
    }

    const gl = this.regl._gl as WebGL2RenderingContext;
    const glsl = SwissGL(gl);

    const destinationFramebuffer = getFramebuffer(framebuffer);

    const swglTarget = {
      bindTarget: (gl: WebGL2RenderingContext) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, destinationFramebuffer);
        return [width, height];
      }
    };

    // Create SwissGL context with message passing support
    const swglContext: SwissGLContext = {
      glsl,
      userRenderFunc: null,
      swglTarget,
      gl,
      onMessage: () => {},
      nodeId: node.id
    };

    // Parse user's render function from code
    let userRenderFunc: ((params: { t: number }) => void) | null = null;

    try {
      const wrappedGlsl = (shaderConfig: unknown, targetConfig: Record<string, unknown> = {}) =>
        glsl(shaderConfig, { ...targetConfig, ...swglTarget });

      // Create context with message passing functions
      const context = {
        glsl: wrappedGlsl,

        onMessage: (callback: MessageCallbackFn) => {
          swglContext.onMessage = callback;
        },

        send: (data: unknown, options: SendMessageOptions) => {
          self.postMessage({
            type: 'sendMessageFromNode',
            fromNodeId: node.id,
            data,
            options
          });
        }
      };

      const funcBody = `
				with (arguments[0]) {
					var recv = onMessage; // alias for onMessage

					${node.data.code}
				}

				return render;
			`;

      userRenderFunc = new Function(funcBody)(context);
    } catch (error) {
      console.error('Failed to parse SwissGL user code:', error);
      return null;
    }

    swglContext.userRenderFunc = userRenderFunc;
    this.swglByNode.set(node.id, swglContext);

    return {
      render: (params) => {
        if (!userRenderFunc) return;

        framebuffer.use(() => {
          try {
            userRenderFunc({ t: params.lastTime });
          } catch (error) {
            console.error('SwissGL render error:', error);
          }
        });
      },
      cleanup: () => {
        const swglContext = this.swglByNode.get(node.id);
        swglContext?.glsl?.reset();

        this.swglByNode.delete(node.id);
      }
    };
  }

  destroyNodes(newNodeIds?: Set<string>) {
    for (const fboNode of this.fboNodes.values()) {
      fboNode.framebuffer.destroy();
      fboNode.texture.destroy();
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

  setPreviewEnabled(nodeId: string, enabled: boolean) {
    this.previewRenderer.setPreviewEnabled(nodeId, enabled);
    this.shouldProcessPreviews = this.previewRenderer.hasEnabledPreviews();
  }

  /** Toggle pause state for a node */
  toggleNodePause(nodeId: string) {
    const currentState = this.nodePausedMap.get(nodeId) ?? false;
    this.nodePausedMap.set(nodeId, !currentState);
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

    // Render each node in topological order
    for (const nodeId of this.renderGraph.sortedNodes) {
      if (!this.renderGraph) continue;

      const node = this.renderGraph.nodes.find((n) => n.id === nodeId);
      const fboNode = this.fboNodes.get(nodeId);

      if (!node || !fboNode) continue;

      this.renderFboNode(node, fboNode);
    }

    // Render the final result to the main canvas
    // Use the node that is connected to bg.out in the graph
    if (this.outputNodeId !== null) {
      const outputFBONode = this.fboNodes.get(this.outputNodeId);

      if (outputFBONode) {
        this.renderNodeToMainOutput(outputFBONode);
      }
    }
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
          }
        }
      }
    }

    // Convert texture map to array for Hydra and Three
    // Preserves gaps for unused video inlets.
    if (node.type === 'hydra' || node.type === 'three') {
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
    fboNode.framebuffer.use(() => {
      fboNode.render({
        lastTime: this.lastTime,
        iFrame: this.frameCount,
        mouseX: mouseData[0],
        mouseY: mouseData[1],
        mouseZ: mouseData[2],
        mouseW: mouseData[3],
        userParams: userUniformParams as UserParam[]
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
    return this.previewRenderer.renderPreviewBitmaps(
      this.fboNodes,
      this.isOutputEnabled,
      (nodeId) => (this.canvasByNode.has(nodeId) ? this.canvasOutputSize : undefined)
    );
  }

  // HACK: use a different preview size for canvas nodes
  // this is to make the canvas preview looks sharper
  get canvasOutputSize(): [number, number] {
    return [this.outputSize[0] / 2, this.outputSize[1] / 2];
  }

  /** Set which nodes are visible in the viewport for preview culling */
  setVisibleNodes(nodeIds: Set<string>) {
    this.previewRenderer.setVisibleNodes(nodeIds);
  }

  /** Enable/disable frame profiling */
  public setProfilingEnabled(enabled: boolean) {
    this.profiler.setEnabled(enabled);
  }

  /** Record frame time (call this at end of each frame) */
  public recordFrameTime() {
    this.profiler.recordFrameTime();
  }

  /** Get frame timing stats and clear buffer */
  public flushFrameStats() {
    return this.profiler.flushStats();
  }

  private renderNodeToMainOutput(node: FBONode): void {
    const [renderWidth, renderHeight] = this.outputSize;

    if (!this.isOutputEnabled) {
      return;
    }

    if (!node) {
      console.warn('Could not find source framebuffer for final texture');
      return;
    }

    const gl = this.regl._gl as WebGL2RenderingContext;
    let framebuffer: regl.Framebuffer2D | null = null;

    let sourceWidth = renderWidth;
    let sourceHeight = renderHeight;

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

    gl.viewport(0, 0, renderWidth, renderHeight);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, getFramebuffer(framebuffer));
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

    gl.blitFramebuffer(
      0,
      0,
      sourceWidth,
      sourceHeight,
      0,
      0,
      renderWidth,
      renderHeight,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  getOutputBitmap(): ImageBitmap | null {
    return this.offscreenCanvas.transferToImageBitmap();
  }

  startRenderLoop(onFrame?: () => void) {
    this.stopRenderLoop();
    this.isAnimating = true;

    this.frameCancellable = this.regl.frame(() => {
      if (!this.isAnimating) {
        this.frameCancellable?.cancel();
        return;
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
    for (const [inletIndex, sourceNodeId] of node.inletMap) {
      const inputFBO = this.fboNodes.get(sourceNodeId);

      // If there exists an external texture for an input node, use it.
      if (this.videoTextures.has(sourceNodeId)) {
        textureMap.set(inletIndex, this.videoTextures.getDestinationTexture(sourceNodeId)!);
        continue;
      }

      if (inputFBO) {
        textureMap.set(inletIndex, inputFBO.texture);
      }
    }

    return textureMap;
  }

  async setPreviewSize(width: number, height: number) {
    this.pixelReadbackService.setPreviewSize(width, height);
    await this.buildFBOs(this.renderGraph!);
  }

  setOutputSize(width: number, height: number) {
    this.outputSize = [width, height] as [w: number, h: number];

    // Update all hydra renderers to match the new output size
    for (const hydra of this.hydraByNode.values()) {
      hydra?.hydra?.setResolution(width, height);
    }

    this.offscreenCanvas.width = width;
    this.offscreenCanvas.height = height;

    // Update pixel readback service's output size reference
    this.pixelReadbackService.setOutputSize(this.outputSize);
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

    const data = message['data'];

    match(node.type)
      .with('hydra', () => {
        const hydraRenderer = this.hydraByNode.get(nodeId);
        if (!hydraRenderer) return;

        hydraRenderer.onMessage(data, message);
      })
      .with('canvas', () => {
        const canvasRenderer = this.canvasByNode.get(nodeId);
        if (!canvasRenderer) return;

        canvasRenderer.handleMessage(message);
      })
      .with('swgl', () => {
        const swglContext = this.swglByNode.get(nodeId);
        if (!swglContext) return;

        swglContext.onMessage(data, message);
      })
      .with('textmode', () => {
        const textmodeRenderer = this.textmodeByNode.get(nodeId);
        if (!textmodeRenderer) return;

        textmodeRenderer.onMessage(data, message);
      })
      .with('three', () => {
        const threeRenderer = this.threeByNode.get(nodeId);
        if (!threeRenderer) return;

        threeRenderer.handleMessage(message);
      })
      .with(P.union('glsl', 'img', 'bg.out'), () => {})
      .exhaustive();
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
    const externalTexture = this.videoTextures.getDestinationTexture(nodeId);
    if (externalTexture) {
      // Use cached FBO to avoid creating/destroying on every capture
      const sourceFbo = this.videoTextures.getDestinationFBO(nodeId);
      if (sourceFbo) {
        const bitmap = this.captureRenderer.capturePreviewBitmapSync(
          sourceFbo,
          externalTexture.width,
          externalTexture.height,
          customSize
        );
        return bitmap;
      }
    }

    const fboNode = this.fboNodes.get(nodeId);
    if (!fboNode) return null;

    const [sourceWidth, sourceHeight] = this.outputSize;
    return this.captureRenderer.capturePreviewBitmapSync(
      fboNode.framebuffer,
      sourceWidth,
      sourceHeight,
      customSize
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
}
