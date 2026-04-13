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
  import { sparksVisions } from '../../stores/sparks.store';

  interface Props {
    selectedMood: Mood | null;
    selectedOutputIds: SvelteSet<string>;
    outputs: Output[];
    accentColor: string;
    glowColor: string;
    textColor: string;
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

<section class="vision-section border-y border-white/5 bg-black/20 px-8 pt-8 pb-10">
  <div class="mx-auto max-w-4xl">
    <!-- Header row -->
    <div
      class="mb-5 flex flex-wrap items-center gap-4 max-[600px]:flex-col max-[600px]:items-stretch"
    >
      <div class="flex-1">
        <h2
          class="sparks-heading font-serif text-[clamp(2rem,5vw,3.8rem)] leading-[1.1] text-zinc-200 italic"
        >
          Dream a build
        </h2>
        <p class="mt-0.5 font-mono text-[11px] text-zinc-700">three what-ifs based on your picks</p>
      </div>
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <input
          type="text"
          bind:value={steerPrompt}
          placeholder="try: stranger, lo-fi, for a gallery opening"
          class="steer-input max-w-[340px] min-w-0 flex-1 rounded-md border border-white/8 bg-white/3 px-3 py-1.5 font-mono text-xs text-zinc-400 transition-colors outline-none placeholder:text-zinc-700 focus:text-zinc-200"
          onkeydown={(e) => e.key === 'Enter' && generateVisions()}
        />
        <button
          onclick={generateVisions}
          class="generate-btn flex cursor-pointer items-center gap-1.5 rounded-md border bg-transparent px-3.5 py-1.5 font-mono text-xs whitespace-nowrap transition-all disabled:cursor-not-allowed disabled:opacity-40"
          style:border-color="color-mix(in srgb, {accentColor} 35%, transparent)"
          style:color={isGenerating ? accentColor : undefined}
        >
          {#if isGenerating}
            <span class="generating-dot"></span> stop
          {:else if $sparksVisions.length > 0}
            ↺ again
          {:else}
            ✦ imagine
          {/if}
        </button>
      </div>
    </div>

    <!-- Error -->
    {#if generationError}
      <p class="mb-4 font-mono text-xs text-red-500">{generationError}</p>
    {/if}

    <!-- Vision cards -->
    {#if isGenerating && $sparksVisions.length === 0}
      <div class="visions-grid">
        {#each [0, 1, 2] as i (i)}
          <div class="vision-card vision-skeleton" style:animation-delay="{i * 120}ms"></div>
        {/each}
      </div>
    {:else if $sparksVisions.length > 0}
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
    {:else if !$hasAIApiKey}
      <div class="vision-idle-prompt w-full">
        <p class="mb-3 font-serif text-2xl text-zinc-800 italic">Generation needs an AI key</p>
        <p class="mb-5 font-mono text-[11px] text-zinc-700">
          Sparks uses your own API key — nothing is shared with Patchies servers.
        </p>
        <button
          onclick={() => (aiSettingsOpen = true)}
          class="cursor-pointer rounded-md border border-zinc-700 px-4 py-2 font-mono text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
        >
          Set up AI Provider →
        </button>
      </div>
    {:else}
      <button onclick={generateVisions} class="vision-idle-prompt w-full cursor-pointer">
        <span
          class="font-serif text-2xl text-zinc-800 italic transition-colors group-hover:text-zinc-600"
        >
          Click ✦ imagine to dream up ideas →
        </span>
      </button>
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
  .steer-input:focus {
    border-color: color-mix(in srgb, var(--accent) 35%, transparent);
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
      grid-template-columns: repeat(2, 1fr);
    }
    .visions-grid > *:last-child:nth-child(3) {
      grid-column: 1 / -1;
      min-height: unset;
    }
  }
  @media (max-width: 480px) {
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
