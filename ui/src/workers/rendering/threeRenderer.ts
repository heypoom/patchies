import type regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import type { RenderParams } from '$lib/rendering/types';
import type { Message, MessageCallbackFn } from '$lib/messages/MessageSystem';
import type { AudioAnalysisPayloadWithType } from '$lib/audio/AudioAnalysisSystem';
import type { SendMessageOptions } from '$lib/messages/MessageContext';
import { FFTAnalysis } from '$lib/audio/FFTAnalysis';
import { parseJSError, countLines } from '$lib/js-runner/js-error-parser';
import { getFramebuffer } from './utils';
import { createWorkerGetVfsUrl } from './vfsWorkerUtils';
import { THREE_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';

type AudioAnalysisType = 'wave' | 'freq';
type AudioAnalysisFormat = 'int' | 'float';

type AudioAnalysisProps = {
  id?: string;
  type?: AudioAnalysisType;
  format?: AudioAnalysisFormat;
};

export interface ThreeConfig {
  code: string;
  nodeId: string;
}

export class ThreeRenderer {
  public config: ThreeConfig;
  public renderer: FBORenderer;

  public framebuffer: regl.Framebuffer2D | null = null;

  public onMessage: MessageCallbackFn = () => {};

  private sampleRate: number = 44000;
  private animationId: number | null = null;

  // FFT state tracking
  public isFFTEnabled = false;
  private fftRequestCache = new Map<string, boolean>();
  private fftDataCache = new Map<string, { data: Uint8Array | Float32Array; timestamp: number }>();

  // Three.js instances
  private THREE: typeof import('three') | null = null;
  private threeWebGLRenderer: import('three').WebGLRenderer | null = null;
  private renderTarget: import('three').WebGLRenderTarget | null = null;

  // User-defined render function
  private userRenderFunc: ((time: number) => void) | null = null;

  // Mouse state (updated each frame from RenderParams)
  private mouseX = 0;
  private mouseY = 0;

  // Video input textures (from connected nodes)
  private inputTextures: (regl.Texture2D | undefined)[] = [];

  // Three.js textures wrapping regl textures
  private threeInputTextures: import('three').Texture[] = [];

  private constructor(config: ThreeConfig, framebuffer: regl.Framebuffer2D, renderer: FBORenderer) {
    this.config = config;
    this.framebuffer = framebuffer;
    this.renderer = renderer;
  }

  static async create(
    config: ThreeConfig,
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer
  ): Promise<ThreeRenderer> {
    const instance = new ThreeRenderer(config, framebuffer, renderer);
    instance.THREE = await import('three');

    const [width, height] = instance.renderer.outputSize;

    try {
      // const _oc = new OffscreenCanvas(1, 1);

      const fakeCanvas = {
        addEventListener: () => {}
      };

      instance.threeWebGLRenderer = new instance.THREE.WebGLRenderer({
        // @ts-expect-error -- hack: use fake canvas
        canvas: fakeCanvas,
        context: renderer.gl!,
        antialias: true
      });

      instance.threeWebGLRenderer.setSize(width, height, false);

      // Create render target for Three.js to render into.
      // We'll blit from this to our regl FBO after each render.
      instance.renderTarget = new instance.THREE.WebGLRenderTarget(width, height, {
        format: instance.THREE.RGBAFormat,
        type: instance.THREE.UnsignedByteType
      });
    } catch (error) {
      console.error('error creating THREE', error);
    }

    await instance.updateCode();

    return instance;
  }

  renderFrame(params: RenderParams) {
    if (!this.threeWebGLRenderer || !this.renderTarget || !this.userRenderFunc) return;

    const gl = this.renderer.gl;
    if (!gl) return;

    // Update mouse state from render params
    this.mouseX = params.mouseX;
    this.mouseY = params.mouseY;

    // Store input textures for getTexture() access
    this.inputTextures = params.userParams as (regl.Texture2D | undefined)[];

    // Update Three.js textures from regl textures
    this.updateThreeTextures();

    // Render to Three.js's own render target
    this.threeWebGLRenderer.setRenderTarget(this.renderTarget);

    try {
      // Call user's render function with current time
      this.userRenderFunc(params.lastTime);
    } catch (error) {
      this.handleRuntimeError(error);
    }

    // Blit from Three.js render target to our regl FBO
    // This avoids sharing framebuffer references between Three.js and regl
    this.blitToReglFramebuffer();

    // Refresh both the Three.js and REGL internal state.
    // We are sharing the same WebGL context between Three.js and REGL.
    // Takes 0 - 1ms overall
    this.threeWebGLRenderer.resetState();
    this.renderer.regl._refresh();
  }

  /**
   * Blits the Three.js render target to our regl framebuffer.
   * Similar to how hydraRenderer copies its output to the regl FBO.
   */
  private blitToReglFramebuffer() {
    if (!this.threeWebGLRenderer || !this.renderTarget || !this.framebuffer) return;

    const gl = this.renderer.gl;
    if (!gl) return;

    const [width, height] = this.renderer.outputSize;

    // Get Three.js's internal WebGL framebuffer from the render target
    const threeProps = this.threeWebGLRenderer.properties.get(this.renderTarget);

    // @ts-expect-error -- accessing internal Three.js property
    const sourceFBO = threeProps.__webglFramebuffer as WebGLFramebuffer | undefined;
    if (!sourceFBO) return;

    const destFBO = getFramebuffer(this.framebuffer);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, destFBO);

    // Blit without Y-flip - Three.js output is already in correct orientation
    gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.LINEAR);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  public async updateCode() {
    if (!this.THREE || !this.threeWebGLRenderer || !this.renderTarget) return;

    this.isFFTEnabled = false;
    this.fftDataCache.clear();
    this.fftRequestCache.clear();

    // Reset interaction and video output state
    this.setInteraction('interact', true);
    this.setVideoOutputEnabled(true);

    // Cancel any existing animation frame
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    try {
      const [width, height] = this.renderer.outputSize;
      const THREE = this.THREE;
      const renderer = this.threeWebGLRenderer;
      const renderTarget = this.renderTarget;

      // Preprocess code for module support
      const processedCode = await this.renderer.jsRunner.preprocessCode(this.config.code, {
        nodeId: this.config.nodeId
      });

      if (processedCode === null) return;

      // Three.js wrapper code that extracts the draw function (same pattern as ThreeDom.svelte)
      const codeWithWrapper = `
				var recv = onMessage; // alias for onMessage
				var draw;

				${processedCode}

				return typeof draw === 'function' ? draw : null;
			`;

      // Three.js-specific extra context
      const extraContext = {
        THREE,
        renderer,
        renderTarget,
        width,
        height,

        // Mouse object with getters for real-time values
        mouse: this.createMouseObject(),

        // FFT function for audio analysis
        fft: this.createFFTFunction(),

        // VFS URL resolution (worker -> main thread -> object URL)
        getVfsUrl: createWorkerGetVfsUrl(this.config.nodeId),

        // Message passing
        onMessage: (callback: MessageCallbackFn) => {
          this.onMessage = callback;
        },

        send: this.sendMessage.bind(this),

        // Video inlet/outlet control
        setVideoCount: this.setVideoCount.bind(this),

        // Get texture from video inlet
        getTexture: this.getTexture.bind(this),

        noDrag: () => {
          this.setInteraction('drag', false);
        },

        noPan: () => {
          this.setInteraction('pan', false);
        },

        noWheel: () => {
          this.setInteraction('wheel', false);
        },

        noInteract: () => {
          this.setInteraction('interact', false);
        },

        noOutput: () => {
          this.setVideoOutputEnabled(false);
        },

        requestAnimationFrame: () => {}
      };

      // Execute using JSRunner with Three.js-specific extra context
      const userDraw = await this.renderer.jsRunner.executeJavaScript(
        this.config.nodeId,
        codeWithWrapper,
        {
          customConsole: this.createCustomConsole(),
          setPortCount: (inletCount?: number, outletCount?: number) => {
            this.setPortCount(inletCount, outletCount);
          },
          setTitle: this.setTitle.bind(this),
          setHidePorts: (hidePorts: boolean) =>
            self.postMessage({ type: 'setHidePorts', nodeId: this.config.nodeId, hidePorts }),
          extraContext
        }
      );

      this.userRenderFunc = typeof userDraw === 'function' ? userDraw : null;

      if (!this.userRenderFunc) {
        this.createCustomConsole().warn(
          'No draw() function found. Define a draw(time) function to render.'
        );
      }
    } catch (error) {
      this.handleCodeError(error);
    }
  }

  destroy() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Dispose Three.js resources
    this.renderTarget?.dispose();
    // Note: We don't dispose the renderer since it shares context with regl

    // Clean up JSRunner context for this node
    this.renderer.jsRunner.destroy(this.config.nodeId);

    this.threeWebGLRenderer = null;
    this.renderTarget = null;
    this.userRenderFunc = null;
  }

  sendMessage(data: unknown, options: SendMessageOptions) {
    self.postMessage({
      type: 'sendMessageFromNode',
      fromNodeId: this.config.nodeId,
      data,
      options
    });
  }

  createFFTFunction() {
    return (options: AudioAnalysisProps = {}) => {
      const { type = 'wave', format = 'int' } = options;
      const { nodeId } = this.config;

      const cacheKey = `${type}-${format}`;

      if (!this.isFFTEnabled) {
        self.postMessage({ type: 'fftEnabled', nodeId, enabled: true });
        this.isFFTEnabled = true;
      }

      if (!this.fftRequestCache.has(cacheKey)) {
        self.postMessage({
          type: 'registerFFTRequest',
          nodeId,
          analysisType: type,
          format
        });

        this.fftRequestCache.set(cacheKey, true);
      }

      const cached = this.fftDataCache.get(cacheKey);
      const bins = cached?.data ?? null;

      return new FFTAnalysis(bins, format, this.sampleRate);
    };
  }

  createMouseObject() {
    const getX = () => this.mouseX;
    const getY = () => this.mouseY;

    return {
      get x() {
        return getX();
      },

      get y() {
        return getY();
      }
    };
  }

  // Method to receive FFT data from main thread
  setFFTData(payload: AudioAnalysisPayloadWithType) {
    const { analysisType, format, array, sampleRate } = payload;

    const cacheKey = `${analysisType}-${format}`;
    this.sampleRate = sampleRate;

    this.fftDataCache.set(cacheKey, {
      data: array,
      timestamp: performance.now()
    });
  }

  setPortCount(inletCount = 1, outletCount = 0) {
    self.postMessage({
      type: 'setPortCount',
      portType: 'message',
      nodeId: this.config.nodeId,
      inletCount,
      outletCount
    });
  }

  setTitle(title: string) {
    self.postMessage({
      type: 'setTitle',
      nodeId: this.config.nodeId,
      title
    });
  }

  setInteraction(mode: 'drag' | 'pan' | 'wheel' | 'interact', enabled: boolean) {
    self.postMessage({
      type: 'setInteraction',
      nodeId: this.config.nodeId,
      mode,
      enabled
    });
  }

  setVideoOutputEnabled(videoOutputEnabled: boolean) {
    self.postMessage({
      type: 'setVideoOutputEnabled',
      nodeId: this.config.nodeId,
      videoOutputEnabled
    });
  }

  setVideoCount(inletCount = 1, outletCount = 1) {
    self.postMessage({
      type: 'setPortCount',
      portType: 'video',
      nodeId: this.config.nodeId,
      inletCount,
      outletCount
    });
  }

  /**
   * Updates Three.js textures to use regl's WebGL textures directly.
   * This avoids expensive readPixels by sharing the underlying WebGLTexture.
   */
  private updateThreeTextures() {
    if (!this.THREE || !this.threeWebGLRenderer) return;

    const [width, height] = this.renderer.outputSize;

    for (let i = 0; i < this.inputTextures.length; i++) {
      const reglTex = this.inputTextures[i];
      if (!reglTex) continue;

      // Create Three.js texture wrapper if it doesn't exist
      if (!this.threeInputTextures[i]) {
        // Create a minimal texture - we'll override its WebGL texture
        this.threeInputTextures[i] = new this.THREE.Texture();
        this.threeInputTextures[i].minFilter = this.THREE.LinearFilter;
        this.threeInputTextures[i].magFilter = this.THREE.LinearFilter;
      }

      const threeTex = this.threeInputTextures[i];

      // Get regl's internal WebGLTexture handle
      // @ts-expect-error -- accessing internal regl property
      const webglTexture = reglTex._texture?.texture as WebGLTexture | undefined;

      if (webglTexture) {
        // Directly assign the WebGL texture to Three.js's internal property
        // This avoids expensive readPixels calls
        const props = this.threeWebGLRenderer.properties.get(threeTex) as {
          __webglTexture?: WebGLTexture;
          __webglInit?: boolean;
        };
        props.__webglTexture = webglTexture;
        props.__webglInit = true;

        // Update texture dimensions for Three.js
        threeTex.image = { width, height };
        threeTex.needsUpdate = false; // Don't upload - we're using existing texture
      }
    }
  }

  /**
   * Gets a Three.js texture from a video inlet.
   * @param index The inlet index (0-based)
   * @returns A Three.js Texture or null if not connected
   */
  getTexture(index: number): import('three').Texture | null {
    return this.threeInputTextures[index] ?? null;
  }

  handleMessage(message: Message) {
    this.onMessage?.(message.data, message);
  }

  /**
   * Handles runtime errors during rendering (throttled to avoid flooding at high fps)
   */
  private lastRuntimeError: string | null = null;
  private lastRuntimeErrorTime = 0;
  private static readonly RUNTIME_ERROR_THROTTLE_MS = 1000;

  handleRuntimeError(error: unknown): void {
    const { nodeId, code } = this.config;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const now = performance.now();

    // Throttle: skip if same error was reported recently
    if (
      this.lastRuntimeError === errorMessage &&
      now - this.lastRuntimeErrorTime < ThreeRenderer.RUNTIME_ERROR_THROTTLE_MS
    ) {
      return;
    }

    this.lastRuntimeError = errorMessage;
    this.lastRuntimeErrorTime = now;

    const errorInfo = parseJSError(error, countLines(code), THREE_WRAPPER_OFFSET);

    self.postMessage({
      type: 'consoleOutput',
      nodeId,
      level: 'error',
      args: [`Runtime error: ${errorMessage}`],
      lineErrors: errorInfo?.lineErrors
    });
  }

  /**
   * Handles code execution errors with line number extraction for inline highlighting.
   */
  handleCodeError(error: unknown): void {
    const { nodeId, code } = this.config;
    const customConsole = this.createCustomConsole();

    const errorInfo = parseJSError(error, countLines(code), THREE_WRAPPER_OFFSET);

    if (errorInfo) {
      self.postMessage({
        type: 'consoleOutput',
        nodeId,
        level: 'error',
        args: [errorInfo.message],
        lineErrors: errorInfo.lineErrors
      });

      return;
    }

    // Fallback: no line info available
    const errorMessage = error instanceof Error ? error.message : String(error);
    customConsole.error(errorMessage);
  }

  /**
   * Creates a custom console object that routes output to VirtualConsole via the main thread.
   */
  createCustomConsole() {
    const { nodeId } = this.config;

    const sendLog = (level: 'log' | 'warn' | 'error', args: unknown[]) =>
      self.postMessage({ type: 'consoleOutput', nodeId, level, args });

    return {
      log: (...args: unknown[]) => sendLog('log', args),
      warn: (...args: unknown[]) => sendLog('warn', args),
      error: (...args: unknown[]) => sendLog('error', args),
      info: (...args: unknown[]) => sendLog('log', args),
      debug: (...args: unknown[]) => sendLog('log', args)
    };
  }
}
