<script lang="ts">
  import { match } from 'ts-pattern';
  import {
    Activity,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    Crosshair,
    Settings
  } from '@lucide/svelte/icons';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import {
    profilerEnabled,
    profilerSnapshot,
    profilerHistory
  } from '../../../stores/profiler.store';
  import { requestFocusNodeId, nodeLabelsStore } from '../../../stores/ui.store';
  import {
    profilerSettings,
    SAMPLE_WINDOW_OPTIONS,
    FLUSH_INTERVAL_OPTIONS,
    HOT_THRESHOLD_OPTIONS
  } from '../../../stores/profiler-settings.store';
  import type { ProfilerCategory, ProfilerSnapshot, TimingStats } from '$lib/profiler/types';
  import { SvelteSet } from 'svelte/reactivity';

  // ─── Display stat helpers ──────────────────────────────────────────────────

  let displayStat = $derived($profilerSettings.displayStat);

  const getStatValue = (t: TimingStats): number =>
    match(displayStat)
      .with('avg', () => t.avg)
      .with('max', () => t.max)
      .with('p95', () => t.p95)
      .with('last', () => t.last)
      .with('calls/s', () => t.callsPerSecond)
      .exhaustive();

  function fmtStat(t: TimingStats): string {
    if (displayStat === 'calls/s') {
      return t.callsPerSecond.toFixed(1);
    }

    return fmt(getStatValue(t));
  }

  function fmt(ms: number): string {
    if (ms < 0.01) return '<0.01ms';

    if (ms >= 100) return ms.toFixed(0) + 'ms';

    return ms.toFixed(2) + 'ms';
  }

  function fmtFps(fps: number): string {
    return fps.toFixed(1) + ' fps';
  }

  // ─── Category metadata ───────────────────────────────────────────────────────

  const ORDERED_CATEGORIES: ProfilerCategory[] = ['init', 'message', 'draw', 'interval', 'raf'];
  const MAIN_VIEW_CATEGORIES: ProfilerCategory[] = ['message', 'draw', 'interval', 'raf'];

  const CATEGORY_LABEL: Record<ProfilerCategory, string> = {
    init: 'init',
    message: 'msg',
    draw: 'draw',
    interval: 'int',
    raf: 'raf'
  };

  const CATEGORY_COLOR: Record<ProfilerCategory, string> = {
    init: '#a1a1aa', // zinc-400   – one-time cost
    message: '#60a5fa', // blue-400   – recv/onMessage
    draw: '#fb923c', // orange-400 – render/draw
    interval: '#34d399', // emerald-400– setInterval
    raf: '#a78bfa' // violet-400 – requestAnimationFrame
  };

  // ─── Derived state ───────────────────────────────────────────────────────────

  /** Categories present in the current snapshot (drives main view column headers — excludes init) */
  let activeCategories = $derived(
    $profilerSnapshot
      ? MAIN_VIEW_CATEGORIES.filter((cat) =>
          $profilerSnapshot!.entries.some((e) => e.timings[cat] != null)
        )
      : []
  );

  /** Max displayed stat across message/draw — sizes the bar chart */
  let maxStat = $derived(
    $profilerSnapshot
      ? Math.max(
          ...$profilerSnapshot.entries.map((e) => {
            const t = e.timings.message ?? e.timings.draw;
            return t ? getStatValue(t) : 0;
          }),
          0.01
        )
      : 0.01
  );

  // ─── Expand/collapse state ───────────────────────────────────────────────────

  let selectedNodeId = $state<string | null>(null);

  function toggleNode(nodeId: string) {
    const isSelected = selectedNodeId === nodeId;
    selectedNodeId = isSelected ? null : nodeId;

    if (!isSelected && $profilerSettings.focusOnSelect) requestFocusNodeId.set(nodeId);
  }

  // ─── Chart helpers ───────────────────────────────────────────────────────────

  const CW = 240; // viewBox width
  const CH = 52; // viewBox height
  const CP = 3; // padding

  const COL_W = '2.8rem';

  /** Categories that appear for a node across the entire history */
  function nodeCats(nodeId: string, history: ProfilerSnapshot[]): ProfilerCategory[] {
    const seen = new SvelteSet<ProfilerCategory>();

    for (const snap of history) {
      const entry = snap.entries.find((e) => e.nodeId === nodeId);
      if (!entry) continue;

      for (const cat of ORDERED_CATEGORIES) {
        if (entry.timings[cat]) seen.add(cat);
      }
    }

    return ORDERED_CATEGORIES.filter((c) => seen.has(c));
  }

  /** Max avg across all categories for a node in the history */
  function historyMax(nodeId: string, history: ProfilerSnapshot[]): number {
    let max = 0.01;

    for (const snap of history) {
      const entry = snap.entries.find((e) => e.nodeId === nodeId);
      if (!entry) continue;

      for (const t of Object.values(entry.timings)) {
        if (t && t.avg > max) {
          max = t.avg;
        }
      }
    }

    return max;
  }

  /** Y coordinate for a value given a shared max */
  function valY(v: number, maxVal: number): number {
    return CH - CP - (v / maxVal) * (CH - CP * 2);
  }

  /** SVG path string for a category's avg over the history window */
  function buildPath(
    nodeId: string,
    category: ProfilerCategory,
    history: ProfilerSnapshot[],
    maxVal: number
  ): string {
    const n = history.length;
    if (n === 0) return '';

    let path = '';
    let penDown = false;

    for (let i = 0; i < n; i++) {
      const v = history[i].entries.find((e) => e.nodeId === nodeId)?.timings[category]?.avg ?? null;
      if (v === null) {
        penDown = false;
        continue;
      }

      const x = n > 1 ? (i / (n - 1)) * (CW - CP * 2) + CP : CW / 2;
      const y = valY(v, maxVal);

      path += penDown ? `L${x.toFixed(1)} ${y.toFixed(1)}` : `M${x.toFixed(1)} ${y.toFixed(1)}`;
      penDown = true;
    }

    return path;
  }

  // ─── Renderer chart helpers ─────────────────────────────────────────────────

  type RenderMetric = {
    key: string;
    label: string;
    color: string;
    get: (rf: import('$lib/profiler/types').RenderFrameStats) => number;
  };

  const RENDER_METRICS: RenderMetric[] = [
    { key: 'fps', label: 'fps', color: '#34d399', get: (rf) => rf.fps },
    { key: 'avg', label: 'avg', color: '#60a5fa', get: (rf) => rf.avgMs },
    { key: 'p50', label: 'p50', color: '#a78bfa', get: (rf) => rf.p50Ms },
    { key: 'p95', label: 'p95', color: '#fb923c', get: (rf) => rf.p95Ms },
    { key: 'p99', label: 'p99', color: '#f87171', get: (rf) => rf.p99Ms }
  ];

  function buildRenderPath(
    metric: RenderMetric,
    history: ProfilerSnapshot[],
    maxVal: number
  ): string {
    const n = history.length;
    if (n === 0) return '';
    let path = '';
    let penDown = false;
    for (let i = 0; i < n; i++) {
      const rf = history[i].renderFrame;
      if (!rf) {
        penDown = false;
        continue;
      }
      const v = metric.get(rf);
      const x = n > 1 ? (i / (n - 1)) * (CW - CP * 2) + CP : CW / 2;
      const y = valY(v, maxVal);
      path += penDown ? `L${x.toFixed(1)} ${y.toFixed(1)}` : `M${x.toFixed(1)} ${y.toFixed(1)}`;
      penDown = true;
    }
    return path;
  }

  function renderHistoryMax(history: ProfilerSnapshot[], metrics: RenderMetric[]): number {
    let max = 0.01;
    for (const snap of history) {
      if (!snap.renderFrame) continue;
      for (const m of metrics) {
        const v = m.get(snap.renderFrame);
        if (v > max) max = v;
      }
    }
    return max;
  }

  // ─── Toggles ────────────────────────────────────────────────────────────────
  let showDevStats = $state(false);
  let showSettings = $state(false);

  let hotThreshold = $derived($profilerSettings.hotThresholdMs);
