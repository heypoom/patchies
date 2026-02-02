<script lang="ts">
  import { ChevronDown, Check, AlertTriangle } from '@lucide/svelte/icons';
  import type { PresetPack } from '../../../stores/extensions.store';
  import { getPackIcon } from '../../extensions/pack-icons';
  import { enabledObjects, enabledPackIds, BUILT_IN_PACKS } from '../../../stores/extensions.store';
  import * as Tooltip from '../ui/tooltip';

  let {
    pack,
    enabled,
    onToggle,
    searchQuery = '',
    locked = false
  }: {
    pack: PresetPack;
    enabled: boolean;
    onToggle: () => void;
    searchQuery?: string;
    locked?: boolean;
  } = $props();

  // Check if any presets match the search query
  const matchingPresets = $derived.by(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const query = searchQuery.toLowerCase();
    return new Set(pack.presets.filter((preset) => preset.toLowerCase().includes(query)));
  });

  const hasPresetMatches = $derived(matchingPresets.size > 0);

  // Auto-expand when presets match, allow manual toggle otherwise
  let manualExpanded = $state(false);
  const expanded = $derived(hasPresetMatches || manualExpanded);

  // Check availability based on required objects
  const hasAllRequiredObjects = $derived(
    pack.requiredObjects.every((obj) => $enabledObjects.has(obj))
  );
  const hasAnyRequiredObjects = $derived(
    pack.requiredObjects.some((obj) => $enabledObjects.has(obj))
  );
  const missingObjects = $derived(pack.requiredObjects.filter((obj) => !$enabledObjects.has(obj)));

  // Find which object packs contain the missing objects (and aren't already enabled)
  const missingPacks = $derived.by(() => {
    const packsNeeded = new Map<string, (typeof BUILT_IN_PACKS)[0]>();

    for (const obj of missingObjects) {
      const containingPack = BUILT_IN_PACKS.find((p) => p.objects.includes(obj));
      if (containingPack && !$enabledPackIds.includes(containingPack.id)) {
        packsNeeded.set(containingPack.id, containingPack);
      }
    }

    return Array.from(packsNeeded.values());
  });

  function enableMissingPacks() {
    enabledPackIds.update((ids) => {
      const newIds = [...ids];
      for (const p of missingPacks) {
        if (!newIds.includes(p.id)) {
          newIds.push(p.id);
        }
      }
      return newIds;
    });
  }

  const IconComponent = $derived(getPackIcon(pack.icon));

  // Determine visual state
  const isUnavailable = $derived(!hasAnyRequiredObjects);
  const isPartial = $derived(hasAnyRequiredObjects && !hasAllRequiredObjects);
</script>

<div
  class={[
    'rounded-lg border transition-colors',
    isUnavailable
      ? 'border-zinc-800/50 bg-zinc-900/30 opacity-50'
      : enabled
        ? 'border-zinc-600 bg-zinc-800/50'
        : 'border-zinc-800 bg-zinc-900/50'
  ]}
>
  <!-- Header -->
  <div class="flex items-center gap-2 p-2">
    <!-- Icon -->
    <div
      class={[
        'flex h-6 w-6 shrink-0 items-center justify-center rounded',
        isUnavailable
          ? 'bg-zinc-800/50 text-zinc-600'
          : enabled
            ? 'bg-zinc-700 text-zinc-200'
            : 'bg-zinc-800 text-zinc-500'
      ]}
    >
      <IconComponent class="h-3.5 w-3.5" />
    </div>

    <!-- Info -->
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5">
        <span
          class={[
            'text-xs font-medium',
            isUnavailable ? 'text-zinc-600' : enabled ? 'text-zinc-200' : 'text-zinc-400'
          ]}
        >
          {pack.name}
        </span>
        <span class="text-[10px] text-zinc-600">({pack.presets.length})</span>
        {#if isPartial && enabled && missingPacks.length > 0}
          <Tooltip.Root disableHoverableContent={false} delayDuration={100}>
            <Tooltip.Trigger>
              <AlertTriangle class="h-3 w-3 cursor-pointer text-amber-500" />
            </Tooltip.Trigger>
            <Tooltip.Content side="top" class="p-2">
              <div class="flex flex-col gap-1.5">
                <p class="text-[10px]">
                  Requires: {missingPacks.map((p) => p.name).join(', ')}
                </p>
                <button
                  onclick={enableMissingPacks}
                  class="cursor-pointer rounded bg-amber-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-amber-500"
                >
                  Enable
                </button>
              </div>
            </Tooltip.Content>
          </Tooltip.Root>
        {/if}
      </div>
    </div>

    <!-- Toggle button -->
    {#if locked}
      <Tooltip.Root delayDuration={100}>
        <Tooltip.Trigger>
          <div
            class="flex h-5 w-5 shrink-0 cursor-not-allowed items-center justify-center rounded border border-green-600 bg-green-600/20 text-green-400"
          >
            <Check class="h-3 w-3" />
          </div>
        </Tooltip.Trigger>
        <Tooltip.Content side="left" class="max-w-48 p-2">
          <p class="text-[10px]">
            Starter presets are always enabled to ensure basic functionality.
          </p>
        </Tooltip.Content>
      </Tooltip.Root>
    {:else}
      <button
        onclick={onToggle}
        disabled={isUnavailable}
        class={[
          'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
          isUnavailable
            ? 'cursor-not-allowed border-zinc-800 bg-zinc-800/50 text-zinc-700'
            : enabled
              ? 'cursor-pointer border-green-600 bg-green-600/20 text-green-400 hover:bg-green-600/30'
              : 'cursor-pointer border-zinc-700 bg-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400'
        ]}
        title={isUnavailable
          ? 'Enable required object packs first'
          : enabled
            ? 'Disable pack'
            : 'Enable pack'}
      >
        {#if enabled && !isUnavailable}
          <Check class="h-3 w-3" />
        {/if}
      </button>
    {/if}
  </div>

  <!-- Expandable details -->
  <button
    onclick={() => (manualExpanded = !manualExpanded)}
    class="flex w-full cursor-pointer items-center justify-between border-t border-zinc-800/50 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-400"
  >
    <span>{pack.description}</span>
    <ChevronDown class={['h-2.5 w-2.5 transition-transform', expanded ? 'rotate-180' : '']} />
  </button>

  {#if expanded}
    <div class="border-t border-zinc-800/50 px-2 py-1.5">
      <!-- Missing packs warning -->
      {#if missingPacks.length > 0}
        <div class="mb-1.5 text-[9px] text-amber-500/80">
          Requires: {missingPacks.map((p) => p.name).join(', ')}.
          <button
            onclick={enableMissingPacks}
            class="cursor-pointer underline underline-offset-2 hover:text-amber-400"
          >
            Enable them.
          </button>
        </div>
      {/if}

      <!-- Preset list -->
      <div class="flex flex-wrap gap-0.5">
        {#each pack.presets as preset}
          <span
            class={[
              'rounded px-1 py-0.5 font-mono text-[9px]',
              matchingPresets.has(preset)
                ? 'bg-yellow-500/30 text-yellow-300'
                : 'bg-zinc-800 text-zinc-400'
            ]}
          >
            {preset}
          </span>
        {/each}
      </div>
    </div>
  {/if}
</div>
