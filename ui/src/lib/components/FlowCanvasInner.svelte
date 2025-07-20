<script lang="ts">
	import {
		SvelteFlow,
		Background,
		Controls,
		type Node,
		type Edge,
		useSvelteFlow
	} from '@xyflow/svelte';
	import { onDestroy, onMount } from 'svelte';
	import P5CanvasNode from './nodes/P5CanvasNode.svelte';
	import JSBlockNode from './nodes/JSBlockNode.svelte';
	import HydraNode from './nodes/HydraNode.svelte';
	import JSCanvasNode from './nodes/JSCanvasNode.svelte';
	import GLSLCanvasNode from './nodes/GLSLCanvasNode.svelte';
	import ObjectPalette from './ObjectPalette.svelte';
	import { MessageSystem } from '$lib/messages/MessageSystem';
	import { VideoSystem } from '$lib/video/VideoSystem';

	// Define custom node types
	const nodeTypes = {
		['p5.canvas']: P5CanvasNode,
		['js']: JSBlockNode,
		['hydra']: HydraNode,
		['js.canvas']: JSCanvasNode,
		['glsl.canvas']: GLSLCanvasNode
	};

	// Initial nodes and edges
	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);

	let nodeId = 0;
	let messageSystem = MessageSystem.getInstance();
	let videoSystem = VideoSystem.getInstance();

	// Object palette state
	let showPalette = $state(false);
	let palettePosition = $state({ x: 0, y: 0 }); // Screen position for palette UI
	let nodeCreationPosition = $state({ x: 0, y: 0 }); // Flow position for node creation
	let lastMousePosition = $state({ x: 0, y: 0 });
	let flowContainer: HTMLDivElement;

	// Get flow utilities for coordinate transformation
	const { screenToFlowPosition } = useSvelteFlow();

	// Track nodes and edges for message routing
	let previousNodes = new Set<string>();

	// Update message system when nodes or edges change
	$effect(() => {
		// Handle node changes (deletions)
		const currentNodes = new Set(nodes.map((n) => n.id));

		// Find deleted nodes
		for (const prevNodeId of previousNodes) {
			if (!currentNodes.has(prevNodeId)) {
				messageSystem.unregisterNode(prevNodeId);
			}
		}

		previousNodes = currentNodes;
	});

	$effect(() => {
		// Update connections when edges change
		const connections = edges.map((edge) => ({
			source: edge.source,
			target: edge.target,
			sourceHandle: edge.sourceHandle || undefined,
			targetHandle: edge.targetHandle || undefined
		}));

		messageSystem.updateConnections(connections);

		// Also update video system with handle information
		videoSystem.updateVideoConnections(connections);
	});

	onMount(() => {
		// Auto-focus the flow container to enable keyboard events
		flowContainer?.focus();

		// Add global keyboard listener for 'N' key
		document.addEventListener('keydown', handleGlobalKeydown);

		return () => {
			document.removeEventListener('keydown', handleGlobalKeydown);
		};
	});

	onDestroy(() => {
		// Clean up all nodes when component is destroyed
		for (const node of nodes) {
			messageSystem.unregisterNode(node.id);
		}
	});

	// Handle drop events
	function onDrop(event: DragEvent) {
		event.preventDefault();

		const type = event.dataTransfer?.getData('application/svelteflow');

		if (!type) return;

		// Get accurate positioning with zoom/pan
		const position = screenToFlowPosition({
			x: event.clientX,
			y: event.clientY
		});

		createNode(type, position);
	}

	function onDragOver(event: DragEvent) {
		event.preventDefault();
		event.dataTransfer!.dropEffect = 'move';
	}

	// Create a new node at the specified position
	function createNode(type: string, position: { x: number; y: number }) {
		const newNode: Node = {
			id: `${type}-${nodeId++}`,
			type,
			position,
			data: {}
		};

		nodes = [...nodes, newNode];
	}

	// Handle object palette
	function handlePaletteSelect(nodeType: string) {
		createNode(nodeType, nodeCreationPosition);
		showPalette = false;
	}

	function handlePaletteCancel() {
		showPalette = false;
	}

	// Handle global keyboard events
	function handleGlobalKeydown(event: KeyboardEvent) {
		// Only handle 'n' key when not typing in any input or inside any node content
		const target = event.target as HTMLElement;

		if (
			event.key.toLowerCase() === 'n' &&
			!showPalette &&
			// Exclude all input types
			!(target instanceof HTMLInputElement) &&
			!(target instanceof HTMLTextAreaElement) &&
			// Exclude CodeMirror editors (which use contenteditable divs)
			!target.closest('.cm-editor') &&
			!target.closest('.cm-content') &&
			// Exclude any contenteditable elements
			!(target.contentEditable === 'true') &&
			// Exclude any elements inside nodes (they have react-flow__node class)
			!target.closest('.svelte-flow__node')
		) {
			event.preventDefault();
			// Set screen position for palette UI (where the palette appears)
			palettePosition = { ...lastMousePosition };
			// Convert screen coordinates to flow coordinates for accurate node placement
			nodeCreationPosition = screenToFlowPosition(lastMousePosition);
			showPalette = true;
		}
	}

	// Track mouse position for palette positioning
	function handleMouseMove(event: MouseEvent) {
		// Store the raw client coordinates for palette UI positioning
		lastMousePosition = {
			x: event.clientX,
			y: event.clientY
		};
	}
</script>

<div class="flow-container flex h-screen w-full flex-col">
	<!-- Main flow area -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		bind:this={flowContainer}
		class="relative flex-1"
		ondrop={onDrop}
		ondragover={onDragOver}
		onmousemove={handleMouseMove}
		tabindex="0"
	>
		<SvelteFlow
			bind:nodes
			bind:edges
			{nodeTypes}
			fitView
			class="bg-zinc-900"
			proOptions={{ hideAttribution: true }}
		>
			<Background bgColor="#52525b" gap={16} />
			<Controls />
		</SvelteFlow>

		<!-- Object Palette -->
		{#if showPalette}
			<ObjectPalette
				{nodeTypes}
				position={palettePosition}
				onSelect={handlePaletteSelect}
				onCancel={handlePaletteCancel}
			/>
		{/if}
	</div>

	<!-- Bottom toolbar for draggable nodes -->
	<div class="border-t border-zinc-700 bg-zinc-900 p-4">
		<div class="max-w-full">
			<div class="flex gap-3">
				{#each Object.keys(nodeTypes) as nodeType}
					<div
						role="button"
						tabindex="0"
						class="flex cursor-grab flex-col items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800 p-3 transition-colors hover:bg-zinc-600"
						draggable={true}
						ondragstart={(event) => {
							event.dataTransfer?.setData('application/svelteflow', nodeType);
						}}
					>
						<span class="font-mono text-xs text-zinc-200">{nodeType}</span>
					</div>
				{/each}
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
