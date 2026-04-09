<script lang="ts">
  import { match } from 'ts-pattern';

  type Difficulty = 'beginner' | 'intermediate' | 'advanced';
  type PatchType = 'starter' | 'template' | 'example' | 'showcase';

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
    tags: string[];
    difficulty: Difficulty;
    patches: Patch[];
    author: string;
  }

  const sparks: Spark[] = [
    {
      id: 'music-light-show',
      title: 'Music-Driven Light Show',
      description:
        'Turn any audio input into dynamic DMX lighting. FFT frequency bands map to RGB channels — kick drums flash red, highs shimmer blue.',
      nodes: ['fft', 'dmx', 'map'],
      tags: ['audio-reactive', 'live-performance', 'hardware'],
      difficulty: 'intermediate',
      author: 'poom',
      patches: [
        { title: 'Starter Kit', type: 'starter', url: '#' },
        { title: 'Full Stage Setup', type: 'template', url: '#' }
      ]
    },
    {
      id: 'generative-terrain',
      title: 'Infinite Generative Terrain',
      description:
        'Scrolling Perlin noise landscape that never repeats. Sliders control terrain scale, scroll speed, and color palette in real time.',
      nodes: ['p5', 'slider', 'js'],
      tags: ['generative', 'visual', 'interactive'],
      difficulty: 'beginner',
      author: 'poom',
      patches: [
        { title: 'Starter Kit', type: 'starter', url: '#' },
        { title: 'Audio-Reactive Version', type: 'example', url: '#' }
      ]
    },
    {
      id: 'video-feedback',
      title: 'Live Video Feedback Loop',
      description:
        'Webcam fed back through Hydra transforms creates hypnotic recursive visuals. A classic video synthesis technique made trivial.',
      nodes: ['hydra', 'webcam', 'canvas'],
      tags: ['visual', 'generative', 'video-synthesis'],
      difficulty: 'beginner',
      author: 'poom',
      patches: [
        { title: 'Starter Kit', type: 'starter', url: '#' },
        { title: 'Festival Build', type: 'showcase', url: '#', author: 'joey' }
      ]
    },
    {
      id: 'beat-typography',
      title: 'Beat-Synced Typography',
      description:
        'Text that dances to the beat. Each kick drum fires a font-size explosion. Works with Strudel patterns or live mic input.',
      nodes: ['transport', 'p5', 'strudel', 'fft'],
      tags: ['audio-reactive', 'visual', 'live-performance'],
      difficulty: 'intermediate',
      author: 'poom',
      patches: [{ title: 'Starter Kit', type: 'starter', url: '#' }]
    },
    {
      id: 'data-sonification',
      title: 'Data Sonification',
      description:
        'Fetch live data from any API and map values to synth parameters. Hear the stock market, weather, or crypto as a drone.',
      nodes: ['fetch', 'osc~', 'map', 'js'],
      tags: ['data', 'experimental', 'audio'],
      difficulty: 'advanced',
      author: 'poom',
      patches: [
        { title: 'Starter Kit', type: 'starter', url: '#' },
        { title: 'Bitcoin Price Drone', type: 'example', url: '#' }
      ]
    },
    {
      id: 'reactive-particles',
      title: 'Reactive Particle Storm',
      description:
        'Thousands of particles orbit a central attractor. Frequency bands control speed, mass, and color temperature in real time.',
      nodes: ['fft', 'p5', 'osc~'],
      tags: ['audio-reactive', 'generative', 'visual'],
      difficulty: 'intermediate',
      author: 'poom',
      patches: [
        { title: 'Starter Kit', type: 'starter', url: '#' },
        { title: 'With MIDI', type: 'template', url: '#' },
        { title: 'Festival Build', type: 'showcase', url: '#', author: 'maya' }
      ]
    },
    {
      id: 'glsl-raymarcher',
      title: 'GLSL Raymarched Shapes',
      description:
        'Signed distance functions in a GLSL shader, animated by OSC messages. Change geometry, color, and lighting from other nodes.',
      nodes: ['glsl', 'osc~', 'js'],
      tags: ['visual', 'shader', 'generative'],
      difficulty: 'advanced',
      author: 'poom',
      patches: [
        { title: 'Starter Kit', type: 'starter', url: '#' },
        { title: 'SDF Playground', type: 'template', url: '#' }
      ]
    },
    {
      id: 'collaborative-canvas',
      title: 'Multiplayer Drawing Canvas',
      description:
        'A shared canvas where every connected peer can draw simultaneously. Built on Patchies P2P — no server needed.',
      nodes: ['canvas', 'p5', 'network'],
      tags: ['interactive', 'collaboration', 'experimental'],
      difficulty: 'intermediate',
      author: 'poom',
      patches: [
        { title: 'Starter Kit', type: 'starter', url: '#' },
        { title: 'With Strudel Score', type: 'example', url: '#', author: 'rin' }
      ]
    }
  ];

  const allNodes = [...new Set(sparks.flatMap((s) => s.nodes))].sort();
  const allTags = [...new Set(sparks.flatMap((s) => s.tags))].sort();

  let selectedNodes = $state<Set<string>>(new Set());
  let selectedTags = $state<Set<string>>(new Set());

  function toggleNode(node: string) {
    const next = new Set(selectedNodes);
    if (next.has(node)) next.delete(node);
    else next.add(node);
    selectedNodes = next;
  }

  function toggleTag(tag: string) {
    const next = new Set(selectedTags);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    selectedTags = next;
  }

  const filteredSparks = $derived(
    sparks.filter((spark) => {
      const nodeMatch =
        selectedNodes.size === 0 || [...selectedNodes].every((n) => spark.nodes.includes(n));
      const tagMatch =
        selectedTags.size === 0 || [...selectedTags].every((t) => spark.tags.includes(t));
      return nodeMatch && tagMatch;
    })
  );

  function clearFilters() {
    selectedNodes = new Set();
    selectedTags = new Set();
  }

  const hasFilters = $derived(selectedNodes.size > 0 || selectedTags.size > 0);

  function difficultyClass(d: Difficulty): string {
    return match(d)
      .with('beginner', () => 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10')
      .with('intermediate', () => 'text-amber-400 border-amber-400/30 bg-amber-400/10')
      .with('advanced', () => 'text-rose-400 border-rose-400/30 bg-rose-400/10')
      .exhaustive();
  }

  function patchTypeClass(t: PatchType): string {
    return match(t)
      .with('starter', () => 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700')
      .with(
        'template',
        () => 'bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 border border-blue-500/25'
      )
      .with(
        'example',
        () => 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/25'
      )
      .with(
        'showcase',
        () => 'bg-orange-500/15 text-orange-300 hover:bg-orange-500/25 border border-orange-500/35'
      )
      .exhaustive();
  }

  function patchTypeIcon(t: PatchType): string {
    return match(t)
      .with('starter', () => '▸')
      .with('template', () => '⊞')
      .with('example', () => '◈')
      .with('showcase', () => '★')
      .exhaustive();
  }

  const filterSummary = $derived(() => {
    const parts: string[] = [];
    if (selectedNodes.size > 0) parts.push([...selectedNodes].join(' + '));
    if (selectedTags.size > 0) parts.push([...selectedTags].join(' + '));
    return parts.join(' · ');
  });
</script>

<svelte:head>
  <title>Sparks | Patchies</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
  <link
    href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,600&family=JetBrains+Mono:wght@400;500&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="sparks-page min-h-screen text-zinc-200">
  <!-- Hero -->
  <header class="hero relative overflow-hidden px-8 pt-14 pb-10">
    <div class="mx-auto max-w-5xl">
      <p class="mono mb-3 text-xs tracking-[0.2em] text-orange-400/80 uppercase">
        patchies ✦ inspiration
      </p>
      <h1 class="title-font leading-none text-white" style="font-size: clamp(5rem, 14vw, 10rem);">
        SPARKS
      </h1>
      <p class="bricolage mt-4 max-w-lg text-base leading-relaxed text-zinc-400">
        Ideas that ignite. Combine objects and themes to discover what's possible — recipes,
        starting points, and builds from the community.
      </p>
    </div>
    <div class="hero-orb" aria-hidden="true"></div>
    <div class="hero-orb-2" aria-hidden="true"></div>
  </header>

  <!-- Filter bar -->
  <section class="filter-section border-y border-zinc-800/50 px-8 py-6">
    <div class="mx-auto max-w-5xl">
      <div class="flex flex-wrap gap-8">
        <!-- Objects filter -->
        <div class="min-w-0 flex-1">
          <p class="mono mb-3 text-[10px] tracking-widest text-zinc-600 uppercase">Objects</p>
          <div class="flex flex-wrap gap-2">
            {#each allNodes as node}
              <button
                class="filter-chip node-chip mono cursor-pointer rounded px-3 py-1.5 text-xs transition-all duration-150"
                class:node-active={selectedNodes.has(node)}
                onclick={() => toggleNode(node)}
              >
                {node}
              </button>
            {/each}
          </div>
        </div>

        <div class="hidden w-px self-stretch bg-zinc-800/60 md:block"></div>

        <!-- Themes filter -->
        <div class="min-w-0 flex-1">
          <p class="mono mb-3 text-[10px] tracking-widest text-zinc-600 uppercase">Themes</p>
          <div class="flex flex-wrap gap-2">
            {#each allTags as tag}
              <button
                class="filter-chip tag-chip mono cursor-pointer rounded px-3 py-1.5 text-xs transition-all duration-150"
                class:tag-active={selectedTags.has(tag)}
                onclick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Active filter summary -->
      {#if hasFilters}
        <div class="mt-5 flex items-center gap-3">
          <div class="filter-summary-bar flex items-center gap-2 rounded px-3 py-1.5">
            <span class="mono text-[11px] text-zinc-400">
              <span class="text-zinc-500">showing</span>
              <span class="font-medium text-white">{filteredSparks.length}</span>
              <span class="text-zinc-500"> spark{filteredSparks.length !== 1 ? 's' : ''} for</span>
              <span class="ml-1 text-orange-400">{filterSummary()}</span>
            </span>
          </div>
          <button
            onclick={clearFilters}
            class="mono cursor-pointer text-[11px] text-zinc-600 transition-colors hover:text-zinc-300"
          >
            ✕ clear all
          </button>
        </div>
      {:else}
        <p class="mono mt-4 text-[11px] text-zinc-700">
          {sparks.length} sparks · click objects or themes to filter
        </p>
      {/if}
    </div>
  </section>

  <!-- Cards grid -->
  <main class="px-8 py-10">
    <div class="mx-auto max-w-5xl">
      {#if filteredSparks.length === 0}
        <div class="py-28 text-center">
          <p class="title-font text-6xl text-zinc-800">NO SPARKS</p>
          <p class="mono mt-3 text-sm text-zinc-700">Try removing some filters</p>
          <button
            onclick={clearFilters}
            class="mono mt-6 cursor-pointer rounded border border-zinc-800 px-4 py-2 text-xs text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300"
          >
            Clear filters
          </button>
        </div>
      {:else}
        <div class="sparks-grid">
          {#each filteredSparks as spark (spark.id)}
            <article class="spark-card group">
              <!-- Accent line (top) -->
              <div class="card-accent-line"></div>

              <!-- Header row: nodes + difficulty -->
              <div class="mb-4 flex items-start justify-between gap-2">
                <div class="flex flex-wrap gap-1.5">
                  {#each spark.nodes as node}
                    <button
                      class="mono cursor-pointer rounded-sm px-2 py-0.5 text-[11px] transition-all duration-100"
                      class:node-pill-active={selectedNodes.has(node)}
                      class:node-pill={!selectedNodes.has(node)}
                      onclick={() => toggleNode(node)}
                      title="Filter by {node}">{node}</button
                    >
                  {/each}
                </div>
                <span
                  class="mono shrink-0 rounded border px-2 py-0.5 text-[11px] {difficultyClass(
                    spark.difficulty
                  )}"
                >
                  {spark.difficulty}
                </span>
              </div>

              <!-- Title -->
              <h2 class="bricolage mb-2 text-[1.15rem] leading-snug font-semibold text-white">
                {spark.title}
              </h2>

              <!-- Description -->
              <p class="mb-5 text-sm leading-relaxed text-zinc-400">{spark.description}</p>

              <!-- Tag pills -->
              <div class="mb-5 flex flex-wrap gap-1.5">
                {#each spark.tags as tag}
                  <button
                    class="mono cursor-pointer rounded-full border px-2.5 py-0.5 text-[10px] transition-all duration-100"
                    class:tag-pill-active={selectedTags.has(tag)}
                    class:tag-pill={!selectedTags.has(tag)}
                    onclick={() => toggleTag(tag)}
                    title="Filter by {tag}"
                  >
                    {tag}
                  </button>
                {/each}
              </div>

              <!-- Patches -->
              <div class="flex flex-wrap gap-2 border-t border-zinc-800/80 pt-4">
                {#each spark.patches as patch}
                  <a
                    href={patch.url}
                    class="mono inline-flex cursor-pointer items-center rounded px-3 py-1.5 text-xs transition-all {patchTypeClass(
                      patch.type
                    )}"
                  >
                    <span class="mr-1.5 opacity-60">{patchTypeIcon(patch.type)}</span>
                    {patch.title}
                    {#if patch.author && patch.author !== spark.author}
                      <span class="ml-1.5 opacity-40">by {patch.author}</span>
                    {/if}
                  </a>
                {/each}
              </div>
            </article>
          {/each}
        </div>
      {/if}
    </div>
  </main>
</div>

<style>
  .sparks-page {
    background-color: #09090b;
    background-image:
      radial-gradient(ellipse 70% 50% at 85% 0%, rgba(249, 115, 22, 0.07) 0%, transparent 60%),
      radial-gradient(ellipse 50% 40% at 5% 90%, rgba(6, 182, 212, 0.04) 0%, transparent 55%),
      url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.012'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    font-family: 'Bricolage Grotesque', sans-serif;
  }

  .title-font {
    font-family: 'Bebas Neue', sans-serif;
    letter-spacing: 0.02em;
  }
  .mono {
    font-family: 'JetBrains Mono', monospace;
  }
  .bricolage {
    font-family: 'Bricolage Grotesque', sans-serif;
  }

  .hero-orb {
    position: absolute;
    top: -80px;
    right: -120px;
    width: 600px;
    height: 600px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(249, 115, 22, 0.09) 0%, transparent 65%);
    pointer-events: none;
  }
  .hero-orb-2 {
    position: absolute;
    bottom: -100px;
    left: 30%;
    width: 400px;
    height: 400px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(249, 115, 22, 0.03) 0%, transparent 65%);
    pointer-events: none;
  }

  /* Filter chips (sidebar) */
  .filter-chip {
    border: 1px solid transparent;
    background: rgba(255, 255, 255, 0.04);
    color: #71717a;
  }
  .filter-chip:hover {
    background: rgba(255, 255, 255, 0.07);
    color: #a1a1aa;
  }
  .node-chip.node-active {
    background: rgba(249, 115, 22, 0.14);
    border-color: rgba(249, 115, 22, 0.4);
    color: #fb923c;
    box-shadow: 0 0 12px rgba(249, 115, 22, 0.12);
  }
  .tag-chip.tag-active {
    background: rgba(6, 182, 212, 0.11);
    border-color: rgba(6, 182, 212, 0.38);
    color: #22d3ee;
    box-shadow: 0 0 12px rgba(6, 182, 212, 0.1);
  }

  .filter-summary-bar {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
  }

  /* Grid */
  .sparks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(295px, 1fr));
    gap: 1.25rem;
  }

  /* Card */
  .spark-card {
    position: relative;
    background: #101012;
    border: 1px solid rgba(255, 255, 255, 0.065);
    border-radius: 10px;
    padding: 1.2rem;
    transition:
      border-color 0.2s ease,
      transform 0.2s ease,
      box-shadow 0.2s ease;
    overflow: hidden;
  }
  .spark-card:hover {
    border-color: rgba(249, 115, 22, 0.22);
    transform: translateY(-2px);
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(249, 115, 22, 0.08);
  }

  .card-accent-line {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(249, 115, 22, 0.4) 50%,
      transparent 100%
    );
    opacity: 0;
    transition: opacity 0.25s ease;
  }
  .spark-card:hover .card-accent-line {
    opacity: 1;
  }

  /* Node pills on cards */
  .node-pill {
    background: rgba(255, 255, 255, 0.05);
    color: #71717a;
    border: 1px solid transparent;
  }
  .node-pill:hover {
    background: rgba(249, 115, 22, 0.1);
    color: #fb923c;
  }
  .node-pill-active {
    background: rgba(249, 115, 22, 0.15);
    color: #fb923c;
    border: 1px solid rgba(249, 115, 22, 0.35);
  }

  /* Tag pills on cards */
  .tag-pill {
    border-color: rgba(255, 255, 255, 0.08);
    color: #52525b;
    background: transparent;
  }
  .tag-pill:hover {
    border-color: rgba(6, 182, 212, 0.3);
    color: #22d3ee;
    background: rgba(6, 182, 212, 0.06);
  }
  .tag-pill-active {
    border-color: rgba(6, 182, 212, 0.38);
    color: #22d3ee;
    background: rgba(6, 182, 212, 0.09);
  }
</style>
