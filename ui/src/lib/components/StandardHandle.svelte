<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { getPortPosition } from '$lib/utils/node-utils';

	interface Props {
		port: 'inlet' | 'outlet';
		type?: 'video' | 'audio' | 'message';
		id?: string | number;
		title?: string;
		total: number;
		index: number;
		class?: string;
	}

	let { port, type, id, title, total, index, class: className = '' }: Props = $props();

	// Construct the handle ID based on the specification
	const handleId = $derived(() => {
		if (type && id !== undefined) {
			// e.g., "video-in-0", "audio-out-1", "video-in-0-iChannel0-sampler2D"
			const portDir = port === 'inlet' ? 'in' : 'out';
			return `${type}-${portDir}-${id}`;
		} else if (type && id === undefined) {
			// e.g., "audio-in", "message-out"
			const portDir = port === 'inlet' ? 'in' : 'out';
			return `${type}-${portDir}`;
		} else if (!type && id !== undefined) {
			// e.g., "inlet-0", "outlet-1"
			return `${port}-${id}`;
		} else {
			// fallback: just use port name
			return port;
		}
	});

	// Determine handle type and position
	const handleType = port === 'inlet' ? 'target' : 'source';
	const handlePosition = port === 'inlet' ? Position.Top : Position.Bottom;

	// Calculate position using getPortPosition
	const positionStyle = $derived(`left: ${getPortPosition(total, index)}`);

	// Determine handle color based on type
	const handleClass = $derived(() => {
		let colorClass = '';

		if (type === 'video') {
			colorClass = '!bg-orange-500 hover:!bg-orange-400';
		} else if (type === 'audio') {
			colorClass = '!bg-blue-500 hover:!bg-blue-400';
		} else if (type === 'message') {
			colorClass = '!bg-gray-500 hover:!bg-gray-400';
		} else {
			// Default handle color (for inlet/outlet without specific type)
			colorClass = '!bg-gray-500 hover:!bg-gray-400';
		}

		return `!absolute z-1 ${colorClass} ${className}`;
	});
</script>

<Handle
	type={handleType}
	position={handlePosition}
	id={handleId()}
	class={handleClass()}
	style={positionStyle}
	{title}
/>
