<script lang="ts">
  import { ChevronDown, ChevronRight, Check, Lock } from '@lucide/svelte/icons';
  import { getPackIcon } from '$lib/extensions/pack-icons';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import type { Snippet } from 'svelte';
  import { canManuallyExpandPackContents, canTogglePack } from './pack-card-behavior';

  const SEARCH_TILE_ITEM_LIMIT = 12;

  let {
    name,
    description,
    icon,
    items,
    enabled,
    onToggle,
    searchQuery = '',
    locked = false,
    unavailable = false,
    variant = 'row' as 'row' | 'tile',
    selected = false,
    onSelect,
    nameExtra,
    expandedHeader
  }: {
    name: string;
    description: string;
    icon: string;
    items: string[];
    enabled: boolean;
    onToggle: () => void;
    searchQuery?: string;
    locked?: boolean;
    unavailable?: boolean;
    variant?: 'row' | 'tile';
    selected?: boolean;
    onSelect?: () => void;
    nameExtra?: Snippet;
    expandedHeader?: Snippet;
  } = $props();

  const matchingItems = $derived.by(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const query = searchQuery.toLowerCase();
    return new Set(items.filter((item) => item.toLowerCase().includes(query)));
  });

  const hasMatches = $derived(matchingItems.size > 0);
  const toggleAllowed = $derived(canTogglePack({ locked, unavailable }));
  const manualExpansionAllowed = $derived(
    canManuallyExpandPackContents({ searchQuery, hasMatchingItems: hasMatches, variant })
  );
  const searchTileItems = $derived.by(() => {
    if (variant !== 'tile' || !searchQuery.trim()) return items;

    const matches = items.filter((item) => matchingItems.has(item));
    const nonMatches = items.filter((item) => !matchingItems.has(item));
    return [...matches, ...nonMatches].slice(0, SEARCH_TILE_ITEM_LIMIT);
  });
  const hiddenSearchTileItemCount = $derived(items.length - searchTileItems.length);

  let manualExpanded = $state(false);
  const expanded = $derived(hasMatches || manualExpanded);

  const IconComponent = $derived(getPackIcon(icon));

  function handleTogglePack() {
    if (!toggleAllowed) return;
    onToggle();
  }

  function handleToggleManualExpansion() {
    if (!manualExpansionAllowed) return;

    if (variant === 'tile') {
      onSelect?.();
      return;
    }

    manualExpanded = !manualExpanded;
  }
</script>

