<script lang="ts">
  import { ChevronDown, Check, Lock, TriangleAlert } from '@lucide/svelte/icons';
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

  const matchingPresets = $derived.by(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const query = searchQuery.toLowerCase();
    return new Set(pack.presets.filter((preset) => preset.toLowerCase().includes(query)));
  });

  const hasPresetMatches = $derived(matchingPresets.size > 0);

  let manualExpanded = $state(false);
  const expanded = $derived(hasPresetMatches || manualExpanded);

  const hasAllRequiredObjects = $derived(
    pack.requiredObjects.every((obj) => $enabledObjects.has(obj))
  );
  const hasAnyRequiredObjects = $derived(
    pack.requiredObjects.some((obj) => $enabledObjects.has(obj))
  );
  const missingObjects = $derived(pack.requiredObjects.filter((obj) => !$enabledObjects.has(obj)));

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
        if (!newIds.includes(p.id)) newIds.push(p.id);
      }
      return newIds;
    });
  }

  const IconComponent = $derived(getPackIcon(pack.icon));
  const isUnavailable = $derived(!hasAnyRequiredObjects && pack.requiredObjects.length > 0);
  const isPartial = $derived(hasAnyRequiredObjects && !hasAllRequiredObjects);
</script>

<div class={['pack-row', enabled && 'pack-row--enabled', isUnavailable && 'pack-row--unavailable']}>
  <!-- Left: icon + name + description -->
  <button
    class="pack-row-main"
    onclick={() => (manualExpanded = !manualExpanded)}
    title="Show presets in {pack.name}"
  >
    <div class={['pack-icon', enabled && !isUnavailable ? 'pack-icon--on' : 'pack-icon--off']}>
      <IconComponent class="h-3 w-3" />
    </div>

    <div class="pack-info">
      <div class="flex items-center gap-1.5">
        <span class={['pack-name', enabled && !isUnavailable ? 'pack-name--on' : 'pack-name--off']}>
          {pack.name}
        </span>
        <span class="pack-count-inline">({pack.presets.length})</span>
        {#if isPartial && enabled && missingPacks.length > 0}
          <Tooltip.Root disableHoverableContent={false} delayDuration={100}>
            <Tooltip.Trigger>
              <TriangleAlert class="h-3 w-3 cursor-pointer text-amber-500" />
            </Tooltip.Trigger>
            <Tooltip.Content side="top" class="p-2">
              <div class="flex flex-col gap-1.5">
                <p class="text-[10px]">Requires: {missingPacks.map((p) => p.name).join(', ')}</p>
                <button
                  onclick={enableMissingPacks}
                  class="cursor-pointer rounded bg-amber-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-amber-500"
                  >Enable</button
                >
              </div>
            </Tooltip.Content>
          </Tooltip.Root>
        {/if}
      </div>
      <span class="pack-desc">{pack.description}</span>
    </div>

    <ChevronDown class={['pack-chevron', expanded && 'pack-chevron--open']} />
  </button>

  <!-- Right: toggle -->
  <div class="pack-actions">
    {#if locked}
      <Tooltip.Root delayDuration={100}>
        <Tooltip.Trigger>
          <div class="pack-toggle pack-toggle--locked">
            <Lock class="h-2.5 w-2.5" />
          </div>
        </Tooltip.Trigger>
        <Tooltip.Content side="left" class="max-w-48 p-2">
          <p class="text-[10px]">Starter presets are always enabled.</p>
        </Tooltip.Content>
      </Tooltip.Root>
    {:else}
      <button
        onclick={onToggle}
        disabled={isUnavailable}
        class={[
          'pack-toggle',
          isUnavailable ? 'pack-toggle--locked' : enabled ? 'pack-toggle--on' : 'pack-toggle--off'
        ]}
        title={isUnavailable
          ? 'Enable required object packs first'
          : enabled
            ? 'Disable pack'
            : 'Enable pack'}
      >
        {#if enabled && !isUnavailable}
          <Check class="h-2.5 w-2.5" />
        {/if}
      </button>
    {/if}
  </div>
</div>

{#if expanded}
  <div class="pack-objects">
    {#if missingPacks.length > 0}
      <p class="mb-1 font-mono text-[9px] text-amber-500/80">
        Requires: {missingPacks.map((p) => p.name).join(', ')}.
        <button
          onclick={enableMissingPacks}
          class="cursor-pointer underline underline-offset-2 hover:text-amber-400"
          >Enable them.</button
        >
      </p>
    {/if}
    <div class="pack-objects-inner">
      {#each pack.presets as preset}
        <span class={['pack-obj', matchingPresets.has(preset) && 'pack-obj--match']}>
          {preset}
        </span>
      {/each}
    </div>
  </div>
{/if}

<style>
  .pack-row {
    display: flex;
    align-items: center;
    border-radius: 4px;
    transition: background 0.12s;
  }
  .pack-row:hover {
    background: rgba(255, 255, 255, 0.02);
  }
  .pack-row--unavailable {
    opacity: 0.45;
  }

  .pack-row-main {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    padding: 5px 4px 5px 8px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
  }

  .pack-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .pack-icon--on {
    background: rgba(249, 115, 22, 0.12);
    color: #f97316;
  }
  .pack-icon--off {
    background: rgba(255, 255, 255, 0.04);
    color: #52525b;
  }

  .pack-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 1px;
  }

  .pack-name {
    font-size: 11px;
    font-weight: 500;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pack-name--on {
    color: #d4d4d8;
  }
  .pack-name--off {
    color: #71717a;
  }

  .pack-count-inline {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    color: #3f3f46;
    flex-shrink: 0;
  }

  .pack-desc {
    font-size: 10px;
    color: #52525b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(.pack-chevron) {
    width: 10px;
    height: 10px;
    color: #3f3f46;
    flex-shrink: 0;
    transition: transform 0.15s;
  }
  :global(.pack-chevron--open) {
    transform: rotate(180deg);
  }

  .pack-actions {
    display: flex;
    align-items: center;
    padding: 0 8px 0 4px;
    flex-shrink: 0;
  }

  .pack-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 3px;
    border: 1px solid;
    flex-shrink: 0;
    transition: all 0.12s;
  }
  .pack-toggle--on {
    border-color: rgba(249, 115, 22, 0.5);
    background: rgba(249, 115, 22, 0.12);
    color: #f97316;
    cursor: pointer;
  }
  .pack-toggle--on:hover {
    background: rgba(249, 115, 22, 0.2);
  }
  .pack-toggle--off {
    border-color: #3f3f46;
    background: transparent;
    color: transparent;
    cursor: pointer;
  }
  .pack-toggle--off:hover {
    border-color: #71717a;
  }
  .pack-toggle--locked {
    border-color: #3f3f46;
    background: transparent;
    color: #52525b;
    cursor: not-allowed;
  }

  .pack-objects {
    padding: 0 8px 6px 8px;
  }
  .pack-objects-inner {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    padding: 6px 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  .pack-obj {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    color: #52525b;
    padding: 1px 5px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.03);
  }
  .pack-obj--match {
    background: rgba(249, 115, 22, 0.15);
    color: #fb923c;
  }
</style>
