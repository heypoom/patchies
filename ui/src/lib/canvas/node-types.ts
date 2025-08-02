export const isExternalTextureNode = (nodeType: RenderNode['type']) =>
	nodeType === 'img' || nodeType === 'p5';
