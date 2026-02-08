<script lang="ts">
  import {
    ChevronRight,
    ChevronDown,
    Library,
    LibraryBig,
    Folder,
    FolderOpen,
    FolderPlus,
    Blocks,
    Lock,
    Trash2,
    Pencil,
    Download,
    Upload,
    RotateCcw,
    Plus,
    FolderInput,
    Ellipsis
  } from '@lucide/svelte/icons';
  import SearchBar from './SearchBar.svelte';
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as Popover from '$lib/components/ui/popover';
  import { toast } from 'svelte-sonner';
  import { presetLibraryStore, editableLibraries } from '../../../stores/preset-library.store';
  import type {
    PresetLibrary,
    PresetFolder,
    PresetFolderEntry,
    Preset,
    PresetPath
  } from '$lib/presets/types';
  import { isPreset } from '$lib/presets/preset-utils';
  import { isMobile, isSidebarOpen } from '../../../stores/ui.store';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import FolderPickerDialog, { type FolderNode } from './FolderPickerDialog.svelte';

  // Load expanded paths from localStorage, defaulting to built-in and user
  function loadExpandedPaths(): Set<string> {
    if (typeof window === 'undefined') return new Set(['built-in', 'user']);
    try {
      const saved = localStorage.getItem('patchies-preset-tree-expanded');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch {}
    return new Set(['built-in', 'user']);
  }

  let expandedPaths = $state(loadExpandedPaths());
  let searchQuery = $state('');

  // Search result type for flat display
  type SearchResult = {
    libraryId: string;
    library: PresetLibrary;
    path: PresetPath;
    name: string;
    preset: Preset;
  };

  // Flatten and filter presets for search
  const searchResults = $derived.by((): SearchResult[] => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();

    const results: SearchResult[] = [];

    function collectPresets(
      libraryId: string,
      library: PresetLibrary,
      folder: PresetFolder,
      currentPath: PresetPath
    ) {
      for (const [name, entry] of Object.entries(folder)) {
        if (isPreset(entry)) {
          // It's a preset - check if name matches
          if (name.toLowerCase().includes(query)) {
            results.push({
              libraryId,
              library,
              path: [...currentPath, name],
              name,
              preset: entry
            });
          }
        } else {
          // It's a folder - recurse
          collectPresets(libraryId, library, entry as PresetFolder, [...currentPath, name]);
        }
      }
    }

    for (const library of $presetLibraryStore) {
      collectPresets(library.id, library, library.presets, []);
    }

    // Sort: user libraries first (readonly=false), built-in last (readonly=true)
    return results.sort((a, b) => {
      if (a.library.readonly === b.library.readonly) return 0;

      return a.library.readonly ? 1 : -1;
    });
  });

  // Persist expanded paths changes
  $effect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('patchies-preset-tree-expanded', JSON.stringify([...expandedPaths]));
    }
  });

  // Renaming state
  let renamingPath = $state<string | null>(null);
  let renameInputValue = $state('');

  // New folder creation state
  let creatingFolderIn = $state<string | null>(null);
  let newFolderName = $state('');

  // File input for import
  let importInputRef = $state<HTMLInputElement | null>(null);

  // Drag-drop state
  let dropTargetPath = $state<string | null>(null);
  let dragSourcePath = $state<string | null>(null);

  // Mobile-specific state
  let selectedPresetPath = $state<{ libraryId: string; path: PresetPath; preset: Preset } | null>(
    null
  );
  let showMoveDialog = $state(false);
  let mobileMoreOpen = $state(false);

  // New library dialog state
  let showNewLibraryDialog = $state(false);
  let newLibraryName = $state('');

  const eventBus = PatchiesEventBus.getInstance();

  // Build folder tree for move dialog (only editable libraries)
  const moveFolderTree = $derived.by((): FolderNode[] => {
    const libraries = $editableLibraries;

    function buildChildren(folder: PresetFolder, parentPath: PresetPath): FolderNode[] {
      const children: FolderNode[] = [];

      for (const [name, entry] of Object.entries(folder)) {
        if (!isPreset(entry)) {
          const fullPath = [...parentPath, name];
          // Disable if this is the current preset's parent folder
          const isCurrentParent = !!(
            selectedPresetPath &&
            selectedPresetPath.path.length === fullPath.length + 1 &&
            selectedPresetPath.path.slice(0, -1).join('/') === fullPath.join('/')
          );

          children.push({
            id: fullPath.join('/'),
            name,
            children: buildChildren(entry as PresetFolder, fullPath),
            disabled: isCurrentParent
          });
        }
      }

      return children.sort((a, b) => a.name.localeCompare(b.name));
    }

    return libraries.map((lib) => ({
      id: lib.id,
      name: lib.name,
      icon: Library,
      iconClass: 'text-blue-400',
      children: buildChildren(lib.presets, [])
    }));
  });

  // Handle insert preset to canvas (mobile)
  function handleInsertPresetToCanvas() {
    if (!selectedPresetPath) return;
    eventBus.dispatch({
      type: 'insertPresetToCanvas',
      path: [selectedPresetPath.libraryId, ...selectedPresetPath.path],
      preset: {
        type: selectedPresetPath.preset.type,
        name: selectedPresetPath.preset.name,
        data: selectedPresetPath.preset.data
      }
    });
    selectedPresetPath = null;
    $isSidebarOpen = false;
    toast.success('Added to canvas');
  }

  // Handle move preset
  function handleMovePreset(targetFolderId: string) {
    if (!selectedPresetPath) return;

    // Parse target: could be just libraryId or libraryId/folder/path
    const parts = targetFolderId.split('/');
    const targetLibraryId = parts[0];
    const targetFolderPath = parts.slice(1);

    const success = presetLibraryStore.moveEntry(
      selectedPresetPath.libraryId,
      selectedPresetPath.path,
      targetLibraryId,
      targetFolderPath
    );

    if (success) {
      toast.success(`Moved "${selectedPresetPath.preset.name}"`);
    }
    selectedPresetPath = null;
  }

  // Select preset (works on both mobile and desktop)
  function selectPreset(libraryId: string, path: PresetPath, preset: Preset) {
    selectedPresetPath = { libraryId, path, preset };
  }

  // Handle keyboard events for the tree
  function handleTreeKeydown(event: KeyboardEvent) {
    if (!selectedPresetPath) return;

    // Delete or Backspace to delete selected preset
    if (event.key === 'Delete' || event.key === 'Backspace') {
      // Only delete if from editable library
      const library = $presetLibraryStore.find((l) => l.id === selectedPresetPath!.libraryId);

      if (library && !library.readonly) {
        event.preventDefault();
        deleteEntry(selectedPresetPath.libraryId, selectedPresetPath.path, false);
        selectedPresetPath = null;
      }
    }

    // Escape to deselect
    if (event.key === 'Escape') {
      selectedPresetPath = null;
    }
  }

  function toggleExpanded(path: string) {
    if (expandedPaths.has(path)) {
      expandedPaths.delete(path);
    } else {
      expandedPaths.add(path);
    }
    expandedPaths = new Set(expandedPaths);
  }

  function pathToString(path: PresetPath): string {
    return path.join('/');
  }

  function getSortedEntries(folder: PresetFolder): [string, PresetFolderEntry][] {
    return Object.entries(folder).sort(([aKey, aVal], [bKey, bVal]) => {
      // Folders come before presets
      const aIsFolder = !isPreset(aVal);
      const bIsFolder = !isPreset(bVal);
      if (aIsFolder && !bIsFolder) return -1;
      if (!aIsFolder && bIsFolder) return 1;
      // Then alphabetical
      return aKey.localeCompare(bKey);
    });
  }

  function getPresetTypeIcon(type: string): { color: string } {
    const typeColors: Record<string, string> = {
      glsl: 'text-orange-400',
      hydra: 'text-pink-400',
      p5: 'text-red-400',
      js: 'text-yellow-400',
      slider: 'text-blue-400',
      'canvas.dom': 'text-green-400',
      strudel: 'text-purple-400',
      'tone.js': 'text-cyan-400',
      three: 'text-emerald-400'
    };
    return { color: typeColors[type] ?? 'text-zinc-400' };
  }

  // Drag handlers for presets and folders
  function handleEntryDragStart(
    event: DragEvent,
    libraryId: string,
    path: PresetPath,
    entry: PresetFolderEntry,
    isFolder: boolean,
    isEditable: boolean
  ) {
    const fullPath = [libraryId, ...path];
    const fullPathStr = pathToString(fullPath);
    dragSourcePath = fullPathStr;

    if (isFolder) {
      // Internal move data for folders (only for editable libraries)
      const data = JSON.stringify({
        type: 'folder',
        libraryId,
        path,
        name: path[path.length - 1]
      });
      event.dataTransfer?.setData('application/x-preset-move', data);
      event.dataTransfer?.setData('text/plain', path[path.length - 1]);
    } else {
      // Preset data
      const preset = entry as Preset;

      // Only include move data for editable libraries
      if (isEditable) {
        const moveData = JSON.stringify({
          type: 'preset',
          libraryId,
          path,
          name: preset.name
        });
        event.dataTransfer?.setData('application/x-preset-move', moveData);
      }

      // Always include preset data for canvas drops
      const canvasData = JSON.stringify({ path: fullPath, preset });
      event.dataTransfer?.setData('application/x-preset', canvasData);
      event.dataTransfer?.setData('text/plain', preset.name);
    }

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copyMove';
    }
  }

  function handleDragEnd() {
    dragSourcePath = null;
    dropTargetPath = null;
  }

  // Drop target handlers
  function handleFolderDragOver(event: DragEvent, targetPathStr: string, isEditable: boolean) {
    if (!isEditable) return;

    const hasMoveData = event.dataTransfer?.types.includes('application/x-preset-move');
    if (!hasMoveData) return;

    // Don't allow dropping on itself or its children
    if (
      dragSourcePath &&
      (targetPathStr === dragSourcePath || targetPathStr.startsWith(dragSourcePath + '/'))
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    dropTargetPath = targetPathStr;
  }

  function handleFolderDragLeave(event: DragEvent) {
    // Only clear if leaving the tree entirely
    const relatedTarget = event.relatedTarget as HTMLElement | null;
    if (!relatedTarget?.closest('[role="tree"]')) {
      dropTargetPath = null;
    }
  }

  function handleFolderDrop(
    event: DragEvent,
    targetLibraryId: string,
    targetFolderPath: PresetPath
  ) {
    event.preventDefault();
    event.stopPropagation();

    const currentDropTarget = dropTargetPath;
    dropTargetPath = null;
    dragSourcePath = null;

    const moveDataStr = event.dataTransfer?.getData('application/x-preset-move');
    if (!moveDataStr) return;

    try {
      const moveData = JSON.parse(moveDataStr) as {
        type: 'preset' | 'folder';
        libraryId: string;
        path: PresetPath;
        name: string;
      };

      const success = presetLibraryStore.moveEntry(
        moveData.libraryId,
        moveData.path,
        targetLibraryId,
        targetFolderPath
      );

      if (success) {
        toast.success(`Moved "${moveData.name}"`);

        // Expand the target folder
        if (currentDropTarget) {
          expandedPaths.add(currentDropTarget);
          expandedPaths = new Set(expandedPaths);
        }
      }
    } catch (err) {
      console.error('Failed to parse move data:', err);
    }
  }

  // Check if a path is the current drop target
  function isDropTarget(pathStr: string): boolean {
    return dropTargetPath === pathStr;
  }

  // Rename handlers
  function startRename(path: string, currentName: string) {
    renamingPath = path;
    renameInputValue = currentName;
  }

  function handleRenameKeydown(event: KeyboardEvent, libraryId: string, entryPath: PresetPath) {
    if (event.key === 'Enter') {
      event.preventDefault();

      if (renameInputValue.trim()) {
        presetLibraryStore.renameEntry(libraryId, entryPath, renameInputValue.trim());
      }

      renamingPath = null;
    } else if (event.key === 'Escape') {
      renamingPath = null;
    }
  }

  // Folder creation
  function startFolderCreation(path: string) {
    creatingFolderIn = path;
    newFolderName = '';
  }

  function handleNewFolderKeydown(event: KeyboardEvent, libraryId: string, parentPath: PresetPath) {
    if (event.key === 'Enter') {
      event.preventDefault();

      if (newFolderName.trim()) {
        presetLibraryStore.createFolder(libraryId, parentPath, newFolderName.trim());

        // Expand the parent
        expandedPaths.add(pathToString([libraryId, ...parentPath]));
        expandedPaths = new Set(expandedPaths);
      }

      creatingFolderIn = null;
    } else if (event.key === 'Escape') {
      creatingFolderIn = null;
    }
  }

  // Delete handlers
  function deleteEntry(libraryId: string, entryPath: PresetPath, isFolder: boolean) {
    if (isFolder) {
      presetLibraryStore.removeFolder(libraryId, entryPath);
    } else {
      presetLibraryStore.removePreset(libraryId, entryPath);
    }

    toast.success(`Deleted ${isFolder ? 'folder' : 'preset'}`);
  }

  // Export library
  function exportLibrary(libraryId: string) {
    const exported = presetLibraryStore.exportLibrary(libraryId);
    if (!exported) return;

    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${exported.name.toLowerCase().replace(/\s+/g, '-')}-presets.json`;
    a.click();

    URL.revokeObjectURL(url);

    toast.success(`Exported "${exported.name}"`);
  }

  // Import library
  function handleImportClick() {
    importInputRef?.click();
  }

  async function handleImportChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Basic validation
      if (!data.name || !data.presets) {
        throw new Error('Invalid preset library format');
      }

      presetLibraryStore.importLibrary(data);
      toast.success(`Imported "${data.name}"`);
    } catch (err) {
      toast.error('Failed to import preset library');
      console.error('Import error:', err);
    }

    // Reset input
    input.value = '';
  }

  // Create new library
  function createNewLibrary() {
    newLibraryName = '';
    showNewLibraryDialog = true;
  }

  function handleCreateLibrary() {
    if (!newLibraryName.trim()) return;

    const id = presetLibraryStore.addLibrary(newLibraryName.trim());
    expandedPaths.add(id);
    expandedPaths = new Set(expandedPaths);
    toast.success(`Created library "${newLibraryName.trim()}"`);
    showNewLibraryDialog = false;
  }

  function handleNewLibraryKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleCreateLibrary();
    }
  }
</script>

{#snippet presetEntry(
  libraryId: string,
  library: PresetLibrary,
  entryPath: PresetPath,
  name: string,
  entry: PresetFolderEntry,
  depth: number
)}
  {@const isFolder = !isPreset(entry)}
  {@const fullPathStr = pathToString([libraryId, ...entryPath])}
  {@const isExpanded = expandedPaths.has(fullPathStr)}
  {@const paddingLeft = depth * 12 + 8}
  {@const isRenaming = renamingPath === fullPathStr}
  {@const isCreatingFolder = creatingFolderIn === fullPathStr}
  {@const canEdit = !library.readonly}
  {@const isDraggable = isFolder ? canEdit : true}
  {@const isCurrentDropTarget = isDropTarget(fullPathStr)}
  {@const isSelectedPreset =
    !isFolder &&
    selectedPresetPath &&
    selectedPresetPath.libraryId === libraryId &&
    selectedPresetPath.path.join('/') === entryPath.join('/')}

  <ContextMenu.Root>
    <ContextMenu.Trigger disabled={!canEdit} class="block w-full">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="group flex w-full items-center text-left text-xs {isCurrentDropTarget
          ? 'bg-blue-600/30'
          : isSelectedPreset
            ? 'bg-blue-900/40 hover:bg-blue-900/50'
            : 'hover:bg-zinc-800'}"
        ondragover={(e) => isFolder && handleFolderDragOver(e, fullPathStr, canEdit)}
        ondragleave={handleFolderDragLeave}
        ondrop={(e) => isFolder && handleFolderDrop(e, libraryId, entryPath)}
      >
        <button
          class="flex flex-1 cursor-pointer items-center gap-1.5 py-1"
          style="padding-left: {paddingLeft}px"
          draggable={isDraggable ? 'true' : 'false'}
          ondragstart={(e) =>
            isDraggable && handleEntryDragStart(e, libraryId, entryPath, entry, isFolder, canEdit)}
          ondragend={handleDragEnd}
          onclick={() => {
            if (isRenaming) return;
            if (isFolder) {
              toggleExpanded(fullPathStr);
            } else {
              // Select preset (toggle if already selected)
              const preset = entry as Preset;
              if (isSelectedPreset) {
                selectedPresetPath = null;
              } else {
                selectPreset(libraryId, entryPath, preset);
              }
            }
          }}
        >
          {#if isFolder}
            {#if isExpanded}
              <ChevronDown class="h-3 w-3 shrink-0 text-zinc-500" />
              <FolderOpen class="h-3.5 w-3.5 shrink-0 text-yellow-500" />
            {:else}
              <ChevronRight class="h-3 w-3 shrink-0 text-zinc-500" />
              <Folder class="h-3.5 w-3.5 shrink-0 text-yellow-500" />
            {/if}
          {:else}
            {@const preset = entry as Preset}
            {@const typeIcon = getPresetTypeIcon(preset.type)}
            <span class="w-3"></span>
            <Blocks class="h-3.5 w-3.5 shrink-0 {typeIcon.color}" />
          {/if}

          {#if isRenaming}
            <!-- svelte-ignore a11y_autofocus -->
            <input
              type="text"
              class="flex-1 truncate rounded bg-transparent px-1 font-mono text-zinc-300 ring-1 ring-blue-500 outline-none"
              bind:value={renameInputValue}
              onkeydown={(e) => handleRenameKeydown(e, libraryId, entryPath)}
              onclick={(e) => e.stopPropagation()}
              autofocus
            />
          {:else}
            <span class="truncate font-mono text-zinc-300" title={name}>
              {name}
            </span>
            {#if !isFolder}
              {@const preset = entry as Preset}
              <span class="ml-auto pr-2 text-zinc-600">{preset.type}</span>
            {/if}
          {/if}
        </button>

        {#if isFolder && canEdit}
          <div
            class="flex shrink-0 items-center gap-0.5 pr-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <Tooltip.Root>
              <Tooltip.Trigger>
                <button
                  class="rounded p-0.5 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                  onclick={(e) => {
                    e.stopPropagation();
                    startFolderCreation(fullPathStr);
                  }}
                  title="New folder"
                >
                  <FolderPlus class="h-3.5 w-3.5" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content side="bottom">New folder</Tooltip.Content>
            </Tooltip.Root>
          </div>
        {/if}
      </div>
    </ContextMenu.Trigger>

    {#if canEdit}
      <ContextMenu.Content class="w-48">
        {#if isFolder}
          <ContextMenu.Item onclick={() => startFolderCreation(fullPathStr)}>
            <FolderPlus class="mr-2 h-4 w-4" />
            New Folder
          </ContextMenu.Item>
        {/if}
        <ContextMenu.Item onclick={() => startRename(fullPathStr, name)}>
          <Pencil class="mr-2 h-4 w-4" />
          Rename
        </ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item
          class="text-red-400 focus:text-red-400"
          onclick={() => deleteEntry(libraryId, entryPath, isFolder)}
        >
          <Trash2 class="mr-2 h-4 w-4" />
          Delete
        </ContextMenu.Item>
      </ContextMenu.Content>
    {/if}
  </ContextMenu.Root>

  <!-- New folder input -->
  {#if isCreatingFolder && isFolder}
    <div class="flex items-center gap-1.5 py-1" style="padding-left: {paddingLeft + 12}px">
      <FolderPlus class="h-3.5 w-3.5 shrink-0 text-zinc-500" />
      <!-- svelte-ignore a11y_autofocus -->
      <input
        type="text"
        class="flex-1 truncate rounded bg-transparent px-1 font-mono text-xs text-zinc-300 ring-1 ring-blue-500 outline-none"
        placeholder="Folder name"
        bind:value={newFolderName}
        onkeydown={(e) => handleNewFolderKeydown(e, libraryId, entryPath)}
        autofocus
      />
    </div>
  {/if}

  <!-- Children -->
  {#if isFolder && isExpanded}
    {@const folder = entry as PresetFolder}
    {@const sortedEntries = getSortedEntries(folder)}
    {#if sortedEntries.length > 0}
      {#each sortedEntries as [childName, childEntry]}
        {@render presetEntry(
          libraryId,
          library,
          [...entryPath, childName],
          childName,
          childEntry,
          depth + 1
        )}
      {/each}
    {:else}
      <div
        class="py-1 font-mono text-xs text-zinc-600 italic"
        style="padding-left: {paddingLeft + 20}px"
      >
        Empty folder
      </div>
    {/if}
  {/if}
{/snippet}

{#snippet libraryNode(library: PresetLibrary)}
  {@const isExpanded = expandedPaths.has(library.id)}
  {@const isCreatingFolder = creatingFolderIn === library.id}
  {@const canEdit = !library.readonly}
  {@const isCurrentDropTarget = isDropTarget(library.id)}

  <ContextMenu.Root>
    <ContextMenu.Trigger class="block w-full">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="group flex w-full items-center text-left text-xs {isCurrentDropTarget
          ? 'bg-blue-600/30'
          : 'hover:bg-zinc-800'}"
        ondragover={(e) => handleFolderDragOver(e, library.id, canEdit)}
        ondragleave={handleFolderDragLeave}
        ondrop={(e) => handleFolderDrop(e, library.id, [])}
      >
        <button
          class="flex flex-1 cursor-pointer items-center gap-1.5 py-1.5 pl-2"
          onclick={() => toggleExpanded(library.id)}
        >
          {#if isExpanded}
            <ChevronDown class="h-3 w-3 shrink-0 text-zinc-500" />
          {:else}
            <ChevronRight class="h-3 w-3 shrink-0 text-zinc-500" />
          {/if}
          <Library
            class="h-3.5 w-3.5 shrink-0 {library.readonly ? 'text-zinc-500' : 'text-blue-400'}"
          />
          <span class="truncate font-mono font-medium text-zinc-200">
            {library.name}
          </span>
          {#if library.readonly}
            <Lock class="ml-1 h-3 w-3 text-zinc-600" />
          {/if}
        </button>

        {#if !library.readonly}
          <div
            class="flex shrink-0 items-center gap-0.5 pr-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <Tooltip.Root>
              <Tooltip.Trigger>
                <button
                  class="rounded p-0.5 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                  onclick={(e) => {
                    e.stopPropagation();
                    startFolderCreation(library.id);
                  }}
                  title="New folder"
                >
                  <FolderPlus class="h-3.5 w-3.5" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content side="bottom">New folder</Tooltip.Content>
            </Tooltip.Root>

            <Tooltip.Root>
              <Tooltip.Trigger>
                <button
                  class="rounded p-0.5 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                  onclick={(e) => {
                    e.stopPropagation();
                    exportLibrary(library.id);
                  }}
                  title="Export library"
                >
                  <Download class="h-3.5 w-3.5" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content side="bottom">Export library</Tooltip.Content>
            </Tooltip.Root>
          </div>
        {/if}
      </div>
    </ContextMenu.Trigger>

    <ContextMenu.Content class="w-48">
      {#if !library.readonly}
        <ContextMenu.Item onclick={() => startFolderCreation(library.id)}>
          <FolderPlus class="mr-2 h-4 w-4" />
          New Folder
        </ContextMenu.Item>
        <ContextMenu.Separator />
      {/if}

      <ContextMenu.Item onclick={() => exportLibrary(library.id)}>
        <Download class="mr-2 h-4 w-4" />
        Export
      </ContextMenu.Item>

      {#if !library.readonly && library.id !== 'user'}
        <ContextMenu.Separator />
        <ContextMenu.Item
          class="text-red-400 focus:text-red-400"
          onclick={() => presetLibraryStore.removeLibrary(library.id)}
        >
          <Trash2 class="mr-2 h-4 w-4" />
          Delete Library
        </ContextMenu.Item>
      {/if}
    </ContextMenu.Content>
  </ContextMenu.Root>

  <!-- New folder input at library root -->
  {#if isCreatingFolder}
    <div class="flex items-center gap-1.5 py-1 pl-6">
      <FolderPlus class="h-3.5 w-3.5 shrink-0 text-zinc-500" />
      <!-- svelte-ignore a11y_autofocus -->
      <input
        type="text"
        class="flex-1 truncate rounded bg-transparent px-1 font-mono text-xs text-zinc-300 ring-1 ring-blue-500 outline-none"
        placeholder="Folder name"
        bind:value={newFolderName}
        onkeydown={(e) => handleNewFolderKeydown(e, library.id, [])}
        autofocus
      />
    </div>
  {/if}

  <!-- Library contents -->
  {#if isExpanded}
    {@const sortedEntries = getSortedEntries(library.presets)}
    {#if sortedEntries.length > 0}
      {#each sortedEntries as [name, entry]}
        {@render presetEntry(library.id, library, [name], name, entry, 1)}
      {/each}
    {:else}
      <div class="py-1 pl-6 font-mono text-xs text-zinc-600 italic">No presets</div>
    {/if}
  {/if}
{/snippet}

<!-- Hidden file input for import -->
<input
  bind:this={importInputRef}
  type="file"
  accept=".json"
  class="hidden"
  onchange={handleImportChange}
/>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="flex h-full flex-col outline-none"
  role="tree"
  tabindex="0"
  onkeydown={handleTreeKeydown}
>
  <!-- Search bar -->
  <SearchBar bind:value={searchQuery} placeholder="Search presets..." />

  <!-- Libraries -->
  <div class="flex-1 overflow-y-auto py-1 {$isMobile && selectedPresetPath ? 'pb-14' : ''}">
    {#if searchQuery.trim()}
      <!-- Flat search results -->
      {#if searchResults.length === 0}
        <div class="px-4 py-8 text-center text-xs text-zinc-500">
          No presets matching "{searchQuery}"
        </div>
      {:else}
        {#each searchResults as result}
          {@const isSelected =
            selectedPresetPath &&
            selectedPresetPath.libraryId === result.libraryId &&
            selectedPresetPath.path.join('/') === result.path.join('/')}

          {@const typeIcon = getPresetTypeIcon(result.preset.type)}

          <button
            class="flex w-full cursor-pointer items-center gap-1.5 py-1 pl-2 text-left text-xs {isSelected
              ? 'bg-blue-900/40 hover:bg-blue-900/50'
              : 'hover:bg-zinc-800'}"
            draggable="true"
            ondragstart={(e) =>
              handleEntryDragStart(
                e,
                result.libraryId,
                result.path,
                result.preset,
                false,
                !result.library.readonly
              )}
            ondragend={handleDragEnd}
            onclick={() => {
              if (isSelected) {
                selectedPresetPath = null;
              } else {
                selectPreset(result.libraryId, result.path, result.preset);
              }
            }}
          >
            <Blocks class="h-3.5 w-3.5 shrink-0 {typeIcon.color}" />
            <span class="truncate font-mono text-zinc-300">{result.name}</span>
            <span class="ml-auto truncate pr-2 text-[10px] text-zinc-600">
              {result.library.name}{result.path.length > 1
                ? '/' + result.path.slice(0, -1).join('/')
                : ''}
            </span>
          </button>
        {/each}
      {/if}
    {:else}
      {#each $presetLibraryStore as library}
        {@render libraryNode(library)}
      {/each}
    {/if}
  </div>

  <!-- Footer actions -->
  <div
    class="sticky bottom-0 flex items-center gap-1 border-t border-zinc-800 bg-zinc-950 px-2 pt-1.5"
    style="padding-bottom: calc(0.375rem + env(safe-area-inset-bottom, 0px))"
  >
    <button
      class="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
      onclick={createNewLibrary}
      title="New Library"
    >
      <LibraryBig class="h-3.5 w-3.5" />
      <span>New Library</span>
    </button>
    <button
      class="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
      onclick={handleImportClick}
      title="Import Library"
    >
      <Upload class="h-3.5 w-3.5" />
      <span>Import</span>
    </button>
  </div>
</div>

<!-- Mobile floating toolbar -->
{#if $isMobile && selectedPresetPath}
  {@const currentSelection = selectedPresetPath}
  {@const selectedLibrary = $presetLibraryStore.find((l) => l.id === currentSelection.libraryId)}
  {@const canEdit = selectedLibrary && !selectedLibrary.readonly}

  <div
    class="fixed right-0 bottom-0 left-0 border-t border-zinc-800 bg-zinc-900/95 px-4 pt-2 backdrop-blur-sm"
    style="padding-bottom: calc(0.5rem + env(safe-area-inset-bottom, 0px))"
  >
    <div class="flex items-center justify-center gap-2">
      <span class="mr-2 max-w-32 truncate font-mono text-xs text-zinc-400">
        {selectedPresetPath.preset.name}
      </span>

      <button
        class="flex cursor-pointer items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        onclick={handleInsertPresetToCanvas}
        title="Insert to Canvas"
      >
        <Plus class="h-3.5 w-3.5" />
        <span>Insert</span>
      </button>

      {#if canEdit}
        <button
          class="flex cursor-pointer items-center gap-1.5 rounded bg-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-600"
          onclick={() => (showMoveDialog = true)}
          title="Move to folder"
        >
          <FolderInput class="h-3.5 w-3.5" />
          <span>Move</span>
        </button>

        <Popover.Root bind:open={mobileMoreOpen}>
          <Popover.Trigger
            class="flex cursor-pointer items-center rounded bg-zinc-700 p-1.5 text-zinc-200 hover:bg-zinc-600"
          >
            <Ellipsis class="h-4 w-4" />
          </Popover.Trigger>
          <Popover.Content class="w-40 border-zinc-700 bg-zinc-900 p-1" side="top" align="end">
            <button
              class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800"
              onclick={() => {
                if (selectedPresetPath) {
                  startRename(
                    pathToString([selectedPresetPath.libraryId, ...selectedPresetPath.path]),
                    selectedPresetPath.preset.name
                  );
                }
                mobileMoreOpen = false;
                selectedPresetPath = null;
              }}
            >
              <Pencil class="h-4 w-4 text-zinc-400" />
              Rename
            </button>
            <button
              class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-red-400 hover:bg-zinc-800"
              onclick={() => {
                if (selectedPresetPath) {
                  deleteEntry(selectedPresetPath.libraryId, selectedPresetPath.path, false);
                }
                mobileMoreOpen = false;
                selectedPresetPath = null;
              }}
            >
              <Trash2 class="h-4 w-4" />
              Delete
            </button>
          </Popover.Content>
        </Popover.Root>
      {/if}

      <button
        class="ml-auto text-xs text-zinc-500 hover:text-zinc-300"
        onclick={() => (selectedPresetPath = null)}
      >
        Cancel
      </button>
    </div>
  </div>
{/if}

<!-- Move to folder dialog -->
<FolderPickerDialog
  bind:open={showMoveDialog}
  title="Move to..."
  description="Select a destination folder"
  confirmText="Move here"
  folders={moveFolderTree}
  onSelect={handleMovePreset}
/>

<!-- New library dialog -->
<Dialog.Root bind:open={showNewLibraryDialog}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>New Library</Dialog.Title>
      <Dialog.Description>Create a new preset library to organize your presets.</Dialog.Description>
    </Dialog.Header>

    <div class="mb-2 space-y-4">
      <div class="space-y-2">
        <label for="library-name" class="text-sm font-medium text-zinc-300">Name</label>
        <input
          id="library-name"
          type="text"
          bind:value={newLibraryName}
          onkeydown={handleNewLibraryKeydown}
          class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          placeholder="My Library"
        />
      </div>
    </div>

    <Dialog.Footer class="flex gap-2">
      <button
        onclick={() => (showNewLibraryDialog = false)}
        class="flex-1 cursor-pointer rounded bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-600"
      >
        Cancel
      </button>
      <button
        onclick={handleCreateLibrary}
        disabled={!newLibraryName.trim()}
        class="flex-1 cursor-pointer rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Create Library
      </button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
