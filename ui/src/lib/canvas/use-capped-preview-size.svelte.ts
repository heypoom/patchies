import { capPreviewSize, PREVIEW_SCALE_FACTOR } from './constants';

type CanvasSize = {
  height: number;
  width: number;
};

export function getCappedPreviewSize({ width, height }: CanvasSize) {
  return capPreviewSize(width / PREVIEW_SCALE_FACTOR, height / PREVIEW_SCALE_FACTOR);
}

/**
 * Derive the capped editor-preview dimensions for an output-resolution canvas.
 */
export function useCappedPreviewSize(getCanvasSize: () => CanvasSize) {
  const previewSize = $derived.by(() => {
    return getCappedPreviewSize(getCanvasSize());
  });

  return {
    get height() {
      return previewSize[1];
    },
    get width() {
      return previewSize[0];
    }
  };
}
