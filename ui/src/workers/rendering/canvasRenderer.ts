import type regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import type { Message, MessageCallbackFn } from '$lib/messages/MessageSystem';
import type { AudioAnalysisPayloadWithType } from '$lib/audio/AudioAnalysisSystem';
import type { SendMessageOptions } from '$lib/messages/MessageContext';
import { FFTAnalysis } from '$lib/audio/FFTAnalysis';
import { parseJSError, countLines } from '$lib/js-runner/js-error-parser';
import { CANVAS_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
import { createWorkerGetVfsUrl } from './vfsWorkerUtils';

type AudioAnalysisType = 'wave' | 'freq';
type AudioAnalysisFormat = 'int' | 'float';

type AudioAnalysisProps = {
  id?: string;
  type?: AudioAnalysisType;
  format?: AudioAnalysisFormat;
};

export interface CanvasConfig {
  code: string;
  nodeId: string;
}

export class CanvasRenderer {
  public config: CanvasConfig;
  public renderer: FBORenderer;

  public framebuffer: regl.Framebuffer2D | null = null;
  public offscreenCanvas: OffscreenCanvas | null = null;
  public ctx: OffscreenCanvasRenderingContext2D | null = null;
  public canvasTexture: regl.Texture2D | null = null;

  public onMessage: MessageCallbackFn = () => {};

  private timestamp = performance.now();
  private sampleRate: number = 44000;
  private animationId: number | null = null;
  private drawCommand: regl.DrawCommand | null = null;

  // FFT state tracking
  public isFFTEnabled = false;
  private fftRequestCache = new Map<string, boolean>();
  private fftDataCache = new Map<string, { data: Uint8Array | Float32Array; timestamp: number }>();

  private constructor(
    config: CanvasConfig,
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer
  ) {
    this.config = config;
    this.framebuffer = framebuffer;
    this.renderer = renderer;
  }

  static async create(
    config: CanvasConfig,
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer
  ): Promise<CanvasRenderer> {
    const instance = new CanvasRenderer(config, framebuffer, renderer);

    const [width, height] = instance.renderer.outputSize;

    instance.offscreenCanvas = new OffscreenCanvas(width, height);
    instance.ctx = instance.offscreenCanvas.getContext('2d');

    if (!instance.ctx) {
      throw new Error('Failed to get 2D context from OffscreenCanvas');
    }

    await instance.updateCode();

    return instance;
  }

  private drawCanvasToTexture() {
    if (!this.ctx || !this.offscreenCanvas || !this.framebuffer) return;

    this.ensureDrawCommand();

    // Use flipY to match standard screen coordinates (Y-down, origin top-left)
    // @ts-expect-error -- regl type is wrong
    this.canvasTexture?.({ data: this.offscreenCanvas, flipY: true });
    this.drawCommand?.();
  }

  ensureDrawCommand() {
    if (this.drawCommand || !this.ctx) return;

    // Use flipY to match standard screen coordinates (Y-down, origin top-left)
    // @ts-expect-error -- regl type is wrong
    this.canvasTexture = this.renderer.regl.texture({
      data: this.offscreenCanvas,
      flipY: true
    });

    this.drawCommand = this.renderer.regl({
      framebuffer: this.framebuffer,
      vert: `
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
				uniform sampler2D canvasTexture;

				void main() {
					// Texture is already flipped via flipY:true, so use uv directly
					gl_FragColor = texture2D(canvasTexture, uv);
				}
			`,
      attributes: {
        position: [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1]
        ]
      },
      uniforms: { canvasTexture: this.canvasTexture },
      primitive: 'triangle strip',
      count: 4
    });
  }

  public async updateCode() {
    if (!this.ctx || !this.offscreenCanvas) return;

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

      // Set canvas size
      this.offscreenCanvas.width = width;
      this.offscreenCanvas.height = height;

      // Create extra context for canvas-specific functionality
      const extraContext = {
        canvas: this.offscreenCanvas,
        ctx: this.ctx,
        width: width,
        height: height,

        requestAnimationFrame: (callback: FrameRequestCallback) => {
          this.animationId = requestAnimationFrame(() => {
            callback(performance.now());
            this.drawCanvasToTexture();
          });

          return this.animationId;
        },

        cancelAnimationFrame: (id: number) => {
          cancelAnimationFrame(id);

          if (this.animationId === id) {
            this.animationId = null;
          }
        },

        // FFT function for audio analysis
        fft: this.createFFTFunction(),

        // VFS URL resolution (worker -> main thread -> object URL)
        getVfsUrl: createWorkerGetVfsUrl(this.config.nodeId),

        // Worker-specific send override (JSRunner defaults use worker-local MessageSystem which has no edges)
        send: this.sendMessage.bind(this),

        onMessage: (callback: MessageCallbackFn) => {
          this.onMessage = callback;
        },

        // Interaction control methods
        noDrag: () => this.setInteraction('drag', false),
        noPan: () => this.setInteraction('pan', false),
        noWheel: () => this.setInteraction('wheel', false),
        noInteract: () => this.setInteraction('interact', false),
        noOutput: () => this.setVideoOutputEnabled(false)
      };

      const processedCode = await this.renderer.jsRunner.preprocessCode(this.config.code, {
        nodeId: this.config.nodeId
      });

      if (processedCode === null) return;

      // Use JSRunner's executeJavaScript method with full module support
      await this.renderer.jsRunner.executeJavaScript(this.config.nodeId, processedCode, {
        customConsole: this.createCustomConsole(),
        setPortCount: (inletCount?: number, outletCount?: number) => {
          this.setPortCount(inletCount, outletCount);
        },
        setTitle: (title: string) => {
          this.setTitle(title);
        },
        setHidePorts: (hidePorts: boolean) => {
          this.setHidePorts(hidePorts);
        },
        extraContext
      });
    } catch (error) {
      this.handleCodeError(error);
    }
  }

  destroy() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Clean up JSRunner context for this node
    this.renderer.jsRunner.destroy(this.config.nodeId);

    this.offscreenCanvas = null;
    this.ctx = null;
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

  setHidePorts(hidePorts: boolean) {
    self.postMessage({
      type: 'setHidePorts',
      nodeId: this.config.nodeId,
      hidePorts
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

  handleMessage(message: Message) {
    this.onMessage?.(message.data, message);
  }

  /**
   * Handles code execution errors with line number extraction for inline highlighting.
   * Parses the error to extract line info and sends it via consoleOutput with lineErrors.
   */
  handleCodeError(error: unknown): void {
    const { nodeId, code } = this.config;
    const customConsole = this.createCustomConsole();

    const errorInfo = parseJSError(error, countLines(code), CANVAS_WRAPPER_OFFSET);

    if (errorInfo) {
      // Send error with lineErrors for inline highlighting
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
