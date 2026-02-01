import type regl from 'regl';
import type { FBONode } from '../../lib/rendering/types';
import { getFramebuffer } from './utils';
import type { PixelReadbackService } from './PixelReadbackService';

interface PendingVideoFrameRead {
  pbo: WebGLBuffer;
  width: number;
  height: number;
  sync: WebGLSync;
  sourceNodeId: string;
}

interface PendingVideoFrameBatch {
  targetNodeId: string;
  sourceNodeIds: (string | null)[];
  reads: PendingVideoFrameRead[];
  initiatedAt: number;
}

/**
 * CaptureRenderer handles on-demand frame capture for video frames and LLM previews.
 *
 * Two modes:
 * 1. Async video frame capture - for worker nodes' onVideoFrame()/getVideoFrames() APIs
 * 2. Sync single capture - for export, Gemini image generation, etc.
 *
 * Uses shared PixelReadbackService for PBO pool, canvas cache, and intermediate FBO.
 */
export class CaptureRenderer {
  private service: PixelReadbackService;
  private regl: regl.Regl;
  private gl: WebGL2RenderingContext;

  // Video frame async read state
  private pendingVideoFrameBatches: PendingVideoFrameBatch[] = [];

  constructor(service: PixelReadbackService) {
    this.service = service;
    this.gl = service.gl;
    this.regl = service.regl;
  }

  // ===== Sync Capture (for on-demand use) =====

  /**
   * Synchronous single-node preview capture.
   * Used for on-demand captures (e.g., export, Gemini).
   */
  capturePreviewBitmapSync(
    framebuffer: regl.Framebuffer2D,
    sourceWidth: number,
    sourceHeight: number,
    customSize?: [number, number]
  ): ImageBitmap {
    const [pw, ph] = customSize ?? this.service.previewSize;
    const width = Math.floor(pw);
    const height = Math.floor(ph);

    const { canvas, ctx } = this.service.getCanvas(width, height);

    this.service.ensureIntermediateFboSize(width, height);

    const gl = this.gl;
    const sourceFBO = getFramebuffer(framebuffer);
    const destFBO = getFramebuffer(this.service.getIntermediateFbo());

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, destFBO);

