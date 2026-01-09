import type regl from 'regl';
import type { VideoNodeV2, VideoNodeGroup } from '../interfaces/video-nodes';
import type { VideoContext } from '../VideoContext';

/**
 * ImgNode is a passthrough node for external image textures.
 * The actual texture is stored in TextureStore and accessed via getInputTextures().
 * This node just needs to exist in the registry - no rendering logic needed.
 */
export class ImgNode implements VideoNodeV2 {
	static type = 'img';
	static group: VideoNodeGroup = 'generators';

	readonly nodeId: string;
	readonly framebuffer: regl.Framebuffer2D;
	readonly texture: regl.Texture2D;

	constructor(nodeId: string, ctx: VideoContext) {
		this.nodeId = nodeId;

		// Create a minimal 1x1 framebuffer/texture
		// The actual texture is managed by TextureStore
		this.texture = ctx.regl.texture({
			width: 1,
			height: 1,
			wrapS: 'clamp',
			wrapT: 'clamp'
		});

		this.framebuffer = ctx.regl.framebuffer({
			color: this.texture,
			depthStencil: false
		});
	}

	// No create() or render() needed - this is a pure passthrough node
	// The texture is set via TextureStore.set() and retrieved in getInputTextures()

	destroy(): void {
		this.framebuffer.destroy();
		this.texture.destroy();
	}
}
