<script lang="ts">
  import {
    ArrowLeft,
    ArrowRight,
    Bookmark,
    Boxes,
    ChevronDown,
    CircleQuestionMark,
    Package,
    Search,
    SearchX,
    X
  } from '@lucide/svelte/icons';
  import Fuse from 'fuse.js';
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';
  import {
    getCategorizedObjects,
    type CategoryGroup,
    type ObjectItem
  } from './get-categorized-objects';
  import {
    isAiFeaturesVisible,
    isSidebarOpen,
    objectBrowserMode,
    patchObjectTypes,
    selectedNodeInfo,
    sidebarView
  } from '../../../stores/ui.store';
  import { flattenedPresets } from '../../../stores/preset-library.store';
  import {
    enabledObjects,
    enabledPresets,
    enabledPackIds,
    enabledPresetPackIds,
    BUILT_IN_PACKS,
    BUILT_IN_PRESET_PACKS,
    BULK_ENABLE_PACK_IDS,
    BULK_ENABLE_PRESET_PACK_IDS,
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
  import { getPackIcon } from '$lib/extensions/pack-icons';
  import {
    getBuiltInPresetPackByPresetName,
    getPresetPackPresetNames
  } from '$lib/presets/preset-pack-index';
  import { formatPresetLocation } from '$lib/presets/preset-utils';
  import DisabledObjectSuggestion from './DisabledObjectSuggestion.svelte';
  import ExtensionPackCard from '../sidebar/ExtensionPackCard.svelte';
  import PresetPackCard from '../sidebar/PresetPackCard.svelte';
  import {
    useDisabledObjectSuggestion,
    type DisabledObjectInfo
  } from '$lib/composables/useDisabledObjectSuggestion.svelte';
  import { objectSchemas } from '$lib/objects/schemas';

  type CatalogKind = 'objects' | 'presets';

  let {
    open = $bindable(false),
    onSelectObject,
    onClose = () => {}
  }: {
    open?: boolean;
    onSelectObject: (name: string) => void | Promise<void>;
    onClose?: () => void;
  } = $props();

  let searchQuery = $state('');
  let searchInput = $state<HTMLInputElement>();
  let catalogKind = $state<CatalogKind>('objects');
  let selectedCategoryId = $state<string | null>(null);
  let expandedPackId = $state<string | null>(null);
  let mobileCategoryOpen = $state(false);

  const getIconComponent = getPackIcon;

  function hasHelp(objectName: string): boolean {
    return objectName in objectSchemas;
  }

  function openHelp(objectName: string) {
    $isSidebarOpen = true;
    $sidebarView = 'help';
    $selectedNodeInfo = { type: objectName, id: 'browser' };
    handleClose();
  }

  const objectCategories = $derived(
    getCategorizedObjects($isAiFeaturesVisible, $enabledObjects, $patchObjectTypes)
  );

  const { searchDisabledObject } = useDisabledObjectSuggestion(
    () => $enabledPackIds,
    () => $isAiFeaturesVisible
  );

  const presetCategories = $derived.by((): CategoryGroup[] => {
    const presetsByCategory = new SvelteMap<string, ObjectItem[]>();
    const categoryIconMap = new SvelteMap<string, string>();
    const categoryIdMap = new SvelteMap<string, string>();

    for (const flatPreset of $flattenedPresets) {
      const { preset, libraryName, path } = flatPreset;

      if (!$enabledObjects.has(preset.type)) continue;
      if (libraryName === 'Built-in' && !$enabledPresets.has(preset.name)) continue;

      const presetPack =
        libraryName === 'Built-in' ? getBuiltInPresetPackByPresetName(preset.name) : undefined;

      const typeFolder = path.length > 2 ? path[1] : preset.type;

      const categoryKey =
        libraryName === 'Built-in'
          ? (presetPack?.name ?? typeFolder)
          : formatPresetLocation(flatPreset);

      const categoryId =
        libraryName === 'Built-in'
          ? `preset-pack:${presetPack?.id ?? categoryKey}`
          : `preset-library:${categoryKey}`;

      if (!presetsByCategory.has(categoryKey)) {
        presetsByCategory.set(categoryKey, []);
        categoryIdMap.set(categoryKey, categoryId);
        const pack = BUILT_IN_PACKS.find((candidate) => candidate.objects.includes(preset.type));
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
      return aOrder === bOrder ? a.localeCompare(b) : aOrder - bOrder;
    });

    return sortedCategories.map((category) => {
      const presetPack = BUILT_IN_PRESET_PACKS.find((pack) => pack.name === category);

      return {
        id: categoryIdMap.get(category)!,
        title: category,
        icon: categoryIconMap.get(category) || 'Package',
        description: presetPack?.description,
        isPresetCategory: true,
        objects: presetsByCategory.get(category)!
      };
    });
  });

  const catalogCategories = $derived(
    catalogKind === 'objects' || $objectBrowserMode === 'help' ? objectCategories : presetCategories
  );

  const fuse = $derived(
    new Fuse(
      catalogCategories.flatMap((category) =>
        category.objects.map((object) => ({
          ...object,
          categoryId: category.id
        }))
      ),
      {
        keys: ['name', 'description', 'category'],
        threshold: 0.3,
        includeScore: true
      }
    )
  );

  const filteredCategories = $derived.by(() => {
    if (!searchQuery.trim()) return catalogCategories;

    const results = sortFuseResultsWithPrefixPriority(
      fuse.search(searchQuery),
      searchQuery,
      (item) => item.name,
      (a, b) => {
        if (a.item.priority !== b.item.priority) {
          return a.item.priority === 'normal' ? -1 : 1;
        }
        return 0;
      }
    );

    const matchesByCategory = new SvelteMap<string, ObjectItem[]>();
    const categoryOrder = new SvelteMap<string, number>();

    results.forEach((result, index) => {
      const categoryId = result.item.categoryId;

      if (!matchesByCategory.has(categoryId)) matchesByCategory.set(categoryId, []);
      if (!categoryOrder.has(categoryId)) categoryOrder.set(categoryId, index);

      matchesByCategory.get(categoryId)!.push({
        name: result.item.name,
        description: result.item.description,
        category: result.item.category,
        priority: result.item.priority
      });
    });

    return catalogCategories
      .map((category) => ({
        ...category,
        objects: matchesByCategory.get(category.id) || []
      }))
      .filter((category) => category.objects.length > 0)
      .toSorted(
        (a, b) =>
          (categoryOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (categoryOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER)
      );
  });

  const activeCategory = $derived(
    filteredCategories.find((category) => category.id === selectedCategoryId) ??
      filteredCategories[0] ??
      null
  );

  const suggestedDisabledObject = $derived.by((): DisabledObjectInfo | null => {
    if (catalogKind !== 'objects' || $objectBrowserMode !== 'insert' || !searchQuery.trim()) {
      return null;
    }

    if (filteredCategories.length > 0) return null;

    return searchDisabledObject(searchQuery);
  });

  const filteredObjectPacks = $derived.by(() => {
    if (!searchQuery.trim()) return BUILT_IN_PACKS;

    const query = searchQuery.toLowerCase();

    return BUILT_IN_PACKS.filter(
      (pack) =>
        pack.name.toLowerCase().includes(query) ||
        pack.description.toLowerCase().includes(query) ||
        pack.objects.some((object) => object.toLowerCase().includes(query))
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

  const visiblePackCount = $derived(
    catalogKind === 'objects' ? filteredObjectPacks.length : filteredPresetPacks.length
  );

  const totalObjectCount = $derived.by(() => {
    const objects = new SvelteSet<string>();

    for (const pack of BUILT_IN_PACKS) {
      for (const object of pack.objects) objects.add(object);
    }

    return objects.size;
  });

  const enabledObjectCount = $derived($enabledPrimaryObjects.size);

  const allObjectPacksEnabled = $derived(
    BULK_ENABLE_PACK_IDS.every((packId) => $enabledPackIds.includes(packId))
  );

  const allPresetPacksEnabled = $derived(
    BULK_ENABLE_PRESET_PACK_IDS.every((packId) => $enabledPresetPackIds.includes(packId))
  );

  const onboardingPackCount = $derived(
    catalogKind === 'objects'
      ? $enabledPackIds.filter((packId) => !isPackLocked(packId)).length < 3
        ? BUILT_IN_PACKS.filter(
            (pack) => !isPackLocked(pack.id) && !isPackEnabled(pack.id, $enabledPackIds)
          ).length
        : 0
      : $enabledPresetPackIds.filter((packId) => !isPresetPackLocked(packId)).length < 3
        ? BUILT_IN_PRESET_PACKS.filter(
            (pack) =>
              !isPresetPackLocked(pack.id) && !isPresetPackEnabled(pack.id, $enabledPresetPackIds)
          ).length
        : 0
  );

  const hasEnabledOptionalObjectPacks = $derived(
    $enabledPackIds.some((packId) => !isPackLocked(packId))
  );

  const hasEnabledOptionalPresetPacks = $derived(
    $enabledPresetPackIds.some((packId) => !isPresetPackLocked(packId))
  );

  const expandedObjectPack = $derived(
    catalogKind === 'objects'
      ? (BUILT_IN_PACKS.find((pack) => pack.id === expandedPackId) ?? null)
      : null
  );

  const expandedPresetPack = $derived(
    catalogKind === 'presets'
      ? (BUILT_IN_PRESET_PACKS.find((pack) => pack.id === expandedPackId) ?? null)
      : null
  );

  const expandedPackItems = $derived(
    expandedObjectPack?.objects ??
      (expandedPresetPack ? getPresetPackPresetNames(expandedPresetPack) : [])
  );

  const expandedPackName = $derived(expandedObjectPack?.name ?? expandedPresetPack?.name ?? '');

  const expandedPackDescription = $derived(
    expandedObjectPack?.description ?? expandedPresetPack?.description ?? ''
  );

  const ExpandedPackIcon = $derived(
    getIconComponent(expandedObjectPack?.icon ?? expandedPresetPack?.icon ?? 'package')
  );

  const hasExpandedPack = $derived(Boolean(expandedObjectPack || expandedPresetPack));

  const dialogTitle = $derived(
    $objectBrowserMode === 'packs'
      ? 'Manage library'
      : $objectBrowserMode === 'help'
        ? 'Explore object help'
        : 'Add to patch'
  );

  const searchPlaceholder = $derived(
    $objectBrowserMode === 'packs'
      ? `Search ${catalogKind === 'objects' ? 'object' : 'preset'} packs`
      : $objectBrowserMode === 'help'
        ? 'Search object help'
        : `Search ${catalogKind}`
  );

  $effect(() => {
    if (!open || $objectBrowserMode === 'packs') return;

    const frame = requestAnimationFrame(() => {
      if (window.matchMedia('(pointer: fine)').matches) {
        searchInput?.focus();
        searchInput?.select();
      }
    });

    return () => cancelAnimationFrame(frame);
  });

  function selectCatalogKind(kind: CatalogKind) {
    catalogKind = kind;
    selectedCategoryId = null;
    expandedPackId = null;
    mobileCategoryOpen = false;
  }

  function selectMobileCategory(categoryId: string) {
    selectedCategoryId = categoryId;
    mobileCategoryOpen = false;
  }

  function openPacks() {
    $objectBrowserMode = 'packs';
    expandedPackId = null;
    searchQuery = '';
  }

  function closePacks() {
    $objectBrowserMode = 'insert';
    expandedPackId = null;
    searchQuery = '';
  }

  function toggleHelpMode() {
    if ($objectBrowserMode === 'help') {
      $objectBrowserMode = 'insert';
    } else {
      catalogKind = 'objects';
      $objectBrowserMode = 'help';
    }
  }

  function handleClose() {
    open = false;
    searchQuery = '';
    expandedPackId = null;
    mobileCategoryOpen = false;
    $objectBrowserMode = 'insert';
    onClose();
  }

  async function handleSelectObject(name: string) {
    await onSelectObject(name);
    handleClose();
  }

  function enablePackAndSelect(packId: string, objectName: string) {
    togglePack(packId);
    setTimeout(() => handleSelectObject(objectName), 50);
  }

  function togglePackExpansion(packId: string) {
    expandedPackId = expandedPackId === packId ? null : packId;
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (open && event.key === 'Escape') handleClose();
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if open}
  <div
    class="pt-safe pr-safe pb-safe pl-safe fixed inset-0 z-50 flex items-center justify-center"
    role="presentation"
  >
    <div
      class="fixed inset-0 animate-[ob-fade_0.18s_ease_both] bg-black/80"
      onclick={handleClose}
      aria-hidden="true"
    ></div>

    <div
      class="relative z-10 m-0 flex h-full w-full max-w-[1040px] animate-[ob-card-in_0.2s_cubic-bezier(0.22,0.61,0.36,1)_both] flex-col overflow-hidden rounded-none border border-white/12 bg-[#101012] shadow-[0_24px_80px_rgba(0,0,0,0.58)] outline-none sm:m-4 sm:h-[88dvh] sm:max-h-[820px] sm:rounded-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="object-browser-title"
      tabindex="-1"
    >
      <header
        class="relative z-[2] flex min-h-[60px] shrink-0 items-center gap-4 border-b border-white/7 px-4 py-2 sm:min-h-[72px] sm:px-6 sm:py-3"
      >
        {#if $objectBrowserMode === 'packs'}
          <button
            type="button"
            onclick={closePacks}
            class="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md border border-white/8 bg-white/[0.025] text-zinc-400 transition-colors outline-none hover:border-white/16 hover:text-zinc-100 focus-visible:border-orange-500/70"
            aria-label="Back to catalog"
          >
            <ArrowLeft class="h-4 w-4" />
          </button>
        {/if}

        <div class="min-w-0 flex-1">
          <h2
            id="object-browser-title"
            class="truncate text-[17px] leading-tight font-medium text-zinc-100"
          >
            {dialogTitle}
          </h2>
          <p class="mt-1 truncate text-[11px] text-zinc-500 max-[360px]:hidden">
            {$objectBrowserMode === 'packs'
              ? 'Choose which objects and presets appear in your catalog.'
              : $objectBrowserMode === 'help'
                ? 'Browse object documentation.'
                : 'Browse Patchies objects.'}
          </p>
        </div>

        <div class="flex shrink-0 items-center gap-1.5">
          {#if $objectBrowserMode !== 'packs'}
            <button
              type="button"
              onclick={openPacks}
              aria-label={`Manage library${onboardingPackCount ? `: enable ${onboardingPackCount} more ${catalogKind === 'objects' ? 'object' : 'preset'} packs` : ''}`}
              class={[
                'flex h-9 cursor-pointer items-center rounded-md border px-3 text-left transition-colors outline-none focus-visible:border-orange-500/70',
                onboardingPackCount > 0
                  ? 'gap-2 border-white/10 bg-white/[0.025] text-zinc-100 hover:border-orange-500/30 hover:bg-orange-500/[0.045]'
                  : 'gap-2 border-white/8 bg-white/[0.025] text-zinc-500 hover:border-white/16 hover:text-zinc-200'
              ]}
            >
              {#if onboardingPackCount > 0}
                <Package class="h-4 w-4 shrink-0 text-orange-500" />

                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[11px] font-medium text-zinc-100 sm:text-[12px]">
                    <span class="sm:hidden">{onboardingPackCount} more packs</span>
                    <span class="hidden sm:inline"
                      >{onboardingPackCount} more {catalogKind === 'objects' ? 'object' : 'preset'} packs</span
                    >
                  </span>
                </span>
                <ArrowRight class="h-4 w-4 shrink-0 text-orange-500" />
              {:else}
                <Package class="h-3.5 w-3.5 shrink-0" />

                <span class="min-w-0 flex-1 truncate text-[12px] font-medium">Manage library</span>
              {/if}
            </button>
          {/if}
          <button
            type="button"
            onclick={handleClose}
            class="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent text-zinc-500 transition-colors outline-none hover:bg-white/5 hover:text-zinc-100 focus-visible:border-orange-500/70"
            aria-label="Close object browser"
          >
            <X class="h-5 w-5" />
          </button>
        </div>
      </header>

      <div class="relative z-[1] shrink-0 border-b border-white/7 px-4 py-2 sm:px-6 sm:py-3">
        <label for="object-browser-search" class="sr-only">{searchPlaceholder}</label>
        <div class="relative flex items-center">
          <Search class="pointer-events-none absolute left-3.5 h-4 w-4 text-zinc-500" />
          <input
            id="object-browser-search"
            bind:this={searchInput}
            type="search"
            bind:value={searchQuery}
            placeholder={searchPlaceholder}
            class="h-11 w-full rounded-lg border border-white/9 bg-white/[0.035] pr-11 pl-10 font-mono text-[13px] text-zinc-100 transition-colors outline-none placeholder:text-zinc-600 focus:border-orange-500/45 focus:bg-white/[0.05]"
          />
          {#if searchQuery}
            <button
              type="button"
              onclick={() => (searchQuery = '')}
              class="absolute right-1.5 flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors outline-none hover:bg-white/5 hover:text-zinc-100 focus-visible:text-orange-400"
              aria-label="Clear search"
            >
              <X class="h-4 w-4" />
            </button>
          {/if}
        </div>
      </div>

      {#if $objectBrowserMode === 'packs'}
        <section class="flex min-h-0 flex-1 flex-col" aria-label="Library packs">
          <div
            class="flex shrink-0 flex-col gap-2 border-b border-white/7 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-3"
          >
            <div class="grid grid-cols-2 rounded-lg border border-white/8 bg-black/15 p-0.5 sm:p-1">
              <button
                type="button"
                onclick={() => selectCatalogKind('objects')}
                aria-pressed={catalogKind === 'objects'}
                class={[
                  'flex h-10 min-w-32 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-[11px] font-medium transition-colors outline-none focus-visible:ring-1 focus-visible:ring-orange-500/70 sm:h-8',
                  catalogKind === 'objects'
                    ? 'bg-white/8 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-200'
                ]}
              >
                <Boxes class="h-4 w-4" />
                Object Packs
              </button>
              <button
                type="button"
                onclick={() => selectCatalogKind('presets')}
                aria-pressed={catalogKind === 'presets'}
                class={[
                  'flex h-10 min-w-32 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-[11px] font-medium transition-colors outline-none focus-visible:ring-1 focus-visible:ring-orange-500/70 sm:h-8',
                  catalogKind === 'presets'
                    ? 'bg-white/8 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-200'
                ]}
              >
                <Bookmark class="h-4 w-4" />
                Preset Packs
              </button>
            </div>

            <div
              class="grid grid-cols-[minmax(0,1fr)_auto] items-stretch rounded-md border border-white/8 bg-black/15 p-0.5 sm:flex sm:items-center sm:justify-end sm:gap-4 sm:border-0 sm:bg-transparent sm:p-0"
            >
              <span class="flex items-center px-3 font-mono text-[10px] text-zinc-500 sm:hidden">
                {catalogKind === 'objects'
                  ? `${enabledObjectCount}/${totalObjectCount} enabled`
                  : `${$enabledPresetPackIds.length}/${BUILT_IN_PRESET_PACKS.length} enabled`}
              </span>
              <span class="hidden font-mono text-[10px] text-zinc-500 sm:inline">
                {catalogKind === 'objects'
                  ? `${enabledObjectCount}/${totalObjectCount} objects enabled`
                  : `${$enabledPresetPackIds.length}/${BUILT_IN_PRESET_PACKS.length} packs enabled`}
              </span>
              <div
                class="grid grid-cols-2 border-l border-white/8 sm:rounded-md sm:border sm:border-white/8 sm:bg-black/15 sm:p-1"
              >
                <button
                  type="button"
                  onclick={catalogKind === 'objects' ? disableAllPacks : disableAllPresetPacks}
                  disabled={catalogKind === 'objects'
                    ? !hasEnabledOptionalObjectPacks
                    : !hasEnabledOptionalPresetPacks}
                  class="h-10 cursor-pointer rounded px-3 text-[10px] font-medium text-zinc-500 transition-colors outline-none hover:bg-white/[0.05] hover:text-zinc-200 focus-visible:ring-1 focus-visible:ring-orange-500/70 disabled:cursor-not-allowed disabled:opacity-35 sm:h-7"
                >
                  Disable all
                </button>

                <button
                  type="button"
                  onclick={catalogKind === 'objects' ? enableAllPacks : enableAllPresetPacks}
                  disabled={catalogKind === 'objects'
                    ? allObjectPacksEnabled
                    : allPresetPacksEnabled}
                  class="h-10 cursor-pointer rounded bg-white/[0.045] px-3 text-[10px] font-medium text-zinc-300 transition-colors outline-none hover:bg-white/[0.075] hover:text-zinc-100 focus-visible:ring-1 focus-visible:ring-orange-500/70 disabled:cursor-not-allowed disabled:opacity-35 sm:h-7"
                >
                  Enable all
                </button>
              </div>
            </div>
          </div>

          <div class="relative flex min-h-0 flex-1">
            <div class="ob-scroll min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {#if visiblePackCount === 0}
                <div class="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
                  <SearchX class="h-9 w-9 text-zinc-700" />
                  <p class="text-sm text-zinc-400">No {catalogKind} packs match “{searchQuery}”.</p>
                  <button
                    type="button"
                    onclick={() => (searchQuery = '')}
                    class="h-11 cursor-pointer rounded-md border border-white/10 px-4 text-xs text-zinc-300 hover:bg-white/5"
                    >Clear search</button
                  >
                </div>
              {:else}
                <div class="grid grid-cols-1 gap-2 min-[430px]:grid-cols-2">
                  {#if catalogKind === 'objects'}
                    {#each filteredObjectPacks as pack (pack.id)}
                      <ExtensionPackCard
                        {pack}
                        enabled={isPackEnabled(pack.id, $enabledPackIds)}
                        onToggle={() => togglePack(pack.id)}
                        {searchQuery}
                        locked={isPackLocked(pack.id)}
                        variant="tile"
                        selected={expandedPackId === pack.id}
                        onSelect={() => togglePackExpansion(pack.id)}
                      />
                    {/each}
                  {:else}
                    {#each filteredPresetPacks as pack (pack.id)}
                      <PresetPackCard
                        {pack}
                        enabled={isPresetPackEnabled(pack.id, $enabledPresetPackIds)}
                        onToggle={() => togglePresetPack(pack.id)}
                        {searchQuery}
                        locked={isPresetPackLocked(pack.id)}
                        variant="tile"
                        selected={expandedPackId === pack.id}
                        onSelect={() => togglePackExpansion(pack.id)}
                      />
                    {/each}
                  {/if}
                </div>
              {/if}
            </div>

            {#if hasExpandedPack}
              <button
                type="button"
                onclick={() => (expandedPackId = null)}
                class="absolute inset-0 z-10 cursor-pointer bg-black/65 sm:hidden"
                aria-label="Dismiss pack contents"
              ></button>
            {/if}

            <aside
              class={[
                'absolute inset-x-3 bottom-3 z-20 max-h-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-xl border border-white/12 bg-zinc-950 shadow-[0_18px_50px_rgba(0,0,0,0.55)] sm:static sm:z-auto sm:flex sm:w-[300px] sm:shrink-0 sm:rounded-none sm:border-y-0 sm:border-r-0 sm:border-l sm:bg-black/15 sm:shadow-none',
                hasExpandedPack ? 'flex' : 'hidden'
              ]}
              aria-label={hasExpandedPack ? `${expandedPackName} contents` : 'Pack contents'}
            >
              {#if hasExpandedPack}
                <div class="shrink-0 border-b border-white/7 p-4">
                  <div class="flex items-start gap-3">
                    <div
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/9 bg-white/[0.045] text-zinc-300"
                    >
                      <ExpandedPackIcon class="h-4 w-4" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <h3 class="truncate text-sm font-medium text-zinc-100">{expandedPackName}</h3>
                      <p class="mt-0.5 font-mono text-[9px] text-zinc-600">
                        {expandedPackItems.length}
                        {catalogKind === 'objects' ? 'objects' : 'presets'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onclick={() => (expandedPackId = null)}
                      class="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-500 outline-none hover:bg-white/5 hover:text-zinc-100 focus-visible:ring-1 focus-visible:ring-orange-500/70 sm:h-9 sm:w-9"
                      aria-label="Close pack contents"
                    >
                      <X class="h-4 w-4" />
                    </button>
                  </div>
                  <p class="mt-3 text-[11px] leading-relaxed text-zinc-500">
                    {expandedPackDescription}
                  </p>
                </div>

                <div class="ob-scroll min-h-0 flex-1 overflow-y-auto p-3">
                  <div class="flex flex-col gap-1">
                    {#each expandedPackItems as item, index (item)}
                      <div
                        class="flex min-h-9 items-center gap-3 rounded-md border border-white/6 bg-white/[0.025] px-3 py-2"
                      >
                        <span class="w-5 shrink-0 text-right font-mono text-[8px] text-zinc-700">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span class="min-w-0 font-mono text-[10px] text-zinc-300">{item}</span>
                      </div>
                    {/each}
                  </div>
                </div>
              {:else}
                <div
                  class="flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center"
                >
                  <div
                    class="flex h-10 w-10 items-center justify-center rounded-lg border border-white/7 bg-white/[0.025] text-zinc-600"
                  >
                    {#if catalogKind === 'objects'}
                      <Boxes class="h-4 w-4" />
                    {:else}
                      <Bookmark class="h-4 w-4" />
                    {/if}
                  </div>
                  <h3 class="mt-4 text-sm font-medium text-zinc-300">Select a pack</h3>
                  <p class="mt-1.5 max-w-44 text-[11px] leading-relaxed text-zinc-600">
                    Choose a card to inspect the {catalogKind === 'objects' ? 'objects' : 'presets'}
                    it contains.
                  </p>
                </div>
              {/if}
            </aside>
          </div>
        </section>
      {:else}
        <div class="ob-catalog min-h-0 flex-1">
          {#if mobileCategoryOpen}
            <button
              type="button"
              class="ob-mobile-category-dismiss"
              onclick={() => (mobileCategoryOpen = false)}
              tabindex="-1"
              aria-hidden="true"
            ></button>
          {/if}

          <nav class="ob-catalog-nav" aria-label="Object browser categories">
            <div class="ob-workspace-switch" aria-label="Catalog workspace">
              <button
                type="button"
                onclick={() => selectCatalogKind('objects')}
                aria-pressed={catalogKind === 'objects' || $objectBrowserMode === 'help'}
                class:ob-workspace-active={catalogKind === 'objects' ||
                  $objectBrowserMode === 'help'}
                disabled={$objectBrowserMode === 'help'}
              >
                <Boxes class="h-4 w-4" />
                <span>Objects</span>
                <span class="ob-workspace-count">{objectCategories.length}</span>
              </button>
              <button
                type="button"
                onclick={() => selectCatalogKind('presets')}
                aria-pressed={catalogKind === 'presets'}
                class:ob-workspace-active={catalogKind === 'presets'}
                disabled={$objectBrowserMode === 'help'}
              >
                <Bookmark class="h-4 w-4" />
                <span>Presets</span>
                <span class="ob-workspace-count">{presetCategories.length}</span>
              </button>
            </div>

            {#if activeCategory}
              {@const MobileCategoryIcon = getIconComponent(activeCategory.icon)}
              <div class="ob-mobile-category-picker">
                <button
                  type="button"
                  class="ob-mobile-category-trigger"
                  onclick={() => (mobileCategoryOpen = !mobileCategoryOpen)}
                  aria-expanded={mobileCategoryOpen}
                  aria-controls="object-browser-category-menu"
                >
                  <MobileCategoryIcon class="h-4 w-4 shrink-0 text-zinc-400" />
                  <span class="min-w-0 flex-1 truncate text-left">{activeCategory.title}</span>
                  <span class="ob-mobile-category-count">{activeCategory.objects.length}</span>
                  <ChevronDown
                    class={[
                      'h-4 w-4 shrink-0 text-zinc-500 transition-transform',
                      mobileCategoryOpen && 'rotate-180'
                    ]}
                  />
                </button>

                {#if mobileCategoryOpen}
                  <div
                    id="object-browser-category-menu"
                    class="ob-mobile-category-menu"
                    role="menu"
                    aria-label={catalogKind === 'objects'
                      ? 'Object categories'
                      : 'Preset categories'}
                  >
                    {#each filteredCategories as category (category.id)}
                      {@const CategoryMenuIcon = getIconComponent(category.icon)}
                      <button
                        type="button"
                        role="menuitem"
                        onclick={() => selectMobileCategory(category.id)}
                        aria-current={activeCategory.id === category.id ? 'true' : undefined}
                        class:ob-mobile-category-active={activeCategory.id === category.id}
                      >
                        <span class="ob-mobile-category-icon">
                          <CategoryMenuIcon class="h-4 w-4" />
                        </span>
                        <span class="min-w-0 flex-1 truncate">{category.title}</span>
                        <span class="ob-mobile-category-count">{category.objects.length}</span>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}

            <div class="ob-category-list" aria-label={`${catalogKind} categories`}>
              {#each filteredCategories as category (category.id)}
                {@const CategoryIcon = getIconComponent(category.icon)}
                <button
                  type="button"
                  onclick={() => (selectedCategoryId = category.id)}
                  aria-current={activeCategory?.id === category.id ? 'true' : undefined}
                  class:ob-category-active={activeCategory?.id === category.id}
                >
                  <CategoryIcon class="h-4 w-4 shrink-0" />
                  <span>{category.title}</span>
                  <span class="ob-category-count">{category.objects.length}</span>
                </button>
              {/each}
            </div>
          </nav>

          <section class="ob-results" aria-live="polite">
            {#if activeCategory}
              {@const ActiveIcon = getIconComponent(activeCategory.icon)}
              <header class="ob-results-header">
                <div class="flex min-w-0 items-center gap-3">
                  <div
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/8 bg-white/[0.035] text-zinc-400"
                  >
                    <ActiveIcon class="h-4 w-4" />
                  </div>
                  <div class="min-w-0">
                    <h3 class="truncate text-sm font-medium text-zinc-100">
                      {activeCategory.title}
                    </h3>
                    <p class="mt-0.5 text-[11px] text-zinc-500">
                      {activeCategory.description ??
                        `${activeCategory.objects.length} ${catalogKind === 'objects' ? 'objects' : 'presets'} ready to add`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onclick={toggleHelpMode}
                  aria-pressed={$objectBrowserMode === 'help'}
                  aria-label={$objectBrowserMode === 'help'
                    ? 'Exit help mode'
                    : 'Browse object help'}
                  class={[
                    'flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors outline-none focus-visible:border-blue-400/70',
                    $objectBrowserMode === 'help'
                      ? 'border-blue-400/35 bg-blue-400/8 text-blue-300'
                      : 'border-white/8 bg-white/[0.025] text-zinc-500 hover:border-white/16 hover:text-zinc-200'
                  ]}
                >
                  <CircleQuestionMark class="h-4 w-4" />
                </button>
              </header>

              <div class="ob-scroll min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
                <div class="grid grid-cols-2 gap-2 min-[720px]:grid-cols-3 min-[960px]:grid-cols-4">
                  {#each activeCategory.objects as object (object.name)}
                    {@const isPreset = catalogKind === 'presets'}
                    {@const isLowPriority = object.priority === 'low'}
                    {@const objectHasHelp = hasHelp(object.name)}
                    {@const noHelpAvailable = $objectBrowserMode === 'help' && !objectHasHelp}

                    <div class="group relative flex min-w-0">
                      <button
                        type="button"
                        onclick={() => {
                          if (noHelpAvailable) return;
                          if ($objectBrowserMode === 'help') openHelp(object.name);
                          else handleSelectObject(object.name);
                        }}
                        disabled={noHelpAvailable}
                        class={[
                          'flex min-h-[84px] w-full cursor-pointer flex-col gap-1.5 rounded-lg border px-3 py-3 text-left transition-colors outline-none focus-visible:border-orange-500/60 focus-visible:bg-orange-500/[0.055] disabled:cursor-not-allowed',
                          noHelpAvailable
                            ? 'border-white/4 bg-transparent opacity-30'
                            : $objectBrowserMode === 'help'
                              ? 'border-blue-400/15 bg-blue-400/[0.025] hover:border-blue-400/35 hover:bg-blue-400/[0.06]'
                              : isPreset
                                ? 'border-white/8 bg-white/[0.025] hover:border-white/16 hover:bg-white/[0.055]'
                                : 'border-white/8 bg-white/[0.025] hover:border-orange-500/35 hover:bg-orange-500/[0.045]',
                          isLowPriority && !noHelpAvailable && 'opacity-50'
                        ]}
                      >
                        <div class="flex items-center gap-1.5 pr-5">
                          {#if $objectBrowserMode === 'help'}
                            <CircleQuestionMark
                              class={[
                                'h-3.5 w-3.5 shrink-0',
                                noHelpAvailable ? 'text-zinc-600' : 'text-blue-400'
                              ]}
                            />
                          {/if}
                          <span
                            class={[
                              'min-w-0 font-mono text-[12px] leading-tight break-words',
                              noHelpAvailable
                                ? 'text-zinc-600'
                                : $objectBrowserMode === 'help'
                                  ? 'text-blue-200'
                                  : 'text-zinc-100'
                            ]}>{object.name}</span
                          >
                        </div>
                        <span
                          class={[
                            'line-clamp-2 text-[11px] leading-[1.45] text-zinc-500',
                            noHelpAvailable && 'text-zinc-700'
                          ]}>{object.description}</span
                        >
                        {#if isLowPriority && !noHelpAvailable}
                          <span class="mt-auto font-mono text-[9px] text-zinc-600">disabled</span>
                        {/if}
                      </button>

                      {#if $objectBrowserMode === 'insert' && objectHasHelp && !isPreset}
                        <button
                          type="button"
                          onclick={(event) => {
                            event.stopPropagation();
                            openHelp(object.name);
                          }}
                          class="absolute top-1 right-1 hidden h-9 w-9 cursor-pointer items-center justify-center rounded-md text-zinc-600 opacity-0 transition-all outline-none group-hover:opacity-100 hover:bg-white/7 hover:text-zinc-200 focus-visible:flex focus-visible:text-orange-400 sm:flex"
                          aria-label={`Open help for ${object.name}`}
                        >
                          <CircleQuestionMark class="h-3.5 w-3.5" />
                        </button>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {:else}
              <div
                class="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
              >
                <SearchX class="h-10 w-10 text-zinc-700" />
                <div>
                  <h3 class="text-sm font-medium text-zinc-200">
                    No {catalogKind} found for “{searchQuery}”
                  </h3>
                  <p class="mt-1 text-xs text-zinc-500">
                    Try another search or enable more content in your library.
                  </p>
                </div>

                {#if suggestedDisabledObject}
                  <DisabledObjectSuggestion
                    name={suggestedDisabledObject.name}
                    packName={suggestedDisabledObject.packName}
                    packIcon={suggestedDisabledObject.packIcon}
                    onBrowsePacks={openPacks}
                    onEnableAndAdd={() =>
                      enablePackAndSelect(
                        suggestedDisabledObject.packId,
                        suggestedDisabledObject.name
                      )}
                  />
                {:else}
                  <button
                    type="button"
                    onclick={openPacks}
                    class="flex h-11 cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-white/[0.035] px-4 text-xs text-zinc-300 outline-none hover:border-white/18 hover:bg-white/[0.06] focus-visible:border-orange-500/70"
                  >
                    <Package class="h-4 w-4" />
                    Manage library
                  </button>
                {/if}
              </div>
            {/if}
          </section>
        </div>
      {/if}
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
      transform: translateY(14px) scale(0.985);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  #object-browser-search::-webkit-search-cancel-button,
  #object-browser-search::-webkit-search-decoration {
    appearance: none;
    -webkit-appearance: none;
  }

  #object-browser-search::-ms-clear {
    display: none;
  }

  .ob-catalog {
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr);
  }

  .ob-catalog-nav {
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    border-right: 1px solid rgba(255, 255, 255, 0.07);
    background: #0d0d0f;
  }

  .ob-workspace-switch {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .ob-workspace-switch button {
    display: flex;
    min-width: 0;
    height: 36px;
    cursor: pointer;
    align-items: center;
    justify-content: flex-start;
    gap: 6px;
    padding-inline: 12px;
    border: 1px solid transparent;
    border-radius: 6px;
    color: #71717a;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 11px;
    font-weight: 500;
    outline: none;
    transition:
      color 150ms ease,
      background 150ms ease,
      border-color 150ms ease;
  }

  .ob-workspace-switch button:hover:not(:disabled) {
    color: #d4d4d8;
    background: rgba(255, 255, 255, 0.04);
  }

  .ob-workspace-switch button:focus-visible {
    border-color: rgba(249, 115, 22, 0.7);
  }

  .ob-workspace-switch button:disabled {
    cursor: not-allowed;
  }

  .ob-workspace-switch .ob-workspace-active {
    border-color: rgba(255, 255, 255, 0.09);
    color: #f4f4f5;
    background: rgba(255, 255, 255, 0.07);
  }

  .ob-workspace-count {
    margin-left: auto;
    color: #52525b;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
  }

  .ob-mobile-category-picker {
    display: none;
  }

  .ob-mobile-category-dismiss {
    display: none;
  }

  .ob-category-list {
    min-height: 0;
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .ob-category-list button {
    display: flex;
    width: 100%;
    min-height: 44px;
    cursor: pointer;
    align-items: center;
    gap: 9px;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 8px 9px;
    color: #71717a;
    text-align: left;
    outline: none;
    transition:
      color 150ms ease,
      background 150ms ease,
      border-color 150ms ease;
  }

  .ob-category-list button:hover {
    color: #d4d4d8;
    background: rgba(255, 255, 255, 0.035);
  }

  .ob-category-list button:focus-visible {
    border-color: rgba(249, 115, 22, 0.65);
  }

  .ob-category-list button :global(svg) {
    color: #71717a;
  }

  .ob-category-list button > span:nth-child(2) {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 11px;
    font-weight: 400;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ob-category-list .ob-category-active {
    border-color: rgba(249, 115, 22, 0.25);
    color: #fafafa;
    background: rgba(249, 115, 22, 0.07);
  }

  .ob-category-list .ob-category-active :global(svg) {
    color: #f97316;
  }

  .ob-category-count {
    color: #52525b;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
  }

  .ob-results {
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    background: #111113;
  }

  .ob-results-header {
    display: flex;
    min-height: 68px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    background: #111113;
  }

  .ob-scroll::-webkit-scrollbar,
  .ob-category-list::-webkit-scrollbar {
    width: 5px;
    height: 5px;
  }

  .ob-scroll::-webkit-scrollbar-track,
  .ob-category-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .ob-scroll::-webkit-scrollbar-thumb,
  .ob-category-list::-webkit-scrollbar-thumb {
    border-radius: 3px;
    background: #3f3f46;
  }

  @media (max-width: 639px) {
    .ob-catalog {
      position: relative;
      display: flex;
      min-height: 0;
      flex-direction: column;
    }

    .ob-catalog-nav {
      position: relative;
      z-index: 3;
      display: grid;
      min-height: 48px;
      flex: 0 0 auto;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      gap: 8px;
      padding: 4px 12px;
      border-right: 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    }

    .ob-workspace-switch {
      gap: 2px;
      padding: 2px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.15);
    }

    .ob-workspace-switch button {
      height: 38px;
      justify-content: center;
      gap: 5px;
      padding-inline: 10px;
    }

    .ob-workspace-count {
      display: none;
    }

    .ob-mobile-category-picker {
      position: static;
      display: flex;
      min-width: 0;
      align-items: center;
    }

    .ob-mobile-category-trigger {
      display: flex;
      width: 100%;
      height: 38px;
      cursor: pointer;
      align-items: center;
      gap: 8px;
      overflow: hidden;
      padding: 0 10px;
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 8px;
      color: #d4d4d8;
      background: rgba(255, 255, 255, 0.035);
      font-family: 'IBM Plex Sans', sans-serif;
      font-size: 11px;
      font-weight: 500;
      outline: none;
    }

    .ob-mobile-category-trigger:focus-visible {
      border-color: rgba(249, 115, 22, 0.7);
      box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.12);
    }

    .ob-mobile-category-count {
      flex: 0 0 auto;
      color: #52525b;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 9px;
    }

    .ob-mobile-category-menu {
      position: absolute;
      z-index: 5;
      top: calc(100% + 1px);
      right: 12px;
      left: 12px;
      display: grid;
      max-height: min(55dvh, 420px);
      gap: 2px;
      overflow-y: auto;
      padding: 6px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      background: #18181b;
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
      scrollbar-width: thin;
      scrollbar-color: #3f3f46 transparent;
    }

    .ob-mobile-category-menu button {
      display: flex;
      min-height: 48px;
      cursor: pointer;
      align-items: center;
      gap: 10px;
      padding: 6px 10px;
      border: 1px solid transparent;
      border-radius: 7px;
      color: #a1a1aa;
      font-size: 12px;
      text-align: left;
      outline: none;
    }

    .ob-mobile-category-menu button:hover,
    .ob-mobile-category-menu button:focus-visible {
      color: #f4f4f5;
      background: rgba(255, 255, 255, 0.05);
    }

    .ob-mobile-category-menu button:focus-visible {
      border-color: rgba(249, 115, 22, 0.55);
    }

    .ob-mobile-category-icon {
      display: flex;
      width: 30px;
      height: 30px;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      color: #71717a;
      background: rgba(255, 255, 255, 0.025);
    }

    .ob-mobile-category-menu .ob-mobile-category-active {
      color: #fafafa;
      background: rgba(255, 255, 255, 0.07);
    }

    .ob-mobile-category-menu .ob-mobile-category-active .ob-mobile-category-icon {
      border-color: rgba(249, 115, 22, 0.2);
      color: #f97316;
      background: rgba(249, 115, 22, 0.07);
    }

    .ob-mobile-category-dismiss {
      position: absolute;
      z-index: 2;
      inset: 0;
      display: block;
      cursor: default;
      border: 0;
      background: rgba(0, 0, 0, 0.46);
    }

    .ob-category-list {
      display: none;
    }

    .ob-results-header {
      min-height: 60px;
      gap: 8px;
      padding: 9px 12px;
    }

    .ob-results-header > :global(div:first-child) {
      gap: 8px;
    }
  }

  @media (max-width: 360px) {
    .ob-workspace-switch button {
      padding-inline: 8px;
    }

    .ob-results :global(.grid) {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
