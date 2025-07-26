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
	import StrudelNode from './nodes/StrudelNode.svelte';
	import ObjectPalette from './ObjectPalette.svelte';
	import CommandPalette from './CommandPalette.svelte';
	import ButterchurnNode from './nodes/ButterchurnNode.svelte';
	import ShortcutHelp from './ShortcutHelp.svelte';
	import { MessageSystem } from '$lib/messages/MessageSystem';
	import { VideoSystem } from '$lib/video/VideoSystem';
	import AiImageNode from './nodes/AiImageNode.svelte';
	import AiVideoNode from './nodes/AiVideoNode.svelte';
	import AiMusicNode from './nodes/AiMusicNode.svelte';
	import BackgroundOutputCanvas from './BackgroundOutputCanvas.svelte';
	import BackgroundOutputNode from './nodes/BackgroundOutputNode.svelte';
	import { isBottomBarVisible } from '../../stores/ui.store';
	import { isBackgroundOutputCanvasEnabled } from '../../stores/canvas.store';

	// Define custom node types
	const nodeTypes = {
		['p5']: P5CanvasNode,
		['js']: JSBlockNode,
		['hydra']: HydraNode,
		['canvas']: JSCanvasNode,
		['glsl']: GLSLCanvasNode,
		['strudel']: StrudelNode,
		['bchrn']: ButterchurnNode,
		['ai.img']: AiImageNode,
		['ai.music']: AiMusicNode,
		['bg.out']: BackgroundOutputNode
		// ['ai.vdo']: AiVideoNode,
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

	// Command palette state
	let showCommandPalette = $state(false);
	let commandPalettePosition = $state({ x: 0, y: 0 });
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

	// Handle command palette
	function handleCommandPaletteCancel() {
		showCommandPalette = false;
	}

	// Handle global keyboard events
	function handleGlobalKeydown(event: KeyboardEvent) {
		const target = event.target as HTMLElement;
		const isTyping =
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement ||
			target.closest('.cm-editor') ||
			target.closest('.cm-content') ||
			target.contentEditable === 'true' ||
			target.closest('.svelte-flow__node');

		// Handle CMD+K for command palette
		if (
			event.key.toLowerCase() === 'k' &&
			(event.metaKey || event.ctrlKey) &&
			!showCommandPalette
		) {
			event.preventDefault();
			const centerX = window.innerWidth / 2 - 160;
			const centerY = window.innerHeight / 2 - 200;
			commandPalettePosition = { x: Math.max(0, centerX), y: Math.max(0, centerY) };
			showCommandPalette = true;
		}
		// Handle 'n' key for object palette
		else if (event.key.toLowerCase() === 'n' && !showPalette && !showCommandPalette && !isTyping) {
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
			<Background bgColor="#18181b" gap={16} />
			<BackgroundOutputCanvas />

			<Controls class={$isBottomBarVisible ? '!bottom-[50px]' : ''} />
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

		<!-- Command Palette -->
		{#if showCommandPalette}
			<CommandPalette position={commandPalettePosition} onCancel={handleCommandPaletteCancel} />
		{/if}
	</div>

	<!-- Bottom toolbar for draggable nodes -->
	{#if $isBottomBarVisible}
		<div
			class={[
				'fixed bottom-0 left-0 w-full bg-transparent px-3 py-2 backdrop-blur-xl',
				!$isBackgroundOutputCanvasEnabled && 'border-t border-zinc-700'
			]}
		>
			<div class="max-w-full">
				<div class="flex items-center justify-between">
					<div class="flex gap-3">
						{#each Object.keys(nodeTypes) as nodeType}
							<div
								role="button"
								tabindex="0"
								class={[
									'flex cursor-grab flex-col items-center gap-2 rounded-lg px-2 py-1 transition-colors',
									$isBackgroundOutputCanvasEnabled
										? 'bg-transparent backdrop-blur-xl hover:bg-zinc-900/10'
										: 'border border-zinc-600 bg-zinc-800 hover:bg-zinc-700'
								]}
								draggable={true}
								ondragstart={(event) => {
									event.dataTransfer?.setData('application/svelteflow', nodeType);
								}}
							>
								<span class="font-mono text-xs text-zinc-300">{nodeType}</span>
							</div>
						{/each}
					</div>

					<div>
						<ShortcutHelp />
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	:global(.svelte-flow) {
		background: transparent !important;
	}

	:global(.svelte-flow__background) {
		background: transparent !important;
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
