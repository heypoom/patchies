<script lang="ts">
  import { match } from 'ts-pattern';
  import { SvelteSet } from 'svelte/reactivity';
  import { BUILT_IN_PACKS } from '$lib/extensions/object-packs';

  // ── Types ─────────────────────────────────────────────────────
  type PatchType = 'starter' | 'template' | 'example' | 'showcase';
  type Difficulty = 'beginner' | 'intermediate' | 'advanced';

  interface Output {
    id: string;
    name: string;
    description: string;
    packIds?: string[];
    nodes?: string[];
  }

  function resolveNodes(output: Output): string[] {
    const fromPacks = (output.packIds ?? []).flatMap(
      (packId) => BUILT_IN_PACKS.find((p) => p.id === packId)?.objects ?? []
    );
    return [...new Set([...fromPacks, ...(output.nodes ?? [])])];
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

  interface Props {
    selectedMood: Mood | null;
    selectedOutputIds: SvelteSet<string>;
    outputs: Output[];
    accentColor: string;
    textColor: string;
  }

  let { selectedMood, selectedOutputIds, outputs, accentColor, textColor }: Props = $props();

  // ── Spark data ────────────────────────────────────────────────
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
      outputs: ['video', 'gestures'],
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
      outputs: ['video', 'code'],
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
      outputs: ['video', 'gestures', 'code'],
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
      outputs: ['low-level', 'sound', 'video'],
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

  // ── Derived ───────────────────────────────────────────────────
  const matchingSparks = $derived(
    sparks.filter((s) => {
      const moodOk = !selectedMood || s.mood.includes(selectedMood.id);
      const outputOk =
        selectedOutputIds.size === 0 ||
        [...selectedOutputIds].every((id) => s.outputs.includes(id));
      return moodOk && outputOk;
    })
  );

  const suggestedNodes = $derived([
    ...new Set([
      ...(selectedMood?.nodes ?? []),
      ...[...selectedOutputIds].flatMap((id) => {
        const o = outputs.find((out) => out.id === id);
        return o ? resolveNodes(o).slice(0, 2) : [];
      })
    ])
  ]);

  function patchTypeIcon(t: PatchType): string {
    return match(t)
      .with('starter', () => '▸')
      .with('template', () => '⊞')
      .with('example', () => '◈')
      .with('showcase', () => '★')
      .exhaustive();
  }
</script>

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
            {[...selectedOutputIds].map((id) => outputs.find((o) => o.id === id)?.name).join(' + ')}
          {/if}
        </p>
        <p class="mono text-[11px] text-zinc-600">
          {matchingSparks.length} spark{matchingSparks.length !== 1 ? 's' : ''}
          {#if matchingSparks.length === 0}— try loosening the filters{/if}
        </p>
      </div>

      <!-- Suggested nodes -->
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

<style>
  .serif-italic {
    font-family: 'Instrument Serif', serif;
    font-style: italic;
  }
  .syne {
    font-family: 'Syne', sans-serif;
  }
  .mono {
    font-family: 'JetBrains Mono', monospace;
  }

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
</style>
