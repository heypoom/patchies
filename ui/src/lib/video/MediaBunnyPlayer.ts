/**
 * MediaBunnyPlayer - Video file playback using MediaBunny
 *
 * Uses MediaBunny for efficient video decoding with built-in:
 * - Streaming support for large files
 * - Intelligent prefetching and caching
 * - Automatic seeking to keyframes
 */

import { Input, BlobSource, UrlSource, VideoSampleSink, ALL_FORMATS } from 'mediabunny';
import type { Input as InputType, InputVideoTrack, Source } from 'mediabunny';

export interface VideoMetadata {
  duration: number; // seconds
  width: number;
  height: number;
  frameRate: number;
  codec: string;
  hasAudio: boolean;
}

export interface MediaBunnyPlayerConfig {
  nodeId: string;
  onFrame: (bitmap: ImageBitmap, timestamp: number) => void;
  onMetadata: (metadata: VideoMetadata) => void;
  onEnded: () => void;
  onError: (error: Error) => void;

  /** Called periodically with current playback time (for UI sync) */
  onTimeUpdate?: (currentTime: number) => void;

  /** Called when first frame is received (for timeout cancellation) */
  onFirstFrame?: () => void;
}

/** Buffered frame ready for display */
interface BufferedFrame {
  bitmap: ImageBitmap;
  timestamp: number; // seconds
}

// How many frames to buffer ahead
const FRAME_BUFFER_SIZE = 10;

// Profiling
import { ProfilingHelper } from '$lib/utils/ProfilingHelper';
const PROFILE_ENABLED = true;
const bitmapProfiler = new ProfilingHelper('MediaBunny createImageBitmap');

export class MediaBunnyPlayer {
  private nodeId: string;
  private onFrame: (bitmap: ImageBitmap, timestamp: number) => void;
  private onMetadata: (metadata: VideoMetadata) => void;
  private onEnded: () => void;
  private onError: (error: Error) => void;
  private onTimeUpdate?: (currentTime: number) => void;
  private onFirstFrame?: () => void;
  private firstFrameSent = false;

  // Input can use BlobSource (files) or UrlSource (remote URLs) - both stream lazily
  private input: InputType<Source> | null = null;
  private videoTrack: InputVideoTrack | null = null;
  private sink: VideoSampleSink | null = null;

  private _metadata: VideoMetadata | null = null;
  private _currentTime = 0;
  private _paused = true;
  private _loop = true;
  private _playbackRate = 1;
  private _isLoaded = false;

  // Playback timing
  private playbackStartTime = 0; // performance.now() when playback started
  private playbackStartVideoTime = 0; // video time when playback started
  private animationFrameId: number | null = null;

  // Frame buffer for smooth playback
  private frameBuffer: BufferedFrame[] = [];
  private isBuffering = false;
  private bufferAbortController: AbortController | null = null;

  constructor(config: MediaBunnyPlayerConfig) {
    this.nodeId = config.nodeId;
    this.onFrame = config.onFrame;
    this.onMetadata = config.onMetadata;
    this.onEnded = config.onEnded;
    this.onError = config.onError;
    this.onTimeUpdate = config.onTimeUpdate;
    this.onFirstFrame = config.onFirstFrame;
  }

  /**
   * Check if MediaBunny is supported (WebCodecs required).
   */
  static isSupported(): boolean {
    return typeof VideoDecoder !== 'undefined' && typeof VideoFrame !== 'undefined';
  }

  /**
   * Load a video file for playback (streams lazily via BlobSource).
   */
  async loadFile(file: File): Promise<void> {
    await this.loadSource(new BlobSource(file));
  }

  /**
   * Load a video from URL for playback (streams lazily via UrlSource with range requests).
   * This is much more efficient than fetching the whole file first.
   */
  async loadUrl(url: string): Promise<void> {
    await this.loadSource(new UrlSource(url));
  }

  /**
   * Common initialization logic for all source types.
   * Both BlobSource and UrlSource stream lazily - only fetching bytes as needed.
   */
  private async loadSource(source: Source): Promise<void> {
    try {
      // Clean up previous state
      this.cleanup();

      // Create MediaBunny input with the provided source
      this.input = new Input({
        formats: ALL_FORMATS,
        source
      });

      // Get video track
      this.videoTrack = await this.input.getPrimaryVideoTrack();
      if (!this.videoTrack) {
        throw new Error('No video track found in file');
      }

      // Check if codec is supported by the browser's WebCodecs
      const canDecode = await this.videoTrack.canDecode();

      if (!canDecode) {
        throw new Error(`Unsupported video codec: ${this.videoTrack.codec ?? 'unknown'}`);
      }

      // Create sample sink for decoding
      this.sink = new VideoSampleSink(this.videoTrack);

      // Extract metadata
      const duration = await this.videoTrack.computeDuration();
      const hasAudio = !!(await this.input.getPrimaryAudioTrack());

      // Get frame rate from packet stats (quick estimate from first 100 packets)
      const packetStats = await this.videoTrack.computePacketStats(100);
      const frameRate = packetStats.averagePacketRate;

      this._metadata = {
        duration: duration ?? 0,
        width: this.videoTrack.displayWidth,
        height: this.videoTrack.displayHeight,
        frameRate: frameRate ?? 30,
        codec: this.videoTrack.codec ?? 'unknown',
        hasAudio
      };

      this._isLoaded = true;
      this._currentTime = 0;
      this._paused = true;

      // Send metadata (guaranteed non-null at this point)
      this.onMetadata(this._metadata!);

      // Get first frame as preview
      await this.showPreviewFrame(0);
    } catch (error) {
      // Reset all state to avoid stale values from a partial load
      this.input?.dispose();
      this.input = null;
      this.videoTrack = null;
      this.sink = null;
      this._isLoaded = false;
      this._metadata = null;
      this._currentTime = 0;
      this._paused = true;

      this.onError(error instanceof Error ? error : new Error('Failed to load video'));
    }
  }

