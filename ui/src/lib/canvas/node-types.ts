import type { SwissGL } from '$lib/rendering/swissgl';
import type { RenderNode } from '$lib/rendering/types';

export const isExternalTextureNode = (nodeType: RenderNode['type']) => nodeType === 'img';

export type SwglState = {
	glsl: ReturnType<typeof SwissGL>;
	userRenderFunc: ((params: { t: number }) => void) | null;
	swglFramebuffer: WebGLFramebuffer;
	swglTexture: WebGLTexture;
	swglTarget: { bindTarget: (gl: WebGL2RenderingContext) => number[] };
	gl: WebGL2RenderingContext;
};
