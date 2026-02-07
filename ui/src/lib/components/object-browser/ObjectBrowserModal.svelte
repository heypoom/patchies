<script lang="ts">
  import {
    ChevronDown,
    Search,
    SearchX,
    X,
    Bookmark,
    ChevronRight,
    Package,
    CircleHelp
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
    BUILT_IN_PACKS,
    togglePack
  } from '../../../stores/extensions.store';
  import { sortFuseResultsWithPrefixPriority } from '$lib/utils/sort-fuse-results';
  import { isSidebarOpen, sidebarView } from '../../../stores/ui.store';
  import { getPackIcon } from '$lib/extensions/pack-icons';
  import DisabledObjectSuggestion from './DisabledObjectSuggestion.svelte';
  import {
    useDisabledObjectSuggestion,
    type DisabledObjectInfo
  } from '$lib/composables/useDisabledObjectSuggestion.svelte';
  import { objectSchemas } from '$lib/objects/schemas';

  type BrowserMode = 'insert' | 'help';

  function openPacks() {
    $sidebarView = 'packs';
    $isSidebarOpen = true;
    open = false;
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
    // Check if schema exists or if help patch file exists
    // For now, just check schema registry
    return objectName in objectSchemas;
  }

  // Open help for an object
  function openHelp(objectName: string) {
    window.location.href = `?help=${encodeURIComponent(objectName)}`;
  }

  // Get all categorized objects, filtering AI features and by enabled extensions
  // Objects in the current patch but not enabled are included as low priority
  const allCategories = $derived(
    getCategorizedObjects($isAiFeaturesVisible, $enabledObjects, $patchObjectTypes)
  );

  // Composable for searching disabled objects
  const { searchDisabledObject } = useDisabledObjectSuggestion(
    () => $enabledPackIds,
    () => $isAiFeaturesVisible
  );

  // Get preset categories grouped by library and type
  // Presets are ONLY visible if explicitly enabled via preset packs
  const presetCategories = $derived.by((): CategoryGroup[] => {
    const presetsByCategory = new Map<string, ObjectItem[]>();
    const categoryIconMap = new Map<string, string>(); // Track icon for each category

    for (const flatPreset of $flattenedPresets) {
      const { preset, libraryName, path } = flatPreset;

      // Always require the object type to be enabled
      if (!$enabledObjects.has(preset.type)) {
        continue;
      }

      // For built-in presets: also require the preset to be in an enabled preset pack
      if (libraryName === 'Built-in' && !$enabledPresets.has(preset.name)) {
        continue;
      }

      // Get the type folder (second element in path after library id)
      const typeFolder = path.length > 2 ? path[1] : preset.type;
      const categoryKey = `${libraryName}: ${typeFolder}`;

      if (!presetsByCategory.has(categoryKey)) {
        presetsByCategory.set(categoryKey, []);
        // Look up icon from pack for this object type
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

    // Sort presets within each category alphabetically
    for (const presets of presetsByCategory.values()) {
      presets.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Sort categories alphabetically
    const sortedCategories = Array.from(presetsByCategory.keys()).sort();

    return sortedCategories.map((category) => ({
      title: category,
      icon: categoryIconMap.get(category) || 'Package',
      objects: presetsByCategory.get(category)!
    }));
  });

  // Combined categories: objects first, then presets
  const allCategoriesWithPresets = $derived(
    showPresets ? [...allCategories, ...presetCategories] : allCategories
  );

  // Create Fuse instance for fuzzy search - update when categories change
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

  // Filtered categories based on search
  const filteredCategories = $derived.by(() => {
    if (!searchQuery.trim()) {
      return allCategoriesWithPresets;
    }

    const results = fuse.search(searchQuery);

    // Sort results: prefix matches first, then by priority, then by Fuse score
    const sortedResults = sortFuseResultsWithPrefixPriority(
      results,
      searchQuery,
      (item) => item.name,
      (a, b) => {
        // Low priority items always come last
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

    // When searching, order categories by which has best matches (first match position)
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

  // Find matching disabled objects when search has no results
  const suggestedDisabledObject = $derived.by((): DisabledObjectInfo | null => {
    if (!searchQuery.trim()) return null;
    if (filteredCategories.length > 0) return null;

    return searchDisabledObject(searchQuery);
  });

  function enablePackAndSelect(packId: string, objectName: string) {
    togglePack(packId);

    // Small delay to let the store update, then select the object
    setTimeout(() => {
      handleSelectObject(objectName);
    }, 50);
  }

  function handleClose() {
    open = false;
    searchQuery = '';
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

  // Initialize with all categories expanded (only once per open)
  $effect(() => {
    if (open && !hasInitialized) {
      expandedCategories = new Set(allCategoriesWithPresets.map((cat) => cat.title));
      hasInitialized = true;
    } else if (!open) {
      hasInitialized = false;
    }
  });

  // Auto-expand categories when searching (only when search is active)
  $effect(() => {
    if (searchQuery.trim() && filteredCategories.length > 0) {
      expandedCategories = new Set(filteredCategories.map((cat) => cat.title));
    }
  });

  // Handle global escape key
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
</script>

{#if open}
  <!-- Modal backdrop -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center font-sans"
    role="presentation"
    onclick={(e) => {
      // Close if clicking on the backdrop (not the modal content)
      if (e.target === e.currentTarget) {
        handleClose();
      }
    }}
  >
    <!-- Backdrop overlay -->
    <div
      class="pointer-events-none fixed inset-0 bg-black/60 backdrop-blur-sm"
      aria-hidden="true"
    ></div>

    <!-- Modal container -->
    <div
      class="relative z-10 flex h-screen w-full flex-col overflow-hidden bg-zinc-950 sm:mx-4 sm:h-[85vh] sm:max-w-4xl sm:rounded-lg sm:border sm:border-zinc-700 sm:shadow-2xl md:mx-8 lg:mx-12"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <!-- Header with close button -->
      <div
        class="flex items-center justify-between border-b border-zinc-800 px-4 pt-10 pb-3 sm:px-6 sm:pt-4"
      >
        <h2 id="modal-title" class="text-lg font-medium text-zinc-200">Browse Objects</h2>
        <button
          onclick={handleClose}
          class="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Close modal"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <!-- Search bar -->
      <div class="border-b border-zinc-800 px-4 py-3 sm:px-6">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div class="relative flex-1">
            <Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              bind:value={searchQuery}
              placeholder="Search objects..."
              class="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pr-4 pl-10 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
            />
            {#if searchQuery}
              <button
                onclick={() => (searchQuery = '')}
                class="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                aria-label="Clear search"
              >
                <X class="h-4 w-4" />
              </button>
            {/if}
          </div>

          <!-- Filter buttons -->
          <div class="flex gap-2">
            <!-- Mode toggle (Insert/Help) -->
            <div class="flex overflow-hidden rounded-lg border border-zinc-700">
              <button
                onclick={() => (browserMode = 'insert')}
                class={[
                  'flex cursor-pointer items-center gap-1.5 px-3 text-sm leading-[36px] transition-colors',
                  browserMode === 'insert'
                    ? 'bg-zinc-700 text-zinc-200'
                    : 'bg-zinc-900 text-zinc-500 hover:text-zinc-400'
                ]}
              >
                Insert
              </button>
              <button
                onclick={() => (browserMode = 'help')}
                class={[
                  'flex cursor-pointer items-center gap-1.5 px-3 text-sm leading-[36px] transition-colors',
                  browserMode === 'help'
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-900 text-zinc-500 hover:text-zinc-400'
                ]}
              >
                <CircleHelp class="h-4 w-4" />
                Help
              </button>
            </div>

            <!-- Packs button (navigates to sidebar) -->
            <button
              onclick={openPacks}
              class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm leading-[36px] text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-400 sm:flex-none"
            >
              <Package class="h-4 w-4" />
              <span>Packs</span>
              <ChevronRight class="-ml-0.5 h-3.5 w-3.5" />
            </button>

            <!-- Presets toggle -->
            <button
              onclick={() => (showPresets = !showPresets)}
              class={[
                'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 text-sm leading-[36px] transition-colors sm:flex-none',
                showPresets
                  ? 'border-violet-500/30 bg-violet-500/10 text-violet-300'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-500 hover:text-zinc-400'
              ]}
            >
              <Bookmark class="h-4 w-4" />
              <span>Presets</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Object categories -->
      <div class="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {#if filteredCategories.length === 0}
          <div class="flex h-full items-center justify-center text-zinc-500">
            <div class="text-center">
              <SearchX class="mx-auto mb-2 h-12 w-12" />
              <p class="mb-6">No enabled objects found for "{searchQuery}"</p>

              {#if suggestedDisabledObject}
                <DisabledObjectSuggestion
                  name={suggestedDisabledObject.name}
                  packName={suggestedDisabledObject.packName}
                  packIcon={suggestedDisabledObject.packIcon}
                  onBrowsePacks={openPacks}
                  onEnableAndAdd={() => {
                    enablePackAndSelect(
                      suggestedDisabledObject.packId,
                      suggestedDisabledObject.name
                    );
                  }}
                />
              {:else}
                <button
                  onclick={openPacks}
                  class="mx-auto flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
                >
                  <Package class="h-4 w-4" />
                  <span>Browse Packs</span>
                </button>
              {/if}
            </div>
          </div>
        {:else}
          <div class="space-y-4">
            {#each filteredCategories as category (category.title)}
              {@const isCategoryPreset = category.title.includes(': ')}
              {@const IconComponent = getIconComponent(category.icon)}
              <div>
                <!-- Category header -->
                <button
                  onclick={() => toggleCategory(category.title)}
                  class="mb-2 flex w-full items-center justify-between rounded-lg px-2 py-2 text-left transition-colors hover:bg-zinc-900"
                >
                  <div class="flex items-center gap-2">
                    <div
                      class={[
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded',
                        isCategoryPreset ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-800 text-zinc-400'
                      ]}
                    >
                      <IconComponent class="h-3.5 w-3.5" />
                    </div>
                    <span
                      class={[
                        'text-sm font-medium',
                        isCategoryPreset ? 'text-zinc-500' : 'text-zinc-300'
                      ]}
                    >
                      {category.title}
                    </span>
                    <span class="text-xs text-zinc-600">({category.objects.length})</span>
                  </div>
                  <ChevronDown
                    class={[
                      'h-4 w-4 text-zinc-500 transition-transform',
                      expandedCategories.has(category.title) ? '' : '-rotate-90'
                    ]}
                  />
                </button>

                <!-- Category objects grid -->
                {#if expandedCategories.has(category.title)}
                  <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {#each category.objects as object (object.name)}
                      {@const isPreset = category.title.includes(': ')}
                      {@const isLowPriority = object.priority === 'low'}
                      {@const objectHasHelp = hasHelp(object.name)}

                      <div class="group relative">
                        <button
                          onclick={() => {
                            if (browserMode === 'help') {
                              openHelp(object.name);
                            } else {
                              handleSelectObject(object.name);
                            }
                          }}
                          class={[
                            'flex w-full cursor-pointer flex-col gap-1 rounded-lg border p-3 text-left transition-colors',
                            browserMode === 'help'
                              ? 'border-blue-500/30 bg-blue-500/5 hover:border-blue-500/50 hover:bg-blue-500/10'
                              : isPreset
                                ? 'border-zinc-700/50 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-800/70'
                                : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800',
                            isLowPriority && 'opacity-50'
                          ]}
                        >
                          <div class="flex items-center gap-1.5">
                            {#if browserMode === 'help'}
                              <CircleHelp class="h-3.5 w-3.5 text-blue-400" />
                            {/if}
                            <span
                              class={[
                                'font-mono text-sm',
                                browserMode === 'help'
                                  ? 'text-blue-200'
                                  : isPreset
                                    ? 'text-zinc-300'
                                    : 'text-zinc-200'
                              ]}>{object.name}</span
                            >
                          </div>

                          <span class="line-clamp-2 text-xs text-zinc-500"
                            >{object.description}</span
                          >

                          {#if isLowPriority}
                            <span class="font-mono text-[10px] text-zinc-600">disabled</span>
                          {/if}
                        </button>

                        <!-- Help icon on hover (only in insert mode, desktop only) -->
                        {#if browserMode === 'insert' && objectHasHelp}
                          <button
                            onclick={(e) => {
                              e.stopPropagation();
                              openHelp(object.name);
                            }}
                            class="absolute top-2 right-2 hidden rounded p-1 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 hover:text-zinc-300 sm:block"
                            title="Open help for {object.name}"
                          >
                            <CircleHelp class="h-4 w-4" />
                          </button>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}

            <!-- CTA to enable more packs -->
            <button
              onclick={openPacks}
              class="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 py-6 text-zinc-500 transition-colors hover:border-zinc-600 hover:bg-zinc-900/50 hover:text-zinc-400"
            >
              <Package class="h-5 w-5" />
              <span>Enable more object packs</span>
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /* Custom scrollbar styling */
  :global(.overflow-y-auto::-webkit-scrollbar) {
    width: 8px;
  }

  :global(.overflow-y-auto::-webkit-scrollbar-track) {
    background: rgb(39 39 42); /* zinc-800 */
  }

  :global(.overflow-y-auto::-webkit-scrollbar-thumb) {
    background: rgb(63 63 70); /* zinc-700 */
    border-radius: 4px;
  }

  :global(.overflow-y-auto::-webkit-scrollbar-thumb:hover) {
    background: rgb(82 82 91); /* zinc-600 */
  }
</style>
