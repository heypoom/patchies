<script lang="ts">
  import {
    FileJson,
    Trash2,
    Pencil,
    Download,
    Upload,
    Play,
    Search,
    Link,
    Save,
    History
  } from '@lucide/svelte/icons';
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import LoadPatchDialog from '$lib/components/dialogs/LoadPatchDialog.svelte';
  import DeletePatchDialog from '$lib/components/dialogs/DeletePatchDialog.svelte';
  import { toast } from 'svelte-sonner';
  import { isMobile, isSidebarOpen, currentPatchName } from '../../../stores/ui.store';
  import { serializePatch, type PatchSaveFormat } from '$lib/save-load/serialize-patch';
  import { migratePatch } from '$lib/migration';
  import { createAndCopyShareLink } from '$lib/save-load/share';

  let { onSavePatch }: { onSavePatch?: () => void } = $props();

  // Load saved patches from localStorage
  function loadSavedPatches(): string[] {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('patchies-saved-patches');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return [];
  }

  let savedPatches = $state(loadSavedPatches());
  let searchQuery = $state('');

  // Filtered patches based on search
  const filteredPatches = $derived(
    savedPatches.filter((name) => name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Renaming state
  let renamingPatch = $state<string | null>(null);
  let renameInputValue = $state('');

  // Delete confirmation dialog
  let showDeleteDialog = $state(false);
  let patchToDelete = $state<string | null>(null);

  // Load confirmation dialog
  let showLoadDialog = $state(false);
  let patchToLoad = $state<string | null>(null);

  // Selected patch for mobile actions
  let selectedPatch = $state<string | null>(null);

  // Refresh patches list
  function refreshPatches() {
    savedPatches = loadSavedPatches();
  }

  // Confirm load (shows dialog)
  function confirmLoad(patchName: string) {
    patchToLoad = patchName;
    showLoadDialog = true;
  }

  // Load a patch (called after confirmation)
  function loadPatch() {
    if (!patchToLoad) return;

    const patchData = localStorage.getItem(`patchies-patch-${patchToLoad}`);
    if (!patchData) {
      toast.error('Patch not found');
      patchToLoad = null;
      showLoadDialog = false;
      return;
    }

    try {
      // Navigate to load the patch (using the existing load mechanism)
      // The simplest approach is to trigger a page reload with the autosave
      const parsed: PatchSaveFormat = JSON.parse(patchData);
      const migrated = migratePatch(parsed) as PatchSaveFormat;

      // Save to autosave slot and reload
      localStorage.setItem('patchies-patch-autosave', JSON.stringify(migrated));

      // Set the current patch name (persisted to localStorage, survives reload)
      // Don't set for autosave - that's not a "named" patch
      currentPatchName.set(patchToLoad === 'autosave' ? null : patchToLoad);

      window.location.reload();
    } catch (error) {
      console.error('Error loading patch:', error);
      toast.error('Failed to load patch');
    }

    patchToLoad = null;
    showLoadDialog = false;
  }

  // Start renaming
  function startRename(patchName: string) {
    renamingPatch = patchName;
    renameInputValue = patchName;
  }

  // Handle rename
  function handleRenameKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      finishRename();
    } else if (event.key === 'Escape') {
      renamingPatch = null;
    }
  }

  function finishRename() {
    if (!renamingPatch || !renameInputValue.trim()) {
      renamingPatch = null;
      return;
    }

    const newName = renameInputValue.trim();
    if (newName === renamingPatch) {
      renamingPatch = null;
      return;
    }

    // Check if name already exists
    if (savedPatches.includes(newName)) {
      toast.error('A patch with this name already exists');
      return;
    }

    try {
      // Get the patch data
      const patchData = localStorage.getItem(`patchies-patch-${renamingPatch}`);
      if (!patchData) {
        toast.error('Patch not found');
        renamingPatch = null;
        return;
      }

      // Save with new name
      localStorage.setItem(`patchies-patch-${newName}`, patchData);

      // Remove old patch data
      localStorage.removeItem(`patchies-patch-${renamingPatch}`);

      // Update saved patches list
      const index = savedPatches.indexOf(renamingPatch);
      if (index !== -1) {
        savedPatches[index] = newName;
        localStorage.setItem('patchies-saved-patches', JSON.stringify(savedPatches));
        savedPatches = [...savedPatches];
      }

      toast.success(`Renamed to "${newName}"`);
    } catch (error) {
      console.error('Error renaming patch:', error);
      toast.error('Failed to rename patch');
    }

    renamingPatch = null;
  }

  // Confirm delete
  function confirmDelete(patchName: string) {
    patchToDelete = patchName;
    showDeleteDialog = true;
  }

  // Delete patch
  function deletePatch() {
    if (!patchToDelete) return;

    try {
      localStorage.removeItem(`patchies-patch-${patchToDelete}`);

      const filtered = savedPatches.filter((name) => name !== patchToDelete);
      localStorage.setItem('patchies-saved-patches', JSON.stringify(filtered));
      savedPatches = filtered;

      toast.success(`Deleted "${patchToDelete}"`);
    } catch (error) {
      console.error('Error deleting patch:', error);
      toast.error('Failed to delete patch');
    }

    patchToDelete = null;
    showDeleteDialog = false;
    selectedPatch = null;
  }

  // Export patch as JSON file
  function exportPatch(patchName: string) {
    const patchData = localStorage.getItem(`patchies-patch-${patchName}`);
    if (!patchData) {
      toast.error('Patch not found');
      return;
    }

    try {
      const blob = new Blob([patchData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${patchName}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported "${patchName}"`);
    } catch (error) {
      console.error('Error exporting patch:', error);
      toast.error('Failed to export patch');
    }
  }

  // Share patch as link
  async function sharePatch(patchName: string) {
    const patchData = localStorage.getItem(`patchies-patch-${patchName}`);
    if (!patchData) {
      toast.error('Patch not found');
      return;
    }

    try {
      const parsed: PatchSaveFormat = JSON.parse(patchData);
      await createAndCopyShareLink(parsed.nodes, parsed.edges);
    } catch (error) {
      console.error('Error sharing patch:', error);
      toast.error('Failed to share patch');
    }
  }

  // Import patch from JSON file
  let importInputRef = $state<HTMLInputElement | null>(null);

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
      if (!data.nodes || !data.edges) {
        throw new Error('Invalid patch format');
      }

      // Generate a name from the file name (without extension)
      let baseName = file.name.replace(/\.json$/i, '');

      // Ensure unique name
      let finalName = baseName;
      let counter = 1;
      while (savedPatches.includes(finalName)) {
        finalName = `${baseName}-${counter}`;
        counter++;
      }

      // Save the patch
      localStorage.setItem(`patchies-patch-${finalName}`, text);

      // Update the list
      savedPatches = [...savedPatches, finalName];
      localStorage.setItem('patchies-saved-patches', JSON.stringify(savedPatches));

      toast.success(`Imported "${finalName}"`);
    } catch (err) {
      toast.error('Failed to import patch');
      console.error('Import error:', err);
    }

    // Reset input
    input.value = '';
  }

  // Handle keyboard events
  function handleTreeKeydown(event: KeyboardEvent) {
    if (!selectedPatch) return;

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      confirmDelete(selectedPatch);
    }

    if (event.key === 'Escape') {
      selectedPatch = null;
    }

    if (event.key === 'Enter' && selectedPatch) {
      event.preventDefault();
      confirmLoad(selectedPatch);
    }
  }
</script>

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
  <div class="border-b border-zinc-800 px-2 py-2">
    <div class="relative">
      <Search class="absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2 text-zinc-500" />
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search saves..."
        class="w-full rounded border border-zinc-700 bg-zinc-900 py-1.5 pr-6 pl-7 text-[11px] text-zinc-200 placeholder-zinc-500 outline-none focus:border-zinc-600"
      />
    </div>
  </div>

  <!-- Patches list -->
  <div class="flex-1 overflow-y-auto py-1 {$isMobile && selectedPatch ? 'pb-14' : ''}">
    {#if filteredPatches.length === 0}
      <div class="px-4 py-8 text-center text-xs text-zinc-500">
        {#if searchQuery}
          No patches matching "{searchQuery}"
        {:else}
          No saved patches yet.
          <br />
          <span class="text-zinc-600">Use Cmd+S to save your first patch.</span>
        {/if}
      </div>
    {:else}
      {#each filteredPatches as patchName (patchName)}
        {@const isRenaming = renamingPatch === patchName}
        {@const isSelected = selectedPatch === patchName}
        {@const isAutosave = patchName === 'autosave'}
        {@const isActive = $currentPatchName === patchName}

        <ContextMenu.Root>
          <ContextMenu.Trigger class="block w-full">
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div
              class="group flex w-full cursor-pointer items-center gap-2 py-1.5 pr-3 text-left text-xs {isActive
                ? 'border-l-2 border-blue-500 pl-2.5'
                : 'pl-3'} {isSelected
                ? 'bg-blue-900/40 hover:bg-blue-900/50'
                : 'hover:bg-zinc-800'}"
              onclick={() => {
                if (isRenaming) return;
                // Always toggle selection on click (consistent with PresetTreeView)
                selectedPatch = isSelected ? null : patchName;
              }}
              ondblclick={() => {
                if (isRenaming) return;
                confirmLoad(patchName);
              }}
              role="tabpanel"
              tabindex="0"
            >
              {#if isAutosave}
                <span title="Auto-saved patch - automatically saved as you work">
                  <History class="h-4 w-4 shrink-0 text-emerald-400" />
                </span>
              {:else}
                <FileJson class="h-4 w-4 shrink-0 text-blue-400" />
              {/if}

              {#if isRenaming}
                <!-- svelte-ignore a11y_autofocus -->
                <input
                  type="text"
                  class="flex-1 truncate rounded bg-transparent px-1 font-mono text-zinc-300 ring-1 ring-blue-500 outline-none"
                  bind:value={renameInputValue}
                  onkeydown={handleRenameKeydown}
                  onblur={finishRename}
                  onclick={(e) => e.stopPropagation()}
                  autofocus
                />
              {:else}
                <span class="flex-1 truncate font-mono text-zinc-300" title={patchName}>
                  {patchName}
                </span>
              {/if}

              <!-- Desktop hover actions -->
              {#if !$isMobile && !isRenaming}
                <div class="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <button
                    class="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-blue-400"
                    onclick={(e) => {
                      e.stopPropagation();
                      confirmLoad(patchName);
                    }}
                    title="Load patch"
                  >
                    <Play class="h-3.5 w-3.5" />
                  </button>
                  <button
                    class="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                    onclick={(e) => {
                      e.stopPropagation();
                      exportPatch(patchName);
                    }}
                    title="Export"
                  >
                    <Download class="h-3.5 w-3.5" />
                  </button>
                  <button
                    class="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                    onclick={(e) => {
                      e.stopPropagation();
                      startRename(patchName);
                    }}
                    title="Rename"
                  >
                    <Pencil class="h-3.5 w-3.5" />
                  </button>
                  <button
                    class="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-red-400"
                    onclick={(e) => {
                      e.stopPropagation();
                      confirmDelete(patchName);
                    }}
                    title="Delete"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                  </button>
                </div>
              {/if}
            </div>
          </ContextMenu.Trigger>

          <ContextMenu.Content class="w-48">
            <ContextMenu.Item onclick={() => confirmLoad(patchName)}>
              <Play class="mr-2 h-4 w-4" />
              Load
            </ContextMenu.Item>
            <ContextMenu.Separator />
            <ContextMenu.Item onclick={() => sharePatch(patchName)}>
              <Link class="mr-2 h-4 w-4" />
              Share Link
            </ContextMenu.Item>
            <ContextMenu.Item onclick={() => startRename(patchName)}>
              <Pencil class="mr-2 h-4 w-4" />
              Rename
            </ContextMenu.Item>
            <ContextMenu.Item onclick={() => exportPatch(patchName)}>
              <Download class="mr-2 h-4 w-4" />
              Export as JSON
            </ContextMenu.Item>
            <ContextMenu.Separator />
            <ContextMenu.Item
              class="text-red-400 focus:text-red-400"
              onclick={() => confirmDelete(patchName)}
            >
              <Trash2 class="mr-2 h-4 w-4" />
              Delete
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Root>
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
      onclick={() => onSavePatch?.()}
      title="Save Patch As"
    >
      <Save class="h-3.5 w-3.5" />
      <span>Save As</span>
    </button>
    <button
      class="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
      onclick={handleImportClick}
      title="Import Patch"
    >
      <Upload class="h-3.5 w-3.5" />
      <span>Import</span>
    </button>
  </div>
</div>

<!-- Mobile floating toolbar -->
{#if $isMobile && selectedPatch}
  <div
    class="fixed right-0 bottom-0 left-0 border-t border-zinc-800 bg-zinc-900/95 px-4 pt-2 backdrop-blur-sm"
    style="padding-bottom: calc(0.5rem + env(safe-area-inset-bottom, 0px))"
  >
    <div class="flex items-center justify-center gap-2">
      <span class="mr-2 max-w-32 truncate font-mono text-xs text-zinc-400">
        {selectedPatch}
      </span>

      <button
        class="flex cursor-pointer items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        onclick={() => {
          if (selectedPatch) confirmLoad(selectedPatch);
        }}
        title="Load"
      >
        <Play class="h-3.5 w-3.5" />
        <span>Load</span>
      </button>

      <button
        class="flex cursor-pointer items-center gap-1.5 rounded bg-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-600"
        onclick={() => {
          if (selectedPatch) exportPatch(selectedPatch);
        }}
        title="Export"
      >
        <Download class="h-3.5 w-3.5" />
        <span>Export</span>
      </button>

      <button
        class="flex cursor-pointer items-center gap-1.5 rounded bg-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-600"
        onclick={() => {
          if (selectedPatch) startRename(selectedPatch);
          selectedPatch = null;
        }}
        title="Rename"
      >
        <Pencil class="h-3.5 w-3.5" />
      </button>

      <button
        class="flex cursor-pointer items-center gap-1.5 rounded bg-red-600/80 px-3 py-1.5 text-xs text-white hover:bg-red-600"
        onclick={() => {
          if (selectedPatch) confirmDelete(selectedPatch);
        }}
        title="Delete"
      >
        <Trash2 class="h-3.5 w-3.5" />
      </button>

      <button
        class="ml-auto text-xs text-zinc-500 hover:text-zinc-300"
        onclick={() => (selectedPatch = null)}
      >
        Cancel
      </button>
    </div>
  </div>
{/if}

<LoadPatchDialog bind:open={showLoadDialog} patchName={patchToLoad} onConfirm={loadPatch} />

<DeletePatchDialog bind:open={showDeleteDialog} patchName={patchToDelete} onConfirm={deletePatch} />
