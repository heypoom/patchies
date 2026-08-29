import type regl from 'regl';
import type { FBONode } from '../../lib/rendering/types';
import { DEFAULT_OUTPUT_SIZE, PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';
import { getFramebuffer } from './utils';
import type { PixelReadbackService } from './PixelReadbackService';
import type { CapturedVideoFrame, VideoFrameFormat } from '$lib/js-runner/js-worker-types';

interface PendingVideoFrameRead {
  pbo: WebGLBuffer;
  width: number;
  height: number;
  sync: WebGLSync;
  sourceNodeId: string;
}

interface PendingVideoFrameBatch {
  requestId?: string;
  targetNodeId: string;
  sourceNodeIds: (string | null)[];

  reads: PendingVideoFrameRead[];
  initiatedAt: number;
  format: VideoFrameFormat;
}

export interface VideoFrameCaptureSource {
  framebuffer: regl.Framebuffer2D;
  width: number;
  height: number;
  previewSize: [number, number];
}

export type CaptureSourceResolver = (nodeId: string) => VideoFrameCaptureSource | null;

interface PixelData {
  pixels: Uint8Array;
  width: number;
  height: number;
}

interface VideoFrameBatchRequest {
  requestId?: string;
  targetNodeId: string;
  sourceNodeIds: (string | null)[];

  resolution?: [number, number];
  format?: VideoFrameFormat;
}

interface HarvestedVideoFrameResult {
  requestId?: string;
  targetNodeId: string;

  timestamp: number;
  frames: CapturedVideoFrame[];
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
    customSize: [number, number]
  ): ImageBitmap {
    const [pw, ph] = customSize;
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

  capturePreviewBitmap(
    nodeId: string,
    resolveSource: CaptureSourceResolver,
    customSize?: [number, number]
  ): ImageBitmap | null {
    const source = resolveSource(nodeId);
    if (!source) return null;

    const defaultPreview: [number, number] = [
      Math.floor(DEFAULT_OUTPUT_SIZE[0] / PREVIEW_SCALE_FACTOR),
      Math.floor(DEFAULT_OUTPUT_SIZE[1] / PREVIEW_SCALE_FACTOR)
    ];

    return this.capturePreviewBitmapSync(
      source.framebuffer,
      source.width,
      source.height,
      customSize ?? source.previewSize ?? defaultPreview
    );
  }

  private createBitmapFromPixels(pixels: Uint8Array, width: number, height: number): ImageBitmap {
    const { canvas, ctx } = this.service.getCanvas(width, height);
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
    requests: VideoFrameBatchRequest[],
    fboNodes: Map<string, FBONode>,
    externalTextures?: Map<string, regl.Texture2D>,
    resolvedSources?: Map<string, VideoFrameCaptureSource>
  ): void {
    // Track temporary FBOs created for external textures (need cleanup after read)
    const tempFbos: regl.Framebuffer2D[] = [];

    // Validate resolution tuple - must have exactly 2 positive numbers
    const isValidResolution = (res?: [number, number]): res is [number, number] =>
      Array.isArray(res) && res.length === 2 && res[0] > 0 && res[1] > 0;

    // Cache reads by (sourceId + resolution) to deduplicate when possible
    // Key format: "sourceId:widthxheight" or "sourceId:default"
    const readCache = new Map<string, PendingVideoFrameRead>();

    const getCacheKey = (sourceId: string, resolution?: [number, number]) =>
      resolution ? `${sourceId}:${resolution[0]}x${resolution[1]}` : `${sourceId}:default`;

    // Process each request
    for (const request of requests) {
      const reads: PendingVideoFrameRead[] = [];
      const validResolution = isValidResolution(request.resolution)
        ? request.resolution
        : undefined;

      for (const sourceId of request.sourceNodeIds) {
        if (!sourceId) continue;

        const cacheKey = getCacheKey(sourceId, validResolution);

        // Check if we already have a read for this source at this resolution
        const cachedRead = readCache.get(cacheKey);

        if (cachedRead) {
          reads.push(cachedRead);
          continue;
        }

        const resolvedSource = resolvedSources?.get(sourceId);

        if (resolvedSource) {
          const read = this.initiateVideoFrameRead(
            sourceId,
            resolvedSource.framebuffer,
            [resolvedSource.width, resolvedSource.height],
            validResolution ?? resolvedSource.previewSize
          );

          if (read) {
            readCache.set(cacheKey, read);
            reads.push(read);
          }

          continue;
        }

        // Check external textures first (img, webcam nodes)
        const externalTexture = externalTextures?.get(sourceId);

        if (externalTexture) {
          // Create a temporary framebuffer wrapping the texture
          const tempFbo = this.regl.framebuffer({ color: externalTexture });
          tempFbos.push(tempFbo);

          const textureSize: [number, number] = [externalTexture.width, externalTexture.height];

          const read = this.initiateVideoFrameRead(
            sourceId,
            tempFbo,
            textureSize,
            validResolution ?? textureSize
          );

          if (read) {
            readCache.set(cacheKey, read);
            reads.push(read);
          }

          continue;
        }

        // Fall back to FBO nodes (p5, hydra, glsl, etc.)
        const fboNode = fboNodes.get(sourceId);
        if (!fboNode) continue;

        const read = this.initiateVideoFrameRead(
          sourceId,
          fboNode.framebuffer,
          [fboNode.texture.width, fboNode.texture.height],
          validResolution ?? fboNode.previewSize
        );

        if (read) {
          readCache.set(cacheKey, read);
          reads.push(read);
        }
      }

      this.pendingVideoFrameBatches.push({
        targetNodeId: request.targetNodeId,
        requestId: request.requestId,
        sourceNodeIds: request.sourceNodeIds,
        reads,
        initiatedAt: performance.now(),
        format: request.format ?? 'raw'
      });
    }

    // Clean up temporary FBOs (reads have been initiated, FBO is no longer needed)
    for (const fbo of tempFbos) {
      fbo.destroy();
    }
  }

  initiateVideoFrameCaptureAsync(
    requests: VideoFrameBatchRequest[],
    resolveSource: CaptureSourceResolver,
    fboNodes: Map<string, FBONode>,
    externalTextures: Map<string, regl.Texture2D>
  ): void {
    const resolvedSources = new Map<string, VideoFrameCaptureSource>();

    for (const request of requests) {
      for (const nodeId of request.sourceNodeIds) {
        if (!nodeId || resolvedSources.has(nodeId)) continue;

        const source = resolveSource(nodeId);
        if (source) resolvedSources.set(nodeId, source);
      }
    }

    this.initiateVideoFrameBatchAsync(requests, fboNodes, externalTextures, resolvedSources);
  }

  /**
   * Initiate a single async PBO read for video frame capture.
   * @param sourceNodeId - ID of the source node
   * @param framebuffer - Source framebuffer to read from
   * @param customSourceSize - Optional source dimensions (for external textures)
   * @param customOutputSize - Optional output resolution (for custom capture size)
   */
  private initiateVideoFrameRead(
    sourceNodeId: string,
    framebuffer: regl.Framebuffer2D,
    customSourceSize: [number, number],
    customOutputSize: [number, number]
  ): PendingVideoFrameRead | null {
    const [pw, ph] = customOutputSize;
    const width = Math.floor(pw);
    const height = Math.floor(ph);

    if (width <= 0 || height <= 0) return null;

    const [sourceWidth, sourceHeight] = customSourceSize;
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
   * Returns array of completed batches with raw RGBA or ImageBitmap frames.
   *
   * When multiple targets need the same source, each gets its own bitmap
   * created from the cached pixel data.
   */
  harvestVideoFrameBatches(): HarvestedVideoFrameResult[] {
    const gl = this.gl;

    const results: HarvestedVideoFrameResult[] = [];
    const stillPending: PendingVideoFrameBatch[] = [];

    // Store completed reads with their pixel data (not bitmap yet)
    // null indicates a failed read (WAIT_FAILED) - still marked complete to avoid re-processing
    const completedPixelData = new Map<PendingVideoFrameRead, PixelData | null>();

    // First pass: check completion and extract pixel data
    for (const batch of this.pendingVideoFrameBatches) {
      for (const read of batch.reads) {
        if (completedPixelData.has(read)) continue;

        const status = gl.clientWaitSync(read.sync, 0, 0);
        if (status === gl.TIMEOUT_EXPIRED) continue;

        if (status === gl.WAIT_FAILED) {
          gl.deleteSync(read.sync);
          this.service.returnPbo(read.pbo);

          // Mark as completed (failed) so it won't be re-queued
          completedPixelData.set(read, null);

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
      const frames: CapturedVideoFrame[] = [];

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

        if (batch.format === 'raw') {
          frames.push({
            data: new Uint8ClampedArray(pixelData.pixels),
            width: pixelData.width,
            height: pixelData.height
          });

          continue;
        }

        frames.push(
          this.createBitmapFromPixels(pixelData.pixels, pixelData.width, pixelData.height)
        );
      }

      results.push({
        targetNodeId: batch.targetNodeId,
        requestId: batch.requestId,
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
