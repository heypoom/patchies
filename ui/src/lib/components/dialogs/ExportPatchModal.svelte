<script lang="ts">
  import { Download } from '@lucide/svelte/icons';
  import * as Dialog from '$lib/components/ui/dialog';
  import type { Node, Edge } from '@xyflow/svelte';
  import { serializePatch } from '$lib/save-load/serialize-patch';
  import { currentPatchName as currentPatchNameStore } from '../../../stores/ui.store';

  let {
    open = $bindable(false),
    nodes,
    edges
  }: {
    open: boolean;
    nodes: Node[];
    edges: Edge[];
  } = $props();

  // Form state
  let fileName = $state('');

  // Reset form when dialog opens
  $effect(() => {
    if (open) {
      // Pre-fill with current patch name if available, otherwise generate a name
      fileName = $currentPatchNameStore || generateDefaultName();
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

  function handleExport() {
    if (!fileName.trim()) return;

    const name = fileName.trim();
    const patchJson = serializePatch({ name, nodes, edges });

    const blob = new Blob([patchJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.json`;
    a.click();
    URL.revokeObjectURL(url);

    open = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleExport();
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <Download class="h-5 w-5" />
        Export Patch
      </Dialog.Title>
      <Dialog.Description>Export your patch as a JSON file.</Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 py-4">
      <!-- File Name -->
      <div class="space-y-2">
        <label for="export-file-name" class="text-sm font-medium text-zinc-300">File Name</label>
        <div class="flex items-center gap-2">
          <input
            id="export-file-name"
            type="text"
            bind:value={fileName}
            onkeydown={handleKeydown}
            class="modal-field w-full"
            placeholder="my-patch"
          />
          <span class="text-sm text-zinc-500">.json</span>
        </div>
      </div>

      <p class="text-xs text-zinc-500">
        The file will be downloaded to your default downloads folder.
      </p>
    </div>

    <Dialog.Footer class="flex gap-2">
      <button onclick={() => (open = false)} class="modal-action modal-action--secondary flex-1">
        Cancel
      </button>
      <button
        onclick={handleExport}
        disabled={!fileName.trim()}
        class="modal-action modal-action--primary flex-1"
      >
        Export
      </button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
