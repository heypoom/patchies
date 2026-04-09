<script lang="ts">
  import { match } from 'ts-pattern';
  import { tick } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';

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

  // Today's challenge — could be date-seeded later
  const todaysChallenge = ['fft', 'p5', 'dmx'];

  // ── Bench state ──────────────────────────────────────────────
  const MAX_BENCH = 5;
  let benchNodes = $state<string[]>([]);
  let lockedNodes = new SvelteSet<string>();

  // Wire SVG
  let benchEl: HTMLDivElement | null = $state(null);
  let benchNodeEls: (HTMLElement | null)[] = [];
  let wirePaths = $state<{ d: string; key: string }[]>([]);
  let wireViewBox = $state('0 0 800 140');

  function computeWires() {
    if (!benchEl || benchNodes.length < 2) {
      wirePaths = [];
      return;
    }
    const cr = benchEl.getBoundingClientRect();
    const paths: { d: string; key: string }[] = [];
    for (let i = 0; i < benchNodes.length - 1; i++) {
      const a = benchNodeEls[i];
      const b = benchNodeEls[i + 1];
      if (!a || !b) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      // connect from bottom-center of each token
      const x1 = ra.left + ra.width / 2 - cr.left;
      const y1 = ra.bottom - cr.top;
      const x2 = rb.left + rb.width / 2 - cr.left;
      const y2 = rb.bottom - cr.top;
      const droop = 32;
      paths.push({
        d: `M ${x1} ${y1} C ${x1} ${y1 + droop}, ${x2} ${y2 + droop}, ${x2} ${y2}`,
        key: `${benchNodes[i]}-${benchNodes[i + 1]}-${i}`
      });
    }
    wirePaths = paths;
    wireViewBox = `0 0 ${cr.width} ${cr.height}`;
  }

  $effect(() => {
    void benchNodes;
    tick().then(computeWires);
  });

  function addToBench(node: string) {
    if (benchNodes.includes(node) || benchNodes.length >= MAX_BENCH) return;
    benchNodes = [...benchNodes, node];
  }

  function removeFromBench(node: string) {
    benchNodes = benchNodes.filter((n) => n !== node);
    lockedNodes.delete(node);
  }

  function toggleLock(node: string, e: MouseEvent) {
    e.stopPropagation();
    if (lockedNodes.has(node)) lockedNodes.delete(node);
    else lockedNodes.add(node);
  }

  function surpriseMe() {
    const keep = benchNodes.filter((n) => lockedNodes.has(n));
    const available = allNodes.filter((n) => !keep.includes(n));
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const needed = Math.max(0, 3 - keep.length);
    benchNodes = [...keep, ...shuffled.slice(0, needed)];
  }

  function loadChallenge() {
    benchNodes = [...todaysChallenge];
    lockedNodes.clear();
  }

  function clearBench() {
    benchNodes = [];
    lockedNodes.clear();
    wirePaths = [];
  }

  // ── Spark scoring ─────────────────────────────────────────────
  function scoreSpark(spark: Spark): number {
    if (benchNodes.length === 0) return 0;
    return benchNodes.filter((n) => spark.nodes.includes(n)).length;
  }

  const scoredSparks = $derived(
    sparks
      .map((s) => ({ spark: s, score: scoreSpark(s) }))
      .filter(({ score }) => benchNodes.length === 0 || score > 0)
      .sort((a, b) => b.score - a.score)
  );

  // ── Style helpers ─────────────────────────────────────────────
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
  <!-- ── Hero ── -->
  <header class="hero relative overflow-hidden px-8 pt-12 pb-8">
    <div class="mx-auto max-w-5xl">
      <p class="mono mb-2 text-[11px] tracking-[0.25em] text-orange-400/70 uppercase">
        patchies ✦ inspiration
      </p>
      <div class="flex items-end gap-6">
        <h1 class="title-font leading-none text-white" style="font-size: clamp(4rem, 11vw, 8rem);">
          SPARKS
        </h1>
        <p class="bricolage mb-2 max-w-sm text-sm leading-relaxed text-zinc-500">
          Combine objects on the bench to discover recipes, starting points, and community builds.
        </p>
      </div>
    </div>
    <div class="hero-orb" aria-hidden="true"></div>
  </header>

  <!-- ── Patch Bench ── -->
  <section class="bench-section px-8 pb-8">
    <div class="mx-auto max-w-5xl">
      <!-- Bench header -->
      <div class="mb-4 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <h2 class="title-font text-2xl tracking-wide text-zinc-300">PATCH BENCH</h2>
          {#if benchNodes.length > 0}
            <span class="mono text-[11px] text-zinc-600">
              {benchNodes.length}/{MAX_BENCH} objects
            </span>
          {/if}
        </div>
        <div class="flex items-center gap-2">
          <button onclick={loadChallenge} class="challenge-btn mono cursor-pointer text-xs">
            ⚡ Today's Challenge
          </button>
          <button onclick={surpriseMe} class="surprise-btn mono cursor-pointer text-xs">
            ↺ Surprise me
          </button>
          {#if benchNodes.length > 0}
            <button onclick={clearBench} class="clear-btn mono cursor-pointer text-xs">
              Clear
            </button>
          {/if}
        </div>
      </div>

      <!-- Bench surface -->
      <div class="bench-surface relative" bind:this={benchEl}>
        <!-- Wire SVG -->
        {#if wirePaths.length > 0}
          <svg
            class="wire-svg pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            viewBox={wireViewBox}
            preserveAspectRatio="none"
          >
            <defs>
              <filter id="wire-glow" x="-20%" y="-40%" width="140%" height="180%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {#each wirePaths as wire (wire.key)}
              <!-- Glow layer -->
              <path
                d={wire.d}
                fill="none"
                stroke="rgba(249,115,22,0.25)"
                stroke-width="4"
                filter="url(#wire-glow)"
              />
              <!-- Main cable -->
              <path d={wire.d} fill="none" class="wire-cable" />
              <!-- Signal flow -->
              <path d={wire.d} fill="none" class="wire-flow" />
            {/each}
          </svg>
        {/if}

        <!-- Node tokens on bench -->
        <div class="bench-nodes relative z-10">
          {#if benchNodes.length === 0}
            <div class="bench-empty">
              <span class="mono text-xs text-zinc-700"
                >click objects below · or try Surprise me ↑</span
              >
            </div>
          {:else}
            {#each benchNodes as node, i}
              <div
                class="bench-token"
                class:bench-token-locked={lockedNodes.has(node)}
                bind:this={benchNodeEls[i]}
              >
                <!-- Lock -->
                <button
                  class="token-lock cursor-pointer"
                  onclick={(e) => toggleLock(node, e)}
                  title={lockedNodes.has(node) ? 'Unlock — will reroll' : 'Lock — keep on Surprise'}
                >
                  {#if lockedNodes.has(node)}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <path
                        d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"
                      />
                    </svg>
                  {:else}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <path
                        d="M12 1C9.24 1 7 3.24 7 6v1H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2h-1V6c0-2.76-2.24-5-5-5zm0 2c1.66 0 3 1.34 3 3v1H9V6c0-1.66 1.34-3 3-3zm0 9c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"
                      />
                    </svg>
                  {/if}
                </button>
                <!-- Node name -->
                <span class="mono text-sm font-medium text-zinc-100">{node}</span>
                <!-- Remove -->
                <button
                  class="token-remove cursor-pointer"
                  onclick={() => removeFromBench(node)}
                  title="Remove from bench"
                >
                  ×
                </button>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <!-- Node tray -->
      <div class="node-tray mt-3">
        <p class="mono mb-2 text-[10px] tracking-widest text-zinc-700 uppercase">All Objects</p>
        <div class="flex flex-wrap gap-1.5">
          {#each allNodes as node (node)}
            {@const onBench = benchNodes.includes(node)}
            {@const full = benchNodes.length >= MAX_BENCH && !onBench}
            <button
              class="tray-chip mono cursor-pointer rounded px-2.5 py-1 text-xs transition-all duration-100"
              class:tray-on-bench={onBench}
              class:tray-full={full}
              onclick={() => (onBench ? removeFromBench(node) : addToBench(node))}
              disabled={full}
              title={full
                ? 'Bench is full — remove a node first'
                : onBench
                  ? 'Remove from bench'
                  : 'Add to bench'}
            >
              {node}
            </button>
          {/each}
        </div>
      </div>

      <!-- Challenge card -->
      <div class="challenge-hint mono mt-4 text-[11px] text-zinc-700">
        ⚡ <span class="text-zinc-500">Today's challenge:</span>
        {todaysChallenge.join(' + ')}
        <span class="ml-2 text-zinc-700">· 12 builds submitted</span>
      </div>
    </div>
  </section>

  <!-- ── Divider ── -->
  <div class="mx-8 border-t border-zinc-800/50"></div>

  <!-- ── Sparks Grid ── -->
  <main class="px-8 py-10">
    <div class="mx-auto max-w-5xl">
      {#if benchNodes.length > 0}
        <p class="mono mb-6 text-[11px] text-zinc-600">
          {#if scoredSparks.filter((s) => s.score === benchNodes.length).length > 0}
            <span class="text-orange-400"
              >{scoredSparks.filter((s) => s.score === benchNodes.length).length} full match{scoredSparks.filter(
                (s) => s.score === benchNodes.length
              ).length !== 1
                ? 'es'
                : ''}</span
            >
            {#if scoredSparks.filter((s) => s.score < benchNodes.length).length > 0}
              · {scoredSparks.filter((s) => s.score < benchNodes.length).length} partial
            {/if}
          {:else}
            {scoredSparks.length} partial match{scoredSparks.length !== 1 ? 'es' : ''}
          {/if}
          for {benchNodes.join(' + ')}
        </p>
      {/if}

      {#if scoredSparks.length === 0}
        <div class="py-24 text-center">
          <p class="title-font text-6xl text-zinc-800">NO SPARKS YET</p>
          <p class="mono mt-3 text-sm text-zinc-700">
            No existing recipes use all these nodes together. You might be first!
          </p>
          <a
            href="/sparks/submit"
            class="mono mt-6 inline-block cursor-pointer rounded border border-zinc-800 px-4 py-2 text-xs text-zinc-500 transition-colors hover:border-orange-500/40 hover:text-orange-400"
          >
            Submit a build with these nodes →
          </a>
        </div>
      {:else}
        <div class="sparks-grid">
          {#each scoredSparks as { spark, score } (spark.id)}
            {@const isFullMatch = benchNodes.length > 0 && score === benchNodes.length}
            {@const isPartial = benchNodes.length > 0 && score > 0 && score < benchNodes.length}
            <article
              class="spark-card"
              class:spark-full-match={isFullMatch}
              class:spark-partial={isPartial}
            >
              {#if isFullMatch}
                <div class="card-accent-line"></div>
              {/if}

              <!-- Nodes + difficulty -->
              <div class="mb-3 flex items-start justify-between gap-2">
                <div class="flex flex-wrap gap-1">
                  {#each spark.nodes as node}
                    {@const active = benchNodes.includes(node)}
                    <button
                      class="mono cursor-pointer rounded-sm px-1.5 py-0.5 text-[10px] transition-all"
                      class:node-pill-active={active}
                      class:node-pill={!active}
                      onclick={() => (active ? removeFromBench(node) : addToBench(node))}
                      title={active ? 'Remove from bench' : 'Add to bench'}>{node}</button
                    >
                  {/each}
                </div>
                <div class="flex shrink-0 items-center gap-1.5">
                  {#if isFullMatch}
                    <span class="mono text-[10px] text-orange-400">✦ match</span>
                  {:else if isPartial && benchNodes.length > 0}
                    <span class="mono text-[10px] text-zinc-600">{score}/{benchNodes.length}</span>
                  {/if}
                  <span
                    class="mono rounded border px-1.5 py-0.5 text-[10px] {difficultyClass(
                      spark.difficulty
                    )}">{spark.difficulty}</span
                  >
                </div>
              </div>

              <h2 class="bricolage mb-1.5 text-base leading-snug font-semibold text-white">
                {spark.title}
              </h2>
              <p class="mb-4 text-xs leading-relaxed text-zinc-500">{spark.description}</p>

              <!-- Tags -->
              <div class="mb-4 flex flex-wrap gap-1">
                {#each spark.tags as tag}
                  <span
                    class="mono rounded-full border border-zinc-800 px-2 py-0.5 text-[10px] text-zinc-600"
                  >
                    {tag}
                  </span>
                {/each}
              </div>

              <!-- Patches -->
              <div class="flex flex-wrap gap-1.5 border-t border-zinc-800/70 pt-3">
                {#each spark.patches as patch}
                  <a
                    href={patch.url}
                    class="mono inline-flex cursor-pointer items-center rounded px-2.5 py-1 text-xs transition-all {patchTypeClass(
                      patch.type
                    )}"
                  >
                    <span class="mr-1 opacity-50">{patchTypeIcon(patch.type)}</span>
                    {patch.title}
                    {#if patch.author && patch.author !== spark.author}
                      <span class="ml-1 opacity-40">by {patch.author}</span>
                    {/if}
                  </a>
                {/each}
              </div>
            </article>
          {/each}

          <!-- Submit ghost card (when bench has nodes) -->
          {#if benchNodes.length >= 2}
            <article class="spark-card spark-submit-ghost">
              <p class="mono mb-1 text-[10px] tracking-widest text-zinc-700 uppercase">
                Your build
              </p>
              <h2 class="bricolage mb-2 text-base font-semibold text-zinc-600">
                Made something with {benchNodes.slice(0, 3).join(' + ')}{benchNodes.length > 3
                  ? '…'
                  : ''}?
              </h2>
              <p class="mb-4 text-xs leading-relaxed text-zinc-700">
                Share your patch and it might be featured here for others to remix.
              </p>
              <a
                href="/sparks/submit"
                class="mono inline-flex cursor-pointer items-center gap-1.5 rounded border border-zinc-800 px-3 py-1.5 text-xs text-zinc-600 transition-all hover:border-orange-500/30 hover:text-orange-400"
              >
                Submit a build →
              </a>
            </article>
          {/if}
        </div>
      {/if}
    </div>
  </main>
</div>

<style>
  .sparks-page {
    background-color: #09090b;
    background-image:
      radial-gradient(ellipse 65% 45% at 90% 0%, rgba(249, 115, 22, 0.08) 0%, transparent 60%),
      radial-gradient(ellipse 45% 35% at 5% 85%, rgba(6, 182, 212, 0.03) 0%, transparent 55%);
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
    top: -60px;
    right: -80px;
    width: 500px;
    height: 500px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(249, 115, 22, 0.09) 0%, transparent 65%);
    pointer-events: none;
  }

  .challenge-btn {
    padding: 6px 12px;
    background: rgba(249, 115, 22, 0.08);
    border: 1px solid rgba(249, 115, 22, 0.25);
    border-radius: 6px;
    color: #fb923c;
    transition: all 0.15s;
  }
  .challenge-btn:hover {
    background: rgba(249, 115, 22, 0.15);
    border-color: rgba(249, 115, 22, 0.45);
  }

  .surprise-btn {
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #a1a1aa;
    transition: all 0.15s;
  }
  .surprise-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #e4e4e7;
  }

  .clear-btn {
    padding: 6px 10px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 6px;
    color: #52525b;
    transition: all 0.15s;
  }
  .clear-btn:hover {
    color: #a1a1aa;
    border-color: rgba(255, 255, 255, 0.15);
  }

  /* Bench surface */
  .bench-surface {
    background: #0a0a0d;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.018) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.018) 1px, transparent 1px);
    background-size: 24px 24px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 10px;
    min-height: 130px;
    padding: 20px;
    overflow: hidden;
  }

  .bench-nodes {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    flex-wrap: wrap;
    min-height: 86px;
  }

  .bench-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 86px;
  }

  /* Wire SVG */
  .wire-svg {
    z-index: 0;
  }

  .wire-cable {
    stroke: rgba(249, 115, 22, 0.55);
    stroke-width: 1.5;
    stroke-linecap: round;
  }

  .wire-flow {
    stroke: rgba(249, 115, 22, 0.9);
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-dasharray: 6 18;
    animation: flow 1.2s linear infinite;
  }

  @keyframes flow {
    from {
      stroke-dashoffset: 24;
    }
    to {
      stroke-dashoffset: 0;
    }
  }

  /* Bench tokens */
  .bench-token {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 12px 16px;
    background: #161619;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    min-width: 80px;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }
  .bench-token:hover {
    border-color: rgba(255, 255, 255, 0.18);
  }
  .bench-token-locked {
    border-color: rgba(249, 115, 22, 0.4) !important;
    box-shadow: 0 0 14px rgba(249, 115, 22, 0.1);
  }
  .bench-token-locked .mono {
    color: #fb923c;
  }

  .token-lock {
    position: absolute;
    top: 5px;
    left: 6px;
    color: #52525b;
    transition: color 0.1s;
    background: none;
    border: none;
    padding: 1px;
  }
  .bench-token-locked .token-lock {
    color: #fb923c;
  }
  .token-lock:hover {
    color: #a1a1aa;
  }

  .token-remove {
    position: absolute;
    top: 3px;
    right: 5px;
    color: #3f3f46;
    font-size: 13px;
    line-height: 1;
    background: none;
    border: none;
    padding: 1px 2px;
    transition: color 0.1s;
  }
  .token-remove:hover {
    color: #ef4444;
  }

  /* Node tray */
  .tray-chip {
    border: 1px solid transparent;
    background: rgba(255, 255, 255, 0.04);
    color: #71717a;
  }
  .tray-chip:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    color: #d4d4d8;
  }
  .tray-on-bench {
    background: rgba(249, 115, 22, 0.12) !important;
    border-color: rgba(249, 115, 22, 0.35) !important;
    color: #fb923c !important;
  }
  .tray-full {
    opacity: 0.3;
    cursor: not-allowed !important;
  }

  /* ── Cards ── */
  .sparks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .spark-card {
    position: relative;
    background: #0f0f11;
    border: 1px solid rgba(255, 255, 255, 0.065);
    border-radius: 8px;
    padding: 1rem;
    transition:
      border-color 0.2s,
      box-shadow 0.2s,
      opacity 0.2s;
    overflow: hidden;
  }
  .spark-card:hover {
    border-color: rgba(255, 255, 255, 0.12);
  }
  .spark-full-match {
    border-color: rgba(249, 115, 22, 0.25) !important;
    box-shadow: 0 0 20px rgba(249, 115, 22, 0.06);
  }
  .spark-full-match:hover {
    border-color: rgba(249, 115, 22, 0.4) !important;
    box-shadow: 0 4px 24px rgba(249, 115, 22, 0.1);
  }
  .spark-partial {
    opacity: 0.65;
  }
  .spark-partial:hover {
    opacity: 0.9;
  }

  .card-accent-line {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(249, 115, 22, 0.5), transparent);
  }

  .spark-submit-ghost {
    border-style: dashed !important;
    border-color: rgba(255, 255, 255, 0.06) !important;
    background: transparent !important;
  }

  /* Node pills on cards */
  .node-pill {
    background: rgba(255, 255, 255, 0.04);
    color: #52525b;
    border: 1px solid transparent;
  }
  .node-pill:hover {
    background: rgba(249, 115, 22, 0.08);
    color: #fb923c;
  }
  .node-pill-active {
    background: rgba(249, 115, 22, 0.12);
    color: #fb923c;
    border: 1px solid rgba(249, 115, 22, 0.3);
  }
</style>
