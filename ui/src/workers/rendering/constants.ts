/** Caps the preview at this fps by default */
export const DEFAULT_PREVIEW_MAX_FPS_CAP = 48;

/** Caps the number of previews that can be rendered per frame when output is enabled */
export const DEFAULT_MAX_PREVIEWS_PER_FRAME_WITH_OUTPUT = 20;

/** Caps the number of previews that can be rendered per frame when output is disabled */
export const DEFAULT_MAX_PREVIEWS_PER_FRAME_NO_OUTPUT = 20;

/**
 * Min preview dimension (px) before switching to native
 * FBO readback for crisp low-res previews
 **/
export const MIN_PREVIEW_SIZE_FOR_DOWNSCALE = 64;

/**
 * Zoom-based preview LOD tiers.
 * Each tier defines a zoom threshold and a scale multiplier applied to the base preview scale factor.
 * Tiers are evaluated top-to-bottom; the first matching threshold is used.
 */
export const PREVIEW_ZOOM_LOD_TIERS = [
  { minZoom: 1.0, scaleMultiplier: 1 },
  { minZoom: 0.6, scaleMultiplier: 1.3 },
  { minZoom: 0, scaleMultiplier: 1.6 }
] as const;
