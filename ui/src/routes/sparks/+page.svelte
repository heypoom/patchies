<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import MoodGrid from './MoodGrid.svelte';
  import OutputGrid from './OutputGrid.svelte';
  import VisionGenerator from './VisionGenerator.svelte';
  import { moods, outputs } from './data';
  import './sparks.css';

  // ── Selection state ───────────────────────────────────────────
  let selectedMoodId = $state<string | null>(null);
  let selectedOutputIds = new SvelteSet<string>();

  const selectedMood = $derived(moods.find((m) => m.id === selectedMoodId) ?? null);
  const hasSelection = $derived(selectedMoodId !== null || selectedOutputIds.size > 0);

  const accentColor = $derived(selectedMood?.accentColor ?? '#f97316');
  const glowColor = $derived(selectedMood?.glowColor ?? 'rgba(249,115,22,0.05)');
  const textColor = $derived(selectedMood?.textColor ?? '#fed7aa');
</script>

<svelte:head>
  <title>Sparks | Patchies</title>
</svelte:head>

<Tooltip.Provider>
  <div
    class="sparks-page min-h-screen"
    style:--accent={accentColor}
    style:--glow={glowColor}
    style:--text-acc={textColor}
  >
    <!-- ── Hero ── -->
    <header class="px-8 pt-14 pb-8">
      <div class="mx-auto max-w-4xl">
        <p
          class="sparks-mono mb-3 text-[11px] tracking-[0.25em] uppercase"
          style:color="var(--accent)"
        >
          patchies ✦ sparks
        </p>
        <h1 class="sparks-serif">
          What do you want<br />to make people feel?
        </h1>
        <p class="sparks-syne mt-4 max-w-sm text-sm leading-relaxed text-zinc-600">
          Two questions. Pick one or both to find your spark.
        </p>
      </div>
    </header>

    <!-- ── Two-question layout ── -->
    <div class="px-8 pb-10">
      <div class="mx-auto max-w-4xl space-y-8">
        <MoodGrid {moods} {selectedMoodId} onSelect={(id) => (selectedMoodId = id)} />

        <div class="flex items-center gap-4">
          <div class="h-px flex-1 bg-zinc-900"></div>
          <span class="sparks-mono text-[10px] tracking-widest text-zinc-800 uppercase"
            >and / or</span
          >
          <div class="h-px flex-1 bg-zinc-900"></div>
        </div>

        <OutputGrid {outputs} {selectedOutputIds} />
      </div>
    </div>

    <!-- ── AI Vision Generator ── -->
    {#if hasSelection}
      <VisionGenerator
        {selectedMood}
        {selectedOutputIds}
        {outputs}
        {accentColor}
        {glowColor}
        {textColor}
        onScatter={(nodeNames) => {
          localStorage.setItem('patchies:sparks-pending-scatter', JSON.stringify(nodeNames));
          window.location.href = '/';
        }}
        onChat={(prompt) => {
          localStorage.setItem('patchies:sparks-pending-chat', prompt);
          window.location.href = '/';
        }}
      />
    {/if}

    <!-- TODO: Phase 2 — add <SparkResults> component here once curated content is ready. -->

    <!-- ── Footer ── -->
    <div class="border-t border-zinc-900 px-8 py-5">
      <div class="mx-auto flex max-w-4xl items-center justify-between">
        <p class="sparks-mono text-[11px] text-zinc-800">patchies · sparks</p>
        <a
          href="/"
          class="sparks-mono cursor-pointer text-[11px] text-zinc-700 transition-colors hover:text-zinc-400"
        >
          ← back to patchies
        </a>
      </div>
    </div>
  </div>
</Tooltip.Provider>

<style>
  .sparks-page {
    background-color: #09090b;
    background-image: radial-gradient(ellipse 80% 50% at 50% -5%, var(--glow), transparent 60%);
    transition: background-image 0.5s ease;
    font-family: 'Syne', sans-serif;
    color: #e4e4e7;
  }
</style>
