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
  import DisabledObjectSuggestion from './DisabledObjectSuggestion.svelte';
  import ExtensionPackCard from '../sidebar/ExtensionPackCard.svelte';
  import PresetPackCard from '../sidebar/PresetPackCard.svelte';
  import {
    useDisabledObjectSuggestion,
    type DisabledObjectInfo
  } from '$lib/composables/useDisabledObjectSuggestion.svelte';
  import { objectSchemas } from '$lib/objects/schemas';
  import * as Tooltip from '$lib/components/ui/tooltip';

  import './object-browser.css';

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

      const typeFolder = path.length > 2 ? path[1] : preset.type;
      const categoryKey = `${libraryName}: ${typeFolder}`;

      if (!presetsByCategory.has(categoryKey)) {
        presetsByCategory.set(categoryKey, []);
        const pack = BUILT_IN_PACKS.find((p) => p.objects.includes(preset.type));
        categoryIconMap.set(categoryKey, pack?.icon || 'Package');
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

    const sortedCategories = Array.from(presetsByCategory.keys()).sort();

    return sortedCategories.map((category) => ({
      title: category,
      icon: categoryIconMap.get(category) || 'Package',
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
          isPreset: cat.title.includes(': ')
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
        pack.presets.some((preset) => preset.toLowerCase().includes(query))
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
  <div class="ob-root" role="presentation">
    <!-- Backdrop -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="ob-backdrop"
      role="button"
      tabindex="-1"
      onclick={handleClose}
      aria-label="Close modal"
    ></div>

    <!-- Modal container -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="ob-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ob-title"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Corner ornaments -->
      <span class="oc oc-tl" aria-hidden="true"></span>
      <span class="oc oc-tr" aria-hidden="true"></span>
      <span class="oc oc-bl" aria-hidden="true"></span>
      <span class="oc oc-br" aria-hidden="true"></span>

      <!-- Radial glow -->
      <div class="ob-glow" aria-hidden="true"></div>

      <!-- Header -->
      <div class="ob-header">
        <span class="ob-eyebrow">patchies · objects</span>
        <div class="ob-header-right">
          <div class="ob-filter-chips">
            <!-- Packs button -->
            <Tooltip.Root delayDuration={100}>
              <Tooltip.Trigger>
                <button
                  onclick={() => (browserMode = browserMode === 'packs' ? 'insert' : 'packs')}
                  class={['ob-chip', browserMode === 'packs' ? 'ob-chip-active' : 'ob-chip-action']}
                >
                  <Package class="h-3 w-3" />
                  <span>packs</span>
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content side="bottom">Enable or disable object packs</Tooltip.Content>
            </Tooltip.Root>

            <!-- Presets toggle -->
            <Tooltip.Root delayDuration={100}>
              <Tooltip.Trigger>
                <button
                  onclick={() => (showPresets = !showPresets)}
                  disabled={browserMode === 'help' || browserMode === 'packs'}
                  class={[
                    'ob-chip',
                    browserMode === 'help' || browserMode === 'packs'
                      ? 'ob-chip-disabled'
                      : showPresets
                        ? 'ob-chip-active'
                        : 'ob-chip-action'
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
                    ? 'Presets hidden in packs mode'
                    : 'Show saved presets?'}
              </Tooltip.Content>
            </Tooltip.Root>

            <!-- Help mode toggle -->
            <Tooltip.Root delayDuration={100}>
              <Tooltip.Trigger>
                <button
                  onclick={() => (browserMode = browserMode === 'help' ? 'insert' : 'help')}
                  class={['ob-chip', browserMode === 'help' ? 'ob-chip-help' : 'ob-chip-action']}
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
          <button onclick={handleClose} class="ob-close" aria-label="Close modal">✕</button>
        </div>
      </div>

      <!-- Search bar -->
      <div class="ob-search-wrap">
        <div class="ob-search-inner">
          <Search class="ob-search-icon" />
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="search objects..."
            class="ob-search-input"
            id="ob-title"
          />
          {#if searchQuery}
            <button
              onclick={() => (searchQuery = '')}
              class="ob-search-clear"
              aria-label="Clear search"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          {/if}
        </div>
      </div>

      <!-- Object list / Packs panel -->
      <div class="ob-body">
        {#if browserMode === 'packs'}
          <div class="ob-packs-panel">
            <!-- Object Packs Section -->
            {#if filteredObjectPacks.length > 0}
              <div>
                <div class="ob-packs-section-header">
                  <span class="ob-packs-section-title">Object Packs</span>
                  <div class="ob-packs-section-actions">
                    <span class="ob-packs-section-count">{enabledCount}/{totalObjectCount}</span>
                    {#if allObjectPacksEnabled}
                      <button onclick={disableAllPacks} class="ob-packs-reset-btn">Reset</button>
                    {:else}
                      <button onclick={enableAllPacks} class="ob-packs-all-btn">All</button>
                    {/if}
                  </div>
                </div>
                <div>
                  {#each filteredObjectPacks as pack (pack.id)}
                    <ExtensionPackCard
                      {pack}
                      enabled={isPackEnabled(pack.id, $enabledPackIds)}
                      onToggle={() => togglePack(pack.id)}
                      {searchQuery}
                      locked={isPackLocked(pack.id)}
                    />
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Preset Packs Section -->
            {#if filteredPresetPacks.length > 0}
              <div>
                <div class="ob-packs-section-header">
                  <span class="ob-packs-section-title">Preset Packs</span>
                  <div class="ob-packs-section-actions">
                    <span class="ob-packs-section-count"
                      >{$enabledPresetPackIds.length}/{BUILT_IN_PRESET_PACKS.length}</span
                    >
                    {#if allPresetPacksEnabled}
                      <button onclick={disableAllPresetPacks} class="ob-packs-reset-btn"
                        >Reset</button
                      >
                    {:else}
                      <button onclick={enableAllPresetPacks} class="ob-packs-all-btn">All</button>
                    {/if}
                  </div>
                </div>
                <div>
                  {#each filteredPresetPacks as pack (pack.id)}
                    <PresetPackCard
                      {pack}
                      enabled={isPresetPackEnabled(pack.id, $enabledPresetPackIds)}
                      onToggle={() => togglePresetPack(pack.id)}
                      {searchQuery}
                      locked={isPresetPackLocked(pack.id)}
                    />
                  {/each}
                </div>
              </div>
            {/if}

            <!-- No results -->
            {#if filteredObjectPacks.length === 0 && filteredPresetPacks.length === 0}
              <div class="ob-empty">
                <SearchX class="ob-empty-icon" />
                <p class="ob-empty-text">No packs match "{searchQuery}"</p>
              </div>
            {/if}
          </div>
        {:else if filteredCategories.length === 0}
          <div class="ob-empty">
            <SearchX class="ob-empty-icon" />
            <p class="ob-empty-text">No objects found for "{searchQuery}"</p>

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
              <button onclick={openPacks} class="ob-empty-btn">
                <Package class="h-4 w-4" />
                <span>Browse Packs</span>
              </button>
            {/if}
          </div>
        {:else}
          <div class="ob-categories">
            {#each filteredCategories as category (category.title)}
              {@const isCategoryPreset = category.title.includes(': ')}
              {@const IconComponent = getIconComponent(category.icon)}

              <div class="ob-category">
                <!-- Category header -->
                <button onclick={() => toggleCategory(category.title)} class="ob-cat-header">
                  <div class="ob-cat-header-left">
                    <div class="ob-cat-icon">
                      <IconComponent class="h-3 w-3" />
                    </div>
                    <span class={['ob-cat-title', isCategoryPreset && 'ob-cat-title-preset']}>
                      {category.title}
                    </span>
                    <span class="ob-cat-count">{category.objects.length}</span>
                  </div>
                  <ChevronDown
                    class={[
                      'ob-cat-chevron',
                      expandedCategories.has(category.title) ? '' : '-rotate-90'
                    ]}
                  />
                </button>

                <!-- Objects grid -->
                {#if expandedCategories.has(category.title)}
                  <div class="ob-grid">
                    {#each category.objects as object (object.name)}
                      {@const isPreset = category.title.includes(': ')}
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
                            'ob-obj',
                            noHelpAvailable
                              ? 'ob-obj-disabled'
                              : browserMode === 'help'
                                ? 'ob-obj-help'
                                : isPreset
                                  ? 'ob-obj-preset'
                                  : 'ob-obj-default',
                            isLowPriority && !noHelpAvailable && 'ob-obj-low'
                          ]}
                        >
                          <div class="ob-obj-name-row">
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
                                'ob-obj-name',
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

                          <span class={['ob-obj-desc', noHelpAvailable && 'text-zinc-700']}>
                            {object.description}
                          </span>

                          {#if isLowPriority && !noHelpAvailable}
                            <span class="ob-obj-badge">disabled</span>
                          {/if}
                        </button>

                        <!-- Help hover button (insert mode, desktop) -->
                        {#if browserMode === 'insert' && objectHasHelp}
                          <button
                            onclick={(e) => {
                              e.stopPropagation();
                              openHelp(object.name);
                            }}
                            class="ob-help-hover hidden sm:block"
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
            <button onclick={() => (browserMode = 'packs')} class="ob-packs-cta">
              <Package class="h-4 w-4" />
              <span>enable more object packs</span>
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
