import type regl from 'regl';
import type { FBOFormat } from '$lib/rendering/types';
import { getFramebuffer, getRawTexture } from './utils';

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
  private colorBufferFloatSupported: boolean;

  /** Destination textures (flipped to match GL coordinates) - PUBLIC for renderNodeToMainOutput */
  public destinationTextures: Map<string, regl.Texture2D> = new Map();

  /** Texture storage format for float texture destinations */
  private destinationTextureFormats: Map<string, FBOFormat> = new Map();

  /** Source textures (raw bitmap, not flipped) */
  private sourceTextures: Map<string, regl.Texture2D> = new Map();

  /** FBOs for flipped destination textures - PUBLIC for renderNodeToMainOutput */
  public destinationFBOs: Map<string, regl.Framebuffer2D> = new Map();

  /** Pending bitmaps to close on next frame */
  private pendingBitmaps: Map<string, ImageBitmap> = new Map();

  constructor(regl: regl.Regl, gl: WebGL2RenderingContext) {
    this.regl = regl;
    this.gl = gl;
    this.colorBufferFloatSupported = !!gl.getExtension('EXT_color_buffer_float');
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
    const existingDestTexture = this.destinationTextures.get(nodeId);

    const needsResize =
      !sourceTexture ||
      sourceTexture.width !== width ||
      sourceTexture.height !== height ||
      !existingDestTexture ||
      existingDestTexture.width !== width ||
      existingDestTexture.height !== height;

    if (!sourceTexture || sourceTexture.width !== width || sourceTexture.height !== height) {
      sourceTexture?.destroy();
      sourceTexture = this.regl.texture({ width, height });

      this.sourceTextures.set(nodeId, sourceTexture);
    }

    // Get or create destination texture (flipped result)
    let destTexture = existingDestTexture;

    if (!destTexture || destTexture.width !== width || destTexture.height !== height) {
      destTexture?.destroy();
      destTexture = this.regl.texture({ width, height });

      this.destinationTextures.set(nodeId, destTexture);
    }

    // Get or create destination FBO - must recreate if texture was resized
    let destFBO = this.destinationFBOs.get(nodeId);

    if (!destFBO || needsResize) {
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
   * Upload packed RGBA float data as an external texture.
   * Used by data-texture nodes that already provide GPU-ready pixel rows.
   */
  setFloatTexture(
    nodeId: string,
    width: number,
    height: number,
    data: Float32Array,
    format: FBOFormat = 'rgba32f'
  ): void {
    const safeWidth = Math.max(1, Math.round(width));
    const safeHeight = Math.max(1, Math.round(height));
    const expectedLength = safeWidth * safeHeight * 4;

    if (data.length !== expectedLength) {
      console.warn(
        `[float.tex] Expected RGBA data length ${expectedLength}, received ${data.length}; skipping upload`
      );
      return;
    }

    const uploadFormat = this.resolveFloatTextureFormat(format);

    const pendingBitmap = this.pendingBitmaps.get(nodeId);

    if (pendingBitmap) {
      pendingBitmap.close();
      this.pendingBitmaps.delete(nodeId);
    }

    const sourceTexture = this.sourceTextures.get(nodeId);

    if (sourceTexture) {
      sourceTexture.destroy();
      this.sourceTextures.delete(nodeId);
    }

    const existingDestTexture = this.destinationTextures.get(nodeId);
    const existingDestFBO = this.destinationFBOs.get(nodeId);
    const existingFormat = this.destinationTextureFormats.get(nodeId);

    let destFBO = existingDestFBO;

    const needsResize =
      !existingDestTexture ||
      existingDestTexture.width !== safeWidth ||
      existingDestTexture.height !== safeHeight ||
      existingFormat !== uploadFormat;

    let destTexture = existingDestTexture;

    if (needsResize) {
      destFBO?.destroy();
      destFBO = undefined;
      existingDestTexture?.destroy();

      destTexture = this.regl.texture({
        width: safeWidth,
        height: safeHeight,
        wrapS: 'clamp',
        wrapT: 'clamp'
      });

      this.destinationTextures.set(nodeId, destTexture);
      this.destinationTextureFormats.set(nodeId, uploadFormat);
    }

    const rawTexture = getRawTexture(destTexture);
    const gl = this.gl;
    const upload = this.createFloatTextureUpload(data, uploadFormat);

    const previousTexture = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null;
    const previousActiveTexture = gl.getParameter(gl.ACTIVE_TEXTURE) as number;
    const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, rawTexture);

    if (needsResize) {
      // TODO(float-texture-upload): this raw WebGL reinitialization keeps regl's
      // texture object in sync with WebGL2-sized float storage after resize or
      // format changes. Revisit with a more direct texture allocation path if
      // upload performance becomes a bottleneck.
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        upload.internalFormat,
        safeWidth,
        safeHeight,
        0,
        gl.RGBA,
        upload.type,
        upload.data
      );

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } else {
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        safeWidth,
        safeHeight,
        gl.RGBA,
        upload.type,
        upload.data
      );
    }

    gl.bindTexture(gl.TEXTURE_2D, previousTexture);
    gl.activeTexture(previousActiveTexture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);

    if (!destFBO) {
      destFBO = this.regl.framebuffer({ color: destTexture });
      this.destinationFBOs.set(nodeId, destFBO);
    }
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

    this.destinationTextureFormats.delete(nodeId);

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

  private resolveFloatTextureFormat(format: FBOFormat): FBOFormat {
    if (format === 'rgba8' || this.colorBufferFloatSupported) {
      return format;
    }

    console.warn(
      `[float.tex] EXT_color_buffer_float not supported, falling back to rgba8 for ${format}`
    );

    return 'rgba8';
  }

  private createFloatTextureUpload(data: Float32Array, format: FBOFormat) {
    const gl = this.gl;

    switch (format) {
      case 'rgba8':
        return { internalFormat: gl.RGBA8, type: gl.UNSIGNED_BYTE, data: toUint8ClampedData(data) };
      case 'rgba16f':
        return { internalFormat: gl.RGBA16F, type: gl.FLOAT, data };
      case 'rgba32f':
        return { internalFormat: gl.RGBA32F, type: gl.FLOAT, data };
    }
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
    this.destinationTextureFormats.clear();

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

function toUint8ClampedData(data: Float32Array): Uint8Array {
  const bytes = new Uint8Array(data.length);

  for (let index = 0; index < data.length; index++) {
    bytes[index] = Math.round(Math.min(1, Math.max(0, data[index])) * 255);
  }

  return bytes;
}
