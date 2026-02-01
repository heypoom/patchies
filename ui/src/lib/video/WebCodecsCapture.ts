/**
 * WebCodecsCapture - Webcam capture using MediaStreamTrackProcessor
 *
 * Uses WebCodecs APIs to capture webcam frames more efficiently than HTMLVideoElement.
 * Processes frames in a dedicated worker to offload work from the main thread.
 *
 * Browser support: Chrome 94+, Edge 94+, Safari 16.4+
 * Falls back to HTMLVideoElement on Firefox.
 */

import { webCodecsSupport } from './feature-detection';
import type {
  VideoFrameWorkerMessage,
  VideoFrameWorkerResponse
} from '$workers/video/videoFrameWorker';
import VideoFrameWorker from '$workers/video/videoFrameWorker?worker';

export interface WebCodecsCaptureConfig {
  nodeId: string;
  onFrame: (bitmap: ImageBitmap) => void;
  onError: (error: Error) => void;
  flipY?: boolean;
}

export class WebCodecsCapture {
  private nodeId: string;
  private onFrame: (bitmap: ImageBitmap) => void;
  private onError: (error: Error) => void;
  private flipY: boolean;

  private worker: Worker | null = null;
  private stream: MediaStream | null = null;
  private processor: MediaStreamTrackProcessor<VideoFrame> | null = null;
  private reader: ReadableStreamDefaultReader<VideoFrame> | null = null;
  private isRunning = false;
  private isPaused = false;

  /**
   * Check if WebCodecs webcam capture is supported in the current browser.
   */
  static isSupported(): boolean {
    return webCodecsSupport.webcamFull;
  }

  constructor(config: WebCodecsCaptureConfig) {
    this.nodeId = config.nodeId;
    this.onFrame = config.onFrame;
    this.onError = config.onError;
    this.flipY = config.flipY ?? true;
  }

  /**
   * Start capturing frames from the given MediaStream.
   */
  async start(stream: MediaStream): Promise<void> {
    if (this.isRunning) {
      console.warn('[WebCodecsCapture] Already running');
      return;
    }

    try {
      this.stream = stream;
      const videoTrack = stream.getVideoTracks()[0];

      if (!videoTrack) {
        throw new Error('No video track in stream');
      }

      // Create the worker
      this.worker = new VideoFrameWorker();
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = (e) => {
        this.onError(new Error(`Worker error: ${e.message}`));
      };

      // Configure the worker
      const configMessage: VideoFrameWorkerMessage = {
        type: 'setConfig',
        nodeId: this.nodeId,
        flipY: this.flipY
      };
      this.worker.postMessage(configMessage);

      // Create MediaStreamTrackProcessor to get VideoFrames
      this.processor = new MediaStreamTrackProcessor({ track: videoTrack });
      this.reader = this.processor.readable.getReader();

      this.isRunning = true;
      this.isPaused = false;

      // Start reading frames
      this.readFrames();

      // Handle track ending
      videoTrack.onended = () => {
        this.stop();
      };
    } catch (error) {
      this.onError(error instanceof Error ? error : new Error('Failed to start capture'));
      this.cleanup();
    }
  }

  /**
   * Read frames from the MediaStreamTrackProcessor and send to worker.
   */
  private async readFrames(): Promise<void> {
    if (!this.reader || !this.worker) return;

    while (this.isRunning) {
      try {
        const { value: frame, done } = await this.reader.read();

        if (done) {
          break;
        }

        if (frame && !this.isPaused) {
          // Transfer the frame to the worker for processing
          const message: VideoFrameWorkerMessage = {
            type: 'processFrame',
            nodeId: this.nodeId,
            frame
          };

          // Transfer the VideoFrame to the worker
          this.worker.postMessage(message, [frame]);
        } else if (frame) {
          // If paused, close the frame to avoid memory leak
          frame.close();
        }
      } catch (error) {
        if (this.isRunning) {
          // Only report error if we're supposed to be running
          console.error('[WebCodecsCapture] Error reading frame:', error);
        }
        break;
      }
    }
  }

  /**
   * Handle messages from the worker.
   */
  private handleWorkerMessage(event: MessageEvent<VideoFrameWorkerResponse>): void {
    const message = event.data;

    switch (message.type) {
      case 'frameReady':
        if (message.nodeId === this.nodeId) {
          this.onFrame(message.bitmap);
        }
        break;

      case 'error':
        if (message.nodeId === this.nodeId) {
          this.onError(new Error(message.message));
        }
        break;

      case 'destroyed':
        // Worker cleaned up successfully
        break;
    }
  }

  /**
   * Pause frame capture (frames are discarded).
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume frame capture after pause.
   */
  resume(): void {
    this.isPaused = false;
  }

  /**
   * Stop capturing and clean up resources.
   */
  stop(): void {
    this.isRunning = false;
    this.cleanup();
  }

  /**
   * Clean up all resources.
   */
  private cleanup(): void {
    // Cancel the reader
    if (this.reader) {
      this.reader.cancel().catch(() => {
        // Ignore cancel errors
      });
      this.reader = null;
    }

    // Clean up processor
    this.processor = null;

    // Stop the stream tracks
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    // Destroy the worker
    if (this.worker) {
      const destroyMessage: VideoFrameWorkerMessage = {
        type: 'destroy',
        nodeId: this.nodeId
      };
      this.worker.postMessage(destroyMessage);

      // Terminate after giving it time to clean up
      setTimeout(() => {
        this.worker?.terminate();
        this.worker = null;
      }, 100);
    }
  }

  /**
   * Check if capture is currently running.
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Check if capture is currently paused.
   */
  get paused(): boolean {
    return this.isPaused;
  }
}
