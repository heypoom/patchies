<script lang="ts">
  import { match } from 'ts-pattern';
  import { SvelteSet } from 'svelte/reactivity';
  import { getTextProvider } from '$lib/ai/providers';
  import { extractJson } from '$lib/ai/extract-json';
  import { OBJECT_TYPE_LIST } from '$lib/ai/object-descriptions-types';
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
    '3d-visual': Box,
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

  type PatchType = 'starter' | 'template' | 'example' | 'showcase';
  type Difficulty = 'beginner' | 'intermediate' | 'advanced';

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
    nodes: string[];
  }

  interface Patch {
    title: string;
    type: PatchType;
    url: string;
    author?: string;
  }

  interface Spark {
    id: string;
    title: string;
    description: string;
    nodes: string[];
    difficulty: Difficulty;
    patches: Patch[];
    mood: string[];
    outputs: string[];
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
      nodes: ['p5', 'canvas', 'canvas.dom', 'textmode']
    },
    {
      id: '3d-visual',
      name: '3D Visual',
      description: 'Three.js, GLSL shaders, Hydra',
      nodes: ['three', 'glsl', 'hydra', 'regl']
    },
    {
      id: 'sound',
      name: 'Sound',
      description: 'Synthesis, effects, audio processing',
      nodes: ['osc~', 'reverb~', 'delay~', 'gain~', 'lfo', 'noise~']
    },
    {
      id: 'music',
      name: 'Music',
      description: 'Composition, patterns, sequencing',
      nodes: ['strudel', 'orca', 'beat', 'sequencer', 'sonic~', 'chuck~']
    },
    {
      id: 'gestures',
      name: 'Gestures',
      description: 'Webcam, body & hand tracking',
      nodes: ['vision.hand', 'vision.body', 'vision.face', 'webcam']
    },
    {
      id: 'code',
      name: 'Code',
      description: 'JS runners, workers, scripting',
      nodes: ['js', 'worker', 'python', 'ruby', 'expr']
    },
    {
      id: 'low-level',
      name: 'Low-Level',
      description: 'VMs, assembly, DSP, bytecode',
      nodes: ['uxn', 'asm', 'bytebeat~', 'wgpu.compute', 'dsp~']
    },
    {
      id: 'lighting',
      name: 'Lighting',
      description: 'DMX lights & LED strips — needs DMX hardware',
      nodes: ['serial.dmx', 'dmx']
    },
    {
      id: 'projection',
      name: 'Projection',
      description: 'Projection mapping — needs a projector',
      nodes: ['projmap']
    },
    {
      id: 'midi',
      name: 'MIDI',
      description: 'MIDI controllers & instruments — needs MIDI device',
      nodes: ['midi.in', 'midi.out', 'webmidilink']
    },
    {
      id: 'serial',
      name: 'Serial',
      description: 'Arduino, sensors, physical I/O — needs USB device',
      nodes: ['serial', 'serial.term']
    }
  ];

  const sparks: Spark[] = [
    {
      id: 'music-light-show',
      title: 'Music-Driven Light Show',
      description: 'FFT frequency bands map to DMX RGB channels in real time.',
      nodes: ['fft', 'dmx', 'map'],
      difficulty: 'intermediate',
      mood: ['chaotic', 'euphoric', 'industrial'],
      outputs: ['sound', 'lighting'],
      patches: [
        { title: 'Starter Kit', type: 'starter', url: '/sparks/submit' },
        { title: 'Full Stage Setup', type: 'template', url: '/sparks/submit' }
      ]
    },
    {
      id: 'reactive-particles',
      title: 'Reactive Particle Storm',
      description:
        'Thousands of particles orbit an attractor. Frequency bands control mass and color.',
      nodes: ['fft', 'p5', 'osc~'],
      difficulty: 'intermediate',
      mood: ['euphoric', 'chaotic', 'dark'],
      outputs: ['2d-visual', 'sound'],
      patches: [
        { title: 'Starter Kit', type: 'starter', url: '/sparks/submit' },
        { title: 'Festival Build', type: 'showcase', url: '/sparks/submit', author: 'maya' }
      ]
    },
    {
      id: 'video-feedback',
      title: 'Live Video Feedback Loop',
      description: 'Webcam fed back through Hydra transforms — hypnotic recursive visuals.',
      nodes: ['hydra', 'webcam', 'canvas'],
      difficulty: 'beginner',
      mood: ['glitchy', 'dreamy', 'meditative'],
      outputs: ['3d-visual', 'gestures'],
      patches: [
        { title: 'Starter Kit', type: 'starter', url: '/sparks/submit' },
        { title: 'Performance Build', type: 'showcase', url: '/sparks/submit', author: 'joey' }
      ]
    },
    {
      id: 'beat-typography',
      title: 'Beat-Synced Typography',
      description: 'Text that explodes on every kick drum. Works with Strudel or live audio.',
      nodes: ['transport', 'p5', 'strudel', 'fft'],
      difficulty: 'intermediate',
      mood: ['euphoric', 'chaotic', 'playful'],
      outputs: ['2d-visual', 'music'],
      patches: [{ title: 'Starter Kit', type: 'starter', url: '/sparks/submit' }]
    },
    {
      id: 'glsl-raymarcher',
      title: 'GLSL Raymarched Shapes',
      description: 'Signed distance functions in a shader, animated by OSC messages.',
      nodes: ['glsl', 'osc~', 'js'],
      difficulty: 'advanced',
      mood: ['dark', 'meditative', 'industrial'],
      outputs: ['3d-visual', 'code'],
      patches: [
        { title: 'Starter Kit', type: 'starter', url: '/sparks/submit' },
        { title: 'SDF Playground', type: 'template', url: '/sparks/submit' }
      ]
    },
    {
      id: 'drone-landscape',
      title: 'Drone Soundscape',
      description:
        'Slowly evolving LFOs modulate oscillator timbre. Plays forever without repeating.',
      nodes: ['lfo', 'osc~', 'reverb~'],
      difficulty: 'beginner',
      mood: ['dark', 'meditative', 'dreamy'],
      outputs: ['sound'],
      patches: [
        { title: 'Starter Kit', type: 'starter', url: '/sparks/submit' },
        { title: 'Cathedral Version', type: 'example', url: '/sparks/submit' }
      ]
    },
    {
      id: 'webcam-glitch',
      title: 'Webcam Glitch Engine',
      description:
        'GLSL shaders corrupt the webcam feed in real time. Datamosh, pixel sort, scan lines.',
      nodes: ['webcam', 'glsl', 'js'],
      difficulty: 'intermediate',
      mood: ['glitchy', 'dark', 'chaotic'],
      outputs: ['3d-visual', 'gestures', 'code'],
      patches: [
        { title: 'Starter Kit', type: 'starter', url: '/sparks/submit' },
        { title: 'VJ Set Build', type: 'template', url: '/sparks/submit' }
      ]
    },
    {
      id: 'generative-terrain',
      title: 'Infinite Generative Terrain',
      description: 'Perlin noise landscape that scrolls forever. Sliders control scale and color.',
      nodes: ['p5', 'slider', 'js'],
      difficulty: 'beginner',
      mood: ['playful', 'dreamy', 'meditative'],
      outputs: ['2d-visual', 'code'],
      patches: [
        { title: 'Starter Kit', type: 'starter', url: '/sparks/submit' },
        { title: 'Audio-Reactive', type: 'example', url: '/sparks/submit' }
      ]
    },
    {
      id: 'hand-synth',
      title: 'Hand-Tracked Synth',
      description: 'Wave your hand to control pitch and filter cutoff. No keyboard needed.',
      nodes: ['vision.hand', 'osc~', 'lowpass~'],
      difficulty: 'intermediate',
      mood: ['playful', 'euphoric', 'glitchy'],
      outputs: ['sound', 'gestures'],
      patches: [
        { title: 'Starter Kit', type: 'starter', url: '/sparks/submit' },
        { title: 'Theremin Mode', type: 'example', url: '/sparks/submit' }
      ]
    },
    {
      id: 'bytebeat-viz',
      title: 'Bytebeat Visualizer',
      description:
        'One-line math expressions generate audio and drive a GLSL scope simultaneously.',
      nodes: ['bytebeat~', 'scope~', 'glsl'],
      difficulty: 'advanced',
      mood: ['glitchy', 'industrial', 'dark'],
      outputs: ['low-level', 'sound', '3d-visual'],
      patches: [{ title: 'Starter Kit', type: 'starter', url: '/sparks/submit' }]
    },
    {
      id: 'strudel-visuals',
      title: 'Live Coded Visuals',
      description:
        'Strudel patterns trigger P5 drawing commands. Code music, get visuals for free.',
      nodes: ['strudel', 'p5', 'recv'],
      difficulty: 'beginner',
      mood: ['euphoric', 'playful', 'chaotic'],
      outputs: ['music', '2d-visual', 'code'],
      patches: [
        { title: 'Starter Kit', type: 'starter', url: '/sparks/submit' },
        { title: 'Performance Template', type: 'template', url: '/sparks/submit' }
      ]
    },
    {
      id: 'body-conductor',
      title: 'Body as Conductor',
      description: 'Pose detection maps limb positions to oscillator parameters. Dance to compose.',
      nodes: ['vision.body', 'osc~', 'map'],
      difficulty: 'intermediate',
      mood: ['playful', 'euphoric', 'meditative'],
      outputs: ['gestures', 'sound'],
      patches: [{ title: 'Starter Kit', type: 'starter', url: '/sparks/submit' }]
    }
  ];

  // ── State ─────────────────────────────────────────────────────
  let selectedMoodId = $state<string | null>(null);
  let selectedOutputIds = new SvelteSet<string>();

  const selectedMood = $derived(moods.find((m) => m.id === selectedMoodId) ?? null);

  const matchingSparks = $derived(
    sparks.filter((s) => {
      const moodOk = !selectedMoodId || s.mood.includes(selectedMoodId);
      // multi-select: spark must match ALL selected outputs (AND logic — "I have all of these")
      const outputOk =
        selectedOutputIds.size === 0 ||
        [...selectedOutputIds].every((id) => s.outputs.includes(id));
      return moodOk && outputOk;
    })
  );

  const hasSelection = $derived(selectedMoodId !== null || selectedOutputIds.size > 0);

  const accentColor = $derived(selectedMood?.accentColor ?? '#f97316');
  const glowColor = $derived(selectedMood?.glowColor ?? 'rgba(249,115,22,0.05)');
  const textColor = $derived(selectedMood?.textColor ?? '#fed7aa');

  const suggestedNodes = $derived([
    ...new Set([
      ...(selectedMood?.nodes ?? []),
      ...[...selectedOutputIds].flatMap(
        (id) => outputs.find((o) => o.id === id)?.nodes.slice(0, 2) ?? []
      )
    ])
  ]);

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
        ? `OUTPUT FOCUS: ${[...selectedOutputIds].map((id) => outputs.find((o) => o.id === id)?.name).join(', ')}`
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
${OBJECT_TYPE_LIST}

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
- Nodes: 3–4 real objects from the list only
- Vary scale: one intimate/personal, one performative, one unexpected
- Avoid: "pulsing", "ethereal", "sonic journey", "immersive", "generative"
- ${steerContext || 'Prioritise ideas that feel genuinely new and a little strange'}`;

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

  function patchTypeIcon(t: PatchType): string {
    return match(t)
      .with('starter', () => '▸')
      .with('template', () => '⊞')
      .with('example', () => '◈')
      .with('showcase', () => '★')
      .exhaustive();
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

<div
  class="mood-page min-h-screen"
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
              AI-generated provocations — felt, not followed
            </p>
          </div>
          <div class="flex items-center gap-2">
            <!-- Steer input -->
            <input
              type="text"
              bind:value={steerPrompt}
              placeholder="steer it… darker, weirder, for a party"
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
              <article
                class="vision-card"
                style:--card-accent={accentColor}
                style:animation-delay="{i * 80}ms"
              >
                <div class="vision-top-line"></div>
                <h3 class="serif-italic vision-title" style:color={textColor}>{v.title}</h3>
                <p class="vision-text">{v.vision}</p>
                <div class="mt-auto flex flex-wrap gap-1 pt-4">
                  {#each v.nodes as node (node)}
                    <span class="mono vision-node">{node}</span>
                  {/each}
                </div>
              </article>
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
  {#if hasSelection}
    <section class="border-t border-zinc-900 px-8 py-10">
      <div class="mx-auto max-w-4xl">
        <!-- Result header -->
        <div class="mb-6 flex items-end justify-between">
          <div>
            <p class="serif-italic mb-1 text-lg text-zinc-200">
              {#if selectedMood && selectedOutputIds.size > 0}
                {selectedMood.name} × {[...selectedOutputIds]
                  .map((id) => outputs.find((o) => o.id === id)?.name)
                  .join(', ')}
              {:else if selectedMood}
                {selectedMood.name}
              {:else if selectedOutputIds.size > 0}
                {[...selectedOutputIds]
                  .map((id) => outputs.find((o) => o.id === id)?.name)
                  .join(' + ')}
              {/if}
            </p>
            <p class="mono text-[11px] text-zinc-600">
              {matchingSparks.length} spark{matchingSparks.length !== 1 ? 's' : ''}
              {#if matchingSparks.length === 0}— try loosening the filters{/if}
            </p>
          </div>

          <!-- Suggested nodes from both selections -->
          {#if selectedMood || selectedOutputIds.size > 0}
            <div class="flex flex-wrap justify-end gap-1.5">
              {#each suggestedNodes as node (node)}
                <span
                  class="mono rounded px-2 py-0.5 text-[11px]"
                  style:background="color-mix(in srgb, {accentColor} 10%, transparent)"
                  style:color={textColor}
                  style:border="1px solid color-mix(in srgb, {accentColor} 25%, transparent)"
                >
                  {node}
                </span>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Sparks grid -->
        {#if matchingSparks.length > 0}
          <div class="sparks-grid">
            {#each matchingSparks as spark (spark.id)}
              <article
                class="spark-card"
                style:border-color="color-mix(in srgb, {accentColor} 14%, rgba(255,255,255,0.06))"
              >
                <div class="mb-2 flex flex-wrap gap-1">
                  {#each spark.nodes as node (node)}
                    <span class="mono node-chip text-[10px]">{node}</span>
                  {/each}
                </div>
                <h3 class="syne mb-1 text-sm leading-snug font-semibold text-zinc-100">
                  {spark.title}
                </h3>
                <p class="mb-3 text-xs leading-relaxed text-zinc-600">{spark.description}</p>
                <!-- Output badges -->
                <div class="mb-3 flex flex-wrap gap-1">
                  {#each spark.outputs as oid (oid)}
                    {@const out = outputs.find((o) => o.id === oid)}
                    {#if out}
                      <span
                        class="mono rounded-full px-2 py-0.5 text-[10px]"
                        class:output-badge-active={selectedOutputIds.has(oid)}
                        class:output-badge={!selectedOutputIds.has(oid)}
                      >
                        {out.name}
                      </span>
                    {/if}
                  {/each}
                </div>
                <div
                  class="flex flex-wrap gap-1.5 border-t pt-3"
                  style:border-color="color-mix(in srgb, {accentColor} 10%, rgba(255,255,255,0.05))"
                >
                  {#each spark.patches as patch (patch.title)}
                    <a
                      href={patch.url}
                      class="mono inline-flex cursor-pointer items-center rounded px-2 py-1 text-[11px] transition-opacity hover:opacity-80"
                      style:background="color-mix(in srgb, {accentColor} 10%, transparent)"
                      style:color={textColor}
                      style:border="1px solid color-mix(in srgb, {accentColor} 20%, transparent)"
                    >
                      <span class="mr-1 opacity-50">{patchTypeIcon(patch.type)}</span>
                      {patch.title}
                      {#if patch.author}
                        <span class="ml-1 opacity-40">by {patch.author}</span>
                      {/if}
                    </a>
                  {/each}
                </div>
              </article>
            {/each}

            <!-- Ghost submit -->
            <article class="spark-card spark-ghost">
              <p class="syne mb-2 text-sm font-semibold text-zinc-700">
                {#if selectedMood && selectedOutputIds.size > 0}
                  Made something {selectedMood.name.toLowerCase()} with {[...selectedOutputIds]
                    .map((id) => outputs.find((o) => o.id === id)?.name.toLowerCase())
                    .join(' + ')}?
                {:else if selectedMood}
                  Made something {selectedMood.name.toLowerCase()}?
                {:else}
                  Working on something like this?
                {/if}
              </p>
              <p class="mb-4 text-xs leading-relaxed text-zinc-700">
                Share your patch and it might appear here.
              </p>
              <a
                href="/sparks/submit"
                class="mono inline-flex cursor-pointer items-center gap-1 text-xs transition-colors hover:opacity-80"
                style:color="color-mix(in srgb, {accentColor} 65%, #71717a)"
              >
                Submit a build →
              </a>
            </article>
          </div>
        {:else}
          <div class="py-16 text-center">
            <p class="syne mb-2 text-4xl font-bold text-zinc-800">No sparks yet</p>
            <p class="mono text-sm text-zinc-700">
              This combination doesn't have recipes yet — maybe you'll make the first one.
            </p>
          </div>
        {/if}
      </div>
    </section>
  {:else}
    <div class="px-8 pb-20">
      <p class="mono text-center text-[11px] tracking-widest text-zinc-800">
        ↑ pick a mood, an output, or both
      </p>
    </div>
  {/if}

  <!-- ── Footer ── -->
  <div class="border-t border-zinc-900 px-8 py-5">
    <div class="mx-auto flex max-w-4xl items-center justify-between">
      <p class="mono text-[11px] text-zinc-800">patchies sparks · mood board</p>
      <a
        href="/sparks"
        class="mono cursor-pointer text-[11px] text-zinc-700 transition-colors hover:text-zinc-400"
      >
        ← patch bench
      </a>
    </div>
  </div>
</div>

<style>
  .mood-page {
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

  /* ── Sparks ── */
  .sparks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 10px;
  }

  .spark-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid;
    border-radius: 8px;
    padding: 14px;
    transition:
      transform 0.15s,
      opacity 0.2s;
  }
  .spark-card:hover {
    transform: translateY(-1px);
  }

  .spark-ghost {
    border-style: dashed !important;
    border-color: rgba(255, 255, 255, 0.05) !important;
    background: transparent !important;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .node-chip {
    background: rgba(255, 255, 255, 0.04);
    color: #52525b;
    border-radius: 3px;
    padding: 1px 5px;
  }

  .output-badge {
    border: 1px solid rgba(255, 255, 255, 0.07);
    color: #52525b;
    background: transparent;
  }
  .output-badge-active {
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    color: var(--text-acc);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
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
    width: 260px;
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
