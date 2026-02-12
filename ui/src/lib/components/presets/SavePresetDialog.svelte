<script lang="ts">
  import { ChevronRight, Folder, Library } from '@lucide/svelte/icons';
  import * as Dialog from '$lib/components/ui/dialog';
  import { presetLibraryStore, editableLibraries } from '../../../stores/preset-library.store';
  import type { Preset, PresetFolder, PresetPath } from '$lib/presets/types';
  import type { Node } from '@xyflow/svelte';
  import { toast } from 'svelte-sonner';
  import { isPreset, getUniquePresetName } from '$lib/presets/preset-utils';
  import FolderPickerDialog, { type FolderNode } from '../sidebar/FolderPickerDialog.svelte';

  let {
    open = $bindable(false),
    node
  }: {
    open: boolean;
    node: Node | null;
  } = $props();

  // Form state
  let presetName = $state('');
  let presetDescription = $state('');
  let selectedLibraryId = $state('user');
  let selectedFolderPath = $state<PresetPath>([]);
  let showFolderPicker = $state(false);

  // Compute the actual name that will be saved (with auto-increment if collision)
  let actualSaveName = $derived.by(() => {
    const trimmedName = presetName.trim();
    if (!trimmedName) return '';

    const library = $editableLibraries.find((lib) => lib.id === selectedLibraryId);
    if (!library) return trimmedName;

    return getUniquePresetName(library, selectedFolderPath, trimmedName);
  });

  // Show warning when name will be auto-incremented
  let willAutoIncrement = $derived(presetName.trim() && actualSaveName !== presetName.trim());

  // Reset form when dialog opens with a new node
  $effect(() => {
    if (open && node) {
      // Default name from node type or expression
      const nodeData = node.data as Record<string, unknown>;
      presetName =
        (nodeData.expr as string) || (nodeData.name as string) || node.type || 'New Preset';
      presetDescription = '';
      selectedLibraryId = 'user';
      selectedFolderPath = [];
    }
  });

  // Build folder tree for the picker
  const folderTree = $derived.by((): FolderNode[] => {
    const libraries = $editableLibraries;

    function buildChildren(folder: PresetFolder, parentPath: PresetPath): FolderNode[] {
      const children: FolderNode[] = [];

      for (const [name, entry] of Object.entries(folder)) {
        if (!isPreset(entry)) {
          const fullPath = [...parentPath, name];
          children.push({
            id: fullPath.join('/'),
            name,
            children: buildChildren(entry as PresetFolder, fullPath)
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

  // Get display text for selected location
  const selectedLocationDisplay = $derived.by(() => {
    const library = $editableLibraries.find((lib) => lib.id === selectedLibraryId);
    if (!library) return 'Select location';

    if (selectedFolderPath.length === 0) {
      return library.name;
    }

    return `${library.name} / ${selectedFolderPath.join(' / ')}`;
  });

  function handleFolderSelect(folderId: string) {
    // Parse the folder ID - could be just libraryId or libraryId/folder/path
    const parts = folderId.split('/');

    // Check if first part is a library ID
    const library = $editableLibraries.find((lib) => lib.id === parts[0]);
    if (library) {
      selectedLibraryId = parts[0];
      selectedFolderPath = parts.slice(1);
    } else {
      // It's a folder path within the current library
      selectedFolderPath = parts;
    }
  }

  function handleSave() {
    if (!node || !node.type || !actualSaveName) return;

    const nodeData = node.data as Record<string, unknown>;

    const preset: Preset = {
      name: actualSaveName,
      description: presetDescription.trim() || undefined,
      type: node.type,
      data: nodeData
    };

    const success = presetLibraryStore.addPreset(selectedLibraryId, selectedFolderPath, preset);

    if (success) {
      toast.success(`Saved preset "${preset.name}"`);
      open = false;
    } else {
      toast.error('Failed to save preset');
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSave();
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Save as Preset</Dialog.Title>
      <Dialog.Description>
        Save this {node?.type ?? 'object'} as a reusable preset.
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 py-4">
      <!-- Name -->
      <div class="space-y-2">
        <label for="preset-name" class="text-sm font-medium text-zinc-300">Name</label>
        <input
          id="preset-name"
          type="text"
          bind:value={presetName}
          onkeydown={handleKeydown}
          class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          placeholder="My Preset"
        />
      </div>

      <!-- Description -->
      <div class="space-y-2">
        <label for="preset-description" class="text-sm font-medium text-zinc-300">
          Description <span class="text-zinc-500">(optional)</span>
        </label>
        <textarea
          id="preset-description"
          bind:value={presetDescription}
          rows={2}
          class="w-full resize-none rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          placeholder="What does this preset do?"
        ></textarea>
      </div>

      <!-- Location (Library + Folder) -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-zinc-300">Save to</label>
        <button
          type="button"
          onclick={() => (showFolderPicker = true)}
          class="flex w-full items-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-left text-sm text-zinc-200 hover:border-zinc-600"
        >
          {#if selectedFolderPath.length > 0}
            <Folder class="h-4 w-4 shrink-0 text-yellow-500" />
          {:else}
            <Library class="h-4 w-4 shrink-0 text-blue-400" />
          {/if}
          <span class="flex-1 truncate">{selectedLocationDisplay}</span>
          <ChevronRight class="h-4 w-4 shrink-0 text-zinc-500" />
        </button>
      </div>

      <!-- Auto-increment notice -->
      {#if willAutoIncrement}
        <p class="text-xs text-amber-400">
          "{presetName.trim()}" already exists. Will save as "{actualSaveName}" instead.
        </p>
      {/if}
    </div>

    <Dialog.Footer class="flex gap-2">
      <button
        onclick={() => (open = false)}
        class="flex-1 cursor-pointer rounded bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-600"
      >
        Cancel
      </button>
      <button
        onclick={handleSave}
        disabled={!actualSaveName}
        class="flex-1 cursor-pointer rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {willAutoIncrement ? 'Save as Copy' : 'Save Preset'}
      </button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<FolderPickerDialog
  bind:open={showFolderPicker}
  title="Save to..."
  description="Select a library or folder"
  folders={folderTree}
  onSelect={handleFolderSelect}
/>
