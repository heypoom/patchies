<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Select from '$lib/components/ui/select';
  import { presetLibraryStore, editableLibraries } from '../../../stores/preset-library.store';
  import type { Preset } from '$lib/presets/types';
  import type { Node } from '@xyflow/svelte';
  import { toast } from 'svelte-sonner';

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

  // Reset form when dialog opens with a new node
  $effect(() => {
    if (open && node) {
      // Default name from node type or expression
      const nodeData = node.data as Record<string, unknown>;
      presetName =
        (nodeData.expr as string) || (nodeData.name as string) || node.type || 'New Preset';
      presetDescription = '';
      selectedLibraryId = 'user';
    }
  });

  function handleSave() {
    if (!node || !presetName.trim()) return;

    const nodeData = node.data as Record<string, unknown>;

    const preset: Preset = {
      name: presetName.trim(),
      description: presetDescription.trim() || undefined,
      type: node.type,
      data: nodeData
    };

    const success = presetLibraryStore.addPreset(selectedLibraryId, [], preset);

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

      <!-- Library -->
      <div class="space-y-2">
        <label for="preset-library" class="text-sm font-medium text-zinc-300">Library</label>
        <Select.Root type="single" bind:value={selectedLibraryId}>
          <Select.Trigger
            class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
          >
            {$editableLibraries.find((lib) => lib.id === selectedLibraryId)?.name ??
              'Select library'}
          </Select.Trigger>
          <Select.Content class="border border-zinc-700 bg-zinc-800">
            {#each $editableLibraries as library}
              <Select.Item value={library.id} class="text-zinc-200 hover:bg-zinc-700">
                {library.name}
              </Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
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
        disabled={!presetName.trim()}
        class="flex-1 cursor-pointer rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Save Preset
      </button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
