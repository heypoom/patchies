<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { getPortPosition } from '$lib/utils/node-utils';
	import { match, P } from 'ts-pattern';

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
			.with({ type: P.nullish, id: P.not(P.nullish) }, ({ id }) => `${port}-${id}`)
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
			.with('analysis', () => '!bg-purple-500 hover:!bg-purple-400')
			.with(P.nullish, () => '!bg-gray-500 hover:!bg-gray-400')
			.exhaustive();

		return `!absolute z-1 ${colorClass} ${className}`;
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
	}
</style>
