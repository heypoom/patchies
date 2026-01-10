<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { getPortPosition } from '$lib/utils/node-utils';
	import { match, P } from 'ts-pattern';
	import { ANALYSIS_KEY } from '$lib/audio/v2/constants/fft';
	import { isConnectionMode } from '../../stores/ui.store';

	interface Props {
		port: 'inlet' | 'outlet';
		type?: 'video' | 'audio' | 'message' | 'analysis';
		id?: string | number;
		title?: string;
		total: number;
		index: number;
		class?: string;
	}

	let { port, type, id, title, total, index, class: className = '' }: Props = $props();

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

	// Determine handle color based on type using ts-pattern
	const handleClass = $derived.by(() => {
		const colorClass = match(type)
			.with('video', () => '!bg-orange-500 hover:!bg-orange-400')
			.with('audio', () => '!bg-blue-500 hover:!bg-blue-400')
			.with('message', () => '!bg-gray-500 hover:!bg-gray-400')
			.with(ANALYSIS_KEY, () => '!bg-purple-500 hover:!bg-purple-400')
			.with(P.nullish, () => '!bg-gray-500 hover:!bg-gray-400')
			.exhaustive();

		const connectionModeClass = $isConnectionMode ? 'connection-mode-active' : '';

		return `!absolute z-1 ${colorClass} ${connectionModeClass} ${className}`;
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
		will-change: width, height;
		transition:
			width 0.2s ease-in,
			height 0.2s ease-in;
	}

	:global(.svelte-flow__handle):hover {
		min-width: 10px;
		min-height: 10px;
		width: 11px;
		height: 11px;
	}

	/* Make handles REALLY BIG and touch-friendly in connection mode */
	:global(.svelte-flow__handle.connection-mode-active) {
		min-width: 20px !important;
		min-height: 20px !important;
		width: 24px !important;
		height: 24px !important;
		z-index: 100 !important;
		cursor: pointer !important;
		border: 2px solid rgba(255, 255, 255, 0.3) !important;
		box-shadow: 0 0 8px rgba(255, 255, 255, 0.4) !important;
	}

	:global(.svelte-flow__handle.connection-mode-active):hover {
		min-width: 28px !important;
		min-height: 28px !important;
		width: 32px !important;
		height: 32px !important;
		border: 3px solid rgba(255, 255, 255, 0.5) !important;
		box-shadow: 0 0 12px rgba(255, 255, 255, 0.6) !important;
	}
</style>
