<script lang="ts">
  import type { Mood } from './types';

  interface Props {
    moods: Mood[];
    selectedMoodId: string | null;
    onSelect: (id: string | null) => void;
  }

  let { moods, selectedMoodId, onSelect }: Props = $props();
</script>

<div>
  <div class="mb-4 flex items-baseline gap-3">
    <span class="sparks-serif text-xl text-zinc-200">How should it feel?</span>
    {#if selectedMoodId}
      <button
        class="sparks-mono cursor-pointer text-[11px] text-zinc-700 transition-colors hover:text-zinc-400"
        onclick={() => onSelect(null)}
      >
        ✕ clear
      </button>
    {/if}
  </div>

  <div class="mood-grid">
    {#each moods as mood (mood.id)}
      {@const active = selectedMoodId === mood.id}
      <button
        class="mood-tile cursor-pointer"
        class:mood-tile-active={active}
        style:background={mood.gradient}
        style:--tile-accent={mood.accentColor}
        style:--tile-glow={mood.glowColor}
        onclick={() => onSelect(selectedMoodId === mood.id ? null : mood.id)}
      >
        <span class="mood-name sparks-syne">{mood.name}</span>
        <span class="mood-tagline sparks-mono">{mood.tagline}</span>
        {#if active}<span class="mood-check">✦</span>{/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .mood-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  @media (max-width: 640px) {
    .mood-grid {
      grid-template-columns: repeat(2, 1fr);
    }
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

  .mood-name {
    font-size: 1.1rem;
    font-weight: 700;
    color: #f4f4f5;
    position: relative;
    z-index: 1;
  }
  .mood-tagline {
    font-size: 9px;
    color: rgba(255, 255, 255, 0.28);
    position: relative;
    z-index: 1;
    line-height: 1.4;
  }
  .mood-tile-active .mood-tagline {
    color: color-mix(in srgb, var(--tile-accent) 65%, rgba(255, 255, 255, 0.3));
  }
  .mood-check {
    position: absolute;
    top: 8px;
    right: 10px;
    font-size: 11px;
    color: var(--tile-accent);
    z-index: 1;
  }
</style>
