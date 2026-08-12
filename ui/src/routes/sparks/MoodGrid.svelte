<script lang="ts">
  import { ArrowRight, Check, X } from '@lucide/svelte/icons';
  import type { Mood } from './types';

  interface Props {
    moods: Mood[];
    selectedMoodId: string | null;
    onSelect: (id: string | null) => void;
  }

  let { moods, selectedMoodId, onSelect }: Props = $props();
</script>

<div>
  <div class="sparks-question mb-4 flex items-center justify-between gap-3">
    <span class="sparks-heading">How should it feel?</span>
    {#if selectedMoodId}
      <button
        class="sparks-clear cursor-pointer"
        onclick={() => onSelect(null)}
        aria-label="Clear selected feeling"
      >
        <X size={13} /> Clear feeling
      </button>
    {:else}
      <span class="sparks-pick-note">Choose one</span>
    {/if}
  </div>

  <div class="mood-grid grid grid-cols-2 gap-2 sm:grid-cols-4">
    {#each moods as mood (mood.id)}
      {@const active = selectedMoodId === mood.id}
      <button
        class="mood-tile cursor-pointer"
        class:mood-tile-active={active}
        style:background={mood.gradient}
        style:--tile-accent={mood.accentColor}
        style:--tile-glow={mood.glowColor}
        onclick={() => onSelect(selectedMoodId === mood.id ? null : mood.id)}
        aria-pressed={active}
      >
        <span class="mood-name relative z-[1] text-[1.1rem] font-bold text-zinc-100"
          >{mood.name}</span
        >
        <span class="mood-tagline relative z-[1] font-mono text-[9px] leading-[1.4] text-white/28"
          >{mood.tagline}</span
        >
        <span class="mood-action" aria-hidden="true">
          {#if active}<Check size={15} />{:else}<ArrowRight size={15} />{/if}
        </span>
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

  .mood-tile {
    position: relative;
    border-radius: 8px;
    padding: 16px 14px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    text-align: left;
    overflow: hidden;
    transition:
      border-color 0.2s,
      transform 0.15s,
      box-shadow 0.2s;
    min-height: 90px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 4px;
  }

  .mood-action {
    position: absolute;
    z-index: 2;
    top: 14px;
    right: 14px;
    display: grid;
    width: 26px;
    height: 26px;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #71717a;
    transition:
      color 0.18s ease,
      border-color 0.18s ease,
      background 0.18s ease,
      transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .mood-tile:hover .mood-action {
    color: var(--tile-accent);
    border-color: color-mix(in srgb, var(--tile-accent) 40%, #3f3f46);
    background: color-mix(in srgb, var(--tile-accent) 7%, #18181b);
    transform: translateX(2px);
  }

  .mood-tile-active .mood-action {
    color: #09090b;
    border-color: var(--tile-accent);
    background: var(--tile-accent);
  }
  .mood-tile::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 80% 60% at 50% 110%, var(--tile-glow), transparent);
    opacity: 0;
    transition: opacity 0.3s;
  }
  .mood-tile:hover::after,
  .mood-tile-active::after {
    opacity: 1;
  }
  .mood-tile:hover {
    border-color: color-mix(in srgb, var(--tile-accent) 30%, transparent);
    transform: translateY(-1px);
  }
  .mood-tile-active {
    border-color: color-mix(in srgb, var(--tile-accent) 50%, transparent) !important;
    box-shadow: 0 0 20px color-mix(in srgb, var(--tile-accent) 10%, transparent);
    transform: translateY(-1px);
  }

  .mood-tile-active .mood-tagline {
    color: color-mix(in srgb, var(--tile-accent) 65%, rgba(255, 255, 255, 0.3));
  }
</style>
