<script lang="ts">
  import { ArrowLeft, RotateCcw, Sparkles, Square } from '@lucide/svelte/icons';
  import { SvelteSet } from 'svelte/reactivity';
  import { getTextProvider } from '$lib/ai/providers';
  import { extractJson } from '$lib/ai/extract-json';
  import { SPARKS_OBJECT_LIST } from '$lib/ai/object-descriptions-types';
  import VisionFlipCard from './VisionFlipCard.svelte';
  import { resolveNodes } from './types';
  import type { Mood, Output, Vision } from './types';
  import AIProviderSettingsDialog from '$lib/components/dialogs/AIProviderSettingsDialog.svelte';
  import { hasAIApiKey } from '../../stores/ai-settings.store';
  import { sparksVisions } from '../../stores/sparks.store';

  interface Props {
    selectedMood: Mood | null;
    selectedOutputIds: SvelteSet<string>;
    outputs: Output[];
    accentColor: string;
    glowColor: string;
    textColor: string;
    showResults?: boolean;
    onGenerationStart?: () => void;
    onBack?: () => void;
    onScatter?: (nodeNames: string[]) => void;
    onChat?: (prompt: string) => void;
  }

  let {
    selectedMood,
    selectedOutputIds,
    outputs,
    accentColor,
    glowColor,
    textColor,
    showResults = true,
    onGenerationStart,
    onBack,
    onScatter,
    onChat
  }: Props = $props();

  // ── Generation state ──────────────────────────────────────────
  // visions persisted in store so they survive modal close/tab switches
  let isGenerating = $state(false);
  let steerPrompt = $state('');
  let generationError = $state<string | null>(null);
  let abortController: AbortController | null = null;
  let aiSettingsOpen = $state(false);

  const selectedOutputs = $derived(outputs.filter((output) => selectedOutputIds.has(output.id)));

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      }
    };
  }

  // ── Flip card state ───────────────────────────────────────────
  let flippedVision = $state<Vision | null>(null);
  let flippedIndex = $state(0);

  function openVision(v: Vision, index: number) {
    flippedVision = v;
    flippedIndex = index;
  }

  // ── Generation ────────────────────────────────────────────────
  async function generateVisions() {
    if (isGenerating) {
      abortController?.abort();
      return;
    }

    if (!$hasAIApiKey) {
      aiSettingsOpen = true;
      return;
    }

    onGenerationStart?.();
    isGenerating = true;
    sparksVisions.set([]);
    generationError = null;
    abortController = new AbortController();

    const moodContext = selectedMood
      ? `MOOD: ${selectedMood.name} — ${selectedMood.tagline}\n${selectedMood.description}`
      : '';

    const outputContext =
      selectedOutputIds.size > 0
        ? `OUTPUT FOCUS — each idea MUST use at least one object from these categories:\n${[
            ...selectedOutputIds
          ]
            .map((id) => {
              const o = outputs.find((out) => out.id === id);
              return o ? `- ${o.name}: ${resolveNodes(o).join(', ')}` : '';
            })
            .filter(Boolean)
            .join('\n')}`
        : '';

    const steerContext = steerPrompt.trim()
      ? `CREATIVE DIRECTION FROM USER: "${steerPrompt.trim()}"`
      : '';

    const systemPrompt = `You are a creative director for Patchies — a visual/audio patching environment where artists connect nodes to build audio-visual experiences.

Your task: Generate 3 "what if..." ideas — concrete, surprising premises for things someone could build. Each has a specific "what if..." question as the hook, and 1–2 sentences that make the premise feel tangible without explaining how to build it.

The goal: one concrete anchor (the what-if) + open implementation. Not too abstract, not too prescriptive.

${moodContext}
${outputContext}
${steerContext}

AVAILABLE PATCHIES OBJECTS (suggest nodes only from this list):
${SPARKS_OBJECT_LIST}

Respond ONLY with a valid JSON array of exactly 3 ideas:
[
  {
    "title": "What if [specific, concrete premise in under 10 words]?",
    "vision": "1–2 sentences. Describe the specific experience — what happens, what the person does, sees, or hears. Concrete enough to picture immediately. Never mention code, nodes, or how it works.",
    "nodes": ["node1", "node2", "node3"]
  }
]

Good title examples:
- "What if your heartbeat set the tempo?"
- "What if turning off the lights tuned the bass?"
- "What if the longer you held still, the louder it got?"
- "What if your audience's phones were the only instrument?"

Bad titles (too vague — no anchor):
- "What if shadows had meaning?" — unpictureable
- "What if sound became visual?" — generic

Rules:
- Title must be a specific what-if you can immediately picture
- Vision answers it with concrete specificity: what exactly happens
- Never use words: patch, node, code, connect, map, route, signal
- Vary scale: one intimate/personal, one performative, one unexpected
- Avoid: "pulsing", "ethereal", "sonic journey", "immersive", "generative"
- Try cross-domain combinations that feel fresh, e.g. assembly + projection = ?
- ${steerContext || 'Prioritise ideas that feel genuinely new and a little strange'}
${outputContext ? `\nCRITICAL — OUTPUT FOCUS ENFORCEMENT: Every idea's "nodes" array MUST contain AT LEAST one object from the OUTPUT FOCUS list. This is a hard requirement. Do not suggest nodes outside that list unless supplementing it.` : ''}`;

    try {
      const provider = getTextProvider();
      let accumulated = '';

      await provider.generateText([{ role: 'user', content: systemPrompt }], {
        signal: abortController.signal,
        temperature: 1.1,
        onToken: (token) => {
          accumulated += token;
        }
      });

      sparksVisions.set(JSON.parse(extractJson(accumulated.trim())));
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        generationError = e instanceof Error ? e.message : 'Generation failed';
      }
    } finally {
      isGenerating = false;
      abortController = null;
    }
  }
