<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { getTextProvider } from '$lib/ai/providers';
  import { extractJson } from '$lib/ai/extract-json';
  import { SPARKS_OBJECT_LIST } from '$lib/ai/object-descriptions-types';
  import { BUILT_IN_PACKS } from '$lib/extensions/object-packs';
  import {
    Layers,
    Box,
    AudioLines,
    Music,
    Hand,
    Code,
    Cpu,
    Lightbulb,
    Projector,
    Piano,
    Usb,
    type Icon as LucideIcon
  } from '@lucide/svelte';

  type LucideComponent = typeof LucideIcon;

  const outputIcons: Record<string, LucideComponent> = {
    '2d-visual': Layers,
    video: Box,
    sound: AudioLines,
    music: Music,
    gestures: Hand,
    code: Code,
    'low-level': Cpu,
    lighting: Lightbulb,
    projection: Projector,
    midi: Piano,
    serial: Usb
  };

  interface Mood {
    id: string;
    name: string;
    tagline: string;
    description: string;
    nodes: string[];
    gradient: string;
    accentColor: string;
    glowColor: string;
    textColor: string;
  }

  interface Output {
    id: string;
    name: string;
    description: string;
    packIds?: string[]; // derive nodes from these packs
    nodes?: string[]; // explicit nodes (used alone or to supplement packIds)
  }

  function resolveNodes(output: Output): string[] {
    const fromPacks = (output.packIds ?? []).flatMap(
      (packId) => BUILT_IN_PACKS.find((p) => p.id === packId)?.objects ?? []
    );
    return [...new Set([...fromPacks, ...(output.nodes ?? [])])];
  }

  const moods: Mood[] = [
    {
      id: 'dark',
      name: 'Dark',
      tagline: 'Heavy. Slow. Threatening.',
      description:
        'Deep bass drones that fill a room. Monochrome visuals that shift like smoke. The kind of patch that makes people uncomfortable in the best way.',
      nodes: ['osc~', 'glsl', 'lfo'],
      gradient: 'linear-gradient(135deg, #0a0a1a 0%, #1a1030 50%, #0d0d1a 100%)',
      accentColor: '#818cf8',
      glowColor: 'rgba(99, 102, 241, 0.15)',
      textColor: '#c7d2fe'
    },
    {
      id: 'euphoric',
      name: 'Euphoric',
      tagline: 'Bright. Fast. Alive.',
      description:
        'Festival energy in a patch. Audio-reactive explosions of color, strudel patterns that accelerate, visuals that peak with the drop.',
      nodes: ['fft', 'strudel', 'p5'],
      gradient: 'linear-gradient(135deg, #1a0f00 0%, #2d1a00 50%, #1a1200 100%)',
      accentColor: '#fbbf24',
      glowColor: 'rgba(251, 191, 36, 0.15)',
      textColor: '#fde68a'
    },
    {
      id: 'glitchy',
      name: 'Glitchy',
      tagline: 'Broken. Wrong. Perfect.',
      description:
        'Corrupted video feeds, stuttering audio, visuals that fight against themselves. Deliberately malfunctioning systems are the most interesting ones.',
      nodes: ['glsl', 'webcam', 'js'],
      gradient: 'linear-gradient(135deg, #000d00 0%, #001a04 50%, #000e00 100%)',
      accentColor: '#4ade80',
      glowColor: 'rgba(74, 222, 128, 0.12)',
      textColor: '#86efac'
    },
    {
      id: 'meditative',
      name: 'Meditative',
      tagline: 'Slow. Looping. Breathable.',
      description:
        'Long reverb tails that blur into silence. Hydra visuals that drift without destination. Time stretches. The patch breathes on its own.',
      nodes: ['hydra', 'reverb~', 'lfo'],
      gradient: 'linear-gradient(135deg, #001214 0%, #001e20 50%, #001012 100%)',
      accentColor: '#22d3ee',
      glowColor: 'rgba(34, 211, 238, 0.1)',
      textColor: '#a5f3fc'
    },
    {
      id: 'chaotic',
      name: 'Chaotic',
      tagline: 'Too much. All at once.',
      description:
        "Every frequency band triggering something different. DMX strobing. Strudel patterns racing. Controlled overwhelm — the audience doesn't know where to look.",
      nodes: ['fft', 'dmx', 'strudel'],
      gradient: 'linear-gradient(135deg, #1a0000 0%, #2d0000 50%, #1a0500 100%)',
      accentColor: '#f87171',
      glowColor: 'rgba(248, 113, 113, 0.14)',
      textColor: '#fca5a5'
    },
    {
      id: 'dreamy',
      name: 'Dreamy',
      tagline: 'Soft. Drifting. Hazy.',
      description:
        'Delay trails that smear the past into the present. Hydra textures like oil on water. Something ambient that forgets it started.',
      nodes: ['hydra', 'delay~', 'p5'],
      gradient: 'linear-gradient(135deg, #0d0014 0%, #160020 50%, #0a0012 100%)',
      accentColor: '#c084fc',
      glowColor: 'rgba(192, 132, 252, 0.12)',
      textColor: '#e9d5ff'
    },
    {
      id: 'industrial',
      name: 'Industrial',
      tagline: 'Mechanical. Rhythmic. Cold.',
      description:
        'Clock-driven light rigs, oscillators that clank rather than sing. The beauty of machinery doing exactly what it was told.',
      nodes: ['dmx', 'osc~', 'transport'],
      gradient: 'linear-gradient(135deg, #0f0d0a 0%, #1a1610 50%, #100e0a 100%)',
      accentColor: '#fb923c',
      glowColor: 'rgba(249, 115, 22, 0.12)',
      textColor: '#fed7aa'
    },
    {
      id: 'playful',
      name: 'Playful',
      tagline: 'Interactive. Light. Joyful.',
      description:
        'Sliders that feel good to touch. Canvases that react to cursor position. Patches that invite people to break them.',
      nodes: ['p5', 'slider', 'canvas'],
      gradient: 'linear-gradient(135deg, #0a1200 0%, #111e00 50%, #0b1300 100%)',
      accentColor: '#a3e635',
      glowColor: 'rgba(163, 230, 53, 0.12)',
      textColor: '#d9f99d'
    }
  ];

  const outputs: Output[] = [
    {
      id: '2d-visual',
      name: '2D Visual',
      description: 'Canvas, P5.js, generative graphics',
      packIds: ['2d']
    },
    {
      id: 'video',
      name: 'Video',
      description: 'Three.js, Hydra, shaders, projection',
      packIds: ['video-synthesis']
    },
    {
      id: 'sound',
      name: 'Sound',
      description: 'Synthesis, effects, audio processing',
      packIds: ['signal-generators', 'audio-effects']
    },
    {
      id: 'music',
      name: 'Music',
      description: 'Composition, patterns, sequencing',
      packIds: ['music']
    },
    {
      id: 'gestures',
      name: 'Gestures',
      description: 'Webcam, body & hand tracking',
      packIds: ['vision'],
      nodes: ['webcam']
    },
    {
      id: 'code',
      name: 'Code',
      description: 'JS runners, workers, scripting',
      packIds: ['scripting'],
      nodes: ['js', 'worker']
    },
    {
      id: 'low-level',
      name: 'Low-Level',
      description: 'VMs, assembly, DSP, bytecode',
      packIds: ['low-level'],
      nodes: ['bytebeat~', 'dsp~', 'wgpu.compute']
    },
    {
      id: 'lighting',
      name: 'Lighting',
      description: 'DMX lights & LED strips',
      nodes: ['serial.dmx']
    },
    {
      id: 'projection',
      name: 'Projection',
      description: 'Projection mapping',
      nodes: ['projmap']
    },
    {
      id: 'midi',
      name: 'MIDI',
      description: 'MIDI controllers & instruments',
      packIds: ['midi']
    },
    {
      id: 'serial',
      name: 'Serial',
      description: 'Arduino, sensors, physical I/O',
      nodes: ['serial', 'serial.term']
    }
  ];

  // ── State ─────────────────────────────────────────────────────
  let selectedMoodId = $state<string | null>(null);
  let selectedOutputIds = new SvelteSet<string>();

  const selectedMood = $derived(moods.find((m) => m.id === selectedMoodId) ?? null);

  const hasSelection = $derived(selectedMoodId !== null || selectedOutputIds.size > 0);

  const accentColor = $derived(selectedMood?.accentColor ?? '#f97316');
  const glowColor = $derived(selectedMood?.glowColor ?? 'rgba(249,115,22,0.05)');
  const textColor = $derived(selectedMood?.textColor ?? '#fed7aa');

  // ── AI Vision Generator ───────────────────────────────────────

  interface Vision {
    title: string;
    vision: string;
    nodes: string[];
  }

  let visions = $state<Vision[]>([]);
  let isGenerating = $state(false);

  let steerPrompt = $state('');
  let generationError = $state<string | null>(null);
  let abortController: AbortController | null = null;

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

      const jsonText = extractJson(accumulated.trim());
      visions = JSON.parse(jsonText);
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        generationError = e instanceof Error ? e.message : 'Generation failed';
      }
    } finally {
      isGenerating = false;
      abortController = null;
    }
  }

  const canGenerate = $derived(hasSelection);

  // ── Flipped card ──────────────────────────────────────────────
  let flippedVision = $state<Vision | null>(null);
  let flippedVisionIndex = $state(0);

  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  function openVision(v: Vision, index: number) {
    flippedVision = v;
    flippedVisionIndex = index;
  }

  function closeVision() {
    flippedVision = null;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') closeVision();
  }
