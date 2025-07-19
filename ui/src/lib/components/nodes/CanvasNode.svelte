<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { onMount } from 'svelte';

	let { data = {} } = $props();

	let canvasElement: HTMLCanvasElement;

	onMount(() => {
		if (canvasElement) {
			const ctx = canvasElement.getContext('2d');

			if (ctx) {
				canvasElement.width = 100;
				canvasElement.height = 100;
			}
		}
	});
</script>

<div class="min-w-[220px] rounded-lg border border-zinc-600 bg-zinc-900 p-3 shadow-lg">
	<Handle type="target" position={Position.Top} />

	<div class="flex flex-col gap-2">
		<div class="flex items-center justify-between">
			<span class="font-mono text-xs font-medium text-zinc-100">html5.canvas</span>
		</div>

		<canvas bind:this={canvasElement} class="rounded-md border border-zinc-600 bg-zinc-900"
		></canvas>
	</div>

	<Handle type="source" position={Position.Bottom} />
</div>

<style>
	:global(.svelte-flow__handle) {
		background: rgb(156 163 175) !important;
		border: 2px solid rgb(75 85 99) !important;
		width: 8px !important;
		height: 8px !important;
	}

	:global(.svelte-flow__handle.svelte-flow__handle-top) {
		top: -4px !important;
	}

	:global(.svelte-flow__handle.svelte-flow__handle-bottom) {
		bottom: -4px !important;
	}
</style>
