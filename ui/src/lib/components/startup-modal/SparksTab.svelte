<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import MoodGrid from '$routes/sparks/MoodGrid.svelte';
  import OutputGrid from '$routes/sparks/OutputGrid.svelte';
  import VisionGenerator from '$routes/sparks/VisionGenerator.svelte';
  import { moods, outputs } from '$routes/sparks/data';
  import { sparksMoodTheme, sparksSelectedMoodId } from '../../../stores/sparks.store';

  let selectedOutputIds = new SvelteSet<string>();

  const selectedMood = $derived(moods.find((m) => m.id === $sparksSelectedMoodId) ?? null);
  const hasSelection = $derived($sparksSelectedMoodId !== null || selectedOutputIds.size > 0);

  const accentColor = $derived(selectedMood?.accentColor ?? '#f97316');
  const glowColor = $derived(selectedMood?.glowColor ?? 'rgba(249,115,22,0.05)');
  const textColor = $derived(selectedMood?.textColor ?? '#fed7aa');

  $effect(() => {
    sparksMoodTheme.set({ accentColor, glowColor, textColor });
  });
</script>

<div
  class="sparks-tab"
  style:--accent={accentColor}
  style:--glow={glowColor}
  style:--text-acc={textColor}
>
  <!-- Hero -->
  <div class="sparks-tab-hero">
    <div class="sparks-tab-hero-top">
      <p class="sparks-tab-eyebrow" style:color="var(--accent)">patchies ✦ sparks</p>
      <a href="/sparks" class="sparks-tab-fullscreen sparks-mono" target="_blank" rel="noopener">
        open full screen ↗
      </a>
    </div>
    <h2 class="sparks-tab-headline">What do you want<br />to make people feel?</h2>
    <p class="sparks-tab-sub">Two questions. Pick one or both to find your spark.</p>
  </div>

  <!-- Selectors -->
  <div class="sparks-tab-body">
    <MoodGrid
      {moods}
      selectedMoodId={$sparksSelectedMoodId}
      onSelect={(id) => sparksSelectedMoodId.set(id)}
    />

    <div class="sparks-tab-divider">
      <div class="sparks-tab-rule"></div>
      <span class="sparks-tab-or">and / or</span>
      <div class="sparks-tab-rule"></div>
    </div>

    <OutputGrid {outputs} {selectedOutputIds} />
  </div>

  <!-- AI Vision Generator -->
  {#if hasSelection}
    <div class="sparks-tab-generator">
      <VisionGenerator
        {selectedMood}
        {selectedOutputIds}
        {outputs}
        {accentColor}
        {glowColor}
        {textColor}
      />
    </div>
  {/if}
</div>

<style>
  .sparks-tab {
    font-family: 'Syne', sans-serif;
    color: #e4e4e7;
  }

  .sparks-tab-hero {
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    margin-bottom: 20px;
  }

  .sparks-tab-hero-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .sparks-tab-fullscreen {
    font-size: 9px;
    letter-spacing: 0.15em;
    color: #3f3f46;
    text-decoration: none;
    transition: color 0.15s;
  }
  .sparks-tab-fullscreen:hover {
    color: var(--accent);
  }

  .sparks-tab-eyebrow {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
  }

  .sparks-tab-headline {
    font-family: 'Instrument Serif', serif;
    font-style: italic;
    font-size: clamp(1.6rem, 4vw, 2.4rem);
    line-height: 1.1;
    color: #f4f4f5;
    margin-bottom: 10px;
  }

  .sparks-tab-sub {
    font-family: 'Syne', sans-serif;
    font-size: 12px;
    color: #52525b;
    line-height: 1.5;
  }

  .sparks-tab-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .sparks-tab-divider {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .sparks-tab-rule {
    flex: 1;
    height: 1px;
    background: #18181b;
  }

  .sparks-tab-or {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #27272a;
  }

  /* ── MoodGrid: force 2-col inside narrower modal ── */
  :global(.sparks-tab .mood-grid) {
    grid-template-columns: repeat(2, 1fr) !important;
  }

  /* ── VisionGenerator overrides for modal context ── */

  /* Remove page-level horizontal padding — modal provides its own */
  :global(.sparks-tab-generator .vision-section) {
    padding-left: 0 !important;
    padding-right: 0 !important;
    background: none !important;
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-bottom: none !important;
  }

  /* Remove max-width — modal constrains width itself */
  :global(.sparks-tab-generator .vision-section > div) {
    max-width: none !important;
  }

  /* Force 2-col grid — modal is too narrow for 3 */
  :global(.sparks-tab-generator .visions-grid) {
    grid-template-columns: repeat(2, 1fr) !important;
  }

  /* Third card always spans full width in modal (2-col is always active here) */
  :global(.sparks-tab-generator .visions-grid > *:last-child:nth-child(3)) {
    grid-column: 1 / -1;
    min-height: unset;
  }

  /* On narrow modal, single column */
  @media (max-width: 520px) {
    :global(.sparks-tab-generator .visions-grid) {
      grid-template-columns: 1fr !important;
    }
  }
</style>
