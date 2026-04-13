<script lang="ts">
  import { ChevronDown, Check, Lock } from '@lucide/svelte/icons';
  import { getPackIcon } from '$lib/extensions/pack-icons';
  import * as Tooltip from '../ui/tooltip';
  import type { Snippet } from 'svelte';

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
    nameExtra?: Snippet;
    expandedHeader?: Snippet;
  } = $props();

  const matchingItems = $derived.by(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const query = searchQuery.toLowerCase();
    return new Set(items.filter((item) => item.toLowerCase().includes(query)));
  });

  const hasMatches = $derived(matchingItems.size > 0);

  let manualExpanded = $state(false);
  const expanded = $derived(hasMatches || manualExpanded);

  const IconComponent = $derived(getPackIcon(icon));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class={[
    'flex cursor-pointer items-center rounded transition-colors hover:bg-white/2',
    unavailable && 'opacity-45'
  ]}
  onclick={() => (manualExpanded = !manualExpanded)}
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
      <button
        onclick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        disabled={unavailable}
        class={[
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border transition-all',
          unavailable
            ? 'cursor-not-allowed border-zinc-700 bg-transparent text-zinc-600'
            : enabled
              ? 'cursor-pointer border-orange-500/50 bg-orange-500/12 text-orange-500 hover:bg-orange-500/20'
              : 'cursor-pointer border-zinc-700 bg-transparent text-transparent hover:border-zinc-500'
        ]}
        title={unavailable
          ? 'Enable required object packs first'
          : enabled
            ? 'Disable pack'
            : 'Enable pack'}
      >
        {#if enabled && !unavailable}
          <Check class="h-2.5 w-2.5" />
        {/if}
      </button>
    {/if}

    <div class="flex items-center gap-1">
      <span class="w-[18px] shrink-0 text-right font-mono text-[9px] text-zinc-700"
        >{items.length}</span
      >
      <ChevronDown
        class={[
          'h-2.5 w-2.5 shrink-0 text-zinc-700 transition-transform',
          expanded && 'rotate-180'
        ]}
      />
    </div>
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
