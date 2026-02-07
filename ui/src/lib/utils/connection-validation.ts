import { ANALYSIS_KEY } from '$lib/audio/v2/constants/fft';
import { AudioRegistry } from '$lib/registry/AudioRegistry';

import { handleToPortIndex } from './get-edge-types';

const audioRegistry = AudioRegistry.getInstance();

/**
 * Checks if a target inlet is an AudioParam by looking up the audio node metadata.
 *
 * @param objectName - The name of the target node (e.g., 'gain~', 'allpass~')
 * @param targetHandle - The handle ID of the target inlet
 * @returns true if the inlet is an AudioParam, false otherwise
 */
export function isAudioParamInlet(
  objectName: string | undefined,
  targetHandle: string | null | undefined
): boolean {
  if (objectName === undefined) return false;
  if (!objectName?.endsWith('~')) return false;

  const audioNodeClass = audioRegistry.get(objectName);
  if (!audioNodeClass?.inlets) return false;

  const inletIndex = handleToPortIndex(targetHandle ?? null);
  if (inletIndex === null || isNaN(inletIndex)) return false;

  const inlet = audioNodeClass.inlets[inletIndex];

  return inlet?.isAudioParam ?? false;
}

export interface ConnectionValidationOptions {
  /**
   * Whether the target inlet is an AudioParam.
   * AudioParams can accept both audio signals (for audio-rate modulation)
   * and message connections (for parameter automation).
   */
  isTargetAudioParam?: boolean;
}

/**
 * Validates if a connection between two handles is allowed based on their types.
 *
 * @param sourceHandle - The handle ID of the source (outlet)
 * @param targetHandle - The handle ID of the target (inlet)
 * @param options - Additional validation options
 * @returns true if the connection is valid, false otherwise
 */
export function isValidConnectionBetweenHandles(
  sourceHandle: string | null | undefined,
  targetHandle: string | null | undefined,
  options?: ConnectionValidationOptions
): boolean {
  if (!sourceHandle || !targetHandle) return false;

  // Normalize handles: treat untyped handles (in-0, out-1, in, out) as message handles
  // This handles dynamic nodes like p5, canvas.dom, js, etc. that don't specify type
  const normalizeHandle = (handle: string): string => {
    // If handle starts with a known type, keep it as-is
    if (
      handle.startsWith('video-') ||
      handle.startsWith('audio-') ||
      handle.startsWith('message-') ||
      handle.startsWith(ANALYSIS_KEY)
    ) {
      return handle;
    }

    // Default: treat untyped handles (in-X, out-X, in, out, etc.) as message handles
    return `message-${handle}`;
  };

  const normalizedSource = normalizeHandle(sourceHandle);
  const normalizedTarget = normalizeHandle(targetHandle);

  // Pre-compute handle type checks
  const isSourceAudio = normalizedSource.startsWith('audio');
  const isSourceVideo = normalizedSource.startsWith('video');
  const isSourceMessage = normalizedSource.startsWith('message');
  const isSourceAnalysis = normalizedSource.startsWith(ANALYSIS_KEY);

  const isTargetVideo = normalizedTarget.startsWith('video');
  const isTargetMessage = normalizedTarget.startsWith('message');
  const isTargetAudioInlet = normalizedTarget.startsWith('audio-in');

  // Audio params can accept both audio signals (e.g. gain~ out) and message connections (e.g. numbers)
  if (options?.isTargetAudioParam) {
    return isSourceAudio || isSourceMessage;
  }

  // Allow connecting `fft~` analysis result to message and video inlets (not audio inlets)
  // This check must come BEFORE the video check so analysis→video is allowed
  if (isSourceAnalysis) {
    return isTargetMessage || isTargetVideo;
  }

  // Video connections must be video-to-video only
  if (isSourceVideo || isTargetVideo) {
    return isSourceVideo && isTargetVideo;
  }

  // Target audio inlets (e.g. out~) must be connected to audio outputs/sources
  if (isTargetAudioInlet) {
    return isSourceAudio;
  }

  // Message-to-message connections are allowed
  if (isSourceMessage && isTargetMessage) {
    return true;
  }

  return false;
}

/**
 * Determines if a handle should accept connections from a given source handle type.
 * Used for dimming logic - dims handles that cannot accept connections from the source.
 *
 * @param sourceHandleId - The fully qualified handle ID (nodeId/handleId) or just handleId of the source
 * @param targetHandleId - The fully qualified handle ID (nodeId/handleId) or just handleId of the target
 * @param sourcePort - Whether the source is an 'inlet' or 'outlet'
 * @param targetPort - Whether the target is an 'inlet' or 'outlet'
 * @param options - Additional validation options
 * @returns true if the target can accept connections from the source, false otherwise
 */
export function canAcceptConnection(
  sourceHandleId: string,
  targetHandleId: string,
  sourcePort: 'inlet' | 'outlet',
  targetPort: 'inlet' | 'outlet',
  options?: ConnectionValidationOptions
): boolean {
  // Extract just the handle type from qualified IDs (remove nodeId/ prefix if present)
  const sourceHandle = sourceHandleId.includes('/') ? sourceHandleId.split('/')[1] : sourceHandleId;

  const targetHandle = targetHandleId.includes('/') ? targetHandleId.split('/')[1] : targetHandleId;

  // If connecting from an outlet, the target must be an inlet
  if (sourcePort === 'outlet' && targetPort !== 'inlet') {
    return false;
  }

  // If connecting from an inlet, the target must be an outlet
  if (sourcePort === 'inlet' && targetPort !== 'outlet') {
    return false;
  }

  // Use the main validation logic
  return isValidConnectionBetweenHandles(sourceHandle, targetHandle, options);
}