  /**
   * Load a Blob for playback.
   */
  async loadBlob(blob: Blob): Promise<void> {
    // BlobSource accepts both File and Blob
    await this.loadFile(blob as File);
  }

  /**
   * Show a single frame at the specified time (for preview/seeking).
   * Uses getSample() which is slower but necessary for random access.
   */
  private async showPreviewFrame(timeSeconds: number): Promise<void> {
    if (!this.sink) return;

    try {
      // Get sample at time (random access - slower, but ok for single frames)
      const sample = await this.sink.getSample(timeSeconds);
      if (!sample) return;

      // Cache timestamp before any operations that might close the sample
      const timestamp = sample.timestamp;
      this._currentTime = timestamp;

      // Convert to ImageBitmap with guaranteed cleanup
      const videoFrame = sample.toVideoFrame();
      try {
        // Skip flipY here - let CSS/GL handle it (flipY in createImageBitmap is slow ~11ms)
        const bitmap = await createImageBitmap(videoFrame);

        // Send to renderer
        this.onFrame(bitmap, timestamp * 1_000_000); // convert to microseconds

        // Notify first frame
        if (!this.firstFrameSent) {
          this.firstFrameSent = true;
          this.onFirstFrame?.();
        }
      } finally {
        videoFrame.close();
        sample.close();
      }
    } catch (error) {
      console.error('[MediaBunnyPlayer] Error showing preview frame:', error);
    }
  }

  /**
   * Start or resume playback.
   */
  play(): void {
    if (!this._isLoaded || !this._paused) return;

    this._paused = false;
    this.playbackStartTime = performance.now();
    this.playbackStartVideoTime = this._currentTime;

    // Start buffering frames from current position
    this.startBuffering(this._currentTime);

    // Start playback loop
    this.playbackLoop();
  }

  /**
   * Start buffering frames sequentially from the given time.
   * Uses the async iterator for efficient sequential decoding.
   */
  private async startBuffering(startTime: number): Promise<void> {
    if (!this.sink || this.isBuffering) return;

    // Cancel any existing buffering
    this.stopBuffering();

    this.isBuffering = true;
    this.bufferAbortController = new AbortController();
    const signal = this.bufferAbortController.signal;

    try {
      // Use samples() iterator starting from startTime
      // This is MUCH faster than getSample() per frame
      for await (const sample of this.sink.samples(startTime)) {
        // Check if we should stop
        if (signal.aborted || this._paused) {
          sample.close();
          break;
        }

        // Wait if buffer is full
        while (this.frameBuffer.length >= FRAME_BUFFER_SIZE && !signal.aborted) {
          await new Promise((resolve) => setTimeout(resolve, 16));
        }

        if (signal.aborted) {
          sample.close();
          break;
        }

        try {
          // Convert to ImageBitmap
          const videoFrame = sample.toVideoFrame();

          const bitmapStart = PROFILE_ENABLED ? performance.now() : 0;

          // Skip flipY here - let CSS/GL handle it (flipY in createImageBitmap is slow ~11ms)
          const bitmap = await createImageBitmap(videoFrame);
          const bitmapEnd = PROFILE_ENABLED ? performance.now() : 0;
          videoFrame.close();

          // Profile logging
          if (PROFILE_ENABLED) {
            bitmapProfiler.record(bitmapEnd - bitmapStart);
          }

          // Add to buffer
          this.frameBuffer.push({
            bitmap,
            timestamp: sample.timestamp
          });

          sample.close();
        } catch (error) {
          sample.close();
          console.error('[MediaBunnyPlayer] Error buffering frame:', error);
        }
      }
    } catch (error) {
      if (!signal.aborted) {
        console.error('[MediaBunnyPlayer] Buffering error:', error);

        // Propagate fatal decode errors to trigger fallback
        this.onError(error instanceof Error ? error : new Error('Decode failed'));
      }
    } finally {
      this.isBuffering = false;
    }
  }

  /**
   * Stop the buffering process.
   */
  private stopBuffering(): void {
    if (this.bufferAbortController) {
      this.bufferAbortController.abort();
      this.bufferAbortController = null;
    }
    this.isBuffering = false;
  }

