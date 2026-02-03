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
      <button
        onclick={() => (open = false)}
        class="flex-1 cursor-pointer rounded bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-600"
      >
        Cancel
      </button>
      <button
        onclick={handleConfirm}
        class="flex-1 cursor-pointer rounded bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
      >
        New Patch
      </button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
