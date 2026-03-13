import type { RenderFrameStats, RenderOp } from '$lib/profiler/types';

/**
 * Profiler for rendering performance metrics.
 * Tracks frame timings and GPU readback performance (PBO getBufferSubData).
 */
export class RenderingProfiler {
  private frameTimings: Float64Array | null = null;
  private frameTimingIndex = 0;
  private frameTimingCount = 0;
  private readonly FRAME_TIMING_BUFFER_SIZE = 300; // ~5 seconds at 60fps
  private lastFrameTime = 0;
  private _isEnabled = false;

  // GPU readback profiling (getBufferSubData for PBO async reads)
  private gpuReadTimings: number[] = [];

  // Per-operation breakdown timings
  private opTimings: Record<RenderOp, number[]> = {
    blit: [],
    transfer: [],
    preview: [],
    video: []
  };

  get isEnabled(): boolean {
    return this._isEnabled;
  }

  /** Enable/disable frame profiling */
  setEnabled(enabled: boolean) {
    this._isEnabled = enabled;

    if (enabled && !this.frameTimings) {
      this.frameTimings = new Float64Array(this.FRAME_TIMING_BUFFER_SIZE);
    }

    if (enabled) {
      this.lastFrameTime = performance.now();
      this.frameTimingIndex = 0;
      this.frameTimingCount = 0;
      this.gpuReadTimings = [];
      this.opTimings = { blit: [], transfer: [], preview: [], video: [] };
    }
  }

  /** Record a GPU readback timing (getBufferSubData) */
  recordReglRead(elapsed: number) {
    if (!this._isEnabled) return;

    this.gpuReadTimings.push(elapsed);
  }

  /** Record a per-operation timing sample */
  recordOp(op: RenderOp, elapsed: number) {
    if (!this._isEnabled) return;

    this.opTimings[op].push(elapsed);
  }

  /** Record frame time (call at end of each frame) */
  recordFrameTime() {
    if (!this._isEnabled || !this.frameTimings) return;

    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    this.frameTimings[this.frameTimingIndex] = frameTime;
    this.frameTimingIndex = (this.frameTimingIndex + 1) % this.FRAME_TIMING_BUFFER_SIZE;
    this.frameTimingCount = Math.min(this.frameTimingCount + 1, this.FRAME_TIMING_BUFFER_SIZE);
  }

  /** Flush stats and reset buffers. Returns null if no data collected yet. */
  flushStats(): RenderFrameStats | null {
    if (!this.frameTimings || this.frameTimingCount === 0) return null;

    const timings: number[] = [];
    for (let i = 0; i < this.frameTimingCount; i++) {
      timings.push(this.frameTimings[i]);
    }

    timings.sort((a, b) => a - b);

    const sum = timings.reduce((a, b) => a + b, 0);
    const avg = sum / timings.length;
    const p50 = timings[Math.floor(timings.length * 0.5)];
    const p95 = timings[Math.floor(timings.length * 0.95)];
    const p99 = timings[Math.floor(timings.length * 0.99)];
    const drops60 = timings.filter((t) => t > 16.67).length;

    let gpuReadAvgMs: number | null = null;
    if (this.gpuReadTimings.length > 0) {
      const readSum = this.gpuReadTimings.reduce((a, b) => a + b, 0);
      gpuReadAvgMs = readSum / this.gpuReadTimings.length;
    }

    // Per-operation averages
    const opAvg = (op: RenderOp): number | null => {
      const arr = this.opTimings[op];
      if (arr.length === 0) return null;

      return arr.reduce((a, b) => a + b, 0) / arr.length;
    };

    const blitAvgMs = opAvg('blit');
    const transferAvgMs = opAvg('transfer');
    const previewAvgMs = opAvg('preview');
    const videoAvgMs = opAvg('video');

    // Reset
    this.frameTimingIndex = 0;
    this.frameTimingCount = 0;
    this.gpuReadTimings = [];
    this.opTimings = { blit: [], transfer: [], preview: [], video: [] };

    return {
      fps: 1000 / avg,
      avgMs: avg,
      p50Ms: p50,
      p95Ms: p95,
      p99Ms: p99,
      drops60,
      gpuReadAvgMs,
      blitAvgMs,
      transferAvgMs,
      previewAvgMs,
      videoAvgMs
    };
  }
}
