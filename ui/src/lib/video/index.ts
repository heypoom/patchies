/**
 * Video utilities module
 *
 * Provides WebCodecs-based video capture and playback with
 * HTMLVideoElement fallback for unsupported browsers.
 */

export { webCodecsSupport, isCodecSupported, getWebCodecsSupportInfo } from './feature-detection';
export { WebCodecsCapture, type WebCodecsCaptureConfig } from './WebCodecsCapture';
export { WebCodecsPlayer, type WebCodecsPlayerConfig, type VideoMetadata } from './WebCodecsPlayer';
export { VideoProfiler, type VideoStats } from './VideoProfiler';
