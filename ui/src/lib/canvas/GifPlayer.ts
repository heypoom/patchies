/**
 * GifPlayer - Handles animated GIF playback for the video pipeline
 *
 * Uses ImageDecoder API when available (Chrome, Edge, etc.)
 * Pre-decodes all frames for smooth looping playback.
 * Falls back to static first frame on unsupported browsers (Safari)
 */

export type GifPlayerCallback = (bitmap: ImageBitmap) => void;

interface DecodedFrame {
  bitmap: ImageBitmap;
  duration: number; // milliseconds
}

export class GifPlayer {
  private animationId: number | null = null;
  private frames: DecodedFrame[] = [];
  private isPlaying = false;
  private onFrame: GifPlayerCallback | null = null;

  /**
   * Check if animated GIF playback is supported
   */
  static isSupported(): boolean {
    return typeof ImageDecoder !== 'undefined';
  }

  /**
   * Start playing a GIF, calling onFrame for each frame
   * Falls back to single frame if ImageDecoder is not available
   */
  async play(gifData: Uint8Array, onFrame: GifPlayerCallback): Promise<void> {
    this.stop();
    this.onFrame = onFrame;

    // Keep an independent copy of raw bytes for fallback (not shared with decoder)
    const rawCopy = new Uint8Array(gifData);

    const createFallbackBitmap = async () => {
      const blob = new Blob([rawCopy], { type: 'image/gif' });

      return createImageBitmap(blob);
    };

    // Feature detect ImageDecoder
    if (!GifPlayer.isSupported()) {
      const bitmap = await createFallbackBitmap();
      onFrame(bitmap);

      return;
    }

    let decoder: ImageDecoder | null = null;

    try {
      // Feed data via ReadableStream so Chrome correctly detects all GIF frames
      // (Chrome reports frameCount=1 with a BufferSource for some GIFs)
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(rawCopy);
          controller.close();
        }
      });

      decoder = new ImageDecoder({
        data: stream,
        type: 'image/gif'
      });

      await decoder.completed;

      const rawFrameCount = decoder.tracks.selectedTrack?.frameCount ?? 1;

      // Guard against Infinity/NaN
      const frameCount =
        !Number.isFinite(rawFrameCount) || rawFrameCount < 1 ? 1 : Math.min(rawFrameCount, 10000);

      // Pre-decode all frames
      this.frames = [];

      for (let i = 0; i < frameCount; i++) {
        const result = await decoder.decode({ frameIndex: i });
        const duration = Math.max(10, (result.image.duration ?? 100000) / 1000);

        try {
          const bitmap = await createImageBitmap(result.image);

          this.frames.push({ bitmap, duration });
        } finally {
          result.image.close();
        }
      }

      // Close decoder - we don't need it anymore
      decoder.close();
      decoder = null;

      // Start playback loop
      this.isPlaying = true;
      this.playLoop(0);
    } catch (err) {
      console.warn('[GifPlayer] ImageDecoder failed, falling back to static frame:', err);

      // Clean up decoder and any partially decoded frames
      if (decoder) {
        try {
          decoder.close();
        } catch {
          // Ignore
        }
      }

      for (const frame of this.frames) {
        frame.bitmap.close();
      }

      this.frames = [];

      // Fallback to static frame (wrapped to prevent unhandled rejection)
      try {
        const bitmap = await createFallbackBitmap();
        onFrame(bitmap);
      } catch (fallbackErr) {
        console.warn('[GifPlayer] Fallback also failed:', fallbackErr);
      }
    }
  }

  /**
   * Internal playback loop - cycles through pre-decoded frames
   */
  private async playLoop(frameIndex: number): Promise<void> {
    if (!this.isPlaying || this.frames.length === 0 || !this.onFrame) return;

    const frame = this.frames[frameIndex];

    if (frame) {
      // Create a copy of the bitmap since GLSystem may transfer/neuter it
      const bitmapCopy = await createImageBitmap(frame.bitmap);

      if (!this.isPlaying) {
        bitmapCopy.close();
        return;
      }

      this.onFrame(bitmapCopy);
    }

    // Schedule next frame
    const nextIndex = (frameIndex + 1) % this.frames.length;

    this.animationId = window.setTimeout(() => {
      this.playLoop(nextIndex);
    }, frame?.duration ?? 0);
  }

  /**
   * Stop playback and clean up resources
   */
  stop(): void {
    this.isPlaying = false;
    this.onFrame = null;

    if (this.animationId !== null) {
      clearTimeout(this.animationId);
      this.animationId = null;
    }

    // Close all stored bitmaps
    for (const frame of this.frames) {
      frame.bitmap.close();
    }

    this.frames = [];
  }

  /**
   * Check if currently playing
   */
  get playing(): boolean {
    return this.isPlaying;
  }
}
