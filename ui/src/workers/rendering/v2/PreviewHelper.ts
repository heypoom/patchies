import type regl from 'regl';

import type { VideoContext } from './VideoContext';

import { getFramebuffer } from '../utils';

/**
 * PreviewHelper provides pure functions for capturing preview frames from video nodes.
 * These functions handle the WebGL operations needed to read pixels from framebuffers.
 */

/**
 * Capture a preview frame from a framebuffer.
 * Uses blitFramebuffer to scale down the output to preview size and reads the pixels.
 */
export function capturePreview(
	ctx: VideoContext,
	framebuffer: regl.Framebuffer2D,
	customSize?: [number, number]
): Uint8Array {
	const [previewWidth, previewHeight] = customSize ?? ctx.previewSize;
	const [renderWidth, renderHeight] = ctx.outputSize;

	const previewTexture = ctx.regl.texture({
		width: previewWidth,
		height: previewHeight,
		wrapS: 'clamp',
		wrapT: 'clamp'
	});

	const previewFramebuffer = ctx.regl.framebuffer({
		color: previewTexture,
		depthStencil: false
	});

	let pixels: Uint8Array;

	previewFramebuffer.use(() => {
		const gl = ctx.gl;
		const sourceFBO = getFramebuffer(framebuffer);
		const destPreviewFBO = getFramebuffer(previewFramebuffer);

		gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceFBO);
		gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, destPreviewFBO);

		gl.blitFramebuffer(
			0,
			0,
			renderWidth,
			renderHeight,
			0,
			0,
			previewWidth,
			previewHeight,
			gl.COLOR_BUFFER_BIT,
			gl.LINEAR
		);

		pixels = ctx.regl.read() as Uint8Array;

		gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
		gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
	});

	previewTexture.destroy();
	previewFramebuffer.destroy();

	return pixels!;
}

/**
 * Capture a preview frame from a texture (for external textures).
 * Creates a temporary framebuffer, blits the texture to preview size, and reads pixels.
 */
export function captureTexturePreview(
	ctx: VideoContext,
	texture: regl.Texture2D,
	customSize?: [number, number]
): Uint8Array {
	const [previewWidth, previewHeight] = customSize ?? ctx.previewSize;

	const sourceFbo = ctx.regl.framebuffer({ color: texture });
	const previewFbo = ctx.regl.framebuffer({ width: previewWidth, height: previewHeight });
	const gl = ctx.gl;

	let pixels: Uint8Array;

	previewFbo.use(() => {
		gl.bindFramebuffer(gl.READ_FRAMEBUFFER, getFramebuffer(sourceFbo));
		gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, getFramebuffer(previewFbo));

		gl.blitFramebuffer(
			0,
			0,
			texture.width,
			texture.height,
			0,
			0,
			previewWidth,
			previewHeight,
			gl.COLOR_BUFFER_BIT,
			gl.LINEAR
		);

		pixels = ctx.regl.read();
	});

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	sourceFbo.destroy();
	previewFbo.destroy();

	return pixels!;
}

/**
 * Blit a framebuffer or texture to the main output canvas.
 * This renders the final result to the screen (or output window).
 */
export function blitToOutput(ctx: VideoContext, source: regl.Framebuffer2D | regl.Texture2D): void {
	const [renderWidth, renderHeight] = ctx.outputSize;
	const gl = ctx.gl;

	let framebuffer: regl.Framebuffer2D;
	let sourceWidth = renderWidth;
	let sourceHeight = renderHeight;

	// If source is a texture, wrap it in a framebuffer
	if ('width' in source && 'height' in source) {
		// It's a texture
		framebuffer = ctx.regl.framebuffer({ color: source });
		sourceWidth = source.width;
		sourceHeight = source.height;
	} else {
		// It's already a framebuffer
		framebuffer = source;
	}

	gl.viewport(0, 0, renderWidth, renderHeight);
	gl.bindFramebuffer(gl.READ_FRAMEBUFFER, getFramebuffer(framebuffer));
	gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

	gl.blitFramebuffer(
		0,
		0,
		sourceWidth,
		sourceHeight,
		0,
		renderHeight,
		renderWidth,
		0,
		gl.COLOR_BUFFER_BIT,
		gl.NEAREST
	);

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	// Clean up temporary framebuffer if we created one
	if ('width' in source && 'height' in source) {
		framebuffer.destroy();
	}
}