{#if variant === 'tile'}
  <div
    class={[
      'relative min-h-[120px] overflow-hidden rounded-lg border transition-colors',
      selected
        ? 'border-orange-500/45 bg-orange-500/5'
        : unavailable
          ? 'border-white/4 opacity-45'
          : enabled
            ? 'border-white/10 bg-white/[0.035] hover:border-white/16'
            : 'border-white/6 bg-transparent hover:border-white/12 hover:bg-white/[0.02]'
    ]}
  >
    <button
      type="button"
      onclick={handleTogglePack}
      disabled={!toggleAllowed}
      aria-pressed={enabled}
      aria-label={`${enabled ? 'Disable' : 'Enable'} ${name}`}
      class={[
        'flex h-full min-h-[120px] w-full cursor-pointer flex-col pt-3 pr-14 pl-3 text-left transition-colors outline-none focus-visible:bg-white/[0.04] focus-visible:ring-1 focus-visible:ring-orange-500/70 focus-visible:ring-inset disabled:cursor-not-allowed',
        'pb-12 sm:pb-10'
      ]}
    >
      <div class="mb-1.5 flex items-center gap-2">
        <div
          class={[
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border',
            enabled && !unavailable
              ? 'border-white/10 bg-white/[0.055] text-zinc-300'
              : 'border-white/6 bg-white/[0.025] text-zinc-600'
          ]}
        >
          <IconComponent class="h-3.5 w-3.5" />
        </div>
        <span
          class={[
            'min-w-0 flex-1 truncate text-[12px] leading-[1.25] font-medium',
            enabled && !unavailable ? 'text-zinc-200' : 'text-zinc-500'
          ]}
        >
          {name}
        </span>
      </div>

      <p class="line-clamp-2 text-[10px] leading-[1.45] text-zinc-500">{description}</p>
    </button>

    <div class="pointer-events-none absolute top-1.5 right-1.5 flex items-center gap-0.5">
      {#if nameExtra}
        <div class="pointer-events-auto flex h-11 w-8 items-center justify-center">
          {@render nameExtra()}
        </div>
      {/if}
      {#if locked}
        <Tooltip.Root delayDuration={100}>
          <Tooltip.Trigger>
            <div
              class="pointer-events-auto flex h-11 w-11 cursor-not-allowed items-center justify-center rounded-md text-zinc-600"
            >
              <Lock class="h-3.5 w-3.5" />
            </div>
          </Tooltip.Trigger>
          <Tooltip.Content side="left" class="max-w-48 p-2">
            <p class="text-[10px]">Always enabled.</p>
          </Tooltip.Content>
        </Tooltip.Root>
      {:else}
        <div
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md"
          aria-hidden="true"
        >
          <span
            class={[
              'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
              unavailable
                ? 'border-zinc-700 text-transparent'
                : enabled
                  ? 'border-zinc-500 bg-zinc-700 text-zinc-100'
                  : 'border-zinc-700 text-transparent'
            ]}
            aria-hidden="true"
          >
            {#if enabled && !unavailable}
              <Check class="h-2.5 w-2.5" />
            {/if}
          </span>
        </div>
      {/if}
    </div>

    <button
      type="button"
      onclick={handleToggleManualExpansion}
      disabled={!manualExpansionAllowed}
      class={[
        'absolute inset-x-0 bottom-0 flex h-11 cursor-pointer items-center gap-1 border-t border-white/6 px-3 font-mono text-[9px] transition-colors outline-none focus-visible:bg-white/[0.045] focus-visible:text-orange-400 disabled:cursor-not-allowed sm:h-9',
        selected
          ? 'bg-orange-500/[0.025] text-orange-400'
          : 'text-zinc-600 hover:bg-white/[0.025] hover:text-zinc-400'
      ]}
      aria-label={selected ? `Hide ${name} contents` : `Show ${name} contents`}
      aria-pressed={selected}
    >
      <span>{selected ? 'Viewing contents' : `View ${items.length} items`}</span>
      <ChevronRight class={['h-3 w-3 transition-transform', selected && 'translate-x-0.5']} />
    </button>

    {#if searchQuery.trim()}
      <div class="border-t border-white/6 px-3 py-2">
        <div class="flex flex-wrap gap-[3px]">
          {#each searchTileItems as item (item)}
            <span
              class={[
                'rounded-[3px] px-[5px] py-px font-mono text-[8px]',
                matchingItems.has(item)
                  ? 'bg-orange-500/15 text-orange-400'
                  : 'bg-white/4 text-zinc-600'
              ]}
            >
              {item}
            </span>
          {/each}
          {#if hiddenSearchTileItemCount > 0}
            <span
              class="rounded-[3px] bg-white/4 px-[5px] py-px font-mono text-[8px] text-zinc-600"
            >
              +{hiddenSearchTileItemCount} more
            </span>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{:else}
  <!-- ── Row variant (sidebar list) ── -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class={[
      'flex items-center rounded transition-colors hover:bg-white/2',
      toggleAllowed ? 'cursor-pointer' : 'cursor-not-allowed',
      unavailable && 'opacity-45'
    ]}
    onclick={handleTogglePack}
  >
    <!-- Left: icon + name + description -->
    <div class="flex min-w-0 flex-1 items-center gap-2 py-[5px] pr-1 pl-2">
      <div
        class={[
          'flex h-5 w-5 shrink-0 items-center justify-center rounded',
          enabled && !unavailable ? 'bg-orange-500/12 text-orange-500' : 'bg-white/4 text-zinc-600'
        ]}
      >
        <IconComponent class="h-3 w-3" />
      </div>

      <div class="flex min-w-0 flex-col gap-px">
        <div class="flex items-center gap-1.5">
          <span
            class={[
              'truncate text-[11px] leading-[1.2] font-medium',
              enabled && !unavailable ? 'text-zinc-300' : 'text-zinc-500'
            ]}
          >
            {name}
          </span>
          {#if nameExtra}
            {@render nameExtra()}
          {/if}
        </div>
        <span class="truncate text-[10px] text-zinc-600">{description}</span>
      </div>
    </div>

    <!-- Right: toggle + expand -->
    <div class="flex shrink-0 items-center gap-1.5 pr-2 pl-1">
      {#if locked}
        <Tooltip.Root delayDuration={100}>
          <Tooltip.Trigger>
            <div
              class="flex h-4 w-4 shrink-0 cursor-not-allowed items-center justify-center rounded-[3px] border border-zinc-700 bg-transparent text-zinc-600"
              onclick={(e) => e.stopPropagation()}
            >
              <Lock class="h-2.5 w-2.5" />
            </div>
          </Tooltip.Trigger>
          <Tooltip.Content side="left" class="max-w-48 p-2">
            <p class="text-[10px]">Always enabled.</p>
          </Tooltip.Content>
        </Tooltip.Root>
      {:else}
        <div
          class={[
            'flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border transition-all',
            unavailable
              ? 'border-zinc-700 bg-transparent text-zinc-600'
              : enabled
                ? 'border-orange-500/50 bg-orange-500/12 text-orange-500'
                : 'border-zinc-700 bg-transparent text-transparent'
          ]}
          aria-hidden="true"
        >
          {#if enabled && !unavailable}
            <Check class="h-2.5 w-2.5" />
          {/if}
        </div>
      {/if}

      <button
        onclick={(e) => {
          e.stopPropagation();
          handleToggleManualExpansion();
        }}
        disabled={!manualExpansionAllowed}
        class={[
          'flex shrink-0 items-center gap-1 rounded-[3px] px-1 py-0.5 transition-colors',
          manualExpansionAllowed
            ? 'cursor-pointer hover:bg-white/5'
            : 'cursor-not-allowed opacity-50'
        ]}
        aria-label={expanded ? 'Hide pack contents' : 'Show pack contents'}
      >
        <span class="w-[18px] shrink-0 text-right font-mono text-[9px] text-zinc-700"
          >{items.length}</span
        >
        <ChevronDown
          class={[
            'h-2.5 w-2.5 shrink-0 text-zinc-700 transition-transform',
            expanded && 'rotate-180'
          ]}
        />
      </button>
    </div>
  </div>

  {#if expanded}
    <div class="px-2 pb-1.5">
      {#if expandedHeader}
        {@render expandedHeader()}
      {/if}
      <div class="flex flex-wrap gap-[3px] rounded border border-white/4 bg-white/2 px-2 py-1.5">
        {#each items as item (item)}
          <span
            class={[
              'rounded-[3px] px-[5px] py-px font-mono text-[9px]',
              matchingItems.has(item)
                ? 'bg-orange-500/15 text-orange-400'
                : 'bg-white/3 text-zinc-600'
            ]}
          >
            {item}
          </span>
        {/each}
      </div>
    </div>
  {/if}
{/if}
