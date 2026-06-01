type Dimension = { width: number; height: number };

export type HtmlLayerSizeInput = {
  rootElement: HTMLElement;
  explicitSize?: Partial<Dimension>;
  pixelRatio: number;
};

export type HtmlCanvasSizeLike = Dimension & { scale: number };

export const getRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

export function toPositiveInteger(value: number | undefined, fallback = 1) {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.max(1, Math.ceil(value));
}

export const readHtmlCanvasContentSize = (element: HTMLElement): Dimension => ({
  width: Math.max(element.scrollWidth, element.offsetWidth),
  height: Math.max(element.scrollHeight, element.offsetHeight)
});

export function resolveHtmlLayerSize({
  rootElement,
  explicitSize,
  pixelRatio
}: HtmlLayerSizeInput): HtmlCanvasSizeLike {
  const measured = readHtmlCanvasContentSize(rootElement);

  const displayWidth = explicitSize?.width ?? measured.width;
  const displayHeight = explicitSize?.height ?? measured.height;

  return {
    width: toPositiveInteger(displayWidth) * pixelRatio,
    height: toPositiveInteger(displayHeight) * pixelRatio,
    scale: pixelRatio
  };
}
