<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getAllProfilers, type ProfilingStats } from '$lib/utils/ProfilingHelper';
  import { X, ChartColumn } from '@lucide/svelte/icons';
  import { isProfilingMonitorVisible } from '../../stores/ui.store';

  let isVisible = $state(false);
  let profilerStats = $state<Map<string, ProfilingStats>>(new Map());
  let profilerHistory = $state<Map<string, ProfilingStats[]>>(new Map());
  let updateInterval: ReturnType<typeof setInterval> | null = null;
  let subscribedProfilers = new Set<string>(); // Track which profilers we've subscribed to
  let unsubscribers: Array<() => void> = [];

  // Chart dimensions
  const CHART_WIDTH = 540;
  const CHART_HEIGHT = 100;
  const CHART_PADDING = 5;

  function setupProfilers() {
    const profilers = getAllProfilers();

    profilers.forEach((profiler) => {
      const label = profiler.getLabel();

      // Skip if already subscribed
      if (subscribedProfilers.has(label)) return;

      console.log('[ProfilingMonitor] Subscribing to:', label);
      subscribedProfilers.add(label);

      // Get initial stats and history
      const initialStats = profiler.getStats();
      const initialHistory = profiler.getHistory();

      console.log(
        `[ProfilingMonitor] ${label} - has stats: ${!!initialStats}, history length: ${initialHistory.length}`
      );

      if (initialStats) {
        profilerStats.set(label, initialStats);
        profilerStats = new Map(profilerStats); // Trigger reactivity
      }

      if (initialHistory.length > 0) {
        profilerHistory.set(label, initialHistory);
        profilerHistory = new Map(profilerHistory); // Trigger reactivity
      }

      // Subscribe to updates
      const unsub = profiler.onStats((stats) => {
        profilerStats.set(stats.label, stats);
        profilerStats = new Map(profilerStats); // Trigger reactivity

        // Update history
        const history = profiler.getHistory();
        profilerHistory.set(stats.label, history);
        profilerHistory = new Map(profilerHistory); // Trigger reactivity
      });

      unsubscribers.push(unsub);
    });
  }

  function getLineColor(metric: 'mean' | 'median' | 'p95' | 'p99'): string {
    const colors = {
      mean: '#22c55e', // green-500
      median: '#3b82f6', // blue-500
      p95: '#f97316', // orange-500
      p99: '#ef4444' // red-500
    };
    return colors[metric];
  }

  function generateLinePath(
    history: ProfilingStats[],
    metric: 'mean' | 'median' | 'p95' | 'p99',
    maxValue: number
  ): string {
    if (history.length === 0) return '';

    const points = history.map((stats, index) => {
      const x =
        CHART_PADDING +
        (index / Math.max(history.length - 1, 1)) * (CHART_WIDTH - 2 * CHART_PADDING);
      const value = stats[metric];
      const y =
        CHART_HEIGHT - CHART_PADDING - (value / maxValue) * (CHART_HEIGHT - 2 * CHART_PADDING);
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  }

  function getMaxValueForHistory(history: ProfilingStats[]): number {
    let max = 1;
    history.forEach((stats) => {
      max = Math.max(max, stats.mean, stats.median, stats.p95, stats.p99);
    });
    return max;
  }

  onMount(() => {
    setupProfilers();

    // Periodically check for new profilers
    updateInterval = setInterval(setupProfilers, 3000);

    // Listen for profiling stats from worker threads
    const handleWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'profiling-stats' && event.data.stats) {
        const stats = event.data.stats as ProfilingStats;
        profilerStats.set(stats.label, stats);
        profilerStats = new Map(profilerStats); // Trigger reactivity

        // Store history if provided
        if (event.data.history) {
          profilerHistory.set(stats.label, event.data.history);
          profilerHistory = new Map(profilerHistory); // Trigger reactivity
        }
      }
    };

    // Listen on GLSystem's render worker
    const glSystem = (window as any).glSystem;
    if (glSystem?.renderWorker) {
      glSystem.renderWorker.addEventListener('message', handleWorkerMessage);
    }
  });

  onDestroy(() => {
    if (updateInterval) clearInterval(updateInterval);
    unsubscribers.forEach((unsub) => unsub());
    subscribedProfilers.clear();
  });

  function toggleVisibility() {
    isVisible = !isVisible;
  }
</script>

