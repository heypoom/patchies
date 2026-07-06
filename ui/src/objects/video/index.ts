/**
 * Video utilities module
 *
 * Provides WebCodecs-based video capture and playback with
 * HTMLVideoElement fallback for unsupported browsers.
 */

export {
  webCodecsSupport,
  isCodecSupported,
  getWebCodecsSupportInfo
} from '$lib/video/feature-detection';
export { WebCodecsCapture, type WebCodecsCaptureConfig } from '$objects/video/WebCodecsCapture';
export {
  MediaBunnyPlayer,
  type VideoMetadata,
  type MediaBunnyPlayerConfig
} from '$lib/video/MediaBunnyPlayer';
export {
  VideoProfiler,
  type VideoStats,
  type WorkerQueueStats
} from '$objects/video/VideoProfiler';
