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
      <button onclick={handleCancel} class="modal-action modal-action--secondary flex-1">
        Cancel
      </button>
      <button onclick={handleConfirm} class="modal-action modal-action--destructive flex-1">
        Delete
      </button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
