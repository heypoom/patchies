<script lang="ts">
  import {
    Box,
    Palette,
    AudioLines,
    SlidersHorizontal,
    Music,
    GitBranch,
    Layout,
    Wifi,
    Piano,
    Brain,
    Cpu,
    Code,
    ChevronDown,
    Check
  } from '@lucide/svelte/icons';
  import { match } from 'ts-pattern';
  import type { ExtensionPack } from '../../../stores/extensions.store';

  let {
    pack,
    enabled,
    onToggle
  }: {
    pack: ExtensionPack;
    enabled: boolean;
    onToggle: () => void;
  } = $props();

  let expanded = $state(false);

  const IconComponent = $derived(
    match(pack.icon)
      .with('Box', () => Box)
      .with('Palette', () => Palette)
      .with('AudioLines', () => AudioLines)
      .with('SlidersHorizontal', () => SlidersHorizontal)
      .with('Music', () => Music)
      .with('GitBranch', () => GitBranch)
      .with('Layout', () => Layout)
      .with('Wifi', () => Wifi)
      .with('Piano', () => Piano)
      .with('Brain', () => Brain)
      .with('Cpu', () => Cpu)
      .with('Code', () => Code)
      .otherwise(() => Box)
  );
</script>

<div
  class={[
    'rounded-lg border transition-colors',
    enabled ? 'border-zinc-600 bg-zinc-800/50' : 'border-zinc-800 bg-zinc-900/50'
  ]}
>
  <!-- Header -->
  <div class="flex items-center gap-2 p-2">
    <!-- Icon -->
    <div
      class={[
        'flex h-6 w-6 shrink-0 items-center justify-center rounded',
        enabled ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800 text-zinc-500'
      ]}
    >
      <IconComponent class="h-3.5 w-3.5" />
    </div>

    <!-- Info -->
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5">
        <span class={['text-xs font-medium', enabled ? 'text-zinc-200' : 'text-zinc-400']}>
          {pack.name}
        </span>
        <span class="text-[10px] text-zinc-600">({pack.objects.length})</span>
      </div>
    </div>

    <!-- Toggle button -->
    <button
      onclick={onToggle}
      class={[
        'flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border transition-colors',
        enabled
          ? 'border-green-600 bg-green-600/20 text-green-400 hover:bg-green-600/30'
          : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400'
      ]}
      title={enabled ? 'Disable pack' : 'Enable pack'}
    >
      {#if enabled}
        <Check class="h-3 w-3" />
      {/if}
    </button>
  </div>

  <!-- Expandable object list -->
  <button
    onclick={() => (expanded = !expanded)}
    class="flex w-full cursor-pointer items-center justify-between border-t border-zinc-800/50 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-400"
  >
    <span>{pack.description}</span>

    <ChevronDown class={['h-2.5 w-2.5 transition-transform', expanded ? 'rotate-180' : '']} />
  </button>

  {#if expanded}
    <div class="border-t border-zinc-800/50 px-2 py-1.5">
      <div class="flex flex-wrap gap-0.5">
        {#each pack.objects as obj}
          <span class="rounded bg-zinc-800 px-1 py-0.5 font-mono text-[9px] text-zinc-400">
            {obj}
          </span>
        {/each}
      </div>
    </div>
  {/if}
</div>
