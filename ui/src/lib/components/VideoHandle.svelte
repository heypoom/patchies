<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';

	interface Props {
		type: 'source' | 'target';
		position: Position;
		id?: string;
		class?: string;
		style?: string;
		title?: string;
	}

	let { type, position, id, class: className = '', title, style }: Props = $props();
</script>

<Handle
	{type}
	{position}
	{id}
	class="!bg-orange-500 hover:!bg-orange-400 {className}"
	{title}
	{style}
/>
