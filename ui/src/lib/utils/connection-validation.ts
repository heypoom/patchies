import { ANALYSIS_KEY } from '$lib/audio/v2/constants/fft';

/**
 * Validates if a connection between two handles is allowed based on their types.
 *
 * @param sourceHandle - The handle ID of the source (outlet)
 * @param targetHandle - The handle ID of the target (inlet)
 * @returns true if the connection is valid, false otherwise
 */
export function isValidConnectionBetweenHandles(
	sourceHandle: string | null | undefined,
	targetHandle: string | null | undefined
): boolean {
	if (!sourceHandle || !targetHandle) return false;

	// Allow connecting `fft~` analysis result to anything except audio inlets.
	if (sourceHandle.startsWith(ANALYSIS_KEY)) {
		return !targetHandle.startsWith('audio-in');
	}

	// Video connections: both handles must be video or gl types
	if (sourceHandle.startsWith('video') || targetHandle.startsWith('video')) {
		return !!(
			(sourceHandle.startsWith('video') || sourceHandle.startsWith('gl')) &&
			(targetHandle.startsWith('video') || targetHandle.startsWith('gl'))
		);
	}

	// Audio inlets must come from audio sources (for audio synthesis chains)
	// But audio outlets can connect to message inlets (for parameter automation)
	if (targetHandle.startsWith('audio-in')) {
		return !!sourceHandle.startsWith('audio');
	}

	// Audio outlets can connect to non-audio targets (message inlets for automation)
	// Message connections are always allowed
	return true;
}

/**
 * Determines if a handle should accept connections from a given source handle type.
 * Used for dimming logic - dims handles that cannot accept connections from the source.
 *
 * @param sourceHandleId - The fully qualified handle ID (nodeId/handleId) or just handleId of the source
 * @param targetHandleId - The fully qualified handle ID (nodeId/handleId) or just handleId of the target
 * @param sourcePort - Whether the source is an 'inlet' or 'outlet'
 * @param targetPort - Whether the target is an 'inlet' or 'outlet'
 * @returns true if the target can accept connections from the source, false otherwise
 */
export function canAcceptConnection(
	sourceHandleId: string,
	targetHandleId: string,
	sourcePort: 'inlet' | 'outlet',
	targetPort: 'inlet' | 'outlet'
): boolean {
	// Extract just the handle type from qualified IDs (remove nodeId/ prefix if present)
	const sourceHandle = sourceHandleId.includes('/')
		? sourceHandleId.split('/')[1]
		: sourceHandleId;

	const targetHandle = targetHandleId.includes('/')
		? targetHandleId.split('/')[1]
		: targetHandleId;

	// If connecting from an outlet, the target must be an inlet
	if (sourcePort === 'outlet' && targetPort !== 'inlet') {
		return false;
	}

	// If connecting from an inlet, the target must be an outlet
	if (sourcePort === 'inlet' && targetPort !== 'outlet') {
		return false;
	}

	// Use the main validation logic
	return isValidConnectionBetweenHandles(sourceHandle, targetHandle);
}
