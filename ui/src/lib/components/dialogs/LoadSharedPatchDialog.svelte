<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';

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

  let hasApiKey = $derived(open && !!localStorage.getItem('gemini-api-key'));

  function handleCancel() {
    onCancel();
    open = false;
  }

  function handleConfirm() {
    onConfirm();
    open = false;
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Load Shared Patch</Dialog.Title>
      <Dialog.Description class="text-left">
        {#if patchName}
          You're about to load "{patchName}".
        {:else}
          You're about to load a shared patch.
        {/if}
      </Dialog.Description>
    </Dialog.Header>

    <div
      class="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
    >
      <strong>Warning:</strong> Patches run un-sandboxed code. A malicious patch could execute
      arbitrary code, redirect you, or steal data{#if hasApiKey}
        &nbsp;including your <em>Gemini API key</em>{/if}.{#if !isReadOnly}
        &nbsp;This will also replace your current patch.{/if}
    </div>

    <Dialog.Footer class="flex gap-2">
      <button
        onclick={handleCancel}
        class="flex-1 cursor-pointer rounded bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-600"
      >
        Cancel
      </button>
      <button
        onclick={handleConfirm}
        class="flex-1 cursor-pointer rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
      >
        Load
      </button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
