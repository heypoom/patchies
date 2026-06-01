import { PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';
import type { GLSystem } from '$lib/canvas/GLSystem';
import {
  captureHtmlCanvasElementImage,
  configureHtmlCanvasElement,
  createHtmlCanvasSupport,
  readHtmlCanvasContentSize,
  resolveHtmlCanvasConfig,
  resolveHtmlCanvasSize,
  requestHtmlCanvasPaint,
  syncHtmlCanvasSize
} from './html-canvas-video-output';
import type { HtmlCanvasOptions, HtmlCanvasSizeMode } from './html-canvas-video-output';
import type { HtmlCanvasSupport } from './html-canvas-video-output';

export type HtmlCanvasNodeOutputState = {
  enabled: boolean;
  sizeMode: HtmlCanvasSizeMode;
  width: number;
  height: number;
};

type ExplicitSize = {
  width?: number;
  height?: number;
};

type OutputSize = {
  width: number;
  height: number;
};

type HtmlCanvasVideoGraph = Pick<
  GLSystem,
  'upsertNode' | 'removeNode' | 'hasOutgoingVideoConnections' | 'setElementImage'
>;

export type HtmlCanvasNodeOutputHost = {
  nodeId: string;
  objectName: string;
  getRootElement: () => HTMLElement | undefined;
  getCanvasElement: () => HTMLCanvasElement | undefined;
  getExplicitSize: () => ExplicitSize;
  getOutputSize: () => OutputSize;
  warn: (message: string) => void;
  updateNodeInternals: () => void;
  scheduleRun: () => void;
  onStateChange?: (state: HtmlCanvasNodeOutputState) => void;
  videoGraph: HtmlCanvasVideoGraph;
  detectSupport?: () => HtmlCanvasSupport;
};

export function getHtmlCanvasRootClass(sizeMode: HtmlCanvasSizeMode, explicitSize: ExplicitSize) {
  if (
    sizeMode === 'output' ||
    (sizeMode === 'free' && explicitSize.width !== undefined && explicitSize.height !== undefined)
  ) {
    return 'h-full w-full';
  }

  return 'inline-block';
}

export class HtmlCanvasNodeOutput {
  private enabled = false;
  private sizeMode: HtmlCanvasSizeMode = 'output';
  private width = 1;
  private height = 1;
  private registered = false;
  private videoGraph: HtmlCanvasVideoGraph;

  constructor(private host: HtmlCanvasNodeOutputHost) {
    this.videoGraph = host.videoGraph;
  }

  get state(): HtmlCanvasNodeOutputState {
    return {
      enabled: this.enabled,
      sizeMode: this.sizeMode,
      width: this.width,
      height: this.height
    };
  }

  enable = (options: HtmlCanvasOptions = true) => {
    const config = resolveHtmlCanvasConfig(options);

    if (config.enabled) {
      const support = this.detectSupport();

      if (!support.supported) {
        this.host.warn(
          `htmlCanvas() requires Chrome's experimental HTML-in-Canvas API. Missing: ${support.missing.join(', ')}`
        );

        return false;
      }
    }

    const enabledChanged = this.enabled !== config.enabled;
    const modeChanged = this.sizeMode !== config.mode;

    if (enabledChanged || modeChanged) {
      this.enabled = config.enabled;
      this.sizeMode = config.mode;

      this.setRegistered(config.enabled);
      this.emitState();

      this.host.updateNodeInternals();
      this.host.scheduleRun();
    }

    return true;
  };

  getRootClass() {
    return getHtmlCanvasRootClass(this.sizeMode, this.host.getExplicitSize());
  }

  updateSize() {
    const rootElement = this.host.getRootElement();
    const measured = rootElement ? readHtmlCanvasContentSize(rootElement) : { width: 1, height: 1 };
    const explicitSize = this.host.getExplicitSize();
    const outputSize = this.host.getOutputSize();

    const size = resolveHtmlCanvasSize({
      mode: this.sizeMode,
      explicitWidth: explicitSize.width,
      explicitHeight: explicitSize.height,
      measuredWidth: measured.width,
      measuredHeight: measured.height,
      outputWidth: outputSize.width,
      outputHeight: outputSize.height,
      scale: PREVIEW_SCALE_FACTOR
    });

    this.width = size.width;
    this.height = size.height;

    const canvas = this.host.getCanvasElement();

    if (canvas) {
      syncHtmlCanvasSize(canvas, size);
    }

    return size;
  }

  setup() {
    const canvas = this.host.getCanvasElement();
    const rootElement = this.host.getRootElement();

    if (!canvas || !rootElement) return false;

    const ctx = canvas.getContext('2d');
    const support = createHtmlCanvasSupport({ canvas, context: ctx });

    if (!ctx || !support.supported) {
      this.host.warn(
        `htmlCanvas() requires Chrome's experimental HTML-in-Canvas API. Missing: ${support.missing.join(', ')}`
      );

      this.enable(false);

      return false;
    }

    configureHtmlCanvasElement(canvas, this.updateSize());

    const htmlCanvas = canvas as HTMLCanvasElement & {
      onpaint: ((event: Event) => void) | null;
    };

    const drawContext = ctx as CanvasRenderingContext2D & {
      drawElementImage: (
        element: Element,
        dx: number,
        dy: number,
        dw: number,
        dh: number
      ) => DOMMatrix;
    };

    htmlCanvas.onpaint = () => {
      const { width, height } = this.updateSize();

      ctx.clearRect(0, 0, width, height);

      const transform = drawContext.drawElementImage(rootElement, 0, 0, width, height);
      rootElement.style.transform = transform.toString();

      this.sendBitmap();
    };

    this.requestPaint();

    return true;
  }

  requestPaint() {
    requestHtmlCanvasPaint(this.host.getCanvasElement());
  }

  destroy() {
    this.setRegistered(false);
  }

  private detectSupport() {
    if (this.host.detectSupport) {
      return this.host.detectSupport();
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    return createHtmlCanvasSupport({ canvas, context });
  }

  private setRegistered(registered: boolean) {
    if (registered === this.registered) return;

    this.registered = registered;

    if (registered) {
      this.videoGraph.upsertNode(this.host.nodeId, 'img', {});
    } else {
      this.videoGraph.removeNode(this.host.nodeId);
    }
  }

  private sendBitmap() {
    const canvas = this.host.getCanvasElement();
    const rootElement = this.host.getRootElement();

    if (!canvas || !rootElement) return;
    if (!this.videoGraph.hasOutgoingVideoConnections(this.host.nodeId)) return;

    const elementImage = captureHtmlCanvasElementImage(canvas, rootElement);

    if (!elementImage) {
      this.host.warn(
        "htmlCanvas() could not capture an ElementImage. Is Chrome's experimental HTML-in-Canvas flag enabled?"
      );

      return;
    }

    this.videoGraph.setElementImage(this.host.nodeId, elementImage, this.width, this.height);
  }

  private emitState() {
    this.host.onStateChange?.(this.state);
  }
}
