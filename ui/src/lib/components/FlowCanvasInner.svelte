<script lang="ts">
	import {
		SvelteFlow,
		Background,
		Controls,
		type Node,
		type Edge,
		useSvelteFlow,
		type IsValidConnection,
		useOnSelectionChange
	} from '@xyflow/svelte';
	import { onDestroy, onMount } from 'svelte';
	import CommandPalette from './CommandPalette.svelte';
	import ShortcutHelp from './ShortcutHelp.svelte';
	import NodeList from './NodeList.svelte';
	import { MessageSystem } from '$lib/messages/MessageSystem';
	import BackgroundOutputCanvas from './BackgroundOutputCanvas.svelte';
	import { isAiFeaturesVisible, isBottomBarVisible } from '../../stores/ui.store';
	import { getDefaultNodeData } from '$lib/nodes/defaultNodeData';
	import { nodeTypes } from '$lib/nodes/node-types';
	import { PRESETS } from '$lib/presets/presets';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import { AudioSystem } from '$lib/audio/AudioSystem';
	import { AudioAnalysisSystem } from '$lib/audio/AudioAnalysisSystem';
	import { savePatchToLocalStorage } from '$lib/save-load/save-local-storage';
	import { PyodideSystem } from '$lib/python/PyodideSystem';
	import { match } from 'ts-pattern';

	const visibleNodeTypes = $derived.by(() => {
		return Object.fromEntries(
			Object.entries(nodeTypes).filter(([key]) => {
				// If the user dislikes AI features, filter them out.
				if (key.startsWith('ai.') && !$isAiFeaturesVisible) return false;

				return true;
			})
		);
	});

	// Initial nodes and edges
	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);

	let nodeIdCounter = 0;
	let messageSystem = MessageSystem.getInstance();
	let glSystem = GLSystem.getInstance();
	let audioSystem = AudioSystem.getInstance();
	let audioAnalysisSystem = AudioAnalysisSystem.getInstance();
	let pyodideSystem = PyodideSystem.getInstance();

	// Object palette state
	let lastMousePosition = $state.raw({ x: 100, y: 100 });

	// Command palette state
	let showCommandPalette = $state(false);
	let commandPalettePosition = $state.raw({ x: 0, y: 0 });
	let flowContainer: HTMLDivElement;

	// Get flow utilities for coordinate transformation
	const { screenToFlowPosition } = useSvelteFlow();

	// Track nodes and edges for message routing
	let previousNodes = new Set<string>();

	// Autosave functionality
	let autosaveInterval: ReturnType<typeof setInterval> | null = null;
	let lastAutosave = $state<Date | null>(null);

	let selectedNodeIds = $state.raw<string[]>([]);

	// Node list visibility state
	let isNodeListVisible = $state(false);

	useOnSelectionChange(({ nodes }) => {
		selectedNodeIds = nodes.map((node) => node.id);
	});

	function performAutosave() {
		try {
			savePatchToLocalStorage({ name: 'autosave', nodes, edges });
			lastAutosave = new Date();
		} catch (error) {
			console.error('Autosave failed:', error);
		}
	}

	// Update message system when nodes or edges change
	$effect(() => {
		// Handle node changes (deletions)
		const currentNodes = new Set(nodes.map((n) => n.id));

		// Find deleted nodes
		for (const prevNodeId of previousNodes) {
			if (!currentNodes.has(prevNodeId)) {
				messageSystem.unregisterNode(prevNodeId);
				audioSystem.removeAudioObject(prevNodeId);
			}
		}

		previousNodes = currentNodes;
	});

	$effect(() => {
		messageSystem.updateEdges(edges);
		glSystem.updateEdges(edges);
		audioSystem.updateEdges(edges);
		audioAnalysisSystem.updateEdges(edges);
	});

	// Handle global keyboard events
	function handleGlobalKeydown(event: KeyboardEvent) {
		const target = event.target as HTMLElement;

		const isTyping =
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement ||
			target.closest('.cm-editor') ||
			target.closest('.cm-content') ||
			target.contentEditable === 'true';

		const hasNodeSelected = selectedNodeIds.length > 0;

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
		} else if (
			event.key.toLowerCase() === 'enter' &&
			!showCommandPalette &&
			!isTyping &&
			!hasNodeSelected
		) {
			event.preventDefault();

			const position = screenToFlowPosition(lastMousePosition);
			createNode('object', position);
		}
	}

	onMount(() => {
		flowContainer?.focus();

		glSystem.start();
		audioSystem.start();

		document.addEventListener('keydown', handleGlobalKeydown);

		autosaveInterval = setInterval(performAutosave, 3000);

		return () => {
			document.removeEventListener('keydown', handleGlobalKeydown);
			if (autosaveInterval) {
				clearInterval(autosaveInterval);
				autosaveInterval = null;
			}
		};
	});

	onDestroy(() => {
		// Clean up all nodes when component is destroyed
		for (const node of nodes) {
			messageSystem.unregisterNode(node.id);
		}

		// Clean up autosave interval
		if (autosaveInterval) {
			clearInterval(autosaveInterval);
			autosaveInterval = null;
		}

		glSystem.renderWorker.terminate();
	});

	// Handle drop events
	function onDrop(event: DragEvent) {
		event.preventDefault();

		const type = event.dataTransfer?.getData('application/svelteflow');
		const files = event.dataTransfer?.files;

		// Check if the drop target is within a node (to avoid duplicate handling)
		const target = event.target as HTMLElement;
		const isDropOnNode = target.closest('.svelte-flow__node');

		// Get accurate positioning with zoom/pan
		const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });

		// Handle file drops - only if not dropping on an existing node
		if (files && files.length > 0 && !isDropOnNode) {
			handleFileDrops(files, position);
			return;
		}

		// Handle node palette drops
		if (type) {
			createNode(type, position);
		}
	}

	// Handle dropped files by creating appropriate nodes
	function handleFileDrops(files: FileList, basePosition: { x: number; y: number }) {
		Array.from(files).forEach(async (file, index) => {
			// Offset multiple files to avoid overlap
			const position = {
				x: basePosition.x + (index * 20),
				y: basePosition.y + (index * 20)
			};

			const nodeType = getNodeTypeFromFile(file);
			if (nodeType) {
				const customData = await getFileNodeData(file, nodeType);
				createNode(nodeType, position, customData);
			}
		});
	}

	// Map file types to node types based on spec
	function getNodeTypeFromFile(file: File): string | null {
		const mimeType = file.type;

		// Image files -> img node
		if (mimeType.startsWith('image/')) {
			return 'img';
		}

		// Text files -> markdown node
		if (mimeType.startsWith('text/')) {
			return 'markdown';
		}

		// Audio files -> soundfile~ node
		if (mimeType.startsWith('audio/')) {
			return 'soundfile~';
		}

		// Unsupported file type
		return null;
	}

	// Create appropriate data for file-based nodes
	async function getFileNodeData(file: File, nodeType: string) {
		return await match(nodeType)
			.with('img', () => Promise.resolve({
				...getDefaultNodeData('img'),
				file,
				fileName: file.name,
				url: URL.createObjectURL(file)
			}))
			.with('markdown', async () => {
				try {
					const content = await file.text();
					return {
						...getDefaultNodeData('markdown'),
						markdown: content
					};
				} catch (error) {
					console.error('Failed to read markdown file:', error);
					return {
						...getDefaultNodeData('markdown'),
						markdown: `Error loading file: ${file.name}`
					};
				}
			})
			.with('soundfile~', () => Promise.resolve({
				...getDefaultNodeData('soundfile~'),
				file,
				fileName: file.name
			}))
			.otherwise(() => Promise.resolve(getDefaultNodeData(nodeType)));
	}

	function onDragOver(event: DragEvent) {
		event.preventDefault();
		event.dataTransfer!.dropEffect = 'move';
	}

	// Create a new node at the specified position
	function createNode(type: string, position: { x: number; y: number }, customData?: any) {
		const id = `${type}-${nodeIdCounter++}`;

		const newNode: Node = {
			id,
			type,
			position,
			data: customData ?? getDefaultNodeData(type)
		};

		nodes = [...nodes, newNode];
	}

	function handlePaletteSelect(nodeType: string, isPreset?: boolean) {
		const position = screenToFlowPosition(lastMousePosition);

		if (isPreset && PRESETS[nodeType]) {
			const preset = PRESETS[nodeType];

			createNode(preset.type, position, preset.data);
		} else {
			createNode(nodeType, position);
		}
	}

	function handleCommandPaletteCancel() {
		showCommandPalette = false;
	}

	// Track mouse position for palette positioning
	function handleMouseMove(event: MouseEvent) {
		// Store the raw client coordinates for palette UI positioning
		lastMousePosition = {
			x: event.clientX,
			y: event.clientY
		};
	}

	function handleNodeListToggle() {
		isNodeListVisible = !isNodeListVisible;
	}

	const isValidConnection: IsValidConnection = (connection) => {
		if (
			connection.sourceHandle?.startsWith('video') ||
			connection.targetHandle?.startsWith('video')
		) {
			// TODO: use proper analysis outlet detection.
			if (connection.sourceHandle?.includes('outlet-1')) return true;

			return !!(
				(connection.sourceHandle?.startsWith('video') ||
					connection.sourceHandle?.startsWith('gl')) &&
				(connection.targetHandle?.startsWith('video') || connection.targetHandle?.startsWith('gl'))
			);
		}

		// Allow connections between any nodes
		return true;
	};

	function getNodeIdCounterFromSave(nodes: Node[]): number {
		const lastNodeId = parseInt(nodes.at(-1)?.id.match(/.*\-(\d+)$/)?.[1] ?? '');
		if (isNaN(lastNodeId)) throw new Error('corrupted save - cannot get last node id');

		return lastNodeId + 1;
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
			{isValidConnection}
		>
			<Background bgColor="#18181b" gap={16} patternColor="oklch(44.2% 0.017 285.786)" />
			<BackgroundOutputCanvas />

			<Controls class={$isBottomBarVisible ? '!bottom-[30px]' : ''} />
		</SvelteFlow>

		<!-- Command Palette -->
		{#if showCommandPalette}
			<CommandPalette
				position={commandPalettePosition}
				onCancel={handleCommandPaletteCancel}
				{nodes}
				{edges}
				setNodes={(newNodes) => {
					nodes = newNodes;
					nodeIdCounter = getNodeIdCounterFromSave(newNodes);
				}}
				setEdges={(newEdges) => {
					edges = newEdges;
				}}
			/>
		{/if}
	</div>

	<!-- Bottom toolbar for draggable nodes -->
	{#if $isBottomBarVisible}
		<NodeList
			nodeTypes={visibleNodeTypes}
			isVisible={isNodeListVisible}
			onToggle={handleNodeListToggle}
		/>

		<div class="fixed right-0 bottom-0 p-2">
			<ShortcutHelp />
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
