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
    Copy
  } from '@lucide/svelte/icons';
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import * as Tooltip from '$lib/components/ui/tooltip';
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

  // Expansion state
  let expandedPaths = $state(new Set<string>(['built-in', 'user']));

  // Renaming state
  let renamingPath = $state<string | null>(null);
  let renameInputValue = $state('');

  // New folder creation state
  let creatingFolderIn = $state<string | null>(null);
  let newFolderName = $state('');

  // File input for import
  let importInputRef = $state<HTMLInputElement | null>(null);

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

  // Drag handlers for presets
  function handlePresetDragStart(
    event: DragEvent,
    libraryId: string,
    path: PresetPath,
    preset: Preset
  ) {
    const fullPath = [libraryId, ...path];
    const data = JSON.stringify({ path: fullPath, preset });
    event.dataTransfer?.setData('application/x-preset', data);
    event.dataTransfer?.setData('text/plain', preset.name);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
    }
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
    const name = prompt('Enter library name:');
    if (name?.trim()) {
      const id = presetLibraryStore.addLibrary(name.trim());
      expandedPaths.add(id);
      expandedPaths = new Set(expandedPaths);
      toast.success(`Created library "${name.trim()}"`);
    }
  }

  // Restore built-in
  function restoreBuiltin() {
    if (confirm('Restore built-in presets to default? This will reset any changes.')) {
      presetLibraryStore.restoreBuiltinLibrary();
      toast.success('Restored built-in presets');
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

  <ContextMenu.Root>
    <ContextMenu.Trigger disabled={!canEdit} class="block w-full">
      <div class="group flex w-full items-center text-left text-xs hover:bg-zinc-800">
        <button
          class="flex flex-1 cursor-pointer items-center gap-1.5 py-1"
          style="padding-left: {paddingLeft}px"
          draggable={!isFolder ? 'true' : 'false'}
          ondragstart={(e) =>
            !isFolder && handlePresetDragStart(e, libraryId, entryPath, entry as Preset)}
          onclick={() => {
            if (isRenaming) return;
            if (isFolder) {
              toggleExpanded(fullPathStr);
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

  <ContextMenu.Root>
    <ContextMenu.Trigger class="block w-full">
      <div class="group flex w-full items-center text-left text-xs hover:bg-zinc-800">
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
      {#if library.id === 'built-in'}
        <ContextMenu.Item onclick={restoreBuiltin}>
          <RotateCcw class="mr-2 h-4 w-4" />
          Restore Defaults
        </ContextMenu.Item>
      {/if}
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

<div class="flex h-full flex-col" role="tree">
  <!-- Libraries -->
  <div class="flex-1 overflow-y-auto py-1">
    {#each $presetLibraryStore as library}
      {@render libraryNode(library)}
    {/each}
  </div>

  <!-- Footer actions -->
  <div class="flex items-center gap-1 border-t border-zinc-800 px-2 py-1.5">
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
