<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import { hasAIApiKey } from '../../../stores/ai-settings.store';

  let {
    open = $bindable(false),
    patchName,
    isReadOnly = false,
    onConfirm,
    onCancel
  }: {
    open: boolean;
    patchName: string | null;
    isReadOnly?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  } = $props();

  let hasApiKey = $derived(open && $hasAIApiKey);

  function handleCancel() {
    onCancel();
    open = false;
  }

  function handleConfirm() {
    onConfirm();
    open = false;
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && open) {
      onCancel();
    }

    open = nextOpen;
  }
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Load Patch</Dialog.Title>
      <Dialog.Description class="text-left">
        {#if patchName}
          You're about to load "{patchName}".
        {:else}
          You're about to load a patch from a link.
        {/if}
      </Dialog.Description>
    </Dialog.Header>

    <div
      class="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
    >
      <strong>Warning:</strong> Patches run un-sandboxed code. A malicious patch could execute
      arbitrary code, redirect you, or steal data{#if hasApiKey}
        &nbsp;including your <em>AI API key</em>{/if}.{#if !isReadOnly}
        &nbsp;This will also replace your current patch.{/if}
    </div>

    <Dialog.Footer class="flex gap-2">
      <button onclick={handleCancel} class="modal-action modal-action--secondary flex-1">
        Cancel
      </button>
      <button onclick={handleConfirm} class="modal-action modal-action--primary flex-1">
        Load
      </button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
