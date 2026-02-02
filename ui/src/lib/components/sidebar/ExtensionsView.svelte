<script lang="ts">
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
  <div class="border-b border-zinc-800 px-2 py-2">
    <div class="flex items-center justify-between">
      <span class="text-[10px] text-zinc-500">
        <span class="text-zinc-300">{enabledCount}</span>/{totalObjectCount} objects
      </span>

      {#if allEnabled}
        <button
          onclick={disableAllPacks}
          class="cursor-pointer rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
        >
          Reset
        </button>
      {:else}
        <button
          onclick={enableAllPacks}
          class="cursor-pointer rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-200 hover:bg-zinc-600"
        >
          Enable All
        </button>
      {/if}
    </div>
  </div>

  <!-- Pack list -->
  <div class="flex-1 space-y-1.5 overflow-y-auto p-2">
    {#each BUILT_IN_PACKS as pack (pack.id)}
      <ExtensionPackCard
        {pack}
        enabled={isPackEnabled(pack.id, $enabledPackIds)}
        onToggle={() => togglePack(pack.id)}
      />
    {/each}
  </div>
</div>
