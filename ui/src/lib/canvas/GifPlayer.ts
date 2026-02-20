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

    // Ensure we have a plain ArrayBuffer (not SharedArrayBuffer)
    const buffer = gifData.buffer.slice(
      gifData.byteOffset,
      gifData.byteOffset + gifData.byteLength
    ) as ArrayBuffer;

    // Helper to create blob for fallback
    const createFallbackBitmap = async () => {
      const blob = new Blob([buffer], { type: 'image/gif' });

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
      decoder = new ImageDecoder({
        data: buffer,
        type: 'image/gif'
      });

      await decoder.completed;

      const frameCount = decoder.tracks.selectedTrack?.frameCount ?? 1;

      // Pre-decode all frames
      this.frames = [];
      for (let i = 0; i < frameCount; i++) {
        const result = await decoder.decode({ frameIndex: i });
        const bitmap = await createImageBitmap(result.image);
        const duration = Math.max(10, (result.image.duration ?? 100000) / 1000);
        result.image.close();
        this.frames.push({ bitmap, duration });
      }

      // Close decoder - we don't need it anymore
      decoder.close();
      decoder = null;

      // Start playback loop
      this.isPlaying = true;
      this.playLoop(0);
    } catch {
      // Clean up decoder on error
      if (decoder) {
        try {
          decoder.close();
        } catch {
          // Ignore
        }
      }
      // Fallback to static frame
      const bitmap = await createFallbackBitmap();
      onFrame(bitmap);
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
    this.animationId = window.setTimeout(() => this.playLoop(nextIndex), frame?.duration ?? 0);
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
