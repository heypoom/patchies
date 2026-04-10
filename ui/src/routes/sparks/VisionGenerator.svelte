<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { getTextProvider } from '$lib/ai/providers';
  import { extractJson } from '$lib/ai/extract-json';
  import { SPARKS_OBJECT_LIST } from '$lib/ai/object-descriptions-types';
  import VisionFlipCard from './VisionFlipCard.svelte';
  import { resolveNodes } from './types';
  import type { Mood, Output, Vision } from './types';
  import AIProviderSettingsDialog from '$lib/components/dialogs/AIProviderSettingsDialog.svelte';
  import { hasAIApiKey } from '../../stores/ai-settings.store';

  interface Props {
    selectedMood: Mood | null;
    selectedOutputIds: SvelteSet<string>;
    outputs: Output[];
    accentColor: string;
    glowColor: string;
    textColor: string;
  }

  let { selectedMood, selectedOutputIds, outputs, accentColor, glowColor, textColor }: Props =
    $props();

  // ── Generation state ──────────────────────────────────────────
  let visions = $state<Vision[]>([]);
  let isGenerating = $state(false);
  let steerPrompt = $state('');
  let generationError = $state<string | null>(null);
  let abortController: AbortController | null = null;
  let aiSettingsOpen = $state(false);

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

    isGenerating = true;
    visions = [];
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

      visions = JSON.parse(extractJson(accumulated.trim()));
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

<section class="vision-section px-8 pb-10">
  <div class="mx-auto max-w-4xl">
    <!-- Header row -->
    <div class="mb-5 flex items-center gap-4">
      <div class="flex-1">
        <h2 class="sparks-serif text-xl text-zinc-200">Dream a build</h2>
        <p class="sparks-mono mt-0.5 text-[11px] text-zinc-700">
          three what-ifs based on your picks
        </p>
      </div>
      <div class="flex items-center gap-2">
        <input
          type="text"
          bind:value={steerPrompt}
          placeholder="try: stranger, lo-fi, for a gallery opening"
          class="steer-input sparks-mono text-xs"
          onkeydown={(e) => e.key === 'Enter' && generateVisions()}
        />
        <button
          onclick={generateVisions}
          class="generate-btn sparks-mono cursor-pointer text-xs disabled:cursor-not-allowed disabled:opacity-40"
          style:border-color="color-mix(in srgb, {accentColor} 35%, transparent)"
          style:color={isGenerating ? accentColor : undefined}
        >
          {#if isGenerating}
            <span class="generating-dot"></span> stop
          {:else if visions.length > 0}
            ↺ again
          {:else}
            ✦ imagine
          {/if}
        </button>
      </div>
    </div>

    <!-- Error -->
    {#if generationError}
      <p class="sparks-mono mb-4 text-xs text-red-500">{generationError}</p>
    {/if}

    <!-- Vision cards -->
    {#if isGenerating && visions.length === 0}
      <div class="visions-grid">
        {#each [0, 1, 2] as i (i)}
          <div class="vision-card vision-skeleton" style:animation-delay="{i * 120}ms"></div>
        {/each}
      </div>
    {:else if visions.length > 0}
      <div class="visions-grid">
        {#each visions as v, i (i)}
          <button
            class="vision-card cursor-pointer text-left"
            style:--card-accent={accentColor}
            style:animation-delay="{i * 80}ms"
            onclick={() => openVision(v, i)}
          >
            <div class="vision-top-line"></div>
            <h3 class="sparks-serif vision-title" style:color={textColor}>{v.title}</h3>
            <p class="vision-text">{v.vision}</p>
            <div class="mt-auto flex flex-wrap gap-1 pt-4">
              {#each v.nodes as node (node)}
                <span class="sparks-mono vision-node">{node}</span>
              {/each}
            </div>
            <span class="sparks-mono vision-tap-hint">tap to explore →</span>
          </button>
        {/each}
      </div>
    {:else if !$hasAIApiKey}
      <div class="vision-idle-prompt w-full">
        <p class="sparks-serif mb-3 text-2xl text-zinc-800">Generation needs an AI key</p>
        <p class="sparks-mono mb-5 text-[11px] text-zinc-700">
          Sparks uses your own API key — nothing is shared with Patchies servers.
        </p>
        <button
          onclick={() => (aiSettingsOpen = true)}
          class="sparks-mono cursor-pointer rounded-md border border-zinc-700 px-4 py-2 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
        >
          Set up AI Provider →
        </button>
      </div>
    {:else}
      <button onclick={generateVisions} class="vision-idle-prompt w-full cursor-pointer">
        <span
          class="sparks-serif text-2xl text-zinc-800 transition-colors group-hover:text-zinc-600"
        >
          Click ✦ imagine to dream up ideas →
        </span>
      </button>
    {/if}
  </div>
</section>

<!-- AI Provider Settings dialog -->
<AIProviderSettingsDialog bind:open={aiSettingsOpen} onSaveAndContinue={generateVisions} />

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
    />
  </div>
{/if}

<style>
  .vision-section {
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    background: rgba(0, 0, 0, 0.2);
    padding-top: 2rem;
  }

  .steer-input {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    padding: 6px 12px;
    color: #a1a1aa;
    width: 340px;
    outline: none;
    transition: border-color 0.15s;
  }
  .steer-input::placeholder {
    color: #3f3f46;
  }
  .steer-input:focus {
    border-color: color-mix(in srgb, var(--accent) 35%, transparent);
    color: #e4e4e7;
  }

  .generate-btn {
    padding: 6px 14px;
    border: 1px solid;
    border-radius: 6px;
    background: transparent;
    transition:
      background 0.15s,
      opacity 0.15s;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .generate-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }

  .generating-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    animation: pulse-dot 0.9s ease-in-out infinite;
  }
  @keyframes pulse-dot {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.4;
      transform: scale(0.7);
    }
  }

  .visions-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  @media (max-width: 768px) {
    .visions-grid {
      grid-template-columns: 1fr;
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

  .vision-title {
    font-size: 1.1rem;
    line-height: 1.2;
  }

  .vision-text {
    font-family: 'Syne', sans-serif;
    font-size: 0.8rem;
    line-height: 1.65;
    color: #71717a;
    flex: 1;
  }

  .vision-node {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.04);
    color: #52525b;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .vision-tap-hint {
    font-size: 10px;
    color: transparent;
    transition: color 0.2s;
    margin-top: 2px;
    letter-spacing: 0.05em;
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

  .vision-idle-prompt {
    background: none;
    border: 1px dashed rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 32px;
    text-align: center;
    transition: border-color 0.2s;
  }
  .vision-idle-prompt:hover {
    border-color: rgba(255, 255, 255, 0.12);
  }
</style>