</script>

<section class="vision-section" style:--composer-accent={accentColor}>
  <div class="vision-shell">
    {#if showResults && onBack}
      <div class="vision-stage-bar">
        <button
          class="vision-back cursor-pointer disabled:cursor-not-allowed"
          disabled={isGenerating}
          onclick={onBack}
        >
          <ArrowLeft size={14} /> Edit feeling and medium
        </button>

        <div class="vision-context" aria-label="Selected feeling and media">
          <span class="vision-context-item">
            <span class="vision-context-label">Feeling</span>
            <strong style:color={selectedMood ? textColor : undefined}
              >{selectedMood?.name ?? 'Any feeling'}</strong
            >
          </span>
          <span class="vision-context-item">
            <span class="vision-context-label"
              >{selectedOutputs.length === 1 ? 'Medium' : 'Media'}</span
            >
            <strong>
              {selectedOutputs.length > 0
                ? selectedOutputs.map((output) => output.name).join(' · ')
                : 'Any medium'}
            </strong>
          </span>
        </div>
      </div>
    {/if}

    <div class="vision-composer" class:vision-composer--results={showResults}>
      <div class="vision-copy">
        <span class="vision-mark" aria-hidden="true"><Sparkles size={17} /></span>

        <div>
          <h2>{showResults ? 'Three directions to explore' : 'Imagine the collision'}</h2>
          <p>
            {showResults
              ? 'Open one to inspect the idea and start building.'
              : 'Turn your picks into three concrete what-ifs.'}
          </p>
        </div>
      </div>

      <div class="vision-controls" class:vision-controls--results={showResults}>
        <label class="steer-field" for="sparks-steer-prompt">
          {#if showResults}<span>Refine these ideas</span>{:else}<span class="sr-only"
              >Add a creative direction</span
            >{/if}
          <input
            id="sparks-steer-prompt"
            type="text"
            bind:value={steerPrompt}
            placeholder="Try: stranger, lo-fi, for a gallery opening"
            class="steer-input"
            onkeydown={(e) => e.key === 'Enter' && generateVisions()}
          />
        </label>
        <button
          onclick={generateVisions}
          class="generate-btn cursor-pointer"
          aria-label={isGenerating
            ? 'Stop imagining'
            : $sparksVisions.length > 0
              ? 'Imagine again'
              : 'Imagine ideas'}
        >
          {#if isGenerating}
            <Square size={13} fill="currentColor" /> Stop
          {:else if $sparksVisions.length > 0}
            <RotateCcw size={14} /> Again
          {:else}
            <Sparkles size={14} /> Imagine
          {/if}
        </button>
      </div>
    </div>

    {#if showResults && generationError}
      <p class="generation-error" role="alert">{generationError}</p>
    {/if}

    {#if showResults && isGenerating && $sparksVisions.length === 0}
      <div class="vision-results">
        <div class="visions-grid">
          {#each [0, 1, 2] as i (i)}
            <div class="vision-card vision-skeleton" style:animation-delay="{i * 120}ms"></div>
          {/each}
        </div>
      </div>
    {:else if showResults && $sparksVisions.length > 0}
      <div class="vision-results">
        <div class="visions-grid">
          {#each $sparksVisions as v, i (i)}
            <button
              class="vision-card cursor-pointer text-left"
              style:--card-accent={accentColor}
              style:animation-delay="{i * 80}ms"
              onclick={() => openVision(v, i)}
            >
              <div class="vision-top-line"></div>
              <h3 class="font-serif text-[1.1rem] leading-[1.2] italic" style:color={textColor}>
                {v.title}
              </h3>
              <p class="flex-1 text-[0.8rem] leading-[1.65] text-zinc-500">{v.vision}</p>
              <div class="mt-auto flex flex-wrap gap-1 pt-4">
                {#each v.nodes as node (node)}
                  <span
                    class="rounded-[3px] border border-white/6 bg-white/4 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600"
                    >{node}</span
                  >
                {/each}
              </div>
              <span class="vision-tap-hint font-mono text-[10px] tracking-[0.05em]"
                >tap to explore →</span
              >
            </button>
          {/each}
        </div>
      </div>
    {:else if showResults}
      <div class="vision-empty">
        <Sparkles size={20} aria-hidden="true" />
        <div>
          <strong>No ideas yet</strong>
          <p>Add a constraint or imagine the same ingredients again.</p>
        </div>
      </div>
    {/if}
  </div>
</section>

<!-- AI Provider Settings dialog — portaled to body to escape parent stacking context -->
<div use:portal>
  <AIProviderSettingsDialog bind:open={aiSettingsOpen} onSaveAndContinue={generateVisions} />
</div>

<!-- Flip card overlay — portaled to body to escape any parent stacking context -->
{#if flippedVision}
  <div use:portal>
    <VisionFlipCard
      vision={flippedVision}
      index={flippedIndex}
      {accentColor}
      {glowColor}
      {textColor}
      onClose={() => (flippedVision = null)}
      {onScatter}
      {onChat}
    />
  </div>
{/if}

<style>
  .vision-section {
    animation: dock-in 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .vision-shell {
    width: 100%;
    max-width: none;
  }

  .vision-back {
    display: inline-flex;
    min-height: 32px;
    align-items: center;
    gap: 7px;
    padding: 6px 9px;
    border: 1px solid #3f3f46;
    border-radius: 7px;
    color: #a1a1aa;
    background: #18181b;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.72rem;
    font-weight: 500;
    transition:
      color 0.15s ease,
      border-color 0.15s ease,
      background 0.15s ease;
  }

  .vision-back:hover:not(:disabled) {
    color: #f4f4f5;
    border-color: #52525b;
    background: #27272a;
  }

  .vision-back:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--composer-accent) 22%, transparent);
    outline-offset: 2px;
  }

  .vision-back:disabled {
    opacity: 0.45;
  }

  .vision-stage-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .vision-context {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: flex-end;
    gap: 24px;
    color: #a1a1aa;
  }

  .vision-context-item {
    display: flex;
    min-width: 0;
    align-items: baseline;
    gap: 8px;
  }

  .vision-context-label {
    color: #71717a;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .vision-context-item strong {
    color: #d4d4d8;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.82rem;
    font-weight: 500;
    text-align: right;
  }

  .vision-composer {
    display: grid;
    grid-template-columns: minmax(230px, 0.8fr) minmax(360px, 1.35fr);
    align-items: center;
    gap: 24px;
  }

  .vision-copy {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 12px;
  }

  .vision-mark {
    display: grid;
    width: 36px;
    height: 36px;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--composer-accent) 35%, #3f3f46);
    border-radius: 8px;
    color: var(--composer-accent);
    background: color-mix(in srgb, var(--composer-accent) 7%, #18181b);
  }

  .vision-copy h2 {
    color: #e4e4e7;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.95rem;
    font-weight: 500;
    line-height: 1.25;
    letter-spacing: -0.01em;
  }

  .vision-copy p {
    margin-top: 2px;
    color: #71717a;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.72rem;
    line-height: 1.4;
  }

  .vision-composer--results .vision-copy h2 {
    font-size: 1.1rem;
  }

  .vision-controls {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 8px;
  }

  .vision-controls--results {
    align-items: flex-end;
  }

  .steer-field {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 5px;
    color: #71717a;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.68rem;
    font-weight: 400;
  }

  .steer-input {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    height: 36px;
    min-height: 36px;
    flex: 0 0 36px;
    border: 1px solid #3f3f46;
    border-radius: 7px;
    outline: none;
    padding: 0 12px;
    color: #d4d4d8;
    background: #18181b;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.72rem;
    transition:
      border-color 0.16s ease,
      background 0.16s ease;
  }

  .steer-input::placeholder {
    color: #71717a;
  }

  .steer-input:focus {
    border-color: color-mix(in srgb, var(--composer-accent) 58%, #52525b);
    background: #1c1c1f;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--composer-accent) 14%, transparent);
  }

  .generate-btn {
    display: inline-flex;
    height: 36px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 0 14px;
    border: 1px solid color-mix(in srgb, var(--composer-accent) 55%, #3f3f46);
    border-radius: 7px;
    color: var(--composer-accent);
    background: color-mix(in srgb, var(--composer-accent) 9%, #18181b);
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.75rem;
    font-weight: 500;
    white-space: nowrap;
    transition:
      color 0.16s ease,
      border-color 0.16s ease,
      background 0.16s ease,
      transform 0.16s ease;
  }

  .generate-btn:hover:not(:disabled) {
    color: #09090b;
    border-color: var(--composer-accent);
    background: var(--composer-accent);
    transform: translateY(-1px);
  }

  .generate-btn:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--composer-accent) 22%, transparent);
    outline-offset: 2px;
  }

  .generation-error {
    margin-top: 10px;
    color: #f87171;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.7rem;
  }

  .vision-results {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
  }

  .vision-empty {
    display: flex;
    min-height: 180px;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    color: #71717a;
    text-align: left;
  }

  .vision-empty > :global(svg) {
    color: var(--composer-accent);
    stroke-width: 1.5;
  }

  .vision-empty strong {
    color: #d4d4d8;
    font-size: 0.86rem;
    font-weight: 500;
  }

  .vision-empty p {
    margin-top: 2px;
    font-size: 0.74rem;
  }

  @keyframes dock-in {
    from {
      opacity: 0;
      transform: translateY(14px);
      clip-path: inset(100% 0 0 0);
    }

    to {
      opacity: 1;
      transform: translateY(0);
      clip-path: inset(0 0 0 0);
    }
  }

  .visions-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  @media (max-width: 768px) {
    .vision-stage-bar {
      align-items: flex-start;
      flex-direction: column;
      gap: 12px;
    }

    .vision-context {
      width: 100%;
      justify-content: flex-start;
    }

    .vision-composer {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .visions-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    .visions-grid > *:last-child:nth-child(3) {
      grid-column: 1 / -1;
      min-height: unset;
    }
  }

  @media (max-width: 480px) {
    .vision-context {
      align-items: flex-start;
      flex-direction: column;
      gap: 6px;
    }

    .vision-controls {
      align-items: stretch;
      flex-direction: column;
    }
    .generate-btn {
      width: 100%;
    }

    .visions-grid {
      grid-template-columns: 1fr;
    }
    .visions-grid > *:last-child:nth-child(3) {
      grid-column: unset;
    }
  }

  .vision-card {
    position: relative;
    background: #0c0c0e;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 10px;
    padding: 20px;
    min-height: 180px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: vision-in 0.35s ease both;
    overflow: hidden;
    transition:
      border-color 0.2s,
      box-shadow 0.2s,
      transform 0.15s;
  }
  .vision-card:hover {
    border-color: color-mix(in srgb, var(--card-accent) 30%, transparent);
    box-shadow: 0 4px 24px color-mix(in srgb, var(--card-accent) 10%, transparent);
    transform: translateY(-2px);
  }
  .vision-card:hover .vision-top-line {
    opacity: 1;
  }
  @keyframes vision-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .vision-top-line {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--card-accent, #f97316), transparent);
    opacity: 0.5;
    transition: opacity 0.2s;
  }

  .vision-tap-hint {
    color: transparent;
    transition: color 0.2s;
    margin-top: 2px;
  }
  .vision-card:hover .vision-tap-hint {
    color: color-mix(in srgb, var(--card-accent) 55%, transparent);
  }

  .vision-skeleton {
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.02) 0%,
      rgba(255, 255, 255, 0.05) 50%,
      rgba(255, 255, 255, 0.02) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
    border-color: rgba(255, 255, 255, 0.04);
    min-height: 180px;
  }
  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .vision-section,
    .vision-card,
    .vision-skeleton {
      animation: none;
    }

    .generate-btn:hover:not(:disabled) {
      transform: none;
    }
  }
</style>
