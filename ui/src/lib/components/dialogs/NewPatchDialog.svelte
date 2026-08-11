<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';

  let {
    open = $bindable(false),
    onConfirm
  }: {
    open: boolean;
    onConfirm: () => void;
  } = $props();

  function handleConfirm() {
    open = false;
    onConfirm();
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Create New Patch?</Dialog.Title>
    </Dialog.Header>
    <div class="space-y-4">
      <p class="text-sm text-zinc-300">
        Are you sure you want to create a new patch? All unsaved changes will be lost!
      </p>

      <p class="text-xs text-zinc-400">
        💡 Use <kbd class="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-xs">Ctrl/Cmd + S</kbd>
        to save current patch.
      </p>
    </div>
    <Dialog.Footer class="flex gap-2">
      <button onclick={() => (open = false)} class="modal-action modal-action--secondary flex-1">
        Cancel
      </button>
      <button onclick={handleConfirm} class="modal-action modal-action--destructive flex-1">
        New Patch
      </button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