</script>

<svelte:head>
  <title>Mood Board | Sparks | Patchies</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
  <link
    href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

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
        <p class="mono mb-3 text-[11px] tracking-[0.25em] uppercase" style:color="var(--accent)">
          patchies ✦ sparks
        </p>
        <h1 class="serif-italic">
          What do you want<br />to make people feel?
        </h1>
        <p class="syne mt-4 max-w-sm text-sm leading-relaxed text-zinc-600">
          Two questions. Pick one or both to find your spark.
        </p>
      </div>
    </header>

    <!-- ── Two-question layout ── -->
    <div class="px-8 pb-10">
      <div class="mx-auto max-w-4xl space-y-8">
        <!-- Question 1: Mood -->
        <div>
          <div class="mb-4 flex items-baseline gap-3">
            <span class="serif-italic text-xl text-zinc-200">How should it feel?</span>
            {#if selectedMoodId}
              <button
                class="mono cursor-pointer text-[11px] text-zinc-700 transition-colors hover:text-zinc-400"
                onclick={() => (selectedMoodId = null)}
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
                onclick={() => (selectedMoodId = selectedMoodId === mood.id ? null : mood.id)}
              >
                <span class="mood-name syne">{mood.name}</span>
                <span class="mood-tagline mono">{mood.tagline}</span>
                {#if active}<span class="mood-check">✦</span>{/if}
              </button>
            {/each}
          </div>
        </div>

        <!-- Divider -->
        <div class="flex items-center gap-4">
          <div class="h-px flex-1 bg-zinc-900"></div>
          <span class="mono text-[10px] tracking-widest text-zinc-800 uppercase">and / or</span>
          <div class="h-px flex-1 bg-zinc-900"></div>
        </div>

        <!-- Question 2: Output (multi-select) -->
        <div>
          <div class="mb-4 flex items-baseline gap-3">
            <span class="serif-italic text-xl text-zinc-200">What do you want to make?</span>
            {#if selectedOutputIds.size > 0}
              <button
                class="mono cursor-pointer text-[11px] text-zinc-700 transition-colors hover:text-zinc-400"
                onclick={() => selectedOutputIds.clear()}
              >
                ✕ clear
              </button>
            {/if}
          </div>
          <div class="output-grid">
            {#each outputs as output (output.id)}
              {@const active = selectedOutputIds.has(output.id)}
              {@const Icon = outputIcons[output.id]}
              <button
                class="output-tile cursor-pointer"
                class:output-tile-active={active}
                onclick={() =>
                  active ? selectedOutputIds.delete(output.id) : selectedOutputIds.add(output.id)}
              >
                <span class="output-icon"><Icon size={18} /></span>
                <span class="output-name syne">{output.name}</span>
                <span class="output-desc mono">{output.description}</span>
              </button>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <!-- ── AI Vision Generator ── -->
    {#if hasSelection}
      <section class="vision-section px-8 pb-10">
        <div class="mx-auto max-w-4xl">
          <!-- Header row -->
          <div class="mb-5 flex items-center gap-4">
            <div class="flex-1">
              <h2 class="serif-italic text-xl text-zinc-200">Dream a build</h2>
              <p class="mono mt-0.5 text-[11px] text-zinc-700">
                three what-ifs based on your picks
              </p>
            </div>
            <div class="flex items-center gap-2">
              <!-- Steer input -->
              <input
                type="text"
                bind:value={steerPrompt}
                placeholder="try: stranger, lo-fi, for a gallery opening"
                class="steer-input mono text-xs"
                onkeydown={(e) => e.key === 'Enter' && generateVisions()}
              />
              <button
                onclick={generateVisions}
                disabled={!canGenerate}
                class="generate-btn mono cursor-pointer text-xs disabled:cursor-not-allowed disabled:opacity-40"
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
            <p class="mono mb-4 text-xs text-red-500">{generationError}</p>
          {/if}

          <!-- Vision cards -->
          {#if isGenerating && visions.length === 0}
            <!-- Skeleton loading -->
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
                  title="Click to explore this idea"
                >
                  <div class="vision-top-line"></div>
                  <h3 class="serif-italic vision-title" style:color={textColor}>{v.title}</h3>
                  <p class="vision-text">{v.vision}</p>
                  <div class="mt-auto flex flex-wrap gap-1 pt-4">
                    {#each v.nodes as node (node)}
                      <span class="mono vision-node">{node}</span>
                    {/each}
                  </div>
                  <span class="vision-tap-hint mono">tap to explore →</span>
                </button>
              {/each}
            </div>
          {:else}
            <!-- Idle prompt -->
            <button
              onclick={generateVisions}
              disabled={!canGenerate}
              class="vision-idle-prompt w-full cursor-pointer disabled:cursor-not-allowed"
            >
              <span
                class="serif-italic text-2xl text-zinc-800 transition-colors group-hover:text-zinc-600"
              >
                Click ✦ imagine to dream up ideas →
              </span>
            </button>
          {/if}
        </div>
      </section>
    {/if}

    <!-- ── Results ── -->
    <!-- TODO: Phase 2 — add <SparkResults> component here once curated content is ready. -->

    <!-- ── Flipped Vision Overlay ── -->
    {#if flippedVision}
      <div
        class="flip-backdrop"
        onclick={closeVision}
        onkeydown={handleKeydown}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
      >
        <div
          class="flip-card"
          style:--card-accent={accentColor}
          style:--card-glow={glowColor}
          onclick={(e) => e.stopPropagation()}
          onkeydown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <!-- Corner ornaments -->
          <span class="fc fc-tl" aria-hidden="true"></span>
          <span class="fc fc-tr" aria-hidden="true"></span>
          <span class="fc fc-bl" aria-hidden="true"></span>
          <span class="fc fc-br" aria-hidden="true"></span>

          <!-- Roman numeral watermark -->
          <span class="flip-roman mono" aria-hidden="true">{ROMAN[flippedVisionIndex] ?? 'I'}</span>

          <!-- Close -->
          <button class="flip-close mono cursor-pointer" onclick={closeVision}>✕</button>

          <!-- Accent glow -->
          <div class="flip-glow" aria-hidden="true"></div>

          <!-- Content -->
          <div class="flip-content">
            <p class="flip-eyebrow mono">vision · {ROMAN[flippedVisionIndex] ?? 'I'}</p>
            <h3 class="serif-italic flip-title" style:color={textColor}>{flippedVision.title}</h3>
            <p class="flip-vision-text">{flippedVision.vision}</p>
          </div>

          <!-- Aspects divider -->
          <div class="flip-divider" aria-hidden="true">
            <span class="flip-divider-line"></span>
            <span class="flip-divider-label mono">aspects</span>
            <span class="flip-divider-line"></span>
          </div>

          <!-- Node chips -->
          <div class="flip-nodes">
            {#each flippedVision.nodes as node (node)}
              <span class="mono flip-node-chip">{node}</span>
            {/each}
          </div>

          <!-- CTA pill row -->
          <div class="flip-ctas">
            <Tooltip.Root>
              <Tooltip.Trigger class="flex-1">
                <button class="flip-cta mono w-full cursor-pointer">⊞ scatter</button>
              </Tooltip.Trigger>
              <Tooltip.Content class="z-[200]">Scatter nodes onto your board</Tooltip.Content>
            </Tooltip.Root>
            <Tooltip.Root>
              <Tooltip.Trigger class="flex-1">
                <button class="flip-cta mono w-full cursor-pointer">✦ chat</button>
              </Tooltip.Trigger>
              <Tooltip.Content class="z-[200]">Open this idea in AI chat</Tooltip.Content>
            </Tooltip.Root>
            <Tooltip.Root>
              <Tooltip.Trigger class="flex-1">
                <button class="flip-cta mono w-full cursor-pointer">⎘ copy</button>
              </Tooltip.Trigger>
              <Tooltip.Content class="z-[200]">Copy idea to clipboard</Tooltip.Content>
            </Tooltip.Root>
          </div>
        </div>
      </div>
    {/if}

    <!-- ── Footer ── -->
    <div class="border-t border-zinc-900 px-8 py-5">
      <div class="mx-auto flex max-w-4xl items-center justify-between">
        <p class="mono text-[11px] text-zinc-800">patchies · sparks</p>
        <a
          href="/"
          class="mono cursor-pointer text-[11px] text-zinc-700 transition-colors hover:text-zinc-400"
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

  .serif-italic {
    font-family: 'Instrument Serif', serif;
    font-style: italic;
    font-size: clamp(2rem, 5vw, 3.8rem);
    line-height: 1.1;
    color: #f4f4f5;
  }

  .syne {
    font-family: 'Syne', sans-serif;
  }
  .mono {
    font-family: 'JetBrains Mono', monospace;
  }

  /* ── Mood grid ── */
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

  /* ── Output grid ── */
  .output-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
  }

  .output-tile {
    border-radius: 8px;
    padding: 14px 10px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    transition:
      border-color 0.15s,
      background 0.15s,
      transform 0.15s;
  }
  .output-tile:hover {
    border-color: rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.04);
    transform: translateY(-1px);
  }
  .output-tile-active {
    border-color: color-mix(in srgb, var(--accent) 45%, transparent) !important;
    background: color-mix(in srgb, var(--accent) 8%, transparent) !important;
  }

  .output-icon {
    font-size: 1.2rem;
    line-height: 1;
    color: #52525b;
    transition: color 0.15s;
  }
  .output-tile:hover .output-icon,
  .output-tile-active .output-icon {
    color: var(--accent);
  }
  .output-name {
    font-size: 0.75rem;
    font-weight: 600;
    color: #a1a1aa;
    transition: color 0.15s;
  }
  .output-tile-active .output-name {
    color: var(--text-acc);
  }
  .output-desc {
    font-size: 9px;
    color: #3f3f46;
    line-height: 1.3;
    text-align: center;
  }

  /* ── Vision Generator ── */
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

  /* ── Vision card hover & hint ── */
  .vision-card:hover {
    border-color: color-mix(in srgb, var(--card-accent) 30%, transparent);
    box-shadow: 0 4px 24px color-mix(in srgb, var(--card-accent) 10%, transparent);
    transform: translateY(-2px);
    transition:
      border-color 0.2s,
      box-shadow 0.2s,
      transform 0.15s;
  }
  .vision-card:hover .vision-top-line {
    opacity: 1;
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

  /* ── Flip overlay ── */
  .flip-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.82);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 24px;
    animation: fade-in 0.2s ease both;
    perspective: 1200px;
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .flip-card {
    position: relative;
    background: #0a0a0e;
    /* Double-frame: outer accent border + inner inset shadow */
    border: 1px solid color-mix(in srgb, var(--card-accent) 40%, transparent);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.04),
      0 0 80px color-mix(in srgb, var(--card-accent) 15%, transparent),
      0 32px 64px rgba(0, 0, 0, 0.7);
    border-radius: 12px;
    padding: 32px 32px 24px;
    max-width: 400px;
    width: 100%;
    overflow: hidden;
    animation: flip-in 0.38s cubic-bezier(0.22, 0.61, 0.36, 1) both;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  @keyframes flip-in {
    from {
      opacity: 0;
      transform: rotateY(-80deg) scale(0.9);
    }
    to {
      opacity: 1;
      transform: rotateY(0deg) scale(1);
    }
  }

  /* Corner bracket ornaments */
  .fc {
    position: absolute;
    width: 14px;
    height: 14px;
    opacity: 0.35;
    pointer-events: none;
  }
  .fc-tl {
    top: 10px;
    left: 10px;
    border-top: 1px solid var(--card-accent);
    border-left: 1px solid var(--card-accent);
  }
  .fc-tr {
    top: 10px;
    right: 10px;
    border-top: 1px solid var(--card-accent);
    border-right: 1px solid var(--card-accent);
  }
  .fc-bl {
    bottom: 10px;
    left: 10px;
    border-bottom: 1px solid var(--card-accent);
    border-left: 1px solid var(--card-accent);
  }
  .fc-br {
    bottom: 10px;
    right: 10px;
    border-bottom: 1px solid var(--card-accent);
    border-right: 1px solid var(--card-accent);
  }

  /* Roman numeral watermark */
  .flip-roman {
    position: absolute;
    top: 18px;
    right: 40px;
    font-size: 10px;
    letter-spacing: 0.3em;
    color: color-mix(in srgb, var(--card-accent) 20%, transparent);
    user-select: none;
    pointer-events: none;
  }

  /* Accent glow behind title */
  .flip-glow {
    position: absolute;
    top: -40px;
    left: -40px;
    right: -40px;
    height: 220px;
    background: radial-gradient(
      ellipse 70% 60% at 50% 40%,
      var(--card-glow, rgba(249, 115, 22, 0.08)),
      transparent 70%
    );
    pointer-events: none;
  }

  .flip-close {
    position: absolute;
    top: 12px;
    right: 12px;
    font-size: 11px;
    color: #3f3f46;
    background: none;
    border: none;
    padding: 4px 6px;
    transition: color 0.15s;
    line-height: 1;
    z-index: 2;
  }
  .flip-close:hover {
    color: #71717a;
  }

  /* Content area */
  .flip-content {
    position: relative;
    z-index: 1;
    padding-bottom: 22px;
  }

  .flip-eyebrow {
    font-size: 9px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--card-accent) 50%, transparent);
    margin-bottom: 12px;
  }

  .flip-title {
    font-size: clamp(1.25rem, 3vw, 1.55rem);
    line-height: 1.2;
    margin-bottom: 14px;
    padding-right: 12px;
  }

  .flip-vision-text {
    font-family: 'Syne', sans-serif;
    font-size: 0.82rem;
    line-height: 1.75;
    color: #52525b;
  }

  /* Aspects divider */
  .flip-divider {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }
  .flip-divider-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.07));
  }
  .flip-divider-line:first-child {
    background: linear-gradient(270deg, transparent, rgba(255, 255, 255, 0.07));
  }
  .flip-divider-label {
    font-size: 9px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: #3f3f46;
  }

  /* Node chips (accent-tinted) */
  .flip-nodes {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 22px;
  }
  .flip-node-chip {
    font-size: 10px;
    padding: 3px 8px;
    border-radius: 3px;
    border: 1px solid color-mix(in srgb, var(--card-accent) 22%, transparent);
    background: color-mix(in srgb, var(--card-accent) 7%, transparent);
    color: color-mix(in srgb, var(--card-accent) 70%, #71717a);
  }

  /* CTA pill row */
  .flip-ctas {
    display: flex;
    gap: 6px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }
  .flip-cta {
    flex: 1;
    padding: 7px 6px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(255, 255, 255, 0.02);
    color: #52525b;
    font-size: 10px;
    letter-spacing: 0.04em;
    transition:
      border-color 0.15s,
      background 0.15s,
      color 0.15s;
  }
  .flip-cta:hover {
    border-color: color-mix(in srgb, var(--card-accent) 30%, transparent);
    background: color-mix(in srgb, var(--card-accent) 8%, transparent);
    color: color-mix(in srgb, var(--card-accent) 80%, #a1a1aa);
  }

  .vision-idle-prompt {
    background: none;
    border: 1px dashed rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 32px;
    text-align: center;
    transition: border-color 0.2s;
  }
  .vision-idle-prompt:hover:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.12);
  }
</style>
