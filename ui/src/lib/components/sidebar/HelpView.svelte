<script lang="ts">
  import {
    Search,
    ExternalLink,
    ArrowLeft,
    CircleQuestionMark,
    Play,
    Lock,
    LockOpen
  } from '@lucide/svelte/icons';
  import { objectSchemas, type ObjectSchema } from '$lib/objects/schemas';
  import TriggerTypeSpecifiers from './TriggerTypeSpecifiers.svelte';
  import PortCard from '$lib/components/docs/PortCard.svelte';
  import { selectedNodeInfo } from '../../../stores/ui.store';
  import { useObjectHelp } from '$lib/composables/useObjectHelp.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { enabledObjects } from '../../../stores/extensions.store';

  let searchQuery = $state('');

  let manualViewingObject = $state<string | null>(null);
  let browseModeOverride = $state(false); // When true, show list even if node is selected
  let isLocked = $state(false); // When true, don't auto-switch on node selection
  let lastViewedType = $state<string | null>(null); // Persists across deselection

  // Reset browse mode when a new node is selected on canvas (unless locked)
  $effect(() => {
    if ($selectedNodeInfo && !isLocked) {
      browseModeOverride = false;
      manualViewingObject = null;
    }
  });

  // Auto-show help for selected node, or use manual selection
  const viewingObject = $derived.by((): string | null => {
    if (browseModeOverride) return null;
    if (manualViewingObject) return manualViewingObject;

    // When locked, stay on the last viewed object
    if (isLocked && lastViewedType) return lastViewedType;
    if ($selectedNodeInfo?.type) return $selectedNodeInfo.type;

    // When deselected, keep showing the last viewed object
    if (lastViewedType) return lastViewedType;

    return null;
  });

  // Track last viewed type for persistence
  $effect(() => {
    if (viewingObject) {
      lastViewedType = viewingObject;
    }
  });

  // Fetch help content reactively
  const helpContent = useObjectHelp(() => viewingObject);

  // Get schema for currently viewing object
  const currentSchema = $derived.by((): ObjectSchema | null => {
    if (!viewingObject) return null;
    return objectSchemas[viewingObject] ?? null;
  });

  // Get all available schemas as an array, filtered by enabled object packs
  const allSchemas = $derived(
    Object.values(objectSchemas).filter((schema) => $enabledObjects.has(schema.type))
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

  function getHelpPatchUrl(objectType: string) {
    return `?help=${encodeURIComponent(objectType)}`;
  }

  function viewObject(objectType: string) {
    manualViewingObject = objectType;
    browseModeOverride = false;
    searchQuery = '';
  }

  function showBrowseMode() {
    browseModeOverride = true;
    manualViewingObject = null;
  }
</script>

<div class="flex h-full flex-col">
  {#if currentSchema}
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
              onclick={() => (isLocked = !isLocked)}
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
          class="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-300 transition-colors hover:bg-blue-500/20"
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

    <div class="border-b border-zinc-800 p-3">
      <div class="relative">
        <Search class="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search object help..."
          class="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-1.5 pr-3 pl-8 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-zinc-600"
        />
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-2">
      {#if filteredSchemas.length === 0}
        <div class="py-8 text-center text-xs text-zinc-500">
          {#if searchQuery}
            No help found for "{searchQuery}"
          {:else}
            No documentation available yet.
          {/if}
        </div>
      {:else}
        <div class="space-y-1">
          {#each filteredSchemas as schema}
            <button
              onclick={() => viewObject(schema.type)}
              class="flex w-full cursor-pointer items-start gap-2 rounded-lg p-2 text-left transition-colors hover:bg-zinc-800"
            >
              <CircleQuestionMark class="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />

              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-mono text-xs text-zinc-200">{schema.type}</span>
                  <span class="rounded bg-zinc-800 px-1 py-0.5 text-[9px] text-zinc-500">
                    {schema.category}
                  </span>
                </div>
                <p class="mt-0.5 line-clamp-1 text-[11px] text-zinc-500">{schema.description}</p>
              </div>
            </button>
          {/each}
        </div>

        <!-- Getting Started link -->
        <a
          href="/docs"
          class="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-700 py-2 text-xs text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-400"
          target="_blank"
        >
          <ExternalLink class="h-3.5 w-3.5" />
          Getting Started
        </a>
      {/if}
    </div>
  {/if}
</div>
