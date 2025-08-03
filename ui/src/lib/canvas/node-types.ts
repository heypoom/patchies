import type { SwissGL } from '$lib/rendering/swissgl';
import type { RenderNode } from '$lib/rendering/types';

export const isExternalTextureNode = (nodeType: RenderNode['type']) => nodeType === 'img';

export type SwissGLContext = {
	glsl: ReturnType<typeof SwissGL>;
	userRenderFunc: ((params: { t: number }) => void) | null;
	swglTarget: { bindTarget: (gl: WebGL2RenderingContext) => number[] };
	gl: WebGL2RenderingContext;
};
