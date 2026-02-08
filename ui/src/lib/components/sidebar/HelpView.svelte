<script lang="ts">
  import {
    ExternalLink,
    ArrowLeft,
    CircleQuestionMark,
    Play,
    Lock,
    LockOpen,
    BookOpen,
    ChevronDown,
    ChevronRight
  } from '@lucide/svelte/icons';
  import SearchBar from './SearchBar.svelte';
  import { objectSchemas, type ObjectSchema } from '$lib/objects/schemas';
  import TriggerTypeSpecifiers from './TriggerTypeSpecifiers.svelte';
  import PortCard from '$lib/components/docs/PortCard.svelte';
  import { selectedNodeInfo } from '../../../stores/ui.store';
  import { useObjectHelp } from '$lib/composables/useObjectHelp.svelte';
  import { useTopicHelp } from '$lib/composables/useTopicHelp.svelte';
  import { topicMetas, categoryOrder } from '$lib/docs/topic-index';
  import type { TopicMeta } from '$lib/docs/topic-index';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { enabledObjects } from '../../../stores/extensions.store';
  import { BUILT_IN_PACKS } from '$lib/extensions/object-packs';
  import { helpViewStore } from '../../../stores/help-view.store';

  // Build object order map from packs for sorting
  const objectOrderMap = new Map<string, number>();
  let orderIndex = 0;
  for (const pack of BUILT_IN_PACKS) {
    for (const obj of pack.objects) {
      objectOrderMap.set(obj, orderIndex++);
    }
  }

  let searchQuery = $state('');

  let manualViewingObject = $state<string | null>(null);
  let manualViewingTopic = $state<string | null>(null);
  let browseModeOverride = $state(false); // When true, show list even if node is selected

  // Persisted state from store
  const persistedState = $derived($helpViewStore);
  const isLocked = $derived(persistedState.isLocked);
  const lastViewedType = $derived(persistedState.lastViewedType);
  const lastViewedTopic = $derived(persistedState.lastViewedTopic);
  const guidesExpanded = $derived(persistedState.guidesExpanded);
  const objectsExpanded = $derived(persistedState.objectsExpanded);

  // Reset browse mode when a new node is selected on canvas (unless locked)
  $effect(() => {
    if ($selectedNodeInfo && !isLocked) {
      browseModeOverride = false;
      manualViewingObject = null;
      manualViewingTopic = null;
    }
  });

  // Auto-show help for selected node, or use manual selection
  const viewingObject = $derived.by((): string | null => {
    if (browseModeOverride) return null;
    if (manualViewingTopic) return null; // Topic takes precedence
    if (manualViewingObject) return manualViewingObject;

    // When locked on a topic, don't show object
    if (isLocked && lastViewedTopic) return null;

    // When locked, stay on the last viewed object
    if (isLocked && lastViewedType) return lastViewedType;
    if ($selectedNodeInfo?.type) return $selectedNodeInfo.type;

    // When deselected, keep showing the last viewed object
    if (lastViewedType) return lastViewedType;

    return null;
  });

  // Track which topic is being viewed
  const viewingTopic = $derived.by((): string | null => {
    if (browseModeOverride) return null;
    if (manualViewingTopic) return manualViewingTopic;

    // When locked on a topic, stay on it
    if (isLocked && lastViewedTopic) return lastViewedTopic;

    return null;
  });

  // Track last viewed type/topic for persistence
  $effect(() => {
    if (viewingObject) {
      helpViewStore.setLastViewedType(viewingObject);
    }
  });

  $effect(() => {
    if (viewingTopic) {
      helpViewStore.setLastViewedTopic(viewingTopic);
    }
  });

  // Fetch help content reactively
  const helpContent = useObjectHelp(() => viewingObject);
  const topicContent = useTopicHelp(() => viewingTopic);

  // Get current topic meta
  const currentTopicMeta = $derived.by((): TopicMeta | null => {
    if (!viewingTopic) return null;
    return topicMetas.find((t) => t.slug === viewingTopic) ?? null;
  });

  // Get schema for currently viewing object
  const currentSchema = $derived.by((): ObjectSchema | null => {
    if (!viewingObject) return null;

    return objectSchemas[viewingObject] ?? null;
  });

  // Get all available schemas as an array, filtered by enabled object packs and sorted by pack order
  const allSchemas = $derived(
    Object.values(objectSchemas)
      .filter((schema) => $enabledObjects.has(schema.type))
      .sort((a, b) => {
        const aOrder = objectOrderMap.get(a.type) ?? Infinity;
        const bOrder = objectOrderMap.get(b.type) ?? Infinity;
        return aOrder - bOrder;
      })
  );

  // Filter schemas by search query
  const filteredSchemas = $derived.by(() => {
    if (!searchQuery.trim()) return allSchemas;

    const query = searchQuery.toLowerCase();
    return allSchemas.filter(
      (schema) =>
        schema.type.toLowerCase().includes(query) ||
        schema.description.toLowerCase().includes(query) ||
        schema.category.toLowerCase().includes(query) ||
        schema.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  // Filter topics by search query
  const filteredTopics = $derived.by(() => {
    if (!searchQuery.trim()) return topicMetas;

    const query = searchQuery.toLowerCase();

    return topicMetas.filter(
      (topic) =>
        topic.slug.toLowerCase().includes(query) ||
        topic.title.toLowerCase().includes(query) ||
        topic.category.toLowerCase().includes(query)
    );
  });

  // Group filtered topics by category
  const filteredTopicsByCategory = $derived.by(() => {
    const groups = new Map<string, TopicMeta[]>();

    for (const category of categoryOrder) {
      const categoryTopics = filteredTopics.filter((t) => t.category === category);
      if (categoryTopics.length > 0) {
        groups.set(category, categoryTopics);
      }
    }

    return groups;
  });

  function getHelpPatchUrl(objectType: string) {
    return `?help=${encodeURIComponent(objectType)}`;
  }

  function viewObject(objectType: string) {
    manualViewingObject = objectType;
    manualViewingTopic = null;
    browseModeOverride = false;
    searchQuery = '';
  }

  function viewTopic(topicSlug: string) {
    manualViewingTopic = topicSlug;
    manualViewingObject = null;
    browseModeOverride = false;
    searchQuery = '';
  }

  function showBrowseMode() {
    browseModeOverride = true;
    manualViewingObject = null;
    manualViewingTopic = null;
  }
</script>

<div class="flex h-full flex-col">
  {#if currentTopicMeta}
    <!-- Topic documentation view -->
    <div class="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
      <div class="flex items-center gap-2">
        <button
          onclick={showBrowseMode}
          class="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          title="Browse all help"
        >
          <ArrowLeft class="h-4 w-4" />
        </button>

        <span class="text-sm text-zinc-200">{topicContent.title ?? currentTopicMeta.title}</span>

        <span class="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
          {currentTopicMeta.category}
        </span>
      </div>

      <div class="flex items-center gap-1">
        <!-- Lock toggle -->
        <Tooltip.Root delayDuration={100}>
          <Tooltip.Trigger>
            <button
              onclick={() => helpViewStore.setLocked(!isLocked)}
              class={[
                'cursor-pointer rounded p-1 transition-colors',
                isLocked
                  ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                  : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
              ]}
            >
              {#if isLocked}
                <Lock class="h-4 w-4" />
              {:else}
                <LockOpen class="h-4 w-4" />
              {/if}
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content side="bottom">
            {isLocked ? 'Unlock (auto-follow selection)' : 'Lock (stay on this guide)'}
          </Tooltip.Content>
        </Tooltip.Root>

        <a
          href="/docs/{currentTopicMeta.slug}"
          target="_blank"
          class="rounded p-1 text-zinc-500 transition-colors hover:bg-green-500/20 hover:text-green-300"
          title="Open full documentation (shareable link)"
        >
          <ExternalLink class="h-4 w-4" />
        </a>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      {#if topicContent.htmlContent}
        <div class="prose-markdown-sm">
          {@html topicContent.htmlContent}
        </div>
      {:else if topicContent.loading}
        <div class="text-center text-xs text-zinc-500">Loading...</div>
      {:else}
        <div class="text-center text-xs text-zinc-500">No content available.</div>
      {/if}
    </div>
  {:else if currentSchema}
    <!-- Object documentation view -->
    <div class="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
      <div class="flex items-center gap-2">
        <button
          onclick={showBrowseMode}
          class="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          title="Browse all objects"
        >
          <ArrowLeft class="h-4 w-4" />
        </button>

        <span class="font-mono text-sm text-zinc-200">{currentSchema.type}</span>

        <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
          {currentSchema.category}
        </span>
      </div>

      <div class="flex items-center gap-1">
        <!-- Lock toggle -->
        <Tooltip.Root delayDuration={100}>
          <Tooltip.Trigger>
            <button
              onclick={() => helpViewStore.setLocked(!isLocked)}
              class={[
                'cursor-pointer rounded p-1 transition-colors',
                isLocked
                  ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                  : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
              ]}
            >
              {#if isLocked}
                <Lock class="h-4 w-4" />
              {:else}
                <LockOpen class="h-4 w-4" />
              {/if}
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content side="bottom">
            {isLocked ? 'Unlock (auto-follow selection)' : 'Lock (stay on this object)'}
          </Tooltip.Content>
        </Tooltip.Root>

        {#if helpContent.hasHelpPatch}
          <a
            href={getHelpPatchUrl(currentSchema.type)}
            target="_blank"
            class="rounded p-1 text-zinc-500 transition-colors hover:bg-blue-500/20 hover:text-blue-300"
            title="Open help patch"
          >
            <Play class="h-4 w-4" />
          </a>
        {/if}

        <a
          href="/docs/objects/{currentSchema.type}"
          target="_blank"
          class="rounded p-1 text-zinc-500 transition-colors hover:bg-green-500/20 hover:text-green-300"
          title="Open full documentation (shareable link)"
        >
          <ExternalLink class="h-4 w-4" />
        </a>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      <!-- Description -->
      <p class="mb-4 text-sm text-zinc-300">{currentSchema.description}</p>

      <!-- Inlets -->
      {#if currentSchema.inlets.length > 0}
        <div class="mb-4">
          <h3 class="mb-2 text-xs font-medium tracking-wider text-zinc-500 uppercase">Inlets</h3>
          <div class="space-y-2">
            {#each currentSchema.inlets as inlet}
              <PortCard port={inlet} compact />
            {/each}
          </div>
        </div>
      {/if}

      <!-- Outlets -->
      {#if currentSchema.outlets.length > 0 && !currentSchema.hasDynamicOutlets}
        <div class="mb-4">
          <h3 class="mb-2 text-xs font-medium tracking-wider text-zinc-500 uppercase">Outlets</h3>
          <div class="space-y-2">
            {#each currentSchema.outlets as outlet}
              <PortCard port={outlet} compact />
            {/each}
          </div>
        </div>
      {/if}

      <!-- Special: trigger type specifiers -->
      {#if currentSchema.type === 'trigger'}
        <TriggerTypeSpecifiers />
      {/if}

      <!-- Prose documentation from markdown -->
      {#if helpContent.htmlContent}
        <div class="mb-4 border-t border-zinc-800 pt-4">
          <div class="prose-markdown-sm">
            {@html helpContent.htmlContent}
          </div>
        </div>
      {:else if helpContent.loading}
        <div class="mb-4 text-center text-xs text-zinc-500">Loading...</div>
      {/if}

      <!-- Open help patch button (only if patch exists) -->
      {#if helpContent.hasHelpPatch}
        <a
          href={getHelpPatchUrl(currentSchema.type)}
          target="_blank"
          class="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-300 transition-colors hover:bg-blue-500/20"
        >
          <Play class="h-3.5 w-3.5" />
          Open Help Patch
        </a>
      {/if}

      <!-- Tags -->
      {#if currentSchema.tags && currentSchema.tags.length > 0}
        <div class="mb-4">
          <h3 class="mb-2 text-xs font-medium tracking-wider text-zinc-500 uppercase">Tags</h3>

          <div class="flex flex-wrap gap-1">
            {#each currentSchema.tags as tag}
              <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">{tag}</span>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <!-- Object list view -->

    <!-- Show selected node without help -->
    {#if $selectedNodeInfo && !browseModeOverride}
      <div class="border-b border-zinc-800 p-3">
        <div class="flex items-center gap-2">
          <CircleQuestionMark class="h-4 w-4 text-zinc-500" />

          <span class="font-mono text-sm text-zinc-400">{$selectedNodeInfo.type}</span>
          <span class="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] text-blue-300"
            >selected</span
          >
        </div>
        <p class="mt-1 text-[11px] text-zinc-500">
          No documentation available for this object yet.
        </p>
      </div>
    {/if}

    <SearchBar bind:value={searchQuery} placeholder="Search guides and objects..." />

    <div class="flex-1 overflow-y-auto p-2">
      {#if filteredTopics.length === 0 && filteredSchemas.length === 0}
        <div class="py-8 text-center text-xs text-zinc-500">
          {#if searchQuery}
            No help found for "{searchQuery}"
          {:else}
            No documentation available yet.
          {/if}
        </div>
      {:else}
        <!-- Guides Section -->
        {#if filteredTopics.length > 0}
          <div class="mb-3">
            <button
              onclick={() => helpViewStore.setGuidesExpanded(!guidesExpanded)}
              class="mb-1 flex w-full cursor-pointer items-center gap-1.5 text-xs font-medium tracking-wider text-zinc-500 uppercase transition-colors hover:text-zinc-400"
            >
              {#if guidesExpanded}
                <ChevronDown class="h-3.5 w-3.5" />
              {:else}
                <ChevronRight class="h-3.5 w-3.5" />
              {/if}
              <BookOpen class="h-3.5 w-3.5" />
              Guides
            </button>

            {#if guidesExpanded}
              <div class="ml-1 space-y-2 pt-1">
                {#each categoryOrder as category}
                  {@const categoryTopics = filteredTopicsByCategory.get(category)}

                  {#if categoryTopics && categoryTopics.length > 0}
                    <div>
                      <div class="mb-0.5 px-1 text-[10px] text-zinc-600">{category}</div>

                      <div class="space-y-0.5">
                        {#each categoryTopics as topic}
                          <button
                            onclick={() => viewTopic(topic.slug)}
                            class="flex w-full cursor-pointer items-center rounded px-2 py-1 text-left font-mono text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
                          >
                            {topic.title}
                          </button>
                        {/each}
                      </div>
                    </div>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <!-- Objects Section -->
        {#if filteredSchemas.length > 0}
          <div>
            <button
              onclick={() => helpViewStore.setObjectsExpanded(!objectsExpanded)}
              class="mb-1 flex w-full cursor-pointer items-center gap-1.5 text-xs font-medium tracking-wider text-zinc-500 uppercase transition-colors hover:text-zinc-400"
            >
              {#if objectsExpanded}
                <ChevronDown class="h-3.5 w-3.5" />
              {:else}
                <ChevronRight class="h-3.5 w-3.5" />
              {/if}
              <CircleQuestionMark class="h-3.5 w-3.5" />
              Objects
            </button>

            {#if objectsExpanded}
              <div class="space-y-0.5 pt-1">
                {#each filteredSchemas as schema}
                  <button
                    onclick={() => viewObject(schema.type)}
                    class="flex w-full cursor-pointer items-start rounded px-2 py-1.5 text-left transition-colors hover:bg-zinc-800"
                  >
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <span class="font-mono text-xs text-zinc-200">{schema.type}</span>
                        <span class="rounded bg-zinc-800 px-1 py-0.5 text-[9px] text-zinc-500">
                          {schema.category}
                        </span>
                      </div>
                      <p class="mt-0.5 line-clamp-1 text-[11px] text-zinc-500">
                        {schema.description}
                      </p>
                    </div>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <!-- Full docs link -->
        <a
          href="/docs"
          class="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-700 py-2 text-xs text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-400"
          target="_blank"
        >
          <ExternalLink class="h-3.5 w-3.5" />
          Full Documentation
        </a>
      {/if}
    </div>
  {/if}
</div>
