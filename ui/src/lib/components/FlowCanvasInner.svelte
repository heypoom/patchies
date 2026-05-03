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
  import SettingsModal from './settings-modal/SettingsModal.svelte';
  import BottomToolbar from './BottomToolbar.svelte';
  import AiObjectPrompt from './AiObjectPrompt.svelte';
  import AiActivityTray from './AiActivityTray.svelte';
  import { MessageSystem } from '$lib/messages/MessageSystem';
  import BackgroundOutputCanvas from './BackgroundOutputCanvas.svelte';
  import {
    isAiFeaturesVisible,
    isBottomBarVisible,
    isConnecting,
    connectingFromHandleId,
    isConnectionMode,
    isObjectBrowserOpen,
    isSettingsOpen,
    isMobile,
    isSidebarOpen,
    sidebarWidth,
    sidebarView,
    patchObjectTypes,
    currentPatchName,
    helpModeObject,
    selectedNodeInfo,
    audioSourceConnections,
    isCablesVisible,
    connectingFromAcceptsFloat,
    connectingFromIsAudioParam,
    requestFocusNodeId,
    requestFitView
  } from '../../stores/ui.store';
  import { nodeTypes } from '$lib/nodes/node-types';
  import { edgeTypes } from '$lib/components/edges/edge-types';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import { ProfilerCoordinator } from '$lib/profiler/ProfilerCoordinator';
  import { AudioAnalysisSystem } from '$lib/audio/AudioAnalysisSystem';
  import type { PatchSaveFormat } from '$lib/save-load/serialize-patch';
  import { hasSomeAudioNode, snapGridSize } from '../../stores/canvas.store';
  import { getObjectNameFromExpr } from '$lib/objects/object-definitions';
  import { deleteSearchParam } from '$lib/utils/search-params';
  import BackgroundPattern from './BackgroundPattern.svelte';
  import { Toaster } from '$lib/components/ui/sonner';
  import {
    isAudioParamInlet,
    isAcceptsFloatInlet,
    isValidConnectionBetweenHandles
  } from '$lib/utils/connection-validation';
  import { ViewportCullingManager } from '$lib/canvas/ViewportCullingManager';
  import { CULLABLE_DOM_TYPES } from '$lib/rendering/types';
  import { useFocusNode, useNodeLabels } from '$lib/canvas/use-focus-node.svelte';
  import AIProviderSettingsDialog from './dialogs/AIProviderSettingsDialog.svelte';
  import { hasAIApiKey } from '../../stores/ai-settings.store';
  import { chatSessionsStore, setDraft } from '../../stores/chat-sessions.store';
  import NewPatchDialog from './dialogs/NewPatchDialog.svelte';
  import SavePatchModal from './dialogs/SavePatchModal.svelte';
  import ExportPatchModal from './dialogs/ExportPatchModal.svelte';
  import LoadSharedPatchDialog from './dialogs/LoadSharedPatchDialog.svelte';
  import PatchToPromptDialog from './dialogs/PatchToPromptDialog.svelte';
  import SavePresetDialog from './presets/SavePresetDialog.svelte';
  import SidebarPanel from './sidebar/SidebarPanel.svelte';
  import { CanvasDragDropManager } from '$lib/canvas/CanvasDragDropManager';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import type {
    NodeReplaceEvent,
    VfsPathRenamedEvent,
    CodeCommitEvent,
    NodeDataCommitEvent,
    ObjectDataCommitEvent
  } from '$lib/eventbus/events';
  import { WorkerNodeSystem } from '$lib/js-runner/WorkerNodeSystem';
  import { MediaPipeNodeSystem } from '$objects/mediapipe/MediaPipeNodeSystem';
  import { DirectChannelService } from '$lib/messages/DirectChannelService';
  import { WorkletDirectChannelService } from '$lib/audio/WorkletDirectChannelService';
  import { buildAudioSourceConnections } from '$lib/composables/checkHandleConnections';

  import { toast } from 'svelte-sonner';
  import { Transport } from '$lib/transport';
  import { transportStore } from '../../stores/transport.store';
  import { allPreviewsDisabled } from '../../stores/renderer.store';
  import { isFullscreenActive } from '$lib/canvas/SurfaceOverlay';
  import { PREVIEW_ZOOM_LOD_TIERS } from '$workers/rendering/constants';
  import { initializeVFS } from '$lib/vfs';
  import {
    HistoryManager,
    AddNodeCommand,
    DeleteNodesCommand,
    MoveNodesCommand,
    UpdateNodeDataCommand,
    UpdateObjectDataCommand,
    AddEdgeCommand,
    DeleteEdgesCommand,
    BatchCommand,
    type Command
  } from '$lib/history';
  import { CanvasContext } from '$lib/services/CanvasContext';
  import { ClipboardManager } from '$lib/services/ClipboardManager';
  import { PatchManager } from '$lib/services/PatchManager';
  import { NodeOperationsService } from '$lib/services/NodeOperationsService';
  import { KeyboardShortcutManager } from '$lib/services/KeyboardShortcutManager';
  import { AiOperationsService } from '$lib/services/AiOperationsService';
  import type { AiObjectNode, SimplifiedEdge } from '$lib/ai/types';
  import { SvelteSet } from 'svelte/reactivity';
  import type { AiPromptMode, AiModeContext } from '$lib/ai/modes/types';
  import type { ChatViewportSummary } from '$lib/ai/chat/resolver';
  import { buildChatViewportSummary } from '$lib/ai/chat/viewport-summary';

  const AUTOSAVE_INTERVAL = 2500;

  // Initial nodes and edges
  let nodes = $state.raw<Node[]>([]);
  let edges = $state.raw<Edge[]>([]);

  let messageSystem = MessageSystem.getInstance();
  let glSystem = GLSystem.getInstance();
  let audioService = AudioService.getInstance();
  let audioAnalysisSystem = AudioAnalysisSystem.getInstance();
  let eventBus = PatchiesEventBus.getInstance();
  let workerNodeSystem = WorkerNodeSystem.getInstance();
  let mediaPipeNodeSystem = MediaPipeNodeSystem.getInstance();
  let directChannelService = DirectChannelService.getInstance();
  let workletDirectChannelService = WorkletDirectChannelService.getInstance();
  let historyManager = HistoryManager.getInstance();

  // Canvas context for shared state and utilities
  const canvasContext = new CanvasContext(
    { get: () => nodes, set: (n) => (nodes = n) },
    { get: () => edges, set: (e) => (edges = e) },
    historyManager
  );

  // Alias for convenience (used by history commands)
  const canvasAccessors = canvasContext.canvasAccessors;

  // Clipboard manager for copy/paste operations
  const clipboardManager = new ClipboardManager(canvasContext);
  let hasCopiedData = $state(false);

  // Patch manager for save/load/restore operations
  const patchManager = new PatchManager(canvasContext);

  // Node operations service for creating/deleting/replacing nodes
  const nodeOps = new NodeOperationsService(canvasContext);

  // AI operations service for AI-related node insertion/editing
  const aiOps = new AiOperationsService(canvasContext, nodeOps);

  // Event handlers for nodeOps (stored as variables for proper cleanup)
  const handleNodeReplace = (e: NodeReplaceEvent) => nodeOps.replaceNode(e);
  const handleVfsPathRenamed = (e: VfsPathRenamedEvent) => nodeOps.handleVfsPathRenamed(e);

  // Event handler for code commit (undo tracking)
  const handleCodeCommit = (e: CodeCommitEvent) => {
    historyManager.record(
      new UpdateNodeDataCommand(e.nodeId, e.dataKey, e.oldValue, e.newValue, canvasAccessors)
    );
  };

  // Event handler for generic node data commit (undo tracking for non-code fields)
  const handleNodeDataCommit = (e: NodeDataCommitEvent) => {
    historyManager.record(
      new UpdateNodeDataCommand(e.nodeId, e.dataKey, e.oldValue, e.newValue, canvasAccessors)
    );

    // Viewport-pause edge cases: keep pausedByViewport consistent when the user
    // toggles pause on a DOM-backed node while it's offscreen.
    if (e.dataKey !== 'paused') return;

    const node = getNode(e.nodeId);
    if (!node?.type || !cullableDomTypeSet.has(node.type)) return;

    // Pause-while-offscreen: user takes ownership; drop our claim.
    if (e.newValue === true && pausedByViewport.has(e.nodeId)) {
      pausedByViewport.delete(e.nodeId);
      return;
    }

    // Unpause-while-offscreen: re-pause ourselves so it doesn't waste CPU.
    if (e.newValue === false && !prevVisibleDom.has(e.nodeId)) {
      eventBus.dispatch({ type: 'nodeSetPaused', nodeId: e.nodeId, paused: true });
      pausedByViewport.add(e.nodeId);
    }
  };

  // Keyboard shortcut manager (created lazily in onMount to access component functions)
  let keyboardManager: KeyboardShortcutManager | null = null;

  // Object palette state
  let lastMousePosition = $state.raw({ x: 100, y: 100 });

  // Command palette state
  let showCommandPalette = $state(false);
  let commandPalettePosition = $state.raw({ x: 0, y: 0 });
  let flowContainer: HTMLDivElement;

  // AI object prompt state — supports multiple concurrent instances
  interface AiPromptInstance {
    id: string;
    position: { x: number; y: number };
    mode: AiPromptMode;
    context: AiModeContext;
    open: boolean;
    minimized: boolean;
    isLoading: boolean;
    thinkingText: string;
    isGeneratingConfig: boolean;
    resolvedObjectType: string | null;
  }

  let aiPromptInstances = $state<AiPromptInstance[]>([]);

  // Pending config set by setAiEditingNodeId before triggerAiPrompt is called
  let pendingAiPromptMode = $state<AiPromptMode>('insert');
  let pendingAiPromptContext = $state<AiModeContext>({});

  // Reactive: true when the active AI provider has an API key configured
  let hasGeminiApiKey = $derived($hasAIApiKey);

  // Dialog state for missing API key
  let showMissingApiKeyDialog = $state(false);
  let pendingApiKeyCallback = $state<(() => void) | null>(null);

  // Dialog state for new patch confirmation
  let showNewPatchDialog = $state(false);

  // Dialog state for save as preset
  let showSavePresetDialog = $state(false);
  let nodeToSaveAsPreset = $state<Node | null>(null);

  // Dialog state for save patch modal
  let showSavePatchModal = $state(false);

  // Dialog state for export patch modal
  let showExportPatchModal = $state(false);

  // Dialog state for loading shared patch from URL
  let showLoadSharedPatchDialog = $state(false);
  let pendingSharedPatch = $state<PatchSaveFormat | null>(null);

  // Dialog state for patch-to-prompt generator
  let showPatchToPromptDialog = $state(false);

  // Get flow utilities for coordinate transformation
  const { screenToFlowPosition, fitView, getViewport, getNode } = useSvelteFlow();

  // Viewport culling for preview rendering optimization
  const viewport = useViewport();
  const viewportCullingManager = new ViewportCullingManager();

  viewportCullingManager.onVisibleFboNodesChange = (visibleNodes) => {
    glSystem.setVisibleNodes(visibleNodes);
  };

  // DOM-backed renderers: track which nodes we've auto-paused so we can resume
  // only those on re-entry (and leave user-paused nodes alone).
  const cullableDomTypeSet = new Set(CULLABLE_DOM_TYPES);
  let prevVisibleDom = new Set<string>();
  const pausedByViewport = new SvelteSet<string>();

  viewportCullingManager.onVisibleDomNodesChange = (visible, liveIds) => {
    // Visible → hidden: auto-pause only if the user hasn't already paused.
    for (const id of prevVisibleDom) {
      if (visible.has(id)) continue;

      const node = getNode(id);
      if (!node) continue;
      if ((node.data as { paused?: boolean } | undefined)?.paused) continue;

      eventBus.dispatch({ type: 'nodeSetPaused', nodeId: id, paused: true });
      pausedByViewport.add(id);
    }

    // Hidden → visible: only resume nodes we paused ourselves.
    for (const id of visible) {
      if (prevVisibleDom.has(id)) continue;
      if (!pausedByViewport.has(id)) continue;

      eventBus.dispatch({ type: 'nodeSetPaused', nodeId: id, paused: false });
      pausedByViewport.delete(id);
    }

    // Prune stale entries for deleted nodes.
    for (const id of pausedByViewport) {
      if (!liveIds.has(id)) pausedByViewport.delete(id);
    }

    prevVisibleDom = visible;
  };

  // Autosave functionality
  let autosaveInterval: ReturnType<typeof setInterval> | null = null;

  let selectedNodeIds = $state.raw<string[]>([]);
  let selectedEdgeIds = $state.raw<string[]>([]);

  // Track node positions at drag start for undo/redo
  let dragStartPositions: Map<string, { x: number; y: number }> | null = null;

  let isLoadingFromUrl = $state(false);
  let urlLoadError = $state<string | null>(null);
  let showAudioHint = $state(audioService.getAudioContext().state === 'suspended');
  let showStartupModal = $state(localStorage.getItem('patchies-show-startup-modal') !== 'false');
  let startupInitialTab = $state<'about' | 'demos' | 'sparks' | 'shortcuts' | 'thanks'>('about');
  let isReadOnlyMode = $state(false);
  let pendingReadOnlyMode = $state(false); // Stores intended readonly state for shared patches until confirmed

  // Derived: show read-only banner only when no other banners are shown
  const showReadOnlyBanner = $derived(
    ($helpModeObject || isReadOnlyMode) &&
      !$isConnectionMode &&
      !($isMobile && $isSidebarOpen) &&
      !urlLoadError
  );

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

      selectedNodeInfo.set({
        type: resolvedType,
        id: nodes[0].id,
        data: (nodes[0].data as Record<string, unknown>) ?? undefined
      });
    } else {
      selectedNodeInfo.set(null);
    }
  });

  useFocusNode(
    () => $requestFocusNodeId,
    () => nodes,
    (n) => (nodes = n),
    fitView,
    () => $requestFitView
  );

  useNodeLabels(() => nodes);

  function performAutosave() {
    patchManager.performAutosave(isReadOnlyMode);
  }

  // Immediately autosave when patch settings change to avoid the 2500ms race window
  let _patchSettingsInit = false;

  $effect(() => {
    // Read reactive values to register as dependencies
    void $isCablesVisible;
    void $transportStore.bpm;
    void $transportStore.timeSignature;

    if (!_patchSettingsInit) {
      _patchSettingsInit = true;
      return;
    }

    performAutosave();
  });

  // Update message system when nodes or edges change
  $effect(() => {
    // Handle node changes (deletions)
    const currentNodes = new Set(nodes.map((n) => n.id));
    const deletedNodes = patchManager.updatePreviousNodes(currentNodes);

    // Cleanup deleted nodes
    for (const nodeId of deletedNodes) {
      messageSystem.unregisterNode(nodeId);
      audioService.removeNodeById(nodeId);
      mediaPipeNodeSystem.unregister(nodeId);
      ProfilerCoordinator.getInstance().unregister(nodeId);
    }
  });

  $effect(() => {
    messageSystem.updateEdges(edges);
    glSystem.updateEdges(edges);
    audioService.updateEdges(edges);
    audioAnalysisSystem.updateEdges(edges);
    workerNodeSystem.updateVideoConnections(edges);
    mediaPipeNodeSystem.updateConnections(edges);
    directChannelService.updateEdges(edges);
    workletDirectChannelService.updateEdges(edges);
    audioSourceConnections.set(buildAudioSourceConnections(edges));
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
    const types = new SvelteSet<string>();

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
  // 4a: zoom-based preview LOD — half-res at moderate zoom, quarter-res when zoomed out
  let currentLodMultiplier = 1;

  $effect(() => {
    const currentViewport = viewport.current;

    // Only send zoom level to worker when the LOD tier changes
    const tier =
      PREVIEW_ZOOM_LOD_TIERS.find((t) => currentViewport.zoom >= t.minZoom) ??
      PREVIEW_ZOOM_LOD_TIERS.at(-1)!;

    if (tier.scaleMultiplier !== currentLodMultiplier) {
      currentLodMultiplier = tier.scaleMultiplier;
      glSystem.setPreviewScaleMultiplier(tier.scaleMultiplier);
    }

    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;

    viewportCullingManager.updateVisibleNodes(currentViewport, nodes, screenWidth, screenHeight);
  });

  // Keyboard shortcuts delegated to KeyboardShortcutManager (created in onMount)

  function triggerCommandPalette() {
    const dialogWidth = 320; // w-80
    const currentSidebarWidth = $isSidebarOpen && !$isMobile ? $sidebarWidth : 0;
    const availableWidth = window.innerWidth - currentSidebarWidth;
    const centerX = (availableWidth - dialogWidth) / 2;
    const centerY = window.innerHeight / 2 - 200;

    commandPalettePosition = { x: Math.max(0, centerX), y: Math.max(0, centerY) };
    showCommandPalette = true;
  }

  /**
   * Quick save: if patch has a name, save directly; otherwise show Save modal
   */
  function quickSave() {
    if (!patchManager.quickSave()) {
      // No current patch name, show the Save modal
      showSavePatchModal = true;
    }
  }

  /**
   * Unified handler for checking Gemini API key and showing appropriate UI
   * Returns true if key exists and is valid, false otherwise
   */
  function checkAndHandleGeminiApiKey(): boolean {
    if (!aiOps.hasApiKey()) {
      showMissingApiKeyDialog = true;
      return false;
    }
    return true;
  }

  function onGeminiApiKeySaved() {
    // If there's a pending callback (e.g., from PatchToPromptDialog), call it
    if (pendingApiKeyCallback) {
      const callback = pendingApiKeyCallback;
      pendingApiKeyCallback = null;
      callback();
      return;
    }

    // Default behavior: trigger AI prompt
    // If a single node is selected, edit it; otherwise create new
    if (selectedNodeIds.length === 1) {
      const node = nodes.find((n) => n.id === selectedNodeIds[0]);
      pendingAiPromptMode = node ? 'edit' : 'insert';
      pendingAiPromptContext = node ? { selectedNode: node } : {};
    } else {
      pendingAiPromptMode = 'insert';
      pendingAiPromptContext = {};
    }

    triggerAiPrompt();
  }

  function handlePatchToPromptRequestApiKey(onKeyReady: () => void) {
    pendingApiKeyCallback = onKeyReady;
    showMissingApiKeyDialog = true;
  }

  function triggerAiPrompt() {
    const dialogWidth = 384; // w-96
    const currentSidebarWidth = $isSidebarOpen && !$isMobile ? $sidebarWidth : 0;
    const availableWidth = window.innerWidth - currentSidebarWidth;
    const openCount = aiPromptInstances.filter((i) => i.open).length;
    const stagger = openCount * 24;
    const centerX = (availableWidth - dialogWidth) / 2 + stagger;
    const centerY = window.innerHeight / 2 - 150 + stagger;

    aiPromptInstances = [
      ...aiPromptInstances.filter((i) => i.open), // drop any previously closed instances
      {
        id: crypto.randomUUID(),
        position: { x: Math.max(0, centerX), y: Math.max(0, centerY) },
        mode: pendingAiPromptMode,
        context: pendingAiPromptContext,
        open: true,
        minimized: false,
        isLoading: false,
        thinkingText: '',
        isGeneratingConfig: false,
        resolvedObjectType: null
      }
    ];
  }

  function handleAiObjectInsert(
    type: string,
    data: Record<string, unknown>,
    position?: { x: number; y: number }
  ) {
    const insertPosition = position ?? screenToFlowPosition(lastMousePosition);
    aiOps.insertSingleObject(type, data, insertPosition);
  }

  async function handleAiMultipleObjectsInsert(
    objectNodes: AiObjectNode[],
    simplifiedEdges: SimplifiedEdge[]
  ) {
    const basePosition = screenToFlowPosition(lastMousePosition);
    const viewport = getViewport();

    await aiOps.insertMultipleObjects(
      { objectNodes, simplifiedEdges },
      basePosition,
      viewport,
      () => tick()
    );
  }

  function handleAiObjectEdit(nodeId: string, data: Record<string, unknown>) {
    aiOps.editNode(nodeId, data);
  }

  function handleAiObjectReplace(
    nodeId: string,
    newType: string,
    newData: Record<string, unknown>
  ) {
    aiOps.replaceNode(nodeId, newType, newData);
  }

  function handleAiConnectEdges(edges: import('@xyflow/svelte').Edge[]) {
    aiOps.connectEdges(edges);
  }

  function handleAiDisconnectEdges(edgeIds: string[]) {
    aiOps.disconnectEdges(edgeIds);
  }

  function handleAiDeleteObjects(nodeIds: string[]) {
    aiOps.deleteObjects(nodeIds);
  }

  function handleAiMoveObjects(
    positions: Array<{ nodeId: string; position: { x: number; y: number } }>
  ) {
    aiOps.moveObjects(positions);
  }

  function getNodeById(nodeId: string) {
    const node = getNode(nodeId);
    if (!node) return undefined;
    return { id: node.id, type: node.type, data: node.data as Record<string, unknown> };
  }

  function getGraphSummary() {
    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        name: (n.data as Record<string, unknown>)?.name as string | undefined,
        position: n.position
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle
      }))
    };
  }

  function getViewportSummary(): ChatViewportSummary {
    return buildChatViewportSummary({
      viewport: getViewport(),
      screenRect: flowContainer?.getBoundingClientRect(),
      fallbackScreen: { width: window.innerWidth, height: window.innerHeight },
      screenToFlowPosition
    });
  }

  const aiCallbacks = {
    onInsertObject: handleAiObjectInsert,
    onInsertMultipleObjects: handleAiMultipleObjectsInsert,
    onEditObject: handleAiObjectEdit,
    onReplaceObject: handleAiObjectReplace,
    onConnectEdges: handleAiConnectEdges,
    onDisconnectEdges: handleAiDisconnectEdges,
    onDeleteObjects: handleAiDeleteObjects,
    onMoveObjects: handleAiMoveObjects
  };

  onMount(() => {
    flowContainer?.focus();

    // Initialize VFS with providers
    initializeVFS();

    glSystem.start();
    audioService.start();

    // Restore persisted state from store before transport panel mounts
    const { volume, isMuted, bpm, timeSignature } = $transportStore;

    audioService.setOutVolume(isMuted ? 0 : volume);
    Transport.setBpm(bpm);
    Transport.setTimeSignature(timeSignature[0], timeSignature[1]);

    loadPatch();

    // Handle pending Sparks actions (scatter/chat) from the standalone /sparks page
    const pendingScatter = localStorage.getItem('patchies:sparks-pending-scatter');
    if (pendingScatter) {
      localStorage.removeItem('patchies:sparks-pending-scatter');
      try {
        const nodeNames = JSON.parse(pendingScatter) as string[];
        // Defer until canvas is laid out
        tick().then(() => eventBus.dispatch({ type: 'scatterNodes', nodeNames }));
      } catch {
        // ignore malformed data
      }
    }

    const pendingChat = localStorage.getItem('patchies:sparks-pending-chat');
    if (pendingChat) {
      localStorage.removeItem('patchies:sparks-pending-chat');
      const activeId = $chatSessionsStore.activeId;
      setDraft(activeId, pendingChat, true);
      $isSidebarOpen = true;
      $sidebarView = 'chat';
    }

    // Check if the user wants to see the startup modal on launch
    // Don't show if loading from URL params (src or id)
    const params = new URLSearchParams(window.location.search);
    const isLoadingFromUrlParam = params.has('src') || params.has('id');

    // Check for ?startup= param to force-open startup modal at a specific tab
    const startupParam = params.get('startup');
    if (startupParam) {
      const validTabs = ['about', 'demos', 'sparks', 'shortcuts', 'thanks'] as const;
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

    // Create keyboard shortcut manager with action handlers
    keyboardManager = new KeyboardShortcutManager({
      copy: copySelectedNodes,
      paste: () => pasteNode('keyboard'),
      undo: () => historyManager.undo(),
      redo: () => historyManager.redo(),
      toggleSidebar: () => {
        if (!$isFullscreenActive) $isSidebarOpen = !$isSidebarOpen;
      },
      openObjectBrowser: () => ($isObjectBrowserOpen = true),
      openSettings: () => ($isSettingsOpen = true),
      openCommandPalette: triggerCommandPalette,
      togglePlayPause: () => {
        if (Transport.isPlaying) {
          Transport.pause();
        } else {
          Transport.play();
        }
      },
      toggleTransportPanel: () => transportStore.togglePanel(),
      newPatch,
      quickSave,
      saveAs: () => (showSavePatchModal = true),
      triggerAiPrompt,
      checkGeminiApiKey: checkAndHandleGeminiApiKey,
      quickAddNode: () => {
        const position = screenToFlowPosition(lastMousePosition);

        nodeOps.createNode('object', position, undefined, { skipHistory: true });
      },
      toggleAllPreviews: () => {
        const willDisable = !$allPreviewsDisabled;
        $allPreviewsDisabled = willDisable;
        glSystem.setAllPreviewsDisabled(willDisable);

        toast.success(willDisable ? 'Previews disabled' : 'Previews enabled');
      },
      hasNodeSelected: () => selectedNodeIds.length > 0,
      hasTextSelection: () => !!window.getSelection()?.toString().trim(),
      isCommandPaletteOpen: () => showCommandPalette,
      isAiFeaturesVisible: () => $isAiFeaturesVisible,
      isPatchEmpty: () => nodes.length === 0 && edges.length === 0,
      setAiEditingNodeId: (nodeId) => {
        if (nodeId) {
          const node = nodes.find((n) => n.id === nodeId);
          pendingAiPromptMode = 'edit';
          pendingAiPromptContext = node ? { selectedNode: node } : {};
        } else {
          pendingAiPromptMode = 'insert';
          pendingAiPromptContext = {};
        }
      },
      getSelectedNodeId: () => (selectedNodeIds.length === 1 ? selectedNodeIds[0] : null),
      getSelectedNodeIds: () => selectedNodeIds,
      isAiPromptOpen: () => aiPromptInstances.some((i) => i.open)
    });

    keyboardManager.attach();

    eventBus.addEventListener('nodeReplace', handleNodeReplace);
    eventBus.addEventListener('vfsPathRenamed', handleVfsPathRenamed);
    eventBus.addEventListener('insertVfsFileToCanvas', handleInsertVfsFile);
    eventBus.addEventListener('insertPresetToCanvas', handleInsertPreset);
    eventBus.addEventListener('insertSampleToCanvas', handleInsertSample);
    eventBus.addEventListener('requestSaveSelectedAsPreset', handleRequestSaveSelectedAsPreset);
    eventBus.addEventListener('quickAddConfirmed', handleQuickAddConfirmed);
    eventBus.addEventListener('quickAddCancelled', handleQuickAddCancelled);
    eventBus.addEventListener('scatterNodes', handleScatterNodes);
    eventBus.addEventListener('objectDataCommit', handleObjectDataCommit);
    eventBus.addEventListener('codeCommit', handleCodeCommit);
    eventBus.addEventListener('nodeDataCommit', handleNodeDataCommit);

    autosaveInterval = setInterval(performAutosave, AUTOSAVE_INTERVAL);

    return () => {
      keyboardManager?.detach();

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

    eventBus.removeEventListener('nodeReplace', handleNodeReplace);
    eventBus.removeEventListener('vfsPathRenamed', handleVfsPathRenamed);
    eventBus.removeEventListener('insertVfsFileToCanvas', handleInsertVfsFile);
    eventBus.removeEventListener('insertPresetToCanvas', handleInsertPreset);
    eventBus.removeEventListener('insertSampleToCanvas', handleInsertSample);
    eventBus.removeEventListener('requestSaveSelectedAsPreset', handleRequestSaveSelectedAsPreset);
    eventBus.removeEventListener('quickAddConfirmed', handleQuickAddConfirmed);
    eventBus.removeEventListener('quickAddCancelled', handleQuickAddCancelled);
    eventBus.removeEventListener('scatterNodes', handleScatterNodes);
    eventBus.removeEventListener('objectDataCommit', handleObjectDataCommit);
    eventBus.removeEventListener('codeCommit', handleCodeCommit);
    eventBus.removeEventListener('nodeDataCommit', handleNodeDataCommit);

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
    if (typeof window === 'undefined') return;

    // Check for readonly parameter
    // For shared patches (?id=), default to read-only unless ?readonly=false is explicit
    const params = new URLSearchParams(window.location.search);
    const hasSharedPatchId = params.has('id');
    const readonlyParam = params.get('readonly');

    if (hasSharedPatchId) {
      // Shared patches: defer setting readonly until user confirms loading
      // (readonly mode will be set in confirmLoadSharedPatch)
      pendingReadOnlyMode = readonlyParam !== 'false';
    } else if (readonlyParam === 'true') {
      // Non-shared: only enable readonly if explicitly requested
      isReadOnlyMode = true;
    }

    // Use patchManager for initial loading logic
    isLoadingFromUrl = true;

    try {
      const result = await patchManager.loadInitialPatch();

      // Handle UI state based on result
      if (result.mode === 'help' || result.mode === 'src') {
        showStartupModal = false;
        if (result.error) {
          urlLoadError = result.error;
        }
      } else if (result.mode === 'shared') {
        showStartupModal = false;
        if (result.sharedPatch) {
          pendingSharedPatch = result.sharedPatch;
          showLoadSharedPatchDialog = true;
        } else if (result.error) {
          urlLoadError = result.error;
        }
      }
    } finally {
      isLoadingFromUrl = false;
    }
  }

  // Drag-drop manager (initialized lazily after screenToFlowPosition is available)
  let dragDropManager: CanvasDragDropManager | null = null;

  function getDragDropManager(): CanvasDragDropManager {
    if (!dragDropManager) {
      dragDropManager = new CanvasDragDropManager({
        screenToFlowPosition,
        createNode: (...args) => nodeOps.createNode(...args),
        createNodeFromName: (...args) => nodeOps.createNodeFromName(...args)
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

  // Handle scatter nodes event from Sparks
  function handleScatterNodes(event: { type: 'scatterNodes'; nodeNames: string[] }) {
    const center = getViewportCenter();
    const cols = Math.ceil(Math.sqrt(event.nodeNames.length));
    const spacing = 180;
    event.nodeNames.forEach((name, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const position = {
        x: center.x + (col - (cols - 1) / 2) * spacing,
        y: center.y + (row - Math.floor((event.nodeNames.length - 1) / cols) / 2) * spacing
      };
      nodeOps.createNodeFromName(name, position);
    });
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

  // Handle insert sample event from mobile toolbar
  function handleInsertSample(event: {
    type: 'insertSampleToCanvas';
    result: { kind?: 'sample' | 'synthdef' | 'sc-sample'; url: string; name: string };
  }) {
    const position = getViewportCenter();

    getDragDropManager().insertSample(event.result, position);
  }

  // Handle request to save selected node as preset (from sidebar, etc.)
  function handleRequestSaveSelectedAsPreset() {
    if (selectedNodeIds.length === 1) {
      const node = nodes.find((n) => n.id === selectedNodeIds[0]);
      if (node) {
        nodeToSaveAsPreset = node;
        showSavePresetDialog = true;
      }
    }
  }

  // Handle Quick Add confirmation - record the final node to history
  function handleQuickAddConfirmed(event: { type: 'quickAddConfirmed'; finalNodeId: string }) {
    const node = nodes.find((n) => n.id === event.finalNodeId);

    if (node) {
      // Record the final node state (after any transformation) to history
      historyManager.record(new AddNodeCommand({ ...node }, canvasAccessors));
    }
  }

  // Handle Quick Add cancellation - remove node directly without history
  function handleQuickAddCancelled(event: { type: 'quickAddCancelled'; nodeId: string }) {
    // Remove the node directly, bypassing SvelteFlow's onbeforedelete (which records to history)
    nodes = nodes.filter((n) => n.id !== event.nodeId);
  }

  // Handle ObjectNode data commit (undo tracking for expr/name/params changes)
  function handleObjectDataCommit(event: ObjectDataCommitEvent) {
    historyManager.record(
      new UpdateObjectDataCommand(event.nodeId, event.oldData, event.newData, canvasAccessors)
    );
  }

  // Note: Don't destructure nodeOps methods - they need `this` binding

  function handleCommandPaletteCancel() {
    showCommandPalette = false;
  }

  function handleConnectStart(params: { nodeId?: string | null; handleId?: string | null }) {
    isConnecting.set(true);

    const qualifiedHandleId =
      params.nodeId && params.handleId
        ? `${params.nodeId}/${params.handleId}`
        : params.handleId || null;

    connectingFromHandleId.set(qualifiedHandleId);

    const sourceNode = params.nodeId ? getNode(params.nodeId) : undefined;

    const sourceObjectName =
      sourceNode?.type === 'object' ? (sourceNode.data?.name as string) : undefined;

    connectingFromAcceptsFloat.set(isAcceptsFloatInlet(sourceObjectName, params.handleId));
    connectingFromIsAudioParam.set(isAudioParamInlet(sourceObjectName, params.handleId));
  }

  function handleConnectEnd() {
    isConnecting.set(false);
    connectingFromHandleId.set(null);
    connectingFromAcceptsFloat.set(false);
    connectingFromIsAudioParam.set(false);
  }

  function cancelConnectionMode() {
    isConnectionMode.set(false);
    handleConnectEnd();
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
    nodeOps.createNodeFromName(name, position);
  }

  const isValidConnection: IsValidConnection = (connection) => {
    const targetNode = getNode(connection.target);

    const objectName =
      targetNode?.type === 'object' ? (targetNode.data?.name as string) : undefined;

    return isValidConnectionBetweenHandles(connection.sourceHandle, connection.targetHandle, {
      isTargetAudioParam: isAudioParamInlet(objectName, connection.targetHandle),
      isTargetAcceptsFloat: isAcceptsFloatInlet(objectName, connection.targetHandle)
    });
  };

  // Copy/paste delegated to ClipboardManager
  function copySelectedNodes() {
    const result = clipboardManager.copy(selectedNodeIds);

    if (result) {
      hasCopiedData = true;
    }
  }

  function pasteNode(source: 'keyboard' | 'button') {
    clipboardManager.paste(screenToFlowPosition, source, lastMousePosition);
  }

  // Patch lifecycle delegated to PatchManager
  function loadDemoPatchById(patchId: string) {
    isLoadingFromUrl = true;
    urlLoadError = null;
    patchManager.loadDemoPatchById(patchId);
  }

  function insertObjectWithButton() {
    const position = screenToFlowPosition({
      x: $isMobile ? window.innerWidth / 2 : window.innerWidth / 2 - 200,
      y: $isMobile ? window.innerHeight / 3 : 50
    });

    setTimeout(() => {
      nodeOps.createNode('object', position);
    }, 50);
  }

  function newPatch() {
    showNewPatchDialog = true;
  }

  function confirmNewPatch() {
    patchManager.createNewPatch();
    showNewPatchDialog = false;
  }

  async function confirmLoadSharedPatch() {
    if (!pendingSharedPatch) return;

    await patchManager.loadSharedPatch(pendingSharedPatch);
    pendingSharedPatch = null;

    // Apply the readonly mode now that user has confirmed loading
    isReadOnlyMode = pendingReadOnlyMode;
    pendingReadOnlyMode = false;

    // Re-focus the view on the new content
    await tick();
    fitView();
  }

  function cancelLoadSharedPatch() {
    pendingSharedPatch = null;
    pendingReadOnlyMode = false;

    // Clear URL params since user cancelled loading
    deleteSearchParam('id');
    deleteSearchParam('readonly');

    // Exit shared patch session so autosave resumes and user's patch loads
    patchManager.exitSharedSession();
    patchManager.loadAutosave();
  }

  function resumeAudio() {
    // Don't auto-resume if the user intentionally suspended DSP (mute/volume=0)
    if (audioService.dspSuspendedByUser) return;

    const audioContext = audioService.getAudioContext();

    // Give transport the AudioContext for jank-resistant timing
    Transport.setAudioContext(audioContext);

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

    // Toggle: if any idle (non-loading) prompts are open, close them
    const idleOpenInstances = aiPromptInstances.filter((i) => i.open && !i.isLoading);
    if (idleOpenInstances.length > 0) {
      for (const instance of idleOpenInstances) {
        instance.open = false;
      }

      return;
    }

    // If a single node is selected, edit it,
    // otherwise create new ones
    if (selectedNodeIds.length === 1) {
      const node = nodes.find((n) => n.id === selectedNodeIds[0]);
      pendingAiPromptMode = node ? 'edit' : 'insert';
      pendingAiPromptContext = node ? { selectedNode: node } : {};
    } else {
      pendingAiPromptMode = 'insert';
      pendingAiPromptContext = {};
    }

    triggerAiPrompt();
  }
</script>

<div class="flow-container relative flex h-dvh w-full">
  <!-- Background output canvas lives outside the flow editor so it stays visible during surface fullscreen -->
  <div class="pointer-events-none absolute inset-0 z-0">
    <BackgroundOutputCanvas />
  </div>
  <!-- Sidebar (Files / Presets) -->
  <SidebarPanel
    bind:open={$isSidebarOpen}
    bind:view={$sidebarView}
    onSavePatch={() => (showSavePatchModal = true)}
    onRequestApiKey={handlePatchToPromptRequestApiKey}
    onOpenPatchToApp={() => (showPatchToPromptDialog = true)}
    {aiCallbacks}
    {getNodeById}
    {getGraphSummary}
    {getViewportSummary}
    {hasGeminiApiKey}
  />

  <!-- Main content area -->
  <div class="relative flex flex-1 flex-col" class:hidden={$isFullscreenActive}>
    <!-- URL Loading Indicator -->
    {#if isLoadingFromUrl && !($isMobile && $isSidebarOpen)}
      <div class="top-safe-4 absolute left-1/2 z-50 -translate-x-1/2 transform">
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
      <div class="top-safe-4 absolute left-1/2 z-50 -translate-x-1/2 transform">
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
    {#if showReadOnlyBanner}
      <div
        class="top-safe-4 absolute right-4 left-4 z-50 sm:right-auto sm:left-1/2 sm:-translate-x-1/2"
      >
        <div
          class="flex items-center justify-between gap-3 rounded-lg border border-blue-600 bg-blue-900/90 px-4 py-1.5 text-sm text-blue-100 sm:min-w-[360px]"
        >
          <span>
            {#if $helpModeObject}
              Help for <strong>{$helpModeObject}</strong>. Changes won't be saved.
            {:else}
              Shared patches are read-only.
            {/if}
          </span>

          <div class="flex shrink-0 gap-2">
            {#if isReadOnlyMode && !$helpModeObject}
              <button
                class="cursor-pointer rounded bg-blue-700 px-2 py-0.5 text-xs hover:bg-blue-600"
                onclick={() => (showSavePatchModal = true)}
              >
                Save
              </button>
            {/if}

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
      </div>
    {/if}

    <!-- Audio Resume Hint -->
    {#if showAudioHint && !isLoadingFromUrl && $hasSomeAudioNode && !showStartupModal && !($isMobile && $isSidebarOpen) && $transportStore.dspEnabled}
      <div
        class="absolute right-4 left-4 z-50 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 {$helpModeObject ||
        isReadOnlyMode
          ? 'top-safe-16'
          : 'top-safe-4'}"
      >
        <div
          class="flex items-center gap-2 rounded-lg border border-blue-600 bg-blue-900/80 px-4 py-1.5 text-sm text-blue-200 backdrop-blur-sm sm:min-w-[360px]"
        >
          <Volume2 class="h-4 w-4 shrink-0" />
          <span>Click anywhere to play sound</span>
        </div>
      </div>
    {/if}

    <!-- Connection Mode Indicator -->
    {#if $isConnectionMode && !($isMobile && $isSidebarOpen)}
      <div
        class="top-safe-4 absolute right-4 left-4 z-50 sm:right-auto sm:left-1/2 sm:-translate-x-1/2"
      >
        <div
          class={`flex items-center justify-between gap-3 rounded-lg border px-4 py-1.5 text-sm backdrop-blur-sm sm:min-w-[360px] ${
            $isConnecting
              ? 'border-green-600 bg-green-900/80 text-green-200'
              : 'border-blue-600 bg-blue-900/80 text-blue-200'
          }`}
        >
          <span class="flex items-center gap-2">
            <Cable class="h-4 w-4 shrink-0" />
            {#if $isConnecting}
              Tap or drag to another handle to connect
            {:else}
              Tap on a handle to start the connection
            {/if}
          </span>
          <button
            class={`shrink-0 cursor-pointer ${$isConnecting ? 'text-green-300 hover:text-green-100' : 'text-blue-300 hover:text-blue-100'}`}
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
        snapGrid={$snapGridSize > 0 ? [$snapGridSize, $snapGridSize] : undefined}
        proOptions={{ hideAttribution: true }}
        clickConnect={$isConnectionMode}
        {isValidConnection}
        onnodedragstart={(event) => {
          // Capture starting positions of all dragged nodes
          dragStartPositions = new Map(event.nodes.map((n) => [n.id, { ...n.position }]));
        }}
        onnodedragstop={(event) => {
          if (!dragStartPositions) return;

          // Only record if positions actually changed
          const hasChanged = event.nodes.some((n) => {
            const start = dragStartPositions?.get(n.id);
            return start && (start.x !== n.position.x || start.y !== n.position.y);
          });

          if (hasChanged) {
            const newPositions = new Map(event.nodes.map((n) => [n.id, { ...n.position }]));
            historyManager.record(
              new MoveNodesCommand(dragStartPositions, newPositions, canvasAccessors)
            );
          }

          dragStartPositions = null;
        }}
        onconnect={(connection) => {
          // XYFlow already added the edge, we just need to record it for undo
          const newEdge = edges.find(
            (e) =>
              e.source === connection.source &&
              e.target === connection.target &&
              e.sourceHandle === connection.sourceHandle &&
              e.targetHandle === connection.targetHandle
          );
          if (newEdge) {
            historyManager.record(new AddEdgeCommand(newEdge, canvasAccessors));
          }
        }}
        onconnectstart={(event, params) => handleConnectStart(params)}
        onconnectend={handleConnectEnd}
        onclickconnectstart={(event, params) => handleConnectStart(params)}
        onclickconnectend={(event, connectionState) => {
          handleConnectEnd();

          if (connectionState?.isValid) {
            toast.success('Objects connected by tap.');
          }
        }}
        onbeforedelete={async ({ nodes: nodesToDelete, edges: edgesToDelete }) => {
          // Record deletions to history before SvelteFlow performs them
          const commands: Command[] = [];

          if (nodesToDelete.length > 0) {
            commands.push(new DeleteNodesCommand(nodesToDelete, canvasAccessors));
          }

          if (edgesToDelete.length > 0) {
            // Only record edges not already handled by DeleteNodesCommand
            const nodeIds = new Set(nodesToDelete.map((n) => n.id));
            const standaloneEdges = edgesToDelete.filter(
              (e) => !nodeIds.has(e.source) && !nodeIds.has(e.target)
            );
            if (standaloneEdges.length > 0) {
              commands.push(new DeleteEdgesCommand(standaloneEdges, canvasAccessors));
            }
          }

          if (commands.length === 1) {
            historyManager.record(commands[0]);
          } else if (commands.length > 1) {
            historyManager.record(new BatchCommand(commands, 'Delete selection'));
          }

          return true; // Allow the deletion to proceed
        }}
      >
        <BackgroundPattern />

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
            canvasContext.setNodeIdCounterFromNodes(newNodes);
          }}
          setEdges={(newEdges) => {
            edges = newEdges;
          }}
          onShowAiPrompt={() => {
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
          onShowHelp={(tab) => {
            if (tab) startupInitialTab = tab;
            showStartupModal = true;
          }}
          onBrowseObjects={() => ($isObjectBrowserOpen = true)}
          onSavePatch={() => (showSavePatchModal = true)}
          onExportPatch={() => (showExportPatchModal = true)}
          onLoadPatch={() => {
            $isSidebarOpen = true;
            $sidebarView = 'saves';
          }}
          onGeneratePrompt={() => (showPatchToPromptDialog = true)}
          onUndo={() => {
            const desc = historyManager.undo();

            if (desc) toast.success(`Undo: ${desc}`);
          }}
          onRedo={() => {
            const desc = historyManager.redo();

            if (desc) toast.success(`Redo: ${desc}`);
          }}
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
        {hasCopiedData}
        {hasGeminiApiKey}
        isLeftSidebarOpen={$isSidebarOpen}
        bind:showStartupModal
        {startupInitialTab}
        onDelete={() => nodeOps.deleteSelectedElements(selectedNodeIds, selectedEdgeIds)}
        onInsertObject={insertObjectWithButton}
        onBrowseObjects={() => ($isObjectBrowserOpen = true)}
        onCopy={copySelectedNodes}
        onPaste={() => pasteNode('button')}
        onCancelConnectionMode={cancelConnectionMode}
        onEnableConnectionMode={() => isConnectionMode.set(true)}
        {onAiInsertOrEdit}
        onCommandPalette={triggerCommandPalette}
        onNewPatch={newPatch}
        onLoadPatch={loadDemoPatchById}
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

    <!-- Settings Modal -->
    <SettingsModal bind:open={$isSettingsOpen} />

    <!-- AI Object Prompt Dialogs — multiple concurrent instances supported -->
    {#each aiPromptInstances as instance (instance.id)}
      <AiObjectPrompt
        bind:open={instance.open}
        bind:isMinimized={instance.minimized}
        bind:isLoading={instance.isLoading}
        bind:thinkingText={instance.thinkingText}
        bind:isGeneratingConfig={instance.isGeneratingConfig}
        bind:resolvedObjectType={instance.resolvedObjectType}
        position={instance.position}
        bind:mode={instance.mode}
        context={instance.context}
        onInsertObject={handleAiObjectInsert}
        onInsertMultipleObjects={handleAiMultipleObjectsInsert}
        onEditObject={handleAiObjectEdit}
        onReplaceObject={handleAiObjectReplace}
      />
    {/each}

    <!-- Activity tray: shows running AI prompts at top-right -->
    {#if !($isMobile && $isSidebarOpen)}
      <AiActivityTray
        instances={aiPromptInstances}
        onToggle={(id) => {
          const instance = aiPromptInstances.find((i) => i.id === id);

          if (instance) instance.minimized = !instance.minimized;
        }}
      />
    {/if}

    <!-- Toast Notifications -->
    {#if !$isSidebarOpen}
      <Toaster
        position="top-center"
        offset={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      />
    {/if}

    <!-- AI Provider Settings Dialog (shown when API key is missing) -->
    <AIProviderSettingsDialog
      bind:open={showMissingApiKeyDialog}
      onSaveAndContinue={onGeminiApiKeySaved}
    />

    <!-- New Patch Confirmation Dialog -->
    <NewPatchDialog bind:open={showNewPatchDialog} onConfirm={confirmNewPatch} />

    <!-- Save as Preset Dialog -->
    <SavePresetDialog bind:open={showSavePresetDialog} node={nodeToSaveAsPreset} />

    <!-- Save Patch Modal -->
    <SavePatchModal
      bind:open={showSavePatchModal}
      {nodes}
      {edges}
      onSave={() => {
        // User now owns this patch — exit shared/readonly modes, resume autosave
        patchManager.exitSharedSession();

        if (isReadOnlyMode) {
          isReadOnlyMode = false;
          deleteSearchParam('readonly');
        }
      }}
    />

    <!-- Export Patch Modal -->
    <ExportPatchModal bind:open={showExportPatchModal} {nodes} {edges} />

    <!-- Load Shared Patch Confirmation Dialog -->
    <LoadSharedPatchDialog
      bind:open={showLoadSharedPatchDialog}
      patchName={pendingSharedPatch?.name ?? null}
      isReadOnly={pendingReadOnlyMode}
      onConfirm={confirmLoadSharedPatch}
      onCancel={cancelLoadSharedPatch}
    />

    <!-- Patch-to-Prompt Generator Dialog -->
    <PatchToPromptDialog
      bind:open={showPatchToPromptDialog}
      {nodes}
      {edges}
      patchName={$currentPatchName ?? undefined}
      onRequestApiKey={handlePatchToPromptRequestApiKey}
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
