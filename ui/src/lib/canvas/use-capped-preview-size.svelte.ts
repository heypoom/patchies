import { capPreviewSize, PREVIEW_SCALE_FACTOR } from './constants';

interface CanvasSize {
  height: number;
  width: number;
}

export const getCappedPreviewSize = ({ width, height }: CanvasSize) =>
  capPreviewSize(width / PREVIEW_SCALE_FACTOR, height / PREVIEW_SCALE_FACTOR);

/**
 * Derive the capped editor-preview dimensions for an output-resolution canvas.
 */
export function useCappedPreviewSize(getCanvasSize: () => CanvasSize) {
  const previewSize = $derived.by(() => getCappedPreviewSize(getCanvasSize()));

  return {
    get width() {
      return previewSize[0];
    },
    get height() {
      return previewSize[1];
    }
  };
}
