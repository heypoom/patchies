import type regl from 'regl';
import { getFramebuffer } from './utils';

/**
 * Manages video texture lifecycle for external bitmap sources.
 *
 * Handles:
 * - Creating/destroying textures and FBOs for video frames
 * - Uploading ImageBitmap data to GPU textures
 * - Y-flip blit for correct orientation
 * - Memory management (texture reuse, bitmap cleanup)
 */
export class VideoTextureManager {
  private regl: regl.Regl;
  private gl: WebGL2RenderingContext;

  /** Destination textures (flipped to match GL coordinates) - PUBLIC for renderNodeToMainOutput */
  public destinationTextures: Map<string, regl.Texture2D> = new Map();

  /** Source textures (raw bitmap, not flipped) */
  private sourceTextures: Map<string, regl.Texture2D> = new Map();

  /** FBOs for flipped destination textures - PUBLIC for renderNodeToMainOutput */
  public destinationFBOs: Map<string, regl.Framebuffer2D> = new Map();

  /** Pending bitmaps to close on next frame */
  private pendingBitmaps: Map<string, ImageBitmap> = new Map();

  constructor(regl: regl.Regl, gl: WebGL2RenderingContext) {
    this.regl = regl;
    this.gl = gl;
  }

  /**
   * Upload a bitmap to GPU texture with Y-flip for correct orientation.
   * Creates textures/FBOs on first call, reuses on subsequent calls.
   */
  setBitmap(nodeId: string, bitmap: ImageBitmap): void {
    // Close the PREVIOUS bitmap for this node (safe - texture upload already completed)
    const pendingBitmap = this.pendingBitmaps.get(nodeId);

    if (pendingBitmap) {
      pendingBitmap.close();
    }

    const width = bitmap.width;
    const height = bitmap.height;

    // Get or create source texture (raw bitmap, not flipped)
    let sourceTexture = this.sourceTextures.get(nodeId);

    if (!sourceTexture || sourceTexture.width !== width || sourceTexture.height !== height) {
      sourceTexture?.destroy();
      sourceTexture = this.regl.texture({ width, height });

      this.sourceTextures.set(nodeId, sourceTexture);
    }

    // Get or create destination texture (flipped result)
    let destTexture = this.destinationTextures.get(nodeId);

    if (!destTexture || destTexture.width !== width || destTexture.height !== height) {
      destTexture?.destroy();
      destTexture = this.regl.texture({ width, height });

      this.destinationTextures.set(nodeId, destTexture);
    }

    // Get or create destination FBO (CACHED - created once and reused)
    let destFBO = this.destinationFBOs.get(nodeId);

    if (!destFBO || destTexture.width !== width || destTexture.height !== height) {
      destFBO?.destroy();
      destFBO = this.regl.framebuffer({ color: destTexture });

      this.destinationFBOs.set(nodeId, destFBO);
    }

    // Upload bitmap to source texture
    // @ts-expect-error -- regl types are imprecise for ImageBitmap
    sourceTexture({ data: bitmap });

    // Create temporary FBO for reading from source texture
    const sourceFBO = this.regl.framebuffer({ color: sourceTexture });

    // Blit with Y flip: swap srcY0 and srcY1 to flip vertically
    this.gl.bindFramebuffer(this.gl.READ_FRAMEBUFFER, getFramebuffer(sourceFBO));
    this.gl.bindFramebuffer(this.gl.DRAW_FRAMEBUFFER, getFramebuffer(destFBO!));
    this.gl.blitFramebuffer(
      0,
      height, // srcY0 = height (top)
      width,
      0, // srcY1 = 0 (bottom) - swapped to flip
      0,
      0,
      width,
      height,
      this.gl.COLOR_BUFFER_BIT,
      this.gl.NEAREST
    );
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

    // Clean up temporary source FBO (texture is kept)
    sourceFBO.destroy();

    // Queue THIS bitmap to be closed on the NEXT frame
    // This ensures the texture upload is complete before we release the bitmap
    this.pendingBitmaps.set(nodeId, bitmap);
  }

  /**
   * Remove all textures/FBOs for a video node.
   * Called when node is deleted from the graph.
   */
  removeBitmap(nodeId: string): void {
    // Clean up destination texture
    const destTexture = this.destinationTextures.get(nodeId);

    if (destTexture) {
      destTexture.destroy();
      this.destinationTextures.delete(nodeId);
    }

    // Clean up destination FBO
    const destFBO = this.destinationFBOs.get(nodeId);

    if (destFBO) {
      destFBO.destroy();
      this.destinationFBOs.delete(nodeId);
    }

    // Clean up source texture
    const sourceTexture = this.sourceTextures.get(nodeId);

    if (sourceTexture) {
      sourceTexture.destroy();
      this.sourceTextures.delete(nodeId);
    }

    // Close pending bitmap if any
    const pendingBitmap = this.pendingBitmaps.get(nodeId);

    if (pendingBitmap) {
      pendingBitmap.close();
      this.pendingBitmaps.delete(nodeId);
    }
  }

  /**
   * Get destination texture for a video node (if exists).
   */
  getDestinationTexture(nodeId: string): regl.Texture2D | undefined {
    return this.destinationTextures.get(nodeId);
  }

  /**
   * Get destination FBO for a video node (if exists).
   */
  getDestinationFBO(nodeId: string): regl.Framebuffer2D | undefined {
    return this.destinationFBOs.get(nodeId);
  }

  /**
   * Check if a node has video textures.
   */
  has(nodeId: string): boolean {
    return this.destinationTextures.has(nodeId);
  }

  /**
   * Cleanup all resources.
   */
  destroy(): void {
    // Close all pending bitmaps
    for (const bitmap of this.pendingBitmaps.values()) {
      bitmap.close();
    }

    this.pendingBitmaps.clear();

    // Destroy all textures
    for (const texture of this.destinationTextures.values()) {
      texture.destroy();
    }

    this.destinationTextures.clear();

    for (const texture of this.sourceTextures.values()) {
      texture.destroy();
    }

    this.sourceTextures.clear();

    // Destroy all FBOs
    for (const fbo of this.destinationFBOs.values()) {
      fbo.destroy();
    }

    this.destinationFBOs.clear();
  }
}
