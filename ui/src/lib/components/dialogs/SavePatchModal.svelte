<script lang="ts">
  import { Save } from '@lucide/svelte/icons';
  import * as Dialog from '$lib/components/ui/dialog';
  import { toast } from 'svelte-sonner';
  import { savePatchToLocalStorage, getUniquePatchName } from '$lib/save-load/save-local-storage';
  import type { Node, Edge } from '@xyflow/svelte';
  import { deleteSearchParam } from '$lib/utils/search-params';
  import {
    currentPatchName as currentPatchNameStore,
    generateNewPatchId
  } from '../../../stores/ui.store';

  let {
    open = $bindable(false),
    nodes,
    edges,
    onSave
  }: {
    open: boolean;
    nodes: Node[];
    edges: Edge[];
    onSave?: () => void;
  } = $props();

  // Form state
  let patchName = $state('');

  // Compute the actual name that will be saved (with auto-increment if collision)
  let actualSaveName = $derived(
    patchName.trim() ? getUniquePatchName(patchName.trim(), $currentPatchNameStore) : ''
  );

  // Show warning when name will be auto-incremented
  let willAutoIncrement = $derived(patchName.trim() && actualSaveName !== patchName.trim());

  // Reset form when dialog opens
  $effect(() => {
    if (open) {
      // Pre-fill with current patch name if available, otherwise suggest a name
      patchName = $currentPatchNameStore || generateDefaultName();
    }
  });

  function generateDefaultName(): string {
    const now = new Date();
    const date = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    const time = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return `patch-${date}-${time}`.replace(/[:\s,]/g, '-').toLowerCase();
  }

  function handleSave() {
    if (!actualSaveName) return;

    // Remove any URL params related to shared patches
    deleteSearchParam('id');
    deleteSearchParam('src');

    const name = actualSaveName;
    const currentName = $currentPatchNameStore;

    // If saving as a different name (including auto-incremented), generate a new patchId
    // so the new patch has its own KV storage.
    // Only treat as rename if currentName is defined (not first save)
    if (currentName && name !== currentName) {
      generateNewPatchId();
    }

    savePatchToLocalStorage({ name, nodes, edges });

    // Update the current patch name store
    currentPatchNameStore.set(name);

    toast.success(`Saved patch as "${name}"`);
    open = false;

    // Notify parent that save completed (used to exit read-only mode)
    onSave?.();
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
      <Dialog.Title class="flex items-center gap-2">
        <Save class="h-5 w-5" />
        Save Patch
      </Dialog.Title>
      <Dialog.Description>Save your patch to local storage for later use.</Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 py-4">
      <!-- Name -->
      <div class="space-y-2">
        <label for="patch-name" class="text-sm font-medium text-zinc-300">Name</label>
        <input
          id="patch-name"
          type="text"
          bind:value={patchName}
          onkeydown={handleKeydown}
          class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          placeholder="my-patch"
        />
      </div>

      <!-- Auto-increment notice -->
      {#if willAutoIncrement}
        <p class="text-xs text-amber-400">
          "{patchName.trim()}" already exists. Will save as "{actualSaveName}" instead.
        </p>
      {:else}
        <p class="text-xs text-zinc-500">
          {#if $currentPatchNameStore === patchName.trim()}
            This will update the current patch.
          {:else}
            Enter a unique name for your patch.
          {/if}
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
        {willAutoIncrement ? 'Save as Copy' : 'Save'}
      </button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
