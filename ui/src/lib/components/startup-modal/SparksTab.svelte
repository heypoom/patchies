<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import MoodGrid from '$routes/sparks/MoodGrid.svelte';
  import OutputGrid from '$routes/sparks/OutputGrid.svelte';
  import VisionGenerator from '$routes/sparks/VisionGenerator.svelte';
  import { moods, outputs } from '$routes/sparks/data';
  import { sparksMoodTheme, sparksSelectedMoodId } from '../../../stores/sparks.store';
  import { isSidebarOpen, sidebarView } from '../../../stores/ui.store';
  import { chatSessionsStore, setDraft } from '../../../stores/chat-sessions.store';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';

  interface Props {
    closeModal: () => void;
  }

  let { closeModal }: Props = $props();

  let selectedOutputIds = new SvelteSet<string>();

  const eventBus = PatchiesEventBus.getInstance();

  function handleScatter(nodeNames: string[]) {
    eventBus.dispatch({ type: 'scatterNodes', nodeNames });
    closeModal();
  }

  function handleChat(prompt: string) {
    const activeId = $chatSessionsStore.activeId;
    setDraft(activeId, prompt);
    $isSidebarOpen = true;
    $sidebarView = 'chat';
    closeModal();
  }

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
  class="sparks-tab text-zinc-200"
  style:--accent={accentColor}
  style:--glow={glowColor}
  style:--text-acc={textColor}
>
  <!-- Hero -->
  <div class="mb-5 border-b border-white/4 pb-5">
    <div class="mb-2.5 flex items-center justify-between">
      <p class="font-mono text-[10px] tracking-[0.25em] uppercase" style:color="var(--accent)">
        patchies ✦ sparks
      </p>
      <a
        href="/sparks"
        class="sparks-tab-fullscreen font-mono text-[9px] tracking-[0.15em] text-zinc-700 no-underline transition-colors"
        target="_blank"
        rel="noopener"
      >
        open full screen ↗
      </a>
    </div>
    <h2
      class="mb-2.5 font-serif text-[clamp(1.6rem,4vw,2.4rem)] leading-[1.1] text-zinc-100 italic"
    >
      What do you want<br />to make people feel?
    </h2>
    <p class="text-xs leading-relaxed text-zinc-600">
      Two questions. Pick one or both to find your spark.
    </p>
  </div>

  <!-- Selectors -->
  <div class="flex flex-col gap-4">
    <MoodGrid
      {moods}
      selectedMoodId={$sparksSelectedMoodId}
      onSelect={(id) => sparksSelectedMoodId.set(id)}
    />

    <div class="flex items-center gap-3">
      <div class="h-px flex-1 bg-zinc-900"></div>
      <span class="font-mono text-[9px] tracking-[0.2em] text-zinc-800 uppercase">and / or</span>
      <div class="h-px flex-1 bg-zinc-900"></div>
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
        onScatter={handleScatter}
        onChat={handleChat}
      />
    </div>
  {/if}
</div>

<style>
  .sparks-tab-fullscreen:hover {
    color: var(--accent);
  }

  /* ── Shrink section headings for modal context ── */
  :global(.sparks-tab .sparks-heading) {
    font-size: 1.25rem !important;
  }

  /* ── MoodGrid: force 2-col inside narrower modal ── */
  :global(.sparks-tab .mood-grid) {
    grid-template-columns: repeat(2, 1fr) !important;
  }

  /* ── OutputGrid: force 4-col inside narrower modal ── */
  :global(.sparks-tab .output-grid) {
    grid-template-columns: repeat(4, 1fr) !important;
  }

  /* ── VisionGenerator overrides for modal context ── */
  :global(.sparks-tab-generator .vision-section) {
    padding-left: 0 !important;
    padding-right: 0 !important;
    background: none !important;
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-bottom: none !important;
    border-top: none !important;
  }

  :global(.sparks-tab-generator .vision-section > div) {
    max-width: none !important;
  }

  :global(.sparks-tab-generator .visions-grid) {
    grid-template-columns: repeat(2, 1fr) !important;
  }

  :global(.sparks-tab-generator .visions-grid > *:last-child:nth-child(3)) {
    grid-column: 1 / -1;
    min-height: unset;
  }

  @media (max-width: 520px) {
    :global(.sparks-tab-generator .visions-grid) {
      grid-template-columns: 1fr !important;
    }
  }
</style>