    gl.blitFramebuffer(
      0,
      0,
      sourceWidth,
      sourceHeight,
      0,
      height,
      width,
      0,
      gl.COLOR_BUFFER_BIT,
      gl.LINEAR
    );

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, destFBO);

    const pixels = this.service.syncRead(width, height);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

    const imageData = new ImageData(new Uint8ClampedArray(pixels), width, height);
    ctx.putImageData(imageData, 0, 0);

    return canvas.transferToImageBitmap();
  }

  // ===== Video Frame Async Capture =====

  /**
   * Initiate async PBO reads for a batch of video frame requests.
   * Call harvestVideoFrameBatches() in subsequent frames to get completed results.
   *
   * Used by worker nodes for `onVideoFrame()` and `getVideoFrames()` APIs.
   * Supports both FBO nodes (p5, hydra, glsl) and external texture nodes (img, webcam).
   */
  initiateVideoFrameBatchAsync(
    requests: Array<{ targetNodeId: string; sourceNodeIds: (string | null)[] }>,
    fboNodes: Map<string, FBONode>,
    externalTextures?: Map<string, regl.Texture2D>
  ): void {
    // Collect all unique source node IDs across all requests
    const uniqueSourceIds = new Set<string>();
    for (const request of requests) {
      for (const sourceId of request.sourceNodeIds) {
        if (sourceId) uniqueSourceIds.add(sourceId);
      }
    }

    // Track temporary FBOs created for external textures (need cleanup after read)
    const tempFbos: regl.Framebuffer2D[] = [];

    // Initiate async reads for each unique source
    const sourceReads = new Map<string, PendingVideoFrameRead>();
    for (const sourceId of uniqueSourceIds) {
      // Check external textures first (img, webcam nodes)
      const externalTexture = externalTextures?.get(sourceId);
      if (externalTexture) {
        // Create a temporary framebuffer wrapping the texture
        const tempFbo = this.regl.framebuffer({ color: externalTexture });
        tempFbos.push(tempFbo);

        const read = this.initiateVideoFrameRead(sourceId, tempFbo, [
          externalTexture.width,
          externalTexture.height
        ]);
        if (read) {
          sourceReads.set(sourceId, read);
        }
        continue;
      }

      // Fall back to FBO nodes (p5, hydra, glsl, etc.)
      const fboNode = fboNodes.get(sourceId);
      if (!fboNode) continue;

      const read = this.initiateVideoFrameRead(sourceId, fboNode.framebuffer);
      if (read) {
        sourceReads.set(sourceId, read);
      }
    }

    // Clean up temporary FBOs (reads have been initiated, FBO is no longer needed)
    for (const fbo of tempFbos) {
      fbo.destroy();
    }

    // Create pending batches for each target
    for (const request of requests) {
      const reads: PendingVideoFrameRead[] = [];

      for (const sourceId of request.sourceNodeIds) {
        if (sourceId) {
          const read = sourceReads.get(sourceId);
          if (read) reads.push(read);
        }
      }

      this.pendingVideoFrameBatches.push({
        targetNodeId: request.targetNodeId,
        sourceNodeIds: request.sourceNodeIds,
        reads,
        initiatedAt: performance.now()
      });
    }
  }

  /**
   * Initiate a single async PBO read for video frame capture.
   */
  private initiateVideoFrameRead(
    sourceNodeId: string,
    framebuffer: regl.Framebuffer2D,
    customSourceSize?: [number, number]
  ): PendingVideoFrameRead | null {
    const [pw, ph] = this.service.previewSize;
    const width = Math.floor(pw);
    const height = Math.floor(ph);

    if (width <= 0 || height <= 0) return null;

    const [sourceWidth, sourceHeight] = customSourceSize ?? this.service.outputSize;
    const gl = this.gl;

    this.service.ensureIntermediateFboSize(width, height);

    // Blit source to intermediate FBO with flip
    const sourceFBO = getFramebuffer(framebuffer);
    const destFBO = getFramebuffer(this.service.getIntermediateFbo());

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, destFBO);

    gl.blitFramebuffer(
      0,
      0,
      sourceWidth,
      sourceHeight,
      0,
      height,
      width,
      0,
      gl.COLOR_BUFFER_BIT,
      gl.LINEAR
    );

    // Setup PBO for async read
    const pbo = this.service.getPbo();
    const size = width * height * 4;

    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, size, gl.STREAM_READ);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, destFBO);

    // This returns immediately - GPU transfer happens async
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, 0);

    // Create fence sync to know when read is complete
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)!;

    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

    return { pbo, width, height, sync, sourceNodeId };
  }

  /**
   * Harvest completed video frame batches.
   * Returns array of completed batches with their ImageBitmaps.
   *
   * Smart cloning: When multiple targets need the same source, each gets
   * its own bitmap created from the cached pixel data. When only one target
   * needs a source, no cloning overhead is incurred.
   */
  harvestVideoFrameBatches(): Array<{
    targetNodeId: string;
    frames: (ImageBitmap | null)[];
    timestamp: number;
  }> {
    const gl = this.gl;
    const results: Array<{
      targetNodeId: string;
      frames: (ImageBitmap | null)[];
      timestamp: number;
    }> = [];

    const stillPending: PendingVideoFrameBatch[] = [];

    // Store completed reads with their pixel data (not bitmap yet)
    const completedPixelData = new Map<
      PendingVideoFrameRead,
      { pixels: Uint8Array; width: number; height: number }
    >();

    // First pass: check completion and extract pixel data
    for (const batch of this.pendingVideoFrameBatches) {
      for (const read of batch.reads) {
        if (completedPixelData.has(read)) continue;

        const status = gl.clientWaitSync(read.sync, 0, 0);

        if (status === gl.TIMEOUT_EXPIRED) {
          continue;
        }

        if (status === gl.WAIT_FAILED) {
          gl.deleteSync(read.sync);
          this.service.returnPbo(read.pbo);
          continue;
        }

        // Read is complete - extract pixels (not bitmap yet)
        gl.deleteSync(read.sync);

        const { pbo, width, height } = read;
        const size = width * height * 4;
        const pixels = new Uint8Array(size);

        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
        gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixels);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);

        this.service.returnPbo(pbo);

        completedPixelData.set(read, { pixels, width, height });
      }
    }

    // Count how many targets need each source (for smart cloning decision)
    const sourceRefCounts = new Map<string, number>();
    for (const batch of this.pendingVideoFrameBatches) {
      const allReadsComplete = batch.reads.every((r) => completedPixelData.has(r));
      if (!allReadsComplete) continue;

      for (const sourceId of batch.sourceNodeIds) {
        if (sourceId) {
          sourceRefCounts.set(sourceId, (sourceRefCounts.get(sourceId) || 0) + 1);
        }
      }
    }

    // Track bitmaps that can be reused (when only 1 target needs them)
    const reusableBitmaps = new Map<string, ImageBitmap>();

    // Second pass: build results for completed batches
    for (const batch of this.pendingVideoFrameBatches) {
      const allReadsComplete = batch.reads.every((r) => completedPixelData.has(r));

      if (!allReadsComplete) {
        stillPending.push(batch);
        continue;
      }

      if (batch.reads.length === 0) {
        continue;
      }

      // Build frames array matching sourceNodeIds order
      const frames: (ImageBitmap | null)[] = [];

      for (const sourceId of batch.sourceNodeIds) {
        if (!sourceId) {
          frames.push(null);
          continue;
        }

        const read = batch.reads.find((r) => r.sourceNodeId === sourceId);
        if (!read) {
          frames.push(null);
          continue;
        }

        const pixelData = completedPixelData.get(read);
        if (!pixelData) {
          frames.push(null);
          continue;
        }

        const refCount = sourceRefCounts.get(sourceId) || 0;

        if (refCount === 1) {
          // Only 1 target needs this source - create bitmap directly (no clone needed)
          const { canvas, ctx } = this.service.getCanvas(pixelData.width, pixelData.height);
          const imageData = new ImageData(
            new Uint8ClampedArray(pixelData.pixels),
            pixelData.width,
            pixelData.height
          );
          ctx.putImageData(imageData, 0, 0);
          frames.push(canvas.transferToImageBitmap());
        } else {
          // Multiple targets need this source - each gets their own bitmap
          const existing = reusableBitmaps.get(sourceId);
          if (existing) {
            // Create a new bitmap from pixels for this target
            const { canvas, ctx } = this.service.getCanvas(pixelData.width, pixelData.height);
            const imageData = new ImageData(
              new Uint8ClampedArray(pixelData.pixels),
              pixelData.width,
              pixelData.height
            );
            ctx.putImageData(imageData, 0, 0);
            frames.push(canvas.transferToImageBitmap());
          } else {
            // First target - create and mark as created
            const { canvas, ctx } = this.service.getCanvas(pixelData.width, pixelData.height);
            const imageData = new ImageData(
              new Uint8ClampedArray(pixelData.pixels),
              pixelData.width,
              pixelData.height
            );
            ctx.putImageData(imageData, 0, 0);
            const bitmap = canvas.transferToImageBitmap();
            reusableBitmaps.set(sourceId, bitmap);
            frames.push(bitmap);
          }
        }

        // Decrement ref count
        sourceRefCounts.set(sourceId, (sourceRefCounts.get(sourceId) || 1) - 1);
      }

      results.push({
        targetNodeId: batch.targetNodeId,
        frames,
        timestamp: performance.now()
      });
    }

    this.pendingVideoFrameBatches = stillPending;
    return results;
  }

  /**
   * Check if there are pending video frame batches.
   */
  hasPendingVideoFrames(): boolean {
    return this.pendingVideoFrameBatches.length > 0;
  }

  // ===== Cleanup =====

  destroy(): void {
    const gl = this.gl;

    // Clean up pending video frame batches
    // Note: Multiple batches can share the same reads, so we deduplicate first
    const cleanedReads = new Set<PendingVideoFrameRead>();

    for (const batch of this.pendingVideoFrameBatches) {
      for (const read of batch.reads) {
        if (!cleanedReads.has(read)) {
          cleanedReads.add(read);
          gl.deleteSync(read.sync);
          gl.deleteBuffer(read.pbo);
        }
      }
    }

    this.pendingVideoFrameBatches = [];
  }
}
