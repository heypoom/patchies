import type regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import type { RenderParams } from '$lib/rendering/types';
import type { Message } from '$lib/messages/MessageSystem';
import type { AudioAnalysisPayloadWithType } from '$lib/audio/AudioAnalysisSystem';
import type { SendMessageOptions } from '$lib/messages/MessageContext';
import { FFTAnalysis } from '$lib/audio/FFTAnalysis';
import { parseJSError, countLines } from '$lib/js-runner/js-error-parser';
import { createWorkerGetVfsUrl } from './vfsWorkerUtils';
import { REGL_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
import { createWorkerSettingsProxy, type WorkerSettingsProxy } from '../shared/workerSettingsProxy';
import { WorkerRendererMessageContext } from './WorkerRendererMessageContext';

type AudioAnalysisType = 'wave' | 'freq';
type AudioAnalysisFormat = 'int' | 'float';

type AudioAnalysisProps = {
  id?: string;
  type?: AudioAnalysisType;
  format?: AudioAnalysisFormat;
};

export interface ReglConfig {
  code: string;
  nodeId: string;
}

/**
 * Creates a tracked wrapper around regl that auto-cleans allocated resources.
 * Intercepts buffer/texture/elements/framebuffer/renderbuffer creation and
 * draw command creation to track them for bulk cleanup.
 *
 * Also intercepts regl.clear() to auto-inject the output framebuffer when
 * the user omits it, preventing accidental main canvas clears.
 */
function createTrackedRegl(
  reglInstance: regl.Regl,
  getFramebuffer: () => regl.Framebuffer2D | null
) {
  const tracked: Array<{ destroy(): void }> = [];

  const proxy = new Proxy(reglInstance, {
    apply(target, thisArg, args) {
      // regl({...}) creates a draw command
      const cmd = Reflect.apply(target, thisArg, args);
      tracked.push(cmd);
      return cmd;
    },
    get(target, prop) {
      const val = Reflect.get(target, prop);

      // Intercept resource creation methods
      if (
        prop === 'buffer' ||
        prop === 'texture' ||
        prop === 'elements' ||
        prop === 'framebuffer' ||
        prop === 'renderbuffer'
      ) {
        return (...args: unknown[]) => {
          const resource = (val as Function).apply(target, args);
          tracked.push(resource);
          return resource;
        };
      }

      // Intercept clear() to auto-inject framebuffer without mutating caller's object
      if (prop === 'clear') {
        return (opts: Record<string, unknown>) => {
          if (opts && !('framebuffer' in opts)) {
            const fb = getFramebuffer();
            if (fb) {
              return (val as Function).call(target, { ...opts, framebuffer: fb });
            }
          }
          return (val as Function).call(target, opts);
        };
      }

      return val;
    }
  });

  return {
    regl: proxy as regl.Regl,
    destroyAll() {
      for (const r of tracked) {
        try {
          r.destroy();
        } catch {
          // Resource may already be destroyed
        }
      }
      tracked.length = 0;
    }
  };
}

export class ReglRenderer {
  public config: ReglConfig;
  public renderer: FBORenderer;

  public framebuffer: regl.Framebuffer2D | null = null;

  private msgContext!: WorkerRendererMessageContext;
  public settingsProxy: WorkerSettingsProxy | null = null;

  private sampleRate: number = 44000;

  // FFT state tracking
  public isFFTEnabled = false;
  private fftRequestCache = new Map<string, boolean>();
  private fftDataCache = new Map<string, { data: Uint8Array | Float32Array; timestamp: number }>();

  // User's render function
  private userRenderFunc: ((time: number) => void) | null = null;

  // Mouse state (updated each frame from RenderParams)
  private mouseX = 0;
  private mouseY = 0;

  // Video input textures (from connected nodes)
  private inputTextures: (regl.Texture2D | undefined)[] = [];

  // Tracked regl wrapper for automatic resource cleanup
  private trackedRegl: ReturnType<typeof createTrackedRegl> | null = null;

  /** 1x1 transparent texture returned when an inlet is not connected */
  private fallbackTexture: regl.Texture2D;

  private constructor(config: ReglConfig, framebuffer: regl.Framebuffer2D, renderer: FBORenderer) {
    this.config = config;
    this.framebuffer = framebuffer;
    this.renderer = renderer;
    this.msgContext = new WorkerRendererMessageContext(config.nodeId);
    this.fallbackTexture = renderer.regl.texture({
      width: 1,
      height: 1,
      data: new Uint8Array([0, 0, 0, 0])
    });
  }

  static async create(
    config: ReglConfig,
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer
  ): Promise<ReglRenderer> {
    const instance = new ReglRenderer(config, framebuffer, renderer);
    await instance.updateCode();
    return instance;
  }

  renderFrame(params: RenderParams) {
    if (!this.userRenderFunc) return;

    // Skip rendering when transport is paused — FBO retains last frame
    if (this.renderer.transportTime && !this.renderer.transportTime.isPlaying) return;

    // Update mouse state from render params
    this.mouseX = params.mouseX;
    this.mouseY = params.mouseY;

    // Store input textures for getTexture() access
    this.inputTextures = params.userParams as (regl.Texture2D | undefined)[];

    // FBO is already bound by the pipeline (fboNode.framebuffer.use())
    try {
      this.userRenderFunc(params.transportTime);
    } catch (error) {
      this.handleRuntimeError(error);
    }
  }

  public async updateCode() {
    // Prevent stale render function from running during async rebuild
    this.userRenderFunc = null;

    // Clean up previous tracked resources
    this.trackedRegl?.destroyAll();

    this.isFFTEnabled = false;
    this.fftDataCache.clear();
    this.fftRequestCache.clear();
    this.msgContext.reset();

    // Reset settings proxy for re-run
    if (!this.settingsProxy) {
      this.settingsProxy = createWorkerSettingsProxy(this.config.nodeId, (msg) =>
        self.postMessage(msg)
      );
    } else {
      this.settingsProxy._reset();
    }

    // Reset interaction and video output state
    this.setInteraction('interact', true);
    this.setVideoOutputEnabled(true);

    try {
      const [width, height] = this.renderer.outputSize;

      // Create tracked regl wrapper
      this.trackedRegl = createTrackedRegl(this.renderer.regl, () => this.framebuffer);

      // Preprocess code for module support
      const processedCode = await this.renderer.jsRunner.preprocessCode(this.config.code, {
        nodeId: this.config.nodeId
      });

      if (processedCode === null) return;

      // Wrapper that extracts render() function
      const codeWithWrapper = `
        var recv = onMessage;
        var render;

        ${processedCode}

        return typeof render === 'function' ? render : null;
      `;

      // Build extra context exposed to user code
      const extraContext = {
        regl: this.trackedRegl.regl,
        width,
        height,

        // Mouse object with getters for real-time values
        mouse: this.createMouseObject(),

        // FFT function for audio analysis
        fft: this.createFFTFunction(),

        // VFS URL resolution
        getVfsUrl: createWorkerGetVfsUrl(this.config.nodeId),

        // Message passing
        onMessage: this.msgContext.createOnMessageFunction(),
        send: this.sendMessage.bind(this),

        // Video inlet/outlet control
        setVideoCount: this.setVideoCount.bind(this),

        // Get texture from video inlet
        getTexture: this.getTexture.bind(this),

        noDrag: () => this.setInteraction('drag', false),
        noPan: () => this.setInteraction('pan', false),
        noWheel: () => this.setInteraction('wheel', false),
        noInteract: () => this.setInteraction('interact', false),
        noOutput: () => this.setVideoOutputEnabled(false),

        // No-op: regl uses render(time) called by the pipeline, not RAF
        requestAnimationFrame: () => {},

        // Worker-compatible clock
        clock: this.renderer.createWorkerClock(),

        // Settings API
        settings: this.settingsProxy!.settings
      };

      // Execute using JSRunner
      const userRender = await this.renderer.jsRunner.executeJavaScript(
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

      this.userRenderFunc = typeof userRender === 'function' ? userRender : null;

      if (!this.userRenderFunc) {
        this.createCustomConsole().warn(
          'No render() function found. Define a render(time) function to draw each frame.'
        );
      }
    } catch (error) {
      this.handleCodeError(error);
    }
  }

  destroy() {
    this.trackedRegl?.destroyAll();
    this.trackedRegl = null;
    this.fallbackTexture.destroy();

    // Clean up JSRunner context for this node
    this.renderer.jsRunner.destroy(this.config.nodeId);

    this.userRenderFunc = null;
  }

  /**
   * Gets a regl texture from a video inlet.
   * Returns a 1x1 transparent fallback texture when the inlet is not connected,
   * so regl uniforms always receive a valid texture.
   * @param index The inlet index (0-based)
   */
  getTexture(index: number): regl.Texture2D {
    return this.inputTextures[index] ?? this.fallbackTexture;
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

      return new FFTAnalysis(bins, format, this.sampleRate, type);
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

  handleMessage(message: Message) {
    this.msgContext.handleEdgeMessage(message.data, message);
  }

  handleChannelMessage(channel: string, data: unknown, sourceNodeId: string) {
    this.msgContext.handleChannelMessage(channel, data, sourceNodeId);
  }

  /** Throttled runtime error reporting */
  private lastRuntimeError: string | null = null;
  private lastRuntimeErrorTime = 0;
  private static readonly RUNTIME_ERROR_THROTTLE_MS = 1000;

  handleRuntimeError(error: unknown): void {
    const { nodeId, code } = this.config;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const now = performance.now();

    if (
      this.lastRuntimeError === errorMessage &&
      now - this.lastRuntimeErrorTime < ReglRenderer.RUNTIME_ERROR_THROTTLE_MS
    ) {
      return;
    }

    this.lastRuntimeError = errorMessage;
    this.lastRuntimeErrorTime = now;

    const errorInfo = parseJSError(error, countLines(code), REGL_WRAPPER_OFFSET);

    self.postMessage({
      type: 'consoleOutput',
      nodeId,
      level: 'error',
      args: [`Runtime error: ${errorMessage}`],
      lineErrors: errorInfo?.lineErrors
    });
  }

  handleCodeError(error: unknown): void {
    const { nodeId, code } = this.config;
    const customConsole = this.createCustomConsole();

    const errorInfo = parseJSError(error, countLines(code), REGL_WRAPPER_OFFSET);

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

    const errorMessage = error instanceof Error ? error.message : String(error);

    customConsole.error(errorMessage);
  }

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
