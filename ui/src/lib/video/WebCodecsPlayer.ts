/**
 * WebCodecsPlayer - Video file playback using WebCodecs
 *
 * Uses WebCodecs VideoDecoder and MP4Box.js for efficient video decoding.
 * Supports streaming from large files (5GB+) without loading into memory.
 *
 * Browser support: Chrome 94+, Edge 94+, Safari 16.4+
 * Falls back to HTMLVideoElement on Firefox.
 */

import { webCodecsSupport } from './feature-detection';
import type {
  VideoDecoderWorkerMessage,
  VideoDecoderWorkerResponse,
  VideoMetadata
} from '$workers/video/videoDecoderWorker';
import VideoDecoderWorker from '$workers/video/videoDecoderWorker?worker';

export type { VideoMetadata };

export interface WebCodecsPlayerConfig {
  nodeId: string;
  onFrame: (bitmap: ImageBitmap, timestamp: number) => void;
  onMetadata: (metadata: VideoMetadata) => void;
  onEnded: () => void;
  onError: (error: Error) => void;
}

export class WebCodecsPlayer {
  private nodeId: string;
  private onFrame: (bitmap: ImageBitmap, timestamp: number) => void;
  private onMetadata: (metadata: VideoMetadata) => void;
  private onEnded: () => void;
  private onError: (error: Error) => void;

  private worker: Worker | null = null;
  private _metadata: VideoMetadata | null = null;
  private _currentTime = 0;
  private _paused = true;
  private _loop = true;
  private _playbackRate = 1;
  private _isLoaded = false;

  /**
   * Check if WebCodecs video playback is supported in the current browser.
   */
  static isSupported(): boolean {
    return webCodecsSupport.videoFileFull;
  }

  constructor(config: WebCodecsPlayerConfig) {
    this.nodeId = config.nodeId;
    this.onFrame = config.onFrame;
    this.onMetadata = config.onMetadata;
    this.onEnded = config.onEnded;
    this.onError = config.onError;
  }

  /**
   * Load a video file for playback.
   */
  async loadFile(file: File): Promise<void> {
    try {
      // Create or reuse worker
      if (!this.worker) {
        this.worker = new VideoDecoderWorker();
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
        this.worker.onerror = (e) => {
          this.onError(new Error(`Worker error: ${e.message}`));
        };
      }

      // Reset state
      this._isLoaded = false;
      this._currentTime = 0;
      this._paused = true;

      // Send file to worker
      const message: VideoDecoderWorkerMessage = {
        type: 'loadFile',
        nodeId: this.nodeId,
        file
      };

      // Transfer the file to the worker
      this.worker.postMessage(message);
    } catch (error) {
      this.onError(error instanceof Error ? error : new Error('Failed to load file'));
    }
  }

  /**
   * Load a Blob for playback.
   */
  async loadBlob(blob: Blob): Promise<void> {
    try {
      if (!this.worker) {
        this.worker = new VideoDecoderWorker();
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
        this.worker.onerror = (e) => {
          this.onError(new Error(`Worker error: ${e.message}`));
        };
      }

      this._isLoaded = false;
      this._currentTime = 0;
      this._paused = true;

      const message: VideoDecoderWorkerMessage = {
        type: 'loadBlob',
        nodeId: this.nodeId,
        blob
      };

      this.worker.postMessage(message);
    } catch (error) {
      this.onError(error instanceof Error ? error : new Error('Failed to load blob'));
    }
  }

  /**
   * Handle messages from the decoder worker.
   */
  private handleWorkerMessage(event: MessageEvent<VideoDecoderWorkerResponse>): void {
    const message = event.data;

    if (message.nodeId !== this.nodeId) return;

    switch (message.type) {
      case 'metadata':
        this._metadata = message.metadata;
        this._isLoaded = true;
        this.onMetadata(message.metadata);
        break;

      case 'frameReady':
        this._currentTime = message.currentTime;
        this.onFrame(message.bitmap, message.timestamp);
        break;

      case 'seeked':
        this._currentTime = message.currentTime;
        break;

      case 'ended':
        if (this._loop) {
          this.seek(0);
          this.play();
        } else {
          this._paused = true;
          this.onEnded();
        }
        break;

      case 'error':
        this.onError(new Error(message.message));
        break;

      case 'destroyed':
        // Worker cleaned up successfully
        break;
    }
  }

  /**
   * Start or resume playback.
   */
  play(): void {
    if (!this.worker || !this._isLoaded) return;

    this._paused = false;

    const message: VideoDecoderWorkerMessage = {
      type: 'play',
      nodeId: this.nodeId
    };
    this.worker.postMessage(message);
  }

  /**
   * Pause playback.
   */
  pause(): void {
    if (!this.worker) return;

    this._paused = true;

    const message: VideoDecoderWorkerMessage = {
      type: 'pause',
      nodeId: this.nodeId
    };
    this.worker.postMessage(message);
  }

  /**
   * Seek to a specific time.
   * @param timeSeconds Time in seconds to seek to
   */
  seek(timeSeconds: number): void {
    if (!this.worker || !this._isLoaded) return;

    const message: VideoDecoderWorkerMessage = {
      type: 'seek',
      nodeId: this.nodeId,
      timeSeconds
    };
    this.worker.postMessage(message);
  }

  /**
   * Set playback rate.
   * @param rate Playback rate (0.25 to 4.0)
   */
  setPlaybackRate(rate: number): void {
    this._playbackRate = Math.max(0.25, Math.min(4, rate));

    if (!this.worker) return;

    const message: VideoDecoderWorkerMessage = {
      type: 'setPlaybackRate',
      nodeId: this.nodeId,
      rate: this._playbackRate
    };
    this.worker.postMessage(message);
  }

  /**
   * Set loop mode.
   */
  setLoop(loop: boolean): void {
    this._loop = loop;

    if (!this.worker) return;

    const message: VideoDecoderWorkerMessage = {
      type: 'setLoop',
      nodeId: this.nodeId,
      loop
    };
    this.worker.postMessage(message);
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    if (this.worker) {
      const message: VideoDecoderWorkerMessage = {
        type: 'destroy',
        nodeId: this.nodeId
      };
      this.worker.postMessage(message);

      setTimeout(() => {
        this.worker?.terminate();
        this.worker = null;
      }, 100);
    }

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
