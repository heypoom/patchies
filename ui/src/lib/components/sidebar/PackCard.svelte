<script lang="ts">
  import { ChevronDown, Check, Lock } from '@lucide/svelte/icons';
  import { getPackIcon } from '$lib/extensions/pack-icons';
  import * as Tooltip from '../ui/tooltip';
  import type { Snippet } from 'svelte';
  import { canManuallyExpandPackContents, canTogglePack } from './pack-card-behavior';

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
  const manualExpansionAllowed = $derived(canManuallyExpandPackContents({ searchQuery }));

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
  <!-- ── Tile variant (grid-friendly card) ── -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class={[
      'flex flex-col rounded-lg border p-3 transition-all',
      toggleAllowed ? 'cursor-pointer' : 'cursor-not-allowed',
      selected
        ? 'border-orange-500/30 bg-orange-500/5'
        : unavailable
          ? 'border-white/4 opacity-45'
          : enabled
            ? 'border-orange-500/15 bg-orange-500/3 hover:border-orange-500/25'
            : 'border-white/6 bg-white/2 hover:border-white/10'
    ]}
    onclick={handleTogglePack}
  >
    <!-- Header: icon + name + toggle -->
    <div class="mb-1 flex items-center gap-2">
      <div
        class={[
          'flex h-5 w-5 shrink-0 items-center justify-center rounded',
          enabled && !unavailable ? 'bg-orange-500/12 text-orange-500' : 'bg-white/4 text-zinc-600'
        ]}
      >
        <IconComponent class="h-3 w-3" />
      </div>
      <span
        class={[
          'flex-1 truncate text-[11px] leading-[1.2] font-medium',
          enabled && !unavailable ? 'text-zinc-200' : 'text-zinc-500'
        ]}
      >
        {name}
      </span>
      {#if nameExtra}
        {@render nameExtra()}
      {/if}
      <Tooltip.Root delayDuration={100}>
        <Tooltip.Trigger>
          <button
            onclick={(e) => {
              e.stopPropagation();
              handleToggleManualExpansion();
            }}
            disabled={!manualExpansionAllowed}
            class={[
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border transition-all',
              manualExpansionAllowed
                ? 'cursor-pointer border-white/8 text-zinc-600 hover:border-orange-500/25 hover:text-orange-400'
                : 'cursor-not-allowed border-white/4 text-zinc-800',
              selected && 'border-orange-500/30 text-orange-400'
            ]}
            aria-label={selected ? 'Hide pack contents' : 'Show pack contents'}
          >
            <ChevronDown class={['h-3 w-3 transition-transform', selected && 'rotate-180']} />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content>
          {manualExpansionAllowed ? 'Show Contents' : 'Contents listed in search'}
        </Tooltip.Content>
      </Tooltip.Root>
      {#if locked}
        <Lock class="h-3 w-3 shrink-0 text-zinc-700" />
      {:else}
        <div
          class={[
            'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border transition-all',
            unavailable
              ? 'border-zinc-700 text-zinc-600'
              : enabled
                ? 'border-orange-500/50 bg-orange-500/12 text-orange-500'
                : 'border-zinc-700 text-transparent'
          ]}
          aria-hidden="true"
        >
          {#if enabled && !unavailable}
            <Check class="h-2 w-2" />
          {/if}
        </div>
      {/if}
    </div>

    <!-- Description -->
    <p class="text-[10px] leading-[1.4] text-zinc-600">{description}</p>

    {#if searchQuery.trim()}
      <!-- Pills visible during search -->
      <div class="mt-2 flex flex-wrap gap-[3px]">
        {#each items as item}
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
      </div>
    {:else}
      <!-- Item count when not searching -->
      <p class="mt-auto pt-1.5 font-mono text-[9px] text-zinc-700">{items.length} items</p>
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
        {#each items as item}
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
