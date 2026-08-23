<script lang="ts">
  import { Check, ChevronDown, ChevronRight, Lock, Package } from '@lucide/svelte/icons';

  import { BUILTIN_PRESETS } from '$presets';

  import { getPackIcon } from '$lib/extensions/pack-icons';
  import { getPresetPackPresetNames } from '$lib/presets/preset-pack-index';
  import { getObjectDescription } from '$lib/components/object-browser/get-categorized-objects';
  import { useScrollIndicator } from '$lib/components/use-scroll-indicator.svelte';

  import {
    BUILT_IN_PACKS,
    BUILT_IN_PACK_COLLECTIONS,
    BUILT_IN_PRESET_PACKS,
    enabledPackIds,
    enabledPresetPackIds,
    isPackEnabled,
    isPackLocked,
    isPresetPackEnabled,
    isPresetPackLocked,
    toggleCollection,
    togglePack,
    togglePresetPack,
    type ExtensionPack,
    type PresetPack
  } from '../../../stores/extensions.store';

  type PackEntry =
    | { kind: 'object'; pack: ExtensionPack }
    | { kind: 'preset'; pack: PresetPack; optional?: boolean }
    | { kind: 'supporting'; pack: ExtensionPack; items: string[] };

  type CollectionState = 'on' | 'partial' | 'off';

  let {
    searchQuery = '',
    layout = 'list'
  }: {
    searchQuery?: string;
    layout?: 'list' | 'columns';
  } = $props();

  let expandedCollectionIds = $state<string[]>([]);
  let expandedPackKeys = $state<string[]>([]);
  let selectedCollectionId = $state<string>('essentials');
  let selectedPackKey = $state<string | null>(null);

  const query = $derived(searchQuery.trim().toLowerCase());
  const packColumnScroll = useScrollIndicator(() => layout === 'columns' && !query);
  const contentsColumnScroll = useScrollIndicator(() => layout === 'columns' && !query);

  function getEntries(collectionId: string): PackEntry[] {
    const collection = BUILT_IN_PACK_COLLECTIONS.find((candidate) => candidate.id === collectionId);
    if (!collection) return [];

    const objectEntries = collection.primaryObjectPackIds.flatMap((id) => {
      const pack = BUILT_IN_PACKS.find((candidate) => candidate.id === id);

      return pack ? [{ kind: 'object' as const, pack }] : [];
    });

    const presetEntries = collection.primaryPresetPackIds.flatMap((id) => {
      const pack = BUILT_IN_PRESET_PACKS.find((candidate) => candidate.id === id);

      return pack ? [{ kind: 'preset' as const, pack }] : [];
    });

    const optionalPresetEntries = collection.optionalPresetPackIds.flatMap((id) => {
      const pack = BUILT_IN_PRESET_PACKS.find((candidate) => candidate.id === id);

      return pack ? [{ kind: 'preset' as const, pack, optional: true }] : [];
    });

    return [...objectEntries, ...presetEntries, ...optionalPresetEntries];
  }

  function getSupportingEntries(collectionId: string): PackEntry[] {
    const collection = BUILT_IN_PACK_COLLECTIONS.find((candidate) => candidate.id === collectionId);
    if (!collection) return [];

    return BUILT_IN_PACKS.flatMap((pack) => {
      const items = collection.supportingObjectTypes.filter((object) =>
        pack.objects.includes(object)
      );

      return items.length > 0 ? [{ kind: 'supporting' as const, pack, items }] : [];
    });
  }

  function getItems(entry: PackEntry): string[] {
    if (entry.kind === 'supporting') return entry.items;

    return entry.kind === 'object' ? entry.pack.objects : getPresetPackPresetNames(entry.pack);
  }

  function getItemDescription(entry: PackEntry, item: string): string | undefined {
    if (entry.kind === 'preset') return BUILTIN_PRESETS[item]?.description;

    return getObjectDescription(item);
  }

  function isEntryEnabled(entry: PackEntry): boolean {
    if (entry.kind === 'supporting') return true;

    return entry.kind === 'object'
      ? isPackEnabled(entry.pack.id, $enabledPackIds)
      : isPresetPackEnabled(entry.pack.id, $enabledPresetPackIds);
  }

  function isEntryLocked(entry: PackEntry): boolean {
    if (entry.kind === 'supporting') return true;

    return entry.kind === 'object'
      ? isPackLocked(entry.pack.id)
      : isPresetPackLocked(entry.pack.id);
  }

  const isOptionalPresetEntry = (entry: PackEntry): boolean =>
    entry.kind === 'preset' && entry.optional === true;

  function getCollectionState(collectionId: string): CollectionState {
    const entries = getEntries(collectionId).filter(
      (entry) => !isEntryLocked(entry) && !isOptionalPresetEntry(entry)
    );

    const enabledCount = entries.filter(isEntryEnabled).length;
    if (enabledCount === 0) return 'off';
    if (enabledCount === entries.length) return 'on';

    return 'partial';
  }

  function matchesEntry(entry: PackEntry): boolean {
    if (!query) return true;

    return [entry.pack.name, entry.pack.description, ...getItems(entry)].some((value) =>
      value.toLowerCase().includes(query)
    );
  }

  const visibleCollections = $derived(
    BUILT_IN_PACK_COLLECTIONS.filter((collection) => {
      if (!query) return true;

      return (
        collection.name.toLowerCase().includes(query) ||
        collection.description.toLowerCase().includes(query) ||
        getEntries(collection.id).some(matchesEntry) ||
        getSupportingEntries(collection.id).some(matchesEntry)
      );
    })
  );

  const isCollectionExpanded = (collectionId: string): boolean =>
    Boolean(query) || expandedCollectionIds.includes(collectionId);

  const isPackExpanded = (key: string): boolean => Boolean(query) || expandedPackKeys.includes(key);

  const toggleExpanded = (values: string[], value: string): string[] =>
    values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

  function toggleEntry(entry: PackEntry) {
    if (entry.kind === 'supporting') return;

    if (entry.kind === 'object') {
      togglePack(entry.pack.id);
    } else {
      togglePresetPack(entry.pack.id);
    }
  }

  const activeCollection = $derived(
    visibleCollections.find((collection) => collection.id === selectedCollectionId) ??
      visibleCollections[0] ??
      null
  );

  const activeEntries = $derived(activeCollection ? getEntries(activeCollection.id) : []);

  const activeSupportingEntries = $derived(
    activeCollection ? getSupportingEntries(activeCollection.id) : []
  );

  const activeDisplayEntries = $derived([...activeEntries, ...activeSupportingEntries]);

  const activePack = $derived(
    activeDisplayEntries.find((entry) => `${entry.kind}:${entry.pack.id}` === selectedPackKey) ??
      activeDisplayEntries[0] ??
      null
  );

  function selectCollection(collectionId: string) {
    selectedCollectionId = collectionId;
    selectedPackKey = null;
  }

  function selectPack(entry: PackEntry) {
    selectedPackKey = `${entry.kind}:${entry.pack.id}`;
  }
