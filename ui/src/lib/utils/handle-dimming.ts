import { canAcceptConnection } from './connection-validation';

/**
 * Determines if a handle should be dimmed during active connection.
 *
 * @param params.isConnecting - Whether a connection is currently being dragged
 * @param params.connectingFromHandleId - Fully qualified handle ID of the source (e.g., "node-123/message-out")
 * @param params.currentHandleQualifiedId - Fully qualified handle ID of this handle (e.g., "node-456/message-in-0")
 * @param params.currentHandlePort - Whether this handle is an 'inlet' or 'outlet'
 * @param params.isAudioParam - Whether this handle is an AudioParam inlet
 * @returns true if the handle should be dimmed, false otherwise
 */
export function shouldDimHandle(params: {
	isConnecting: boolean;
	connectingFromHandleId: string | null;
	currentHandleQualifiedId: string;
	currentHandlePort: 'inlet' | 'outlet';
	isAudioParam: boolean;
}): boolean {
	const {
		isConnecting,
		connectingFromHandleId,
		currentHandleQualifiedId,
		currentHandlePort,
		isAudioParam
	} = params;

	// Only dim when actively connecting
	if (!isConnecting || !connectingFromHandleId) return false;

	// Don't dim the handle that initiated the connection (compare fully qualified IDs)
	if (connectingFromHandleId === currentHandleQualifiedId) return false;

	// Determine if the connecting handle is an inlet or outlet
	// Handle patterns:
	//   - Typed: "audio-out", "audio-out-0", "message-in", "message-in-1"
	//   - Untyped: "out-0", "in-1", "out", "in"
	//   - Fallback: "outlet", "inlet"
	// Extract just the handle ID (remove nodeId/ prefix if present)
	const connectingHandleId = connectingFromHandleId.split('/')[1] || connectingFromHandleId;

	// Check for outlet: typed (-out), untyped (starts with out-), or exact match
	const connectingIsOutlet =
		connectingHandleId.includes('-out') ||
		connectingHandleId.startsWith('out-') ||
		connectingHandleId === 'out' ||
		connectingHandleId === 'outlet';

	// Check for inlet: typed (-in), untyped (starts with in-), or exact match
	const connectingIsInlet =
		connectingHandleId.includes('-in') ||
		connectingHandleId.startsWith('in-') ||
		connectingHandleId === 'in' ||
		connectingHandleId === 'inlet';

	// Determine the source port type (what initiated the connection)
	const sourcePort: 'inlet' | 'outlet' = connectingIsOutlet ? 'outlet' : 'inlet';

	// If connecting from an outlet, dim ALL outlets (user should select an inlet)
	if (connectingIsOutlet && currentHandlePort === 'outlet') {
		return true;
	}

	// If connecting from an inlet, dim ALL inlets (user should select an outlet)
	if (connectingIsInlet && currentHandlePort === 'inlet') {
		return true;
	}

	// Check if this handle can accept a connection from the source based on validation rules
	// If the connection would be invalid, dim this handle
	const wouldBeValidConnection = canAcceptConnection(
		connectingFromHandleId,
		currentHandleQualifiedId,
		sourcePort,
		currentHandlePort,
		{ isTargetAudioParam: isAudioParam }
	);

	if (!wouldBeValidConnection) {
		return true;
	}

	return false;
}
