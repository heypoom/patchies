import type regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import type { RenderParams } from '$lib/rendering/types';
import type { PrimaryButton } from '$lib/eventbus/events';
import type { Message } from '$lib/messages/MessageSystem';
import type { AudioAnalysisPayloadWithType } from '$lib/audio/AudioAnalysisSystem';
import type { SendMessageOptions } from '$lib/messages/MessageContext';
import { FFTAnalysis } from '$lib/audio/FFTAnalysis';
import { parseJSError, countLines } from '$lib/js-runner/js-error-parser';
import { createWorkerGetVfsUrl } from './vfsWorkerUtils';
import { createWorkerSettingsProxy, type WorkerSettingsProxy } from '../shared/workerSettingsProxy';
import { createWorkerResolver } from '$lib/glsl-include/worker-resolver';
import { createGlslTag } from '$lib/glsl-include/tagged-template';
import { processIncludes } from '$lib/glsl-include/preprocessor';
import { WorkerRendererMessageContext } from './WorkerRendererMessageContext';

type AudioAnalysisType = 'wave' | 'freq';
type AudioAnalysisFormat = 'int' | 'float';

type AudioAnalysisProps = {
  id?: string;
  type?: AudioAnalysisType;
  format?: AudioAnalysisFormat;
};

export interface BaseRendererConfig {
  code: string;
  nodeId: string;
}

/**
 * Abstract base class for worker-side renderers (regl, three, canvas, textmode, hydra).
 *
 * Provides shared FFT, messaging, mouse, port config, console, settings proxy,
 * and error handling — eliminating ~120 lines of duplication per renderer.
 */
export abstract class BaseWorkerRenderer<TConfig extends BaseRendererConfig = BaseRendererConfig> {
  public config: TConfig;
  public renderer: FBORenderer;
  public framebuffer: regl.Framebuffer2D | null;

  protected msgContext: WorkerRendererMessageContext;
  public settingsProxy: WorkerSettingsProxy | null = null;

  // FFT
  public isFFTEnabled = false;
  protected sampleRate: number = 44100;
  protected fftRequestCache = new Map<string, boolean>();
  protected fftDataCache = new Map<
    string,
    { data: Uint8Array | Float32Array; timestamp: number }
  >();

  // Mouse
  protected mouseX = 0;
  protected mouseY = 0;

  // Error throttling
  protected lastRuntimeError: string | null = null;
  protected lastRuntimeErrorTime = 0;
  private static readonly RUNTIME_ERROR_THROTTLE_MS = 1000;

  constructor(config: TConfig, framebuffer: regl.Framebuffer2D, renderer: FBORenderer) {
    this.config = config;
    this.framebuffer = framebuffer;
    this.renderer = renderer;
    this.msgContext = new WorkerRendererMessageContext(config.nodeId);
  }

  // ── Abstract ──

  abstract renderFrame(params: RenderParams): void;
  abstract updateCode(): Promise<void>;

  // ── FFT ──

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

  setFFTData(payload: AudioAnalysisPayloadWithType) {
    const { analysisType, format, array, sampleRate } = payload;

    const cacheKey = `${analysisType}-${format}`;
    this.sampleRate = sampleRate;

    this.fftDataCache.set(cacheKey, {
      data: array,
      timestamp: performance.now()
    });
  }

  // ── Messaging ──

  sendMessage(data: unknown, options: SendMessageOptions) {
    self.postMessage({
      type: 'sendMessageFromNode',
      fromNodeId: this.config.nodeId,
      data,
      options
    });
  }

  handleMessage(message: Message) {
    this.msgContext.handleEdgeMessage(message.data, message);
  }

  handleChannelMessage(channel: string, data: unknown, sourceNodeId: string) {
    this.msgContext.handleChannelMessage(channel, data, sourceNodeId);
  }

  // ── Port configuration ──

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

  setTextureFormat(format: 'rgba8' | 'rgba16f' | 'rgba32f') {
    self.postMessage({
      type: 'setTextureFormat',
      nodeId: this.config.nodeId,
      format
    });
  }

