<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import type { UnsavedChangesDecision } from '$lib/vfs/PatchFileEditorSession';

  let {
    open = $bindable(false),
    path,
    onChoose
  }: {
    open: boolean;
    path: string;
    onChoose: (decision: UnsavedChangesDecision) => void;
  } = $props();

  function choose(decision: UnsavedChangesDecision) {
    open = false;
    onChoose(decision);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && open) onChoose('cancel');

    open = nextOpen;
  }
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
  <Dialog.Content class="max-w-md border-zinc-700 bg-zinc-900">
    <Dialog.Header>
      <Dialog.Title>Save changes?</Dialog.Title>
      <Dialog.Description class="text-left text-zinc-400">
        <span class="font-mono text-zinc-300">{path}</span> has unsaved changes.
      </Dialog.Description>
    </Dialog.Header>

    <Dialog.Footer class="flex gap-2">
      <button
        class="modal-action modal-action--secondary cursor-pointer"
        onclick={() => choose('cancel')}
      >
        Cancel
      </button>
      <button
        class="modal-action modal-action--secondary cursor-pointer"
        onclick={() => choose('discard')}
      >
        Discard
      </button>
      <button
        class="modal-action modal-action--primary cursor-pointer"
        onclick={() => choose('save')}
      >
        Save
      </button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
