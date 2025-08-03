import type { RenderNode } from '$lib/rendering/types';

export const isExternalTextureNode = (nodeType: RenderNode['type']) => nodeType === 'img';

export type SwglState = {
	glsl: any;
	userRenderFunc: ((params: { t: number }) => void) | null;
	canvas: OffscreenCanvas;
	gl: WebGL2RenderingContext;
};
