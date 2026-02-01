/**
 * Video utilities module
 *
 * Provides WebCodecs-based video capture and playback with
 * HTMLVideoElement fallback for unsupported browsers.
 */

export { webCodecsSupport, isCodecSupported, getWebCodecsSupportInfo } from './feature-detection';
export { WebCodecsCapture, type WebCodecsCaptureConfig } from './WebCodecsCapture';
export {
  MediaBunnyPlayer,
  type VideoMetadata,
  type MediaBunnyPlayerConfig
} from './MediaBunnyPlayer';
export { VideoProfiler, type VideoStats, type WorkerQueueStats } from './VideoProfiler';
