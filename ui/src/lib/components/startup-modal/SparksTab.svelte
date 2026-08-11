<script lang="ts">
  import { Sparkles } from '@lucide/svelte/icons';
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
  const selectedOutputs = $derived(outputs.filter((output) => selectedOutputIds.has(output.id)));
  const hasSelection = $derived($sparksSelectedMoodId !== null || selectedOutputIds.size > 0);
  const feelingSummary = $derived(selectedMood?.name ?? 'Any feeling');
  const outputSummary = $derived.by(() => {
    if (selectedOutputs.length === 0) return 'Any medium';
    if (selectedOutputs.length === 1) return selectedOutputs[0].name;

    const firstTwoNames = selectedOutputs.slice(0, 2).map((output) => output.name);
    if (selectedOutputs.length === 2) return firstTwoNames.join(' and ');

    return firstTwoNames.join(', ');
  });
  const hasAdditionalOutputs = $derived(selectedOutputs.length > 2);
  const selectionKey = $derived(`${feelingSummary}-${outputSummary}-${selectedOutputs.length}`);

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
  <div class="sparks-workspace">
    <header class="sparks-intro" class:sparks-intro--active={hasSelection}>
      <div class="sparks-intro-mark" aria-hidden="true"><Sparkles /></div>
      <div class="sparks-intro-copy">
        <h1>
          What happens when <span class="sparks-choice">{feelingSummary}</span><br />
          meets <span class="sparks-choice">{outputSummary}</span>{#if hasAdditionalOutputs}<span
              class="sparks-more">and more</span
            >{/if}?
        </h1>
        <p>
          Combine a feeling with a medium. Patchies will turn the collision into questions to
          explore.
        </p>
      </div>
    </header>

    <div class="sparks-selectors" class:sparks-selectors--active={hasSelection}>
      <svg
        class="sparks-flow-trace"
        viewBox="0 0 32 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path class="sparks-flow-base" d="M 16 0 V 100" pathLength="1" />
        {#if hasSelection}
          {#key selectionKey}
            <path class="sparks-flow-pulse" d="M 16 0 V 100" pathLength="1" />
          {/key}
        {/if}
      </svg>

      <div class="sparks-stage">
        <MoodGrid
          {moods}
          selectedMoodId={$sparksSelectedMoodId}
          onSelect={(id) => sparksSelectedMoodId.set(id)}
        />
      </div>

      <div class="sparks-join" aria-hidden="true">
        <span></span>
        <span class="sparks-junction"><Sparkles class="sparks-junction-icon" /> and / or</span>
        <span></span>
      </div>

      <div class="sparks-stage">
        <OutputGrid {outputs} {selectedOutputIds} />
      </div>
    </div>
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
  .sparks-tab {
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
  }

  .sparks-workspace {
    min-height: 0;
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .sparks-workspace::-webkit-scrollbar {
    width: 6px;
  }
  .sparks-workspace::-webkit-scrollbar-track {
    background: transparent;
  }
  .sparks-workspace::-webkit-scrollbar-thumb {
    border-radius: 3px;
    background: #27272a;
  }

  .sparks-tab-generator {
    position: relative;
    z-index: 4;
    flex: 0 0 auto;
  }

  .sparks-intro {
    position: relative;
    display: flex;
    min-height: 230px;
    align-items: flex-end;
    gap: 24px;
    padding: 32px;
    overflow: hidden;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: radial-gradient(circle at 92% 14%, var(--glow), transparent 30%), #101012;
  }

  .sparks-intro-mark {
    position: relative;
    z-index: 1;
    display: grid;
    width: 48px;
    height: 48px;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid #3f3f46;
    border-radius: 10px;
    color: var(--accent);
    background: #18181b;
  }

  .sparks-intro-mark :global(svg) {
    width: 20px;
    height: 20px;
    stroke-width: 1.6;
  }

  .sparks-intro-copy {
    position: relative;
    z-index: 1;
    max-width: 900px;
  }

  .sparks-intro h1 {
    color: #f4f4f5;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: clamp(2rem, 4.6vw, 3.35rem);
    font-weight: 400;
    line-height: 1.02;
    letter-spacing: -0.035em;
    text-wrap: balance;
  }

  .sparks-intro h1 .sparks-choice {
    color: #a1a1aa;
    text-decoration: underline;
    text-decoration-color: #3f3f46;
    text-decoration-thickness: 1px;
    text-underline-offset: 0.13em;
    transition:
      color 0.2s ease,
      text-decoration-color 0.2s ease;
  }

  .sparks-intro--active h1 .sparks-choice {
    color: var(--text-acc);
    text-decoration-color: color-mix(in srgb, var(--accent) 58%, #3f3f46);
  }

  .sparks-more {
    margin-left: 0.22em;
  }

  .sparks-intro p {
    max-width: 65ch;
    margin-top: 14px;
    color: #a1a1aa;
    font-size: 0.9rem;
    line-height: 1.55;
  }

  .sparks-selectors {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 56px minmax(0, 1fr);
    align-items: stretch;
    gap: 20px;
    padding: 28px 32px 32px;
    overflow: hidden;
    background-color: #0b0b0d;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.028) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.028) 1px, transparent 1px);
    background-size: 24px 24px;
  }

  .sparks-stage,
  .sparks-join {
    position: relative;
    z-index: 1;
  }

  .sparks-stage {
    min-width: 0;
    padding: 20px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    background: #0f0f11;
  }

  .sparks-stage::before {
    content: '';
    position: absolute;
    top: 34px;
    left: -24px;
    width: 7px;
    height: 7px;
    border: 1px solid #52525b;
    border-radius: 50%;
    background: #0b0b0d;
    transform: translateY(-50%);
    transition: border-color 0.2s ease;
  }

  .sparks-selectors--active .sparks-stage::before {
    border-color: var(--accent);
  }

  .sparks-flow-trace {
    position: absolute;
    z-index: 0;
    top: 0;
    bottom: 0;
    left: 0;
    width: 32px;
    height: 100%;
    pointer-events: none;
  }

  .sparks-flow-base,
  .sparks-flow-pulse {
    fill: none;
    vector-effect: non-scaling-stroke;
  }

  .sparks-flow-base {
    stroke: #3f3f46;
    stroke-width: 1;
  }

  .sparks-flow-pulse {
    stroke: var(--accent);
    stroke-width: 2;
    stroke-dasharray: 0.14 0.86;
    animation: sparks-signal 0.75s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes sparks-signal {
    from {
      stroke-dashoffset: 1;
    }
    to {
      stroke-dashoffset: 0;
    }
  }

  .sparks-join {
    display: grid;
    grid-template-rows: 1fr auto 1fr;
    align-items: center;
    justify-items: center;
    gap: 10px;
  }

  .sparks-join > span:first-child,
  .sparks-join > span:last-child {
    width: 1px;
    height: 100%;
    background: #27272a;
  }

  .sparks-junction {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    color: #71717a;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  :global(.sparks-junction-icon) {
    width: 13px;
    height: 13px;
    color: var(--accent);
    stroke-width: 1.7;
  }

  :global(.sparks-tab .sparks-heading) {
    font-family: 'IBM Plex Sans', sans-serif !important;
    font-size: 1rem !important;
    font-style: normal !important;
    font-weight: 500 !important;
    letter-spacing: -0.01em !important;
    color: #d4d4d8 !important;
  }

  /* ── MoodGrid: force 2-col inside narrower modal ── */
  :global(.sparks-tab .mood-grid) {
    grid-template-columns: repeat(2, 1fr) !important;
  }

  :global(.sparks-tab .mood-tile) {
    min-height: 88px;
    padding: 15px 16px;
    border-color: rgba(255, 255, 255, 0.08);
    background: #131315 !important;
    box-shadow: none !important;
    transform: none !important;
  }

  :global(.sparks-tab .mood-tile::after) {
    background: transparent !important;
    opacity: 0 !important;
  }

  :global(.sparks-tab .mood-tile:hover) {
    border-color: color-mix(in srgb, var(--tile-accent) 32%, rgba(255, 255, 255, 0.08));
    background: color-mix(in srgb, var(--tile-accent) 5%, #131315) !important;
    box-shadow: 0 10px 26px rgba(0, 0, 0, 0.2) !important;
    transform: translateY(-2px) !important;
  }

  :global(.sparks-tab .mood-tile-active) {
    border-color: color-mix(in srgb, var(--tile-accent) 26%, rgba(255, 255, 255, 0.08)) !important;
    background: color-mix(in srgb, var(--tile-accent) 9%, #131315) !important;
  }

  :global(.sparks-tab .mood-tile > span:first-child) {
    color: #e4e4e7;
    font-weight: 500;
  }

  :global(.sparks-tab .mood-tile-active > span:first-child) {
    color: var(--text-acc);
  }

  :global(.sparks-tab .mood-tagline) {
    color: #71717a !important;
  }

  :global(.sparks-tab .mood-tile-active .mood-tagline) {
    color: color-mix(in srgb, var(--tile-accent) 55%, #a1a1aa) !important;
  }

  :global(.sparks-tab .mood-tile:focus-visible) {
    border-color: var(--tile-accent) !important;
    outline: 3px solid color-mix(in srgb, var(--tile-accent) 22%, transparent);
    outline-offset: 2px;
  }

  /* ── OutputGrid: 2-col on narrow modal, 4-col when wider ── */
  :global(.sparks-tab .output-grid) {
    grid-template-columns: repeat(2, 1fr) !important;
  }

  :global(.sparks-tab .output-tile) {
    min-height: 84px;
    aspect-ratio: auto;
    border-radius: 8px !important;
  }

  @media (min-width: 1100px) {
    :global(.sparks-tab .output-grid) {
      grid-template-columns: repeat(4, 1fr) !important;
    }
  }

  @media (max-width: 900px) {
    .sparks-selectors {
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .sparks-join {
      grid-template-columns: 1fr auto 1fr;
      grid-template-rows: auto;
    }

    .sparks-join > span:first-child,
    .sparks-join > span:last-child {
      width: 100%;
      height: 1px;
    }

    .sparks-junction {
      flex-direction: row;
    }
  }

  /* ── VisionGenerator overrides for modal context ── */
  :global(.sparks-tab-generator .vision-section) {
    max-height: min(46dvh, 390px);
    margin: 0;
    padding: 14px 20px !important;
    overflow-y: auto;
    background: #101012 !important;
    border-bottom: none !important;
    border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
    box-shadow: 0 -18px 42px rgba(0, 0, 0, 0.28);
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
    .sparks-intro {
      min-height: 0;
      align-items: flex-start;
      padding: 24px 20px;
    }

    .sparks-intro-mark {
      display: none;
    }
    .sparks-intro h1 {
      font-size: clamp(2rem, 10vw, 2.65rem);
    }

    .sparks-selectors {
      padding: 24px 20px 28px;
    }

    .sparks-stage {
      padding: 16px;
    }

    :global(.sparks-tab .mood-grid),
    :global(.sparks-tab .output-grid) {
      grid-template-columns: 1fr !important;
    }

    :global(.sparks-tab .output-tile) {
      min-height: 112px;
      aspect-ratio: auto;
    }

    :global(.sparks-tab-generator .vision-section) {
      max-height: min(52dvh, 420px);
      padding: 12px 14px !important;
    }

    :global(.sparks-tab-generator .visions-grid) {
      grid-template-columns: 1fr !important;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sparks-flow-pulse {
      animation: none;
      stroke-dashoffset: 0;
    }
    :global(.sparks-tab .mood-tile:hover) {
      transform: none !important;
    }
  }
</style>
