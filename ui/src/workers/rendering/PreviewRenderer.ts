import type regl from 'regl';
import type { FBONode, PreviewState } from '../../lib/rendering/types';
import { getFramebuffer } from './utils';
import type { PixelReadbackService } from './PixelReadbackService';
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

/**
 * PreviewRenderer handles periodic GPU-to-CPU pixel readback for node preview thumbnails.
 *
 * Uses PBO (Pixel Buffer Object) async reads with frame rate limiting:
 * - Previews update at configurable fps (default ~40fps)
 * - Batch preview reads in one frame, retrieve results 2+ frames later
 * - Non-blocking retrieval: skip if GPU isn't ready yet
 *
 * This eliminates GPU stalls from readPixels while keeping previews responsive.
 *
 * Uses shared PixelReadbackService for PBO pool, canvas cache, and intermediate FBO.
 */
export class PreviewRenderer {
  private service: PixelReadbackService;
  private gl: WebGL2RenderingContext;

  // Preview state
  private previewState: PreviewState = {};
  private previewRoundRobinIndex = 0;
  private visibleNodes: Set<string> = new Set();

  // Throttling configuration
  public maxPreviewsPerFrame = DEFAULT_MAX_PREVIEWS_PER_FRAME_WITH_OUTPUT;
  public maxPreviewsPerFrameNoOutput = DEFAULT_MAX_PREVIEWS_PER_FRAME_NO_OUTPUT;

  // Frame rate limiting for previews (in ms)
  private previewIntervalMs = Math.round(1000 / DEFAULT_PREVIEW_MAX_FPS_CAP);
  private lastPreviewTime = 0;

  // PBO async read state
  private pendingReads: PendingRead[] = [];
  private pendingNodeIds: Set<string> = new Set(); // Track nodes with in-flight reads

  constructor(service: PixelReadbackService) {
    this.service = service;
    this.gl = service.gl;
  }

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

  removeNode(nodeId: string): void {
    delete this.previewState[nodeId];

    this.pendingNodeIds.delete(nodeId);

    // Clean up any pending reads for this node
    this.pendingReads = this.pendingReads.filter((p) => {
      if (p.nodeId === nodeId) {
        this.gl.deleteSync(p.sync);
        this.service.returnPbo(p.pbo);
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
        this.service.returnPbo(pbo);
        this.pendingNodeIds.delete(nodeId);
        continue;
      }

      // Ready! (ALREADY_SIGNALED or CONDITION_SATISFIED)
      gl.deleteSync(sync);

      // Read the data (should be instant since GPU is done)
      const size = width * height * 4;
      const pixels = new Uint8Array(size);

      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);

      const start = this.service.profiler.isEnabled ? performance.now() : 0;

      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixels);

      if (this.service.profiler.isEnabled) {
        this.service.profiler.recordReglRead(performance.now() - start);
      }

      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      this.service.returnPbo(pbo);

      // Create bitmap
      const { canvas, ctx } = this.service.getCanvas(width, height);

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
    const [pw, ph] = customSize ?? this.service.previewSize;
    const width = Math.floor(pw);
    const height = Math.floor(ph);

    if (width <= 0 || height <= 0) return;

    const [sourceWidth, sourceHeight] = this.service.outputSize;
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

    this.pendingReads.push({ pbo, width, height, sync, nodeId });
    this.pendingNodeIds.add(nodeId);
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

  // ===== Cleanup =====

  destroy(): void {
    // Clean up pending reads
    for (const pending of this.pendingReads) {
      this.gl.deleteSync(pending.sync);
      this.gl.deleteBuffer(pending.pbo);
    }

    this.pendingReads = [];
    this.pendingNodeIds.clear();
  }
}
