import {
  configureHtmlCanvasElement,
  requestHtmlCanvasPaint,
  syncHtmlCanvasSize
} from './html-canvas-video-output';
import type { HtmlCanvasSize, HtmlCanvasSupport } from './html-canvas-video-output';
import { getRecord, resolveHtmlLayerSize } from './utils';

export type HtmlLayerFrame = {
  width: number;
  height: number;
  displayWidth: number;
  displayHeight: number;
  pixelRatio: number;
  time: number;
  delta: number;
};

export type HtmlLayerCallback = (ctx: CanvasRenderingContext2D, frame: HtmlLayerFrame) => void;
export type HtmlLayerOptions = HtmlLayerCallback | false | undefined;
export type HtmlLayerNodeOutputState = { enabled: boolean };

export type HtmlLayerNodeOutputHost = {
  getRootElement: () => HTMLElement | undefined;
  getCanvasElement: () => HTMLCanvasElement | undefined;
  getExplicitSize?: () => { width?: number; height?: number };
  warn: (message: string) => void;
  scheduleRun: () => void;
  onStateChange?: (state: HtmlLayerNodeOutputState) => void;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
  now?: () => number;
  getPixelRatio?: () => number;
  detectSupport?: () => HtmlCanvasSupport;
};

type CanvasWithOnPaint = HTMLCanvasElement & { onpaint: ((event: Event) => void) | null };

function createHtmlLayerSupport({
  canvas,
  context
}: {
  canvas: unknown;
  context: unknown;
}): HtmlCanvasSupport {
  const missing: string[] = [];
  const canvasRecord = getRecord(canvas);
  const contextRecord = getRecord(context);

  if (typeof canvasRecord?.requestPaint !== 'function') {
    missing.push('HTMLCanvasElement.requestPaint');
  }

  if (typeof contextRecord?.drawElementImage !== 'function') {
    missing.push('CanvasRenderingContext2D.drawElementImage');
  }

  return {
    supported: missing.length === 0,
    missing
  };
}

export class HtmlLayerNodeOutput {
  private callback: HtmlLayerCallback | null = null;
  private frameId: number | null = null;
  private startedAt = 0;
  private lastFrameAt = 0;

  constructor(private host: HtmlLayerNodeOutputHost) {}

  get enabled() {
    return this.callback !== null;
  }

  get state(): HtmlLayerNodeOutputState {
    return { enabled: this.enabled };
  }

  enable = (options: HtmlLayerOptions) => {
    if (options === false || options === undefined) {
      const wasEnabled = this.enabled;
      this.stop();

      if (wasEnabled) {
        this.host.scheduleRun();
      }

      return false;
    }

    const support = this.detectSupport();

    if (!support.supported) {
      this.host.warn(
        `htmlLayer() requires Chrome's experimental HTML-in-Canvas API. Missing: ${support.missing.join(', ')}`
      );

      return false;
    }

    const wasEnabled = this.enabled;

    this.callback = options;
    this.startedAt = this.now();
    this.lastFrameAt = this.startedAt;
    this.emitState();

    if (!wasEnabled) {
      this.host.scheduleRun();
    }

    return true;
  };

  stop() {
    if (this.frameId !== null) {
      this.cancelFrame(this.frameId);
      this.frameId = null;
    }

    const wasEnabled = this.enabled;
    this.callback = null;

    if (wasEnabled) {
      this.emitState();
    }
  }

  setup() {
    const canvas = this.host.getCanvasElement();
    const rootElement = this.host.getRootElement();

    if (!this.callback || !canvas || !rootElement) return false;

    const ctx = canvas.getContext('2d');
    const support = createHtmlLayerSupport({ canvas, context: ctx });

    if (!ctx || !support.supported) {
      this.host.warn(
        `htmlLayer() requires Chrome's experimental HTML-in-Canvas API. Missing: ${support.missing.join(', ')}`
      );

      this.stop();

      return false;
    }

    configureHtmlCanvasElement(canvas, this.resolveSize(rootElement));

    const htmlCanvas = canvas as CanvasWithOnPaint;
    htmlCanvas.onpaint = () => this.paint();

    this.requestPaintLoop();

    return true;
  }

  paint = (timestamp = this.now()) => {
    if (!this.callback) return;

    const canvas = this.host.getCanvasElement();
    const rootElement = this.host.getRootElement();

    if (!canvas || !rootElement) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = this.resolveSize(rootElement);
    syncHtmlCanvasSize(canvas, size);

    const drawContext = ctx as CanvasRenderingContext2D & {
      drawElementImage: (
        element: Element,
        dx: number,
        dy: number,
        dw: number,
        dh: number
      ) => DOMMatrix;
    };

    ctx.clearRect(0, 0, size.width, size.height);

    const transform = drawContext.drawElementImage(rootElement, 0, 0, size.width, size.height);
    rootElement.style.transform = transform.toString();
    ctx.setTransform(size.scale, 0, 0, size.scale, 0, 0);

    const frame = {
      width: size.width,
      height: size.height,
      displayWidth: size.width / size.scale,
      displayHeight: size.height / size.scale,
      pixelRatio: size.scale,
      time: timestamp - this.startedAt,
      delta: timestamp - this.lastFrameAt
    };

    this.lastFrameAt = timestamp;
    this.callback(ctx, frame);
  };

  requestPaint() {
    requestHtmlCanvasPaint(this.host.getCanvasElement());
  }

  private resolveSize(rootElement: HTMLElement): HtmlCanvasSize {
    return resolveHtmlLayerSize({
      rootElement,
      explicitSize: this.host.getExplicitSize?.(),
      pixelRatio: this.pixelRatio()
    });
  }

  private requestPaintLoop() {
    this.requestPaint();

    if (this.frameId !== null) {
      this.cancelFrame(this.frameId);
    }

    this.frameId = this.requestFrame(() => {
      this.frameId = null;
      this.requestPaintLoop();
    });
  }

  private detectSupport() {
    if (this.host.detectSupport) {
      return this.host.detectSupport();
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    return createHtmlLayerSupport({ canvas, context });
  }

  private requestFrame(callback: FrameRequestCallback) {
    return this.host.requestFrame?.(callback) ?? requestAnimationFrame(callback);
  }

  private cancelFrame(id: number) {
    (this.host.cancelFrame ?? cancelAnimationFrame)(id);
  }

  private now() {
    return this.host.now?.() ?? performance.now();
  }

  private pixelRatio() {
    return Math.max(1, this.host.getPixelRatio?.() ?? globalThis.devicePixelRatio ?? 1);
  }

  private emitState() {
    this.host.onStateChange?.(this.state);
  }
}
