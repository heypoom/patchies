import type regl from 'regl';

/**
 * TextureStore manages external textures (images, video frames, etc.) that persist across graph rebuilds.
 * These textures are uploaded from the main thread and used as inputs to video nodes.
 */
export class TextureStore {
	/** External textures by node ID */
	private textures = new Map<string, regl.Texture2D>();

	/**
	 * Set or update an external texture for a node from a bitmap.
	 */
	set(nodeId: string, bitmap: ImageBitmap, reglInstance: regl.Regl): void {
		const existingTexture = this.textures.get(nodeId);

		// Either update the existing texture or create a new one
		const nextTexture = existingTexture ? existingTexture(bitmap) : reglInstance.texture(bitmap);

		this.textures.set(nodeId, nextTexture);
	}

	/**
	 * Get an external texture for a node.
	 */
	get(nodeId: string): regl.Texture2D | undefined {
		return this.textures.get(nodeId);
	}

	/**
	 * Check if a node has an external texture.
	 */
	has(nodeId: string): boolean {
		return this.textures.has(nodeId);
	}

	/**
	 * Remove an external texture for a node.
	 * This should only be called from the frontend when the node is removed.
	 */
	remove(nodeId: string): void {
		const texture = this.textures.get(nodeId);
		if (!texture) return;

		texture.destroy();
		this.textures.delete(nodeId);
	}
}
