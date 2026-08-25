import { capPreviewSize, PREVIEW_SCALE_FACTOR } from './constants';

interface CanvasSize {
  height: number;
  width: number;
}

export const getCappedPreviewSize = ({ width, height }: CanvasSize) =>
  capPreviewSize(width / PREVIEW_SCALE_FACTOR, height / PREVIEW_SCALE_FACTOR);

export const getUncappedPreviewSize = ({ width, height }: CanvasSize): [number, number] => [
  width / PREVIEW_SCALE_FACTOR,
  height / PREVIEW_SCALE_FACTOR
];

/**
 * Derive editor-preview dimensions for an output-resolution canvas. Fixed
 * previews are capped, while fluid previews match their node dimensions.
 */
export function useCappedPreviewSize(getCanvasSize: () => CanvasSize, shouldCap = () => true) {
  const previewSize = $derived.by(() => {
    const canvasSize = getCanvasSize();

    return shouldCap() ? getCappedPreviewSize(canvasSize) : getUncappedPreviewSize(canvasSize);
  });

  return {
    get width() {
      return previewSize[0];
    },
    get height() {
      return previewSize[1];
    }
  };
}
