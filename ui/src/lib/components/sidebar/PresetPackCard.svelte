<script lang="ts">
  import {
    Sparkles,
    Palette,
    AudioLines,
    Music,
    GitBranch,
    Layout,
    Wifi,
    Brain,
    Cpu,
    Code,
    ChevronDown,
    Check,
    AlertTriangle
  } from '@lucide/svelte/icons';
  import { match } from 'ts-pattern';
  import type { PresetPack } from '../../../stores/extensions.store';
  import { enabledObjects, enabledPackIds, BUILT_IN_PACKS } from '../../../stores/extensions.store';
  import * as Tooltip from '../ui/tooltip';

  let {
    pack,
    enabled,
    onToggle
  }: {
    pack: PresetPack;
    enabled: boolean;
    onToggle: () => void;
  } = $props();

  let expanded = $state(false);

  // Check availability based on required objects
  const hasAllRequiredObjects = $derived(
    pack.requiredObjects.every((obj) => $enabledObjects.has(obj))
  );
  const hasAnyRequiredObjects = $derived(
    pack.requiredObjects.some((obj) => $enabledObjects.has(obj))
  );
  const missingObjects = $derived(pack.requiredObjects.filter((obj) => !$enabledObjects.has(obj)));

  const IconComponent = $derived(
    match(pack.icon)
      .with('Sparkles', () => Sparkles)
      .with('Palette', () => Palette)
      .with('AudioLines', () => AudioLines)
      .with('Music', () => Music)
      .with('GitBranch', () => GitBranch)
      .with('Layout', () => Layout)
      .with('Wifi', () => Wifi)
      .with('Brain', () => Brain)
      .with('Cpu', () => Cpu)
      .with('Code', () => Code)
      .otherwise(() => Sparkles)
  );

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
        {#if isPartial && enabled}
          <Tooltip.Root>
            <Tooltip.Trigger>
              <AlertTriangle class="h-3 w-3 text-amber-500" />
            </Tooltip.Trigger>
            <Tooltip.Content>
              <p>Some required objects are disabled</p>
            </Tooltip.Content>
          </Tooltip.Root>
        {/if}
      </div>
    </div>

    <!-- Toggle button -->
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
  </div>

  <!-- Expandable details -->
  <button
    onclick={() => (expanded = !expanded)}
    class="flex w-full cursor-pointer items-center justify-between border-t border-zinc-800/50 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-400"
  >
    <span>{pack.description}</span>
    <ChevronDown class={['h-2.5 w-2.5 transition-transform', expanded ? 'rotate-180' : '']} />
  </button>

  {#if expanded}
    <div class="border-t border-zinc-800/50 px-2 py-1.5">
      <!-- Missing objects warning -->
      {#if missingObjects.length > 0}
        <div class="mb-1.5 text-[9px] text-amber-500/80">
          Requires: {missingObjects.join(', ')}
        </div>
      {/if}

      <!-- Preset list -->
      <div class="flex flex-wrap gap-0.5">
        {#each pack.presets as preset}
          <span class="rounded bg-zinc-800 px-1 py-0.5 font-mono text-[9px] text-zinc-400">
            {preset}
          </span>
        {/each}
      </div>
    </div>
  {/if}
</div>