  /**
   * Clear the frame buffer and close all bitmaps.
   */
  private clearBuffer(): void {
    for (const frame of this.frameBuffer) {
      frame.bitmap.close();
    }
    this.frameBuffer = [];
  }

  /**
   * Playback loop - displays buffered frames at correct timing.
   */
  private playbackLoop(): void {
    if (this._paused || !this._metadata) return;

    // Schedule next frame FIRST (non-blocking loop at 60fps)
    this.animationFrameId = requestAnimationFrame(() => this.playbackLoop());

    const now = performance.now();
    const elapsed = ((now - this.playbackStartTime) / 1000) * this._playbackRate;
    const targetTime = this.playbackStartVideoTime + elapsed;

    // Check if we've reached the end
    if (targetTime >= this._metadata.duration) {
      if (this._loop) {
        // Loop back to start
        this._currentTime = 0;
        this.playbackStartTime = performance.now();
        this.playbackStartVideoTime = 0;

        // Clear buffer and restart from beginning
        this.stopBuffering();
        this.clearBuffer();
        this.startBuffering(0);
      } else {
        this._paused = true;
        if (this.animationFrameId !== null) {
          cancelAnimationFrame(this.animationFrameId);
          this.animationFrameId = null;
        }
        this.stopBuffering();
        this.onEnded();
      }
      return;
    }

    // Find and display the frame closest to target time
    this.displayFrameAtTime(targetTime);
  }

  /**
   * Display the best frame from buffer for the target time.
   */
  private displayFrameAtTime(targetTime: number): void {
    if (this.frameBuffer.length === 0) return;

    // Find frames that are at or before target time
    let bestFrameIndex = -1;
    for (let i = 0; i < this.frameBuffer.length; i++) {
      if (this.frameBuffer[i].timestamp <= targetTime) {
        bestFrameIndex = i;
      } else {
        break; // Buffer is sorted, no need to continue
      }
    }

    if (bestFrameIndex === -1) {
      // No suitable frame yet, wait for buffer to fill
      return;
    }

    // Remove and close all frames before the best one (they're too old)
    for (let i = 0; i < bestFrameIndex; i++) {
      this.frameBuffer[i].bitmap.close();
    }
    this.frameBuffer.splice(0, bestFrameIndex);

    // Display the best frame
    const frame = this.frameBuffer.shift();
    if (frame) {
      this._currentTime = frame.timestamp;
      this.onFrame(frame.bitmap, frame.timestamp * 1_000_000); // convert to microseconds

      // Notify first frame
      if (!this.firstFrameSent) {
        this.firstFrameSent = true;
        this.onFirstFrame?.();
      }

      // Notify time update
      this.onTimeUpdate?.(this._currentTime);
    }
  }

  /**
   * Pause playback.
   */
  pause(): void {
    this._paused = true;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Stop buffering but keep existing buffer for resume
    this.stopBuffering();
  }

  /**
   * Seek to a specific time.
   */
  async seek(timeSeconds: number): Promise<void> {
    if (!this._isLoaded) return;

    const wasPlaying = !this._paused;
    if (wasPlaying) {
      this.pause();
    }

    // Clear buffer for new position
    this.stopBuffering();
    this.clearBuffer();

    // Show preview frame at seek position
    await this.showPreviewFrame(timeSeconds);

    // Force exact time when seeking to beginning (keyframe may not be at 0)
    if (timeSeconds === 0) {
      this._currentTime = 0;
    }

    if (wasPlaying) {
      this.playbackStartTime = performance.now();
      this.playbackStartVideoTime = this._currentTime;
      this._paused = false;
      this.startBuffering(this._currentTime);
      this.playbackLoop();
    }
  }

  /**
   * Set playback rate.
   */
  setPlaybackRate(rate: number): void {
    const wasPlaying = !this._paused;
    const currentVideoTime = this._currentTime;

    this._playbackRate = Math.max(0.25, Math.min(4, rate));

    // Reset timing to maintain position with new rate
    if (wasPlaying) {
      this.playbackStartTime = performance.now();
      this.playbackStartVideoTime = currentVideoTime;
    }
  }

  /**
   * Set loop mode.
   */
  setLoop(loop: boolean): void {
    this._loop = loop;
  }

  /**
   * Clean up internal resources.
   */
  private cleanup(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.stopBuffering();
    this.clearBuffer();

    // Dispose Input to cancel ongoing reads, close decoders, and free resources
    this.input?.dispose();
    this.input = null;

    // VideoSampleSink and InputVideoTrack are owned by Input and cleaned up via dispose()
    this.sink = null;
    this.videoTrack = null;
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.cleanup();
    this._metadata = null;
    this._isLoaded = false;
  }

  // Getters

  get currentTime(): number {
    return this._currentTime;
  }

  get duration(): number {
    return this._metadata?.duration ?? 0;
  }

  get paused(): boolean {
    return this._paused;
  }

  get loop(): boolean {
    return this._loop;
  }

  get playbackRate(): number {
    return this._playbackRate;
  }

  get metadata(): VideoMetadata | null {
    return this._metadata;
  }

  get isLoaded(): boolean {
    return this._isLoaded;
  }
}
