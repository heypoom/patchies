<script lang="ts">
  import { onMount } from 'svelte';
  import { Play, Square, Music, SlidersHorizontal } from '@lucide/svelte/icons';
  import SearchBar from './SearchBar.svelte';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import { toast } from 'svelte-sonner';
  import { sampleSearchStore } from '$lib/sample-search/sample-search-store.svelte';
  import type { SampleResult } from '$lib/sample-search/types';

  const GROUP_INITIAL = 5;
  const ROW_H = 28; // px — all row types use the same height for simplicity
  const OVERSCAN = 4; // extra rows above/below viewport

  // ── row model ────────────────────────────────────────────────────────────────

  type HeaderRow = { type: 'header'; category: string; provider: string };
  type SampleRow = { type: 'sample'; result: SampleResult };
  type MoreRow = { type: 'more'; category: string; hidden: number; total: number };
  type Row = HeaderRow | SampleRow | MoreRow;

  let searchQuery = $state('');
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  let scrollTop = $state(0);
  let viewportHeight = $state(400);
  let scrollEl = $state<HTMLElement | null>(null);

  // Per-category expanded state: category key -> number of items shown
  let expandedGroups = $state(new Map<string, number>());

  // Reset expanded groups and scroll to top when query changes
  $effect(() => {
    searchQuery; // track
    expandedGroups = new Map();
    scrollTop = 0;
    scrollEl?.scrollTo({ top: 0 });
  });

  // Start loading indexes as soon as this component mounts
  onMount(() => {
    sampleSearchStore.loadIndexes();
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

  // Flat row list derived from results + expandedGroups
  const rows = $derived.by<Row[]>(() => {
    const out: Row[] = [];
    const groups = new Map<string, SampleResult[]>();
    for (const r of sampleSearchStore.results) {
      const key = r.category ?? '';
      const g = groups.get(key);
      if (g) g.push(r);
      else groups.set(key, [r]);
    }
    for (const [category, samples] of groups) {
      if (category) {
        out.push({ type: 'header', category, provider: samples[0].provider });
      }
      const limit = expandedGroups.get(category) ?? GROUP_INITIAL;
      const visible = samples.slice(0, limit);
      for (const s of visible) out.push({ type: 'sample', result: s });
      const hidden = samples.length - visible.length;
      if (hidden > 0) out.push({ type: 'more', category, hidden, total: samples.length });
    }
    return out;
  });

  // Virtual window
  const totalH = $derived(rows.length * ROW_H);
  const startIdx = $derived(Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN));
  const endIdx = $derived(
    Math.min(rows.length, Math.ceil((scrollTop + viewportHeight) / ROW_H) + OVERSCAN)
  );
  const visibleRows = $derived(rows.slice(startIdx, endIdx));
  const paddingTop = $derived(startIdx * ROW_H);
  const paddingBottom = $derived(Math.max(0, (rows.length - endIdx) * ROW_H));

  // Sticky header: last header row that is above or at the current scroll position
  const stickyHeader = $derived.by<HeaderRow | null>(() => {
    if (!rows.length) return null;
    const firstVisibleRow = Math.floor(scrollTop / ROW_H);
    let last: HeaderRow | null = null;
    for (let i = 0; i <= Math.min(firstVisibleRow, rows.length - 1); i++) {
      if (rows[i].type === 'header') last = rows[i] as HeaderRow;
    }
    return last;
  });

  function onScroll(e: Event) {
    const el = e.currentTarget as HTMLElement;
    scrollTop = el.scrollTop;
  }

  function onResize(el: HTMLElement) {
    const ro = new ResizeObserver(() => {
      viewportHeight = el.clientHeight;
    });
    ro.observe(el);
    viewportHeight = el.clientHeight;
    return { destroy: () => ro.disconnect() };
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
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }

  const PROVIDER_META: Record<string, { badge: string; label: string; color: string }> = {
    'tidal-drum-machines': {
      badge: 'TDM',
      label: 'Tidal Drum Machines (geikha)',
      color: 'text-cyan-400 bg-cyan-900/30'
    },
    'dough-samples': {
      badge: 'DS',
      label: 'Dough Samples (felixroos) — piano, EmuSP12, mridangam, VCSL, Dirt-Samples',
      color: 'text-purple-400 bg-purple-900/30'
    },
    spicule: {
      badge: 'SPC',
      label: 'Spicule (yaxu) — diverse drums, synths, foley, breaks',
      color: 'text-emerald-400 bg-emerald-900/30'
    },
    'clean-breaks': {
      badge: 'CLN',
      label: 'Clean Breaks (yaxu) — classic breakbeat loops',
      color: 'text-lime-400 bg-lime-900/30'
    },
    'estuary-samples': {
      badge: 'EST',
      label: 'Estuary Samples (felixroos) — world & acoustic instruments',
      color: 'text-amber-400 bg-amber-900/30'
    },
    'dough-fox': {
      badge: 'FOX',
      label: 'Dough Fox (Bubobubobubobubo) — drum machine hits & percussion',
      color: 'text-orange-400 bg-orange-900/30'
    },
    'dough-amen': {
      badge: 'AMN',
      label: 'Dough Amen (Bubobubobubobubo) — amen break loops',
      color: 'text-red-400 bg-red-900/30'
    },
    'dough-amiga': {
      badge: 'AMG',
      label: 'Dough Amiga (Bubobubobubobubo) — Amiga/chiptune samples',
      color: 'text-sky-400 bg-sky-900/30'
    },
    'dough-samples-bubo': {
      badge: 'DBB',
      label: 'Dough Samples (Bubobubobubobubo) — general purpose kit',
      color: 'text-violet-400 bg-violet-900/30'
    },
    'emptyflash-samples': {
      badge: 'EF',
      label: 'Emptyflash Samples — Legowelt & ER-1 drum machines',
      color: 'text-pink-400 bg-pink-900/30'
    }
  };

  function providerBadge(provider: string): string {
    return PROVIDER_META[provider]?.badge ?? provider.slice(0, 3).toUpperCase();
  }

  function providerLabel(provider: string): string {
    return PROVIDER_META[provider]?.label ?? provider;
  }

  function providerColor(provider: string): string {
    return PROVIDER_META[provider]?.color ?? 'text-zinc-400 bg-zinc-800';
  }

  function strudelName(result: SampleResult): string {
    const cat = result.category ?? result.name;
    const idx = result.index ?? 0;
    return idx === 0 ? `s("${cat}")` : `s("${cat}:${idx}")`;
  }

  async function copyAsStrudelName(result: SampleResult) {
    await navigator.clipboard.writeText(strudelName(result));
    toast.success('Copied to clipboard');
  }
</script>

<div class="flex h-full flex-col">
  <!-- Search input -->
  <SearchBar bind:value={searchQuery} placeholder="Search samples..." />

  <!-- Index loading progress bar -->
  {#if sampleSearchStore.isIndexLoading}
    {@const total = sampleSearchStore.providers.length}
    {@const loaded = sampleSearchStore.loadedCount}
    {@const pct = total > 0 ? (loaded / total) * 100 : 0}
    <div class="border-b border-zinc-800 px-3 py-1.5">
      <div class="mb-1 flex items-center justify-between">
        <span class="font-mono text-[9px] text-zinc-600">Loading indexes</span>
        <span class="font-mono text-[9px] text-zinc-500">{loaded}/{total}</span>
      </div>
      <div class="h-0.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          class="h-full rounded-full bg-zinc-500 transition-all duration-300"
          style="width: {pct}%"
        ></div>
      </div>
    </div>
  {/if}

  <!-- Results list -->
  <div class="relative flex-1 overflow-hidden">
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
    {:else if rows.length === 0}
      <div class="px-4 py-8 text-center text-xs text-zinc-500">
        No samples matching "{searchQuery}"
      </div>
    {:else}
      <!-- Sticky header overlay — always rendered on top when scrolled past a header -->
      {#if stickyHeader && scrollTop > 0}
        <div
          class="absolute top-0 right-0 left-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/95 px-2 backdrop-blur-sm"
          style="height: {ROW_H}px"
        >
          <span class="font-mono text-[10px] font-medium text-zinc-500"
            >{stickyHeader.category}</span
          >
          <span
            class="shrink-0 cursor-help rounded px-1 py-0.5 font-mono text-[9px] font-medium {providerColor(
              stickyHeader.provider
            )}"
            title={providerLabel(stickyHeader.provider)}
          >
            {providerBadge(stickyHeader.provider)}
          </span>
        </div>
      {/if}

      <!-- Scrollable virtual list -->
      <div class="h-full overflow-y-auto" onscroll={onScroll} bind:this={scrollEl} use:onResize>
        <!-- Total height spacer -->
        <div style="height: {totalH}px; position: relative;">
          <!-- Top padding -->
          <div style="height: {paddingTop}px"></div>

          {#each visibleRows as row (row.type === 'sample' ? row.result.id : row.type === 'header' ? `h:${row.category}` : `m:${row.category}`)}
            {#if row.type === 'header'}
              <div
                class="flex items-center justify-between border-b border-zinc-800 px-2"
                style="height: {ROW_H}px"
              >
                <span class="font-mono text-[10px] font-medium text-zinc-500">{row.category}</span>
                <span
                  class="shrink-0 cursor-help rounded px-1 py-0.5 font-mono text-[9px] font-medium {providerColor(
                    row.provider
                  )}"
                  title={providerLabel(row.provider)}
                >
                  {providerBadge(row.provider)}
                </span>
              </div>
            {:else if row.type === 'sample'}
              {@const isPlaying = sampleSearchStore.playingId === row.result.id}
              <ContextMenu.Root>
                <ContextMenu.Trigger>
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="group flex w-full cursor-pointer items-center gap-1.5 pr-1 pl-4 text-xs hover:bg-zinc-800"
                    style="height: {ROW_H}px"
                    draggable="true"
                    ondragstart={(e) => handleDragStart(e, row.result)}
                  >
                    <button
                      class="shrink-0 cursor-pointer rounded p-0.5 text-zinc-500 hover:text-zinc-200 {isPlaying
                        ? 'text-blue-400 hover:text-blue-300'
                        : ''}"
                      title={isPlaying ? 'Stop preview' : 'Preview'}
                      onclick={() => sampleSearchStore.togglePreview(row.result)}
                    >
                      {#if isPlaying}
                        <Square class="h-3 w-3" />
                      {:else}
                        <Play class="h-3 w-3" />
                      {/if}
                    </button>
                    <span class="flex-1 truncate font-mono text-zinc-300" title={row.result.name}>
                      {row.result.name}
                    </span>
                  </div>
                </ContextMenu.Trigger>
                <ContextMenu.Content>
                  <ContextMenu.Item onclick={() => copyAsStrudelName(row.result)}>
                    Copy as Strudel name
                  </ContextMenu.Item>
                </ContextMenu.Content>
              </ContextMenu.Root>
            {:else if row.type === 'more'}
              <div class="flex items-center gap-2 pr-2 pl-4" style="height: {ROW_H}px">
                <button
                  class="cursor-pointer font-mono text-[10px] text-zinc-500 hover:text-zinc-300"
                  onclick={() => showMore(row.category, row.total)}
                >
                  +{row.hidden > 20 ? 20 : row.hidden} more
                </button>
                {#if row.hidden > 20}
                  <button
                    class="cursor-pointer font-mono text-[10px] text-zinc-600 hover:text-zinc-400"
                    onclick={() => showAll(row.category, row.total)}
                  >
                    show all {row.total}
                  </button>
                {/if}
              </div>
            {/if}
          {/each}

          <!-- Bottom padding -->
          <div style="height: {paddingBottom}px"></div>
        </div>
      </div>
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