</script>

<div class="flex h-full flex-col">
  <!-- Header -->
  <div class="flex items-center justify-between border-b border-zinc-700 px-3 py-2">
    <div class="flex items-center gap-2">
      <Activity class="h-3.5 w-3.5 text-zinc-400" />
      <span class="text-xs font-medium text-zinc-300">Profiler</span>
      {#if $profilerEnabled}
        <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
      {/if}
    </div>
    <button
      class="cursor-pointer rounded px-2 py-0.5 text-xs transition-colors {$profilerEnabled
        ? 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600'
        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}"
      onclick={() => profilerEnabled.update((v) => !v)}
    >
      {$profilerEnabled ? 'Stop' : 'Start'}
    </button>
  </div>

  {#if !$profilerEnabled && !$profilerSnapshot}
    <div class="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
      <Activity class="h-8 w-8 text-zinc-700" />
      <p class="text-xs text-zinc-500">Press Start to begin profiling object processing times.</p>
    </div>
  {:else if !$profilerSnapshot || $profilerSnapshot.entries.length === 0}
    <div class="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
      <p class="text-xs text-zinc-500">Waiting for messages…</p>
      <p class="text-xs text-zinc-600">Send a message to a text object (metro, kv, etc.)</p>
    </div>
  {:else}
    <div class="min-h-0 flex-1 overflow-y-auto">
      <!-- Column headers -->
      <div
        class="sticky top-0 grid gap-x-2 border-b border-zinc-800 bg-zinc-950 px-3 py-1 text-[10px] font-medium tracking-wide text-zinc-600 uppercase"
        style:grid-template-columns="1fr {activeCategories.map(() => COL_W).join(' ')}"
      >
        <span>Object</span>

        {#each activeCategories as cat (cat)}
          <span class="text-right" style:color={CATEGORY_COLOR[cat]}>{CATEGORY_LABEL[cat]}</span>
        {/each}
      </div>

      {#each $profilerSnapshot.entries as entry (entry.nodeId)}
        {@const primaryTiming = entry.timings.message ?? entry.timings.draw}
        {@const primaryVal = primaryTiming ? getStatValue(primaryTiming) : 0}
        {@const isTimeStat = displayStat !== 'calls/s'}

        {@const isSevere = isTimeStat && primaryVal > hotThreshold * 5}
        {@const isHot = isTimeStat && entry.isHot}
        {@const barPct = Math.min(100, (primaryVal / maxStat) * 100)}

        {@const isSelected = selectedNodeId === entry.nodeId}
        {@const nodeLabel = $nodeLabelsStore[entry.nodeId] ?? entry.nodeType}

        <!-- Node row -->
        <div
          class="group grid cursor-pointer items-center gap-x-2 px-3 py-1.5 text-xs
            {isSevere
            ? 'bg-red-950/30 hover:bg-red-950/50'
            : isHot
              ? 'bg-amber-950/30 hover:bg-amber-950/50'
              : isSelected
                ? 'bg-zinc-800/60'
                : 'hover:bg-zinc-800/50'}"
          style:grid-template-columns="1fr {activeCategories.map(() => COL_W).join(' ')}"
          onclick={() => toggleNode(entry.nodeId)}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && toggleNode(entry.nodeId)}
        >
          <!-- Object name + bar -->
          <div class="min-w-0">
            <div class="flex items-center gap-1 truncate">
              <ChevronRight
                class="h-2.5 w-2.5 shrink-0 text-zinc-700 transition-transform group-hover:text-zinc-500 {isSelected
                  ? 'rotate-90 text-zinc-500'
                  : ''}"
              />

              {#if isHot}
                <span class="shrink-0 {isSevere ? 'text-red-400' : 'text-amber-400'}">⚠</span>
              {/if}

              <span
                class="truncate font-mono {isSevere
                  ? 'text-red-300'
                  : isHot
                    ? 'text-amber-300'
                    : 'text-zinc-300'}">{nodeLabel}</span
              >
              <span class="ml-0.5 shrink-0 truncate font-mono text-[10px] text-zinc-600"
                >{entry.nodeId}</span
              >
            </div>

            <!-- Progress bar -->
            <div class="mt-0.5 h-0.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                class="h-full rounded-full transition-all duration-300 {isSevere
                  ? 'bg-red-500'
                  : isHot
                    ? 'bg-amber-500'
                    : 'bg-zinc-500'}"
                style:width="{barPct}%"
              ></div>
            </div>
          </div>

          <!-- Per-category timing columns -->
          {#each activeCategories as cat (cat)}
            {@const t = entry.timings[cat]}
            {#if t}
              {@const val = getStatValue(t)}
              {@const catSevere = isTimeStat && val > hotThreshold * 5}
              {@const catHot = isTimeStat && val > hotThreshold}
              <span
                class="font-mono text-[10px] tabular-nums {catSevere
                  ? 'text-red-300'
                  : catHot
                    ? 'text-amber-300'
                    : 'text-zinc-400'}">{fmtStat(t)}</span
              >
            {:else}
              <span class="text-zinc-800 tabular-nums">—</span>
            {/if}
          {/each}
        </div>

        <!-- Expanded sparkline chart -->
        {#if isSelected}
          {@const history = $profilerHistory}
          {@const cats = nodeCats(entry.nodeId, history)}
          {@const maxMs = historyMax(entry.nodeId, history)}
          {@const hotY = maxMs > hotThreshold ? valY(hotThreshold, maxMs) : null}
          {@const histSpanSecs = ((history.length - 1) * 0.5).toFixed(0)}

          <div class="border-b border-zinc-800/50 bg-zinc-900/40 px-3 pt-1.5 pb-2">
            {#if history.length >= 2}
              <!-- SVG sparkline -->
              <svg
                viewBox="0 0 {CW} {CH}"
                width="100%"
                height={CH}
                preserveAspectRatio="none"
                class="block overflow-visible"
              >
                <!-- HOT threshold reference line -->
                {#if hotY !== null}
                  <line
                    x1={CP}
                    y1={hotY}
                    x2={CW - CP}
                    y2={hotY}
                    stroke="#92400e"
                    stroke-width="0.75"
                    stroke-dasharray="4,3"
                  />
                {/if}

                <!-- Category paths -->
                {#each cats as cat (cat)}
                  {@const d = buildPath(entry.nodeId, cat, history, maxMs)}

                  {#if d}
                    <path
                      {d}
                      stroke={CATEGORY_COLOR[cat]}
                      stroke-width="1.5"
                      fill="none"
                      stroke-linejoin="round"
                      stroke-linecap="round"
                    />
                  {/if}
                {/each}

                <!-- Latest-value dots -->
                {#each cats as cat (cat)}
                  {@const lastEntry = history
                    .at(-1)
                    ?.entries.find((e) => e.nodeId === entry.nodeId)}

                  {@const v = lastEntry?.timings[cat]?.avg}

                  {#if v != null}
                    <circle cx={CW - CP} cy={valY(v, maxMs)} r="2.5" fill={CATEGORY_COLOR[cat]} />
                  {/if}
                {/each}
              </svg>

              <!-- Axis hints -->
              <div
                class="mt-0.5 flex items-center justify-between font-mono text-[8px] text-zinc-700"
              >
                <span>{fmt(maxMs)}</span>
                <span>{histSpanSecs}s</span>
              </div>
            {:else}
              <p class="py-2 text-center text-[10px] text-zinc-700">Gathering data…</p>
            {/if}

            <!-- Detailed timing stats table -->
            <div class="mt-1.5">
              <!-- Table header -->
              <div
                class="grid gap-x-2 border-b border-zinc-800/60 pb-0.5 text-[9px] font-medium tracking-wide text-zinc-600 uppercase"
                style:grid-template-columns="3rem repeat(5, 1fr)"
              >
                <span></span>
                <span class="text-right">avg</span>
                <span class="text-right">max</span>
                <span class="text-right">p95</span>
                <span class="text-right">last</span>
                <span class="text-right">calls/s</span>
              </div>

              <!-- Per-category rows -->
              {#each cats as cat (cat)}
                {@const t = entry.timings[cat]}
                <div
                  class="grid gap-x-2 py-0.5 font-mono text-[10px] tabular-nums"
                  style:grid-template-columns="3rem repeat(5, 1fr)"
                >
                  <span class="flex items-center gap-1">
                    <span
                      class="inline-block h-0.5 w-2 rounded-full"
                      style:background-color={CATEGORY_COLOR[cat]}
                    ></span>
                    <span class="text-zinc-600">{CATEGORY_LABEL[cat]}</span>
                  </span>

                  {#if t}
                    {@const catSevere = t.avg > hotThreshold * 5}
                    {@const catHot = t.avg > hotThreshold}
                    {@const color = catSevere
                      ? 'text-red-300'
                      : catHot
                        ? 'text-amber-300'
                        : 'text-zinc-400'}
                    <span class="text-right {color}">{fmt(t.avg)}</span>
                    <span class="text-right {color}">{fmt(t.max)}</span>
                    <span class="text-right {color}">{fmt(t.p95)}</span>
                    <span class="text-right text-zinc-500">{fmt(t.last)}</span>
                    <span class="text-right text-zinc-500">{t.callsPerSecond.toFixed(1)}</span>
                  {:else}
                    <span class="text-right text-zinc-800">—</span>
                    <span class="text-right text-zinc-800">—</span>
                    <span class="text-right text-zinc-800">—</span>
                    <span class="text-right text-zinc-800">—</span>
                    <span class="text-right text-zinc-800">—</span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    </div>

    <!-- Footer: threshold note + dev stats toggle -->
    <div class="border-t border-zinc-800 px-3 py-1.5 text-[10px] text-zinc-600">
      <div class="flex items-center justify-between">
        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              class="cursor-pointer rounded px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 tabular-nums transition-colors hover:bg-zinc-800 hover:text-zinc-300"
              onclick={() => profilerSettings.nextDisplayStat()}
            >
              {displayStat}
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content>Cycle display stat</Tooltip.Content>
        </Tooltip.Root>
        <div class="flex items-center gap-1">
          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                class="cursor-pointer rounded p-0.5 transition-colors {$profilerSettings.focusOnSelect
                  ? 'text-zinc-300 hover:text-zinc-100'
                  : 'text-zinc-700 hover:text-zinc-500'}"
                onclick={() => profilerSettings.toggleFocusOnSelect()}
              >
                <Crosshair class="h-3 w-3" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content
              >{$profilerSettings.focusOnSelect ? 'Disable' : 'Enable'} focus on select</Tooltip.Content
            >
          </Tooltip.Root>
          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                class="cursor-pointer rounded p-0.5 transition-colors {showSettings
                  ? 'text-zinc-300 hover:text-zinc-100'
                  : 'text-zinc-600 hover:text-zinc-400'}"
                onclick={() => (showSettings = !showSettings)}
              >
                <Settings class="h-3 w-3" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>Profiler settings</Tooltip.Content>
          </Tooltip.Root>
          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                class="cursor-pointer rounded p-0.5 text-zinc-600 transition-colors hover:text-zinc-400"
                onclick={() => (showDevStats = !showDevStats)}
              >
                {#if showDevStats}<ChevronDown class="h-3 w-3" />{:else}<ChevronUp
                    class="h-3 w-3"
                  />{/if}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>Toggle renderer stats</Tooltip.Content>
          </Tooltip.Root>
        </div>
      </div>

      <!-- Settings panel -->
      {#if showSettings}
        <div class="mt-1.5 space-y-2 border-t border-zinc-800/60 pt-1.5">
          <!-- Sample window -->
          <div class="flex items-center justify-between">
            <span class="text-zinc-500">Sample window</span>
            <div class="flex gap-0.5">
              {#each SAMPLE_WINDOW_OPTIONS as opt (opt)}
                <button
                  class="cursor-pointer rounded px-1.5 py-0.5 font-mono tabular-nums transition-colors {$profilerSettings.sampleWindowSec ===
                  opt
                    ? 'bg-zinc-700 text-zinc-200'
                    : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}"
                  onclick={() => profilerSettings.setSampleWindow(opt)}
                >
                  {opt}s
                </button>
              {/each}
            </div>
          </div>

          <!-- Update rate -->
          <div class="flex items-center justify-between">
            <span class="text-zinc-500">Update rate</span>
            <div class="flex gap-0.5">
              {#each FLUSH_INTERVAL_OPTIONS as opt (opt)}
                <button
                  class="cursor-pointer rounded px-1.5 py-0.5 font-mono tabular-nums transition-colors {$profilerSettings.flushIntervalMs ===
                  opt
                    ? 'bg-zinc-700 text-zinc-200'
                    : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}"
                  onclick={() => profilerSettings.setFlushInterval(opt)}
                >
                  {opt}ms
                </button>
              {/each}
            </div>
          </div>

          <!-- Hot threshold -->
          <div class="flex items-center justify-between">
            <span class="text-zinc-500">Hot threshold</span>
            <div class="flex gap-0.5">
              {#each HOT_THRESHOLD_OPTIONS as opt (opt)}
                <button
                  class="cursor-pointer rounded px-1.5 py-0.5 font-mono tabular-nums transition-colors {$profilerSettings.hotThresholdMs ===
                  opt
                    ? 'bg-zinc-700 text-zinc-200'
                    : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}"
                  onclick={() => profilerSettings.setHotThreshold(opt)}
                >
                  {opt}ms
                </button>
              {/each}
            </div>
          </div>
        </div>
      {/if}

      {#if showDevStats}
        {@const rf = $profilerSnapshot?.renderFrame}
        {@const history = $profilerHistory}
        {@const rMaxMs = renderHistoryMax(history, RENDER_METRICS)}
        {@const rHistSpan = ((history.length - 1) * 0.5).toFixed(0)}
        <div class="mt-1.5 border-t border-zinc-800/60 pt-1.5">
          <div class="mb-1 font-mono font-light tracking-wide text-zinc-500">renderer</div>

          {#if rf}
            <!-- Renderer sparkline chart -->
            {#if history.length >= 2}
              <svg
                viewBox="0 0 {CW} {CH}"
                width="100%"
                height={CH}
                preserveAspectRatio="none"
                class="block overflow-visible"
              >
                {#each RENDER_METRICS as metric (metric.key)}
                  {@const d = buildRenderPath(metric, history, rMaxMs)}
                  {#if d}
                    <path
                      {d}
                      stroke={metric.color}
                      stroke-width="1.5"
                      fill="none"
                      stroke-linejoin="round"
                      stroke-linecap="round"
                    />
                  {/if}
                {/each}

                <!-- Latest-value dots -->
                {#each RENDER_METRICS as metric (metric.key)}
                  {@const lastRf = history.at(-1)?.renderFrame}
                  {#if lastRf}
                    {@const v = metric.get(lastRf)}
                    <circle cx={CW - CP} cy={valY(v, rMaxMs)} r="2.5" fill={metric.color} />
                  {/if}
                {/each}
              </svg>

              <div
                class="mt-0.5 flex items-center justify-between font-mono text-[8px] text-zinc-700"
              >
                <span>{fmt(rMaxMs)}</span>
                <span>{rHistSpan}s</span>
              </div>
            {/if}

            <!-- Legend + stats -->
            <div class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono">
              {#each RENDER_METRICS as metric (metric.key)}
                <span class="flex items-center gap-1 text-[10px]">
                  <span
                    class="inline-block h-0.5 w-3 rounded-full"
                    style:background-color={metric.color}
                  ></span>

                  <span class="text-zinc-600">{metric.label}</span>

                  <span class="text-zinc-400 tabular-nums">
                    {metric.key === 'fps' ? fmtFps(metric.get(rf)) : fmt(metric.get(rf))}
                  </span>
                </span>
              {/each}
            </div>

            <!-- Per-operation breakdown -->
            {#if rf.blitAvgMs !== null || rf.transferAvgMs !== null || rf.previewAvgMs !== null || rf.videoAvgMs !== null}
              <div class="mt-0.5 font-mono">
                <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] tabular-nums">
                  {#if rf.blitAvgMs !== null}
                    <span class="text-zinc-600">blit</span>
                    <span class="text-zinc-400">{fmt(rf.blitAvgMs)}</span>
                  {/if}

                  {#if rf.transferAvgMs !== null}
                    <span class="text-zinc-600">transfer bitmap</span>
                    <span class="text-zinc-400">{fmt(rf.transferAvgMs)}</span>
                  {/if}

                  {#if rf.previewAvgMs !== null}
                    <span class="text-zinc-600">previews</span>
                    <span class="text-zinc-400">{fmt(rf.previewAvgMs)}</span>
                  {/if}

                  {#if rf.videoAvgMs !== null}
                    <span class="text-zinc-600">video harvest</span>
                    <span class="text-zinc-400">{fmt(rf.videoAvgMs)}</span>
                  {/if}
                </div>
              </div>
            {/if}

            <!-- Extra stats -->
            <div class="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[10px] tabular-nums">
              <span class="text-zinc-600">drops@60</span>
              <span class={rf.drops60 > 0 ? 'text-amber-400' : 'text-zinc-400'}>{rf.drops60}</span>

              {#if rf.gpuReadAvgMs !== null}
                <span class="text-zinc-600">gpu read</span>
                <span class="text-zinc-400">{fmt(rf.gpuReadAvgMs)}</span>
              {/if}
            </div>
          {:else}
            <span class="text-zinc-700">no render data yet</span>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
