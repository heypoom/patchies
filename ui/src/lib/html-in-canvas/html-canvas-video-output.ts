import { getRecord, toPositiveInteger } from './utils';
export { readHtmlCanvasContentSize } from './utils';

export type HtmlCanvasSupport = {
  supported: boolean;
  missing: string[];
};

export type HtmlCanvasSize = {
  width: number;
  height: number;
  scale: number;
};

export type HtmlCanvasSizeMode = 'output' | 'free';

export type HtmlCanvasSizeInput = {
  mode?: HtmlCanvasSizeMode;
  explicitWidth?: number;
  explicitHeight?: number;
  measuredWidth?: number;
  measuredHeight?: number;
  outputWidth?: number;
  outputHeight?: number;
  scale: number;
};

export type HtmlCanvasOptions = boolean | { size?: 'free' } | undefined;

export type HtmlCanvasConfig = {
  enabled: boolean;
  mode: HtmlCanvasSizeMode;
};

export type ElementImageLike = {
  width: number;
  height: number;
  close: () => void;
};

export function createHtmlCanvasSupport({
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

  if (typeof canvasRecord?.captureElementImage !== 'function') {
    missing.push('HTMLCanvasElement.captureElementImage');
  }

  if (typeof contextRecord?.drawElementImage !== 'function') {
    missing.push('CanvasRenderingContext2D.drawElementImage');
  }

  return {
    supported: missing.length === 0,
    missing
  };
}

export function configureHtmlCanvasElement(canvas: HTMLCanvasElement, size: HtmlCanvasSize) {
  canvas.setAttribute('layoutsubtree', '');

  syncHtmlCanvasSize(canvas, size);
}

export function resolveHtmlCanvasSize({
  mode = 'output',
  explicitWidth,
  explicitHeight,
  measuredWidth,
  measuredHeight,
  outputWidth,
  outputHeight,
  scale
}: HtmlCanvasSizeInput): HtmlCanvasSize {
  if (mode === 'output') {
    return {
      width: toPositiveInteger(outputWidth),
      height: toPositiveInteger(outputHeight),
      scale
    };
  }

  const displayWidth = explicitWidth ?? measuredWidth;
  const displayHeight = explicitHeight ?? measuredHeight;

  return {
    width: toPositiveInteger(displayWidth) * scale,
    height: toPositiveInteger(displayHeight) * scale,
    scale
  };
}

export function resolveHtmlCanvasConfig(options: HtmlCanvasOptions = true): HtmlCanvasConfig {
  if (options === false) {
    return { enabled: false, mode: 'output' };
  }

  if (typeof options === 'object' && options?.size === 'free') {
    return { enabled: true, mode: 'free' };
  }

  return { enabled: true, mode: 'output' };
}

export function syncHtmlCanvasSize(
  canvas: HTMLCanvasElement,
  { width, height, scale }: HtmlCanvasSize
) {
  const styleWidth = `${width / scale}px`;
  const styleHeight = `${height / scale}px`;

  let changed = false;

  if (canvas.width !== width) {
    canvas.width = width;
    changed = true;
  }

  if (canvas.height !== height) {
    canvas.height = height;
    changed = true;
  }

  if (canvas.style.width !== styleWidth) {
    canvas.style.width = styleWidth;
    changed = true;
  }

  if (canvas.style.height !== styleHeight) {
    canvas.style.height = styleHeight;
    changed = true;
  }

  return changed;
}

export function requestHtmlCanvasPaint(canvas: unknown) {
  const canvasRecord = getRecord(canvas);

  if (typeof canvasRecord?.requestPaint === 'function') {
    canvasRecord.requestPaint();
  }
}

export function captureHtmlCanvasElementImage(
  canvas: unknown,
  element: Element
): ElementImageLike | null {
  const canvasRecord = getRecord(canvas);

  if (typeof canvasRecord?.captureElementImage !== 'function') {
    return null;
  }

  return canvasRecord.captureElementImage(element) as ElementImageLike;
}
