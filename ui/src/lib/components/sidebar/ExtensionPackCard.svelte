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
      .with('Sparkles', () => Sparkles)
      .with('Palette', () => Palette)
      .with('AudioLines', () => AudioLines)
      .with('Music', () => Music)
      .with('GitBranch', () => GitBranch)
      .with('Layout', () => Layout)
      .with('Wifi', () => Wifi)
      .with('Brain', () => Brain)
      .with('Cpu', () => Cpu)
      .otherwise(() => Sparkles)
  );
</script>

<div
  class={[
    'rounded-lg border transition-colors',
    enabled ? 'border-zinc-600 bg-zinc-800/50' : 'border-zinc-800 bg-zinc-900/50'
  ]}
>
  <!-- Header -->
  <div class="flex items-center gap-3 p-3">
    <!-- Icon -->
    <div
      class={[
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
        enabled ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800 text-zinc-500'
      ]}
    >
      <IconComponent class="h-4 w-4" />
    </div>

    <!-- Info -->
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <span class={['text-sm font-medium', enabled ? 'text-zinc-200' : 'text-zinc-400']}>
          {pack.name}
        </span>
        <span class="text-xs text-zinc-600">
          {pack.objects.length} objects
        </span>
      </div>
      <p class="truncate text-xs text-zinc-500">{pack.description}</p>
    </div>

    <!-- Toggle button -->
    <button
      onclick={onToggle}
      class={[
        'flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors',
        enabled
          ? 'border-green-600 bg-green-600/20 text-green-400 hover:bg-green-600/30'
          : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400'
      ]}
      title={enabled ? 'Disable pack' : 'Enable pack'}
    >
      {#if enabled}
        <Check class="h-3.5 w-3.5" />
      {/if}
    </button>
  </div>

  <!-- Expandable object list -->
  <button
    onclick={() => (expanded = !expanded)}
    class="flex w-full cursor-pointer items-center justify-between border-t border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-400"
  >
    <span>View objects</span>
    <ChevronDown class={['h-3 w-3 transition-transform', expanded ? 'rotate-180' : '']} />
  </button>

  {#if expanded}
    <div class="border-t border-zinc-800 px-3 py-2">
      <div class="flex flex-wrap gap-1">
        {#each pack.objects as obj}
          <span class="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
            {obj}
          </span>
        {/each}
      </div>
    </div>
  {/if}
</div>
