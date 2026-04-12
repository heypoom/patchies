// These are duplicated here (not imported from constants.ts) to avoid a circular dependency,
// since constants.ts re-exports from this file.
const DEFAULT_OUTPUT_SIZE: [number, number] = [1008, 654];
const PREVIEW_SCALE_FACTOR = 4;

export const DEFAULT_PREVIEW_SIZE: [number, number] = [
  Math.round(DEFAULT_OUTPUT_SIZE[0] / PREVIEW_SCALE_FACTOR),
  Math.round(DEFAULT_OUTPUT_SIZE[1] / PREVIEW_SCALE_FACTOR)
];

/** DPR-aware output size based on screen dimensions. Used as default when no explicit size is saved. */
export function getDefaultOutputSize(): [number, number] {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : DEFAULT_OUTPUT_SIZE[0];
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : DEFAULT_OUTPUT_SIZE[1];

  return [
    Math.max(1, Math.min(8192, Math.round(windowWidth * dpr))),
    Math.max(1, Math.min(8192, Math.round(windowHeight * dpr)))
  ];
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
