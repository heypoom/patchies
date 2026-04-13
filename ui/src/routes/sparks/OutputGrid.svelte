<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import {
    Layers,
    Box,
    AudioLines,
    Music,
    Hand,
    Code,
    Cpu,
    Activity,
    Lightbulb,
    Projector,
    Piano,
    Usb,
    type Icon as LucideIcon
  } from '@lucide/svelte';
  import type { Output } from './types';

  type LucideComponent = typeof LucideIcon;

  const icons: Record<string, LucideComponent> = {
    '2d-visual': Layers,
    video: Box,
    sound: AudioLines,
    music: Music,
    gestures: Hand,
    code: Code,
    'low-level': Cpu,
    dsp: Activity,
    lighting: Lightbulb,
    projection: Projector,
    midi: Piano,
    serial: Usb
  };

  interface Props {
    outputs: Output[];
    selectedOutputIds: SvelteSet<string>;
  }

  let { outputs, selectedOutputIds }: Props = $props();
</script>

<div>
  <div class="mb-4 flex items-baseline gap-3">
    <span
      class="sparks-heading font-serif text-[clamp(2rem,5vw,3.8rem)] leading-[1.1] text-zinc-100 italic"
      >What do you want to make?</span
    >
    {#if selectedOutputIds.size > 0}
      <button
        class="cursor-pointer font-mono text-[11px] text-zinc-700 transition-colors hover:text-zinc-400"
        onclick={() => selectedOutputIds.clear()}
      >
        ✕ clear
      </button>
    {/if}
  </div>

  <div class="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
    {#each outputs as output (output.id)}
      {@const active = selectedOutputIds.has(output.id)}
      {@const Icon = icons[output.id]}
      <button
        class="output-tile cursor-pointer"
        class:output-tile-active={active}
        onclick={() =>
          active ? selectedOutputIds.delete(output.id) : selectedOutputIds.add(output.id)}
      >
        <span class="output-icon text-[1.2rem] leading-none text-zinc-600 transition-colors"
          ><Icon size={18} /></span
        >
        <span class="output-name text-xs font-semibold text-zinc-400 transition-colors"
          >{output.name}</span
        >
        <span class="text-center font-mono text-[9px] leading-[1.3] text-zinc-700"
          >{output.description}</span
        >
      </button>
    {/each}
  </div>
</div>

<style>
  .output-tile {
    border-radius: 8px;
    padding: 14px 10px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    transition:
      border-color 0.15s,
      background 0.15s,
      transform 0.15s;
  }
  .output-tile:hover {
    border-color: rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.04);
    transform: translateY(-1px);
  }
  .output-tile-active {
    border-color: color-mix(in srgb, var(--accent) 45%, transparent) !important;
    background: color-mix(in srgb, var(--accent) 8%, transparent) !important;
  }

  .output-tile:hover .output-icon,
  .output-tile-active .output-icon {
    color: var(--accent);
  }

  .output-tile-active .output-name {
    color: var(--text-acc);
  }
</style>
