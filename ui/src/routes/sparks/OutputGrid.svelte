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
    <span class="sparks-serif text-xl text-zinc-200">What do you want to make?</span>
    {#if selectedOutputIds.size > 0}
      <button
        class="sparks-mono cursor-pointer text-[11px] text-zinc-700 transition-colors hover:text-zinc-400"
        onclick={() => selectedOutputIds.clear()}
      >
        ✕ clear
      </button>
    {/if}
  </div>

  <div class="output-grid">
    {#each outputs as output (output.id)}
      {@const active = selectedOutputIds.has(output.id)}
      {@const Icon = icons[output.id]}
      <button
        class="output-tile cursor-pointer"
        class:output-tile-active={active}
        onclick={() =>
          active ? selectedOutputIds.delete(output.id) : selectedOutputIds.add(output.id)}
      >
        <span class="output-icon"><Icon size={18} /></span>
        <span class="output-name sparks-syne">{output.name}</span>
        <span class="output-desc sparks-mono">{output.description}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .output-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
  }

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

  .output-icon {
    font-size: 1.2rem;
    line-height: 1;
    color: #52525b;
    transition: color 0.15s;
  }
  .output-tile:hover .output-icon,
  .output-tile-active .output-icon {
    color: var(--accent);
  }

  .output-name {
    font-size: 0.75rem;
    font-weight: 600;
    color: #a1a1aa;
    transition: color 0.15s;
  }
  .output-tile-active .output-name {
    color: var(--text-acc);
  }

  .output-desc {
    font-size: 9px;
    color: #3f3f46;
    line-height: 1.3;
    text-align: center;
  }
</style>
