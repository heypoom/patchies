<script lang="ts">
	import { SvelteFlow, Background, Controls, type Node, type Edge } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import CanvasNode from './nodes/CanvasNode.svelte';

	// Define custom node types
	const nodeTypes = {
		canvas: CanvasNode
	};

	// Initial nodes and edges
	let nodes = $state<Node[]>([]);
	let edges = $state<Edge[]>([]);

	let nodeId = 0;

	// Handle drop events
	function onDrop(event: DragEvent) {
		event.preventDefault();

		const type = event.dataTransfer?.getData('application/svelteflow');
		if (!type) return;

		const flowContainer = event.currentTarget as HTMLElement;
		const rect = flowContainer.getBoundingClientRect();

		const position = {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top
		};

		const newNode: Node = {
			id: `${type}-${nodeId++}`,
			type,
			position,
			data: {}
		};

		nodes = [...nodes, newNode];
	}

	function onDragOver(event: DragEvent) {
		event.preventDefault();
		event.dataTransfer!.dropEffect = 'move';
	}
</script>

<div class="flow-container flex h-screen w-full flex-col">
	<!-- Main flow area -->
	<div class="relative flex-1" ondrop={onDrop} ondragover={onDragOver}>
		<SvelteFlow
			{nodes}
			{edges}
			{nodeTypes}
			fitView
			class="bg-zinc-900"
			proOptions={{ hideAttribution: true }}
		>
			<Background color="#52525b" gap={16} />
			<Controls />
		</SvelteFlow>
	</div>

	<!-- Bottom toolbar for draggable nodes -->
	<div class="border-t border-zinc-700 bg-zinc-800 p-4">
		<div class="max-w-full">
			<div class="mb-2">
				<h3 class="text-sm font-medium text-zinc-100">Nodes</h3>
			</div>
			<div class="flex gap-3">
				<div
					class="flex cursor-grab flex-col items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-700 p-3 transition-colors hover:bg-zinc-600"
					draggable={true}
					ondragstart={(event) => {
						event.dataTransfer?.setData('application/svelteflow', 'canvas');
					}}
				>
					<div
						class="flex h-8 w-12 items-center justify-center rounded border border-zinc-500 bg-zinc-900"
					>
						<div class="h-5 w-8 rounded-sm border border-zinc-600 bg-zinc-800"></div>
					</div>
					<span class="text-xs text-zinc-200">JS Canvas</span>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	:global(.svelte-flow) {
		background: rgb(24 24 27) !important;
	}

	:global(.svelte-flow__background) {
		background: rgb(24 24 27) !important;
	}

	:global(.svelte-flow__controls) {
		background: rgb(39 39 42) !important;
		border: 1px solid rgb(63 63 70) !important;
	}

	:global(.svelte-flow__controls button) {
		background: rgb(39 39 42) !important;
		color: rgb(244 244 245) !important;
		border: 1px solid rgb(63 63 70) !important;
	}

	:global(.svelte-flow__controls button:hover) {
		background: rgb(63 63 70) !important;
	}
</style>
