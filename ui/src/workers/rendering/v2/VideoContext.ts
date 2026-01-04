import type regl from 'regl';

/**
 * VideoContext holds shared WebGL resources used by all video nodes.
 * This is a lightweight interface that provides access to the rendering infrastructure.
 */
export interface VideoContext {
	/** The regl rendering context */
	readonly regl: regl.Regl;

	/** The underlying WebGL2 rendering context */
	readonly gl: WebGL2RenderingContext;

	/** The offscreen canvas used for rendering */
	readonly offscreenCanvas: OffscreenCanvas;

	/** Current output size for rendering [width, height] */
	outputSize: [number, number];

	/** Current preview size for node previews [width, height] */
	previewSize: [number, number];

	/** Fallback texture used when no input texture is available */
	readonly fallbackTexture: regl.Texture2D;
}
