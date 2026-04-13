export const DEFAULT_OUTPUT_SIZE: [number, number] = [1280, 720];
export const PREVIEW_SCALE_FACTOR = 4;

export const DEFAULT_PREVIEW_SIZE: [number, number] = [
  Math.round(DEFAULT_OUTPUT_SIZE[0] / PREVIEW_SCALE_FACTOR),
  Math.round(DEFAULT_OUTPUT_SIZE[1] / PREVIEW_SCALE_FACTOR)
];

/** Output size based on screen dimensions (without DPR). Used as default when no explicit size is saved. */
export function getScreenOutputSize(): [number, number] {
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : DEFAULT_OUTPUT_SIZE[0];
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : DEFAULT_OUTPUT_SIZE[1];

  return [Math.max(1, Math.min(8192, windowWidth)), Math.max(1, Math.min(8192, windowHeight))];
}

/** Maximum preview dimensions. Previews are scaled down to fit within this box. */
export const MAX_PREVIEW_SIZE: [number, number] = [252, 164];

/** Constrain preview dimensions to fit within MAX_PREVIEW_SIZE, preserving aspect ratio. */
export function capPreviewSize(width: number, height: number): [number, number] {
  const [maxWidth, maxHeight] = MAX_PREVIEW_SIZE;

  if (width <= maxWidth && height <= maxHeight) {
    return [width, height];
  }

  const scale = Math.min(maxWidth / width, maxHeight / height);

  return [Math.max(1, Math.floor(width * scale)), Math.max(1, Math.floor(height * scale))];
}

/**
 * Compute preview size from a per-node FBO resolution override.
 * Used by node components to derive their preview canvas dimensions.
 */
export function getPreviewSizeForResolution(
  resolution: number | [number, number] | string | undefined
): [number, number] {
  if (resolution == null) return DEFAULT_PREVIEW_SIZE;

  const [outputWidth, outputHeight] = DEFAULT_OUTPUT_SIZE;

  // Fractional: '1/2', '1/4', etc.
  if (typeof resolution === 'string') {
    const match = resolution.match(/^1\/(\d+)$/);

    if (match) {
      const divisor = Number(match[1]);

      if (!Number.isFinite(divisor) || divisor <= 0) {
        return DEFAULT_PREVIEW_SIZE;
      }

      return capPreviewSize(
        Math.max(1, Math.floor(outputWidth / divisor / PREVIEW_SCALE_FACTOR)),
        Math.max(1, Math.floor(outputHeight / divisor / PREVIEW_SCALE_FACTOR))
      );
    }
    return DEFAULT_PREVIEW_SIZE;
  }

  // Square: 256 → 64x64
  if (typeof resolution === 'number') {
    if (!Number.isFinite(resolution) || resolution <= 0) {
      return DEFAULT_PREVIEW_SIZE;
    }

    const size = Math.max(1, Math.floor(resolution / PREVIEW_SCALE_FACTOR));

    return capPreviewSize(size, size);
  }

  // Explicit: [512, 256] → [128, 64]
  if (
    !Number.isFinite(resolution[0]) ||
    !Number.isFinite(resolution[1]) ||
    resolution[0] <= 0 ||
    resolution[1] <= 0
  ) {
    return DEFAULT_PREVIEW_SIZE;
  }

  return capPreviewSize(
    Math.max(1, Math.floor(resolution[0] / PREVIEW_SCALE_FACTOR)),
    Math.max(1, Math.floor(resolution[1] / PREVIEW_SCALE_FACTOR))
  );
}

/**
 * Create a transform that maps window-space 0–1 coordinates to output UV space,
 * accounting for the cover-mode blit crop. This is the inverse of the cover blit
 * in fboRenderer.ts that crops the source FBO to fill the background canvas.
 *
 * When sourceAspect > windowAspect: source sides are cropped → X needs remapping
 * When sourceAspect < windowAspect: source top/bottom are cropped → Y needs remapping
 */
export function createCoverBlitTransform(
  sourceWidth: number,
  sourceHeight: number,
  windowWidth: number,
  windowHeight: number
): (x: number, y: number) => { x: number; y: number } {
  const sourceAspect = sourceWidth / sourceHeight;
  const windowAspect = windowWidth / windowHeight;

  if (Math.abs(sourceAspect - windowAspect) < 0.001) {
    // Aspects match — no transform needed
    return (x, y) => ({ x, y });
  }

  if (sourceAspect > windowAspect) {
    // Source is wider — sides are cropped
    // Visible UV X range: [offsetU, offsetU + visibleU]
    const cropWidth = sourceHeight * windowAspect;
    const offsetU = (sourceWidth - cropWidth) / 2 / sourceWidth;
    const visibleU = cropWidth / sourceWidth;

    return (x, y) => ({
      x: offsetU + x * visibleU,
      y
    });
  }

  // Source is taller — top/bottom are cropped
  // Visible UV Y range: [offsetV, offsetV + visibleV]
  const cropHeight = sourceWidth / windowAspect;
  const offsetV = (sourceHeight - cropHeight) / 2 / sourceHeight;
  const visibleV = cropHeight / sourceHeight;

  return (x, y) => ({
    x,
    y: offsetV + y * visibleV
  });
}
