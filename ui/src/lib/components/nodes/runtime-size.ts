import { PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';
import { stripJavaScriptComments } from '$lib/utils/javascript-comments';

export type DomSize = {
  width: number;
  height: number;
};

export const shouldResetDomSize = (code: string): boolean =>
  !/\bsetSize\s*\(/.test(stripJavaScriptComments(code));

export const getDomSizeResetData = (): {
  width: undefined;
  height: undefined;
} => ({ width: undefined, height: undefined });

export function measureDomSize(
  element: HTMLElement | undefined,
  fallback: { width?: number; height?: number },
  zoom = 1
): DomSize | null {
  const rect = element?.getBoundingClientRect();
  const scale = zoom || 1;

  if (rect && rect.width > 0 && rect.height > 0) {
    return {
      width: rect.width / scale,
      height: rect.height / scale
    };
  }

  if (fallback.width !== undefined && fallback.height !== undefined) {
    return {
      width: fallback.width,
      height: fallback.height
    };
  }

  return null;
}

export function resetCanvasSize(canvas: HTMLCanvasElement, outputSize: readonly [number, number]) {
  const [width, height] = outputSize;

  canvas.width = width;
  canvas.height = height;

  canvas.style.width = `${width / PREVIEW_SCALE_FACTOR}px`;
  canvas.style.height = `${height / PREVIEW_SCALE_FACTOR}px`;

  return { width, height };
}
