<script lang="ts">
	import {
		CirclePlus,
		Command,
		FilePlus2,
		Link,
		Search,
		Trash2,
		Volume2
	} from '@lucide/svelte/icons';
	import {
		SvelteFlow,
		Controls,
		type Node,
		type Edge,
		useSvelteFlow,
		type IsValidConnection,
		useOnSelectionChange
	} from '@xyflow/svelte';
	import { onDestroy, onMount } from 'svelte';
	import CommandPalette from './CommandPalette.svelte';
	import StartupModal from './startup-modal/StartupModal.svelte';
	import VolumeControl from './VolumeControl.svelte';
	import ObjectBrowserModal from './object-browser/ObjectBrowserModal.svelte';
	import AiObjectPrompt from './AiObjectPrompt.svelte';
	import { MessageSystem } from '$lib/messages/MessageSystem';
	import BackgroundOutputCanvas from './BackgroundOutputCanvas.svelte';
	import { isAiFeaturesVisible, isBottomBarVisible } from '../../stores/ui.store';
	import { getDefaultNodeData } from '$lib/nodes/defaultNodeData';
	import { nodeTypes } from '$lib/nodes/node-types';
	import { edgeTypes } from '$lib/components/edges/edge-types';
	import { PRESETS } from '$lib/presets/presets';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import { AudioService } from '$lib/audio/v2/AudioService';
	import { AudioAnalysisSystem } from '$lib/audio/AudioAnalysisSystem';
	import { savePatchToLocalStorage } from '$lib/save-load/save-local-storage';
	import { loadPatchFromUrl } from '$lib/save-load/load-patch-from-url';
	import { match } from 'ts-pattern';
	import type { PatchSaveFormat } from '$lib/save-load/serialize-patch';
	import { serializePatch } from '$lib/save-load/serialize-patch';
	import { appHostUrl, createShareablePatch, getSharedPatchData } from '$lib/api/pb';
	import { isBackgroundOutputCanvasEnabled, hasSomeAudioNode } from '../../stores/canvas.store';
	import { deleteSearchParam, getSearchParam } from '$lib/utils/search-params';
	import BackgroundPattern from './BackgroundPattern.svelte';
	import { ANALYSIS_KEY } from '$lib/audio/v2/constants/fft';
	import { ObjectShorthandRegistry } from '$lib/registry/ObjectShorthandRegistry';
	import { AudioRegistry } from '$lib/registry/AudioRegistry';
	import { ObjectRegistry } from '$lib/registry/ObjectRegistry';

	const AUTOSAVE_INTERVAL = 2500;

	const visibleNodeTypes = $derived.by(() => {
		return Object.fromEntries(
			Object.entries(nodeTypes).filter(([key]) => {
				// If the user dislikes AI features, filter them out.
				if (key.startsWith('ai.') && !$isAiFeaturesVisible) return false;

				// Hide asm.value from node palette - only created via drag-and-drop
				if (key === 'asm.value') return false;

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
	let audioService = AudioService.getInstance();
	let audioAnalysisSystem = AudioAnalysisSystem.getInstance();

	// Object palette state
	let lastMousePosition = $state.raw({ x: 100, y: 100 });

	// Command palette state
	let showCommandPalette = $state(false);
	let commandPalettePosition = $state.raw({ x: 0, y: 0 });
	let flowContainer: HTMLDivElement;

	// Object browser modal state
	let showObjectBrowser = $state(false);

	// AI object prompt state
	let showAiPrompt = $state(false);
	let aiPromptPosition = $state.raw({ x: 0, y: 0 });
	let aiEditingNodeId = $state<string | null>(null);

	// Get flow utilities for coordinate transformation
	const { screenToFlowPosition, deleteElements, fitView } = useSvelteFlow();

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

	let isLoadingFromUrl = $state(false);
	let urlLoadError = $state<string | null>(null);
	let showAudioHint = $state(audioService.getAudioContext().state === 'suspended');
	let showStartupModal = $state(localStorage.getItem('patchies-show-startup-modal') !== 'false');

	useOnSelectionChange(({ nodes, edges }) => {
		selectedNodeIds = nodes.map((node) => node.id);
		selectedEdgeIds = edges.map((edge) => edge.id);
	});

	function performAutosave() {
		const embedParam = getSearchParam('embed');
		const isEmbed = embedParam === 'true' || embedParam === '1';

		// do not autosave when in embed mode
		if (isEmbed) {
			return;
		}

		// Only autosave when tab is active and focused to prevent conflicts between browser tabs
		if (document.hidden || !document.hasFocus()) {
			return;
		}

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
				const node = audioService.getNodeById(prevNodeId);
				if (node) {
					audioService.removeNode(node);
				}
			}
		}

		previousNodes = currentNodes;
	});

	$effect(() => {
		messageSystem.updateEdges(edges);
		glSystem.updateEdges(edges);
		audioService.updateEdges(edges);
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
		}
		// Handle CMD+B for browse objects
		else if (event.key.toLowerCase() === 'b' && (event.metaKey || event.ctrlKey) && !isTyping) {
			event.preventDefault();
			showObjectBrowser = true;
		}
		// Handle CMD+I for AI object insertion/editing
		else if (event.key.toLowerCase() === 'i' && (event.metaKey || event.ctrlKey) && !isTyping) {
			event.preventDefault();
			
			// Respect the "Hide AI features" setting
			if (!$isAiFeaturesVisible) {
				return;
			}
			
			// Check if Gemini API key is set, show helpful message if not
			const hasApiKey = localStorage.getItem('gemini-api-key');
			if (!hasApiKey) {
				const shouldSetKey = confirm(
					'AI Object Insertion requires a Gemini API key. Would you like to set it now?'
				);
				if (shouldSetKey) {
					triggerCommandPalette();
				}
			} else {
				// If a single node is selected, edit it; otherwise create new
				if (selectedNodeIds.length === 1) {
					aiEditingNodeId = selectedNodeIds[0];
				} else {
					aiEditingNodeId = null;
				}
				triggerAiPrompt();
			}
		}
		// Handle CMD+S for manual save
		else if (event.key.toLowerCase() === 's' && (event.metaKey || event.ctrlKey) && !isTyping) {
			event.preventDefault();
			// Save to autosave slot
			const patchJson = serializePatch({ name: 'autosave', nodes, edges });
			localStorage.setItem('patchies-patch-autosave', patchJson);
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

	function triggerAiPrompt() {
		const centerX = window.innerWidth / 2 - 192; // Half of 384px (w-96)
		const centerY = window.innerHeight / 2 - 150;

		aiPromptPosition = { x: Math.max(0, centerX), y: Math.max(0, centerY) };
		showAiPrompt = true;
	}

	function handleAiObjectInsert(type: string, data: any) {
		const position = screenToFlowPosition(lastMousePosition);
		createNode(type, position, data);
	}

	function handleAiObjectEdit(nodeId: string, data: any) {
		// Update only specific fields from the AI result to preserve node structure
		nodes = nodes.map(node => {
			if (node.id !== nodeId) return node;
			
			// Merge only the fields that should be updated (primarily code and related config)
			const updatedData = { ...node.data };
			
			// Update code if provided
			if (data.code !== undefined) {
				updatedData.code = data.code;
			}
			
			// Update title if provided
			if (data.title !== undefined) {
				updatedData.title = data.title;
			}
			
			// Update inlet/outlet counts if provided
			if (data.messageInletCount !== undefined) {
				updatedData.messageInletCount = data.messageInletCount;
			}
			if (data.messageOutletCount !== undefined) {
				updatedData.messageOutletCount = data.messageOutletCount;
			}
			if (data.audioInletCount !== undefined) {
				updatedData.audioInletCount = data.audioInletCount;
			}
			if (data.audioOutletCount !== undefined) {
				updatedData.audioOutletCount = data.audioOutletCount;
			}
			if (data.inletCount !== undefined) {
				updatedData.inletCount = data.inletCount;
			}
			if (data.outletCount !== undefined) {
				updatedData.outletCount = data.outletCount;
			}
			
			return { ...node, data: updatedData };
		});
	}

	onMount(() => {
		flowContainer?.focus();

		glSystem.start();
		audioService.start();

		loadPatch();

		// Check if the user wants to see the startup modal on launch
		const showStartupSetting = localStorage.getItem('patchies-show-startup-modal');
		// Default to true if not set (first time users), or respect user's preference
		if (showStartupSetting === null || showStartupSetting === 'true') {
			showStartupModal = true;
		}

		document.addEventListener('keydown', handleGlobalKeydown);

		autosaveInterval = setInterval(performAutosave, AUTOSAVE_INTERVAL);

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
			deleteSearchParam('src');
			return;
		}

		if (id) {
			isLoadingFromUrl = true;

			try {
				const save = await getSharedPatchData(id);
				deleteSearchParam('id');

				if (save) restorePatchFromSave(save);
			} catch (err) {
				urlLoadError = err instanceof Error ? err.message : 'Unknown error occurred';
			} finally {
				isLoadingFromUrl = false;
			}

			return;
		}

		try {
			const save = localStorage.getItem('patchies-patch-autosave');

			if (save) {
				const parsed: PatchSaveFormat = JSON.parse(save);
				if (parsed) restorePatchFromSave(parsed);
			}
		} catch {}
	}

	// Handle drop events
	function onDrop(event: DragEvent) {
		event.preventDefault();

		const type = event.dataTransfer?.getData('application/svelteflow');
		const files = event.dataTransfer?.files;
		const memoryData = event.dataTransfer?.getData('application/asm-memory');

		// Check if the drop target is within a node (to avoid duplicate handling)
		const target = event.target as HTMLElement;
		const isDropOnNode = target.closest('.svelte-flow__node');

		// Get accurate positioning with zoom/pan
		const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });

		// Handle assembly memory drops - create asm.value node
		if (memoryData && !isDropOnNode) {
			try {
				const data = JSON.parse(memoryData);
				createNode('asm.value', position, data);
				return;
			} catch (error) {
				console.warn('Failed to parse memory drag data:', error);
			}
		}

		// Handle file drops - only if not dropping on an existing node
		if (files && files.length > 0 && !isDropOnNode) {
			handleFileDrops(files, position);
			return;
		}

		// Handle node palette drops
		if (type) {
			createNodeFromName(type, position);
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

		// Check what type of drag this is and set appropriate drop effect
		const hasMemoryData = event.dataTransfer?.types.includes('application/asm-memory');
		const hasSvelteFlowData = event.dataTransfer?.types.includes('application/svelteflow');

		if (hasMemoryData) {
			event.dataTransfer!.dropEffect = 'copy';
		} else if (hasSvelteFlowData) {
			event.dataTransfer!.dropEffect = 'move';
		} else {
			event.dataTransfer!.dropEffect = 'move';
		}
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

	/**
	 * Create a node from an object name (handles both visual nodes and textual objects).
	 * Textual objects (like dac~, expr, adsr) are created as 'object' nodes.
	 * Visual nodes (like p5, hydra, glsl) are created with their actual type.
	 */
	function createNodeFromName(name: string, position: { x: number; y: number }) {
		// Check if it's a visual node type
		if (nodeTypes[name as keyof typeof nodeTypes]) {
			createNode(name, position);
			return;
		}

		// Check if it's a textual object (audio or text object)
		const audioRegistry = AudioRegistry.getInstance();
		const objectRegistry = ObjectRegistry.getInstance();

		if (audioRegistry.isDefined(name) || objectRegistry.isDefined(name)) {
			// Create an 'object' node with the textual object name
			createNode('object', position, {
				expr: name,
				name: name,
				params: []
			});
			return;
		}

		// Fallback: try shorthand transformation
		const shorthandResult = ObjectShorthandRegistry.getInstance().tryTransform(name);
		if (shorthandResult) {
			createNode(shorthandResult.nodeType, position, shorthandResult.data);
			return;
		}

		// Last resort: create as-is
		createNode(name, position);
	}

	function handlePaletteSelect(nodeType: string, isPreset?: boolean) {
		const position = screenToFlowPosition(lastMousePosition);

		if (isPreset && PRESETS[nodeType]) {
			const preset = PRESETS[nodeType];
			createNode(preset.type, position, preset.data);
		} else {
			createNodeFromName(nodeType, position);
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

	function handleObjectBrowserSelect(name: string) {
		// Get the center of the viewport in screen coordinates
		const viewportCenterX = window.innerWidth / 2;
		const viewportCenterY = window.innerHeight / 2;

		// Convert to flow coordinates (accounts for pan and zoom)
		const position = screenToFlowPosition({ x: viewportCenterX, y: viewportCenterY });
		createNodeFromName(name, position);
	}

	const isValidConnection: IsValidConnection = (connection) => {
		// Allow connecting `fft~` analysis result to anything except audio inlets.
		if (connection.sourceHandle?.startsWith(ANALYSIS_KEY)) {
			return !connection.targetHandle?.startsWith('audio');
		}

		if (
			connection.sourceHandle?.startsWith('video') ||
			connection.targetHandle?.startsWith('video')
		) {
			return !!(
				(connection.sourceHandle?.startsWith('video') ||
					connection.sourceHandle?.startsWith('gl')) &&
				(connection.targetHandle?.startsWith('video') || connection.targetHandle?.startsWith('gl'))
			);
		}

		// Audio connections must connect audio to audio
		if (
			connection.sourceHandle?.startsWith('audio') ||
			connection.targetHandle?.startsWith('audio')
		) {
			return !!(
				connection.sourceHandle?.startsWith('audio') && connection.targetHandle?.startsWith('audio')
			);
		}

		// Allow connections between any nodes (message connections)
		return true;
	};

	function getNodeIdCounterFromSave(nodes: Node[]): number {
		if (nodes.length === 0) return 0 + 1;

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

	async function loadPatchById(patchId: string) {
		isLoadingFromUrl = true;
		urlLoadError = null;

		try {
			const save = await getSharedPatchData(patchId);
			if (save) {
				restorePatchFromSave(save);

				// Reset viewport to center and default zoom
				setTimeout(() => {
					fitView({ padding: 0.2, duration: 300 });
				}, 100);

				// Close the startup modal after loading
				showStartupModal = false;
			}
		} catch (err) {
			urlLoadError = err instanceof Error ? err.message : 'Unknown error occurred';
			console.error('Failed to load patch:', err);
		} finally {
			isLoadingFromUrl = false;
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

	function newPatch() {
		const ok = confirm(
			'Are you sure you want to create a new patch? Unsaved changes will be lost!!!'
		);

		if (!ok) return;

		nodes = [];
		edges = [];
		localStorage.removeItem('patchies-patch-autosave');
		isBackgroundOutputCanvasEnabled.set(false);
	}

	function resumeAudio() {
		const audioContext = audioService.getAudioContext();

		if (audioContext.state === 'suspended') {
			audioContext.resume();
			audioService.updateEdges(edges);
		}

		if (showAudioHint) {
			showAudioHint = false;
		}
	}
</script>

<div class="flow-container flex h-screen w-full flex-col">
	<!-- URL Loading Indicator -->
	{#if isLoadingFromUrl}
		<div class="absolute top-4 left-1/2 z-50 -translate-x-1/2 transform">
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
		<div class="absolute top-4 left-1/2 z-50 -translate-x-1/2 transform">
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

	<!-- Audio Resume Hint -->
	{#if showAudioHint && !isLoadingFromUrl && $hasSomeAudioNode && !showStartupModal}
		<div class="absolute top-4 left-1/2 z-50 -translate-x-1/2 transform">
			<div
				class="flex items-center gap-2 rounded-lg border border-blue-600 bg-blue-900/80 px-4 py-2 text-sm text-blue-200 backdrop-blur-sm"
			>
				<Volume2 class="h-4 w-4" />
				<span>Click anywhere to play sound</span>
			</div>
		</div>
	{/if}

	<!-- Main flow area -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		bind:this={flowContainer}
		class="relative flex-1"
		ondrop={onDrop}
		ondragover={onDragOver}
		onmousemove={handleMouseMove}
		onclick={resumeAudio}
		tabindex="0"
	>
		<SvelteFlow
			bind:nodes
			bind:edges
			{nodeTypes}
			{edgeTypes}
			fitView
			class="bg-zinc-900"
			snapGrid={[5, 5]}
			proOptions={{ hideAttribution: true }}
			{isValidConnection}
		>
			<BackgroundPattern />

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

	<!-- Bottom toolbar buttons -->
	{#if $isBottomBarVisible}
		<div class="fixed right-0 bottom-0 p-2">
			{#if selectedNodeIds.length > 0 || selectedEdgeIds.length > 0}
				<button
					title="Delete (Del)"
					class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
					onclick={(e) => {
						e.preventDefault();
						e.stopPropagation();

						const ok = confirm('Delete this element?');

						if (ok) {
							deleteSelectedElements();
						}
					}}><Trash2 class="h-4 w-4 text-red-400" /></button
				>
			{/if}

			<button
				title="Quick Insert Object (Enter)"
				class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();

					insertObjectWithButton();
				}}><CirclePlus class="h-4 w-4 text-zinc-300" /></button
			>

			<button
				title="Browse Objects (Cmd+B)"
				class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();

					showObjectBrowser = true;
				}}><Search class="h-4 w-4 text-zinc-300" /></button
			>

			<button
				title="Share Link"
				class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
				onclick={createShareLink}><Link class="h-4 w-4 text-zinc-300" /></button
			>

			<button
				title="Command Palette (Cmd+K)"
				class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();

					triggerCommandPalette();
				}}><Command class="h-4 w-4 text-zinc-300" /></button
			>

			<VolumeControl />

			<button
				title="New Patch"
				class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();

					newPatch();
				}}><FilePlus2 class="h-4 w-4 text-zinc-300 hover:text-red-400" /></button
			>

			<StartupModal bind:open={showStartupModal} onLoadPatch={loadPatchById} />
		</div>
	{/if}

	<!-- Object Browser Modal -->
	<ObjectBrowserModal bind:open={showObjectBrowser} onSelectObject={handleObjectBrowserSelect} />

	<!-- AI Object Prompt Dialog -->
	<AiObjectPrompt
		bind:open={showAiPrompt}
		position={aiPromptPosition}
		editingNode={aiEditingNodeId ? nodes.find(n => n.id === aiEditingNodeId) : null}
		onInsertObject={handleAiObjectInsert}
		onEditObject={handleAiObjectEdit}
	/>
</div>

<style>
	:global(.svelte-flow) {
		background: transparent !important;
	}

	:global(.svelte-flow__background) {
		background: transparent !important;
	}

	:global(.svelte-flow__controls) {
		border-radius: 8px;
	}

	:global(.svelte-flow__controls button) {
		background: rgba(39, 39, 42, 0.5) !important;
		color: rgb(244 244 245) !important;
		border: transparent;
		height: 28px;
	}

	:global(.svelte-flow__controls button):first-child {
		border-top-left-radius: 8px;
		border-top-right-radius: 8px;
	}

	:global(.svelte-flow__controls button):last-child {
		border-bottom-left-radius: 8px;
		border-bottom-right-radius: 8px;
	}

	:global(.svelte-flow__controls button:hover) {
		background: rgb(39, 39, 42) !important;
	}
</style>
