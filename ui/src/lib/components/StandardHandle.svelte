<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { getPortPosition } from '$lib/utils/node-utils';
	import { match, P } from 'ts-pattern';
	import { ANALYSIS_KEY } from '$lib/audio/v2/constants/fft';
	import { isConnectionMode, isConnecting, connectingFromHandleId } from '../../stores/ui.store';
	import { canAcceptConnection } from '$lib/utils/connection-validation';

	interface Props {
		port: 'inlet' | 'outlet';
		type?: 'video' | 'audio' | 'message' | 'analysis';
		id?: string | number;
		title?: string;
		total: number;
		index: number;
		class?: string;
		nodeId: string;
		isAudioParam?: boolean;
	}

	let { port, type, id, title, total, index, class: className = '', nodeId, isAudioParam = false }: Props = $props();

	// Construct the handle ID based on the specification
	const handleId = $derived.by(() => {
		const portDir = port === 'inlet' ? 'in' : 'out';

		return match({ type, id })
			.with({ type: P.string, id: P.not(P.nullish) }, ({ type, id }) => `${type}-${portDir}-${id}`)
			.with({ type: P.string, id: P.nullish }, ({ type }) => `${type}-${portDir}`)
			.with({ type: P.nullish, id: P.not(P.nullish) }, ({ id }) => `${portDir}-${id}`)
			.otherwise(() => port);
	});

	// Determine handle type and position using ts-pattern
	const handleType = match(port)
		.with('inlet', () => 'target' as const)
		.with('outlet', () => 'source' as const)
		.exhaustive();

	const handlePosition = match(port)
		.with('inlet', () => Position.Top)
		.with('outlet', () => Position.Bottom)
		.exhaustive();

	// Calculate position using getPortPosition
	const positionStyle = $derived(`left: ${getPortPosition(total, index)}`);

	// Construct the fully qualified handle identifier (nodeId + handleId)
	const qualifiedHandleId = $derived(`${nodeId}/${handleId}`);

	// Determine if this AudioParam inlet should highlight as "audio-compatible"
	// when dragging from an audio outlet (e.g. gain~ audio-out)
	const shouldShowAsAudioCompatible = $derived.by(() => {
		if (!$isConnecting || !$connectingFromHandleId) return false;
		if (!isAudioParam || port !== 'inlet') return false;

		// Check if dragging from an audio outlet
		return $connectingFromHandleId.includes('audio-out');
	});

	// Determine if this handle should be dimmed
	const shouldDim = $derived.by(() => {
		// Only dim when actively connecting
		if (!$isConnecting || !$connectingFromHandleId) return false;

		// Don't dim the handle that initiated the connection (compare fully qualified IDs)
		if ($connectingFromHandleId === qualifiedHandleId) return false;

		// Determine if the connecting handle is an inlet or outlet by checking for -in or -out
		// Handle patterns: "audio-out", "audio-out-0", "message-in", "out-0", "in-1", etc.
		const connectingIsOutlet = $connectingFromHandleId.includes('-out');
		const connectingIsInlet = $connectingFromHandleId.includes('-in');

		// Determine the source port type (what initiated the connection)
		const sourcePort: 'inlet' | 'outlet' = connectingIsOutlet ? 'outlet' : 'inlet';

		// If connecting from an outlet, dim ALL outlets (user should select an inlet)
		if (connectingIsOutlet && port === 'outlet') {
			return true;
		}

		// If connecting from an inlet, dim ALL inlets (user should select an outlet)
		if (connectingIsInlet && port === 'inlet') {
			return true;
		}

		// Check if this handle can accept a connection from the source based on validation rules
		// If the connection would be invalid, dim this handle
		const wouldBeValidConnection = canAcceptConnection(
			$connectingFromHandleId,
			qualifiedHandleId,
			sourcePort,
			port,
			{ isTargetAudioParam: isAudioParam }
		);

		if (!wouldBeValidConnection) {
			return true;
		}

		return false;
	});

	// Determine handle color based on type using ts-pattern
	const handleClass = $derived.by(() => {
		// Override color to blue when AudioParam inlet is compatible with audio source being dragged
		const effectiveType = shouldShowAsAudioCompatible ? 'audio' : type;

		// Don't apply hover colors when dimmed
		const colorClass = shouldDim
			? match(effectiveType)
					.with('video', () => '!bg-orange-500')
					.with('audio', () => '!bg-blue-500')
					.with('message', () => '!bg-gray-500')
					.with(ANALYSIS_KEY, () => '!bg-purple-500')
					.with(P.nullish, () => '!bg-gray-500')
					.exhaustive()
			: match(effectiveType)
					.with('video', () => '!bg-orange-500 hover:!bg-orange-400')
					.with('audio', () => '!bg-blue-500 hover:!bg-blue-400')
					.with('message', () => '!bg-gray-500 hover:!bg-gray-400')
					.with(ANALYSIS_KEY, () => '!bg-purple-500 hover:!bg-purple-400')
					.with(P.nullish, () => '!bg-gray-500 hover:!bg-gray-400')
					.exhaustive();

		const connectionModeClass = $isConnectionMode ? 'connection-mode-active' : '';
		const dimClass = shouldDim ? 'handle-dimmed' : '';

		return `!absolute z-1 ${colorClass} ${connectionModeClass} ${dimClass} ${className}`;
	});
</script>

<Handle
	type={handleType}
	position={handlePosition}
	id={handleId}
	class={handleClass}
	style={positionStyle}
	{title}
/>

<style>
	:global(.svelte-flow__handle) {
		min-width: 6px;
		min-height: 6px;
		width: 7px;
		height: 7px;
		will-change: width, height, opacity, filter;
		transition:
			width 0.2s ease-in,
			height 0.2s ease-in,
			opacity 0.2s ease-in,
			filter 0.2s ease-in;
	}

	:global(.svelte-flow__handle):hover {
		min-width: 10px;
		min-height: 10px;
		width: 11px;
		height: 11px;
	}

	/* Make handles REALLY BIG and touch-friendly in connection mode */
	:global(.svelte-flow__handle.connection-mode-active) {
		min-width: 12px !important;
		min-height: 12px !important;
		width: 14px !important;
		height: 14px !important;
		z-index: 100 !important;
		cursor: pointer !important;
		box-shadow: 0 0 8px rgba(255, 255, 255, 0.2) !important;
	}

	:global(.svelte-flow__handle.connection-mode-active.connecting) {
		background: red !important;
	}

	/* Dim handles when in connecting state - JavaScript-controlled via handle-dimmed class */
	:global(.svelte-flow__handle.handle-dimmed) {
		opacity: 0.25 !important;
		filter: grayscale(0.7) brightness(0.6) !important;
		pointer-events: none !important;
		cursor: not-allowed !important;
	}
</style>
