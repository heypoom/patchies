import type regl from 'regl';
import type { RenderingProfiler } from './RenderingProfiler';

/**
 * PixelReadbackService provides shared infrastructure for GPU-to-CPU pixel readback.
 *
 * Manages:
 * - PBO (Pixel Buffer Object) pool for async reads
 * - OffscreenCanvas cache for ImageBitmap creation
 * - Reusable intermediate FBO for blit/scale operations
 *
 * Used by both PreviewRenderer (periodic preview thumbnails) and
 * CaptureRenderer (on-demand video frame capture).
 */
export class PixelReadbackService {
  public gl: WebGL2RenderingContext;
  public regl: regl.Regl;
  public profiler: RenderingProfiler;

  // Size configuration
  public outputSize: [number, number];
  public previewSize: [number, number];

  // PBO pool for async reads
  private pboPool: WebGLBuffer[] = [];

  // Canvas cache for ImageBitmap creation (keyed by "widthxheight")
  private canvasCache = new Map<
    string,
    { canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D }
  >();

  // Reusable intermediate FBO (avoids per-frame allocation)
  private intermediateFbo: regl.Framebuffer2D | null = null;
  private intermediateTexture: regl.Texture2D | null = null;

  constructor(
    gl: WebGL2RenderingContext,
    reglInstance: regl.Regl,
    profiler: RenderingProfiler,
    outputSize: [number, number],
    previewSize: [number, number]
  ) {
    this.gl = gl;
    this.regl = reglInstance;
    this.profiler = profiler;
    this.outputSize = outputSize;
    this.previewSize = previewSize;
    this.createIntermediateFbo();
  }

  private createIntermediateFbo(): void {
    const [width, height] = this.previewSize;

    this.intermediateTexture = this.regl.texture({
      width,
      height,
      wrapS: 'clamp',
      wrapT: 'clamp'
    });

    this.intermediateFbo = this.regl.framebuffer({
      color: this.intermediateTexture,
      depthStencil: false
    });
  }

  // ===== Public API =====

  setPreviewSize(width: number, height: number): void {
    this.previewSize = [width, height];
    this.intermediateFbo?.destroy();
    this.intermediateTexture?.destroy();
    this.createIntermediateFbo();
  }

  setOutputSize(outputSize: [number, number]): void {
    this.outputSize = outputSize;
  }

  // ===== PBO Pool =====

  getPbo(): WebGLBuffer {
    if (this.pboPool.length > 0) {
      return this.pboPool.pop()!;
    }
    return this.gl.createBuffer()!;
  }

  returnPbo(pbo: WebGLBuffer): void {
    this.pboPool.push(pbo);
  }

  // ===== Canvas Cache =====

  getCanvas(
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

  // ===== Intermediate FBO =====

  /**
   * Ensure intermediate FBO matches the requested size.
   * Returns the native WebGL framebuffer handle.
   */
  ensureIntermediateFboSize(width: number, height: number): void {
    if (
      this.intermediateTexture &&
      this.intermediateTexture.width === width &&
      this.intermediateTexture.height === height
    ) {
      return;
    }

    this.intermediateFbo?.destroy();
    this.intermediateTexture?.destroy();

    this.intermediateTexture = this.regl.texture({
      width,
      height,
      wrapS: 'clamp',
      wrapT: 'clamp'
    });

    this.intermediateFbo = this.regl.framebuffer({
      color: this.intermediateTexture,
      depthStencil: false
    });
  }

  getIntermediateFbo(): regl.Framebuffer2D {
    return this.intermediateFbo!;
  }

  // ===== Sync Read =====

  /**
   * Synchronous pixel read with optional profiling.
   * Blocks until GPU is done - use for on-demand captures only.
   */
  syncRead(width: number, height: number): Uint8Array {
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

  // ===== Cleanup =====

  destroy(): void {
    // Clean up PBO pool
    for (const pbo of this.pboPool) {
      this.gl.deleteBuffer(pbo);
    }
    this.pboPool = [];

    // Clean up intermediate FBO
    this.intermediateFbo?.destroy();
    this.intermediateTexture?.destroy();

    // Canvas cache will be garbage collected
    this.canvasCache.clear();
  }
}
