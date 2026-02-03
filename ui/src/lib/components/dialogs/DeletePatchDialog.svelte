<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';

  let {
    open = $bindable(false),
    patchName,
    onConfirm
  }: {
    open: boolean;
    patchName: string | null;
    onConfirm: () => void;
  } = $props();

  function handleCancel() {
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
      <Dialog.Title>Delete Patch</Dialog.Title>
      <Dialog.Description>
        Are you sure you want to delete "{patchName}"? This action cannot be undone.
      </Dialog.Description>
    </Dialog.Header>

    <Dialog.Footer class="flex gap-2">
      <button
        onclick={handleCancel}
        class="flex-1 cursor-pointer rounded bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-600"
      >
        Cancel
      </button>
      <button
        onclick={handleConfirm}
        class="flex-1 cursor-pointer rounded bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
      >
        Delete
      </button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
