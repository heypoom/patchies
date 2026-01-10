<script lang="ts">
	import {
		CirclePlus,
		Command,
		FilePlus2,
		Link,
		Search,
		Sparkles,
		Trash2,
		Volume2,
		Cable
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
	const { screenToFlowPosition, deleteElements, fitView, getViewport } = useSvelteFlow();

	// Track nodes and edges for message routing
	let previousNodes = new Set<string>();

	// Autosave functionality
	let autosaveInterval: ReturnType<typeof setInterval> | null = null;

	let selectedNodeIds = $state.raw<string[]>([]);
	let selectedEdgeIds = $state.raw<string[]>([]);

	// Node list visibility state
	let isNodeListVisible = $state(false);

	// Clipboard for copy-paste functionality
	let copiedNodeData: Array<{
		type: string;
		data: any;
		relativePosition: { x: number; y: number };
	}> | null = null;

	let isLoadingFromUrl = $state(false);
	let urlLoadError = $state<string | null>(null);
	let showAudioHint = $state(audioService.getAudioContext().state === 'suspended');
	let showStartupModal = $state(localStorage.getItem('patchies-show-startup-modal') !== 'false');

	// Mobile connection mode state
	let isConnectionMode = $state(false);
	let connectionSourceNode = $state<string | null>(null);
	let connectionDestinationNode = $state<string | null>(null);
	let sourceNodeConfirmed = $state(false);
	let destinationNodeConfirmed = $state(false);
	let showSourceOutletSelection = $state(false);
	let showDestinationInletSelection = $state(false);
	let availableSourceHandles = $state<Array<{ id: string; label: string; type: string }>>([]);
	let availableTargetHandles = $state<Array<{ id: string; label: string; type: string }>>([]);
	let selectedSourceHandle = $state<string | null>(null);
	let selectedTargetHandle = $state<string | null>(null);

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
			return !connection.targetHandle?.startsWith('audio-in');
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

		// Audio inlets must come from audio sources (for audio synthesis chains)
		// But audio outlets can connect to message inlets (for parameter automation)
		if (connection.targetHandle?.startsWith('audio-in')) {
			return !!connection.sourceHandle?.startsWith('audio');
		}

		// Audio outlets can connect to non-audio targets (message inlets for automation)
		// Message connections are always allowed
		return true;
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
	}

	// Paste copied nodes at current mouse position
	function pasteNode() {
		if (!copiedNodeData || copiedNodeData.length === 0) return;

		// Get the paste position (where the center of the copied nodes will be placed)
		const pastePosition = screenToFlowPosition(lastMousePosition);

		// Create all nodes with their relative positions preserved
		for (const nodeData of copiedNodeData) {
			const position = {
				x: pastePosition.x + nodeData.relativePosition.x,
				y: pastePosition.y + nodeData.relativePosition.y
			};

			createNode(nodeData.type, position, nodeData.data);
		}
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

	// Mobile connection mode functions
	function startConnectionMode() {
		isConnectionMode = true;
		connectionSourceNode = null;
		connectionDestinationNode = null;
		sourceNodeConfirmed = false;
		destinationNodeConfirmed = false;
		showSourceOutletSelection = false;
		showDestinationInletSelection = false;
		selectedSourceHandle = null;
		selectedTargetHandle = null;
	}

	function cancelConnectionMode() {
		isConnectionMode = false;
		connectionSourceNode = null;
		connectionDestinationNode = null;
		sourceNodeConfirmed = false;
		destinationNodeConfirmed = false;
		showSourceOutletSelection = false;
		showDestinationInletSelection = false;
		selectedSourceHandle = null;
		selectedTargetHandle = null;
	}

	// Get available handles for a node
	async function getNodeHandles(
		node: Node,
		direction: 'source' | 'target'
	): Promise<Array<{ id: string; label: string; type: string }>> {
		const handles: Array<{ id: string; label: string; type: string }> = [];

		// For 'object' nodes, we need to get their metadata
		if (node.type === 'object') {
			const { getCombinedMetadata } = await import('$lib/objects/v2/get-metadata');
			const { getObjectNameFromExpr } = await import('$lib/objects/object-definitions');

			const expr = node.data?.expr || node.data?.name || '';
			const objectName = getObjectNameFromExpr(expr);
			const meta = getCombinedMetadata(objectName);

			if (direction === 'source' && meta?.outlets) {
				meta.outlets.forEach((outlet, index) => {
					const portType = outlet.type === 'signal' ? 'audio' : 'message';
					const handleId = `${portType}-out-${index}`;
					const label = outlet.name || `Outlet ${index}`;
					handles.push({ id: handleId, label, type: portType });
				});
			} else if (direction === 'target' && meta?.inlets) {
				meta.inlets.forEach((inlet, index) => {
					const portType = inlet.type === 'signal' ? 'audio' : 'message';
					const handleId = `${portType}-in-${index}`;
					const label = inlet.name || `Inlet ${index}`;
					handles.push({ id: handleId, label, type: portType });
				});
			}
		} else {
			// For other node types, provide generic handles
			// This is a simplified approach - ideally we'd inspect each node type
			if (direction === 'source') {
				handles.push({ id: 'message-out', label: 'Output', type: 'message' });
				// Add audio output for audio-related nodes
				if (node.type?.includes('~')) {
					handles.push({ id: 'audio-out', label: 'Audio Out', type: 'audio' });
				}
				// Add video output for visual nodes
				if (['p5', 'hydra', 'glsl', 'video', 'webcam', 'swgl'].includes(node.type || '')) {
					handles.push({ id: 'video-out', label: 'Video Out', type: 'video' });
				}
			} else {
				handles.push({ id: 'message-in', label: 'Input', type: 'message' });
				// Add audio input for audio-related nodes
				if (node.type?.includes('~')) {
					handles.push({ id: 'audio-in', label: 'Audio In', type: 'audio' });
				}
				// Add video input for visual nodes
				if (['p5', 'hydra', 'glsl', 'swgl'].includes(node.type || '')) {
					handles.push({ id: 'video-in', label: 'Video In', type: 'video' });
				}
			}
		}

		return handles;
	}

	function handleNodeClickForConnection(nodeId: string) {
		if (!isConnectionMode) return;

		if (!sourceNodeConfirmed) {
			// Select source node (pending confirmation)
			connectionSourceNode = nodeId;
		} else if (!destinationNodeConfirmed) {
			// Select destination node (pending confirmation)
			connectionDestinationNode = nodeId;
		}
	}

	async function confirmSourceNode() {
		if (!connectionSourceNode) return;

		const sourceNode = nodes.find((n) => n.id === connectionSourceNode);
		if (!sourceNode) {
			cancelConnectionMode();
			return;
		}

		// Get available source handles
		const sourceHandles = await getNodeHandles(sourceNode, 'source');
		availableSourceHandles = sourceHandles;

		// If multiple outlets, show selection modal
		if (sourceHandles.length > 1) {
			selectedSourceHandle = sourceHandles[0]?.id || null;
			showSourceOutletSelection = true;
		} else {
			// Single outlet - auto-select and confirm
			selectedSourceHandle = sourceHandles[0]?.id || null;
			sourceNodeConfirmed = true;
		}
	}

	function confirmSourceOutlet() {
		showSourceOutletSelection = false;
		sourceNodeConfirmed = true;
	}

	async function confirmDestinationNode() {
		if (!connectionDestinationNode || !connectionSourceNode) return;

		// Can't connect a node to itself
		if (connectionDestinationNode === connectionSourceNode) {
			cancelConnectionMode();
			return;
		}

		const destinationNode = nodes.find((n) => n.id === connectionDestinationNode);
		if (!destinationNode) {
			cancelConnectionMode();
			return;
		}

		// Get available target handles
		const targetHandles = await getNodeHandles(destinationNode, 'target');
		availableTargetHandles = targetHandles;

		// If multiple inlets, show selection modal
		if (targetHandles.length > 1) {
			selectedTargetHandle = targetHandles[0]?.id || null;
			showDestinationInletSelection = true;
		} else {
			// Single inlet - auto-select and create connection
			selectedTargetHandle = targetHandles[0]?.id || null;
			createConnection(
				connectionSourceNode,
				connectionDestinationNode,
				selectedSourceHandle || undefined,
				targetHandles[0]?.id
			);
		}
	}

	function confirmDestinationInlet() {
		showDestinationInletSelection = false;
		if (!connectionSourceNode || !connectionDestinationNode) return;

		createConnection(
			connectionSourceNode,
			connectionDestinationNode,
			selectedSourceHandle || undefined,
			selectedTargetHandle || undefined
		);
	}

	async function selectDestinationNode(destinationNodeId: string) {
		// This function is no longer used in the new flow
		// Kept for compatibility but will be refactored
	}

	function createConnection(
		sourceId: string,
		targetId: string,
		sourceHandle?: string,
		targetHandle?: string
	) {
		const newEdge = {
			id: `e${sourceId}-${targetId}-${edgeIdCounter++}`,
			source: sourceId,
			target: targetId,
			sourceHandle: sourceHandle || undefined,
			targetHandle: targetHandle || undefined
		};

		edges = [...edges, newEdge];
		cancelConnectionMode();
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

	<!-- Audio Resume Hint -->
	{#if showAudioHint && !isLoadingFromUrl && $hasSomeAudioNode && !showStartupModal}
		<div class="absolute left-1/2 top-4 z-50 -translate-x-1/2 transform">
			<div
				class="flex items-center gap-2 rounded-lg border border-blue-600 bg-blue-900/80 px-4 py-2 text-sm text-blue-200 backdrop-blur-sm"
			>
				<Volume2 class="h-4 w-4" />
				<span>Click anywhere to play sound</span>
			</div>
		</div>
	{/if}

	<!-- Connection Mode Indicator -->
	{#if isConnectionMode && !connectionSourceNode}
		<div class="absolute left-1/2 top-4 z-50 -translate-x-1/2 transform">
			<div
				class="flex items-center gap-2 rounded-lg border border-blue-600 bg-blue-900/80 px-4 py-2 text-sm text-blue-200 backdrop-blur-sm"
			>
				<Cable class="h-4 w-4" />
				<span>Click on a node to select source</span>
				<button
					class="ml-2 text-blue-300 hover:text-blue-100"
					onclick={cancelConnectionMode}
					title="Cancel"
				>
					×
				</button>
			</div>
		</div>
	{/if}

	<!-- Connection Mode - Source Node Selected (Pending Confirmation) -->
	{#if isConnectionMode && connectionSourceNode && !sourceNodeConfirmed}
		<div class="absolute left-1/2 top-4 z-50 -translate-x-1/2 transform">
			<div
				class="flex items-center gap-3 rounded-lg border border-yellow-600 bg-yellow-900/80 px-4 py-2 text-sm text-yellow-200 backdrop-blur-sm"
			>
				<Cable class="h-4 w-4" />
				<span
					>Source selected: {nodes.find((n) => n.id === connectionSourceNode)?.type ||
						'node'}</span
				>
				<button
					class="rounded bg-yellow-700 px-3 py-1 text-xs font-medium text-yellow-100 hover:bg-yellow-600"
					onclick={confirmSourceNode}
				>
					Select
				</button>
				<button
					class="text-yellow-300 hover:text-yellow-100"
					onclick={cancelConnectionMode}
					title="Cancel"
				>
					×
				</button>
			</div>
		</div>
	{/if}

	<!-- Connection Mode - Source Confirmed, Select Destination -->
	{#if isConnectionMode && sourceNodeConfirmed && !connectionDestinationNode}
		<div class="absolute left-1/2 top-4 z-50 -translate-x-1/2 transform">
			<div
				class="flex items-center gap-2 rounded-lg border border-green-600 bg-green-900/80 px-4 py-2 text-sm text-green-200 backdrop-blur-sm"
			>
				<Cable class="h-4 w-4" />
				<span
					>Source: {nodes.find((n) => n.id === connectionSourceNode)?.type || 'selected'} →
					Click destination node</span
				>
				<button
					class="ml-2 text-green-300 hover:text-green-100"
					onclick={cancelConnectionMode}
					title="Cancel"
				>
					×
				</button>
			</div>
		</div>
	{/if}

	<!-- Connection Mode - Destination Node Selected (Pending Confirmation) -->
	{#if isConnectionMode && connectionDestinationNode && !destinationNodeConfirmed}
		<div class="absolute left-1/2 top-4 z-50 -translate-x-1/2 transform">
			<div
				class="flex items-center gap-3 rounded-lg border border-yellow-600 bg-yellow-900/80 px-4 py-2 text-sm text-yellow-200 backdrop-blur-sm"
			>
				<Cable class="h-4 w-4" />
				<span
					>Destination selected: {nodes.find((n) => n.id === connectionDestinationNode)?.type ||
						'node'}</span
				>
				<button
					class="rounded bg-yellow-700 px-3 py-1 text-xs font-medium text-yellow-100 hover:bg-yellow-600"
					onclick={confirmDestinationNode}
				>
					Select
				</button>
				<button
					class="text-yellow-300 hover:text-yellow-100"
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
			onnodeclick={({ node }) => {
				if (isConnectionMode) {
					handleNodeClickForConnection(node.id);
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
			/>
		{/if}
	</div>

	<!-- Bottom toolbar buttons -->
	{#if $isBottomBarVisible}
		<div class="fixed bottom-0 right-0 p-2">
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
				title={isConnectionMode ? 'Cancel Connection' : 'Connect Nodes'}
				class={`cursor-pointer rounded p-1 hover:bg-zinc-700 ${isConnectionMode ? 'bg-blue-600/70' : 'bg-zinc-900/70'}`}
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();

					if (isConnectionMode) {
						cancelConnectionMode();
					} else {
						startConnectionMode();
					}
				}}><Cable class="h-4 w-4 text-zinc-300" /></button
			>

			{#if $isAiFeaturesVisible && hasGeminiApiKey}
				<button
					title="AI Create/Edit Object (Cmd+I)"
					class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
					onclick={(e) => {
						e.preventDefault();
						e.stopPropagation();

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
					}}><Sparkles class="h-4 w-4 text-zinc-300" /></button
				>
			{/if}

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
		editingNode={aiEditingNodeId ? nodes.find((n) => n.id === aiEditingNodeId) : null}
		onInsertObject={handleAiObjectInsert}
		onInsertMultipleObjects={handleAiMultipleObjectsInsert}
		onEditObject={handleAiObjectEdit}
	/>

	<!-- Mobile Connection Mode: Source Outlet Selection Modal -->
	{#if showSourceOutletSelection && connectionSourceNode}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
			onclick={cancelConnectionMode}
		>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="max-h-[80vh] w-full max-w-md overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl"
				onclick={(e) => e.stopPropagation()}
			>
				<div class="border-b border-zinc-700 p-4">
					<h2 class="text-lg font-semibold text-zinc-200">Select Outlet</h2>
					<p class="mt-1 text-sm text-zinc-400">
						Choose which outlet to connect from {nodes.find((n) => n.id === connectionSourceNode)
							?.type || 'source'}
					</p>
				</div>

				<div class="max-h-[60vh] overflow-y-auto p-4">
					{#if availableSourceHandles.length > 0}
						<div class="space-y-1">
							{#each availableSourceHandles as handle (handle.id)}
								<button
									class={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
										selectedSourceHandle === handle.id
											? 'border-blue-500 bg-blue-900/30 text-blue-200'
											: 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
									}`}
									onclick={() => (selectedSourceHandle = handle.id)}
								>
									<div class="flex items-center justify-between">
										<span class="font-medium">{handle.label}</span>
										<span
											class={`text-xs ${
												handle.type === 'audio'
													? 'text-blue-400'
													: handle.type === 'video'
														? 'text-orange-400'
														: 'text-gray-400'
											}`}
										>
											{handle.type}
										</span>
									</div>
								</button>
							{/each}
						</div>
					{:else}
						<div class="text-sm text-zinc-500">No outlets available</div>
					{/if}
				</div>

				<div class="border-t border-zinc-700 p-4">
					<div class="flex gap-2">
						<button
							class="flex-1 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
							onclick={cancelConnectionMode}
						>
							Cancel
						</button>
						<button
							class="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
							onclick={confirmSourceOutlet}
							disabled={!selectedSourceHandle}
						>
							Confirm
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Mobile Connection Mode: Destination Inlet Selection Modal -->
	{#if showDestinationInletSelection && connectionDestinationNode}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
			onclick={cancelConnectionMode}
		>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="max-h-[80vh] w-full max-w-md overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl"
				onclick={(e) => e.stopPropagation()}
			>
				<div class="border-b border-zinc-700 p-4">
					<h2 class="text-lg font-semibold text-zinc-200">Select Inlet</h2>
					<p class="mt-1 text-sm text-zinc-400">
						Choose which inlet to connect to {nodes.find((n) => n.id === connectionDestinationNode)
							?.type || 'destination'}
					</p>
				</div>

				<div class="max-h-[60vh] overflow-y-auto p-4">
					{#if availableTargetHandles.length > 0}
						<div class="space-y-1">
							{#each availableTargetHandles as handle (handle.id)}
								<button
									class={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
										selectedTargetHandle === handle.id
											? 'border-blue-500 bg-blue-900/30 text-blue-200'
											: 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
									}`}
									onclick={() => (selectedTargetHandle = handle.id)}
								>
									<div class="flex items-center justify-between">
										<span class="font-medium">{handle.label}</span>
										<span
											class={`text-xs ${
												handle.type === 'audio'
													? 'text-blue-400'
													: handle.type === 'video'
														? 'text-orange-400'
														: 'text-gray-400'
											}`}
										>
											{handle.type}
										</span>
									</div>
								</button>
							{/each}
						</div>
					{:else}
						<div class="text-sm text-zinc-500">No inlets available</div>
					{/if}
				</div>

				<div class="border-t border-zinc-700 p-4">
					<div class="flex gap-2">
						<button
							class="flex-1 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
							onclick={cancelConnectionMode}
						>
							Cancel
						</button>
						<button
							class="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
							onclick={confirmDestinationInlet}
							disabled={!selectedTargetHandle}
						>
							Connect
						</button>
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
