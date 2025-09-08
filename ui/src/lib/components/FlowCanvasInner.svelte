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
	import { edgeTypes } from '$lib/components/edges/edge-types';
	import { PRESETS } from '$lib/presets/presets';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import { AudioSystem } from '$lib/audio/AudioSystem';
	import { AudioAnalysisSystem } from '$lib/audio/AudioAnalysisSystem';
	import { savePatchToLocalStorage } from '$lib/save-load/save-local-storage';
	import { loadPatchFromUrl } from '$lib/save-load/load-patch-from-url';
	import { match } from 'ts-pattern';
	import type { PatchSaveFormat } from '$lib/save-load/serialize-patch';
	import { appHostUrl, createShareablePatch, getSharedPatchData } from '$lib/api/pb';
	import Icon from '@iconify/svelte';

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

	// Object palette state
	let lastMousePosition = $state.raw({ x: 100, y: 100 });

	// Command palette state
	let showCommandPalette = $state(false);
	let commandPalettePosition = $state.raw({ x: 0, y: 0 });
	let flowContainer: HTMLDivElement;

	// Get flow utilities for coordinate transformation
	const { screenToFlowPosition, deleteElements } = useSvelteFlow();

	// Track nodes and edges for message routing
	let previousNodes = new Set<string>();

	// Autosave functionality
	let autosaveInterval: ReturnType<typeof setInterval> | null = null;

	let selectedNodeIds = $state.raw<string[]>([]);
	let selectedEdgeIds = $state.raw<string[]>([]);

	// Node list visibility state
	let isNodeListVisible = $state(false);

	// Clipboard for copy-paste functionality
	let copiedNodeData: { type: string; data: any } | null = null;

	// URL loading state
	let isLoadingFromUrl = $state(false);
	let urlLoadError = $state<string | null>(null);

	useOnSelectionChange(({ nodes, edges }) => {
		selectedNodeIds = nodes.map((node) => node.id);
		selectedEdgeIds = edges.map((edge) => edge.id);
	});

	function performAutosave() {
		try {
			savePatchToLocalStorage({ name: 'autosave', nodes, edges });
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

		// Handle CTRL+C for copy
		if (
			event.key.toLowerCase() === 'c' &&
			(event.metaKey || event.ctrlKey) &&
			!isTyping &&
			hasNodeSelected
		) {
			event.preventDefault();
			copySelectedNode();
		}
		// Handle CTRL+V for paste
		else if (event.key.toLowerCase() === 'v' && (event.metaKey || event.ctrlKey) && !isTyping) {
			event.preventDefault();
			pasteNode();
		}
		// Handle CMD+K for command palette
		else if (
			event.key.toLowerCase() === 'k' &&
			(event.metaKey || event.ctrlKey) &&
			!showCommandPalette
		) {
			event.preventDefault();

			triggerCommandPalette();
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

	function triggerCommandPalette() {
		const centerX = window.innerWidth / 2 - 160;
		const centerY = window.innerHeight / 2 - 200;

		commandPalettePosition = { x: Math.max(0, centerX), y: Math.max(0, centerY) };
		showCommandPalette = true;
	}

	onMount(() => {
		flowContainer?.focus();

		glSystem.start();
		audioSystem.start();

		loadPatch();

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

	async function loadPatch() {
		if (typeof window === 'undefined') return null;

		const params = new URLSearchParams(window.location.search);
		const src = params.get('src');
		const id = params.get('id');

		if (src) {
			await loadPatchFromUrlParam(src);
			return;
		}

		if (id) {
			isLoadingFromUrl = true;

			try {
				const save = await getSharedPatchData(id);

				if (save) restorePatchFromSave(save);
			} catch (err) {
				urlLoadError = err instanceof Error ? err.message : 'Unknown error occurred';
			} finally {
				isLoadingFromUrl = false;
			}

			return;
		}
	}

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
				x: basePosition.x + index * 20,
				y: basePosition.y + index * 20
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

		// Video files -> video node
		if (mimeType.startsWith('video/')) {
			return 'video';
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
			.with('img', () =>
				Promise.resolve({
					...getDefaultNodeData('img'),
					file,
					fileName: file.name,
					url: URL.createObjectURL(file)
				})
			)
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
			.with('soundfile~', () =>
				Promise.resolve({
					...getDefaultNodeData('soundfile~'),
					file,
					fileName: file.name
				})
			)
			.with('video', () =>
				Promise.resolve({
					...getDefaultNodeData('video'),
					file,
					fileName: file.name
				})
			)
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
			if (connection.sourceHandle?.startsWith('analysis')) return true;

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

	// Copy selected node to clipboard
	function copySelectedNode() {
		if (selectedNodeIds.length !== 1) return;

		const selectedNode = nodes.find((node) => node.id === selectedNodeIds[0]);
		if (!selectedNode || !selectedNode.type) return;

		// Deep copy the node data to avoid reference issues
		copiedNodeData = {
			type: selectedNode.type,
			data: { ...selectedNode.data }
		};
	}

	// Paste copied node at current mouse position
	function pasteNode() {
		if (!copiedNodeData) return;

		const position = screenToFlowPosition(lastMousePosition);
		createNode(copiedNodeData.type, position, copiedNodeData.data);
	}

	function restorePatchFromSave(save: PatchSaveFormat) {
		nodes = [];
		edges = [];

		nodes = save.nodes;
		edges = save.edges;

		// Update node counter based on loaded nodes
		if (save.nodes.length > 0) {
			nodeIdCounter = getNodeIdCounterFromSave(save.nodes);
		}
	}

	// Load patch from URL parameter
	async function loadPatchFromUrlParam(url: string) {
		isLoadingFromUrl = true;
		urlLoadError = null;

		try {
			const result = await loadPatchFromUrl(url);

			if (result.success) {
				const { data } = result;
				restorePatchFromSave(data);

				console.log(`Successfully loaded patch "${data.name}" from URL:`, url);
			} else {
				urlLoadError = result.error;
				console.error('Failed to load patch from URL:', result.error);
			}
		} catch (error) {
			urlLoadError = error instanceof Error ? error.message : 'Unknown error occurred';
			console.error('Failed to load patch from URL:', error);
		} finally {
			isLoadingFromUrl = false;
		}
	}

	async function createShareLink() {
		const id = await createShareablePatch(null, nodes, edges);
		if (id === null) return;

		const url = `${appHostUrl}/?id=${id}`;

		try {
			await navigator.clipboard.writeText(url);
			alert(`Shareable link copied to clipboard: ${url}`);
		} catch {}
	}

	function insertObjectWithButton() {
		const position = screenToFlowPosition({
			x: Math.max(0, window.innerWidth / 2 - 200),
			y: 50
		});

		setTimeout(() => {
			createNode('object', position);
		}, 50);
	}

	function deleteSelectedElements() {
		const selectedNodes = selectedNodeIds.map((id) => ({ id }));
		const selectedEdges = selectedEdgeIds.map((id) => ({ id }));

		if (selectedNodes.length > 0 || selectedEdges.length > 0) {
			deleteElements({ nodes: selectedNodes, edges: selectedEdges });
		}
	}
</script>

<div class="flow-container flex h-screen w-full flex-col">
	<!-- URL Loading Indicator -->
	{#if isLoadingFromUrl}
		<div class="absolute left-1/2 top-4 z-50 -translate-x-1/2 transform">
			<div
				class="flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm text-zinc-200"
			>
				<div
					class="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
				></div>

				<span>Loading your patch...</span>
			</div>
		</div>
	{/if}

	<!-- URL Loading Error -->
	{#if urlLoadError}
		<div class="absolute left-1/2 top-4 z-50 -translate-x-1/2 transform">
			<div
				class="flex items-center gap-2 rounded-lg border border-red-600 bg-red-900 px-4 py-2 text-sm text-red-200"
			>
				<span>Failed to load patch: {urlLoadError}</span>

				<button
					class="ml-2 text-red-300 hover:text-red-100"
					onclick={() => (urlLoadError = null)}
					title="Dismiss"
				>
					×
				</button>
			</div>
		</div>
	{/if}

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
			{edgeTypes}
			fitView
			class="bg-zinc-900"
			proOptions={{ hideAttribution: true }}
			{isValidConnection}
		>
			<Background bgColor="#18181b" gap={16} patternColor="oklch(44.2% 0.017 285.786)" />

			<BackgroundOutputCanvas />

			<Controls class={$isBottomBarVisible ? '' : '!hidden'} />
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

		<div class="fixed bottom-0 right-0 p-2">
			{#if selectedNodeIds.length > 0 || selectedEdgeIds.length > 0}
				<button
					title="Delete (Del)"
					class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700 sm:hidden"
					onclick={(e) => {
						e.preventDefault();
						e.stopPropagation();

						const ok = confirm('delete this element?');

						if (ok) {
							deleteSelectedElements();
						}
					}}><Icon icon="lucide:trash-2" class="h-4 w-4 text-red-300" /></button
				>
			{/if}

			<button
				title="Insert Object (Enter)"
				class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();

					insertObjectWithButton();
				}}><Icon icon="lucide:circle-plus" class="h-4 w-4 text-zinc-300" /></button
			>

			<button
				title="Share link"
				class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
				onclick={createShareLink}><Icon icon="lucide:link" class="h-4 w-4 text-zinc-300" /></button
			>

			<button
				title="Command Palette (Cmd+K)"
				class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();

					triggerCommandPalette();
				}}><Icon icon="lucide:command" class="h-4 w-4 text-zinc-300" /></button
			>

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
		position: fixed;
		bottom: 23px !important;
		border-radius: 10px;
		margin: 15px 9px;
	}

	:global(.svelte-flow__controls button) {
		background: rgba(39, 39, 42, 0.5) !important;
		color: rgb(244 244 245) !important;
		border: transparent;
		height: 28px;
	}

	:global(.svelte-flow__controls button):first-child {
		border-top-left-radius: 10px;
		border-top-right-radius: 10px;
	}

	:global(.svelte-flow__controls button):last-child {
		border-bottom-left-radius: 10px;
		border-bottom-right-radius: 10px;
	}

	:global(.svelte-flow__controls button:hover) {
		background: rgb(39, 39, 42) !important;
	}
</style>
