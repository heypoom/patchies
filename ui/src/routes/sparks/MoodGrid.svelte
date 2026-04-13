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
    <span
      class="sparks-heading font-serif text-[clamp(2rem,5vw,3.8rem)] leading-[1.1] text-zinc-100 italic"
      >How should it feel?</span
    >
    {#if selectedMoodId}
      <button
        class="cursor-pointer font-mono text-[11px] text-zinc-700 transition-colors hover:text-zinc-400"
        onclick={() => onSelect(null)}
      >
        ✕ clear
      </button>
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
      >
        <span class="relative z-[1] text-[1.1rem] font-bold text-zinc-100">{mood.name}</span>
        <span class="mood-tagline relative z-[1] font-mono text-[9px] leading-[1.4] text-white/28"
          >{mood.tagline}</span
        >
        {#if active}<span
            class="absolute top-2 right-2.5 z-[1] text-[11px]"
            style:color="var(--tile-accent)">✦</span
          >{/if}
      </button>
    {/each}
  </div>
</div>

<style>
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

  .mood-tile-active .mood-tagline {
    color: color-mix(in srgb, var(--tile-accent) 65%, rgba(255, 255, 255, 0.3));
  }
</style>