{#if $isProfilingMonitorVisible}
  <!-- Toggle button -->
  <button
    onclick={toggleVisibility}
    class="fixed right-4 bottom-4 z-50 rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-zinc-100 shadow-lg transition-colors hover:bg-zinc-700"
    title="Toggle Profiling Monitor"
  >
    <ChartColumn size={20} />
  </button>

  {#if isVisible}
    <div
      class="fixed right-4 bottom-20 z-50 max-h-[600px] w-[600px] overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl"
    >
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-zinc-700 bg-zinc-800 p-3">
        <div class="flex items-center gap-2">
          <ChartColumn size={18} class="text-zinc-400" />
          <h3 class="text-sm font-semibold text-zinc-100">Performance Profiling</h3>
        </div>

        <button
          onclick={toggleVisibility}
          class="rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
        >
          <X size={16} />
        </button>
      </div>

      <!-- Content -->
      <div class="space-y-3 p-3">
        {#if profilerStats.size === 0}
          <div class="py-8 text-center text-sm text-zinc-500">
            No profiling data available yet
            <div class="mt-2 text-xs text-zinc-600">
              {getAllProfilers().length} profiler(s) registered, waiting for first report...
            </div>
          </div>
        {:else}
          {#each Array.from(profilerStats.values()) as stats (stats.label)}
            {@const history = profilerHistory.get(stats.label) || []}
            {@const maxValue = getMaxValueForHistory(history)}
            <div class="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
              <!-- Label and sample count -->
              <div class="mb-2 flex items-baseline justify-between">
                <span class="text-xs font-medium text-zinc-100">{stats.label}</span>
                <span class="text-xs text-zinc-500">{stats.sampleCount} samples</span>
              </div>

              <!-- Stats grid -->
              <div class="mb-3 grid grid-cols-4 gap-2">
                <div>
                  <div class="mb-1 text-[10px] text-zinc-500 uppercase">Mean</div>
                  <div class="font-mono text-sm" style="color: {getLineColor('mean')}">
                    {stats.mean.toFixed(1)}ms
                  </div>
                </div>
                <div>
                  <div class="mb-1 text-[10px] text-zinc-500 uppercase">Median</div>
                  <div class="font-mono text-sm" style="color: {getLineColor('median')}">
                    {stats.median.toFixed(1)}ms
                  </div>
                </div>
                <div>
                  <div class="mb-1 text-[10px] text-zinc-500 uppercase">P95</div>
                  <div class="font-mono text-sm" style="color: {getLineColor('p95')}">
                    {stats.p95.toFixed(1)}ms
                  </div>
                </div>
                <div>
                  <div class="mb-1 text-[10px] text-zinc-500 uppercase">P99</div>
                  <div class="font-mono text-sm" style="color: {getLineColor('p99')}">
                    {stats.p99.toFixed(1)}ms
                  </div>
                </div>
              </div>

              <!-- Line chart -->
              {#if history.length > 0}
                <div class="mb-2">
                  <svg
                    width={CHART_WIDTH}
                    height={CHART_HEIGHT}
                    class="overflow-visible"
                    viewBox="0 0 {CHART_WIDTH} {CHART_HEIGHT}"
                  >
                    <!-- Background grid lines -->
                    {#each [0.25, 0.5, 0.75] as fraction}
                      <line
                        x1={CHART_PADDING}
                        y1={CHART_HEIGHT -
                          CHART_PADDING -
                          fraction * (CHART_HEIGHT - 2 * CHART_PADDING)}
                        x2={CHART_WIDTH - CHART_PADDING}
                        y2={CHART_HEIGHT -
                          CHART_PADDING -
                          fraction * (CHART_HEIGHT - 2 * CHART_PADDING)}
                        stroke="#3f3f46"
                        stroke-width="1"
                        opacity="0.3"
                      />
                    {/each}

                    <!-- Line paths -->
                    <path
                      d={generateLinePath(history, 'mean', maxValue)}
                      fill="none"
                      stroke={getLineColor('mean')}
                      stroke-width="2"
                    />
                    <path
                      d={generateLinePath(history, 'median', maxValue)}
                      fill="none"
                      stroke={getLineColor('median')}
                      stroke-width="2"
                    />
                    <path
                      d={generateLinePath(history, 'p95', maxValue)}
                      fill="none"
                      stroke={getLineColor('p95')}
                      stroke-width="2"
                    />
                    <path
                      d={generateLinePath(history, 'p99', maxValue)}
                      fill="none"
                      stroke={getLineColor('p99')}
                      stroke-width="2"
                    />
                  </svg>
                </div>

                <!-- Time range indicator -->
                <div class="flex justify-between text-[10px] text-zinc-500">
                  <span>{history.length} data points</span>
                  <span>Max: {maxValue.toFixed(1)}ms</span>
                </div>
              {:else}
                <div class="py-4 text-center text-xs text-zinc-500">
                  Waiting for historical data...
                </div>
              {/if}

              <!-- Min/Max range -->
              <div class="mt-2 flex justify-between text-[10px] text-zinc-500">
                <span>Min: {stats.min.toFixed(1)}ms</span>
                <span>Max: {stats.max.toFixed(1)}ms</span>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
{/if}
