<script lang="ts">
  import { Trash, X } from '@lucide/svelte/icons';
  import type { ChuckShred } from '$objects/chuck~/ChuckNode';
  import * as Tooltip from '$lib/components/ui/tooltip';

  let {
    shreds,
    onRemoveShred,
    onStopAll,
    onClose = undefined,
    showCloseButton = true,
    showHeaderActions = true
  }: {
    shreds: ChuckShred[];
    onRemoveShred: (shredId: number) => void;
    onStopAll: () => void;
    onClose?: () => void;
    showCloseButton?: boolean;
    showHeaderActions?: boolean;
  } = $props();

  function handleClick(e: MouseEvent) {
    e.stopPropagation();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={handleClick}>
  {#if showHeaderActions}
    <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            onclick={onStopAll}
            class="cursor-pointer rounded p-1 hover:bg-zinc-700"
            type="button"
            aria-label="Stop all shreds"
          >
            <Trash class="h-4 w-4 text-zinc-300" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content>Stop all shreds</Tooltip.Content>
      </Tooltip.Root>

      {#if showCloseButton && onClose}
        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              onclick={onClose}
              class="cursor-pointer rounded p-1 hover:bg-zinc-700"
              type="button"
              aria-label="Close settings"
            >
              <X class="h-4 w-4 text-zinc-300" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content>Close settings</Tooltip.Content>
        </Tooltip.Root>
      {/if}
    </div>
  {/if}

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
                  <Tooltip.Root>
                    <Tooltip.Trigger>
                      <button
                        onclick={() => onRemoveShred(shred.id)}
                        class="ml-2 cursor-pointer rounded p-1 hover:bg-zinc-700"
                        type="button"
                        aria-label={`Remove shred ${shred.id}`}
                      >
                        <X class="h-3 w-3 text-red-400" />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Content>Remove shred</Tooltip.Content>
                  </Tooltip.Root>
                </div>
              </div>
            {/each}

            {#if !showHeaderActions}
              <div class="flex justify-end border-t border-zinc-800 pt-3">
                <Tooltip.Root>
                  <Tooltip.Trigger>
                    <button
                      onclick={onStopAll}
                      class="flex cursor-pointer items-center gap-1 rounded border border-red-500/30 px-2 py-1 text-xs text-red-300 hover:bg-red-950/40"
                    >
                      <Trash class="h-3 w-3" />
                      Stop all
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Stop all shreds</Tooltip.Content>
                </Tooltip.Root>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
