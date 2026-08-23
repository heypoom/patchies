<script lang="ts">
  import SearchBar from './SearchBar.svelte';
  import PackCollectionsTree from './PackCollectionsTree.svelte';
  import {
    disableAllPacks,
    disableAllPresetPacks,
    enableAllPacks,
    enableAllPresetPacks
  } from '../../../stores/extensions.store';

  let searchQuery = $state('');

  function enableEverything() {
    enableAllPacks();
    enableAllPresetPacks();
  }

  function resetLibrary() {
    disableAllPacks();
    disableAllPresetPacks();
  }
</script>

<div class="flex h-full flex-col">
  <div class="shrink-0 border-b border-white/6 p-2">
    <SearchBar
      bind:value={searchQuery}
      placeholder="Search collections, packs, objects & presets..."
    />
    <div class="mt-2 flex items-center justify-between gap-2 px-1">
      <p class="text-[10px] text-zinc-500">Choose what you want to make, then fine-tune packs.</p>
      <div class="flex shrink-0 items-center gap-1">
        <button
          onclick={resetLibrary}
          class="cursor-pointer rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
        >
          Reset
        </button>
        <button
          onclick={enableEverything}
          class="cursor-pointer rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-200 hover:bg-zinc-600"
        >
          All
        </button>
      </div>
    </div>
  </div>

  <div class="flex-1 overflow-y-auto p-2">
    <PackCollectionsTree {searchQuery} />
  </div>
</div>
