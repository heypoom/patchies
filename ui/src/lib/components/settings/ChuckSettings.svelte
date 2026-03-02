<script lang="ts">
  import { Trash, X } from '@lucide/svelte/icons';
  import type { ChuckShred } from '$lib/audio/v2/nodes/ChuckNode';

  let {
    shreds,
    onRemoveShred,
    onStopAll,
    onClose
  }: {
    shreds: ChuckShred[];
    onRemoveShred: (shredId: number) => void;
    onStopAll: () => void;
    onClose: () => void;
  } = $props();

  function handleClick(e: MouseEvent) {
    e.stopPropagation();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={handleClick}>
  <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
    <button onclick={onStopAll} class="rounded p-1 hover:bg-zinc-700">
      <Trash class="h-4 w-4 text-zinc-300" />
    </button>

    <button onclick={onClose} class="rounded p-1 hover:bg-zinc-700">
      <X class="h-4 w-4 text-zinc-300" />
    </button>
  </div>

  <div class="nodrag w-64 rounded-lg border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
    <div class="space-y-4">
      <div>
        {#if shreds.length === 0}
          <div class="text-xs text-zinc-500">No running shreds</div>
        {:else}
          <div class="space-y-2">
            {#each shreds as shred, index (index)}
              <div class="relative flex items-center justify-between">
                <div class="flex-1">
                  <div class="font-mono text-xs text-zinc-300">ID: {shred.id}</div>

                  <div class="text-xs text-zinc-500">
                    {shred.time}
                  </div>

                  <div class="mt-1 max-w-48 truncate font-mono text-xs text-zinc-400">
                    {shred.code.slice(0, 30)}
                  </div>
                </div>

                <div class="absolute top-0 right-0">
                  <button
                    onclick={() => onRemoveShred(shred.id)}
                    class="ml-2 rounded p-1 hover:bg-zinc-700"
                    title="Remove shred"
                  >
                    <X class="h-3 w-3 text-red-400" />
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
