<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import type { VfsCollisionStrategy } from '$lib/vfs/VirtualFilesystem';

  let {
    open = $bindable(false),
    paths,
    onChoose
  }: {
    open: boolean;
    paths: string[];
    onChoose: (strategy: VfsCollisionStrategy) => void;
  } = $props();

  function choose(strategy: VfsCollisionStrategy) {
    onChoose(strategy);
    open = false;
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && open) onChoose('cancel');

    open = nextOpen;
  }
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
  <Dialog.Content class="max-w-md border-zinc-700 bg-zinc-900">
    <Dialog.Header>
      <Dialog.Title>Files already exist</Dialog.Title>
      <Dialog.Description class="text-left text-zinc-400">
        Choose how to handle {paths.length === 1
          ? 'this collision'
          : `these ${paths.length} collisions`}.
      </Dialog.Description>
    </Dialog.Header>

    <div class="max-h-40 overflow-y-auto rounded border border-zinc-800 bg-zinc-950/50 p-2">
      {#each paths as path (path)}
        <div class="truncate font-mono text-xs text-zinc-300">{path}</div>
      {/each}
    </div>

    <Dialog.Footer class="flex gap-2">
      <button
        class="modal-action modal-action--secondary cursor-pointer"
        onclick={() => choose('cancel')}
      >
        Cancel
      </button>
      <button
        class="modal-action modal-action--secondary cursor-pointer"
        onclick={() => choose('keep-both')}
      >
        Keep Both
      </button>
      <button
        class="modal-action modal-action--primary cursor-pointer"
        onclick={() => choose('replace')}
      >
        Replace
      </button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
