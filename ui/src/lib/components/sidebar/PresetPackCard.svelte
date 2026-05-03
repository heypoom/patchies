<script lang="ts">
  import { TriangleAlert } from '@lucide/svelte/icons';
  import { getPresetPackDisplayItems } from '$lib/extensions/preset-pack-index';
  import type { PresetPack } from '../../../stores/extensions.store';
  import { enabledObjects, enabledPackIds, BUILT_IN_PACKS } from '../../../stores/extensions.store';
  import * as Tooltip from '../ui/tooltip';
  import PackCard from './PackCard.svelte';

  let {
    pack,
    enabled,
    onToggle,
    searchQuery = '',
    locked = false,
    variant = 'row' as 'row' | 'tile',
    selected = false,
    onSelect
  }: {
    pack: PresetPack;
    enabled: boolean;
    onToggle: () => void;
    searchQuery?: string;
    locked?: boolean;
    variant?: 'row' | 'tile';
    selected?: boolean;
    onSelect?: () => void;
  } = $props();

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

  const isUnavailable = $derived(!hasAnyRequiredObjects && pack.requiredObjects.length > 0);
  const isPartial = $derived(hasAnyRequiredObjects && !hasAllRequiredObjects);
  const displayItems = $derived(getPresetPackDisplayItems(pack));
</script>

<PackCard
  name={pack.name}
  description={pack.description}
  icon={pack.icon}
  items={displayItems}
  {enabled}
  {onToggle}
  {searchQuery}
  {locked}
  {variant}
  {selected}
  {onSelect}
  unavailable={isUnavailable}
>
  {#snippet nameExtra()}
    {#if isPartial && enabled && missingPacks.length > 0}
      <Tooltip.Root disableHoverableContent={false} delayDuration={100}>
        <Tooltip.Trigger>
          <TriangleAlert
            class="h-3 w-3 cursor-pointer text-amber-500"
            onclick={(e) => e.stopPropagation()}
          />
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
  {/snippet}

  {#snippet expandedHeader()}
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
  {/snippet}
</PackCard>
