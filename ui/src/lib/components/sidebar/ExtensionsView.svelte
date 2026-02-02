<script lang="ts">
  import { Package } from '@lucide/svelte/icons';
  import ExtensionPackCard from './ExtensionPackCard.svelte';
  import {
    BUILT_IN_PACKS,
    enabledPackIds,
    enabledObjects,
    togglePack,
    enableAllPacks,
    disableAllPacks,
    isPackEnabled
  } from '../../../stores/extensions.store';

  // Total number of unique objects across all packs
  const totalObjectCount = $derived.by(() => {
    const allObjects = new Set<string>();
    for (const pack of BUILT_IN_PACKS) {
      for (const obj of pack.objects) {
        allObjects.add(obj);
      }
    }
    return allObjects.size;
  });

  const enabledCount = $derived($enabledObjects.size);
  const allEnabled = $derived($enabledPackIds.length === BUILT_IN_PACKS.length);
</script>

<div class="flex h-full flex-col">
  <!-- Header with stats -->
  <div class="border-b border-zinc-800 px-3 py-3">
    <div class="mb-2 flex items-center gap-2">
      <Package class="h-4 w-4 text-zinc-400" />
      <span class="text-sm font-medium text-zinc-300">Extensions</span>
    </div>

    <div class="flex items-center justify-between text-xs text-zinc-500">
      <span>
        <span class="text-zinc-300">{enabledCount}</span>
        of {totalObjectCount} objects enabled
      </span>

      <div class="flex gap-1">
        {#if allEnabled}
          <button
            onclick={disableAllPacks}
            class="cursor-pointer rounded px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
          >
            Reset
          </button>
        {:else}
          <button
            onclick={enableAllPacks}
            class="cursor-pointer rounded bg-zinc-700 px-2 py-1 text-zinc-200 hover:bg-zinc-600"
          >
            Enable All
          </button>
        {/if}
      </div>
    </div>
  </div>

  <!-- Pack list -->
  <div class="flex-1 space-y-2 overflow-y-auto p-3">
    {#each BUILT_IN_PACKS as pack (pack.id)}
      <ExtensionPackCard
        {pack}
        enabled={isPackEnabled(pack.id, $enabledPackIds)}
        onToggle={() => togglePack(pack.id)}
      />
    {/each}
  </div>

  <!-- Footer hint -->
  <div class="border-t border-zinc-800 px-3 py-2 text-center text-[10px] text-zinc-600">
    Enabled objects appear in autocomplete and browser
  </div>
</div>
