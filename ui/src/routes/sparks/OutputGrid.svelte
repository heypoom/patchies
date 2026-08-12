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
    Sparkles,
    Disc3,
    Globe,
    SlidersHorizontal,
    X,
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
    serial: Usb,
    ai: Sparkles,
    sampling: Disc3,
    connections: Globe,
    ui: SlidersHorizontal
  };

  interface Props {
    outputs: Output[];
    selectedOutputIds: SvelteSet<string>;
  }

  let { outputs, selectedOutputIds }: Props = $props();
</script>

<div>
  <div class="sparks-question mb-4 flex items-center justify-between gap-3">
    <span class="sparks-heading">What could it become?</span>

    {#if selectedOutputIds.size > 0}
      <button
        class="sparks-clear cursor-pointer"
        onclick={() => selectedOutputIds.clear()}
        aria-label="Clear selected media"
      >
        <X size={13} /> Clear media
      </button>
    {:else}
      <span class="sparks-pick-note">Choose any</span>
    {/if}
  </div>

  <div
    class="output-grid grid auto-rows-[1fr] grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
  >
    {#each outputs as output (output.id)}
      {@const active = selectedOutputIds.has(output.id)}
      {@const Icon = icons[output.id]}
      <button
        class="output-tile cursor-pointer"
        class:output-tile-active={active}
        onclick={() =>
          active ? selectedOutputIds.delete(output.id) : selectedOutputIds.add(output.id)}
        aria-pressed={active}
      >
        <span class="output-icon text-[1.2rem] leading-none text-zinc-600 transition-colors"
          ><Icon size={18} /></span
        >
        <span class="output-name text-xs font-semibold text-zinc-400 transition-colors"
          >{output.name}</span
        >
        <span
          class={[
            'mx-1.5 text-center font-mono text-[9px] leading-[1.3]',
            active ? 'text-accent' : 'text-zinc-500'
          ]}>{output.description}</span
        >
      </button>
    {/each}
  </div>
</div>

<style>
  .sparks-heading {
    color: #e4e4e7;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 1rem;
    font-weight: 500;
    letter-spacing: -0.01em;
  }

  .sparks-pick-note {
    color: #71717a;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.72rem;
  }

  .sparks-clear {
    display: inline-flex;
    min-height: 28px;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border: 1px solid #3f3f46;
    border-radius: 6px;
    color: #a1a1aa;
    background: #18181b;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.7rem;
    font-weight: 500;
    line-height: 1;
    transition:
      color 0.15s ease,
      border-color 0.15s ease,
      background 0.15s ease;
  }

  .sparks-clear:hover {
    border-color: #52525b;
    color: #f4f4f5;
    background: #27272a;
  }

  .sparks-clear:focus-visible {
    outline: 3px solid rgba(249, 115, 22, 0.22);
    outline-offset: 2px;
  }

  .output-tile {
    aspect-ratio: auto;
    border-radius: 8px;
    padding: 14px 10px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
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
