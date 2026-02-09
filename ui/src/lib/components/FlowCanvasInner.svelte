<script lang="ts">
  import { Volume2, Cable } from '@lucide/svelte/icons';
  import {
    SvelteFlow,
    Controls,
    type Node,
    type Edge,
    useSvelteFlow,
    useViewport,
    type IsValidConnection,
    useOnSelectionChange
  } from '@xyflow/svelte';
  import { onDestroy, onMount, tick } from 'svelte';
  import CommandPalette from './CommandPalette.svelte';
  import ObjectBrowserModal from './object-browser/ObjectBrowserModal.svelte';
  import BottomToolbar from './BottomToolbar.svelte';
  import AiObjectPrompt from './AiObjectPrompt.svelte';
  import { MessageSystem } from '$lib/messages/MessageSystem';
  import BackgroundOutputCanvas from './BackgroundOutputCanvas.svelte';
  import {
    isAiFeaturesVisible,
    isBottomBarVisible,
    isConnecting,
    connectingFromHandleId,
    isConnectionMode,
    isObjectBrowserOpen,
    isMobile,
    isSidebarOpen,
    sidebarView,
    patchObjectTypes,
    currentPatchName,
    helpModeObject,
    selectedNodeInfo
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
  import { cleanupPatch } from '$lib/save-load/cleanup-patch';
  import { match } from 'ts-pattern';
  import type { PatchSaveFormat } from '$lib/save-load/serialize-patch';
  import { migratePatch } from '$lib/migration';
  import { getSharedPatchData } from '$lib/api/pb';
  import { isBackgroundOutputCanvasEnabled, hasSomeAudioNode } from '../../stores/canvas.store';
  import { getObjectNameFromExpr } from '$lib/objects/object-definitions';
  import { deleteSearchParam, getSearchParam } from '$lib/utils/search-params';
  import BackgroundPattern from './BackgroundPattern.svelte';
  import { ObjectShorthandRegistry } from '$lib/registry/ObjectShorthandRegistry';
  import { AudioRegistry } from '$lib/registry/AudioRegistry';
  import { ObjectRegistry } from '$lib/registry/ObjectRegistry';
  import { parseObjectParamFromString } from '$lib/objects/parse-object-param';
  import { Toaster } from '$lib/components/ui/sonner';
  import {
    isAudioParamInlet,
    isValidConnectionBetweenHandles
  } from '$lib/utils/connection-validation';
  import { ViewportCullingManager } from '$lib/canvas/ViewportCullingManager';
  import GeminiApiKeyDialog from './dialogs/GeminiApiKeyDialog.svelte';
  import NewPatchDialog from './dialogs/NewPatchDialog.svelte';
  import SavePatchModal from './dialogs/SavePatchModal.svelte';
  import LoadSharedPatchDialog from './dialogs/LoadSharedPatchDialog.svelte';
  import PatchToPromptDialog from './dialogs/PatchToPromptDialog.svelte';
  import SavePresetDialog from './presets/SavePresetDialog.svelte';
  import SidebarPanel from './sidebar/SidebarPanel.svelte';
  import { CanvasDragDropManager } from '$lib/canvas/CanvasDragDropManager';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import type { NodeReplaceEvent, VfsPathRenamedEvent } from '$lib/eventbus/events';
  import { WorkerNodeSystem } from '$lib/js-runner/WorkerNodeSystem';
  import { DirectChannelService } from '$lib/messages/DirectChannelService';

  import { toast } from 'svelte-sonner';
  import { initializeVFS, VirtualFilesystem } from '$lib/vfs';

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
  let eventBus = PatchiesEventBus.getInstance();
  let workerNodeSystem = WorkerNodeSystem.getInstance();
  let directChannelService = DirectChannelService.getInstance();

  // Object palette state
  let lastMousePosition = $state.raw({ x: 100, y: 100 });

  // Command palette state
  let showCommandPalette = $state(false);
  let commandPalettePosition = $state.raw({ x: 0, y: 0 });
  let flowContainer: HTMLDivElement;

  // AI object prompt state
  let showAiPrompt = $state(false);
  let aiPromptPosition = $state.raw({ x: 0, y: 0 });
  let aiEditingNodeId = $state<string | null>(null);

  // Check if Gemini API key is set (for showing AI button)
  let hasGeminiApiKey = $state(false);

  // Dialog state for missing API key
  let showMissingApiKeyDialog = $state(false);

  // Dialog state for new patch confirmation
  let showNewPatchDialog = $state(false);

  // Dialog state for save as preset
  let showSavePresetDialog = $state(false);
  let nodeToSaveAsPreset = $state<Node | null>(null);

  // Dialog state for save patch modal
  let showSavePatchModal = $state(false);

  // Dialog state for loading shared patch from URL
  let showLoadSharedPatchDialog = $state(false);
  let pendingSharedPatch = $state<PatchSaveFormat | null>(null);

  // Dialog state for patch-to-prompt generator
  let showPatchToPromptDialog = $state(false);

  // Get flow utilities for coordinate transformation
  const { screenToFlowPosition, deleteElements, fitView, getViewport, getNode } = useSvelteFlow();

  // Viewport culling for preview rendering optimization
  const viewport = useViewport();
  const viewportCullingManager = new ViewportCullingManager();

  viewportCullingManager.onVisibleNodesChange = (visibleNodes) => {
    glSystem.setVisibleNodes(visibleNodes);
  };

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
  let startupInitialTab = $state<'about' | 'demos' | 'shortcuts' | 'thanks'>('about');
  let isReadOnlyMode = $state(false);

  // Mobile connection mode state - simplified to just toggle connection mode
  useOnSelectionChange(({ nodes, edges }) => {
    selectedNodeIds = nodes.map((node) => node.id);
    selectedEdgeIds = edges.map((edge) => edge.id);

    // Sync selected node to store for context-sensitive help sidebar
    if (nodes.length === 1 && nodes[0].type) {
      // For "object" nodes, extract the actual object name from data.expr
      const nodeType = nodes[0].type;

      const resolvedType =
        nodeType === 'object' && nodes[0].data?.expr
          ? getObjectNameFromExpr(nodes[0].data.expr as string)
          : nodeType;

      selectedNodeInfo.set({ type: resolvedType, id: nodes[0].id });
    } else {
      selectedNodeInfo.set(null);
    }
  });

  function performAutosave() {
    const embedParam = getSearchParam('embed');
    const isEmbed = embedParam === 'true';

    // do not autosave when in embed mode, help mode, or read-only mode
    if (isEmbed || $helpModeObject || isReadOnlyMode) {
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
        audioService.removeNodeById(prevNodeId);
      }
    }

    previousNodes = currentNodes;
  });

  $effect(() => {
    messageSystem.updateEdges(edges);
    glSystem.updateEdges(edges);
    audioService.updateEdges(edges);
    audioAnalysisSystem.updateEdges(edges);
    workerNodeSystem.updateVideoConnections(edges);
    directChannelService.updateEdges(edges);
  });

  // Keep DirectChannelService informed of node types for direct messaging
  $effect(() => {
    directChannelService.updateNodeTypes(
      nodes
        .filter((n): n is typeof n & { type: string } => n.type !== undefined)
        .map((n) => ({ id: n.id, type: n.type }))
    );
  });

  // Update patchObjectTypes store for components outside the flow context (e.g., ObjectBrowserModal)
  $effect(() => {
    const types = new Set<string>();

    for (const node of nodes) {
      if (node.type === 'object' && node.data?.name) {
        types.add(node.data.name as string);
      } else if (node.type && node.type !== 'object') {
        types.add(node.type);
      }
    }

    patchObjectTypes.set(types);
  });

  // Update visible nodes for preview culling when viewport or nodes change
  $effect(() => {
    const currentViewport = viewport.current;
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;

    viewportCullingManager.updateVisibleNodes(currentViewport, nodes, screenWidth, screenHeight);
  });

  // Handle global keyboard events
  function handleGlobalKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;

    const isTyping =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target.closest('.cm-editor') ||
      target.closest('.cm-content') ||
      target.contentEditable === 'true' ||
      // Allow text selection in virtual console
      target.closest('[role="log"]') ||
      // Allow copy in sidebar
      target.closest('[data-sidebar]');

    const hasNodeSelected = selectedNodeIds.length > 0;

    // Handle CTRL+C for copy
    // Skip if there's text selected (user wants to copy text, not nodes)
    const hasTextSelection = window.getSelection()?.toString().trim();

    if (
      event.key.toLowerCase() === 'c' &&
      (event.metaKey || event.ctrlKey) &&
      !isTyping &&
      hasNodeSelected &&
      !hasTextSelection
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
    // Handle CMD+B for toggle sidebar
    else if (event.key.toLowerCase() === 'b' && (event.metaKey || event.ctrlKey) && !isTyping) {
      event.preventDefault();
      $isSidebarOpen = !$isSidebarOpen;
    }
    // Handle CMD+O for browse objects
    else if (event.key.toLowerCase() === 'o' && (event.metaKey || event.ctrlKey) && !isTyping) {
      event.preventDefault();
      $isObjectBrowserOpen = true;
    }
    // Handle CMD+N for new patch
    else if (event.key.toLowerCase() === 'n' && (event.metaKey || event.ctrlKey) && !isTyping) {
      event.preventDefault();
      newPatch();
    }
    // Handle CMD+I for AI object insertion/editing
    else if (event.key.toLowerCase() === 'i' && (event.metaKey || event.ctrlKey) && !isTyping) {
      event.preventDefault();

      // When AI features are hidden, fallback to browse objects (Ctrl+O behavior)
      if (!$isAiFeaturesVisible) {
        $isObjectBrowserOpen = true;
        return;
      }

      // Check if Gemini API key is set
      if (!checkAndHandleGeminiApiKey()) {
        return;
      }

      // If a single node is selected, edit it; otherwise create new
      if (selectedNodeIds.length === 1) {
        aiEditingNodeId = selectedNodeIds[0];
      } else {
        aiEditingNodeId = null;
      }

      triggerAiPrompt();
    }
    // Handle CMD+Shift+S for Save As (always shows modal)
    else if (
      event.key.toLowerCase() === 's' &&
      (event.metaKey || event.ctrlKey) &&
      event.shiftKey &&
      !isTyping
    ) {
      event.preventDefault();

      // No-op if patch is completely empty
      if (nodes.length === 0 && edges.length === 0) return;

      showSavePatchModal = true;
    }
    // Handle CMD+S for save (quick save if named, otherwise show modal)
    else if (event.key.toLowerCase() === 's' && (event.metaKey || event.ctrlKey) && !isTyping) {
      event.preventDefault();

      // No-op if patch is completely empty
      if (nodes.length === 0 && edges.length === 0) return;

      quickSave();
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
    const dialogWidth = 320; // w-80
    const sidebarWidth = $isSidebarOpen && !$isMobile ? 256 : 0; // w-64
    const availableWidth = window.innerWidth - sidebarWidth;
    const centerX = (availableWidth - dialogWidth) / 2;
    const centerY = window.innerHeight / 2 - 200;

    commandPalettePosition = { x: Math.max(0, centerX), y: Math.max(0, centerY) };
    showCommandPalette = true;
  }

  /**
   * Quick save: if patch has a name, save directly; otherwise show Save modal
   */
  function quickSave() {
    const name = $currentPatchName;

    if (name) {
      // Remove any URL params related to shared patches
      deleteSearchParam('id');
      deleteSearchParam('src');

      // Silent save - no toast for quick save to existing name
      savePatchToLocalStorage({ name, nodes, edges });
    } else {
      // No current patch name, show the Save modal
      showSavePatchModal = true;
    }
  }

  /**
   * Unified handler for checking Gemini API key and showing appropriate UI
   * Returns true if key exists and is valid, false otherwise
   */
  function checkAndHandleGeminiApiKey(): boolean {
    const hasApiKey = !!localStorage.getItem('gemini-api-key');

    if (!hasApiKey) {
      showMissingApiKeyDialog = true;
    }

    return hasApiKey;
  }

  function onGeminiApiKeySaved() {
    hasGeminiApiKey = true;

    // If a single node is selected, edit it; otherwise create new
    if (selectedNodeIds.length === 1) {
      aiEditingNodeId = selectedNodeIds[0];
    } else {
      aiEditingNodeId = null;
    }

    triggerAiPrompt();
  }

  function triggerAiPrompt() {
    const dialogWidth = 384; // w-96
    const sidebarWidth = $isSidebarOpen && !$isMobile ? 256 : 0; // w-64
    const availableWidth = window.innerWidth - sidebarWidth;
    const centerX = (availableWidth - dialogWidth) / 2;
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

    // Initialize VFS with providers
    initializeVFS();

    glSystem.start();
    audioService.start();

    loadPatch();

    // Check if Gemini API key is set
    hasGeminiApiKey = !!localStorage.getItem('gemini-api-key');

    // Check if the user wants to see the startup modal on launch
    // Don't show if loading from URL params (src or id)
    const params = new URLSearchParams(window.location.search);
    const isLoadingFromUrlParam = params.has('src') || params.has('id');

    // Check for ?startup= param to force-open startup modal at a specific tab
    const startupParam = params.get('startup');
    if (startupParam) {
      const validTabs = ['about', 'demos', 'shortcuts', 'thanks'] as const;
      if (validTabs.includes(startupParam as (typeof validTabs)[number])) {
        startupInitialTab = startupParam as (typeof validTabs)[number];
        showStartupModal = true;
        // Clean up the URL param after using it
        deleteSearchParam('startup');
      }
    } else if (!isLoadingFromUrlParam) {
      const showStartupSetting = localStorage.getItem('patchies-show-startup-modal');
      // Default to true if not set (first time users), or respect user's preference
      if (showStartupSetting === null || showStartupSetting === 'true') {
        showStartupModal = true;
      }
    }

    document.addEventListener('keydown', handleGlobalKeydown);
    eventBus.addEventListener('nodeReplace', replaceNode);
    eventBus.addEventListener('vfsPathRenamed', handleVfsPathRenamed);
    eventBus.addEventListener('insertVfsFileToCanvas', handleInsertVfsFile);
    eventBus.addEventListener('insertPresetToCanvas', handleInsertPreset);

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

    eventBus.removeEventListener('nodeReplace', replaceNode);
    eventBus.removeEventListener('vfsPathRenamed', handleVfsPathRenamed);
    eventBus.removeEventListener('insertVfsFileToCanvas', handleInsertVfsFile);
    eventBus.removeEventListener('insertPresetToCanvas', handleInsertPreset);

    // Clean up autosave interval
    if (autosaveInterval) {
      clearInterval(autosaveInterval);
      autosaveInterval = null;
    }

    // Clean up viewport culling manager
    viewportCullingManager.destroy();

    glSystem.renderWorker.terminate();
  });

  async function loadPatch() {
    if (typeof window === 'undefined') return null;

    const params = new URLSearchParams(window.location.search);
    const src = params.get('src');
    const id = params.get('id');
    const help = params.get('help');
    const readonly = params.get('readonly');

    // Check for ?readonly=true parameter (enables read-only mode without help context)
    if (readonly === 'true') {
      isReadOnlyMode = true;
    }

    // For ?help= parameter, load help patch (read-only mode)
    if (help) {
      showStartupModal = false;
      helpModeObject.set(help);
      await loadPatchFromUrlParam(`/help-patches/${help}.json`);
      return;
    }

    // For ?src= parameter, load directly (external URL - no confirmation for now)
    if (src) {
      showStartupModal = false;
      await loadPatchFromUrlParam(src);
      deleteSearchParam('src');
      return;
    }

    // Always load autosave first (so user has their content if they cancel shared patch load)
    try {
      const save = localStorage.getItem('patchies-patch-autosave');

      if (save) {
        const parsed: PatchSaveFormat = JSON.parse(save);
        if (parsed) await restorePatchFromSave(parsed);
      }
    } catch {}

    // For ?id= parameter, fetch shared patch and show confirmation dialog
    if (id) {
      showStartupModal = false;
      isLoadingFromUrl = true;

      try {
        const save = await getSharedPatchData(id);

        if (save) {
          // Store pending patch and show confirmation dialog
          pendingSharedPatch = save;
          showLoadSharedPatchDialog = true;
        } else {
          deleteSearchParam('id');
        }
      } catch (err) {
        urlLoadError = err instanceof Error ? err.message : 'Unknown error occurred';
        deleteSearchParam('id');
      } finally {
        isLoadingFromUrl = false;
      }
    }
  }

  // Drag-drop manager (initialized lazily after screenToFlowPosition is available)
  let dragDropManager: CanvasDragDropManager | null = null;

  function getDragDropManager(): CanvasDragDropManager {
    if (!dragDropManager) {
      dragDropManager = new CanvasDragDropManager({
        screenToFlowPosition,
        createNode,
        createNodeFromName
      });
    }

    return dragDropManager;
  }

  function onDrop(event: DragEvent) {
    getDragDropManager().onDrop(event);
  }

  function onDragOver(event: DragEvent) {
    getDragDropManager().onDragOver(event);
  }

  // Get the center of the viewport in flow coordinates
  function getViewportCenter(): { x: number; y: number } {
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    return screenToFlowPosition({ x: viewportCenterX, y: viewportCenterY });
  }

  // Handle insert VFS file event from mobile toolbar
  async function handleInsertVfsFile(event: { type: 'insertVfsFileToCanvas'; vfsPath: string }) {
    const position = getViewportCenter();
    await getDragDropManager().insertVfsFile(event.vfsPath, position);
  }

  // Handle insert preset event from mobile toolbar
  function handleInsertPreset(event: {
    type: 'insertPresetToCanvas';
    path: string[];
    preset: { type: string; name: string; data: unknown };
  }) {
    const position = getViewportCenter();
    getDragDropManager().insertPreset(event.preset, position);
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
   * Replace a node with a new type while preserving position and updating edges.
   * Used for converting between compatible node types (e.g., soundfile~ to sampler~).
   */
  function replaceNode(event: NodeReplaceEvent) {
    const { nodeId, newType, newData, handleMapping } = event;

    // Find the old node
    const oldNode = nodes.find((n) => n.id === nodeId);
    if (!oldNode) return;

    // Create new node ID
    const newId = `${newType}-${nodeIdCounter++}`;

    // Create the replacement node at the same position
    const newNode: Node = {
      id: newId,
      type: newType,
      position: oldNode.position,
      data: newData
    };

    // Update edges to point to the new node, mapping handle IDs if provided
    edges = edges.map((edge) => {
      if (edge.source === nodeId) {
        const newSourceHandle = handleMapping?.[edge.sourceHandle ?? ''] ?? edge.sourceHandle;

        return { ...edge, source: newId, sourceHandle: newSourceHandle };
      }

      if (edge.target === nodeId) {
        const newTargetHandle = handleMapping?.[edge.targetHandle ?? ''] ?? edge.targetHandle;

        return { ...edge, target: newId, targetHandle: newTargetHandle };
      }

      return edge;
    });

    // Replace the old node with the new one
    nodes = nodes.map((n) => (n.id === nodeId ? newNode : n));
  }

  /**
   * Update vfsPath in all nodes when a VFS path is renamed.
   */
  function handleVfsPathRenamed(event: VfsPathRenamedEvent) {
    const { oldPath, newPath } = event;

    nodes = nodes.map((node) => {
      // Check if this node has a vfsPath that matches the old path
      if (node.data?.vfsPath === oldPath) {
        return { ...node, data: { ...node.data, vfsPath: newPath } };
      }

      return node;
    });
  }

  /**
   * Create a node from an object name (handles both visual nodes and textual objects).
   * Textual objects (like out~, expr, adsr) are created as 'object' nodes.
   * Visual nodes (like p5, hydra, glsl) are created with their actual type.
   */
  function createNodeFromName(name: string, position: { x: number; y: number }) {
    // Check if it's a visual node type
    if (nodeTypes[name as keyof typeof nodeTypes]) {
      createNode(name, position);
      return;
    }

    // Check if it's a preset
    const preset = PRESETS[name];
    if (preset) {
      createNode(preset.type, position, preset.data as Record<string, unknown>);
      return;
    }

    // Check if it's a textual object (audio or text object)
    const audioRegistry = AudioRegistry.getInstance();
    const objectRegistry = ObjectRegistry.getInstance();

    if (audioRegistry.isDefined(name) || objectRegistry.isDefined(name)) {
      // Create an 'object' node with the textual object name and default params
      const defaultParams = parseObjectParamFromString(name, []);
      createNode('object', position, {
        expr: name,
        name: name,
        params: defaultParams
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

  async function restorePatchFromSave(save: PatchSaveFormat) {
    // Apply migrations to upgrade old patch formats
    const migrated = migratePatch(save) as PatchSaveFormat;

    cleanupPatch(nodes);

    previousNodes = new Set();

    nodes = [];
    edges = [];

    // Hydrate VFS from saved files
    const vfs = VirtualFilesystem.getInstance();
    vfs.clear();

    if (migrated.files) {
      await vfs.hydrate(migrated.files);

      // Check for pending permissions and log them
      const pending = vfs.getPendingPermissions();

      if (pending.length > 0) {
        console.log('VFS: Some local files need permission:', pending);
        // Permission will be requested by individual nodes when they try to load
      }
    }

    nodes = migrated.nodes;
    edges = migrated.edges;

    // Update node counter based on loaded nodes
    if (migrated.nodes.length > 0) {
      nodeIdCounter = getNodeIdCounterFromSave(migrated.nodes);
    }

    // Immediately save migrated patch to autosave so reloads don't break
    performAutosave();
  }

  // HACK: loading normally is causing artifacts when switching between patches
  //       so we go with this super hacky solution
  async function loadPatchById(patchId: string) {
    isLoadingFromUrl = true;
    urlLoadError = null;
    window.location.href = `/?id=${patchId}`;
  }

  // Load patch from URL parameter
  async function loadPatchFromUrlParam(url: string) {
    isLoadingFromUrl = true;
    urlLoadError = null;

    try {
      const result = await loadPatchFromUrl(url);

      if (result.success) {
        const { data } = result;
        await restorePatchFromSave(data);
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
      x: $isMobile ? window.innerWidth / 2 : window.innerWidth / 2 - 200,
      y: $isMobile ? window.innerHeight / 3 : 50
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
    showNewPatchDialog = true;
  }

  function confirmNewPatch() {
    cleanupPatch(nodes);
    previousNodes = new Set();

    nodes = [];
    edges = [];

    const vfs = VirtualFilesystem.getInstance();
    vfs.clear();
    vfs.clearPersistedData();

    localStorage.removeItem('patchies-patch-autosave');
    isBackgroundOutputCanvasEnabled.set(false);
    currentPatchName.set(null); // Clear current patch name for new patch
    deleteSearchParam('id'); // Clear shared patch URL since we're starting fresh
    showNewPatchDialog = false;
  }

  async function confirmLoadSharedPatch() {
    if (!pendingSharedPatch) return;

    // Keep the ?id= param in URL so users can easily copy/share the link

    // Load the shared patch
    await restorePatchFromSave(pendingSharedPatch);

    // Clear current patch name to prevent accidentally overwriting user's saved patches
    currentPatchName.set(null);

    pendingSharedPatch = null;

    // Re-focus the view on the new content
    await tick();
    fitView();
  }

  function cancelLoadSharedPatch() {
    // Keep the ?id= param in URL so users can easily copy/share the link
    // Their autosave is already loaded, so they keep their content
    pendingSharedPatch = null;
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
    // Check if Gemini API key is set
    if (!checkAndHandleGeminiApiKey()) {
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

<div class="flow-container flex h-screen w-full">
  <!-- Sidebar (Files / Presets) -->
  <SidebarPanel
    bind:open={$isSidebarOpen}
    bind:view={$sidebarView}
    onSavePatch={() => (showSavePatchModal = true)}
  />

  <!-- Main content area -->
  <div class="relative flex flex-1 flex-col">
    <!-- URL Loading Indicator -->
    {#if isLoadingFromUrl && !($isMobile && $isSidebarOpen)}
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
    {#if urlLoadError && !($isMobile && $isSidebarOpen)}
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

    <!-- Help Mode / Read-Only Mode Banner -->
    {#if ($helpModeObject || isReadOnlyMode) && !($isMobile && $isSidebarOpen)}
      <div class="absolute top-4 left-1/2 z-50 -translate-x-1/2 transform">
        <div
          class="flex items-center gap-3 rounded-lg border border-blue-600 bg-blue-900/90 px-4 py-2 text-sm text-blue-100"
        >
          <span>
            {#if $helpModeObject}
              Help for <strong>{$helpModeObject}</strong>. Changes won't be saved.
            {:else}
              Read-only mode. Changes won't be saved.
            {/if}
          </span>

          <button
            class="cursor-pointer rounded bg-blue-700 px-2 py-0.5 text-xs hover:bg-blue-600"
            onclick={() => {
              helpModeObject.set(null);
              window.history.pushState({}, '', window.location.pathname);
              window.location.reload();
            }}
          >
            {$helpModeObject ? 'Exit Help' : 'Exit'}
          </button>
        </div>
      </div>
    {/if}

    <!-- Audio Resume Hint -->
    {#if showAudioHint && !isLoadingFromUrl && $hasSomeAudioNode && !showStartupModal && !($isMobile && $isSidebarOpen)}
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
    {#if $isConnectionMode && !($isMobile && $isSidebarOpen)}
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
        clickConnect={$isConnectionMode}
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

        <Controls class={$isBottomBarVisible && !$isMobile ? '' : '!hidden'} />
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
          onShowGeminiKeyModal={() => {
            showMissingApiKeyDialog = true;
          }}
          onNewPatch={newPatch}
          onToggleSidebar={() => ($isSidebarOpen = !$isSidebarOpen)}
          onSaveAsPreset={(node) => {
            nodeToSaveAsPreset = node;
            showSavePresetDialog = true;
          }}
          onShowHelp={() => (showStartupModal = true)}
          onBrowseObjects={() => ($isObjectBrowserOpen = true)}
          onSavePatch={() => (showSavePatchModal = true)}
          onLoadPatch={() => {
            $isSidebarOpen = true;
            $sidebarView = 'saves';
          }}
          onGeneratePrompt={() => (showPatchToPromptDialog = true)}
        />
      {/if}
    </div>

    <!-- Bottom toolbar buttons -->
    {#if $isBottomBarVisible}
      <BottomToolbar
        {nodes}
        {edges}
        {selectedNodeIds}
        {selectedEdgeIds}
        {copiedNodeData}
        {hasGeminiApiKey}
        isLeftSidebarOpen={$isSidebarOpen}
        bind:showStartupModal
        {startupInitialTab}
        onDelete={deleteSelectedElements}
        onInsertObject={insertObjectWithButton}
        onBrowseObjects={() => ($isObjectBrowserOpen = true)}
        onCopy={copySelectedNodes}
        onPaste={() => pasteNode('button')}
        onCancelConnectionMode={cancelConnectionMode}
        onEnableConnectionMode={() => isConnectionMode.set(true)}
        {onAiInsertOrEdit}
        onCommandPalette={triggerCommandPalette}
        onNewPatch={newPatch}
        onLoadPatch={loadPatchById}
        onToggleLeftSidebar={() => {
          $isSidebarOpen = !$isSidebarOpen;
        }}
        onSaveSelectedAsPreset={() => {
          if (selectedNodeIds.length === 1) {
            const node = nodes.find((n) => n.id === selectedNodeIds[0]);

            if (node) {
              nodeToSaveAsPreset = node;
              showSavePresetDialog = true;
            }
          }
        }}
        onQuickSave={quickSave}
        onSaveAs={() => (showSavePatchModal = true)}
        onOpenSaves={() => {
          $isSidebarOpen = true;
          $sidebarView = 'saves';
        }}
      />
    {/if}

    <!-- Object Browser Modal -->
    <ObjectBrowserModal
      bind:open={$isObjectBrowserOpen}
      onSelectObject={handleObjectBrowserSelect}
    />

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

    <!-- Gemini API Key Missing Dialog -->
    <GeminiApiKeyDialog
      bind:open={showMissingApiKeyDialog}
      onSaveAndContinue={onGeminiApiKeySaved}
    />

    <!-- New Patch Confirmation Dialog -->
    <NewPatchDialog bind:open={showNewPatchDialog} onConfirm={confirmNewPatch} />

    <!-- Save as Preset Dialog -->
    <SavePresetDialog bind:open={showSavePresetDialog} node={nodeToSaveAsPreset} />

    <!-- Save Patch Modal -->
    <SavePatchModal bind:open={showSavePatchModal} {nodes} {edges} />

    <!-- Load Shared Patch Confirmation Dialog -->
    <LoadSharedPatchDialog
      bind:open={showLoadSharedPatchDialog}
      patchName={pendingSharedPatch?.name ?? null}
      isReadOnly={isReadOnlyMode}
      onConfirm={confirmLoadSharedPatch}
      onCancel={cancelLoadSharedPatch}
    />

    <!-- Patch-to-Prompt Generator Dialog -->
    <PatchToPromptDialog
      bind:open={showPatchToPromptDialog}
      {nodes}
      {edges}
      patchName={$currentPatchName ?? undefined}
    />
  </div>
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
