/**
 * WebCodecs feature detection utilities.
 *
 * Used to determine which video processing pipeline to use:
 * - WebCodecs path for Chrome 94+, Edge 94+, Safari 16.4+
 * - HTMLVideoElement fallback for Firefox and older browsers
 */

/**
 * Check if the current browser is Firefox.
 * Firefox has experimental WebCodecs support but it's significantly slower
 * than the HTMLVideoElement fallback, so we explicitly disable it.
 */
function isFirefox(): boolean {
  return typeof navigator !== 'undefined' && /Firefox/i.test(navigator.userAgent);
}

export const webCodecsSupport = {
  /**
   * MediaStreamTrackProcessor support for webcam frame extraction.
   * Allows getting VideoFrames directly from camera stream.
   */
  get webcam(): boolean {
    return typeof MediaStreamTrackProcessor !== 'undefined';
  },

  /**
   * VideoDecoder support for video file decoding.
   * Allows decoding video files without HTMLVideoElement.
   */
  get videoDecoder(): boolean {
    return typeof VideoDecoder !== 'undefined';
  },

  /**
   * VideoFrame support (required for both webcam and video processing).
   */
  get videoFrame(): boolean {
    return typeof VideoFrame !== 'undefined';
  },

  /**
   * EncodedVideoChunk support (required for video file decoding).
   */
  get encodedVideoChunk(): boolean {
    return typeof EncodedVideoChunk !== 'undefined';
  },

  /**
   * Full webcam WebCodecs support.
   * Requires MediaStreamTrackProcessor and VideoFrame.
   */
  get webcamFull(): boolean {
    return this.webcam && this.videoFrame;
  },

  /**
   * Full video file WebCodecs support.
   * Requires VideoDecoder, VideoFrame, and EncodedVideoChunk.
   * Disabled on Firefox due to poor performance (HTMLVideoElement fallback is faster).
   */
  get videoFileFull(): boolean {
    if (isFirefox()) return false;

    return this.videoDecoder && this.videoFrame && this.encodedVideoChunk;
  }
};

/**
 * Check if a specific video codec is supported by VideoDecoder.
 * Common codecs: 'avc1.42E01E' (H.264), 'vp8', 'vp09.00.10.08' (VP9), 'av01.0.04M.08' (AV1)
 */
export async function isCodecSupported(codec: string): Promise<boolean> {
  if (!webCodecsSupport.videoDecoder) return false;

  try {
    const support = await VideoDecoder.isConfigSupported({
      codec,

      // Minimal config for support check
      codedWidth: 1920,
      codedHeight: 1080
    });
    return support.supported === true;
  } catch {
    return false;
  }
}

/**
 * Get a human-readable string of supported features for debugging.
 */
export function getWebCodecsSupportInfo(): string {
  const features = [
    `browser: ${isFirefox() ? 'Firefox (forced fallback)' : 'other'}`,
    `webcam: ${webCodecsSupport.webcam}`,
    `videoDecoder: ${webCodecsSupport.videoDecoder}`,
    `videoFrame: ${webCodecsSupport.videoFrame}`,
    `encodedVideoChunk: ${webCodecsSupport.encodedVideoChunk}`,
    `webcamFull: ${webCodecsSupport.webcamFull}`,
    `videoFileFull: ${webCodecsSupport.videoFileFull}`
  ];

  return features.join(', ');
}
