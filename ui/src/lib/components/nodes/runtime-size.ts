import { PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';
import { stripJavaScriptComments } from '$lib/utils/javascript-comments';

export const shouldResetDomSize = (code: string): boolean =>
  !/\bsetSize\s*\(/.test(stripJavaScriptComments(code));

export const getDomSizeResetData = (): {
  width: undefined;
  height: undefined;
} => ({ width: undefined, height: undefined });

export function resetCanvasSize(canvas: HTMLCanvasElement, outputSize: readonly [number, number]) {
  const [width, height] = outputSize;

  canvas.width = width;
  canvas.height = height;

  canvas.style.width = `${width / PREVIEW_SCALE_FACTOR}px`;
  canvas.style.height = `${height / PREVIEW_SCALE_FACTOR}px`;

  return { width, height };
}
