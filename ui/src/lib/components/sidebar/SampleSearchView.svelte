<script lang="ts">
  import { Play, Square, Music } from '@lucide/svelte/icons';
  import SearchBar from './SearchBar.svelte';
  import { sampleSearchStore } from '$lib/sample-search/sample-search-store.svelte';
  import type { SampleResult } from '$lib/sample-search/types';

  const GROUP_INITIAL = 5;

  let searchQuery = $state('');
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  // Per-category expanded state: category key -> number of items shown
  let expandedGroups = $state(new Map<string, number>());

  // Reset expanded groups when query changes
  $effect(() => {
    searchQuery; // track
    expandedGroups = new Map();
  });

  // Debounced search — fires 300ms after user stops typing
  $effect(() => {
    const q = searchQuery;
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      sampleSearchStore.search(q);
    }, 300);
    return () => {
      if (searchTimeout) clearTimeout(searchTimeout);
    };
  });

  // Group results by category, preserving insertion order
  const groupedResults = $derived.by(() => {
    const groups = new Map<string, SampleResult[]>();
    for (const result of sampleSearchStore.results) {
      const key = result.category ?? '';
      const group = groups.get(key);
      if (group) {
        group.push(result);
      } else {
        groups.set(key, [result]);
      }
    }
    return groups;
  });

  function visibleSamples(category: string, samples: SampleResult[]): SampleResult[] {
    const limit = expandedGroups.get(category) ?? GROUP_INITIAL;
    return samples.slice(0, limit);
  }

  function showMore(category: string, total: number) {
    const current = expandedGroups.get(category) ?? GROUP_INITIAL;
    expandedGroups.set(category, Math.min(current + 20, total));
    expandedGroups = new Map(expandedGroups);
  }

  function showAll(category: string, total: number) {
    expandedGroups.set(category, total);
    expandedGroups = new Map(expandedGroups);
  }

  function handleDragStart(event: DragEvent, result: SampleResult) {
    const payload = JSON.stringify({ url: result.url, name: result.name });
    event.dataTransfer?.setData('application/x-sample-url', payload);
    event.dataTransfer?.setData('text/plain', result.name);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
    }
  }

  /** Short badge label from provider id */
  function providerBadge(provider: string): string {
    if (provider === 'tidal-drum-machines') return 'TDM';
    if (provider === 'dough-samples') return 'DS';
    return provider.slice(0, 3).toUpperCase();
  }

  /** Badge color per provider */
  function providerColor(provider: string): string {
    if (provider === 'tidal-drum-machines') return 'text-cyan-400 bg-cyan-900/30';
    if (provider === 'dough-samples') return 'text-purple-400 bg-purple-900/30';
    return 'text-zinc-400 bg-zinc-800';
  }
</script>

<div class="flex h-full flex-col">
  <!-- Search input -->
  <SearchBar bind:value={searchQuery} placeholder="Search samples..." />

  <!-- Results list -->
  <div class="flex-1 overflow-y-auto">
    {#if sampleSearchStore.isLoading}
      <div class="px-4 py-8 text-center text-xs text-zinc-500">Loading...</div>
    {:else if sampleSearchStore.error}
      <div class="px-4 py-6 text-center text-xs text-red-400">
        {sampleSearchStore.error}
      </div>
    {:else if !searchQuery.trim()}
      <div class="flex flex-col items-center gap-2 px-4 py-12 text-center text-xs text-zinc-600">
        <Music class="h-6 w-6 opacity-40" />
        <span>Type to search samples</span>
      </div>
    {:else if sampleSearchStore.results.length === 0}
      <div class="px-4 py-8 text-center text-xs text-zinc-500">
        No samples matching "{searchQuery}"
      </div>
    {:else}
      {#each groupedResults as [category, samples]}
        {@const visible = visibleSamples(category, samples)}
        {@const hidden = samples.length - visible.length}

        <!-- Sticky category header -->
        {#if category}
          <div
            class="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/95 px-2 py-0.5 backdrop-blur-sm"
          >
            <span class="font-mono text-[10px] font-medium text-zinc-500">{category}</span>
            <span
              class="shrink-0 rounded px-1 py-0.5 font-mono text-[9px] font-medium {providerColor(
                samples[0].provider
              )}"
            >
              {providerBadge(samples[0].provider)}
            </span>
          </div>
        {/if}

        {#each visible as result (result.id)}
          {@const isPlaying = sampleSearchStore.playingId === result.id}

          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="group flex w-full cursor-pointer items-center gap-1.5 py-1 pr-1 pl-4 text-xs hover:bg-zinc-800"
            draggable="true"
            ondragstart={(e) => handleDragStart(e, result)}
          >
            <!-- Play/stop button -->
            <button
              class="shrink-0 cursor-pointer rounded p-0.5 text-zinc-500 hover:text-zinc-200 {isPlaying
                ? 'text-blue-400 hover:text-blue-300'
                : ''}"
              onclick={() => sampleSearchStore.togglePreview(result)}
              title={isPlaying ? 'Stop preview' : 'Preview'}
            >
              {#if isPlaying}
                <Square class="h-3 w-3" />
              {:else}
                <Play class="h-3 w-3" />
              {/if}
            </button>

            <!-- Sample name -->
            <span class="flex-1 truncate font-mono text-zinc-300" title={result.name}>
              {result.name}
            </span>
          </div>
        {/each}

        <!-- "X more" expand row -->
        {#if hidden > 0}
          <div class="flex items-center gap-2 py-0.5 pr-2 pl-4">
            <button
              class="cursor-pointer font-mono text-[10px] text-zinc-500 hover:text-zinc-300"
              onclick={() => showMore(category, samples.length)}
            >
              +{hidden > 20 ? 20 : hidden} more
            </button>
            {#if hidden > 20}
              <button
                class="cursor-pointer font-mono text-[10px] text-zinc-600 hover:text-zinc-400"
                onclick={() => showAll(category, samples.length)}
              >
                show all {samples.length}
              </button>
            {/if}
          </div>
        {/if}
      {/each}
    {/if}
  </div>

  <!-- Footer: result count -->
  {#if sampleSearchStore.results.length > 0}
    <div
      class="border-t border-zinc-800 px-3 py-1.5 text-[10px] text-zinc-600"
      style="padding-bottom: calc(0.375rem + env(safe-area-inset-bottom, 0px))"
    >
      {sampleSearchStore.results.length} result{sampleSearchStore.results.length === 1 ? '' : 's'}
    </div>
  {/if}
</div>