  setResolution(widthOrPreset: number | '1/2' | '1/4', height?: number) {
    const resolution =
      typeof widthOrPreset === 'number' && typeof height === 'number'
        ? [widthOrPreset, height]
        : widthOrPreset;
    self.postMessage({
      type: 'setResolution',
      nodeId: this.config.nodeId,
      resolution
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

  setPrimaryButton(primaryButton: PrimaryButton) {
    self.postMessage({
      type: 'setPrimaryButton',
      nodeId: this.config.nodeId,
      primaryButton
    });
  }

  // ── Mouse ──

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

  // ── Console ──

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

  // ── Shared helpers for updateCode() ──

  /** Resets FFT, settings proxy, interaction state. */
  protected resetState() {
    this.isFFTEnabled = false;
    this.fftDataCache.clear();
    this.fftRequestCache.clear();
    this.msgContext.reset();

    if (!this.settingsProxy) {
      this.settingsProxy = createWorkerSettingsProxy(this.config.nodeId, (msg) =>
        self.postMessage(msg)
      );
    } else {
      this.settingsProxy._reset();
    }

    // Register with fboRenderer so settingsValuesInit can be routed even while
    // this renderer hasn't been stored in its type-specific map yet (create() is still awaiting).
    this.renderer.registerSettingsProxy(this.config.nodeId, this.settingsProxy);

    this.setInteraction('interact', true);
    this.setVideoOutputEnabled(true);
  }

  /** Builds the common extraContext entries shared by all renderers. */
  protected buildBaseExtraContext(): Record<string, unknown> {
    const [width, height] = this.renderer.outputSize;
    const resolver = createWorkerResolver(this.config.nodeId);

    return {
      width,
      height,
      mouse: this.createMouseObject(),
      fft: this.createFFTFunction(),
      getVfsUrl: createWorkerGetVfsUrl(this.config.nodeId),
      glsl: createGlslTag(resolver),
      processIncludes: (source: string) => processIncludes(source, resolver),
      onMessage: this.msgContext.createOnMessageFunction(),
      send: this.sendMessage.bind(this),
      noDrag: () => this.setInteraction('drag', false),
      noPan: () => this.setInteraction('pan', false),
      noWheel: () => this.setInteraction('wheel', false),
      noInteract: () => this.setInteraction('interact', false),
      noOutput: () => this.setVideoOutputEnabled(false),
      setPrimaryButton: this.setPrimaryButton.bind(this),
      clock: this.renderer.createWorkerClock(),
      settings: this.settingsProxy!.settings
    };
  }

  /**
   * Preprocesses and executes user code via JSRunner.
   * Returns null if preprocessing fails (e.g. library definition).
   * Otherwise returns the result of executeJavaScript (the user's return value, if any).
   * Callers should check for null before using the result.
   */
  protected async executeUserCode(code: string, extraContext: Record<string, unknown>) {
    const processedCode = await this.renderer.jsRunner.preprocessCode(code, {
      nodeId: this.config.nodeId
    });
    if (processedCode === null) return null;

    return this.renderer.jsRunner.executeJavaScript(this.config.nodeId, processedCode, {
      customConsole: this.createCustomConsole(),
      setPortCount: (inletCount?: number, outletCount?: number) => {
        this.setPortCount(inletCount, outletCount);
      },
      setTitle: this.setTitle.bind(this),
      setTextureFormat: this.setTextureFormat.bind(this),
      setHidePorts: (hidePorts: boolean) =>
        self.postMessage({ type: 'setHidePorts', nodeId: this.config.nodeId, hidePorts }),
      extraContext
    });
  }

  // ── Error handling ──

  /** Throttled runtime error reporting. */
  protected handleRuntimeError(error: unknown, wrapperOffset: number): void {
    const { nodeId, code } = this.config;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const now = performance.now();

    if (
      this.lastRuntimeError === errorMessage &&
      now - this.lastRuntimeErrorTime < BaseWorkerRenderer.RUNTIME_ERROR_THROTTLE_MS
    ) {
      return;
    }

    this.lastRuntimeError = errorMessage;
    this.lastRuntimeErrorTime = now;

    const errorInfo = parseJSError(error, countLines(code), wrapperOffset);

    self.postMessage({
      type: 'consoleOutput',
      nodeId,
      level: 'error',
      args: [`Runtime error: ${errorMessage}`],
      lineErrors: errorInfo?.lineErrors
    });
  }

  /** Code error reporting with line number extraction. */
  protected handleCodeError(error: unknown, wrapperOffset: number): void {
    const { nodeId, code } = this.config;

    const errorInfo = parseJSError(error, countLines(code), wrapperOffset);

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
    this.createCustomConsole().error(errorMessage);
  }

  // ── Lifecycle ──

  /** Clean up JSRunner context. Subclasses should call super.destroy(). */
  destroy() {
    if (this.settingsProxy) {
      this.renderer.unregisterSettingsProxy(this.config.nodeId, this.settingsProxy);
    }

    this.renderer.jsRunner.destroy(this.config.nodeId);
  }
}
