<script lang="ts">
  import {
    ChevronDown,
    Search,
    SearchX,
    X,
    Bookmark,
    Package,
    CircleQuestionMark
  } from '@lucide/svelte/icons';
  import {
    getCategorizedObjects,
    type CategoryGroup,
    type ObjectItem
  } from './get-categorized-objects';
  import Fuse from 'fuse.js';
  import { isAiFeaturesVisible, patchObjectTypes } from '../../../stores/ui.store';
  import { flattenedPresets } from '../../../stores/preset-library.store';
  import {
    enabledObjects,
    enabledPresets,
    enabledPackIds,
    enabledPresetPackIds,
    BUILT_IN_PACKS,
    BUILT_IN_PRESET_PACKS,
    togglePack,
    togglePresetPack,
    enableAllPacks,
    enableAllPresetPacks,
    disableAllPacks,
    disableAllPresetPacks,
    isPackEnabled,
    isPresetPackEnabled,
    isPackLocked,
    isPresetPackLocked,
    enabledPrimaryObjects
  } from '../../../stores/extensions.store';
  import { sortFuseResultsWithPrefixPriority } from '$lib/utils/sort-fuse-results';
  import { isSidebarOpen, sidebarView, selectedNodeInfo } from '../../../stores/ui.store';
  import { getPackIcon } from '$lib/extensions/pack-icons';
  import {
    getBuiltInPresetPackByPresetName,
    getPresetPackPresetNames
  } from '$lib/extensions/preset-pack-index';
  import { formatPresetLocation } from '$lib/presets/preset-utils';
  import DisabledObjectSuggestion from './DisabledObjectSuggestion.svelte';
  import ExtensionPackCard from '../sidebar/ExtensionPackCard.svelte';
  import PresetPackCard from '../sidebar/PresetPackCard.svelte';
  import {
    useDisabledObjectSuggestion,
    type DisabledObjectInfo
  } from '$lib/composables/useDisabledObjectSuggestion.svelte';
  import { objectSchemas } from '$lib/objects/schemas';
  import * as Tooltip from '$lib/components/ui/tooltip';

  type BrowserMode = 'insert' | 'help' | 'packs';

  function openPacks() {
    browserMode = 'packs';
  }

  const getIconComponent = getPackIcon;

  let {
    open = $bindable(false),
    onSelectObject
  }: { open?: boolean; onSelectObject: (name: string) => void } = $props();

  let searchQuery = $state('');
  let expandedCategories = $state<Set<string>>(new Set());
  let showPresets = $state(true);
  let hasInitialized = $state(false);
  let browserMode = $state<BrowserMode>('insert');
  let expandedPackId = $state<string | null>(null);

  // Check if an object has help available
  function hasHelp(objectName: string): boolean {
    return objectName in objectSchemas;
  }

  // Open help for an object in sidebar
  function openHelp(objectName: string) {
    $isSidebarOpen = true;
    $sidebarView = 'help';
    $selectedNodeInfo = { type: objectName, id: 'browser' };
    open = false;
  }

  // Get all categorized objects, filtering AI features and by enabled extensions
  const allCategories = $derived(
    getCategorizedObjects($isAiFeaturesVisible, $enabledObjects, $patchObjectTypes)
  );

  // Composable for searching disabled objects
  const { searchDisabledObject } = useDisabledObjectSuggestion(
    () => $enabledPackIds,
    () => $isAiFeaturesVisible
  );

  // Get preset categories grouped by library and type
  const presetCategories = $derived.by((): CategoryGroup[] => {
    const presetsByCategory = new Map<string, ObjectItem[]>();
    const categoryIconMap = new Map<string, string>();

    for (const flatPreset of $flattenedPresets) {
      const { preset, libraryName, path } = flatPreset;

      if (!$enabledObjects.has(preset.type)) {
        continue;
      }

      if (libraryName === 'Built-in' && !$enabledPresets.has(preset.name)) {
        continue;
      }

      const presetPack =
        libraryName === 'Built-in' ? getBuiltInPresetPackByPresetName(preset.name) : undefined;
      const typeFolder = path.length > 2 ? path[1] : preset.type;
      const categoryKey =
        libraryName === 'Built-in'
          ? (presetPack?.name ?? typeFolder)
          : formatPresetLocation(flatPreset);

      if (!presetsByCategory.has(categoryKey)) {
        presetsByCategory.set(categoryKey, []);
        const pack = BUILT_IN_PACKS.find((p) => p.objects.includes(preset.type));
        categoryIconMap.set(categoryKey, presetPack?.icon ?? pack?.icon ?? 'Package');
      }

      presetsByCategory.get(categoryKey)!.push({
        name: preset.name,
        description: preset.description || `Preset using ${preset.type}`,
        category: categoryKey,
        priority: 'normal'
      });
    }

    for (const presets of presetsByCategory.values()) {
      presets.sort((a, b) => a.name.localeCompare(b.name));
    }

    const presetPackOrder = new Map(BUILT_IN_PRESET_PACKS.map((pack, index) => [pack.name, index]));
    const sortedCategories = Array.from(presetsByCategory.keys()).sort((a, b) => {
      const aOrder = presetPackOrder.get(a) ?? Number.MAX_SAFE_INTEGER;
      const bOrder = presetPackOrder.get(b) ?? Number.MAX_SAFE_INTEGER;

      if (aOrder !== bOrder) return aOrder - bOrder;

      return a.localeCompare(b);
    });

    return sortedCategories.map((category) => ({
      title: category,
      icon: categoryIconMap.get(category) || 'Package',
      isPresetCategory: true,
      objects: presetsByCategory.get(category)!
    }));
  });

  const allCategoriesWithPresets = $derived.by(() => {
    if (showPresets && browserMode !== 'help') {
      return [...allCategories, ...presetCategories];
    }
    return allCategories;
  });

  const fuse = $derived(
    new Fuse(
      allCategoriesWithPresets.flatMap((cat) =>
        cat.objects.map((obj) => ({
          ...obj,
          categoryTitle: cat.title,
          isPreset: cat.isPresetCategory === true
        }))
      ),
      {
        keys: ['name', 'description', 'categoryTitle'],
        threshold: 0.3,
        includeScore: true
      }
    )
  );

  const filteredCategories = $derived.by(() => {
    if (!searchQuery.trim()) {
      return allCategoriesWithPresets;
    }

    const results = fuse.search(searchQuery);

    const sortedResults = sortFuseResultsWithPrefixPriority(
      results,
      searchQuery,
      (item) => item.name,
      (a, b) => {
        if (a.item.priority !== b.item.priority) {
          return a.item.priority === 'normal' ? -1 : 1;
        }
        return 0;
      }
    );

    const matchedObjects = new Map<string, ObjectItem[]>();

    for (const result of sortedResults) {
      const categoryTitle = result.item.categoryTitle;
      if (!matchedObjects.has(categoryTitle)) {
        matchedObjects.set(categoryTitle, []);
      }
      matchedObjects.get(categoryTitle)!.push({
        name: result.item.name,
        description: result.item.description,
        category: result.item.category,
        priority: result.item.priority
      });
    }

    const categoryOrder = new Map<string, number>();
    sortedResults.forEach((result, index) => {
      const cat = result.item.categoryTitle;
      if (!categoryOrder.has(cat)) {
        categoryOrder.set(cat, index);
      }
    });

    return allCategoriesWithPresets
      .map((cat) => ({
        ...cat,
        objects: matchedObjects.get(cat.title) || []
      }))
      .filter((cat) => cat.objects.length > 0)
      .toSorted((a, b) => {
        const aOrder = categoryOrder.get(a.title) ?? Infinity;
        const bOrder = categoryOrder.get(b.title) ?? Infinity;
        return aOrder - bOrder;
      });
  });

  const suggestedDisabledObject = $derived.by((): DisabledObjectInfo | null => {
    if (!searchQuery.trim()) return null;
    if (filteredCategories.length > 0) return null;
    return searchDisabledObject(searchQuery);
  });

  const isSearching = $derived(searchQuery.trim().length > 0);

  function enablePackAndSelect(packId: string, objectName: string) {
    togglePack(packId);
    setTimeout(() => {
      handleSelectObject(objectName);
    }, 50);
  }

  function handleClose() {
    open = false;
    searchQuery = '';
    browserMode = 'insert';
    expandedPackId = null;
  }

  function handleSelectObject(name: string) {
    onSelectObject(name);
    handleClose();
  }

  function toggleCategory(title: string) {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(title)) {
      newExpanded.delete(title);
    } else {
      newExpanded.add(title);
    }
    expandedCategories = newExpanded;
  }

  function togglePackExpansion(packId: string) {
    if (isSearching) return;
    expandedPackId = expandedPackId === packId ? null : packId;
  }

  $effect(() => {
    if (open && !hasInitialized) {
      expandedCategories = new Set(allCategoriesWithPresets.map((cat) => cat.title));
      hasInitialized = true;
    } else if (!open) {
      hasInitialized = false;
    }
  });

  $effect(() => {
    if (searchQuery.trim() && filteredCategories.length > 0) {
      expandedCategories = new Set(filteredCategories.map((cat) => cat.title));
    }
  });

  $effect(() => {
    if (isSearching) {
      expandedPackId = null;
    }
  });

  $effect(() => {
    if (!open) return;

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose();
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });

  // Pack filtering for packs mode
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
        getPresetPackPresetNames(pack).some((preset) => preset.toLowerCase().includes(query))
    );
  });

  const totalObjectCount = $derived.by(() => {
    const allObjects = new Set<string>();
    for (const pack of BUILT_IN_PACKS) {
      for (const obj of pack.objects) allObjects.add(obj);
    }
    return allObjects.size;
  });

  const enabledCount = $derived($enabledPrimaryObjects.size);
  const allObjectPacksEnabled = $derived($enabledPackIds.length === BUILT_IN_PACKS.length);
  const allPresetPacksEnabled = $derived(
    $enabledPresetPackIds.length === BUILT_IN_PRESET_PACKS.length
  );
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center" role="presentation">
    <!-- Backdrop -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 animate-[ob-fade_0.2s_ease_both] bg-black/88 backdrop-blur-[12px]"
      role="button"
      tabindex="-1"
      onclick={handleClose}
      aria-label="Close modal"
    ></div>

    <!-- Modal container -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="relative z-10 m-0 flex h-dvh w-full max-w-[860px] animate-[ob-card-in_0.35s_cubic-bezier(0.22,0.61,0.36,1)_both] flex-col overflow-hidden rounded-[14px] border border-orange-500/18 bg-[#09090b] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),0_0_80px_rgba(249,115,22,0.06),0_40px_80px_rgba(0,0,0,0.8)] outline-none sm:m-4 sm:h-[88vh] sm:max-h-[780px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ob-title"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Corner ornaments -->
      <span
        class="pointer-events-none absolute top-3 left-3 z-[2] h-4 w-4 border-t border-l border-orange-500 opacity-40"
        aria-hidden="true"
      ></span>
      <span
        class="pointer-events-none absolute top-3 right-3 z-[2] h-4 w-4 border-t border-r border-orange-500 opacity-40"
        aria-hidden="true"
      ></span>
      <span
        class="pointer-events-none absolute bottom-3 left-3 z-[2] h-4 w-4 border-b border-l border-orange-500 opacity-40"
        aria-hidden="true"
      ></span>
      <span
        class="pointer-events-none absolute right-3 bottom-3 z-[2] h-4 w-4 border-r border-b border-orange-500 opacity-40"
        aria-hidden="true"
      ></span>

      <!-- Radial glow -->
      <div
        class="pointer-events-none absolute -top-[60px] -right-[60px] -left-[60px] z-0 h-[240px] bg-[radial-gradient(ellipse_70%_60%_at_50%_35%,rgba(249,115,22,0.07),transparent_70%)]"
        aria-hidden="true"
      ></div>

      <!-- Header -->
      <div
        class="relative z-[1] flex shrink-0 items-center justify-between gap-3 border-b border-white/5 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 max-sm:flex-col max-sm:items-start sm:px-7 sm:pt-[max(18px,env(safe-area-inset-top))] sm:pb-3.5"
      >
        <span
          class="shrink-0 font-mono text-[10px] tracking-[0.18em] whitespace-nowrap text-zinc-700 uppercase"
          >patchies · objects</span
        >
        <div
          class="flex items-center gap-2.5 max-sm:ml-0 max-sm:w-full max-sm:justify-between sm:ml-auto"
        >
          <div class="flex flex-wrap gap-1.5">
            <!-- Packs button -->
            <Tooltip.Root delayDuration={100}>
              <Tooltip.Trigger>
                <button
                  onclick={() => (browserMode = browserMode === 'packs' ? 'insert' : 'packs')}
                  class={[
                    'flex cursor-pointer items-center gap-[5px] rounded border px-2.5 py-1 font-mono text-[10px] tracking-[0.1em] whitespace-nowrap lowercase transition-all',
                    browserMode === 'packs'
                      ? 'border-orange-500/30 bg-orange-500/6 text-orange-500'
                      : 'border-white/8 bg-white/2 text-zinc-600 hover:border-white/14 hover:bg-white/4 hover:text-zinc-400'
                  ]}
                >
                  <Package class="h-3 w-3" />
                  <span>packs</span>
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content side="bottom">Enable or disable packs</Tooltip.Content>
            </Tooltip.Root>

            <!-- Presets toggle -->
            <Tooltip.Root delayDuration={100}>
              <Tooltip.Trigger>
                <button
                  onclick={() => (showPresets = !showPresets)}
                  disabled={browserMode === 'help' || browserMode === 'packs'}
                  class={[
                    'flex cursor-pointer items-center gap-[5px] rounded border px-2.5 py-1 font-mono text-[10px] tracking-[0.1em] whitespace-nowrap lowercase transition-all',
                    browserMode === 'help' || browserMode === 'packs'
                      ? 'cursor-not-allowed border-white/4 text-zinc-700 opacity-50'
                      : showPresets
                        ? 'border-orange-500/30 bg-orange-500/6 text-orange-500'
                        : 'border-white/8 bg-white/2 text-zinc-600 hover:border-white/14 hover:bg-white/4 hover:text-zinc-400'
                  ]}
                >
                  <Bookmark class="h-3 w-3" />
                  <span>presets</span>
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content side="bottom">
                {browserMode === 'help'
                  ? 'Presets hidden in help mode'
                  : browserMode === 'packs'
                    ? 'Switch to insert mode to browse presets'
                    : 'Show saved and enabled presets'}
              </Tooltip.Content>
            </Tooltip.Root>

            <!-- Help mode toggle -->
            <Tooltip.Root delayDuration={100}>
              <Tooltip.Trigger>
                <button
                  onclick={() => (browserMode = browserMode === 'help' ? 'insert' : 'help')}
                  class={[
                    'flex cursor-pointer items-center gap-[5px] rounded border px-2.5 py-1 font-mono text-[10px] tracking-[0.1em] whitespace-nowrap lowercase transition-all',
                    browserMode === 'help'
                      ? 'border-blue-400/30 bg-blue-400/6 text-blue-400'
                      : 'border-white/8 bg-white/2 text-zinc-600 hover:border-white/14 hover:bg-white/4 hover:text-zinc-400'
                  ]}
                >
                  <CircleQuestionMark class="h-3 w-3" />
                  <span>help</span>
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content side="bottom">
                {browserMode === 'help' ? 'Help mode active' : 'Browse help'}
              </Tooltip.Content>
            </Tooltip.Root>
          </div>
          <button
            onclick={handleClose}
            class="-my-2 -mr-1 shrink-0 cursor-pointer border-none bg-transparent p-3 font-mono text-base leading-none text-zinc-700 transition-colors hover:text-zinc-500"
            aria-label="Close modal">✕</button
          >
        </div>
      </div>

      <!-- Search bar -->
      <div class="relative z-[1] shrink-0 border-b border-white/4 px-5 py-2.5 sm:px-7 sm:py-3">
        <div class="relative flex items-center">
          <Search class="pointer-events-none absolute left-3 h-3.5 w-3.5 text-zinc-700" />
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="search objects and presets..."
            class="w-full rounded-md border border-white/6 bg-white/2 px-9 py-2 font-mono text-[13px] text-zinc-200 transition-colors outline-none placeholder:tracking-[0.04em] placeholder:text-zinc-700 focus:border-orange-500/25"
            id="ob-title"
          />

          {#if searchQuery}
            <button
              onclick={() => (searchQuery = '')}
              class="absolute right-2.5 cursor-pointer border-none bg-transparent p-0.5 text-zinc-600 transition-colors hover:text-zinc-400"
              aria-label="Clear search"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          {/if}
        </div>
      </div>

      <!-- Object list / Packs panel -->
      <div
        class="ob-scroll relative z-[1] flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5 sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        {#if browserMode === 'packs'}
          <div class="flex flex-col gap-5">
            <!-- Object Packs Section -->
            {#if filteredObjectPacks.length > 0}
              <div>
                <div class="mb-2 flex items-center justify-between">
                  <span
                    class="font-mono text-[10px] font-medium tracking-[0.14em] text-zinc-600 uppercase"
                    >Object Packs</span
                  >
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-[10px] text-zinc-700"
                      >{enabledCount}/{totalObjectCount}</span
                    >
                    {#if allObjectPacksEnabled}
                      <button
                        onclick={disableAllPacks}
                        class="cursor-pointer rounded border-none bg-transparent px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 transition-all hover:bg-white/5 hover:text-zinc-400"
                        >Reset</button
                      >
                    {:else}
                      <button
                        onclick={enableAllPacks}
                        class="cursor-pointer rounded border-none bg-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-200 transition-all hover:bg-zinc-600"
                        >All</button
                      >
                    {/if}
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {#each filteredObjectPacks as pack, i (pack.id)}
                    {@const expandedIdx = isSearching
                      ? -1
                      : filteredObjectPacks.findIndex((p) => p.id === expandedPackId)}
                    {@const cols = 3}
                    {@const isEndOfRow =
                      (i + 1) % cols === 0 || i === filteredObjectPacks.length - 1}
                    {@const expandedInThisRow =
                      expandedIdx >= 0 && Math.floor(expandedIdx / cols) === Math.floor(i / cols)}
                    {@const expandedPack = expandedInThisRow
                      ? filteredObjectPacks[expandedIdx]
                      : null}
                    <ExtensionPackCard
                      {pack}
                      enabled={isPackEnabled(pack.id, $enabledPackIds)}
                      onToggle={() => togglePack(pack.id)}
                      {searchQuery}
                      locked={isPackLocked(pack.id)}
                      variant="tile"
                      selected={!isSearching && expandedPackId === pack.id}
                      onSelect={() => togglePackExpansion(pack.id)}
                    />
                    {#if isEndOfRow && expandedPack}
                      <div
                        class="col-span-full rounded-lg border border-orange-500/15 bg-orange-500/3 p-3"
                      >
                        <div class="flex flex-wrap gap-1">
                          {#each expandedPack.objects as obj}
                            {@const isMatch =
                              searchQuery.trim() &&
                              obj.toLowerCase().includes(searchQuery.toLowerCase())}
                            <span
                              class={[
                                'rounded-[3px] px-1.5 py-0.5 font-mono text-[9px]',
                                isMatch
                                  ? 'bg-orange-500/15 text-orange-400'
                                  : 'bg-white/4 text-zinc-500'
                              ]}
                            >
                              {obj}
                            </span>
                          {/each}
                        </div>
                      </div>
                    {/if}
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Preset Packs Section -->
            {#if filteredPresetPacks.length > 0}
              <div>
                <div class="mb-2 flex items-center justify-between">
                  <span
                    class="font-mono text-[10px] font-medium tracking-[0.14em] text-zinc-600 uppercase"
                    >Preset Packs</span
                  >
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-[10px] text-zinc-700"
                      >{$enabledPresetPackIds.length}/{BUILT_IN_PRESET_PACKS.length}</span
                    >
                    {#if allPresetPacksEnabled}
                      <button
                        onclick={disableAllPresetPacks}
                        class="cursor-pointer rounded border-none bg-transparent px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 transition-all hover:bg-white/5 hover:text-zinc-400"
                        >Reset</button
                      >
                    {:else}
                      <button
                        onclick={enableAllPresetPacks}
                        class="cursor-pointer rounded border-none bg-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-200 transition-all hover:bg-zinc-600"
                        >All</button
                      >
                    {/if}
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {#each filteredPresetPacks as pack, i (pack.id)}
                    {@const expandedIdx = isSearching
                      ? -1
                      : filteredPresetPacks.findIndex((p) => p.id === expandedPackId)}

                    {@const cols = 3}

                    {@const isEndOfRow =
                      (i + 1) % cols === 0 || i === filteredPresetPacks.length - 1}

                    {@const expandedInThisRow =
                      expandedIdx >= 0 && Math.floor(expandedIdx / cols) === Math.floor(i / cols)}

                    {@const expandedPack = expandedInThisRow
                      ? filteredPresetPacks[expandedIdx]
                      : null}

                    <PresetPackCard
                      {pack}
                      enabled={isPresetPackEnabled(pack.id, $enabledPresetPackIds)}
                      onToggle={() => togglePresetPack(pack.id)}
                      {searchQuery}
                      locked={isPresetPackLocked(pack.id)}
                      variant="tile"
                      selected={!isSearching && expandedPackId === pack.id}
                      onSelect={() => togglePackExpansion(pack.id)}
                    />

                    {#if isEndOfRow && expandedPack}
                      <div
                        class="col-span-full rounded-lg border border-orange-500/15 bg-orange-500/3 p-3"
                      >
                        <div class="flex flex-wrap gap-1">
                          {#each expandedPack.presets as preset (preset)}
                            {@const isMatch =
                              searchQuery.trim() &&
                              preset.toLowerCase().includes(searchQuery.toLowerCase())}

                            <span
                              class={[
                                'rounded-[3px] px-1.5 py-0.5 font-mono text-[9px]',
                                isMatch
                                  ? 'bg-orange-500/15 text-orange-400'
                                  : 'bg-white/4 text-zinc-500'
                              ]}
                            >
                              {preset}
                            </span>
                          {/each}
                        </div>
                      </div>
                    {/if}
                  {/each}
                </div>
              </div>
            {/if}

            <!-- No results -->
            {#if filteredObjectPacks.length === 0 && filteredPresetPacks.length === 0}
              <div class="flex h-full flex-col items-center justify-center gap-3 text-center">
                <SearchX class="h-10 w-10 text-zinc-800" />
                <p class="font-mono text-xs tracking-[0.04em] text-zinc-600">
                  No packs match "{searchQuery}"
                </p>
              </div>
            {/if}
          </div>
        {:else if filteredCategories.length === 0}
          <div class="flex h-full flex-col items-center justify-center gap-3 text-center">
            <SearchX class="h-10 w-10 text-zinc-800" />
            <p class="font-mono text-xs tracking-[0.04em] text-zinc-600">
              No objects found for "{searchQuery}"
            </p>

            {#if suggestedDisabledObject}
              <DisabledObjectSuggestion
                name={suggestedDisabledObject.name}
                packName={suggestedDisabledObject.packName}
                packIcon={suggestedDisabledObject.packIcon}
                onBrowsePacks={openPacks}
                onEnableAndAdd={() => {
                  enablePackAndSelect(suggestedDisabledObject.packId, suggestedDisabledObject.name);
                }}
              />
            {:else}
              <button
                onclick={openPacks}
                class="flex cursor-pointer items-center gap-2 rounded-md border border-white/8 bg-transparent px-4 py-2 font-mono text-xs text-zinc-500 transition-all hover:border-orange-500/25 hover:text-zinc-400"
              >
                <Package class="h-4 w-4" />
                <span>Browse Packs</span>
              </button>
            {/if}
          </div>
        {:else}
          <div class="flex flex-col gap-2">
            {#each filteredCategories as category (category.title)}
              {@const isCategoryPreset = category.isPresetCategory === true}
              {@const IconComponent = getIconComponent(category.icon)}

              <div>
                <!-- Category header -->
                <button
                  onclick={() => toggleCategory(category.title)}
                  class="mb-1 flex w-full cursor-pointer items-center justify-between rounded border-none bg-transparent px-1.5 py-[5px] transition-colors hover:bg-white/2"
                >
                  <div class="flex items-center gap-2">
                    <div
                      class="flex h-[18px] w-[18px] shrink-0 items-center justify-center text-zinc-500"
                    >
                      <IconComponent class="h-3 w-3" />
                    </div>
                    <span
                      class={[
                        'font-mono text-[10px] tracking-[0.14em] uppercase',
                        isCategoryPreset ? 'text-zinc-600' : 'text-zinc-500'
                      ]}
                    >
                      {category.title}
                    </span>
                    <span class="font-mono text-[9px] tracking-[0.05em] text-zinc-600"
                      >{category.objects.length}</span
                    >
                  </div>
                  <ChevronDown
                    class={[
                      'h-3.5 w-3.5 text-zinc-600 transition-transform',
                      expandedCategories.has(category.title) ? '' : '-rotate-90'
                    ]}
                  />
                </button>

                <!-- Objects grid -->
                {#if expandedCategories.has(category.title)}
                  <div class="mb-1 grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4">
                    {#each category.objects as object (object.name)}
                      {@const isPreset = category.isPresetCategory === true}
                      {@const isLowPriority = object.priority === 'low'}
                      {@const objectHasHelp = hasHelp(object.name)}
                      {@const noHelpAvailable = browserMode === 'help' && !objectHasHelp}

                      <div class="group relative flex">
                        <button
                          onclick={() => {
                            if (noHelpAvailable) return;
                            if (browserMode === 'help') {
                              openHelp(object.name);
                            } else {
                              handleSelectObject(object.name);
                            }
                          }}
                          disabled={noHelpAvailable}
                          class={[
                            'flex h-full w-full cursor-pointer flex-col gap-1 rounded-md border px-2.5 py-2 text-left transition-all',
                            noHelpAvailable
                              ? 'cursor-not-allowed border-white/2 bg-transparent opacity-30'
                              : browserMode === 'help'
                                ? 'border-blue-400/15 bg-blue-400/3 hover:border-blue-400/30 hover:bg-blue-400/7'
                                : isPreset
                                  ? 'border-white/7 bg-white/2 hover:border-white/12 hover:bg-white/4'
                                  : 'border-white/7 bg-white/2 hover:border-orange-500/30 hover:bg-orange-500/5',
                            isLowPriority && !noHelpAvailable && 'opacity-45'
                          ]}
                        >
                          <div class="flex items-center gap-[5px]">
                            {#if browserMode === 'help'}
                              <CircleQuestionMark
                                class={[
                                  'h-3 w-3',
                                  noHelpAvailable ? 'text-zinc-600' : 'text-blue-400'
                                ]}
                              />
                            {/if}
                            <span
                              class={[
                                'font-mono text-xs leading-tight',
                                noHelpAvailable
                                  ? 'text-zinc-600'
                                  : browserMode === 'help'
                                    ? 'text-blue-200'
                                    : isPreset
                                      ? 'text-zinc-300'
                                      : 'text-zinc-100'
                              ]}>{object.name}</span
                            >
                          </div>

                          <span
                            class={[
                              'line-clamp-2 text-[11px] leading-[1.4] text-zinc-500',
                              noHelpAvailable && 'text-zinc-700'
                            ]}
                          >
                            {object.description}
                          </span>

                          {#if isLowPriority && !noHelpAvailable}
                            <span class="font-mono text-[9px] tracking-[0.08em] text-zinc-600"
                              >disabled</span
                            >
                          {/if}
                        </button>

                        <!-- Help hover button (insert mode, desktop) -->
                        {#if browserMode === 'insert' && objectHasHelp}
                          <button
                            onclick={(e) => {
                              e.stopPropagation();
                              openHelp(object.name);
                            }}
                            class="absolute top-1.5 right-1.5 hidden cursor-pointer rounded border-none bg-transparent p-1 text-zinc-600 opacity-0 transition-all group-hover:opacity-100 hover:bg-white/6 hover:text-zinc-400 sm:block"
                            title="Open help for {object.name}"
                          >
                            <CircleQuestionMark class="h-3.5 w-3.5" />
                          </button>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}

            <!-- Enable more packs CTA -->
            <button
              onclick={() => (browserMode = 'packs')}
              class="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/6 bg-transparent py-3.5 font-mono text-[10px] tracking-[0.12em] text-zinc-700 lowercase transition-all hover:border-orange-500/20 hover:text-zinc-500"
            >
              <Package class="h-4 w-4" />
              <span>enable more object packs</span>
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes ob-fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes ob-card-in {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .ob-scroll::-webkit-scrollbar {
    width: 5px;
  }
  .ob-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .ob-scroll::-webkit-scrollbar-thumb {
    background: #27272a;
    border-radius: 3px;
  }
  .ob-scroll::-webkit-scrollbar-thumb:hover {
    background: #3f3f46;
  }
</style>
