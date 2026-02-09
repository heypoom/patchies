<script lang="ts">
  import { onMount } from 'svelte';
  import { match } from 'ts-pattern';
  import {
    isAiFeaturesVisible,
    isBottomBarVisible,
    isFpsMonitorVisible,
    isConnectionMode,
    isConnecting,
    connectingFromHandleId
  } from '../../stores/ui.store';
  import { useWebCodecs, toggleWebCodecs, toggleVideoStats } from '../../stores/video.store';
  import type { Node, Edge } from '@xyflow/svelte';
  import { IpcSystem } from '$lib/canvas/IpcSystem';
  import { isBackgroundOutputCanvasEnabled } from '../../stores/canvas.store';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import { savePatchToLocalStorage } from '$lib/save-load/save-local-storage';
  import { serializePatch, type PatchSaveFormat } from '$lib/save-load/serialize-patch';
  import { createAndCopyShareLink } from '$lib/save-load/share';
  import { deleteSearchParam, getSearchParam, setSearchParam } from '$lib/utils/search-params';
  import { migratePatch } from '$lib/migration';
  import {
    downloadForOffline,
    type OfflineDownloadProgress
  } from '$lib/offline/download-for-offline';

  interface Props {
    position: { x: number; y: number };
    onCancel: () => void;
    nodes: Node[];
    edges: Edge[];
    setNodes: (nodes: Node[]) => void;
    setEdges: (edges: Edge[]) => void;
    onShowAiPrompt?: () => void;
    onShowGeminiKeyModal?: () => void;
    onNewPatch?: () => void;
    onToggleSidebar?: () => void;
    onSaveAsPreset?: (node: Node) => void;
    onShowHelp?: () => void;
    onBrowseObjects?: () => void;
    onSavePatch?: () => void;
    onLoadPatch?: () => void;
  }

  let {
    position,
    onCancel,
    nodes,
    edges,
    setNodes,
    setEdges,
    onShowAiPrompt,
    onShowGeminiKeyModal,
    onNewPatch,
    onToggleSidebar,
    onSaveAsPreset,
    onShowHelp,
    onBrowseObjects,
    onSavePatch,
    onLoadPatch
  }: Props = $props();

  // Get the first selected node (for save as preset)
  const selectedNode = $derived(nodes.find((n) => n.selected));

  // Component state
  let searchQuery = $state('');
  let selectedIndex = $state(0);
  let searchInput: HTMLInputElement | undefined = $state();
  let paletteContainer: HTMLDivElement | undefined = $state();
  let resultsContainer: HTMLDivElement | undefined = $state();
  let ipcSystem = IpcSystem.getInstance();

  type StageName =
    | 'commands'
    | 'delete-list'
    | 'rename-list'
    | 'rename-name'
    | 'set-room'
    | 'offline-download';

  // Multi-stage state
  let stage = $state<StageName>('commands');

  let patchName = $state('');
  let savedPatches = $state<string[]>([]);
  let selectedPatchToRename = $state('');
  let roomName = $state('');
  let offlineProgress = $state<OfflineDownloadProgress>({
    current: 0,
    total: 0,
    currentItem: '',
    status: 'idle'
  });

  // Base commands for stage 1
  const commands = [
    {
      id: 'share-patch',
      name: 'Share Patch Link',
      description: 'Get a shareable link for your patch.'
    },
    {
      id: 'new-patch',
      name: 'New Patch',
      description: 'Create a new patch. All unsaved changes will be lost.'
    },
    {
      id: 'enter-fullscreen',
      name: 'Enter Fullscreen',
      description: 'Enter fullscreen mode in the main window.'
    },
    {
      id: 'toggle-connect-mode',
      name: 'Toggle Easy Connect',
      description: 'Enter or exit easy connect mode for quickly connecting objects'
    },
    {
      id: 'ai-insert-object',
      name: 'Insert or Edit Object with AI',
      description: 'Use AI to create objects with natural language',
      requiresAi: true
    },
    { id: 'export-patch', name: 'Export Patch', description: 'Save patch as JSON file' },
    { id: 'import-patch', name: 'Import Patch', description: 'Load patch from JSON file' },
    { id: 'save-patch', name: 'Save Patch', description: 'Save patch to local storage' },
    { id: 'load-patch', name: 'Load Patch', description: 'Load patch from local storage' },
    { id: 'rename-patch', name: 'Rename Patch', description: 'Rename saved patch' },
    { id: 'delete-patch', name: 'Delete Patch', description: 'Delete patch from local storage' },
    {
      id: 'open-output-screen',
      name: 'Open Output Screen',
      description: 'Open a secondary output screen for live performances.'
    },
    {
      id: 'toggle-ai-features',
      name: 'Toggle AI Features',
      description: 'Show or hide AI-related objects and features'
    },
    {
      id: 'toggle-vim-mode',
      name: 'Toggle Vim Mode',
      description: 'Enable or disable Vim keybindings in code editors'
    },
    {
      id: 'toggle-fps-monitor',
      name: 'Toggle FPS Monitor',
      description: 'Show or hide the FPS monitor'
    },
    {
      id: 'toggle-video-stats',
      name: 'Toggle Video Stats Overlay',
      description: 'Show or hide video/webcam performance stats (FPS, drops, pipeline)'
    },
    {
      id: 'toggle-mediabunny',
      name: 'Toggle MediaBunny',
      description: `${$useWebCodecs ? 'Disable' : 'Enable'} MediaBunny for video decoding (currently ${$useWebCodecs ? 'ON' : 'OFF'})`
    },
    {
      id: 'set-gemini-api-key',
      name: 'Set Gemini AI API Key',
      description: 'Configure Google Gemini API key for AI features',
      requiresAi: true
    },
    {
      id: 'toggle-bottom-bar',
      name: 'Toggle Bottom Bar',
      description: 'Show or hide the bottom toolbar'
    },
    {
      id: 'toggle-sidebar',
      name: 'Toggle Sidebar',
      description: 'Files and presets in the sidebar'
    },
    {
      id: 'browse-objects',
      name: 'Browse Objects',
      description: 'Open the object browser to add nodes (Ctrl+O)'
    },
    {
      id: 'save-as-preset',
      name: 'Save Selected Object as Preset',
      description: 'Save the selected node as a reusable preset',
      requiresSelection: true
    },
    {
      id: 'help',
      name: 'Getting Started',
      description: 'Show the getting started guide and help documentation'
    },
    {
      id: 'set-room',
      name: 'Set room for netsend/netrecv',
      description: 'Set a custom room ID for P2P communication between patches'
    },
    {
      id: 'prepare-offline',
      name: 'Prepare for Offline',
      description: 'Download heavy assets (Ruby WASM, SuperSonic, Strudel samples) for offline use'
    },
    {
      id: 'clear-cache',
      name: 'Clear Cache',
      description: 'Fix stale app issues by clearing all caches and unregistering service workers'
    }
  ];

  // Filtered items based on current stage
  const filteredCommands = $derived.by(() => {
    return commands
      .filter((cmd) => !cmd.requiresAi || $isAiFeaturesVisible)
      .filter((cmd) => !cmd.requiresSelection || selectedNode)
      .filter((cmd) => cmd.name.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  const filteredPatches = $derived.by(() => {
    return savedPatches.filter((patch) => patch.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  // Auto-focus search input
  onMount(() => {
    searchInput?.focus();
    loadSavedPatches();
  });

  // Focus input when stage changes
  $effect(() => {
    if (
      stage === 'delete-list' ||
      stage === 'rename-list' ||
      stage === 'rename-name' ||
      stage === 'commands' ||
      stage === 'set-room'
    ) {
      setTimeout(() => {
        searchInput?.focus();
      }, 0);
    }
  });

  function loadSavedPatches() {
    const saved = localStorage.getItem('patchies-saved-patches');
    if (saved) {
      try {
        savedPatches = JSON.parse(saved);
      } catch (e) {
        savedPatches = [];
      }
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    match(event.key)
      .with('Escape', () => {
        event.preventDefault();
        if (stage !== 'commands') {
          // Go back to commands stage
          stage = 'commands';
          searchQuery = '';
          selectedIndex = 0;
          searchInput?.focus();
        } else {
          onCancel();
        }
      })
      .with('ArrowDown', () => {
        event.preventDefault();
        const maxIndex =
          stage === 'commands'
            ? filteredCommands.length - 1
            : stage === 'delete-list' || stage === 'rename-list'
              ? filteredPatches.length - 1
              : 0;
        selectedIndex = Math.min(selectedIndex + 1, maxIndex);
        scrollToSelectedItem();
      })
      .with('ArrowUp', () => {
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        scrollToSelectedItem();
      })
      .with('Enter', () => {
        event.preventDefault();
        handleSelect();
      });
  }

  function handleSelect() {
    if (stage === 'commands' && filteredCommands.length > 0) {
      const selectedCommand = filteredCommands[selectedIndex];
      executeCommand(selectedCommand.id);
    } else if (stage === 'delete-list' && filteredPatches.length > 0) {
      const selectedPatch = filteredPatches[selectedIndex];
      deleteFromLocalStorage(selectedPatch);
    } else if (stage === 'rename-list' && filteredPatches.length > 0) {
      const selectedPatch = filteredPatches[selectedIndex];
      selectedPatchToRename = selectedPatch;
      stage = 'rename-name';
      searchQuery = '';
      patchName = selectedPatch; // Pre-fill with current name
      selectedIndex = 0;
    } else if (stage === 'rename-name' && patchName.trim()) {
      renamePatch();
    } else if (stage === 'set-room' && roomName.trim()) {
      setRoom();
    }
  }

  const nextStage = (stageName: StageName) => {
    stage = stageName;
    searchQuery = '';
    selectedIndex = 0;
  };

  function executeCommand(commandId: string) {
    match(commandId)
      .with('export-patch', () => saveToFile())
      .with('import-patch', () => loadFromFile())
      .with('save-patch', () => {
        onCancel();
        onSavePatch?.();
      })
      .with('load-patch', () => {
        onCancel();
        onLoadPatch?.();
      })
      .with('delete-patch', () => nextStage('delete-list'))
      .with('rename-patch', () => nextStage('rename-list'))
      .with('set-gemini-api-key', () => {
        onCancel();
        onShowGeminiKeyModal?.();
      })
      .with('toggle-bottom-bar', () => {
        $isBottomBarVisible = !$isBottomBarVisible;
        onCancel();
      })
      .with('toggle-fps-monitor', () => {
        $isFpsMonitorVisible = !$isFpsMonitorVisible;
        onCancel();
      })
      .with('toggle-video-stats', () => {
        toggleVideoStats();
        onCancel();
      })
      .with('toggle-mediabunny', () => {
        toggleWebCodecs();
        onCancel();
      })
      .with('toggle-ai-features', () => {
        $isAiFeaturesVisible = !$isAiFeaturesVisible;
        onCancel();
      })
      .with('open-output-screen', () => {
        isBackgroundOutputCanvasEnabled.set(false);
        ipcSystem.openOutputWindow();
        onCancel();
      })
      .with('enter-fullscreen', () => {
        document.querySelector('html')?.requestFullscreen();
        onCancel();
      })
      .with('share-patch', async () => {
        onCancel();
        await createAndCopyShareLink(nodes, edges);
      })
      .with('new-patch', () => {
        onCancel();
        onNewPatch?.();
      })
      .with('toggle-sidebar', () => {
        onCancel();
        onToggleSidebar?.();
      })
      .with('browse-objects', () => {
        onCancel();
        onBrowseObjects?.();
      })
      .with('toggle-vim-mode', () => {
        const current = localStorage.getItem('editor.vim') === 'true';
        localStorage.setItem('editor.vim', String(!current));

        onCancel();
        window.location.reload();
      })
      .with('toggle-connect-mode', () => {
        if ($isConnectionMode) {
          // Exit connection mode - clear all connection state
          isConnectionMode.set(false);
          isConnecting.set(false);
          connectingFromHandleId.set(null);
        } else {
          // Enter connection mode
          isConnectionMode.set(true);
        }
        onCancel();
      })
      .with('ai-insert-object', () => {
        onCancel();
        onShowAiPrompt?.();
      })
      .with('save-as-preset', () => {
        if (selectedNode) {
          onCancel();
          onSaveAsPreset?.(selectedNode);
        }
      })
      .with('help', () => {
        onCancel();
        onShowHelp?.();
      })
      .with('set-room', () => {
        roomName = getSearchParam('room') || '';
        nextStage('set-room');
      })
      .with('prepare-offline', () => {
        nextStage('offline-download');
        startOfflineDownload();
      })
      .with('clear-cache', async () => {
        onCancel();
        await clearCacheAndServiceWorker();
      })
      .otherwise(() => {
        console.warn(`Unknown command: ${commandId}`);
      });
  }

  function saveToFile() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const patchJson = serializePatch({ name: patchName, nodes, edges });

    const blob = new Blob([patchJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patch-${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onCancel();
  }

  function loadFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const patchData = JSON.parse(e.target?.result as string);
            loadPatchData(patchData);
            onCancel();
          } catch (error) {
            console.error('Error loading patch:', error);
          }
        };
        reader.readAsText(file);
      }
    };

    input.click();
  }

  function loadFromLocalStorage(patchName: string) {
    const patchData = localStorage.getItem(`patchies-patch-${patchName}`);
    if (patchData) {
      try {
        const data = JSON.parse(patchData);
        loadPatchData(data);
        onCancel();
      } catch (error) {
        console.error('Error loading patch from storage:', error);
      }
    }
  }

  function loadPatchData(patchSave: PatchSaveFormat) {
    try {
      if (!patchSave || !patchSave.nodes || !patchSave.edges) {
        throw new Error('Invalid patch data format');
      }

      // Apply migrations to upgrade old patch formats
      const migrated = migratePatch(patchSave) as PatchSaveFormat;

      setNodes(migrated.nodes);
      setEdges(migrated.edges);

      console.log(`[load] found ${migrated.nodes.length} nodes and ${migrated.edges.length} edges`);

      AudioService.getInstance().getAudioContext().resume();

      patchName = migrated.name || 'Untitled';
    } catch (error) {
      console.error('Error deserializing patch data:', error);
      throw error;
    }
  }

  function deleteFromLocalStorage(patchName: string) {
    localStorage.removeItem(`patchies-patch-${patchName}`);

    const saved = localStorage.getItem('patchies-saved-patches') || '[]';
    try {
      let savedPatchesList: string[] = JSON.parse(saved);
      savedPatchesList = savedPatchesList.filter((name) => name !== patchName);
      localStorage.setItem('patchies-saved-patches', JSON.stringify(savedPatchesList));

      savedPatches = savedPatchesList;

      if (selectedIndex >= savedPatchesList.length) {
        selectedIndex = Math.max(0, savedPatchesList.length - 1);
      }
    } catch (error) {
      console.error('Error deleting patch from storage:', error);
    }
  }

  function renamePatch() {
    if (!selectedPatchToRename || !patchName.trim() || patchName === selectedPatchToRename) {
      onCancel();
      return;
    }

    try {
      // Get the patch data from the old name
      const patchData = localStorage.getItem(`patchies-patch-${selectedPatchToRename}`);
      if (!patchData) {
        console.error('Patch data not found for rename');
        onCancel();
        return;
      }

      // Save with new name
      localStorage.setItem(`patchies-patch-${patchName}`, patchData);

      // Remove old patch data
      localStorage.removeItem(`patchies-patch-${selectedPatchToRename}`);

      // Update saved patches list
      const saved = localStorage.getItem('patchies-saved-patches') || '[]';
      let savedPatchesList: string[] = JSON.parse(saved);

      // Replace old name with new name
      const oldIndex = savedPatchesList.indexOf(selectedPatchToRename);
      if (oldIndex !== -1) {
        savedPatchesList[oldIndex] = patchName;
        localStorage.setItem('patchies-saved-patches', JSON.stringify(savedPatchesList));

        // Update local state
        savedPatches = savedPatchesList;
      }

      onCancel();
    } catch (error) {
      console.error('Error renaming patch:', error);
      onCancel();
    }
  }

  function setRoom() {
    if (!roomName.trim()) {
      onCancel();
      return;
    }

    setSearchParam('room', roomName.trim());
    onCancel();
    window.location.reload();
  }

  async function clearCacheAndServiceWorker() {
    try {
      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
        console.log(`[clear-cache] Unregistered ${registrations.length} service worker(s)`);
      }

      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
        console.log(`[clear-cache] Deleted ${cacheNames.length} cache(s)`);
      }

      // Force reload to get fresh content
      alert('Cache cleared! The page will now reload.');
      window.location.reload();
    } catch (error) {
      console.error('[clear-cache] Error:', error);
      alert(`Failed to clear cache: ${error}`);
    }
  }

  async function startOfflineDownload() {
    offlineProgress = {
      current: 0,
      total: 0,
      currentItem: '',
      status: 'downloading'
    };

    try {
      await downloadForOffline((progress) => {
        offlineProgress = progress;
      });
    } catch (e) {
      offlineProgress = {
        ...offlineProgress,
        status: 'error',
        error: e instanceof Error ? e.message : 'Unknown error'
      };
    }
  }

  function scrollToSelectedItem() {
    if (!resultsContainer) return;

    const selectedElement = resultsContainer.children[selectedIndex] as HTMLElement;
    if (!selectedElement) return;

    const containerRect = resultsContainer.getBoundingClientRect();
    const elementRect = selectedElement.getBoundingClientRect();

    // Check if element is below the visible area
    if (elementRect.bottom > containerRect.bottom) {
      selectedElement.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }
    // Check if element is above the visible area
    else if (elementRect.top < containerRect.top) {
      selectedElement.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }

  function handleClickOutside(event: MouseEvent) {
    // @ts-expect-error -- to fix
    if (paletteContainer && !paletteContainer.contains(event.target)) {
      onCancel();
    }
  }

  function handleItemClick(index: number, event?: MouseEvent) {
    event?.stopPropagation();
    selectedIndex = index;
    handleSelect();
  }

  $effect(() => {
    const maxIndex =
      stage === 'commands'
        ? filteredCommands.length - 1
        : stage === 'delete-list' || stage === 'rename-list'
          ? filteredPatches.length - 1
          : 0;

    selectedIndex = Math.min(selectedIndex, Math.max(0, maxIndex));
  });

  $effect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });
</script>

<div
  bind:this={paletteContainer}
  class="absolute z-50 w-80 rounded-lg border border-zinc-600 bg-zinc-900/90 shadow-2xl backdrop-blur-xl"
  style="left: {position.x}px; top: {position.y}px;"
>
  <!-- Search Input -->
  {#if stage === 'commands'}
    <div class="border-b border-zinc-700 p-3">
      <input
        bind:this={searchInput}
        bind:value={searchQuery}
        onkeydown={handleKeydown}
        type="text"
        placeholder="Search commands..."
        class="w-full bg-transparent font-mono text-sm text-zinc-100 placeholder-zinc-400 outline-none"
      />
    </div>
  {:else if stage === 'delete-list'}
    <div class="border-b border-zinc-700 p-3">
      <div class="mb-2 text-xs text-zinc-400">Select a patch to delete:</div>
      <input
        bind:this={searchInput}
        bind:value={searchQuery}
        onkeydown={handleKeydown}
        type="text"
        placeholder="Search patches..."
        class="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-400 outline-none"
      />
    </div>
  {:else if stage === 'rename-list'}
    <div class="border-b border-zinc-700 p-3">
      <div class="mb-2 text-xs text-zinc-400">Select a patch to rename:</div>
      <input
        bind:this={searchInput}
        bind:value={searchQuery}
        onkeydown={handleKeydown}
        type="text"
        placeholder="Search patches..."
        class="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-400 outline-none"
      />
    </div>
  {:else if stage === 'rename-name'}
    <div class="border-b border-zinc-700 p-3">
      <div class="mb-2 text-xs text-zinc-400">Enter new name for "{selectedPatchToRename}":</div>
      <input
        bind:this={searchInput}
        bind:value={patchName}
        onkeydown={handleKeydown}
        type="text"
        placeholder="Enter new patch name..."
        class="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-400 outline-none"
      />
    </div>
  {:else if stage === 'set-room'}
    <div class="border-b border-zinc-700 p-3">
      <div class="mb-2 text-xs text-zinc-400">Enter room ID for netsend/netrecv:</div>
      <input
        bind:this={searchInput}
        bind:value={roomName}
        onkeydown={handleKeydown}
        type="text"
        placeholder="Enter room ID..."
        class="w-full bg-transparent font-mono text-sm text-zinc-100 placeholder-zinc-400 outline-none"
      />
    </div>
  {:else if stage === 'offline-download'}
    <div class="border-b border-zinc-700 p-3">
      <div class="text-sm font-medium text-zinc-200">Preparing for Offline</div>
      <div class="mt-1 text-xs text-zinc-400">Downloading assets for airplane mode...</div>
    </div>
  {/if}

  <!-- Results List -->
  <div bind:this={resultsContainer} class="max-h-64 overflow-y-auto">
    {#if stage === 'commands'}
      {#each filteredCommands as command, index (command.id)}
        <div
          class="cursor-pointer px-3 py-2 {index === selectedIndex
            ? 'bg-zinc-600/50'
            : 'hover:bg-zinc-700'}"
          onclick={(e) => handleItemClick(index, e)}
          onkeydown={(e) => e.key === 'Enter' && handleItemClick(index)}
          role="button"
          tabindex="-1"
        >
          <div class="font-mono text-sm text-zinc-200">{command.name}</div>
          <div class="text-xs text-zinc-400">{command.description}</div>
        </div>
      {/each}
    {:else if stage === 'delete-list'}
      {#if filteredPatches.length === 0}
        <div class="px-3 py-2 text-xs text-zinc-400">No saved patches found</div>
      {:else}
        {#each filteredPatches as patch, index (patch)}
          <div
            class="cursor-pointer px-3 py-2 {index === selectedIndex
              ? 'bg-red-800'
              : 'hover:bg-red-900/50'}"
            onclick={(e) => handleItemClick(index, e)}
            onkeydown={(e) => e.key === 'Enter' && handleItemClick(index)}
            role="button"
            tabindex="-1"
          >
            <div class="font-mono text-sm text-red-200">{patch}</div>
          </div>
        {/each}
      {/if}
    {:else if stage === 'rename-list'}
      {#if filteredPatches.length === 0}
        <div class="px-3 py-2 text-xs text-zinc-400">No saved patches found</div>
      {:else}
        {#each filteredPatches as patch, index (patch)}
          <div
            class="cursor-pointer px-3 py-2 {index === selectedIndex
              ? 'bg-blue-800'
              : 'hover:bg-blue-900/50'}"
            onclick={(e) => handleItemClick(index, e)}
            onkeydown={(e) => e.key === 'Enter' && handleItemClick(index)}
            role="button"
            tabindex="-1"
          >
            <div class="font-mono text-sm text-blue-200">{patch}</div>
          </div>
        {/each}
      {/if}
    {:else if stage === 'rename-name'}
      <!-- Show current input preview -->
      {#if patchName.trim() && patchName !== selectedPatchToRename}
        <div class="px-3 py-2 text-xs text-zinc-400">
          Will rename "<span class="text-blue-200">{selectedPatchToRename}</span>" to "<span
            class="text-zinc-200">{patchName}</span
          >"
        </div>
      {/if}
    {:else if stage === 'set-room'}
      <!-- Show room info -->
      <div class="px-3 py-2 text-xs text-zinc-400">
        {#if roomName.trim()}
          Room ID: <span class="font-mono text-green-300">{roomName}</span>
          <div class="mt-1 text-zinc-500">Page will reload to join this room.</div>
        {:else}
          Enter a room ID to connect with other users
        {/if}
      </div>
    {:else if stage === 'offline-download'}
      <div class="px-3 py-4">
        {#if offlineProgress.status === 'downloading'}
          <div class="mb-2 flex items-center justify-between text-xs text-zinc-400">
            <span>Downloading {offlineProgress.current}/{offlineProgress.total}</span>
            <span class="font-mono text-zinc-500"
              >{Math.round((offlineProgress.current / offlineProgress.total) * 100) || 0}%</span
            >
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-zinc-700">
            <div
              class="h-full bg-green-500 transition-all duration-300"
              style="width: {(offlineProgress.current / offlineProgress.total) * 100 || 0}%"
            ></div>
          </div>
          {#if offlineProgress.currentItem}
            <div class="mt-2 truncate font-mono text-xs text-zinc-500">
              {offlineProgress.currentItem}
            </div>
          {/if}
        {:else if offlineProgress.status === 'complete'}
          <div class="flex items-center gap-2 text-sm text-green-400">
            <span>All assets downloaded for offline use</span>
          </div>
          <div class="mt-2 text-xs text-zinc-500">
            You can now use Patchies without an internet connection.
          </div>
        {:else if offlineProgress.status === 'error'}
          <div class="text-sm text-red-400">Download failed</div>
          <div class="mt-1 text-xs text-zinc-500">{offlineProgress.error}</div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Footer -->
  <div class="border-t border-zinc-700 px-3 py-2 text-xs text-zinc-500">
    {#if stage === 'commands'}
      ↑↓ Navigate • Enter Select • Esc Cancel
    {:else if stage === 'delete-list'}
      ↑↓ Navigate • Enter Delete • Esc Back
    {:else if stage === 'rename-list'}
      ↑↓ Navigate • Enter Rename • Esc Back
    {:else if stage === 'rename-name'}
      Enter Rename • Esc Back
    {:else if stage === 'set-room'}
      Enter Set Room • Esc Back
    {:else if stage === 'offline-download'}
      {#if offlineProgress.status === 'complete' || offlineProgress.status === 'error'}
        Esc Close
      {:else}
        Downloading...
      {/if}
    {/if}
  </div>
</div>
