import type { RenderNode } from '$lib/rendering/types';

export const isExternalTextureNode = (nodeType: RenderNode['type']) => nodeType === 'img';
