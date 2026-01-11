<script lang="ts">
	import {
		CirclePlus,
		Command,
		Copy,
		FilePlus2,
		Link,
		Search,
		Sparkles,
		Trash2,
		Volume2,
		Cable,
		ClipboardPaste
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
	import { onDestroy, onMount, tick } from 'svelte';
	import CommandPalette from './CommandPalette.svelte';
	import StartupModal from './startup-modal/StartupModal.svelte';
	import VolumeControl from './VolumeControl.svelte';
	import ObjectBrowserModal from './object-browser/ObjectBrowserModal.svelte';
	import AiObjectPrompt from './AiObjectPrompt.svelte';
	import { MessageSystem } from '$lib/messages/MessageSystem';
	import BackgroundOutputCanvas from './BackgroundOutputCanvas.svelte';
	import {
		isAiFeaturesVisible,
		isBottomBarVisible,
		isConnecting,
		connectingFromHandleId,
		isConnectionMode
	} from '../../stores/ui.store';
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
	import { getSharedPatchData } from '$lib/api/pb';
	import { createAndCopyShareLink } from '$lib/save-load/share';
	import { isBackgroundOutputCanvasEnabled, hasSomeAudioNode } from '../../stores/canvas.store';
	import { deleteSearchParam, getSearchParam } from '$lib/utils/search-params';
	import BackgroundPattern from './BackgroundPattern.svelte';
	import { ObjectShorthandRegistry } from '$lib/registry/ObjectShorthandRegistry';
	import { AudioRegistry } from '$lib/registry/AudioRegistry';
	import { ObjectRegistry } from '$lib/registry/ObjectRegistry';
	import { Toaster } from '$lib/components/ui/sonner';
	import {
		isAudioParamInlet,
		isValidConnectionBetweenHandles
	} from '$lib/utils/connection-validation';

	// @ts-expect-error -- no typedefs
	import { toast } from 'svelte-sonner';

	const AUTOSAVE_INTERVAL = 2500;

	// Initial nodes and edges
	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);

	let nodeIdCounter = 0;
	let edgeIdCounter = 0;
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

	// Check if Gemini API key is set (for showing AI button)
	let hasGeminiApiKey = $state(false);

	// Get flow utilities for coordinate transformation
	const { screenToFlowPosition, deleteElements, fitView, getViewport, getNode } = useSvelteFlow();

	// Track nodes and edges for message routing
	let previousNodes = new Set<string>();

	// Autosave functionality
	let autosaveInterval: ReturnType<typeof setInterval> | null = null;

	let selectedNodeIds = $state.raw<string[]>([]);
	let selectedEdgeIds = $state.raw<string[]>([]);

	// Clipboard for copy-paste functionality
	let copiedNodeData = $state<Array<{
		type: string;
		data: any;
		relativePosition: { x: number; y: number };
	}> | null>(null);

	let isLoadingFromUrl = $state(false);
	let urlLoadError = $state<string | null>(null);
	let showAudioHint = $state(audioService.getAudioContext().state === 'suspended');
	let showStartupModal = $state(localStorage.getItem('patchies-show-startup-modal') !== 'false');

	// Mobile connection mode state - simplified to just toggle connection mode
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
			copySelectedNodes();
		}
		// Handle CTRL+V for paste
		else if (event.key.toLowerCase() === 'v' && (event.metaKey || event.ctrlKey) && !isTyping) {
			event.preventDefault();
			pasteNode('keyboard');
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

	async function handleAiMultipleObjectsInsert(
		objectNodes: Array<{ type: string; data: any; position?: { x: number; y: number } }>,
		simplifiedEdges: Array<{
			source: number;
			target: number;
			sourceHandle?: string;
			targetHandle?: string;
		}>
	) {
		const { handleMultiObjectInsert } = await import('$lib/ai/handle-multi-object-insert');

		// Get base position (center around mouse position)
		const basePosition = screenToFlowPosition(lastMousePosition);

		// Get current viewport for context
		const viewport = getViewport();

		// Process the multi-object insertion
		const result = await handleMultiObjectInsert({
			objectNodes,
			simplifiedEdges,
			basePosition,
			nodeIdCounter,
			edgeIdCounter,
			viewport
		});

		// Update counters
		nodeIdCounter = result.nextNodeIdCounter;
		edgeIdCounter = result.nextEdgeIdCounter;

		// Add all new nodes first
		nodes = [...nodes, ...result.newNodes];

		// Wait for DOM to update and XYFlow to process the new nodes
		await tick();

		// Add all new edges after nodes are rendered
		edges = [...edges, ...result.newEdges];

		// Wait one more tick to ensure edges are rendered
		await tick();
	}

	function handleAiObjectEdit(nodeId: string, data: any) {
		nodes = nodes.map((node) => {
			if (node.id !== nodeId) return node;

			// Define fields that should NOT be overwritten (internal state)
			// Note: node.data should only contain user data, not node.id (that's at node.id)
			const preservedFields = new Set([
				'name', // Internal node name, different from user-facing title
				'executeCode', // Internal execution trigger flag (timestamp)
				'initialized' // Internal initialization state
			]);

			// Start with existing data
			const updatedData = { ...node.data };

			// Merge all fields from AI response except preserved ones
			// Also skip any fields starting with __ (internal convention)
			for (const [key, value] of Object.entries(data)) {
				if (!preservedFields.has(key) && !key.startsWith('__')) {
					updatedData[key] = value;
				}
			}

			// Add execution trigger if code was updated
			if (data.code !== undefined && data.code !== node.data.code) {
				updatedData.executeCode = Date.now();
			}

			return { ...node, data: updatedData };
		});
	}

	onMount(() => {
		flowContainer?.focus();

		glSystem.start();
		audioService.start();

		loadPatch();

		// Check if Gemini API key is set
		hasGeminiApiKey = !!localStorage.getItem('gemini-api-key');

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
		// Re-check if API key was just set
		hasGeminiApiKey = !!localStorage.getItem('gemini-api-key');
	}

	function cancelConnectionMode() {
		isConnectionMode.set(false);
		isConnecting.set(false);
		connectingFromHandleId.set(null);
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
		const targetNode = getNode(connection.target);

		const objectName =
			targetNode?.type === 'object' ? (targetNode.data?.name as string) : undefined;

		return isValidConnectionBetweenHandles(connection.sourceHandle, connection.targetHandle, {
			isTargetAudioParam: isAudioParamInlet(objectName, connection.targetHandle)
		});
	};

	function getNodeIdCounterFromSave(nodes: Node[]): number {
		if (nodes.length === 0) return 0 + 1;

		const lastNodeId = parseInt(nodes.at(-1)?.id.match(/.*\-(\d+)$/)?.[1] ?? '');
		if (isNaN(lastNodeId)) throw new Error('corrupted save - cannot get last node id');

		return lastNodeId + 1;
	}

	// Copy selected nodes to clipboard
	function copySelectedNodes() {
		if (selectedNodeIds.length === 0) return;

		const selectedNodes = nodes.filter((node) => selectedNodeIds.includes(node.id) && node.type);
		if (selectedNodes.length === 0) return;

		// Calculate the center point of all selected nodes
		const centerX =
			selectedNodes.reduce((sum, node) => sum + node.position.x, 0) / selectedNodes.length;

		const centerY =
			selectedNodes.reduce((sum, node) => sum + node.position.y, 0) / selectedNodes.length;

		// Store nodes with their relative positions from the center
		copiedNodeData = selectedNodes.map((node) => ({
			type: node.type!,
			data: { ...node.data },
			relativePosition: {
				x: node.position.x - centerX,
				y: node.position.y - centerY
			}
		}));

		toast.success(`Copied ${selectedNodes.length} node${selectedNodes.length === 1 ? '' : 's'}`);
	}

	// Paste copied nodes at current mouse position or center of screen
	function pasteNode(source: 'keyboard' | 'button') {
		if (!copiedNodeData || copiedNodeData.length === 0) return;

		// Get the paste position (where the center of the copied nodes will be placed)
		const pastePosition = match(source)
			.with('keyboard', () => screenToFlowPosition(lastMousePosition))
			.with('button', () => {
				const centerX = window.innerWidth / 2;
				const centerY = window.innerHeight / 2;

				return screenToFlowPosition({ x: centerX, y: centerY });
			})
			.exhaustive();

		// Create all nodes with their relative positions preserved
		for (const nodeData of copiedNodeData) {
			const position = {
				x: pastePosition.x + nodeData.relativePosition.x,
				y: pastePosition.y + nodeData.relativePosition.y
			};

			createNode(nodeData.type, position, nodeData.data);
		}

		toast.success(`Pasted ${copiedNodeData.length} node${copiedNodeData.length === 1 ? '' : 's'}`);
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

	function onAiInsertOrEdit() {
		// Check if Gemini API key is set, show helpful message if not
		const hasApiKey = localStorage.getItem('gemini-api-key');

		if (!hasApiKey) {
			const shouldSetKey = confirm(
				'AI Object Insertion requires a Gemini API key. Would you like to set it now?'
			);

			if (shouldSetKey) {
				triggerCommandPalette();
			}

			return;
		}

		// If a single node is selected, edit it,
		// otherwise create new ones
		if (selectedNodeIds.length === 1) {
			aiEditingNodeId = selectedNodeIds[0];
		} else {
			aiEditingNodeId = null;
		}

		triggerAiPrompt();
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

	<!-- Connection Mode Indicator -->
	{#if $isConnectionMode}
		<div class="absolute top-4 left-1/2 z-50 -translate-x-1/2 transform">
			<div
				class={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm backdrop-blur-sm ${
					$isConnecting
						? 'border-green-600 bg-green-900/80 text-green-200'
						: 'border-blue-600 bg-blue-900/80 text-blue-200'
				}`}
			>
				<Cable class="h-4 w-4" />
				<span>
					{#if $isConnecting}
						Tap or drag to another handle to connect
					{:else}
						Tap on a handle to start the connection
					{/if}
				</span>
				<button
					class={`ml-2 hover:text-blue-100 ${$isConnecting ? 'text-green-300' : 'text-blue-300'}`}
					onclick={cancelConnectionMode}
					title="Cancel"
				>
					×
				</button>
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
			onconnectstart={(event, params) => {
				isConnecting.set(true);
				// Construct fully qualified handle identifier (nodeId/handleId)
				const qualifiedHandleId =
					params.nodeId && params.handleId
						? `${params.nodeId}/${params.handleId}`
						: params.handleId || null;
				connectingFromHandleId.set(qualifiedHandleId);
			}}
			onconnectend={() => {
				isConnecting.set(false);
				connectingFromHandleId.set(null);
			}}
			onclickconnectstart={(event, params) => {
				isConnecting.set(true);
				// Construct fully qualified handle identifier (nodeId/handleId)
				const qualifiedHandleId =
					params.nodeId && params.handleId
						? `${params.nodeId}/${params.handleId}`
						: params.handleId || null;
				connectingFromHandleId.set(qualifiedHandleId);
			}}
			onclickconnectend={(event, connectionState) => {
				isConnecting.set(false);
				connectingFromHandleId.set(null);

				// Show success toast if connection was successfully made
				// connectionState will have connection details if successful
				if (connectionState?.isValid) {
					toast.success('Objects connected by tap.');
				}
			}}
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
				onShowAiPrompt={() => {
					aiEditingNodeId = null;
					onAiInsertOrEdit();
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

			{#if selectedNodeIds.length > 0 || (selectedNodeIds.length === 0 && copiedNodeData && copiedNodeData.length > 0)}
				<button
					title="Copy / Paste"
					class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
					onclick={(e) => {
						e.preventDefault();
						e.stopPropagation();

						if (selectedNodeIds.length === 0 && copiedNodeData && copiedNodeData.length > 0) {
							pasteNode('button');
						} else if (selectedNodeIds && (!copiedNodeData || copiedNodeData.length === 0)) {
							copySelectedNodes();
						}
					}}
				>
					{#if selectedNodeIds.length === 0 && copiedNodeData && copiedNodeData.length > 0}
						<ClipboardPaste class="h-4 w-4 text-zinc-300" />
					{:else}
						<Copy class="h-4 w-4 text-zinc-300" />
					{/if}
				</button>
			{/if}

			<!-- Only show connection button if there are at least 2 nodes -->
			<!-- You can't connect a single node to itself -->
			{#if nodes.length >= 2}
				<button
					title={$isConnectionMode ? 'Exit Easy Connect' : 'Easy Connect'}
					class={`cursor-pointer rounded p-1 ${$isConnectionMode ? 'bg-blue-600/70 hover:bg-blue-800/70' : 'bg-zinc-900/70 hover:bg-zinc-700'}`}
					onclick={(e) => {
						e.preventDefault();
						e.stopPropagation();

						if ($isConnectionMode) {
							cancelConnectionMode();
						} else {
							isConnectionMode.set(true);
						}
					}}><Cable class="h-4 w-4 text-zinc-300" /></button
				>
			{/if}

			{#if $isAiFeaturesVisible && hasGeminiApiKey}
				<button
					title="AI Create/Edit Object (Cmd+I)"
					class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
					onclick={(e) => {
						e.preventDefault();
						e.stopPropagation();

						onAiInsertOrEdit();
					}}><Sparkles class="h-4 w-4 text-zinc-300" /></button
				>
			{/if}

			<button
				title="Share Patch Link"
				class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
				onclick={() => createAndCopyShareLink(nodes, edges)}
				><Link class="h-4 w-4 text-zinc-300" /></button
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
		editingNode={aiEditingNodeId ? nodes.find((n) => n.id === aiEditingNodeId) : null}
		onInsertObject={handleAiObjectInsert}
		onInsertMultipleObjects={handleAiMultipleObjectsInsert}
		onEditObject={handleAiObjectEdit}
	/>

	<!-- Toast Notifications -->
	<Toaster position="top-center" />
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
