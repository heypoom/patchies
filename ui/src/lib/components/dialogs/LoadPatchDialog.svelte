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
      <Dialog.Title>Load Patch</Dialog.Title>
      <Dialog.Description>
        Loading "{patchName}" will replace your current patch.
      </Dialog.Description>
    </Dialog.Header>

    <div
      class="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
    >
      Any unsaved changes will be lost.
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
