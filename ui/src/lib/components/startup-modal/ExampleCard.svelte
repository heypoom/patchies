<script lang="ts">
  import { ArrowUpRight, AudioWaveform, Braces, Eye, Network, Wrench } from '@lucide/svelte/icons';
  import DemoSignal from './DemoSignal.svelte';
  import type { ExamplePatch } from './types';

  let { patch, onLoad }: { patch: ExamplePatch; onLoad: (id: string) => void } = $props();

  const categoryIcons = {
    Visual: Eye,
    Audio: AudioWaveform,
    Programming: Braces,
    Networking: Network,
    'Dev Patches': Wrench
  } as const;

  const CategoryIcon = $derived(
    categoryIcons[patch.category as keyof typeof categoryIcons] ?? Braces
  );
  const signalVariant = $derived(
    Array.from(patch.name).reduce((total, character) => total + character.charCodeAt(0), 0) % 3
  );
</script>

<button onclick={() => onLoad(patch.slug)} class="ex-card cursor-pointer">
  <DemoSignal category={patch.category} variant={signalVariant} />
  <span class="ex-topline">
    <span class="ex-category" role="img" aria-label={patch.category}>
      <CategoryIcon class="ex-category-icon" aria-hidden="true" />
    </span>
    {#if patch.author}<span class="ex-author">{patch.author}</span>{/if}
  </span>
  <span class="ex-copy">
    <span class="ex-title">{patch.name}</span>
    {#if patch.description}
      <span class="ex-desc">{patch.description}</span>
    {/if}
  </span>
  <span class="ex-footer">
    <span class="ex-action">
      Open demo
      <ArrowUpRight class="ex-action-icon" aria-hidden="true" />
    </span>
  </span>
</button>

<style>
  .ex-card {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 176px;
    gap: 14px;
    padding: 17px 18px 16px;
    background: #151517;
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 12px;
    text-align: left;
    cursor: pointer;
    overflow: hidden;
    transition:
      background 0.16s ease,
      border-color 0.16s ease;
  }

  .ex-card:hover {
    background: #19191b;
    border-color: rgba(249, 115, 22, 0.38);
  }

  .ex-card:hover .ex-title {
    color: #f4f4f5;
  }
  .ex-card:hover .ex-action {
    color: #f97316;
  }
  .ex-card:hover .ex-category {
    color: #f97316;
  }

  .ex-card:focus-visible {
    outline: 2px solid #f97316;
    outline-offset: -2px;
  }

  .ex-topline {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 20px;
  }

  .ex-action,
  .ex-author {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .ex-category {
    display: inline-flex;
    align-items: center;
    color: #71717a;
    transition: color 0.15s ease;
  }

  :global(.ex-category-icon) {
    width: 16px;
    height: 16px;
    stroke-width: 1.7;
  }

  .ex-copy {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ex-title {
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 1.12rem;
    font-weight: 500;
    color: #e4e4e7;
    line-height: 1.25;
    transition: color 0.15s;
  }

  .ex-desc {
    max-width: 44ch;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.8rem;
    color: #8b8b94;
    line-height: 1.55;
  }

  .ex-footer {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    padding-top: 11px;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
  }

  .ex-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #d4d4d8;
    transition: color 0.15s ease;
  }

  .ex-author {
    margin-left: auto;
    color: #71717a;
    letter-spacing: 0.04em;
    text-transform: none;
  }

  :global(.ex-action-icon) {
    width: 13px;
    height: 13px;
    stroke-width: 1.8;
  }

  @media (max-width: 600px) {
    .ex-card {
      min-height: 166px;
      padding: 18px 20px;
    }
  }
</style>
