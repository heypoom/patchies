<script lang="ts">
  import { Play, Square, Music, SlidersHorizontal } from '@lucide/svelte/icons';
  import SearchBar from './SearchBar.svelte';
  import * as Popover from '$lib/components/ui/popover/index.js';
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
    if (provider === 'spicule') return 'SPC';
    if (provider === 'clean-breaks') return 'CLN';
    if (provider === 'estuary-samples') return 'EST';
    if (provider === 'dough-fox') return 'FOX';
    if (provider === 'dough-amen') return 'AMN';
    if (provider === 'dough-amiga') return 'AMG';
    if (provider === 'dough-samples-bubo') return 'DBB';
    if (provider === 'emptyflash-samples') return 'EF';
    return provider.slice(0, 3).toUpperCase();
  }

  /** Full provider name for tooltip */
  function providerLabel(provider: string): string {
    if (provider === 'tidal-drum-machines') return 'Tidal Drum Machines (geikha)';
    if (provider === 'dough-samples')
      return 'Dough Samples (felixroos) — piano, EmuSP12, mridangam, VCSL, Dirt-Samples';
    if (provider === 'spicule') return 'Spicule (yaxu) — diverse drums, synths, foley, breaks';
    if (provider === 'clean-breaks') return 'Clean Breaks (yaxu) — classic breakbeat loops';
    if (provider === 'estuary-samples')
      return 'Estuary Samples (felixroos) — world & acoustic instruments';
    if (provider === 'dough-fox')
      return 'Dough Fox (Bubobubobubobubo) — drum machine hits & percussion';
    if (provider === 'dough-amen') return 'Dough Amen (Bubobubobubobubo) — amen break loops';
    if (provider === 'dough-amiga')
      return 'Dough Amiga (Bubobubobubobubo) — Amiga/chiptune samples';
    if (provider === 'dough-samples-bubo')
      return 'Dough Samples (Bubobubobubobubo) — general purpose kit';
    if (provider === 'emptyflash-samples')
      return 'Emptyflash Samples — Legowelt & ER-1 drum machines';
    return provider;
  }

  /** Badge color per provider */
  function providerColor(provider: string): string {
    if (provider === 'tidal-drum-machines') return 'text-cyan-400 bg-cyan-900/30';
    if (provider === 'dough-samples') return 'text-purple-400 bg-purple-900/30';
    if (provider === 'spicule') return 'text-emerald-400 bg-emerald-900/30';
    if (provider === 'clean-breaks') return 'text-lime-400 bg-lime-900/30';
    if (provider === 'estuary-samples') return 'text-amber-400 bg-amber-900/30';
    if (provider === 'dough-fox') return 'text-orange-400 bg-orange-900/30';
    if (provider === 'dough-amen') return 'text-red-400 bg-red-900/30';
    if (provider === 'dough-amiga') return 'text-sky-400 bg-sky-900/30';
    if (provider === 'dough-samples-bubo') return 'text-violet-400 bg-violet-900/30';
    if (provider === 'emptyflash-samples') return 'text-pink-400 bg-pink-900/30';
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
              class="shrink-0 cursor-help rounded px-1 py-0.5 font-mono text-[9px] font-medium {providerColor(
                samples[0].provider
              )}"
              title={providerLabel(samples[0].provider)}
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

  <!-- Footer: result count + filter -->
  <div
    class="flex items-center justify-between border-t border-zinc-800 px-3 py-1.5"
    style="padding-bottom: calc(0.375rem + env(safe-area-inset-bottom, 0px))"
  >
    <span class="text-[10px] text-zinc-600">
      {#if sampleSearchStore.results.length > 0}
        {sampleSearchStore.results.length} result{sampleSearchStore.results.length === 1 ? '' : 's'}
      {/if}
    </span>
    <Popover.Root>
      <Popover.Trigger>
        {#snippet child({ props })}
          {@const total = sampleSearchStore.providers.length}
          {@const enabled = sampleSearchStore.enabledProviders.size}
          <button
            {...props}
            class="relative cursor-pointer rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 {enabled <
            total
              ? 'text-blue-400'
              : ''}"
            title="Filter sources"
          >
            <SlidersHorizontal class="h-3 w-3" />
            {#if enabled < total}
              <span
                class="absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-blue-500 font-mono text-[7px] text-white"
                >{enabled}</span
              >
            {/if}
          </button>
        {/snippet}
      </Popover.Trigger>
      <Popover.Content class="w-48 p-2" align="end" side="top">
        <p
          class="mb-1.5 px-1 font-mono text-[9px] font-medium tracking-wider text-zinc-500 uppercase"
        >
          Sources
        </p>
        <div class="flex flex-col gap-0.5">
          {#each sampleSearchStore.providers as provider}
            {@const enabled = sampleSearchStore.enabledProviders.has(provider.id)}
            <button
              class="flex w-full cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-zinc-800 {enabled
                ? ''
                : 'opacity-40'}"
              onclick={() => sampleSearchStore.toggleProvider(provider.id)}
            >
              <span
                class="shrink-0 rounded px-1 py-0.5 font-mono text-[9px] font-medium {providerColor(
                  provider.id
                )}">{providerBadge(provider.id)}</span
              >
              <span class="truncate font-mono text-[10px] text-zinc-300">{provider.name}</span>
            </button>
          {/each}
        </div>
      </Popover.Content>
    </Popover.Root>
  </div>
</div>
