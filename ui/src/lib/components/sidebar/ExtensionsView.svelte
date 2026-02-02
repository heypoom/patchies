<script lang="ts">
  import { Search, X } from '@lucide/svelte/icons';
  import ExtensionPackCard from './ExtensionPackCard.svelte';
  import PresetPackCard from './PresetPackCard.svelte';
  import {
    BUILT_IN_PACKS,
    BUILT_IN_PRESET_PACKS,
    enabledPackIds,
    enabledPresetPackIds,
    enabledObjects,
    togglePack,
    togglePresetPack,
    enableAllPacks,
    enableAllPresetPacks,
    disableAllPacks,
    disableAllPresetPacks,
    isPackEnabled,
    isPresetPackEnabled
  } from '../../../stores/extensions.store';

  let searchQuery = $state('');

  // Filter packs based on search query
  const filteredObjectPacks = $derived.by(() => {
    if (!searchQuery.trim()) return BUILT_IN_PACKS;

    const query = searchQuery.toLowerCase();
    return BUILT_IN_PACKS.filter(
      (pack) =>
        pack.name.toLowerCase().includes(query) ||
        pack.description.toLowerCase().includes(query) ||
        pack.objects.some((obj) => obj.toLowerCase().includes(query))
    );
  });

  const filteredPresetPacks = $derived.by(() => {
    if (!searchQuery.trim()) return BUILT_IN_PRESET_PACKS;

    const query = searchQuery.toLowerCase();
    return BUILT_IN_PRESET_PACKS.filter(
      (pack) =>
        pack.name.toLowerCase().includes(query) ||
        pack.description.toLowerCase().includes(query) ||
        pack.presets.some((preset) => preset.toLowerCase().includes(query))
    );
  });

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
  const allObjectPacksEnabled = $derived($enabledPackIds.length === BUILT_IN_PACKS.length);
  const allPresetPacksEnabled = $derived(
    $enabledPresetPackIds.length === BUILT_IN_PRESET_PACKS.length
  );
</script>

<div class="flex h-full flex-col">
  <!-- Search bar -->
  <div class="border-b border-zinc-800 p-2">
    <div class="relative">
      <Search class="absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2 text-zinc-500" />
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search packs..."
        class="w-full rounded border border-zinc-700 bg-zinc-900 py-1.5 pr-6 pl-7 text-[11px] text-zinc-200 placeholder-zinc-500 outline-none focus:border-zinc-600"
      />
      {#if searchQuery}
        <button
          onclick={() => (searchQuery = '')}
          class="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-zinc-500 hover:text-zinc-300"
        >
          <X class="h-3 w-3" />
        </button>
      {/if}
    </div>
  </div>

  <!-- Pack list -->
  <div class="flex-1 space-y-4 overflow-y-auto p-2">
    <!-- Object Packs Section -->
    {#if filteredObjectPacks.length > 0}
      <div>
        <div class="mb-2 flex items-center justify-between">
          <span class="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
            Object Packs
          </span>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-zinc-600">
              {enabledCount}/{totalObjectCount}
            </span>
            {#if allObjectPacksEnabled}
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
                All
              </button>
            {/if}
          </div>
        </div>
        <div class="space-y-1.5">
          {#each filteredObjectPacks as pack (pack.id)}
            <ExtensionPackCard
              {pack}
              enabled={isPackEnabled(pack.id, $enabledPackIds)}
              onToggle={() => togglePack(pack.id)}
            />
          {/each}
        </div>
      </div>
    {/if}

    <!-- Preset Packs Section -->
    {#if filteredPresetPacks.length > 0}
      <div>
        <div class="mb-2 flex items-center justify-between">
          <span class="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
            Preset Packs
          </span>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-zinc-600">
              {$enabledPresetPackIds.length}/{BUILT_IN_PRESET_PACKS.length}
            </span>
            {#if allPresetPacksEnabled}
              <button
                onclick={disableAllPresetPacks}
                class="cursor-pointer rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              >
                Reset
              </button>
            {:else}
              <button
                onclick={enableAllPresetPacks}
                class="cursor-pointer rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-200 hover:bg-zinc-600"
              >
                All
              </button>
            {/if}
          </div>
        </div>
        <div class="space-y-1.5">
          {#each filteredPresetPacks as pack (pack.id)}
            <PresetPackCard
              {pack}
              enabled={isPresetPackEnabled(pack.id, $enabledPresetPackIds)}
              onToggle={() => togglePresetPack(pack.id)}
            />
          {/each}
        </div>
      </div>
    {/if}

    <!-- No results -->
    {#if filteredObjectPacks.length === 0 && filteredPresetPacks.length === 0}
      <div class="py-8 text-center text-[11px] text-zinc-500">
        No packs match "{searchQuery}"
      </div>
    {/if}
  </div>
</div>
