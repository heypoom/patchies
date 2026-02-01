/**
 * VideoProfiler - Frame metrics tracking for video playback
 *
 * Tracks:
 * - FPS (frames per second, rolling average)
 * - Frame drops (detected by timestamp gaps)
 * - Decode latency (time from request to frame delivery)
 * - Queue depth (pending frames)
 */

import type { WorkerQueueStats } from '$workers/video/videoDecoderWorker';

export type { WorkerQueueStats };

export interface VideoStats {
  /** Current frames per second (rolling average over 1 second) */
  fps: number;

  /** Target FPS based on video metadata */
  targetFps: number;

  /** Total frames received since start */
  totalFrames: number;

  /** Estimated dropped frames based on timestamp gaps */
  droppedFrames: number;

  /** Current playback time in seconds */
  currentTime: number;

  /** Video duration in seconds */
  duration: number;

  /** Pending frames in queue (worker-reported, legacy) */
  queueDepth: number;

  /** Detailed worker queue stats (WebCodecs only) */
  workerQueues: WorkerQueueStats | null;

  /** Whether using WebCodecs or HTMLVideoElement fallback */
  pipeline: 'webcodecs' | 'fallback';

  /** Video resolution */
  width: number;
  height: number;

  /** Video codec (if known) */
  codec: string;
}

export class VideoProfiler {
  private nodeId: string;
  private frameTimestamps: number[] = [];
  private lastVideoTimestamp = 0;
  private totalFrames = 0;
  private droppedFrames = 0;
  private targetFps = 30;
  private currentTime = 0;
  private duration = 0;
  private queueDepth = 0;
  private workerQueues: WorkerQueueStats | null = null;
  private pipeline: 'webcodecs' | 'fallback' = 'webcodecs';
  private width = 0;
  private height = 0;
  private codec = 'unknown';

  // Rolling window for FPS calculation (1 second)
  private readonly FPS_WINDOW_MS = 1000;

  // Threshold for detecting frame drops (1.5x expected frame interval)
  private readonly DROP_THRESHOLD_FACTOR = 1.5;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
  }

  /**
   * Set video metadata (call when video loads).
   */
  setMetadata(metadata: {
    frameRate?: number;
    duration?: number;
    width?: number;
    height?: number;
    codec?: string;
  }): void {
    if (metadata.frameRate) this.targetFps = metadata.frameRate;
    if (metadata.duration) this.duration = metadata.duration;
    if (metadata.width) this.width = metadata.width;
    if (metadata.height) this.height = metadata.height;
    if (metadata.codec) this.codec = metadata.codec;
  }

  /**
   * Set the pipeline type.
   */
  setPipeline(pipeline: 'webcodecs' | 'fallback'): void {
    this.pipeline = pipeline;
  }

  /**
   * Set queue depth (from worker).
   */
  setQueueDepth(depth: number): void {
    this.queueDepth = depth;
  }

  /**
   * Set detailed worker queue stats (WebCodecs only).
   */
  setWorkerQueues(stats: WorkerQueueStats): void {
    this.workerQueues = stats;
    // Also update legacy queueDepth for compatibility
    this.queueDepth = stats.pendingFrames;
  }

  /**
   * Record a frame delivery.
   * @param videoTimestamp The timestamp of the frame in the video (microseconds)
   * @param currentTime Current playback position in seconds
   */
  recordFrame(videoTimestamp: number, currentTime?: number): void {
    const now = performance.now();
    this.frameTimestamps.push(now);
    this.totalFrames++;

    if (currentTime !== undefined) {
      this.currentTime = currentTime;
    }

    // Detect drops by checking video timestamp gaps
    if (this.lastVideoTimestamp > 0 && videoTimestamp > this.lastVideoTimestamp) {
      const expectedInterval = 1_000_000 / this.targetFps; // in microseconds
      const actualInterval = videoTimestamp - this.lastVideoTimestamp;
      const expectedFrames = Math.round(actualInterval / expectedInterval);

      if (expectedFrames > 1) {
        // We skipped frames
        this.droppedFrames += expectedFrames - 1;
      }
    }
    this.lastVideoTimestamp = videoTimestamp;

    // Clean up old timestamps outside the window
    const cutoff = now - this.FPS_WINDOW_MS;
    while (this.frameTimestamps.length > 0 && this.frameTimestamps[0] < cutoff) {
      this.frameTimestamps.shift();
    }
  }

  /**
   * Get current FPS (frames in the last second).
   */
  getFps(): number {
    const now = performance.now();
    const cutoff = now - this.FPS_WINDOW_MS;

    // Count frames in window
    let count = 0;
    for (let i = this.frameTimestamps.length - 1; i >= 0; i--) {
      if (this.frameTimestamps[i] >= cutoff) {
        count++;
      } else {
        break;
      }
    }

    return count;
  }

  /**
   * Get all current stats.
   */
  getStats(): VideoStats {
    return {
      fps: this.getFps(),
      targetFps: this.targetFps,
      totalFrames: this.totalFrames,
      droppedFrames: this.droppedFrames,
      currentTime: this.currentTime,
      duration: this.duration,
      queueDepth: this.queueDepth,
      workerQueues: this.workerQueues,
      pipeline: this.pipeline,
      width: this.width,
      height: this.height,
      codec: this.codec
    };
  }

  /**
   * Reset all stats (call when video restarts or changes).
   */
  reset(): void {
    this.frameTimestamps = [];
    this.lastVideoTimestamp = 0;
    this.totalFrames = 0;
    this.droppedFrames = 0;
    this.currentTime = 0;
    this.queueDepth = 0;
    this.workerQueues = null;
  }

  /**
   * Format stats as a multi-line string for display.
   */
  formatStats(): string {
    const stats = this.getStats();
    const lines = [
      `${stats.pipeline.toUpperCase()}`,
      `${stats.fps}/${Math.round(stats.targetFps)} FPS`,
      `Dropped: ${stats.droppedFrames}`,
      `${stats.width}x${stats.height}`
    ];

    // Show detailed queue stats for WebCodecs
    if (stats.workerQueues) {
      const q = stats.workerQueues;
      lines.push(`Samples: ${q.pendingSamples}`);
      lines.push(`Decode Q: ${q.decodeQueueSize}`);
      lines.push(`Frames: ${q.pendingFrames}`);
    } else {
      lines.push(`Queue: ${stats.queueDepth}`);
    }

    if (stats.codec !== 'unknown') {
      lines.push(stats.codec);
    }

    return lines.join('\n');
  }
}
