<script lang="ts">
  import { ChevronDown, Check, Lock } from '@lucide/svelte/icons';
  import type { ExtensionPack } from '../../../stores/extensions.store';
  import { getPackIcon } from '$lib/extensions/pack-icons';
  import * as Tooltip from '../ui/tooltip';

  let {
    pack,
    enabled,
    onToggle,
    searchQuery = '',
    locked = false
  }: {
    pack: ExtensionPack;
    enabled: boolean;
    onToggle: () => void;
    searchQuery?: string;
    locked?: boolean;
  } = $props();

  const matchingObjects = $derived.by(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const query = searchQuery.toLowerCase();
    return new Set(pack.objects.filter((obj) => obj.toLowerCase().includes(query)));
  });

  const hasObjectMatches = $derived(matchingObjects.size > 0);

  let manualExpanded = $state(false);
  const expanded = $derived(hasObjectMatches || manualExpanded);

  const IconComponent = $derived(getPackIcon(pack.icon));
</script>

<div class={['pack-row', enabled && 'pack-row--enabled']}>
  <!-- Left: icon + name + description -->
  <button
    class="pack-row-main"
    onclick={() => (manualExpanded = !manualExpanded)}
    title="Show objects in {pack.name}"
  >
    <div class={['pack-icon', enabled ? 'pack-icon--on' : 'pack-icon--off']}>
      <IconComponent class="h-3 w-3" />
    </div>

    <div class="pack-info">
      <span class={['pack-name', enabled ? 'pack-name--on' : 'pack-name--off']}>
        {pack.name}
      </span>
      <span class="pack-desc">{pack.description}</span>
    </div>

    <ChevronDown class={['pack-chevron', expanded && 'pack-chevron--open']} />
  </button>

  <!-- Right: count + toggle -->
  <div class="pack-actions">
    <span class="pack-count">{pack.objects.length}</span>

    {#if locked}
      <Tooltip.Root delayDuration={100}>
        <Tooltip.Trigger>
          <div class="pack-toggle pack-toggle--locked">
            <Lock class="h-2.5 w-2.5" />
          </div>
        </Tooltip.Trigger>
        <Tooltip.Content side="left" class="max-w-48 p-2">
          <p class="text-[10px]">Starter objects are always enabled.</p>
        </Tooltip.Content>
      </Tooltip.Root>
    {:else}
      <button
        onclick={onToggle}
        class={['pack-toggle', enabled ? 'pack-toggle--on' : 'pack-toggle--off']}
        title={enabled ? 'Disable pack' : 'Enable pack'}
      >
        {#if enabled}
          <Check class="h-2.5 w-2.5" />
        {/if}
      </button>
    {/if}
  </div>
</div>

{#if expanded}
  <div class="pack-objects">
    <div class="pack-objects-inner">
      {#each pack.objects as obj}
        <span class={['pack-obj', matchingObjects.has(obj) && 'pack-obj--match']}>
          {obj}
        </span>
      {/each}
    </div>
  </div>
{/if}

<style>
  .pack-row {
    display: flex;
    align-items: center;
    gap: 0;
    border-radius: 4px;
    transition: background 0.12s;
  }
  .pack-row:hover {
    background: rgba(255, 255, 255, 0.02);
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
    gap: 6px;
    padding: 0 8px 0 4px;
    flex-shrink: 0;
  }

  .pack-count {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    color: #3f3f46;
    min-width: 16px;
    text-align: right;
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

  /* Object pills */
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
