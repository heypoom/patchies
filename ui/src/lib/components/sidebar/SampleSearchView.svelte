<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import {
    Play,
    Square,
    Music,
    SlidersHorizontal,
    Volume2,
    Headphones,
    Tag,
    Plus,
    Copy,
    Ellipsis
  } from '@lucide/svelte/icons';
  import SearchBar from './SearchBar.svelte';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { toast } from 'svelte-sonner';
  import {
    sampleSearchStore,
    freesoundProvider
  } from '$lib/sample-search/sample-search-store.svelte';
  import { sampleTagsStore, getTagColor } from '$lib/sample-search/sample-tags.store.svelte';
  import { freesoundKeyStore } from '$lib/sample-search/freesound-key.store.svelte';
  import type { SampleResult } from '$lib/sample-search/types';
  import { isMobile, isSidebarOpen } from '../../../stores/ui.store';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import { PROVIDER_META, SAMPLE_VIEW_MAX_PRELOAD } from '$lib/sample-search/constants';
  import { match } from 'ts-pattern';

  const eventBus = PatchiesEventBus.getInstance();

  const GROUP_INITIAL = 5;
  const ROW_H = 28; // px — all row types use the same height for simplicity
  const OVERSCAN = 4; // extra rows above/below viewport

  // ── row model ────────────────────────────────────────────────────────────────

  type HeaderRow = { type: 'header'; category: string; provider: string };
  type SampleRow = { type: 'sample'; result: SampleResult };
  type MoreRow = { type: 'more'; category: string; hidden: number; total: number };
  type FetchMoreRow = { type: 'fetch-more'; provider: string };
  type Row = HeaderRow | SampleRow | MoreRow | FetchMoreRow;

  let searchQuery = $state('');
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  let scrollTop = $state(0);
  let viewportHeight = $state(400);
  let scrollElement = $state<HTMLElement | null>(null);

  // Per-category expanded state: category key -> number of items shown
  let expandedGroups = new SvelteMap<string, number>();

  // New tag input — shared across all open context menus (only one can be open at a time)
  let newTagInput = $state('');

  // Freesound setup: enabled but no API key yet
  const freesoundEnabled = $derived(sampleSearchStore.enabledProviders.has('freesound'));
  const freesoundNeedsSetup = $derived(freesoundEnabled && !freesoundKeyStore.hasKey);

  // Inline key input state
  let freesoundKeyInput = $state('');

  function saveFreesoundKey() {
    freesoundKeyStore.setApiKey(freesoundKeyInput);
    freesoundKeyInput = '';
    // Re-run search so Freesound results load immediately
    if (searchQuery.trim()) sampleSearchStore.search(searchQuery);
  }

  // Tag search mode: query starts with '#'
  const isTagMode = $derived(searchQuery.startsWith('#'));
  const tagQuery = $derived(isTagMode ? searchQuery.slice(1) : '');

  // Active results: tag search or normal provider search
  const activeResults = $derived(
    isTagMode ? sampleTagsStore.getSamplesByTag(tagQuery) : sampleSearchStore.results
  );

  // Mobile state
  let mobileSelectedSample = $state<SampleResult | null>(null);
  let mobileMoreOpen = $state(false);

  // Reset expanded groups and scroll to top when query changes
  $effect(() => {
    void searchQuery; // track

    expandedGroups.clear();
    scrollTop = 0;
    scrollElement?.scrollTo({ top: 0 });
  });

  // Start loading indexes as soon as this component mounts
  onMount(() => {
    sampleSearchStore.loadIndexes();
  });

  // Debounced search — fires 300ms after user stops typing (skipped in tag mode)
  $effect(() => {
    const q = searchQuery;
    if (searchTimeout) clearTimeout(searchTimeout);
    if (q.startsWith('#')) return;
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
    const groups = new SvelteMap<string, SampleResult[]>();

    for (const r of activeResults) {
      const key = r.category ?? '';
      const g = groups.get(key);

      if (g) {
        g.push(r);
      } else {
        groups.set(key, [r]);
      }
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

    // Append a load-more row for Freesound when there are more pages
    if (freesoundProvider.hasMore() && !isTagMode) {
      out.push({ type: 'fetch-more', provider: 'freesound' });
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
      if (rows[i].type === 'header') {
        last = rows[i] as HeaderRow;
      }
    }

    return last;
  });

  const rowKey = (row: Row): string =>
    match(row)
      .with({ type: 'sample' }, (r) => r.result.id)
      .with({ type: 'header' }, (r) => `h:${r.category}`)
      .with({ type: 'fetch-more' }, (r) => `fm:${r.provider}`)
      .with({ type: 'more' }, (r) => `m:${r.category}`)
      .exhaustive();

  function onScroll(e: Event) {
    const el = e.currentTarget as HTMLElement;

    scrollTop = el.scrollTop;
  }

  function onResize(el: HTMLElement) {
    const observer = new ResizeObserver(() => {
      viewportHeight = el.clientHeight;
    });

    observer.observe(el);

    viewportHeight = el.clientHeight;

    return { destroy: () => observer.disconnect() };
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

    e.preventDefault();

    const sampleRows = rows.filter((r): r is SampleRow => r.type === 'sample');
    if (!sampleRows.length) return;

    const currentIndex = sampleRows.findIndex((r) => r.result.id === sampleSearchStore.selectedId);
    let nextIndex: number;

    if (currentIndex === -1) {
      nextIndex = e.key === 'ArrowDown' ? 0 : sampleRows.length - 1;
    } else {
      nextIndex =
        e.key === 'ArrowDown'
          ? Math.min(currentIndex + 1, sampleRows.length - 1)
          : Math.max(currentIndex - 1, 0);
    }

    const nextResult = sampleRows[nextIndex].result;

    sampleSearchStore.selectSample(nextResult, false);

    // Scroll into view
    const rowIndex = rows.findIndex(
      (row) => row.type === 'sample' && (row as SampleRow).result.id === nextResult.id
    );

    if (rowIndex !== -1 && scrollElement) {
      const top = rowIndex * ROW_H;
      const bottom = top + ROW_H;

      if (top < scrollTop) {
        scrollElement.scrollTo({ top });
      } else if (bottom > scrollTop + viewportHeight) {
        scrollElement.scrollTo({ top: bottom - viewportHeight });
      }
    }
  }

  function showMore(category: string, total: number) {
    const current = expandedGroups.get(category) ?? GROUP_INITIAL;

    expandedGroups.set(category, Math.min(current + 20, total));
  }

  function showAll(category: string, total: number) {
    expandedGroups.set(category, total);
  }

  function handleDragStart(event: DragEvent, result: SampleResult) {
    match(result)
      .with({ kind: 'synthdef' }, () => {
        const payload = JSON.stringify({ synthdef: result.url });

        event.dataTransfer?.setData('application/x-supersonic-synthdef', payload);
        event.dataTransfer?.setData('text/plain', result.url);
      })
      .with({ kind: 'sc-sample' }, () => {
        const payload = JSON.stringify({ name: result.name });

        event.dataTransfer?.setData('application/x-supersonic-sample', payload);
        event.dataTransfer?.setData('text/plain', result.name);
      })
      .otherwise(() => {
        const payload = JSON.stringify({ url: result.url, name: result.name });

        event.dataTransfer?.setData('application/x-sample-url', payload);
        event.dataTransfer?.setData('text/plain', result.name);
      });

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
    }
  }

  function providerBadge(provider: string): string {
    return PROVIDER_META[provider]?.badge ?? provider.slice(0, 3).toUpperCase();
  }

  function providerLabel(provider: string): string {
    return PROVIDER_META[provider]?.label ?? provider;
  }

  function providerColor(provider: string): string {
    return PROVIDER_META[provider]?.color ?? 'text-zinc-400 bg-zinc-800';
  }

  function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds.toFixed(2)}s`;

    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(0).padStart(2, '0');

    return `${m}:${s}`;
  }

  function strudelName(result: SampleResult): string {
    const category = result.category ?? result.name;
    const index = result.index ?? 0;

    return index === 0 ? category : `${category}:${index}`;
  }

  async function copyAsStrudelName(result: SampleResult) {
    await navigator.clipboard.writeText(strudelName(result));

    toast.success('Copied to clipboard');
  }

  async function copySynthdefName(result: SampleResult) {
    // result.url holds the raw synthdef name for synthdef kind
    await navigator.clipboard.writeText(result.url);

    toast.success('Copied to clipboard');
  }

  async function copyScSampleName(result: SampleResult) {
    await navigator.clipboard.writeText(result.name);

    toast.success('Copied to clipboard');
  }

  async function copyAsUrl(result: SampleResult) {
    await navigator.clipboard.writeText(result.url);

    toast.success('Copied to clipboard');
  }

  /** Whether this result has audio that can be previewed */
  const isPlayable = (result: SampleResult): boolean => result.kind !== 'synthdef';

  function addNewTag(result: SampleResult) {
    const tag = newTagInput.trim();
    if (!tag) return;

    sampleTagsStore.addTag(result, tag);

    newTagInput = '';
  }

  const preloadCache = new SvelteMap<string, HTMLAudioElement>();

  $effect(() => {
    for (const row of visibleRows) {
      if (row.type !== 'sample') continue;

      const { result } = row;

      if (!isPlayable(result) || !result.url || preloadCache.has(result.id)) continue;

      if (preloadCache.size >= SAMPLE_VIEW_MAX_PRELOAD) {
        const oldest = preloadCache.keys().next().value!;
        const oldAudio = preloadCache.get(oldest)!;

        oldAudio.pause();
        oldAudio.removeAttribute('src');
        oldAudio.load();
        preloadCache.delete(oldest);
      }

      const audio = new Audio(result.url);
      audio.preload = 'auto';

      preloadCache.set(result.id, audio);
    }
  });

  function handleInsertSampleToCanvas() {
    if (!mobileSelectedSample) return;

    eventBus.dispatch({
      type: 'insertSampleToCanvas',
      result: {
        kind: mobileSelectedSample.kind,
        url: mobileSelectedSample.url,
        name: mobileSelectedSample.name
      }
    });

    mobileSelectedSample = null;
    $isSidebarOpen = false;

    toast.success('Added to canvas');
  }

  const mobileCopy = async (result: SampleResult) =>
    match(result)
      .with({ kind: 'synthdef' }, () => copySynthdefName(result))
      .with({ kind: 'sc-sample' }, () => copyScSampleName(result))
      .otherwise(() => copyAsStrudelName(result));
</script>

<div class="flex h-full flex-col">
  <!-- Search input -->
  <SearchBar bind:value={searchQuery} placeholder="Search samples… or #tag" />

  <!-- Tag mode indicator -->
  {#if isTagMode}
    <div class="flex items-center gap-1.5 border-b border-zinc-800 bg-amber-950/20 px-3 py-1">
      <Tag class="h-3 w-3 text-amber-400" />
      <span class="font-mono text-[10px] text-amber-400">
        {tagQuery.trim() ? `Tag: ${tagQuery.trim()}` : 'All tagged samples'}
      </span>
    </div>
  {/if}

  <!-- Freesound API key setup banner -->
  {#if freesoundNeedsSetup}
    <div class="flex flex-col gap-1.5 border-b border-yellow-900/40 bg-yellow-950/20 px-3 py-2">
      <div class="flex items-center gap-1.5">
        <span class="font-mono text-[10px] font-medium text-yellow-400"
          >Freesound API key required</span
        >
        <a
          href="https://freesound.org/apiv2/apply"
          target="_blank"
          rel="noopener noreferrer"
          class="ml-auto font-mono text-[9px] text-yellow-600 underline hover:text-yellow-400"
          >Get key ↗</a
        >
      </div>
      <div class="flex gap-1.5">
        <input
          class="min-w-0 flex-1 rounded bg-zinc-800 px-2 py-1 font-mono text-[10px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:ring-1 focus:ring-yellow-700"
          placeholder="Paste API key…"
          bind:value={freesoundKeyInput}
          onkeydown={(e) => {
            if (e.key === 'Enter') saveFreesoundKey();
          }}
        />
        <button
          class="cursor-pointer rounded bg-yellow-700 px-2 py-1 font-mono text-[10px] text-yellow-100 hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!freesoundKeyInput.trim()}
          onclick={saveFreesoundKey}>Save</button
        >
      </div>
    </div>
  {/if}

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
  <div class="relative flex-1 overflow-hidden {$isMobile && mobileSelectedSample ? 'pb-14' : ''}">
    {#if !isTagMode && sampleSearchStore.isLoading}
      <div class="px-4 py-8 text-center text-xs text-zinc-500">Loading...</div>
    {:else if !isTagMode && sampleSearchStore.error}
      <div class="px-4 py-6 text-center text-xs text-red-400">
        {sampleSearchStore.error}
      </div>
    {:else if !searchQuery.trim()}
      <div class="flex flex-col items-center gap-2 px-4 py-12 text-center text-xs text-zinc-600">
        <Music class="h-6 w-6 opacity-40" />
        <span>Type to search samples</span>
        <span class="text-[10px]"
          >Use <span class="font-mono text-zinc-500">#</span> to browse tagged samples</span
        >
      </div>
    {:else if isTagMode && sampleTagsStore.getAllTags().length === 0}
      <div class="flex flex-col items-center gap-2 px-4 py-12 text-center text-xs text-zinc-600">
        <Tag class="h-6 w-6 opacity-40" />
        <span>No tagged samples yet</span>
        <span class="text-[10px]">Right-click any sample to add tags</span>
      </div>
    {:else if rows.length === 0}
      <div class="px-4 py-8 text-center text-xs text-zinc-500">
        {#if isTagMode}
          No samples tagged with "{tagQuery.trim()}"
        {:else}
          No samples matching "{searchQuery}"
        {/if}
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
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="h-full overflow-y-auto outline-none"
        onscroll={onScroll}
        onkeydown={handleKeyDown}
        bind:this={scrollElement}
        use:onResize
        tabindex="0"
      >
        <!-- Total height spacer -->
        <div style="height: {totalH}px; position: relative;">
          <!-- Top padding -->
          <div style="height: {paddingTop}px"></div>

          {#each visibleRows as row (rowKey(row))}
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
              {@const isSelected = sampleSearchStore.selectedId === row.result.id}
              {@const playable = isPlayable(row.result)}
              {@const tagged = sampleTagsStore.isTagged(row.result.id)}
              {@const sampleTags = sampleTagsStore.getTags(row.result.id)}
              {@const allTags = sampleTagsStore.getAllTags()}
              <ContextMenu.Root onOpenChange={() => (newTagInput = '')}>
                <ContextMenu.Trigger>
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <div
                    class="group flex w-full cursor-pointer items-center gap-1.5 pr-1 pl-4 text-xs {isSelected
                      ? 'bg-zinc-700 hover:bg-zinc-700'
                      : 'hover:bg-zinc-800'}"
                    style="height: {ROW_H}px"
                    draggable="true"
                    ondragstart={(e) => handleDragStart(e, row.result)}
                    onclick={() => {
                      sampleSearchStore.selectSample(row.result);
                      if ($isMobile) mobileSelectedSample = row.result;
                    }}
                  >
                    {#if playable}
                      <Tooltip.Root>
                        <Tooltip.Trigger>
                          <button
                            class="shrink-0 cursor-pointer rounded p-0.5 text-zinc-500 hover:text-zinc-200 {isPlaying
                              ? 'text-blue-400 hover:text-blue-300'
                              : ''}"
                            onclick={(e) => {
                              e.stopPropagation();
                              sampleSearchStore.togglePreview(row.result);
                            }}
                          >
                            {#if isPlaying}
                              <Square class="h-3 w-3" />
                            {:else}
                              <Play class="h-3 w-3" />
                            {/if}
                          </button>
                        </Tooltip.Trigger>
                        <Tooltip.Content>{isPlaying ? 'Stop preview' : 'Preview'}</Tooltip.Content>
                      </Tooltip.Root>
                    {/if}

                    <span
                      class="min-w-0 flex-1 truncate font-mono text-zinc-300"
                      title={row.result.name}
                    >
                      {row.result.name}
                    </span>

                    {#if row.result.duration != null}
                      <span class="shrink-0 font-mono text-[10px] text-zinc-600">
                        {formatDuration(row.result.duration)}
                      </span>
                    {/if}

                    {#if tagged}
                      <div class="mr-0.5 flex shrink-0 items-center gap-0.5">
                        {#each sampleTags.slice(0, 4) as tag (tag)}
                          <div
                            class="h-1.5 w-1.5 rounded-full {getTagColor(tag).dot}"
                            title={tag}
                          ></div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </ContextMenu.Trigger>

                <ContextMenu.Content>
                  {#if row.result.kind === 'synthdef'}
                    <ContextMenu.Item onclick={() => copySynthdefName(row.result)}>
                      Copy synthdef name
                    </ContextMenu.Item>
                  {:else if row.result.kind === 'sc-sample'}
                    <ContextMenu.Item onclick={() => copyScSampleName(row.result)}>
                      Copy sample name
                    </ContextMenu.Item>
                  {:else}
                    <ContextMenu.Item onclick={() => copyAsStrudelName(row.result)}>
                      Copy as Strudel name
                    </ContextMenu.Item>

                    <ContextMenu.Item onclick={() => copyAsUrl(row.result)}>
                      Copy as URL
                    </ContextMenu.Item>
                  {/if}
                  {#if row.result.attribution}
                    <ContextMenu.Separator />
                    <ContextMenu.Item
                      onclick={() =>
                        window.open(
                          `https://freesound.org/s/${row.result.attribution!.freesoundId}/`,
                          '_blank'
                        )}
                    >
                      Open on Freesound ↗
                    </ContextMenu.Item>
                    <ContextMenu.Item disabled class="font-mono text-[10px] opacity-50">
                      {row.result.attribution.username} · {row.result.attribution.license}
                    </ContextMenu.Item>
                  {/if}

                  <ContextMenu.Separator />

                  <ContextMenu.Sub>
                    <ContextMenu.SubTrigger class="flex items-center gap-1.5">
                      <Tag class="h-3 w-3" />
                      Tags
                      {#if tagged}
                        <span class="ml-auto font-mono text-[9px] text-amber-400">
                          {sampleTags.length}
                        </span>
                      {/if}
                    </ContextMenu.SubTrigger>

                    <ContextMenu.SubContent class="min-w-36 p-1">
                      <!-- New tag input -->
                      <div class="px-1 pb-1">
                        <input
                          class="w-full rounded bg-zinc-800 px-2 py-1 font-mono text-[10px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:ring-1 focus:ring-zinc-600"
                          placeholder="New tag…"
                          bind:value={newTagInput}
                          onkeydown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') addNewTag(row.result);
                          }}
                          onclick={(e) => e.stopPropagation()}
                        />
                      </div>

                      {#if allTags.length > 0}
                        <ContextMenu.Separator />

                        {#each allTags as tag (tag)}
                          {@const color = getTagColor(tag)}

                          <ContextMenu.CheckboxItem
                            checked={sampleTagsStore.hasTag(row.result.id, tag)}
                            onCheckedChange={() => sampleTagsStore.toggleTag(row.result, tag)}
                          >
                            <span class="flex w-full items-center gap-1.5">
                              <span class="h-2 w-2 shrink-0 rounded-full {color.dot}"></span>

                              {tag}
                            </span>
                          </ContextMenu.CheckboxItem>
                        {/each}
                      {/if}
                    </ContextMenu.SubContent>
                  </ContextMenu.Sub>
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
            {:else if row.type === 'fetch-more'}
              <div class="flex items-center gap-2 pr-2 pl-4" style="height: {ROW_H}px">
                <button
                  class="cursor-pointer font-mono text-[10px] text-zinc-500 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={sampleSearchStore.isLoadingMore}
                  onclick={() => sampleSearchStore.loadMoreFromProvider(row.provider)}
                >
                  {sampleSearchStore.isLoadingMore ? 'Loading…' : 'Load more from Freesound'}
                </button>
              </div>
            {/if}
          {/each}

          <!-- Bottom padding -->
          <div style="height: {paddingBottom}px"></div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Mobile floating toolbar -->
  {#if $isMobile && mobileSelectedSample}
    {@const sample = mobileSelectedSample}
    <div
      class="fixed right-0 bottom-0 left-0 z-30 border-t border-zinc-800 bg-zinc-900/95 px-4 pt-2 backdrop-blur-sm"
      style="padding-bottom: calc(0.5rem + env(safe-area-inset-bottom, 0px))"
    >
      <div class="flex items-center justify-center gap-2">
        <span class="mr-2 max-w-32 truncate font-mono text-xs text-zinc-400">
          {sample.name}
        </span>

        <button
          class="flex cursor-pointer items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          onclick={handleInsertSampleToCanvas}
        >
          <Plus class="h-3.5 w-3.5" />
          <span>Insert</span>
        </button>

        {#if isPlayable(sample)}
          <button
            class="flex cursor-pointer items-center gap-1.5 rounded bg-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-600 {sampleSearchStore.playingId ===
            sample.id
              ? 'text-blue-400'
              : ''}"
            onclick={() => sampleSearchStore.togglePreview(sample)}
          >
            {#if sampleSearchStore.playingId === sample.id}
              <Square class="h-3.5 w-3.5" />
              <span>Stop</span>
            {:else}
              <Play class="h-3.5 w-3.5" />
              <span>Preview</span>
            {/if}
          </button>
        {/if}

        <Popover.Root bind:open={mobileMoreOpen}>
          <Popover.Trigger
            class="flex cursor-pointer items-center rounded bg-zinc-700 p-1.5 text-zinc-200 hover:bg-zinc-600"
          >
            <Ellipsis class="h-4 w-4" />
          </Popover.Trigger>

          <Popover.Content class="w-44 border-zinc-700 bg-zinc-900 p-1" side="top" align="end">
            <button
              class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800"
              onclick={async () => {
                await mobileCopy(sample);
                mobileMoreOpen = false;
              }}
            >
              <Copy class="h-4 w-4 text-zinc-400" />
              {sample.kind === 'synthdef'
                ? 'Copy synthdef name'
                : sample.kind === 'sc-sample'
                  ? 'Copy sample name'
                  : 'Copy Strudel name'}
            </button>
          </Popover.Content>
        </Popover.Root>

        <button
          class="ml-auto cursor-pointer text-xs text-zinc-500 hover:text-zinc-300"
          onclick={() => (mobileSelectedSample = null)}
        >
          Cancel
        </button>
      </div>
    </div>
  {/if}

  <!-- Footer: result count + filter (hidden on mobile when toolbar is visible) -->
  <div
    class="flex items-center justify-between border-t border-zinc-800 px-3 py-1.5 {$isMobile &&
    mobileSelectedSample
      ? 'hidden'
      : ''}"
    style="padding-bottom: calc(0.375rem + env(safe-area-inset-bottom, 0px))"
  >
    <span class="text-[10px] text-zinc-600">
      {#if activeResults.length > 0}
        {activeResults.length} result{activeResults.length === 1 ? '' : 's'}
      {/if}
    </span>
    <div class="flex items-center gap-0.5">
      <!-- Volume control -->
      <Popover.Root>
        <Popover.Trigger>
          {#snippet child({ props })}
            <Tooltip.Root>
              <Tooltip.Trigger>
                <button
                  {...props}
                  class="cursor-pointer rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                >
                  <Volume2 class="h-3 w-3" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content>Preview volume</Tooltip.Content>
            </Tooltip.Root>
          {/snippet}
        </Popover.Trigger>

        <Popover.Content class="w-14 p-3" align="end" side="top">
          <div class="flex flex-col items-center gap-2">
            <span class="font-mono text-[9px] text-zinc-500">
              {Math.round(sampleSearchStore.previewVolume * 100)}%
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={sampleSearchStore.previewVolume}
              oninput={(e) =>
                sampleSearchStore.setPreviewVolume(
                  Number((e.currentTarget as HTMLInputElement).value)
                )}
              class="h-24 cursor-pointer accent-zinc-400"
              style="writing-mode: vertical-lr; direction: rtl;"
            />
          </div>
        </Popover.Content>
      </Popover.Root>

      <!-- Auto-preview toggle -->
      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            class="cursor-pointer rounded p-1 hover:bg-zinc-800 {sampleSearchStore.autoPreview
              ? 'text-blue-400 hover:text-blue-300'
              : 'text-zinc-500 hover:text-zinc-300'}"
            onclick={() => sampleSearchStore.setAutoPreview(!sampleSearchStore.autoPreview)}
          >
            <Headphones class="h-3 w-3" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content>
          Auto-preview: {sampleSearchStore.autoPreview ? 'on' : 'off'}
        </Tooltip.Content>
      </Tooltip.Root>

      <!-- Sources filter (hidden in tag mode) -->
      {#if !isTagMode}
        <Popover.Root>
          <Popover.Trigger>
            {#snippet child({ props })}
              <Tooltip.Root>
                <Tooltip.Trigger>
                  {@const total = sampleSearchStore.providers.length}
                  {@const enabled = sampleSearchStore.enabledProviders.size}
                  <button
                    {...props}
                    class="relative cursor-pointer rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 {enabled <
                    total
                      ? 'text-blue-400'
                      : ''}"
                  >
                    <SlidersHorizontal class="h-3 w-3" />
                    {#if enabled < total}
                      <span
                        class="absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-blue-500 font-mono text-[7px] text-white"
                        >{enabled}</span
                      >
                    {/if}
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Content>Filter sources</Tooltip.Content>
              </Tooltip.Root>
            {/snippet}
          </Popover.Trigger>
          <Popover.Content class="w-48 p-2" align="end" side="top">
            <p
              class="mb-1.5 px-1 font-mono text-[9px] font-medium tracking-wider text-zinc-500 uppercase"
            >
              Sources
            </p>
            <div class="flex flex-col gap-0.5">
              {#each sampleSearchStore.providers as provider (provider.id)}
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
      {/if}
    </div>
  </div>
</div>