</script>

{#if layout === 'columns' && !query}
  <div
    class="hidden min-[760px]:grid min-[760px]:h-full min-[760px]:min-h-0 min-[760px]:grid-cols-[minmax(190px,0.8fr)_minmax(220px,1fr)_minmax(260px,1.15fr)] min-[760px]:overflow-hidden"
    aria-label="Pack collections"
  >
    <section
      class="flex min-h-0 min-w-0 flex-col border-r border-white/7 bg-black/10"
      aria-label="Collections"
    >
      <header class="border-b border-white/7 px-3 py-2.5">
        <h4 class="text-[10px] font-medium tracking-[0.08em] text-zinc-500 uppercase">
          Collections
        </h4>
      </header>
      <div class="ob-scroll min-h-0 flex-1 overflow-y-auto p-1.5">
        {#each visibleCollections as collection (collection.id)}
          {@const state = getCollectionState(collection.id)}
          {@const CollectionIcon = getPackIcon(collection.icon)}
          <div
            class={[
              'group flex min-h-10 items-center gap-1 rounded-md',
              activeCollection?.id === collection.id && 'bg-white/[0.07]'
            ]}
          >
            <button
              type="button"
              onclick={() => toggleCollection(collection, state !== 'on')}
              disabled={collection.id === 'essentials'}
              role="checkbox"
              aria-checked={state === 'partial' ? 'mixed' : state === 'on'}
              aria-label={`${state === 'on' ? 'Disable' : 'Enable'} ${collection.name}`}
              class="ml-1 flex h-8 w-6 shrink-0 cursor-pointer items-center justify-center rounded outline-none focus-visible:ring-1 focus-visible:ring-orange-500/70 disabled:cursor-not-allowed"
            >
              <span
                class={[
                  'flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border',
                  state === 'on' || state === 'partial'
                    ? 'border-orange-500/60 bg-orange-500/15 text-orange-400'
                    : 'border-zinc-700 text-transparent'
                ]}
              >
                {#if state === 'on'}<Check class="h-2.5 w-2.5" />{:else if state === 'partial'}<span
                    class="h-px w-2 bg-current"
                  ></span>{/if}
              </span>
            </button>
            <button
              type="button"
              onclick={() => selectCollection(collection.id)}
              aria-current={activeCollection?.id === collection.id ? 'true' : undefined}
              class="flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md py-1 pr-2 text-left outline-none focus-visible:ring-1 focus-visible:ring-orange-500/70"
            >
              <CollectionIcon class="h-3.5 w-3.5 shrink-0 text-zinc-500" />
              <span class="min-w-0 flex-1 truncate text-[11px] text-zinc-300"
                >{collection.name}</span
              >
              <ChevronRight class="h-3.5 w-3.5 shrink-0 text-zinc-600" />
            </button>
          </div>
        {/each}
      </div>
    </section>

    <section
      class="flex min-h-0 min-w-0 flex-col border-r border-white/7 bg-white/[0.015]"
      aria-label="Packs"
    >
      <header class="border-b border-white/7 px-3 py-2.5">
        <h4 class="truncate text-[10px] font-medium tracking-[0.08em] text-zinc-500 uppercase">
          {activeCollection?.name ?? 'Packs'}
        </h4>
      </header>
      <div class="flex min-h-0 flex-1 flex-col">
        <div
          bind:this={packColumnScroll.element}
          onscroll={packColumnScroll.onScroll}
          class="ob-scroll min-h-0 flex-1 overflow-y-auto p-1.5"
        >
          <div>
            {#if activeCollection}
              {#each activeDisplayEntries as entry (`${entry.kind}:${entry.pack.id}`)}
                {@const key = `${entry.kind}:${entry.pack.id}`}
                {@const enabled = isEntryEnabled(entry)}
                {@const locked = isEntryLocked(entry)}
                {@const PackIcon = getPackIcon(entry.pack.icon)}
                <div
                  class={[
                    'group flex min-h-10 items-center gap-1 rounded-md',
                    activePack &&
                      `${activePack.kind}:${activePack.pack.id}` === key &&
                      'bg-white/[0.07]'
                  ]}
                >
                  {#if entry.kind === 'supporting'}
                    <span
                      class="ml-1 flex h-8 w-6 shrink-0 items-center justify-center text-zinc-600"
                      aria-hidden="true"
                    >
                      <Lock class="h-3 w-3" />
                    </span>
                  {:else}
                    <button
                      type="button"
                      onclick={() => toggleEntry(entry)}
                      disabled={locked}
                      role="checkbox"
                      aria-checked={enabled}
                      aria-label={`${enabled ? 'Disable' : 'Enable'} ${entry.pack.name}`}
                      class="ml-1 flex h-8 w-6 shrink-0 cursor-pointer items-center justify-center rounded outline-none focus-visible:ring-1 focus-visible:ring-orange-500/70 disabled:cursor-not-allowed"
                    >
                      <span
                        class={[
                          'flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border',
                          enabled
                            ? 'border-zinc-500 bg-zinc-700 text-zinc-100'
                            : 'border-zinc-700 text-transparent'
                        ]}
                        >{#if enabled}<Check class="h-2.5 w-2.5" />{/if}</span
                      >
                    </button>
                  {/if}
                  <button
                    type="button"
                    onclick={() => selectPack(entry)}
                    aria-current={activePack && `${activePack.kind}:${activePack.pack.id}` === key
                      ? 'true'
                      : undefined}
                    class="flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md py-1 pr-2 text-left outline-none focus-visible:ring-1 focus-visible:ring-orange-500/70"
                  >
                    <PackIcon class="h-3 w-3 shrink-0 text-zinc-500" />
                    <span class="min-w-0 flex-1 truncate text-[10px] text-zinc-300"
                      >{entry.kind === 'supporting'
                        ? `Included from ${entry.pack.name}`
                        : entry.pack.name}</span
                    >
                    {#if isOptionalPresetEntry(entry)}
                      <span class="text-[8px] text-zinc-600">Optional</span>
                    {/if}
                    <span class="font-mono text-[8px] text-zinc-700">{getItems(entry).length}</span>
                    <ChevronRight class="h-3 w-3 shrink-0 text-zinc-600" />
                  </button>
                </div>
              {/each}
            {/if}
          </div>
        </div>
        {#if packColumnScroll.hasMore}
          <div
            class="pointer-events-none flex h-6 shrink-0 items-center justify-center text-[9px] text-zinc-400"
            aria-hidden="true"
          >
            <span class="flex items-center gap-1">
              Scroll for more
              <ChevronDown class="h-3 w-3" />
            </span>
          </div>
        {/if}
      </div>
    </section>

    <section class="flex min-h-0 min-w-0 flex-col bg-black/10" aria-label="Pack contents">
      <header class="border-b border-white/7 px-3 py-2.5">
        <h4 class="truncate text-[10px] font-medium tracking-[0.08em] text-zinc-500 uppercase">
          {activePack?.pack.name ?? 'Contents'}
        </h4>
      </header>
      <div class="flex min-h-0 flex-1 flex-col">
        <div
          bind:this={contentsColumnScroll.element}
          onscroll={contentsColumnScroll.onScroll}
          class="ob-scroll min-h-0 flex-1 overflow-y-auto p-2"
        >
          <div>
            {#if activePack}
              <p class="mb-2 px-1 text-[10px] leading-relaxed text-zinc-500">
                {activePack.kind === 'supporting'
                  ? `Objects from ${activePack.pack.name} that ${activeCollection?.name} makes available when enabled. The rest of ${activePack.pack.name} stays disabled.`
                  : isOptionalPresetEntry(activePack)
                    ? `${activePack.pack.description} Optional: enable this pack separately to add its presets.`
                    : activePack.pack.description}
              </p>
              {#each getItems(activePack) as item (item)}
                {@const description = getItemDescription(activePack, item)}
                <div
                  class="flex min-h-10 items-start gap-2 rounded px-2 py-1.5 hover:bg-white/[0.035]"
                >
                  <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-700"></span>
                  <span class="min-w-0">
                    <span class="block truncate font-mono text-[9px] text-zinc-400">{item}</span>
                    {#if description}
                      <span
                        class="mt-0.5 line-clamp-2 block text-[9px] leading-relaxed text-zinc-600"
                      >
                        {description}
                      </span>
                    {/if}
                  </span>
                </div>
              {/each}
            {:else}
              <p class="px-1 py-3 text-[10px] text-zinc-600">Select a pack to view its contents.</p>
            {/if}
          </div>
        </div>
        {#if contentsColumnScroll.hasMore}
          <div
            class="pointer-events-none flex h-6 shrink-0 items-center justify-center text-[9px] text-zinc-400"
            aria-hidden="true"
          >
            <span class="flex items-center gap-1">
              Scroll for more
              <ChevronDown class="h-3 w-3" />
            </span>
          </div>
        {/if}
      </div>
    </section>
  </div>
{/if}

<div
  class={['space-y-1.5', layout === 'columns' && !query && 'min-[760px]:hidden']}
  aria-label="Pack collections"
>
  {#each visibleCollections as collection (collection.id)}
    {@const entries = getEntries(collection.id)}
    {@const primaryEntries = entries}
    {@const supportingEntries = getSupportingEntries(collection.id)}
    {@const collectionState = getCollectionState(collection.id)}
    {@const CollectionIcon = getPackIcon(collection.icon)}
    {@const collectionExpanded = isCollectionExpanded(collection.id)}
    <section class="overflow-hidden rounded-lg border border-white/8 bg-white/[0.02]">
      <div class="flex min-h-11 items-center gap-1 px-1.5">
        <button
          type="button"
          onclick={() => toggleCollection(collection, collectionState !== 'on')}
          disabled={collection.id === 'essentials'}
          role="checkbox"
          aria-checked={collectionState === 'partial' ? 'mixed' : collectionState === 'on'}
          aria-label={`${collectionState === 'on' ? 'Disable' : 'Enable'} ${collection.name}`}
          class="flex min-h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-2 text-left transition-colors outline-none hover:bg-white/[0.045] focus-visible:ring-1 focus-visible:ring-orange-500/70 disabled:cursor-not-allowed"
        >
          <span
            class={[
              'flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border',
              collectionState === 'on'
                ? 'border-orange-500/60 bg-orange-500/15 text-orange-400'
                : collectionState === 'partial'
                  ? 'border-orange-500/60 bg-orange-500/15 text-orange-400'
                  : 'border-zinc-700 text-transparent'
            ]}
            aria-hidden="true"
          >
            {#if collectionState === 'on'}
              <Check class="h-2.5 w-2.5" />
            {:else if collectionState === 'partial'}
              <span class="h-px w-2 bg-current"></span>
            {/if}
          </span>
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.045] text-zinc-400"
          >
            <CollectionIcon class="h-3.5 w-3.5" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[11px] font-medium text-zinc-200"
              >{collection.name}</span
            >
            <span class="block truncate text-[9px] text-zinc-600">{collection.description}</span>
          </span>
          {#if collection.id === 'essentials'}
            <Lock class="h-3 w-3 shrink-0 text-zinc-600" aria-label="Always enabled" />
          {/if}
        </button>
        <button
          type="button"
          onclick={() =>
            (expandedCollectionIds = toggleExpanded(expandedCollectionIds, collection.id))}
          class="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-600 transition-colors outline-none hover:bg-white/5 hover:text-zinc-300 focus-visible:ring-1 focus-visible:ring-orange-500/70"
          aria-label={`${collectionExpanded ? 'Collapse' : 'Expand'} ${collection.name}`}
          aria-expanded={collectionExpanded}
        >
          {#if collectionExpanded}
            <ChevronDown class="h-3.5 w-3.5" />
          {:else}
            <ChevronRight class="h-3.5 w-3.5" />
          {/if}
        </button>
      </div>

      {#if collectionExpanded}
        <div class="border-t border-white/6 px-2 py-1.5">
          <p class="px-2 pb-1 font-mono text-[8px] tracking-[0.08em] text-zinc-600 uppercase">
            Packs
          </p>
          {#each primaryEntries.filter(matchesEntry) as entry (`${entry.kind}:${entry.pack.id}`)}
            {@const key = `${collection.id}:${entry.kind}:${entry.pack.id}`}
            {@const expanded = isPackExpanded(key)}
            {@const enabled = isEntryEnabled(entry)}
            {@const locked = isEntryLocked(entry)}
            {@const PackIcon = getPackIcon(entry.pack.icon)}
            <div class="rounded-md hover:bg-white/[0.025]">
              <div class="flex min-h-9 items-center gap-1">
                <button
                  type="button"
                  onclick={() => toggleEntry(entry)}
                  disabled={locked}
                  role="checkbox"
                  aria-checked={enabled}
                  class="flex min-h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-2 text-left outline-none focus-visible:ring-1 focus-visible:ring-orange-500/70 disabled:cursor-not-allowed"
                >
                  <span
                    class={[
                      'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border',
                      enabled
                        ? 'border-zinc-500 bg-zinc-700 text-zinc-100'
                        : 'border-zinc-700 text-transparent'
                    ]}
                  >
                    {#if enabled}<Check class="h-2.5 w-2.5" />{/if}
                  </span>
                  <PackIcon class="h-3 w-3 shrink-0 text-zinc-500" />
                  <span class="min-w-0 flex-1 truncate text-[10px] text-zinc-400"
                    >{entry.pack.name}</span
                  >
                  {#if isOptionalPresetEntry(entry)}
                    <span class="text-[8px] text-zinc-600">Optional</span>
                  {/if}
                  <span class="font-mono text-[8px] text-zinc-700">{getItems(entry).length}</span>
                </button>
                <button
                  type="button"
                  onclick={() => (expandedPackKeys = toggleExpanded(expandedPackKeys, key))}
                  class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-zinc-700 outline-none hover:bg-white/5 hover:text-zinc-400 focus-visible:ring-1 focus-visible:ring-orange-500/70"
                  aria-label={`${expanded ? 'Hide' : 'Show'} ${entry.pack.name} contents`}
                  aria-expanded={expanded}
                >
                  <ChevronDown
                    class={['h-3 w-3 transition-transform', !expanded && '-rotate-90']}
                  />
                </button>
              </div>
              {#if expanded}
                <div class="ml-8 border-l border-white/6 px-2 pb-1.5">
                  {#each getItems(entry).filter((item) => !query || item
                        .toLowerCase()
                        .includes(query)) as item (item)}
                    <div class="truncate py-0.5 font-mono text-[9px] text-zinc-600">{item}</div>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}

          {#if supportingEntries.length > 0}
            <p
              class="mt-2 px-2 pb-1 font-mono text-[8px] tracking-[0.08em] text-zinc-600 uppercase"
            >
              Included from other packs
            </p>
            <p class="px-2 pb-1 text-[8px] text-zinc-600">
              These objects are enabled with this collection, without enabling the full source pack.
            </p>
            {#each supportingEntries.filter(matchesEntry) as entry (`supporting:${entry.pack.id}`)}
              {@const key = `${collection.id}:supporting:${entry.pack.id}`}
              {@const expanded = isPackExpanded(key)}
              {@const PackIcon = getPackIcon(entry.pack.icon)}
              <div class="rounded-md hover:bg-white/[0.025]">
                <div class="flex min-h-9 items-center gap-1">
                  <div
                    class="flex min-h-9 min-w-0 flex-1 items-center gap-2 px-2 text-left"
                    aria-label={`Included from ${entry.pack.name}; read only`}
                  >
                    <Lock class="h-3.5 w-3.5 shrink-0 text-zinc-600" aria-hidden="true" />
                    <PackIcon class="h-3 w-3 shrink-0 text-zinc-500" />
                    <span class="min-w-0 flex-1 truncate text-[10px] text-zinc-400"
                      >Included from {entry.pack.name}</span
                    >
                    <span class="font-mono text-[8px] text-zinc-700">{getItems(entry).length}</span>
                  </div>
                  <button
                    type="button"
                    onclick={() => (expandedPackKeys = toggleExpanded(expandedPackKeys, key))}
                    class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-zinc-700 outline-none hover:bg-white/5 hover:text-zinc-400 focus-visible:ring-1 focus-visible:ring-orange-500/70"
                    aria-label={`${expanded ? 'Hide' : 'Show'} objects included from ${entry.pack.name}`}
                    aria-expanded={expanded}
                  >
                    <ChevronDown
                      class={['h-3 w-3 transition-transform', !expanded && '-rotate-90']}
                    />
                  </button>
                </div>
                {#if expanded}
                  <div class="ml-8 border-l border-white/6 px-2 pb-1.5">
                    {#each getItems(entry).filter((item) => !query || item
                          .toLowerCase()
                          .includes(query)) as item (item)}
                      <div class="truncate py-0.5 font-mono text-[9px] text-zinc-600">
                        {item}
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    </section>
  {/each}

  {#if visibleCollections.length === 0}
    <div class="flex min-h-32 flex-col items-center justify-center gap-2 text-center text-zinc-600">
      <Package class="h-5 w-5" />
      <p class="text-[11px]">No collections match “{searchQuery}”.</p>
    </div>
  {/if}
</div>
