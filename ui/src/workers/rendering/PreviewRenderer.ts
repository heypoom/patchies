import type regl from 'regl';
import type { FBONode, PreviewState } from '../../lib/rendering/types';
import { PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';
import { getFramebuffer } from './utils';
import type { RenderingProfiler } from './RenderingProfiler';
import {
  DEFAULT_PREVIEW_MAX_FPS_CAP,
  DEFAULT_MAX_PREVIEWS_PER_FRAME_NO_OUTPUT,
  DEFAULT_MAX_PREVIEWS_PER_FRAME_WITH_OUTPUT
} from './constants';

interface PendingRead {
  pbo: WebGLBuffer;
  width: number;
  height: number;
  sync: WebGLSync;
  nodeId: string;
}

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
 * PreviewRenderer handles GPU-to-CPU pixel readback for node previews.
 *
 * Uses PBO (Pixel Buffer Object) async reads with frame rate limiting:
 * - Previews update at ~40fps
 * - Batch all preview reads in one frame, retrieve results 2+ frames later
 * - Non-blocking retrieval: skip if GPU isn't ready yet
 *
 * This eliminates GPU stalls from readPixels while keeping previews responsive.
 */
export class PreviewRenderer {
  private gl: WebGL2RenderingContext;
  private regl: regl.Regl;
  private profiler: RenderingProfiler;

  // Preview state
  private previewState: PreviewState = {};
  private previewRoundRobinIndex = 0;
  private visibleNodes: Set<string> = new Set();

  // Size configuration
  public outputSize: [number, number];
  public previewSize: [number, number];

  // Throttling configuration
  public maxPreviewsPerFrame = DEFAULT_MAX_PREVIEWS_PER_FRAME_WITH_OUTPUT;
  public maxPreviewsPerFrameNoOutput = DEFAULT_MAX_PREVIEWS_PER_FRAME_NO_OUTPUT;

  // Frame rate limiting for previews (in ms)
  private previewIntervalMs = Math.round(1000 / DEFAULT_PREVIEW_MAX_FPS_CAP);
  private lastPreviewTime = 0;

  // PBO async read state
  private pboPool: WebGLBuffer[] = [];
  private pendingReads: PendingRead[] = [];
  private pendingNodeIds: Set<string> = new Set(); // Track nodes with in-flight reads

  // Canvas cache for ImageBitmap creation
  private canvasCache = new Map<
    string,
    { canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D }
  >();

  // Reusable preview FBO (avoids per-frame allocation)
  private previewFbo: regl.Framebuffer2D | null = null;
  private previewTexture: regl.Texture2D | null = null;

  // Video frame async read state
  private pendingVideoFrameBatches: PendingVideoFrameBatch[] = [];

  constructor(
    gl: WebGL2RenderingContext,
    reglInstance: regl.Regl,
    profiler: RenderingProfiler,
    outputSize: [number, number]
  ) {
    this.gl = gl;
    this.regl = reglInstance;
    this.profiler = profiler;
    this.outputSize = outputSize;
    this.previewSize = [
      Math.floor(outputSize[0] / PREVIEW_SCALE_FACTOR),
      Math.floor(outputSize[1] / PREVIEW_SCALE_FACTOR)
    ];
    this.createPreviewFbo();
  }

  private createPreviewFbo(): void {
    const [width, height] = this.previewSize;

    this.previewTexture = this.regl.texture({
      width,
      height,
      wrapS: 'clamp',
      wrapT: 'clamp'
    });

    this.previewFbo = this.regl.framebuffer({
      color: this.previewTexture,
      depthStencil: false
    });
  }

  // ===== Public API =====

  setPreviewEnabled(nodeId: string, enabled: boolean): void {
    this.previewState[nodeId] = enabled;
  }

  setPreviewFpsCap(fps: number): void {
    this.previewIntervalMs = Math.round(1000 / fps);
  }

  isPreviewEnabled(nodeId: string): boolean {
    return this.previewState[nodeId] ?? false;
  }

  getEnabledPreviews(): string[] {
    return Object.keys(this.previewState).filter((nodeId) => this.previewState[nodeId]);
  }

  hasEnabledPreviews(): boolean {
    return this.getEnabledPreviews().length > 0;
  }

  /** Set which nodes are visible in the viewport for preview culling */
  setVisibleNodes(nodeIds: Set<string>): void {
    this.visibleNodes = nodeIds;
  }

  setPreviewSize(width: number, height: number): void {
    this.previewSize = [width, height];
    this.previewFbo?.destroy();
    this.previewTexture?.destroy();
    this.createPreviewFbo();
  }

  setOutputSize(outputSize: [number, number]): void {
    this.outputSize = outputSize;
  }

  removeNode(nodeId: string): void {
    delete this.previewState[nodeId];
    this.pendingNodeIds.delete(nodeId);

    // Clean up any pending reads for this node
    this.pendingReads = this.pendingReads.filter((p) => {
      if (p.nodeId === nodeId) {
        this.gl.deleteSync(p.sync);
        this.returnPbo(p.pbo);
        return false;
      }
      return true;
    });
  }

  /**
   * Main entry point: render previews using async PBO reads.
   *
   * Flow:
   * 1. Check for completed async reads and create bitmaps (non-blocking)
   * 2. If enough time has passed, initiate new batch of reads
   *
   * Returns bitmaps that are ready (may be empty if nothing completed yet).
   */
  renderPreviewBitmaps(
    fboNodes: Map<string, FBONode>,
    isOutputEnabled: boolean,
    getCustomSize?: (nodeId: string) => [number, number] | undefined
  ): Map<string, ImageBitmap> {
    const results = new Map<string, ImageBitmap>();

    // Step 1: Harvest any completed reads (non-blocking)
    this.harvestCompletedReads(results);

    // Step 2: Check if we should initiate new reads (frame rate limiting)
    const now = performance.now();

    if (now - this.lastPreviewTime < this.previewIntervalMs) {
      return results;
    }

    this.lastPreviewTime = now;

    // Step 3: Initiate new batch of async reads
    const enabledPreviews = this.getEnabledPreviews();
    if (enabledPreviews.length === 0) return results;

    const maxLimit = isOutputEnabled ? this.maxPreviewsPerFrame : this.maxPreviewsPerFrameNoOutput;
    const nodesToRead = this.selectNodesForFrame(enabledPreviews, maxLimit);

    for (const nodeId of nodesToRead) {
      // Skip if this node already has a pending read
      if (this.pendingNodeIds.has(nodeId)) continue;

      const fboNode = fboNodes.get(nodeId);
      if (!fboNode) continue;

      const customSize = getCustomSize?.(nodeId);
      this.initiateAsyncRead(nodeId, fboNode.framebuffer, customSize);
    }

    return results;
  }

  /**
   * Harvest completed async reads without blocking.
   * Uses clientWaitSync with 0 timeout to check if ready.
   */
  private harvestCompletedReads(results: Map<string, ImageBitmap>): void {
    const gl = this.gl;
    const stillPending: PendingRead[] = [];

    for (const pending of this.pendingReads) {
      const { pbo, width, height, sync, nodeId } = pending;

      // Non-blocking check: is the GPU done?
      const status = gl.clientWaitSync(sync, 0, 0);

      if (status === gl.TIMEOUT_EXPIRED) {
        // Not ready yet, keep waiting
        stillPending.push(pending);
        continue;
      }

      if (status === gl.WAIT_FAILED) {
        // Sync failed - clean up and discard this read
        console.warn(`[PreviewRenderer]: clientWaitSync failed for node ${nodeId}`);

        gl.deleteSync(sync);
        this.returnPbo(pbo);
        this.pendingNodeIds.delete(nodeId);
        continue;
      }

      // Ready! (ALREADY_SIGNALED or CONDITION_SATISFIED)
      gl.deleteSync(sync);

      // Read the data (should be instant since GPU is done)
      const size = width * height * 4;
      const pixels = new Uint8Array(size);

      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);

      const start = this.profiler.isEnabled ? performance.now() : 0;
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixels);
      if (this.profiler.isEnabled) {
        this.profiler.recordReglRead(performance.now() - start);
      }

      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      this.returnPbo(pbo);

      // Create bitmap
      const { canvas, ctx } = this.getCanvas(width, height);

      const imageData = new ImageData(new Uint8ClampedArray(pixels), width, height);
      ctx.putImageData(imageData, 0, 0);

      results.set(nodeId, canvas.transferToImageBitmap());

      // Remove from pending set
      this.pendingNodeIds.delete(nodeId);
    }

    this.pendingReads = stillPending;
  }

  /**
   * Initiate an async read using PBO.
   * readPixels with PBO bound returns immediately.
   */
  private initiateAsyncRead(
    nodeId: string,
    framebuffer: regl.Framebuffer2D,
    customSize?: [number, number]
  ): void {
    const [pw, ph] = customSize ?? this.previewSize;
    const width = Math.floor(pw);
    const height = Math.floor(ph);

    if (width <= 0 || height <= 0) return;

    const [sourceWidth, sourceHeight] = this.outputSize;
    const gl = this.gl;

    this.ensurePreviewFboSize(width, height);

    // Blit source to preview FBO with flip
    const sourceFBO = getFramebuffer(framebuffer);
    const destFBO = getFramebuffer(this.previewFbo!);

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
    const pbo = this.getPbo();
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

    this.pendingReads.push({ pbo, width, height, sync, nodeId });
    this.pendingNodeIds.add(nodeId);
  }

  // ===== PBO Pool =====

  private getPbo(): WebGLBuffer {
    if (this.pboPool.length > 0) {
      return this.pboPool.pop()!;
    }

    return this.gl.createBuffer()!;
  }

  private returnPbo(pbo: WebGLBuffer): void {
    this.pboPool.push(pbo);
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
    const [pw, ph] = customSize ?? this.previewSize;
    const width = Math.floor(pw);
    const height = Math.floor(ph);

    const { canvas, ctx } = this.getCanvas(width, height);

    this.ensurePreviewFboSize(width, height);

    const gl = this.gl;
    const sourceFBO = getFramebuffer(framebuffer);
    const destFBO = getFramebuffer(this.previewFbo!);

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

    const pixels = this.timedSyncRead(width, height);

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
   */
  initiateVideoFrameBatchAsync(
    requests: Array<{ targetNodeId: string; sourceNodeIds: (string | null)[] }>,
    fboNodes: Map<string, FBONode>
  ): void {
    // Collect all unique source node IDs across all requests
    const uniqueSourceIds = new Set<string>();
    for (const request of requests) {
      for (const sourceId of request.sourceNodeIds) {
        if (sourceId) uniqueSourceIds.add(sourceId);
      }
    }

    // Initiate async reads for each unique source
    const sourceReads = new Map<string, PendingVideoFrameRead>();
    for (const sourceId of uniqueSourceIds) {
      const fboNode = fboNodes.get(sourceId);
      if (!fboNode) continue;

      const read = this.initiateVideoFrameRead(sourceId, fboNode.framebuffer);
      if (read) {
        sourceReads.set(sourceId, read);
      }
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
    framebuffer: regl.Framebuffer2D
  ): PendingVideoFrameRead | null {
    const [pw, ph] = this.previewSize;
    const width = Math.floor(pw);
    const height = Math.floor(ph);

    if (width <= 0 || height <= 0) return null;

    const [sourceWidth, sourceHeight] = this.outputSize;
    const gl = this.gl;

    this.ensurePreviewFboSize(width, height);

    // Blit source to preview FBO with flip
    const sourceFBO = getFramebuffer(framebuffer);
    const destFBO = getFramebuffer(this.previewFbo!);

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
    const pbo = this.getPbo();
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
          this.returnPbo(read.pbo);
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

        this.returnPbo(pbo);

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
          const { canvas, ctx } = this.getCanvas(pixelData.width, pixelData.height);
          const imageData = new ImageData(
            new Uint8ClampedArray(pixelData.pixels),
            pixelData.width,
            pixelData.height
          );
          ctx.putImageData(imageData, 0, 0);
          frames.push(canvas.transferToImageBitmap());
        } else {
          // Multiple targets need this source - each gets their own bitmap
          // Check if we already created one for reuse (first target)
          const existing = reusableBitmaps.get(sourceId);
          if (existing) {
            // Create a new bitmap from pixels for this target
            const { canvas, ctx } = this.getCanvas(pixelData.width, pixelData.height);
            const imageData = new ImageData(
              new Uint8ClampedArray(pixelData.pixels),
              pixelData.width,
              pixelData.height
            );
            ctx.putImageData(imageData, 0, 0);
            frames.push(canvas.transferToImageBitmap());
          } else {
            // First target - create and mark as created
            const { canvas, ctx } = this.getCanvas(pixelData.width, pixelData.height);
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

  // ===== Helpers =====

  private selectNodesForFrame(enabledPreviews: string[], maxLimit: number): string[] {
    // Filter to only visible nodes (fallback to all if visibleNodes is empty)
    const visibleEnabledPreviews =
      this.visibleNodes.size === 0
        ? enabledPreviews
        : enabledPreviews.filter((nodeId) => this.visibleNodes.has(nodeId));

    if (maxLimit <= 0 || visibleEnabledPreviews.length <= maxLimit) {
      return visibleEnabledPreviews;
    }

    const selected: string[] = [];
    for (let i = 0; i < maxLimit; i++) {
      const idx = (this.previewRoundRobinIndex + i) % visibleEnabledPreviews.length;
      selected.push(visibleEnabledPreviews[idx]);
    }

    this.previewRoundRobinIndex =
      (this.previewRoundRobinIndex + maxLimit) % visibleEnabledPreviews.length;

    return selected;
  }

  private getCanvas(
    width: number,
    height: number
  ): { canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D } {
    const key = `${width}x${height}`;
    let cached = this.canvasCache.get(key);

    if (!cached) {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d')!;

      cached = { canvas, ctx };
      this.canvasCache.set(key, cached);
    }

    return cached;
  }

  private ensurePreviewFboSize(width: number, height: number): void {
    if (
      this.previewTexture &&
      this.previewTexture.width === width &&
      this.previewTexture.height === height
    ) {
      return;
    }

    this.previewFbo?.destroy();
    this.previewTexture?.destroy();

    this.previewTexture = this.regl.texture({
      width,
      height,
      wrapS: 'clamp',
      wrapT: 'clamp'
    });

    this.previewFbo = this.regl.framebuffer({
      color: this.previewTexture,
      depthStencil: false
    });
  }

  private timedSyncRead(width: number, height: number): Uint8Array {
    const size = width * height * 4;
    const pixels = new Uint8Array(size);

    if (!this.profiler.isEnabled) {
      this.gl.readPixels(0, 0, width, height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);
      return pixels;
    }

    const start = performance.now();

    this.gl.readPixels(0, 0, width, height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);
    this.profiler.recordReglRead(performance.now() - start);

    return pixels;
  }

  destroy(): void {
    // Clean up pending reads
    for (const pending of this.pendingReads) {
      this.gl.deleteSync(pending.sync);
      this.gl.deleteBuffer(pending.pbo);
    }

    this.pendingReads = [];
    this.pendingNodeIds.clear();

    // Clean up PBO pool
    for (const pbo of this.pboPool) {
      this.gl.deleteBuffer(pbo);
    }

    this.pboPool = [];

    this.previewFbo?.destroy();
    this.previewTexture?.destroy();
  }
}
