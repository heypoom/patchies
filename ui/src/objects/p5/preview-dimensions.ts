import { PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';

export function getP5PreviewDimensions({
  width,
  height,
  isSurfaceCanvas
}: {
  width: number;
  height: number;
  isSurfaceCanvas: boolean;
}) {
  if (!isSurfaceCanvas) {
    return { width, height };
  }

  return {
    width: Math.max(1, Math.round(width / PREVIEW_SCALE_FACTOR)),
    height: Math.max(1, Math.round(height / PREVIEW_SCALE_FACTOR))
  };
}
